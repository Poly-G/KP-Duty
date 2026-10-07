"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  createOpportunityRecord,
  createOrganizationRecord,
  createPersonRecord,
  moveOpportunityToStage,
} from "./service";

const uuid = z.string().uuid();

const optionalText = (value: FormDataEntryValue | null) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
};

function refreshCrm(businessSlug?: string) {
  revalidatePath("/crm");
  revalidatePath("/crm/companies");
  revalidatePath("/crm/people");
  if (businessSlug) revalidatePath(`/crm/${businessSlug}`);
}

export async function createOrganization(formData: FormData) {
  const result = await createOrganizationRecord({
    source: "ui",
    requestKey: crypto.randomUUID(),
    input: {
      name: z.string().trim().min(1).parse(formData.get("name")),
      website: optionalText(formData.get("website")),
      publicEmail: optionalText(formData.get("public_email")),
      phone: optionalText(formData.get("phone")),
      city: optionalText(formData.get("city")),
      state: optionalText(formData.get("state")),
    },
  });

  refreshCrm();
  void result;
}

export async function createPerson(formData: FormData) {
  const organizationRaw = optionalText(formData.get("organization_id"));

  const result = await createPersonRecord({
    source: "ui",
    requestKey: crypto.randomUUID(),
    input: {
      firstName: z.string().trim().min(1).parse(formData.get("first_name")),
      lastName: optionalText(formData.get("last_name")),
      email: optionalText(formData.get("email")),
      title: optionalText(formData.get("title")),
      organizationId: organizationRaw ? uuid.parse(organizationRaw) : null,
    },
  });

  refreshCrm();
  void result;
}

export async function createOpportunity(formData: FormData) {
  const businessSlug = z
    .string()
    .trim()
    .min(1)
    .parse(formData.get("business_slug"));
  const stageId = uuid.parse(formData.get("stage_id"));

  const supabase = await createClient();
  const { data: stage, error: stageError } = await supabase
    .from("pipeline_stages")
    .select("slug")
    .eq("id", stageId)
    .maybeSingle();

  if (stageError) throw new Error(stageError.message);
  if (!stage) throw new Error("Selected pipeline stage was not found.");

  const organizationRaw = optionalText(formData.get("organization_id"));

  const result = await createOpportunityRecord({
    source: "ui",
    requestKey: crypto.randomUUID(),
    input: {
      name: z.string().trim().min(1).parse(formData.get("name")),
      businessSlug,
      stageSlug: stage.slug,
      organizationId: organizationRaw ? uuid.parse(organizationRaw) : null,
      source: optionalText(formData.get("source")),
      sourceUrl: optionalText(formData.get("source_url")),
      nextAction: optionalText(formData.get("next_action")),
    },
  });

  refreshCrm(businessSlug);
  void result;
}

export async function moveOpportunityStage(
  opportunityId: string,
  stageId: string,
  businessSlug: string,
) {
  const result = await moveOpportunityToStage(opportunityId, stageId);
  refreshCrm(z.string().trim().min(1).parse(businessSlug));
  return result;
}
