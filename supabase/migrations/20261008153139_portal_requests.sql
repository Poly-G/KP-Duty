-- Staff-only portal preparation. No client access, emails or payment authority.
create table public.project_request_policies (
 project_id uuid primary key references public.client_engagements(id),
 revision integer not null default 1,
 feature_rule text not null default 'unconfigured' check(feature_rule in ('unconfigured','included','quote_required')),
 bug_rule text not null default 'unconfigured' check(bug_rule in ('unconfigured','included','quote_required')),
 evidence text not null check(length(btrim(evidence)) between 5 and 10000),
 updated_by uuid not null default auth.uid() references public.profiles(id),
 updated_at timestamptz not null default now()
);
create table public.portal_requests (
 id uuid primary key,
 project_id uuid not null references public.client_engagements(id),
 kind text not null check(kind in ('feature','bug')),
 title text not null check(length(btrim(title)) between 1 and 200),
 details text not null check(length(btrim(details)) between 1 and 10000),
 submitted_by uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now(),
 policy_revision integer not null default 0,
 disposition text not null default 'review_plan' check(disposition in ('review_plan','review_included','review_quote')),
 status text not null default 'submitted' check(status in ('submitted','reviewing','waiting','resolved','declined')),
 response text not null default '' check(length(response)<=10000),
 revision integer not null default 1,
 updated_at timestamptz not null default now()
);
create table public.portal_request_history (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.portal_requests(id),
 revision integer not null,
 snapshot jsonb not null,
 actor_id uuid not null references public.profiles(id),
 created_at timestamptz not null default now(), unique(request_id,revision)
);
create index portal_requests_project_idx on public.portal_requests(project_id,created_at desc);
create index portal_requests_submitter_idx on public.portal_requests(submitted_by);
create index request_policy_actor_idx on public.project_request_policies(updated_by);
create index portal_request_history_actor_idx on public.portal_request_history(actor_id);
create index portal_requests_queue_idx on public.portal_requests(status,created_at desc);
alter table public.project_request_policies enable row level security;
alter table public.portal_requests enable row level security;
alter table public.portal_request_history enable row level security;
revoke all on public.project_request_policies,public.portal_requests,public.portal_request_history from anon,authenticated;
grant select,insert,update on public.project_request_policies to authenticated;
grant select,insert on public.portal_requests to authenticated;
grant update(status,response,revision) on public.portal_requests to authenticated;
grant select on public.portal_request_history to authenticated;
create policy request_policy_read on public.project_request_policies for select to authenticated using((select private.is_active_member()));
create policy request_policy_insert on public.project_request_policies for insert to authenticated with check((select private.is_admin()));
create policy request_policy_update on public.project_request_policies for update to authenticated using((select private.is_admin())) with check((select private.is_admin()));
create policy portal_request_read on public.portal_requests for select to authenticated using((select private.is_active_member()));
create policy portal_request_insert on public.portal_requests for insert to authenticated with check((select private.is_active_member()) and submitted_by=(select auth.uid()));
create policy portal_request_update on public.portal_requests for update to authenticated using((select private.is_admin())) with check((select private.is_admin()));
create policy portal_request_history_read on public.portal_request_history for select to authenticated using((select private.is_active_member()));

create function private.guard_request_policy() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Admin required'; end if;
 if not exists(select 1 from public.projects p join public.businesses b on b.id=p.business_id where p.id=new.project_id and p.archived_at is null and b.is_active and b.slug='solta') then raise exception 'Active Solta project required'; end if;
 if tg_op='UPDATE' then
  if new.project_id<>old.project_id or new.revision<>old.revision+1 then raise exception 'Policy changed; reload'; end if;
 elsif new.revision<>1 then raise exception 'Initial policy revision must be 1'; end if;
 new.updated_by=auth.uid();new.updated_at=now();return new;
end $$;
revoke all on function private.guard_request_policy() from public;
create trigger guard_request_policy before insert or update on public.project_request_policies for each row execute function private.guard_request_policy();

create function private.guard_portal_request() returns trigger language plpgsql security invoker set search_path='' as $$
declare policy public.project_request_policies; rule text;
begin
 if not private.is_active_member() then raise exception 'Active staff required'; end if;
 if not exists(select 1 from public.projects p join public.businesses b on b.id=p.business_id where p.id=new.project_id and p.archived_at is null and b.is_active and b.slug='solta') then raise exception 'Active Solta project required'; end if;
 if tg_op='INSERT' then
  if new.submitted_by<>auth.uid() or new.status<>'submitted' or new.response<>'' or new.revision<>1 then raise exception 'Invalid request submission'; end if;
  select * into policy from public.project_request_policies where project_id=new.project_id for share;
  new.policy_revision=coalesce(policy.revision,0);
  rule=case when new.kind='feature' then policy.feature_rule else policy.bug_rule end;
  new.disposition=case rule when 'included' then 'review_included' when 'quote_required' then 'review_quote' else 'review_plan' end;
  new.created_at=now();
 else
  if not private.is_admin() then raise exception 'Admin review required'; end if;
  if new.id<>old.id or new.project_id<>old.project_id or new.kind<>old.kind or new.title<>old.title or new.details<>old.details or new.submitted_by<>old.submitted_by or new.created_at<>old.created_at or new.policy_revision<>old.policy_revision or new.disposition<>old.disposition then raise exception 'Request submission is immutable'; end if;
  if new.revision<>old.revision+1 then raise exception 'Request changed; reload'; end if;
  if new.status in ('resolved','declined') and length(btrim(new.response))<5 then raise exception 'Explain the review outcome'; end if;
 end if;
 new.updated_at=now();return new;
end $$;
revoke all on function private.guard_portal_request() from public;
create trigger guard_portal_request before insert or update on public.portal_requests for each row execute function private.guard_portal_request();
create function private.audit_portal_request() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.is_active_member() then raise exception 'Active staff required'; end if;
 insert into public.portal_request_history(request_id,revision,snapshot,actor_id) values(new.id,new.revision,to_jsonb(new),auth.uid());return new;
end $$;
revoke all on function private.audit_portal_request() from public;
create trigger audit_portal_request after insert or update on public.portal_requests for each row execute function private.audit_portal_request();
create function public.kp_submit_portal_request(p_id uuid,p_project uuid,p_kind text,p_title text,p_details text) returns uuid language plpgsql security invoker set search_path='' as $$
declare existing public.portal_requests;
begin
 if not private.is_active_member() then raise exception 'Active staff required'; end if;
 insert into public.portal_requests(id,project_id,kind,title,details) values(p_id,p_project,p_kind,btrim(p_title),btrim(p_details)) on conflict(id) do nothing;
 select * into existing from public.portal_requests where id=p_id;
 if existing.id is null or existing.project_id<>p_project or existing.submitted_by<>auth.uid() or existing.kind<>p_kind or existing.title<>btrim(p_title) or existing.details<>btrim(p_details) then raise exception 'Request key already used'; end if;
 return p_id;
end $$;
revoke all on function public.kp_submit_portal_request(uuid,uuid,text,text,text) from public,anon;
grant execute on function public.kp_submit_portal_request(uuid,uuid,text,text,text) to authenticated;

create table public.project_request_policy_history (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.client_engagements(id),
 revision integer not null, snapshot jsonb not null,
 actor_id uuid not null references public.profiles(id),
 created_at timestamptz not null default now(), unique(project_id,revision)
);
create index request_policy_history_actor_idx on public.project_request_policy_history(actor_id);
alter table public.project_request_policy_history enable row level security;
revoke all on public.project_request_policy_history from anon,authenticated;
grant select on public.project_request_policy_history to authenticated;
create policy request_policy_history_read on public.project_request_policy_history for select to authenticated using((select private.is_active_member()));
create function private.audit_request_policy() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.is_admin() then raise exception 'Admin required'; end if;
 insert into public.project_request_policy_history(project_id,revision,snapshot,actor_id) values(new.project_id,new.revision,to_jsonb(new),auth.uid());return new;
end $$;
revoke all on function private.audit_request_policy() from public;
create trigger audit_request_policy after insert or update on public.project_request_policies for each row execute function private.audit_request_policy();
