import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
export async function kpFixture(){
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
for(const suffix of ['_solta_client_read_boundary.sql','_solta_client_collaboration.sql']){const file=(await readdir(new URL('../../supabase/migrations/',import.meta.url))).find(n=>n.endsWith(suffix));await db.exec(await readFile(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));}
return db;
}
