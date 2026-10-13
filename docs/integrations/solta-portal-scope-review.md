# Client scope review in the Solta portal

Staff saves immutable scope versions in KP. A saved scope is private until an administrator explicitly shares the current version with the project's connected client company. Share only the finished deliverables, exclusions, commercial terms and timing. Internal change reasons and approval evidence are omitted from the portal projection.

Clients can request changes with a note. Only the active company approver can confirm approval of that exact current shared scope version. The Solta server derives actor identity and role from authorized membership, then signs the request to KP. KP independently checks the service identity, exact enabled project/company mapping, fresh nonce, publication and current version. Repeated request IDs must match the original decision. Final approvals are append-only.

Saving a revision immediately invalidates prior approval for readiness and office payment creation. The last shared scope remains readable as reference while the revised draft stays private. Publish the revised version to reopen client review. Cancel unpaid payment requests bound to an earlier office scope before sharing a revised scope.

Portal approval satisfies the existing current-scope readiness and $799 office payment gate. It does not charge a card, start delivery, advance production or launch a website. Staff can still record actual approval received outside the portal. Those private evidence fields remain private.

Sharing a scope currently makes it available in the portal only; it does not send a scope email. The existing project email work covers other event types and is preserved.

Verification: 41 isolated database checks, 52 KP unit tests, 42 frontend tests, and 28 phone/desktop interface checks. QA browser submissions were mocked locally, with no real agreement or payment. Production builds and scoped lint checks must pass before rollout.
