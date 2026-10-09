# Nex admin reconciliation for KP

Prepared October 8, 2026 PT from current Nex Notion decisions, acceptance tasks and KP repository main `3b4a2b3ac99661bcdc758c7b3f069d23688598f9`.

Status: repository handoff prepared. Live KP Work/Library/Decision records have **not** been read or updated in this reconciliation because the browser's admin-policy verification denied access. Do not treat this file as a completed live sync or assume it reflects post-migration KP operational changes. After access is restored, find existing records first and update them; avoid duplicate tasks or overwriting newer KP work.

## Authority and source records

- [Owner-approved KP admin decision](https://app.notion.com/p/3f48037fac73817a8d69cbcc022732ee): KP is the admin source of truth and sole admin workspace. Nex protects domain state and provides scoped services; customer workspaces stay Nex.
- [Product Specs](https://app.notion.com/p/3dd8037fac7381248b94fa71cc7d0f0a) and [Current Priorities](https://app.notion.com/p/3dd8037fac73810bb22acbdb6b2285c5): build Veteran/Provider backend and the KP admin connection first. Further lifecycle expansion last. Claude designs; ChatGPT engineers backend and implements frontend after design handoff with Poly.
- [TASK-132](https://app.notion.com/p/3e78037fac7381e4aa0be0dc8a805d3f): provider feed preparation is complete/inactive; producer, full admin connection and cross-account acceptance remain open.
- [Admin acceptance](https://app.notion.com/p/3ea8037fac73815f813cd5b3b0299556): staff, support, moderation and activity functional/security requirements remain V1 despite relocation into KP.
- KP's migrated Notion operating pages are backup/history. Live KP Work, Library and Decisions remain its working company home. This file is a transfer checklist, not a second task system.

## Verified completed work

| Work | Evidence and limit |
| --- | --- |
| KP provider CRM receiver and reviewed stable-ID links | KP PR #14 merged; never infer identity from email/name or grant Nex authority through CRM links. |
| KP seven-stage provider pipeline and schema-2 operating fields | KP PR #15 merged; schema-2 semantics still need producer alignment. |
| KP follow-up task mirror, request-only DNC/wrong-person/completion and reconciliation | KP PR #16 merged at `3b4a2b3`; prior Notion records document receiving-side deployment/QA. This turn has not reverified the live service. |
| Nex approved security/lifecycle foundation and first editorial activity backend | [Nex PR #100](https://github.com/Poly-G/NexProviders/pull/100) merged as `6de63a566127f9275618e49397b142333881c821`. All six CircleCI checks passed on `fa492a670b4a18df649c6c0ea4f77d7657d5a4f9`. The new private activity read API is not a finished KP connector; TASK-97 is partial. |

No current evidence accepts a live provider feed, broader admin connection, production Nex migrations or staff grants. Passing isolated code/database/browser checks does not establish hosted acceptance. Nex Vercel deployment was blocked; Supabase Preview was skipped at the merge checkpoint.

## V1 gap map and proposed KP work updates

Search KP for the existing Nex project, integration preparation task and engineering tasks before making these updates. Keep detailed domain backlog in Nex Notion; KP needs high-level owned work with next actions and source links. Do not mark the entire integration finished because receiving-side preparation is finished.

| Existing requirement | KP responsibility | Remaining backend/acceptance | Proposed next action |
| --- | --- | --- | --- |
| Admin workspace — TASK-93 | Use KP shell, queues, assignment and provider/admin operating views. | Protected reads/commands for editorial evidence, research, publication and authority. Current provider feed does not provide these. | Map the existing KP surfaces to Nex commands/read models; define the first provider editorial workflow and contract. |
| Staff — TASK-136 | Named staff lifecycle and administration in KP, reusable fixed capabilities. | Fresh mandatory MFA, live membership/capability and object checks, immediate offboarding, least delegation, last-owner safety and two-staff cross-account tests. Existing KP login is not proof of these bridge controls. | Inspect the current KP MFA/team implementation and design explicit capability mapping; provision no grants during preparation. |
| Activity — TASK-97 | Supervisor activity interface and operational oversight in KP. | Nex first slice records transactional editorial mutations; broader denial/read/export/support/moderation events, KP actor attribution, retention and alerts remain. | Connect a bounded metadata-only activity read after staff authorization is accepted; preserve KP and Nex actual actors/correlation. |
| Reviews — TASK-137/138 | Assigned human review/reply/report/appeal moderation in KP. | Version-specific decisions, publication/takedown/reinstatement, concurrency, separate payload deletion and restricted sensitive-content handling in Nex. | Build protected Nex review domain services and the KP moderation contract; keep raw content out of general CRM/logs. |
| Support — TASK-96 | Support operations through KP and controlled Nex customer views. | Target/reason/reference/expiry/revocation/read-only enforcement, MFA, analytics isolation and audit. Authorization flow remains undecided. | Preserve O1 as an owner decision; do not enable Support View or choose a grant flow through implementation. |
| Provider feed/linking — TASK-132 | Maintain existing immutable domain mappings, human work and request status. | Nex producer/retries/outcome validation/full-source comparison, schema alignment, retention/rights and integrated ten-organization tests. | Record receiver as prepared/inactive; build the scoped admin connection before further lifecycle expansion. |
| Veteran/Provider workspaces — TASK-27 | High-level engineering visibility; no ordinary CRM copy of private customer activity. | Customer authentication, organization/member boundaries and the complete documented customer workspaces remain Nex work. | Track the backend milestone with a link to Nex's detailed backlog; frontend follows Claude's design handoff. |

This is a recommended decomposition of existing requirements, not new product scope or permission approval. Exact record IDs, owners, task stages and edits must be established from live KP records before applying it.

## Ready-to-record KP project checkpoint

Nex is active. KP is its sole admin workspace and admin operational source of truth. Nex owns protected domain enforcement and the Veteran/Provider customer application. The approved backend stack and first transactional editorial activity slice are merged through Nex PR #100 with all six backend checks passing. KP receiving-side provider integration is prepared and inactive. The complete admin connection, customer workspace backend and hosted acceptance remain unfinished. Further lifecycle expansion is last; V2 marketplace begins after full V1 release acceptance.

## Ready-to-record Library correction

Preserve older company guides as history and add the dated owner correction: deliver Nex staff/admin operations in KP connected to scoped Nex services, rather than a separate Nex admin frontend. Existing mandatory MFA, live revocation, capability separation, object scope, privacy and audit requirements remain. KP login and CRM identity links alone do not authorize Nex operations. Do not turn the existing provider bearer token into a broad admin credential. `NEX_ADMIN_ORIGIN` is legacy compatibility, not the new admin connection.

Nex's D1–D12 brand/product decisions remain approved. In particular, published facts use one 90-day freshness window; UI evidence wording maps to existing backend states; a Vetted marker cannot be awarded until O2's checklist is confirmed. Do not change evidence states or award Vetted from CRM status. Preserve public independence, pricing disclaimers and links to free accredited help. Do not rewrite KP's company-wide brand to match Nex.

## Decisions and access that remain unchanged

- O1: Support View staff-start versus customer-approved grant is open.
- O2: Vetted checklist contents and field mapping are open.
- The new admin architecture does not grant Keshia or any other KP member Nex system/data access. Existing per-person restrictions remain until explicitly reviewed; no implicit expansion from KP membership.
- No PHI, clinical files, claim narratives, customer credentials or private Veteran payload in normal KP CRM, notes, notifications, integration logs or company Library.
- No production fixtures, new tokens, staff grants, Cron/email activation, provider feed activation or marketplace implementation in this reconciliation.

## Live application checklist after browser access is restored

1. Read current Nex-related KP Work, project, Library and Decisions records through the authorized KP interface. Reconcile newer changes before writing.
2. Add the owner-approved admin correction with the Notion source link to the relevant KP decision/history record; do not replace unrelated company decisions.
3. Update the existing Nex project checkpoint and integration task: receiving side prepared; complete connection pending. Preserve earlier completed preparation and its evidence.
4. Reconcile high-level engineering work using the gap map. Use existing tasks where possible, one accountable owner and a concrete next action; do not invent dates or auto-complete tasks.
5. Update the relevant Library guide with the dated correction and source links. Preserve historical guides rather than deleting them.
6. Verify each changed live record and record its stable KP ID plus outcome in Nex Notion. Do not report KP synchronized until these writes and read-back checks succeed.
