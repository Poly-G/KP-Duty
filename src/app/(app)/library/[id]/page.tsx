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
 return <><Link href="/library" className="text-sm text-[var(--muted)]">← Company library</Link>
 <PageHeading eyebrow={document.category+" · "+document.status} title={document.title} description={"Version "+document.revision+" · Updated "+new Date(document.updated_at).toLocaleDateString("en-US",{timeZone:"UTC"})}/>
 {document.status!=="current"?<p className="mb-5 rounded-lg bg-[var(--surface-subtle)] p-3">This guide is {document.status}. Check current guides before using it as authority.</p>:null}
 <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"><DocumentContent content={document.content}/></article>
 {profile.role==="admin"?<details className="mt-6 rounded-xl border border-[var(--border)] p-5"><summary className="cursor-pointer font-medium">Edit guide</summary><div className="mt-5"><DocumentEditor key={document.revision} document={document}/></div></details>:null}
 {document.source_url?<p className="mt-5 text-xs text-[var(--muted)]"><a href={document.source_url} target="_blank" rel="noreferrer">Original Notion backup</a> · KP is the current working record.</p>:null}
 </>;
}

