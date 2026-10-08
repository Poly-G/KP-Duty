"use server";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import {requireActiveIdentity,requireAdminIdentity} from "@/lib/auth/current-user";
import {createClient} from "@/lib/supabase/server";
import {getDelivery} from "./queries";
import {onboardingFields,requiredOnboardingKeys} from "./templates";
const uuid=z.string().uuid();
function refresh(business:string,id:string){revalidatePath(`/businesses/${business}`);revalidatePath(`/businesses/${business}/projects/${id}`);revalidatePath(`/businesses/${business}/clients`,"layout");revalidatePath("/projects");}
export async function createClientDelivery(data:FormData){
 await requireAdminIdentity();const db=await createClient();
 const business=z.enum(["solta","snd"]).parse(data.get("business"));
 const id=uuid.parse(data.get("request_id"));
 const {error}=await db.rpc("kp_create_client_delivery",{p_id:id,p_business:business,p_company:uuid.parse(data.get("company_id")),p_name:z.string().trim().min(1).max(200).parse(data.get("name")),p_service:z.enum(["website","branding","less_office","care","snd"]).parse(data.get("service"))});
 if(error)throw new Error(error.message);refresh(business,id); return id;
}
export async function saveClientDelivery(data:FormData){
 const {profile}=await requireActiveIdentity();const db=await createClient();
 const id=uuid.parse(data.get("id"));const business=z.enum(["solta","snd"]).parse(data.get("business"));
 const delivery=await getDelivery(id,business);if(!delivery)throw new Error("Project not found.");
 const revision=z.coerce.number().int().positive().parse(data.get("revision"));
 const operation=z.enum(["answers","submit","review","start"]).parse(data.get("operation"));
 const patch:Record<string,unknown>={};
 if(operation==="answers"||operation==="submit"){
  const answers:Record<string,string>={};for(const key of Object.keys(onboardingFields(delivery.engagement.service,delivery.engagement.template_version,{...delivery.engagement.answers,branding_included:String(data.get('branding_included')||'')})))answers[key]=z.string().trim().max(10000).parse(data.get(key)??"");
  if(operation==="submit") {for(const key of requiredOnboardingKeys(delivery.engagement.service,delivery.engagement.template_version,answers))if(!answers[key])throw new Error("Complete the required fields.");z.email().parse(answers.approver_email);patch.submit=true;}
  patch.answers=answers;
 }
 if(operation==="review"){
  patch.onboarding_reviewed=data.get("onboarding_reviewed")==="on";patch.access_ready=data.get("access_ready")==="on";
  if(profile.role==="admin"){
   if(!delivery.engagement.scope_required)patch.scope_approved=data.get("scope_approved")==="on";patch.payment_required=data.get("payment_required")==="on";patch.capacity_ready=data.get("capacity_ready")==="on";patch.payment_evidence=z.string().trim().max(10000).parse(data.get("payment_evidence")??"")||null;
  }
 }
 if(operation==="start")await requireAdminIdentity();
 const {error}=await db.rpc("kp_save_client_delivery",{p_id:id,p_revision:revision,p_patch:patch,p_start:operation==="start"});if(error)throw new Error(error.message);refresh(business,id);
}

export async function saveScope(data:FormData){
 await requireAdminIdentity();const db=await createClient();
 const project=uuid.parse(data.get("project_id"));const business=z.enum(["solta","snd"]).parse(data.get("business"));
 if(!await getDelivery(project,business))throw new Error("Project not found.");
 const text=(key:string,max=10000)=>z.string().trim().min(5).max(max).parse(data.get(key));
 const {error}=await db.rpc("kp_save_scope",{p_id:uuid.parse(data.get("request_id")),p_project:project,p_expected:z.coerce.number().int().nonnegative().parse(data.get("expected_version")),p_deliverables:text("deliverables"),p_exclusions:text("exclusions"),p_terms:text("commercial_terms"),p_timing:text("timing"),p_reason:text("change_reason",2000)});
 if(error)throw new Error(error.message);refresh(business,project);
}
export async function approveScope(data:FormData){
 await requireAdminIdentity();const db=await createClient();
 const project=uuid.parse(data.get("project_id"));const business=z.enum(["solta","snd"]).parse(data.get("business"));
 if(!await getDelivery(project,business))throw new Error("Project not found.");
 const scope=uuid.parse(data.get("scope_id"));
 const {data:version,error:lookupError}=await db.from("project_scope_versions").select("id,version").eq("id",scope).eq("project_id",project).maybeSingle();
 if(lookupError)throw new Error(lookupError.message);if(!version)throw new Error("Scope not found.");
 if(data.get("confirmation")!==`APPROVE v${version.version}`||data.get("client_confirmed")!=="on")throw new Error("Confirm the client approved this exact scope version.");
 const {error}=await db.rpc("kp_approve_scope",{p_scope:scope,p_client_name:z.string().trim().min(1).max(200).parse(data.get("client_name")),p_client_email:z.email().max(320).parse(data.get("client_email")),p_evidence:z.string().trim().min(5).max(10000).parse(data.get("evidence"))});
 if(error)throw new Error(error.message);refresh(business,project);
}
