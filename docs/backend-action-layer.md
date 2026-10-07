# KP Duty — Domain Action Layer

Status: **implemented; deployment pending**

KP Duty now uses one shared backend boundary for human UI actions and WebMCP Site Tools.

## Layers

```text
UI forms/buttons ─────┐
                      ├─> domain services ─> Supabase Auth/RLS ─> Postgres
WebMCP Site Tools ────┘                         │
                                               ├─ activity triggers
                                               └─ idempotency ledger
```

## Identity and permissions

- Every operation resolves the current Supabase session.
- `requireActiveIdentity()` rejects missing/disabled KP profiles.
- `requireAdminIdentity()` is required for cross-person task assignment and team-wide task reads.
- Ordinary task updates remain owner-scoped.
- CRM/project/decision collaboration follows the existing active-team RLS model.
- No Site Tool exposes hard delete, role changes, raw SQL, service-role access, deployment control, or secret management.

## Retry-safe creation

These operations use transactional request-key idempotency:

- create task
- create organization
- create person
- create opportunity
- create project
- create decision
- add note

The caller sends a stable `requestKey`.

The database:
1. namespaces the key by authenticated actor + source;
2. hashes the action payload;
3. atomically claims the key in `integration_action_requests`;
4. performs the domain insert in the same transaction;
5. stores a small replay result;
6. returns that result on a retry instead of inserting again.

Reusing a request key with different data fails.

If the transaction fails, the request claim rolls back with it.

## Activity

Existing task/opportunity/project/decision triggers keep actor attribution through `auth.uid()`.

The unified `add_note` action appends `note.added` events to `activity_events` for:

- task
- opportunity
- project
- organization
- person
- decision

Decision activity now has an explicit `decision_id` foreign key.

## Site Tool surface

### Read

- `get_my_work`
- `get_team_work` (admin)
- `get_team_members` (admin)
- `search_crm`
- `get_pipeline`
- `get_projects`
- `get_decisions`
- `get_recent_activity`

### Write

- `create_task`
- `complete_task`
- `update_task`
- `assign_task` (admin)
- `create_organization`
- `create_person`
- `create_opportunity`
- `update_opportunity`
- `create_project`
- `update_project`
- `create_decision`
- `update_decision_status`
- `resolve_decision`
- `add_note`

## Deliberately excluded

- hard deletes
- user/profile/role changes
- raw SQL
- arbitrary table CRUD
- credential or secret access
- integration queue writes
- Vercel/GitHub/Supabase administration

Those stay outside the conversational operational surface.
