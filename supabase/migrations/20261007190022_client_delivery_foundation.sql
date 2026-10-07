-- Additive staff-only delivery module. Client access is intentionally closed.
create table public.client_engagements (
 id uuid primary key references public.projects(id) on delete restrict,
 service text not null check(service in ('website','branding','less_office','care','snd')),
 template_version integer not null default 1 check(template_version=1),
 revision integer not null default 1,
 answers jsonb not null default '{}' check(jsonb_typeof(answers)='object'),
 submitted_at timestamptz,
 onboarding_reviewed boolean not null default false,
 scope_approved boolean not null default false,
 payment_required boolean not null default true,
 payment_evidence text,
 access_ready boolean not null default false,
 capacity_ready boolean not null default false,
 started_at timestamptz,
 started_by uuid references public.profiles(id),
 updated_at timestamptz not null default now()
);
create table public.client_engagement_history (
 id uuid primary key default gen_random_uuid(),
 engagement_id uuid not null references public.client_engagements(id),
 revision integer not null,
 snapshot jsonb not null,
 actor_id uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 unique(engagement_id,revision)
);
create index client_engagement_history_actor_idx on public.client_engagement_history(actor_id);
create index client_engagements_started_by_idx on public.client_engagements(started_by);
alter table public.client_engagements enable row level security;
alter table public.client_engagement_history enable row level security;
revoke all on public.client_engagements,public.client_engagement_history from anon,authenticated;
grant select,insert,update on public.client_engagements to authenticated;
grant select on public.client_engagement_history to authenticated;
create policy engagement_read on public.client_engagements for select to authenticated using((select private.is_active_member()));
create policy engagement_insert on public.client_engagements for insert to authenticated with check((select private.is_admin()));
create policy engagement_update on public.client_engagements for update to authenticated using((select private.is_active_member())) with check((select private.is_active_member()));
create policy engagement_history_read on public.client_engagement_history for select to authenticated using((select private.is_active_member()));

create function private.check_client_engagement() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.projects; slug text; required_key text; keys text[];
begin
 if not private.is_active_member() then raise exception 'Active team membership required'; end if;
 select * into p from public.projects where id=new.id and archived_at is null;
 select b.slug into slug from public.businesses b where b.id=p.business_id and b.is_active;
 if p.id is null or p.organization_id is null or slug not in ('solta','snd') then raise exception 'Active business and client company required'; end if;
 if (slug='snd') <> (new.service='snd') then raise exception 'Service does not belong to this business'; end if;
 if tg_op='INSERT' then
  if p.status<>'planned' or new.started_at is not null or new.started_by is not null or new.revision<>1 then raise exception 'New delivery must start in preparation'; end if;
 else
  if new.id<>old.id or new.service<>old.service or new.template_version<>old.template_version then raise exception 'Project and template cannot change'; end if;
  if old.started_at is not null and (new.started_at is distinct from old.started_at or new.started_by is distinct from old.started_by) then raise exception 'Start approval is immutable'; end if;
  if not private.is_admin() and (new.scope_approved is distinct from old.scope_approved or new.payment_required is distinct from old.payment_required or new.payment_evidence is distinct from old.payment_evidence or new.capacity_ready is distinct from old.capacity_ready or new.started_at is distinct from old.started_at or new.started_by is distinct from old.started_by) then raise exception 'Admin approval required'; end if;
  if new.answers is distinct from old.answers then new.onboarding_reviewed=false; if new.submitted_at is not distinct from old.submitted_at then new.submitted_at=null; end if; end if;
  new.revision=old.revision+1;
 end if;
 keys=array['goal','approver_email'];
 if new.service='website' then keys=keys||array['website_pages','content_owner'];
 elsif new.service='branding' then keys=keys||array['audience','brand_deliverables'];
 elsif new.service='less_office' then keys=keys||array['systems','workflow'];
 elsif new.service='care' then keys=keys||array['site_url','care_priorities'];
 else keys=keys||array['systems','agreed_plan','measurement']; end if;
 if new.submitted_at is not null then
  foreach required_key in array keys loop
   if coalesce(length(btrim(new.answers->>required_key)),0)=0 then raise exception 'Complete required onboarding fields before submitting'; end if;
  end loop;
  if (new.answers->>'approver_email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Valid approver email required'; end if;
 end if;
 if new.onboarding_reviewed and new.submitted_at is null then raise exception 'Submit onboarding before review'; end if;
 if new.started_at is not null and (tg_op='INSERT' or old.started_at is null) then
  if not private.is_admin() or new.started_by is distinct from auth.uid() then raise exception 'Admin start approval required'; end if;
  if not(new.scope_approved and new.onboarding_reviewed and new.submitted_at is not null and new.access_ready and new.capacity_ready) or (new.payment_required and coalesce(length(btrim(new.payment_evidence)),0)=0) then raise exception 'Resolve readiness checks before starting delivery'; end if;
  if not exists(select 1 from public.profiles where id=p.owner_id and status='active') then raise exception 'Active project owner required'; end if;
 end if;
 new.updated_at=now(); return new;
end $$;
revoke all on function private.check_client_engagement() from public;
create trigger check_client_engagement before insert or update on public.client_engagements for each row execute function private.check_client_engagement();

create function private.audit_client_engagement() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.is_active_member() then raise exception 'Active member required'; end if;
 insert into public.client_engagement_history(engagement_id,revision,snapshot,actor_id) values(new.id,new.revision,to_jsonb(new),auth.uid());
 return new;
end $$;
revoke all on function private.audit_client_engagement() from public;
create trigger audit_client_engagement after insert or update on public.client_engagements for each row execute function private.audit_client_engagement();

create function private.guard_client_project_start() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.status in ('active','complete') and exists(select 1 from public.client_engagements where id=new.id and started_at is null) then raise exception 'Approve delivery start in the client workspace first'; end if;
 if exists(select 1 from public.client_engagements where id=new.id) and (new.business_id is distinct from old.business_id or new.organization_id is distinct from old.organization_id) then raise exception 'Client delivery business and company cannot change'; end if;
 return new;
end $$;
revoke all on function private.guard_client_project_start() from public;
create trigger guard_client_project_start before update on public.projects for each row execute function private.guard_client_project_start();

create function public.kp_create_client_delivery(p_id uuid,p_business text,p_company uuid,p_name text,p_service text) returns uuid language plpgsql security invoker set search_path='' as $$
declare b uuid; existing public.projects;
begin
 if not private.is_admin() then raise exception 'Admin project setup required'; end if;
 select id into b from public.businesses where slug=p_business and is_active and slug in ('solta','snd');
 if b is null or length(btrim(p_name))=0 then raise exception 'Active business and project name required'; end if;
 select * into existing from public.projects where id=p_id;
 if existing.id is not null then
  if existing.business_id=b and existing.organization_id=p_company and existing.name=p_name and existing.created_by=auth.uid() and exists(select 1 from public.client_engagements where id=p_id and service=p_service) then return p_id; end if;
  raise exception 'Request ID is already used';
 end if;
 insert into public.projects(id,business_id,organization_id,name,owner_id,phase) values(p_id,b,p_company,btrim(p_name),auth.uid(),'Onboarding');
 insert into public.client_engagements(id,service) values(p_id,p_service);
 return p_id;
end $$;
revoke all on function public.kp_create_client_delivery(uuid,text,uuid,text,text) from public,anon;
grant execute on function public.kp_create_client_delivery(uuid,text,uuid,text,text) to authenticated;

create function public.kp_save_client_delivery(p_id uuid,p_revision integer,p_patch jsonb,p_start boolean default false) returns void language plpgsql security invoker set search_path='' as $$
declare e public.client_engagements;
begin
 if not private.is_active_member() then raise exception 'Active team membership required'; end if;
 select * into e from public.client_engagements where id=p_id for update;
 if e.id is null or e.revision<>p_revision then raise exception 'This project changed. Reload before saving.'; end if;
 update public.client_engagements set
 answers=coalesce(p_patch->'answers',answers),
 submitted_at=case when p_patch->>'submit'='true' then now() else submitted_at end,
 onboarding_reviewed=coalesce((p_patch->>'onboarding_reviewed')::boolean,onboarding_reviewed),
 scope_approved=coalesce((p_patch->>'scope_approved')::boolean,scope_approved),
 payment_required=coalesce((p_patch->>'payment_required')::boolean,payment_required),
 payment_evidence=case when p_patch ? 'payment_evidence' then p_patch->>'payment_evidence' else payment_evidence end,
 access_ready=coalesce((p_patch->>'access_ready')::boolean,access_ready),
 capacity_ready=coalesce((p_patch->>'capacity_ready')::boolean,capacity_ready),
 started_at=case when p_start then coalesce(started_at,now()) else started_at end,
 started_by=case when p_start then coalesce(started_by,auth.uid()) else started_by end
 where id=p_id;
 if p_start then update public.projects set status='active',phase='Delivery' where id=p_id; end if;
end $$;
revoke all on function public.kp_save_client_delivery(uuid,integer,jsonb,boolean) from public,anon;
grant execute on function public.kp_save_client_delivery(uuid,integer,jsonb,boolean) to authenticated;
