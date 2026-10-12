import {randomUUID} from 'node:crypto';
import {driveDatabase} from '@/modules/integrations/google-drive/server';
import {connectedDrive} from '@/modules/integrations/google-drive/storage';
import {verifyDownloadTicket} from '@/modules/integrations/solta/download-ticket';
import {validateProjectFile} from '@/modules/project-collaboration/files';
export const runtime='nodejs';
export async function GET(request:Request){
 const secret=process.env.SOLTA_PORTAL_SHARED_SECRET;
 if(process.env.SOLTA_PORTAL_RECEIVER_ENABLED!=='true'||!secret||secret.length<32)return new Response('Unavailable',{status:503});
 let input;try{input=verifyDownloadTicket(new URL(request.url).searchParams.get('ticket')||'',secret);}catch{return new Response('Unauthorized',{status:401,headers:{'Cache-Control':'no-store'}});}
 try{
  const db=driveDatabase();
  // Recheck the company/project mapping and ready state at download time.
  const {data:file,error}=await db.rpc('kp_solta_portal_drive_operation',{p_request:input,p_nonce:randomUUID()});
  if(error||!file||file.provider!=='google-drive')return new Response('Not found',{status:404});
  const {drive}=await connectedDrive(db),bytes=await drive.bytes(file.driveId,file.folderId,file.size);
  const checked=validateProjectFile(file.name,bytes);if(checked.sha256!==file.sha256||checked.mime!==file.mime)throw new Error('Drive file changed');
  let offset=0;
  const stream=new ReadableStream<Uint8Array>({pull(controller){if(offset>=bytes.length){controller.close();return;}const end=Math.min(offset+65536,bytes.length);controller.enqueue(bytes.subarray(offset,end));offset=end;}});
  return new Response(stream,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}"`,'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
 }catch{return new Response('File unavailable',{status:503,headers:{'Cache-Control':'no-store'}});}
}
