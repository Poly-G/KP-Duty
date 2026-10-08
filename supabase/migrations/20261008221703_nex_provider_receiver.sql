-- Provider-only mirror. No account, publication, clinical, billing or send authority.
create table public.nex_provider_organizations (
 nex_organization_id uuid primary key,
 kp_organization_id uuid not null unique references public.organizations(id) on delete restrict,
 linked_by uuid not null references public.profiles(id),
 linked_at timestamptz not null default now()
);
create table public.nex_provider_contacts (
 nex_contact_id uuid primary key,
 nex_organization_id uuid not null references public.nex_provider_organizations(nex_organization_id),
 kp_person_id uuid not null unique references public.people(id) on delete restrict,
 linked_by uuid not null references public.profiles(id),
 linked_at timestamptz not null default now()
);
create table public.nex_provider_attempts (
 nex_attempt_id uuid primary key,
 nex_organization_id uuid not null references public.nex_provider_organizations(nex_organization_id),
 kp_opportunity_id uuid not null unique references public.opportunities(id) on delete restrict,
 linked_by uuid not null references public.profiles(id),
 linked_at timestamptz not null default now()
);
create table public.nex_provider_snapshots (
 nex_attempt_id uuid primary key references public.nex_provider_attempts(nex_attempt_id),
 revision bigint not null check (revision between 1 and 9007199254740991),
 snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
 occurred_at timestamptz not null,
 received_at timestamptz not null default now()
);
create table public.nex_provider_receipts (
 event_id uuid primary key,
 envelope jsonb not null,
 result text not null check (result in ('applied','stale')),
 received_at timestamptz not null default now()
);
create index nex_provider_contacts_organization_idx on public.nex_provider_contacts(nex_organization_id);
create index nex_provider_attempts_organization_idx on public.nex_provider_attempts(nex_organization_id);
create index nex_provider_organizations_actor_idx on public.nex_provider_organizations(linked_by);
create index nex_provider_contacts_actor_idx on public.nex_provider_contacts(linked_by);
create index nex_provider_attempts_actor_idx on public.nex_provider_attempts(linked_by);

alter table public.nex_provider_organizations enable row level security;
alter table public.nex_provider_contacts enable row level security;
alter table public.nex_provider_attempts enable row level security;
alter table public.nex_provider_snapshots enable row level security;
alter table public.nex_provider_receipts enable row level security;
revoke all on public.nex_provider_organizations,public.nex_provider_contacts,public.nex_provider_attempts,public.nex_provider_snapshots,public.nex_provider_receipts from public,anon,authenticated,service_role;
grant select on public.nex_provider_organizations,public.nex_provider_contacts,public.nex_provider_attempts,public.nex_provider_snapshots to authenticated;
create policy "active staff read provider organization links" on public.nex_provider_organizations for select to authenticated using ((select private.is_active_member()));
create policy "active staff read provider contact links" on public.nex_provider_contacts for select to authenticated using ((select private.is_active_member()));
create policy "active staff read provider attempt links" on public.nex_provider_attempts for select to authenticated using ((select private.is_active_member()));
create policy "active staff read provider mirrors" on public.nex_provider_snapshots for select to authenticated using ((select private.is_active_member()));

-- Immutable explicit links. A retry can add a newly identified contact to an existing
-- attempt, but cannot move a source identity to another CRM record.
create function public.kp_link_nex_provider(p_organization uuid,p_contact uuid,p_attempt uuid,p_kp_organization uuid,p_kp_person uuid,p_kp_opportunity uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Active admin required'; end if;
 perform pg_advisory_xact_lock(826018);
 if p_organization is null or p_attempt is null or p_kp_organization is null or p_kp_opportunity is null or (p_contact is null) <> (p_kp_person is null) then raise exception 'Invalid provider link'; end if;
 if not exists (select 1 from public.organizations where id=p_kp_organization and archived_at is null)
 or not exists (select 1 from public.opportunities o join public.businesses b on b.id=o.business_id where o.id=p_kp_opportunity and o.organization_id=p_kp_organization and o.archived_at is null and b.slug='nex' and b.is_active)
 or (p_contact is not null and not exists (select 1 from public.people where id=p_kp_person and organization_id=p_kp_organization and archived_at is null)) then raise exception 'Provider link must use live Nex CRM records'; end if;
 insert into public.nex_provider_organizations values(p_organization,p_kp_organization,auth.uid(),now()) on conflict(nex_organization_id) do nothing;
 if not exists(select 1 from public.nex_provider_organizations where nex_organization_id=p_organization and kp_organization_id=p_kp_organization) then raise exception 'Provider organization link conflict'; end if;
 if p_contact is not null then
  insert into public.nex_provider_contacts values(p_contact,p_organization,p_kp_person,auth.uid(),now()) on conflict(nex_contact_id) do nothing;
  if not exists(select 1 from public.nex_provider_contacts where nex_contact_id=p_contact and nex_organization_id=p_organization and kp_person_id=p_kp_person) then raise exception 'Provider contact link conflict'; end if;
 end if;
 insert into public.nex_provider_attempts values(p_attempt,p_organization,p_kp_opportunity,auth.uid(),now()) on conflict(nex_attempt_id) do nothing;
 if not exists(select 1 from public.nex_provider_attempts where nex_attempt_id=p_attempt and nex_organization_id=p_organization and kp_opportunity_id=p_kp_opportunity) then raise exception 'Provider attempt link conflict'; end if;
end $$;
revoke all on function public.kp_link_nex_provider(uuid,uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.kp_link_nex_provider(uuid,uuid,uuid,uuid,uuid,uuid) to authenticated;

-- Database validates the same strict allowlist as the HTTP receiver; direct worker
-- calls cannot bypass it. Raw rejected input is never persisted or echoed.
create function public.kp_receive_nex_provider(p_envelope jsonb)
returns text language plpgsql security definer set search_path='' as $$
declare
 p jsonb; k text; v jsonb; eid uuid; org uuid; cid uuid; aid uuid; rev bigint;
 old public.nex_provider_snapshots; prior public.nex_provider_receipts; outcome text;
begin
 if jsonb_typeof(p_envelope) is distinct from 'object' or
 (select array_agg(key order by key) from jsonb_object_keys(p_envelope) key) is distinct from array['entityType','eventId','eventType','occurredAt','payload','schemaVersion','source','target']::text[]
 or p_envelope->'schemaVersion' <> '1'::jsonb or p_envelope->>'source' <> 'nexproviders' or p_envelope->>'target' <> 'kp'
 or p_envelope->>'entityType' <> 'provider_onboarding_attempt' or p_envelope->>'eventType' <> 'provider_snapshot' then raise exception 'Invalid provider envelope'; end if;
 for k,v in select key,value from jsonb_each(p_envelope) where key not in ('schemaVersion','payload') loop
  if jsonb_typeof(v) <> 'string' then raise exception 'Invalid provider envelope'; end if;
 end loop;
 p:=p_envelope->'payload';
 if jsonb_typeof(p) is distinct from 'object' or
 (select array_agg(key order by key) from jsonb_object_keys(p) key) is distinct from array['admission','attemptId','contactId','contactStatus','disposition','listingReadiness','mergedIntoOrganizationId','onboardedAt','onboardingPhase','organizationId','organizationNoContact','representation','revision']::text[] then raise exception 'Invalid provider snapshot'; end if;
 for k,v in select key,value from jsonb_each(p) loop
  if k='revision' then
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
  if old.snapshot is not null and (old.snapshot->>'admission'<>p->>'admission' or
   (old.snapshot->>'onboardingPhase' in ('onboarded','not_onboarded') and old.snapshot->>'onboardingPhase'<>p->>'onboardingPhase') or
   (old.snapshot->>'onboardedAt' is not null and old.snapshot->>'onboardedAt' is distinct from p->>'onboardedAt')) then raise exception 'Ended provider attempt cannot reopen'; end if;
  if p->>'onboardingPhase' not in ('onboarded','not_onboarded') and exists(select 1 from public.nex_provider_snapshots s join public.nex_provider_attempts a using(nex_attempt_id) where a.nex_organization_id=org and a.nex_attempt_id<>aid and s.snapshot->>'onboardingPhase' not in ('onboarded','not_onboarded')) then raise exception 'Provider already has an active attempt'; end if;
  insert into public.nex_provider_snapshots values(aid,rev,p,(p_envelope->>'occurredAt')::timestamptz,now()) on conflict(nex_attempt_id) do update set revision=excluded.revision,snapshot=excluded.snapshot,occurred_at=excluded.occurred_at,received_at=excluded.received_at;
  outcome:='applied';
 end if;
 insert into public.nex_provider_receipts values(eid,p_envelope,outcome,now());
 return outcome;
exception when invalid_text_representation or datetime_field_overflow then raise exception 'Invalid provider envelope';
end $$;
revoke all on function public.kp_receive_nex_provider(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.kp_receive_nex_provider(jsonb) to service_role;
