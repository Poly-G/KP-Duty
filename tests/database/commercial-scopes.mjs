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
await db.exec(await readFile(new URL('../../supabase/migrations/20261007191750_client_delivery_start_authority.sql',import.meta.url),'utf8'));

const project='30000000-0000-4000-8000-000000000001',legacy='30000000-0000-4000-8000-000000000002',company='20000000-0000-4000-8000-000000000001';
async function user(n){await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000000${n}',false);`);}
async function create(id){return db.query('select kp_create_client_delivery($1,$2,$3,$4,$5)',[id,'solta',company,'Scope checks','website']);}
async function save(id,patch={},start=false){const {rows:[e]}=await db.query('select revision from client_engagements where id=$1',[id]);return db.query('select kp_save_client_delivery($1,$2,$3,$4)',[id,e.revision,JSON.stringify(patch),start]);}
const answers={goal:'Website',approver_email:'client@example.test',website_pages:'Three pages',content_owner:'Client'};
await user(1);await create(legacy);await save(legacy,{answers,submit:true,onboarding_reviewed:true,scope_approved:true,access_ready:true,capacity_ready:true,payment_required:false});await save(legacy,{onboarding_reviewed:true});await save(legacy,{},true);
const pending='30000000-0000-4000-8000-000000000003';await create(pending);await save(pending,{answers,submit:true,scope_approved:true,access_ready:true,capacity_ready:true,payment_required:false});await save(pending,{onboarding_reviewed:true});
await db.exec('reset role;');
await db.exec(await readFile(new URL('../../supabase/migrations/20261008001823_versioned_commercial_scopes.sql',import.meta.url),'utf8'));
await user(1);
assert.equal((await db.query('select scope_required from client_engagements where id=$1',[legacy])).rows[0].scope_required,false);
await db.query("update projects set phase='Existing work continues' where id=$1",[legacy]);
await assert.rejects(save(pending,{},true),/client evidence/);
await create(project);await save(project,{answers,submit:true,onboarding_reviewed:true,access_ready:true,capacity_ready:true,payment_required:false});
await assert.rejects(save(project,{scope_approved:true}),/client evidence/);
await assert.rejects(save(project,{},true),/readiness/);
await save(project,{onboarding_reviewed:true});
const scope1='40000000-0000-4000-8000-000000000001',scope2='40000000-0000-4000-8000-000000000002';
const terms=['Three page website','Hosting excluded','Payment agreed separately','Client copy before design','Initial agreement'];
async function scope(id,expected,fields=terms){return db.query('select kp_save_scope($1,$2,$3,$4,$5,$6,$7,$8)',[id,project,expected,...fields]);}
async function approve(id,evidence='Client email: approved v1'){return db.query('select kp_approve_scope($1,$2,$3,$4)',[id,'Client Owner','client@example.test',evidence]);}
await user(2);await assert.rejects(scope(scope1,0),/Admin/);await assert.rejects(approve(scope1),/Admin/);
await user(1);await scope(scope1,0);await scope(scope1,0);
assert.equal((await db.query('select count(*)::int n from project_scope_versions')).rows[0].n,1);
await assert.rejects(scope(scope1,0,[...terms.slice(0,4),'Different terms']),/retry mismatch/);
await assert.rejects(scope(scope2,1,['','Hosting excluded',...terms.slice(2)]),/check constraint/);
await assert.rejects(db.query("update project_scope_versions set deliverables='Tampered' where id=$1",[scope1]),/permission denied/);
await assert.rejects(db.query('delete from project_scope_versions where id=$1',[scope1]),/permission denied/);
await assert.rejects(approve(scope1,''),/check constraint/);
await approve(scope1);await approve(scope1);
await assert.rejects(approve(scope1,'Replacement evidence'),/immutable/);
await save(project,{},true);
await scope(scope2,1,[...terms.slice(0,4),'Added copywriting']);
assert.equal((await db.query('select scope_approved from client_engagements where id=$1',[project])).rows[0].scope_approved,false);
await assert.rejects(approve(scope1),/current scope/);
await assert.rejects(scope('40000000-0000-4000-8000-000000000003',1),/Scope changed/);
await assert.rejects(save(project,{scope_approved:true}),/client evidence/);
await assert.rejects(db.query('update client_engagements set scope_required=false where id=$1',[project]),/disabled/);
await assert.rejects(db.query("update projects set phase='Build' where id=$1",[project]),/current scope/);
await assert.rejects(db.query("update projects set status='complete' where id=$1",[project]),/current scope/);
await approve(scope2,'Client email: approved revised version 2');await db.query("update projects set phase='Build' where id=$1",[project]);
await user(2);assert.equal((await db.query('select * from project_scope_versions')).rows.length,2);
await assert.rejects(db.query('insert into project_scope_approvals(scope_id,client_name,client_email,evidence,recorded_by) values($1,$2,$3,$4,auth.uid())',[scope2,'Fake','fake@example.test','Fake approval']),/permission denied/);
await user(3);assert.equal((await db.query('select * from project_scope_versions')).rows.length,0);assert.equal((await db.query('select * from project_scope_approvals')).rows.length,0);await assert.rejects(scope(scope1,0),/Admin/);
await db.exec('reset role;set role anon;');await assert.rejects(db.query('select * from project_scope_versions'),/permission denied/);
await db.close();console.log('Commercial scope checks passed: preserved starts, current-version evidence, append-only history, retry/stale safety, admin authorization, direct API/start/phase bypass denial, revision resets, inactive/anonymous isolation.');
