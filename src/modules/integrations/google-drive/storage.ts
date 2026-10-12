import {driveConfig,openToken,sealToken,refreshAccessToken} from './oauth.ts';
import type {SupabaseClient} from '@supabase/supabase-js';
import {MAX_FILE_BYTES} from '../../project-collaboration/files.ts';
const API='https://www.googleapis.com/drive/v3';
function id(value:string){if(!/^[A-Za-z0-9_-]{1,200}$/.test(value))throw new Error('Invalid Drive identifier');return value;}
export function uploadSessionUrl(value:string){const url=new URL(value);if(url.origin!=='https://www.googleapis.com'||url.pathname!=='/upload/drive/v3/files'||!url.searchParams.get('upload_id'))throw new Error('Invalid Drive upload session');return value;}
export class DriveStorage{
 token:string;fetcher:typeof fetch;
 constructor(token:string,fetcher:typeof fetch=fetch){this.token=token;this.fetcher=fetcher;}
 async request(url:string,options:RequestInit={}){return this.fetcher(url,{...options,headers:{Authorization:`Bearer ${this.token}`,...options.headers},cache:'no-store',signal:AbortSignal.timeout(30000)});}
 async json(path:string,options:RequestInit={}){const r=await this.request(API+path,options);if(!r.ok)throw new Error('Drive request unavailable');return r.json();}
 async generateId(){const data=await this.json('/files/generateIds?count=1&space=drive');return id(data.ids[0]);}
 async folder(folderId:string,name:string,parent?:string,retried=false){
  const existing=await this.request(API+'/files/'+id(folderId)+'?fields=id,mimeType,parents,trashed');
  if(existing.ok){const f=await existing.json();if(f.trashed||f.mimeType!=='application/vnd.google-apps.folder'||(parent&&!f.parents?.includes(parent)))throw new Error('Drive folder changed');return;}
  if(existing.status!==404)throw new Error('Drive folder unavailable');
  const r=await this.request(API+'/files?fields=id',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:folderId,name,mimeType:'application/vnd.google-apps.folder',...(parent?{parents:[parent]}:{})})});
  if(!r.ok&&r.status!==409)throw new Error('Drive folder could not be created');
  if(r.status===409){if(retried)throw new Error('Drive folder unavailable');await this.folder(folderId,name,parent,true);}
 }
 async start(fileId:string,folderId:string,name:string,mime:string,size:number){
  const r=await this.request('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id',{method:'POST',headers:{'Content-Type':'application/json','X-Upload-Content-Type':mime,'X-Upload-Content-Length':String(size)},body:JSON.stringify({id:id(fileId),name,mimeType:mime,parents:[id(folderId)]})});
  if(!r.ok)throw new Error('Drive upload could not be started');return uploadSessionUrl(r.headers.get('Location')||'');
 }
 async bytes(fileId:string,folderId:string,expectedSize?:number){
  const metadata=await this.json('/files/'+id(fileId)+'?fields=id,parents,size,trashed');
  if(metadata.trashed||!metadata.parents?.includes(folderId)||!Number.isSafeInteger(Number(metadata.size))||Number(metadata.size)>MAX_FILE_BYTES||(expectedSize!==undefined&&Number(metadata.size)!==expectedSize))throw new Error('Drive file metadata changed');
  const r=await this.request(API+'/files/'+id(fileId)+'?alt=media');if(!r.ok||!r.body)throw new Error('Drive download unavailable');
  const reader=r.body.getReader(),chunks:Uint8Array[]=[];let length=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>MAX_FILE_BYTES){await reader.cancel();throw new Error('Drive file too large');}chunks.push(value);}}finally{reader.releaseLock();}
  if(length!==Number(metadata.size))throw new Error('Drive file size changed');return new Uint8Array(Buffer.concat(chunks));
 }
}
export async function connectedDrive(db:SupabaseClient){
 const {data,error}=await db.from('solta_drive_connection').select('encrypted_refresh_token,root_folder_id').eq('id','solta').single();
 if(error||!data)throw new Error('Connect Solta Drive first');
 const config=driveConfig(),drive=new DriveStorage(await refreshAccessToken(config,data.encrypted_refresh_token));
 return {drive,config,connection:data};
}
async function ensureNode(db:SupabaseClient,drive:DriveStorage,key:string,parent:string,name:string){
 const loaded=await db.from('solta_drive_folders').select('drive_id,parent_id').eq('node_key',key).maybeSingle();let data=loaded.data;if(loaded.error)throw new Error('Folder mapping unavailable');
 if(!data){const candidate=await drive.generateId();const inserted=await db.from('solta_drive_folders').insert({node_key:key,drive_id:candidate,parent_id:parent}).select('drive_id,parent_id').maybeSingle();
  if(inserted.error&&inserted.error.code!=='23505')throw new Error('Folder mapping unavailable');
  data=inserted.data;if(!data){const saved=await db.from('solta_drive_folders').select('drive_id,parent_id').eq('node_key',key).single();data=saved.data;}}
 if(!data||data.parent_id!==parent)throw new Error('Folder mapping changed');await drive.folder(data.drive_id,name,parent);return data.drive_id as string;
}
export async function reserveDriveUpload(db:SupabaseClient,file:{id:string;name:string;mime:string;size:number},project:string,company:string,labels?:{company?:string;project?:string}){
 const {drive,config,connection}=await connectedDrive(db);let root=connection.root_folder_id as string|null;
 if(!root){const candidate=await drive.generateId();const assigned=await db.from('solta_drive_connection').update({root_folder_id:candidate}).eq('id','solta').is('root_folder_id',null).select('root_folder_id').maybeSingle();
  if(assigned.error)throw new Error('Drive root unavailable');root=assigned.data?.root_folder_id||null;if(!root){const saved=await db.from('solta_drive_connection').select('root_folder_id').eq('id','solta').single();root=saved.data?.root_folder_id;}}
 if(!root)throw new Error('Drive root unavailable');await drive.folder(root,'Solta Works — Client Files');
 const companyFolder=await ensureNode(db,drive,'company:'+company,root,labels?.company||'Company '+company);
 const projectFolder=await ensureNode(db,drive,'project:'+project,companyFolder,labels?.project||'Project '+project);
 const loaded=await db.from('solta_drive_files').select('drive_id,folder_id,encrypted_upload_session,session_expires_at').eq('file_id',file.id).maybeSingle();let data=loaded.data;if(loaded.error)throw new Error('Drive file mapping unavailable');
 if(!data){const inserted=await db.from('solta_drive_files').insert({file_id:file.id,drive_id:await drive.generateId(),folder_id:projectFolder}).select('drive_id,folder_id,encrypted_upload_session,session_expires_at').maybeSingle();
  if(inserted.error&&inserted.error.code!=='23505')throw new Error('Drive file mapping unavailable');data=inserted.data;
  if(!data){const saved=await db.from('solta_drive_files').select('drive_id,folder_id,encrypted_upload_session,session_expires_at').eq('file_id',file.id).single();data=saved.data;}}
 if(!data||data.folder_id!==projectFolder)throw new Error('Drive file mapping changed');
 if(data.encrypted_upload_session&&new Date(data.session_expires_at).getTime()>Date.now())return uploadSessionUrl(openToken(data.encrypted_upload_session,config.clientSecret));
 const session=await drive.start(data.drive_id,projectFolder,file.name,file.mime,file.size);
 const saved=await db.from('solta_drive_files').update({encrypted_upload_session:sealToken(session,config.clientSecret),session_expires_at:new Date(Date.now()+6*24*3600*1000).toISOString()}).eq('file_id',file.id);
 if(saved.error)throw new Error('Upload session unavailable');return session;
}
