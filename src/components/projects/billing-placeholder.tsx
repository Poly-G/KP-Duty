export function BillingPlaceholder() {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-medium">Billing</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">Stripe is not connected yet.</p>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Invoices, subscriptions, and payment status will appear here when billing is connected.</p>
    </section>
  );
}
