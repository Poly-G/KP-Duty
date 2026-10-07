# KP Duty — Integration Contract

Status: **plumbing only; no live child-system integrations enabled**

KP Duty is the control plane. Solta, SnD, and Nex keep their detailed operational backends.

## Rule

Do not integrate a system because an API exists. Connect it only when a real workflow needs synchronization.

Before enabling an integration, document:

| Requirement | Required |
|---|---|
| Business purpose | Yes |
| Source system | Yes |
| Data read | Yes |
| Data written | Yes |
| Authentication method | Yes |
| Minimum scopes | Yes |
| Source of truth per field/state | Yes |
| Trigger / sync mode | Yes |
| Retry behavior | Yes |
| Idempotency behavior | Yes |
| Failure visibility | Yes |
| Secret storage | Yes |
| Audit events | Yes |
| Approval rule for consequential writes | Yes |
| Rollback / disable procedure | Yes |
| Privacy/security risk | Yes |

This carries forward the Integration Matrix + threat-model discipline from the Internal AI System.

## Stable record mapping

Use `external_links`.

A link maps:

```text
KP entity UUID
<-> source system + external record ID
```

Never synchronize by company/project display name when a stable ID exists.

## Versioned event envelope

Child systems eventually send events shaped like:

```json
{
  "event_id": "source-unique-id",
  "version": 1,
  "event_type": "v1.project.status_changed",
  "source_system": "solta",
  "occurred_at": "2026-10-07T03:00:00-07:00",
  "business_id": "optional-kp-business-uuid",
  "kp_entity": {
    "type": "project",
    "id": "kp-project-uuid"
  },
  "external_entity_id": "solta-project-id",
  "payload": {}
}
```

The TypeScript validator is `src/modules/integrations/event-envelope.ts`.

## Inbox

`inbox_events` persists events received from external systems before they are applied.

Required properties:
- unique event ID
- version
- source
- event type
- original occurrence time
- payload
- processing state
- attempts
- error
- processed timestamp

The unique `event_id` is the first idempotency boundary: a retry must not create a second logical event.

## Outbox

`outbox_events` is the transactional-outbox foundation for future events KP sends outward.

Application/domain logic will eventually:
1. change KP state;
2. insert the corresponding outbox row in the same database transaction;
3. let a dispatcher send/retry it later.

No message broker is required for V1.

## Retry-safe actions

`integration_action_requests` carries forward SnD's proven request-key pattern:

- unique request key
- actor
- source
- action
- request hash
- minimal safe replay result
- completion timestamp

Never store credentials, MFA codes, raw private tokens, or secret payloads in replay data.

## Current security posture

Human users can **read integration state**.

Only admins can configure `external_links`.

There are intentionally no ordinary authenticated write policies on:
- `inbox_events`
- `outbox_events`
- `integration_action_requests`

Those writes stay unavailable until a controlled integration worker/API boundary is implemented and approved.

## Initial event vocabulary

Planned examples:

- `v1.project.created`
- `v1.project.status_changed`
- `v1.project.completed`
- `v1.client.won`
- `v1.client.updated`
- `v1.opportunity.changed`
- `v1.payment.received`

Do not implement an event until a real integration requires it.

## First live integration later

Start with exactly one useful event, likely:

`Solta -> KP: v1.project.status_changed`

Prove authentication, mapping, retries, idempotency, failure visibility, auditability, and rollback before adding another integration.
