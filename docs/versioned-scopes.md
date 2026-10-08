# Versioned scope approvals

Client projects now keep immutable scope snapshots covering deliverables/acceptance criteria, exclusions/client responsibilities, commercial terms, timing/dependencies/revision limits, and the reason for the version.

An admin records the actual client approver's name/email and response evidence for the current version, confirming that exact version in the site. This is a staff record of approval received elsewhere, not a client e-signature. No approval email is sent. Client authentication remains the final slice.

Saving a revision resets scope readiness. Earlier versions and their approval evidence remain visible. Admin-only database functions serialize versions, reject stale saves, and make exact retries safe. Direct table mutation is revoked; active staff can read the history, disabled and anonymous users cannot.

New projects and previously unstarted projects require a current approved version to start. Existing starts retain their earlier approval until a scope version is prepared. That enables the new requirement permanently. Generic project phase/status advancement to active/complete also checks the latest scope, preventing the old project editor/API from bypassing this requirement.

This slice does not yet implement separate brand-direction, copy, QA, launch, or handoff stage approvals, or prevent every individual task/file edit while a revised scope awaits approval. Those production gates remain separate work. Scope changes do not silently rewrite onboarding answers; onboarding is reviewed independently.

The admin backup includes scope versions and approval evidence. Stripe remains a placeholder.
