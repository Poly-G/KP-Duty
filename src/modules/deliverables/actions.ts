'use server';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {requireActiveIdentity} from '@/lib/auth/current-user';
import {createClient} from '@/lib/supabase/server';
import {getDelivery} from '@/modules/delivery/queries';
import {onboardingFields} from '@/modules/delivery/templates';
const uuid = z.string().uuid();
async function context(form: FormData) {
  await requireActiveIdentity();
  const projectId=uuid.parse(form.get('project_id'));
  const business=z.enum(['solta','snd']).parse(form.get('business'));
  const delivery=await getDelivery(projectId,business);
  if(!delivery) throw new Error('Project unavailable.');
  return {projectId,business,delivery,db:await createClient()};
}
function refresh(id:string,business:string) {
  revalidatePath(`/businesses/${business}/projects/${id}`);
  revalidatePath(`/client-preview/${business}/projects/${id}`);
}
async function verifyDeliverable(db: Awaited<ReturnType<typeof createClient>>,id:string,projectId:string) {
  const {data,error}=await db.from('project_deliverables').select('id').eq('id',id).eq('project_id',projectId).maybeSingle();
  if(error || !data) throw new Error('Deliverable unavailable.');
}
async function verifyVersion(db: Awaited<ReturnType<typeof createClient>>,id:string,projectId:string) {
  const {data,error}=await db.from('deliverable_versions').select('deliverable_id').eq('id',id).maybeSingle();
  if(error || !data) throw new Error('Version unavailable.');
  await verifyDeliverable(db,data.deliverable_id,projectId);
}
export async function createDeliverable(form:FormData) {
  const {projectId,business,delivery,db}=await context(form);
  const requirement=String(form.get('requirement_key') || '') || null;
  if(requirement && !Object.hasOwn(onboardingFields(delivery.engagement.service,delivery.engagement.template_version,delivery.engagement.answers),requirement)) throw new Error('Unknown requirement.');
  const {error}=await db.rpc('kp_create_deliverable',{
    p_id:uuid.parse(form.get('request_id')),p_project:projectId,
    p_title:z.string().trim().min(1).max(200).parse(form.get('title')),
    p_kind:z.enum(['general','brand_direction','copy','launch']).parse(form.get('kind')),
    p_reviewer:uuid.parse(form.get('reviewer_id')),p_requirement:requirement,
  });
  if(error) throw new Error(error.message);
  refresh(projectId,business);
}
export async function addDeliverableVersion(form:FormData) {
  const {projectId,business,db}=await context(form);
  const deliverableId=uuid.parse(form.get('deliverable_id'));
  await verifyDeliverable(db,deliverableId,projectId);
  const files=z.array(uuid).max(20).parse(form.getAll('file_ids'));
  const {error}=await db.rpc('kp_add_deliverable_version',{
    p_id:uuid.parse(form.get('request_id')),p_deliverable:deliverableId,
    p_expected_version:z.coerce.number().int().min(0).parse(form.get('expected_version')),
    p_description:z.string().trim().min(1).max(10000).parse(form.get('description')),p_files:files,
  });
  if(error) throw new Error(error.message);
  refresh(projectId,business);
}
export async function reviewDeliverable(form:FormData) {
  const {projectId,business,db}=await context(form);
  const versionId=uuid.parse(form.get('version_id'));
  await verifyVersion(db,versionId,projectId);
  const lane=z.enum(['internal','client_record']).parse(form.get('lane'));
  const outcome=z.enum(['approved','changes_requested']).parse(form.get('outcome'));
  const note=z.string().trim().max(5000).parse(String(form.get('note') || ''));
  if(outcome==='changes_requested' && !note) throw new Error('Describe the requested changes.');
  const {error}=await db.rpc('kp_review_deliverable',{
    p_id:uuid.parse(form.get('request_id')),p_version:versionId,p_lane:lane,p_outcome:outcome,p_note:note,
    p_client_name:lane==='client_record'?z.string().trim().min(1).max(200).parse(form.get('client_name')):null,
    p_evidence:lane==='client_record'?z.string().trim().min(1).max(5000).parse(form.get('evidence')):null,
  });
  if(error) throw new Error(error.message);
  refresh(projectId,business);
}
export async function publishDeliverable(form:FormData) {
  const {projectId,business,db}=await context(form);
  const versionId=uuid.parse(form.get('version_id'));
  await verifyVersion(db,versionId,projectId);
  const {error}=await db.rpc('kp_publish_deliverable',{p_version:versionId});
  if(error) throw new Error(error.message);
  refresh(projectId,business);
}
