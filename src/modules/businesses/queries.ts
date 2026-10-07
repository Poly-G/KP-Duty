import { getBusinessPipeline } from "@/modules/crm/queries";
import { listProjects } from "@/modules/projects/queries";

export const businessSlugs = new Set(["solta", "snd", "nex"]);

export async function getBusinessWorkspace(slug: string) {
  const [pipeline, allProjects] = await Promise.all([
    getBusinessPipeline(slug),
    listProjects(),
  ]);
  if (!pipeline) return null;
  const projects = allProjects.filter((project) => project.business.slug === slug);
  const companies = new Map<string, { id: string; name: string; projectCount: number; opportunityCount: number }>();
  for (const project of projects) {
    if (!project.organization) continue;
    const company = companies.get(project.organization.id) ?? { ...project.organization, projectCount: 0, opportunityCount: 0 };
    company.projectCount += 1;
    companies.set(company.id, company);
  }
  for (const opportunity of pipeline.opportunities) {
    if (!opportunity.organization) continue;
    const company = companies.get(opportunity.organization.id) ?? { ...opportunity.organization, projectCount: 0, opportunityCount: 0 };
    company.opportunityCount += 1;
    companies.set(company.id, company);
  }
  return { pipeline, projects, companies: [...companies.values()].sort((a, b) => a.name.localeCompare(b.name)) };
}
