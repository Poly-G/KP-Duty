# KP Duty Site Tools (WebMCP)

Status: **proof of concept**

KP Duty exposes a small WebMCP surface from the authenticated application shell so ChatGPT's built-in browser can use the same live session, permissions, and domain logic as the human UI.

## Architecture

```text
KP UI buttons ───────┐
                     ├─> existing KP server/domain actions ─> Supabase Auth/RLS ─> Postgres
WebMCP site tools ───┘
```

There is no service-role key in the browser and no second AI-specific authorization system.

Site tools are mounted only from the protected `(app)` layout after KP Duty has confirmed that the current user has an active profile.

## POC tools

### `get_my_work`

Read-only.

Returns a deliberately shaped view of the current user's KP work:

- task ID / reference code
- title
- stage
- availability
- priority
- due date
- next action
- business

It intentionally does not expose task notes, instructions, credentials, secrets, or unrelated application data.

### `complete_task`

Write action.

Accepts exactly one task UUID and calls KP's existing `completeTask()` action.

The existing mutation boundary:

- validates the UUID;
- identifies the current Supabase user from the signed-in session;
- restricts the update to `owner_id = current user`;
- returns the updated task so the agent can verify success;
- lets the database set `updated_by` / `finished_at`;
- lets the existing activity trigger record the authenticated actor;
- does not duplicate a stage-change activity event if the same completion is retried.

## Browser registration

Tools are registered through the current imperative WebMCP API:

```ts
document.modelContext.registerTool(...)
```

An `AbortController` owns both registrations so React can unregister them when the protected shell unmounts.

The registration is feature-detected and becomes a no-op in browsers without WebMCP support. KP Duty remains fully usable without an agent.

## Initial acceptance test

Run this only after a deployment supports Site Tools.

1. Sign in to KP Duty as Keshia in ChatGPT desktop's built-in browser.
2. Confirm the browser lists `get_my_work` and `complete_task`.
3. Ask: "What are my open KP tasks?"
4. Confirm the agent calls `get_my_work` and returns only the work visible to Keshia.
5. Ask it to finish one of Keshia's tasks.
6. Confirm `complete_task` returns the changed task with `stage = finished`.
7. Refresh/open Work and confirm the task is finished.
8. Confirm Recent Activity attributes the change to Keshia.
9. Attempt to pass a Poly-owned task ID from Keshia's session. The write must fail as not found/not permitted.
10. Retry the already-finished Keshia task. It may return the current finished state, but it must not create a duplicate stage-change activity event.

Repeat the same test under Poly's session.

## Deferred tools

Do not add these until the two-tool POC passes end to end:

- `move_task`
- `get_pipeline`
- `move_opportunity`
- `get_projects`
- `set_project_status`
- `create_task`
- `create_opportunity`
- `add_note`

Create operations need an explicit retry/idempotency boundary before exposure.

## Future MCP server

WebMCP is the first ChatGPT transport because it reuses the open page and signed-in KP session.

A normal MCP server can be added later for page-independent access. Both transports should call the same KP domain layer rather than maintain separate business logic.
