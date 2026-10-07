"use client";
import {useRouter} from "next/navigation";
import {ActionForm} from "@/components/action-form";
import {createClientDelivery} from "@/modules/delivery/actions";
import {serviceTemplates} from "@/modules/delivery/templates";
export function ClientProjectSetup({business,companyId,requestId}:{business:string;companyId:string;requestId:string}){
 const router=useRouter();
 return <section className="mb-7 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="font-medium">Set up a client project</h2><p className="mt-2 text-sm text-[var(--muted)]">Creates a planned project. Delivery starts only after readiness review and your approval.</p><ActionForm action={async data=>{const id=await createClientDelivery(data);router.push(`/businesses/${business}/projects/${id}`);}} className="mt-4 grid gap-4 sm:grid-cols-2"><input type="hidden" name="business" value={business}/><input type="hidden" name="company_id" value={companyId}/><input type="hidden" name="request_id" value={requestId}/><label className="grid gap-2 text-sm">Project name<input required name="name" maxLength={200} className="rounded-lg border border-[var(--border)] p-3"/></label><label className="grid gap-2 text-sm">Service<select name="service" className="rounded-lg border border-[var(--border)] p-3">{Object.entries(serviceTemplates).filter(([key])=>business === "snd" ? key === "snd" : key !== "snd").map(([key,template])=><option key={key} value={key}>{template.label}</option>)}</select></label><button type="submit" className="rounded-lg bg-[var(--text)] px-4 py-2 text-sm text-white">Create planned project</button></ActionForm></section>;
}
