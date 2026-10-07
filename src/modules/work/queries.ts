import { requireCurrentIdentity } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { sortWorkTasks, type WorkTask } from "./types";

export type WorkProfileOption = {
  id: string;
  display_name: string | null;
};

export type WorkBusinessOption = {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
};

export async function listMyWork(): Promise<WorkTask[]> {
  const { user, profile } = await requireCurrentIdentity();
  const supabase = await createClient();

  let query = supabase
    .from("tasks")
    .select(
      "id,reference_code,title,what_this_is,why_it_matters,instructions,notes,owner_id,stage,availability,priority,due_at,next_action,finished_when,waiting_on,reference_url,position,finished_at,business:businesses(id,slug,name)",
    )
    .is("archived_at", null);

  query =
    profile?.role === "admin"
      ? query.or(`owner_id.eq.${user.id},owner_id.is.null`)
      : query.eq("owner_id", user.id);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Unable to load work: ${error.message}`);
  }

  return sortWorkTasks((data ?? []) as unknown as WorkTask[]);
}

export async function getWorkOptions() {
  const { user, profile } = await requireCurrentIdentity();
  const supabase = await createClient();

  const [{ data: businesses, error: businessError }, profileResult] =
    await Promise.all([
      supabase
        .from("businesses")
        .select("id,slug,name,is_active")
        .order("name"),
      profile?.role === "admin"
        ? supabase
            .from("profiles")
            .select("id,display_name")
            .eq("status", "active")
            .order("display_name")
        : Promise.resolve({
            data: [
              {
                id: user.id,
                display_name: profile?.display_name ?? user.email ?? "Me",
              },
            ],
            error: null,
          }),
    ]);

  if (businessError) {
    throw new Error(`Unable to load businesses: ${businessError.message}`);
  }

  if (profileResult.error) {
    throw new Error(`Unable to load owners: ${profileResult.error.message}`);
  }

  return {
    isAdmin: profile?.role === "admin",
    currentUserId: user.id,
    businesses: (businesses ?? []) as WorkBusinessOption[],
    profiles: (profileResult.data ?? []) as WorkProfileOption[],
  };
}
