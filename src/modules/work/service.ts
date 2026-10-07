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
import type {
  TaskAvailability,
  TaskPriority,
  TaskStage,
} from "./types";

const uuid = z.string().uuid();
const nullableUuid = z.string().uuid().nullable();
const optionalUrl = z.string().url().nullable().optional();

export const createTaskInputSchema = z.object({
  title: z.string().trim().min(1),
  businessId: z.string().uuid().nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
  stage: z.enum(["todo", "working"]).optional(),
  availability: z.enum(["yes", "waiting", "blocked", "parked"]).optional(),
  priority: z.enum(["critical", "high", "normal", "low"]).optional(),
  dueAt: z.string().datetime({ offset: true }).nullable().optional(),
  nextAction: z.string().trim().nullable().optional(),
  whatThisIs: z.string().trim().nullable().optional(),
  whyItMatters: z.string().trim().nullable().optional(),
  instructions: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  finishedWhen: z.string().trim().nullable().optional(),
  waitingOn: z.string().trim().nullable().optional(),
  referenceUrl: optionalUrl,
  position: z.number().int().optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;

export type CreatedTask = {
  id: string;
  title: string;
  ownerId: string | null;
  businessId: string | null;
  stage: TaskStage;
  availability: TaskAvailability;
  priority: TaskPriority;
  dueAt: string | null;
  nextAction: string | null;
};

export async function createTaskRecord({
  input,
  source,
  requestKey,
}: {
  input: CreateTaskInput;
  source: DomainActionSource;
  requestKey: string;
}): Promise<CreatedTask> {
  const payload = createTaskInputSchema.parse(input);

  return callIdempotentDomainRpc<CreatedTask>({
    functionName: "kp_create_task",
    source,
    requestKey,
    payload,
  });
}

export type TaskMutationResult = {
  id: string;
  title: string;
  stage: TaskStage;
  availability: TaskAvailability;
  priority: TaskPriority;
  owner_id: string | null;
  finished_at: string | null;
  next_action: string | null;
  due_at: string | null;
};

export async function setOwnedTaskStage(
  taskId: string,
  stage: TaskStage,
): Promise<TaskMutationResult> {
  const id = uuid.parse(taskId);
  const nextStage = z.enum(["todo", "working", "finished"]).parse(stage);
  const { user } = await requireActiveIdentity();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .update({ stage: nextStage })
    .eq("id", id)
    .eq("owner_id", user.id)
    .is("archived_at", null)
    .select(
      "id,title,stage,availability,priority,owner_id,finished_at,next_action,due_at",
    )
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error(
      "Task not found or you do not have permission to modify it.",
    );
  }

  return data as TaskMutationResult;
}

export async function updateOwnedTask(
  taskId: string,
  patch: {
    availability?: TaskAvailability;
    priority?: TaskPriority;
    dueAt?: string | null;
    nextAction?: string | null;
    waitingOn?: string | null;
    notes?: string | null;
  },
): Promise<TaskMutationResult> {
  const id = uuid.parse(taskId);
  const { user } = await requireActiveIdentity();

  const parsed = z
    .object({
      availability: z.enum(["yes", "waiting", "blocked", "parked"]).optional(),
      priority: z.enum(["critical", "high", "normal", "low"]).optional(),
      dueAt: z.string().datetime({ offset: true }).nullable().optional(),
      nextAction: z.string().trim().nullable().optional(),
      waitingOn: z.string().trim().nullable().optional(),
      notes: z.string().trim().nullable().optional(),
    })
    .parse(patch);

  const dbPatch: Record<string, unknown> = {};
  if (parsed.availability !== undefined) dbPatch.availability = parsed.availability;
  if (parsed.priority !== undefined) dbPatch.priority = parsed.priority;
  if (parsed.dueAt !== undefined) dbPatch.due_at = parsed.dueAt;
  if (parsed.nextAction !== undefined) dbPatch.next_action = parsed.nextAction;
  if (parsed.waitingOn !== undefined) dbPatch.waiting_on = parsed.waitingOn;
  if (parsed.notes !== undefined) dbPatch.notes = parsed.notes;

  if (!Object.keys(dbPatch).length) {
    throw new Error("No task changes were provided.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update(dbPatch)
    .eq("id", id)
    .eq("owner_id", user.id)
    .is("archived_at", null)
    .select(
      "id,title,stage,availability,priority,owner_id,finished_at,next_action,due_at",
    )
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error(
      "Task not found or you do not have permission to modify it.",
    );
  }

  return data as TaskMutationResult;
}

export async function assignTask(
  taskId: string,
  ownerId: string | null,
): Promise<TaskMutationResult> {
  const id = uuid.parse(taskId);
  const nextOwner = nullableUuid.parse(ownerId);
  await requireAdminIdentity();
  const supabase = await createClient();

  if (nextOwner) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id,status")
      .eq("id", nextOwner)
      .eq("status", "active")
      .maybeSingle();

    if (profileError) throw new Error(profileError.message);
    if (!profile) throw new Error("Assigned owner is not an active KP member.");
  }

  const { data, error } = await supabase
    .from("tasks")
    .update({ owner_id: nextOwner })
    .eq("id", id)
    .is("archived_at", null)
    .select(
      "id,title,stage,availability,priority,owner_id,finished_at,next_action,due_at",
    )
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Task not found.");

  return data as TaskMutationResult;
}
