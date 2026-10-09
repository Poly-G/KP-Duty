# Nex provider integration — KP V1 handoff

## Ownership and release boundary

Owner correction, October 8, 2026 PT: KP is the source of truth and sole workspace for Nex admin operations, including staff administration and admin-facing work queues. Nex retains protected domain services for research/evidence, publication, representation, provider/Veteran accounts and lifecycle integrity. Customer workspaces remain in Nex. Do not build a separate Nex admin frontend. Notion TASK-132 and the [admin reconciliation handoff](nex-admin-reconciliation.md) preserve the requirements and remaining acceptance. V2 marketplace is excluded from this implementation.

The approved Nex security/lifecycle stack and first transactional activity backend merged through [Nex PR #100](https://github.com/Poly-G/NexProviders/pull/100), main commit `6de63a566127f9275618e49397b142333881c821`, after all six CircleCI checks passed on `fa492a670b4a18df649c6c0ea4f77d7657d5a4f9`. This is code integration, not hosted acceptance or permission/connection activation. Veteran/Provider workspace backend and the scoped KP admin connection take priority; further lifecycle expansion comes last.

The KP receiver, explicit admin links, seven-stage pipeline, operating fields, task mirror, durable return requests and daily local reconciliation are implemented. No live connection, source identities, integration tokens, outreach, account authority or production fixtures are created. All external endpoints default to HTTP503 until explicitly configured. Schema version 2, task kinds and outcome codes are prepared transport choices that must be reconciled with the actual accepted Nex producer.

## Explicit identity links and navigation

Active KP admins link reviewed Nex organization/contact/attempt IDs to existing company/person/opportunity records at `/businesses/nex/integration`. Contact is optional, but both source/CRM contact IDs must be supplied together. A contact must belong to the linked company and the opportunity to the active Nex business. No name/email matching or contact-detail import occurs. A company can have multiple contacts and bounded attempts. Mapping is immutable; a retry can add a new reviewed contact.

IDs map domain records, never authentication identities. KP login/linking grants no Nex staff, provider membership, representation, publication or send authority. The screen links to Work and the CRM. The existing optional `NEX_ADMIN_ORIGIN` HTTPS `/admin` link is legacy compatibility, not the new admin delivery destination; do not configure it as the KP admin connection. Credentials, query strings and arbitrary paths remain rejected. Existing Nex editor infrastructure may remain until a reviewed bridge replaces it.

Erroneous mappings require an audited administrative repair reviewed against both systems. Never relink by editing identity fields, mint a replacement event to hide a collision, or silently unarchive moved/deleted records. Archive/merge/moved-contact conditions appear in reconciliation and stop new live ingestion until reviewed.

## Provider snapshots

`POST /api/integrations/nex/providers` accepts strict provider snapshot schema versions 1 and 2; see `src/modules/integrations/nex/provider-contract.ts`. Version 1 remains unchanged. Version 2 adds the exact operations object: outreachStatus, endReason, stalled, stallPhase, stalledSince, lastTouchAt, nextActionDueAt, openedAt, closedAt, attemptNumber, rulesVersion, asOfAt. Reason-code and numeric rules-version choices require accepted Nex derivation alignment. Unknown fields, free text, Veteran/customer/clinical records, contact details, documents, auth IDs and arbitrary metadata are rejected.

Event IDs and revisions are retry-safe and collision-checked inside one transaction. Stale delivery is acknowledged without replacing current state. A newer version-1 snapshot cannot erase accepted version-2 facts. Terminal attempts cannot reopen; genuinely new attempts use new IDs and opportunities. Source first success time is retained after listing-readiness regression. Admission is historical approved-preview or inbound-claim evidence; Nex must prove admission before sending.

Accepted snapshots atomically project the seven-stage `provider-onboarding` pipeline. Linked business/company and phase are database-protected; linked cards cannot be dragged. Before first accepted state, the linked stage is locked. Pauses/stalls are operating conditions, not stages. KP does not derive source truth from human CRM activity.

## Nex-created follow-up tasks

`POST /api/integrations/nex/tasks` accepts an independent strict version-1 envelope:

- schemaVersion=1, source=nexproviders, target=kp;
- entityType=provider_follow_up, eventType=task_snapshot;
- eventId, canonical UTC occurredAt;
- exact payload: organizationId, attemptId, contactId|null, taskId, positive revision, kind, state, dueAt|null, resolvedAt|null.

Prepared kind codes are follow_up, verify_representation, complete_profile, review_stall. State is open/completed/cancelled. Terminal states require a resolvedAt no later than occurredAt; open requires null. Nex must accept this contract before activation. No title, task narrative, evidence or arbitrary URL comes from Nex.

A task requires an already accepted provider attempt and reviewed contact link if contact-scoped. Initial delivery atomically creates one KP Work item with a fixed descriptive title, source deadline and internal reference, then immutable source mapping. Retries never duplicate work. The initial owner is the active admin who linked the attempt, or unassigned if that person is inactive; KP admin assignment remains local. Task ID/attempt/contact/kind cannot move. Ended tasks cannot reopen. Cancellation archives the Work item without presenting it as successful completion.

KP owners can work on the task and record local notes. Source title/deadline/identity/reference and terminal outcome are protected. Finishing an open source task creates a durable completion request; the Work item remains Working/Waiting with “Nex completion review.” Nex acknowledgement alone does not mark it finished. Only an accepted completed source snapshot closes it. A rejection releases the review wait. Generic Work UI and WebMCP updates use the same database guard; ordinary unlinked task behavior is preserved.

## Contact and completion return requests

Staff select the affected linked contact at the integration screen and request dnc or wrong_person. No organization-stop or un-suppression request is accepted here. These requests do not mutate contact, organization, representation, listing, stage or source task truth. A completion request is scoped to one Nex-created task.

`GET /api/integrations/nex/requests?after=<request UUID>` exports at most 100 pending requests, ordered by request ID. Each includes requestId, organizationId, attemptId, contactId|null, taskId|null, kind, baseRevision, requestedAt. No staff identity, notes, email or customer data is exported. Response is `{items,next}`; null next ends the pass. Start the next pass from the beginning. Polling never consumes requests; unacknowledged items are redelivered until resolved. IDs and source revision deduplicate repeated clicks/completion attempts. A stale rejection requires fresh source state before a new request at a new revision.

Nex validates the exact contact/task, current authority, lifecycle and revision. It durably records the request ID/outcome and corresponding domain change before acknowledging. Retry the same decision after connection failure.

`POST /api/integrations/nex/requests` accepts only `{requestId,status,code}`. Accepted codes: applied/already_applied. Rejected codes: stale/not_allowed/inactive_record. Status is accepted/rejected and must match its code. Conflicting acknowledgements fail; identical acknowledgements are safe. There is no direct Nex state mutation through this endpoint. Nex emits resulting provider/task snapshots separately.

## Reconciliation and operating visibility

Hosted Supabase schedules `private.run_nex_reconciliation()` daily at 03:30 UTC. No external network request or secret is stored in the scheduler. An active KP admin can run the same check from the integration screen. Database/function permissions keep ordinary workers/team members from invoking maintenance or writing its report.

The check compares accepted snapshots with current opportunity stage/success time and source-owned task fields/outcomes. Safe stage/task drift is repaired. Archived/moved company/opportunity/contact/task associations and missing source baselines are flagged for reviewed repair; source authority is never inferred or recreated. Reports contain IDs, issue codes and counts only. The screen shows last check, repairs, pending requests, requests older than one day and an overdue-check notice after 26 hours. A failing scheduler is visible through its missing heartbeat and hosted Cron run history. Receiver failures remain generic and do not log rejected payloads.

`GET /api/integrations/nex/reconciliation?after=<attempt UUID>` provides bounded source-comparison pages, protected by the return-connection token. It exports accepted provider/task snapshots, link health/current stage, contact association health and request outcomes, without contact details or local notes. Nex must compare against its complete source inventory nightly, detect missing source/KP records and all revision/field/contact/task differences, then re-push newer source snapshots. This local check/export does not substitute for that Nex worker. Nex must continue operating when KP is unavailable.

## Connection controls

Server-only environment configuration, through secret managers:

| Setting | Purpose |
| --- | --- |
| NEX_PROVIDER_RECEIVER_ENABLED | Global integration kill switch; unset/false stops every external endpoint |
| NEX_PROVIDER_RECEIVER_TOKEN | Scoped inbound snapshot/task bearer token, at least 32 characters |
| KP_INTEGRATION_SUPABASE_SECRET | KP server worker key; never sent to Nex/browser/source control |
| NEXT_PUBLIC_SUPABASE_URL | Existing KP project URL |
| NEX_PROVIDER_OPERATIONS_ENABLED | Independent schema-2 snapshot gate |
| NEX_PROVIDER_TASKS_ENABLED | Independent task feed gate |
| NEX_PROVIDER_REQUESTS_ENABLED | Independent return-request and reconciliation export gate |
| NEX_PROVIDER_REQUESTS_TOKEN | Separate scoped return-connection bearer token, at least 32 characters |
| NEX_ADMIN_ORIGIN | Legacy compatibility only; not the KP admin connection |

No gate or token was enabled/created by this implementation. Authentication precedes parsing/body reads; POST streaming body size is capped at 8 KiB. Worker RPCs alone ingest/read exports/acknowledge; ordinary anonymous/staff sessions cannot. Active membership is checked live for linking, contact requests and maintenance. Source tables/receipts/requests cannot be directly written by staff or worker sessions.

Disable the global switch before rotation/revocation or repair. Rotate each scoped token in both secret managers during a coordinated paused window; retain queued source events/pending requests and retry them unchanged after verification. Nex receives only the scoped HTTP tokens and endpoint URLs, never KP's database worker key. Existing requests survive receiver outages and revoked staff access. A token/account leak follows the accepted incident process; no credential material belongs in CRM notes or logs.

## Replay retention and rights handling

Receipts are append-only replay/collision evidence and are not automatically pruned. Source snapshots, immutable mappings and request outcomes are retained for operational correctness. This is a deliberate hold pending the accepted replay horizon and privacy contract, not an indefinite-retention policy decision. No scheduled deletion or contact-data copying is introduced.

Before live activation, Nex and KP must agree the producer replay horizon, minimum event-ID tombstone retention, contact rights/deletion propagation, approved administrative anonymization/repair and legal/privacy retention. Complete source task cancellation/stop handling before archiving a linked contact. Review affected associations, outstanding requests and replay tombstones; do not hard-delete source links or reintroduce deleted contact details through retries. KP's native CRM data remains independently subject to its rights process. Those source-dependent decisions cannot be accepted solely with KP access.

## Nex account handoff and acceptance

1. Reuse the approved merged Nex foundation; finish its separate hosted security/privacy acceptance and reconcile prepared schema-2 fields, task kinds and request outcome codes with canonical source rules. Prioritize the protected admin connection and Veteran/Provider backend before further lifecycle expansion.
2. Implement the authenticated source producer, transactional retry queue, request validator and nightly full-source comparison. Keep every unacknowledged event/request. Transient 429/503/network failures back off without changing source truth; 400/401/409/413/415 require staff review, not replacement IDs.
3. Verify actual source domain IDs and the protected backend host. Define named KP staff/capability mapping with fresh MFA, live revocation and object scope before any new admin connection. Link reviewed records; no synthetic fixtures in production. Configure scoped tokens only through secret managers and verify disabled/unauthorized paths before staged activation. A provider-feed token never authorizes editorial, support, moderation or staff actions.
4. Run the integrated ten-organization/multiple-contact matrix: approved-preview/inbound admission, contact versus organization stops, terminal re-entry, regression after success, tasks/cancellation/completion review, stale/duplicate/collision delivery, moved/archived links, access revocation, forced API/network failures and deliberate drift repair. Local KP tests are receiving-side evidence, not this cross-account release acceptance.
5. Agree retention/rights and verify rotation, kill-switch recovery and scheduler heartbeat. Activate only the accepted V1 provider feed. Finish remaining Nex Veteran/provider/admin V1 release checks before starting V2 marketplace.
