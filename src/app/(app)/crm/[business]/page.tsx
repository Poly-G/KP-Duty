import { notFound } from "next/navigation";
import { NewOpportunityForm } from "@/components/crm/new-opportunity-form";
import { OpportunityBoard } from "@/components/crm/opportunity-board";
import { PageHeading } from "@/components/page-heading";
import {
  getBusinessPipeline,
  listOrganizations,
} from "@/modules/crm/queries";

const allowedBusinesses = new Set(["solta", "snd", "nex"]);

export default async function BusinessCrmPage({
  params,
}: {
  params: Promise<{ business: string }>;
}) {
  const { business } = await params;
  if (!allowedBusinesses.has(business)) notFound();

  const [board, organizations] = await Promise.all([
    getBusinessPipeline(business),
    listOrganizations(),
  ]);

  if (!board) notFound();

  return (
    <>
      <PageHeading
        eyebrow="CRM"
        title={board.business.name}
        description={
          business === "nex" && !board.business.is_active
            ? "Nex is parked, but the relationship structure is ready when KP reactivates it."
            : "Move opportunities as the relationship changes. The same company record can appear in another KP business without duplication."
        }
      />

      <NewOpportunityForm board={board} organizations={organizations} />

      <OpportunityBoard key={JSON.stringify(board.opportunities)}
        businessSlug={board.business.slug}
        stages={board.stages}
        initialOpportunities={board.opportunities}
      />
    </>
  );
}
