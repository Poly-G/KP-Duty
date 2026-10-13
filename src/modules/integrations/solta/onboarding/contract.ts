import {createHmac,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
export const onboardingPath='/api/integrations/kp/onboarding';
const person=z.object({name:z.string().trim().min(1).max(100),email:z.string().trim().toLowerCase().pipe(z.email().max(254))}).strict();
const base=z.object({version:z.literal(1),business:z.literal('solta'),actorId:z.uuid(),actorName:z.string().trim().min(1).max(100),projectId:z.uuid(),organizationId:z.uuid(),companyName:z.string().trim().min(1).max(120),projectName:z.string().trim().min(1).max(200)}).strict();
export const setupPeople=z.object({approver:person,members:z.array(person).max(9),replaceApprover:z.boolean(),confirmedCompanyAccess:z.literal(true)}).strict().refine(input=>new Set([input.approver.email,...input.members.map(p=>p.email)]).size===input.members.length+1,'Each person needs a different email address.');
export const onboardingRequest=z.union([
 base.extend({operation:z.literal('status')}).strict(),
 base.extend({operation:z.literal('prepare'),requestId:z.uuid(),portalProjectId:z.uuid(),people:setupPeople}).strict(),
 base.extend({operation:z.literal('commit'),requestId:z.uuid(),portalProjectId:z.uuid()}).strict(),
 base.extend({operation:z.literal('invite'),requestId:z.uuid(),portalProjectId:z.uuid(),email:person.shape.email}).strict(),
]);
export type OnboardingRequest=z.infer<typeof onboardingRequest>;
export type SetupPeople=z.infer<typeof setupPeople>;
export const onboardingStatus=z.object({projectEmailsReady:z.boolean().default(false),ready:z.boolean(),members:z.array(z.object({name:z.string().nullable(),email:z.email(),role:z.enum(['member','approver'])})),portalProjectId:z.uuid().nullable(),jobId:z.uuid().nullable(),welcomeAccepted:z.array(z.email()),inviteEmails:z.array(z.email()).default([])});
export type OnboardingStatus=z.infer<typeof onboardingStatus>;
export class OnboardingError extends Error{status:number;constructor(status:number,message:string){super(message);this.status=status;}}
export function onboardingSignature(secret:string,timestamp:string,nonce:string,raw:string){
 if(secret.length<32)throw new Error('Setup connection unavailable');
 const key=createHmac('sha256',secret).update('kp-solta-onboarding-key:v1').digest();
 return createHmac('sha256',key).update(`POST\n${onboardingPath}\n${timestamp}\n${nonce}\n${raw}`).digest('hex');
}
export async function readOnboardingRequest(request:Request,secret:string,now=Date.now()){
 const timestamp=request.headers.get('x-kp-timestamp')||'',nonce=request.headers.get('x-kp-nonce')||'',signature=request.headers.get('x-kp-signature')||'';
 if(!/^\d{10}$/.test(timestamp)||Math.abs(now/1000-Number(timestamp))>300||!z.uuid().safeParse(nonce).success||!/^[a-f0-9]{64}$/.test(signature))throw new OnboardingError(401,'Unauthorized');
 if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new OnboardingError(415,'JSON required');
 const reader=request.body?.getReader();if(!reader)throw new OnboardingError(400,'Invalid request');let length=0;const chunks:Uint8Array[]=[];
 try{while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>32768){await reader.cancel();throw new OnboardingError(413,'Request too large');}chunks.push(value);}}finally{reader.releaseLock();}
 let raw:string;try{raw=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));}catch{throw new OnboardingError(400,'Invalid request');}
 if(!timingSafeEqual(Buffer.from(onboardingSignature(secret,timestamp,nonce,raw),'hex'),Buffer.from(signature,'hex')))throw new OnboardingError(401,'Unauthorized');
 let parsed;try{parsed=JSON.parse(raw);}catch{throw new OnboardingError(400,'Invalid request');}
 const result=onboardingRequest.safeParse(parsed);if(!result.success)throw new OnboardingError(400,'Check the client setup fields');return {input:result.data,nonce};
}
