import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AppRole = "admin" | "team_member";
export type ProfileStatus = "active" | "disabled";

export type CurrentProfile = {
  id: string;
  display_name: string | null;
  role: AppRole;
  status: ProfileStatus;
};

export async function requireCurrentIdentity() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, role, status")
    .eq("id", user.id)
    .maybeSingle<CurrentProfile>();

  return { user, profile };
}
