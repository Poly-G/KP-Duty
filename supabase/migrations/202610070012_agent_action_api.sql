-- KP Duty — Agent/domain action API
-- Safe shared mutation boundary for UI and WebMCP.
-- Reuses the existing integration_action_requests ledger for transactional
-- request-key idempotency while preserving the caller's Supabase RLS context.

alter table public.activity_events
  add column if not exists decision_id uuid references public.decisions(id) on delete set null;

create index if not exists activity_events_decision_idx
  on public.activity_events (decision_id, occurred_at desc)
  where decision_id is not null;

create or replace function private.claim_action_request(
  p_source text,
  p_request_key text,
  p_action text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_internal_key text;
  v_hash text;
  v_row public.integration_action_requests%rowtype;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_actor
      and p.status = 'active'
  ) then
    raise exception 'Active KP Duty membership required' using errcode = '42501';
  end if;

  if p_source not in ('ui', 'site_tools') then
    raise exception 'Unsupported action source' using errcode = '22023';
  end if;

  if p_request_key is null or btrim(p_request_key) = '' then
    raise exception 'request key is required' using errcode = '22023';
  end if;

  if p_action is null or btrim(p_action) = '' then
    raise exception 'action is required' using errcode = '22023';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload must be a JSON object' using errcode = '22023';
  end if;

  v_internal_key := v_actor::text || ':' || p_source || ':' || p_request_key;
  v_hash := md5(p_action || ':' || p_payload::text);

  insert into public.integration_action_requests (
    request_key,
    actor_user_id,
    source,
    action,
    request_hash
  )
  values (
    v_internal_key,
    v_actor,
    p_source,
    p_action,
    v_hash
  )
  on conflict (request_key) do nothing;

  select *
    into v_row
  from public.integration_action_requests r
  where r.request_key = v_internal_key;

  if not found then
    raise exception 'Unable to claim action request';
  end if;

  if v_row.actor_user_id is distinct from v_actor
    or v_row.source is distinct from p_source
    or v_row.action is distinct from p_action
    or v_row.request_hash is distinct from v_hash
  then
    raise exception 'request key was reused with different action data'
      using errcode = '22023';
  end if;

  return jsonb_build_object(
    'internalKey', v_internal_key,
    'replay', v_row.completed_at is not null,
    'result', v_row.replay_result
  );
end;
$$;

create or replace function private.complete_action_request(
  p_internal_key text,
  p_result jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_result is null or jsonb_typeof(p_result) <> 'object' then
    raise exception 'result must be a JSON object' using errcode = '22023';
  end if;

  update public.integration_action_requests r
  set
    replay_result = p_result,
    completed_at = now(),
    updated_at = now()
  where r.request_key = p_internal_key
    and r.actor_user_id = v_actor
    and r.source in ('ui', 'site_tools');

  if not found then
    raise exception 'Unable to complete action request';
  end if;
end;
$$;

create or replace function public.kp_create_task(
  p_source text,
  p_request_key text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_claim jsonb;
  v_result jsonb;
  v_actor uuid := auth.uid();
  v_owner uuid;
  v_business uuid;
  v_stage public.task_stage;
  v_availability public.task_availability;
  v_priority public.task_priority;
  v_id uuid;
  v_title text;
begin
  v_claim := private.claim_action_request(
    p_source,
    p_request_key,
    'create_task',
    p_payload
  );

  if (v_claim ->> 'replay')::boolean then
    return v_claim -> 'result';
  end if;

  v_title := nullif(btrim(p_payload ->> 'title'), '');
  if v_title is null then
    raise exception 'Task title is required' using errcode = '22023';
  end if;

  if p_payload ? 'ownerId' then
    if p_payload ->> 'ownerId' is null or btrim(p_payload ->> 'ownerId') = '' then
      v_owner := null;
    else
      v_owner := (p_payload ->> 'ownerId')::uuid;
    end if;
  else
    v_owner := v_actor;
  end if;

  if v_owner is distinct from v_actor and not (select private.is_admin()) then
    raise exception 'Only an admin can create work for another owner or leave it unassigned'
      using errcode = '42501';
  end if;

  if nullif(btrim(p_payload ->> 'businessId'), '') is not null then
    v_business := (p_payload ->> 'businessId')::uuid;
  end if;

  v_stage := coalesce(nullif(btrim(p_payload ->> 'stage'), ''), 'todo')::public.task_stage;
  if v_stage = 'finished' then
    raise exception 'Create an active task first; finish it with the task completion action'
      using errcode = '22023';
  end if;

  v_availability := coalesce(
    nullif(btrim(p_payload ->> 'availability'), ''),
    'yes'
  )::public.task_availability;

  v_priority := coalesce(
    nullif(btrim(p_payload ->> 'priority'), ''),
    'normal'
  )::public.task_priority;

  insert into public.tasks (
    business_id,
    title,
    what_this_is,
    why_it_matters,
    instructions,
    notes,
    owner_id,
    stage,
    availability,
    priority,
    due_at,
    next_action,
    finished_when,
    waiting_on,
    reference_url,
    position
  )
  values (
    v_business,
    v_title,
    nullif(btrim(p_payload ->> 'whatThisIs'), ''),
    nullif(btrim(p_payload ->> 'whyItMatters'), ''),
    nullif(btrim(p_payload ->> 'instructions'), ''),
    nullif(btrim(p_payload ->> 'notes'), ''),
    v_owner,
    v_stage,
    v_availability,
    v_priority,
    case
      when nullif(btrim(p_payload ->> 'dueAt'), '') is null then null
      else (p_payload ->> 'dueAt')::timestamptz
    end,
    nullif(btrim(p_payload ->> 'nextAction'), ''),
    nullif(btrim(p_payload ->> 'finishedWhen'), ''),
    nullif(btrim(p_payload ->> 'waitingOn'), ''),
    nullif(btrim(p_payload ->> 'referenceUrl'), ''),
    coalesce((p_payload ->> 'position')::integer, 0)
  )
  returning id into v_id;

  select jsonb_build_object(
    'id', t.id,
    'title', t.title,
    'ownerId', t.owner_id,
    'businessId', t.business_id,
    'stage', t.stage,
    'availability', t.availability,
    'priority', t.priority,
    'dueAt', t.due_at,
    'nextAction', t.next_action
  )
  into v_result
  from public.tasks t
  where t.id = v_id;

  perform private.complete_action_request(v_claim ->> 'internalKey', v_result);
  return v_result;
end;
$$;

create or replace function public.kp_create_organization(
  p_source text,
  p_request_key text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_claim jsonb;
  v_result jsonb;
  v_id uuid;
  v_name text;
begin
  v_claim := private.claim_action_request(
    p_source,
    p_request_key,
    'create_organization',
    p_payload
  );

  if (v_claim ->> 'replay')::boolean then
    return v_claim -> 'result';
  end if;

  v_name := nullif(btrim(p_payload ->> 'name'), '');
  if v_name is null then
    raise exception 'Organization name is required' using errcode = '22023';
  end if;

  insert into public.organizations (
    name,
    website,
    domain,
    phone,
    public_email,
    city,
    state,
    country,
    description
  )
  values (
    v_name,
    nullif(btrim(p_payload ->> 'website'), ''),
    lower(nullif(btrim(p_payload ->> 'domain'), '')),
    nullif(btrim(p_payload ->> 'phone'), ''),
    lower(nullif(btrim(p_payload ->> 'publicEmail'), '')),
    nullif(btrim(p_payload ->> 'city'), ''),
    nullif(btrim(p_payload ->> 'state'), ''),
    nullif(btrim(p_payload ->> 'country'), ''),
    nullif(btrim(p_payload ->> 'description'), '')
  )
  returning id into v_id;

  select jsonb_build_object(
    'id', o.id,
    'name', o.name,
    'website', o.website,
    'domain', o.domain,
    'publicEmail', o.public_email,
    'phone', o.phone,
    'city', o.city,
    'state', o.state,
    'country', o.country
  )
  into v_result
  from public.organizations o
  where o.id = v_id;

  perform private.complete_action_request(v_claim ->> 'internalKey', v_result);
  return v_result;
end;
$$;

create or replace function public.kp_create_person(
  p_source text,
  p_request_key text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_claim jsonb;
  v_result jsonb;
  v_id uuid;
  v_first_name text;
  v_org uuid;
begin
  v_claim := private.claim_action_request(
    p_source,
    p_request_key,
    'create_person',
    p_payload
  );

  if (v_claim ->> 'replay')::boolean then
    return v_claim -> 'result';
  end if;

  v_first_name := nullif(btrim(p_payload ->> 'firstName'), '');
  if v_first_name is null then
    raise exception 'First name is required' using errcode = '22023';
  end if;

  if nullif(btrim(p_payload ->> 'organizationId'), '') is not null then
    v_org := (p_payload ->> 'organizationId')::uuid;
  end if;

  insert into public.people (
    organization_id,
    first_name,
    last_name,
    email,
    phone,
    title,
    linkedin_url,
    notes
  )
  values (
    v_org,
    v_first_name,
    nullif(btrim(p_payload ->> 'lastName'), ''),
    lower(nullif(btrim(p_payload ->> 'email'), '')),
    nullif(btrim(p_payload ->> 'phone'), ''),
    nullif(btrim(p_payload ->> 'title'), ''),
    nullif(btrim(p_payload ->> 'linkedinUrl'), ''),
    nullif(btrim(p_payload ->> 'notes'), '')
  )
  returning id into v_id;

  select jsonb_build_object(
    'id', p.id,
    'organizationId', p.organization_id,
    'firstName', p.first_name,
    'lastName', p.last_name,
    'email', p.email,
    'phone', p.phone,
    'title', p.title,
    'linkedinUrl', p.linkedin_url
  )
  into v_result
  from public.people p
  where p.id = v_id;

  perform private.complete_action_request(v_claim ->> 'internalKey', v_result);
  return v_result;
end;
$$;

create or replace function public.kp_create_opportunity(
  p_source text,
  p_request_key text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_claim jsonb;
  v_result jsonb;
  v_actor uuid := auth.uid();
  v_owner uuid;
  v_business uuid;
  v_pipeline uuid;
  v_stage uuid;
  v_org uuid;
  v_id uuid;
  v_title text;
  v_priority public.task_priority;
  v_position integer;
begin
  v_claim := private.claim_action_request(
    p_source,
    p_request_key,
    'create_opportunity',
    p_payload
  );

  if (v_claim ->> 'replay')::boolean then
    return v_claim -> 'result';
  end if;

  v_title := nullif(btrim(p_payload ->> 'name'), '');
  if v_title is null then
    raise exception 'Opportunity name is required' using errcode = '22023';
  end if;

  select b.id, p.id
    into v_business, v_pipeline
  from public.businesses b
  join public.pipelines p
    on p.business_id = b.id
   and p.is_default = true
   and p.archived_at is null
  where b.slug = nullif(btrim(p_payload ->> 'businessSlug'), '')
    and b.is_active = true;

  if v_business is null or v_pipeline is null then
    raise exception 'Active business/default pipeline not found' using errcode = '22023';
  end if;

  if nullif(btrim(p_payload ->> 'stageSlug'), '') is not null then
    select ps.id
      into v_stage
    from public.pipeline_stages ps
    where ps.pipeline_id = v_pipeline
      and ps.slug = p_payload ->> 'stageSlug';
  else
    select ps.id
      into v_stage
    from public.pipeline_stages ps
    where ps.pipeline_id = v_pipeline
      and ps.kind = 'open'
    order by ps.position
    limit 1;
  end if;

  if v_stage is null then
    raise exception 'Pipeline stage not found' using errcode = '22023';
  end if;

  if p_payload ? 'ownerId' then
    if p_payload ->> 'ownerId' is null or btrim(p_payload ->> 'ownerId') = '' then
      v_owner := null;
    else
      v_owner := (p_payload ->> 'ownerId')::uuid;
    end if;
  else
    v_owner := v_actor;
  end if;

  if v_owner is distinct from v_actor and not (select private.is_admin()) then
    raise exception 'Only an admin can assign an opportunity to another owner or leave it unassigned'
      using errcode = '42501';
  end if;

  if nullif(btrim(p_payload ->> 'organizationId'), '') is not null then
    v_org := (p_payload ->> 'organizationId')::uuid;
  end if;

  v_priority := coalesce(
    nullif(btrim(p_payload ->> 'priority'), ''),
    'normal'
  )::public.task_priority;

  select coalesce(max(o.position), 0) + 10
    into v_position
  from public.opportunities o
  where o.pipeline_id = v_pipeline
    and o.stage_id = v_stage
    and o.archived_at is null;

  insert into public.opportunities (
    business_id,
    pipeline_id,
    stage_id,
    organization_id,
    name,
    owner_id,
    source,
    source_url,
    priority,
    amount_cents,
    currency,
    next_action,
    next_action_at,
    position
  )
  values (
    v_business,
    v_pipeline,
    v_stage,
    v_org,
    v_title,
    v_owner,
    nullif(btrim(p_payload ->> 'source'), ''),
    nullif(btrim(p_payload ->> 'sourceUrl'), ''),
    v_priority,
    case
      when nullif(btrim(p_payload ->> 'amountCents'), '') is null then null
      else (p_payload ->> 'amountCents')::bigint
    end,
    coalesce(nullif(upper(btrim(p_payload ->> 'currency')), ''), 'USD'),
    nullif(btrim(p_payload ->> 'nextAction'), ''),
    case
      when nullif(btrim(p_payload ->> 'nextActionAt'), '') is null then null
      else (p_payload ->> 'nextActionAt')::timestamptz
    end,
    v_position
  )
  returning id into v_id;

  select jsonb_build_object(
    'id', o.id,
    'name', o.name,
    'businessId', o.business_id,
    'pipelineId', o.pipeline_id,
    'stageId', o.stage_id,
    'organizationId', o.organization_id,
    'ownerId', o.owner_id,
    'priority', o.priority,
    'nextAction', o.next_action,
    'nextActionAt', o.next_action_at
  )
  into v_result
  from public.opportunities o
  where o.id = v_id;

  perform private.complete_action_request(v_claim ->> 'internalKey', v_result);
  return v_result;
end;
$$;

create or replace function public.kp_create_project(
  p_source text,
  p_request_key text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_claim jsonb;
  v_result jsonb;
  v_actor uuid := auth.uid();
  v_owner uuid;
  v_business uuid;
  v_org uuid;
  v_opportunity uuid;
  v_id uuid;
  v_name text;
begin
  v_claim := private.claim_action_request(
    p_source,
    p_request_key,
    'create_project',
    p_payload
  );

  if (v_claim ->> 'replay')::boolean then
    return v_claim -> 'result';
  end if;

  v_name := nullif(btrim(p_payload ->> 'name'), '');
  if v_name is null then
    raise exception 'Project name is required' using errcode = '22023';
  end if;

  select b.id
    into v_business
  from public.businesses b
  where b.slug = nullif(btrim(p_payload ->> 'businessSlug'), '')
    and b.is_active = true;

  if v_business is null then
    raise exception 'Active business not found' using errcode = '22023';
  end if;

  if p_payload ? 'ownerId' and nullif(btrim(p_payload ->> 'ownerId'), '') is not null then
    v_owner := (p_payload ->> 'ownerId')::uuid;
  else
    v_owner := v_actor;
  end if;

  if v_owner is distinct from v_actor and not (select private.is_admin()) then
    raise exception 'Only an admin can assign a project to another owner'
      using errcode = '42501';
  end if;

  if nullif(btrim(p_payload ->> 'organizationId'), '') is not null then
    v_org := (p_payload ->> 'organizationId')::uuid;
  end if;

  if nullif(btrim(p_payload ->> 'opportunityId'), '') is not null then
    v_opportunity := (p_payload ->> 'opportunityId')::uuid;
  end if;

  insert into public.projects (
    business_id,
    organization_id,
    opportunity_id,
    name,
    owner_id,
    status,
    phase,
    next_milestone,
    next_milestone_at,
    source_system,
    external_project_url,
    sync_status
  )
  values (
    v_business,
    v_org,
    v_opportunity,
    v_name,
    v_owner,
    'planned',
    nullif(btrim(p_payload ->> 'phase'), ''),
    nullif(btrim(p_payload ->> 'nextMilestone'), ''),
    case
      when nullif(btrim(p_payload ->> 'nextMilestoneAt'), '') is null then null
      else (p_payload ->> 'nextMilestoneAt')::timestamptz
    end,
    'kp',
    nullif(btrim(p_payload ->> 'externalProjectUrl'), ''),
    'manual'
  )
  returning id into v_id;

  select jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'businessId', p.business_id,
    'organizationId', p.organization_id,
    'opportunityId', p.opportunity_id,
    'ownerId', p.owner_id,
    'status', p.status,
    'phase', p.phase,
    'health', p.health,
    'nextMilestone', p.next_milestone,
    'nextMilestoneAt', p.next_milestone_at
  )
  into v_result
  from public.projects p
  where p.id = v_id;

  perform private.complete_action_request(v_claim ->> 'internalKey', v_result);
  return v_result;
end;
$$;

create or replace function public.kp_create_decision(
  p_source text,
  p_request_key text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_claim jsonb;
  v_result jsonb;
  v_actor uuid := auth.uid();
  v_owner uuid;
  v_business uuid;
  v_id uuid;
  v_title text;
  v_mode public.decision_mode;
  v_priority public.task_priority;
begin
  v_claim := private.claim_action_request(
    p_source,
    p_request_key,
    'create_decision',
    p_payload
  );

  if (v_claim ->> 'replay')::boolean then
    return v_claim -> 'result';
  end if;

  v_title := nullif(btrim(p_payload ->> 'title'), '');
  if v_title is null then
    raise exception 'Decision title is required' using errcode = '22023';
  end if;

  if nullif(btrim(p_payload ->> 'businessSlug'), '') is not null then
    select b.id
      into v_business
    from public.businesses b
    where b.slug = p_payload ->> 'businessSlug'
      and b.is_active = true;

    if v_business is null then
      raise exception 'Active business not found' using errcode = '22023';
    end if;
  end if;

  if p_payload ? 'ownerId' and nullif(btrim(p_payload ->> 'ownerId'), '') is not null then
    v_owner := (p_payload ->> 'ownerId')::uuid;
  else
    v_owner := v_actor;
  end if;

  if v_owner is distinct from v_actor and not (select private.is_admin()) then
    raise exception 'Only an admin can assign a decision to another owner'
      using errcode = '42501';
  end if;

  v_mode := coalesce(
    nullif(btrim(p_payload ->> 'mode'), ''),
    'joint'
  )::public.decision_mode;

  v_priority := coalesce(
    nullif(btrim(p_payload ->> 'priority'), ''),
    'normal'
  )::public.task_priority;

  insert into public.decisions (
    business_id,
    title,
    domain,
    mode,
    owner_id,
    status,
    priority,
    needed_by,
    context,
    recommendation,
    revisit_trigger
  )
  values (
    v_business,
    v_title,
    nullif(btrim(p_payload ->> 'domain'), ''),
    v_mode,
    v_owner,
    'open',
    v_priority,
    case
      when nullif(btrim(p_payload ->> 'neededBy'), '') is null then null
      else (p_payload ->> 'neededBy')::date
    end,
    nullif(btrim(p_payload ->> 'context'), ''),
    nullif(btrim(p_payload ->> 'recommendation'), ''),
    nullif(btrim(p_payload ->> 'revisitTrigger'), '')
  )
  returning id into v_id;

  select jsonb_build_object(
    'id', d.id,
    'title', d.title,
    'businessId', d.business_id,
    'ownerId', d.owner_id,
    'mode', d.mode,
    'status', d.status,
    'priority', d.priority,
    'neededBy', d.needed_by,
    'domain', d.domain
  )
  into v_result
  from public.decisions d
  where d.id = v_id;

  perform private.complete_action_request(v_claim ->> 'internalKey', v_result);
  return v_result;
end;
$$;

create or replace function public.kp_add_note(
  p_source text,
  p_request_key text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_claim jsonb;
  v_result jsonb;
  v_actor uuid := auth.uid();
  v_entity_type text;
  v_entity_id uuid;
  v_note text;
  v_business uuid;
  v_org uuid;
  v_person uuid;
  v_opportunity uuid;
  v_project uuid;
  v_task uuid;
  v_decision uuid;
  v_event uuid;
begin
  v_claim := private.claim_action_request(
    p_source,
    p_request_key,
    'add_note',
    p_payload
  );

  if (v_claim ->> 'replay')::boolean then
    return v_claim -> 'result';
  end if;

  v_entity_type := nullif(btrim(p_payload ->> 'entityType'), '');
  v_note := nullif(btrim(p_payload ->> 'note'), '');

  if v_entity_type is null or v_entity_type not in (
    'task', 'opportunity', 'project', 'organization', 'person', 'decision'
  ) then
    raise exception 'Unsupported note entity type' using errcode = '22023';
  end if;

  if nullif(btrim(p_payload ->> 'entityId'), '') is null then
    raise exception 'entityId is required' using errcode = '22023';
  end if;

  if v_note is null then
    raise exception 'Note text is required' using errcode = '22023';
  end if;

  v_entity_id := (p_payload ->> 'entityId')::uuid;

  case v_entity_type
    when 'task' then
      select t.id, t.business_id
        into v_task, v_business
      from public.tasks t
      where t.id = v_entity_id
        and t.archived_at is null;

    when 'opportunity' then
      select o.id, o.business_id, o.organization_id
        into v_opportunity, v_business, v_org
      from public.opportunities o
      where o.id = v_entity_id
        and o.archived_at is null;

    when 'project' then
      select p.id, p.business_id, p.organization_id, p.opportunity_id
        into v_project, v_business, v_org, v_opportunity
      from public.projects p
      where p.id = v_entity_id
        and p.archived_at is null;

    when 'organization' then
      select o.id
        into v_org
      from public.organizations o
      where o.id = v_entity_id
        and o.archived_at is null;

    when 'person' then
      select p.id, p.organization_id
        into v_person, v_org
      from public.people p
      where p.id = v_entity_id
        and p.archived_at is null;

    when 'decision' then
      select d.id, d.business_id
        into v_decision, v_business
      from public.decisions d
      where d.id = v_entity_id;
  end case;

  if coalesce(v_task, v_opportunity, v_project, v_org, v_person, v_decision) is null then
    raise exception 'Target record not found' using errcode = '22023';
  end if;

  insert into public.activity_events (
    event_type,
    business_id,
    organization_id,
    person_id,
    opportunity_id,
    project_id,
    task_id,
    decision_id,
    actor_user_id,
    source,
    summary,
    metadata
  )
  values (
    'note.added',
    v_business,
    v_org,
    v_person,
    v_opportunity,
    v_project,
    v_task,
    v_decision,
    v_actor,
    p_source,
    'Note added: ' || left(regexp_replace(v_note, E'[\n\r]+', ' ', 'g'), 140),
    jsonb_build_object(
      'note', v_note,
      'entityType', v_entity_type
    )
  )
  returning id into v_event;

  select jsonb_build_object(
    'id', a.id,
    'entityType', v_entity_type,
    'entityId', v_entity_id,
    'note', v_note,
    'occurredAt', a.occurred_at
  )
  into v_result
  from public.activity_events a
  where a.id = v_event;

  perform private.complete_action_request(v_claim ->> 'internalKey', v_result);
  return v_result;
end;
$$;

-- Keep private helpers unavailable as a direct API surface. They remain callable
-- by authenticated invoker functions from inside Postgres.
revoke all on function private.claim_action_request(text, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function private.complete_action_request(text, jsonb)
  from public, anon, authenticated;
grant execute on function private.claim_action_request(text, text, text, jsonb)
  to authenticated;
grant execute on function private.complete_action_request(text, jsonb)
  to authenticated;

-- Domain RPCs are the only new authenticated function surface.
revoke all on function public.kp_create_task(text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.kp_create_organization(text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.kp_create_person(text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.kp_create_opportunity(text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.kp_create_project(text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.kp_create_decision(text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.kp_add_note(text, text, jsonb)
  from public, anon, authenticated;

grant execute on function public.kp_create_task(text, text, jsonb) to authenticated;
grant execute on function public.kp_create_organization(text, text, jsonb) to authenticated;
grant execute on function public.kp_create_person(text, text, jsonb) to authenticated;
grant execute on function public.kp_create_opportunity(text, text, jsonb) to authenticated;
grant execute on function public.kp_create_project(text, text, jsonb) to authenticated;
grant execute on function public.kp_create_decision(text, text, jsonb) to authenticated;
grant execute on function public.kp_add_note(text, text, jsonb) to authenticated;
