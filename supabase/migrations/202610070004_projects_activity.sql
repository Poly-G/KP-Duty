-- KP Duty — Gate D project mirrors + append-only business activity

create type public.project_status as enum (
  'planned', 'active', 'waiting', 'blocked', 'complete', 'cancelled'
);
create type public.project_health as enum (
  'on_track', 'needs_attention', 'at_risk', 'complete'
);
create type public.project_sync_status as enum (
  'manual', 'pending', 'synced', 'error'
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  organization_id uuid references public.organizations(id) on delete set null,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  name text not null,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  status public.project_status not null default 'planned',
  phase text,
  health public.project_health not null default 'on_track',
  next_milestone text,
  next_milestone_at timestamptz,
  source_system text not null default 'kp',
  external_record_id text,
  external_project_url text,
  sync_status public.project_sync_status not null default 'manual',
  last_synced_at timestamptz,
  archived_at timestamptz,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  updated_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_name_not_blank check (btrim(name) <> ''),
  constraint projects_source_not_blank check (btrim(source_system) <> '')
);

create index projects_business_status_idx
  on public.projects (business_id, status, health)
  where archived_at is null;

create index projects_owner_idx
  on public.projects (owner_id, status)
  where archived_at is null;

create index projects_org_idx
  on public.projects (organization_id)
  where archived_at is null;

create unique index projects_external_record_uq
  on public.projects (source_system, external_record_id)
  where external_record_id is not null and archived_at is null;

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  business_id uuid references public.businesses(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  person_id uuid references public.people(id) on delete set null,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  source text not null default 'kp',
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint activity_event_type_not_blank check (btrim(event_type) <> ''),
  constraint activity_source_not_blank check (btrim(source) <> ''),
  constraint activity_summary_not_blank check (btrim(summary) <> ''),
  constraint activity_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index activity_events_occurred_idx
  on public.activity_events (occurred_at desc);

create index activity_events_org_idx
  on public.activity_events (organization_id, occurred_at desc)
  where organization_id is not null;

create index activity_events_project_idx
  on public.activity_events (project_id, occurred_at desc)
  where project_id is not null;

create index activity_events_opportunity_idx
  on public.activity_events (opportunity_id, occurred_at desc)
  where opportunity_id is not null;

create or replace function public.set_project_audit_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();

  if auth.uid() is not null then
    new.updated_by = auth.uid();
  end if;

  if new.status = 'complete' then
    new.health = 'complete';
  elsif old.status = 'complete' and new.status <> 'complete' and new.health = 'complete' then
    new.health = 'on_track';
  end if;

  return new;
end;
$$;

create trigger projects_set_audit_fields
before update on public.projects
for each row execute function public.set_project_audit_fields();

create or replace function public.log_task_activity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  business_value uuid;
begin
  select business_id into business_value
  from public.tasks
  where id = new.id;

  if tg_op = 'INSERT' then
    insert into public.activity_events (
      event_type, business_id, task_id, actor_user_id, summary, metadata
    )
    values (
      'task.created',
      business_value,
      new.id,
      auth.uid(),
      'Task created: ' || new.title,
      jsonb_build_object('stage', new.stage, 'availability', new.availability)
    );
  elsif old.stage is distinct from new.stage then
    insert into public.activity_events (
      event_type, business_id, task_id, actor_user_id, summary, metadata
    )
    values (
      'task.stage_changed',
      business_value,
      new.id,
      auth.uid(),
      case
        when new.stage = 'finished' then 'Finished task: ' || new.title
        else 'Task moved to ' || new.stage::text || ': ' || new.title
      end,
      jsonb_build_object('from', old.stage, 'to', new.stage)
    );
  end if;

  return new;
end;
$$;

create trigger tasks_log_activity
after insert or update of stage on public.tasks
for each row execute function public.log_task_activity();

create or replace function public.log_opportunity_activity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  old_stage_name text;
  new_stage_name text;
begin
  if tg_op = 'INSERT' then
    select name into new_stage_name
    from public.pipeline_stages
    where id = new.stage_id;

    insert into public.activity_events (
      event_type, business_id, organization_id, opportunity_id,
      actor_user_id, summary, metadata
    )
    values (
      'opportunity.created',
      new.business_id,
      new.organization_id,
      new.id,
      auth.uid(),
      'Opportunity created: ' || new.name,
      jsonb_build_object('stage', new_stage_name)
    );
  elsif old.stage_id is distinct from new.stage_id then
    select name into old_stage_name
    from public.pipeline_stages
    where id = old.stage_id;

    select name into new_stage_name
    from public.pipeline_stages
    where id = new.stage_id;

    insert into public.activity_events (
      event_type, business_id, organization_id, opportunity_id,
      actor_user_id, summary, metadata
    )
    values (
      'opportunity.stage_changed',
      new.business_id,
      new.organization_id,
      new.id,
      auth.uid(),
      new.name || ': ' || coalesce(old_stage_name, 'Unknown') || ' → ' || coalesce(new_stage_name, 'Unknown'),
      jsonb_build_object(
        'from_stage_id', old.stage_id,
        'to_stage_id', new.stage_id,
        'from_stage', old_stage_name,
        'to_stage', new_stage_name
      )
    );
  end if;

  return new;
end;
$$;

create trigger opportunities_log_activity
after insert or update of stage_id on public.opportunities
for each row execute function public.log_opportunity_activity();

create or replace function public.log_project_activity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activity_events (
      event_type, business_id, organization_id, opportunity_id, project_id,
      actor_user_id, source, summary, metadata
    )
    values (
      'project.created',
      new.business_id,
      new.organization_id,
      new.opportunity_id,
      new.id,
      auth.uid(),
      new.source_system,
      'Project created: ' || new.name,
      jsonb_build_object('status', new.status, 'phase', new.phase)
    );
  elsif old.status is distinct from new.status or old.phase is distinct from new.phase then
    insert into public.activity_events (
      event_type, business_id, organization_id, opportunity_id, project_id,
      actor_user_id, source, summary, metadata
    )
    values (
      'project.changed',
      new.business_id,
      new.organization_id,
      new.opportunity_id,
      new.id,
      auth.uid(),
      new.source_system,
      'Project updated: ' || new.name,
      jsonb_build_object(
        'from_status', old.status,
        'to_status', new.status,
        'from_phase', old.phase,
        'to_phase', new.phase
      )
    );
  end if;

  return new;
end;
$$;

create trigger projects_log_activity
after insert or update of status, phase on public.projects
for each row execute function public.log_project_activity();

alter table public.projects enable row level security;
alter table public.activity_events enable row level security;

revoke all on public.projects, public.activity_events from anon;

grant select, insert, update, delete on public.projects to authenticated;
grant select, insert on public.activity_events to authenticated;

create policy "active team read projects"
on public.projects for select to authenticated
using (public.is_active_member());

create policy "active team create projects"
on public.projects for insert to authenticated
with check (
  public.is_active_member()
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

create policy "active team update projects"
on public.projects for update to authenticated
using (public.is_active_member())
with check (public.is_active_member());

create policy "admins delete projects"
on public.projects for delete to authenticated
using (public.is_admin());

create policy "active team read activity"
on public.activity_events for select to authenticated
using (public.is_active_member());

create policy "active team append activity"
on public.activity_events for insert to authenticated
with check (
  public.is_active_member()
  and (actor_user_id is null or actor_user_id = auth.uid())
);

-- No authenticated UPDATE or DELETE grant/policy for activity_events.
-- Business activity is append-only by default.
