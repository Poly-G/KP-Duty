import {createHash} from 'node:crypto';
import {z} from 'zod';

const contact=z.object({id:z.string().min(1).max(128),name:z.string().max(200),email:z.email(),canMessage:z.boolean()});
export const recipeConfig=z.object({id:z.uuid(),kind:z.enum(['inquiry','reminder','review']),active:z.boolean().default(false),scopeApproved:z.boolean().default(false),paymentVerified:z.boolean().default(false),accessReady:z.boolean().default(false),acceptanceApproved:z.boolean().default(false),scopeVersion:z.number().int().positive(),messageApproved:z.boolean().default(false),message:z.string().trim().max(2000),staffInbox:z.email(),reviewUrl:z.url().refine(value=>new URL(value).protocol==='https:').optional(),reminderHours:z.number().int().min(1).max(168).default(24)}).strict();
export const recipeEvent=z.discriminatedUnion('type',[
 z.object({type:z.literal('inquiry'),id:z.string().min(1).max(128),contact,summary:z.string().max(2000)}).strict(),
 z.object({type:z.literal('appointment'),id:z.string().min(1).max(128),version:z.string().min(1).max(128),contact,status:z.enum(['confirmed','cancelled']),startsAt:z.iso.datetime({offset:true}),timeZone:z.string().min(1).max(100)}).strict(),
 z.object({type:z.literal('completed_job'),id:z.string().min(1).max(128),contact}).strict(),
]);
export type RecipeStep={type:'upsert-contact';contact:z.infer<typeof contact>}|{type:'notify-staff';to:string;summary:string}|{type:'schedule-reminder';contact:z.infer<typeof contact>;appointmentId:string;version:string;at:string;startsAt:string;timeZone:string;message:string;recheckBeforeSend:true}|{type:'send-review';contact:z.infer<typeof contact>;message:string;reviewUrl:string};
export function planOfficeRecipe(configValue:z.input<typeof recipeConfig>,eventValue:z.input<typeof recipeEvent>,now=new Date()){
 const config=recipeConfig.parse(configValue),event=recipeEvent.parse(eventValue);
 if(!config.active||!config.scopeApproved||!config.paymentVerified||!config.accessReady||!config.acceptanceApproved)throw new Error('Activate only after scope approval, payment, setup and client acceptance.');
 const matching={inquiry:'inquiry',reminder:'appointment',review:'completed_job'}[config.kind];
 if(event.type!==matching)throw new Error('Event does not match the agreed task.');
 const key=createHash('sha256').update(JSON.stringify([config.id,config.scopeVersion,event.type,event.id,event.type==='appointment'?event.version:''])).digest('hex');
 if(event.type==='inquiry')return {key,steps:[{type:'upsert-contact',contact:event.contact},{type:'notify-staff',to:config.staffInbox,summary:event.summary}] as RecipeStep[],skipped:null};
 if(!config.messageApproved||!config.message)throw new Error('Approve the message wording before sending.');
 if(!event.contact.canMessage)return {key,steps:[] as RecipeStep[],skipped:'Contact cannot receive messages.'};
 if(event.type==='appointment'){
  try{new Intl.DateTimeFormat('en-US',{timeZone:event.timeZone});}catch{throw new Error('Confirm the appointment time zone.');}
  const due=new Date(new Date(event.startsAt).getTime()-config.reminderHours*3600000);
  if(event.status==='cancelled'||due<=now)return {key,steps:[] as RecipeStep[],skipped:'Appointment cancelled or reminder window passed.'};
  return {key,steps:[{type:'schedule-reminder',contact:event.contact,appointmentId:event.id,version:event.version,at:due.toISOString(),startsAt:event.startsAt,timeZone:event.timeZone,message:config.message,recheckBeforeSend:true}] as RecipeStep[],skipped:null};
 }
 if(!config.reviewUrl)throw new Error('Confirm the HTTPS review link.');
 return {key,steps:[{type:'send-review',contact:event.contact,message:config.message,reviewUrl:config.reviewUrl}] as RecipeStep[],skipped:null};
}

// Each customer adapter must implement durable, atomic claim and step idempotency.
// A reminder adapter must reload status, time, version and permission at send time.
export type RecipePorts={claim:(key:string)=>Promise<boolean>;execute:(step:RecipeStep,key:string)=>Promise<void>;finish:(key:string)=>Promise<void>;fail:(key:string)=>Promise<void>};
export async function runOfficeRecipe(config:z.input<typeof recipeConfig>,event:z.input<typeof recipeEvent>,ports:RecipePorts,now=new Date()){
 const plan=planOfficeRecipe(config,event,now);
 if(plan.skipped)return {status:'skipped' as const,reason:plan.skipped};
 if(!await ports.claim(plan.key))return {status:'duplicate' as const};
 try{for(const [index,step] of plan.steps.entries())await ports.execute(step,plan.key+':'+index);await ports.finish(plan.key);return {status:'complete' as const};}
 catch(error){await ports.fail(plan.key);throw error;}
}
