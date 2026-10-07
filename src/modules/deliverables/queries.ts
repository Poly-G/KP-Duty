import {requireActiveIdentity} from '@/lib/auth/current-user';
import {createClient} from '@/lib/supabase/server';
import type {Deliverable, DeliverableVersion, Review} from './types';
export async function getDeliverables(projectId: string): Promise<Deliverable[]> {
  await requireActiveIdentity();
  const db = await createClient();
  const {data, error} = await db.from('project_deliverables')
    .select('id,project_id,title,kind,reviewer_id,requirement_key,current_version,reviewer:profiles!reviewer_id(display_name)')
    .eq('project_id', projectId).order('created_at', {ascending: true});
  if (error) throw new Error(error.message);
  if (!data?.length) return [];
  const {data:versions, error:versionError} = await db.from('deliverable_versions').select('*')
    .in('deliverable_id',data.map(d => d.id)).order('version',{ascending:false});
  if (versionError) throw new Error(versionError.message);
  const versionIds = (versions || []).map(v => v.id);
  if (!versionIds.length) return (data as unknown as Omit<Deliverable,'versions'>[]).map(d=>({...d,versions:[]}));
  const [files,reviews,publications] = await Promise.all([
    db.from('deliverable_version_files').select('version_id,file_id').in('version_id',versionIds),
    db.from('deliverable_reviews').select('*,actor:profiles!recorded_by(display_name)').in('version_id',versionIds).order('recorded_at'),
    db.from('deliverable_publications').select('id,published_at').in('id',versionIds),
  ]);
  for (const result of [files,reviews,publications]) if(result.error) throw new Error(result.error.message);
  return (data as unknown as Omit<Deliverable,'versions'>[]).map(d=>({...d,versions:(versions || []).filter(v=>v.deliverable_id===d.id).map(v=>({
    ...v,file_ids:(files.data || []).filter(f=>f.version_id===v.id).map(f=>f.file_id),
    published_at:publications.data?.find(p=>p.id===v.id)?.published_at || null,
    reviews:(reviews.data || []).filter(r=>r.version_id===v.id) as unknown as Review[],
  })) as DeliverableVersion[]}));
}
export async function getDeliverableReviewers() {
  const {profile} = await requireActiveIdentity();
  if (profile.role !== 'admin') return [];
  const db = await createClient();
  const {data,error} = await db.from('profiles').select('id,display_name').eq('status','active').order('display_name');
  if(error) throw new Error(error.message);
  return data || [];
}
