-- New staff workflow; existing portal links and customer access remain unchanged.
create table public.solta_client_setup_jobs(
 id uuid primary key,project_id uuid not null references public.client_engagements(id),
 organization_id uuid not null references public.organizations(id),portal_project_id uuid not null,
 people jsonb not null,created_by uuid not null references public.profiles(id),
 phase text not null default 'prepared' check(phase in ('prepared','linked','complete')),
 created_at timestamptz not null default now(),completed_at timestamptz
);
create index solta_client_setup_project_idx on public.solta_client_setup_jobs(project_id,created_at desc);
create index solta_client_setup_actor_idx on public.solta_client_setup_jobs(created_by);
alter table public.solta_client_setup_jobs enable row level security;
revoke all on public.solta_client_setup_jobs from public,anon,authenticated,service_role;
grant select on public.solta_client_setup_jobs to authenticated;
create policy solta_setup_admin_read on public.solta_client_setup_jobs for select to authenticated using ((select private.is_admin()));
create function private.prepare_solta_client_setup(p_id uuid,p_project uuid,p_people jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare job public.solta_client_setup_jobs; link public.solta_portal_project_links; org uuid; company_name text; project_name text;
begin
 if not private.is_admin() then raise exception 'Active admin required';end if;
 select p.organization_id,p.name,o.name into org,project_name,company_name from public.projects p join public.client_engagements e on e.id=p.id join public.organizations o on o.id=p.organization_id join public.businesses b on b.id=p.business_id where p.id=p_project and p.archived_at is null and o.archived_at is null and b.slug='solta' and b.is_active for update of p;
 if not found then raise exception 'Active Solta client project required';end if;
 if p_id is null or p_people is null or p_people->>'confirmedCompanyAccess' is distinct from 'true' then raise exception 'Confirm company project access';end if;
 select * into job from public.solta_client_setup_jobs where id=p_id;
 if found then
  if job.project_id<>p_project or job.created_by<>auth.uid() or job.people is distinct from p_people then raise exception 'Setup retry mismatch';end if;
 else
  select * into link from public.solta_portal_project_links where project_id=p_project;
  if found and (link.organization_id<>org or not link.enabled) then
   -- A disabled mapping may be our incomplete first setup, never a completed/revoked mapping.
   if link.organization_id<>org or not exists(select 1 from public.solta_client_setup_jobs where project_id=p_project and phase='prepared') or exists(select 1 from public.solta_client_setup_jobs where project_id=p_project and phase<>'prepared') then raise exception 'Existing portal access is disabled or mismatched';end if;
  end if;
  if link.project_id is null then
   insert into public.solta_portal_project_links(project_id,organization_id,portal_project_id,enabled,linked_by) values(p_project,org,gen_random_uuid(),false,auth.uid()) returning * into link;
  end if;
  insert into public.solta_client_setup_jobs(id,project_id,organization_id,portal_project_id,people,created_by) values(p_id,p_project,org,link.portal_project_id,p_people,auth.uid()) returning * into job;
 end if;
 return jsonb_build_object('projectId',job.project_id,'organizationId',job.organization_id,'portalProjectId',job.portal_project_id,'companyName',company_name,'projectName',project_name,'phase',job.phase);
end $$;
create function private.advance_solta_client_setup(p_id uuid,p_portal_project uuid,p_complete boolean) returns void language plpgsql security definer set search_path='' as $$
declare job public.solta_client_setup_jobs;
begin
 if not private.is_admin() then raise exception 'Active admin required';end if;
 select * into job from public.solta_client_setup_jobs where id=p_id for update;
 if not found or job.created_by<>auth.uid() or job.portal_project_id<>p_portal_project then raise exception 'Setup not found';end if;
 if not exists(select 1 from public.projects p join public.organizations o on o.id=p.organization_id join public.businesses b on b.id=p.business_id where p.id=job.project_id and p.organization_id=job.organization_id and p.archived_at is null and o.archived_at is null and b.slug='solta' and b.is_active) then raise exception 'Active Solta client project required';end if;
 if not exists(select 1 from public.solta_portal_project_links where project_id=job.project_id and organization_id=job.organization_id and portal_project_id=job.portal_project_id) then raise exception 'Portal mapping changed';end if;
 if job.phase<>'prepared' and not exists(select 1 from public.solta_portal_project_links where project_id=job.project_id and enabled) then raise exception 'Portal access changed after linking';end if;
 if job.phase='prepared' and not exists(select 1 from public.solta_portal_project_links where project_id=job.project_id and enabled) and exists(select 1 from public.solta_client_setup_jobs where project_id=job.project_id and phase<>'prepared') then raise exception 'Portal access changed after another setup';end if;
 if p_complete then
  if job.phase='prepared' then raise exception 'Finish KP linking before completing setup';end if;
  update public.solta_client_setup_jobs set phase='complete',completed_at=coalesce(completed_at,now()) where id=p_id;
 else
  if not exists(select 1 from public.solta_drive_connection where id='solta' and account_email='soltafilms@gmail.com') then raise exception 'Connect Solta Google Drive first';end if;
  update public.solta_portal_project_links set enabled=true where project_id=job.project_id;
  insert into public.solta_drive_projects(project_id,enabled) values(job.project_id,true) on conflict(project_id) do update set enabled=true;
  update public.solta_client_setup_jobs set phase=case when phase='complete' then phase else 'linked' end where id=p_id;
 end if;
end $$;
revoke all on function private.prepare_solta_client_setup(uuid,uuid,jsonb),private.advance_solta_client_setup(uuid,uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function private.prepare_solta_client_setup(uuid,uuid,jsonb),private.advance_solta_client_setup(uuid,uuid,boolean) to authenticated;
create function public.kp_prepare_solta_client_setup(p_id uuid,p_project uuid,p_people jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.prepare_solta_client_setup(p_id,p_project,p_people)$$;
create function public.kp_advance_solta_client_setup(p_id uuid,p_portal_project uuid,p_complete boolean) returns void language sql security invoker set search_path='' as $$select private.advance_solta_client_setup(p_id,p_portal_project,p_complete)$$;
revoke all on function public.kp_prepare_solta_client_setup(uuid,uuid,jsonb),public.kp_advance_solta_client_setup(uuid,uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function public.kp_prepare_solta_client_setup(uuid,uuid,jsonb),public.kp_advance_solta_client_setup(uuid,uuid,boolean) to authenticated;
