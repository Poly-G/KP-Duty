-- Staff-only production authority. No publishing, client auth or email side effects.
alter table public.client_engagements add column production_required boolean not null default false;
alter table public.client_engagements alter column production_required set default true;
create table public.production_gate_approvals (
 id uuid primary key, project_id uuid not null references public.client_engagements(id),
 revision integer not null check(revision>0),
 kind text not null check(kind in ('brand_direction','copy','qa','launch','handoff')),
 scope_id uuid not null references public.project_scope_versions(id),
 answers_hash text not null,
 version_id uuid not null references public.deliverable_versions(id),
 dependencies jsonb not null check(jsonb_typeof(dependencies)='object'),
 evidence text not null check(length(btrim(evidence)) between 5 and 10000),
 recorded_by uuid not null references public.profiles(id), recorded_at timestamptz not null default now(),
 unique(project_id,kind,revision)
);
create table public.production_stage_events (
 id uuid primary key, project_id uuid not null references public.client_engagements(id),
 sequence integer not null check(sequence>0),
 stage text not null check(stage in ('visual','build','qa','launch','handoff','complete')),
 scope_id uuid not null references public.project_scope_versions(id), answers_hash text not null,
 evidence text not null check(length(btrim(evidence)) between 5 and 10000),
 recorded_by uuid not null references public.profiles(id), recorded_at timestamptz not null default now(),
 unique(project_id,sequence)
);
create index production_gate_project_idx on public.production_gate_approvals(project_id,kind,recorded_at);
create index production_gate_scope_idx on public.production_gate_approvals(scope_id);
create index production_gate_version_idx on public.production_gate_approvals(version_id);
create index production_gate_actor_idx on public.production_gate_approvals(recorded_by);
create index production_stage_scope_idx on public.production_stage_events(scope_id);
create index production_stage_actor_idx on public.production_stage_events(recorded_by);
alter table public.production_gate_approvals enable row level security;
alter table public.production_stage_events enable row level security;
revoke all on public.production_gate_approvals,public.production_stage_events from public,anon,authenticated;
grant select on public.production_gate_approvals,public.production_stage_events to authenticated;
create policy production_gate_staff_read on public.production_gate_approvals for select to authenticated using((select private.is_active_member()));
create policy production_stage_staff_read on public.production_stage_events for select to authenticated using((select private.is_active_member()));

create function private.production_dependencies(p_project uuid,p_kind text) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare service text; result jsonb:='{}'; versions jsonb;
begin
 select e.service into service from public.client_engagements e where e.id=p_project;
 if p_kind='qa' then
  if service in ('website','branding') then result:=result||jsonb_build_object('brand_direction',private.current_production_gate(p_project,'brand_direction')); end if;
  if service='website' then result:=result||jsonb_build_object('copy',private.current_production_gate(p_project,'copy')); end if;
  select coalesce(jsonb_object_agg(d.id::text,d.current_version),'{}') into versions from public.project_deliverables d where d.project_id=p_project;
  result:=result||jsonb_build_object('versions',versions);
 elsif p_kind='launch' then result:=jsonb_build_object('qa',private.current_production_gate(p_project,'qa'));
 elsif p_kind='handoff' then result:=jsonb_build_object('launch',private.current_production_gate(p_project,'launch'));
 end if;
 return result;
end $$;
create function private.current_production_gate(p_project uuid,p_kind text) returns uuid language plpgsql stable security invoker set search_path='' as $$
declare g public.production_gate_approvals; scope uuid; answers text;
begin
 if not private.is_active_member() then return null; end if;
 select id into scope from public.project_scope_versions where project_id=p_project order by version desc limit 1;
 select md5(e.answers::text) into answers from public.client_engagements e where e.id=p_project;
 select * into g from public.production_gate_approvals where project_id=p_project and kind=p_kind order by revision desc limit 1;
 if g.id is null or g.scope_id is distinct from scope or g.answers_hash is distinct from answers then return null; end if;
 if not exists(select 1 from public.deliverable_versions v join public.project_deliverables d on d.id=v.deliverable_id where v.id=g.version_id and d.project_id=p_project and v.version=d.current_version) then return null; end if;
 if g.dependencies is distinct from private.production_dependencies(p_project,p_kind) then return null; end if;
 if p_kind in ('launch','handoff') and exists(select 1 from public.production_gate_approvals prerequisite where prerequisite.id=case p_kind when 'launch' then private.current_production_gate(p_project,'qa') else private.current_production_gate(p_project,'launch') end and prerequisite.version_id<>g.version_id) then return null; end if;
 return g.id;
end $$;
create function private.production_stages(p_service text) returns text[] language sql immutable security invoker set search_path='' as $$
 select case p_service when 'website' then array['visual','build','qa','launch','handoff','complete'] when 'branding' then array['visual','qa','launch','handoff','complete'] else array['build','qa','launch','handoff','complete'] end;
$$;
create function private.production_issues(p_project uuid,p_stage text) returns text[] language plpgsql stable security invoker set search_path='' as $$
declare e public.client_engagements; issues text[]:='{}';
begin
 if not private.is_active_member() then return array['Active membership required']; end if;
 select * into e from public.client_engagements where id=p_project;
 if e.id is null then return array['Client project required']; end if;
 if e.started_at is null then issues:=issues||'Approve delivery start first'::text; end if;
 if not private.current_scope_approved(p_project) then issues:=issues||'Approve the current scope'::text; end if;
 if not(e.onboarding_reviewed and e.submitted_at is not null) then issues:=issues||'Submit and review current onboarding'::text; end if;
 if not e.access_ready then issues:=issues||'Confirm access and dependencies'::text; end if;
 if not e.capacity_ready then issues:=issues||'Confirm team capacity'::text; end if;
 if e.payment_required and coalesce(length(btrim(e.payment_evidence)),0)=0 then issues:=issues||'Verify required payment'::text; end if;
 if not exists(select 1 from public.projects p join public.profiles o on o.id=p.owner_id join public.businesses b on b.id=p.business_id where p.id=p_project and p.archived_at is null and b.is_active and o.status='active') then issues:=issues||'Active project, business and owner required'::text; end if;
 if not p_stage=any(private.production_stages(e.service)) then issues:=issues||'Stage does not apply to this service'::text; end if;
 if e.service in ('website','branding') and private.current_production_gate(p_project,'brand_direction') is null then issues:=issues||'Approve current brand direction'::text; end if;
 if e.service='website' and p_stage<>'visual' and private.current_production_gate(p_project,'copy') is null then issues:=issues||'Confirm current copy before full build'::text; end if;
 if p_stage in ('launch','handoff','complete') and private.current_production_gate(p_project,'qa') is null then issues:=issues||'Record current QA checks'::text; end if;
 if p_stage in ('handoff','complete') and private.current_production_gate(p_project,'launch') is null then issues:=issues||'Record current launch approval'::text; end if;
 if p_stage='complete' and private.current_production_gate(p_project,'handoff') is null then issues:=issues||'Record current handoff acceptance'::text; end if;
 return issues;
end $$;
create function private.production_context(p_project uuid) returns text language sql stable security invoker set search_path='' as $$
 select md5(jsonb_build_object('engagement',to_jsonb(e),'scope',(select id from public.project_scope_versions where project_id=p_project order by version desc limit 1),'versions',(select coalesce(jsonb_object_agg(d.id::text,d.current_version),'{}') from public.project_deliverables d where d.project_id=p_project),'gates',(select coalesce(jsonb_agg(g.id order by g.kind,g.revision),'[]') from public.production_gate_approvals g where g.project_id=p_project),'sequence',(select coalesce(max(sequence),0) from public.production_stage_events where project_id=p_project),'project',(select jsonb_build_object('status',p.status,'phase',p.phase,'owner',p.owner_id,'archived',p.archived_at) from public.projects p where p.id=p_project))::text) from public.client_engagements e where e.id=p_project;
$$;
create function public.kp_get_production_state(p_project uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare e public.client_engagements; stage text; sequence integer; item text; gates jsonb:='{}'; issues jsonb:='{}';
begin
 if not private.is_active_member() then raise exception 'Active membership required'; end if;
 select * into e from public.client_engagements where id=p_project;
 if e.id is null then raise exception 'Client project unavailable'; end if;
 select s.stage,s.sequence into stage,sequence from public.production_stage_events s where s.project_id=p_project order by s.sequence desc limit 1;
 foreach item in array array['brand_direction','copy','qa','launch','handoff'] loop gates:=gates||jsonb_build_object(item,private.current_production_gate(p_project,item)); end loop;
 foreach item in array private.production_stages(e.service) loop issues:=issues||jsonb_build_object(item,private.production_issues(p_project,item)); end loop;
 return jsonb_build_object('stage',stage,'sequence',coalesce(sequence,0),'stages',private.production_stages(e.service),'gates',gates,'issues',issues,'context',private.production_context(p_project),'required',e.production_required or e.started_at is null);
end $$;

create function private.record_production_gate(p_id uuid,p_project uuid,p_kind text,p_version uuid,p_context text,p_evidence text) returns uuid language plpgsql security definer set search_path='' as $$
declare e public.client_engagements; v public.deliverable_versions; d public.project_deliverables; old_gate public.production_gate_approvals; scope uuid; stage text; dependency uuid; issues text[];
begin
 if auth.uid() is null or not private.is_admin() then raise exception 'Admin production approval required'; end if;
 -- Lock the project before engagement, matching ordinary project updates.
 perform 1 from public.projects where id=p_project for update;
 select * into e from public.client_engagements where id=p_project for update;
 if e.id is null then raise exception 'Client project required'; end if;
 select * into old_gate from public.production_gate_approvals where id=p_id;
 if found then
  if old_gate.project_id=p_project and old_gate.kind=p_kind and old_gate.version_id=p_version and old_gate.evidence=p_evidence and old_gate.recorded_by=auth.uid() then return p_id; end if;
  raise exception 'Production approval retry mismatch';
 end if;
 if p_context is distinct from private.production_context(p_project) then raise exception 'Project changed. Reload before approving.'; end if;
 if p_kind not in ('brand_direction','copy','qa','launch','handoff') then raise exception 'Unknown production approval'; end if;
 if p_kind='brand_direction' and e.service not in ('website','branding') or p_kind='copy' and e.service<>'website' then raise exception 'Approval does not apply to this service'; end if;
 if e.started_at is null or not private.current_scope_approved(p_project) or not(e.onboarding_reviewed and e.submitted_at is not null and e.access_ready and e.capacity_ready) or (e.payment_required and coalesce(length(btrim(e.payment_evidence)),0)=0) or not exists(select 1 from public.projects p join public.businesses b on b.id=p.business_id join public.profiles o on o.id=p.owner_id where p.id=p_project and p.archived_at is null and b.is_active and o.status='active') then raise exception 'Resolve delivery readiness before production approval'; end if;
 select * into v from public.deliverable_versions where id=p_version;
 select * into d from public.project_deliverables where id=v.deliverable_id for update;
 if d.project_id is distinct from p_project or v.version is distinct from d.current_version or d.kind<>(case when p_kind in ('brand_direction','copy') then p_kind else 'launch' end) then raise exception 'Choose the current matching deliverable version from this project'; end if;
 if not exists(select 1 from public.deliverable_reviews where version_id=p_version and lane='internal' and outcome='approved') then raise exception 'Internal deliverable approval required'; end if;
 if p_kind<>'qa' and not exists(select 1 from public.deliverable_reviews where version_id=p_version and lane='client_record' and outcome='approved') then raise exception 'Evidenced client approval of this exact version required'; end if;
 select s.stage into stage from public.production_stage_events s where s.project_id=p_project order by sequence desc limit 1;
 if p_kind='qa' and coalesce(stage,'') not in ('qa','launch','handoff','complete') then raise exception 'Enter QA before recording QA checks'; end if;
 if p_kind='launch' and coalesce(stage,'') not in ('launch','handoff','complete') then raise exception 'Enter launch before recording launch approval'; end if;
 if p_kind='handoff' and coalesce(stage,'') not in ('handoff','complete') then raise exception 'Enter handoff before recording handoff acceptance'; end if;
 if p_kind in ('qa','launch','handoff') then
  issues:=private.production_issues(p_project,case p_kind when 'qa' then 'qa' when 'launch' then 'launch' else 'handoff' end);
  if cardinality(issues)>0 then raise exception 'Resolve production gates: %',array_to_string(issues,', '); end if;
 end if;
 if p_kind in ('launch','handoff') then
  dependency:=private.current_production_gate(p_project,case p_kind when 'launch' then 'qa' else 'launch' end);
  if not exists(select 1 from public.production_gate_approvals where id=dependency and version_id=p_version) then raise exception 'Use the same release version as the prior approval'; end if;
 end if;
 select id into scope from public.project_scope_versions where project_id=p_project order by version desc limit 1;
 insert into public.production_gate_approvals(id,project_id,revision,kind,scope_id,answers_hash,version_id,dependencies,evidence,recorded_by) values(p_id,p_project,(select coalesce(max(revision),0)+1 from public.production_gate_approvals where project_id=p_project and kind=p_kind),p_kind,scope,md5(e.answers::text),p_version,private.production_dependencies(p_project,p_kind),p_evidence,auth.uid());
 if not e.production_required then update public.client_engagements set production_required=true where id=p_project; end if;
 return p_id;
end $$;
create function public.kp_record_production_gate(p_id uuid,p_project uuid,p_kind text,p_version uuid,p_context text,p_evidence text) returns uuid language sql security invoker set search_path='' as $$select private.record_production_gate(p_id,p_project,p_kind,p_version,p_context,p_evidence)$$;

create function private.advance_production(p_id uuid,p_project uuid,p_stage text,p_context text,p_evidence text) returns uuid language plpgsql security definer set search_path='' as $$
declare e public.client_engagements; old_event public.production_stage_events; latest public.production_stage_events; stages text[]; target integer; previous integer; issues text[]; scope uuid;
begin
 if auth.uid() is null or not private.is_admin() then raise exception 'Admin production advancement required'; end if;
 perform 1 from public.projects where id=p_project for update;
 select * into e from public.client_engagements where id=p_project for update;
 if e.id is null then raise exception 'Client project required'; end if;
 select * into old_event from public.production_stage_events where id=p_id;
 if found then
  if old_event.project_id=p_project and old_event.stage=p_stage and old_event.evidence=p_evidence and old_event.recorded_by=auth.uid() then return p_id; end if;
  raise exception 'Production stage retry mismatch';
 end if;
 if p_context is distinct from private.production_context(p_project) then raise exception 'Project changed. Reload before advancing.'; end if;
 stages:=private.production_stages(e.service);target:=array_position(stages,p_stage);
 select * into latest from public.production_stage_events where project_id=p_project order by sequence desc limit 1;
 previous:=coalesce(array_position(stages,latest.stage),0);
 if target is null or target>previous+1 then raise exception 'Advance one production stage at a time; earlier stages can be revisited'; end if;
 issues:=private.production_issues(p_project,p_stage);
 if cardinality(issues)>0 then raise exception 'Resolve production gates: %',array_to_string(issues,', '); end if;
 select id into scope from public.project_scope_versions where project_id=p_project order by version desc limit 1;
 insert into public.production_stage_events(id,project_id,sequence,stage,scope_id,answers_hash,evidence,recorded_by) values(p_id,p_project,coalesce(latest.sequence,0)+1,p_stage,scope,md5(e.answers::text),p_evidence,auth.uid());
 if not e.production_required then update public.client_engagements set production_required=true where id=p_project; end if;
 update public.projects set phase=case p_stage when 'visual' then 'Visual production' when 'build' then 'Build' when 'qa' then 'QA' when 'launch' then 'Launch' when 'handoff' then 'Handoff' else 'Complete' end,status=case when p_stage='complete' then 'complete'::public.project_status else 'active'::public.project_status end where id=p_project;
 return p_id;
end $$;
create function public.kp_advance_production(p_id uuid,p_project uuid,p_stage text,p_context text,p_evidence text) returns uuid language sql security invoker set search_path='' as $$select private.advance_production(p_id,p_project,p_stage,p_context,p_evidence)$$;

create function private.guard_production_project() returns trigger language plpgsql security invoker set search_path='' as $$
declare e public.client_engagements; stage text; expected_phase text; issues text[];
begin
 select * into e from public.client_engagements where id=new.id;
 if e.id is null or (not e.production_required and e.started_at is not null) then return new; end if;
 if new.phase is distinct from old.phase or (new.status is distinct from old.status and new.status in ('active','complete')) then
  select s.stage into stage from public.production_stage_events s where s.project_id=new.id order by sequence desc limit 1;
  expected_phase:=case stage when 'visual' then 'Visual production' when 'build' then 'Build' when 'qa' then 'QA' when 'launch' then 'Launch' when 'handoff' then 'Handoff' when 'complete' then 'Complete' else 'Delivery' end;
  if new.phase is distinct from expected_phase then raise exception 'Use production approvals to change delivery stage'; end if;
  if stage='complete' and new.status='active' then raise exception 'Revisit a production stage before reopening completed delivery'; end if;
  if new.status='complete' and stage is distinct from 'complete' then raise exception 'Approve handoff before completion'; end if;
  if stage is not null and new.status in ('active','complete') then
   issues:=private.production_issues(new.id,stage);
   if cardinality(issues)>0 then raise exception 'Resolve production gates: %',array_to_string(issues,', '); end if;
  end if;
 end if;
 return new;
end $$;
create trigger guard_production_project before update on public.projects for each row execute function private.guard_production_project();
create function private.guard_production_engagement() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' and not new.production_required then raise exception 'New projects require production gates'; end if;
 if tg_op='UPDATE' then
  if old.started_at is null then new.production_required=true; end if;
  if old.production_required and not new.production_required then raise exception 'Production gates cannot be disabled'; end if;
  if new.production_required is distinct from old.production_required and not private.is_admin() and old.started_at is not null then raise exception 'Admin production controls required'; end if;
 end if;
 return new;
end $$;
create trigger zy_guard_production_engagement before insert or update on public.client_engagements for each row execute function private.guard_production_engagement();

revoke all on function private.production_dependencies(uuid,text),private.current_production_gate(uuid,text),private.production_stages(text),private.production_issues(uuid,text),private.production_context(uuid),public.kp_get_production_state(uuid),private.record_production_gate(uuid,uuid,text,uuid,text,text),public.kp_record_production_gate(uuid,uuid,text,uuid,text,text),private.advance_production(uuid,uuid,text,text,text),public.kp_advance_production(uuid,uuid,text,text,text) from public,anon;
grant execute on function private.production_dependencies(uuid,text),private.current_production_gate(uuid,text),private.production_stages(text),private.production_issues(uuid,text),private.production_context(uuid),public.kp_get_production_state(uuid),private.record_production_gate(uuid,uuid,text,uuid,text,text),public.kp_record_production_gate(uuid,uuid,text,uuid,text,text),private.advance_production(uuid,uuid,text,text,text),public.kp_advance_production(uuid,uuid,text,text,text) to authenticated;
revoke all on function private.guard_production_project(),private.guard_production_engagement() from public,anon,authenticated;

-- Require admin authority even when replaying an already approved start.
create or replace function public.kp_save_client_delivery(p_id uuid,p_revision integer,p_patch jsonb,p_start boolean default false) returns void language plpgsql security invoker set search_path='' as $$
declare e public.client_engagements;
begin
 if not private.is_active_member() then raise exception 'Active team membership required'; end if;
 if p_start and not private.is_admin() then raise exception 'Admin start approval required'; end if;
 perform 1 from public.projects where id=p_id for update;
 select * into e from public.client_engagements where id=p_id for update;
 if e.id is null or e.revision<>p_revision then raise exception 'This project changed. Reload before saving.'; end if;
 update public.client_engagements set
 answers=coalesce(p_patch->'answers',answers),
 submitted_at=case when p_patch->>'submit'='true' then now() else submitted_at end,
 onboarding_reviewed=coalesce((p_patch->>'onboarding_reviewed')::boolean,onboarding_reviewed),
 scope_approved=coalesce((p_patch->>'scope_approved')::boolean,scope_approved),
 payment_required=coalesce((p_patch->>'payment_required')::boolean,payment_required),
 payment_evidence=case when p_patch ? 'payment_evidence' then p_patch->>'payment_evidence' else payment_evidence end,
 access_ready=coalesce((p_patch->>'access_ready')::boolean,access_ready),
 capacity_ready=coalesce((p_patch->>'capacity_ready')::boolean,capacity_ready),
 started_at=case when p_start then coalesce(started_at,now()) else started_at end,
 started_by=case when p_start then coalesce(started_by,auth.uid()) else started_by end
 where id=p_id;
 if p_start then update public.projects set status='active',phase='Delivery' where id=p_id; end if;
end $$;
revoke all on function public.kp_save_client_delivery(uuid,integer,jsonb,boolean) from public,anon;
grant execute on function public.kp_save_client_delivery(uuid,integer,jsonb,boolean) to authenticated;
