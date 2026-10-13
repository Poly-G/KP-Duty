-- Enroll only a project's first completed, administrator-authorized setup.
-- Preserve email kill switches and intentionally paused existing projects.
create function private.enable_solta_setup_emails() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Active admin required';end if;
 if exists(select 1 from public.solta_client_setup_jobs where project_id=new.project_id and phase='complete' and id<>new.id) then return new;end if;
 if not exists(select 1 from public.solta_portal_project_links l join public.projects p on p.id=l.project_id
 join public.organizations o on o.id=p.organization_id join public.businesses b on b.id=p.business_id
 where l.project_id=new.project_id and l.organization_id=new.organization_id and l.portal_project_id=new.portal_project_id
 and l.enabled and p.organization_id=l.organization_id and p.archived_at is null and o.archived_at is null and b.slug='solta' and b.is_active) then raise exception 'Active Solta client project required';end if;
 update public.solta_notification_control set allowed_projects=case when allowed_projects @> jsonb_build_array(new.project_id::text) then allowed_projects else allowed_projects||jsonb_build_array(new.project_id::text) end where id='solta';
 if not found then raise exception 'Project email connection unavailable';end if;
 return new;
end $$;
revoke all on function private.enable_solta_setup_emails() from public,anon,authenticated,service_role;
create trigger enable_solta_setup_emails after update of phase on public.solta_client_setup_jobs for each row when(new.phase='complete' and old.phase='linked') execute function private.enable_solta_setup_emails();
