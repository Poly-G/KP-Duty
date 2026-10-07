"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCurrentIdentity } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

const idSchema = z.string().uuid();
const stageSchema = z.enum(["todo", "working", "finished"]);
const availabilitySchema = z.enum(["yes", "waiting", "blocked", "parked"]);
const prioritySchema = z.enum(["critical", "high", "normal", "low"]);

const optionalText = (value: FormDataEntryValue | null) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
};

function revalidateWork() {
  revalidatePath("/");
  revalidatePath("/work");
}

export async function createTask(formData: FormData) {
  const { user, profile } = await requireCurrentIdentity();
  const supabase = await createClient();

  const title = z.string().trim().min(1).parse(formData.get("title"));
  const priority = prioritySchema.parse(formData.get("priority") || "normal");
  const nextAction = optionalText(formData.get("next_action"));
  const businessRaw = optionalText(formData.get("business_id"));
  const ownerRaw = optionalText(formData.get("owner_id"));

  const businessId = businessRaw ? idSchema.parse(businessRaw) : null;

  let ownerId: string | null = user.id;
  if (profile?.role === "admin") {
    ownerId = ownerRaw ? idSchema.parse(ownerRaw) : null;
  }

  const { error } = await supabase.from("tasks").insert({
    title,
    business_id: businessId,
    owner_id: ownerId,
    priority,
    next_action: nextAction,
    stage: "todo",
    availability: "yes",
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidateWork();
}

export async function setTaskStage(taskId: string, stage: string) {
  const id = idSchema.parse(taskId);
  const nextStage = stageSchema.parse(stage);
  const { user } = await requireCurrentIdentity();
  const supabase = await createClient();

  const { error } = await supabase
    .from("tasks")
    .update({ stage: nextStage })
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidateWork();
}

export async function setTaskControls(
  taskId: string,
  input: {
    ownerId?: string | null;
    availability?: string;
    waitingOn?: string | null;
  },
) {
  const id = idSchema.parse(taskId);
  const { user, profile } = await requireCurrentIdentity();
  const supabase = await createClient();

  const updates: {
    owner_id?: string | null;
    availability?: z.infer<typeof availabilitySchema>;
    waiting_on?: string | null;
  } = {};

  if (input.availability) {
    updates.availability = availabilitySchema.parse(input.availability);
  }

  if (input.waitingOn !== undefined) {
    updates.waiting_on = input.waitingOn?.trim() || null;
  }

  if (profile?.role === "admin" && input.ownerId !== undefined) {
    updates.owner_id = input.ownerId ? idSchema.parse(input.ownerId) : null;
  }

  let query = supabase.from("tasks").update(updates).eq("id", id);

  if (profile?.role !== "admin") {
    query = query.eq("owner_id", user.id);
  }

  const { error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  revalidateWork();
}

export async function completeTask(taskId: string) {
  return setTaskStage(taskId, "finished");
}

export async function reopenTask(taskId: string) {
  return setTaskStage(taskId, "todo");
}
