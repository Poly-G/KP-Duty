process.on('uncaughtException',e=>{console.error(e.message,e.where||'');process.exit(1);});
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
insert into profiles values ('00000000-0000-4000-8000-000000000001','admin','active'),('00000000-0000-4000-8000-000000000002','team_member','active'),('00000000-0000-4000-8000-000000000003','team_member','disabled'),('00000000-0000-4000-8000-000000000004','team_member','active');
insert into businesses values ('10000000-0000-4000-8000-000000000001','solta',true),('10000000-0000-4000-8000-000000000002','snd',true),('10000000-0000-4000-8000-000000000003','nex',false);
insert into organizations values ('20000000-0000-4000-8000-000000000001','Sample Company');
`);
await db.exec(await readFile(new URL('../../supabase/migrations/20261007190022_client_delivery_foundation.sql',import.meta.url),'utf8'));
await db.exec(await readFile(new URL('../../supabase/migrations/20261007191750_client_delivery_start_authority.sql',import.meta.url),'utf8'));

await db.exec(`create schema storage;grant usage on schema storage to authenticated;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,unique(bucket_id,name));alter table storage.objects enable row level security;grant select,insert,update,delete on storage.objects to authenticated;`);
await db.exec(await readFile(new URL('../../supabase/migrations/20261007220430_project_client_collaboration.sql',import.meta.url),'utf8'));
await db.exec(await readFile(new URL('../../supabase/migrations/20261007230107_deliverable_version_reviews.sql',import.meta.url),'utf8'));
const project='30000000-0000-4000-8000-000000000001';const otherProject='30000000-0000-4000-8000-000000000002';
const deliverable='50000000-0000-4000-8000-000000000001';const delegated='50000000-0000-4000-8000-000000000002';
const v1='60000000-0000-4000-8000-000000000001';const v2='60000000-0000-4000-8000-000000000002';const v3='60000000-0000-4000-8000-000000000003';
const file='40000000-0000-4000-8000-000000000001';const otherFile='40000000-0000-4000-8000-000000000002';const drive='40000000-0000-4000-8000-000000000003';
async function user(n){await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000000${n}',false);`);}
async function create(id=deliverable,reviewer='00000000-0000-4000-8000-000000000001',requirement='website_pages'){
 return db.query('select kp_create_deliverable($1,$2,$3,$4,$5,$6)',[id,project,'Home page','general',reviewer,requirement]);
}
async function version(id,expected,files=[],d=deliverable){return db.query('select kp_add_deliverable_version($1,$2,$3,$4,$5)',[id,d,expected,'Fixed version '+id,files]);}
async function review(id,v,lane='internal',outcome='approved',note='Reviewed',name=null,evidence=null){return db.query('select kp_review_deliverable($1,$2,$3,$4,$5,$6,$7)',[id,v,lane,outcome,note,name,evidence]);}
async function publish(v){return db.query('select kp_publish_deliverable($1)',[v]);}
await user(1);
for(const [p,business] of [[project,'solta'],[otherProject,'snd']])await db.query('select kp_create_client_delivery($1,$2,$3,$4,$5)',[p,business,'20000000-0000-4000-8000-000000000001','Sample project',business==='solta'?'website':'snd']);
for(const [f,p] of [[file,project],[otherFile,otherProject]]){
 const path=p+'/'+f+'/snapshot.pdf';
 await db.query("insert into project_files(id,project_id,series_id,version,name,object_path,size_bytes,mime_type,sha256) values($1,$2,$1,1,'snapshot.pdf',$3,100,'application/pdf',$4)",[f,p,path,'a'.repeat(64)]);
 await db.query("insert into storage.objects(bucket_id,name) values('kp-project-files',$1)",[path]);
 await db.query("update project_files set state='ready' where id=$1",[f]);
}
await db.query("insert into project_files(id,project_id,series_id,version,name,drive_url) values($1,$2,$1,1,'Mutable Drive','https://docs.google.com/document/d/example')",[drive,project]);
await create();await create();assert.equal((await db.query('select * from project_deliverables')).rows.length,1,'Create retry duplicated');
await assert.rejects(create('50000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','unknown'),/Unknown onboarding/);
await assert.rejects(create('50000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000003'),/Active reviewer/);
await user(2);await assert.rejects(create(delegated,'00000000-0000-4000-8000-000000000002'),/Admin assigns/);
await assert.rejects(version(v1,0,[otherFile]),/ready uploaded snapshots/);
await assert.rejects(version(v1,0,[drive]),/Drive links are mutable/);
await assert.rejects(version(v1,0,[file,file]),/distinct files/);
await version(v1,0,[file]);await version(v1,0,[file]);
assert.equal((await db.query('select * from deliverable_versions')).rows.length,1,'Version retry duplicated');
await assert.rejects(version(v2,0,[file]),/changed/);
await assert.rejects(publish(v1),/Internal approval/);
await assert.rejects(review('70000000-0000-4000-8000-000000000001',v1),/Assigned reviewer/);
await user(1);
await assert.rejects(review('70000000-0000-4000-8000-000000000001',v1,'internal','changes_requested',''),/check constraint/);
await review('70000000-0000-4000-8000-000000000001',v1);await review('70000000-0000-4000-8000-000000000001',v1);
await assert.rejects(review('70000000-0000-4000-8000-000000000001',v1,'internal','changes_requested'),/retry mismatch/);
await assert.rejects(review('70000000-0000-4000-8000-000000000002',v1,'client_record','approved','Approved','Client','Email reference'),/Publish this version/);
assert.equal((await db.query('select * from deliverable_publications')).rows.length,0);
await user(2);await publish(v1);await publish(v1);
assert.equal((await db.query("select count(*)::int as n from project_notification_jobs where event_kind='deliverable'")).rows[0].n,1);
assert.equal((await db.query('select audience from project_files where id=$1',[file])).rows[0].audience,'client','Explicit publication did not share exact file');
await assert.rejects(review('70000000-0000-4000-8000-000000000002',v1,'client_record','approved','Approved','Client',''),/check constraint/);
await review('70000000-0000-4000-8000-000000000002',v1,'client_record','changes_requested','Revise headline','Client','Email reference');
await assert.rejects(review('70000000-0000-4000-8000-000000000003',v1,'client_record','approved','Approved','Client','Email reference'),/already reviewed/);
await version(v2,1,[file]);
assert.equal((await db.query('select * from deliverable_reviews where version_id=$1',[v2])).rows.length,0,'Old approval carried forward');
await assert.rejects(publish(v2),/Internal approval/);
await assert.rejects(review('70000000-0000-4000-8000-000000000003',v1,'client_record','approved','Approved','Client','Email reference'),/newer version/);
await user(1);await review('70000000-0000-4000-8000-000000000003',v2,'internal','changes_requested','Fix layout');
await assert.rejects(publish(v2),/Internal approval/);
await version(v3,2);await review('70000000-0000-4000-8000-000000000004',v3);await publish(v3);
await review('70000000-0000-4000-8000-000000000005',v3,'client_record','approved','Approved','Client','Meeting record');
assert.equal((await db.query('select status from projects where id=$1',[project])).rows[0].status,'planned','Approval started/completed the project');
await create(delegated,'00000000-0000-4000-8000-000000000004');const delegatedVersion='60000000-0000-4000-8000-000000000004';await version(delegatedVersion,0,[],delegated);
await user(2);await assert.rejects(review('70000000-0000-4000-8000-000000000006',delegatedVersion),/Assigned reviewer/);
await user(4);await review('70000000-0000-4000-8000-000000000006',delegatedVersion);
await assert.rejects(db.query("update deliverable_versions set description='tampered' where id=$1",[v1]),/permission denied/);
await assert.rejects(db.query("update deliverable_reviews set recorded_by='00000000-0000-4000-8000-000000000001'"),/permission denied/);
await assert.rejects(db.query("insert into deliverable_publications(id,published_by) values($1,'00000000-0000-4000-8000-000000000004')",[v2]),/permission denied/);
await assert.rejects(db.query('delete from deliverable_version_files'),/permission denied/);
await user(3);assert.equal((await db.query('select * from deliverable_reviews')).rows.length,0);await assert.rejects(publish(v1),/membership/);
await user(1);await db.query('update projects set archived_at=now() where id=$1',[project]);await assert.rejects(version('60000000-0000-4000-8000-000000000005',3),/Active client project/);
await assert.rejects(publish(v1),/Active client project/);
await db.exec('reset role;set role anon;');await assert.rejects(db.query('select * from project_deliverables'),/permission denied/);await assert.rejects(publish(v1),/permission denied/);
await db.close();console.log('Deliverable database checks passed: exact immutable versions, retry safety, stale review rejection, no inherited approval, assigned reviewer/delegation, evidence requirements, fixed/project-scoped attachments, explicit publication, held notifications, archived/disabled/anonymous denial and no automatic project activation.');
