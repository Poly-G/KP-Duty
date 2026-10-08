"use client";

import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ExternalLink, GripVertical, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { moveOpportunityStage } from "@/modules/crm/actions";
import type {
  Opportunity,
  PipelineStage,
} from "@/modules/crm/types";
import { cn } from "@/lib/utils";

function OpportunityCard({
  opportunity,
  onOpen,
}: {
  opportunity: Opportunity;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: opportunity.id,
      disabled: !!opportunity.nexAttemptId,
      data: { stageId: opportunity.stage_id },
    });

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        "rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm",
        isDragging && "z-30 opacity-70 shadow-lg",
      )}
    >
      <div className="flex items-start gap-2">
        {!opportunity.nexAttemptId && <button
          type="button"
          aria-label="Drag opportunity"
          className="mt-0.5 cursor-grab rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-subtle)] active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={15} />
        </button>}

        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={onOpen}
        >
          <p className="text-sm font-medium leading-5">{opportunity.name}</p>
          {opportunity.nexAttemptId && <p className="mt-1 text-xs text-[var(--muted)]">Stage from Nex</p>}
          {opportunity.organization ? (
            <p className="mt-1 truncate text-xs text-[var(--muted)]">
              {opportunity.organization.name}
            </p>
          ) : null}
          {opportunity.next_action ? (
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--muted)]">
              Next: {opportunity.next_action}
            </p>
          ) : null}
        </button>
      </div>
    </article>
  );
}

function StageColumn({
  stage,
  opportunities,
  onOpen,
}: {
  stage: PipelineStage;
  opportunities: Opportunity[];
  onOpen: (opportunity: Opportunity) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `stage:${stage.id}`,
    data: { stageId: stage.id },
  });

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "w-72 shrink-0 rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-3 transition",
        isOver && "border-neutral-400 bg-neutral-100",
      )}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold">{stage.name}</h2>
        <span className="text-xs tabular-nums text-[var(--muted)]">
          {opportunities.length}
        </span>
      </div>

      <div className="min-h-28 space-y-2">
        {opportunities.map((opportunity) => (
          <OpportunityCard
            key={opportunity.id}
            opportunity={opportunity}
            onOpen={() => onOpen(opportunity)}
          />
        ))}

        {!opportunities.length ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-white/60 px-3 py-7 text-center text-xs text-[var(--muted)]">
            Empty
          </div>
        ) : null}
      </div>
    </section>
  );
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function labelForMetadata(key: string) {
  return key
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function OpportunityDetail({
  opportunity,
  onClose,
}: {
  opportunity: Opportunity;
  onClose: () => void;
}) {
  const detailEntries = Object.entries(opportunity.metadata ?? {}).filter(
    ([, value]) => value !== null && value !== undefined && value !== "",
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/15" onClick={onClose}>
      <aside
        className="h-full w-full max-w-lg overflow-y-auto border-l border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-medium text-[var(--muted)]">
              {[opportunity.reference_code, opportunity.organization?.name]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <h2 className="text-xl font-semibold leading-7">
              {opportunity.name}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close opportunity details"
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-subtle)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-7 space-y-6">
          {opportunity.nexAttemptId && <section className="rounded-xl border border-[var(--border)] p-4">
            <p className="text-sm">Nex controls this onboarding stage. KP owns human follow-up.</p>
            <a className="mt-2 inline-block text-sm underline" href={`/businesses/nex/integration#attempt-${opportunity.nexAttemptId}`}>View provider operating status</a>
          </section>}
          <section>
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
              Do this next
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
              {opportunity.next_action || "No next action has been written yet."}
            </p>
          </section>

          <section className="grid grid-cols-2 gap-4 rounded-xl bg-[var(--surface-subtle)] p-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">
                Owner
              </p>
              <p className="mt-1 text-sm">
                {opportunity.owner?.display_name || "Unassigned"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">
                Source
              </p>
              <p className="mt-1 text-sm">{opportunity.source || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">
                Priority
              </p>
              <p className="mt-1 text-sm capitalize">{opportunity.priority}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">
                Value
              </p>
              <p className="mt-1 text-sm">
                {opportunity.amount_cents == null
                  ? "—"
                  : new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: opportunity.currency,
                    }).format(opportunity.amount_cents / 100)}
              </p>
            </div>
          </section>

          {detailEntries.length ? (
            <details className="rounded-xl border border-[var(--border)] p-4">
              <summary className="cursor-pointer text-xs font-medium text-[var(--muted-strong)]">
                More details
              </summary>
              <dl className="mt-4 space-y-4">
                {detailEntries.map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">
                      {labelForMetadata(key)}
                    </dt>
                    <dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--muted-strong)]">
                      {displayValue(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
          ) : null}

          {opportunity.source_url ? (
            <a
              href={opportunity.source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4"
            >
              Open source
              <ExternalLink size={14} />
            </a>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

export function OpportunityBoard({
  businessSlug,
  stages,
  initialOpportunities,
}: {
  businessSlug: string;
  stages: PipelineStage[];
  initialOpportunities: Opportunity[];
}) {
  const [opportunities, setOpportunities] = useState(initialOpportunities);
  const [selected, setSelected] = useState<Opportunity | null>(null);
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const grouped = useMemo(
    () =>
      Object.fromEntries(
        stages.map((stage) => [
          stage.id,
          opportunities.filter((opportunity) => opportunity.stage_id === stage.id),
        ]),
      ) as Record<string, Opportunity[]>,
    [opportunities, stages],
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (isPending) return;
    setSaveError("");
    const opportunityId = String(event.active.id);
    const over = event.over;
    if (!over) return;

    const opportunity = opportunities.find(
      (candidate) => candidate.id === opportunityId,
    );
    if (!opportunity || opportunity.nexAttemptId) return;

    const overId = String(over.id);
    const destinationStageId = overId.startsWith("stage:")
      ? overId.replace("stage:", "")
      : undefined;

    if (
      !destinationStageId ||
      destinationStageId === opportunity.stage_id
    ) {
      return;
    }

    setOpportunities((current) =>
      current.map((candidate) =>
        candidate.id === opportunity.id
          ? { ...candidate, stage_id: destinationStageId }
          : candidate,
      ),
    );

    startTransition(async () => {
      try {
        await moveOpportunityStage(
          opportunity.id,
          destinationStageId,
          businessSlug,
        );
      } catch {
        setSaveError("The change couldn’t be saved. Please try again.");
        setOpportunities((current) => current.map(candidate => candidate.id === opportunity.id ? opportunity : candidate));
      }
    });
  };

  return (
    <fieldset disabled={isPending} className="contents">
      {isPending ? <p role="status">Saving…</p> : null}
      {saveError ? <p role="alert" className="text-sm text-red-700">{saveError}</p> : null}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-4">
          {stages.map((stage) => (
            <StageColumn
              key={stage.id}
              stage={stage}
              opportunities={grouped[stage.id] ?? []}
              onOpen={setSelected}
            />
          ))}
        </div>
      </DndContext>

      {selected ? (
        <OpportunityDetail
          opportunity={selected}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </fieldset>
  );
}
