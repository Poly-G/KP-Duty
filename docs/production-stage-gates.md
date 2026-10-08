# Production gates

Staff-only client project controls now separate delivery start, visual production, build, QA, launch review, handoff and completion. Website: visual → build → QA → launch → handoff → complete. Branding: visual → QA → launch → handoff → complete. Less Office/Care/Sent: build → QA → launch → handoff → complete. Website projects without a branding add-on still record acceptance of the existing brand direction.

An admin records exact-version brand/copy approvals after internal and evidenced client deliverable reviews. QA uses an internally approved Launch / handoff package, records the applicable checklist/results, and snapshots all current project deliverable versions. Launch and handoff each need separate evidence, the same release package as the preceding approval, and client approval of that version. These are staff records of real responses, not client-authenticated signatures.

Approval snapshots bind to the current commercial scope and onboarding answers. New scope, changed answers, a newer referenced deliverable, a changed QA package inventory, or a renewed prerequisite invalidates dependent approvals. History stays append-only. Readiness, active owner/business/project and required payment evidence are checked before advancement. Steps cannot be skipped; earlier steps can be revisited. Generic project editor/API phase changes cannot bypass the recorded sequence, including while blocked. Completed projects must explicitly revisit a stage before reopening.

Only admins record production authority or advance. Other active staff may read history and continue their existing deliverable reviews. The initial authority matches existing Poly start approval; configurable delegation remains future work. Direct writes to gate/event tables are revoked. IDs make exact retries safe, current context rejects stale submissions, project/engagement locks serialize stage actions.

Existing started engagements retain their legacy behavior until a production approval or stage action enables gates permanently. New engagements and previously unstarted engagements get gates. Non-client internal projects are unchanged.

No action here publishes a deliverable, deploys a public website, sends notifications, charges Stripe or provisions a client login. Blocked stages do not prevent notes, file uploads or corrective work; they prevent advancing the managed delivery state. Final client sessions and actual production-form pilot are still required before client rollout.

Staff practice pages provide a visibly labeled, in-memory simulation. They save nothing and do not substitute for database permission/workflow tests. Backup includes both gate and stage history.
