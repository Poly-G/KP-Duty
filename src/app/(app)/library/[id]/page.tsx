import {randomUUID} from 'node:crypto';
import {createClient} from '@/lib/supabase/server';
import {ActionForm} from '@/components/action-form';
import {addLibraryFile} from '@/modules/knowledge/actions';
import Link from "next/link";
import {notFound} from "next/navigation";
import {PageHeading} from "@/components/page-heading";
import {DocumentEditor} from "@/components/knowledge/document-editor";
import {DocumentContent} from "@/components/knowledge/document-content";
import {getKnowledge} from "@/modules/knowledge/service";
import {requireActiveIdentity} from "@/lib/auth/current-user";
export default async function Guide({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))notFound();
 const [document,{profile}]=await Promise.all([getKnowledge(id),requireActiveIdentity()]);
 if(!document)notFound();
 const db=await createClient();const {data:files,error:filesError}=await db.from('library_files').select('id,name,state,size_bytes,created_at').eq('document_id',id).order('created_at',{ascending:false});if(filesError)throw new Error(filesError.message);

 return <><Link href="/library" className="text-sm text-[var(--muted)]">← Company library</Link>
 <PageHeading eyebrow={document.category+" · "+document.status} title={document.title} description={"Version "+document.revision+" · Updated "+new Date(document.updated_at).toLocaleDateString("en-US",{timeZone:"UTC"})}/>
 {document.status!=="current"?<p className="mb-5 rounded-lg bg-[var(--surface-subtle)] p-3">This guide is {document.status}. Check current guides before using it as authority.</p>:null}
 <section className="mb-5 rounded-xl border border-[var(--border)] p-5"><h2 className="font-medium">Original files</h2><p className="mt-2 text-sm text-[var(--muted)]">Retained originals for the team. Logo ZIPs download as files and are never run in KP.</p><ul className="mt-3 space-y-2">{files?.filter(file=>file.state==='ready').map(file=><li key={file.id}><a className="text-sm underline" href={`/api/v1/library-files/${file.id}`}>Download {file.name}</a> <span className="text-xs text-[var(--muted)]">({Math.ceil(file.size_bytes/1024)} KB)</span></li>)}</ul>{profile.role==='admin'?<ActionForm action={addLibraryFile} className="mt-4 grid gap-3" errorMessage="Couldn’t add this original. Use a PDF or logo ZIP up to 2 MB; retrying the same file preserves the original."><input type="hidden" name="document_id" value={id}/><input type="hidden" name="request_id" value={randomUUID()}/><label className="grid gap-2 text-sm">Original PDF or logo kit<input name="file" type="file" accept=".pdf,.zip" required/></label><button className="w-fit rounded-lg border border-[var(--border)] p-3 text-sm">Add original file</button></ActionForm>:null}</section>
 <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"><DocumentContent content={document.content}/></article>
 {profile.role==="admin"?<details className="mt-6 rounded-xl border border-[var(--border)] p-5"><summary className="cursor-pointer font-medium">Edit guide</summary><div className="mt-5"><DocumentEditor key={document.revision} document={document}/></div></details>:null}
 {document.source_url?<p className="mt-5 text-xs text-[var(--muted)]"><a href={document.source_url} target="_blank" rel="noreferrer">Original Notion backup</a> · KP is the current working record.</p>:null}
 </>;
}

