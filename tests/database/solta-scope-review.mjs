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
const portal=randomUUID(),scope1=randomUUID(),scope2=randomUUID();
await staff();await db.query('select kp_create_client_delivery($1,$2,$3,$4,$5)',[project,'solta',company,'Scope review QA','less_office']);
await db.query('select kp_link_solta_portal($1,$2,$3)',[project,company,portal]);
const base={version:1,business:'solta',projectId:project,organizationId:company,portalProjectId:portal,actorId:'synthetic-approver'};
async function read(patch={}){return (await db.query('select kp_solta_portal_operation($1,$2) as value',[{...base,operation:'project.read',...patch},randomUUID()])).rows[0].value;}
async function decide(patch={},meta={},id=randomUUID()){return (await db.query('select kp_solta_portal_operation($1,$2) as value',[{...base,actorName:'Synthetic Approver',actorRole:'approver',operation:'scope.decide',...meta,payload:{requestId:id,scopeId:scope1,version:1,outcome:'approved',note:'',confirmed:true,...patch}},randomUUID()])).rows[0].value;}
async function save(id,expected){return db.query('select kp_save_scope($1,$2,$3,$4,$5,$6,$7,$8)',[id,project,expected,'One task acceptance tests','Extra work excluded','$799 after approval','5–10 business days','INTERNAL STAFF REASON MUST NOT LEAK']);}
await save(scope1,0);
await service();assert.equal((await read()).scope,null);checks++;
await assert.rejects(decide(),/not been shared/);checks++;
await staff('00000000-0000-4000-8000-000000000002');await assert.rejects(db.query('select kp_publish_solta_scope($1)',[scope1]),/admin required/);checks++;
await staff();await db.query('select kp_publish_solta_scope($1)',[scope1]);await db.query('select kp_publish_solta_scope($1)',[scope1]);
await service();const shared=await read();assert.equal(shared.scope.version,1);assert.equal(shared.scope.status,'pending');assert.equal(shared.scope.isCurrent,true);assert.equal(JSON.stringify(shared).includes('INTERNAL STAFF REASON'),false);checks+=4;
assert.equal(await read({organizationId:randomUUID()}),null);assert.equal(await read({portalProjectId:randomUUID()}),null);checks+=2;
await assert.rejects(decide({}, {actorRole:'member'}),/approver/);await assert.rejects(decide({confirmed:false}),/approver/);await assert.rejects(decide({version:2}),/Scope changed/);await assert.rejects(decide({scopeId:randomUUID()}),/Scope changed/);await assert.rejects(decide({outcome:'changes_requested'}),/Explain/);checks+=5;
const feedback=randomUUID();await decide({outcome:'changes_requested',note:'Clarify supported tools',confirmed:false},{actorRole:'member',actorId:'synthetic-member'},feedback);
assert.equal((await read()).scope.status,'changes_requested');assert.equal((await read()).scope.feedback.note,'Clarify supported tools');checks+=2;
await assert.rejects(decide({outcome:'changes_requested',note:'Different feedback',confirmed:false},{actorRole:'member',actorId:'synthetic-member'},feedback),/retry mismatch/);checks++;
const approval=randomUUID();await decide({}, {},approval);await decide({}, {},approval);
assert.equal((await read()).scope.status,'approved');await assert.rejects(decide(),/final approval/);await assert.rejects(decide({outcome:'changes_requested',note:'Later feedback'}),/final approval/);checks+=3;
await db.exec('reset role');assert.equal((await db.query('select private.current_scope_approved($1) value',[project])).rows[0].value,true);
assert.equal((await db.query('select started_at from client_engagements where id=$1',[project])).rows[0].started_at,null);checks+=2;
await staff();const payment=randomUUID();assert.equal((await db.query('select kp_prepare_solta_payment($1,$2,$3,$4,$5) value',[payment,project,'QA office',79900,false])).rows[0].value.scopeId,scope1);checks++;
await save(scope2,1);
await service();assert.equal((await read()).scope.id,scope1);assert.equal((await read()).scope.isCurrent,false);await assert.rejects(decide({}, {},randomUUID()),/Scope changed/);checks+=3;
await db.exec('reset role');assert.equal((await db.query('select private.current_scope_approved($1) value',[project])).rows[0].value,false);checks++;
await staff();await assert.rejects(db.query('select kp_publish_solta_scope($1)',[scope2]),/Cancel unpaid/);checks++;
await db.query('select kp_mark_solta_payment($1,true)',[payment]);await db.query('select kp_publish_solta_scope($1)',[scope2]);
await assert.rejects(db.query('select kp_publish_solta_scope($1)',[scope1]),/current scope/);checks++;
await service();assert.equal((await read()).scope.id,scope2);assert.equal((await read()).scope.status,'pending');await assert.rejects(decide(),/Scope changed/);checks+=3;
await staff();await db.query('select kp_approve_scope($1,$2,$3,$4)',[scope2,'Synthetic manual approver','qa@example.invalid','PRIVATE EMAIL EVIDENCE']);
await service();assert.equal((await read()).scope.status,'approved');assert.equal(JSON.stringify(await read()).includes('PRIVATE EMAIL EVIDENCE'),false);await assert.rejects(decide({scopeId:scope2,version:2}),/final approval/);checks+=3;
await staff();await assert.rejects(db.query("update solta_portal_scope_decisions set note='tamper'"),/permission denied/);await assert.rejects(db.query('delete from solta_portal_scope_publications'),/permission denied/);checks+=2;
await staff('00000000-0000-4000-8000-000000000003');assert.equal((await db.query('select * from solta_portal_scope_decisions')).rows.length,0);checks++;
await db.exec('reset role;set role anon');await assert.rejects(read(),/permission denied/);await assert.rejects(db.query('select * from solta_portal_scope_decisions'),/permission denied/);await assert.rejects(db.query('select kp_publish_solta_scope($1)',[scope2]),/permission denied/);checks+=3;
await db.close();console.log(JSON.stringify({scopeChecks:checks,isolatedDatabase:true,liveWrites:0}));
