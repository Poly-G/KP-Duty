import {LeadImporter} from "@/components/crm/lead-importer";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { EmptyPanel } from "@/components/empty-panel";
import { BillingPlaceholder } from "@/components/projects/billing-placeholder";
import { businessSlugs, getBusinessWorkspace } from "@/modules/businesses/queries";

export default async function BusinessWorkspacePage({ params }: { params: Promise<{ business: string }> }) {
  const { business } = await params;
  if (!businessSlugs.has(business)) notFound();
  const workspace = await getBusinessWorkspace(business);
  if (!workspace) notFound();
  const { pipeline, projects, companies } = workspace;
  if (business === "nex") return <><PageHeading eyebrow="Business workspace" title="Nex" description="Nex is paused. This space is reserved for when work resumes." /><EmptyPanel title="Paused" description="Client onboarding and delivery are not open for Nex." /></>;
  return <>
    <PageHeading eyebrow="Business workspace" title={pipeline.business.name} description="Sales, client relationships, and delivery work for this business." />
    <div className="mb-7 flex flex-wrap gap-3">
      <Link className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm" href={`/crm/${business}`}>Open sales pipeline · {pipeline.opportunities.length}</Link>
      <Link className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm" href={`/projects?business=${business}`}>Manage projects · {projects.length}</Link>
      <Link className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm" href={`/businesses/${business}/preview`}>Try a sample project</Link>
    </div>
    <section className="mb-7">
      <h2 className="mb-3 font-medium">Companies & clients</h2>
      <p className="mb-4 text-sm text-[var(--muted)]">Companies with a sales opportunity or project in this business. A sales opportunity does not mean a client has started delivery.</p>
      {companies.length ? <div className="grid gap-3 sm:grid-cols-2">{companies.map(company => <Link key={company.id} href={`/businesses/${business}/clients/${company.id}`} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 hover:bg-[var(--surface-subtle)]"><h3 className="font-medium">{company.name}</h3><p className="mt-2 text-sm text-[var(--muted)]">{company.opportunityCount} sales opportunities · {company.projectCount} projects</p></Link>)}</div> : <EmptyPanel title="No client relationships yet" description="Companies appear here when they have an opportunity or project in this business." />}
    </section>
    <LeadImporter business={business}/><BillingPlaceholder />
  </>;
}
