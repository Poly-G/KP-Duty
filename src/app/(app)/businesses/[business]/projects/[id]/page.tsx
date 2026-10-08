import {ProjectScope} from "@/components/projects/project-scope";
import {OnboardingEditor} from "@/components/projects/onboarding-editor";
import Link from "next/link";
import {ProjectDeliverables} from "@/components/projects/project-deliverables";
import {ProjectCollaboration} from "@/components/projects/project-collaboration";
import {z} from "zod";
import {notFound} from "next/navigation";
import {PageHeading} from "@/components/page-heading";
import {ActionForm} from "@/components/action-form";
import {BillingPlaceholder} from "@/components/projects/billing-placeholder";
import {requireActiveIdentity} from "@/lib/auth/current-user";
import {getDelivery} from "@/modules/delivery/queries";
import {saveClientDelivery} from "@/modules/delivery/actions";
import {onboardingFields,requiredOnboardingKeys,readinessIssues,serviceTemplates} from "@/modules/delivery/templates";

export default async function DeliveryPage({params}:{params:Promise<{business:string;id:string}>}){
 const {business,id}=await params;
 if(!["solta","snd"].includes(business)||!z.string().uuid().safeParse(id).success)notFound();
 const [{profile},delivery]=await Promise.all([requireActiveIdentity(),getDelivery(id,business)]);
 if(!delivery)notFound(); const {project,engagement:e}=delivery;const admin=profile.role==="admin";const issues=readinessIssues(e);
 const fields=onboardingFields(e.service,e.template_version,e.answers);
 function hidden(operation:string){return <><input type="hidden" name="id" value={id}/><input type="hidden" name="business" value={business}/><input type="hidden" name="revision" value={e.revision}/><input type="hidden" name="operation" value={operation}/></>;}
 return <>
  <Link href={`/businesses/${business}/clients/${project.organization.id}`} className="mb-5 inline-block text-sm text-[var(--muted)]">← {project.organization.name}</Link>
  <PageHeading eyebrow={`${project.business.name} · ${serviceTemplates[e.service].label}`} title={project.name} description={`Owner: ${project.owner.display_name || "Unassigned"}. ${e.started_at ? "Delivery start approved." : "Preparing for delivery."}`}/>
  <section className="mb-7 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
   <h2 className="font-medium">Onboarding</h2><p className="mt-2 text-sm text-[var(--muted)]">Staff preparation · template v{e.template_version}. Client login and submission will be added later. Do not enter passwords or access tokens here.</p>
   <OnboardingEditor key={e.revision} engagement={e} business={business} companyName={project.organization.name}/>
   <ActionForm key={`submit-${e.revision}`} action={saveClientDelivery} className="mt-4 space-y-3">{hidden("submit")}{Object.keys(fields).map(key=><input key={key} type="hidden" name={key} value={e.answers[key]||""}/>)}<button type="submit" disabled={requiredOnboardingKeys(e.service,e.template_version,e.answers).some(key=>!e.answers[key]?.trim())} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-40">Submit saved onboarding for review</button><p className="text-sm text-[var(--muted)]">{e.submitted_at?"Submitted for review. Editing answers resets the review.":"Save all answers before submitting."}</p></ActionForm>
  </section>
  <ProjectScope id={id} business={business} admin={admin} required={!!e.scope_required}/>
  <section className="mb-7 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><h2 className="font-medium">Readiness & approvals</h2><ActionForm key={`review-${e.revision}`} action={saveClientDelivery} className="mt-4 space-y-4">{hidden("review")}
   <label className="flex gap-2 text-sm"><input type="checkbox" name="onboarding_reviewed" defaultChecked={e.onboarding_reviewed} disabled={!e.submitted_at}/>Onboarding reviewed</label>
   <label className="flex gap-2 text-sm"><input type="checkbox" name="access_ready" defaultChecked={e.access_ready}/>Required access and dependencies confirmed</label>
   {admin?<>{e.scope_required?<p className="text-sm">Scope approval: {e.scope_approved?"Current version approved":"Record client approval in Scope & terms above"}</p>:<label className="flex gap-2 text-sm"><input type="checkbox" name="scope_approved" defaultChecked={e.scope_approved}/>Scope and terms approved (existing project)</label>}<label className="flex gap-2 text-sm"><input type="checkbox" name="payment_required" defaultChecked={e.payment_required}/>Payment required before delivery</label><label className="grid gap-2 text-sm">Payment verification evidence<textarea name="payment_evidence" defaultValue={e.payment_evidence||""} rows={2} maxLength={10000} placeholder="Receipt reference or evidence link; never card details" className="rounded-lg border border-[var(--border)] p-3"/></label><label className="flex gap-2 text-sm"><input type="checkbox" name="capacity_ready" defaultChecked={e.capacity_ready}/>Team capacity confirmed</label></>:<p className="text-sm text-[var(--muted)]">Admin approves scope, payment requirements, capacity, and delivery start.</p>}
   <button type="submit" className="rounded-lg bg-[var(--text)] px-4 py-2 text-sm text-white">Save readiness review</button>
  </ActionForm>
  {issues.length?<ul className="mt-5 list-disc space-y-2 pl-5 text-sm text-[var(--muted)]">{issues.map(issue=><li key={issue}>{issue}</li>)}</ul>:<p className="mt-5 text-sm">Readiness checks complete.</p>}
  {e.started_at?<p className="mt-4 text-sm">Start approval recorded {new Date(e.started_at).toLocaleDateString("en-US",{timeZone:"UTC"})}.</p>:admin?<ActionForm key={`start-${e.revision}`} action={saveClientDelivery} className="mt-5">{hidden("start")}<button disabled={issues.length>0} type="submit" className="rounded-lg bg-[var(--text)] px-4 py-2 text-sm text-white disabled:opacity-40">Approve and start delivery</button></ActionForm>:null}
  </section><ProjectCollaboration id={id} business={business}/><ProjectDeliverables id={id} business={business} ownerId={project.owner.id} requirements={fields}/><BillingPlaceholder/>
 </>;
}
