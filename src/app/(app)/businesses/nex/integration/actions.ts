"use server";
import { requireAdminIdentity, requireActiveIdentity } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
export async function linkProvider(form: FormData) {
  await requireAdminIdentity();
  const read = (key: string, optional = false) => {
    const value = String(form.get(key) ?? "").trim().toLowerCase();
    if (optional && !value) return null;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value) ? value : undefined;
  };
  const payload = { p_organization: read("organization"), p_contact: read("contact", true), p_attempt: read("attempt"), p_kp_organization: read("kp_organization"), p_kp_person: read("kp_person", true), p_kp_opportunity: read("kp_opportunity") };
  if (Object.values(payload).some(v => v === undefined) || (payload.p_contact === null) !== (payload.p_kp_person === null)) redirect("/businesses/nex/integration?result=invalid");
  const client = await createClient();
  const { error } = await client.rpc("kp_link_nex_provider", payload);
  revalidatePath("/businesses/nex/integration");
  redirect(`/businesses/nex/integration?result=${error ? "conflict" : "linked"}`);
}
export async function requestContactStatus(form: FormData) {
  await requireActiveIdentity();
  const client = await createClient();
  const { error } = await client.rpc("kp_request_nex_contact", { p_attempt: String(form.get("attempt") ?? ""), p_contact: String(form.get("contact") ?? ""), p_status: String(form.get("status") ?? "") });
  revalidatePath("/businesses/nex/integration");
  redirect(`/businesses/nex/integration?result=${error ? "request_failed" : "requested"}`);
}
export async function reconcileProviderRecords() {
  await requireAdminIdentity();
  const client = await createClient();
  const { error } = await client.rpc("kp_reconcile_nex");
  revalidatePath("/businesses/nex/integration");
  redirect(`/businesses/nex/integration?result=${error ? "check_failed" : "checked"}`);
}
