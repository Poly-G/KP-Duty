import { PageHeading } from "@/components/page-heading";

const columns = [
  ["To Do", "Actionable work that has not started."],
  ["Working", "Only work that is actively being worked."],
  ["Finished", "Completed work is hidden from the default view."],
] as const;

export default function WorkPage() {
  return (
    <>
      <PageHeading
        eyebrow="Work"
        title="Simple work state"
        description="To Do → Working → Finished. Waiting and blocked stay separate availability states."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {columns.map(([title, detail]) => (
          <section
            key={title}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-3"
          >
            <div className="px-2 py-2">
              <h2 className="text-sm font-semibold">{title}</h2>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                {detail}
              </p>
            </div>
            <div className="mt-2 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-8 text-center text-xs text-[var(--muted)]">
              Gate B will place movable cards here.
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
