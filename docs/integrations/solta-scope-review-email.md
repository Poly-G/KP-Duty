# Scope review emails

When an administrator explicitly shares a new current scope version, queue one branded “Your scope is ready to review” email for the connected company's active final approver. Members and the internal inbox are not additional recipients of this event.

The email identifies the company, project and immutable version, then links to the project’s scope panel. It prompts the client to review deliverables, exclusions, price and timing. It never includes staff change reasons, approval evidence, private notes, scope terms as attachments, or a sign-in token. The portal remains the source for the current scope and authenticated approval.

The existing project email and client-update controls apply. Private drafts, existing shared scopes and retries of the same publication do not create new emails. Revisions create a fresh event only when explicitly shared. Old queued scope emails become “Superseded” and stop retrying when a newer draft exists.

Publication and queuing share a database transaction. Delivery runs after the staff response; an email failure cannot undo or hide the shared scope. Pending deliveries use existing leases, provider idempotency and current-recipient checks. Uncertain old provider acceptance still requires delivery review before a new send.

Local database verification covers 27 checks, including explicit publication, disabled controls, no backfill, duplicate sharing, private-field omission, current version, expired leases, superseded events and disabled project access. Hosted QA uses only the existing synthetic project and non-binding $0 sample scopes.
