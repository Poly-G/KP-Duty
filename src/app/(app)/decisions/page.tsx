import { DecisionList } from "@/components/decisions/decision-list";
import { NewDecisionForm } from "@/components/decisions/new-decision-form";
import { PageHeading } from "@/components/page-heading";
import {
  listDecisionBusinesses,
  listDecisions,
} from "@/modules/decisions/queries";

import { requireActiveIdentity } from "@/lib/auth/current-user";

export default async function DecisionsPage() {
  const [decisions, businesses, identity] = await Promise.all([
    listDecisions(),
    listDecisionBusinesses(),
    requireActiveIdentity(),
  ]);

  return (
    <>
      <PageHeading
        eyebrow="Decisions"
        title="What needs a decision?"
        description="Keep material choices visible until they are resolved. Routine owner decisions do not need to become committee work."
      />

      <NewDecisionForm businesses={businesses} />
      <DecisionList key={JSON.stringify(decisions)} initialDecisions={decisions} isAdmin={identity.profile.role === "admin"} />
    </>
  );
}
