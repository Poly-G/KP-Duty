import {z} from 'zod';
import {requireActiveIdentity} from '@/lib/auth/current-user';
import {createClient} from '@/lib/supabase/server';
import {driveDatabase} from '@/modules/integrations/google-drive/server';
import {connectedDrive} from '@/modules/integrations/google-drive/storage';
import {validateProjectFile,MAX_FILE_BYTES} from '@/modules/project-collaboration/files';

export const runtime='nodejs';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 await requireActiveIdentity();
 const {id}=await params;
 if(!z.uuid().safeParse(id).success)return new Response('Not found',{status:404});
 // Read through the signed-in staff client's RLS before using private Drive access.
 const db=await createClient();
 const {data:file,error}=await db.from('solta_portal_files').select('id,project_id,name,object_path,size_bytes,mime_type,sha256,state').eq('id',id).eq('state','ready').maybeSingle();
 if(error||!file)return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}});
 try{
  const storage=driveDatabase();
  const {data:mapping,error:mappingError}=await storage.from('solta_drive_files').select('drive_id,folder_id').eq('file_id',file.id).maybeSingle();
  if(mappingError)throw new Error('File mapping unavailable');
  let bytes:Uint8Array;
  if(mapping){
   const {data:folder,error:folderError}=await storage.from('solta_drive_folders').select('drive_id').eq('node_key','project:'+file.project_id).maybeSingle();
   if(folderError||!folder||folder.drive_id!==mapping.folder_id)throw new Error('File mapping changed');
   const {drive}=await connectedDrive(storage);
   bytes=await drive.bytes(mapping.drive_id,mapping.folder_id,file.size_bytes);
  }else{
   const {data,error:downloadError}=await db.storage.from('kp-project-files').download(file.object_path);
   if(downloadError||!data||data.size!==file.size_bytes||data.size>MAX_FILE_BYTES)throw new Error('File unavailable');
   bytes=new Uint8Array(await data.arrayBuffer());
  }
  const checked=validateProjectFile(file.name,bytes);
  if(checked.sha256!==file.sha256||checked.mime!==file.mime_type)throw new Error('Stored file changed');
  let offset=0;
  const stream=new ReadableStream<Uint8Array>({pull(controller){if(offset>=bytes.length){controller.close();return;}const end=Math.min(offset+65536,bytes.length);controller.enqueue(bytes.subarray(offset,end));offset=end;}});
  return new Response(stream,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}"`,'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
 }catch{return new Response('File unavailable',{status:503,headers:{'Cache-Control':'no-store'}});}
}
