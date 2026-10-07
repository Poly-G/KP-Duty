import type { WorkTask } from "@/modules/work/types";

function MiniTask({ task }: { task: WorkTask }) {
  return (
    <div className="border-t border-[var(--border)] py-3 first:border-t-0 first:pt-0">
      <p className="text-sm font-medium">{task.title}</p>
      {task.next_action ? (
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted)]">
          {task.next_action}
        </p>
      ) : null}
    </div>
  );
}

export function HomeWorkSummary({ tasks }: { tasks: WorkTask[] }) {
  const owned = tasks.filter((task) => task.owner_id !== null);
  const working = owned.filter(
    (task) => task.stage === "working" && task.availability === "yes",
  );
  const next = owned.filter(
    (task) => task.stage === "todo" && task.availability === "yes",
  );
  const waiting = owned.filter(
    (task) =>
      task.stage !== "finished" &&
      (task.availability === "waiting" || task.availability === "blocked"),
  );
  const unassigned = tasks.filter(
    (task) => task.owner_id === null && task.stage !== "finished",
  );

  const groups = [
    {
      title: "Working",
      tasks: working,
      empty: "Nothing is actively being worked right now.",
    },
    {
      title: "Next",
      tasks: next.slice(0, 3),
      empty: "No actionable to-do is queued.",
    },
    {
      title: "Waiting / Blocked",
      tasks: waiting.slice(0, 3),
      empty: "Nothing is waiting or blocked.",
    },
    ...(unassigned.length
      ? [
          {
            title: "Needs an owner",
            tasks: unassigned.slice(0, 3),
            empty: "",
          },
        ]
      : []),
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {groups.map((group) => (
        <section
          key={group.title}
          className="min-h-40 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">{group.title}</h2>
            <span className="text-xs tabular-nums text-[var(--muted)]">
              {group.tasks.length}
            </span>
          </div>

          {group.tasks.length ? (
            group.tasks.map((task) => <MiniTask key={task.id} task={task} />)
          ) : (
            <p className="text-xs leading-5 text-[var(--muted)]">{group.empty}</p>
          )}
        </section>
      ))}
    </div>
  );
}
