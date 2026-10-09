import { receiveOperation } from "@/modules/integrations/nex/http";
import { readOperation } from "@/modules/integrations/nex/read-operation";
import { parseRequestOutcome } from "@/modules/integrations/nex/operations-contract";
import { workerConfig, workerRpc } from "@/modules/integrations/nex/worker-client";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const config = workerConfig("requests");
  return readOperation(request, config, cursor => workerRpc(config, "kp_poll_nex_requests", { p_after: cursor }));
}
export async function POST(request: Request) {
  const config = workerConfig("requests");
  return receiveOperation(request, config, parseRequestOutcome, async outcome => {
    await workerRpc(config, "kp_ack_nex_request", { p_id: outcome.requestId, p_status: outcome.status, p_code: outcome.code });
    return "recorded";
  });
}
