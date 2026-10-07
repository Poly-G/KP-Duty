import { ActionForm } from "@/components/action-form";
import { createDecision } from "@/modules/decisions/actions";

export function NewDecisionForm({
  businesses,
}: {
  businesses: Array<{ id: string; name: string; slug: string }>;
}) {
  return (
    <details className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium">
        + Add decision
      </summary>
      <ActionForm
        action={createDecision}
        className="grid gap-3 border-t border-[var(--border)] p-4 sm:grid-cols-2"
      >
        <label className="text-xs font-medium text-[var(--muted-strong)] sm:col-span-2">
          Decision
          <input
            required
            name="title"
            className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm"
            placeholder="What needs to be decided?"
          />
        </label>

        <label className="text-xs font-medium text-[var(--muted-strong)]">
          Business
          <select
            name="business_id"
            defaultValue=""
            className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm"
          >
            <option value="">KP / Shared</option>
            {businesses.map((business) => (
              <option key={business.id} value={business.id}>
                {business.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-medium text-[var(--muted-strong)]">
          Mode
          <select
            name="mode"
            defaultValue="joint"
            className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm"
          >
            <option value="joint">Joint</option>
            <option value="individual">Individual</option>
          </select>
        </label>

        <label className="text-xs font-medium text-[var(--muted-strong)]">
          Domain
          <input
            name="domain"
            className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm"
            placeholder="Operations, pricing, brand…"
          />
        </label>

        <label className="text-xs font-medium text-[var(--muted-strong)]">
          Needed by
          <input
            name="needed_by"
            type="date"
            className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm"
          />
        </label>

        <label className="text-xs font-medium text-[var(--muted-strong)] sm:col-span-2">
          Context
          <textarea
            name="context"
            rows={3}
            className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-white p-3 text-sm"
          />
        </label>

        <label className="text-xs font-medium text-[var(--muted-strong)] sm:col-span-2">
          Recommendation
          <textarea
            name="recommendation"
            rows={3}
            className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-white p-3 text-sm"
          />
        </label>

        <div className="sm:col-span-2">
          <button
            type="submit"
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
          >
            Add decision
          </button>
        </div>
      </ActionForm>
    </details>
  );
}
