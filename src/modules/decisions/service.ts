import { z } from "zod";
import { requireActiveIdentity } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import {
  callIdempotentDomainRpc,
  type DomainActionSource,
} from "@/modules/domain/action-rpc";
import type { TaskPriority } from "@/modules/work/types";
import type { DecisionStatus } from "./types";

const uuid = z.string().uuid();

export const createDecisionInputSchema = z.object({
  title: z.string().trim().min(1),
  businessSlug: z.string().trim().nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
  mode: z.enum(["individual", "joint"]).optional(),
  priority: z.enum(["critical", "high", "normal", "low"]).optional(),
  domain: z.string().trim().nullable().optional(),
  neededBy: z.string().date().nullable().optional(),
  context: z.string().trim().nullable().optional(),
  recommendation: z.string().trim().nullable().optional(),
  revisitTrigger: z.string().trim().nullable().optional(),
});

export type CreateDecisionInput = z.infer<typeof createDecisionInputSchema>;

export type CreatedDecision = {
  id: string;
  title: string;
  businessId: string | null;
  ownerId: string;
  mode: "individual" | "joint";
  status: DecisionStatus;
  priority: TaskPriority;
  neededBy: string | null;
  domain: string | null;
};

export async function createDecisionRecord({
  input,
  source,
  requestKey,
}: {
  input: CreateDecisionInput;
  source: DomainActionSource;
  requestKey: string;
}): Promise<CreatedDecision> {
  return callIdempotentDomainRpc<CreatedDecision>({
    functionName: "kp_create_decision",
    source,
    requestKey,
    payload: createDecisionInputSchema.parse(input),
  });
}

export type DecisionMutationResult = {
  id: string;
  title: string;
  status: DecisionStatus;
  final_decision: string | null;
  effective_date: string | null;
  resolved_at: string | null;
};

export async function setDecisionStatusRecord(
  decisionId: string,
  status: Exclude<DecisionStatus, "resolved">,
): Promise<DecisionMutationResult> {
  const id = uuid.parse(decisionId);
  const nextStatus = z
    .enum(["open", "discussing", "deferred", "superseded"])
    .parse(status);
  await requireActiveIdentity();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("decisions")
    .update({ status: nextStatus })
    .eq("id", id)
    .select("id,title,status,final_decision,effective_date,resolved_at")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Decision not found.");

  return data as DecisionMutationResult;
}

export async function resolveDecisionRecord(
  decisionId: string,
  finalDecision: string,
  effectiveDate?: string | null,
): Promise<DecisionMutationResult> {
  const id = uuid.parse(decisionId);
  const outcome = z.string().trim().min(1).parse(finalDecision);
  const date = z.string().date().nullable().optional().parse(effectiveDate);
  await requireActiveIdentity();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("decisions")
    .update({
      status: "resolved",
      final_decision: outcome,
      effective_date: date ?? new Date().toISOString().slice(0, 10),
    })
    .eq("id", id)
    .select("id,title,status,final_decision,effective_date,resolved_at")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Decision not found.");

  return data as DecisionMutationResult;
}
