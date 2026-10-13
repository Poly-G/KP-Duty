import {randomUUID} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import {validateProjectFile,MAX_FILE_BYTES} from '../../project-collaboration/files.ts';
import {ReceiverError,type ReadRequest} from './receiver.ts';
import {connectedDrive,reserveDriveUpload} from '../google-drive/storage.ts';
import {downloadTicket} from './download-ticket.ts';

export async function portalOperation(client:SupabaseClient,input:ReadRequest,nonce:string){
 async function rpc(request:unknown,n=nonce){
  let {data,error}=await client.rpc(input.operation.startsWith('file.')?'kp_solta_portal_drive_operation':'kp_solta_portal_operation',{p_request:request,p_nonce:n});
  // Rolling deployment before the additive migration uses the unchanged legacy RPC.
  if(error&&['PGRST202','42883'].includes(error.code)){({data,error}=await client.rpc('kp_solta_portal_operation',{p_request:request,p_nonce:n}));}
  if(error){if(['P0001','23505','23514'].includes(error.code))throw new ReceiverError(409,'This item changed or was already submitted. Reload and check before retrying.');throw new Error('KP operation unavailable');}return data;
 }
 const storage=client.storage.from('kp-project-files');
 if(input.operation==='file.complete'){
  const file=await rpc({...input,operation:'file.inspect'});if(!file)return null;
  if(file.state==='ready')return {id:file.id,state:'ready'};
  let bytes:Uint8Array;
  if(file.provider==='google-drive'){
   try{const {drive}=await connectedDrive(client);bytes=await drive.bytes(file.driveId,file.folderId,file.size);}catch{throw new ReceiverError(409,'The upload is not complete. Retry the same file.');}
  }else{
   const {data,error}=await storage.download(file.path);if(error||!data)throw new ReceiverError(409,'The upload is not complete. Retry the same file.');
   bytes=new Uint8Array(await data.arrayBuffer());
  }
  if(bytes.length!==file.size||bytes.length>MAX_FILE_BYTES)throw new ReceiverError(422,'The uploaded file size does not match.');
  let checked;try{checked=validateProjectFile(file.name,bytes);}catch{throw new ReceiverError(422,'The file contents do not match a supported format.');}
  if(checked.mime!==file.mime||checked.sha256!==file.sha256)throw new ReceiverError(422,'The uploaded file does not match.');
  return rpc({...input,payload:{...input.payload,verifiedSha256:checked.sha256,...(file.provider==='google-drive'?{verifiedDriveId:file.driveId,verifiedSize:bytes.length}:{})}},randomUUID());
 }
 const result=await rpc(input);if(!result)return null;
 if(input.operation==='file.reserve'){
  if(result.state==='ready')return {id:result.id,state:'ready'};
  if(!result.driveEnabled&&result.provider!=='google-drive'){
   const {data,error}=await storage.createSignedUploadUrl(result.path,{upsert:false});
   if(error||!data)throw new Error('Upload link unavailable');return {id:result.id,state:'pending',uploadUrl:data.signedUrl,uploadProvider:'supabase'};
  }
  const uploadUrl=await reserveDriveUpload(client,{id:result.id,...input.payload},input.projectId,input.organizationId,{company:result.companyName,project:result.projectName});
  return {id:result.id,state:'pending',uploadUrl,uploadProvider:'google-drive'};
 }
 if(input.operation==='file.download'){
  const secret=process.env.SOLTA_PORTAL_SHARED_SECRET;if(!secret||secret.length<32)throw new Error('Download unavailable');
  return {url:'https://kp-duty.vercel.app/api/integrations/solta/files?ticket='+encodeURIComponent(downloadTicket(input,secret))};
 }

 return result;
}
