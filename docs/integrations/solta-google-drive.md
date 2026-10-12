# Solta Google Drive connection

Storage account: soltafilms@gmail.com. Google Cloud project: Solta Portal Drive
(serene-mender-511416-q9). The Drive API and OAuth branding are configured.

The KP server needs GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET in
Production. Both credentials were confirmed present as Production secrets in KP
on October 12. Never copy these values into browser bundles or source control.

The registered callback is:
https://kp-duty.vercel.app/api/integrations/google-drive/callback

After deploying, an active KP administrator opens
/api/integrations/google-drive and uses the connection button. Google must grant
openid, email and drive.file to the verified Solta account. No existing unrelated
Drive files are requested. Callback state is random, bound to the admin and an
HttpOnly Secure cookie, expires after one hour, and is consumed atomically.
The refresh token is encrypted with AES-256-GCM, using a domain-separated key
derived from the server-side client secret. Changing that secret requires
reconnecting. Tokens and provider error bodies are never displayed or logged.

The hosted migration 20261012165918 is applied. Both tables have RLS and grants
only for service_role; anon and authenticated have no table privileges. The
no-policy advisor INFO is intentional: all browser access is denied. Existing
advisor warnings for KP linking RPCs and leaked-password protection were not
changed by this migration.

Production attempt GM3Uw3jA7 failed at npm install because unpinned resolution
selected an unpublished @typescript-eslint/parser 8.71.2. The focused release
now includes the existing integration branch's tested pnpm lockfile and an
explicit frozen install command. Dependency manifests match, the frozen offline
lockfile check passed, and the locked parser 8.71.1 is published in the registry.

Verified locally: five OAuth/encryption/database security tests, existing Solta
receiver test, TypeScript, and lint. These tests use synthetic tokens and mocks;
Google consent is now verified in Production; Drive file operations remain untested.

Production deployment 8tLUnRgdqbzcfqVnUBkD6KpGBWgC is Ready (58s),
source c66b478, serving kp-duty.vercel.app. The user explicitly approved the
one-hour setup window after automatic review initially rejected its deployment.
Google Audience lists only soltafilms@gmail.com as a test user. Signed-out access
redirects to KP login. The owner completed consent while signed in as an active
KP administrator. Database metadata confirms account_email soltafilms@gmail.com
and connected_at 2026-10-12T19:31:51.239Z. The page shows Google Drive connected.
No credential contents were retrieved. root_folder_id is still null; file
storage routing has not yet changed.

Remaining before activation:

- Testing mode can
  expire refresh tokens in seven days; use the appropriate published OAuth
  configuration before relying on unattended production storage.
- Implement project folder mapping, resumable uploads, content verification and
  authenticated downloads. Existing Supabase files remain available meanwhile.
- Test with synthetic files and preserve existing objects until migration is
  verified. Do not make Drive folders public.
- Add scheduled cleanup for expired OAuth states. Successful states are removed
  immediately; abandoned states currently remain inaccessible until cleanup.

This patch establishes the provider connection only; it does not switch uploads
or downloads to Google Drive yet.

Owner authorization attempts exceeded the initial ten-minute window (about 44
minutes and 18 minutes). The setup state and cookie now share a bounded one-hour
window; administrator checks, exact Google account, CSRF origin, and single-use
database consumption remain required. No session lifetime or Drive scope changed.


## Drive file rollout

Migration `20261012195021_solta_google_drive_additive_storage.sql` adds a separate service-only file RPC and private Drive mappings. The original portal RPC and its grants remain unchanged. `solta_drive_connection.storage_enabled` defaults to false: new code still reserves Supabase uploads until explicit activation. New code also falls back to the original RPC when the additive RPC is absent. Existing completed Supabase files retain their original download flow.

Drive uploads use private company/project folders, resumable upload links without Google credentials in the browser, server verification of size/type/SHA-256 before publication, and expiring download tickets that recheck project authorization. The current 20 MB limit remains.

Validation before activation: isolated database checks cover legacy operations, the off switch, Drive completion, wrong actor/company, denied browser access and disabled mappings. Live small and >4.5 MB synthetic uploads/downloads remain pending. Google OAuth Testing refresh-token expiry remains an operational follow-up.


Project-scoped activation supersedes the global switch. Migration `20261012203922_solta_drive_project_scoped_rollout.sql` makes new uploads opt-in through service-only `solta_drive_projects`. Only synthetic QA project `32ecdf04-8eca-4510-a300-30f0bce59465` is enabled. All other projects retain legacy storage. Production backend deployment `H8sqH7hSM5PceeLxbzgPyaaqrpza` uses d6c290c; portal deployment `2W4MGuGV813mv9g9uQzah168uSSV` uses 4d165f3.


Live QA (2026-10-12): the synthetic 61-byte text file and 6,291,456-byte text file both uploaded from the signed-in client portal, reached ready only after server size/type/SHA verification, and downloaded with identical bytes and hashes. The root folder sharing dialog shows only soltafilms@gmail.com as Owner and Restricted general access. Invalid download ticket returned HTTP 401. Production origin session fix is 6c5ec1b deployment gTMgmQHLRUkWWmYkP9j9mXe739j6. Download progress correction is b501cd7 deployment 6D5Tc1xKbiVf1VcbfjCVwwyRyq6V.

Legacy download follow-up: Chrome blocked a direct Supabase signed URL during live QA. Use the same KP ticket endpoint for both legacy and Drive downloads, preserving database authorization and private no-store attachment delivery; legacy files stay in their current storage. Retest after deployment before considering this verified.


Legacy relay QA passed on production deployment `CtdMXfBHpPJ8tXZQDZLZsE1ps2wW` (e58fea4): `solta-production-qa.txt` downloaded through the portal as 70 bytes with its original SHA-256 ca3c0bc98cece06c6f5e9cce36e70852e89ac4939d568a2bb14b59d2ec40e3d6. No files were migrated or made public. Live storage QA is complete for the synthetic project. Production Google OAuth publishing and a new post-publishing consent remain pending owner approval; the existing Testing grant expires after seven days. New real projects need explicit storage activation when onboarded.
