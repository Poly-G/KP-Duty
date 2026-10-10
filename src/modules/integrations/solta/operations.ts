import {randomUUID} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import {validateProjectFile,MAX_FILE_BYTES} from '../../project-collaboration/files.ts';
import {ReceiverError,type ReadRequest} from './receiver.ts';

export async function portalOperation(client:SupabaseClient,input:ReadRequest,nonce:string){
 async function rpc(request:unknown,n=nonce){
  const {data,error}=await client.rpc('kp_solta_portal_operation',{p_request:request,p_nonce:n});
  if(error){if(['P0001','23505','23514'].includes(error.code))throw new ReceiverError(409,'This item changed or was already submitted. Reload and check before retrying.');throw new Error('KP operation unavailable');}return data;
 }
 const storage=client.storage.from('kp-project-files');
 if(input.operation==='file.complete'){
  const file=await rpc({...input,operation:'file.inspect'});if(!file)return null;
  if(file.state==='ready')return {id:file.id,state:'ready'};
  const {data,error}=await storage.download(file.path);
  if(error||!data)throw new ReceiverError(409,'The upload is not complete. Retry the same file.');
  if(data.size!==file.size||data.size>MAX_FILE_BYTES)throw new ReceiverError(422,'The uploaded file size does not match.');
  let checked;try{checked=validateProjectFile(file.name,new Uint8Array(await data.arrayBuffer()));}catch{throw new ReceiverError(422,'The file contents do not match a supported format.');}
  if(checked.mime!==file.mime||checked.sha256!==file.sha256)throw new ReceiverError(422,'The uploaded file does not match.');
  return rpc({...input,payload:{...input.payload,verifiedSha256:checked.sha256}},randomUUID());
 }
 const result=await rpc(input);if(!result)return null;
 if(input.operation==='file.reserve'){
  if(result.state==='ready')return {id:result.id,state:'ready'};
  const {data,error}=await storage.createSignedUploadUrl(result.path,{upsert:false});
  if(error||!data)throw new Error('Upload link unavailable');
  return {id:result.id,state:'pending',uploadUrl:data.signedUrl};
 }
 if(input.operation==='file.download'){
  const {data,error}=await storage.createSignedUrl(result.path,60,{download:result.name});
  if(error||!data)throw new Error('Download unavailable');return {url:data.signedUrl};
 }
 return result;
}
