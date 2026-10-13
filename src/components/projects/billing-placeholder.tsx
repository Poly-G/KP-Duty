export function BillingPlaceholder({ business }: { business?: string }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="font-medium">Billing</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">{business === "solta" ? "Client payments are managed in each connected project." : "Stripe is not connected yet."}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{business === "solta" ? "Open a project’s Client payments section to request a Stripe payment or check its status." : "Invoices, subscriptions, and payment status will appear here when billing is connected."}</p>
    </section>
  );
}
