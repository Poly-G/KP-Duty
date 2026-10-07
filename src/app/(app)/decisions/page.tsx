import { DecisionList } from "@/components/decisions/decision-list";
import { NewDecisionForm } from "@/components/decisions/new-decision-form";
import { PageHeading } from "@/components/page-heading";
import {
  listDecisionBusinesses,
  listDecisions,
} from "@/modules/decisions/queries";

export default async function DecisionsPage() {
  const [decisions, businesses] = await Promise.all([
    listDecisions(),
    listDecisionBusinesses(),
  ]);

  return (
    <>
      <PageHeading
        eyebrow="Decisions"
        title="What needs a decision?"
        description="Keep material choices visible until they are resolved. Routine owner decisions do not need to become committee work."
      />

      <NewDecisionForm businesses={businesses} />
      <DecisionList initialDecisions={decisions} />
    </>
  );
}
