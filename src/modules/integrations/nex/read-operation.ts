import { authorizeIntegration, type IntegrationConfig } from "./http.ts";
import { parseCursor } from "./operations-contract.ts";
export async function readOperation(request: Request, config: IntegrationConfig, read: (cursor: string | null) => Promise<unknown>): Promise<Response> {
  const denial = authorizeIntegration(request, config); if (denial) return denial;
  let cursor: string | null;
  try { cursor = parseCursor(request); } catch { return Response.json({ error: "Invalid cursor" }, { status: 400 }); }
  try {
    const items = await read(cursor);
    if (!Array.isArray(items) || items.length > 100) throw new Error("Invalid page");
    // Start a fresh pass after null; pending requests are redelivered until acknowledged.
    const last = items.at(-1);
    const next = items.length === 100 ? (last.requestId ?? last.attemptId) : null;
    return Response.json({ items, next }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Operations unavailable" }, { status: 503 }); }
}
