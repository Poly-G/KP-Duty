import 'server-only';
import {randomUUID} from 'node:crypto';
import {driveDatabase} from '@/modules/integrations/google-drive/server';
import {notificationEvent,notificationPath,notificationSignature} from './contract';
export async function dispatchProjectEmails(projectId:string,retry=false){
 if(process.env.VERCEL_ENV!=='production')return {sent:0,pending:true};
 const secret=process.env.SOLTA_PORTAL_SHARED_SECRET;
 if(!secret||secret.length<32)throw new Error('Project email connection unavailable');
 const db=driveDatabase(),lease=randomUUID();
 if(retry){const {error}=await db.from('solta_notification_events').update({next_attempt_at:new Date().toISOString()}).eq('project_id',projectId).eq('status','pending');if(error)throw new Error('Retry unavailable');}
 const {data:rows,error}=await db.rpc('kp_claim_solta_notifications',{p_project:projectId,p_lease:lease});
 if(error)throw new Error('Project email queue unavailable');
 let sent=0,pending=false;
 for(const row of rows||[]){
  let errorCode='EMAIL_DELIVERY_PENDING';
  try{
   const event=notificationEvent.parse({...row.payload,version:1,business:'solta',eventId:row.id,sourceId:row.source_id,kind:row.event_kind,createdAt:new Date(row.created_at).toISOString()});
   const raw=JSON.stringify(event),timestamp=String(Math.floor(Date.now()/1000)),nonce=randomUUID();
   const response=await fetch('https://www.soltaworks.com'+notificationPath,{method:'POST',headers:{'Content-Type':'application/json','X-Notification-Timestamp':timestamp,'X-Notification-Nonce':nonce,'X-Notification-Signature':notificationSignature(secret,timestamp,nonce,raw)},body:raw,redirect:'error',signal:AbortSignal.timeout(45000)});
   if(!response.ok){const failure=await response.json().catch(()=>null);if(failure?.code==='DELIVERY_NEEDS_REVIEW')errorCode='DELIVERY_NEEDS_REVIEW';throw new Error('EMAIL_PENDING');}
   const text=await response.text();if(Buffer.byteLength(text)>32768)throw new Error('INVALID_ACK');const acknowledgement=JSON.parse(text);
   if(acknowledgement.accepted!==true||acknowledgement.eventId!==row.id)throw new Error('INVALID_ACK');
   const saved=await db.from('solta_notification_events').update({status:'sent',sent_at:new Date().toISOString(),lease_id:null,lease_until:null,error_code:null}).eq('id',row.id).eq('lease_id',lease).select('id').maybeSingle();
   if(saved.error||!saved.data)throw new Error('ACK_SAVE_FAILED');sent++;
  }catch{
   pending=true;
   await db.from('solta_notification_events').update({status:'pending',lease_id:null,lease_until:null,error_code:errorCode,next_attempt_at:new Date(Date.now()+300000).toISOString()}).eq('id',row.id).eq('lease_id',lease);
  }
 }
 const remaining=await db.from('solta_notification_events').select('id',{head:true,count:'exact'}).eq('project_id',projectId).neq('status','sent');
 return {sent,pending:pending||!!remaining.count||!!remaining.error};
}
export async function tryProjectEmails(projectId:string){try{await dispatchProjectEmails(projectId);}catch{console.error('Project email dispatch pending','UNAVAILABLE');}}
