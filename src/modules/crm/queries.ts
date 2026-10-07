import { createClient } from "@/lib/supabase/server";
import type {
  BusinessPipeline,
  Opportunity,
  Organization,
  Person,
  PipelineStage,
} from "./types";

export async function listOrganizations(): Promise<Organization[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select(
      "id,name,website,domain,phone,public_email,city,state,country,description",
    )
    .is("archived_at", null)
    .order("name");

  if (error) throw new Error(`Unable to load companies: ${error.message}`);
  return (data ?? []) as unknown as Organization[];
}

export async function listPeople(): Promise<Person[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("people")
    .select(
      "id,first_name,last_name,email,phone,title,organization:organizations(id,name)",
    )
    .is("archived_at", null)
    .order("first_name");

  if (error) throw new Error(`Unable to load people: ${error.message}`);
  return (data ?? []) as unknown as Person[];
}

export async function getBusinessPipeline(
  businessSlug: string,
): Promise<BusinessPipeline | null> {
  const supabase = await createClient();

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id,slug,name,is_active")
    .eq("slug", businessSlug)
    .maybeSingle();

  if (businessError) {
    throw new Error(`Unable to load business: ${businessError.message}`);
  }
  if (!business) return null;

  const { data: pipeline, error: pipelineError } = await supabase
    .from("pipelines")
    .select("id,slug,name")
    .eq("business_id", business.id)
    .eq("is_default", true)
    .is("archived_at", null)
    .maybeSingle();

  if (pipelineError) {
    throw new Error(`Unable to load pipeline: ${pipelineError.message}`);
  }
  if (!pipeline) return null;

  const [{ data: stages, error: stageError }, { data: opportunities, error: oppError }] =
    await Promise.all([
      supabase
        .from("pipeline_stages")
        .select("id,slug,name,position,kind")
        .eq("pipeline_id", pipeline.id)
        .order("position"),
      supabase
        .from("opportunities")
        .select(
          "id,reference_code,name,business_id,pipeline_id,stage_id,organization_id,owner_id,source,source_url,priority,amount_cents,currency,next_action,next_action_at,position,metadata,organization:organizations(id,name),owner:profiles(id,display_name)",
        )
        .eq("pipeline_id", pipeline.id)
        .is("archived_at", null)
        .order("position"),
    ]);

  if (stageError) throw new Error(`Unable to load stages: ${stageError.message}`);
  if (oppError) throw new Error(`Unable to load opportunities: ${oppError.message}`);

  return {
    business: business as BusinessPipeline["business"],
    pipeline: pipeline as BusinessPipeline["pipeline"],
    stages: (stages ?? []) as unknown as PipelineStage[],
    opportunities: (opportunities ?? []) as unknown as Opportunity[],
  };
}
