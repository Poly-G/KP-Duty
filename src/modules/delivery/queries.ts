import {requireActiveIdentity} from "@/lib/auth/current-user";
import {createClient} from "@/lib/supabase/server";
import type {Engagement} from "./templates";
export async function getDelivery(id:string,business:string){
 await requireActiveIdentity(); const db=await createClient();
 const {data:project,error}=await db.from("projects").select("id,name,status,organization:organizations(id,name),owner:profiles!owner_id(id,display_name),business:businesses!inner(id,slug,name)").eq("id",id).eq("business.slug",business).is("archived_at",null).maybeSingle();
 if(error)throw new Error(error.message); if(!project)return null;
 const {data:engagement,error:engagementError}=await db.from("client_engagements").select("*").eq("id",id).maybeSingle<Engagement>();
 if(engagementError)throw new Error(engagementError.message); if(!engagement)return null;
 return {project:project as unknown as {id:string;name:string;status:string;organization:{id:string;name:string};owner:{id:string;display_name:string};business:{slug:string;name:string}},engagement};
}
