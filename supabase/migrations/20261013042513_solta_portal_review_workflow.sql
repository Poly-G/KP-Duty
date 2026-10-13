-- Compose existing staff-authorized publication operations in one transaction.
create function private.publish_solta_delivery(p_version uuid,p_url text) returns uuid
language plpgsql security invoker set search_path='' as $$
begin
 perform private.publish_deliverable(p_version);
 perform private.publish_solta_preview(p_version,p_url);
 return p_version;
end $$;
create function public.kp_publish_solta_delivery(p_version uuid,p_url text) returns uuid
language sql security invoker set search_path='' as $$select private.publish_solta_delivery(p_version,p_url)$$;
revoke all on function private.publish_solta_delivery(uuid,text),public.kp_publish_solta_delivery(uuid,text) from public,anon,authenticated,service_role;
grant execute on function private.publish_solta_delivery(uuid,text),public.kp_publish_solta_delivery(uuid,text) to authenticated;

-- Client portal decisions count as exact-version evidence, while all explicit
-- staff production approvals, readiness, scope, stage and dependency gates remain.
create or replace function private.record_production_gate(p_id uuid,p_project uuid,p_kind text,p_version uuid,p_context text,p_evidence text) returns uuid language plpgsql security definer set search_path='' as $$
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
 if p_kind<>'qa' and not (exists(select 1 from public.deliverable_reviews where version_id=p_version and lane='client_record' and outcome='approved') or exists(select 1 from public.solta_portal_decisions where version_id=p_version and outcome='approved')) then raise exception 'Evidenced client approval of this exact version required'; end if;
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
