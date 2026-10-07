import { z } from "zod";
import { requireActiveIdentity } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import {
  callIdempotentDomainRpc,
  type DomainActionSource,
} from "@/modules/domain/action-rpc";
import type { ProjectHealth, ProjectStatus } from "./types";

const uuid = z.string().uuid();

export const createProjectInputSchema = z.object({
  name: z.string().trim().min(1),
  businessSlug: z.string().trim().min(1),
  organizationId: z.string().uuid().nullable().optional(),
  opportunityId: z.string().uuid().nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
  phase: z.string().trim().nullable().optional(),
  nextMilestone: z.string().trim().nullable().optional(),
  nextMilestoneAt: z.string().datetime({ offset: true }).nullable().optional(),
  externalProjectUrl: z.string().url().nullable().optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;

export type CreatedProject = {
  id: string;
  name: string;
  businessId: string;
  organizationId: string | null;
  opportunityId: string | null;
  ownerId: string;
  status: ProjectStatus;
  phase: string | null;
  health: ProjectHealth;
  nextMilestone: string | null;
  nextMilestoneAt: string | null;
};

export async function createProjectRecord({
  input,
  source,
  requestKey,
}: {
  input: CreateProjectInput;
  source: DomainActionSource;
  requestKey: string;
}): Promise<CreatedProject> {
  return callIdempotentDomainRpc<CreatedProject>({
    functionName: "kp_create_project",
    source,
    requestKey,
    payload: createProjectInputSchema.parse(input),
  });
}

export type ProjectMutationResult = {
  id: string;
  name: string;
  status: ProjectStatus;
  phase: string | null;
  health: ProjectHealth;
  next_milestone: string | null;
  next_milestone_at: string | null;
};

export async function updateProjectRecord(
  projectId: string,
  patch: {
    status?: ProjectStatus;
    phase?: string | null;
    health?: Exclude<ProjectHealth, "complete">;
    nextMilestone?: string | null;
    nextMilestoneAt?: string | null;
  },
): Promise<ProjectMutationResult> {
  const id = uuid.parse(projectId);
  await requireActiveIdentity();

  const parsed = z
    .object({
      status: z
        .enum(["planned", "active", "waiting", "blocked", "complete", "cancelled"])
        .optional(),
      phase: z.string().trim().nullable().optional(),
      health: z.enum(["on_track", "needs_attention", "at_risk"]).optional(),
      nextMilestone: z.string().trim().nullable().optional(),
      nextMilestoneAt: z
        .string()
        .datetime({ offset: true })
        .nullable()
        .optional(),
    })
    .parse(patch);

  const dbPatch: Record<string, unknown> = {};
  if (parsed.status !== undefined) dbPatch.status = parsed.status;
  if (parsed.phase !== undefined) dbPatch.phase = parsed.phase;
  if (parsed.health !== undefined) dbPatch.health = parsed.health;
  if (parsed.nextMilestone !== undefined)
    dbPatch.next_milestone = parsed.nextMilestone;
  if (parsed.nextMilestoneAt !== undefined)
    dbPatch.next_milestone_at = parsed.nextMilestoneAt;

  if (!Object.keys(dbPatch).length) {
    throw new Error("No project changes were provided.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .update(dbPatch)
    .eq("id", id)
    .is("archived_at", null)
    .select(
      "id,name,status,phase,health,next_milestone,next_milestone_at",
    )
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Project not found.");

  return data as ProjectMutationResult;
}
