-- Immutable scope snapshots and evidence; existing approved starts are preserved.
alter table public.client_engagements add column scope_required boolean not null default false;
alter table public.client_engagements alter column scope_required set default true;
create table public.project_scope_versions (
 id uuid primary key,
 project_id uuid not null references public.client_engagements(id),
 version integer not null check(version>0),
 deliverables text not null check(length(btrim(deliverables)) between 5 and 10000),
 exclusions text not null check(length(btrim(exclusions)) between 5 and 10000),
 commercial_terms text not null check(length(btrim(commercial_terms)) between 5 and 10000),
 timing text not null check(length(btrim(timing)) between 5 and 10000),
 change_reason text not null check(length(btrim(change_reason)) between 5 and 2000),
 created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 unique(project_id,version)
);
create table public.project_scope_approvals (
 scope_id uuid primary key references public.project_scope_versions(id),
 client_name text not null check(length(btrim(client_name)) between 1 and 200),
 client_email text not null check(client_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' and length(client_email)<=320),
 evidence text not null check(length(btrim(evidence)) between 5 and 10000),
 recorded_by uuid not null references public.profiles(id),
 recorded_at timestamptz not null default now()
);
create index project_scope_versions_creator_idx on public.project_scope_versions(created_by);
create index project_scope_approvals_recorder_idx on public.project_scope_approvals(recorded_by);
alter table public.project_scope_versions enable row level security;
alter table public.project_scope_approvals enable row level security;
revoke all on public.project_scope_versions,public.project_scope_approvals from public,anon,authenticated;
grant select on public.project_scope_versions,public.project_scope_approvals to authenticated;
create policy scope_staff_read on public.project_scope_versions for select to authenticated using((select private.is_active_member()));
create policy scope_approval_staff_read on public.project_scope_approvals for select to authenticated using((select private.is_active_member()));

create function private.current_scope_approved(p_project uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.project_scope_versions s join public.project_scope_approvals a on a.scope_id=s.id where s.project_id=p_project and s.version=(select max(v.version) from public.project_scope_versions v where v.project_id=p_project));
$$;
revoke all on function private.current_scope_approved(uuid) from public,anon;
grant execute on function private.current_scope_approved(uuid) to authenticated;

-- Definer writes only to append-only tables unavailable to direct API mutations.
create function private.save_scope(p_id uuid,p_project uuid,p_expected integer,p_deliverables text,p_exclusions text,p_terms text,p_timing text,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare existing public.project_scope_versions; e public.client_engagements; current_version integer;
begin
 if auth.uid() is null or not private.is_admin() then raise exception 'Admin scope preparation required'; end if;
 select * into e from public.client_engagements where id=p_project for update;
 if e.id is null or not exists(select 1 from public.projects where id=p_project and archived_at is null) then raise exception 'Active client project required'; end if;
 select * into existing from public.project_scope_versions where id=p_id;
 if found then
  if existing.project_id=p_project and existing.version=p_expected+1 and existing.created_by=auth.uid() and existing.deliverables=p_deliverables and existing.exclusions=p_exclusions and existing.commercial_terms=p_terms and existing.timing=p_timing and existing.change_reason=p_reason then return p_id; end if;
  raise exception 'Scope retry mismatch';
 end if;
 select coalesce(max(version),0) into current_version from public.project_scope_versions where project_id=p_project;
 if current_version is distinct from p_expected then raise exception 'Scope changed. Reload before saving.'; end if;
 insert into public.project_scope_versions(id,project_id,version,deliverables,exclusions,commercial_terms,timing,change_reason,created_by) values(p_id,p_project,current_version+1,p_deliverables,p_exclusions,p_terms,p_timing,p_reason,auth.uid());
 update public.client_engagements set scope_required=true,scope_approved=false where id=p_project;
 return p_id;
end $$;
revoke all on function private.save_scope(uuid,uuid,integer,text,text,text,text,text) from public,anon;
grant execute on function private.save_scope(uuid,uuid,integer,text,text,text,text,text) to authenticated;
create function public.kp_save_scope(p_id uuid,p_project uuid,p_expected integer,p_deliverables text,p_exclusions text,p_terms text,p_timing text,p_reason text) returns uuid language sql security invoker set search_path='' as $$
 select private.save_scope(p_id,p_project,p_expected,p_deliverables,p_exclusions,p_terms,p_timing,p_reason);
$$;
revoke all on function public.kp_save_scope(uuid,uuid,integer,text,text,text,text,text) from public,anon;
grant execute on function public.kp_save_scope(uuid,uuid,integer,text,text,text,text,text) to authenticated;

create function private.approve_scope(p_scope uuid,p_client_name text,p_client_email text,p_evidence text) returns void language plpgsql security definer set search_path='' as $$
declare s public.project_scope_versions; a public.project_scope_approvals; e public.client_engagements;
begin
 if auth.uid() is null or not private.is_admin() then raise exception 'Admin scope approval required'; end if;
 select * into s from public.project_scope_versions where id=p_scope;
 if s.id is null then raise exception 'Scope not found'; end if;
 select * into e from public.client_engagements where id=s.project_id for update;
 if not exists(select 1 from public.projects where id=s.project_id and archived_at is null) then raise exception 'Active client project required'; end if;
 if s.version<>(select max(version) from public.project_scope_versions where project_id=s.project_id) then raise exception 'Only current scope can be approved'; end if;
 select * into a from public.project_scope_approvals where scope_id=p_scope;
 if found then
  if a.recorded_by=auth.uid() and a.client_name=p_client_name and a.client_email=p_client_email and a.evidence=p_evidence then return; end if;
  raise exception 'Approval evidence is immutable';
 end if;
 insert into public.project_scope_approvals(scope_id,client_name,client_email,evidence,recorded_by) values(p_scope,p_client_name,p_client_email,p_evidence,auth.uid());
 update public.client_engagements set scope_approved=true where id=s.project_id;
end $$;
revoke all on function private.approve_scope(uuid,text,text,text) from public,anon;
grant execute on function private.approve_scope(uuid,text,text,text) to authenticated;
create function public.kp_approve_scope(p_scope uuid,p_client_name text,p_client_email text,p_evidence text) returns void language sql security invoker set search_path='' as $$
 select private.approve_scope(p_scope,p_client_name,p_client_email,p_evidence);
$$;
revoke all on function public.kp_approve_scope(uuid,text,text,text) from public,anon;
grant execute on function public.kp_approve_scope(uuid,text,text,text) to authenticated;

create function private.guard_scope_readiness() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' and old.started_at is null then new.scope_required=true; end if;
 if tg_op='INSERT' and not new.scope_required then raise exception 'New projects require versioned scope'; end if;
 if tg_op='UPDATE' and old.scope_required and not new.scope_required then raise exception 'Versioned scope cannot be disabled'; end if;
 if new.scope_required and new.scope_approved and not private.current_scope_approved(new.id) then raise exception 'Record current scope approval with client evidence first'; end if;
 if tg_op='UPDATE' and old.started_at is null and new.started_at is not null and new.scope_required and not private.current_scope_approved(new.id) then raise exception 'Approve current scope before delivery starts'; end if;
 return new;
end $$;
revoke all on function private.guard_scope_readiness() from public;
create trigger zz_guard_scope_readiness before insert or update on public.client_engagements for each row execute function private.guard_scope_readiness();
create or replace function private.guard_client_project_start() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.status in ('active','complete') and exists(select 1 from public.client_engagements where id=new.id and started_at is null) then raise exception 'Approve delivery start in the client workspace first'; end if;
 if exists(select 1 from public.client_engagements where id=new.id) and (new.business_id is distinct from old.business_id or new.organization_id is distinct from old.organization_id) then raise exception 'Client delivery business and company cannot change'; end if;
 if (new.status is distinct from old.status or new.phase is distinct from old.phase) and new.status in ('active','complete') and exists(select 1 from public.client_engagements where id=new.id and scope_required) and not private.current_scope_approved(new.id) then raise exception 'Approve current scope before advancing delivery'; end if;
 return new;
end $$;
