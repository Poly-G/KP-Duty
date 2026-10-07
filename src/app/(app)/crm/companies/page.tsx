import { ActionForm } from "@/components/action-form";
import { ExternalLink } from "lucide-react";
import { createOrganization } from "@/modules/crm/actions";
import { listOrganizations } from "@/modules/crm/queries";
import { PageHeading } from "@/components/page-heading";

export default async function CompaniesPage() {
  const organizations = await listOrganizations();

  return (
    <>
      <PageHeading
        eyebrow="CRM"
        title="Companies"
        description="A company exists once in KP, even when it touches more than one business."
      />

      <details className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium">
          + Add company
        </summary>
        <ActionForm
          action={createOrganization}
          className="grid gap-3 border-t border-[var(--border)] p-4 sm:grid-cols-2"
        >
          {[
            ["name", "Company name", "text"],
            ["website", "Website", "text"],
            ["public_email", "Public email", "email"],
            ["phone", "Phone", "text"],
            ["city", "City", "text"],
            ["state", "State", "text"],
          ].map(([name, label, type]) => (
            <label
              key={name}
              className="text-xs font-medium text-[var(--muted-strong)]"
            >
              {label}
              <input
                required={name === "name"}
                name={name}
                type={type}
                className="mt-1.5 h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-sm"
              />
            </label>
          ))}

          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white"
            >
              Add company
            </button>
          </div>
        </ActionForm>
      </details>

      {organizations.length ? (
        <div className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          {organizations.map((organization) => (
            <article
              key={organization.id}
              className="flex items-start justify-between gap-5 px-4 py-4"
            >
              <div className="min-w-0">
                <h2 className="truncate text-sm font-medium">
                  {organization.name}
                </h2>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {[organization.city, organization.state]
                    .filter(Boolean)
                    .join(", ") || organization.domain || "No location/domain yet"}
                </p>
              </div>

              {organization.website ? (
                <a
                  href={
                    organization.website.match(/^https?:\/\//)
                      ? organization.website
                      : `https://${organization.website}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${organization.name} website`}
                  className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-subtle)]"
                >
                  <ExternalLink size={15} />
                </a>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-5 py-10 text-center text-sm text-[var(--muted)]">
          No companies yet.
        </p>
      )}
    </>
  );
}
