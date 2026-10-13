# First Solta client checklist

Use KP for client setup and delivery. The public Solta site handles enquiries, checkout and the client's private portal.

## Before inviting a real client

1. Create the client company and its Solta project in KP. Confirm the agreed service, price, deliverables, contact details and who supplies copy, images and other materials.
2. Prepare the scope and terms as a private version. For a website, confirm domain ownership, where enquiries should go, branding requirements and dependencies. For Less Office Work, record the workflow trigger, steps, exceptions, approved tools, software costs and acceptance tests.
3. In Client portal access, enter one final approver and any teammates. Verify every email and confirm company-wide access. Changing the final approver affects all projects belonging to that company.
4. Finish setup, then use each person's Send welcome email action. Setup alone does not send invitations. Each client opens the invitation and signs in using their own email link.
5. Enable project emails and client-update emails for this specific project on both KP and Solta, preserving the existing allowed-project lists. Check the designated approver and active members before enabling delivery; keep all-project delivery disabled unless separately authorized.
6. Explicitly share the current scope in the client portal. With project client-update emails enabled, the final approver receives its review link. Verify the client’s approval of that exact version in KP; a revised draft invalidates earlier approval and must be shared and approved again.

The $799 Standard office offer is one task, paid after approval of the written scope. Multiple tasks and broader processes require a separate quote. Use an office scope starter for the three supported task types; confirm compatibility and software costs before preparing the scope.

## Payment and communication

1. In Client payments, create the agreed fixed-amount USD request and explicitly confirm the amount and mode. A real client request uses Live; synthetic QA uses Test. Creating a request does not create an invoice. Publishing the request sends the final approver a payment email when project emails are enabled. For Less Office Work, the current scope must already be approved before creating a payment request.
2. The client opens Payments in the portal and completes Stripe checkout. Confirm the matching paid request in KP and the receipt in the portal. Test payments do not satisfy a real payment requirement.
3. Ask the client to send a project message and an ordinary project file through the portal. Confirm they appear in the correct KP project and that staff can download the file privately. Files can be up to 50 MiB.

If request publication is interrupted, reload and use Retry publishing on the existing request. Do not create a duplicate request. An unused request may be cancelled; a request with checkout already started is locked against cancellation.

## Review and delivery

1. Save the website deliverable as a new immutable version, complete internal review, and publish its working preview.
2. The final approver can approve that exact version; teammates can request changes. A revised version requires a new approval.
3. Confirm the recorded client response in KP before treating the version as approved.
4. Start delivery explicitly only after scope, submitted and reviewed onboarding, required payment evidence, access/dependencies and capacity are ready. Portal access, a payment, or a preview approval does not start delivery automatically.
5. Use the existing explicit launch checks when the work is complete. Approval of a preview alone does not launch the website.

## Connecting an office client’s tools

1. Confirm the real client, final approver, approved scope version and one agreed task. Record which named tools hold the source data and receive the result, including the client’s timezone and approved contact/message rules.
2. Confirm provider compatibility, access ownership and ongoing software costs. Obtain access through the client’s approved sign-in or authorization flow; never put passwords, tokens or API keys in scope notes, messages or this checklist.
3. Connect the tools against the scope’s acceptance tests. Keep the workflow paused while checking success, cancellation/opt-out, duplicate events, retries and failures. Appointment reminders must recheck current appointment details before sending.
4. Obtain acceptance of the tested result. Activate only after the exact scope is approved, required real payment is verified, access is ready, and acceptance and message wording are approved. Confirm the pause procedure and handover.

The current connected projects are synthetic QA fixtures. They do not identify a real client or authorize access to anyone’s business tools.

## Verification on October 13, 2026

Independent local checks passed: 11 Solta onboarding/payment tests, 3 KP setup workflow tests, 24 isolated onboarding database checks and 24 isolated payment database checks. These tests made no live writes.

The fresh synthetic company test in the Build out the project chat has verified two welcome invitations, a sandbox payment synchronized to KP, exact-version approval, and teammate restrictions. The staff display and private download fix is live; the downloaded file matched the original exactly.

No real client invitation, live payment request or launch was created by this checklist. Live Stripe-signed delivery will be confirmed when the first authorized real payment occurs; sandbox checks do not prove a live charge.
