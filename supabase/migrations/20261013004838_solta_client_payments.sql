create table public.solta_payment_requests(
 id uuid primary key,project_id uuid not null references public.client_engagements(id),organization_id uuid not null references public.organizations(id),portal_project_id uuid not null,
 title text not null check(length(title) between 1 and 200),amount integer not null check(amount between 50 and 99999999),currency text not null default 'usd' check(currency='usd'),livemode boolean not null,
 status text not null default 'prepared' check(status in ('prepared','published','cancelled','paid')),created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),
 portal_payment_id uuid unique,stripe_session_id text unique,stripe_payment_intent_id text unique,paid_at timestamptz,
 check((status='paid')=(portal_payment_id is not null and stripe_session_id is not null and stripe_payment_intent_id is not null and paid_at is not null))
);
create index solta_payment_project_idx on public.solta_payment_requests(project_id,created_at);
create index solta_payment_actor_idx on public.solta_payment_requests(created_by);
create index solta_payment_org_idx on public.solta_payment_requests(organization_id);
create table public.solta_payment_receipts(nonce uuid primary key,expires_at timestamptz not null);
create index solta_payment_receipt_expiry_idx on public.solta_payment_receipts(expires_at);
alter table public.solta_payment_requests enable row level security;alter table public.solta_payment_receipts enable row level security;
revoke all on public.solta_payment_requests,public.solta_payment_receipts from public,anon,authenticated,service_role;
grant select on public.solta_payment_requests to authenticated;
create policy solta_payment_admin_read on public.solta_payment_requests for select to authenticated using((select private.is_admin()));
create function private.prepare_solta_payment(p_id uuid,p_project uuid,p_title text,p_amount integer,p_live boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare link public.solta_portal_project_links; row public.solta_payment_requests;
begin
 if not private.is_admin() then raise exception 'Active admin required';end if;
 if p_id is null or p_amount is null or p_live is null or p_amount<50 or p_amount>99999999 or p_title is null or length(btrim(p_title)) not between 1 and 200 then raise exception 'Check payment amount and title';end if;
 select l.* into link from public.solta_portal_project_links l join public.projects p on p.id=l.project_id join public.client_engagements e on e.id=p.id join public.organizations o on o.id=p.organization_id join public.businesses b on b.id=p.business_id where p.id=p_project and p.archived_at is null and o.archived_at is null and b.slug='solta' and b.is_active and l.enabled and l.organization_id=p.organization_id for update of p;
 if not found then raise exception 'Active connected Solta client project required';end if;
 select * into row from public.solta_payment_requests where id=p_id for update;
 if found then
  if row.project_id<>p_project or row.organization_id<>link.organization_id or row.portal_project_id<>link.portal_project_id or row.created_by<>auth.uid() or row.title<>btrim(p_title) or row.amount<>p_amount or row.livemode<>p_live then raise exception 'Payment request retry mismatch';end if;
 else
  insert into public.solta_payment_requests(id,project_id,organization_id,portal_project_id,title,amount,livemode,created_by) values(p_id,p_project,link.organization_id,link.portal_project_id,btrim(p_title),p_amount,p_live,auth.uid()) returning * into row;
 end if;
 return jsonb_build_object('requestId',row.id,'projectId',row.project_id,'organizationId',row.organization_id,'portalProjectId',row.portal_project_id,'title',row.title,'amount',row.amount,'currency',row.currency,'livemode',row.livemode,'status',row.status);
end $$;
create function private.mark_solta_payment(p_id uuid,p_cancel boolean) returns void language plpgsql security definer set search_path='' as $$
declare row public.solta_payment_requests;
begin
 if not private.is_admin() then raise exception 'Active admin required';end if;
 select * into row from public.solta_payment_requests where id=p_id for update;
 if not found then raise exception 'Payment request not found';end if;
 if row.status='paid' then if p_cancel then raise exception 'A received payment cannot be cancelled';end if;return;end if;
 if row.status='cancelled' and not p_cancel then raise exception 'Payment request is cancelled';end if;
 update public.solta_payment_requests set status=case when p_cancel then 'cancelled' else 'published' end where id=p_id;
end $$;
create function private.receive_solta_payment(p_event jsonb,p_nonce uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare row public.solta_payment_requests; req uuid; paid uuid; session text; intent text;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Integration role required';end if;
 if p_nonce is null or p_event->>'version' is distinct from '1' or p_event->>'business' is distinct from 'solta' or p_event->>'operation' is distinct from 'payment.received' then raise exception 'Invalid payment event';end if;
 delete from public.solta_payment_receipts where expires_at<now();insert into public.solta_payment_receipts values(p_nonce,now()+interval '10 minutes');
 req:=(p_event->>'requestId')::uuid;paid:=(p_event->>'paymentId')::uuid;session:=p_event->>'stripeSessionId';intent:=p_event->>'stripePaymentIntentId';
 select * into row from public.solta_payment_requests where id=req for update;
 if not found or row.project_id is distinct from (p_event->>'projectId')::uuid or row.organization_id is distinct from (p_event->>'organizationId')::uuid or row.portal_project_id is distinct from (p_event->>'portalProjectId')::uuid or row.amount is distinct from (p_event->>'amount')::integer or row.currency is distinct from p_event->>'currency' or row.livemode is distinct from (p_event->>'livemode')::boolean then raise exception 'Payment does not match request';end if;
 if paid is null or intent !~ '^pi_[A-Za-z0-9]+$' or session !~ (case when row.livemode then '^cs_live_[A-Za-z0-9]+$' else '^cs_test_[A-Za-z0-9]+$' end) or p_event->>'paidAt' is null then raise exception 'Invalid Stripe payment identity';end if;
 if row.status='paid' then
  if row.portal_payment_id<>paid or row.stripe_session_id<>session or row.stripe_payment_intent_id<>intent then raise exception 'Conflicting payment needs reconciliation';end if;
 else
  if row.status='cancelled' then raise exception 'Cancelled payment needs reconciliation';end if;
  update public.solta_payment_requests set status='paid',portal_payment_id=paid,stripe_session_id=session,stripe_payment_intent_id=intent,paid_at=(p_event->>'paidAt')::timestamptz where id=req;
 end if;
 -- Test events never set delivery evidence; all delivery/launch approvals remain explicit.
 return jsonb_build_object('received',true,'paymentId',paid,'requestId',req);
end $$;
create function public.kp_prepare_solta_payment(p_id uuid,p_project uuid,p_title text,p_amount integer,p_live boolean) returns jsonb language sql security invoker set search_path='' as $$select private.prepare_solta_payment(p_id,p_project,p_title,p_amount,p_live)$$;
create function public.kp_mark_solta_payment(p_id uuid,p_cancel boolean) returns void language sql security invoker set search_path='' as $$select private.mark_solta_payment(p_id,p_cancel)$$;
create function public.kp_receive_solta_payment(p_event jsonb,p_nonce uuid) returns jsonb language sql security invoker set search_path='' as $$select private.receive_solta_payment(p_event,p_nonce)$$;
revoke all on function private.prepare_solta_payment(uuid,uuid,text,integer,boolean),private.mark_solta_payment(uuid,boolean),private.receive_solta_payment(jsonb,uuid),public.kp_prepare_solta_payment(uuid,uuid,text,integer,boolean),public.kp_mark_solta_payment(uuid,boolean),public.kp_receive_solta_payment(jsonb,uuid) from public,anon,authenticated,service_role;
grant execute on function private.prepare_solta_payment(uuid,uuid,text,integer,boolean),private.mark_solta_payment(uuid,boolean),public.kp_prepare_solta_payment(uuid,uuid,text,integer,boolean),public.kp_mark_solta_payment(uuid,boolean) to authenticated;
grant usage on schema private to service_role;
grant execute on function private.receive_solta_payment(jsonb,uuid),public.kp_receive_solta_payment(jsonb,uuid) to service_role;
