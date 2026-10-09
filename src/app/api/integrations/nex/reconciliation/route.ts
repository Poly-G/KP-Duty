import { readOperation } from "@/modules/integrations/nex/read-operation";
import { workerConfig, workerRpc } from "@/modules/integrations/nex/worker-client";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const config = workerConfig("requests");
  return readOperation(request, config, cursor => workerRpc(config, "kp_export_nex_reconciliation", { p_after: cursor }));
}
