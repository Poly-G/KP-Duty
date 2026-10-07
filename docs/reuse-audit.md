# KP Duty — Full Reuse Audit

Status: **locked pre-build reuse map**

Reviewed sources:

1. `Poly-G/SnD` — private internal Sent & Delivered application
2. `marmelab/atomic-crm` — MIT-licensed open-source CRM
3. `Poly-G/Internal-Ai-System` — private architecture/security research

## Executive decision

KP Duty is **not** a fork of SnD, Atomic CRM, or Internal AI System.

It is a new application that selectively reuses the strongest proven parts of all three:

- **SnD contributes operating behavior and proven workflow semantics.**
- **Atomic CRM contributes commodity CRM implementation patterns and selected reusable code.**
- **Internal AI System contributes security, isolation, integration, audit, and reliability invariants.**

The final product keeps the calm Notion/Trello/SnD interaction model and deliberately rejects Atomic's dense all-purpose CRM UI.

---

# 1. SnD reuse audit

## 1.1 Reuse directly or very closely

### Explicit next-action model

Source examples:
- `engagements.next_action`
- `engagements.next_action_due_at`
- `next_action_owner_type`
- Command Center shaping in `api/_ops-dashboard-store.js`

**KP Duty decision:** reuse the concept as a first-class invariant.

Every actionable work/relationship/project record that needs a human follow-up should be able to answer:
- what happens next?
- who owns the next move?
- when is it due?
- is it actionable now?

This is more important than a generic "status" field.

### Separate execution state from dependency/availability

SnD already distinguishes:
- `not_started`
- `in_progress`
- `waiting`
- `blocked`
- `complete`
- `not_applicable`

KP Duty will simplify the visible work stage to:
- **To Do**
- **Working**
- **Finished**

and keep availability/dependency separately:
- **Yes**
- **Waiting on Poly / another owner**
- **Blocked**
- **Parked**

This preserves the useful SnD state model while making the UI simpler.

### Stable staff identity tied to authentication

Source:
- `staff_users`
- `auth_subject`
- audit identity migration `003_ops_staff_identity.sql`

**KP Duty decision:** reuse the identity separation pattern, but implement it with Supabase Auth:

`auth.users.id -> profiles.id`

Poly and Keshia each get separate identities. All meaningful writes remain attributable.

### Idempotent consequential mutations

Source:
- `db/migrations/005_ops_action_idempotency.sql`
- unique `request_key`
- request hash
- replay-safe result reference

**KP Duty decision:** carry this pattern into:
- integration event ingestion
- future MCP writes where retries are possible
- external sync actions
- any consequential API mutation that may be retried

We will not require idempotency plumbing on every trivial UI edit, but integration/API boundaries will support it.

### Derived attention state

Source:
- `shapeOpsDashboard`
- overdue next action detection
- waiting state
- risk/guardrail alerts
- dashboard tests

**KP Duty decision:** reuse the **attention-engine principle**, not SnD's business-specific rules.

Home should derive:
- working now
- actionable next
- overdue
- waiting on the current user
- blocked
- recently changed

from durable state.

The Home page must not become a manually curated second task list.

### Project/engagement reconciliation idea

Source:
- `api/_project-state.js`
- milestone-driven reconciliation

**KP Duty decision:** adapt later for high-level project mirrors.

If a child business backend eventually sends milestone/project state, KP can derive the central phase/next milestone instead of requiring duplicated manual status edits.

### Security-conscious dashboard shaping

Source:
- tests asserting dashboard output does not expose passwords/API tokens
- private workspace behavior
- `noindex` / `nofollow` internal layout

**KP Duty decision:** reuse:
- private/noindex posture
- explicit safe output shaping
- tests that sensitive fields never reach client summaries

---

## 1.2 Reuse as behavior, not code

### SnD Command Center UX

Source:
- `src/pages/ops.astro`
- view copy: "Decisions, active client work, and what needs attention next."

**Reuse:** the attention-first information architecture.

**Do not copy:** the 239k-line-style monolithic ops page implementation or Astro structure.

KP Duty will reproduce the good interaction model in modular React/Next.js components.

### Engagement model

SnD's:
- clients
- contacts
- engagements
- engagement contacts
- milestones
- documents

proved relational project/client modeling.

KP Duty will borrow those relational ideas but generalize them into:
- organizations
- people
- relationships
- opportunities
- projects
- activity

SnD's lifecycle-specific scope/SOW/change/QA structures remain SnD-owned.

---

## 1.3 Explicitly reject from SnD

### Shared admin password/session auth

Source:
- `api/_ops-auth.js`

Reason:
- single shared identity
- cannot cleanly distinguish Poly vs Keshia
- poor fit for future team growth
- poor fit for per-user MCP authorization

**Replacement:** Supabase Auth + individual profiles + RLS.

### SnD-specific delivery tables

Do not copy into KP Duty:
- scope versions
- engagement plans
- SOW snapshots/signing
- invoices
- lifecycle focus
- measurement plans
- access grants
- change QA
- delivery-specific approvals
- detailed closeout
- SnD-specific intake flows

Those belong in SnD.

KP Duty should link/mirror only the high-level state.

### Astro frontend stack

KP Duty stays Next.js/React/TypeScript.

---

# 2. Atomic CRM reuse audit

Atomic CRM is MIT licensed and can legally be copied/modified with its copyright + permission notice preserved for substantial reused portions.

Atomic is treated as a **CRM parts library**, not as KP Duty's product UI.

## 2.1 Data-model patterns to reuse

### Companies

Source:
- `public.companies`

Reusable concepts:
- company name
- website/domain
- phone
- location/address
- description
- owner/account manager
- timestamps
- archive state / metadata

**KP Duty changes:**
- use UUID primary keys, not bigint identity
- call entity `organizations` so it can represent companies/providers/other orgs
- keep one canonical org across Solta/SnD/Nex
- add normalized relationship tables instead of business-specific duplication

### Contacts / people

Source:
- `public.contacts`

Reusable concepts:
- person identity separate from company
- title
- email(s)
- phone(s)
- LinkedIn
- owner
- status
- tags
- first/last activity metadata

**KP Duty changes:**
- entity becomes `people`
- UUID keys
- company/org link can change without destroying relationship history
- relationship to businesses is modeled separately
- tags should use join tables rather than storing raw bigint arrays

### Deals -> opportunities

Source:
- `public.deals`

Reusable concepts:
- name
- company relation
- stage
- amount/value
- expected close
- owner
- order/index for Kanban
- archive state

**KP Duty changes:**
- entity becomes `opportunities`
- add `business_id`
- add `pipeline_id`
- stages come from `pipeline_stages`, not one global config
- contacts use an `opportunity_people` join table rather than an array column
- next action/date are first-class

### User/profile mapping

Source:
- `sales.user_id -> auth.users.id`

**KP Duty decision:** reuse the concept as:
- `profiles.id -> auth.users.id`
- role
- display name
- active/disabled state

Do not copy the sales-rep terminology.

---

## 2.2 UI behavior to reuse

### One-click task completion

Source:
- `Task.tsx`
- checkbox updates `done_date`
- recently completed tasks can remain briefly visible
- undoable deletion/update patterns

**KP Duty decision:** reuse the interaction:
- check/complete quickly
- optimistic response
- finished item disappears from normal work view
- short undo opportunity where practical

Do not reuse Atomic's full task list UI.

### Task date grouping

Source:
- `TasksListByDueDate.tsx`

Useful categories:
- overdue
- today
- tomorrow
- this week
- later

**KP Duty decision:** reuse this as a secondary agenda/list view, not the primary Work board.

### Kanban drag/drop behavior

Source:
- `DealListContent.tsx`
- stage-grouped records
- card ordering
- optimistic local move
- persisted stage/index updates

**KP Duty decision:** reuse the behavior and algorithmic lessons.

**Implementation change:**
- use `dnd-kit` in KP Duty
- use a server-side transaction/RPC for stage + ordering when possible
- avoid Atomic's many independent client writes for reindexing a whole column
- stage move also appends a KP activity event

### Record detail with contextual information

Source:
- `DealShow.tsx`
- `CompanyShow.tsx`
- `ContactShow.tsx`
- notes/tasks tied to records

**KP Duty decision:** reuse the concept, but redesign the UI radically.

KP record detail should open as a side sheet and expose:
1. current state / next action
2. activity
3. related people/opportunities/projects
4. collapsed "more details"

Do not carry over Atomic's dense multi-section record pages.

### Infinite activity timeline

Source:
- `ActivityLog.tsx`
- pageable `activity_log` view

**KP Duty decision:** reuse infinite/paginated activity UX.

Data implementation will be improved: KP will maintain an explicit append-oriented activity/event table rather than reconstructing all history only through a UNION view.

### Import/export

Source:
- data import context
- resource-specific CSV parsing
- company resolver
- deal index assignment
- bulk export hooks

**KP Duty decision:** reuse/adapt these patterns primarily for **Gate F Airtable migration** and later admin import/export.

Direct-copy candidates after adaptation:
- cell parsing helpers
- row-by-row import error handling
- company/org resolver pattern
- sample CSV approach

---

## 2.3 MCP implementation to reuse heavily

This is Atomic's most valuable code contribution.

Source:
- `supabase/functions/mcp/index.ts`
- `supabase/functions/mcp/validateSql.ts`
- JWT validation
- MCP OAuth protected resource metadata
- Streamable HTTP transport
- RLS-aware DB execution
- MCP App task list resource
- idempotent `complete_task` tool

### Reuse closely

- stateless Supabase Edge Function MCP server pattern
- Supabase JWT/JWKS validation
- OAuth protected-resource metadata pattern
- RLS impersonation via authenticated JWT claims
- Streamable HTTP MCP transport
- MCP App resource pattern for visual task lists
- read/write tool annotations
- idempotent task completion semantics

### Do NOT expose Atomic's generic raw SQL mutation tool to normal KP users

Atomic exposes:
- `query(sql)`
- `mutate(sql)`

Even with AST validation + RLS, KP Duty should have a smaller domain tool surface:

- `get_my_work`
- `search_crm`
- `get_organization`
- `get_opportunity`
- `move_opportunity`
- `log_activity`
- `create_followup`
- `complete_task`
- `get_project_summary`

This is easier to audit, safer for Keshia's Chat, and prevents accidental broad DB mutations.

### SQL validator

`validateSql.ts` is a good MIT-licensed implementation if we later retain a restricted admin/developer SQL MCP tool.

For ordinary user-facing MCP, it is unnecessary because domain tools are preferable.

---

## 2.4 Database mechanisms to adapt

### Activity log aggregation

Atomic's `activity_log` view aggregates:
- company created
- contact created
- notes
- deals
- deal notes

Useful idea: one chronological stream.

KP Duty improvement:
- explicit `activity_events` table
- actor
- source
- entity references
- event type
- summary
- metadata
- occurred_at

This supports stage changes, tasks, project sync events, future email summaries, and external-system events cleanly.

### Summary views

Atomic's:
- `companies_summary`
- `contacts_summary`

are useful read-optimized patterns.

KP Duty can add summary/database views only when a real UI/API query benefits from them.

Do not prematurely duplicate every table as a view.

### Triggers

Useful patterns:
- auto-sync auth user to app profile
- normalize fields
- update last-seen/activity metadata

KP Duty will use triggers sparingly for durable invariants, not for product/business logic that belongs in services.

---

## 2.5 Explicitly reject from Atomic

### Atomic's overall UI

Poly explicitly dislikes it.

Do not reuse:
- its app shell/layout density
- dashboard composition
- crowded forms
- full CRM screen hierarchy
- its visual information density

### react-admin / ra-core as KP's application framework

Atomic relies heavily on `ra-core`.

KP Duty should **not** adopt it because:
- it encourages generalized CRUD screens
- KP needs a highly opinionated, low-density workflow
- it adds abstraction around Next.js/App Router patterns we do not need
- it makes the app feel more like a generic CRM

We can copy small MIT-licensed logic utilities without adopting react-admin.

### Single global deal-stage configuration

Atomic stores configurable deal stages globally.

Reject for KP because Solta, SnD, and Nex require different pipelines.

Use:
- `pipelines`
- `pipeline_stages`

as normalized data.

### Broad "every authenticated user can CRUD everything" RLS

Atomic's default policies broadly allow authenticated users to select/insert/update/delete CRM tables.

Reject directly.

KP Duty uses:
- active profile check
- role checks
- business/resource policies where needed
- deny-by-default philosophy

### Bigint identities

Reject.

KP needs stable cross-system identifiers, so core entities use UUIDs.

### Contact/deal arrays for relationships

Reject:
- `contact_ids bigint[]`
- tag ID arrays

Use normalized join tables for relationships that matter.

### Auto-fetch avatars/favicons in database triggers

Not V1.

Network calls from DB triggers add latency/failure modes and are not needed to make KP operational.

### Separate note tables per entity

Atomic uses `contact_notes` and `deal_notes`.

KP Duty will favor a unified note/activity model with explicit entity relationships.

---

# 3. Internal AI System reuse audit

Internal AI System is primarily architecture/process evidence, not production app code.

Its strongest contribution is **guardrails**.

## 3.1 Reuse as architecture invariants

### Business scoping

Source invariant:
> Every durable business record is business-scoped.

KP refinement:
- entities that are truly cross-KP (organization/person identity) remain global to KP
- business-specific relationship/opportunity/project records require explicit `business_id`

Never infer business scope from a page/view.

### Credentials never stored in app records

Reuse exactly.

KP Duty application records may contain:
- credential reference label
- system name
- access state

They may not contain:
- passwords
- API tokens
- MFA/recovery codes
- raw secrets

Secrets stay in Bitwarden/deployment secret stores.

### Deny-by-default permissions

Reuse exactly as a principle.

Gate A:
- individual user auth
- active/disabled profiles
- admin/team_member technical roles
- RLS enabled from first migration

Later permissions only become more specific when there is an operational need.

### Auditability

Reuse:
- actor
- source
- entity
- action
- timestamp
- material before/after context where appropriate

Human-readable business activity and technical audit are separate concepts.

### Idempotency

Source:
> Retries cannot duplicate consequential actions.

Reuse for:
- inbound events
- outbound events
- MCP/external mutations
- external communications/integrations later

### Integration matrix

Reuse the planning template before connecting each child business or external service.

Every integration must document:
- purpose
- data read
- data written
- auth
- minimum scope
- trigger/sync mode
- failure handling
- secret storage
- audit events
- approval rule
- privacy/security risks

### Threat model

Reuse relevant threats:
- cross-business leakage
- credential blast radius
- untrusted external content
- unauthorized external writes
- silent integration failure

### Recovery requirements

Reuse:
- retry policy
- idempotency
- timeout behavior
- backup/restore awareness
- connector revocation
- failure visibility

### Evaluation/test categories

Reuse:
- deterministic unit/contract tests
- permission tests
- business-isolation tests
- retry/idempotency tests
- regression tests
- human acceptance testing

---

## 3.2 Explicitly reject/defer from Internal AI System

Do not bring into KP Duty V1:
- agent orchestration runtime
- multi-agent architecture
- model routing
- model token/cost accounting
- agent knowledge snapshots
- run/step/tool-call execution tables
- evaluation harness for AI outputs
- complex approval machinery around normal internal CRUD

Those belong to a future AI automation layer only if real usage requires them.

KP Duty must work completely without an AI agent.

---

# 4. Final feature-by-feature source map

| KP Duty capability | Primary source | Reuse decision |
|---|---|---|
| Home / attention surface | **SnD** | Adapt Command Center attention/next-action model |
| Work stages | **SnD + Atomic** | SnD state semantics + Atomic quick-complete interaction |
| Work card UI | **New KP UI** | Not copied; Trello/Notion-inspired |
| Task completion / hide finished | **Atomic** | Reuse behavior, implement in KP design |
| Next action + owner | **SnD** | Reuse strongly |
| Separate Poly/Keshia identity | **Atomic + SnD** | Supabase auth-profile mapping; reject shared SnD password |
| Roles/RLS | **Internal AI + Atomic/Supabase** | Internal AI deny-by-default; custom RLS |
| Organizations | **Atomic** | Adapt companies table, UUID/global KP identity |
| People | **Atomic** | Adapt contacts table |
| Business relationships | **New KP model** | Not present cleanly in sources |
| Opportunities | **Atomic + SnD** | Atomic deal basics + SnD next-action/owner semantics |
| Pipelines/stages | **Atomic behavior, new schema** | Trello board behavior; normalized per-business pipelines |
| Kanban drag/drop | **Atomic** | Adapt optimistic move/reorder; use dnd-kit + transactional server update |
| Notes/activity timeline | **Atomic + SnD** | Unified explicit activity/event table |
| Record detail | **Atomic concept + KP UI** | Related notes/tasks/data, but much calmer side sheet |
| CRM import/export | **Atomic** | Reuse/adapt parsers/resolvers for migration/admin use |
| High-level project mirror | **SnD** | Adapt engagement/milestone concepts |
| Stable external links | **Internal AI + new** | Explicit integration mapping |
| Integration events | **Internal AI + SnD** | Integration matrix + SnD idempotency lessons |
| Idempotency store | **SnD** | Reuse schema pattern |
| Technical audit | **Internal AI + SnD** | New KP audit table following invariants |
| MCP transport/auth | **Atomic** | Reuse heavily |
| MCP tools | **New KP layer** | Domain-specific tools; reject generic raw SQL for normal users |
| MCP visual task UI | **Atomic** | Reuse/adapt later if useful |
| Security/threat model | **Internal AI** | Reuse framework |
| UI primitives | **shadcn upstream** | Do not copy Atomic's styling wholesale |
| App framework | **New KP** | Next.js App Router, not Astro or react-admin |
| File storage | **Current KP architecture** | Drive references, not Atomic storage duplication |
| Secrets | **Internal AI / KP rules** | Bitwarden + deployment secrets |

---

# 5. Direct-copy candidates vs adaptation candidates

## Direct-copy candidates from Atomic (MIT), after compatibility review

Potentially copy with attribution:
- MCP JWT/JWKS auth helper
- OAuth protected-resource metadata pattern
- MCP streamable HTTP server setup
- `validateSql.ts` if a restricted admin SQL tool is retained
- CSV cell parsing utilities
- import batch/error helpers
- company resolver logic
- selected small pure utilities

If substantial Atomic code is copied, preserve the MIT copyright/permission notice in `THIRD_PARTY_NOTICES.md`.

## Adapt, do not directly copy

From Atomic:
- deal Kanban move/reorder logic
- task quick-complete behavior
- activity timeline pagination
- record relationship display

From SnD:
- Command Center shaping
- milestone/project state reconciliation
- attention derivation
- next-action semantics
- ops idempotency design

From Internal AI:
- permission matrix
- integration matrix
- threat model
- recovery/test requirements

---

# 6. New code that KP Duty genuinely needs

These are not solved correctly by any source:

- calm KP-specific Home
- Trello/Notion-style Work UI
- `businesses`
- canonical `organizations` shared across businesses
- `relationships`
- per-business `pipelines` + `pipeline_stages`
- normalized `opportunity_people`
- high-level `projects` mirror
- `external_links`
- `inbox_events`
- `outbox_events`
- unified `activity_events`
- technical `audit_events`
- domain service layer shared by UI/API/MCP
- KP-specific domain MCP tools
- Airtable migration mapping

---

# 7. Build rule after this audit

Before implementing any cross-cutting KP Duty capability:

1. Check SnD for proven operational behavior.
2. Check Atomic for commodity CRM implementation.
3. Check Internal AI System for security/integration invariants.
4. Reuse directly only when the source matches KP's architecture and UX.
5. Prefer adaptation over importing a framework that would dictate the product.
6. Record substantial third-party copied code in `THIRD_PARTY_NOTICES.md`.
7. Never import business-specific detail into KP merely because code already exists.

This audit is the reuse authority for Gate A onward.
