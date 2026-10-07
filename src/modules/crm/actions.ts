"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCurrentIdentity } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();
const optionalText = (value: FormDataEntryValue | null) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
};

function domainFromWebsite(website: string | null) {
  if (!website) return null;

  try {
    const normalized = website.match(/^https?:\/\//)
      ? website
      : `https://${website}`;
    return new URL(normalized).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export async function createOrganization(formData: FormData) {
  await requireCurrentIdentity();
  const supabase = await createClient();

  const name = z.string().trim().min(1).parse(formData.get("name"));
  const website = optionalText(formData.get("website"));
  const publicEmail = optionalText(formData.get("public_email"));
  const phone = optionalText(formData.get("phone"));
  const city = optionalText(formData.get("city"));
  const state = optionalText(formData.get("state"));

  const { error } = await supabase.from("organizations").insert({
    name,
    website,
    domain: domainFromWebsite(website),
    public_email: publicEmail,
    phone,
    city,
    state,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/crm/companies");
  revalidatePath("/crm");
}

export async function createPerson(formData: FormData) {
  await requireCurrentIdentity();
  const supabase = await createClient();

  const firstName = z.string().trim().min(1).parse(formData.get("first_name"));
  const lastName = optionalText(formData.get("last_name"));
  const email = optionalText(formData.get("email"));
  const title = optionalText(formData.get("title"));
  const organizationRaw = optionalText(formData.get("organization_id"));
  const organizationId = organizationRaw ? uuid.parse(organizationRaw) : null;

  const { error } = await supabase.from("people").insert({
    first_name: firstName,
    last_name: lastName,
    email,
    title,
    organization_id: organizationId,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/crm/people");
}

export async function createOpportunity(formData: FormData) {
  const { user } = await requireCurrentIdentity();
  const supabase = await createClient();

  const name = z.string().trim().min(1).parse(formData.get("name"));
  const businessId = uuid.parse(formData.get("business_id"));
  const pipelineId = uuid.parse(formData.get("pipeline_id"));
  const stageId = uuid.parse(formData.get("stage_id"));

  const organizationRaw = optionalText(formData.get("organization_id"));
  const organizationId = organizationRaw ? uuid.parse(organizationRaw) : null;

  const source = optionalText(formData.get("source"));
  const sourceUrl = optionalText(formData.get("source_url"));
  const nextAction = optionalText(formData.get("next_action"));
  const businessSlug = z.string().trim().min(1).parse(formData.get("business_slug"));

  const { error } = await supabase.from("opportunities").insert({
    name,
    business_id: businessId,
    pipeline_id: pipelineId,
    stage_id: stageId,
    organization_id: organizationId,
    owner_id: user.id,
    source,
    source_url: sourceUrl,
    next_action: nextAction,
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/crm/${businessSlug}`);
}

export async function moveOpportunityStage(
  opportunityId: string,
  stageId: string,
  businessSlug: string,
) {
  await requireCurrentIdentity();
  const supabase = await createClient();

  const id = uuid.parse(opportunityId);
  const nextStageId = uuid.parse(stageId);

  const { error } = await supabase
    .from("opportunities")
    .update({ stage_id: nextStageId })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath(`/crm/${businessSlug}`);
}
