import { EmptyPanel } from "@/components/empty-panel";
import { PageHeading } from "@/components/page-heading";

export default function DecisionsPage() {
  return (
    <>
      <PageHeading
        eyebrow="Decisions"
        title="Shared decisions without meeting clutter"
        description="Material KP decisions live here with an owner, context, recommendation and final resolution."
      />
      <EmptyPanel
        title="Decision shell ready"
        description="The live decision model is wired after Work + CRM foundations are stable."
      />
    </>
  );
}
