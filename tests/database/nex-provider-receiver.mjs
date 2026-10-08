import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const {PGlite}=await import(process.env.PGLITE_TEST_PACKAGE || '@electric-sql/pglite');
const db=new PGlite();
const admin=randomUUID(),team=randomUUID(),disabled=randomUUID(),biz=randomUUID(),otherbiz=randomUUID(),org=randomUUID(),person=randomUUID(),opp=randomUUID(),opp2=randomUUID(),otheropp=randomUUID(),norg=randomUUID(),contact=randomUUID(),attempt=randomUUID(),attempt2=randomUUID();
await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema private;
grant usage on schema public,auth,private to authenticated;grant usage on schema public to service_role;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table profiles(id uuid primary key,role text,status text);
create function private.is_active_member() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.profiles where id=auth.uid() and status='active')$$;
create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and status='active')$$;
create table businesses(id uuid primary key,slug text,is_active boolean);
create table organizations(id uuid primary key,archived_at timestamptz);
create table people(id uuid primary key,organization_id uuid,archived_at timestamptz);
create type public.opportunity_stage_kind as enum ('open','won','lost');
create table pipelines(id uuid primary key default gen_random_uuid(),business_id uuid,slug text,name text,is_default boolean,archived_at timestamptz,unique(business_id,slug));
create table pipeline_stages(id uuid primary key default gen_random_uuid(),pipeline_id uuid,slug text,name text,position integer,kind opportunity_stage_kind,unique(pipeline_id,slug),unique(pipeline_id,position));
create table opportunities(id uuid primary key,business_id uuid,organization_id uuid,archived_at timestamptz,pipeline_id uuid,stage_id uuid,won_at timestamptz,lost_at timestamptz);
grant select,update on opportunities to authenticated;
insert into profiles values('${admin}','admin','active'),('${team}','team_member','active'),('${disabled}','admin','disabled');
insert into businesses values('${biz}','nex',true),('${otherbiz}','solta',true);
insert into organizations values('${org}',null);insert into people values('${person}','${org}',null);
insert into opportunities(id,business_id,organization_id,archived_at) values('${opp}','${biz}','${org}',null),('${opp2}','${biz}','${org}',null),('${otheropp}','${otherbiz}','${org}',null);`);
await db.exec(await readFile(new URL('../../supabase/migrations/20261008221703_nex_provider_receiver.sql',import.meta.url),'utf8'));
async function user(id){await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`);}
async function link(a=attempt,o=opp,c=contact,p=person){return db.query('select kp_link_nex_provider($1,$2,$3,$4,$5,$6)',[norg,c,a,org,p,o]);}
await user(team);await assert.rejects(link(),/admin/);await user(disabled);await assert.rejects(link(),/admin/);await user(admin);
await assert.rejects(link(attempt,otheropp),/live Nex/);await assert.rejects(link(attempt,opp,null,person),/Invalid/);await link();await link();await link(attempt2,opp2);
await assert.rejects(link(attempt,opp2),/unique|conflict/);
await db.exec('reset role;');
await db.exec(await readFile(new URL('../../supabase/migrations/20261008230748_nex_provider_pipeline.sql',import.meta.url),'utf8'));
const stage = async()=> (await db.query('select s.slug,o.won_at from opportunities o join pipeline_stages s on s.id=o.stage_id where o.id=$1',[opp])).rows[0];

await db.exec('reset role;set role service_role;');
const base={organizationId:norg,contactId:contact,attemptId:attempt,revision:1,admission:'approved_preview',listingReadiness:'preview_ready',representation:'unrepresented',disposition:'active',mergedIntoOrganizationId:null,onboardingPhase:'ready_for_outreach',onboardedAt:null,contactStatus:'contactable',organizationNoContact:false};
const envelope=(p=base,eid=randomUUID())=>({schemaVersion:1,source:'nexproviders',target:'kp',entityType:'provider_onboarding_attempt',eventType:'provider_snapshot',eventId:eid,occurredAt:'2026-10-08T00:00:00.000Z',payload:p});
async function receive(e){return (await db.query('select kp_receive_nex_provider($1) result',[JSON.stringify(e)])).rows[0].result;}
for(const e of [envelope({...base,notes:'PRIVATE'}),{...envelope(),source:null},{...envelope(),occurredAt:null},envelope({...base,contactStatus:null}),envelope({...base,revision:1.5}),envelope({...base,organizationId:'name'}),envelope({...base,onboardingPhase:'onboarded',onboardedAt:'2026-02-30T00:00:00.000Z'}),envelope({...base,attemptId:randomUUID()})])await assert.rejects(receive(e));
const first=envelope();assert.equal(await receive(first),'applied');assert.equal(await receive(first),'duplicate');await db.exec('reset role;');assert.equal((await stage()).slug,'ready_for_outreach');await user(team);await assert.rejects(db.query('update opportunities set stage_id=$1 where id=$2',[randomUUID(),opp]),/controlled by Nex/);await db.exec('reset role;set role service_role;');await assert.rejects(receive({...first,payload:{...base,contactStatus:'dnc'}}),/collision/);
await assert.rejects(receive(envelope({...base,contactStatus:'dnc'})),/revision collision/);
assert.equal(await receive(envelope({...base,revision:2,contactStatus:'dnc'})),'applied');assert.equal(await receive(envelope()),'stale');
await assert.rejects(receive(envelope({...base,attemptId:attempt2})),/active attempt/);
const success={...base,revision:3,onboardingPhase:'onboarded',onboardedAt:'2026-10-08T00:00:00.000Z'};assert.equal(await receive(envelope(success)),'applied');
assert.equal(await receive(envelope({...success,revision:4,listingReadiness:'in_research'})),'applied');
await db.exec('reset role;');assert.equal((await stage()).slug,'onboarded');assert.equal(new Date((await stage()).won_at).toISOString(),success.onboardedAt);await db.exec('set role service_role;');
await assert.rejects(receive(envelope({...base,revision:5})),/cannot reopen/);await assert.rejects(receive(envelope({...success,revision:5,onboardedAt:'2026-10-09T00:00:00.000Z'})),/cannot reopen/);
assert.equal(await receive(envelope({...base,attemptId:attempt2})),'applied');
for (const [i,phase] of ['outreach','responded','verifying','completing'].entries()) {
 assert.equal(await receive(envelope({...base,attemptId:attempt2,revision:i+2,onboardingPhase:phase})),'applied');
 await db.exec('reset role;');assert.equal((await db.query('select s.slug from opportunities o join pipeline_stages s on s.id=o.stage_id where o.id=$1',[opp2])).rows[0].slug,phase);await db.exec('set role service_role;');
}
assert.equal(await receive(envelope({...base,attemptId:attempt2,revision:6,onboardingPhase:'not_onboarded'})),'applied');await assert.rejects(receive(envelope({...base,attemptId:attempt2,revision:7})),/cannot reopen/);
await assert.rejects(db.query('select * from nex_provider_receipts'),/permission denied/);
await user(team);assert.equal((await db.query('select * from nex_provider_snapshots')).rows.length,2);await assert.rejects(receive(envelope()),/permission denied/);await assert.rejects(db.query('delete from nex_provider_snapshots'),/permission denied/);
await user(disabled);assert.equal((await db.query('select * from nex_provider_snapshots')).rows.length,0);
await db.exec('reset role;set role anon;');await assert.rejects(receive(envelope()),/permission denied/);await assert.rejects(db.query('select * from nex_provider_snapshots'),/permission denied/);
await db.exec('reset role;');
const op={outreachStatus:'ended',endReason:'completed',stalled:false,stallPhase:null,stalledSince:null,lastTouchAt:'2026-10-08T00:00:00.000Z',nextActionDueAt:null,openedAt:'2026-10-01T00:00:00.000Z',closedAt:'2026-10-08T00:00:00.000Z',attemptNumber:1,rulesVersion:1,asOfAt:'2026-10-08T00:00:00.000Z'};
await db.exec('set role service_role;');
const v2={...envelope({...success,revision:5,operations:op}),schemaVersion:2};
assert.equal(await receive(v2),'applied');assert.equal(await receive(v2),'duplicate');
for(const operations of [{...op,notes:'PRIVATE'},{...op,stalled:true},{...op,outreachStatus:'paused'},{...op,endReason:'clinical'},{...op,asOfAt:'2026-09-30T00:00:00.000Z'}]) await assert.rejects(receive({...v2,eventId:randomUUID(),payload:{...v2.payload,revision:6,operations}}));
await assert.rejects(receive({...v2,payload:{...v2.payload,operations:{...op,endReason:'declined'}}}),/collision/);
await assert.rejects(receive(envelope({...success,revision:6})),/downgrade/);
await assert.rejects(receive({...v2,eventId:randomUUID(),payload:{...v2.payload,revision:6,operations:{...op,attemptNumber:2}}}),/facts conflict/);
await db.exec('reset role;');assert.equal((await stage()).slug,'onboarded');assert.equal(new Date((await stage()).won_at).toISOString(),success.onboardedAt);
await db.close();console.log('Nex receiver database checks passed: explicit scoped links, admin/live membership, strict allowlist, replay/revision collisions, stale delivery, suppression, terminal retention, sibling attempts and worker-only ingestion.');
