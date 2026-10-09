/** V1 transport preparation. Nex must accept these task kinds and outcome codes. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function recordId(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new Error("Invalid Nex record ID");
  return value.toLowerCase();
}
function exact(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Reflect.ownKeys(value).length !== keys.length || Reflect.ownKeys(value).some(k => typeof k !== "string" || !keys.includes(k))) throw new Error("Invalid Nex operation");
  return value as Record<string, unknown>;
}
function timestamp(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) throw new Error("Invalid Nex date");
  return value;
}
function choice<T extends string>(v: unknown, values: readonly T[]): T {
  if (typeof v !== "string" || !values.includes(v as T)) throw new Error("Invalid Nex value");
  return v as T;
}
export function parseTaskEnvelope(value: unknown) {
  const e = exact(value, ["schemaVersion", "source", "target", "entityType", "eventType", "eventId", "occurredAt", "payload"]);
  if (e.schemaVersion !== 1 || e.source !== "nexproviders" || e.target !== "kp" || e.entityType !== "provider_follow_up" || e.eventType !== "task_snapshot") throw new Error("Invalid Nex task envelope");
  const p = exact(e.payload, ["organizationId", "attemptId", "contactId", "taskId", "revision", "kind", "state", "dueAt", "resolvedAt"]);
  if (!Number.isSafeInteger(p.revision) || (p.revision as number) < 1) throw new Error("Invalid Nex revision");
  const state = choice(p.state, ["open", "completed", "cancelled"] as const);
  const occurredAt = timestamp(e.occurredAt);
  const resolvedAt = p.resolvedAt === null ? null : timestamp(p.resolvedAt);
  if ((state === "open") !== (resolvedAt === null) || (resolvedAt && resolvedAt > occurredAt)) throw new Error("Invalid Nex task state");
  return {
    schemaVersion: 1 as const, source: "nexproviders" as const, target: "kp" as const, entityType: "provider_follow_up" as const, eventType: "task_snapshot" as const,
    eventId: recordId(e.eventId), occurredAt,
    payload: { organizationId: recordId(p.organizationId), attemptId: recordId(p.attemptId), contactId: p.contactId === null ? null : recordId(p.contactId), taskId: recordId(p.taskId), revision: p.revision as number,
      kind: choice(p.kind, ["follow_up", "verify_representation", "complete_profile", "review_stall"] as const), state, dueAt: p.dueAt === null ? null : timestamp(p.dueAt), resolvedAt },
  };
}
export function parseRequestOutcome(value: unknown) {
  const p = exact(value, ["requestId", "status", "code"]);
  const status = choice(p.status, ["accepted", "rejected"] as const);
  const code = choice(p.code, ["applied", "already_applied", "stale", "not_allowed", "inactive_record"] as const);
  if ((status === "accepted") !== ["applied", "already_applied"].includes(code)) throw new Error("Invalid Nex outcome");
  return { requestId: recordId(p.requestId), status, code };
}
export function parseCursor(request: Request): string | null {
  const params = new URL(request.url).searchParams;
  if ([...params.keys()].some(k => k !== "after") || params.getAll("after").length > 1) throw new Error("Invalid cursor");
  return params.has("after") ? recordId(params.get("after")) : null;
}
