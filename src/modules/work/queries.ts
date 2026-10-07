import {
  requireActiveIdentity,
  requireAdminIdentity,
} from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import {
  sortWorkTasks,
  type TeamWorkTask,
  type WorkTask,
} from "./types";

const workSelect =
  "id,reference_code,title,what_this_is,why_it_matters,instructions,notes,owner_id,stage,availability,priority,due_at,next_action,finished_when,waiting_on,reference_url,position,finished_at,business:businesses(id,slug,name)";

export async function listMyWork(): Promise<WorkTask[]> {
  const { user, profile } = await requireActiveIdentity();
  const supabase = await createClient();

  let query = supabase
    .from("tasks")
    .select(workSelect)
    .is("archived_at", null);

  query =
    profile.role === "admin"
      ? query.or(`owner_id.eq.${user.id},owner_id.is.null`)
      : query.eq("owner_id", user.id);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Unable to load work: ${error.message}`);
  }

  return sortWorkTasks((data ?? []) as unknown as WorkTask[]);
}

export async function listTeamWork(): Promise<TeamWorkTask[]> {
  await requireAdminIdentity();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select(
      `${workSelect},owner:profiles!owner_id(id,display_name)`,
    )
    .is("archived_at", null);

  if (error) {
    throw new Error(`Unable to load team work: ${error.message}`);
  }

  return sortWorkTasks((data ?? []) as unknown as TeamWorkTask[]);
}

export async function listActiveTeamMembers() {
  await requireAdminIdentity();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id,display_name,role,status")
    .eq("status", "active")
    .order("display_name");

  if (error) {
    throw new Error(`Unable to load team members: ${error.message}`);
  }

  return data ?? [];
}
