import { createClient } from "@supabase/supabase-js";
import { ProviderEventConflict, receiveProviderRequest } from "@/modules/integrations/nex/receiver";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const config = {
    enabled: process.env.NEX_PROVIDER_RECEIVER_ENABLED,
    token: process.env.NEX_PROVIDER_RECEIVER_TOKEN,
    databaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    databaseSecret: process.env.KP_INTEGRATION_SUPABASE_SECRET,
  };
  return receiveProviderRequest(request, config, async event => {
    const client = createClient(config.databaseUrl!, config.databaseSecret!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.rpc("kp_receive_nex_provider", { p_envelope: event });
    if (error?.code === "P0001" || error?.code === "23505") throw new ProviderEventConflict("Provider event not accepted");
    if (error || typeof data !== "string") throw new Error("Provider receiver unavailable");
    return data;
  });
}
