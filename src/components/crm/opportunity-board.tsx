"use client";

import { ColumnHeading } from "@/components/crm/column-heading";
import { RecordNotes } from "@/components/activity/record-notes";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, horizontalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { createCrmColumn, reorderCrmColumns } from "@/modules/crm/column-actions";
import { useRouter } from "next/navigation";
import { CSS } from "@dnd-kit/utilities";
import { ExternalLink, GripVertical, X } from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";
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
      <button type="button" onClick={onOpen} className="mt-3 text-xs text-[var(--muted)] underline underline-offset-4">Add note</button>
    </article>
  );
}

function StageColumn({
  pipelineId,
  onRenamed,
  stage,
  opportunities,
  onOpen,
}: {
  pipelineId: string;
  onRenamed: (stage: PipelineStage) => void;
  stage: PipelineStage;
  opportunities: Opportunity[];
  onOpen: (opportunity: Opportunity) => void;
}) {
  const sortable = useSortable({ id: `column:${stage.id}`, data: { type: "column" } });
  const { setNodeRef, isOver } = useDroppable({
    id: `stage:${stage.id}`,
    data: { stageId: stage.id },
  });

  return (
    <section
      ref={node => { setNodeRef(node); sortable.setNodeRef(node); }}
      style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }}
      className={cn(
        "w-72 shrink-0 rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-3 transition",
        isOver && "border-neutral-400 bg-neutral-100",
      )}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex min-w-0 items-center gap-2"><button type="button" aria-label={`Move ${stage.name} column`} title="Drag to move column" className="cursor-grab rounded p-1 text-[var(--muted)] hover:bg-white touch-none" {...sortable.attributes} {...sortable.listeners}><GripVertical size={15}/></button><ColumnHeading stage={stage} pipelineId={pipelineId} onRenamed={onRenamed} /></div>
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

        <RecordNotes key={opportunity.id} entityType="opportunity" entityId={opportunity.id} expanded />

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
  pipelineId,
  stages: initialStages,
  initialOpportunities,
}: {
  businessSlug: string;
  pipelineId: string;
  stages: PipelineStage[];
  initialOpportunities: Opportunity[];
}) {
  const [stages, setStages] = useState(initialStages);
  const [adding, setAdding] = useState(false);
  const [columnName, setColumnName] = useState("");
  const columnAttempt = useRef<{ name: string; id: string } | null>(null);
  const router = useRouter();
  const [opportunities, setOpportunities] = useState(initialOpportunities);
  const [selected, setSelected] = useState<Opportunity | null>(null);
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
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
    if (String(event.active.id).startsWith("column:")) {
      if (!event.over) return;
      const from = stages.findIndex(stage => `column:${stage.id}` === String(event.active.id));
      const overId = String(event.over.id).replace(/^(column|stage):/, "");
      const to = stages.findIndex(stage => stage.id === overId || opportunities.some(card => card.id === overId && card.stage_id === stage.id));
      if (from < 0 || to < 0 || from === to) return;
      const previous = stages;
      const reordered = arrayMove(stages, from, to);
      setStages(reordered);
      startTransition(async () => {
        try { await reorderCrmColumns(pipelineId, previous.map(stage => stage.id), reordered.map(stage => stage.id)); }
        catch { setStages(previous); setSaveError("The column couldn’t be moved. Refresh the board and try again."); }
      });
      return;
    }
    const opportunityId = String(event.active.id);
    const over = event.over;
    if (!over) return;

    const opportunity = opportunities.find(
      (candidate) => candidate.id === opportunityId,
    );
    if (!opportunity || opportunity.nexAttemptId) return;

    const overId = String(over.id);
    const destinationStageId = /^(stage|column):/.test(overId)
      ? overId.replace(/^(stage|column):/, "")
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
          <SortableContext items={stages.map(stage => `column:${stage.id}`)} strategy={horizontalListSortingStrategy}>
          {stages.map((stage) => (
            <StageColumn
              pipelineId={pipelineId}
              onRenamed={renamed => setStages(current => current.map(stage => stage.id === renamed.id ? renamed : stage))}
              key={stage.id}
              stage={stage}
              opportunities={grouped[stage.id] ?? []}
              onOpen={setSelected}
            />
          ))}
          </SortableContext>
          <div className="w-72 shrink-0">
            {adding ? <form className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3" onSubmit={event => {
              event.preventDefault();
              const name = columnName.trim();
              if (!name || isPending) return;
              if (columnAttempt.current?.name !== name) columnAttempt.current = { name, id: crypto.randomUUID() };
              const id = columnAttempt.current.id;
              setSaveError("");
              startTransition(async () => {
                try {
                  const column = await createCrmColumn(pipelineId, id, name);
                  setStages(current => current.some(stage => stage.id === column.id) ? current : [...current, column]);
                  setColumnName(""); setAdding(false); columnAttempt.current = null; router.refresh();
                } catch { setSaveError("The column couldn’t be added. Your name is still here; please try again."); }
              });
            }}>
              <label className="text-xs font-medium">Column name<input autoFocus required maxLength={80} value={columnName} onChange={event => setColumnName(event.target.value)} placeholder="e.g. Call back next week" className="mt-2 w-full rounded-lg border border-[var(--border)] p-2 text-sm" /></label>
              <div className="mt-3 flex gap-3"><button type="submit" disabled={!columnName.trim() || isPending} className="rounded-lg bg-[var(--accent)] px-3 py-2 text-xs text-white disabled:opacity-50">Add column</button><button type="button" onClick={() => setAdding(false)} className="text-xs text-[var(--muted)]">Cancel</button></div>
            </form> : <button type="button" onClick={() => setAdding(true)} className="w-full rounded-2xl border border-dashed border-[var(--border)] p-4 text-left text-sm text-[var(--muted)] hover:bg-[var(--surface-subtle)]">+ Add column</button>}
          </div>
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
