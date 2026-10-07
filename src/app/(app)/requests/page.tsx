import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { PageHeading } from "@/components/page-heading";
import { submitRequestForm } from "@/modules/collaboration/actions";
import { listDecisions } from "@/modules/decisions/queries";
export default async function RequestsPage() {
 const requests=(await listDecisions()).filter(d=>d.request_kind);
 const field="mt-2 w-full rounded-lg border border-[var(--border)] bg-white p-3 text-sm";
 return <><PageHeading eyebrow="Requests" title="Make KP work better" description="Suggest an improvement or report a bug. Both people can submit; Poly reviews each request as a decision."/>
 <ActionForm action={submitRequestForm} className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
 <input type="hidden" name="request_key" value={crypto.randomUUID()}/>
 <label className="block">Request type<select name="kind" className={field}><option value="feature">Feature / smoother process</option><option value="bug">Bug report</option></select></label>
 <label className="block">Title<input name="title" required maxLength={200} className={field}/></label>
 <label className="block">What happens, and what would be better?<textarea name="details" required maxLength={10000} rows={5} className={field} placeholder="For a bug: steps, expected result, actual result. For a feature: current friction and the improvement you want."/></label>
 <label className="block">Affected page or workflow<input name="page" maxLength={500} className={field}/></label>
 <label className="block">Impact<select name="impact" className={field}><option value="normal">Slows us down</option><option value="blocking">Blocks current work</option></select></label>
 <p className="text-sm text-[var(--muted)]">An initial triage recommendation is included. Poly’s ChatGPT can add a deeper review when pulling decisions.</p>
 <button className="rounded-lg bg-[var(--accent)] px-4 py-2 text-white">Send to Poly’s decisions</button>
 </ActionForm>
 <section className="mt-6 space-y-3"><h2 className="font-semibold">Submitted requests</h2>{requests.length?requests.map(d=><Link key={d.id} href="/decisions" className="block rounded-xl border border-[var(--border)] p-4"><span className="font-medium">{d.title}</span><p className="text-sm text-[var(--muted)]">{d.status} · Submitted by {d.requester?.display_name??"KP teammate"} · {d.recommendation_reviewed_at?"ChatGPT review added":"Awaiting ChatGPT review"}</p></Link>):<p>No requests yet.</p>}</section></>;
}
