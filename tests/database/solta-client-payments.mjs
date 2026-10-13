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
const request=randomUUID(),portal=randomUUID();
async function prepare(id=request,amount=500,live=false){return (await db.query('select kp_prepare_solta_payment($1,$2,$3,$4,$5) as value',[id,project,'QA deposit',amount,live])).rows[0].value;}
await staff();await db.query('select kp_create_client_delivery($1,$2,$3,$4,$5)',[project,'solta',company,'QA payments','website']);
await assert.rejects(prepare(),/connected Solta/);checks++;
await db.query('select kp_link_solta_portal($1,$2,$3)',[project,company,portal]);const saved=await prepare();assert.equal(saved.requestId,request);assert.equal(saved.portalProjectId,portal);assert.equal((await prepare()).requestId,request);checks+=3;
await assert.rejects(prepare(request,501),/retry mismatch/);checks++;
await staff('00000000-0000-4000-8000-000000000002');await assert.rejects(prepare(randomUUID()),/admin required/);assert.equal((await db.query('select * from solta_payment_requests')).rows.length,0);checks+=2;
await db.exec('reset role;set role anon');await assert.rejects(prepare(),/permission denied/);await assert.rejects(db.query('select * from solta_payment_receipts'),/permission denied/);checks+=2;
await staff();await db.query('select kp_mark_solta_payment($1,false)',[request]);const event={version:1,business:'solta',operation:'payment.received',projectId:project,organizationId:company,portalProjectId:portal,requestId:request,paymentId:randomUUID(),amount:500,currency:'usd',livemode:false,stripeSessionId:'cs_test_QA123',stripePaymentIntentId:'pi_QA123',paidAt:new Date().toISOString()};
const receive=(data=event,nonce=randomUUID())=>db.query('select kp_receive_solta_payment($1,$2) as value',[data,nonce]);
await assert.rejects(receive(),/permission denied/);checks++;
await service();await assert.rejects(receive({...event,amount:501}),/does not match/);await assert.rejects(receive({...event,livemode:true}),/does not match/);await assert.rejects(receive({...event,organizationId:randomUUID()}),/does not match/);await assert.rejects(receive({...event,stripeSessionId:'cs_live_QA123'}),/identity/);checks+=4;
const nonce=randomUUID();assert.equal((await receive(event,nonce)).rows[0].value.received,true);await assert.rejects(receive(event,nonce),/duplicate key/);assert.equal((await receive()).rows[0].value.received,true);await assert.rejects(receive({...event,paymentId:randomUUID()}),/reconciliation/);checks+=4;
await db.exec('reset role');assert.equal((await db.query('select status from solta_payment_requests where id=$1',[request])).rows[0].status,'paid');assert.equal((await db.query('select started_at from client_engagements where id=$1',[project])).rows[0].started_at,null);assert.equal((await db.query('select payment_evidence from client_engagements where id=$1',[project])).rows[0].payment_evidence,null);checks+=3;
await staff();await assert.rejects(db.query('select kp_mark_solta_payment($1,true)',[request]),/cannot be cancelled/);const unused=randomUUID();await prepare(unused);await db.query('select kp_mark_solta_payment($1,true)',[unused]);await assert.rejects(db.query('select kp_mark_solta_payment($1,false)',[unused]),/cancelled/);checks+=2;
// Office payment creation binds to the exact current client-approved scope.
await staff();
const office=randomUUID(),officePortal=randomUUID(),scope1=randomUUID(),scope2=randomUUID(),officeRequest=randomUUID();
await db.query('select kp_create_client_delivery($1,$2,$3,$4,$5)',[office,'solta',company,'QA office','less_office']);
await db.query('select kp_link_solta_portal($1,$2,$3)',[office,company,officePortal]);
const officePrepare=(id=officeRequest)=>db.query('select kp_prepare_solta_payment($1,$2,$3,$4,$5) as value',[id,office,'Standard office work',79900,false]);
await assert.rejects(officePrepare(),/Approve the current office-work scope/);checks++;
await db.query('select kp_save_scope($1,$2,$3,$4,$5,$6,$7,$8)',[scope1,office,0,'One task and tested result','No broader work','$799 after approval','5–10 business days','Initial scope']);
await assert.rejects(officePrepare(),/Approve the current office-work scope/);checks++;
await db.query('select kp_approve_scope($1,$2,$3,$4)',[scope1,'Synthetic client','qa@example.invalid','Isolated test approval only']);
assert.equal((await officePrepare()).rows[0].value.scopeId,scope1);checks++;
assert.equal((await officePrepare()).rows[0].value.scopeId,scope1);checks++;
await db.query('select kp_save_scope($1,$2,$3,$4,$5,$6,$7,$8)',[scope2,office,1,'Revised one task','No broader work','$799 after approval','5–10 business days','Revised scope']);
await assert.rejects(officePrepare(),/Scope changed/);checks++;
await assert.rejects(officePrepare(randomUUID()),/Approve the current office-work scope/);checks++;
await db.query('select kp_approve_scope($1,$2,$3,$4)',[scope2,'Synthetic client','qa@example.invalid','Isolated revised approval only']);
await assert.rejects(officePrepare(),/Scope changed/);checks++;
assert.equal((await officePrepare(randomUUID())).rows[0].value.scopeId,scope2);checks++;
await db.exec('reset role');assert.equal((await db.query('select started_at from client_engagements where id=$1',[office])).rows[0].started_at,null);checks++;
await db.exec('reset role');await db.query('update projects set archived_at=now() where id=$1',[project]);await staff();await assert.rejects(prepare(randomUUID()),/Active connected/);checks++;
await db.close();console.log(JSON.stringify({checks,isolatedDatabase:true,liveWrites:0}));
