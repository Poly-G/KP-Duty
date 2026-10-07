-- Require admin authority even when replaying an already approved start.
create or replace function public.kp_save_client_delivery(p_id uuid,p_revision integer,p_patch jsonb,p_start boolean default false) returns void language plpgsql security invoker set search_path='' as $$
declare e public.client_engagements;
begin
 if not private.is_active_member() then raise exception 'Active team membership required'; end if;
 if p_start and not private.is_admin() then raise exception 'Admin start approval required'; end if;
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
