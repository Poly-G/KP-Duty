"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  createProjectRecord,
  updateProjectRecord,
} from "./service";

const uuid = z.string().uuid();

const optionalText = (value: FormDataEntryValue | null) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
};

function refreshProjects() {
  revalidatePath("/projects");
  revalidatePath("/");
}

export async function createProject(formData: FormData) {
  const businessId = uuid.parse(formData.get("business_id"));
  const supabase = await createClient();

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("slug")
    .eq("id", businessId)
    .maybeSingle();

  if (businessError) throw new Error(businessError.message);
  if (!business) throw new Error("Selected business was not found.");

  const organizationRaw = optionalText(formData.get("organization_id"));

  const result = await createProjectRecord({
    source: "ui",
    requestKey: crypto.randomUUID(),
    input: {
      name: z.string().trim().min(1).parse(formData.get("name")),
      businessSlug: business.slug,
      organizationId: organizationRaw ? uuid.parse(organizationRaw) : null,
      phase: optionalText(formData.get("phase")),
      nextMilestone: optionalText(formData.get("next_milestone")),
      externalProjectUrl: optionalText(formData.get("external_project_url")),
    },
  });

  refreshProjects();
  return result;
}

export async function setProjectStatus(projectId: string, status: string) {
  const nextStatus = z
    .enum(["planned", "active", "waiting", "blocked", "complete", "cancelled"])
    .parse(status);

  const result = await updateProjectRecord(projectId, {
    status: nextStatus,
  });

  refreshProjects();
  return result;
}
