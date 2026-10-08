import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { requireActiveIdentity } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";
import { receiverReady } from "@/modules/integrations/nex/receiver";
import { parseProviderOperations, PROVIDER_PHASE_LABELS } from "@/modules/integrations/nex/provider-contract";
import { linkProvider } from "./actions";
export default async function NexIntegrationPage({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  const { profile } = await requireActiveIdentity();
  const client = await createClient();
  const [attempts, snapshots, search] = await Promise.all([
    client.from("nex_provider_attempts").select("nex_attempt_id,nex_organization_id,kp_opportunity_id,linked_at"),
    client.from("nex_provider_snapshots").select("nex_attempt_id,revision,snapshot,received_at"),
    searchParams,
  ]);
  const ready = receiverReady({ enabled: process.env.NEX_PROVIDER_RECEIVER_ENABLED, token: process.env.NEX_PROVIDER_RECEIVER_TOKEN, databaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL, databaseSecret: process.env.KP_INTEGRATION_SUPABASE_SECRET });
  const unavailable = !!attempts.error || !!snapshots.error;
  return <>
    <PageHeading eyebrow="Nex provider operations" title="Provider record links" description="Connect approved Nex provider records to their KP CRM records. Each side keeps its own permissions." />
    <Link className="mb-5 inline-block text-sm underline" href="/businesses/nex">Back to Nex</Link>
    <section className="mb-6 rounded-xl border border-[var(--border)] p-5">
      <h2 className="font-medium">{ready ? "Receiver configured" : "Live feed inactive"}</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">{ready ? "The receiver is configured. Nex producer and end-to-end acceptance must also be verified before calling this integration live." : "KP preparation is ready when the schema is available. Nex authentication, producer acceptance and the shared connection still need verification."}</p>
      <p className="mt-2 text-sm text-[var(--muted)]">Links never grant provider account access, representation authority, publication approval or permission to send outreach. Linked onboarding stages follow accepted Nex updates. Pauses and stalls remain operating conditions, not pipeline stages.</p>
    </section>
    {search.result && <p role="status" className="mb-5">{search.result === "linked" ? "Provider records linked." : search.result === "invalid" ? "Use valid record IDs and supply both contact fields together." : "Link could not be saved. Check the Nex business, active CRM records and existing links."}</p>}
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
        </article>;
      })}</div>
      {!attempts.data?.length && <p className="text-sm text-[var(--muted)]">No provider records linked yet.</p>}
    </>}
  </>;
}
