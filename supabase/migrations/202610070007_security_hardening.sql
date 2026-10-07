-- KP Duty — Security hardening
-- Supabase public-schema defaults grant broad privileges to authenticated users.
-- Reset grants explicitly so RLS is defense-in-depth, not the only boundary.

revoke all on table
  public.profiles,
  public.businesses,
  public.tasks,
  public.organizations,
  public.people,
  public.relationships,
  public.pipelines,
  public.pipeline_stages,
  public.opportunities,
  public.opportunity_people,
  public.projects,
  public.activity_events,
  public.external_links,
  public.inbox_events,
  public.outbox_events,
  public.integration_action_requests,
  public.decisions
from anon, authenticated;

-- Team/profile registry
grant select, update on public.profiles to authenticated;

-- Portfolio configuration
grant select, insert, update, delete on public.businesses to authenticated;

-- Shared work
grant select, insert, update, delete on public.tasks to authenticated;

-- CRM
grant select, insert, update, delete on
  public.organizations,
  public.people,
  public.relationships,
  public.pipelines,
  public.pipeline_stages,
  public.opportunities,
  public.opportunity_people
to authenticated;

-- Projects
grant select, insert, update, delete on public.projects to authenticated;

-- Business activity is append-only for humans
grant select, insert on public.activity_events to authenticated;

-- Integration mapping can be configured by admins through RLS
grant select, insert, update, delete on public.external_links to authenticated;

-- Integration processing queues and replay ledger are human-readable only.
-- Future controlled workers use server-side credentials/service boundaries.
grant select on
  public.inbox_events,
  public.outbox_events,
  public.integration_action_requests
to authenticated;

-- Decisions
grant select, insert, update, delete on public.decisions to authenticated;

-- Helper functions callable from RLS policies only by authenticated users.
revoke all on function public.is_active_member() from public, anon;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_active_member() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- Trigger-only functions should not be exposed as ordinary RPC surface.
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.set_task_audit_fields() from public, anon, authenticated;
revoke all on function public.validate_opportunity_pipeline() from public, anon, authenticated;
revoke all on function public.set_opportunity_audit_fields() from public, anon, authenticated;
revoke all on function public.set_project_audit_fields() from public, anon, authenticated;
revoke all on function public.log_task_activity() from public, anon, authenticated;
revoke all on function public.log_opportunity_activity() from public, anon, authenticated;
revoke all on function public.log_project_activity() from public, anon, authenticated;
revoke all on function public.set_decision_audit_fields() from public, anon, authenticated;
revoke all on function public.log_decision_activity() from public, anon, authenticated;
