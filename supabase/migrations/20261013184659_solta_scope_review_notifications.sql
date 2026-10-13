-- Future explicitly shared scopes notify the company's current approver.
-- Existing publications are not backfilled or resent.
alter table public.solta_notification_events drop constraint solta_notification_events_event_kind_check;
alter table public.solta_notification_events add constraint solta_notification_events_event_kind_check check(event_kind in ('message.created','file.verified','review.decided','payment.requested','payment.received','message.shared','progress.published','file.shared','preview.published','scope.published'));
alter table public.solta_notification_events drop constraint solta_notification_events_status_check;
alter table public.solta_notification_events add constraint solta_notification_events_status_check check(status in ('pending','sending','sent','skipped'));
create function private.queue_solta_scope_review() returns trigger language plpgsql security definer set search_path='' as $$
declare s public.project_scope_versions; link public.solta_portal_project_links; project_name text;company_name text;
begin
 select * into s from public.project_scope_versions where id=new.scope_id and project_id=new.project_id;
 if not found or s.version<>(select max(version) from public.project_scope_versions where project_id=new.project_id) then return new;end if;
 if not exists(select 1 from public.solta_notification_control c where c.id='solta' and c.enabled and c.client_updates_enabled and (c.allow_all_projects or c.allowed_projects @> jsonb_build_array(new.project_id::text))) then return new;end if;
 select l.* into link from public.solta_portal_project_links l join public.projects p on p.id=l.project_id join public.organizations o on o.id=l.organization_id join public.businesses b on b.id=p.business_id
 where l.project_id=new.project_id and l.enabled and l.organization_id=p.organization_id and b.slug='solta' and b.is_active and p.archived_at is null and o.archived_at is null;
 if not found then return new;end if;
 select p.name,o.name into project_name,company_name from public.projects p join public.organizations o on o.id=p.organization_id where p.id=new.project_id;
 insert into public.solta_notification_events(project_id,event_kind,source_id,payload) values(new.project_id,'scope.published',new.scope_id,
 jsonb_build_object('projectId',new.project_id,'organizationId',link.organization_id,'portalProjectId',link.portal_project_id,'projectName',project_name,'companyName',company_name,'versionNumber',s.version))
 on conflict(event_kind,source_id) do nothing;
 return new;
end $$;
revoke all on function private.queue_solta_scope_review() from public,anon,authenticated,service_role;
create trigger queue_solta_shared_scope after insert on public.solta_portal_scope_publications for each row execute function private.queue_solta_scope_review();

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
  and (q.event_kind<>'scope.published' or (exists(select 1 from public.solta_notification_control c where c.id='solta' and c.client_updates_enabled) and exists(
   select 1 from public.project_scope_versions s join public.solta_portal_scope_publications u on u.scope_id=s.id and u.project_id=s.project_id
   where s.id=q.source_id and s.project_id=q.project_id and s.version=(select max(v.version) from public.project_scope_versions v where v.project_id=q.project_id)
  )))
  order by q.created_at limit 5 for update of q skip locked
 ) returning e.*;
end;
$$;
