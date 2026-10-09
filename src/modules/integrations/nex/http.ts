import { createHash, timingSafeEqual } from "node:crypto";
export type IntegrationConfig = { enabled?: string; token?: string; databaseUrl?: string; databaseSecret?: string };
export function integrationReady(config: IntegrationConfig): boolean {
  return config.enabled === "true" && (config.token?.length ?? 0) >= 32 && !!config.databaseUrl && !!config.databaseSecret;
}
export function authorizeIntegration(request: Request, config: IntegrationConfig): Response | null {
  if (!integrationReady(config)) return Response.json({ error: "Receiver inactive" }, { status: 503 });
  const supplied = request.headers.get("authorization") ?? "";
  const digest = (s: string) => createHash("sha256").update(s).digest();
  if (supplied.length > 512 || !timingSafeEqual(digest(supplied), digest(`Bearer ${config.token}`))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return null;
}
export async function boundedJson(request: Request): Promise<unknown | Response> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return Response.json({ error: "JSON required" }, { status: 415 });
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ error: "Invalid envelope" }, { status: 400 });
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (size > 8192) { await reader.cancel(); return Response.json({ error: "Envelope too large" }, { status: 413 }); }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch { return Response.json({ error: "Invalid envelope" }, { status: 400 }); }
}
export class IntegrationConflict extends Error {}
export async function receiveOperation<T>(request: Request, config: IntegrationConfig, parse: (v: unknown) => T, apply: (v: T) => Promise<unknown>): Promise<Response> {
  const denial = authorizeIntegration(request, config); if (denial) return denial;
  const body = await boundedJson(request); if (body instanceof Response) return body;
  let parsed: T;
  try { parsed = parse(body); } catch { return Response.json({ error: "Invalid envelope" }, { status: 400 }); }
  try { return Response.json({ result: await apply(parsed) }, { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { return Response.json({ error: "Operation not accepted" }, { status: error instanceof IntegrationConflict ? 409 : 503 }); }
}
