import type { ActivityEvent } from "@/modules/projects/types";

export function RecentActivity({
  events,
}: {
  events: ActivityEvent[];
}) {
  return (
    <section className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Recent</h2>
        <span className="text-xs text-[var(--muted)]">
          Shared KP activity
        </span>
      </div>

      {events.length ? (
        <div className="divide-y divide-[var(--border)]">
          {events.map((event) => (
            <div
              key={event.id}
              className="grid gap-1 py-3 first:pt-0 sm:grid-cols-[1fr_auto] sm:gap-4"
            >
              <div>
                <p className="text-sm leading-5">{event.summary}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {[event.business?.name, event.organization?.name, event.actor?.display_name]
                    .filter(Boolean)
                    .join(" · ") || event.source}
                </p>
              </div>
              <time
                dateTime={event.occurred_at}
                className="text-[10px] text-[var(--muted)] sm:pt-0.5"
              >
                {new Intl.DateTimeFormat("en-US", {
                  month: "short",
                  day: "numeric",
                }).format(new Date(event.occurred_at))}
              </time>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs leading-5 text-[var(--muted)]">
          No activity yet.
        </p>
      )}
    </section>
  );
}
