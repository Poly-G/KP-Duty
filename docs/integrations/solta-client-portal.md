# Solta client portal read bridge

The customer app lives in Poly-G/mettlesite. Customers have separate invited accounts and company memberships; they do not become KP staff. KP remains the source of project delivery records and private files.

## Implementation and rollout

The dedicated POST `/api/integrations/solta/portal` receiver is closed unless `SOLTA_PORTAL_RECEIVER_ENABLED=true`, a shared secret of at least 32 characters is present, and the server-only integration database credential is configured. Normal KP staff authentication remains in place on other routes.

Before enabling a pilot:

1. Review and apply `20261010030032_solta_client_read_boundary.sql` to the intended KP database.
2. Create company and project authorization links in Solta. Verify the KP UUIDs.
3. As a KP admin, call `kp_link_solta_portal(p_project, p_company, p_portal_project)` with those exact IDs. The mapping is immutable; enable/disable it through the admin-controlled `enabled` field.
4. Configure KP's server-only `KP_INTEGRATION_SUPABASE_SECRET`, `SOLTA_PORTAL_SHARED_SECRET`, and enable flag. Configure Solta's `KP_PORTAL_API_URL` to this HTTPS endpoint and matching dedicated `KP_PORTAL_SHARED_SECRET`. The database credential stays in KP.
5. Pilot synthetic companies and verify publication, foreign-company denial, revoked membership, disabled links, signature expiry and replay denial in the deployed environment.

No live migration or enablement is performed by this change. The local tests are not evidence of hosted configuration.

## Publication boundary

Requests carry exact KP project/company IDs, the immutable Solta project-link ID, client actor ID, timestamp, UUID nonce and HMAC signature. KP independently checks the mapping, active Solta business and unarchived company/project. A unique receipt rejects nonce reuse. Receipts contain actor identifiers and timestamps, not message/file content; define an operational retention period before sustained traffic.

Only the latest explicitly published progress, client messages and ready client-shared file descriptors are returned. Internal notes, draft progress, staff IDs, evidence, storage paths and raw storage URLs are excluded. Reviews are empty until working-preview publication is implemented. Upload/download, approval and payment writes are not part of this read-only bridge. Solta's payment outbox remains held.

Disable the receiver flag or a project mapping to close access. Do not replace this boundary with client access to KP's privileged database key.

## Verification

`node --test tests/solta-receiver.test.mjs` checks the signed transport and bounded strict input. `node tests/database/solta-client-read.mjs` replays the actual migration in isolated PostgreSQL-compatible PGlite and checks admin-only linking, independent matching, private field exclusion, replay protection, disabled links and role permissions. Hosted RLS/advisor and end-to-end service checks remain rollout work.
