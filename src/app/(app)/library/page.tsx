import Link from "next/link";
import {PageHeading} from "@/components/page-heading";
import {listKnowledge} from "@/modules/knowledge/service";
import {requireActiveIdentity} from "@/lib/auth/current-user";
export default async function LibraryPage({searchParams}:{searchParams:Promise<{q?:string;history?:string}>}) {
 const {q="",history}=await searchParams;
 const [docs,{profile}]=await Promise.all([listKnowledge(q,history==="1"),requireActiveIdentity()]);
 return <><PageHeading eyebrow="Company library" title="What we know and how we work" description="Company truth, business guides and approved processes live here. Notion is our backup."/>
 <form className="mb-6 flex flex-wrap items-center gap-3">
 <label className="flex-1">Find a guide<input name="q" defaultValue={q} maxLength={200} className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white p-3" placeholder="Search titles…"/></label>
 <label className="text-sm"><input type="checkbox" name="history" value="1" defaultChecked={history==="1"}/> Include research, drafts and history</label>
 <button className="rounded-lg border border-[var(--border)] px-4 py-2">Search</button>
 </form>
 {profile.role==="admin"?<div className="mb-5 flex flex-wrap items-center gap-3"><Link href="/library/new" className="rounded-lg bg-[var(--accent)] px-4 py-2 text-white">Add a guide</Link><a href="/api/v1/backup" className="rounded-lg border border-[var(--border)] px-4 py-2">Download company backup</a><span className="text-xs text-[var(--muted)]">Notion is a migration snapshot. Download a fresh backup to preserve later changes. Uploaded file contents need a separate storage export.</span></div>:null}
 <div className="grid gap-3 sm:grid-cols-2">{docs.map(d=><Link key={d.id} href={"/library/"+d.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 hover:bg-[var(--surface-subtle)]"><p className="text-xs uppercase text-[var(--muted)]">{d.category} · {d.status}</p><h2 className="mt-2 font-medium">{d.title}</h2></Link>)}</div>
 {!docs.length?<p>No matching guides.</p>:null}</>;
}
