-- New staff-to-client alerts are separately disabled until both apps are released and QA is enabled.
alter table public.solta_notification_control add column client_updates_enabled boolean not null default false;
alter table public.solta_notification_events drop constraint solta_notification_events_event_kind_check;
alter table public.solta_notification_events add constraint solta_notification_events_event_kind_check check(event_kind in ('message.created','file.verified','review.decided','payment.requested','payment.received','message.shared','progress.published','file.shared','preview.published'));
create function private.queue_solta_client_update() returns trigger language plpgsql security definer set search_path='' as $$
declare project uuid;kind text;source uuid;details jsonb;link public.solta_portal_project_links;project_name text;company_name text;version_number integer;item_title text;
begin
 if tg_table_name='project_messages' then
  if new.audience<>'client' then return new;end if;
  project:=new.project_id;kind:='message.shared';source:=new.id;details:='{}'::jsonb;
 elsif tg_table_name='project_progress_updates' then
  project:=new.project_id;kind:='progress.published';source:=new.id;details:='{}'::jsonb;
 elsif tg_table_name='project_files' then
  if new.audience<>'client' or new.state<>'ready' or (old.audience='client' and old.state='ready') then return new;end if;
  project:=new.project_id;kind:='file.shared';source:=new.id;details:=jsonb_build_object('label',new.name,'versionNumber',new.version);
 else
  select d.project_id,v.version,d.title into project,version_number,item_title from public.deliverable_versions v join public.project_deliverables d on d.id=v.deliverable_id where v.id=new.version_id;
  kind:='preview.published';source:=new.version_id;details:=jsonb_build_object('label',item_title,'versionNumber',version_number);
 end if;
 if not exists(select 1 from public.solta_notification_control c where c.id='solta' and c.enabled and c.client_updates_enabled and (c.allow_all_projects or c.allowed_projects @> jsonb_build_array(project::text))) then return new;end if;
 select l.* into link from public.solta_portal_project_links l join public.projects p on p.id=l.project_id join public.organizations o on o.id=l.organization_id join public.businesses b on b.id=p.business_id where l.project_id=project and l.enabled and l.organization_id=p.organization_id and b.slug='solta' and b.is_active and p.archived_at is null and o.archived_at is null;
 if not found then return new;end if;
 select p.name,o.name into project_name,company_name from public.projects p join public.organizations o on o.id=p.organization_id where p.id=project;
 insert into public.solta_notification_events(project_id,event_kind,source_id,payload) values(project,kind,source,details||jsonb_build_object('projectId',project,'organizationId',link.organization_id,'portalProjectId',link.portal_project_id,'projectName',project_name,'companyName',company_name)) on conflict(event_kind,source_id) do nothing;
 return new;
end $$;
revoke all on function private.queue_solta_client_update() from public,anon,authenticated,service_role;
create trigger queue_solta_staff_message after insert on public.project_messages for each row execute function private.queue_solta_client_update();
create trigger queue_solta_published_progress after insert on public.project_progress_updates for each row execute function private.queue_solta_client_update();
create trigger queue_solta_shared_file after update of audience,state on public.project_files for each row execute function private.queue_solta_client_update();
create trigger queue_solta_published_preview after insert on public.solta_portal_previews for each row execute function private.queue_solta_client_update();

create or replace function private.claim_solta_notifications(p_project uuid,p_lease uuid) returns setof public.solta_notification_events language plpgsql security definer set search_path='' as $$
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
  and exists(select 1 from public.solta_notification_control c where c.id='solta' and c.enabled and (q.event_kind not in ('message.shared','progress.published','file.shared','preview.published') or c.client_updates_enabled) and (c.allow_all_projects or c.allowed_projects @> jsonb_build_array(p_project::text)))
  order by q.created_at limit 5 for update of q skip locked
 ) returning e.*;
end;
$$;
