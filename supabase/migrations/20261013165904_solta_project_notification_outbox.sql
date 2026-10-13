-- Capture future events only; existing held notification jobs are not replayed.
create table public.solta_notification_control(id text primary key check(id='solta'),enabled boolean not null default false,allow_all_projects boolean not null default false,allowed_projects jsonb not null default '[]'::jsonb check(jsonb_typeof(allowed_projects)='array'));
insert into public.solta_notification_control(id) values('solta');
create table public.solta_notification_events(
 id uuid primary key default gen_random_uuid(),project_id uuid not null references public.client_engagements(id),
 event_kind text not null check(event_kind in ('message.created','file.verified','review.decided','payment.requested','payment.received')),
 source_id uuid not null,payload jsonb not null,status text not null default 'pending' check(status in ('pending','sending','sent')),
 attempts integer not null default 0,next_attempt_at timestamptz not null default now(),lease_id uuid,lease_until timestamptz,
 error_code text,created_at timestamptz not null default now(),sent_at timestamptz,
 unique(event_kind,source_id)
);
create index solta_notifications_pending_idx on public.solta_notification_events(project_id,next_attempt_at) where status<>'sent';
alter table public.solta_notification_control enable row level security;
alter table public.solta_notification_events enable row level security;
revoke all on public.solta_notification_control,public.solta_notification_events from public,anon,authenticated,service_role;
grant select on public.solta_notification_control,public.solta_notification_events to authenticated;
create policy solta_notifications_admin_control on public.solta_notification_control for select to authenticated using((select private.is_admin()));
create policy solta_notifications_staff_read on public.solta_notification_events for select to authenticated using((select private.is_active_member()));
grant select,update on public.solta_notification_events to service_role;
grant select on public.solta_notification_control to service_role;

create function private.queue_solta_notification() returns trigger language plpgsql security definer set search_path='' as $$
declare project uuid;kind text;source uuid;details jsonb;link public.solta_portal_project_links;project_name text;company_name text;review_version integer;review_title text;
begin
 if tg_table_name='solta_portal_messages' then project:=new.project_id;kind:='message.created';source:=new.id;details:=jsonb_build_object('actorName',new.actor_name);
 elsif tg_table_name='solta_portal_files' then
  if new.state<>'ready' or old.state='ready' then return new;end if;
  project:=new.project_id;kind:='file.verified';source:=new.id;details:=jsonb_build_object('label',new.name);
 elsif tg_table_name='solta_portal_decisions' then
  select d.project_id,v.version,d.title into project,review_version,review_title from public.deliverable_versions v join public.project_deliverables d on d.id=v.deliverable_id where v.id=new.version_id;
  kind:='review.decided';source:=new.id;details:=jsonb_build_object('actorName',new.actor_name,'outcome',new.outcome,'versionNumber',review_version,'label',review_title);
 else
  project:=new.project_id;source:=new.id;
  if new.status='paid' and old.status<>'paid' then kind:='payment.received';
  elsif new.status='published' and old.status='prepared' then kind:='payment.requested';
  else return new;end if;
  details:=jsonb_build_object('label',new.title,'amount',new.amount,'livemode',new.livemode);
 end if;
 if not exists(select 1 from public.solta_notification_control c where c.id='solta' and c.enabled and (c.allow_all_projects or c.allowed_projects @> jsonb_build_array(project::text))) then return new;end if;
 select l.* into link from public.solta_portal_project_links l join public.projects p on p.id=l.project_id join public.organizations o on o.id=l.organization_id join public.businesses b on b.id=p.business_id where l.project_id=project and l.enabled and l.organization_id=p.organization_id and b.slug='solta' and b.is_active and p.archived_at is null and o.archived_at is null;
 if not found then return new;end if;
 select p.name,o.name into project_name,company_name from public.projects p join public.organizations o on o.id=p.organization_id where p.id=project;
 insert into public.solta_notification_events(project_id,event_kind,source_id,payload) values(project,kind,source,
  details||jsonb_build_object('projectId',project,'organizationId',link.organization_id,'portalProjectId',link.portal_project_id,'projectName',project_name,'companyName',company_name)) on conflict(event_kind,source_id) do nothing;
 return new;
end $$;
revoke all on function private.queue_solta_notification() from public,anon,authenticated,service_role;
create trigger queue_solta_client_message after insert on public.solta_portal_messages for each row execute function private.queue_solta_notification();
create trigger queue_solta_client_file after update of state on public.solta_portal_files for each row execute function private.queue_solta_notification();
create trigger queue_solta_client_decision after insert on public.solta_portal_decisions for each row execute function private.queue_solta_notification();
create trigger queue_solta_client_payment after update of status on public.solta_payment_requests for each row execute function private.queue_solta_notification();

create function private.claim_solta_notifications(p_project uuid,p_lease uuid) returns setof public.solta_notification_events language plpgsql security definer set search_path='' as $$
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' or p_project is null or p_lease is null then raise exception 'Integration role required';end if;
 return query
 update public.solta_notification_events e set status='sending',lease_id=p_lease,lease_until=now()+interval '5 minutes',attempts=e.attempts+1
 where e.id in (
  select q.id from public.solta_notification_events q
  join public.solta_portal_project_links l on l.project_id=q.project_id
  join public.projects p on p.id=q.project_id join public.organizations o on o.id=p.organization_id join public.businesses b on b.id=p.business_id
  where q.project_id=p_project and q.status<>'sent' and q.error_code is distinct from 'DELIVERY_NEEDS_REVIEW' and q.next_attempt_at<=now() and (q.lease_until is null or q.lease_until<now())
  and l.enabled and l.organization_id=p.organization_id and b.slug='solta' and b.is_active and p.archived_at is null and o.archived_at is null
  and exists(select 1 from public.solta_notification_control c where c.id='solta' and c.enabled and (c.allow_all_projects or c.allowed_projects @> jsonb_build_array(p_project::text)))
  order by q.created_at limit 5 for update of q skip locked
 ) returning e.*;
end;
$$;
create function public.kp_claim_solta_notifications(p_project uuid,p_lease uuid) returns setof public.solta_notification_events language sql security invoker set search_path='' as $$select * from private.claim_solta_notifications(p_project,p_lease)$$;
revoke all on function public.kp_claim_solta_notifications(uuid,uuid),private.claim_solta_notifications(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.kp_claim_solta_notifications(uuid,uuid),private.claim_solta_notifications(uuid,uuid) to service_role;
