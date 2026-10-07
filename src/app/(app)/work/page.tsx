import { NewTaskForm } from "@/components/work/new-task-form";
import { PageHeading } from "@/components/page-heading";
import { WorkBoard } from "@/components/work/work-board";
import { getWorkOptions, listMyWork } from "@/modules/work/queries";

export default async function WorkPage() {
  const [tasks, options] = await Promise.all([
    listMyWork(),
    getWorkOptions(),
  ]);

  return (
    <>
      <PageHeading
        eyebrow="Work"
        title="What are you doing?"
        description="Only actionable To Do and Working items stay on the main board. Finished work disappears; Waiting and Blocked stay separate."
      />

      <NewTaskForm
        businesses={options.businesses}
        profiles={options.profiles}
        isAdmin={options.isAdmin}
        currentUserId={options.currentUserId}
      />

      <WorkBoard
        initialTasks={tasks}
        profiles={options.profiles}
        canAssign={options.isAdmin}
      />
    </>
  );
}
