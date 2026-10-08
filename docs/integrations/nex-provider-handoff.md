# Nex provider integration — KP preparation, October 8, 2026

## Ownership and current state

KP owns provider CRM relationships, human follow-up and shared work. Nex owns research evidence, listing readiness/publication, representation authority, provider/Veteran accounts, and customer support/reviews. Notion remains Nex's canonical requirements and acceptance record. This implementation is receiving-side preparation; it does not accept the pending Nex lifecycle or privacy release gates.

The provider-only endpoint is `POST /api/integrations/nex/providers`. It returns 503 until explicitly configured. No real source identities or credentials have been created by this change. The admin screen is `/businesses/nex/integration` and shows configuration status separately from accepted snapshots.

## Admin links

An active KP admin explicitly links Nex organization, contact (optional), and onboarding attempt IDs to existing KP company, contact and Nex opportunity IDs. There is no matching by name/email and no import of contact details from Nex. KP contact must belong to the linked company; opportunity must belong to the active Nex business. IDs map domain records, never authentication identities.

Mappings are immutable and retries are safe. A new contact may be added using the same organization/attempt mapping. Corrections to an erroneous source identity mapping require a reviewed administrative migration; this screen cannot silently relink it. Archiving or moving a CRM record makes new delivery fail until staff resolve it.

## Restricted feed

The contract is strict schemaVersion 1, source nexproviders, target kp, entityType provider_onboarding_attempt, eventType provider_snapshot. See `src/modules/integrations/nex/provider-contract.ts` for exact allowlisted fields. No Veteran records, claim/clinical data, private research/evidence, review text, free text, contact details or arbitrary metadata are permitted. Rejected payloads/database errors are not returned or logged. The 8 KiB body limit is enforced on streaming reads after authentication.

The database repeats validation and exposes ingestion only to service_role; ordinary team/admin/anonymous sessions cannot ingest or write the mirror. Active KP members can read provider-only mirror state. Linking uses current active-admin membership, not a role embedded in an old token.

Event IDs are idempotent. Reused event IDs with different content and reused revisions with different snapshots fail. Revisions order per onboarding attempt; older snapshots are acknowledged as stale without overwriting the mirror. Transaction locks serialize receipts and attempts. Success timestamp and terminal phase cannot be changed/reopened; new attempts use new IDs and opportunities. Multiple known active attempts for an organization fail. Nex must supply a consistent initial baseline and end the old attempt before opening the next; KP cannot infer missing source events.

Contact DNC/wrong-person remains scoped to that contact. Organization no-contact, closed/merged status, listing readiness and representation are separate dimensions. KP does not send outreach, publish listings, grant representation or auto-complete work from these updates. CRM follow-up stages remain human-owned; the read-only Nex phase is shown separately. No automatic generic CRM stage migration or writeback is included.

## Enablement handoff when Nex account is available

1. Accept Nex lifecycle C1/TASK128, TASK132 contract and privacy review gates against actual release code. Pending Nex PR93 is preparation, not an authenticated producer.
2. Verify the KP migration and hosted receiver revision, then use the admin screen to link reviewed real domain records. Do not insert synthetic fixtures in production.
3. Configure server-only KP environment variables through the deployment's secret manager: NEX_PROVIDER_RECEIVER_ENABLED=true, NEX_PROVIDER_RECEIVER_TOKEN (random at least 32 characters), KP_INTEGRATION_SUPABASE_SECRET (KP server service-role secret). The existing NEXT_PUBLIC_SUPABASE_URL must identify the KP project. The integration secret never goes to Nex/browser/source control. Keep ENABLED unset until readiness review.
4. Nex receives only the scoped receiver bearer token and endpoint URL. Its server creates the allowlisted envelope from accepted lifecycle state and queues delivery with the same event ID/revision on retries. Use canonical millisecond UTC timestamps and normalized UUIDs.
5. Test approved-preview and inbound-claim admission, regressions after success, missing/moved/archive links, wrong-person vs organization DNC, terminal reentry, stale/duplicate/collision delivery, access revocation and forbidden data. Verify no customer auth/profile mutation and no outreach send.
6. Producer retains every unacknowledged event. Retry transient 503/network failures with bounded backoff; stop and alert staff on 400/401/409/413/415. Review identity/revision collisions rather than minting new event IDs to hide them. KP receipts are append-only operational replay evidence; define retention with the eventual producer's replay horizon before any pruning.

Disabling ENABLED is the receiving-side kill switch. It does not acknowledge or consume events. No live feed, automatic outreach, provider authority linking, bidirectional suppression writeback, or follow-up completion writeback is enabled by this preparation. Those capabilities need separately accepted Nex-side command contracts and cannot be fabricated solely from KP access.
