-- Company knowledge lives in KP; Notion remains a provenance/backup reference.
create table public.knowledge_documents (
 id uuid primary key default gen_random_uuid(),
 title text not null check (btrim(title) <> ''),
 content text not null check (btrim(content) <> ''),
 category text not null default 'company' check(category in ('company','sop','solta','snd')),
 status text not null default 'current' check(status in ('current','draft','historical')),
 source_page_id text unique,
 source_url text,
 revision integer not null default 1,
 updated_by uuid not null default auth.uid() references public.profiles(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.knowledge_revisions (
 id uuid primary key default gen_random_uuid(),
 document_id uuid not null references public.knowledge_documents(id),
 revision integer not null,
 title text not null,
 content text not null,
 status text not null,
 category text not null,
 updated_by uuid not null references public.profiles(id),
 saved_at timestamptz not null,
 unique(document_id,revision)
);
create function public.track_knowledge_revision() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.knowledge_revisions(document_id,revision,title,content,status,category,updated_by,saved_at)
 values(old.id,old.revision,old.title,old.content,old.status,old.category,old.updated_by,old.updated_at);
 new.revision=old.revision+1;
 new.updated_at=now();
 new.updated_by=coalesce(auth.uid(),new.updated_by);
 return new;
end;
$$;
revoke all on function public.track_knowledge_revision() from public, anon, authenticated;
create trigger knowledge_track_revision before update on public.knowledge_documents for each row execute function public.track_knowledge_revision();
alter table public.knowledge_documents enable row level security;
alter table public.knowledge_revisions enable row level security;
revoke all on public.knowledge_documents,public.knowledge_revisions from anon,authenticated;
grant select,insert,update on public.knowledge_documents to authenticated;
grant select on public.knowledge_revisions to authenticated;
create policy knowledge_read on public.knowledge_documents for select to authenticated using((select private.is_active_member()));
create policy knowledge_create on public.knowledge_documents for insert to authenticated with check((select private.is_admin()) and updated_by=auth.uid());
create policy knowledge_edit on public.knowledge_documents for update to authenticated using((select private.is_admin())) with check((select private.is_admin()) and updated_by=auth.uid());
create policy knowledge_history_read on public.knowledge_revisions for select to authenticated using((select private.is_active_member()));
