"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireActiveIdentity } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import type { PipelineStage } from "./types";

const uuid = z.string().uuid();

export async function createCrmColumn(pipelineId: string, id: string, name: string): Promise<PipelineStage> {
  const input = z.object({ pipelineId: uuid, id: uuid, name: z.string().trim().min(1).max(80) }).parse({ pipelineId, id, name });
  await requireActiveIdentity();
  const db = await createClient();
  const { data, error } = await db.rpc("kp_create_crm_column", { p_pipeline: input.pipelineId, p_id: input.id, p_name: input.name });
  if (error) throw new Error("Unable to create column. Please try again.");
  revalidatePath("/crm", "layout");
  return data as PipelineStage;
}

export async function reorderCrmColumns(pipelineId: string, expected: string[], order: string[]) {
  const input = z.object({ pipelineId: uuid, expected: z.array(uuid).min(1).max(500), order: z.array(uuid).min(1).max(500) }).parse({ pipelineId, expected, order });
  await requireActiveIdentity();
  const db = await createClient();
  const { error } = await db.rpc("kp_reorder_crm_columns", { p_pipeline: input.pipelineId, p_expected: input.expected, p_order: input.order });
  if (error) throw new Error("Unable to move column. Refresh the board and try again.");
  revalidatePath("/crm", "layout");
}
