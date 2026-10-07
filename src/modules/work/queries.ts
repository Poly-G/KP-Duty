import { requireCurrentIdentity } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { sortWorkTasks, type WorkTask } from "./types";

export async function listMyWork(): Promise<WorkTask[]> {
  const { user } = await requireCurrentIdentity();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select(
      "id,title,what_this_is,why_it_matters,owner_id,stage,availability,priority,due_at,next_action,finished_when,waiting_on,reference_url,position,finished_at,business:businesses(id,slug,name)",
    )
    .eq("owner_id", user.id)
    .is("archived_at", null);

  if (error) {
    throw new Error(`Unable to load work: ${error.message}`);
  }

  return sortWorkTasks((data ?? []) as unknown as WorkTask[]);
}
