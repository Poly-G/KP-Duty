import {randomUUID} from 'node:crypto';
import {driveDatabase} from '@/modules/integrations/google-drive/server';
import {dispatchProjectEmails} from '@/modules/integrations/solta/notifications/dispatch';
import {retryToken} from '@/modules/integrations/solta/notifications/retry-token';
export const runtime='nodejs';
export const maxDuration=300;
export async function POST(request:Request){
 const headers={'Cache-Control':'no-store'};
 if(process.env.VERCEL_ENV!=='production')return Response.json({error:'Unavailable'},{status:404,headers});
 const token=retryToken(request.headers.get('authorization'));
 if(!token)return Response.json({error:'Unauthorized'},{status:401,headers});
 try{
  const db=driveDatabase(),lease=randomUUID();
  const claimed=await db.rpc('kp_begin_solta_email_tick',{p_token:token,p_lease:lease});
  if(claimed.error)return Response.json({error:'Unauthorized'},{status:401,headers});
  if(!claimed.data)return Response.json({accepted:true},{headers});
  let ok=false;
  try{await dispatchProjectEmails(claimed.data);ok=true;}
  finally{const finished=await db.rpc('kp_finish_solta_email_tick',{p_lease:lease,p_ok:ok});if(finished.error)throw new Error('RETRY_RECORD_PENDING');}
  return Response.json({accepted:true},{headers});
 }catch{return Response.json({error:'Retry unavailable'},{status:503,headers});}
}
