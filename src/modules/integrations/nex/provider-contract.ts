/** Preparation only: the future authenticated Nex producer supplies this snapshot. */
export const KP_PROVIDER_SCHEMA_VERSION = 1 as const;

export type ProviderSnapshot = Readonly<{
  organizationId: string;
  contactId: string | null;
  attemptId: string;
  revision: number;
  admission: "approved_preview" | "inbound_claim";
  listingReadiness: "in_research" | "preview_ready" | "decision_ready";
  representation: "unrepresented" | "claim_pending" | "verified";
  disposition: "active" | "closed" | "merged";
  mergedIntoOrganizationId: string | null;
  onboardingPhase: "ready_for_outreach" | "outreach" | "responded" | "verifying" | "completing" | "onboarded" | "not_onboarded";
  onboardedAt: string | null;
  contactStatus: "contactable" | "dnc" | "wrong_person" | null;
  organizationNoContact: boolean;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEYS: readonly (keyof ProviderSnapshot)[] = [
  "organizationId", "contactId", "attemptId", "revision", "admission",
  "listingReadiness", "representation", "disposition", "mergedIntoOrganizationId",
  "onboardingPhase", "onboardedAt", "contactStatus", "organizationNoContact",
];

function invalid(): never {
  // Never reflect incoming data into logs/errors.
  throw new Error("Invalid KP provider snapshot");
}

function id(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) return invalid();
  return value.toLowerCase();
}

function choice<T extends string>(value: unknown, values: readonly T[]): T {
  if (typeof value !== "string" || !values.includes(value as T)) return invalid();
  return value as T;
}

function timestamp(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return invalid();
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) return invalid();
  return value;
}

/** No free text, Veteran records, auth IDs, evidence documents or arbitrary metadata. */
export function parseProviderSnapshot(value: unknown): ProviderSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  const input = value as Record<string, unknown>;
  const ownKeys = Reflect.ownKeys(input);
  if (ownKeys.length !== KEYS.length || ownKeys.some((key) => typeof key !== "string" || !KEYS.includes(key as keyof ProviderSnapshot))) return invalid();
  if (!Number.isSafeInteger(input.revision) || (input.revision as number) < 1) return invalid();
  if (typeof input.organizationNoContact !== "boolean") return invalid();

  const snapshot: ProviderSnapshot = {
    organizationId: id(input.organizationId),
    contactId: input.contactId === null ? null : id(input.contactId),
    attemptId: id(input.attemptId),
    revision: input.revision as number,
    admission: choice(input.admission, ["approved_preview", "inbound_claim"]),
    listingReadiness: choice(input.listingReadiness, ["in_research", "preview_ready", "decision_ready"]),
    representation: choice(input.representation, ["unrepresented", "claim_pending", "verified"]),
    disposition: choice(input.disposition, ["active", "closed", "merged"]),
    mergedIntoOrganizationId: input.mergedIntoOrganizationId === null ? null : id(input.mergedIntoOrganizationId),
    onboardingPhase: choice(input.onboardingPhase, ["ready_for_outreach", "outreach", "responded", "verifying", "completing", "onboarded", "not_onboarded"]),
    onboardedAt: timestamp(input.onboardedAt),
    contactStatus: input.contactStatus === null ? null : choice(input.contactStatus, ["contactable", "dnc", "wrong_person"] as const),
    organizationNoContact: input.organizationNoContact,
  };
  if ((snapshot.contactId === null) !== (snapshot.contactStatus === null)) return invalid();
  if ((snapshot.disposition === "merged") !== (snapshot.mergedIntoOrganizationId !== null)) return invalid();
  if (snapshot.organizationId === snapshot.mergedIntoOrganizationId) return invalid();
  // Admission is historical. Readiness can regress after the approved intake.
  // Terminal success is retained even when readiness subsequently regresses.
  if ((snapshot.onboardingPhase === "onboarded") !== (snapshot.onboardedAt !== null)) return invalid();
  return Object.freeze(snapshot);
}

export function prepareProviderEnvelope(eventId: string, occurredAt: Date, value: unknown) {
  if (!(occurredAt instanceof Date) || !Number.isFinite(occurredAt.getTime())) return invalid();
  return Object.freeze({
    schemaVersion: KP_PROVIDER_SCHEMA_VERSION,
    source: "nexproviders" as const,
    target: "kp" as const,
    entityType: "provider_onboarding_attempt" as const,
    eventType: "provider_snapshot" as const,
    eventId: id(eventId),
    occurredAt: occurredAt.toISOString(),
    payload: parseProviderSnapshot(value),
  });
}

export function parseProviderEnvelope(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  const input = value as Record<string, unknown>;
  const keys = ["schemaVersion", "source", "target", "entityType", "eventType", "eventId", "occurredAt", "payload"];
  if (Reflect.ownKeys(input).length !== keys.length || Reflect.ownKeys(input).some(key => typeof key !== "string" || !keys.includes(key))) return invalid();
  if (![1, 2].includes(input.schemaVersion as number) || input.source !== "nexproviders" || input.target !== "kp" || input.entityType !== "provider_onboarding_attempt" || input.eventType !== "provider_snapshot") return invalid();
  const at = timestamp(input.occurredAt);
  if (!at) return invalid();
  if (input.schemaVersion === 1) return prepareProviderEnvelope(id(input.eventId), new Date(at), input.payload);
  if (!input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)) return invalid();
  const { operations, ...base } = input.payload as Record<string, unknown>;
  const prepared = prepareProviderEnvelope(id(input.eventId), new Date(at), base);
  return Object.freeze({ ...prepared, schemaVersion: 2 as const, payload: Object.freeze({ ...prepared.payload, operations: parseProviderOperations(operations) }) });
}

/** Eligibility only; this neither schedules nor authorizes a send. */
export function isProviderOutboundEligible(snapshot: ProviderSnapshot): boolean {
  const checked = parseProviderSnapshot(snapshot);
  return checked.disposition === "active" && !checked.organizationNoContact &&
    checked.contactStatus === "contactable" && checked.listingReadiness !== "in_research" &&
    checked.onboardingPhase !== "onboarded" && checked.onboardingPhase !== "not_onboarded";
}

/** KP preparation contract; Nex must accept its field semantics before enabling v2. */
export type ProviderOperations = Readonly<{
  outreachStatus: "not_eligible" | "ready" | "active" | "responded" | "paused" | "ended";
  endReason: "completed" | "no_response" | "declined" | "contact_stop" | "organization_stop" | "organization_closed" | "organization_merged" | "superseded" | null;
  stalled: boolean;
  stallPhase: "outreach" | "responded" | "verifying" | "completing" | null;
  stalledSince: string | null;
  lastTouchAt: string | null;
  nextActionDueAt: string | null;
  openedAt: string;
  closedAt: string | null;
  attemptNumber: number;
  rulesVersion: number;
  asOfAt: string;
}>;

export function parseProviderOperations(value: unknown): ProviderOperations {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  const p = value as Record<string, unknown>;
  const keys = ["outreachStatus", "endReason", "stalled", "stallPhase", "stalledSince", "lastTouchAt", "nextActionDueAt", "openedAt", "closedAt", "attemptNumber", "rulesVersion", "asOfAt"];
  if (Reflect.ownKeys(p).length !== keys.length || Reflect.ownKeys(p).some(k => typeof k !== "string" || !keys.includes(k))) return invalid();
  for (const key of ["attemptNumber", "rulesVersion"]) if (!Number.isSafeInteger(p[key]) || (p[key] as number) < 1) return invalid();
  if (typeof p.stalled !== "boolean") return invalid();
  const result: ProviderOperations = {
    outreachStatus: choice(p.outreachStatus, ["not_eligible", "ready", "active", "responded", "paused", "ended"]),
    endReason: p.endReason === null ? null : choice(p.endReason, ["completed", "no_response", "declined", "contact_stop", "organization_stop", "organization_closed", "organization_merged", "superseded"] as const),
    stalled: p.stalled,
    stallPhase: p.stallPhase === null ? null : choice(p.stallPhase, ["outreach", "responded", "verifying", "completing"] as const),
    stalledSince: timestamp(p.stalledSince), lastTouchAt: timestamp(p.lastTouchAt), nextActionDueAt: timestamp(p.nextActionDueAt),
    openedAt: timestamp(p.openedAt) ?? invalid(), closedAt: timestamp(p.closedAt), asOfAt: timestamp(p.asOfAt) ?? invalid(),
    attemptNumber: p.attemptNumber as number, rulesVersion: p.rulesVersion as number,
  };
  if ((result.outreachStatus === "ended") !== (result.endReason !== null && result.closedAt !== null) ||
      (result.outreachStatus !== "ended" && (result.endReason !== null || result.closedAt !== null)) ||
      result.stalled !== (result.stallPhase !== null && result.stalledSince !== null) ||
      (!result.stalled && (result.stallPhase !== null || result.stalledSince !== null)) ||
      (result.stalled && ["not_eligible", "ready", "paused", "ended"].includes(result.outreachStatus))) return invalid();
  for (const date of [result.openedAt, result.closedAt, result.lastTouchAt, result.stalledSince]) {
    if (date !== null && (date > result.asOfAt || date < result.openedAt)) return invalid();
  }
  return Object.freeze(result);
}

export const PROVIDER_PHASE_LABELS = {
  ready_for_outreach: "Ready for outreach", outreach: "Outreach in progress", responded: "Responded", verifying: "Verifying",
  completing: "Completing profile", onboarded: "Onboarded", not_onboarded: "Not onboarded",
} as const;
