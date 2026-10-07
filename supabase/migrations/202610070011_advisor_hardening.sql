-- KP Duty — advisor hardening
-- Hide RLS helper functions from the exposed public schema, optimize auth checks,
-- and add covering indexes for foreign keys reported by Supabase advisors.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

alter function public.is_active_member() set schema private;
alter function public.is_admin() set schema private;

revoke all on function private.is_active_member() from public, anon, authenticated;
revoke all on function private.is_admin() from public, anon, authenticated;
grant execute on function private.is_active_member() to authenticated;
grant execute on function private.is_admin() to authenticated;

-- Avoid re-evaluating auth.uid() for every candidate row.
alter policy "active team can create tasks"
on public.tasks
with check (
  (select private.is_active_member())
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

alter policy "active team create opportunities"
on public.opportunities
with check (
  (select private.is_active_member())
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

alter policy "active team create projects"
on public.projects
with check (
  (select private.is_active_member())
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

alter policy "active team append activity"
on public.activity_events
with check (
  (select private.is_active_member())
  and (
    actor_user_id is null
    or actor_user_id = (select auth.uid())
  )
);

alter policy "active team create decisions"
on public.decisions
with check (
  (select private.is_active_member())
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

-- Cover foreign-key columns used by joins/deletes and future CRM/activity growth.
create index if not exists activity_events_actor_user_id_idx
  on public.activity_events (actor_user_id);
create index if not exists activity_events_business_id_idx
  on public.activity_events (business_id);
create index if not exists activity_events_person_id_idx
  on public.activity_events (person_id);
create index if not exists activity_events_task_id_idx
  on public.activity_events (task_id);

create index if not exists decisions_business_id_idx
  on public.decisions (business_id);
create index if not exists decisions_created_by_idx
  on public.decisions (created_by);
create index if not exists decisions_updated_by_idx
  on public.decisions (updated_by);

create index if not exists external_links_business_id_idx
  on public.external_links (business_id);

create index if not exists inbox_events_business_id_idx
  on public.inbox_events (business_id);

create index if not exists opportunities_business_id_idx
  on public.opportunities (business_id);
create index if not exists opportunities_stage_id_idx
  on public.opportunities (stage_id);
create index if not exists opportunities_created_by_idx
  on public.opportunities (created_by);
create index if not exists opportunities_updated_by_idx
  on public.opportunities (updated_by);

create index if not exists opportunity_people_person_id_idx
  on public.opportunity_people (person_id);

create index if not exists outbox_events_business_id_idx
  on public.outbox_events (business_id);

create index if not exists projects_created_by_idx
  on public.projects (created_by);
create index if not exists projects_opportunity_id_idx
  on public.projects (opportunity_id);
create index if not exists projects_updated_by_idx
  on public.projects (updated_by);

create index if not exists relationships_owner_id_idx
  on public.relationships (owner_id);

create index if not exists tasks_created_by_idx
  on public.tasks (created_by);
create index if not exists tasks_updated_by_idx
  on public.tasks (updated_by);
