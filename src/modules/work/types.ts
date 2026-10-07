export type TaskStage = "todo" | "working" | "finished";
export type TaskAvailability = "yes" | "waiting" | "blocked" | "parked";
export type TaskPriority = "critical" | "high" | "normal" | "low";

export type WorkTask = {
  id: string;
  reference_code: string | null;
  title: string;
  what_this_is: string | null;
  why_it_matters: string | null;
  instructions: string | null;
  notes: string | null;
  owner_id: string | null;
  stage: TaskStage;
  availability: TaskAvailability;
  priority: TaskPriority;
  due_at: string | null;
  next_action: string | null;
  finished_when: string | null;
  waiting_on: string | null;
  reference_url: string | null;
  position: number;
  finished_at: string | null;
  business: {
    id: string;
    slug: string;
    name: string;
  } | null;
};

export type TeamWorkTask = WorkTask & {
  owner: {
    id: string;
    display_name: string | null;
  } | null;
};

export const priorityRank: Record<TaskPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export function sortWorkTasks<T extends WorkTask>(tasks: T[]) {
  return [...tasks].sort((a, b) => {
    const byPriority = priorityRank[a.priority] - priorityRank[b.priority];
    if (byPriority !== 0) return byPriority;

    if (a.due_at && b.due_at) {
      return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
    }
    if (a.due_at) return -1;
    if (b.due_at) return 1;

    return a.position - b.position;
  });
}
