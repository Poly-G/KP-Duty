import { z } from "zod";
import {
  requireActiveIdentity,
  requireAdminIdentity,
} from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import {
  callIdempotentDomainRpc,
  type DomainActionSource,
} from "@/modules/domain/action-rpc";
import type { TaskPriority } from "@/modules/work/types";

const uuid = z.string().uuid();

export function domainFromWebsite(website: string | null | undefined) {
  if (!website) return null;

  try {
    const normalized = /^https?:\/\//i.test(website)
      ? website
      : `https://${website}`;
    return new URL(normalized).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export const createOrganizationInputSchema = z.object({
  name: z.string().trim().min(1),
  website: z.string().trim().nullable().optional(),
  publicEmail: z.string().email().nullable().optional(),
  phone: z.string().trim().nullable().optional(),
  city: z.string().trim().nullable().optional(),
  state: z.string().trim().nullable().optional(),
  country: z.string().trim().nullable().optional(),
  description: z.string().trim().nullable().optional(),
});

export type CreateOrganizationInput = z.infer<
  typeof createOrganizationInputSchema
>;

export type CreatedOrganization = {
  id: string;
  name: string;
  website: string | null;
  domain: string | null;
  publicEmail: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
};

export async function createOrganizationRecord({
  input,
  source,
  requestKey,
}: {
  input: CreateOrganizationInput;
  source: DomainActionSource;
  requestKey: string;
}): Promise<CreatedOrganization> {
  const parsed = createOrganizationInputSchema.parse(input);

  return callIdempotentDomainRpc<CreatedOrganization>({
    functionName: "kp_create_organization",
    source,
    requestKey,
    payload: {
      ...parsed,
      domain: domainFromWebsite(parsed.website),
    },
  });
}

export const createPersonInputSchema = z.object({
  organizationId: z.string().uuid().nullable().optional(),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().trim().nullable().optional(),
  title: z.string().trim().nullable().optional(),
  linkedinUrl: z.string().url().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

export type CreatePersonInput = z.infer<typeof createPersonInputSchema>;

export type CreatedPerson = {
  id: string;
  organizationId: string | null;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  linkedinUrl: string | null;
};

export async function createPersonRecord({
  input,
  source,
  requestKey,
}: {
  input: CreatePersonInput;
  source: DomainActionSource;
  requestKey: string;
}): Promise<CreatedPerson> {
  return callIdempotentDomainRpc<CreatedPerson>({
    functionName: "kp_create_person",
    source,
    requestKey,
    payload: createPersonInputSchema.parse(input),
  });
}

export const createOpportunityInputSchema = z.object({
  name: z.string().trim().min(1),
  businessSlug: z.string().trim().min(1),
  stageSlug: z.string().trim().nullable().optional(),
  organizationId: z.string().uuid().nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
  source: z.string().trim().nullable().optional(),
  sourceUrl: z.string().url().nullable().optional(),
  priority: z.enum(["critical", "high", "normal", "low"]).optional(),
  amountCents: z.number().int().nonnegative().nullable().optional(),
  currency: z.string().trim().length(3).optional(),
  nextAction: z.string().trim().nullable().optional(),
  nextActionAt: z.string().datetime({ offset: true }).nullable().optional(),
});

export type CreateOpportunityInput = z.infer<
  typeof createOpportunityInputSchema
>;

export type CreatedOpportunity = {
  id: string;
  name: string;
  businessId: string;
  pipelineId: string;
  stageId: string;
  organizationId: string | null;
  ownerId: string | null;
  priority: TaskPriority;
  nextAction: string | null;
  nextActionAt: string | null;
};

export async function createOpportunityRecord({
  input,
  source,
  requestKey,
}: {
  input: CreateOpportunityInput;
  source: DomainActionSource;
  requestKey: string;
}): Promise<CreatedOpportunity> {
  return callIdempotentDomainRpc<CreatedOpportunity>({
    functionName: "kp_create_opportunity",
    source,
    requestKey,
    payload: createOpportunityInputSchema.parse(input),
  });
}

export type OpportunityMutationResult = {
  id: string;
  name: string;
  stage_id: string;
  owner_id: string | null;
  priority: TaskPriority;
  next_action: string | null;
  next_action_at: string | null;
};

export async function moveOpportunityToStage(
  opportunityId: string,
  stageId: string,
): Promise<OpportunityMutationResult> {
  const id = uuid.parse(opportunityId);
  const nextStageId = uuid.parse(stageId);
  await requireActiveIdentity();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("opportunities")
    .update({ stage_id: nextStageId })
    .eq("id", id)
    .is("archived_at", null)
    .select(
      "id,name,stage_id,owner_id,priority,next_action,next_action_at",
    )
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Opportunity not found.");

  return data as OpportunityMutationResult;
}

export async function moveOpportunityToStageSlug(
  opportunityId: string,
  stageSlug: string,
): Promise<OpportunityMutationResult> {
  const id = uuid.parse(opportunityId);
  const slug = z.string().trim().min(1).parse(stageSlug);
  await requireActiveIdentity();
  const supabase = await createClient();

  const { data: opportunity, error: opportunityError } = await supabase
    .from("opportunities")
    .select("id,pipeline_id")
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();

  if (opportunityError) throw new Error(opportunityError.message);
  if (!opportunity) throw new Error("Opportunity not found.");

  const { data: stage, error: stageError } = await supabase
    .from("pipeline_stages")
    .select("id")
    .eq("pipeline_id", opportunity.pipeline_id)
    .eq("slug", slug)
    .maybeSingle();

  if (stageError) throw new Error(stageError.message);
  if (!stage) throw new Error("Stage not found in this opportunity's pipeline.");

  return moveOpportunityToStage(id, stage.id);
}

export async function updateOpportunity(
  opportunityId: string,
  patch: {
    priority?: TaskPriority;
    nextAction?: string | null;
    nextActionAt?: string | null;
  },
): Promise<OpportunityMutationResult> {
  const id = uuid.parse(opportunityId);
  await requireActiveIdentity();

  const parsed = z
    .object({
      priority: z.enum(["critical", "high", "normal", "low"]).optional(),
      nextAction: z.string().trim().nullable().optional(),
      nextActionAt: z.string().datetime({ offset: true }).nullable().optional(),
    })
    .parse(patch);

  const dbPatch: Record<string, unknown> = {};
  if (parsed.priority !== undefined) dbPatch.priority = parsed.priority;
  if (parsed.nextAction !== undefined) dbPatch.next_action = parsed.nextAction;
  if (parsed.nextActionAt !== undefined)
    dbPatch.next_action_at = parsed.nextActionAt;

  if (!Object.keys(dbPatch).length) {
    throw new Error("No opportunity changes were provided.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("opportunities")
    .update(dbPatch)
    .eq("id", id)
    .is("archived_at", null)
    .select(
      "id,name,stage_id,owner_id,priority,next_action,next_action_at",
    )
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Opportunity not found.");

  return data as OpportunityMutationResult;
}

export async function assignOpportunity(
  opportunityId: string,
  ownerId: string | null,
): Promise<OpportunityMutationResult> {
  const id = uuid.parse(opportunityId);
  const owner = z.string().uuid().nullable().parse(ownerId);
  await requireAdminIdentity();
  const supabase = await createClient();

  if (owner) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", owner)
      .eq("status", "active")
      .maybeSingle();

    if (profileError) throw new Error(profileError.message);
    if (!profile) throw new Error("Assigned owner is not an active KP member.");
  }

  const { data, error } = await supabase
    .from("opportunities")
    .update({ owner_id: owner })
    .eq("id", id)
    .is("archived_at", null)
    .select(
      "id,name,stage_id,owner_id,priority,next_action,next_action_at",
    )
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Opportunity not found.");

  return data as OpportunityMutationResult;
}
