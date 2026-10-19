-- Narrow team operations: existing direct table writes remain admin-only.
-- Privileged helpers are private, authenticate the actor, and only create open
-- columns or change positions. No stage semantics or lead data may be edited.
create function private.kp_create_crm_column(p_pipeline uuid, p_id uuid, p_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result public.pipeline_stages; next_position integer;
begin
  if auth.uid() is null or not private.is_active_member() then
    raise exception 'Active team membership required' using errcode = '42501';
  end if;
  if p_id is null or p_name is null or length(btrim(p_name)) not between 1 and 80 then
    raise exception 'Column name must contain 1–80 characters';
  end if;
  perform 1 from public.pipelines where id=p_pipeline and archived_at is null for update;
  if not found then raise exception 'Pipeline not found'; end if;
  select * into result from public.pipeline_stages where id=p_id;
  if found then
    if result.pipeline_id<>p_pipeline or result.name<>btrim(p_name) then raise exception 'Column request changed'; end if;
    return to_jsonb(result);
  end if;
  select coalesce(max(position),-1)+1 into next_position from public.pipeline_stages where pipeline_id=p_pipeline;
  insert into public.pipeline_stages(id,pipeline_id,slug,name,position,kind)
    values(p_id,p_pipeline,'custom-'||p_id::text,btrim(p_name),next_position,'open') returning * into result;
  return to_jsonb(result);
end; $$;

create function private.kp_reorder_crm_columns(p_pipeline uuid, p_expected uuid[], p_order uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare current_ids uuid[]; temporary_start integer;
begin
  if auth.uid() is null or not private.is_active_member() then
    raise exception 'Active team membership required' using errcode = '42501';
  end if;
  perform 1 from public.pipelines where id=p_pipeline and archived_at is null for update;
  if not found then raise exception 'Pipeline not found'; end if;
  select coalesce(array_agg(id order by position),array[]::uuid[]),coalesce(max(position),0)+1 into current_ids,temporary_start
    from public.pipeline_stages where pipeline_id=p_pipeline;
  if p_order is null or cardinality(p_order)=0 or cardinality(p_order)>500
    or array_position(p_order,null) is not null
    or cardinality(p_order)<>(select count(distinct id) from unnest(p_order) id)
    or not (p_order @> current_ids and p_order <@ current_ids) then
    raise exception 'Order must contain each pipeline column exactly once';
  end if;
  -- A lost response can be retried without changing anything again.
  if current_ids=p_order then return; end if;
  if p_expected is distinct from current_ids then raise exception 'Columns changed. Refresh the board and try again.'; end if;
  -- Two passes avoid the existing immediate unique(pipeline_id, position) constraint.
  update public.pipeline_stages s set position=temporary_start+o.ordinality::integer
    from unnest(p_order) with ordinality o(id,ordinality) where s.id=o.id and s.pipeline_id=p_pipeline;
  update public.pipeline_stages s set position=o.ordinality::integer-1
    from unnest(p_order) with ordinality o(id,ordinality) where s.id=o.id and s.pipeline_id=p_pipeline;
end; $$;

revoke all on function private.kp_create_crm_column(uuid,uuid,text) from public,anon,authenticated;
revoke all on function private.kp_reorder_crm_columns(uuid,uuid[],uuid[]) from public,anon,authenticated;
grant execute on function private.kp_create_crm_column(uuid,uuid,text) to authenticated;
grant execute on function private.kp_reorder_crm_columns(uuid,uuid[],uuid[]) to authenticated;

create function public.kp_create_crm_column(p_pipeline uuid,p_id uuid,p_name text)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.kp_create_crm_column(p_pipeline,p_id,p_name);
$$;
create function public.kp_reorder_crm_columns(p_pipeline uuid,p_expected uuid[],p_order uuid[])
returns void language sql security invoker set search_path = '' as $$
  select private.kp_reorder_crm_columns(p_pipeline,p_expected,p_order);
$$;
revoke all on function public.kp_create_crm_column(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.kp_reorder_crm_columns(uuid,uuid[],uuid[]) from public,anon,authenticated;
grant execute on function public.kp_create_crm_column(uuid,uuid,text) to authenticated;
grant execute on function public.kp_reorder_crm_columns(uuid,uuid[],uuid[]) to authenticated;
