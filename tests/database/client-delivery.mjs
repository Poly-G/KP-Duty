import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
// PGLITE_TEST_PACKAGE may point to an isolated test-runtime install outside the app.
const {PGlite}=await import(process.env.PGLITE_TEST_PACKAGE || '@electric-sql/pglite');
const db=new PGlite();
await db.exec(`
create role anon; create role authenticated;
create schema auth; create schema private;
grant usage on schema auth,private,public to authenticated;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table public.profiles(id uuid primary key,role text,status text);
create table public.businesses(id uuid primary key,slug text,is_active boolean);
create table public.organizations(id uuid primary key,name text);
create table public.projects(id uuid primary key,business_id uuid references businesses,organization_id uuid references organizations,name text,owner_id uuid references profiles,status text default 'planned',phase text,archived_at timestamptz,created_by uuid default auth.uid());
create function private.is_active_member() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.profiles where id=auth.uid() and status='active')$$;
create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.profiles where id=auth.uid() and status='active' and role='admin')$$;
grant select on profiles,businesses,organizations to authenticated;
grant select,insert,update on projects to authenticated;
insert into profiles values ('00000000-0000-4000-8000-000000000001','admin','active'),('00000000-0000-4000-8000-000000000002','team_member','active'),('00000000-0000-4000-8000-000000000003','team_member','disabled');
insert into businesses values ('10000000-0000-4000-8000-000000000001','solta',true),('10000000-0000-4000-8000-000000000002','snd',true),('10000000-0000-4000-8000-000000000003','nex',false);
insert into organizations values ('20000000-0000-4000-8000-000000000001','Sample Company');
`);
await db.exec(await readFile(new URL('../../supabase/migrations/20261007190022_client_delivery_foundation.sql',import.meta.url),'utf8'));
const project='30000000-0000-4000-8000-000000000001';const company='20000000-0000-4000-8000-000000000001';
async function user(n){await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000000${n}',false);`);}
async function create(id,business='solta',service='website'){return db.query('select public.kp_create_client_delivery($1,$2,$3,$4,$5)',[id,business,company,'Sample delivery',service]);}
async function save(revision,patch={},start=false){return db.query('select public.kp_save_client_delivery($1,$2,$3,$4)',[project,revision,JSON.stringify(patch),start]);}
async function engagement(){return (await db.query('select * from client_engagements where id=$1',[project])).rows[0];}
await user(1);await create(project);await create(project);
assert.equal((await db.query('select count(*)::int as count from projects')).rows[0].count,1,'Retry created a duplicate');
await assert.rejects(create('30000000-0000-4000-8000-000000000002','nex'),/Active business/);
await assert.rejects(create('30000000-0000-4000-8000-000000000003','solta','snd'),/Service/);
assert.equal((await db.query('select count(*)::int as count from projects')).rows[0].count,1,'Rejected setup left an orphan');
await assert.rejects(save(1,{},true),/readiness/);
await assert.rejects(db.query("update projects set status='active' where id=$1",[project]),/Approve delivery/);
await assert.rejects(db.query("update projects set status='complete' where id=$1",[project]),/Approve delivery/);
await assert.rejects(save(1,{submit:true}),/required onboarding/);
const answers={goal:'Launch a useful website',approver_email:'client@example.test',website_pages:'Home, services, contact',content_owner:'Client'};
await save(1,{answers,submit:true});assert.ok((await engagement()).submitted_at);
await assert.rejects(save(1,{access_ready:true}),/changed/);
await user(2);
await assert.rejects(create('30000000-0000-4000-8000-000000000004'),/Admin/);
await assert.rejects(save(2,{scope_approved:true}),/Admin/);
await assert.rejects(save(2,{capacity_ready:true}),/Admin/);
await assert.rejects(save(2,{payment_required:false}),/Admin/);
await assert.rejects(save(2,{payment_evidence:'fabricated'}),/Admin/);
await save(2,{onboarding_reviewed:true,access_ready:true});
await assert.rejects(save(3,{},true),/Admin/);
await user(1);await save(3,{scope_approved:true,capacity_ready:true});
await assert.rejects(save(4,{},true),/readiness/);
await save(4,{payment_evidence:'Receipt 123 verified'});
await save(5,{},true);const started=await engagement();assert.ok(started.started_at);
assert.equal((await db.query('select status from projects where id=$1',[project])).rows[0].status,'active');
await assert.rejects(db.query('update client_engagements set started_at=null,started_by=null where id=$1',[project]),/immutable/);
await save(6,{answers:{...answers,website_pages:'Revised scope'}});const revised=await engagement();assert.equal(revised.onboarding_reviewed,false);assert.equal(revised.submitted_at,null);
assert.equal((await db.query('select count(*)::int as count from client_engagement_history where engagement_id=$1',[project])).rows[0].count,7);
await assert.rejects(db.query("update client_engagement_history set snapshot='{}' where engagement_id=$1",[project]),/permission denied/);
await user(3);assert.equal((await db.query('select * from client_engagements')).rows.length,0);await assert.rejects(save(7,{}),/membership/);
await db.exec('reset role;set role anon;');await assert.rejects(db.query('select * from client_engagements'),/permission denied/);
await db.close();console.log('Client delivery database checks passed: retry safety, business/service isolation, no orphan setup, required onboarding, stale saves, admin-only approvals, payment evidence, legacy start bypass, immutable start/history, disabled/anonymous denial.');
