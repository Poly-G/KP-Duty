import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {PGlite}=await import(process.env.PGLITE_TEST_PACKAGE||'@electric-sql/pglite');
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create schema auth;create schema private;
grant usage on schema public,auth,private to authenticated;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table profiles(id uuid primary key,status text);
create function private.is_active_member() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.profiles where id=auth.uid() and status='active')$$;
grant select on profiles to authenticated;
insert into profiles values ('00000000-0000-4000-8000-000000000001','active'),('00000000-0000-4000-8000-000000000002','active'),('00000000-0000-4000-8000-000000000003','active'),('00000000-0000-4000-8000-000000000004','disabled');
create function public.guard_request_decision() returns trigger language plpgsql as $$begin return new;end$$;`);
const migration=await readFile(new URL('../../supabase/migrations/20261007171726_requests_and_chat_inbox.sql',import.meta.url),'utf8');
// Exercise the shipped message table, grants, RLS and reply guard without any live messages.
await db.exec(migration.slice(migration.indexOf('create table public.chat_messages('),migration.indexOf('create function public.kp_send_chat_message(')));
async function user(n){await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000000${n}',false);`);}
async function send(recipient,reply=null,sender=null){return db.query(`insert into chat_messages(recipient_id,subject,body,source,reply_to_id,sender_id) values($1,'Test','Test body','ui',$2,coalesce($3::uuid,auth.uid())) returning id`,[`00000000-0000-4000-8000-00000000000${recipient}`,reply,sender]);}
await user(1);const original=(await send(2)).rows[0].id;
await assert.rejects(send(1),/check constraint/);
await assert.rejects(send(4),/row-level security/);
await assert.rejects(send(3,null,'00000000-0000-4000-8000-000000000002'),/row-level security/);
assert.equal((await db.query('update chat_messages set acknowledged_at=now() where id=$1 returning id',[original])).rows.length,0,'Sender cannot acknowledge recipient message');
await assert.rejects(db.query("update chat_messages set body='changed' where id=$1",[original]),/permission denied/);
await assert.rejects(db.query('delete from chat_messages where id=$1',[original]),/permission denied/);
await user(3);assert.equal((await db.query('select * from chat_messages')).rows.length,0);
await assert.rejects(send(1,original),/reply must go/i);
await user(2);assert.equal((await db.query('select * from chat_messages')).rows.length,1);
await assert.rejects(send(3,original),/reply must go/i);
const reply=(await send(1,original)).rows[0].id;
assert.equal((await db.query('select acknowledged_at from chat_messages where id=$1',[original])).rows[0].acknowledged_at,null,'Reply must not acknowledge original');
assert.equal((await db.query('update chat_messages set acknowledged_at=now() where id=$1 returning id',[original])).rows.length,1);
await user(1);assert.equal((await db.query('select id from chat_messages where id=$1',[reply])).rows.length,1);
await user(4);assert.equal((await db.query('select * from chat_messages')).rows.length,0);await assert.rejects(send(1),/row-level security/);
await db.exec('reset role;set role anon;');await assert.rejects(db.query('select * from chat_messages'),/permission denied/);
await db.close();console.log('Chat inbox checks passed: participant isolation, immutable message body, recipient-only acknowledgement, replies do not acknowledge, correct reply recipient, no impersonation, disabled and anonymous denial.');
