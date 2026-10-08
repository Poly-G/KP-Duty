"use server";
import {revalidatePath} from "next/cache";
import {z} from 'zod';
import {requireAdminIdentity} from '@/lib/auth/current-user';
import {createClient} from '@/lib/supabase/server';
import {validateLibraryFile} from './files';
import {saveKnowledge} from "./service";
export async function saveKnowledgeForm(form:FormData) {
 await saveKnowledge(String(form.get("id")),Number(form.get("revision")),{
 title:String(form.get("title")),content:String(form.get("content")),
 category:form.get("category") as "company"|"sop"|"solta"|"snd",
 status:form.get("status") as "current"|"draft"|"historical",
 });
 revalidatePath("/library");revalidatePath("/library/"+String(form.get("id")));
}


export async function addLibraryFile(form:FormData){
 const {profile}=await requireAdminIdentity();const db=await createClient();
 const documentId=z.string().uuid().parse(form.get('document_id'));const requestId=z.string().uuid().parse(form.get('request_id'));const file=form.get('file');
 if(!(file instanceof File)||file.size>2*1024*1024)throw new Error('Choose a PDF or logo ZIP up to 2 MB.');
 const bytes=Buffer.from(await file.arrayBuffer());const checked=validateLibraryFile(file.name,bytes);
 const {data:document,error:documentError}=await db.from('knowledge_documents').select('id').eq('id',documentId).single();if(documentError||!document)throw new Error('Guide unavailable.');
 const {data:existing,error:existingError}=await db.from('library_files').select('*').eq('document_id',documentId).eq('sha256',checked.sha256).maybeSingle();if(existingError)throw new Error(existingError.message);
 const id=existing?.id||requestId,path=existing?.object_path||`${documentId}/${id}/${checked.name}`;
 if(!existing){const {error}=await db.from('library_files').insert({id,document_id:documentId,name:checked.name,object_path:path,mime_type:checked.mime,size_bytes:bytes.length,sha256:checked.sha256,created_by:profile.id});if(error)throw new Error(error.message);}
 if(existing?.state!=='ready'){
  const {error}=await db.storage.from('kp-library-files').upload(path,bytes,{contentType:checked.mime,upsert:false});
  if(error){const {data:uploaded,error:readError}=await db.storage.from('kp-library-files').download(path);if(readError||!uploaded||validateLibraryFile(checked.name,Buffer.from(await uploaded.arrayBuffer())).sha256!==checked.sha256)throw new Error('Upload failed; retry the same original file.');}
  const {error:readyError}=await db.from('library_files').update({state:'ready'}).eq('id',id);if(readyError)throw new Error(readyError.message);
 }
 revalidatePath(`/library/${documentId}`);revalidatePath('/library');
}
