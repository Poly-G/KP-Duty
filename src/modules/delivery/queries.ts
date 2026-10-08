import {requireActiveIdentity} from "@/lib/auth/current-user";
import {createClient} from "@/lib/supabase/server";
import type {Engagement} from "./templates";
export async function getDelivery(id:string,business:string){
 await requireActiveIdentity(); const db=await createClient();
 const {data:project,error}=await db.from("projects").select("id,name,status,organization:organizations(id,name),owner:profiles!owner_id(id,display_name),business:businesses!inner(id,slug,name)").eq("id",id).eq("business.slug",business).is("archived_at",null).maybeSingle();
 if(error)throw new Error(error.message); if(!project)return null;
 const {data:engagement,error:engagementError}=await db.from("client_engagements").select("*").eq("id",id).maybeSingle<Engagement>();
 if(engagementError)throw new Error(engagementError.message); if(!engagement)return null;
 return {project:project as unknown as {id:string;name:string;status:string;organization:{id:string;name:string};owner:{id:string;display_name:string};business:{slug:string;name:string}},engagement:{...engagement,scope_required:engagement.scope_required||!engagement.started_at}};
}

export async function getScopes(id:string){
 await requireActiveIdentity();const db=await createClient();
 const {data:versions,error}=await db.from("project_scope_versions").select("*").eq("project_id",id).order("version",{ascending:false});
 if(error)throw new Error(error.message);
 const ids=(versions||[]).map(v=>v.id);
 const {data:approvals,error:approvalError}=ids.length?await db.from("project_scope_approvals").select("*").in("scope_id",ids):{data:[],error:null};
 if(approvalError)throw new Error(approvalError.message);
 return {versions:(versions||[]) as import("./scopes").ScopeVersion[],approvals:(approvals||[]) as import("./scopes").ScopeApproval[]};
}

export async function getProduction(id:string){
 await requireActiveIdentity();const db=await createClient();
 const [state,approvals,events]=await Promise.all([
  db.rpc('kp_get_production_state',{p_project:id}),
  db.from('production_gate_approvals').select('id,kind,revision,version_id,scope_id,evidence,recorded_at,actor:profiles!recorded_by(display_name)').eq('project_id',id).order('revision',{ascending:false}),
  db.from('production_stage_events').select('id,sequence,stage,scope_id,evidence,recorded_at,actor:profiles!recorded_by(display_name)').eq('project_id',id).order('sequence',{ascending:false}),
 ]);
 for(const result of [state,approvals,events])if(result.error)throw new Error(result.error.message);
 return {state:state.data as import('./production').ProductionState,approvals:(approvals.data||[]) as unknown as import('./production').ProductionApproval[],events:(events.data||[]) as unknown as import('./production').ProductionEvent[]};
}
