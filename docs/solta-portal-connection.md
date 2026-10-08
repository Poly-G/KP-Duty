# Solta portal connection — first foundation

KP owns customer/project records, service onboarding, publication, files and review history. Solta's website repository owns branded client screens. Intended client origin: `https://portal.soltaworks.com`; the public website remains `https://soltaworks.com`. These are intended destinations, not configured deployments. Mettlesite remains an internal staff entrance.

## Existing code to reuse

- `modules/delivery/templates.ts`: Website, Branding, Less Office, Care and Sent questionnaires with conditional branding questions.
- Delivery/scopes/production modules: draft/submission/review, exact scope versions, explicit start and dependency gates.
- Project collaboration: private immutable file versions, separately published progress, audience-specific messages and held notifications.
- Deliverables: version-specific publication and client responses, excluding internal evidence.
- New `modules/client-portal/projection.ts`: an allowlisted client payload shared by the staff preview. Removes internal notes/messages, unpublished deliverables, pending/private files, internal attachment IDs, staff IDs and arbitrary extra fields. This is not a public API or authorization mechanism.

## Connection contract and sequence

1. Poly clarified that Solta's website is not built yet. Use the supplied October 7 brand guide and homepage reference as the design source. The first shell is developed in KP's separate portal foundation branch; no Solta website repository has been created or connected yet.
2. Keep KP as the authoritative backend. Portal reads must independently authorize the authenticated client's business, company and project; an arbitrary project UUID must not suffice. Client membership is separate from active staff profiles. File download authorization must use the same membership/publication boundary.
3. Build the Solta shell/onboarding with a synthetic fixture and this payload contract. Staff-only preview remains authenticated while client auth is deferred. No credentials or service keys in the browser, no anonymous access to real records.
4. Model a purchased plan with an immutable version and explicit entitlements: eligible service/onboarding, feature-request allowance, bug-report/support boundaries and quote-required work. Final names, pricing, limits and cancellation rules await the approved Solta offer; do not invent them.
5. Add client requests as a separate project-scoped workflow, not the internal staff feature/bug decision submission. Server enforcement must decide entitlement and route out-of-scope work to a quote; submitting a request never automatically approves scope or starts work.
6. Connect Stripe last. A verified, retry-safe paid event creates or links the customer/project and makes onboarding available. A success URL alone is not payment evidence. Async payments, retries, refunds and subscription changes need explicit handling. Opening onboarding does not bypass the existing owner approval to start delivery.
7. Add invitation/account creation on the Solta origin and branded Resend delivery last; never send unverified invitations during preview development. Final account isolation and full Solta browser pilot are release gates.

No external connection, plan catalog, client auth, Stripe processing, notification delivery or domain change is shipped by this first foundation.

## Branded preview slice

`/client-preview/solta/demo` provides an authenticated, synthetic design preview independent of the archived workflow fixture. The real Solta client-preview route also uses this shell. It uses the supplied outlined SVG logo (not retyped text), Ink/Cream/White, Human Blue actions and modest Marigold highlights. Bricolage Grotesque and Instrument Sans load from Google Fonts with local fallback fonts. CSS is scoped to the Solta shell; Sent and the staff dashboard retain their current styling.

This slice shows published progress, next action, files, deliverable responses and messages. Section links navigate to real content; no nonfunctional request/upload/approval controls are presented. The demo is read-only and labels sample content. Form onboarding, plan-based client requests, client account isolation and domain deployment are subsequent slices. Production compilation/typecheck, lint and publication projection tests passed. Live browser/mobile verification is still required before release.

## Onboarding and request practice slice

The synthetic demo now contains editable service-specific onboarding, conditional branding questions, email/required-field validation, an answer review step, and explicit save/restore of browser-local drafts. Draft parsing accepts only known services, schema version and questionnaire fields. Changing service clears the current answers; saving replaces the previous sample draft. The page tells staff to use sample information, since local drafts are not company records and can remain on a shared browser.

Sample feature/bug requests appear in a local list until refresh. No requests are sent to staff, no decision is created and no charge is approved. A pure request policy helper distinguishes included review, quote review and unconfigured plan review; all current sample plans are unconfigured. Final entitlements require Poly's approved inclusions. This helper is not backend enforcement. Live authenticated submissions, durable request history, file upload, client approvals, identity isolation and payment provisioning remain pending.

All 31 unit tests passed, including invalid draft restoration, conditional onboarding and unconfigured entitlement behavior. Typecheck and scoped lint passed. Browser workflow/mobile checks remain required before release.

## Persistent staff preparation slice

The real Solta project preview now reuses the existing version-checked onboarding save/submit actions and database history. The standalone design demo remains local-only. A staff-only project request form submits persistent feature/bug records through a retry-safe RPC. The new Solta request queue gives admins version-checked status/response review; members can submit and read. Completed/declined reviews require an explanation. This is staff preparation, not authenticated client access.

Admins can record project-specific feature/bug rules from approved scope evidence. Rules begin unconfigured; included requests still require review and quote-required work is not approved. Each submission snapshots its policy revision/disposition, and original submission content is immutable. Request and policy histories are append-only with actor attribution. Archived projects and non-Solta projects reject new submissions. No delete path, automatic decision/task creation, outgoing notification, charge or delivery activation is added.

Migration `20261008153139_portal_requests.sql` is additive and generated by the Supabase CLI. Four new tables have RLS and explicit grants; no anonymous or nonstaff access. Invoker request submission and private guarded audit triggers preserve the existing staff access model. Backup export includes all four tables and orders policy rows by project ID. The business workspace links to the queue and independent design preview.

Validation: 31 unit tests and all 11 isolated database suites passed, including submission immutability, correct actor, retry mismatch, member/admin policy/review isolation, frozen entitlement snapshot, stale revision rejection, durable histories, wrong business, archived project, and disabled/anonymous denial. Production build, typecheck and scoped lint passed. The new migration has not been applied remotely; no hosted advisor check or live browser workflow/mobile pilot has been performed. Apply the migration before deploying this branch, then run advisors and the staff browser pilot. No production endpoint is available until deployment.
