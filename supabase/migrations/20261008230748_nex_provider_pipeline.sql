-- No live delivery or marketplace capability is enabled by this migration.
-- Preserve the legacy pipeline; refuse to hide unmapped live opportunities.
do $$
declare biz uuid; target uuid;
begin
 select id into biz from public.businesses where slug='nex';
 if biz is null then raise exception 'Nex business missing'; end if;
 if exists(select 1 from public.opportunities o join public.pipelines p on p.id=o.pipeline_id where o.business_id=biz and o.archived_at is null and p.slug<>'provider-onboarding' and not exists(select 1 from public.nex_provider_attempts a where a.kp_opportunity_id=o.id)) then raise exception 'Review unmapped Nex opportunities before pipeline migration'; end if;
 insert into public.pipelines(business_id,slug,name,is_default) values(biz,'provider-onboarding','Provider onboarding',false) on conflict(business_id,slug) do nothing;
 select id into target from public.pipelines where business_id=biz and slug='provider-onboarding' and archived_at is null;
 if target is null then raise exception 'Provider onboarding pipeline unavailable'; end if;
 insert into public.pipeline_stages(pipeline_id,slug,name,position,kind)
 select target,slug,name,position,kind::public.opportunity_stage_kind from (values
 ('ready_for_outreach','Ready for outreach',10,'open'),('outreach','Outreach in progress',20,'open'),
 ('responded','Responded',30,'open'),('verifying','Verifying',40,'open'),('completing','Completing profile',50,'open'),
 ('onboarded','Onboarded',60,'won'),('not_onboarded','Not onboarded',70,'lost')) s(slug,name,position,kind)
 on conflict(pipeline_id,slug) do nothing;
 update public.pipelines set is_default=false where business_id=biz and is_default and id<>target;
 update public.pipelines set is_default=true where id=target;
end $$;

create function private.validate_nex_provider_operations(p jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare k text; v jsonb;
begin
 if jsonb_typeof(p) is distinct from 'object' or (select array_agg(key order by key) from jsonb_object_keys(p) key) is distinct from
 array['asOfAt','attemptNumber','closedAt','endReason','lastTouchAt','nextActionDueAt','openedAt','outreachStatus','rulesVersion','stallPhase','stalled','stalledSince']::text[] then raise exception 'Invalid provider operations'; end if;
 for k,v in select key,value from jsonb_each(p) loop
  if k in ('attemptNumber','rulesVersion') then
   if jsonb_typeof(v)<>'number' or v::text !~ '^[1-9][0-9]{0,15}$' or v::numeric>9007199254740991 then raise exception 'Invalid operations version'; end if;
  elsif k='stalled' then
   if jsonb_typeof(v)<>'boolean' then raise exception 'Invalid stall condition'; end if;
  elsif k not in ('openedAt','asOfAt','outreachStatus') and v='null'::jsonb then null;
  elsif jsonb_typeof(v)<>'string' then raise exception 'Invalid operations value'; end if;
 end loop;
 if p->>'outreachStatus' not in ('not_eligible','ready','active','responded','paused','ended')
 or (p->>'endReason' is not null and p->>'endReason' not in ('completed','no_response','declined','contact_stop','organization_stop','organization_closed','organization_merged','superseded'))
 or (p->>'stallPhase' is not null and p->>'stallPhase' not in ('outreach','responded','verifying','completing'))
 or ((p->>'outreachStatus'='ended') <> (p->>'endReason' is not null and p->>'closedAt' is not null))
 or (p->>'outreachStatus'<>'ended' and (p->>'endReason' is not null or p->>'closedAt' is not null))
 or ((p->>'stalled')::boolean <> (p->>'stallPhase' is not null and p->>'stalledSince' is not null))
 or (p->>'stalled'='false' and (p->>'stallPhase' is not null or p->>'stalledSince' is not null))
 or (p->>'stalled'='true' and p->>'outreachStatus' in ('not_eligible','ready','paused','ended')) then raise exception 'Invalid operations state'; end if;
 for k,v in select key,value from jsonb_each(p) where key in ('openedAt','closedAt','asOfAt','lastTouchAt','nextActionDueAt','stalledSince') loop
  if v<>'null'::jsonb and (v#>>'{}' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$' or
  to_char((v#>>'{}')::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')<>v#>>'{}') then raise exception 'Invalid operations date'; end if;
  if k not in ('asOfAt','nextActionDueAt') and v<>'null'::jsonb and ((v#>>'{}')::timestamptz>(p->>'asOfAt')::timestamptz or (v#>>'{}')::timestamptz<(p->>'openedAt')::timestamptz) then raise exception 'Invalid operations chronology'; end if;
 end loop;
end $$;
revoke all on function private.validate_nex_provider_operations(jsonb) from public,anon,authenticated,service_role;

-- Last in BEFORE UPDATE order, after normal CRM timestamp bookkeeping.
-- The desired stage is derived from the accepted snapshot, never a session flag.
create function private.guard_nex_provider_opportunity()
returns trigger language plpgsql security definer set search_path='' as $$
declare a public.nex_provider_attempts; s public.nex_provider_snapshots; desired uuid; pipe uuid; org uuid; biz uuid;
begin
 select * into a from public.nex_provider_attempts where kp_opportunity_id=old.id;
 if not found then return new; end if;
 select * into s from public.nex_provider_snapshots where nex_attempt_id=a.nex_attempt_id;
 select l.kp_organization_id into org from public.nex_provider_organizations l where l.nex_organization_id=a.nex_organization_id;
 select b.id,p.id,ps.id into biz,pipe,desired from public.businesses b join public.pipelines p on p.business_id=b.id and p.slug='provider-onboarding' and p.archived_at is null join public.pipeline_stages ps on ps.pipeline_id=p.id and ps.slug=s.snapshot->>'onboardingPhase' where b.slug='nex';
 if new.business_id is distinct from old.business_id or new.organization_id is distinct from org then raise exception 'Linked Nex identity is immutable'; end if;
 if s.nex_attempt_id is null then
  if new.pipeline_id is distinct from old.pipeline_id or new.stage_id is distinct from old.stage_id then raise exception 'Awaiting accepted Nex state'; end if;
  new.won_at:=old.won_at;new.lost_at:=old.lost_at;return new;
 end if;
 if desired is null or new.business_id is distinct from biz or new.pipeline_id is distinct from pipe or new.stage_id is distinct from desired then raise exception 'Linked onboarding stage is controlled by Nex'; end if;
 if s.snapshot->>'onboardingPhase'='onboarded' then new.won_at:=(s.snapshot->>'onboardedAt')::timestamptz;new.lost_at:=null;
 elsif s.snapshot->>'onboardingPhase'='not_onboarded' then new.won_at:=null;new.lost_at:=coalesce(old.lost_at,s.occurred_at);
 else new.won_at:=null;new.lost_at:=null;end if;
 return new;
end $$;
revoke all on function private.guard_nex_provider_opportunity() from public,anon,authenticated,service_role;
create trigger zz_nex_provider_opportunity_guard before update on public.opportunities for each row execute function private.guard_nex_provider_opportunity();

create function private.project_nex_provider_pipeline()
returns trigger language plpgsql security definer set search_path='' as $$
declare desired uuid; pipe uuid; oid uuid;
begin
 select a.kp_opportunity_id,p.id,ps.id into oid,pipe,desired from public.nex_provider_attempts a join public.opportunities o on o.id=a.kp_opportunity_id join public.businesses b on b.id=o.business_id and b.slug='nex' join public.pipelines p on p.business_id=b.id and p.slug='provider-onboarding' and p.archived_at is null join public.pipeline_stages ps on ps.pipeline_id=p.id and ps.slug=new.snapshot->>'onboardingPhase' where a.nex_attempt_id=new.nex_attempt_id;
 if desired is null then raise exception 'Provider pipeline unavailable'; end if;
 update public.opportunities set pipeline_id=pipe,stage_id=desired where id=oid;
 return new;
end $$;
revoke all on function private.project_nex_provider_pipeline() from public,anon,authenticated,service_role;
create trigger nex_provider_pipeline_projection after insert or update on public.nex_provider_snapshots for each row execute function private.project_nex_provider_pipeline();
-- Re-project only already accepted mirrors. No synthetic or research records admitted.
update public.nex_provider_snapshots set snapshot=snapshot;

create or replace function public.kp_receive_nex_provider(p_envelope jsonb)
returns text language plpgsql security definer set search_path='' as $$
declare
 p jsonb; k text; v jsonb; eid uuid; org uuid; cid uuid; aid uuid; rev bigint;
 old public.nex_provider_snapshots; prior public.nex_provider_receipts; outcome text;
begin
 if jsonb_typeof(p_envelope) is distinct from 'object' or
 (select array_agg(key order by key) from jsonb_object_keys(p_envelope) key) is distinct from array['entityType','eventId','eventType','occurredAt','payload','schemaVersion','source','target']::text[]
 or p_envelope->'schemaVersion' not in ('1'::jsonb,'2'::jsonb) or p_envelope->>'source' <> 'nexproviders' or p_envelope->>'target' <> 'kp'
 or p_envelope->>'entityType' <> 'provider_onboarding_attempt' or p_envelope->>'eventType' <> 'provider_snapshot' then raise exception 'Invalid provider envelope'; end if;
 for k,v in select key,value from jsonb_each(p_envelope) where key not in ('schemaVersion','payload') loop
  if jsonb_typeof(v) <> 'string' then raise exception 'Invalid provider envelope'; end if;
 end loop;
 p:=p_envelope->'payload';
 if jsonb_typeof(p) is distinct from 'object' or
 (select array_agg(key order by key) from jsonb_object_keys(p) key) is distinct from (case when p_envelope->'schemaVersion'='2'::jsonb then array['admission','attemptId','contactId','contactStatus','disposition','listingReadiness','mergedIntoOrganizationId','onboardedAt','onboardingPhase','operations','organizationId','organizationNoContact','representation','revision']::text[] else array['admission','attemptId','contactId','contactStatus','disposition','listingReadiness','mergedIntoOrganizationId','onboardedAt','onboardingPhase','organizationId','organizationNoContact','representation','revision']::text[] end) then raise exception 'Invalid provider snapshot'; end if;
 for k,v in select key,value from jsonb_each(p) loop
  if k='operations' then perform private.validate_nex_provider_operations(v);
  elsif k='revision' then
   if jsonb_typeof(v) <> 'number' or v::text !~ '^[1-9][0-9]{0,15}$' or v::numeric > 9007199254740991 then raise exception 'Invalid provider revision'; end if;
  elsif k='organizationNoContact' then
   if jsonb_typeof(v) <> 'boolean' then raise exception 'Invalid provider suppression'; end if;
  elsif k in ('contactId','contactStatus','mergedIntoOrganizationId','onboardedAt') and v='null'::jsonb then null;
  elsif jsonb_typeof(v) <> 'string' then raise exception 'Invalid provider value'; end if;
 end loop;
 for k,v in select key,value from jsonb_each(p || jsonb_build_object('eventId',p_envelope->'eventId')) where key in ('organizationId','contactId','attemptId','mergedIntoOrganizationId','eventId') loop
  if v <> 'null'::jsonb and (jsonb_typeof(v)<>'string' or v#>>'{}' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') then raise exception 'Invalid provider identity'; end if;
 end loop;
 if p->>'admission' not in ('approved_preview','inbound_claim') or p->>'listingReadiness' not in ('in_research','preview_ready','decision_ready')
 or p->>'representation' not in ('unrepresented','claim_pending','verified') or p->>'disposition' not in ('active','closed','merged')
 or p->>'onboardingPhase' not in ('ready_for_outreach','outreach','responded','verifying','completing','onboarded','not_onboarded')
 or (p->>'contactStatus' is not null and p->>'contactStatus' not in ('contactable','dnc','wrong_person'))
 or (p->>'contactId' is null) <> (p->>'contactStatus' is null)
 or (p->>'disposition'='merged') <> (p->>'mergedIntoOrganizationId' is not null)
 or p->>'organizationId'=p->>'mergedIntoOrganizationId'
 or (p->>'onboardingPhase'='onboarded') <> (p->>'onboardedAt' is not null) then raise exception 'Invalid provider state'; end if;
 for k,v in select key,value from jsonb_each(p_envelope || jsonb_build_object('onboardedAt',p->'onboardedAt')) where key in ('occurredAt','onboardedAt') loop
  if v<>'null'::jsonb and (jsonb_typeof(v)<>'string' or v#>>'{}' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$') then raise exception 'Invalid provider timestamp'; end if;
  -- Cast rejects impossible calendar dates and normalization rejects leap seconds.
  if v<>'null'::jsonb and to_char((v#>>'{}')::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') <> v#>>'{}' then raise exception 'Invalid provider timestamp'; end if;
 end loop;
 eid:=(p_envelope->>'eventId')::uuid; org:=(p->>'organizationId')::uuid; cid:=(p->>'contactId')::uuid; aid:=(p->>'attemptId')::uuid; rev:=(p->>'revision')::bigint;
 -- Global receiver lock keeps retries, sibling attempts and receipts atomic.
 perform pg_advisory_xact_lock(826018);
 select * into prior from public.nex_provider_receipts where event_id=eid;
 if found then
  if prior.envelope <> p_envelope then raise exception 'Provider event collision'; end if;
  return 'duplicate';
 end if;
 if not exists(select 1 from public.nex_provider_attempts a join public.nex_provider_organizations l using(nex_organization_id) join public.organizations ko on ko.id=l.kp_organization_id join public.opportunities o on o.id=a.kp_opportunity_id join public.businesses b on b.id=o.business_id where a.nex_attempt_id=aid and a.nex_organization_id=org and ko.archived_at is null and o.archived_at is null and o.organization_id=ko.id and b.slug='nex' and b.is_active)
 or (cid is not null and not exists(select 1 from public.nex_provider_contacts c join public.people person on person.id=c.kp_person_id join public.nex_provider_organizations l using(nex_organization_id) where c.nex_contact_id=cid and c.nex_organization_id=org and person.organization_id=l.kp_organization_id and person.archived_at is null)) then raise exception 'Provider links missing or inactive'; end if;
 select * into old from public.nex_provider_snapshots where nex_attempt_id=aid;
 if found and rev=old.revision and p<>old.snapshot then raise exception 'Provider revision collision'; end if;
 if old.revision is not null and rev<=old.revision then outcome:='stale';
 else
  if old.snapshot ? 'operations' and not (p ? 'operations') then raise exception 'Provider operations downgrade rejected'; end if;
  if old.snapshot is not null and (old.snapshot->>'admission'<>p->>'admission' or
   (old.snapshot->>'onboardingPhase' in ('onboarded','not_onboarded') and old.snapshot->>'onboardingPhase'<>p->>'onboardingPhase') or
   (old.snapshot->>'onboardedAt' is not null and old.snapshot->>'onboardedAt' is distinct from p->>'onboardedAt')) then raise exception 'Ended provider attempt cannot reopen'; end if;
  if p->>'onboardingPhase' not in ('onboarded','not_onboarded') and exists(select 1 from public.nex_provider_snapshots s join public.nex_provider_attempts a using(nex_attempt_id) where a.nex_organization_id=org and a.nex_attempt_id<>aid and s.snapshot->>'onboardingPhase' not in ('onboarded','not_onboarded')) then raise exception 'Provider already has an active attempt'; end if;
  if old.snapshot ? 'operations' and (old.snapshot->'operations'->>'openedAt' is distinct from p->'operations'->>'openedAt' or old.snapshot->'operations'->>'attemptNumber' is distinct from p->'operations'->>'attemptNumber' or old.snapshot->'operations'->>'asOfAt' > p->'operations'->>'asOfAt') then raise exception 'Provider attempt facts conflict'; end if;
  insert into public.nex_provider_snapshots values(aid,rev,p,(p_envelope->>'occurredAt')::timestamptz,now()) on conflict(nex_attempt_id) do update set revision=excluded.revision,snapshot=excluded.snapshot,occurred_at=excluded.occurred_at,received_at=excluded.received_at;
  outcome:='applied';
 end if;
 insert into public.nex_provider_receipts values(eid,p_envelope,outcome,now());
 return outcome;
exception when invalid_text_representation or datetime_field_overflow then raise exception 'Invalid provider envelope';
end $$;
revoke all on function public.kp_receive_nex_provider(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.kp_receive_nex_provider(jsonb) to service_role;
