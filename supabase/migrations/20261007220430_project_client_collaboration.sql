-- Additive staff collaboration. Client access remains default-deny until its own auth slice.
create table public.project_messages (
 id uuid primary key, project_id uuid not null references public.client_engagements(id),
 audience text not null check(audience in ('internal','client')), body text not null check(length(trim(body)) between 1 and 10000),
 author_id uuid not null default auth.uid() references public.profiles(id), created_at timestamptz not null default now()
);
create table public.project_progress_drafts (
 id uuid primary key references public.client_engagements(id), revision integer not null default 1 check(revision>0),
 current_work text not null default '' check(length(current_work)<=5000), next_action text not null default '' check(length(next_action)<=5000),
 milestones jsonb not null default '[]' check(jsonb_typeof(milestones)='array' and jsonb_array_length(milestones)<=20),
 updated_by uuid not null default auth.uid() references public.profiles(id), updated_at timestamptz not null default now()
);
create table public.project_progress_updates (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.client_engagements(id), draft_revision integer not null,
 current_work text not null, next_action text not null, milestones jsonb not null,
 published_by uuid not null default auth.uid() references public.profiles(id), published_at timestamptz not null default now(), unique(project_id,draft_revision)
);
create table public.project_files (
 id uuid primary key, project_id uuid not null references public.client_engagements(id), series_id uuid not null, version integer not null check(version>0),
 name text not null check(length(name) between 1 and 200), object_path text unique, drive_url text,
 size_bytes bigint, mime_type text, sha256 text,
 state text not null default 'pending' check(state in ('pending','ready')),
 audience text not null default 'internal' check(audience in ('internal','client')),
 created_by uuid not null default auth.uid() references public.profiles(id), created_at timestamptz not null default now(),
 unique(series_id,version), check((object_path is not null and drive_url is null and size_bytes is not null and mime_type is not null and sha256 is not null and size_bytes between 1 and 20971520 and sha256 ~ '^[a-f0-9]{64}$') or (object_path is null and drive_url is not null and drive_url ~ '^https://(drive|docs)\.google\.com/' and size_bytes is null))
);
create table public.project_notification_jobs (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.client_engagements(id),
 event_kind text not null check(event_kind in ('message','progress')), event_id uuid not null,
 status text not null default 'held' check(status='held'), created_at timestamptz not null default now(), unique(event_kind,event_id)
);
create index project_messages_project_created_idx on public.project_messages(project_id,created_at);
create index project_messages_author_idx on public.project_messages(author_id);
create index project_progress_updates_project_idx on public.project_progress_updates(project_id,published_at);
create index project_progress_updates_author_idx on public.project_progress_updates(published_by);
create index project_progress_drafts_author_idx on public.project_progress_drafts(updated_by);
create index project_files_project_idx on public.project_files(project_id,created_at);
create index project_files_author_idx on public.project_files(created_by);
create index project_notification_jobs_project_idx on public.project_notification_jobs(project_id,created_at);

create function private.check_project_collaboration() returns trigger language plpgsql set search_path='' as $$
declare project uuid; item jsonb; previous_file public.project_files;
begin
 if not private.is_active_member() then raise exception 'Active membership required'; end if;
 if tg_table_name='project_progress_drafts' then project:=new.id; else project:=new.project_id; end if;
 if not exists(select 1 from public.client_engagements e join public.projects p on p.id=e.id where e.id=project and p.archived_at is null) then raise exception 'Active client project required'; end if;
 if tg_table_name='project_messages' then
  if new.author_id<>auth.uid() then raise exception 'Author must be current member'; end if;
  new.created_at:=now();
 elsif tg_table_name='project_progress_drafts' then
  if tg_op='UPDATE' and new.id<>old.id then raise exception 'Project is immutable'; end if;
  for item in select value from jsonb_array_elements(new.milestones) loop
   if jsonb_typeof(item)<>'object' or jsonb_typeof(item->'title') is distinct from 'string' or coalesce(length(trim(item->>'title')),0) not between 1 and 200 or coalesce(item->>'status','') not in ('pending','in_progress','complete') then raise exception 'Invalid milestone'; end if;
  end loop;
  new.revision:=case when tg_op='INSERT' then 1 else old.revision+1 end;
  new.updated_by:=auth.uid();new.updated_at:=now();
 elsif tg_table_name='project_files' then
  if tg_op='INSERT' then
   if new.created_by<>auth.uid() or new.audience<>'internal' then raise exception 'New files must be private and owned by current member'; end if;
   select * into previous_file from public.project_files where series_id=new.series_id order by version desc limit 1;
   if found then
    if previous_file.project_id<>new.project_id or new.version<>previous_file.version+1 then raise exception 'Invalid file version'; end if;
   elsif new.series_id<>new.id or new.version<>1 then raise exception 'First file must start its own series'; end if;
   if new.object_path is not null and (new.object_path<>new.project_id::text||'/'||new.id::text||'/'||new.name or new.state<>'pending') then raise exception 'Invalid object reservation'; end if;
   if new.drive_url is not null then new.state:='ready'; end if;
   new.created_at:=now();
  else
   if (to_jsonb(new)-'state'-'audience') is distinct from (to_jsonb(old)-'state'-'audience') then raise exception 'File versions are immutable'; end if;
   if old.state='ready' and new.state<>'ready' then raise exception 'Ready file is immutable'; end if;
   if new.state='ready' and old.state='pending' and not exists(select 1 from storage.objects where bucket_id='kp-project-files' and name=new.object_path) then raise exception 'Upload not complete'; end if;
   if new.audience='client' and new.state<>'ready' then raise exception 'Only ready files can be published'; end if;
  end if;
 end if;
 return new;
end $$;
revoke all on function private.check_project_collaboration() from public;
create trigger check_project_messages before insert on public.project_messages for each row execute function private.check_project_collaboration();
create trigger check_progress_drafts before insert or update on public.project_progress_drafts for each row execute function private.check_project_collaboration();
create trigger check_project_files before insert or update on public.project_files for each row execute function private.check_project_collaboration();

create function private.queue_project_notification() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not private.is_active_member() then raise exception 'Active membership required'; end if;
 if tg_table_name='project_messages' then
  if new.audience<>'client' then return new; end if;
 end if;
 if tg_table_name in ('project_progress_updates','project_messages') then
  insert into public.project_notification_jobs(project_id,event_kind,event_id) values(new.project_id,case when tg_table_name='project_messages' then 'message' else 'progress' end,new.id) on conflict do nothing;
 end if;
 return new;
end $$;
revoke all on function private.queue_project_notification() from public;
create trigger queue_project_message after insert on public.project_messages for each row execute function private.queue_project_notification();
create trigger queue_project_progress after insert on public.project_progress_updates for each row execute function private.queue_project_notification();

alter table public.project_messages enable row level security;
alter table public.project_progress_drafts enable row level security;
alter table public.project_progress_updates enable row level security;
alter table public.project_files enable row level security;
alter table public.project_notification_jobs enable row level security;
create policy staff_read_messages on public.project_messages for select to authenticated using(private.is_active_member());
create policy staff_post_messages on public.project_messages for insert to authenticated with check(private.is_active_member() and author_id=(select auth.uid()));
create policy staff_read_drafts on public.project_progress_drafts for select to authenticated using(private.is_active_member());
create policy staff_create_drafts on public.project_progress_drafts for insert to authenticated with check(private.is_active_member());
create policy staff_update_drafts on public.project_progress_drafts for update to authenticated using(private.is_active_member()) with check(private.is_active_member());
create policy staff_read_updates on public.project_progress_updates for select to authenticated using(private.is_active_member());
create policy staff_read_files on public.project_files for select to authenticated using(private.is_active_member());
create policy staff_reserve_files on public.project_files for insert to authenticated with check(private.is_active_member() and created_by=(select auth.uid()));
create policy staff_update_files on public.project_files for update to authenticated using(private.is_active_member()) with check(private.is_active_member());
create policy staff_read_notification_jobs on public.project_notification_jobs for select to authenticated using(private.is_active_member());
revoke all on public.project_messages,public.project_progress_drafts,public.project_progress_updates,public.project_files,public.project_notification_jobs from anon,authenticated;
grant select,insert on public.project_messages to authenticated;
grant select,insert,update on public.project_progress_drafts,public.project_files to authenticated;
grant select on public.project_progress_updates,public.project_notification_jobs to authenticated;

create function public.kp_save_project_progress(p_id uuid,p_revision integer,p_work text,p_next text,p_milestones jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare actual integer;
begin
 if not private.is_active_member() then raise exception 'Active membership required'; end if;
 select revision into actual from public.project_progress_drafts where id=p_id for update;
 if found then
  if actual<>p_revision then raise exception 'Draft changed; reload before saving'; end if;
  update public.project_progress_drafts set current_work=p_work,next_action=p_next,milestones=p_milestones where id=p_id;
 else
  if p_revision<>0 then raise exception 'Draft changed; reload before saving'; end if;
  insert into public.project_progress_drafts(id,current_work,next_action,milestones) values(p_id,p_work,p_next,p_milestones);
 end if;
end $$;
-- Definer is required only for appending an immutable publication; no direct INSERT grant.
create function private.publish_project_progress(p_id uuid,p_revision integer) returns uuid language plpgsql security definer set search_path='' as $$
declare draft public.project_progress_drafts; result uuid;
begin
 if not private.is_active_member() then raise exception 'Active membership required'; end if;
 if not exists(select 1 from public.projects where id=p_id and archived_at is null) then raise exception 'Active client project required'; end if;
 select * into draft from public.project_progress_drafts where id=p_id for update;
 if not found or draft.revision<>p_revision then raise exception 'Draft changed; reload before publishing'; end if;
 if length(trim(draft.current_work))=0 then raise exception 'Describe the current work before publishing'; end if;
 insert into public.project_progress_updates(project_id,draft_revision,current_work,next_action,milestones,published_by) values(p_id,draft.revision,draft.current_work,draft.next_action,draft.milestones,auth.uid()) on conflict(project_id,draft_revision) do nothing;
 select id into result from public.project_progress_updates where project_id=p_id and draft_revision=p_revision;
 return result;
end $$;
revoke all on function private.publish_project_progress(uuid,integer) from public,anon;
grant execute on function private.publish_project_progress(uuid,integer) to authenticated;
create function public.kp_publish_project_progress(p_id uuid,p_revision integer) returns uuid language sql security invoker set search_path='' as $$select private.publish_project_progress(p_id,p_revision)$$;
revoke all on function public.kp_save_project_progress(uuid,integer,text,text,jsonb),public.kp_publish_project_progress(uuid,integer) from public,anon;
grant execute on function public.kp_save_project_progress(uuid,integer,text,text,jsonb),public.kp_publish_project_progress(uuid,integer) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('kp-project-files','kp-project-files',false,20971520,array['application/pdf','image/png','image/jpeg','text/plain','text/csv']) on conflict(id) do nothing;
create policy kp_project_files_read on storage.objects for select to authenticated using(bucket_id='kp-project-files' and private.is_active_member() and exists(select 1 from public.project_files f join public.projects p on p.id=f.project_id where f.object_path=storage.objects.name and p.archived_at is null));
create policy kp_project_files_upload on storage.objects for insert to authenticated with check(bucket_id='kp-project-files' and private.is_active_member() and exists(select 1 from public.project_files f join public.projects p on p.id=f.project_id where f.object_path=storage.objects.name and f.state='pending' and f.created_by=(select auth.uid()) and p.archived_at is null));
-- No storage UPDATE or DELETE policy: uploaded versions are retained rather than overwritten.
