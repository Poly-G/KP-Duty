"use server";
import {revalidatePath} from "next/cache";
import {saveKnowledge} from "./service";
export async function saveKnowledgeForm(form:FormData) {
 await saveKnowledge(String(form.get("id")),Number(form.get("revision")),{
 title:String(form.get("title")),content:String(form.get("content")),
 category:form.get("category") as "company"|"sop"|"solta"|"snd",
 status:form.get("status") as "current"|"draft"|"historical",
 });
 revalidatePath("/library");revalidatePath("/library/"+String(form.get("id")));
}

