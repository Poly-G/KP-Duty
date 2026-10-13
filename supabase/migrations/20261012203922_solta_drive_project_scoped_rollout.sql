-- Project-scoped rollout; no global Drive activation is needed.
create table public.solta_drive_projects(project_id uuid primary key references public.projects(id),enabled boolean not null default false);
alter table public.solta_drive_projects enable row level security;
revoke all on public.solta_drive_projects from public,anon,authenticated;
grant select,insert,update,delete on public.solta_drive_projects to service_role;
create or replace function private.solta_portal_drive_operation(p_request jsonb,p_nonce uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; mapping public.solta_drive_files; f public.solta_portal_files; op text:=p_request->>'operation'; v_file_id uuid;
begin
 if op='file.complete' then
  -- Reuse the original project/company/actor/nonce boundary before touching files.
  result:=private.solta_portal_operation(jsonb_set(p_request,'{operation}','"file.inspect"'),p_nonce);
  if result is null then return null;end if;
  v_file_id:=(result->>'id')::uuid;select * into mapping from public.solta_drive_files where solta_drive_files.file_id=v_file_id;
  if found then
   select * into f from public.solta_portal_files where id=v_file_id for update;
   if p_request->'payload'->>'verifiedSha256' is distinct from f.sha256 or p_request->'payload'->>'verifiedDriveId' is distinct from mapping.drive_id or (p_request->'payload'->>'verifiedSize')::int is distinct from f.size_bytes then raise exception 'Drive upload not verified';end if;
   update public.solta_portal_files set state='ready',verified_at=coalesce(verified_at,now()) where id=v_file_id;
   return jsonb_build_object('id',v_file_id,'state','ready');
  end if;
  -- The inspection consumed this nonce. Legacy completion needs a fresh one.
  return private.solta_portal_operation(p_request,gen_random_uuid());
 end if;
 result:=private.solta_portal_operation(p_request,p_nonce);if result is null then return null;end if;
 if op='file.reserve' then result:=result||jsonb_build_object('driveEnabled',exists(select 1 from public.solta_drive_projects where project_id=(p_request->>'projectId')::uuid and enabled),'companyName',(select name from public.organizations where id=(p_request->>'organizationId')::uuid),'projectName',(select name from public.projects where id=(p_request->>'projectId')::uuid));end if;
 if op in ('file.inspect','file.download','file.reserve') then
  v_file_id:=case when op='file.reserve' then (result->>'id')::uuid else (p_request->'payload'->>'fileId')::uuid end;
  select * into mapping from public.solta_drive_files where solta_drive_files.file_id=v_file_id;
  if found then
   select * into f from public.solta_portal_files where id=v_file_id;
   result:=result||jsonb_build_object('provider','google-drive','driveId',mapping.drive_id,'folderId',mapping.folder_id,'size',f.size_bytes,'sha256',f.sha256,'mime',f.mime_type);
  end if;
 end if;
 return result;
end $$;
