import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseProviderSnapshot, prepareProviderEnvelope, isProviderOutboundEligible } from "../src/modules/integrations/nex/provider-contract.ts";

const org = "123e4567-e89b-42d3-a456-426614174000";
const contact = "123e4567-e89b-42d3-a456-426614174001";
const valid = {
  organizationId: org, contactId: contact, attemptId: "123e4567-e89b-42d3-a456-426614174002",
  revision: 1, admission: "approved_preview", listingReadiness: "preview_ready",
  representation: "unrepresented", disposition: "active", mergedIntoOrganizationId: null,
  onboardingPhase: "ready_for_outreach", onboardedAt: null,
  contactStatus: "contactable", organizationNoContact: false,
};

describe("KP provider boundary", () => {
  it("prepares bounded stable-ID envelopes for ten synthetic organizations", () => {
    for (let n = 0; n < 10; n++) {
      const organizationId = `123e4567-e89b-42d3-a456-42661417401${n}`;
      const event = prepareProviderEnvelope(org, new Date("2026-10-08T00:00:00.000Z"), { ...valid, organizationId });
      assert.equal(event.payload.organizationId, organizationId);
      assert.equal(event.schemaVersion, 1);
      assert.ok(Object.isFrozen(event.payload));
    }
  });
  it("allows inbound claims before preview readiness without allowing outbound", () => {
    const snapshot = parseProviderSnapshot({ ...valid, admission: "inbound_claim", listingReadiness: "in_research", representation: "claim_pending" });
    assert.equal(isProviderOutboundEligible(snapshot), false);
    assert.throws(() => parseProviderSnapshot({ ...valid, admission: "researched" }));
    assert.equal(isProviderOutboundEligible(parseProviderSnapshot({ ...valid, listingReadiness: "in_research" })), false);
  });
  it("keeps contact suppression separate from organization suppression", () => {
    for (const contactStatus of ["dnc", "wrong_person"]) {
      const blocked = parseProviderSnapshot({ ...valid, contactStatus });
      assert.equal(blocked.organizationNoContact, false);
      assert.equal(isProviderOutboundEligible(blocked), false);
      assert.equal(isProviderOutboundEligible(parseProviderSnapshot({ ...valid, contactId: org })), true);
    }
    assert.equal(isProviderOutboundEligible(parseProviderSnapshot({ ...valid, organizationNoContact: true })), false);
  });
  it("does not equate closed or merged organizations with DNC", () => {
    for (const disposition of ["closed", "merged"]) {
      const snapshot = parseProviderSnapshot({ ...valid, disposition, mergedIntoOrganizationId: disposition === "merged" ? contact : null });
      assert.equal(snapshot.organizationNoContact, false);
      assert.equal(isProviderOutboundEligible(snapshot), false);
    }
    assert.throws(() => parseProviderSnapshot({ ...valid, disposition: "merged" }));
    assert.throws(() => parseProviderSnapshot({ ...valid, disposition: "merged", mergedIntoOrganizationId: org }));
  });
  it("retains successful attempts when readiness regresses and rejects reopening", () => {
    const success = { ...valid, onboardingPhase: "onboarded", onboardedAt: "2026-10-07T00:00:00.000Z", listingReadiness: "in_research" };
    assert.equal(parseProviderSnapshot(success).onboardingPhase, "onboarded");
    assert.equal(isProviderOutboundEligible(parseProviderSnapshot(success)), false);
    assert.throws(() => parseProviderSnapshot({ ...success, onboardingPhase: "outreach" }));
    assert.throws(() => parseProviderSnapshot({ ...success, onboardedAt: null }));
  });
  it("keeps ended attempts closed and new attempts separately identifiable", () => {
    assert.equal(isProviderOutboundEligible(parseProviderSnapshot({ ...valid, onboardingPhase: "not_onboarded" })), false);
    const next = parseProviderSnapshot({ ...valid, attemptId: contact });
    assert.notEqual(next.attemptId, valid.attemptId);
  });
  it("rejects Veteran, clinical, contact-detail, free-text and unknown fields without reflecting them", () => {
    for (const key of ["veteranId", "accountId", "diagnosis", "notes", "email", "evidence", "metadata", "sourceUrl"]) {
      assert.throws(() => parseProviderSnapshot({ ...valid, [key]: "private test value" }), /^Error: Invalid KP provider snapshot$/);
    }
  });
  it("rejects missing/malformed identifiers, revisions, enums, timestamps and contact scope", () => {
    for (const input of [null, [], {}, { ...valid, contactStatus: null }, { ...valid, contactId: null },
      { ...valid, revision: 0 }, { ...valid, revision: 1.5 }, { ...valid, revision: Number.MAX_SAFE_INTEGER + 1 },
      { ...valid, organizationId: "name" }, { ...valid, representation: "trusted" },
      { ...valid, onboardedAt: "2026-02-30T00:00:00.000Z", onboardingPhase: "onboarded" }]) {
      assert.throws(() => parseProviderSnapshot(input), /Invalid KP provider snapshot/);
    }
    assert.throws(() => prepareProviderEnvelope(org, new Date("invalid"), valid));
  });
});
