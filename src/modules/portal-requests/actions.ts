'use server';
import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {requireActiveIdentity,requireAdminIdentity} from '@/lib/auth/current-user';
import {createClient} from '@/lib/supabase/server';
import {getDelivery} from '@/modules/delivery/queries';
function refresh(id:string){revalidatePath(`/client-preview/solta/projects/${id}`);revalidatePath(`/businesses/solta/projects/${id}`);revalidatePath('/businesses/solta/requests');}
export async function submitPortalRequest(data:FormData){
 await requireActiveIdentity(); const db=await createClient();
 const project=z.uuid().parse(data.get('project_id'));
 if(!await getDelivery(project,'solta'))throw new Error('Solta project unavailable.');
 const {error}=await db.rpc('kp_submit_portal_request',{p_id:z.uuid().parse(data.get('request_id')),p_project:project,p_kind:z.enum(['feature','bug']).parse(data.get('kind')),p_title:z.string().trim().min(1).max(200).parse(data.get('title')),p_details:z.string().trim().min(1).max(10000).parse(data.get('details'))});
 if(error)throw new Error(error.message);refresh(project);
}
export async function reviewPortalRequest(data:FormData){
 await requireAdminIdentity(); const db=await createClient();
 const id=z.uuid().parse(data.get('id'));const revision=z.coerce.number().int().positive().parse(data.get('revision'));
 const status=z.enum(['submitted','reviewing','waiting','resolved','declined']).parse(data.get('status'));
 const response=z.string().trim().max(10000).parse(data.get('response'));
 if(['resolved','declined'].includes(status)&&response.length<5)throw new Error('Explain the outcome.');
 const result=await db.from('portal_requests').update({status,response,revision:revision+1}).eq('id',id).eq('revision',revision).select('project_id').maybeSingle();
 if(result.error)throw new Error(result.error.message);if(!result.data)throw new Error('Request changed; reload.');refresh(result.data.project_id);
}
export async function saveRequestPolicy(data:FormData){
 await requireAdminIdentity();const db=await createClient();const project=z.uuid().parse(data.get('project_id'));
 if(!await getDelivery(project,'solta'))throw new Error('Solta project unavailable.');
 const expected=z.coerce.number().int().nonnegative().parse(data.get('revision'));
 const rule=z.enum(['unconfigured','included','quote_required']);
 const patch={project_id:project,revision:expected+1,feature_rule:rule.parse(data.get('feature_rule')),bug_rule:rule.parse(data.get('bug_rule')),evidence:z.string().trim().min(5).max(10000).parse(data.get('evidence'))};
 if(expected===0){const {error}=await db.from('project_request_policies').insert(patch);if(error)throw new Error(error.message);}
 else {const {data:saved,error}=await db.from('project_request_policies').update(patch).eq('project_id',project).eq('revision',expected).select('project_id').maybeSingle();if(error)throw new Error(error.message);if(!saved)throw new Error('Policy changed; reload.');}
 refresh(project);
}
