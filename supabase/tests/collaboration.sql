-- Transactional integration checks against existing active members. Leaves no test data.
begin;
select set_config('qa.admin', (select id::text from public.profiles where role='admin' and status='active' order by created_at,id limit 1),true);
select set_config('qa.member', (select id::text from public.profiles where role='team_member' and status='active' order by created_at,id limit 1),true);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('qa.member'),true);
do $$
declare a jsonb; b jsonb; denied boolean:=false;
begin
 a:=public.kp_submit_request('site_tools','qa-request-transaction','{"kind":"bug","title":"[QA] request routing","details":"Expected save, got error","impact":"blocking"}');
 b:=public.kp_submit_request('site_tools','qa-request-transaction','{"kind":"bug","title":"[QA] request routing","details":"Expected save, got error","impact":"blocking"}');
 if a<>b or a->>'ownerId'<>current_setting('qa.admin') then raise exception 'request routing/idempotency failed'; end if;
 perform set_config('qa.decision',a->>'id',true);
 if not exists(select 1 from public.decisions where id=(a->>'id')::uuid and recommendation is not null and priority='high') then raise exception 'triage missing'; end if;
 begin update public.decisions set assistant_recommendation='Unauthorized review' where id=(a->>'id')::uuid; exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'member reviewed admin request'; end if;
 a:=public.kp_send_chat_message('site_tools','qa-message-transaction',jsonb_build_object('recipientId',current_setting('qa.admin'),'subject','[QA] Clarification','body','What is the next step?','context','Temporary QA context'));
 b:=public.kp_send_chat_message('site_tools','qa-message-transaction',jsonb_build_object('recipientId',current_setting('qa.admin'),'subject','[QA] Clarification','body','What is the next step?','context','Temporary QA context'));
 if a<>b then raise exception 'message retry created duplicate'; end if;
 perform set_config('qa.message',a->>'id',true);
 update public.chat_messages set acknowledged_at=now() where id=(a->>'id')::uuid;
 if found then raise exception 'sender acknowledged recipient message'; end if;
 denied:=false;
 begin update public.chat_messages set body='tamper' where id=(a->>'id')::uuid; exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'message body could be edited'; end if;
 denied:=false;
 begin perform public.kp_send_chat_message('site_tools','qa-invalid-self',jsonb_build_object('recipientId',current_setting('qa.member'),'subject','Self','body','No')); exception when check_violation then denied:=true; end;
 if not denied then raise exception 'self-send allowed'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('qa.admin'),true);
do $$
declare a jsonb;
begin
 if not exists(select 1 from public.chat_messages where id=current_setting('qa.message')::uuid and acknowledged_at is null) then raise exception 'incoming pending message missing'; end if;
 update public.decisions set assistant_recommendation='[QA] Reproduce then fix',recommendation_reviewed_at=now() where id=current_setting('qa.decision')::uuid;
 a:=public.kp_send_chat_message('site_tools','qa-reply-transaction',jsonb_build_object('recipientId',current_setting('qa.member'),'subject','[QA] Clarification','body','Start with a reproduction.','replyToId',current_setting('qa.message')));
 perform set_config('qa.reply',a->>'id',true);
 update public.chat_messages set acknowledged_at=now() where id=current_setting('qa.message')::uuid;
 if not found then raise exception 'recipient acknowledgement failed'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('qa.member'),true);
do $$ begin
 if not exists(select 1 from public.chat_messages where id=current_setting('qa.reply')::uuid and acknowledged_at is null and reply_to_id=current_setting('qa.message')::uuid) then raise exception 'reply not delivered'; end if;
 if not exists(select 1 from public.decisions where id=current_setting('qa.decision')::uuid and assistant_recommendation is not null) then raise exception 'requester cannot see review'; end if;
 if has_table_privilege('anon','public.chat_messages','select') or has_function_privilege('anon','public.kp_send_chat_message(text,text,jsonb)','execute') then raise exception 'anonymous access exposed'; end if;
end $$;
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
do $$
declare denied boolean:=false;
begin
 if exists(select 1 from public.chat_messages) then raise exception 'nonmember read private messages'; end if;
 begin perform public.kp_send_chat_message('site_tools','qa-nonmember',jsonb_build_object('recipientId',current_setting('qa.admin'),'subject','Denied','body','Denied')); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'nonmember sent a message'; end if;
end $$;
rollback;
select 'PASS: request routing, triage, review permissions, retry safety, delivery, replies, acknowledgement, immutable messages, anonymous denial' as result;
