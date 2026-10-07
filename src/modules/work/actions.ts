"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCurrentIdentity } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

const idSchema = z.string().uuid();
const stageSchema = z.enum(["todo", "working", "finished"]);

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

  revalidatePath("/");
  revalidatePath("/work");
}

export async function completeTask(taskId: string) {
  return setTaskStage(taskId, "finished");
}

export async function reopenTask(taskId: string) {
  return setTaskStage(taskId, "todo");
}
