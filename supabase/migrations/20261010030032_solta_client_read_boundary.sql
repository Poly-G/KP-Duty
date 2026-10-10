-- Explicitly enabled project mappings; no customer is added to KP staff profiles.
create table public.solta_portal_project_links (
 project_id uuid primary key references public.client_engagements(id) on delete restrict,
 organization_id uuid not null references public.organizations(id) on delete restrict,
 portal_project_id uuid not null unique,
 enabled boolean not null default true,
 linked_by uuid not null references public.profiles(id),
 linked_at timestamptz not null default now()
);
create index solta_portal_link_org_idx on public.solta_portal_project_links(organization_id);
create index solta_portal_link_actor_idx on public.solta_portal_project_links(linked_by);
alter table public.solta_portal_project_links enable row level security;
revoke all on public.solta_portal_project_links from public,anon,authenticated,service_role;
grant select on public.solta_portal_project_links to authenticated;
grant update(enabled) on public.solta_portal_project_links to authenticated;
create policy solta_link_read on public.solta_portal_project_links for select to authenticated using ((select private.is_admin()));
create policy solta_link_disable on public.solta_portal_project_links for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create table public.solta_portal_read_receipts (
 nonce uuid primary key,
 project_id uuid not null references public.solta_portal_project_links(project_id),
 portal_actor text not null check(length(portal_actor) between 1 and 100),
 received_at timestamptz not null default now()
);
create index solta_portal_receipt_project_idx on public.solta_portal_read_receipts(project_id);
alter table public.solta_portal_read_receipts enable row level security;
revoke all on public.solta_portal_read_receipts from public,anon,authenticated,service_role;
grant select on public.solta_portal_read_receipts to authenticated;
create policy solta_receipt_admin_read on public.solta_portal_read_receipts for select to authenticated using ((select private.is_admin()));

create function public.kp_link_solta_portal(p_project uuid,p_company uuid,p_portal_project uuid) returns void language plpgsql security definer set search_path='' as $$
declare existing public.solta_portal_project_links;
begin
 if not private.is_admin() then raise exception 'Active admin required'; end if;
 if p_project is null or p_company is null or p_portal_project is null then raise exception 'Invalid portal link'; end if;
 if not exists(select 1 from public.projects p join public.businesses b on b.id=p.business_id join public.organizations o on o.id=p.organization_id join public.client_engagements e on e.id=p.id where p.id=p_project and o.id=p_company and p.archived_at is null and o.archived_at is null and b.slug='solta' and b.is_active) then raise exception 'Active Solta client project required'; end if;
 insert into public.solta_portal_project_links(project_id,organization_id,portal_project_id,linked_by) values(p_project,p_company,p_portal_project,auth.uid()) on conflict(project_id) do nothing;
 select * into existing from public.solta_portal_project_links where project_id=p_project;
 if existing.organization_id<>p_company or existing.portal_project_id<>p_portal_project then raise exception 'Portal mapping is immutable'; end if;
end $$;
revoke all on function public.kp_link_solta_portal(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.kp_link_solta_portal(uuid,uuid,uuid) to authenticated;

-- Privileged, fixed projection: no dynamic SQL and no arbitrary table operations.
-- Private implementation is not a public Data API routine.
create function private.read_solta_portal(p_project uuid,p_company uuid,p_portal_project uuid,p_actor text,p_nonce uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare project public.projects; progress jsonb; files jsonb; messages jsonb;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Integration role required'; end if;
 if p_nonce is null or p_actor is null or length(p_actor) not between 1 and 100 then raise exception 'Invalid portal request'; end if;
 select p.* into project from public.projects p join public.solta_portal_project_links l on l.project_id=p.id join public.businesses b on b.id=p.business_id join public.organizations o on o.id=p.organization_id where p.id=p_project and p.organization_id=p_company and l.organization_id=p_company and l.portal_project_id=p_portal_project and l.enabled and b.slug='solta' and b.is_active and p.archived_at is null and o.archived_at is null;
 if project.id is null then return null; end if;
 insert into public.solta_portal_read_receipts(nonce,project_id,portal_actor) values(p_nonce,p_project,p_actor);
 select jsonb_build_object('revision',u.draft_revision,'currentWork',u.current_work,'nextAction',u.next_action,'milestones',coalesce((select jsonb_agg(jsonb_build_object('title',m->>'title','status',m->>'status')) from jsonb_array_elements(u.milestones) m),'[]'::jsonb)) into progress from public.project_progress_updates u where u.project_id=p_project order by u.published_at desc,u.id desc limit 1;
 select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,'version',f.version)),'[]'::jsonb) into files from (select id,name,version from public.project_files where project_id=p_project and state='ready' and audience='client' order by created_at desc limit 100) f;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'body',m.body,'createdAt',to_char(m.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'authorName','Solta team')),'[]'::jsonb) into messages from (select id,body,created_at from public.project_messages where project_id=p_project and audience='client' order by created_at desc limit 100) m;
 return jsonb_build_object('project',jsonb_build_object('id',project.id,'organizationId',project.organization_id,'name',project.name,'status',project.status),'progress',progress,'files',files,'reviews','[]'::jsonb,'messages',messages);
end $$;
revoke all on function private.read_solta_portal(uuid,uuid,uuid,text,uuid) from public,anon,authenticated,service_role;
grant usage on schema private to service_role;
grant execute on function private.read_solta_portal(uuid,uuid,uuid,text,uuid) to service_role;
create function public.kp_read_solta_portal(p_project uuid,p_company uuid,p_portal_project uuid,p_actor text,p_nonce uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.read_solta_portal(p_project,p_company,p_portal_project,p_actor,p_nonce) $$;
revoke all on function public.kp_read_solta_portal(uuid,uuid,uuid,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.kp_read_solta_portal(uuid,uuid,uuid,text,uuid) to service_role;
