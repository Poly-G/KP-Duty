-- New office requests require approval of the current immutable scope.
-- Existing payment requests and website billing remain intact.
alter table public.solta_payment_requests add column scope_id uuid references public.project_scope_versions(id);
create index solta_payment_scope_idx on public.solta_payment_requests(scope_id);
create or replace function private.prepare_solta_payment(p_id uuid,p_project uuid,p_title text,p_amount integer,p_live boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare link public.solta_portal_project_links; row public.solta_payment_requests; engagement public.client_engagements; approved_scope uuid;
begin
 if not private.is_admin() then raise exception 'Active admin required';end if;
 if p_id is null or p_amount is null or p_live is null or p_amount<50 or p_amount>99999999 or p_title is null or length(btrim(p_title)) not between 1 and 200 then raise exception 'Check payment amount and title';end if;
 select l.* into link from public.solta_portal_project_links l join public.projects p on p.id=l.project_id join public.client_engagements e on e.id=p.id join public.organizations o on o.id=p.organization_id join public.businesses b on b.id=p.business_id where p.id=p_project and p.archived_at is null and o.archived_at is null and b.slug='solta' and b.is_active and l.enabled and l.organization_id=p.organization_id for update of p;
 if not found then raise exception 'Active connected Solta client project required';end if;
 -- Scope saves use this same engagement lock, preventing payment/scope revision races.
 select * into engagement from public.client_engagements where id=p_project for update;
 select * into row from public.solta_payment_requests where id=p_id for update;
 if found then
  if row.project_id<>p_project or row.organization_id<>link.organization_id or row.portal_project_id<>link.portal_project_id or row.created_by<>auth.uid() or row.title<>btrim(p_title) or row.amount<>p_amount or row.livemode<>p_live then raise exception 'Payment request retry mismatch';end if;
  if row.scope_id is not null and (not private.current_scope_approved(p_project) or row.scope_id is distinct from (select s.id from public.project_scope_versions s where s.project_id=p_project order by s.version desc limit 1)) then raise exception 'Scope changed. Approve the current scope and prepare a new payment request.'; end if;
 else
  if engagement.service='less_office' then
   if not private.current_scope_approved(p_project) then raise exception 'Approve the current office-work scope before requesting payment.'; end if;
   select s.id into approved_scope from public.project_scope_versions s where s.project_id=p_project order by s.version desc limit 1;
  end if;
  insert into public.solta_payment_requests(id,project_id,organization_id,portal_project_id,title,amount,livemode,created_by,scope_id) values(p_id,p_project,link.organization_id,link.portal_project_id,btrim(p_title),p_amount,p_live,auth.uid(),approved_scope) returning * into row;
 end if;
 return jsonb_build_object('requestId',row.id,'projectId',row.project_id,'organizationId',row.organization_id,'portalProjectId',row.portal_project_id,'title',row.title,'amount',row.amount,'currency',row.currency,'livemode',row.livemode,'status',row.status,'scopeId',row.scope_id);
end $$;
