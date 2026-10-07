-- Human-facing removal is recoverable. Permanent deletion is not exposed.
revoke delete on public.organizations,public.people,public.opportunities,public.projects,public.tasks,public.decisions from authenticated;
create table public.lead_import_batches(id uuid primary key, actor_id uuid not null references public.profiles(id), file_name text not null, payload jsonb not null, result jsonb not null, created_at timestamptz not null default now());
create index lead_import_batches_actor_idx on public.lead_import_batches(actor_id);
create table public.lead_import_keys(business_id uuid not null references public.businesses(id), fingerprint text not null, opportunity_id uuid not null references public.opportunities(id), batch_id uuid not null references public.lead_import_batches(id) deferrable initially deferred, primary key(business_id,fingerprint));
create index lead_import_keys_opportunity_idx on public.lead_import_keys(opportunity_id);
create index lead_import_keys_batch_idx on public.lead_import_keys(batch_id);
create table public.archive_events(id uuid primary key default gen_random_uuid(),entity_type text not null check(entity_type in ('organization','person','opportunity','project','task')),entity_id uuid not null,entity_name text not null,operation text not null check(operation in ('archive','restore')),reason text not null check(length(trim(reason)) between 5 and 2000),actor_id uuid not null references public.profiles(id),created_at timestamptz not null default now());
create index archive_events_actor_idx on public.archive_events(actor_id);
create index archive_events_entity_idx on public.archive_events(entity_type,entity_id,created_at);
alter table public.lead_import_batches enable row level security;
alter table public.lead_import_keys enable row level security;
alter table public.archive_events enable row level security;
revoke all on public.lead_import_batches,public.lead_import_keys,public.archive_events from anon,authenticated;
grant select on public.lead_import_batches,public.lead_import_keys to authenticated;
grant select on public.archive_events to authenticated;
create policy staff_read_import_batches on public.lead_import_batches for select to authenticated using((select private.is_active_member()));
create policy staff_read_import_keys on public.lead_import_keys for select to authenticated using((select private.is_active_member()));
create policy admins_read_archive_events on public.archive_events for select to authenticated using((select private.is_admin()));

create function private.import_lead_batch(p_id uuid,p_file text,p_rows jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare receipt public.lead_import_batches; row jsonb; business uuid; pipeline uuid; stage uuid; org uuid; person uuid; opportunity uuid; v_fingerprint text; suggested text; added integer:=0; skipped integer:=0; matches integer; result jsonb; email text; company text; domain text;
begin
 if not private.is_active_member() then raise exception 'Active membership required'; end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) not between 1 and 500 or length(p_rows::text)>3000000 or length(trim(p_file)) not between 1 and 200 then raise exception 'Invalid import size'; end if;
 perform pg_advisory_xact_lock(hashtextextended('kp-lead-import',0));
 select * into receipt from public.lead_import_batches where id=p_id;
 if found then if receipt.actor_id<>auth.uid() or receipt.payload<>p_rows or receipt.file_name<>p_file then raise exception 'Import retry mismatch'; end if;return receipt.result;end if;
 for row in select value from jsonb_array_elements(p_rows) loop
 if jsonb_typeof(row)<>'object' or exists(select 1 from jsonb_each(row) v where jsonb_typeof(v.value)<>'string' or length(v.value#>>'{}')>10000) then raise exception 'Import cells must be text';end if;
 company:=trim(row->>'company'); domain:=nullif(lower(trim(row->>'domain')),'');email:=nullif(lower(trim(row->>'email')),'');
 if coalesce(length(company),0) not between 1 and 300 or (email is not null and email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'Invalid company or email';end if;
 if row->>'business' not in ('solta','snd') or row->>'business' is null then raise exception 'Choose an active business'; end if;
 suggested:=case when coalesce(row->>'service','')~* '\m(website|web design|branding|brand design|logo|less office|workflow automation|website care)\M' and coalesce(row->>'service','')!~* '\m(snd|s&d|sent.?delivered|email marketing|lifecycle|deliverability|klaviyo|email automation)\M' then 'solta' when coalesce(row->>'service','')~* '\m(snd|s&d|sent.?delivered|email marketing|lifecycle|deliverability|klaviyo|email automation)\M' and coalesce(row->>'service','')!~* '\m(website|web design|branding|brand design|logo|less office|workflow automation|website care)\M' then 'snd' else null end;
 if suggested is not null and suggested<>row->>'business' and length(trim(coalesce(row->>'override_reason','')))<5 then raise exception 'Explain the service/business override';end if;
 if nullif(row->>'website','') is not null and (row->>'website'!~ '^https?://' or row->>'website'~ '^https?://[^/]*@') then raise exception 'Invalid website';end if;
 if nullif(row->>'source_url','') is not null and (row->>'source_url'!~ '^https?://' or row->>'source_url'~ '^https?://[^/]*@') then raise exception 'Invalid source URL';end if;
 if domain is distinct from nullif(regexp_replace(lower(substring(row->>'website' from '^https?://([^/:?#]+)')),'^www\.',''),'') then raise exception 'Website/domain mismatch';end if;
 select id into business from public.businesses where slug=row->>'business' and is_active;
 select id into pipeline from public.pipelines where business_id=business and is_default and archived_at is null;
 select id into stage from public.pipeline_stages where pipeline_id=pipeline and kind='open' order by position limit 1;
 if business is null or stage is null then raise exception 'Business pipeline unavailable';end if;
 v_fingerprint:=lower(coalesce(domain,company))||'|'||lower(trim(coalesce(row->>'service','')));
 if exists(select 1 from public.lead_import_keys where business_id=business and lead_import_keys.fingerprint=v_fingerprint) then skipped:=skipped+1;continue;end if;
 org:=null;
 if domain is not null then select id into org from public.organizations where lower(organizations.domain)=domain and archived_at is null;end if;
 if org is null then
 select count(*),min(id::text)::uuid into matches,org from public.organizations where lower(name)=lower(company) and archived_at is null;
 if matches>1 then raise exception 'Ambiguous existing company: %',company;end if;
 end if;
 if org is null then org:=gen_random_uuid();insert into public.organizations(id,name,website,domain,phone,public_email,description) values(org,company,nullif(row->>'website',''),domain,nullif(row->>'phone',''),email,nullif(row->>'notes',''));end if;
 -- Avoid adding a second unqualified lead for a company already in this pipeline.
 select id into opportunity from public.opportunities where business_id=business and organization_id=org and archived_at is null and (metadata->>'import_service' is null or lower(metadata->>'import_service')=lower(coalesce(row->>'service',''))) order by created_at limit 1;
 if opportunity is not null then skipped:=skipped+1;insert into public.lead_import_keys values(business,v_fingerprint,opportunity,p_id);continue;end if;
 if nullif(row->>'contact','') is not null then
 person:=null;
 if email is not null then select id into person from public.people where organization_id=org and lower(people.email)=email and archived_at is null order by created_at limit 1;end if;
 if person is null then person:=gen_random_uuid();insert into public.people(id,organization_id,first_name,email,phone,notes) values(person,org,row->>'contact',email,nullif(row->>'phone',''),nullif(row->>'notes',''));end if;
 end if;
 opportunity:=gen_random_uuid();
 insert into public.opportunities(id,business_id,pipeline_id,stage_id,organization_id,name,owner_id,source,source_url,next_action,metadata) values(opportunity,business,pipeline,stage,org,company||case when nullif(row->>'service','') is null then '' else ' · '||left(row->>'service',100) end,auth.uid(),coalesce(nullif(row->>'source',''),'Spreadsheet research'),nullif(row->>'source_url',''),'Review sourced lead before outreach',jsonb_build_object('import_service',coalesce(row->>'service',''),'research_notes',coalesce(row->>'notes',''),'import_batch_id',p_id,'routing_override',coalesce(row->>'override_reason','')));
 insert into public.lead_import_keys values(business,v_fingerprint,opportunity,p_id);added:=added+1;
 end loop;
 result:=jsonb_build_object('added',added,'skipped',skipped);
 insert into public.lead_import_batches(id,actor_id,file_name,payload,result) values(p_id,auth.uid(),p_file,p_rows,result);return result;
end $$;
revoke all on function private.import_lead_batch(uuid,text,jsonb) from public,anon;
grant execute on function private.import_lead_batch(uuid,text,jsonb) to authenticated;
create function public.kp_import_lead_batch(p_id uuid,p_file text,p_rows jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.import_lead_batch(p_id,p_file,p_rows)$$;
revoke all on function public.kp_import_lead_batch(uuid,text,jsonb) from public,anon;
grant execute on function public.kp_import_lead_batch(uuid,text,jsonb) to authenticated;

create function private.archive_record(p_type text,p_id uuid,p_operation text,p_confirmation text,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare tab text; label text; archived timestamptz;
begin
 if not private.is_admin() then raise exception 'Admin permission required';end if;
 tab:=case p_type when 'organization' then 'organizations' when 'person' then 'people' when 'opportunity' then 'opportunities' when 'project' then 'projects' when 'task' then 'tasks' end;
 if tab is null or p_operation not in ('archive','restore') or p_operation is null then raise exception 'Invalid record action';end if;
 execute format('select %s,archived_at from public.%I where id=$1 for update',case p_type when 'person' then 'first_name||coalesce('' ''||last_name,'''')' when 'task' then 'title' else 'name' end,tab) into label,archived using p_id;
 if label is null then raise exception 'Record unavailable';end if;
 if p_confirmation is distinct from upper(p_operation)||' '||label or length(trim(coalesce(p_reason,''))) not between 5 and 2000 then raise exception 'Type the exact confirmation and explain why';end if;
 if (p_operation='archive' and archived is not null) or (p_operation='restore' and archived is null) then return;end if;
 if p_type='organization' and p_operation='archive' and (exists(select 1 from public.opportunities where organization_id=p_id and archived_at is null) or exists(select 1 from public.projects where organization_id=p_id and archived_at is null) or exists(select 1 from public.people where organization_id=p_id and archived_at is null) or exists(select 1 from public.relationships where organization_id=p_id and archived_at is null)) then raise exception 'Archive or move linked contacts, opportunities, projects and relationships first';end if;
 execute format('update public.%I set archived_at=$1 where id=$2',tab) using case when p_operation='archive' then now() else null end,p_id;
 insert into public.archive_events(entity_type,entity_id,entity_name,operation,reason,actor_id) values(p_type,p_id,label,p_operation,p_reason,auth.uid());
end $$;
revoke all on function private.archive_record(text,uuid,text,text,text) from public,anon;
grant execute on function private.archive_record(text,uuid,text,text,text) to authenticated;
create function public.kp_archive_record(p_type text,p_id uuid,p_operation text,p_confirmation text,p_reason text) returns void language sql security invoker set search_path='' as $$select private.archive_record(p_type,p_id,p_operation,p_confirmation,p_reason)$$;
revoke all on function public.kp_archive_record(text,uuid,text,text,text) from public,anon;
grant execute on function public.kp_archive_record(text,uuid,text,text,text) to authenticated;
