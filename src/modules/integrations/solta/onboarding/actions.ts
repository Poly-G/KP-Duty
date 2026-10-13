'use server';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {requireAdminIdentity} from '@/lib/auth/current-user';
import {createClient} from '@/lib/supabase/server';
import {getDelivery} from '@/modules/delivery/queries';
import {OnboardingError,setupPeople,onboardingStatus,type OnboardingStatus} from './contract';
import {soltaSetupRequest} from './client';
import {runClientSetup} from './workflow';
async function context(projectId:string){
 const {user,profile}=await requireAdminIdentity();if(!z.uuid().safeParse(projectId).success)throw new OnboardingError(400,'Project not found.');
 const delivery=await getDelivery(projectId,'solta');if(!delivery)throw new OnboardingError(404,'Solta client project not found.');
 return {version:1 as const,business:'solta' as const,actorId:user.id,actorName:(profile.display_name||'KP administrator').slice(0,100),projectId,organizationId:delivery.project.organization.id,companyName:delivery.project.organization.name,projectName:delivery.project.name};
}
function friendly(error:unknown){if(error instanceof OnboardingError)return error.message;if(error instanceof z.ZodError)return 'Check the names, email addresses, and company access confirmation.';console.error('Solta client setup action failed','UNAVAILABLE');return 'Setup was interrupted. Retry the same setup; access will only open after every step succeeds.';}
export async function getClientPortalStatus(projectId:string):Promise<{available:boolean;status:OnboardingStatus|null;error?:string}>{
 const source=await context(projectId);
 try{return {available:true,status:onboardingStatus.parse(await soltaSetupRequest({...source,operation:'status'}))};}catch(error){return {available:false,status:null,error:friendly(error)};}
}
export async function setupClientPortal(data:FormData){
 const source=await context(String(data.get('project_id')||''));
 try{
  const requestId=z.uuid().parse(data.get('request_id'));
  const membersText=String(data.get('members_json')||'[]');if(membersText.length>8000)throw new OnboardingError(400,'Use up to nine additional people.');
  let members;try{members=JSON.parse(membersText);}catch{throw new OnboardingError(400,'Check the additional people.');}
  const people=setupPeople.parse({approver:{name:data.get('approver_name'),email:data.get('approver_email')},members,replaceApprover:data.get('replace_approver')==='on',confirmedCompanyAccess:data.get('company_access_confirmed')==='on'});
  const db=await createClient();
  const rpc=async(name:'kp_prepare_solta_client_setup'|'kp_advance_solta_client_setup',args:Record<string,unknown>)=>{const {data,error}=await db.rpc(name,args);if(error){if(error.code==='P0001')throw new OnboardingError(409,error.message);throw new OnboardingError(503,'KP client setup is not ready yet.');}return data;};
  await runClientSetup(source,requestId,people,{prepare:async()=>{const result=await rpc('kp_prepare_solta_client_setup',{p_id:requestId,p_project:source.projectId,p_people:people});return z.object({portalProjectId:z.uuid(),projectId:z.uuid(),organizationId:z.uuid()}).parse(result);},link:async id=>{await rpc('kp_advance_solta_client_setup',{p_id:requestId,p_portal_project:id,p_complete:false});},complete:async id=>{await rpc('kp_advance_solta_client_setup',{p_id:requestId,p_portal_project:id,p_complete:true});},remote:soltaSetupRequest});
  revalidatePath(`/businesses/solta/projects/${source.projectId}`);return {ok:true as const};
 }catch(error){return {ok:false as const,error:friendly(error)};}
}
export async function sendClientWelcome(data:FormData){
 const source=await context(String(data.get('project_id')||''));
 try{
  const requestId=z.uuid().parse(data.get('request_id')),email=z.string().trim().toLowerCase().pipe(z.email()).parse(data.get('email'));
  const db=await createClient();const {data:link,error}=await db.from('solta_portal_project_links').select('portal_project_id').eq('project_id',source.projectId).eq('organization_id',source.organizationId).eq('enabled',true).maybeSingle();
  if(error||!link)throw new OnboardingError(409,'Finish client setup before sending the welcome email.');
  const result=await soltaSetupRequest({...source,operation:'invite',requestId,portalProjectId:link.portal_project_id,email});if(result.accepted!==true)throw new OnboardingError(503,'Email was not accepted. Retry later.');
  revalidatePath(`/businesses/solta/projects/${source.projectId}`);return {ok:true as const};
 }catch(error){return {ok:false as const,error:friendly(error)};}
}
