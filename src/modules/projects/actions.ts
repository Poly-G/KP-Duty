"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCurrentIdentity } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();
const statusSchema = z.enum([
  "planned",
  "active",
  "waiting",
  "blocked",
  "complete",
  "cancelled",
]);

const optionalText = (value: FormDataEntryValue | null) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
};

export async function createProject(formData: FormData) {
  const { user } = await requireCurrentIdentity();
  const supabase = await createClient();

  const name = z.string().trim().min(1).parse(formData.get("name"));
  const businessId = uuid.parse(formData.get("business_id"));
  const organizationRaw = optionalText(formData.get("organization_id"));
  const organizationId = organizationRaw ? uuid.parse(organizationRaw) : null;
  const phase = optionalText(formData.get("phase"));
  const nextMilestone = optionalText(formData.get("next_milestone"));
  const externalProjectUrl = optionalText(formData.get("external_project_url"));
  const sourceSystem = optionalText(formData.get("source_system")) || "kp";

  const { error } = await supabase.from("projects").insert({
    business_id: businessId,
    organization_id: organizationId,
    name,
    owner_id: user.id,
    status: "planned",
    phase,
    next_milestone: nextMilestone,
    external_project_url: externalProjectUrl,
    source_system: sourceSystem,
    sync_status: "manual",
  });

  if (error) throw new Error(error.message);

  revalidatePath("/projects");
  revalidatePath("/");
}

export async function setProjectStatus(projectId: string, status: string) {
  await requireCurrentIdentity();
  const supabase = await createClient();

  const id = uuid.parse(projectId);
  const nextStatus = statusSchema.parse(status);

  const { error } = await supabase
    .from("projects")
    .update({ status: nextStatus })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/projects");
  revalidatePath("/");
}
