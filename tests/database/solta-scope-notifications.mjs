process.on('uncaughtException',e=>{console.error(e.message,e.where||'',e.position||'',e.internalPosition||'');process.exit(1);});
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
await db.exec("create table public.solta_drive_connection(id text primary key,account_email text);create table public.solta_drive_projects(project_id uuid primary key references public.projects(id),enabled boolean not null default false);alter table public.solta_drive_projects enable row level security;revoke all on public.solta_drive_projects from public,anon,authenticated,service_role;");
await db.exec(await readFile('supabase/migrations/20261012212909_solta_client_onboarding.sql','utf8'));
const project='30000000-0000-4000-8000-000000000001',company='20000000-0000-4000-8000-000000000001',admin='00000000-0000-4000-8000-000000000001';
const {randomUUID}=await import('node:crypto');let checks=0;

await db.exec(await readFile('supabase/migrations/20261008001823_versioned_commercial_scopes.sql','utf8'));
await db.exec(await readFile('supabase/migrations/20261013004838_solta_client_payments.sql','utf8'));
await db.exec(await readFile('supabase/migrations/20261013163548_solta_office_scope_before_payment.sql','utf8'));
async function staff(id=admin){await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);select set_config('request.jwt.claim.role','authenticated',false)`);}
async function service(){await db.exec("reset role;set role service_role;select set_config('request.jwt.claim.role','service_role',false)");}

await db.exec(await readFile('supabase/migrations/20261013175002_solta_portal_scope_review.sql','utf8'));

await db.exec(await readFile('supabase/migrations/20261013165904_solta_project_notification_outbox.sql','utf8'));
await db.exec(await readFile('supabase/migrations/20261013184549_solta_client_update_notifications.sql','utf8'));
await db.exec(await readFile('supabase/migrations/20261013184659_solta_scope_review_notifications.sql','utf8'));
const portal=randomUUID(),scopes=Array.from({length:5},()=>randomUUID());
await staff();await db.query('select kp_create_client_delivery($1,$2,$3,$4,$5)',[project,'solta',company,'Scope email QA','website']);
await db.query('select kp_link_solta_portal($1,$2,$3)',[project,company,portal]);
async function save(n){return db.query('select kp_save_scope($1,$2,$3,$4,$5,$6,$7,$8)',[scopes[n-1],project,n-1,'PRIVATE DELIVERABLES','PRIVATE EXCLUSIONS','PRIVATE PRICE','PRIVATE TIMING','PRIVATE STAFF REASON']);}
const publish=n=>db.query('select kp_publish_solta_scope($1)',[scopes[n-1]]);
const events=async()=>{await db.exec('reset role');return (await db.query("select * from solta_notification_events where event_kind='scope.published' order by created_at")).rows;};
await save(1);await publish(1);assert.equal((await events()).length,0);checks++;
await db.query('update solta_notification_control set enabled=true,client_updates_enabled=true,allowed_projects=$1',[JSON.stringify([project])]);
await staff();await publish(1);assert.equal((await events()).length,0);checks++; // no backfill on retry
await staff();await save(2);assert.equal((await events()).length,0);checks++; // private drafts do not notify
await staff();await publish(2);await publish(2);const queued=await events();
assert.equal(queued.length,1);assert.equal(queued[0].source_id,scopes[1]);assert.equal(queued[0].payload.versionNumber,2);assert.equal(queued[0].payload.portalProjectId,portal);assert.equal(JSON.stringify(queued).includes('PRIVATE'),false);checks+=5;
await db.query('update solta_notification_control set client_updates_enabled=false');await staff();await save(3);await publish(3);assert.equal((await events()).length,1);checks++;
await db.query('update solta_notification_control set client_updates_enabled=true');await staff();await publish(3);assert.equal((await events()).length,1);checks++;
await staff();await save(4);await publish(4);assert.equal((await events()).length,2);checks++;
await staff('00000000-0000-4000-8000-000000000002');await assert.rejects(publish(4),/admin required/);checks++;
await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from kp_claim_solta_notifications($1,$2)',[project,randomUUID()]),/permission denied/);checks++;
await service();const lease=randomUUID(),claimed=(await db.query('select * from kp_claim_solta_notifications($1,$2)',[project,lease])).rows;
assert.equal(claimed.length,1);assert.equal(claimed[0].source_id,scopes[3]);assert.equal((await db.query('select * from kp_claim_solta_notifications($1,$2)',[project,randomUUID()])).rows.length,0);checks+=3;
const stale=(await events()).find(e=>e.source_id===scopes[1]);assert.equal(stale.status,'skipped');assert.equal(stale.error_code,'SCOPE_SUPERSEDED');checks+=2;
await db.query("update solta_notification_events set lease_until=now()-interval '1 minute' where source_id=$1",[scopes[3]]);
await service();const retry=(await db.query('select * from kp_claim_solta_notifications($1,$2)',[project,randomUUID()])).rows;
assert.equal(retry.length,1);assert.equal(retry[0].id,claimed[0].id);checks+=2;
await staff();await save(5);
await db.exec('reset role');await db.query("update solta_notification_events set lease_until=now()-interval '1 minute' where source_id=$1",[scopes[3]]);
await service();assert.equal((await db.query('select * from kp_claim_solta_notifications($1,$2)',[project,randomUUID()])).rows.length,0);checks++;
assert.equal((await events()).find(e=>e.source_id===scopes[3]).status,'skipped');checks++;
await staff();await publish(5);await db.exec('reset role');await db.query('update solta_portal_project_links set enabled=false where project_id=$1',[project]);
await service();assert.equal((await db.query('select * from kp_claim_solta_notifications($1,$2)',[project,randomUUID()])).rows.length,0);checks++;

await db.exec('reset role');await db.query('update solta_portal_project_links set enabled=true where project_id=$1',[project]);await db.query('update solta_notification_control set client_updates_enabled=false');
await db.query('insert into solta_portal_messages(id,project_id,actor_id,actor_name,body) values($1,$2,$3,$4,$5)',[randomUUID(),project,'qa-member','QA member','Private body']);
await service();const oldAlert=(await db.query('select * from kp_claim_solta_notifications($1,$2)',[project,randomUUID()])).rows;
assert.equal(oldAlert.length,1);assert.equal(oldAlert[0].event_kind,'message.created');checks+=2;
await db.exec('reset role');await db.query('update solta_notification_control set client_updates_enabled=true');
await service();const newest=(await db.query('select * from kp_claim_solta_notifications($1,$2)',[project,randomUUID()])).rows;
assert.equal(newest.length,1);assert.equal(newest[0].source_id,scopes[4]);checks+=2;
await db.close();console.log(JSON.stringify({scopeEmailChecks:checks,isolatedDatabase:true,emailsSent:0,liveWrites:0}));
