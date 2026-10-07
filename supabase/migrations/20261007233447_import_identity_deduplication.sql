-- Tighten import identity matching without deleting existing data or receipts.
create or replace function private.import_lead_batch(p_id uuid,p_file text,p_rows jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
 v_fingerprint:=lower(coalesce(domain,regexp_replace(company,'[^[:alnum:]]','','g')));
 if exists(select 1 from public.lead_import_keys where business_id=business and lead_import_keys.fingerprint=v_fingerprint) then skipped:=skipped+1;continue;end if;
 org:=null;
 if domain is not null then select id into org from public.organizations where lower(organizations.domain)=domain and archived_at is null;end if;
 if org is null then
 select count(*),min(id::text)::uuid into matches,org from public.organizations where archived_at is null and (
 (regexp_replace(lower(name),'[^[:alnum:]]','','g')=regexp_replace(lower(company),'[^[:alnum:]]','','g') and (domain is null or organizations.domain is null or lower(organizations.domain)=domain))
 or (email is not null and (lower(public_email)=email or exists(select 1 from public.people pe where pe.organization_id=organizations.id and pe.archived_at is null and lower(pe.email)=email)))
 or (domain is not null and regexp_replace(lower(substring(website from '^https?://([^/:?#]+)')),'^www\.','')=domain)
 );
 if matches>1 then raise exception 'Ambiguous existing company: %',company;end if;
 end if;
 if org is null then org:=gen_random_uuid();insert into public.organizations(id,name,website,domain,phone,public_email,description) values(org,company,nullif(row->>'website',''),domain,nullif(row->>'phone',''),email,nullif(row->>'notes',''));end if;
 -- Avoid adding a second unqualified lead for a company already in this pipeline.
 select id into opportunity from public.opportunities where business_id=business and organization_id=org and archived_at is null  order by created_at limit 1;
 if opportunity is null then select opportunity_id into opportunity from public.lead_import_keys k join public.opportunities o on o.id=k.opportunity_id where k.business_id=business and o.organization_id=org limit 1;end if;
 if opportunity is not null then skipped:=skipped+1;insert into public.lead_import_keys values(business,v_fingerprint,opportunity,p_id);continue;end if;
 if nullif(row->>'contact','') is not null then
 person:=null;
 if email is not null then select id into person from public.people where organization_id=org and lower(people.email)=email and archived_at is null order by created_at limit 1;end if;
 if person is null then select id into person from public.people where organization_id=org and archived_at is null and regexp_replace(lower(first_name||coalesce(' '||last_name,'')),'[^[:alnum:]]','','g')=regexp_replace(lower(row->>'contact'),'[^[:alnum:]]','','g') order by created_at limit 1;end if;
 if person is null then person:=gen_random_uuid();insert into public.people(id,organization_id,first_name,email,phone,notes) values(person,org,row->>'contact',email,nullif(row->>'phone',''),nullif(row->>'notes',''));end if;
 end if;
 opportunity:=gen_random_uuid();
 insert into public.opportunities(id,business_id,pipeline_id,stage_id,organization_id,name,owner_id,source,source_url,next_action,metadata) values(opportunity,business,pipeline,stage,org,company||case when nullif(row->>'service','') is null then '' else ' · '||left(row->>'service',100) end,auth.uid(),coalesce(nullif(row->>'source',''),'Spreadsheet research'),nullif(row->>'source_url',''),'Review sourced lead before outreach',jsonb_build_object('import_service',coalesce(row->>'service',''),'research_notes',coalesce(row->>'notes',''),'import_batch_id',p_id,'routing_override',coalesce(row->>'override_reason','')));
 insert into public.lead_import_keys values(business,v_fingerprint,opportunity,p_id);added:=added+1;
 end loop;
 result:=jsonb_build_object('added',added,'skipped',skipped);
 insert into public.lead_import_batches(id,actor_id,file_name,payload,result) values(p_id,auth.uid(),p_file,p_rows,result);return result;
end $$;
