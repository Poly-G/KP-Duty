# Automatic Solta email retries

Pending email events are retried without a staff visit. Supabase Cron wakes the production KP worker every five minutes using pg_net; Vercel Hobby's daily cron cannot meet the retry interval. The cron destination is fixed to KP production. No new persistent secret is required: each request gets a ten-minute, single-use credential whose hash is stored in the private schema. Browser roles cannot issue or consume ticks or read tick credentials. pg_net retains Supabase-managed extension grants; its net schema must remain outside the exposed Data API schemas.

The worker processes one due project (up to five events) per tick. A global five-minute lease and existing per-event leases prevent overlapping work. Due-project selection respects active Solta mappings, company/project archives, the email project allowlist, the client-update switch, and current scope publication. Existing Resend idempotency and recipient ledgers remain authoritative. DELIVERY_NEEDS_REVIEW events are never automatically resent; verify provider acceptance before resolving them. Only the existing QA allowlist is enabled.

KP admins see a banner across the staff application for emails delayed after three attempts, deliveries needing manual review, stale scheduler scans, missed workers, lost HTTP requests, and recorded worker HTTP failures. Links open each affected project's email controls. These are **KP alerts**, not separate alert emails; a provider outage cannot prevent this banner from showing. The banner updates on navigation/refresh.

## Rollout

The scheduler migration creates a disabled scheduler. The follow-up attempts to restrict pg_net; Supabase owns that extension, so these revocations do not change the hosted extension grants. The managed pg_net request queue retains PUBLIC SQL grants, so it must never be exposed through the Data API. Our private token table denies client reads and the scheduler RPCs deny browser roles. Tick credentials authorize only the fixed, allowlisted retry operation, expire after ten minutes and are single use. Hosted verification returned PGRST106 / HTTP 406 for the net schema; only public and graphql_public are exposed. Do not expose the net or private schema through the Data API. Deploy the tested worker commit before enabling it. Inspect notification control and confirm the approved project allowlist before activation. In KP's database:

```sql
begin;
update public.solta_email_scheduler set enabled=true where id='solta';
select cron.schedule('solta-email-retries','*/5 * * * *','select private.tick_solta_emails()');
commit;
```

No existing source events are backfilled. No staff project page should be opened during the hosted queue-recovery test because that page can also drain the queue. Prepare one new synthetic QA event, allow a cron tick to process it, then inspect the event lease, sent timestamp, scheduler completion, Solta receipt and Resend delivery. Replay must not send a second email. Never reset an accepted delivery to pending for this test.

Stop retries reversibly:

```sql
begin;
update public.solta_email_scheduler set enabled=false where id='solta';
select cron.unschedule('solta-email-retries');
commit;
```

Disabled ticks reject worker authorization. Existing queued events remain stored, and explicit project retries remain available. Monitor `last_scan_at`, `last_started_at`, `last_completed_at` and `error_code`; inspect pg_net response status by request ID without reading or logging Authorization headers. A worker failure leaves a lease that expires and can recover on the next eligible tick.

## Validation

24 isolated database checks cover role restrictions, disabled defaults, hashed credentials, single use, expiry, overlapping leases, guarded completion, disabled mappings/client updates, manual-review exclusion and HTTP failure recording. Three runtime tests cover token parsing and scheduler health thresholds. Run notification and scope regression checks plus the production build and scoped lint.

## Hosted QA — October 13, 2026

KP worker commit 4a1c0b8 was rebuilt in Production as 9hiXEERbdPT4soDSk2LT1FL7r3ND and assigned to kp-duty.vercel.app. Follow-up database fix 05d19b9 is applied. All 84 local checks passed (24 retry database, 3 health/token, 30 notification and 27 scope regressions), with scoped lint and the production build. Hosted missing/forged credentials returned 401; GET returned 405.

Scheduler job 2 is active at */5 * * * *, and notification controls still allow only QA project b7ab0318-2cf8-4b47-977e-1b97e581e538. The synthetic QA message 6714686e-8cc8-4455-a5a8-11c1abb15ea6 queued event 73cb3472-0f86-4c3d-8fdf-9c0234e35c6c. Its attempt counter was deliberately set to 3 to simulate a delayed event; no previous provider send was reset. The global KP admin warning appeared with the correct project link. No project page was opened during this recovery test.

The real Cron run began at 20:15:00 UTC, the worker began at 20:15:01, the event was marked sent at 20:15:03, and the worker completed at 20:15:04. The HTTP response was 200. Solta recorded exactly one recipient delivery, and Resend confirmed Delivered for provider email 01a136e7-8085-7c03-a852-5abef3796c52 to contact@soltaworks.com. A further scheduler tick produced no new network request or duplicate delivery. Pending events and active tick tokens returned to zero, and the KP warning cleared on refresh. No payment was created or charged. Completed release and QA tabs were closed.

Proof images: /private/tmp/solta-email-retry-warning-detail.png and /private/tmp/solta-automatic-retry-delivered.png. These temporary files are supporting evidence; the database delivery records remain the durable audit trail.
