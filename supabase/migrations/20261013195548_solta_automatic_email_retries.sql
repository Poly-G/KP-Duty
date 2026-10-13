-- Disabled until the production worker is deployed and the QA scheduler is activated.
create extension if not exists pg_net with schema extensions;
create table public.solta_email_scheduler (
 id text primary key check(id='solta'), enabled boolean not null default false,
 last_scan_at timestamptz, last_started_at timestamptz, last_completed_at timestamptz,
 lease_id uuid, lease_until timestamptz, error_code text, request_id bigint
);
insert into public.solta_email_scheduler(id) values('solta');
alter table public.solta_email_scheduler enable row level security;
revoke all on public.solta_email_scheduler from public,anon,authenticated,service_role;
grant select on public.solta_email_scheduler to authenticated;
create policy solta_scheduler_admin_read on public.solta_email_scheduler for select to authenticated using((select private.is_admin()));
create table private.solta_email_tick_tokens (token_hash text primary key,expires_at timestamptz not null);
alter table private.solta_email_tick_tokens enable row level security;
revoke all on private.solta_email_tick_tokens from public,anon,authenticated,service_role;

create function private.next_solta_email_project() returns uuid language sql stable security invoker set search_path='' as $$
 select q.project_id from public.solta_notification_events q
 join public.solta_portal_project_links l on l.project_id=q.project_id
 join public.projects p on p.id=q.project_id join public.organizations o on o.id=p.organization_id
 join public.businesses b on b.id=p.business_id join public.solta_notification_control c on c.id='solta'
 where q.status in ('pending','sending') and q.error_code is distinct from 'DELIVERY_NEEDS_REVIEW'
 and q.next_attempt_at<=now() and (q.lease_until is null or q.lease_until<now())
 and l.enabled and l.organization_id=p.organization_id and b.slug='solta' and b.is_active
 and p.archived_at is null and o.archived_at is null and c.enabled
 and (c.allow_all_projects or c.allowed_projects @> jsonb_build_array(q.project_id::text))
 and (q.event_kind not in ('message.shared','progress.published','file.shared','preview.published','scope.published') or c.client_updates_enabled)
 and (q.event_kind<>'scope.published' or exists(
 select 1 from public.project_scope_versions s join public.solta_portal_scope_publications u on u.scope_id=s.id and u.project_id=s.project_id
 where s.id=q.source_id and s.project_id=q.project_id and s.version=(select max(v.version) from public.project_scope_versions v where v.project_id=q.project_id)))
 order by q.next_attempt_at,q.created_at,q.id limit 1
$$;
revoke all on function private.next_solta_email_project() from public,anon,authenticated,service_role;

-- A fixed destination and short-lived, single-use token; no stored API credential.
create function private.tick_solta_emails() returns void language plpgsql security definer set search_path='' as $$
declare s public.solta_email_scheduler; token uuid; request bigint;
begin
 select * into s from public.solta_email_scheduler where id='solta' for update;
 if not s.enabled then return;end if;
 update public.solta_email_scheduler set last_scan_at=now() where id='solta';
 if exists(select 1 from net._http_response r where r.id=s.request_id and (r.status_code is distinct from 200 or r.timed_out or r.error_msg is not null)) then
  update public.solta_email_scheduler set error_code='EMAIL_RETRY_UNAVAILABLE' where id='solta';
 end if;
 delete from private.solta_email_tick_tokens where expires_at<=now();
 if s.lease_until>now() or exists(select 1 from private.solta_email_tick_tokens) or private.next_solta_email_project() is null then return;end if;
 token:=gen_random_uuid();
 insert into private.solta_email_tick_tokens values(encode(sha256(convert_to(token::text,'UTF8')),'hex'),now()+interval '10 minutes');
 select net.http_post(url:='https://kp-duty.vercel.app/api/integrations/solta/notifications/retry',body:='{}'::jsonb,
 headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||token::text),timeout_milliseconds:=250000) into request;
 update public.solta_email_scheduler set request_id=request where id='solta';
end $$;
revoke all on function private.tick_solta_emails() from public,anon,authenticated,service_role;

create function private.begin_solta_email_tick(p_token uuid,p_lease uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.solta_email_scheduler; project uuid;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' or p_token is null or p_lease is null then raise exception 'Integration role required';end if;
 select * into s from public.solta_email_scheduler where id='solta' for update;
 if not s.enabled then raise exception 'Scheduler disabled';end if;
 delete from private.solta_email_tick_tokens where token_hash=encode(sha256(convert_to(p_token::text,'UTF8')),'hex') and expires_at>now();
 if not found then raise exception 'Invalid tick';end if;
 if s.lease_until>now() then return null;end if;
 project:=private.next_solta_email_project();
 if project is null then return null;end if;
 update public.solta_email_scheduler set lease_id=p_lease,lease_until=now()+interval '5 minutes',last_started_at=now(),error_code=null where id='solta';
 return project;
end $$;
create function public.kp_begin_solta_email_tick(p_token uuid,p_lease uuid) returns uuid language sql security invoker set search_path='' as $$select private.begin_solta_email_tick(p_token,p_lease)$$;
create function private.finish_solta_email_tick(p_lease uuid,p_ok boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Integration role required';end if;
 update public.solta_email_scheduler set lease_id=null,lease_until=null,last_completed_at=now(),error_code=case when p_ok then null else 'EMAIL_RETRY_UNAVAILABLE' end where id='solta' and lease_id=p_lease;
end $$;
create function public.kp_finish_solta_email_tick(p_lease uuid,p_ok boolean) returns void language sql security invoker set search_path='' as $$select private.finish_solta_email_tick(p_lease,p_ok)$$;
revoke all on function private.begin_solta_email_tick(uuid,uuid),public.kp_begin_solta_email_tick(uuid,uuid),private.finish_solta_email_tick(uuid,boolean),public.kp_finish_solta_email_tick(uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function private.begin_solta_email_tick(uuid,uuid),public.kp_begin_solta_email_tick(uuid,uuid),private.finish_solta_email_tick(uuid,boolean),public.kp_finish_solta_email_tick(uuid,boolean) to service_role;

-- Preserve scope supersession and enforce the client-update switch on every claim.
create or replace function private.claim_solta_notifications(p_project uuid,p_lease uuid) returns setof public.solta_notification_events language plpgsql security definer set search_path='' as $$
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' or p_project is null or p_lease is null then raise exception 'Integration role required';end if;
 -- A newer private draft makes an old review email obsolete too.
 update public.solta_notification_events e set status='skipped',error_code='SCOPE_SUPERSEDED',lease_id=null,lease_until=null
 where e.project_id=p_project and e.event_kind='scope.published' and e.status in ('pending','sending')
 and (e.lease_until is null or e.lease_until<now()) and not exists(
  select 1 from public.project_scope_versions s join public.solta_portal_scope_publications u on u.scope_id=s.id and u.project_id=s.project_id
  where s.id=e.source_id and s.project_id=e.project_id and s.version=(select max(v.version) from public.project_scope_versions v where v.project_id=e.project_id)
 );
 return query
 update public.solta_notification_events e set status='sending',lease_id=p_lease,lease_until=now()+interval '5 minutes',attempts=e.attempts+1
 where e.id in (
  select q.id from public.solta_notification_events q
  join public.solta_portal_project_links l on l.project_id=q.project_id
  join public.projects p on p.id=q.project_id join public.organizations o on o.id=p.organization_id join public.businesses b on b.id=p.business_id
  where q.project_id=p_project and q.status in ('pending','sending') and q.error_code is distinct from 'DELIVERY_NEEDS_REVIEW' and q.next_attempt_at<=now() and (q.lease_until is null or q.lease_until<now())
  and l.enabled and l.organization_id=p.organization_id and b.slug='solta' and b.is_active and p.archived_at is null and o.archived_at is null
  and exists(select 1 from public.solta_notification_control c where c.id='solta' and c.enabled and (c.allow_all_projects or c.allowed_projects @> jsonb_build_array(p_project::text)))
  and (q.event_kind not in ('message.shared','progress.published','file.shared','preview.published','scope.published') or exists(select 1 from public.solta_notification_control c where c.id='solta' and c.client_updates_enabled))
  and (q.event_kind<>'scope.published' or (exists(select 1 from public.solta_notification_control c where c.id='solta' and c.client_updates_enabled) and exists(
   select 1 from public.project_scope_versions s join public.solta_portal_scope_publications u on u.scope_id=s.id and u.project_id=s.project_id
   where s.id=q.source_id and s.project_id=q.project_id and s.version=(select max(v.version) from public.project_scope_versions v where v.project_id=q.project_id)
  )))
  order by q.created_at limit 5 for update of q skip locked
 ) returning e.*;
end;
$$;
