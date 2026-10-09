import "server-only";
import { createClient } from "@supabase/supabase-js";
import { IntegrationConflict, type IntegrationConfig } from "./http";
export function workerConfig(kind: "tasks" | "requests"): IntegrationConfig {
  return { enabled: process.env.NEX_PROVIDER_RECEIVER_ENABLED === "true" ? (kind === "tasks" ? process.env.NEX_PROVIDER_TASKS_ENABLED : process.env.NEX_PROVIDER_REQUESTS_ENABLED) : undefined,
    token: kind === "tasks" ? process.env.NEX_PROVIDER_RECEIVER_TOKEN : process.env.NEX_PROVIDER_REQUESTS_TOKEN,
    databaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL, databaseSecret: process.env.KP_INTEGRATION_SUPABASE_SECRET };
}
export async function workerRpc(config: IntegrationConfig, name: string, args: Record<string, unknown>) {
  const client = createClient(config.databaseUrl!, config.databaseSecret!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.rpc(name, args);
  if (error?.code === "P0001" || error?.code === "23505") throw new IntegrationConflict("Operation not accepted");
  if (error) throw new Error("Nex operations unavailable");
  return data;
}
