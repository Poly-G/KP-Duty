"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  createDecisionRecord,
  resolveDecisionRecord,
  setDecisionStatusRecord,
} from "./service";

const uuid = z.string().uuid();

const optionalText = (value: FormDataEntryValue | null) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
};

function refreshDecisions() {
  revalidatePath("/decisions");
  revalidatePath("/");
}

export async function createDecision(formData: FormData) {
  const businessRaw = optionalText(formData.get("business_id"));
  let businessSlug: string | null = null;

  if (businessRaw) {
    const businessId = uuid.parse(businessRaw);
    const supabase = await createClient();
    const { data: business, error } = await supabase
      .from("businesses")
      .select("slug")
      .eq("id", businessId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!business) throw new Error("Selected business was not found.");
    businessSlug = business.slug;
  }

  const result = await createDecisionRecord({
    source: "ui",
    requestKey: crypto.randomUUID(),
    input: {
      title: z.string().trim().min(1).parse(formData.get("title")),
      businessSlug,
      mode: z.enum(["individual", "joint"]).parse(formData.get("mode")),
      domain: optionalText(formData.get("domain")),
      context: optionalText(formData.get("context")),
      recommendation: optionalText(formData.get("recommendation")),
      neededBy: optionalText(formData.get("needed_by")),
    },
  });

  refreshDecisions();
  void result;
}

export async function setDecisionStatus(decisionId: string, status: string) {
  const nextStatus = z
    .enum(["open", "discussing", "deferred", "superseded"])
    .parse(status);

  const result = await setDecisionStatusRecord(decisionId, nextStatus);
  refreshDecisions();
  return result;
}

export async function resolveDecision(formData: FormData) {
  const id = uuid.parse(formData.get("decision_id"));
  const finalDecision = z
    .string()
    .trim()
    .min(1, "A resolved decision needs an outcome.")
    .parse(formData.get("final_decision"));

  const result = await resolveDecisionRecord(id, finalDecision);
  refreshDecisions();
  void result;
}
