'use server';
import {randomUUID} from 'node:crypto';
import {revalidatePath} from 'next/cache';
import {createClient as integrationClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {requireAdminIdentity} from '@/lib/auth/current-user';
import {createClient} from '@/lib/supabase/server';
import {getDelivery,getScopes} from '@/modules/delivery/queries';
import {assertOfficePaymentScope} from './office-scope';
import {BillingError,requestDetails,type BillingStatus} from './contract';
import {soltaBillingRequest} from './client';
async function context(projectId:string){
 const {user}=await requireAdminIdentity();if(!z.uuid().safeParse(projectId).success)throw new BillingError(404,'Project not found.');
 const delivery=await getDelivery(projectId,'solta');if(!delivery)throw new BillingError(404,'Solta client project not found.');
 const db=await createClient();const {data:link,error}=await db.from('solta_portal_project_links').select('portal_project_id').eq('project_id',projectId).eq('organization_id',delivery.project.organization.id).eq('enabled',true).maybeSingle();
 if(error||!link)throw new BillingError(409,'Set up client portal access before requesting payment.');
 return {version:1 as const,business:'solta' as const,actorId:user.id,projectId,organizationId:delivery.project.organization.id,portalProjectId:link.portal_project_id};
}
function friendly(error:unknown){return error instanceof BillingError?error.message:error instanceof z.ZodError?'Check the payment title, amount, mode and confirmation.':'Billing was interrupted. Retry the same request or refresh payment status.';}
async function checkOfficeScope(projectId:string,requestScopeId?:string|null){
 const delivery=await getDelivery(projectId,'solta');
 if(delivery?.engagement.service!=='less_office')return;
 const scopes=await getScopes(projectId);
 try{assertOfficePaymentScope('less_office',scopes.versions[0]?.id,scopes.approvals.map(a=>a.scope_id),requestScopeId);}catch(error){throw new BillingError(409,(error as Error).message);}
}
async function reconcile(status:BillingStatus){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.KP_INTEGRATION_SUPABASE_SECRET;if(!url||!key)throw new BillingError(503,'Payment sync is not configured.');
 const viewer=await createClient(),ids=status.records.filter(r=>r.payment).map(r=>r.requestId);if(!ids.length)return;
 const existing=await viewer.from('solta_payment_requests').select('id,status,portal_payment_id').in('id',ids);if(existing.error)throw new BillingError(503,'Payment status could not be checked.');
 const known=new Map((existing.data||[]).map(r=>[r.id,r]));const db=integrationClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const pending=status.records.filter(r=>r.payment&&(known.get(r.requestId)?.status!=='paid'||known.get(r.requestId)?.portal_payment_id!==r.payment.paymentId));
 for(const record of pending.slice(0,20)){const {error}=await db.rpc('kp_receive_solta_payment',{p_event:record.payment,p_nonce:randomUUID()});if(error)throw new BillingError(503,'A payment needs reconciliation. Retry refresh.');}
 if(pending.length>20)throw new BillingError(503,'More payments need syncing. Refresh payment status again.');
}
export async function getSoltaBilling(projectId:string){
 try{const source=await context(projectId);const remote=await soltaBillingRequest({...source,operation:'status'});await reconcile(remote);return {available:true as const,status:remote};}catch(error){return {available:false as const,error:friendly(error),status:null};}
}
export async function requestSoltaPayment(data:FormData){
 try{
  const source=await context(String(data.get('project_id')||''));const dollars=String(data.get('amount')||'').trim();if(!/^\d{1,6}(\.\d{1,2})?$/.test(dollars))throw new BillingError(400,'Enter a dollar amount with up to two decimal places.');
  const payload=requestDetails.parse({requestId:data.get('request_id'),title:data.get('title'),amount:Math.round(Number(dollars)*100),currency:'usd',livemode:data.get('mode')==='live',confirmed:data.get('confirmed')==='on'});
  if(!['test','live'].includes(String(data.get('mode'))))throw new BillingError(400,'Choose a payment mode.');
  await checkOfficeScope(source.projectId);
  const db=await createClient();const {data:prepared,error}=await db.rpc('kp_prepare_solta_payment',{p_id:payload.requestId,p_project:source.projectId,p_title:payload.title,p_amount:payload.amount,p_live:payload.livemode});
  if(error)throw new BillingError(409,error.code==='P0001'?error.message:'Payment preparation is unavailable.');
  if(prepared.requestId!==payload.requestId||prepared.projectId!==source.projectId||prepared.organizationId!==source.organizationId||prepared.portalProjectId!==source.portalProjectId)throw new BillingError(409,'Payment identity changed. Reload before continuing.');
  const remote=await soltaBillingRequest({...source,operation:'create',payload});const record=remote.records.find(r=>r.requestId===payload.requestId);
  if(!record||record.amount!==payload.amount||record.title!==payload.title||record.livemode!==payload.livemode)throw new BillingError(503,'Payment request was not confirmed. Retry the same request.');
  if(!record.active&&!record.paid)throw new BillingError(409,'This payment request was cancelled. Refresh before creating a new request.');
  await reconcile(remote);const saved=await db.rpc('kp_mark_solta_payment',{p_id:payload.requestId,p_cancel:false});if(saved.error)throw new BillingError(503,'Payment request needs refresh.');
  revalidatePath(`/businesses/solta/projects/${source.projectId}`);return {ok:true as const};
 }catch(error){return {ok:false as const,error:friendly(error)};}
}
export async function refreshSoltaPayments(data:FormData){const id=String(data.get('project_id')||'');const result=await getSoltaBilling(id);if(!result.available)return {ok:false as const,error:result.error};revalidatePath(`/businesses/solta/projects/${id}`);return {ok:true as const};}
export async function cancelSoltaPayment(data:FormData){
 try{const source=await context(String(data.get('project_id')||'')),requestId=z.uuid().parse(data.get('request_id'));const remote=await soltaBillingRequest({...source,operation:'cancel',requestId});const record=remote.records.find(r=>r.requestId===requestId);if(!record||record.active||record.paid)throw new BillingError(409,'Cancellation was not confirmed.');const db=await createClient();const {error}=await db.rpc('kp_mark_solta_payment',{p_id:requestId,p_cancel:true});if(error)throw new BillingError(503,'Cancellation needs refresh.');revalidatePath(`/businesses/solta/projects/${source.projectId}`);return {ok:true as const};}catch(error){return {ok:false as const,error:friendly(error)};}
}
export async function retrySoltaPayment(data:FormData){
 try{const source=await context(String(data.get('project_id')||'')),requestId=z.uuid().parse(data.get('request_id')),db=await createClient();const {data:row,error}=await db.from('solta_payment_requests').select('*').eq('id',requestId).eq('project_id',source.projectId).eq('organization_id',source.organizationId).eq('portal_project_id',source.portalProjectId).maybeSingle();if(error||!row||row.status!=='prepared')throw new BillingError(409,'Refresh before retrying this payment request.');
  await checkOfficeScope(source.projectId,row.scope_id);
  const remote=await soltaBillingRequest({...source,operation:'create',payload:{requestId,title:row.title,amount:row.amount,currency:'usd',livemode:row.livemode,confirmed:true}});const record=remote.records.find(r=>r.requestId===requestId);if(!record)throw new BillingError(503,'Payment request could not be confirmed.');await reconcile(remote);const saved=await db.rpc('kp_mark_solta_payment',{p_id:requestId,p_cancel:!record.active});if(saved.error)throw new BillingError(503,'Payment request needs refresh.');revalidatePath(`/businesses/solta/projects/${source.projectId}`);return {ok:true as const};
 }catch(error){return {ok:false as const,error:friendly(error)};}
}
