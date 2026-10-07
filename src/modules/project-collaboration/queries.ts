import {createClient} from '@/lib/supabase/server';
import {requireActiveIdentity} from '@/lib/auth/current-user';
export type Milestone={title:string;status:'pending'|'in_progress'|'complete'};
export type Progress={revision:number;draft_revision?:number;current_work:string;next_action:string;milestones:Milestone[]};
export type ProjectMessage={id:string;audience:'internal'|'client';body:string;created_at:string;author_id:string;author?:{display_name:string|null}};
export type ProjectFile={id:string;series_id:string;version:number;name:string;state:'pending'|'ready';audience:'internal'|'client';drive_url:string|null;created_at:string};
export async function getProjectCollaboration(id:string){
 await requireActiveIdentity();const db=await createClient();
 const [draft,updates,messages,files,jobs]=await Promise.all([
  db.from('project_progress_drafts').select('*').eq('id',id).maybeSingle(),
  db.from('project_progress_updates').select('*').eq('project_id',id).order('published_at',{ascending:false}).limit(1),
  db.from('project_messages').select('id,audience,body,created_at,author_id,author:profiles!author_id(display_name)').eq('project_id',id).order('created_at',{ascending:false}).limit(100),
  db.from('project_files').select('id,series_id,version,name,state,audience,drive_url,created_at').eq('project_id',id).order('created_at',{ascending:false}).limit(100),
  db.from('project_notification_jobs').select('id',{count:'exact',head:true}).eq('project_id',id)
 ]);
 for(const result of [draft,updates,messages,files,jobs])if(result.error)throw new Error(result.error.message);
 return {draft:draft.data as Progress|null,published:updates.data?.[0] as Progress|null,messages:(messages.data||[]) as unknown as ProjectMessage[],files:(files.data||[]) as ProjectFile[],heldNotifications:jobs.count||0};
}
