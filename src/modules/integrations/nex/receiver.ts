import { createHash, timingSafeEqual } from "node:crypto";
import { parseProviderEnvelope } from "./provider-contract.ts";

export type ReceiverConfig = { enabled?: string; operationsEnabled?: string; token?: string; databaseUrl?: string; databaseSecret?: string };
export class ProviderEventConflict extends Error {}
export function receiverReady(config: ReceiverConfig): boolean {
  return config.enabled === "true" && (config.token?.length ?? 0) >= 32 && !!config.databaseUrl && !!config.databaseSecret;
}

/** Authenticated before body reads; bounded stream prevents unbounded JSON allocation. */
export async function receiveProviderRequest(request: Request, config: ReceiverConfig, ingest: (event: ReturnType<typeof parseProviderEnvelope>) => Promise<string>): Promise<Response> {
  if (!receiverReady(config)) return Response.json({ error: "Receiver inactive" }, { status: 503 });
  const supplied = request.headers.get("authorization") ?? "";
  const digest = (s: string) => createHash("sha256").update(s).digest();
  if (supplied.length > 512 || !timingSafeEqual(digest(supplied), digest(`Bearer ${config.token}`))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return Response.json({ error: "JSON required" }, { status: 415 });
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ error: "Invalid provider envelope" }, { status: 400 });
  const chunks: Uint8Array[] = []; let size = 0;
  let event: ReturnType<typeof parseProviderEnvelope>;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (size > 8192) { await reader.cancel(); return Response.json({ error: "Envelope too large" }, { status: 413 }); }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    event = parseProviderEnvelope(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
  } catch { return Response.json({ error: "Invalid provider envelope" }, { status: 400 }); }
  if (event.schemaVersion === 2 && config.operationsEnabled !== "true") return Response.json({ error: "Operating updates inactive" }, { status: 503 });
  try {
    const result = await ingest(event);
    if (!["applied", "stale", "duplicate"].includes(result)) throw new Error("Unexpected receiver result");
    return Response.json({ result });
  } catch (error) {
    // No incoming payload or database error details in response/logs.
    // Producer retains the event and alerts staff; never drop an unacknowledged event.
    return Response.json({ error: "Provider event not accepted" }, { status: error instanceof ProviderEventConflict ? 409 : 503 });
  }
}
