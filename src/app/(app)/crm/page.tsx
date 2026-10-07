import { EmptyPanel } from "@/components/empty-panel";
import { PageHeading } from "@/components/page-heading";

const areas = [
  ["Companies", "One canonical organization record across KP."],
  ["People", "Individual contacts linked to organizations."],
  ["Solta", "Solta-specific relationships and opportunities."],
  ["SnD", "Sent & Delivered relationships and opportunities."],
  ["Nex", "Nex relationships remain visible while Nex is parked."],
] as const;

export default function CrmPage() {
  return (
    <>
      <PageHeading
        eyebrow="CRM"
        title="One relationship system"
        description="Companies and people exist once. Business-specific relationships and opportunities sit on top instead of creating duplicates."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {areas.map(([title, description]) => (
          <EmptyPanel key={title} title={title} description={description} />
        ))}
      </div>
    </>
  );
}
