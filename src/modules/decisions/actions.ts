"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCurrentIdentity } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();
const statusSchema = z.enum(["open", "discussing", "deferred", "resolved", "superseded"]);

const optionalText = (value: FormDataEntryValue | null) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
};

export async function createDecision(formData: FormData) {
  const { user } = await requireCurrentIdentity();
  const supabase = await createClient();

  const title = z.string().trim().min(1).parse(formData.get("title"));
  const businessRaw = optionalText(formData.get("business_id"));
  const businessId = businessRaw ? uuid.parse(businessRaw) : null;
  const mode = z.enum(["individual", "joint"]).parse(formData.get("mode"));
  const domain = optionalText(formData.get("domain"));
  const context = optionalText(formData.get("context"));
  const recommendation = optionalText(formData.get("recommendation"));
  const neededBy = optionalText(formData.get("needed_by"));

  const { error } = await supabase.from("decisions").insert({
    title,
    business_id: businessId,
    mode,
    domain,
    context,
    recommendation,
    needed_by: neededBy,
    owner_id: user.id,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/decisions");
  revalidatePath("/");
}

export async function setDecisionStatus(decisionId: string, status: string) {
  await requireCurrentIdentity();
  const supabase = await createClient();

  const id = uuid.parse(decisionId);
  const nextStatus = statusSchema.parse(status);

  const { error } = await supabase
    .from("decisions")
    .update({ status: nextStatus })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/decisions");
  revalidatePath("/");
}

export async function resolveDecision(formData: FormData) {
  await requireCurrentIdentity();
  const supabase = await createClient();

  const id = uuid.parse(formData.get("decision_id"));
  const finalDecision = z
    .string()
    .trim()
    .min(1, "A resolved decision needs an outcome.")
    .parse(formData.get("final_decision"));

  const { error } = await supabase
    .from("decisions")
    .update({
      status: "resolved",
      final_decision: finalDecision,
      effective_date: new Date().toISOString().slice(0, 10),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/decisions");
  revalidatePath("/");
}
