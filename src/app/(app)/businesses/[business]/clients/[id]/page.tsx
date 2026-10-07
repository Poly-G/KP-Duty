import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { EmptyPanel } from "@/components/empty-panel";
import { BillingPlaceholder } from "@/components/projects/billing-placeholder";
import { businessSlugs, getBusinessWorkspace } from "@/modules/businesses/queries";

export default async function ClientWorkspacePage({ params }: { params: Promise<{ business: string; id: string }> }) {
  const { business, id } = await params;
  if (!businessSlugs.has(business) || business === "nex") notFound();
  const workspace = await getBusinessWorkspace(business);
  const company = workspace?.companies.find(company => company.id === id);
  if (!workspace || !company) notFound();
  const projects = workspace.projects.filter(project => project.organization?.id === id);
  const opportunities = workspace.pipeline.opportunities.filter(opportunity => opportunity.organization?.id === id);
  return <>
    <Link href={`/businesses/${business}`} className="mb-5 inline-block text-sm text-[var(--muted)]">← {workspace.pipeline.business.name}</Link>
    <PageHeading eyebrow="Client workspace" title={company.name} description="This company’s sales and delivery work within this business." />
    <section className="mb-7"><h2 className="mb-3 font-medium">Projects</h2>{projects.length ? <div className="grid gap-3 sm:grid-cols-2">{projects.map(project => <article key={project.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"><h3 className="font-medium">{project.name}</h3><p className="mt-2 text-sm capitalize text-[var(--muted)]">{project.status} · {project.phase || "Phase not set"}</p><p className="mt-2 text-sm">Owner: {project.owner?.display_name || "Unassigned"}</p>{project.next_milestone ? <p className="mt-2 text-sm">Next: {project.next_milestone}</p> : null}</article>)}</div> : <EmptyPanel title="No delivery projects" description="This relationship has not been attached to a delivery project yet." />}</section>
    <section className="mb-7"><h2 className="mb-3 font-medium">Sales opportunities</h2>{opportunities.map(opportunity => <article key={opportunity.id} className="mb-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"><h3 className="font-medium">{opportunity.name}</h3><p className="mt-2 text-sm text-[var(--muted)]">{workspace.pipeline.stages.find(stage => stage.id === opportunity.stage_id)?.name || "Stage not set"}</p>{opportunity.next_action ? <p className="mt-2 text-sm">Next: {opportunity.next_action}</p> : null}</article>)}{!opportunities.length ? <p className="text-sm text-[var(--muted)]">No sales opportunities.</p> : null}</section>
    <BillingPlaceholder />
  </>;
}
