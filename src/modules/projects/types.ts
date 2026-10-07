export type ProjectStatus =
  | "planned"
  | "active"
  | "waiting"
  | "blocked"
  | "complete"
  | "cancelled";

export type ProjectHealth =
  | "on_track"
  | "needs_attention"
  | "at_risk"
  | "complete";

export type ProjectRecord = {
  id: string;
  name: string;
  status: ProjectStatus;
  phase: string | null;
  health: ProjectHealth;
  next_milestone: string | null;
  next_milestone_at: string | null;
  source_system: string;
  external_record_id: string | null;
  external_project_url: string | null;
  sync_status: "manual" | "pending" | "synced" | "error";
  last_synced_at: string | null;
  business: {
    id: string;
    slug: string;
    name: string;
  };
  organization: {
    id: string;
    name: string;
  } | null;
  owner: {
    id: string;
    display_name: string | null;
  } | null;
};

export type ActivityEvent = {
  id: string;
  event_type: string;
  source: string;
  summary: string;
  occurred_at: string;
  metadata: Record<string, unknown>;
  business: {
    id: string;
    slug: string;
    name: string;
  } | null;
  actor: {
    id: string;
    display_name: string | null;
  } | null;
  organization: {
    id: string;
    name: string;
  } | null;
  project_id: string | null;
  opportunity_id: string | null;
  task_id: string | null;
  decision_id: string | null;
};
