"use client";

import {
  DndContext,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowRight,
  Check,
  ExternalLink,
  GripVertical,
  X,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import {
  completeTask,
  reopenTask,
  setTaskStage,
} from "@/modules/work/actions";
import type {
  TaskAvailability,
  TaskStage,
  WorkTask,
} from "@/modules/work/types";
import { cn } from "@/lib/utils";

const visibleStages: Array<{ id: Exclude<TaskStage, "finished">; label: string }> =
  [
    { id: "todo", label: "To Do" },
    { id: "working", label: "Working" },
  ];

const availabilityLabel: Record<TaskAvailability, string> = {
  yes: "Ready",
  waiting: "Waiting",
  blocked: "Blocked",
  parked: "Parked",
};

function TaskCard({
  task,
  onOpen,
  onFinish,
}: {
  task: WorkTask;
  onOpen: () => void;
  onFinish: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { stage: task.stage },
  });

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm",
        isDragging && "opacity-60 shadow-md",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          aria-label="Drag task"
          className="mt-0.5 cursor-grab rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-subtle)] active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={15} />
        </button>

        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 text-left"
        >
          <p className="text-sm font-medium leading-5">{task.title}</p>
          {task.next_action ? (
            <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-[var(--muted)]">
              Next: {task.next_action}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {task.business ? (
              <span className="rounded-md bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted-strong)]">
                {task.business.name}
              </span>
            ) : null}
            {task.priority !== "normal" ? (
              <span className="rounded-md bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[10px] capitalize text-[var(--muted)]">
                {task.priority}
              </span>
            ) : null}
          </div>
        </button>

        <button
          type="button"
          aria-label="Finish task"
          title="Finish"
          onClick={onFinish}
          className="rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-emerald-50 hover:text-emerald-700"
        >
          <Check size={16} />
        </button>
      </div>
    </article>
  );
}

function BoardColumn({
  stage,
  label,
  tasks,
  onOpen,
  onFinish,
}: {
  stage: Exclude<TaskStage, "finished">;
  label: string;
  tasks: WorkTask[];
  onOpen: (task: WorkTask) => void;
  onFinish: (task: WorkTask) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column:${stage}`,
    data: { stage },
  });

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "min-h-48 rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-3 transition",
        isOver && "border-neutral-400 bg-neutral-100",
      )}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold">{label}</h2>
        <span className="text-xs tabular-nums text-[var(--muted)]">
          {tasks.length}
        </span>
      </div>

      <SortableContext
        items={tasks.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onOpen={() => onOpen(task)}
              onFinish={() => onFinish(task)}
            />
          ))}

          {!tasks.length ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-white/60 px-3 py-8 text-center text-xs text-[var(--muted)]">
              Nothing here.
            </div>
          ) : null}
        </div>
      </SortableContext>
    </section>
  );
}

function TaskDetail({
  task,
  onClose,
}: {
  task: WorkTask;
  onClose: () => void;
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
              {[task.reference_code, task.business?.name].filter(Boolean).join(" · ")}
            </p>
            <h2 className="text-xl font-semibold leading-7">{task.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close task details"
            className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-subtle)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-7 space-y-6">
          <section>
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
              Do this next
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
              {task.next_action || "No next action has been written yet."}
            </p>
          </section>

          {task.instructions ? (
            <section>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                Step-by-step
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                {task.instructions}
              </p>
            </section>
          ) : null}

          {task.finished_when ? (
            <section>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                Finished when
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                {task.finished_when}
              </p>
            </section>
          ) : null}

          {task.waiting_on ? (
            <section>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                Waiting on / needs
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{task.waiting_on}</p>
            </section>
          ) : null}

          {task.what_this_is || task.why_it_matters ? (
            <section className="rounded-xl bg-[var(--surface-subtle)] p-4">
              {task.what_this_is ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                    What this is
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{task.what_this_is}</p>
                </>
              ) : null}
              {task.why_it_matters ? (
                <div className={task.what_this_is ? "mt-5" : ""}>
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                    Why it matters
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                    {task.why_it_matters}
                  </p>
                </div>
              ) : null}
            </section>
          ) : null}

          {task.notes ? (
            <details className="rounded-xl border border-[var(--border)] p-4">
              <summary className="cursor-pointer text-xs font-medium text-[var(--muted-strong)]">
                Notes
              </summary>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--muted-strong)]">
                {task.notes}
              </p>
            </details>
          ) : null}

          {task.reference_url ? (
            <a
              href={task.reference_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4"
            >
              Open reference
              <ExternalLink size={14} />
            </a>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

export function WorkBoard({ initialTasks }: { initialTasks: WorkTask[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [selectedTask, setSelectedTask] = useState<WorkTask | null>(null);
  const [showFinished, setShowFinished] = useState(false);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const actionable = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.owner_id !== null &&
          task.availability === "yes" &&
          task.stage !== "finished",
      ),
    [tasks],
  );

  const waiting = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.owner_id !== null &&
          task.stage !== "finished" &&
          (task.availability === "waiting" ||
            task.availability === "blocked"),
      ),
    [tasks],
  );

  const unassigned = useMemo(
    () =>
      tasks.filter(
        (task) => task.owner_id === null && task.stage !== "finished",
      ),
    [tasks],
  );

  const finished = useMemo(
    () => tasks.filter((task) => task.stage === "finished"),
    [tasks],
  );

  const tasksForStage = (stage: Exclude<TaskStage, "finished">) =>
    actionable.filter((task) => task.stage === stage);

  const handleFinish = (task: WorkTask) => {
    setTasks((current) =>
      current.map((candidate) =>
        candidate.id === task.id
          ? { ...candidate, stage: "finished", finished_at: new Date().toISOString() }
          : candidate,
      ),
    );

    if (selectedTask?.id === task.id) setSelectedTask(null);

    startTransition(async () => {
      try {
        await completeTask(task.id);
      } catch {
        setTasks(initialTasks);
      }
    });
  };

  const handleReopen = (task: WorkTask) => {
    setTasks((current) =>
      current.map((candidate) =>
        candidate.id === task.id
          ? { ...candidate, stage: "todo", finished_at: null }
          : candidate,
      ),
    );

    startTransition(async () => {
      try {
        await reopenTask(task.id);
      } catch {
        setTasks(initialTasks);
      }
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const taskId = String(event.active.id);
    const over = event.over;
    if (!over) return;

    const task = tasks.find((candidate) => candidate.id === taskId);
    if (!task || task.stage === "finished" || task.owner_id === null) return;

    const overId = String(over.id);
    const destinationTask = tasks.find((candidate) => candidate.id === overId);
    const destinationStage = (
      overId.startsWith("column:")
        ? overId.replace("column:", "")
        : destinationTask?.stage
    ) as TaskStage | undefined;

    if (
      !destinationStage ||
      destinationStage === "finished" ||
      destinationStage === task.stage
    ) {
      return;
    }

    setTasks((current) =>
      current.map((candidate) =>
        candidate.id === task.id
          ? { ...candidate, stage: destinationStage }
          : candidate,
      ),
    );

    startTransition(async () => {
      try {
        await setTaskStage(task.id, destinationStage);
      } catch {
        setTasks(initialTasks);
      }
    });
  };

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="grid gap-4 lg:grid-cols-2">
          {visibleStages.map((stage) => (
            <BoardColumn
              key={stage.id}
              stage={stage.id}
              label={stage.label}
              tasks={tasksForStage(stage.id)}
              onOpen={setSelectedTask}
              onFinish={handleFinish}
            />
          ))}
        </div>
      </DndContext>

      {waiting.length ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold">Waiting / Blocked</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            These stay visible for awareness, but they are not recommended as
            work-now.
          </p>

          <div className="mt-3 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            {waiting.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => setSelectedTask(task)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--surface-subtle)]"
              >
                <span className="min-w-16 rounded-md bg-[var(--surface-subtle)] px-2 py-1 text-center text-[10px] font-medium text-[var(--muted)]">
                  {availabilityLabel[task.availability]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {task.title}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">
                    {task.waiting_on || "Dependency needs resolution."}
                  </span>
                </span>
                <ArrowRight size={15} className="text-[var(--muted)]" />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {unassigned.length ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold">Needs an owner</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
            These are visible to the admin so they do not disappear from KP.
          </p>

          <div className="mt-3 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            {unassigned.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => setSelectedTask(task)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--surface-subtle)]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {task.title}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">
                    {task.next_action || "Assign an owner before starting."}
                  </span>
                </span>
                <ArrowRight size={15} className="text-[var(--muted)]" />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {finished.length ? (
        <section className="mt-7">
          <button
            type="button"
            onClick={() => setShowFinished((value) => !value)}
            className="text-xs font-medium text-[var(--muted)] underline underline-offset-4"
          >
            {showFinished ? "Hide" : "Show"} finished ({finished.length})
          </button>

          {showFinished ? (
            <div className="mt-3 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
              {finished.map((task) => (
                <div key={task.id} className="flex items-center gap-3 px-4 py-3">
                  <Check size={15} className="text-emerald-700" />
                  <span className="min-w-0 flex-1 truncate text-sm text-[var(--muted)] line-through">
                    {task.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleReopen(task)}
                    className="text-xs font-medium text-[var(--muted)] hover:text-[var(--text)]"
                  >
                    Reopen
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {selectedTask ? (
        <TaskDetail task={selectedTask} onClose={() => setSelectedTask(null)} />
      ) : null}
    </>
  );
}
