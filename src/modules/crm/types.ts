import type { TaskPriority } from "@/modules/work/types";

export type Organization = {
  id: string;
  name: string;
  website: string | null;
  domain: string | null;
  phone: string | null;
  public_email: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  description: string | null;
};

export type Person = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  organization: {
    id: string;
    name: string;
  } | null;
};

export type PipelineStage = {
  id: string;
  slug: string;
  name: string;
  position: number;
  kind: "open" | "won" | "lost";
};

export type Opportunity = {
  id: string;
  name: string;
  business_id: string;
  pipeline_id: string;
  stage_id: string;
  organization_id: string | null;
  owner_id: string;
  source: string | null;
  source_url: string | null;
  priority: TaskPriority;
  amount_cents: number | null;
  currency: string;
  next_action: string | null;
  next_action_at: string | null;
  position: number;
  organization: {
    id: string;
    name: string;
  } | null;
  owner: {
    id: string;
    display_name: string | null;
  } | null;
};

export type BusinessPipeline = {
  business: {
    id: string;
    slug: string;
    name: string;
    is_active: boolean;
  };
  pipeline: {
    id: string;
    slug: string;
    name: string;
  };
  stages: PipelineStage[];
  opportunities: Opportunity[];
};
