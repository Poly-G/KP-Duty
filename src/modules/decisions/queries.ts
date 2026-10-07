import { requireActiveIdentity } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import type { DecisionRecord } from "./types";

export async function listDecisions(): Promise<DecisionRecord[]> {
  await requireActiveIdentity();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("decisions")
    .select(
      "id,title,domain,mode,status,request_kind,request_impact,request_page,assistant_recommendation,recommendation_reviewed_at,requester:profiles!created_by(id,display_name),priority,needed_by,context,recommendation,final_decision,effective_date,revisit_trigger,resolved_at,business:businesses(id,name,slug),owner:profiles!owner_id(id,display_name)",
    )
    .order("created_at", { ascending: false });

  if (error)
    throw new Error(`Unable to load decisions: ${error.message}`);
  return (data ?? []) as unknown as DecisionRecord[];
}

export async function listDecisionBusinesses() {
  await requireActiveIdentity();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("id,name,slug")
    .eq("is_active", true)
    .order("name");

  if (error) throw new Error(error.message);
  return data ?? [];
}
