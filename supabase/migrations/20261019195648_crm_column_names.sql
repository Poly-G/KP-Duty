-- Only columns created through the custom-column operation may be renamed.
create function private.kp_rename_crm_column(p_pipeline uuid,p_id uuid,p_expected text,p_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result public.pipeline_stages;
begin
  if auth.uid() is null or not private.is_active_member() then
    raise exception 'Active team membership required' using errcode='42501';
  end if;
  if p_name is null or length(btrim(p_name)) not between 1 and 80 then
    raise exception 'Column name must contain 1–80 characters';
  end if;
  perform 1 from public.pipelines where id=p_pipeline and archived_at is null for update;
  if not found then raise exception 'Pipeline not found'; end if;
  select * into result from public.pipeline_stages where id=p_id and pipeline_id=p_pipeline for update;
  if not found then raise exception 'Column not found'; end if;
  if result.slug <> 'custom-'||result.id::text or result.kind <> 'open' then
    raise exception 'Built-in column names are locked' using errcode='42501';
  end if;
  if result.name=btrim(p_name) then return to_jsonb(result); end if;
  if result.name is distinct from p_expected then raise exception 'Column changed. Refresh and try again.'; end if;
  update public.pipeline_stages set name=btrim(p_name) where id=p_id returning * into result;
  return to_jsonb(result);
end; $$;
revoke all on function private.kp_rename_crm_column(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function private.kp_rename_crm_column(uuid,uuid,text,text) to authenticated;
create function public.kp_rename_crm_column(p_pipeline uuid,p_id uuid,p_expected text,p_name text)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.kp_rename_crm_column(p_pipeline,p_id,p_expected,p_name);
$$;
revoke all on function public.kp_rename_crm_column(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.kp_rename_crm_column(uuid,uuid,text,text) to authenticated;
