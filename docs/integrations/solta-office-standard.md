# Standard Less Office Work — $799

## Customer journey

The public quote form asks which task the customer wants and which tools they use. A task-specific link preselects the choice. Multiple tasks and broader processes are explicitly quoted separately. The enquiry email includes the task, tools and requested result; no payment is taken at intake.

Staff create a Solta Less Office project in KP and open Scope & terms. The office starter offers three reusable templates: new inquiry to customer list, appointment reminder, and completed-job review request. Staff name the actual tools, describe mappings/timing/exceptions and confirm compatibility and provider costs. The starter prepares editable deliverables, acceptance tests, exclusions, $799 commercial terms and timing. Saving creates the existing immutable scope version; it does not approve it.

Share that written scope with the client by the agreed channel. Record the real client's response and evidence against the exact scope version in KP. New office payment requests are blocked until the current version is approved, at both the staff action and database boundary. Office payment fields default to $799; staff must match the amount to the approved terms, including separately quoted work. The ledger records the scope ID. A prepared request from an older scope cannot be retried against a later version; review/cancel any existing request before replacement. Website payment behavior is retained.

After verified payment, completed/reviewed onboarding, access and capacity are ready, staff explicitly start delivery. Build against the acceptance tests, obtain client acceptance and activate the configuration. Payment and scope approval never automatically start delivery or launch.

## Reusable implementation

office-offer.ts generates the scope and three acceptance cases for each task.

office-recipes.ts supplies executable event validation, planning and a runner for the three tasks. It is provider-neutral and has no public webhook endpoint. Configuration is paused by default and must record scope approval, verified payment, access readiness, approved acceptance and message wording before activation. Unknown event shapes and task mismatches are rejected.

Customer-specific adapters connect the approved tools. RecipePorts requires durable atomic claims and per-step idempotency; retain completed steps on failure so retries reuse the same downstream keys. An adapter must not treat an in-memory set as production storage, retry an ambiguous send without provider idempotency/reconciliation, or accept configuration from an untrusted webhook.

The reminder adapter must reload appointment status, version, time and contact permission when the scheduled job executes. Drop stale/cancelled jobs; enqueue the revised appointment with its new version. A late reminder is skipped rather than sent at an unexpected time. Review requests respect opt-outs and never filter by satisfaction or rating. Client-owned credentials stay in the client's approved platform or server secret store, never in scope notes or recipe events.

No customer accounts are connected or messages sent by installing these starters. Supported-tool selection and adapter deployment happen for the first real client after compatibility and scope review. Missed-call texting remains a compatibility review/quote option, not one of the three ready starter recipes.

## Verification

The earlier first-client staff download check completed: the downloaded bytes matched the original exactly. Welcome invitations, approver/member separation, exact-version decisions and sandbox payment synchronization passed.

The office implementation passed 35 frontend backend tests, 51 KP unit tests, and 33 isolated payment database checks (nine new scope guard cases). Local browser checks verified task preselection, separate-quote messaging, hidden/disabled office fields for website enquiries, scope draft validation/reset and payment disabled until approval. The actual quote route was tested with mocked delivery; no new external email or payment was created.

Migration solta_office_scope_before_payment is applied to the KP database. Read-back confirms the scope link and guard, anonymous RPC access denied and existing staff RPC permissions retained. Security advisor findings are unchanged. Production release status follows after hosted checks.
