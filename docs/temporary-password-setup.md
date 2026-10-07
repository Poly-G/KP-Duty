# Temporary password setup

`/setup-password` is disabled (404) unless `KP_PASSWORD_SETUP_ENABLED=true`
and `KP_PASSWORD_SETUP_EXPIRES_AT` contains a future ISO timestamp. Enable only
on the Render test service. It does not change existing login, auth callbacks,
app cookies, RLS, roles, or account creation.

An administrator generates a Supabase `recovery` link for the existing account
using `auth.admin.generateLink`, without sending an email. Deliver its
`properties.hashed_token` as `/setup-password#token_hash=…`. This token is a
bearer secret: never commit it, log it, or put it in a query string.

The browser removes the fragment from history, validates both password fields,
then exchanges the token with `verifyOtp({type: 'recovery', token_hash})`.
Supabase enforces expiry and one-time consumption, including across tabs and
server restarts. Merely opening the page does not consume the token.
The password goes directly to Supabase `auth.updateUser`, with its existing
password and authentication policies. No service-role key reaches the app.

The dedicated recovery client stores its session only in memory, supports
password-policy retries within the same tab, signs out the recovery session
after success, and navigates to `/login`. No password or auth session is
persisted to browser storage. Reloading after token exchange loses the recovery
session; issue a new link if needed. Failed responses never echo credentials.

The link becomes unusable at exchange, before the password update. The route
automatically returns 404 at its configured deadline; to close it sooner set
`KP_PASSWORD_SETUP_ENABLED=false` and redeploy. The HTML form may remain
available until that deadline, but a consumed link cannot authorize another
password change. Remove this route, `src/lib/auth/password-setup.ts`, its test,
the setup-only headers in `next.config.ts`, and both environment variables
when the temporary flow is no longer needed.

The old `kp-password-setup` Edge Function must remain a 410 tombstone. If a
temporary token-issuance helper is used, disable it immediately after issuance.
Never accept or inspect Poly's chosen password in chat or automation.

Run `node --test tests/password-setup.test.mjs` on Node 22.18+ for regression
checks, then run the existing typecheck, lint, and production build.
