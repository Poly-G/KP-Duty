import {requireActiveIdentity} from '@/lib/auth/current-user';
import {createClient} from '@/lib/supabase/server';
export type PortalRequest={id:string;project_id:string;kind:string;title:string;details:string;status:string;response:string;revision:number;disposition:string;policy_revision:number;created_at:string};
export async function getPortalRequests(project?:string){
 await requireActiveIdentity();const db=await createClient();
 let query=db.from('portal_requests').select('id,project_id,kind,title,details,status,response,revision,disposition,policy_revision,created_at').order('created_at',{ascending:false}).limit(100);
 if(project)query=query.eq('project_id',project);
 const {data,error}=await query;if(error)throw new Error(error.message);return (data||[]) as PortalRequest[];
}
export async function getRequestPolicy(project:string){
 await requireActiveIdentity();const db=await createClient();
 const {data,error}=await db.from('project_request_policies').select('revision,feature_rule,bug_rule,evidence').eq('project_id',project).maybeSingle();
 if(error)throw new Error(error.message);return data;
}
