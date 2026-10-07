import { ActionForm } from "@/components/action-form";
import { createOpportunity } from "@/modules/crm/actions";
import type {
  BusinessPipeline,
  Organization,
} from "@/modules/crm/types";

export function NewOpportunityForm({
  board,
  organizations,
}: {
  board: BusinessPipeline;
  organizations: Organization[];
}) {
  if (!board.business.is_active) {
    return <p className="mb-6 text-sm text-[var(--muted)]">New opportunities are paused while this business is parked.</p>;
  }

  const firstStage = board.stages[0];
  if (!firstStage) return null;

  return (
    <details className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium">
        + Add opportunity
      </summary>
      <ActionForm
        action={createOpportunity}
        className="grid gap-3 border-t border-[var(--border)] p-4 sm:grid-cols-2"
      >
        <input type="hidden" name="business_id" value={board.business.id} />
        <input type="hidden" name="business_slug" value={board.business.slug} />
        <input type="hidden" name="pipeline_id" value={board.pipeline.id} />
        <input type="hidden" name="stage_id" value={firstStage.id} />

        <label className="text-xs font-medium text-[var(--muted-strong)] sm:col-span-2">
          Opportunity
          <input
            required
            name="name"
            className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm"
            placeholder="What is the opportunity?"
          />
        </label>

        <label className="text-xs font-medium text-[var(--muted-strong)]">
          Company
          <select
            name="organization_id"
            className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm"
            defaultValue=""
          >
            <option value="">No company yet</option>
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-medium text-[var(--muted-strong)]">
          Source
          <input
            name="source"
            className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm"
            placeholder="Upwork, referral, inbound…"
          />
        </label>

        <label className="text-xs font-medium text-[var(--muted-strong)] sm:col-span-2">
          Do this next
          <input
            name="next_action"
            className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm"
            placeholder="Immediate next action"
          />
        </label>

        <label className="text-xs font-medium text-[var(--muted-strong)] sm:col-span-2">
          Source link
          <input
            name="source_url"
            type="url"
            className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm"
            placeholder="https://…"
          />
        </label>

        <div className="sm:col-span-2">
          <button
            type="submit"
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
          >
            Add to {firstStage.name}
          </button>
        </div>
      </ActionForm>
    </details>
  );
}
