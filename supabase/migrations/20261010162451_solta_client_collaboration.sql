-- Customer submissions remain in KP; external actors never become staff profiles.
create table public.solta_portal_messages (
 id uuid primary key, project_id uuid not null references public.client_engagements(id),
 actor_id text not null check(length(actor_id) between 1 and 100), actor_name text not null check(length(actor_name) between 1 and 100),
 body text not null check(length(trim(body)) between 1 and 10000), created_at timestamptz not null default now()
);
create table public.solta_portal_files (
 id uuid primary key, project_id uuid not null references public.client_engagements(id),
 actor_id text not null check(length(actor_id) between 1 and 100),
 name text not null check(name ~ '^[a-zA-Z0-9._-]{1,180}$' and name not in ('.','..')),
 object_path text not null unique, size_bytes integer not null check(size_bytes between 1 and 20971520),
 mime_type text not null check(mime_type in ('application/pdf','image/png','image/jpeg','image/heic','image/heif','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','text/csv')),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'), state text not null default 'pending' check(state in ('pending','ready')),
 created_at timestamptz not null default now(), verified_at timestamptz, check(object_path='portal/'||project_id::text||'/'||id::text||'/'||name), check(state<>'ready' or verified_at is not null)
);
create table public.solta_portal_previews (
 version_id uuid primary key references public.deliverable_publications(id),
 preview_url text not null check(preview_url ~ '^https://[^ /]+/' and length(preview_url)<=2000),
 published_by uuid not null references public.profiles(id), published_at timestamptz not null default now()
);
create table public.solta_portal_decisions (
 id uuid primary key, version_id uuid not null unique references public.solta_portal_previews(version_id),
 actor_id text not null check(length(actor_id) between 1 and 100), actor_name text not null check(length(actor_name) between 1 and 100),
 outcome text not null check(outcome in ('approved','changes_requested')),
 note text not null check(length(note)<=5000 and (outcome<>'changes_requested' or length(trim(note))>0)), created_at timestamptz not null default now()
);
create index solta_messages_project_idx on public.solta_portal_messages(project_id,created_at);
create index solta_files_project_idx on public.solta_portal_files(project_id,created_at);
create index solta_preview_publisher_idx on public.solta_portal_previews(published_by);
do $$declare t text;begin
 foreach t in array array['solta_portal_messages','solta_portal_files','solta_portal_previews','solta_portal_decisions'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy staff_read on public.%I for select to authenticated using ((select private.is_active_member()))',t);
 end loop;
end $$;

-- New formats are validated from stored bytes before they become visible.
update storage.buckets set allowed_mime_types=array['application/pdf','image/png','image/jpeg','text/plain','text/csv','image/heic','image/heif','application/vnd.openxmlformats-officedocument.wordprocessingml.document'] where id='kp-project-files';
create policy staff_read_solta_uploads on storage.objects for select to authenticated using (
 bucket_id='kp-project-files' and (select private.is_active_member()) and exists(select 1 from public.solta_portal_files f where f.object_path=storage.objects.name and f.state='ready')
);

create function private.publish_solta_preview(p_version uuid,p_url text) returns void language plpgsql security definer set search_path='' as $$
declare d public.project_deliverables; v public.deliverable_versions; existing text;
begin
 if not private.is_active_member() then raise exception 'Active staff required';end if;
 select * into v from public.deliverable_versions where id=p_version;
 select * into d from public.project_deliverables where id=v.deliverable_id for update;
 if d.id is null or v.version<>d.current_version or not exists(select 1 from public.deliverable_publications where id=p_version) or not exists(select 1 from public.solta_portal_project_links where project_id=d.project_id and enabled) then raise exception 'Publish a current linked version first';end if;
 if p_url !~ '^https://[^ /]+/' or length(p_url)>2000 or p_url ~ '^https://[^/]*@' then raise exception 'HTTPS preview required';end if;
 select preview_url into existing from public.solta_portal_previews where version_id=p_version;
 if found then if existing<>p_url then raise exception 'Preview is immutable; publish a new version';end if;return;end if;
 insert into public.solta_portal_previews(version_id,preview_url,published_by) values(p_version,p_url,auth.uid());
end $$;
revoke all on function private.publish_solta_preview(uuid,text) from public,anon,authenticated,service_role;
grant execute on function private.publish_solta_preview(uuid,text) to authenticated;
create function public.kp_publish_solta_preview(p_version uuid,p_url text) returns void language sql security invoker set search_path='' as $$select private.publish_solta_preview(p_version,p_url)$$;
revoke all on function public.kp_publish_solta_preview(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.kp_publish_solta_preview(uuid,text) to authenticated;

-- One bounded operation entrypoint. The read boundary independently validates
-- exact company/project/link IDs and consumes a unique signed-request nonce.
create function private.solta_portal_operation(p_request jsonb,p_nonce uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p uuid:=(p_request->>'projectId')::uuid; actor text:=p_request->>'actorId'; op text:=p_request->>'operation'; payload jsonb:=p_request->'payload'; projection jsonb; item jsonb; f public.solta_portal_files; v public.deliverable_versions; d public.project_deliverables; decision public.solta_portal_decisions; request_id uuid;
begin
 projection:=private.read_solta_portal(p,(p_request->>'organizationId')::uuid,(p_request->>'portalProjectId')::uuid,actor,p_nonce);
 if projection is null then return null;end if;
 if op='project.read' then
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'version',1)),'[]') into item from (select id,name from public.solta_portal_files where project_id=p and state='ready' order by created_at desc limit 100)s;
  projection:=jsonb_set(projection,'{files}',projection->'files'||item);
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'body',s.body,'createdAt',to_char(s.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'authorName',s.actor_name)),'[]') into item from (select id,body,created_at,actor_name from public.solta_portal_messages where project_id=p order by created_at desc limit 100)s;
  projection:=jsonb_set(projection,'{messages}',projection->'messages'||item);
  select coalesce(jsonb_agg(jsonb_build_object('id',vv.id,'version',vv.version,'title',dd.title,'previewUrl',u.preview_url,'status',case when r.outcome='approved' then 'approved' when r.outcome='changes_requested' then 'changes' else 'pending' end)),'[]') into item from public.solta_portal_previews u join public.deliverable_versions vv on vv.id=u.version_id join public.project_deliverables dd on dd.id=vv.deliverable_id left join public.solta_portal_decisions r on r.version_id=vv.id where dd.project_id=p and vv.version=dd.current_version;
  return jsonb_set(projection,'{reviews}',item);
 end if;
 if length(coalesce(p_request->>'actorName','')) not between 1 and 100 or coalesce(p_request->>'actorRole','') not in ('member','approver') then raise exception 'Invalid actor';end if;
 if op='message.create' then
  request_id:=(payload->>'requestId')::uuid;
  select to_jsonb(m) into item from public.solta_portal_messages m where id=request_id;
  if found then if item->>'project_id'<>p::text or item->>'actor_id'<>actor or item->>'body' is distinct from payload->>'body' then raise exception 'Retry mismatch';end if;
  else insert into public.solta_portal_messages(id,project_id,actor_id,actor_name,body) values(request_id,p,actor,p_request->>'actorName',payload->>'body');end if;
  return jsonb_build_object('id',request_id);
 elsif op='file.reserve' then
  request_id:=(payload->>'requestId')::uuid;
  select * into f from public.solta_portal_files where id=request_id;
  if found then
   if f.project_id<>p or f.actor_id<>actor or f.name is distinct from payload->>'name' or f.size_bytes is distinct from (payload->>'size')::int or f.mime_type is distinct from payload->>'mime' or f.sha256 is distinct from payload->>'sha256' then raise exception 'Retry mismatch';end if;
  else
   insert into public.solta_portal_files(id,project_id,actor_id,name,object_path,size_bytes,mime_type,sha256) values(request_id,p,actor,payload->>'name','portal/'||p::text||'/'||request_id::text||'/'||(payload->>'name'),(payload->>'size')::int,payload->>'mime',payload->>'sha256') returning * into f;
  end if;
  return jsonb_build_object('id',f.id,'path',f.object_path,'state',f.state);
 elsif op in ('file.inspect','file.complete') then
  select * into f from public.solta_portal_files where id=(payload->>'fileId')::uuid and project_id=p and actor_id=actor for update;
  if not found then return null;end if;
  if op='file.complete' then
   if payload->>'verifiedSha256' is distinct from f.sha256 or not exists(select 1 from storage.objects where bucket_id='kp-project-files' and name=f.object_path and (metadata->>'size')::bigint=f.size_bytes) then raise exception 'Upload not verified';end if;
   update public.solta_portal_files set state='ready',verified_at=coalesce(verified_at,now()) where id=f.id;
   return jsonb_build_object('id',f.id,'state','ready');
  end if;
  return jsonb_build_object('id',f.id,'path',f.object_path,'name',f.name,'size',f.size_bytes,'mime',f.mime_type,'sha256',f.sha256,'state',f.state);
 elsif op='file.download' then
  select jsonb_build_object('path',object_path,'name',name) into item from public.solta_portal_files where id=(payload->>'fileId')::uuid and project_id=p and state='ready';
  if not found then select jsonb_build_object('path',object_path,'name',name) into item from public.project_files where id=(payload->>'fileId')::uuid and project_id=p and state='ready' and audience='client' and object_path is not null;end if;
  return item;
 elsif op='review.decide' then
  request_id:=(payload->>'requestId')::uuid;
  select * into v from public.deliverable_versions where id=(payload->>'reviewId')::uuid;
  select * into d from public.project_deliverables where id=v.deliverable_id for update;
  if d.project_id is distinct from p or not exists(select 1 from public.solta_portal_previews where version_id=v.id) then return null;end if;
  if payload->>'outcome'='approved' and (p_request->>'actorRole'<>'approver' or payload->>'confirmed'<>'true') then raise exception 'Approver confirmation required';end if;
  select * into decision from public.solta_portal_decisions where id=request_id;
  if found then
   if decision.version_id<>v.id or decision.actor_id<>actor or decision.outcome is distinct from payload->>'outcome' or decision.note is distinct from payload->>'note' then raise exception 'Retry mismatch';end if;
   return jsonb_build_object('id',decision.id);
  end if;
  if v.version<>d.current_version or v.version is distinct from (payload->>'version')::int then raise exception 'Version changed';end if;
  if exists(select 1 from public.deliverable_reviews where version_id=v.id and lane='client_record') then raise exception 'Version already reviewed';end if;
  insert into public.solta_portal_decisions(id,version_id,actor_id,actor_name,outcome,note) values(request_id,v.id,actor,p_request->>'actorName',payload->>'outcome',payload->>'note');
  return jsonb_build_object('id',request_id);
 end if;
 raise exception 'Unsupported operation';
end $$;
revoke all on function private.solta_portal_operation(jsonb,uuid) from public,anon,authenticated,service_role;
grant execute on function private.solta_portal_operation(jsonb,uuid) to service_role;
create function public.kp_solta_portal_operation(p_request jsonb,p_nonce uuid) returns jsonb language sql security invoker set search_path='' as $$select private.solta_portal_operation(p_request,p_nonce)$$;
revoke all on function public.kp_solta_portal_operation(jsonb,uuid) from public,anon,authenticated,service_role;
grant execute on function public.kp_solta_portal_operation(jsonb,uuid) to service_role;

-- Staff recording must not supersede an immutable response from the portal.
alter function private.review_deliverable(uuid,uuid,text,text,text,text,text) rename to review_deliverable_before_portal;
create function private.review_deliverable(p_id uuid,p_version uuid,p_lane text,p_outcome text,p_note text,p_client_name text,p_evidence text) returns uuid language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.project_deliverables d join public.deliverable_versions v on v.deliverable_id=d.id where v.id=p_version for update of d;
 if p_lane='client_record' and exists(select 1 from public.solta_portal_decisions where version_id=p_version) then raise exception 'Client already responded through the portal';end if;
 return private.review_deliverable_before_portal(p_id,p_version,p_lane,p_outcome,p_note,p_client_name,p_evidence);
end $$;
revoke all on function private.review_deliverable_before_portal(uuid,uuid,text,text,text,text,text) from public,anon,authenticated,service_role;
revoke all on function private.review_deliverable(uuid,uuid,text,text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function private.review_deliverable(uuid,uuid,text,text,text,text,text) to authenticated;
