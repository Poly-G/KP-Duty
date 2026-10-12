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

Verified locally: four OAuth/encryption/database security tests, existing Solta
receiver test, TypeScript, and lint. These tests use synthetic tokens and mocks;
Google consent and production connectivity have not yet been tested.

Production deployment 6yzFqJuT6dG9XRKDSGYuJsoBPDUH is Ready (1m 10s),
source bd61639, serving kp-duty.vercel.app. Google Audience lists only
soltafilms@gmail.com as a test user. Opening the deployed connection page in a
signed-out browser correctly redirects to KP login. The owner must sign into
KP before Google authorization; no Google token has been obtained yet.

Remaining before activation:

- Sign into KP and authorize as Solta. Testing mode can
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
