import { PageHeading } from "@/components/page-heading";

const sections = [
  {
    title: "Working",
    body: "What you are actively doing right now will live here.",
  },
  {
    title: "Next",
    body: "Your next actionable work will be selected from the same shared state.",
  },
  {
    title: "Waiting on you",
    body: "Approvals, inputs and decisions that need your attention will surface here.",
  },
  {
    title: "Recent",
    body: "Meaningful changes across KP will appear here without turning Home into an analytics dashboard.",
  },
];

export default function HomePage() {
  return (
    <>
      <PageHeading
        eyebrow="Home"
        title="What needs your attention?"
        description="Borrowing the SnD Command Center rule: active work, decisions, and what needs attention next — not a wall of metrics."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((section) => (
          <section
            key={section.title}
            className="min-h-36 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"
          >
            <h2 className="text-sm font-semibold">{section.title}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {section.body}
            </p>
          </section>
        ))}
      </div>
    </>
  );
}
