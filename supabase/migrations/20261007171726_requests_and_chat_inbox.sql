-- Requests become Poly-owned decisions; chat messages remain pending until acknowledged.
alter table public.decisions
  add column request_kind text check (request_kind in ('feature','bug')),
  add column request_impact text check (request_impact in ('normal','blocking')),
  add column request_page text,
  add column assistant_recommendation text,
  add column recommendation_reviewed_at timestamptz;

create function public.guard_request_decision() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' and new.request_kind is not null then
    if not exists (select 1 from public.profiles where id=new.owner_id and role='admin' and status='active') then
      raise exception 'Requests must be routed to an active admin';
    end if;
    if new.assistant_recommendation is not null or new.recommendation_reviewed_at is not null then
      raise exception 'Assistant review must be added separately by the admin';
    end if;
  elsif tg_op = 'UPDATE' and (old.request_kind is not null or new.request_kind is not null) then
    if not (select private.is_admin()) then
      raise exception 'Only the admin can review request decisions' using errcode='42501';
    end if;
    if new.request_kind is distinct from old.request_kind or new.created_by is distinct from old.created_by then
      raise exception 'Request identity cannot be changed';
    end if;
  end if;
  return new;
end $$;
create trigger decisions_guard_request before insert or update on public.decisions
for each row execute function public.guard_request_decision();

create function public.kp_submit_request(p_source text,p_request_key text,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_claim jsonb; v_admin uuid; v_id uuid; v_kind text:=p_payload->>'kind';
v_title text:=nullif(btrim(p_payload->>'title'),''); v_details text:=nullif(btrim(p_payload->>'details'),'');
v_impact text:=coalesce(p_payload->>'impact','normal'); v_result jsonb;
begin
  v_claim:=private.claim_action_request(p_source,p_request_key,'submit_request',p_payload);
  if (v_claim->>'replay')::boolean then return v_claim->'result'; end if;
  if v_kind not in ('feature','bug') or v_kind is null or v_impact not in ('normal','blocking')
    or v_title is null or length(v_title)>200 or v_details is null or length(v_details)>10000
    or length(coalesce(p_payload->>'page',''))>500 then raise exception 'Invalid request details'; end if;
  select id into v_admin from public.profiles where role='admin' and status='active' order by created_at,id limit 1;
  if v_admin is null then raise exception 'No active admin is available to review requests'; end if;
  insert into public.decisions(title,owner_id,mode,domain,priority,context,recommendation,request_kind,request_impact,request_page)
  values(case when v_kind='bug' then 'Bug: ' else 'Feature: ' end||v_title,v_admin,'individual','KP Duty improvements',
    case when v_impact='blocking' then 'high'::public.task_priority else 'normal'::public.task_priority end,
    v_details,case when v_kind='bug' then
      case when v_impact='blocking' then 'Initial triage: prioritize reproducing this blocker and finding a safe workaround. ' else 'Initial triage: reproduce the reported behavior before choosing a fix. ' end ||
      'Confirm expected versus actual behavior, identify the affected workflow, then verify the fix with a regression check.'
    else 'Initial triage: confirm how often this slows the workflow, define a measurable improvement, and try the smallest useful change before expanding scope.' end,
    v_kind,v_impact,nullif(btrim(p_payload->>'page'),'')) returning id into v_id;
  v_result:=jsonb_build_object('id',v_id,'ownerId',v_admin,'status','open','recommendationReviewNeeded',true);
  perform private.complete_action_request(v_claim->>'internalKey',v_result); return v_result;
end $$;

create table public.chat_messages(
 id uuid primary key default gen_random_uuid(),
 sender_id uuid not null default auth.uid() references public.profiles(id),
 recipient_id uuid not null references public.profiles(id),
 subject text not null check(length(btrim(subject)) between 1 and 200),
 body text not null check(length(btrim(body)) between 1 and 10000),
 context text check(length(context)<=10000),
 reply_to_id uuid references public.chat_messages(id),
 source text not null check(source in ('ui','site_tools')),
 created_at timestamptz not null default now(),
 acknowledged_at timestamptz,
 check(sender_id<>recipient_id)
);
create index chat_messages_pending_idx on public.chat_messages(recipient_id,created_at desc) where acknowledged_at is null;
create index chat_messages_sender_idx on public.chat_messages(sender_id,created_at desc);
create index chat_messages_reply_idx on public.chat_messages(reply_to_id);
alter table public.chat_messages enable row level security;
revoke all on public.chat_messages from anon,authenticated;
grant select,insert on public.chat_messages to authenticated;
grant update(acknowledged_at) on public.chat_messages to authenticated;
create policy "participants read messages" on public.chat_messages for select to authenticated
using((select private.is_active_member()) and auth.uid() in(sender_id,recipient_id));
create policy "members send their own messages" on public.chat_messages for insert to authenticated
with check((select private.is_active_member()) and sender_id=auth.uid() and acknowledged_at is null
and exists(select 1 from public.profiles where id=recipient_id and status='active'));
create policy "recipients acknowledge messages" on public.chat_messages for update to authenticated
using((select private.is_active_member()) and recipient_id=auth.uid())
with check((select private.is_active_member()) and recipient_id=auth.uid());
create function public.guard_chat_reply() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.reply_to_id is not null and not exists(select 1 from public.chat_messages p where p.id=new.reply_to_id
 and p.recipient_id=auth.uid() and p.sender_id=new.recipient_id) then
 raise exception 'A reply must go to the sender of a message you received' using errcode='42501'; end if;
 return new;
end $$;
create trigger chat_messages_guard_reply before insert on public.chat_messages for each row execute function public.guard_chat_reply();
create function public.kp_send_chat_message(p_source text,p_request_key text,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_claim jsonb; v_id uuid; v_result jsonb;
begin
 v_claim:=private.claim_action_request(p_source,p_request_key,'send_chat_message',p_payload);
 if (v_claim->>'replay')::boolean then return v_claim->'result'; end if;
 insert into public.chat_messages(recipient_id,subject,body,context,reply_to_id,source)
 values((p_payload->>'recipientId')::uuid,btrim(p_payload->>'subject'),btrim(p_payload->>'body'),
 nullif(btrim(p_payload->>'context'),''),nullif(p_payload->>'replyToId','')::uuid,p_source) returning id into v_id;
 v_result:=jsonb_build_object('id',v_id,'status','pending','delivery','Available on recipient next daily pull');
 perform private.complete_action_request(v_claim->>'internalKey',v_result); return v_result;
end $$;
revoke all on function public.guard_request_decision(),public.guard_chat_reply() from public,anon,authenticated;
revoke all on function public.kp_submit_request(text,text,jsonb),public.kp_send_chat_message(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.kp_submit_request(text,text,jsonb),public.kp_send_chat_message(text,text,jsonb) to authenticated;
