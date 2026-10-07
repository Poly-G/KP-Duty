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

export async function requireActiveIdentity() {
  const identity = await requireCurrentIdentity();

  if (!identity.profile) {
    throw new Error("KP Duty profile is not configured.");
  }

  if (identity.profile.status !== "active") {
    throw new Error("KP Duty account is disabled.");
  }

  return {
    user: identity.user,
    profile: identity.profile,
  };
}

export async function requireAdminIdentity() {
  const identity = await requireActiveIdentity();

  if (identity.profile.role !== "admin") {
    throw new Error("Admin permission required.");
  }

  return identity;
}
