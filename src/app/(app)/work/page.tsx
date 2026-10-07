import { PageHeading } from "@/components/page-heading";
import { WorkBoard } from "@/components/work/work-board";
import { listMyWork } from "@/modules/work/queries";

export default async function WorkPage() {
  const tasks = await listMyWork();

  return (
    <>
      <PageHeading
        eyebrow="Work"
        title="What are you doing?"
        description="Only actionable To Do and Working items stay on the main board. Finished work disappears; Waiting and Blocked stay separate."
      />
      <WorkBoard key={JSON.stringify(tasks)} initialTasks={tasks} />
    </>
  );
}
