'use server';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {createClient} from '@/lib/supabase/server';
import {requireActiveIdentity} from '@/lib/auth/current-user';
import {getDelivery} from '@/modules/delivery/queries';
import {validateDriveUrl,validateProjectFile,MAX_FILE_BYTES} from './files';
const uuid=z.string().uuid();
async function context(form:FormData){
 const {profile}=await requireActiveIdentity();const id=uuid.parse(form.get('id'));const business=z.enum(['solta','snd']).parse(form.get('business'));
 if(!await getDelivery(id,business))throw new Error('Project unavailable.');
 return {profile,id,business,db:await createClient()};
}
function refresh(id:string,business:string){revalidatePath(`/businesses/${business}/projects/${id}`);revalidatePath(`/client-preview/${business}/projects/${id}`);}
export async function saveProjectProgress(form:FormData){
 const {id,business,db}=await context(form);const revision=z.coerce.number().int().min(0).parse(form.get('revision'));
 const milestones=z.array(z.object({title:z.string().trim().min(1).max(200),status:z.enum(['pending','in_progress','complete'])})).max(20).parse(JSON.parse(String(form.get('milestones'))));
 const {error}=await db.rpc('kp_save_project_progress',{p_id:id,p_revision:revision,p_work:z.string().trim().max(5000).parse(form.get('current_work')),p_next:z.string().trim().max(5000).parse(form.get('next_action')),p_milestones:milestones});if(error)throw new Error(error.message);refresh(id,business);
}
export async function publishProjectProgress(form:FormData){
 const {id,business,db}=await context(form);const {error}=await db.rpc('kp_publish_project_progress',{p_id:id,p_revision:z.coerce.number().int().positive().parse(form.get('revision'))});if(error)throw new Error(error.message);refresh(id,business);
}
export async function postProjectMessage(form:FormData){
 const {id,business,db,profile}=await context(form);const messageId=uuid.parse(form.get('request_id'));const body=z.string().trim().min(1).max(10000).parse(form.get('body'));const audience=z.enum(['internal','client']).parse(form.get('audience'));
 const {data:existing,error:readError}=await db.from('project_messages').select('project_id,body,audience,author_id').eq('id',messageId).maybeSingle();if(readError)throw new Error(readError.message);
 if(existing){if(existing.project_id!==id||existing.body!==body||existing.audience!==audience||existing.author_id!==profile.id)throw new Error('Message retry mismatch.');}
 else {const {error}=await db.from('project_messages').insert({id:messageId,project_id:id,body,audience,author_id:profile.id});if(error)throw new Error(error.message);}
 refresh(id,business);
}
export async function addProjectFile(form:FormData){
 const {id,business,db,profile}=await context(form);const fileId=uuid.parse(form.get('request_id'));const source=z.enum(['upload','drive']).parse(form.get('source'));
 const seriesInput=String(form.get('series_id')||'');const series=seriesInput?uuid.parse(seriesInput):fileId;
 const {data:existing,error:existingError}=await db.from('project_files').select('*').eq('id',fileId).maybeSingle();if(existingError)throw new Error(existingError.message);
 let version=1;
 if(series!==fileId){const {data:previous,error}=await db.from('project_files').select('version,project_id').eq('series_id',series).order('version',{ascending:false}).limit(1).single();if(error||previous.project_id!==id)throw new Error('File series unavailable.');version=previous.version+1;}
 let bytes:Uint8Array|undefined;let path:string|undefined;
 let record:Record<string,unknown>={id:fileId,project_id:id,series_id:series,version,created_by:profile.id};
 if(source==='upload'){
  const file=form.get('file');if(!(file instanceof File)||file.size>MAX_FILE_BYTES)throw new Error('Choose a file up to 20 MB.');
  bytes=new Uint8Array(await file.arrayBuffer());const validated=validateProjectFile(file.name,bytes);path=`${id}/${fileId}/${validated.name}`;
  record={...record,name:validated.name,object_path:path,mime_type:validated.mime,size_bytes:bytes.length,sha256:validated.sha256};
 }else record={...record,name:z.string().trim().min(1).max(200).parse(form.get('name')),drive_url:validateDriveUrl(String(form.get('drive_url')))};
 if(existing){for(const key of ['project_id','series_id','created_by','name','drive_url','sha256','object_path'])if((existing[key]??null)!==(record[key]??null))throw new Error('File retry mismatch.');}
 else {const {error}=await db.from('project_files').insert(record);if(error)throw new Error(error.message);}
 if(bytes&&path&&existing?.state!=='ready'){
  const {error}=await db.storage.from('kp-project-files').upload(path,bytes,{contentType:String(record.mime_type),upsert:false});
  if(error){const {data:objects,error:listError}=await db.storage.from('kp-project-files').list(`${id}/${fileId}`,{limit:1});if(listError||!objects?.some(object=>object.name===record.name))throw new Error('Upload failed; retry the same file.');}
  const {error:readyError}=await db.from('project_files').update({state:'ready'}).eq('id',fileId);if(readyError)throw new Error(readyError.message);
 }
 refresh(id,business);
}
export async function setProjectFileAudience(form:FormData){
 const {id,business,db}=await context(form);const {error}=await db.from('project_files').update({audience:z.enum(['internal','client']).parse(form.get('audience'))}).eq('id',uuid.parse(form.get('file_id'))).eq('project_id',id).eq('state','ready');if(error)throw new Error(error.message);refresh(id,business);
}
