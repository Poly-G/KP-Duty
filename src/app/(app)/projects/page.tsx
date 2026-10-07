import { EmptyPanel } from "@/components/empty-panel";
import { PageHeading } from "@/components/page-heading";

export default function ProjectsPage() {
  return (
    <>
      <PageHeading
        eyebrow="Projects"
        title="Portfolio-level project visibility"
        description="KP Duty mirrors only the project state KP needs. Detailed delivery stays inside Solta, SnD or Nex."
      />
      <EmptyPanel
        title="No mirrored projects yet"
        description="Gate D adds project cards with business, client, owner, phase, health, next milestone and a link to the detailed business system."
      />
    </>
  );
}
