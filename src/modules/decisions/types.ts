import type { TaskPriority } from "@/modules/work/types";

export type DecisionStatus =
  | "open"
  | "discussing"
  | "deferred"
  | "resolved"
  | "superseded";

export type DecisionRecord = {
  id: string;
  title: string;
  domain: string | null;
  mode: "individual" | "joint";
  status: DecisionStatus;
  priority: TaskPriority;
  needed_by: string | null;
  context: string | null;
  recommendation: string | null;
  final_decision: string | null;
  effective_date: string | null;
  revisit_trigger: string | null;
  resolved_at: string | null;
  business: {
    id: string;
    name: string;
    slug: string;
  } | null;
  owner: {
    id: string;
    display_name: string | null;
  } | null;
};
