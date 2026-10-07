"use client";

import { ActionForm } from "@/components/action-form";

import { X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import {
  resolveDecision,
  setDecisionStatus,
} from "@/modules/decisions/actions";
import type {
  DecisionRecord,
  DecisionStatus,
} from "@/modules/decisions/types";

const statusLabel: Record<DecisionStatus, string> = {
  open: "Open",
  discussing: "Discussing",
  deferred: "Deferred",
  resolved: "Resolved",
  superseded: "Superseded",
};

function DecisionDetail({
  decision,
  onClose,
  onStatus,
}: {
  decision: DecisionRecord;
  onClose: () => void;
  onStatus: (status: DecisionStatus) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/15" onClick={onClose}>
      <aside
        className="h-full w-full max-w-lg overflow-y-auto border-l border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-medium text-[var(--muted)]">
              {[decision.business?.name, decision.mode === "joint" ? "Joint" : "Individual"]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <h2 className="text-xl font-semibold leading-7">{decision.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close decision"
            className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-subtle)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-7 space-y-6">
          {decision.context ? (
            <section>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                Context
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                {decision.context}
              </p>
            </section>
          ) : null}

          {decision.recommendation ? (
            <section>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                Recommendation
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                {decision.recommendation}
              </p>
            </section>
          ) : null}

          {decision.final_decision ? (
            <section className="rounded-xl bg-[var(--surface-subtle)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                Final decision
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                {decision.final_decision}
              </p>
            </section>
          ) : null}

          {decision.status !== "resolved" &&
          decision.status !== "superseded" ? (
            <>
              <div className="flex flex-wrap gap-2">
                {(["open", "discussing", "deferred"] as DecisionStatus[]).map(
                  (status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => onStatus(status)}
                      className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium hover:bg-[var(--surface-subtle)]"
                    >
                      {statusLabel[status]}
                    </button>
                  ),
                )}
              </div>

              <ActionForm action={resolveDecision} className="border-t border-[var(--border)] pt-5">
                <input type="hidden" name="decision_id" value={decision.id} />
                <label className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Resolve with
                  <textarea
                    required
                    name="final_decision"
                    rows={4}
                    className="mt-2 w-full rounded-lg border border-[var(--border)] bg-white p-3 text-sm normal-case tracking-normal text-[var(--text)]"
                    placeholder="What did KP decide?"
                  />
                </label>
                <button
                  type="submit"
                  className="mt-3 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
                >
                  Resolve decision
                </button>
              </ActionForm>
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

export function DecisionList({
  initialDecisions,
}: {
  initialDecisions: DecisionRecord[];
}) {
  const [decisions, setDecisions] = useState(initialDecisions);
  const [selected, setSelected] = useState<DecisionRecord | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState("");

  const active = useMemo(
    () =>
      decisions.filter(
        (decision) =>
          decision.status !== "resolved" && decision.status !== "superseded",
      ),
    [decisions],
  );

  const resolved = useMemo(
    () =>
      decisions.filter(
        (decision) =>
          decision.status === "resolved" || decision.status === "superseded",
      ),
    [decisions],
  );

  const handleStatus = (decision: DecisionRecord, status: DecisionStatus) => {
    if (isPending) return;
    setSaveError("");
    const nextDecision = { ...decision, status };
    setDecisions((current) =>
      current.map((candidate) =>
        candidate.id === decision.id ? nextDecision : candidate,
      ),
    );
    setSelected(nextDecision);

    startTransition(async () => {
      try {
        await setDecisionStatus(decision.id, status);
      } catch {
        setSaveError("The change couldn’t be saved. Please try again.");
        setDecisions(initialDecisions);
        setSelected(decision);
      }
    });
  };

  return (
    <fieldset disabled={isPending} className="contents">
      {isPending ? <p role="status">Saving…</p> : null}
      {saveError ? <p role="alert" className="text-sm text-red-700">{saveError}</p> : null}
      {active.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {active.map((decision) => (
            <button
              key={decision.id}
              type="button"
              onClick={() => setSelected(decision)}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-left transition hover:border-neutral-300 hover:shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--muted)]">
                  {statusLabel[decision.status]}
                </span>
                <span className="text-[10px] capitalize text-[var(--muted)]">
                  {decision.priority}
                </span>
              </div>
              <h2 className="mt-3 text-sm font-semibold">{decision.title}</h2>
              <p className="mt-2 text-xs text-[var(--muted)]">
                {[decision.business?.name, decision.owner?.display_name]
                  .filter(Boolean)
                  .join(" · ") || "KP / Shared"}
              </p>
              {decision.recommendation ? (
                <p className="mt-4 line-clamp-2 text-xs leading-5 text-[var(--muted-strong)]">
                  {decision.recommendation}
                </p>
              ) : null}
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-5 py-10 text-center text-sm text-[var(--muted)]">
          No open decisions.
        </p>
      )}

      {resolved.length ? (
        <section className="mt-7">
          <button
            type="button"
            onClick={() => setShowResolved((value) => !value)}
            className="text-xs font-medium text-[var(--muted)] underline underline-offset-4"
          >
            {showResolved ? "Hide" : "Show"} resolved ({resolved.length})
          </button>

          {showResolved ? (
            <div className="mt-3 divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
              {resolved.map((decision) => (
                <button
                  key={decision.id}
                  type="button"
                  onClick={() => setSelected(decision)}
                  className="block w-full px-4 py-3 text-left hover:bg-[var(--surface-subtle)]"
                >
                  <span className="text-sm text-[var(--muted)]">
                    {decision.title}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {selected ? (
        <DecisionDetail
          decision={selected}
          onClose={() => setSelected(null)}
          onStatus={(status) => handleStatus(selected, status)}
        />
      ) : null}
    </fieldset>
  );
}
