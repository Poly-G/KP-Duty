# Client delivery foundation

Solta and Sent company workspaces now create separate, planned client delivery projects. Existing internal project workflows stay unchanged. Nex has no client setup route.

Each project has an immutable service/template selection, saved onboarding answers, submission/review state, scope approval, payment requirements and evidence, dependencies/access confirmation, capacity confirmation, and an explicit admin start approval. Website, Branding, Less Office, Care and Sent use different required questions. Staff prepare the records now; external client authentication is deferred.

Editing onboarding answers resets submission/review. Optimistic revision checks reject stale saves. Every accepted edit retains a snapshot with actor attribution. Only active staff can read records; team members can prepare onboarding and review dependencies, while administrators approve commercial requirements, capacity, and delivery start. No client or anonymous access is granted. Future client identities must remain separate from staff profiles and receive independently tested business/project permissions.

Database triggers reject active/completed status before start approval, including through the existing project controls. Start requires reviewed, submitted onboarding, approved scope, active owner, dependencies/access, capacity and payment evidence when payment is required. Stripe is still disconnected; manual evidence is not a Stripe payment status.

The staff-only `/businesses/solta/preview` and `/businesses/snd/preview` practice pages use browser-local sample state. They never create records or send messages. They demonstrate the workflow; database permission tests independently verify live enforcement.

## Validation

`npm test` runs the existing 16 authentication tests plus an isolated PGlite Postgres test. Install dependencies first. Database cases cover retry safety, wrong business/service, orphan prevention, missing onboarding, stale saves, member approval denial, required payment evidence, legacy status bypass, immutable start/history, and disabled/anonymous denial. A production integration test ran inside a rolled-back transaction and verified compatibility with existing project triggers; no sample projects remain. Typecheck, lint and production build also pass.

Company backups include engagement records and revision history. Pre-change backup: local audit/2026-10-07-pre-delivery-backup.json outside the repository.

Advisors found no new security warnings from this module. Existing project findings remain: [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), [Library foreign-key indexes](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys), and [Library/Inbox RLS performance](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan). New indexes are initially unused because there are no client engagements yet.

## Remaining work

Private files, branded customer portals, project messages and notifications, published milestones, deliverable approvals, team administration, client authentication/isolation and SnD migration are separate remaining slices. Do not present this foundation as the finished client portal.
