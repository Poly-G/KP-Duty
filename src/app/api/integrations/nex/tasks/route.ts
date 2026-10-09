import { receiveOperation } from "@/modules/integrations/nex/http";
import { parseTaskEnvelope } from "@/modules/integrations/nex/operations-contract";
import { workerConfig, workerRpc } from "@/modules/integrations/nex/worker-client";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const config = workerConfig("tasks");
  return receiveOperation(request, config, parseTaskEnvelope, async event => {
    const result = await workerRpc(config, "kp_receive_nex_task", { p_envelope: event });
    if (!["applied", "stale", "duplicate"].includes(result)) throw new Error("Unexpected task result");
    return result;
  });
}
