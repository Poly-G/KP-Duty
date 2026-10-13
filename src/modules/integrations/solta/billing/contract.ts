import {createHmac,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
export const billingPath='/api/integrations/kp/billing',paymentPath='/api/integrations/solta/payments';
const identity=z.object({version:z.literal(1),business:z.literal('solta'),projectId:z.uuid(),organizationId:z.uuid(),portalProjectId:z.uuid()});
const staff=identity.extend({actorId:z.uuid()});
export const requestDetails=z.object({requestId:z.uuid(),title:z.string().trim().min(1).max(200),amount:z.number().int().min(50).max(99999999),currency:z.literal('usd'),livemode:z.boolean(),confirmed:z.literal(true)}).strict();
export const billingRequest=z.union([
 staff.extend({operation:z.literal('status')}).strict(),
 staff.extend({operation:z.literal('create'),payload:requestDetails}).strict(),
 staff.extend({operation:z.literal('cancel'),requestId:z.uuid()}).strict(),
]);
export const paymentEvent=identity.extend({operation:z.literal('payment.received'),requestId:z.uuid(),paymentId:z.uuid(),amount:z.number().int().min(50).max(99999999),currency:z.literal('usd'),livemode:z.boolean(),stripeSessionId:z.string().regex(/^cs_(test_|live_)[A-Za-z0-9]+$/),stripePaymentIntentId:z.string().regex(/^pi_[A-Za-z0-9]+$/),paidAt:z.iso.datetime()}).strict().refine(p=>p.stripeSessionId.startsWith(p.livemode?'cs_live_':'cs_test_'),'Payment mode mismatch');
export const billingRecord=z.object({requestId:z.uuid(),title:z.string(),amount:z.number().int(),currency:z.literal('usd'),livemode:z.boolean(),active:z.boolean(),paid:z.boolean(),checkoutStarted:z.boolean(),payment:paymentEvent.nullable()}).refine(r=>r.paid===!!r.payment&&(!r.payment||(r.payment.requestId===r.requestId&&r.payment.amount===r.amount&&r.payment.currency===r.currency&&r.payment.livemode===r.livemode)),'Payment record mismatch');
export const billingStatus=z.object({records:z.array(billingRecord).max(200),liveEnabled:z.boolean(),testEnabled:z.boolean()});
export type BillingRequest=z.infer<typeof billingRequest>;
export type PaymentEvent=z.infer<typeof paymentEvent>;
export type BillingStatus=z.infer<typeof billingStatus>;
export class BillingError extends Error{status:number;constructor(status:number,message:string){super(message);this.status=status;}}
export function billingSignature(secret:string,path:string,timestamp:string,nonce:string,raw:string){
 if(secret.length<32||![billingPath,paymentPath].includes(path))throw new Error('Billing connection unavailable');
 const key=createHmac('sha256',secret).update('solta-billing:v1').digest();
 return createHmac('sha256',key).update(`POST\n${path}\n${timestamp}\n${nonce}\n${raw}`).digest('hex');
}
export async function signedBillingBody(request:Request,secret:string,path:string,now=Date.now()){
 const timestamp=request.headers.get('x-billing-timestamp')||'',nonce=request.headers.get('x-billing-nonce')||'',signature=request.headers.get('x-billing-signature')||'';
 if(!/^\d{10}$/.test(timestamp)||Math.abs(now/1000-Number(timestamp))>300||!z.uuid().safeParse(nonce).success||!/^[a-f0-9]{64}$/.test(signature))throw new BillingError(401,'Unauthorized');
 if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new BillingError(415,'JSON required');
 const reader=request.body?.getReader();if(!reader)throw new BillingError(400,'Invalid request');let size=0;const chunks:Uint8Array[]=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>32768){await reader.cancel();throw new BillingError(413,'Request too large');}chunks.push(value);}}finally{reader.releaseLock();}
 let raw:string;try{raw=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));}catch{throw new BillingError(400,'Invalid request');}
 if(!timingSafeEqual(Buffer.from(billingSignature(secret,path,timestamp,nonce,raw),'hex'),Buffer.from(signature,'hex')))throw new BillingError(401,'Unauthorized');
 let data;try{data=JSON.parse(raw);}catch{throw new BillingError(400,'Invalid request');}return {data,nonce};
}
