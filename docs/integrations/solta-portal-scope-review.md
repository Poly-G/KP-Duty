# Client scope review in the Solta portal

Staff saves immutable scope versions in KP. A saved scope is private until an administrator explicitly shares the current version with the project's connected client company. Share only the finished deliverables, exclusions, commercial terms and timing. Internal change reasons and approval evidence are omitted from the portal projection.

Clients can request changes with a note. Only the active company approver can confirm approval of that exact current shared scope version. The Solta server derives actor identity and role from authorized membership, then signs the request to KP. KP independently checks the service identity, exact enabled project/company mapping, fresh nonce, publication and current version. Repeated request IDs must match the original decision. Final approvals are append-only.

Saving a revision immediately invalidates prior approval for readiness and office payment creation. The last shared scope remains readable as reference while the revised draft stays private. Publish the revised version to reopen client review. Cancel unpaid payment requests bound to an earlier office scope before sharing a revised scope.

Portal approval satisfies the existing current-scope readiness and $799 office payment gate. It does not charge a card, start delivery, advance production or launch a website. Staff can still record actual approval received outside the portal. Those private evidence fields remain private.

Sharing a scope currently makes it available in the portal only; it does not send a scope email. The existing project email work covers other event types and is preserved.

Verification: 41 isolated database checks, 52 KP unit tests, 42 frontend tests, and 28 phone/desktop interface checks. QA browser submissions were mocked locally, with no real agreement or payment. Production builds and scoped lint checks must pass before rollout.

## Hosted verification — October 13, 2026

Backend e96a824 is live through production deployment 3VwKwoceFhBWuoVc7tXcyojTYtMm. The additive migration is installed; both new tables have RLS, anonymous operation access is denied, staff publication and service receiver grants were read back, and security advisors gained no new findings.

On the existing synthetic First Client Website project, staff saved a non-binding $0 QA scope privately, then shared v1 through the normal staff control. The signed client portal displayed all four sections and omitted the internal revision reason. A member's approval option was disabled; empty feedback was rejected. A real QA feedback submission reached KP and the database with actor_role=member, scope_approved=false and started_at=null.

Staff saved v2 privately. Clients continued to see v1 as reference with all decision controls removed. Explicitly sharing v2 reopened fresh review and did not carry over v1 feedback. The live 390-pixel view had no horizontal overflow. No real agreement was accepted and no payment was requested. Final-approver submission and approval/payment readiness were verified in isolated database and mocked browser tests.
