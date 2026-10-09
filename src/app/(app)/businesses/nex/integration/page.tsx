import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { requireActiveIdentity } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { nexAdminUrl } from "@/modules/integrations/nex/navigation";
import { integrationReady } from "@/modules/integrations/nex/http";
import { workerConfig } from "@/modules/integrations/nex/worker-client";
import { receiverReady } from "@/modules/integrations/nex/receiver";
import { parseProviderOperations, PROVIDER_PHASE_LABELS } from "@/modules/integrations/nex/provider-contract";
import { linkProvider, requestContactStatus, reconcileProviderRecords } from "./actions";
export default async function NexIntegrationPage({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  const { profile } = await requireActiveIdentity();
  const client = await createClient();
  const [attempts, snapshots, contacts, tasks, requests, checks, search] = await Promise.all([
    client.from("nex_provider_attempts").select("nex_attempt_id,nex_organization_id,kp_opportunity_id,linked_at"),
    client.from("nex_provider_snapshots").select("nex_attempt_id,revision,snapshot,received_at"),
    client.from("nex_provider_contacts").select("nex_contact_id,nex_organization_id").limit(1000),
    client.from("nex_provider_tasks").select("nex_task_id,nex_attempt_id,kp_task_id,revision,snapshot").order("received_at", { ascending: false }).limit(100),
    client.from("nex_provider_requests").select("request_id,nex_attempt_id,nex_contact_id,nex_task_id,kind,status,outcome_code,created_at").order("created_at", { ascending: false }).limit(50),
    client.from("nex_provider_reconciliation_runs").select("checked_at,checked_attempts,repaired,issues,pending_requests,overdue_requests").order("checked_at", { ascending: false }).limit(1),
    searchParams,
  ]);
  const ready = receiverReady({ enabled: process.env.NEX_PROVIDER_RECEIVER_ENABLED, token: process.env.NEX_PROVIDER_RECEIVER_TOKEN, databaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL, databaseSecret: process.env.KP_INTEGRATION_SUPABASE_SECRET });
  const adminUrl = nexAdminUrl(process.env.NEX_ADMIN_ORIGIN);
  const tasksReady = integrationReady(workerConfig("tasks"));
  const returnsReady = integrationReady(workerConfig("requests"));
  const unavailable = !!attempts.error || !!snapshots.error || !!contacts.error || !!tasks.error || !!requests.error || !!checks.error;
  // eslint-disable-next-line react-hooks/purity -- Server-only request-time heartbeat; no client render or hydration.
  const overdue = !!checks.data?.[0] && Date.now() - Date.parse(checks.data[0].checked_at) > 26 * 60 * 60 * 1000;
  const messages: Record<string, string> = { linked: "Provider records linked.", invalid: "Use valid record IDs and supply both contact fields together.", requested: "Contact request recorded. Nex will validate it; source state is unchanged.", request_failed: "Request could not be saved. Check the accepted provider and contact links.", checked: "Provider records checked. Review the result below.", check_failed: "Check could not run. Try again or review the connection." };
  return <>
    <PageHeading eyebrow="Nex provider operations" title="Provider record links" description="Connect approved Nex provider records to their KP CRM records. Each side keeps its own permissions." />
    <Link className="mb-5 inline-block text-sm underline" href="/businesses/nex">Back to Nex</Link>
    <section className="mb-6 rounded-xl border border-[var(--border)] p-5">
      <h2 className="font-medium">{ready ? "Receiver configured" : "Live feed inactive"}</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">{ready ? "The receiver is configured. Nex producer and end-to-end acceptance must also be verified before calling this integration live." : "KP preparation is ready when the schema is available. Nex authentication, producer acceptance and the shared connection still need verification."}</p>
      <p className="mt-2 text-sm">Follow-up feed: {tasksReady ? "configured" : "inactive"} · Returned requests and source comparison: {returnsReady ? "configured" : "inactive"}</p>
      {adminUrl ? <a className="mt-3 inline-block text-sm underline" href={adminUrl} target="_blank" rel="noreferrer">Open Nex administration</a> : <p className="mt-2 text-sm text-[var(--muted)]">Nex administration link awaits the reviewed source connection.</p>}
      <p className="mt-2 text-sm text-[var(--muted)]">Links never grant provider account access, representation authority, publication approval or permission to send outreach. Linked onboarding stages follow accepted Nex updates. Pauses and stalls remain operating conditions, not pipeline stages.</p>
    </section>
    {search.result && <p role="status" className="mb-5">{messages[search.result] ?? "Link could not be saved. Check the Nex business, active CRM records and existing links."}</p>}
    {unavailable ? <p role="status">Provider integration schema is not available yet. Record linking is paused.</p> : <>
      {profile.role === "admin" && <form action={linkProvider} className="mb-6 rounded-xl border border-[var(--border)] p-5">
        <h2 className="font-medium">Link a provider attempt</h2><p className="mt-2 text-sm text-[var(--muted)]">Use reviewed record IDs from both systems. Existing links cannot be moved to different records. Leave both contact fields empty until a contact has been identified.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">{[["organization", "Nex organization ID", true], ["kp_organization", "KP company ID", true], ["attempt", "Nex onboarding attempt ID", true], ["kp_opportunity", "KP Nex opportunity ID", true], ["contact", "Nex contact ID", false], ["kp_person", "KP contact ID", false]].map(([name, label, required]) => <label className="text-sm" key={String(name)}>{label}<input className="mt-1 w-full rounded-lg border border-[var(--border)] p-3" name={String(name)} required={Boolean(required)} maxLength={36} placeholder="Record ID" /></label>)}</div>
        <button className="mt-4 rounded-lg bg-[var(--accent)] px-4 py-2 text-white">Save record links</button>
      </form>}
      <h2 className="mb-3 font-medium">Linked attempts · {attempts.data?.length ?? 0}</h2>
      <div className="space-y-3">{attempts.data?.map(attempt => {
        const mirror = snapshots.data?.find(row => row.nex_attempt_id === attempt.nex_attempt_id);
        const operations = mirror?.snapshot.operations ? parseProviderOperations(mirror.snapshot.operations) : null;
        return <article id={`attempt-${attempt.nex_attempt_id}`} key={attempt.nex_attempt_id} className="rounded-xl border border-[var(--border)] p-4"><p className="break-all text-sm">Nex attempt: {attempt.nex_attempt_id}</p><p className="mt-2 text-sm">{mirror ? `Nex phase: ${PROVIDER_PHASE_LABELS[mirror.snapshot.onboardingPhase as keyof typeof PROVIDER_PHASE_LABELS]} · revision ${mirror.revision}` : "Awaiting the first accepted Nex update"}</p>{mirror && <p className="mt-1 text-sm text-[var(--muted)]">Listing: {String(mirror.snapshot.listingReadiness).replaceAll("_", " ")} · Representation: {mirror.snapshot.representation} · Contact: {mirror.snapshot.contactStatus ?? "unidentified"}{mirror.snapshot.organizationNoContact ? " · Organization no-contact" : ""}</p>}
          {mirror && <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            {[
              ["Outreach", operations?.outreachStatus.replaceAll("_", " ")],
              ["End reason", operations?.endReason?.replaceAll("_", " ") ?? (operations ? "Not ended" : null)],
              ["Stalled", operations ? (operations.stalled ? `${operations.stallPhase} since ${operations.stalledSince}` : "No") : null],
              ["Last outreach touch", operations?.lastTouchAt ?? (operations ? "None recorded" : null)],
              ["Next due action", operations?.nextActionDueAt ?? (operations ? "None scheduled" : null)],
              ["Attempt", operations ? `${operations.attemptNumber} · opened ${operations.openedAt}` : null],
              ["Closed", operations?.closedAt ?? (operations ? "Open" : null)],
              ["Derived as of", operations ? `${operations.asOfAt} · rules ${operations.rulesVersion}` : null],
            ].map(([label, value]) => <div key={label}><dt className="text-[var(--muted)]">{label}</dt><dd>{value ?? "Awaiting operating update"}</dd></div>)}
          </dl>}
          {mirror && <form action={requestContactStatus} className="mt-4 flex flex-wrap items-end gap-3">
            <input type="hidden" name="attempt" value={attempt.nex_attempt_id} />
            <label className="text-sm">Affected contact<select name="contact" required className="block rounded-lg border p-2"><option value="">Choose linked contact</option>{contacts.data?.filter(c => c.nex_organization_id === attempt.nex_organization_id).map(c => <option value={c.nex_contact_id} key={c.nex_contact_id}>{c.nex_contact_id}</option>)}</select></label>
            <label className="text-sm">Request<select name="status" className="block rounded-lg border p-2"><option value="dnc">Do not contact this person</option><option value="wrong_person">Wrong person</option></select></label>
            <button className="rounded-lg border px-3 py-2 text-sm">Submit to Nex for review</button>
          </form>}

        </article>;
      })}</div>
      {!attempts.data?.length && <p className="text-sm text-[var(--muted)]">No provider records linked yet.</p>}
      <section className="mt-7 rounded-xl border border-[var(--border)] p-5">
        <h2 className="font-medium">Nex follow-ups</h2><p className="mt-2 text-sm text-[var(--muted)]">Latest 100 linked tasks. Finish a follow-up in Work to request completion. It waits for Nex review; only Nex can confirm completion or cancellation.</p>
        {!tasks.data?.length && <p className="mt-3 text-sm">No Nex follow-ups received yet.</p>}
        {tasks.data?.map(task => <article id={`task-${task.nex_task_id}`} className="mt-3 rounded-lg border p-3 text-sm" key={task.nex_task_id}><p>{String(task.snapshot.kind).replaceAll("_", " ")} · Nex {task.snapshot.state} · revision {task.revision}</p><p className="mt-1 break-all">Nex task: {task.nex_task_id}</p><p>Due: {task.snapshot.dueAt ?? "None scheduled"}</p><Link href="/work" className="mt-2 inline-block underline">Open Work</Link></article>)}
      </section>
      <section className="mt-5 rounded-xl border border-[var(--border)] p-5">
        <h2 className="font-medium">Requests awaiting Nex validation</h2><p className="mt-2 text-sm text-[var(--muted)]">Latest 50 requests. An accepted response records Nex’s decision; updated source snapshots confirm the resulting state.</p>
        {!requests.data?.length && <p className="mt-3 text-sm">No returned requests yet.</p>}
        {requests.data?.map(request => <p className="mt-3 break-all text-sm" key={request.request_id}>{request.kind.replaceAll("_", " ")} · {request.status}{request.outcome_code ? ` · ${request.outcome_code.replaceAll("_", " ")}` : ""} · {request.nex_contact_id ?? request.nex_task_id}</p>)}
      </section>
      <section className="mt-5 rounded-xl border border-[var(--border)] p-5">
        <h2 className="font-medium">Daily record check</h2><p className="mt-2 text-sm text-[var(--muted)]">KP checks accepted mirrors daily, repairs safe stage/task drift and flags moved or archived links. Nex must also compare its source state using the reconciliation connection.</p>
        {checks.data?.[0] ? <><p className="mt-3 text-sm">Last check: {checks.data[0].checked_at} {overdue ? "· Check overdue — review the scheduler" : ""} · {checks.data[0].checked_attempts} attempts · {checks.data[0].repaired} repaired</p><p className="mt-1 text-sm">{checks.data[0].pending_requests} pending requests · {checks.data[0].overdue_requests} older than one day</p>{(checks.data[0].issues as Array<{attemptId?: string;taskId?: string;code: string}>).map((issue, index) => <p className="mt-2 break-all text-sm" key={index}>{issue.code.replaceAll("_", " ")} · {issue.attemptId ?? issue.taskId}</p>)}</> : <p className="mt-3 text-sm">No check recorded yet.</p>}
        {profile.role === "admin" && <form action={reconcileProviderRecords}><button className="mt-3 rounded-lg border px-3 py-2 text-sm">Check provider records now</button></form>}
        <p className="mt-3 text-sm text-[var(--muted)]">Replay evidence is retained. Receipt pruning and rights/deletion propagation require the agreed Nex replay horizon and privacy contract before live activation.</p>
      </section>
    </>}
  </>;
}
