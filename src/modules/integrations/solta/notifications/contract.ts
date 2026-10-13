import {createHmac,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
export const notificationPath='/api/integrations/kp/notifications';
const base=z.object({version:z.literal(1),business:z.literal('solta'),eventId:z.uuid(),sourceId:z.uuid(),projectId:z.uuid(),organizationId:z.uuid(),portalProjectId:z.uuid(),projectName:z.string().min(1).max(300),companyName:z.string().min(1).max(300),createdAt:z.iso.datetime()});
export const notificationEvent=z.discriminatedUnion('kind',[
 base.extend({kind:z.literal('message.created'),actorName:z.string().min(1).max(100)}).strict(),
 base.extend({kind:z.literal('file.verified'),label:z.string().min(1).max(200)}).strict(),
 base.extend({kind:z.literal('review.decided'),actorName:z.string().min(1).max(100),outcome:z.enum(['approved','changes_requested']),versionNumber:z.number().int().positive(),label:z.string().min(1).max(200)}).strict(),
 base.extend({kind:z.enum(['payment.requested','payment.received']),label:z.string().min(1).max(200),amount:z.number().int().min(50).max(99999999),livemode:z.boolean()}).strict(),
]);
export type NotificationEvent=z.infer<typeof notificationEvent>;
export class NotificationError extends Error{constructor(public status:number,message:string){super(message);}}
export function notificationSignature(secret:string,timestamp:string,nonce:string,raw:string){
 if(secret.length<32)throw new Error('Notification connection unavailable');
 const key=createHmac('sha256',secret).update('solta-notifications:v1').digest();
 return createHmac('sha256',key).update(`POST\n${notificationPath}\n${timestamp}\n${nonce}\n${raw}`).digest('hex');
}
export async function readNotificationRequest(request:Request,secret:string,now=Date.now()){
 if(request.method!=='POST'||new URL(request.url).pathname!==notificationPath)throw new NotificationError(401,'Unauthorized');
 const timestamp=request.headers.get('x-notification-timestamp')||'',nonce=request.headers.get('x-notification-nonce')||'',signature=request.headers.get('x-notification-signature')||'';
 if(!/^\d{10}$/.test(timestamp)||Math.abs(now/1000-Number(timestamp))>300||!z.uuid().safeParse(nonce).success||!/^[a-f0-9]{64}$/.test(signature))throw new NotificationError(401,'Unauthorized');
 if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new NotificationError(415,'JSON required');
 const reader=request.body?.getReader();if(!reader)throw new NotificationError(400,'Invalid request');
 let length=0;const chunks:Uint8Array[]=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>32768){await reader.cancel();throw new NotificationError(413,'Request too large');}chunks.push(value);}}finally{reader.releaseLock();}
 let raw:string;try{raw=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));}catch{throw new NotificationError(400,'Invalid request');}
 if(!timingSafeEqual(Buffer.from(notificationSignature(secret,timestamp,nonce,raw),'hex'),Buffer.from(signature,'hex')))throw new NotificationError(401,'Unauthorized');
 let input;try{input=notificationEvent.parse(JSON.parse(raw));}catch{throw new NotificationError(400,'Invalid event');}
 return {input,nonce};
}
