-- KP Duty — Decisions module

create type public.decision_mode as enum ('individual', 'joint');
create type public.decision_status as enum (
  'open', 'discussing', 'deferred', 'resolved', 'superseded'
);

create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete set null,
  title text not null,
  domain text,
  mode public.decision_mode not null default 'joint',
  owner_id uuid not null references public.profiles(id) on delete restrict,
  status public.decision_status not null default 'open',
  priority public.task_priority not null default 'normal',
  needed_by date,
  context text,
  recommendation text,
  final_decision text,
  effective_date date,
  revisit_trigger text,
  resolved_at timestamptz,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  updated_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint decisions_title_not_blank check (btrim(title) <> ''),
  constraint decisions_resolved_has_outcome check (
    status <> 'resolved'
    or (final_decision is not null and btrim(final_decision) <> '')
  )
);

create index decisions_status_priority_idx
  on public.decisions (status, priority, needed_by);

create index decisions_owner_idx
  on public.decisions (owner_id, status);

create or replace function public.set_decision_audit_fields()
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

  if new.status = 'resolved' and old.status is distinct from 'resolved' then
    new.resolved_at = now();
  elsif new.status <> 'resolved' then
    new.resolved_at = null;
  end if;

  return new;
end;
$$;

create trigger decisions_set_audit_fields
before update on public.decisions
for each row execute function public.set_decision_audit_fields();

create or replace function public.log_decision_activity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activity_events (
      event_type, business_id, actor_user_id, summary, metadata
    )
    values (
      'decision.created',
      new.business_id,
      auth.uid(),
      'Decision opened: ' || new.title,
      jsonb_build_object('mode', new.mode, 'priority', new.priority)
    );
  elsif old.status is distinct from new.status then
    insert into public.activity_events (
      event_type, business_id, actor_user_id, summary, metadata
    )
    values (
      'decision.status_changed',
      new.business_id,
      auth.uid(),
      case
        when new.status = 'resolved' then 'Decision resolved: ' || new.title
        else 'Decision moved to ' || new.status::text || ': ' || new.title
      end,
      jsonb_build_object('from', old.status, 'to', new.status)
    );
  end if;

  return new;
end;
$$;

create trigger decisions_log_activity
after insert or update of status on public.decisions
for each row execute function public.log_decision_activity();

alter table public.decisions enable row level security;

revoke all on public.decisions from anon;
grant select, insert, update, delete on public.decisions to authenticated;

create policy "active team read decisions"
on public.decisions for select to authenticated
using (public.is_active_member());

create policy "active team create decisions"
on public.decisions for insert to authenticated
with check (
  public.is_active_member()
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

create policy "active team update decisions"
on public.decisions for update to authenticated
using (public.is_active_member())
with check (public.is_active_member());

create policy "admins delete decisions"
on public.decisions for delete to authenticated
using (public.is_admin());
