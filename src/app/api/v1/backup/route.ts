import {requireActiveIdentity} from "@/lib/auth/current-user";
import {createClient} from "@/lib/supabase/server";

export async function GET() {
 const {profile}=await requireActiveIdentity();
 if(profile.role!=="admin")return Response.json({error:"Admin permission required."},{status:403});
 const db=await createClient();
 const tables=["businesses","tasks","organizations","people","relationships","pipelines","pipeline_stages","opportunities","opportunity_people","projects","client_engagements","client_engagement_history",
  "project_messages", "project_progress_drafts", "project_progress_updates", "project_files", "project_notification_jobs","project_deliverables","deliverable_versions","deliverable_version_files","deliverable_reviews","deliverable_publications", "lead_import_batches", "lead_import_keys", "archive_events","staff_invitations","team_admin_events","decisions","chat_messages","knowledge_documents","knowledge_revisions","library_files","project_scope_versions","project_scope_approvals","activity_events","external_links"];
 try {
  const entries=await Promise.all(tables.map(async table=>{
   const rows:unknown[]=[];
   for(let offset=0;;offset+=1000){
    const query=db.from(table).select("*");
    const ordered=table==="opportunity_people"
     ?query.order("opportunity_id").order("person_id")
     :table==="project_scope_approvals"?query.order("scope_id"):table==="lead_import_keys"?query.order("business_id").order("fingerprint"):query.order("id");
    const {data,error}=await ordered.range(offset,offset+999);
    if(error)throw new Error(error.message);
    rows.push(...data);
    if(data.length<1000)break;
   }
   return [table,rows] as const;
  }));
  const {data:profiles,error}=await db.from("profiles").select("id,display_name,role,status");
  if(error)throw new Error(error.message);
  const exportedAt=new Date().toISOString();
  return Response.json({format:"kp-duty-company-backup",version:1,exportedAt,scope:"Shared company records plus the signed-in user’s visible Inbox. File metadata is included; uploaded bytes require a separate private storage export. Credentials and private ChatGPT histories are excluded.",profiles,tables:Object.fromEntries(entries)},{headers:{
   "Content-Disposition":'attachment; filename="kp-duty-backup-'+exportedAt.slice(0,10)+'.json"',
   "Cache-Control":"private, no-store",
  }});
 } catch (error) {
  console.error("Company backup failed", error);
  return Response.json({error:"The backup could not finish. Please try again."},{status:500,headers:{"Cache-Control":"no-store"}});
 }
}
