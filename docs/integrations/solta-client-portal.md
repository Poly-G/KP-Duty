# Solta client portal collaboration bridge

The customer app lives in Poly-G/mettlesite. Customers have separate invited accounts and company memberships; they do not become KP staff. KP remains the source of project delivery records and private files.

## Implementation and rollout

The dedicated POST `/api/integrations/solta/portal` receiver is closed unless `SOLTA_PORTAL_RECEIVER_ENABLED=true`, a shared secret of at least 32 characters is present, and the server-only integration database credential is configured. Normal KP staff authentication remains in place on other routes.

Before enabling a pilot:

1. Review and apply `20261010030032_solta_client_read_boundary.sql`, then `20261010162451_solta_client_collaboration.sql` to the intended KP database.
2. Create company and project authorization links in Solta. Verify the KP UUIDs.
3. As a KP admin, call `kp_link_solta_portal(p_project, p_company, p_portal_project)` with those exact IDs. The mapping is immutable; enable/disable it through the admin-controlled `enabled` field.
4. Configure KP's server-only `KP_INTEGRATION_SUPABASE_SECRET`, `SOLTA_PORTAL_SHARED_SECRET`, and enable flag. Configure Solta's `KP_PORTAL_API_URL` to this HTTPS endpoint and matching dedicated `KP_PORTAL_SHARED_SECRET`. The database credential stays in KP.
5. Pilot synthetic companies and verify publication, foreign-company denial, revoked membership, disabled links, signature expiry and replay denial in the deployed environment.

Hosted rollout update, October 10, 2026: both migrations were applied with user approval to KP project `yurkyxjhxvtivdrbcjuc` through its signed-in dashboard and recorded in migration history. Verification confirmed six RLS-protected tables, narrow service-role RPC permission, blocked direct anonymous/customer RPC access, private Storage and zero project mappings. Receiver deployment, secret configuration and a hosted synthetic pilot remain pending. Local tests do not prove hosted end-to-end behavior.

## Publication boundary

Requests carry exact KP project/company IDs, the immutable Solta project-link ID, client actor ID, timestamp, UUID nonce and HMAC signature. KP independently checks the mapping, active Solta business and unarchived company/project. A unique receipt rejects nonce reuse. Receipts contain actor identifiers and timestamps, not message/file content; define an operational retention period before sustained traffic.

Only the latest explicitly published progress, client messages and ready client-shared file descriptors are returned. Internal notes, draft progress, staff IDs, evidence, storage paths and raw storage URLs are excluded. KP staff can publish an immutable working-preview URL for the current published version. Client messages, ready uploads and version-specific decisions are KP-owned records with external actor attribution. Customers are not staff profiles. Payment writes remain outside this bridge; Solta’s payment outbox remains held.

Disable the receiver flag or a project mapping to close access. Do not replace this boundary with client access to KP's privileged database key.

## Verification

`node --test tests/solta-receiver.test.mjs` checks the signed transport and bounded strict input. `node tests/database/solta-client-read.mjs` replays the actual migration in isolated PostgreSQL-compatible PGlite and checks admin-only linking, independent matching, private field exclusion, replay protection, disabled links and role permissions. Hosted RLS/advisor and end-to-end service checks remain rollout work.

## Collaboration operations

The strict signed contract supports project.read, message.create, file.reserve, file.inspect, file.complete, file.download and review.decide. Solta derives actor identity and current member/approver role from its database; KP independently checks the exact company/project/portal mapping and consumes a unique nonce. Request UUIDs make message/upload/decision retries durable. Version-specific decisions reject stale versions and staff review overwrites. Approval does not launch or activate delivery.

The browser uploads directly to a scoped signed URL with no upsert. KP verifies stored size, format and SHA-256 before marking the file ready. The private bucket accepts PDF, PNG, JPEG, HEIC/HEIF, DOCX, UTF-8 text and CSV up to 20 MB; legacy DOC and SVG remain unsupported. Downloads require an authorized ready file and expire after 60 seconds. Upload tokens last up to two hours; current authorization is required again for completion. Define pending-object cleanup and nonce receipt retention before sustained traffic. File format checks are not malware scanning. Use an exact version deployment URL for previews; immutable URL publication cannot freeze external page contents.

`node tests/database/solta-client-collaboration.mjs` checks the actual additive migration, publication/tenant restrictions, immutable decisions, retries and narrow role permissions. The cross-repository Solta `test:portal-kp` checks the real signed receiver and Solta sessions against isolated SQL databases and fixture Storage. Hosted database, Storage and receiver deployment are still unverified.
