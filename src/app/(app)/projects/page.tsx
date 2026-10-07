import { PageHeading } from "@/components/page-heading";
import { NewProjectForm } from "@/components/projects/new-project-form";
import { ProjectGrid } from "@/components/projects/project-grid";
import {
  listProjectFormOptions,
  listProjects,
} from "@/modules/projects/queries";

export default async function ProjectsPage() {
  const [projects, options] = await Promise.all([
    listProjects(),
    listProjectFormOptions(),
  ]);

  return (
    <>
      <PageHeading
        eyebrow="Projects"
        title="What is happening across KP?"
        description="KP keeps the high-level state. Detailed delivery stays inside Solta, SnD, or Nex and links back from each card."
      />

      <NewProjectForm
        businesses={options.businesses}
        organizations={options.organizations}
      />

      <ProjectGrid key={JSON.stringify(projects)} initialProjects={projects} />
    </>
  );
}
