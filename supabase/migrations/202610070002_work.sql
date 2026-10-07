-- KP Duty — Gate B work system
-- SnD contribution: explicit next action / owner / waiting state.
-- Atomic contribution: quick completion and movable-card behavior.
-- KP simplification: visible stage is only To Do -> Working -> Finished.

create type public.task_stage as enum ('todo', 'working', 'finished');
create type public.task_availability as enum ('yes', 'waiting', 'blocked', 'parked');
create type public.task_priority as enum ('critical', 'high', 'normal', 'low');

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete restrict,
  title text not null,
  what_this_is text,
  why_it_matters text,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  stage public.task_stage not null default 'todo',
  availability public.task_availability not null default 'yes',
  priority public.task_priority not null default 'normal',
  due_at timestamptz,
  next_action text,
  finished_when text,
  waiting_on text,
  reference_url text,
  position integer not null default 0,
  finished_at timestamptz,
  archived_at timestamptz,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  updated_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_title_not_blank check (btrim(title) <> ''),
  constraint tasks_finished_timestamp check (
    (stage = 'finished' and finished_at is not null)
    or stage <> 'finished'
  )
);

create index tasks_owner_stage_idx
  on public.tasks (owner_id, stage, position)
  where archived_at is null;

create index tasks_owner_availability_idx
  on public.tasks (owner_id, availability, priority)
  where archived_at is null;

create index tasks_business_idx
  on public.tasks (business_id)
  where archived_at is null;

create or replace function public.set_task_audit_fields()
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

  if new.stage = 'finished' and old.stage is distinct from 'finished' then
    new.finished_at = now();
  elsif new.stage <> 'finished' then
    new.finished_at = null;
  end if;

  return new;
end;
$$;

create trigger tasks_set_audit_fields
before update on public.tasks
for each row execute function public.set_task_audit_fields();

alter table public.tasks enable row level security;

revoke all on public.tasks from anon;
grant select, insert, update, delete on public.tasks to authenticated;

create policy "active team can read tasks"
on public.tasks
for select
to authenticated
using (public.is_active_member());

create policy "active team can create tasks"
on public.tasks
for insert
to authenticated
with check (
  public.is_active_member()
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

create policy "active team can update tasks"
on public.tasks
for update
to authenticated
using (public.is_active_member())
with check (public.is_active_member());

create policy "admins can delete tasks"
on public.tasks
for delete
to authenticated
using (public.is_admin());
