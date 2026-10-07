import { createPerson } from "@/modules/crm/actions";
import { listOrganizations, listPeople } from "@/modules/crm/queries";
import { PageHeading } from "@/components/page-heading";

export default async function PeoplePage() {
  const [people, organizations] = await Promise.all([
    listPeople(),
    listOrganizations(),
  ]);

  return (
    <>
      <PageHeading
        eyebrow="CRM"
        title="People"
        description="People stay separate from companies so relationship history survives role or employer changes."
      />

      <details className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium">
          + Add person
        </summary>
        <form
          action={createPerson}
          className="grid gap-3 border-t border-[var(--border)] p-4 sm:grid-cols-2"
        >
          <label className="text-xs font-medium text-[var(--muted-strong)]">
            First name
            <input
              required
              name="first_name"
              className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm"
            />
          </label>
          <label className="text-xs font-medium text-[var(--muted-strong)]">
            Last name
            <input
              name="last_name"
              className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm"
            />
          </label>
          <label className="text-xs font-medium text-[var(--muted-strong)]">
            Email
            <input
              name="email"
              type="email"
              className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm"
            />
          </label>
          <label className="text-xs font-medium text-[var(--muted-strong)]">
            Title
            <input
              name="title"
              className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm"
            />
          </label>
          <label className="text-xs font-medium text-[var(--muted-strong)] sm:col-span-2">
            Company
            <select
              name="organization_id"
              defaultValue=""
              className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm"
            >
              <option value="">No company</option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
            >
              Add person
            </button>
          </div>
        </form>
      </details>

      {people.length ? (
        <div className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          {people.map((person) => (
            <article key={person.id} className="px-4 py-4">
              <h2 className="text-sm font-medium">
                {[person.first_name, person.last_name].filter(Boolean).join(" ")}
              </h2>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {[person.title, person.organization?.name]
                  .filter(Boolean)
                  .join(" · ") || person.email || "No details yet"}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-5 py-10 text-center text-sm text-[var(--muted)]">
          No people yet.
        </p>
      )}
    </>
  );
}
