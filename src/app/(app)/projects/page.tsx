import {firstSearchValue,type SearchValue} from '@/lib/ui/search-params';
import {notFound} from 'next/navigation';
import { PageHeading } from "@/components/page-heading";
import { NewProjectForm } from "@/components/projects/new-project-form";
import { ProjectGrid } from "@/components/projects/project-grid";
import {
  listProjectFormOptions,
  listProjects,
} from "@/modules/projects/queries";

export default async function ProjectsPage({searchParams}:{searchParams:Promise<{business?:SearchValue}>}) {
  const business=firstSearchValue((await searchParams).business);
  if(business&&!['solta','snd','nex'].includes(business))notFound();
  const [allProjects, options] = await Promise.all([
    listProjects(),
    listProjectFormOptions(),
  ]);

  const projects=business?allProjects.filter(project=>project.business.slug===business):allProjects;
  const businessName=options.businesses.find(item=>item.slug===business)?.name;
  return (
    <>
      <PageHeading
        eyebrow="Projects"
        title={businessName?`${businessName} projects`:"What is happening across KP?"}
        description="KP keeps the high-level state. Detailed delivery stays inside Solta, SnD, or Nex and links back from each card."
      />

      <NewProjectForm
        businesses={business?options.businesses.filter(item=>item.slug===business):options.businesses}
        organizations={options.organizations}
      />

      <ProjectGrid key={JSON.stringify(projects)} initialProjects={projects} />
    </>
  );
}
