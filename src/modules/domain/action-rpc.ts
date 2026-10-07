import { z } from "zod";
import { requireActiveIdentity } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

export type DomainActionSource = "ui" | "site_tools";

const requestKeySchema = z.string().trim().min(1).max(200);

export async function callIdempotentDomainRpc<T>({
  functionName,
  source,
  requestKey,
  payload,
}: {
  functionName:
    | "kp_create_task"
    | "kp_create_organization"
    | "kp_create_person"
    | "kp_create_opportunity"
    | "kp_create_project"
    | "kp_create_decision"
    | "kp_add_note";
  source: DomainActionSource;
  requestKey: string;
  payload: Record<string, unknown>;
}): Promise<T> {
  await requireActiveIdentity();

  const key = requestKeySchema.parse(requestKey);
  const supabase = await createClient();

  const { data, error } = await supabase.rpc(functionName, {
    p_source: source,
    p_request_key: key,
    p_payload: payload,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`${functionName} returned an invalid result.`);
  }

  return data as T;
}
