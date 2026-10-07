-- Staff workflow only. Verified client identities and direct client reviews come later.
create table public.project_deliverables (
 id uuid primary key, project_id uuid not null references public.client_engagements(id),
 title text not null check(length(trim(title)) between 1 and 200),
 kind text not null check(kind in ('general','brand_direction','copy','launch')),
 reviewer_id uuid not null references public.profiles(id), requirement_key text,
 current_version integer not null default 0 check(current_version>=0),
 created_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create table public.deliverable_versions (
 id uuid primary key, deliverable_id uuid not null references public.project_deliverables(id),
 version integer not null check(version>0), description text not null check(length(trim(description)) between 1 and 10000),
 created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(), unique(deliverable_id,version)
);
create table public.deliverable_version_files (
 id uuid primary key default gen_random_uuid(), version_id uuid not null references public.deliverable_versions(id),
 file_id uuid not null references public.project_files(id), unique(version_id,file_id)
);
create table public.deliverable_reviews (
 id uuid primary key, version_id uuid not null references public.deliverable_versions(id),
 lane text not null check(lane in ('internal','client_record')),
 outcome text not null check(outcome in ('approved','changes_requested')),
 note text not null default '' check(length(note)<=5000), client_name text, evidence text,
 recorded_by uuid not null references public.profiles(id), recorded_at timestamptz not null default now(), unique(version_id,lane),
 check((lane='internal' and client_name is null and evidence is null) or (lane='client_record' and client_name is not null and length(trim(client_name)) between 1 and 200 and evidence is not null and length(trim(evidence)) between 1 and 5000)),
 check(outcome<>'changes_requested' or length(trim(note))>0)
);
create table public.deliverable_publications (
 id uuid primary key references public.deliverable_versions(id), published_by uuid not null references public.profiles(id), published_at timestamptz not null default now()
);
create index project_deliverables_project_idx on public.project_deliverables(project_id,created_at);
create index project_deliverables_reviewer_idx on public.project_deliverables(reviewer_id);
create index project_deliverables_creator_idx on public.project_deliverables(created_by);
create index deliverable_versions_creator_idx on public.deliverable_versions(created_by);
create index deliverable_version_files_file_idx on public.deliverable_version_files(file_id);
create index deliverable_reviews_actor_idx on public.deliverable_reviews(recorded_by);
create index deliverable_publications_actor_idx on public.deliverable_publications(published_by);

alter table public.project_deliverables enable row level security;
alter table public.deliverable_versions enable row level security;
alter table public.deliverable_version_files enable row level security;
alter table public.deliverable_reviews enable row level security;
alter table public.deliverable_publications enable row level security;
create policy staff_read_deliverables on public.project_deliverables for select to authenticated using(private.is_active_member());
create policy staff_read_deliverable_versions on public.deliverable_versions for select to authenticated using(private.is_active_member());
create policy staff_read_deliverable_files on public.deliverable_version_files for select to authenticated using(private.is_active_member());
create policy staff_read_deliverable_reviews on public.deliverable_reviews for select to authenticated using(private.is_active_member());
create policy staff_read_deliverable_publications on public.deliverable_publications for select to authenticated using(private.is_active_member());
revoke all on public.project_deliverables,public.deliverable_versions,public.deliverable_version_files,public.deliverable_reviews,public.deliverable_publications from anon,authenticated;
grant select on public.project_deliverables,public.deliverable_versions,public.deliverable_version_files,public.deliverable_reviews,public.deliverable_publications to authenticated;

create function private.require_deliverable_project(p_project uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
 if not private.is_active_member() then raise exception 'Active membership required'; end if;
 if not exists(select 1 from public.client_engagements e join public.projects p on p.id=e.id join public.businesses b on b.id=p.business_id where e.id=p_project and p.archived_at is null and b.is_active and b.slug in ('solta','snd')) then raise exception 'Active client project required'; end if;
end $$;
revoke all on function private.require_deliverable_project(uuid) from public,anon,authenticated;

-- Restricted definers own append-only writes; public API wrappers remain invokers.
create function private.create_deliverable(p_id uuid,p_project uuid,p_title text,p_kind text,p_reviewer uuid,p_requirement text) returns uuid language plpgsql security definer set search_path='' as $$
declare owner uuid; existing public.project_deliverables; service text; allowed text[];
begin
 perform private.require_deliverable_project(p_project);
 select owner_id into owner from public.projects where id=p_project;
 if not private.is_admin() and p_reviewer is distinct from owner then raise exception 'Admin assigns a different reviewer'; end if;
 if not exists(select 1 from public.profiles where id=p_reviewer and status='active') then raise exception 'Active reviewer required'; end if;
 select e.service into service from public.client_engagements e where id=p_project;
 allowed:=array['goal','approver_email']||case service when 'website' then array['website_pages','content_owner'] when 'branding' then array['audience','brand_deliverables'] when 'less_office' then array['systems','workflow'] when 'care' then array['site_url','care_priorities'] else array['systems','agreed_plan','measurement'] end;
 if p_requirement is not null and not p_requirement=any(allowed) then raise exception 'Unknown onboarding requirement'; end if;
 select * into existing from public.project_deliverables where id=p_id;
 if found then
  if existing.project_id is distinct from p_project or existing.title is distinct from p_title or existing.kind is distinct from p_kind or existing.reviewer_id is distinct from p_reviewer or existing.requirement_key is distinct from p_requirement or existing.created_by<>auth.uid() then raise exception 'Deliverable retry mismatch'; end if;
  return p_id;
 end if;
 insert into public.project_deliverables(id,project_id,title,kind,reviewer_id,requirement_key,created_by) values(p_id,p_project,p_title,p_kind,p_reviewer,p_requirement,auth.uid());
 return p_id;
end $$;

create function private.add_deliverable_version(p_id uuid,p_deliverable uuid,p_expected_version integer,p_description text,p_files uuid[]) returns uuid language plpgsql security definer set search_path='' as $$
declare d public.project_deliverables; existing public.deliverable_versions; file_ids uuid[]; existing_files uuid[];
begin
 if not private.is_active_member() then raise exception 'Active membership required'; end if;
 select * into d from public.project_deliverables where id=p_deliverable for update;
 if not found then raise exception 'Deliverable unavailable'; end if;
 perform private.require_deliverable_project(d.project_id);
 select coalesce(array_agg(f order by f),'{}'::uuid[]) into file_ids from unnest(coalesce(p_files,'{}'::uuid[])) as f;
 if cardinality(file_ids)>20 or exists(select 1 from unnest(file_ids) f where f is null) or cardinality(file_ids)<>(select count(distinct f) from unnest(file_ids) f) then raise exception 'Choose up to 20 distinct files'; end if;
 if cardinality(file_ids)<>(select count(*) from public.project_files where id=any(file_ids) and project_id=d.project_id and state='ready' and drive_url is null) then raise exception 'Attach ready uploaded snapshots from this project; Drive links are mutable'; end if;
 select * into existing from public.deliverable_versions where id=p_id;
 if found then
  select coalesce(array_agg(file_id order by file_id),'{}'::uuid[]) into existing_files from public.deliverable_version_files where version_id=p_id;
  if existing.deliverable_id<>p_deliverable or existing.description is distinct from p_description or existing_files<>file_ids or existing.created_by<>auth.uid() then raise exception 'Version retry mismatch'; end if;
  return p_id;
 end if;
 if p_expected_version is distinct from d.current_version then raise exception 'Deliverable changed; reload before adding a version'; end if;
 insert into public.deliverable_versions(id,deliverable_id,version,description,created_by) values(p_id,p_deliverable,d.current_version+1,p_description,auth.uid());
 insert into public.deliverable_version_files(version_id,file_id) select p_id,f from unnest(file_ids) f;
 update public.project_deliverables set current_version=current_version+1 where id=p_deliverable;
 return p_id;
end $$;

create function private.review_deliverable(p_id uuid,p_version uuid,p_lane text,p_outcome text,p_note text,p_client_name text,p_evidence text) returns uuid language plpgsql security definer set search_path='' as $$
declare d public.project_deliverables; v public.deliverable_versions; existing public.deliverable_reviews;
begin
 if not private.is_active_member() then raise exception 'Active membership required'; end if;
 select * into v from public.deliverable_versions where id=p_version;
 if not found then raise exception 'Version unavailable'; end if;
 select * into d from public.project_deliverables where id=v.deliverable_id for update;
 perform private.require_deliverable_project(d.project_id);
 if p_lane='internal' and auth.uid()<>d.reviewer_id and not private.is_admin() then raise exception 'Assigned reviewer or admin approval required'; end if;
 if p_lane='client_record' and not exists(select 1 from public.deliverable_publications where id=p_version) then raise exception 'Publish this version before recording a client response'; end if;
 select * into existing from public.deliverable_reviews where id=p_id;
 if found then
  if existing.version_id<>p_version or existing.lane is distinct from p_lane or existing.outcome is distinct from p_outcome or existing.note is distinct from p_note or existing.client_name is distinct from p_client_name or existing.evidence is distinct from p_evidence or existing.recorded_by<>auth.uid() then raise exception 'Review retry mismatch'; end if;
  return p_id;
 end if;
 if v.version<>d.current_version then raise exception 'A newer version exists; review the current version'; end if;
 if exists(select 1 from public.deliverable_reviews where version_id=p_version and lane=p_lane) then raise exception 'This version was already reviewed; create a new version for changes'; end if;
 insert into public.deliverable_reviews(id,version_id,lane,outcome,note,client_name,evidence,recorded_by) values(p_id,p_version,p_lane,p_outcome,p_note,p_client_name,p_evidence,auth.uid());
 return p_id;
end $$;

alter table public.project_notification_jobs drop constraint project_notification_jobs_event_kind_check;
alter table public.project_notification_jobs add constraint project_notification_jobs_event_kind_check check(event_kind in ('message','progress','deliverable'));
create function private.publish_deliverable(p_version uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare d public.project_deliverables; v public.deliverable_versions;
begin
 if not private.is_active_member() then raise exception 'Active membership required'; end if;
 select * into v from public.deliverable_versions where id=p_version;
 if not found then raise exception 'Version unavailable'; end if;
 select * into d from public.project_deliverables where id=v.deliverable_id for update;
 perform private.require_deliverable_project(d.project_id);
 if exists(select 1 from public.deliverable_publications where id=p_version) then return p_version; end if;
 if v.version<>d.current_version then raise exception 'A newer version exists; publish the current version'; end if;
 if not exists(select 1 from public.deliverable_reviews where version_id=p_version and lane='internal' and outcome='approved') then raise exception 'Internal approval required before publication'; end if;
 if exists(select 1 from public.deliverable_version_files vf join public.project_files f on f.id=vf.file_id where vf.version_id=p_version and (f.state<>'ready' or f.project_id<>d.project_id)) then raise exception 'Attached files are unavailable'; end if;
 -- This explicit publication action shares the exact attached file versions.
 update public.project_files set audience='client' where id in(select file_id from public.deliverable_version_files where version_id=p_version);
 insert into public.deliverable_publications(id,published_by) values(p_version,auth.uid());
 insert into public.project_notification_jobs(project_id,event_kind,event_id) values(d.project_id,'deliverable',p_version) on conflict do nothing;
 return p_version;
end $$;

revoke all on function private.create_deliverable(uuid,uuid,text,text,uuid,text) from public,anon,authenticated;
grant execute on function private.create_deliverable(uuid,uuid,text,text,uuid,text) to authenticated;
create function public.kp_create_deliverable(p_id uuid,p_project uuid,p_title text,p_kind text,p_reviewer uuid,p_requirement text) returns uuid language sql security invoker set search_path='' as $$select private.create_deliverable(p_id,p_project,p_title,p_kind,p_reviewer,p_requirement)$$;
revoke all on function public.kp_create_deliverable(uuid,uuid,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.kp_create_deliverable(uuid,uuid,text,text,uuid,text) to authenticated;

revoke all on function private.add_deliverable_version(uuid,uuid,integer,text,uuid[]) from public,anon,authenticated;
grant execute on function private.add_deliverable_version(uuid,uuid,integer,text,uuid[]) to authenticated;
create function public.kp_add_deliverable_version(p_id uuid,p_deliverable uuid,p_expected_version integer,p_description text,p_files uuid[]) returns uuid language sql security invoker set search_path='' as $$select private.add_deliverable_version(p_id,p_deliverable,p_expected_version,p_description,p_files)$$;
revoke all on function public.kp_add_deliverable_version(uuid,uuid,integer,text,uuid[]) from public,anon,authenticated;
grant execute on function public.kp_add_deliverable_version(uuid,uuid,integer,text,uuid[]) to authenticated;

revoke all on function private.review_deliverable(uuid,uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function private.review_deliverable(uuid,uuid,text,text,text,text,text) to authenticated;
create function public.kp_review_deliverable(p_id uuid,p_version uuid,p_lane text,p_outcome text,p_note text,p_client_name text,p_evidence text) returns uuid language sql security invoker set search_path='' as $$select private.review_deliverable(p_id,p_version,p_lane,p_outcome,p_note,p_client_name,p_evidence)$$;
revoke all on function public.kp_review_deliverable(uuid,uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.kp_review_deliverable(uuid,uuid,text,text,text,text,text) to authenticated;

revoke all on function private.publish_deliverable(uuid) from public,anon,authenticated;
grant execute on function private.publish_deliverable(uuid) to authenticated;
create function public.kp_publish_deliverable(p_version uuid) returns uuid language sql security invoker set search_path='' as $$select private.publish_deliverable(p_version)$$;
revoke all on function public.kp_publish_deliverable(uuid) from public,anon,authenticated;
grant execute on function public.kp_publish_deliverable(uuid) to authenticated;
