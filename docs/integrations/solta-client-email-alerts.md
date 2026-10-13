# Solta client email alerts

Sign-in and welcome emails are working. Public website deposits notify Solta. Project messages, verified files, review decisions, payment requests and confirmed portal payments now have a durable notification queue and branded delivery endpoint. Local verification passed and the approved commits were released. Both hosted controls allow only the synthetic first-client project. Message, verified-file, exact-version changes-request and payment-request emails are confirmed delivered in Resend. The Sandbox payment-confirmation email is also verified delivered; all five implemented event kinds passed hosted QA.

## Current status

| Event | Current behavior | Email status |
| --- | --- | --- |
| Sign-in link requested | Sends the branded, one-use sign-in email to that user. | Verified through normal client sign-in. |
| Welcome invitation sent from KP | Sends the branded portal button to the selected person after access setup completes. | Both QA inboxes confirmed delivery. |
| Public quote/enquiry submitted | Sends the enquiry to the internal inbox. | Quote delivery previously verified. |
| Public standard website deposit paid | Verifies Stripe's event and sends an internal deposit email. | Sandbox email verified; live signed delivery awaits a genuine payment. |
| Client posts a message | Saves the message in KP and displays it for staff. | Verified delivered for the QA project in Resend (October 13). |
| Client uploads a file | Verifies the stored file and makes it available to authorized clients/staff. | Verified delivered for the QA project in Resend (October 13). |
| Staff posts a client message or publishes progress | Publishes the client-visible record and creates a held notification job. | Future scoped publications send the new client alerts; old held jobs remain untouched. |
| Staff shares a file or publishes a working preview | Makes the published file/version available in the portal. | The new file/preview alerts are verified delivered for the QA project. |
| Client approves or requests changes | Saves the decision for the exact version and displays it in KP. | Verified delivered for the QA project in Resend (October 13). |
| KP publishes a portal payment request | Makes the fixed-amount request available in Payments. | Verified delivered for the QA project in Resend (October 13). |
| A portal payment succeeds | Records the verified payment, synchronizes it to KP and provides the Stripe receipt link. | Verified delivered after the signed Sandbox payment synchronized to KP. |

## Alert plan

| Priority | Trigger | Recipient | Email action |
| --- | --- | --- | --- |
| 1 | New client message | contact@soltaworks.com | Open the KP project to respond. |
| 1 | Client file finishes verification | contact@soltaworks.com | Open the KP project to review/download the file. |
| 1 | Client approval or changes request | contact@soltaworks.com | Open the exact version's recorded decision. |
| 2 | Staff client message, published progress or newly shared file | Active people with access to that company/project | Open the client project. |
| 2 | New working preview published | The company's final approver | Review the exact published version. |
| 2 | Live portal payment request published | The company's final approver | Open Payments to see the amount and pay through Stripe. |
| 2 | Verified portal payment recorded | contact@soltaworks.com and the company's final approver | Staff: open KP. Client: open Payments/receipt. |

These recipients are the proposed defaults. The current access model has an approver and members; there is no separate billing-contact role yet. Welcome invitations remain explicit per-person actions. Internal notes and unpublished drafts do not generate client email alerts.

## Requirements before enabling alerts

Each email should use the Solta logo, a clear company/project name and one button. Project buttons open the normal authenticated portal or KP page. File emails link to the project rather than attaching the private file.

Select only active, authorized recipients at delivery time. Each recorded event and recipient needs a durable delivery record so a retry does not send duplicate notifications. Failed deliveries must remain retryable and visible to staff. Old held jobs should stay held unless deliberately selected for delivery.

Test every alert using the synthetic QA company and the two confirmed inboxes before enabling it for real clients. Test Stripe emails must say TEST and remain separate from real-payment notifications. Email failure must not undo a saved message, verified upload, approval or payment.

## Source evidence

- Sign-in branding: `mettlesite/lib/portal/sign-in-email.ts`.
- Welcome delivery and retry key: `mettlesite/app/api/integrations/kp/onboarding/route.ts`.
- Public deposit email: `mettlesite/app/api/stripe/webhook/route.ts` and its sandbox counterpart.
- Portal payment persistence and KP synchronization: `mettlesite/lib/portal/billing/webhook.ts` and `dispatch.ts`; neither sends notification email.
- Client message/file/decision requests: `mettlesite/app/api/portal/projects/[id]/actions/route.ts`; this calls KP without an email delivery step.
- Held staff message/progress notifications: `kp-production-release/supabase/migrations/20261007220430_project_client_collaboration.sql`. Its notification status is constrained to `held`; the current source has no delivery worker.

Audit date: October 13, 2026. This plan does not activate email delivery or send new messages.

## Implementation and verification

October 13: Solta backend suite passed 40 tests; KP notification database suite passed 23 isolated checks. Both production builds and scoped lint passed. New controls default disabled in both databases. No old held jobs are replayed.

KP captures future authorized source events transactionally and leases delivery attempts. Solta freezes recipient records, rechecks active approver access, uses a stable provider idempotency key, and records provider acceptance. An uncertain delivery older than 23 hours requires manual provider reconciliation before another send.

Retries run on subsequent project activity, an authorized staff project visit, or the admin Retry pending emails action. No periodic background retry schedule is configured. Provider acceptance is distinct from confirmed inbox arrival.

Client alerts for staff messages, published progress, shared staff files and newly published previews are implemented and verified for the sample project. Real-client alerts remain disabled by the project allowlist.

## Hosted QA delivery results

Approved releases: Solta `af169b050cf18aa3161fbba9dc2bfcd1503e5107` (production `HhcVuiCMruuqJAW6mDf5cf8EwNWD`), KP `0578c0651b0a014464c762c8b57a24c949636bb4` (production `9d7W1xPFYsEuUJe9YULuERbRgdWs`). Newer scope-review releases include these ancestors; do not roll them back to repeat this release.

Scope: only KP project `b7ab0318-2cf8-4b47-977e-1b97e581e538`, portal project `3caae450-e8f1-4ab6-8230-a4d5839d005c`. `allow_all_projects` remains false in both databases.

Verified delivered to contact@soltaworks.com: synthetic client message; verified `solta-notification-qa.txt`; changes request for website version 3; request for `[QA] Email-alert sandbox payment — no real money`. Message and request acknowledgement retries retained one provider email per event. Request `e8a47e4d-5d48-4041-9f29-1fb2d44d0643` is $5 in Stripe Sandbox (`livemode=false`). No real money test occurred.

Sandbox Checkout completed October 13 at 11:40 AM Pacific using Stripe’s standard fake card. Both ledgers record $5.00 and livemode=false; KP captured payment.received and acknowledged notification delivery. Resend reports the payment confirmation delivered to contact@soltaworks.com (provider id 01a13690-a6bc-707d-8060-a1f59c590563). The internal inbox and active approver are the same address, so one recipient email is intentional. All five queue events and all five delivery records are sent; a final retry created no additional delivery. No real-client alerts are enabled and no real money was charged.

## Client update implementation and hosted QA

New event kinds: `message.shared`, `progress.published`, `file.shared`, `preview.published`. Staff messages, published progress and ready shared files notify all active company members; a newly published preview notifies the active approver only. Each email links to the authenticated project; no message body, draft content, file attachment or private Drive URL is sent. Preview/file emails identify the recorded version.

Both hosted databases have the `client_updates_enabled` control, default false. Existing incoming-activity/payment alerts remain scoped to the QA project. The new source triggers do not backfill held jobs or existing publications. The queue claim and receiver both respect the new control. Revoked memberships are skipped before a retry sends.

Verification: 44 Solta backend tests, 30 KP notification database checks, scoped lint and both local production builds passed. Solta commit `2a914ad070e88b823b19fba89c749c3521eae8c4`; KP final release commit `2475f27ab17c634b049c3911d07211621f043350` (includes `b840ba2`). Solta Vercel preview `CLesTtt1iJP8RxFVh8s5ARVvHm53` is Ready. The owner approved both exact commits. Hosted QA delivery is now verified for all four event kinds; the earlier approval block is resolved.

Authorized staff visits now drain the scoped queue even when the viewer is not an admin; delivery controls remain admin-only. The final KP build and lint passed after this fix.

## Client update hosted results — October 13

Production deployments: Solta `DixAXq3cB5TH1K1FYEYtVrfoZZAU` from `2a914ad`; KP `DXofcf5UgmWzZjmX96hhvRDdgFbG` from `2475f27`. Both applications have client updates enabled only on the existing sample project allowlist; allow_all_projects remains false. No payment or launch was created.

- `message.shared`: sent once to contact@soltaworks.com and soltafilms@gmail.com; event c72f45c7-ecb4-4c89-93b3-6addda43fda1.
- `progress.published`: sent once to both QA members; event c04c0c8b-de21-4e9a-8631-ead96f7e328b.
- `file.shared`: sent once to both QA members after staff explicitly shared solta-staff-shared-qa.txt, version 1; event b10bc3db-c525-4f07-be92-d00907a0e44f. The private upload alone created no file alert.
- `preview.published`: sent once only to the approver, contact@soltaworks.com, for website version 4; event 1576fe2f-22a8-4b18-b847-65813b22d57b. Resend provider id 01a136ae-67c3-7435-9e9a-a9a8f7dc1af0.

Resend reports all seven recipient emails delivered. KP acknowledges all four queue events as sent, one attempt each; Solta stores seven sent recipient records for these four IDs. A final Retry pending emails left these counts unchanged. An internal-only note and unpublished progress draft produced zero new email events. The branded preview email identifies version 4 and its button opens the normal authenticated project URL; an expired session correctly reaches sign-in.

Staff saves briefly showed stale-page errors around the release. After refreshing the released page, file sharing and internal review succeeded. Billing refresh also recovered and showed both existing Sandbox payments. No permission bypass or corrective production data write was used.
