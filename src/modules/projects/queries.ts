import { requireActiveIdentity } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import type { ActivityEvent, ProjectRecord } from "./types";

export async function listProjects(): Promise<ProjectRecord[]> {
  await requireActiveIdentity();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("projects")
    .select(
      "id,name,status,phase,health,next_milestone,next_milestone_at,source_system,external_record_id,external_project_url,sync_status,last_synced_at,business:businesses(id,slug,name),organization:organizations(id,name),owner:profiles!owner_id(id,display_name)",
    )
    .is("archived_at", null)
    .neq("status", "cancelled")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`Unable to load projects: ${error.message}`);
  return (data ?? []) as unknown as ProjectRecord[];
}

export async function listRecentActivity(
  limit = 12,
): Promise<ActivityEvent[]> {
  await requireActiveIdentity();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("activity_events")
    .select(
      "id,event_type,source,summary,occurred_at,metadata,project_id,opportunity_id,task_id,decision_id,business:businesses(id,slug,name),actor:profiles!actor_user_id(id,display_name),organization:organizations(id,name)",
    )
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (error)
    throw new Error(`Unable to load activity: ${error.message}`);
  return (data ?? []) as unknown as ActivityEvent[];
}

export async function listProjectFormOptions() {
  await requireActiveIdentity();
  const supabase = await createClient();

  const [
    { data: businesses, error: businessError },
    { data: organizations, error: orgError },
  ] = await Promise.all([
    supabase.from("businesses").select("id,slug,name,is_active").order("name"),
    supabase
      .from("organizations")
      .select("id,name")
      .is("archived_at", null)
      .order("name"),
  ]);

  if (businessError) throw new Error(businessError.message);
  if (orgError) throw new Error(orgError.message);

  return {
    businesses: businesses ?? [],
    organizations: organizations ?? [],
  };
}
