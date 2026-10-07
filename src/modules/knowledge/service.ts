import { z } from "zod";
import { requireActiveIdentity, requireAdminIdentity } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
export const documentSchema = z.object({
 title: z.string().trim().min(1).max(200),
 content: z.string().trim().min(1).max(2000000),
 category: z.enum(["company","sop","solta","snd"]),
 status: z.enum(["current","draft","historical"]),
});
export type KnowledgeDocument = z.infer<typeof documentSchema> & {
 id:string; revision:number; source_url:string|null; source_page_id:string|null; updated_at:string;
};
export async function listKnowledge(query="",includeHistory=false) {
 await requireActiveIdentity();
 const db=await createClient();
 const {data,error}=await db.from("knowledge_documents")
 .select("id,title,category,status,revision,updated_at")
 .order("title");
 if(error) throw new Error(error.message);
 const term=z.string().max(200).parse(query).trim().toLowerCase();
 return (data??[]).filter(d=>(includeHistory||d.status==="current")&&(!term||d.title.toLowerCase().includes(term)));
}
export async function getKnowledge(id:string) {
 await requireActiveIdentity(); const db=await createClient();
 const {data,error}=await db.from("knowledge_documents").select("*").eq("id",z.string().uuid().parse(id)).maybeSingle();
 if(error) throw new Error(error.message);
 return data as KnowledgeDocument|null;
}
export async function saveKnowledge(id:string,revision:number,input:z.input<typeof documentSchema>) {
 const {user}=await requireAdminIdentity(); const db=await createClient();
 const parsed=documentSchema.parse(input); const key=z.string().uuid().parse(id);
 if(revision===0) {
  const {error}=await db.from("knowledge_documents").insert({id:key,...parsed,updated_by:user.id});
  if(error) {
   if(error.code!=="23505") throw new Error(error.message);
   const existing=await getKnowledge(key);
   if(!existing||Object.entries(parsed).some(([k,v])=>existing[k as keyof KnowledgeDocument]!==v)) throw new Error("This document was already created with different content.");
   return existing;
  }
 } else {
  const expected=z.number().int().positive().parse(revision);
  const {data,error}=await db.from("knowledge_documents").update({...parsed,updated_by:user.id}).eq("id",key).eq("revision",expected).select("id").maybeSingle();
  if(error) throw new Error(error.message);
  if(!data) throw new Error("This document changed since you opened it. Reload before editing.");
 }
 return getKnowledge(key);
}
