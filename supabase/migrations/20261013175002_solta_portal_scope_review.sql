-- Staff explicitly publishes an immutable scope; portal decisions never become staff accounts.
create table public.solta_portal_scope_publications (
 scope_id uuid primary key references public.project_scope_versions(id),
 project_id uuid not null references public.client_engagements(id),
 published_by uuid not null references public.profiles(id), published_at timestamptz not null default now()
);
create index solta_scope_publication_project_idx on public.solta_portal_scope_publications(project_id);
create index solta_scope_publisher_idx on public.solta_portal_scope_publications(published_by);
create table public.solta_portal_scope_decisions (
 id uuid primary key, scope_id uuid not null references public.solta_portal_scope_publications(scope_id),
 project_id uuid not null references public.client_engagements(id),
 actor_id text not null check(length(actor_id) between 1 and 100),
 actor_name text not null check(length(btrim(actor_name)) between 1 and 100),
 actor_role text not null check(actor_role in ('member','approver')),
 outcome text not null check(outcome in ('approved','changes_requested')),
 note text not null check(length(note)<=5000 and (outcome<>'changes_requested' or length(btrim(note))>0)),
 created_at timestamptz not null default now(), check(outcome<>'approved' or actor_role='approver')
);
create unique index solta_scope_one_approval_idx on public.solta_portal_scope_decisions(scope_id) where outcome='approved';
create index solta_scope_decision_project_idx on public.solta_portal_scope_decisions(project_id);
create index solta_scope_decision_scope_idx on public.solta_portal_scope_decisions(scope_id,created_at);
do $$declare t text;begin
 foreach t in array array['solta_portal_scope_publications','solta_portal_scope_decisions'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy staff_read on public.%I for select to authenticated using ((select private.is_active_member()))',t);
 end loop;
end $$;

create or replace function private.current_scope_approved(p_project uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.project_scope_versions s where s.project_id=p_project and s.version=(select max(v.version) from public.project_scope_versions v where v.project_id=p_project)
 and (exists(select 1 from public.project_scope_approvals a where a.scope_id=s.id) or exists(select 1 from public.solta_portal_scope_decisions d where d.scope_id=s.id and d.outcome='approved')))
$$;

create function private.publish_solta_scope(p_scope uuid) returns void language plpgsql security definer set search_path='' as $$
declare s public.project_scope_versions;
begin
 if not private.is_admin() then raise exception 'Active admin required';end if;
 select * into s from public.project_scope_versions where id=p_scope;
 if not found then raise exception 'Scope unavailable';end if;
 perform 1 from public.client_engagements where id=s.project_id for update;
 if s.version<>(select max(version) from public.project_scope_versions where project_id=s.project_id) then raise exception 'Share the current scope version';end if;
 if not exists(select 1 from public.solta_portal_project_links l join public.projects p on p.id=l.project_id join public.organizations o on o.id=p.organization_id join public.businesses b on b.id=p.business_id where p.id=s.project_id and l.enabled and l.organization_id=p.organization_id and p.archived_at is null and o.archived_at is null and b.slug='solta' and b.is_active) then raise exception 'Active connected Solta project required';end if;
 if exists(select 1 from public.solta_payment_requests where project_id=s.project_id and scope_id is not null and scope_id<>s.id and status in ('prepared','published')) then raise exception 'Cancel unpaid requests tied to an earlier scope before sharing a revision';end if;
 insert into public.solta_portal_scope_publications(scope_id,project_id,published_by) values(s.id,s.project_id,auth.uid()) on conflict(scope_id) do nothing;
end $$;
revoke all on function private.publish_solta_scope(uuid) from public,anon,authenticated,service_role;
grant execute on function private.publish_solta_scope(uuid) to authenticated;
create function public.kp_publish_solta_scope(p_scope uuid) returns void language sql security invoker set search_path='' as $$select private.publish_solta_scope(p_scope)$$;
revoke all on function public.kp_publish_solta_scope(uuid) from public,anon,authenticated,service_role;
grant execute on function public.kp_publish_solta_scope(uuid) to authenticated;

-- Preserve the existing message, file and website-review operation implementation.
create function private.solta_scope_portal_operation(p_request jsonb,p_nonce uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p uuid:=(p_request->>'projectId')::uuid; actor text:=p_request->>'actorId'; payload jsonb:=p_request->'payload';
 projection jsonb; scope_json jsonb; s public.project_scope_versions; decision public.solta_portal_scope_decisions; request_id uuid;
begin
 if p_request->>'operation'<>'scope.decide' then
  projection:=private.solta_portal_operation(p_request,p_nonce);
  if projection is null or p_request->>'operation'<>'project.read' then return projection;end if;
  select jsonb_build_object(
   'id',v.id,'version',v.version,'deliverables',v.deliverables,'exclusions',v.exclusions,
   'commercialTerms',v.commercial_terms,'timing',v.timing,
   'publishedAt',to_char(u.published_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
   'isCurrent',v.version=(select max(version) from public.project_scope_versions where project_id=p),
   'status',case when exists(select 1 from public.project_scope_approvals a where a.scope_id=v.id) or exists(select 1 from public.solta_portal_scope_decisions a where a.scope_id=v.id and a.outcome='approved') then 'approved' when feedback.outcome='changes_requested' then 'changes_requested' else 'pending' end,
   'feedback',case when feedback.id is null then null else jsonb_build_object('outcome',feedback.outcome,'note',feedback.note,'actorName',feedback.actor_name,'createdAt',to_char(feedback.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) end
  ) into scope_json from public.solta_portal_scope_publications u join public.project_scope_versions v on v.id=u.scope_id
  left join lateral(select * from public.solta_portal_scope_decisions d where d.scope_id=v.id order by d.created_at desc,d.id desc limit 1) feedback on true
  where u.project_id=p and v.project_id=p order by v.version desc limit 1;
  return jsonb_set(projection,'{scope}',coalesce(scope_json,'null'::jsonb));
 end if;
 -- This boundary checks the service identity, exact enabled mapping and signed-request nonce.
 projection:=private.read_solta_portal(p,(p_request->>'organizationId')::uuid,(p_request->>'portalProjectId')::uuid,actor,p_nonce);
 if projection is null then return null;end if;
 perform 1 from public.client_engagements where id=p for update;
 if coalesce(p_request->>'actorRole','') not in ('member','approver') or length(btrim(coalesce(p_request->>'actorName',''))) not between 1 and 100 then raise exception 'Invalid actor';end if;
 if coalesce(payload->>'outcome','') not in ('approved','changes_requested') or length(coalesce(payload->>'note',''))>5000 or payload->>'note' is null then raise exception 'Invalid decision';end if;
 if payload->>'outcome'='approved' and (p_request->>'actorRole'<>'approver' or payload->'confirmed' is distinct from 'true'::jsonb) then raise exception 'Company approver must confirm this scope';end if;
 if payload->>'outcome'='changes_requested' and length(btrim(payload->>'note'))=0 then raise exception 'Explain the requested changes';end if;
 request_id:=(payload->>'requestId')::uuid;
 select * into decision from public.solta_portal_scope_decisions where id=request_id;
 if found then
  if decision.project_id<>p or decision.actor_id<>actor or decision.actor_role<>p_request->>'actorRole' or decision.scope_id is distinct from (payload->>'scopeId')::uuid or decision.outcome<>payload->>'outcome' or decision.note<>payload->>'note' or (payload->>'version')::integer is distinct from (select version from public.project_scope_versions where id=decision.scope_id) then raise exception 'Scope decision retry mismatch';end if;
  return jsonb_build_object('id',decision.id);
 end if;
 select v.* into s from public.project_scope_versions v join public.solta_portal_scope_publications u on u.scope_id=v.id and u.project_id=v.project_id where v.id=(payload->>'scopeId')::uuid and v.project_id=p;
 if not found or s.version is distinct from (payload->>'version')::integer or s.version<>(select max(version) from public.project_scope_versions where project_id=p) then raise exception 'Scope changed or has not been shared. Reload before reviewing';end if;
 if exists(select 1 from public.project_scope_approvals where scope_id=s.id) or exists(select 1 from public.solta_portal_scope_decisions where scope_id=s.id and outcome='approved') then raise exception 'This scope already has final approval';end if;
 insert into public.solta_portal_scope_decisions(id,scope_id,project_id,actor_id,actor_name,actor_role,outcome,note)
 values(request_id,s.id,p,actor,p_request->>'actorName',p_request->>'actorRole',payload->>'outcome',payload->>'note');
 if payload->>'outcome'='approved' then update public.client_engagements set scope_approved=true where id=p;end if;
 return jsonb_build_object('id',request_id);
end $$;
revoke all on function private.solta_scope_portal_operation(jsonb,uuid) from public,anon,authenticated,service_role;
grant execute on function private.solta_scope_portal_operation(jsonb,uuid) to service_role;
create or replace function public.kp_solta_portal_operation(p_request jsonb,p_nonce uuid) returns jsonb language sql security invoker set search_path='' as $$select private.solta_scope_portal_operation(p_request,p_nonce)$$;
revoke all on function public.kp_solta_portal_operation(jsonb,uuid) from public,anon,authenticated,service_role;
grant execute on function public.kp_solta_portal_operation(jsonb,uuid) to service_role;
