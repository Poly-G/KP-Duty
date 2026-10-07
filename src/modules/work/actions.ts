"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  assignTask,
  createTaskRecord,
  setOwnedTaskStage,
  updateOwnedTask,
  type CreateTaskInput,
} from "./service";

const stageSchema = z.enum(["todo", "working", "finished"]);

function refreshWork() {
  revalidatePath("/");
  revalidatePath("/work");
}

export async function setTaskStage(taskId: string, stage: string) {
  const result = await setOwnedTaskStage(taskId, stageSchema.parse(stage));
  refreshWork();
  return result;
}

export async function completeTask(taskId: string) {
  return setTaskStage(taskId, "finished");
}

export async function reopenTask(taskId: string) {
  return setTaskStage(taskId, "todo");
}

export async function updateMyTask(
  taskId: string,
  patch: Parameters<typeof updateOwnedTask>[1],
) {
  const result = await updateOwnedTask(taskId, patch);
  refreshWork();
  return result;
}

export async function assignTaskOwner(taskId: string, ownerId: string | null) {
  const result = await assignTask(taskId, ownerId);
  refreshWork();
  return result;
}

export async function createTaskForUi(input: CreateTaskInput) {
  const result = await createTaskRecord({
    input,
    source: "ui",
    requestKey: crypto.randomUUID(),
  });
  refreshWork();
  return result;
}
