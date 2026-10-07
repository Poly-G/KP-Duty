# Project collaboration slice

Solta and Sent & Delivered client delivery projects now have private files, retained versions, internal notes, client messages, and explicitly published milestone updates. Existing CRM, staff Inbox, Requests, Library, and delivery readiness stay separate. Nex remains paused.

## Working flow

1. Open a client delivery project under its business workspace.
2. Save current work, client next action, and named milestones as a private draft.
3. Use **Publish saved progress** to copy that revision into an immutable client publication. Later edits and internal project stage changes cannot alter it. Retrying a publication creates one snapshot and one notification job.
4. Upload a PDF, PNG, JPEG, UTF-8 text, or CSV (up to 20 MB), or attach a Google Drive/Docs link. Files start internal; explicitly share a ready version with the client. Previous versions remain retained. Drive permissions are managed in Drive.
5. Post an internal note or explicitly choose a client message. Messages are immutable and attributed to the current staff identity. Corrections can be posted as a new message.
6. **Preview client view** opens a staff-authenticated branded page without KP navigation. Only published progress, ready shared files, and client messages appear. It is not a public portal or an authentication bypass.

The business practice page includes a browser-only collaboration simulation. No sample clients or sample messages are written to the production database.

## Storage and permissions

`kp-project-files` is a private Supabase Storage bucket. Uploads first reserve metadata for a specific project/file path. Storage INSERT requires that exact pending reservation and the uploader's active staff identity. Storage UPDATE and DELETE are not granted; versions cannot overwrite one another. Ready state requires a matching stored object. A failed upload keeps its pending reservation for a same-file retry. File size, byte signatures/UTF-8, safe filenames, and SHA-256 are validated server-side. Text files are downloaded as attachments, never rendered as uploaded HTML.

All five collaboration tables have RLS and explicit authenticated grants. Anonymous and disabled users are denied. Active staff share the internal workspace under the current team model. Client access will require separate business-scoped identities and policies in the later auth slice; clients must not become staff profiles. Archived project uploads/publications are rejected. Downloads use the user's JWT and storage RLS and return private, non-cacheable attachments.

Draft saves check revision numbers; publishing locks the draft and rejects a stale revision. File series/version uniqueness prevents conflicting version reservations. Internal notes never queue notifications. All client message and progress events create deduplicated **held** jobs.

## Email deliberately held

This slice does not send email. There are no verified client portal recipients yet, and Supabase's existing Resend SMTP configuration is for authentication email. The outbox records events so the later client access slice can add verified recipients, opt-ins, a Resend app sender, leased retry delivery, provider idempotency, and a working portal link. Held jobs cannot be marked sent by staff API requests. No cron, Stripe integration, or stage-triggered communication has been introduced.

## Backup and recovery

The company JSON backup includes messages, drafts, immutable publications, file metadata, and held jobs. Uploaded file **bytes are not in the JSON backup**. Restoring files requires a separate export of the private storage bucket; retain the object paths from `project_files`. Do not claim that a JSON-only backup restores uploads. Migration is additive; rolling back the app to the previous release leaves these records intact.

## Verification

The database test runs the real migrations against local PostgreSQL (PGlite) with authenticated, disabled, and anonymous roles, including storage policies. It verifies stale saves, immutable snapshots, repeat publication, actor forgery, internal-note isolation, notification holds, exact upload paths, file immutability/versioning, and denied identities. File validation tests exercise actual bytes and malicious links. Production smoke testing uses rolled-back SQL plus the browser practice view; actual uploaded bytes still need a staff-owned real project to exercise end to end.

Supabase advisors after applying this slice reported no new security issues or unindexed collaboration foreign keys. The pre-existing [leaked-password protection setting](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) and [Inbox/Library policy performance notices](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan) remain outside this release.
