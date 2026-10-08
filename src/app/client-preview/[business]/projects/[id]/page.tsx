import {SoltaPortal} from '@/components/projects/solta-portal';
import {OnboardingEditor} from '@/components/projects/onboarding-editor';
import {ActionForm} from '@/components/action-form';
import {saveClientDelivery} from '@/modules/delivery/actions';
import {onboardingFields,requiredOnboardingKeys} from '@/modules/delivery/templates';
import {PortalRequestForm} from '@/components/projects/portal-request-form';
import {getPortalRequests} from '@/modules/portal-requests/queries';
import Link from 'next/link';
import {getDeliverables} from '@/modules/deliverables/queries';
import {projectPortalContent} from '@/modules/client-portal/projection';
import {notFound} from 'next/navigation';
import {z} from 'zod';
import {requireActiveIdentity} from '@/lib/auth/current-user';
import {getDelivery} from '@/modules/delivery/queries';
import {getProjectCollaboration} from '@/modules/project-collaboration/queries';
import {ClientProjectView} from '@/components/projects/client-project-view';
export async function generateMetadata({params}:{params:Promise<{business:string}>}){const {business}=await params;return {title:business==='solta'?'Solta · Project':'Sent & Delivered · Project'};}
export default async function ClientPreview({params}:{params:Promise<{business:string;id:string}>}){
 await requireActiveIdentity();const {business,id}=await params;if(!['solta','snd'].includes(business)||!z.string().uuid().safeParse(id).success)notFound();
 const delivery=await getDelivery(id,business);if(!delivery)notFound();const [data,deliverables]=await Promise.all([getProjectCollaboration(id),getDeliverables(id)]);
 const content=projectPortalContent({...data,deliverables});
 if(business==='solta'){
  const requests=await getPortalRequests(id);const e=delivery.engagement;const fields=onboardingFields(e.service,e.template_version,e.answers);
  return <main className="mx-auto max-w-6xl p-3 sm:p-6"><aside className="mb-4 text-sm">Staff preparation · Changes save to KP · Client login is not enabled. <Link className="underline" href={`/businesses/solta/projects/${id}`}>Return to project</Link></aside><SoltaPortal name={delivery.project.name} {...content}><section id="onboarding" className="mt-10 rounded-xl bg-[#f5f0e8] p-6"><h2 className="text-2xl font-semibold">Tell us about your project</h2><p className="mt-3">Save your answers before submitting them for review. Do not enter passwords or secrets.</p><OnboardingEditor key={e.revision} engagement={e} business={business} companyName={delivery.project.organization.name}/><ActionForm key={`submit-${e.revision}`} action={saveClientDelivery} className="mt-5"><input type="hidden" name="id" value={id}/><input type="hidden" name="business" value={business}/><input type="hidden" name="revision" value={e.revision}/><input type="hidden" name="operation" value="submit"/>{Object.keys(fields).map(key=><input key={key} type="hidden" name={key} value={e.answers[key]||''}/>)}<button disabled={requiredOnboardingKeys(e.service,e.template_version,e.answers).some(key=>!e.answers[key]?.trim())} className="min-h-11 rounded-lg bg-[#354f8f] px-5 py-3 text-white disabled:opacity-50">Submit saved answers for review</button><p className="mt-3">{e.submitted_at?'Submitted. Editing answers resets the review.':'Save all required answers, then submit.'}</p></ActionForm></section><PortalRequestForm project={id} requests={requests}/></SoltaPortal></main>;
 }

 return <main className="mx-auto max-w-3xl p-5"><aside className="mb-4 rounded-xl border border-[var(--border)] p-4 text-sm">Staff preview · client login will be added later. <Link href={`/businesses/${business}/projects/${id}`} className="underline">Return to project</Link></aside><ClientProjectView business={business} name={delivery.project.name} {...content}/></main>;
}
