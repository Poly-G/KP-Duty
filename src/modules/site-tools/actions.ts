"use server";

import { z } from "zod";
import { completeTask } from "@/modules/work/actions";
import { listMyWork } from "@/modules/work/queries";

const taskIdSchema = z.string().uuid();

export async function getMyWorkForSiteTool() {
  const tasks = await listMyWork();

  return {
    scope: "current_kp_user",
    tasks: tasks.map((task) => ({
      id: task.id,
      referenceCode: task.reference_code,
      title: task.title,
      stage: task.stage,
      availability: task.availability,
      priority: task.priority,
      dueAt: task.due_at,
      nextAction: task.next_action,
      business: task.business
        ? {
            id: task.business.id,
            slug: task.business.slug,
            name: task.business.name,
          }
        : null,
    })),
  };
}

export async function completeTaskForSiteTool(taskId: string) {
  const id = taskIdSchema.parse(taskId);
  const task = await completeTask(id);

  return {
    success: true,
    task: {
      id: task.id,
      title: task.title,
      stage: task.stage,
      finishedAt: task.finished_at,
    },
  };
}
