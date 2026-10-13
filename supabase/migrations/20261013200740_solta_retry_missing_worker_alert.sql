-- Detect missing pg_net responses as well as explicit HTTP errors.
create or replace function private.tick_solta_emails() returns void language plpgsql security definer set search_path='' as $$
declare s public.solta_email_scheduler; token uuid; request bigint;
begin
 select * into s from public.solta_email_scheduler where id='solta' for update;
 if not s.enabled then return;end if;
 update public.solta_email_scheduler set last_scan_at=now() where id='solta';
 if exists(select 1 from net._http_response r where r.id=s.request_id and (r.status_code is distinct from 200 or r.timed_out or r.error_msg is not null)) then
  update public.solta_email_scheduler set error_code='EMAIL_RETRY_UNAVAILABLE' where id='solta';
 end if;
 if exists(select 1 from private.solta_email_tick_tokens where expires_at<=now()) then
  update public.solta_email_scheduler set error_code='EMAIL_RETRY_UNAVAILABLE' where id='solta';
 end if;
 delete from private.solta_email_tick_tokens where expires_at<=now();
 if s.lease_until>now() or exists(select 1 from private.solta_email_tick_tokens) or private.next_solta_email_project() is null then return;end if;
 token:=gen_random_uuid();
 insert into private.solta_email_tick_tokens values(encode(sha256(convert_to(token::text,'UTF8')),'hex'),now()+interval '10 minutes');
 select net.http_post(url:='https://kp-duty.vercel.app/api/integrations/solta/notifications/retry',body:='{}'::jsonb,
 headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||token::text),timeout_milliseconds:=250000) into request;
 update public.solta_email_scheduler set request_id=request where id='solta';
end $$;

create or replace function private.begin_solta_email_tick(p_token uuid,p_lease uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.solta_email_scheduler; project uuid;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' or p_token is null or p_lease is null then raise exception 'Integration role required';end if;
 select * into s from public.solta_email_scheduler where id='solta' for update;
 if not s.enabled then raise exception 'Scheduler disabled';end if;
 delete from private.solta_email_tick_tokens where token_hash=encode(sha256(convert_to(p_token::text,'UTF8')),'hex') and expires_at>now();
 if not found then raise exception 'Invalid tick';end if;
 if s.lease_until>now() then return null;end if;
 project:=private.next_solta_email_project();
 if project is null then
  update public.solta_email_scheduler set last_started_at=now(),last_completed_at=now(),error_code=null where id='solta';
  return null;
 end if;
 update public.solta_email_scheduler set lease_id=p_lease,lease_until=now()+interval '5 minutes',last_started_at=now(),error_code=null where id='solta';
 return project;
end $$;
