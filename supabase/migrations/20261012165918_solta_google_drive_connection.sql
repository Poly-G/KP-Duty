-- Version returned by the hosted solta_google_drive_connection migration.
-- No browser roles can read OAuth state or encrypted provider credentials.
create table public.solta_drive_oauth_states (
 state_hash text primary key check (state_hash ~ '^[a-f0-9]{64}$'),
 actor_id uuid not null references public.profiles(id),
 expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
create table public.solta_drive_connection (
 id text primary key check (id = 'solta'),
 account_email text not null check (account_email = 'soltafilms@gmail.com'),
 encrypted_refresh_token text not null check (encrypted_refresh_token like 'v1.%'),
 root_folder_id text,
 connected_by uuid not null references public.profiles(id),
 connected_at timestamptz not null default now()
);
alter table public.solta_drive_oauth_states enable row level security;
alter table public.solta_drive_connection enable row level security;
revoke all on public.solta_drive_oauth_states,public.solta_drive_connection from public,anon,authenticated;
grant select,insert,update,delete on public.solta_drive_oauth_states,public.solta_drive_connection to service_role;
create index solta_drive_states_expiry_idx on public.solta_drive_oauth_states(expires_at);
create index solta_drive_states_actor_idx on public.solta_drive_oauth_states(actor_id);
create index solta_drive_connection_actor_idx on public.solta_drive_connection(connected_by);
