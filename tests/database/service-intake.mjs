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

const admin='00000000-0000-4000-8000-000000000001';const org='20000000-0000-4000-8000-000000000001';
await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${admin}',false);`);
await db.query('select kp_create_client_delivery($1,$2,$3,$4,$5)',['30000000-0000-4000-8000-000000000001','solta',org,'Legacy website','website']);
await db.exec('reset role');
await db.exec(await readFile(new URL('../../supabase/migrations/20261007232247_service_intake_versions.sql',import.meta.url),'utf8'));
await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${admin}',false);`);
assert.equal((await db.query("select template_version from client_engagements where id='30000000-0000-4000-8000-000000000001'")).rows[0].template_version,1);
let n=2;
for(const service of ['website','branding','less_office','care','snd']){
const id='30000000-0000-4000-8000-00000000000'+n++;
await db.query('select kp_create_client_delivery($1,$2,$3,$4,$5)',[id,service==='snd'?'snd':'solta',org,'Expanded '+service,service]);
assert.equal((await db.query('select template_version from client_engagements where id=$1',[id])).rows[0].template_version,2);
const keys=(await db.query('select private.onboarding_required_keys($1,2,$2) as keys',[service,{}])).rows[0].keys;
const answers=Object.fromEntries(keys.map(key=>[key,key==='approver_email'?'reviewer@example.test':key==='branding_included'?'no':'Not sure']));
await assert.rejects(db.query('select kp_save_client_delivery($1,1,$2)',[id,{answers:{goal:'Partial'},submit:true}]),/required onboarding/);
await db.query('select kp_save_client_delivery($1,1,$2)',[id,{answers,submit:true}]);
await db.query('select kp_save_client_delivery($1,2,$2)',[id,{onboarding_reviewed:true}]);
await db.query('select kp_save_client_delivery($1,3,$2)',[id,{answers:{...answers,goal:'Changed'}}]);
const e=(await db.query('select * from client_engagements where id=$1',[id])).rows[0];assert.equal(e.onboarding_reviewed,false);assert.equal(e.submitted_at,null);
if(service==='website'){
await assert.rejects(db.query('select kp_save_client_delivery($1,4,$2)',[id,{answers:{...answers,branding_included:'yes'},submit:true}]),/required onboarding/);
await db.query('select kp_save_client_delivery($1,4,$2)',[id,{answers:{...answers,branding_included:'yes',brand_context:'New brand',brand_constraints:'Print and web'},submit:true}]);
await db.query('select kp_create_deliverable($1,$2,$3,$4,$5,$6)',['50000000-0000-4000-8000-000000000001',id,'Direction','brand_direction',admin,'brand_context']);
}
}
await db.close();console.log('Intake checks passed: legacy templates preserved, service-specific required fields, partial drafts, optional notes, conditional branding and changed-answer review reset.');
