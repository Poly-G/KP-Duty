-- V1 provider operations only. No customer, marketplace, publication or send authority.
create table public.nex_provider_tasks (
 nex_task_id uuid primary key,
 nex_attempt_id uuid not null references public.nex_provider_attempts(nex_attempt_id),
 nex_contact_id uuid references public.nex_provider_contacts(nex_contact_id),
 kp_task_id uuid not null unique references public.tasks(id) on delete restrict,
 revision bigint not null check(revision between 1 and 9007199254740991),
 snapshot jsonb not null,
 received_at timestamptz not null default now()
);
create index nex_provider_tasks_attempt_idx on public.nex_provider_tasks(nex_attempt_id);
create index nex_provider_tasks_contact_idx on public.nex_provider_tasks(nex_contact_id);
create table public.nex_provider_requests (
 request_id uuid primary key default gen_random_uuid(),
 nex_attempt_id uuid not null references public.nex_provider_attempts(nex_attempt_id),
 nex_contact_id uuid references public.nex_provider_contacts(nex_contact_id),
 nex_task_id uuid references public.nex_provider_tasks(nex_task_id),
 kind text not null check(kind in ('contact_dnc','contact_wrong_person','task_completed')),
 base_revision bigint not null,
 requested_by uuid not null references public.profiles(id),
 status text not null default 'pending' check(status in ('pending','accepted','rejected')),
 outcome_code text check(outcome_code in ('applied','already_applied','stale','not_allowed','inactive_record')),
 created_at timestamptz not null default now(),
 resolved_at timestamptz,
 check((kind='task_completed' and nex_task_id is not null and nex_contact_id is null) or (kind<>'task_completed' and nex_contact_id is not null and nex_task_id is null)),
 check((status='pending' and outcome_code is null and resolved_at is null) or (status<>'pending' and outcome_code is not null and resolved_at is not null)),
 check(status='pending' or (status='accepted' and outcome_code in ('applied','already_applied')) or (status='rejected' and outcome_code in ('stale','not_allowed','inactive_record')))
);
create index nex_provider_requests_attempt_idx on public.nex_provider_requests(nex_attempt_id);
create index nex_provider_requests_contact_idx on public.nex_provider_requests(nex_contact_id);
create index nex_provider_requests_task_idx on public.nex_provider_requests(nex_task_id);
create index nex_provider_requests_actor_idx on public.nex_provider_requests(requested_by);
create index nex_provider_requests_pending_idx on public.nex_provider_requests(request_id) where status='pending';
create unique index nex_provider_requests_dedupe_idx on public.nex_provider_requests(nex_attempt_id,kind,coalesce(nex_contact_id,nex_task_id),base_revision);
create table public.nex_provider_reconciliation_runs (
 id uuid primary key default gen_random_uuid(),
 checked_at timestamptz not null default now(),
 checked_attempts integer not null,
 repaired integer not null,
 issues jsonb not null,
 pending_requests integer not null,
 overdue_requests integer not null
);
alter table public.nex_provider_tasks enable row level security;
alter table public.nex_provider_requests enable row level security;
alter table public.nex_provider_reconciliation_runs enable row level security;
revoke all on public.nex_provider_tasks,public.nex_provider_requests,public.nex_provider_reconciliation_runs from public,anon,authenticated,service_role;
grant select on public.nex_provider_tasks,public.nex_provider_requests,public.nex_provider_reconciliation_runs to authenticated;
create policy "active staff read Nex tasks" on public.nex_provider_tasks for select to authenticated using((select private.is_active_member()));
create policy "active staff read Nex requests" on public.nex_provider_requests for select to authenticated using((select private.is_active_member()));
create policy "active staff read Nex reconciliation" on public.nex_provider_reconciliation_runs for select to authenticated using((select private.is_active_member()));

create function private.nex_task_title(p_kind text) returns text language sql immutable set search_path='' as $$
 select case p_kind when 'follow_up' then 'Nex provider follow-up' when 'verify_representation' then 'Nex provider representation review' when 'complete_profile' then 'Nex provider profile follow-up' when 'review_stall' then 'Nex stalled onboarding review' end
$$;
revoke all on function private.nex_task_title(text) from public,anon,authenticated,service_role;

create function private.queue_nex_request(p_attempt uuid,p_contact uuid,p_task uuid,p_kind text,p_revision bigint)
returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid;
begin
 if not private.is_active_member() then raise exception 'Active member required'; end if;
 insert into public.nex_provider_requests(nex_attempt_id,nex_contact_id,nex_task_id,kind,base_revision,requested_by)
 values(p_attempt,p_contact,p_task,p_kind,p_revision,auth.uid()) on conflict do nothing returning request_id into rid;
 if rid is null then select request_id into rid from public.nex_provider_requests where nex_attempt_id=p_attempt and kind=p_kind and coalesce(nex_contact_id,nex_task_id)=coalesce(p_contact,p_task) and base_revision=p_revision; end if;
 return rid;
end $$;
revoke all on function private.queue_nex_request(uuid,uuid,uuid,text,bigint) from public,anon,authenticated,service_role;

-- Source-controlled identity, title, deadline and terminal state. Local finish is
-- a durable completion request; the Work item waits for accepted Nex state.
create function private.guard_nex_task() returns trigger language plpgsql security definer set search_path='' as $$
declare m public.nex_provider_tasks; b uuid; pending boolean;
begin
 select * into m from public.nex_provider_tasks where kp_task_id=old.id;
 if not found then if tg_op='DELETE' then return old;end if;return new; end if;
 if tg_op='DELETE' then raise exception 'Linked Nex tasks cannot be deleted'; end if;
 select o.business_id into b from public.nex_provider_attempts a join public.opportunities o on o.id=a.kp_opportunity_id where a.nex_attempt_id=m.nex_attempt_id;
 if new.business_id is distinct from b or new.title is distinct from private.nex_task_title(m.snapshot->>'kind') or new.due_at is distinct from (m.snapshot->>'dueAt')::timestamptz or new.reference_url is distinct from ('/businesses/nex/integration#task-'||m.nex_task_id) or new.finished_when is distinct from 'Completion confirmed by Nex' then raise exception 'Linked task fields are controlled by Nex'; end if;
 if auth.uid() is not null and (not private.is_active_member() or (not private.is_admin() and old.owner_id is distinct from auth.uid())) then raise exception 'Task owner or active admin required'; end if;
 if auth.uid() is not null and new.owner_id is distinct from old.owner_id and not private.is_admin() then raise exception 'Active admin required'; end if;
 if new.owner_id is distinct from old.owner_id and new.owner_id is not null and not exists(select 1 from public.profiles where id=new.owner_id and status='active') then raise exception 'Active task owner required';end if;
 if m.snapshot->>'state'='cancelled' then
  if new.archived_at is null then raise exception 'Cancelled Nex task cannot reopen'; end if;
  new.stage:='todo';new.finished_at:=null;
 elsif m.snapshot->>'state'='completed' then
  if new.stage<>'finished' or new.archived_at is not null then raise exception 'Completed Nex task cannot reopen'; end if;
  new.finished_at:=(m.snapshot->>'resolvedAt')::timestamptz;
 else
  if new.archived_at is not null then raise exception 'Open Nex task cannot be archived'; end if;
  if new.stage='finished' then
   if auth.uid() is null then raise exception 'Completion requires a human request'; end if;
   perform private.queue_nex_request(m.nex_attempt_id,null,m.nex_task_id,'task_completed',m.revision);
   new.stage:='working';new.finished_at:=null;new.availability:='waiting';new.waiting_on:='Nex completion review';
  end if;
  if exists(select 1 from public.nex_provider_requests where nex_task_id=m.nex_task_id and status in ('pending','accepted') and base_revision>=m.revision) then new.availability:='waiting';new.waiting_on:='Nex completion review';end if;
 end if;
 return new;
end $$;
revoke all on function private.guard_nex_task() from public,anon,authenticated,service_role;
create trigger zz_nex_task_guard before update or delete on public.tasks for each row execute function private.guard_nex_task();

create function private.project_nex_task(p_task uuid) returns void language plpgsql security definer set search_path='' as $$
declare m public.nex_provider_tasks; pending boolean;
begin
 select * into m from public.nex_provider_tasks where nex_task_id=p_task;
 if not found then raise exception 'Nex task unavailable'; end if;
 select exists(select 1 from public.nex_provider_requests where nex_task_id=p_task and status in ('pending','accepted') and base_revision>=m.revision) into pending;
 update public.tasks set title=private.nex_task_title(m.snapshot->>'kind'),due_at=(m.snapshot->>'dueAt')::timestamptz,
 reference_url='/businesses/nex/integration#task-'||p_task,finished_when='Completion confirmed by Nex',
 stage=case when m.snapshot->>'state'='completed' then 'finished'::public.task_stage when m.snapshot->>'state'='cancelled' then 'todo'::public.task_stage when stage='finished' then 'todo'::public.task_stage else stage end,
 finished_at=case when m.snapshot->>'state'='completed' then (m.snapshot->>'resolvedAt')::timestamptz else null end,
 archived_at=case when m.snapshot->>'state'='cancelled' then coalesce(archived_at,(m.snapshot->>'resolvedAt')::timestamptz) else null end,
 availability=case when pending and m.snapshot->>'state'='open' then 'waiting'::public.task_availability when waiting_on='Nex completion review' then 'yes'::public.task_availability else availability end,
 waiting_on=case when pending and m.snapshot->>'state'='open' then 'Nex completion review' when waiting_on='Nex completion review' then null else waiting_on end
 where id=m.kp_task_id;
end $$;
revoke all on function private.project_nex_task(uuid) from public,anon,authenticated,service_role;

create function public.kp_receive_nex_task(p_envelope jsonb) returns text language plpgsql security definer set search_path='' as $$
declare p jsonb; k text; v jsonb; prior public.nex_provider_receipts; old public.nex_provider_tasks; aid uuid; cid uuid; tid uuid; eid uuid; rev bigint; actor uuid; biz uuid; ktid uuid; outcome text;
begin
 if jsonb_typeof(p_envelope) is distinct from 'object' or (select array_agg(key order by key) from jsonb_object_keys(p_envelope) key) is distinct from array['entityType','eventId','eventType','occurredAt','payload','schemaVersion','source','target']::text[]
 or p_envelope->'schemaVersion' is distinct from '1'::jsonb or p_envelope->>'source' is distinct from 'nexproviders' or p_envelope->>'target' is distinct from 'kp' or p_envelope->>'entityType' is distinct from 'provider_follow_up' or p_envelope->>'eventType' is distinct from 'task_snapshot' then raise exception 'Invalid task envelope'; end if;
 p:=p_envelope->'payload';
 if jsonb_typeof(p) is distinct from 'object' or (select array_agg(key order by key) from jsonb_object_keys(p) key) is distinct from array['attemptId','contactId','dueAt','kind','organizationId','resolvedAt','revision','state','taskId']::text[] then raise exception 'Invalid task snapshot'; end if;
 for k,v in select key,value from jsonb_each(p || jsonb_build_object('eventId',p_envelope->'eventId','occurredAt',p_envelope->'occurredAt')) loop
  if k='revision' then
   if jsonb_typeof(v)<>'number' or v::text !~ '^[1-9][0-9]{0,15}$' or v::numeric>9007199254740991 then raise exception 'Invalid task revision'; end if;
  elsif k in ('contactId','dueAt','resolvedAt') and v='null'::jsonb then null;
  elsif jsonb_typeof(v)<>'string' then raise exception 'Invalid task value';
  elsif k in ('taskId','attemptId','organizationId','contactId','eventId') and v#>>'{}' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then raise exception 'Invalid task identity';
  elsif k in ('dueAt','resolvedAt','occurredAt') and (v#>>'{}' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$' or to_char((v#>>'{}')::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')<>v#>>'{}') then raise exception 'Invalid task date'; end if;
 end loop;
 if p->>'kind' not in ('follow_up','verify_representation','complete_profile','review_stall') or p->>'state' not in ('open','completed','cancelled') or (p->>'state'='open')<>(p->>'resolvedAt' is null) or (p->>'resolvedAt')::timestamptz>(p_envelope->>'occurredAt')::timestamptz then raise exception 'Invalid task state'; end if;
 aid:=(p->>'attemptId')::uuid;cid:=(p->>'contactId')::uuid;tid:=(p->>'taskId')::uuid;eid:=(p_envelope->>'eventId')::uuid;rev:=(p->>'revision')::bigint;
 perform pg_advisory_xact_lock(826018);
 select * into prior from public.nex_provider_receipts where event_id=eid;
 if found then if prior.envelope<>p_envelope then raise exception 'Nex event collision'; end if;return 'duplicate';end if;
 select a.linked_by,o.business_id into actor,biz from public.nex_provider_attempts a join public.nex_provider_organizations l using(nex_organization_id) join public.organizations org on org.id=l.kp_organization_id join public.opportunities o on o.id=a.kp_opportunity_id join public.businesses b on b.id=o.business_id
 join public.nex_provider_snapshots s on s.nex_attempt_id=a.nex_attempt_id
 where a.nex_attempt_id=aid and a.nex_organization_id=(p->>'organizationId')::uuid and o.organization_id=l.kp_organization_id and org.archived_at is null and o.archived_at is null and b.slug='nex' and b.is_active;
 if actor is null or (cid is not null and not exists(select 1 from public.nex_provider_contacts c join public.people person on person.id=c.kp_person_id join public.nex_provider_organizations l using(nex_organization_id) where c.nex_contact_id=cid and c.nex_organization_id=(p->>'organizationId')::uuid and person.organization_id=l.kp_organization_id and person.archived_at is null)) then raise exception 'Accepted provider links required'; end if;
 select * into old from public.nex_provider_tasks where nex_task_id=tid;
 if found then
  if old.nex_attempt_id<>aid or old.nex_contact_id is distinct from cid or old.snapshot->>'kind'<>p->>'kind' then raise exception 'Nex task identity conflict'; end if;
  if rev=old.revision and old.snapshot<>p then raise exception 'Nex task revision collision';end if;
  if rev<=old.revision then outcome:='stale';
  else
   if old.snapshot->>'state'<>'open' and (old.snapshot->>'state'<>p->>'state' or old.snapshot->>'resolvedAt' is distinct from p->>'resolvedAt') then raise exception 'Ended Nex task cannot reopen';end if;
   update public.nex_provider_tasks set revision=rev,snapshot=p,received_at=now() where nex_task_id=tid;
   perform private.project_nex_task(tid);outcome:='applied';
  end if;
 else
  insert into public.tasks(business_id,title,owner_id,created_by,updated_by,reference_url,due_at,finished_when)
  values(biz,private.nex_task_title(p->>'kind'),case when exists(select 1 from public.profiles where id=actor and status='active') then actor else null end,actor,actor,'/businesses/nex/integration#task-'||tid,(p->>'dueAt')::timestamptz,'Completion confirmed by Nex') returning id into ktid;
  insert into public.nex_provider_tasks values(tid,aid,cid,ktid,rev,p,now());perform private.project_nex_task(tid);outcome:='applied';
 end if;
 insert into public.nex_provider_receipts values(eid,p_envelope,outcome,now());return outcome;
exception when invalid_text_representation or datetime_field_overflow then raise exception 'Invalid task envelope';
end $$;
revoke all on function public.kp_receive_nex_task(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.kp_receive_nex_task(jsonb) to service_role;

create function private.request_nex_contact(p_attempt uuid,p_contact uuid,p_status text) returns uuid language plpgsql security definer set search_path='' as $$
declare rev bigint;
begin
 if not private.is_active_member() then raise exception 'Active member required';end if;
 if p_status is null or p_status not in ('dnc','wrong_person') then raise exception 'Only contact stop requests allowed';end if;
 perform pg_advisory_xact_lock(826018);
 select s.revision into rev from public.nex_provider_attempts a join public.nex_provider_snapshots s using(nex_attempt_id) join public.nex_provider_contacts c using(nex_organization_id) join public.people person on person.id=c.kp_person_id join public.nex_provider_organizations l using(nex_organization_id) join public.organizations org on org.id=l.kp_organization_id join public.opportunities o on o.id=a.kp_opportunity_id join public.businesses b on b.id=o.business_id
 where a.nex_attempt_id=p_attempt and c.nex_contact_id=p_contact and person.organization_id=l.kp_organization_id and person.archived_at is null and org.archived_at is null and o.archived_at is null and o.organization_id=l.kp_organization_id and b.slug='nex' and b.is_active;
 if rev is null then raise exception 'Live accepted contact link required';end if;
 return private.queue_nex_request(p_attempt,p_contact,null,'contact_'||p_status,rev);
end $$;
revoke all on function private.request_nex_contact(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function private.request_nex_contact(uuid,uuid,text) to authenticated;
create function public.kp_request_nex_contact(p_attempt uuid,p_contact uuid,p_status text) returns uuid language sql security invoker set search_path='' as $$select private.request_nex_contact(p_attempt,p_contact,p_status)$$;
revoke all on function public.kp_request_nex_contact(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.kp_request_nex_contact(uuid,uuid,text) to authenticated;

-- Request-only API: no worker can edit source truth through acknowledgements.
create function public.kp_poll_nex_requests(p_after uuid default null) returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('requestId',r.request_id,'organizationId',a.nex_organization_id,'attemptId',r.nex_attempt_id,'contactId',r.nex_contact_id,'taskId',r.nex_task_id,'kind',r.kind,'baseRevision',r.base_revision,'requestedAt',to_char(r.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) order by r.request_id),'[]'::jsonb)
 from (select * from public.nex_provider_requests where status='pending' and (p_after is null or request_id>p_after) order by request_id limit 100) r join public.nex_provider_attempts a using(nex_attempt_id)
$$;
revoke all on function public.kp_poll_nex_requests(uuid) from public,anon,authenticated,service_role;
grant execute on function public.kp_poll_nex_requests(uuid) to service_role;
create function public.kp_ack_nex_request(p_id uuid,p_status text,p_code text) returns void language plpgsql security definer set search_path='' as $$
declare r public.nex_provider_requests;
begin
 if p_status is null or p_code is null or not ((p_status='accepted' and p_code in ('applied','already_applied')) or (p_status='rejected' and p_code in ('stale','not_allowed','inactive_record'))) then raise exception 'Invalid request outcome';end if;
 perform pg_advisory_xact_lock(826018);select * into r from public.nex_provider_requests where request_id=p_id;
 if not found then raise exception 'Nex request missing';end if;
 if r.status<>'pending' then if r.status<>p_status or r.outcome_code<>p_code then raise exception 'Nex outcome collision';end if;return;end if;
 update public.nex_provider_requests set status=p_status,outcome_code=p_code,resolved_at=now() where request_id=p_id;
 if r.nex_task_id is not null then perform private.project_nex_task(r.nex_task_id);end if;
end $$;
revoke all on function public.kp_ack_nex_request(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.kp_ack_nex_request(uuid,text,text) to service_role;

-- Full-source comparison is performed by Nex. KP exports safe identities,
-- accepted snapshots, current association/stage state, task and request status.
create function public.kp_export_nex_reconciliation(p_after uuid default null) returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('attemptId',a.nex_attempt_id,'organizationId',a.nex_organization_id,'revision',s.revision,'snapshot',s.snapshot,'receivedAt',s.received_at,'kpArchived',o.archived_at is not null or org.archived_at is not null,'associationMatches',o.organization_id=l.kp_organization_id and b.slug='nex' and b.is_active,'kpPhase',ps.slug,
 'requests',coalesce((select jsonb_agg(jsonb_build_object('requestId',r.request_id,'kind',r.kind,'contactId',r.nex_contact_id,'taskId',r.nex_task_id,'baseRevision',r.base_revision,'status',r.status,'code',r.outcome_code) order by r.request_id) from public.nex_provider_requests r where r.nex_attempt_id=a.nex_attempt_id),'[]'::jsonb),
 'contacts',coalesce((select jsonb_agg(jsonb_build_object('contactId',c.nex_contact_id,'associationMatches',person.organization_id=l.kp_organization_id,'archived',person.archived_at is not null) order by c.nex_contact_id) from public.nex_provider_contacts c join public.people person on person.id=c.kp_person_id where c.nex_organization_id=a.nex_organization_id),'[]'::jsonb),
 'tasks',coalesce((select jsonb_agg(jsonb_build_object('taskId',t.nex_task_id,'revision',t.revision,'snapshot',t.snapshot,'kpStage',kt.stage,'kpArchived',kt.archived_at is not null) order by t.nex_task_id) from public.nex_provider_tasks t join public.tasks kt on kt.id=t.kp_task_id where t.nex_attempt_id=a.nex_attempt_id),'[]'::jsonb)) order by a.nex_attempt_id),'[]'::jsonb)
 from (select * from public.nex_provider_attempts where p_after is null or nex_attempt_id>p_after order by nex_attempt_id limit 100) a
 join public.nex_provider_organizations l using(nex_organization_id) join public.organizations org on org.id=l.kp_organization_id join public.opportunities o on o.id=a.kp_opportunity_id join public.businesses b on b.id=o.business_id left join public.pipeline_stages ps on ps.id=o.stage_id left join public.nex_provider_snapshots s using(nex_attempt_id)
$$;
revoke all on function public.kp_export_nex_reconciliation(uuid) from public,anon,authenticated,service_role;
grant execute on function public.kp_export_nex_reconciliation(uuid) to service_role;

create function private.run_nex_reconciliation() returns uuid language plpgsql security definer set search_path='' as $$
declare a record; t record; issues jsonb:='[]'::jsonb; fixes integer:=0; checked integer:=0; rid uuid; desired uuid; pipe uuid;
begin
 perform pg_advisory_xact_lock(826018);
 for a in select na.*,o.organization_id,o.business_id,o.archived_at,org.archived_at org_archived,l.kp_organization_id,s.snapshot,s.revision,s.occurred_at,o.pipeline_id,o.stage_id,o.won_at,o.lost_at,b.slug,b.is_active from public.nex_provider_attempts na join public.nex_provider_organizations l using(nex_organization_id) join public.organizations org on org.id=l.kp_organization_id join public.opportunities o on o.id=na.kp_opportunity_id join public.businesses b on b.id=o.business_id left join public.nex_provider_snapshots s using(nex_attempt_id) loop
  checked:=checked+1;
  if a.organization_id is distinct from a.kp_organization_id or a.slug<>'nex' or not a.is_active or a.archived_at is not null or a.org_archived is not null then issues:=issues||jsonb_build_array(jsonb_build_object('attemptId',a.nex_attempt_id,'code','inactive_or_moved_link'));continue;end if;
  if a.snapshot is null then issues:=issues||jsonb_build_array(jsonb_build_object('attemptId',a.nex_attempt_id,'code','awaiting_source'));continue;end if;
  select p.id,ps.id into pipe,desired from public.pipelines p join public.pipeline_stages ps on ps.pipeline_id=p.id where p.business_id=a.business_id and p.slug='provider-onboarding' and p.archived_at is null and ps.slug=a.snapshot->>'onboardingPhase';
  if desired is null then issues:=issues||jsonb_build_array(jsonb_build_object('attemptId',a.nex_attempt_id,'code','pipeline_unavailable'));continue;end if;
  if a.pipeline_id is distinct from pipe or a.stage_id is distinct from desired or (a.snapshot->>'onboardingPhase'='onboarded' and a.won_at is distinct from (a.snapshot->>'onboardedAt')::timestamptz) then
   update public.nex_provider_snapshots set snapshot=snapshot where nex_attempt_id=a.nex_attempt_id;fixes:=fixes+1;
  end if;
  if exists(select 1 from public.nex_provider_contacts c join public.people person on person.id=c.kp_person_id where c.nex_organization_id=a.nex_organization_id and (person.organization_id is distinct from a.kp_organization_id or person.archived_at is not null)) then issues:=issues||jsonb_build_array(jsonb_build_object('attemptId',a.nex_attempt_id,'code','contact_link_review'));end if;
 end loop;
 for t in select m.*,kt.title,kt.due_at,kt.reference_url,kt.stage,kt.archived_at,kt.business_id,kt.waiting_on,kt.finished_when,kt.finished_at from public.nex_provider_tasks m join public.tasks kt on kt.id=m.kp_task_id loop
  if not exists(select 1 from public.nex_provider_attempts na join public.opportunities o on o.id=na.kp_opportunity_id join public.nex_provider_organizations l using(nex_organization_id) join public.organizations org on org.id=l.kp_organization_id join public.businesses b on b.id=o.business_id where na.nex_attempt_id=t.nex_attempt_id and o.organization_id=l.kp_organization_id and o.business_id=t.business_id and o.archived_at is null and org.archived_at is null and b.slug='nex' and b.is_active) then issues:=issues||jsonb_build_array(jsonb_build_object('taskId',t.nex_task_id,'code','task_link_review'));continue;end if;
  if t.finished_when is distinct from 'Completion confirmed by Nex' or (t.snapshot->>'state'='completed' and t.finished_at is distinct from (t.snapshot->>'resolvedAt')::timestamptz) or t.title is distinct from private.nex_task_title(t.snapshot->>'kind') or t.due_at is distinct from (t.snapshot->>'dueAt')::timestamptz or t.reference_url is distinct from ('/businesses/nex/integration#task-'||t.nex_task_id) or (t.snapshot->>'state'='completed' and t.stage<>'finished') or (t.snapshot->>'state'='cancelled' and t.archived_at is null) or (t.snapshot->>'state'='open' and (t.stage='finished' or t.archived_at is not null)) then perform private.project_nex_task(t.nex_task_id);fixes:=fixes+1;end if;
 end loop;
 insert into public.nex_provider_reconciliation_runs(checked_attempts,repaired,issues,pending_requests,overdue_requests)
 select checked,fixes,issues,count(*) filter(where status='pending'),count(*) filter(where status='pending' and created_at<now()-interval '1 day') from public.nex_provider_requests returning id into rid;
 return rid;
end $$;
revoke all on function private.run_nex_reconciliation() from public,anon,authenticated,service_role;
create function private.reconcile_nex() returns uuid language plpgsql security definer set search_path='' as $$
begin if not private.is_admin() then raise exception 'Active admin required';end if;return private.run_nex_reconciliation();end $$;
revoke all on function private.reconcile_nex() from public,anon,authenticated,service_role;
grant execute on function private.reconcile_nex() to authenticated;
create function public.kp_reconcile_nex() returns uuid language sql security invoker set search_path='' as $$select private.reconcile_nex()$$;
revoke all on function public.kp_reconcile_nex() from public,anon,authenticated,service_role;
grant execute on function public.kp_reconcile_nex() to authenticated;
-- Hosted Supabase supports pg_cron; isolated test engines can omit it.
do $schedule$
begin
 if exists(select 1 from pg_available_extensions where name='pg_cron') then
  execute 'create extension if not exists pg_cron';
  execute $job$select cron.schedule('kp-nex-provider-reconciliation','30 3 * * *','select private.run_nex_reconciliation();')$job$;
 end if;
end $schedule$;
-- No pruning: event identity/replay evidence is retained until the agreed replay
-- horizon and rights/deletion contract are accepted with Nex.
