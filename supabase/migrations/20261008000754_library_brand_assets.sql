create table public.library_files(
 id uuid primary key,document_id uuid not null references public.knowledge_documents(id),
 name text not null check(name ~ '^[a-zA-Z0-9._-]{1,180}$'),object_path text not null unique,
 mime_type text not null check(mime_type in ('application/pdf','application/zip')),
 size_bytes integer not null check(size_bytes between 1 and 2097152),sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
 state text not null default 'pending' check(state in ('pending','ready')),created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),
 unique(document_id,sha256)
);
create index library_files_creator on public.library_files(created_by);
alter table public.library_files enable row level security;
revoke all on public.library_files from public,anon,authenticated;
grant select,insert,update on public.library_files to authenticated;
create policy library_files_staff_read on public.library_files for select to authenticated using((select private.is_active_member()));
create policy library_files_admin_insert on public.library_files for insert to authenticated with check((select private.is_admin()) and created_by=(select auth.uid()));
create policy library_files_admin_update on public.library_files for update to authenticated using((select private.is_admin())) with check((select private.is_admin()));
create function private.guard_library_files() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Admin permission required';end if;
 if tg_op='INSERT' then
  if new.state<>'pending' or new.created_by<>auth.uid() or new.object_path<>new.document_id::text||'/'||new.id::text||'/'||new.name then raise exception 'Invalid library file reservation';end if;
 else
  if (to_jsonb(new)-'state') is distinct from (to_jsonb(old)-'state') then raise exception 'Library file versions are immutable';end if;
  if old.state='ready' and new.state<>'ready' then raise exception 'Ready library files are immutable';end if;
  if new.state='ready' and not exists(select 1 from storage.objects where bucket_id='kp-library-files' and name=new.object_path) then raise exception 'Upload not complete';end if;
 end if;
 return new;
end $$;
revoke all on function private.guard_library_files() from public,anon,authenticated;
create trigger guard_library_files before insert or update on public.library_files for each row execute function private.guard_library_files();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('kp-library-files','kp-library-files',false,2097152,array['application/pdf','application/zip']);
create policy kp_library_files_read on storage.objects for select to authenticated using(bucket_id='kp-library-files' and (select private.is_active_member()) and exists(select 1 from public.library_files f where f.object_path=storage.objects.name));
create policy kp_library_files_upload on storage.objects for insert to authenticated with check(bucket_id='kp-library-files' and (select private.is_admin()) and exists(select 1 from public.library_files f where f.object_path=storage.objects.name and f.state='pending' and f.created_by=(select auth.uid())));
-- No storage update/delete policy: originals are retained and served as attachments only.
