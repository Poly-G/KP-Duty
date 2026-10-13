import {z} from 'zod';
import {requireActiveIdentity} from '@/lib/auth/current-user';
import {createClient} from '@/lib/supabase/server';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 await requireActiveIdentity();const {id}=await params;if(!z.string().uuid().safeParse(id).success)return new Response('Not found',{status:404});
 const db=await createClient();let {data:file,error}=await db.from('project_files').select('name,object_path,state').eq('id',id).single();
 if(!file){const result=await db.from('solta_portal_files').select('name,object_path,state').eq('id',id).maybeSingle();file=result.data;error=result.error;}
 if(error||!file||file.state!=='ready'||!file.object_path)return new Response('Not found',{status:404});
 const {data,error:downloadError}=await db.storage.from('kp-project-files').download(file.object_path);
 if(downloadError||!data)return new Response('File unavailable',{status:404});
 return new Response(data,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
