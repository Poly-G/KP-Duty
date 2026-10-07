import { ActionForm } from "@/components/action-form";
import { createProject } from "@/modules/projects/actions";

type Option = {
  id: string;
  name: string;
};

export function NewProjectForm({
  businesses,
  organizations,
}: {
  businesses: Array<Option & { slug: string; is_active: boolean }>;
  organizations: Option[];
}) {
  return (
    <details className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium">
        + Add project
      </summary>
      <ActionForm
        action={createProject}
        className="grid gap-3 border-t border-[var(--border)] p-4 sm:grid-cols-2"
      >
        <label className="text-xs font-medium text-[var(--muted-strong)] sm:col-span-2">
          Project
          <input
            required
            name="name"
            className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm"
          />
        </label>

        <label className="text-xs font-medium text-[var(--muted-strong)]">
          Business
          <select
            required
            name="business_id"
            defaultValue=""
            className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm"
          >
            <option value="" disabled>
              Choose business
            </option>
            {businesses.map((business) => (
              <option key={business.id} value={business.id} disabled={!business.is_active}>
                {business.name}{business.is_active ? "" : " — parked"}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-medium text-[var(--muted-strong)]">
          Client / organization
          <select
            name="organization_id"
            defaultValue=""
            className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm"
          >
            <option value="">None yet</option>
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-medium text-[var(--muted-strong)]">
          Phase
          <input
            name="phase"
            className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm"
            placeholder="Design, Build, QA…"
          />
        </label>

        <label className="text-xs font-medium text-[var(--muted-strong)] sm:col-span-2">
          Next milestone
          <input
            name="next_milestone"
            className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm"
          />
        </label>

        <label className="text-xs font-medium text-[var(--muted-strong)] sm:col-span-2">
          Detailed project link
          <input
            name="external_project_url"
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
            Add project
          </button>
        </div>
      </ActionForm>
    </details>
  );
}
