"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCurrentIdentity } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

const idSchema = z.string().uuid();
const stageSchema = z.enum(["todo", "working", "finished"]);

export type TaskStageMutationResult = {
  id: string;
  title: string;
  stage: "todo" | "working" | "finished";
  finished_at: string | null;
};

export async function setTaskStage(
  taskId: string,
  stage: string,
): Promise<TaskStageMutationResult> {
  const id = idSchema.parse(taskId);
  const nextStage = stageSchema.parse(stage);
  const { user } = await requireCurrentIdentity();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .update({ stage: nextStage })
    .eq("id", id)
    .eq("owner_id", user.id)
    .select("id,title,stage,finished_at")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error(
      "Task not found or you do not have permission to modify it.",
    );
  }

  revalidatePath("/");
  revalidatePath("/work");

  return data as TaskStageMutationResult;
}

export async function completeTask(taskId: string) {
  return setTaskStage(taskId, "finished");
}

export async function reopenTask(taskId: string) {
  return setTaskStage(taskId, "todo");
}
