process.on('uncaughtException',e=>{console.error(e.message,e.where||'');process.exit(1);});
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
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

await db.exec("create role service_role;grant usage on schema public,auth to service_role;create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('role',current_setting('request.jwt.claim.role',true))$$;alter table organizations add archived_at timestamptz;alter table storage.objects add metadata jsonb;");
for(const suffix of ['_solta_client_read_boundary.sql','_solta_client_collaboration.sql']){const file=(await readdir('supabase/migrations')).find(n=>n.endsWith(suffix));await db.exec(await readFile('supabase/migrations/'+file,'utf8'));}
const project='30000000-0000-4000-8000-000000000001',company='20000000-0000-4000-8000-000000000001',portal='90000000-0000-4000-8000-000000000001',admin='00000000-0000-4000-8000-000000000001';
async function staff(){await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${admin}',false);select set_config('request.jwt.claim.role','authenticated',false);`);}
async function service(){await db.exec("reset role;set role service_role;select set_config('request.jwt.claim.role','service_role',false);");}
await staff();await db.query('select kp_create_client_delivery($1,$2,$3,$4,$5)',[project,'solta',company,'QA website','website']);await db.query('select kp_link_solta_portal($1,$2,$3)',[project,company,portal]);
const common={version:1,business:'solta',projectId:project,organizationId:company,portalProjectId:portal,actorId:'client-a',actorName:'QA Client',actorRole:'member'};
const {randomUUID}=await import('node:crypto');let checks=0;
async function op(operation,payload={},extra={},nonce=randomUUID()){return (await db.query('select kp_solta_portal_operation($1,$2) as result',[JSON.stringify({...common,operation,payload,...extra}),nonce])).rows[0].result;}
await service();const message={requestId:randomUUID(),body:'Customer question'};await op('message.create',message);await op('message.create',message);await assert.rejects(op('message.create',{...message,body:'Changed'}),/mismatch/);checks+=3;
assert.equal(await op('message.create',{requestId:randomUUID(),body:'Foreign'},{organizationId:randomUUID()}),null);checks++;
const nonce=randomUUID();await op('project.read',{}, {},nonce);await assert.rejects(op('project.read',{}, {},nonce),/duplicate/);checks++;
const file={requestId:randomUUID(),name:'copy.docx',size:100,mime:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',sha256:'a'.repeat(64)};
const reserve=await op('file.reserve',file);await op('file.reserve',file);assert.equal((await op('project.read')).files.length,0);await assert.rejects(op('file.complete',{fileId:file.requestId,verifiedSha256:file.sha256}),/verified/);checks+=3;
await db.exec('reset role');await db.query("insert into storage.objects(bucket_id,name,metadata) values('kp-project-files',$1,$2)",[reserve.path,JSON.stringify({size:100})]);await service();await op('file.complete',{fileId:file.requestId,verifiedSha256:file.sha256});assert.equal((await op('project.read')).files.length,1);assert.equal(await op('file.inspect',{fileId:file.requestId},{actorId:'foreign-client'}),null);assert.equal(await op('file.download',{fileId:file.requestId},{organizationId:randomUUID()}),null);checks+=3;
await staff();const deliverable=randomUUID(),version=randomUUID();await db.query('select kp_create_deliverable($1,$2,$3,$4,$5,$6)',[deliverable,project,'Website preview','general',admin,null]);await db.query('select kp_add_deliverable_version($1,$2,$3,$4,$5)',[version,deliverable,0,'Ready for review',[]]);
await assert.rejects(db.query('select kp_publish_solta_preview($1,$2)',[version,'https://qa.example/version-1/']),/Publish/);await db.query('select kp_review_deliverable($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),version,'internal','approved','Reviewed',null,null]);await db.query('select kp_publish_deliverable($1)',[version]);await db.query('select kp_publish_solta_preview($1,$2)',[version,'https://qa.example/version-1/']);await assert.rejects(db.query('select kp_publish_solta_preview($1,$2)',[version,'https://qa.example/changed/']),/immutable/);checks+=2;
await service();const review={requestId:randomUUID(),reviewId:version,version:1,outcome:'approved',note:'',confirmed:true};await assert.rejects(op('review.decide',review),/Approver/);await op('review.decide',review,{actorRole:'approver'});await op('review.decide',review,{actorRole:'approver'});assert.equal((await op('project.read')).reviews[0].status,'approved');checks+=4;
await staff();await assert.rejects(db.query('select kp_review_deliverable($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),version,'client_record','approved','Received','QA Client','Email']),/already responded/);checks++;
await db.exec('reset role;set role anon');await assert.rejects(op('project.read'),/permission denied/);await assert.rejects(db.query('select * from solta_portal_files'),/permission denied/);checks+=2;
await staff();await db.query('update solta_portal_project_links set enabled=false where project_id=$1',[project]);await service();assert.equal(await op('message.create',{requestId:randomUUID(),body:'Disabled'}),null);checks++;
await db.close();console.log(JSON.stringify({checks,isolatedDatabase:true,liveWrites:0}));
