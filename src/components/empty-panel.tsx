type EmptyPanelProps = {
  title: string;
  description: string;
};

export function EmptyPanel({ title, description }: EmptyPanelProps) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="text-sm font-medium">{title}</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">
        {description}
      </p>
    </section>
  );
}
