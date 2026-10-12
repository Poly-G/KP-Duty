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
await db.exec("create table public.solta_drive_connection(id text primary key,account_email text);create table public.solta_drive_projects(project_id uuid primary key references public.projects(id),enabled boolean not null default false);alter table public.solta_drive_projects enable row level security;revoke all on public.solta_drive_projects from public,anon,authenticated,service_role;");
await db.exec(await readFile('supabase/migrations/20261012212909_solta_client_onboarding.sql','utf8'));
const project='30000000-0000-4000-8000-000000000001',company='20000000-0000-4000-8000-000000000001',admin='00000000-0000-4000-8000-000000000001';
const {randomUUID}=await import('node:crypto');let checks=0;
async function staff(id=admin){await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);select set_config('request.jwt.claim.role','authenticated',false);`);}
const people={approver:{name:'QA',email:'qa@example.invalid'},members:[],replaceApprover:false,confirmedCompanyAccess:true};
async function prepare(id,projectId=project,payload=people){return (await db.query('select kp_prepare_solta_client_setup($1,$2,$3) as result',[id,projectId,JSON.stringify(payload)])).rows[0].result;}
async function advance(id,portal,complete=false){return db.query('select kp_advance_solta_client_setup($1,$2,$3)',[id,portal,complete]);}
await staff();await db.query('select kp_create_client_delivery($1,$2,$3,$4,$5)',[project,'solta',company,'QA onboarding','website']);const id=randomUUID();
const prepared=await prepare(id);assert.equal((await db.query('select enabled from solta_portal_project_links where project_id=$1',[project])).rows[0].enabled,false);assert.equal((await prepare(id)).portalProjectId,prepared.portalProjectId);checks+=2;
await assert.rejects(prepare(id,project,{...people,replaceApprover:true}),/retry mismatch/);await assert.rejects(advance(id,randomUUID()),/not found/);await assert.rejects(advance(id,prepared.portalProjectId,true),/Finish KP linking/);await assert.rejects(advance(id,prepared.portalProjectId),/Connect Solta Google Drive/);checks+=4;
const earlyOther=randomUUID();assert.equal((await prepare(earlyOther)).portalProjectId,prepared.portalProjectId);checks++;
await staff('00000000-0000-4000-8000-000000000002');await assert.rejects(prepare(randomUUID()),/admin required/);await assert.rejects(advance(id,prepared.portalProjectId),/admin required/);assert.equal((await db.query('select * from solta_client_setup_jobs')).rows.length,0);checks+=3;
await db.exec('reset role;set role anon');await assert.rejects(prepare(randomUUID()),/permission denied/);await assert.rejects(db.query('select * from solta_client_setup_jobs'),/permission denied/);checks+=2;
await db.exec("reset role;insert into solta_drive_connection values('solta','soltafilms@gmail.com')");await staff();await advance(id,prepared.portalProjectId);assert.equal((await db.query('select enabled from solta_portal_project_links where project_id=$1',[project])).rows[0].enabled,true);assert.equal((await db.query('select phase from solta_client_setup_jobs where id=$1',[id])).rows[0].phase,'linked');checks+=2;
await db.exec('reset role');assert.equal((await db.query('select enabled from solta_drive_projects where project_id=$1',[project])).rows[0].enabled,true);assert.equal((await db.query('select started_at from client_engagements where id=$1',[project])).rows[0].started_at,null);checks+=2;
await staff();await advance(id,prepared.portalProjectId,true);await advance(id,prepared.portalProjectId,true);assert.equal((await db.query('select phase from solta_client_setup_jobs where id=$1',[id])).rows[0].phase,'complete');checks++;
await db.query('update solta_portal_project_links set enabled=false where project_id=$1',[project]);await assert.rejects(advance(id,prepared.portalProjectId),/access changed/);await assert.rejects(advance(earlyOther,prepared.portalProjectId),/access changed/);await assert.rejects(prepare(randomUUID()),/disabled/);checks+=3;
const snd=randomUUID();await db.query('select kp_create_client_delivery($1,$2,$3,$4,$5)',[snd,'snd',company,'Wrong business','snd']);await assert.rejects(prepare(randomUUID(),snd),/Active Solta/);checks++;
await db.exec('reset role');await db.query('update projects set archived_at=now() where id=$1',[project]);await staff();await assert.rejects(prepare(randomUUID()),/Active Solta/);await assert.rejects(advance(id,prepared.portalProjectId,true),/Active Solta/);checks+=2;
await db.exec('reset role');await db.query("update profiles set status='disabled' where id=$1",[admin]);await staff();await assert.rejects(prepare(randomUUID()),/admin required/);checks++;
await db.close();console.log(JSON.stringify({checks,isolatedDatabase:true,liveWrites:0}));
