# Scope review emails

When an administrator explicitly shares a new current scope version, queue one branded “Your scope is ready to review” email for the connected company's active final approver. Members and the internal inbox are not additional recipients of this event.

The email identifies the company, project and immutable version, then links to the project’s scope panel. It prompts the client to review deliverables, exclusions, price and timing. It never includes staff change reasons, approval evidence, private notes, scope terms as attachments, or a sign-in token. The portal remains the source for the current scope and authenticated approval.

The existing project email and client-update controls apply. Private drafts, existing shared scopes and retries of the same publication do not create new emails. Revisions create a fresh event only when explicitly shared. Old queued scope emails become “Superseded” and stop retrying when a newer draft exists.

Publication and queuing share a database transaction. Delivery runs after the staff response; an email failure cannot undo or hide the shared scope. Pending deliveries use existing leases, provider idempotency and current-recipient checks. Uncertain old provider acceptance still requires delivery review before a new send.

Local database verification covers 27 checks, including explicit publication, disabled controls, no backfill, duplicate sharing, private-field omission, current version, expired leases, superseded events and disabled project access. Hosted QA uses only the existing synthetic project and non-binding $0 sample scopes.

## Hosted verification — October 13, 2026

Released frontend b5777dd as production bw1fhLUBPkEWWMBinDdnqENJHWVz and backend d1f9b96 as production 4LcCYuZoYc9pfqh6gm6PXmGnf66v. The additive migration is installed; the private trigger cannot be called by anonymous users, and security advisors gained no findings.

The existing synthetic QA project has client-update emails enabled on both apps, with all-project delivery disabled. Saving the non-binding $0 scope v3 created no email event. Explicitly sharing it created one scope.published event, completed in one attempt. The frontend retained one delivery row for contact@soltaworks.com with member_role=approver. No member or additional internal recipient was added.

Resend showed the matching subject, version-three body and canonical portal scope link, then reported delivery. The email appeared in the QA approver's Private Email inbox. Its link opened the authenticated project with Scope · Version 3. Internal change reasons and scope terms were absent from the email. Reloading the staff project did not resend the completed event.

Verification passed: 48 frontend tests, 52 KP unit tests, 27 scope-email database checks, 41 scope-review database regressions, scoped lint/type checks, both production builds, and generated email layout at 390 and 900 pixels. No agreement was accepted and no payment was requested. Real projects still require their client-update email controls to be enabled during onboarding.
