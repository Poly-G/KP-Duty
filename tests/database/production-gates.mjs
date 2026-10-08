process.on('uncaughtException',e=>{console.error(e.message,e.where||'',e.position?e.query?.slice(Math.max(0,Number(e.position)-250),Number(e.position)+150):'');process.exit(1);});
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
create type public.project_status as enum('planned','active','waiting','blocked','complete','cancelled');
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
await db.exec(await readFile(new URL('../../supabase/migrations/20261007232247_service_intake_versions.sql',import.meta.url),'utf8'));
await db.exec(await readFile(new URL('../../supabase/migrations/20261008001823_versioned_commercial_scopes.sql',import.meta.url),'utf8'));
await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
select kp_create_client_delivery('30000000-0000-4000-8000-000000000099','solta','20000000-0000-4000-8000-000000000001','Legacy active delivery','care');
select kp_save_client_delivery('30000000-0000-4000-8000-000000000099',1,jsonb_build_object('answers',(select jsonb_object_agg(k,case when k='approver_email' then 'client@example.test' else 'Legacy sample answer' end) from unnest(private.onboarding_required_keys('care',2,'{}')) k),'submit',true),false);
select kp_save_scope('40000000-0000-4000-8000-000000000099','30000000-0000-4000-8000-000000000099',0,'Legacy deliverables','Legacy exclusions','Legacy commercial terms','Legacy timeline','Initial agreement');
select kp_approve_scope('40000000-0000-4000-8000-000000000099','Client','client@example.test','Legacy email evidence');
select kp_save_client_delivery('30000000-0000-4000-8000-000000000099',4,'{"onboarding_reviewed":true,"access_ready":true,"capacity_ready":true,"payment_required":false}',false);
select kp_save_client_delivery('30000000-0000-4000-8000-000000000099',5,'{}',true);reset role;`);
await db.exec(await readFile(new URL('../../supabase/migrations/20261008002718_production_stage_gates.sql',import.meta.url),'utf8'));
import {randomUUID} from 'node:crypto';
const admin='00000000-0000-4000-8000-000000000001',company='20000000-0000-4000-8000-000000000001';
async function user(n){await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-00000000000${n}',false);`);}
async function state(p){return (await db.query('select kp_get_production_state($1) as state',[p])).rows[0].state;}
async function save(p,patch={},start=false){const e=(await db.query('select * from client_engagements where id=$1',[p])).rows[0];return db.query('select kp_save_client_delivery($1,$2,$3,$4)',[p,e.revision,JSON.stringify(patch),start]);}
async function setup(service,business='solta'){
 const p=randomUUID();await db.query('select kp_create_client_delivery($1,$2,$3,$4,$5)',[p,business,company,'Production sample',service]);
 const keys=(await db.query("select private.onboarding_required_keys($1,2,'{}') as keys",[service])).rows[0].keys;
 const answers=Object.fromEntries(keys.map(k=>[k,k==='approver_email'?'client@example.test':k==='branding_included'?'no':'Synthetic answer']));
 await save(p,{answers,submit:true});await save(p,{onboarding_reviewed:true,access_ready:true,capacity_ready:true,payment_required:false});
 const scope=randomUUID();await db.query('select kp_save_scope($1,$2,0,$3,$4,$5,$6,$7)',[scope,p,'Agreed deliverables','Agreed exclusions','Agreed commercial terms','Agreed timeline','Initial scope']);await db.query('select kp_approve_scope($1,$2,$3,$4)',[scope,'Client','client@example.test','Email approval evidence']);await save(p,{},true);return p;
}
async function deliverable(p,kind,client=true){
 const d=randomUUID(),v=randomUUID();await db.query('select kp_create_deliverable($1,$2,$3,$4,$5,null)',[d,p,kind+' package',kind,admin]);await db.query('select kp_add_deliverable_version($1,$2,0,$3,$4)',[v,d,'Versioned '+kind,[]]);await reviews(v,client);return {d,v};
}
async function reviews(v,client=true){await db.query("select kp_review_deliverable($1,$2,'internal','approved','Checked',null,null)",[randomUUID(),v]);if(client){await db.query('select kp_publish_deliverable($1)',[v]);await db.query("select kp_review_deliverable($1,$2,'client_record','approved','Client agreed','Client','Client email reference')",[randomUUID(),v]);}}
async function gate(p,kind,v,id=randomUUID(),context=null,evidence='Actual gate evidence reference'){return db.query('select kp_record_production_gate($1,$2,$3,$4,$5,$6)',[id,p,kind,v,context??(await state(p)).context,evidence]);}
async function advance(p,stage,id=randomUUID(),context=null,evidence='Explicit stage advancement'){return db.query('select kp_advance_production($1,$2,$3,$4,$5)',[id,p,stage,context??(await state(p)).context,evidence]);}
await user(1);const legacy='30000000-0000-4000-8000-000000000099';assert.equal((await state(legacy)).required,false);await db.query("update projects set phase='Existing legacy workflow' where id=$1",[legacy]);await advance(legacy,'build');assert.equal((await state(legacy)).required,true);await assert.rejects(db.query("update projects set phase='Legacy bypass' where id=$1",[legacy]),/production approvals/);
const p=await setup('website');
assert.deepEqual((await state(p)).stages,['visual','build','qa','launch','handoff','complete']);
await assert.rejects(advance(p,'visual'),/brand direction/);await assert.rejects(advance(p,'build'),/one production stage/);
await assert.rejects(db.query("update projects set phase='Build' where id=$1",[p]),/production approvals/);
await assert.rejects(db.query("update projects set status='blocked',phase='Build' where id=$1",[p]),/production approvals/);
await assert.rejects(db.query("update projects set status='complete' where id=$1",[p]),/handoff/);
const brand=await deliverable(p,'brand_direction'),copy=await deliverable(p,'copy');
await user(2);await assert.rejects(gate(p,'brand_direction',brand.v),/Admin/);await assert.rejects(advance(p,'visual'),/Admin/);await user(1);
const retry=randomUUID(),stale=(await state(p)).context;await gate(p,'brand_direction',brand.v,retry,stale);await gate(p,'brand_direction',brand.v,retry,stale);
await assert.rejects(gate(p,'brand_direction',brand.v,retry,stale,'Different evidence'),/retry mismatch/);
await advance(p,'visual');await assert.rejects(advance(p,'build'),/current copy/);await assert.rejects(gate(p,'copy',copy.v,randomUUID(),stale),/Project changed/);
await gate(p,'copy',copy.v);await advance(p,'build');
const release=await deliverable(p,'launch',false);await assert.rejects(gate(p,'qa',release.v),/Enter QA/);
await advance(p,'qa');await assert.rejects(advance(p,'launch'),/QA checks/);await gate(p,'qa',release.v);
await advance(p,'launch');await assert.rejects(gate(p,'launch',release.v),/client approval/);
await db.query('select kp_publish_deliverable($1)',[release.v]);await db.query("select kp_review_deliverable($1,$2,'client_record','approved','Agreed','Client','Approved release email')",[randomUUID(),release.v]);
await gate(p,'launch',release.v);await advance(p,'handoff');await assert.rejects(advance(p,'complete'),/handoff acceptance/);await gate(p,'handoff',release.v);await advance(p,'complete');
assert.equal((await db.query('select status from projects where id=$1',[p])).rows[0].status,'complete');
await assert.rejects(db.query("update projects set status='active' where id=$1",[p]),/Revisit/);
assert.equal((await db.query("select count(*)::int n from production_gate_approvals where project_id=$1 and kind='brand_direction'",[p])).rows[0].n,1);
await assert.rejects(db.query('update client_engagements set production_required=false where id=$1',[p]),/cannot be disabled/);
await assert.rejects(db.query("update production_gate_approvals set evidence='Forged' where project_id=$1",[p]),/permission denied/);
await assert.rejects(db.query('delete from production_stage_events where project_id=$1',[p]),/permission denied/);
const newBrand=randomUUID();await db.query('select kp_add_deliverable_version($1,$2,1,$3,$4)',[newBrand,brand.d,'Revised brand direction',[]]);
let changed=await state(p);assert.equal(changed.gates.brand_direction,null);assert.equal(changed.gates.qa,null);assert.equal(changed.gates.launch,null);assert.equal(changed.gates.handoff,null);await assert.rejects(advance(p,'complete'),/brand direction/);
await reviews(newBrand);await gate(p,'brand_direction',newBrand);changed=await state(p);assert.equal(changed.gates.qa,null,'Brand approval incorrectly inherited old QA');
await gate(p,'qa',release.v);await gate(p,'launch',release.v);await gate(p,'handoff',release.v);await advance(p,'complete');
const release2=randomUUID();await db.query('select kp_add_deliverable_version($1,$2,1,$3,$4)',[release2,release.d,'Revised release package',[]]);assert.equal((await state(p)).gates.qa,null);assert.equal((await state(p)).gates.launch,null);await assert.rejects(gate(p,'qa',release.v),/current matching/);await reviews(release2);await gate(p,'qa',release2);await assert.rejects(gate(p,'launch',release.v),/current matching/);await gate(p,'launch',release2);await gate(p,'handoff',release2);
const newScope=randomUUID();await db.query('select kp_save_scope($1,$2,1,$3,$4,$5,$6,$7)',[newScope,p,'Revised agreed deliverables','Agreed exclusions','Agreed terms','Agreed timeline','Changed commercial scope']);assert.equal((await state(p)).gates.brand_direction,null);await assert.rejects(advance(p,'complete'),/current scope/);await db.query('select kp_approve_scope($1,$2,$3,$4)',[newScope,'Client','client@example.test','Revised scope evidence']);assert.equal((await state(p)).gates.qa,null);await gate(p,'brand_direction',newBrand);await gate(p,'copy',copy.v);await gate(p,'qa',release2);await gate(p,'launch',release2);await gate(p,'handoff',release2);await advance(p,'complete');
const oldAnswers=(await db.query('select answers from client_engagements where id=$1',[p])).rows[0].answers;await save(p,{answers:{...oldAnswers,goal:'Changed business goal'}});assert.equal((await state(p)).gates.brand_direction,null);await assert.rejects(advance(p,'complete'),/onboarding/);
await user(2);assert.ok((await state(p)).context);await user(3);await assert.rejects(state(p),/membership/);assert.equal((await db.query('select * from production_gate_approvals')).rows.length,0);await user(1);
for(const [service,business] of [['branding','solta'],['less_office','solta'],['care','solta'],['snd','snd']]){
 const sample=await setup(service,business);const stages=(await state(sample)).stages;assert.equal(stages.includes('visual'),service==='branding');assert.equal(stages.includes('build'),service!=='branding');
 if(service==='branding'){const b=await deliverable(sample,'brand_direction');await gate(sample,'brand_direction',b.v);await advance(sample,'visual');}else{await assert.rejects(gate(sample,'brand_direction',brand.v),/does not apply/);await advance(sample,'build');}
 await advance(sample,'qa');const r=await deliverable(sample,'launch');await gate(sample,'qa',r.v);await advance(sample,'launch');await gate(sample,'launch',r.v);await advance(sample,'handoff');await gate(sample,'handoff',r.v);await advance(sample,'complete');
}
await db.exec('reset role;set role anon;');await assert.rejects(db.query('select * from production_stage_events'),/permission denied/);await assert.rejects(state(p),/permission denied/);
await db.close();console.log('Production gate checks passed: all five service paths, exact-version evidence, sequential advancement, revision invalidation, scope/intake dependencies, explicit QA/launch/handoff, stale/retry safety, admin authority and direct/blocked-stage/inactive/anonymous bypass denial.');
