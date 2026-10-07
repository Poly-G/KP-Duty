-- KP Duty — Gate E integration plumbing
-- No live integrations are enabled by this migration.
-- Purpose: create stable mapping, inbox/outbox, retry/idempotency, and sync-state primitives.

create type public.integration_entity_type as enum (
  'organization', 'person', 'relationship', 'opportunity', 'project', 'task'
);

create type public.integration_sync_direction as enum (
  'inbound', 'outbound', 'bidirectional'
);

create type public.integration_sync_status as enum (
  'manual', 'pending', 'synced', 'error', 'disabled'
);

create type public.inbox_event_status as enum (
  'pending', 'processing', 'processed', 'failed', 'ignored'
);

create type public.outbox_event_status as enum (
  'pending', 'sending', 'sent', 'failed', 'cancelled'
);

create table public.external_links (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete restrict,
  entity_type public.integration_entity_type not null,
  entity_id uuid not null,
  source_system text not null,
  external_record_id text not null,
  external_url text,
  sync_direction public.integration_sync_direction not null default 'inbound',
  sync_status public.integration_sync_status not null default 'manual',
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_links_source_not_blank check (btrim(source_system) <> ''),
  constraint external_links_external_id_not_blank check (btrim(external_record_id) <> '')
);

create unique index external_links_source_record_uq
  on public.external_links (source_system, entity_type, external_record_id);

create index external_links_kp_entity_idx
  on public.external_links (entity_type, entity_id);

create trigger external_links_set_updated_at
before update on public.external_links
for each row execute function public.set_updated_at();

create table public.inbox_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  version integer not null check (version > 0),
  event_type text not null,
  source_system text not null,
  business_id uuid references public.businesses(id) on delete set null,
  entity_type public.integration_entity_type,
  entity_id uuid,
  external_entity_id text,
  payload jsonb not null default '{}'::jsonb,
  status public.inbox_event_status not null default 'pending',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint inbox_event_id_not_blank check (btrim(event_id) <> ''),
  constraint inbox_event_type_not_blank check (btrim(event_type) <> ''),
  constraint inbox_source_not_blank check (btrim(source_system) <> ''),
  constraint inbox_payload_object check (jsonb_typeof(payload) = 'object')
);

create index inbox_events_status_idx
  on public.inbox_events (status, received_at)
  where status in ('pending', 'processing', 'failed');

create index inbox_events_entity_idx
  on public.inbox_events (entity_type, entity_id, occurred_at desc)
  where entity_type is not null and entity_id is not null;

create table public.outbox_events (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique default gen_random_uuid(),
  version integer not null default 1 check (version > 0),
  event_type text not null,
  destination_system text,
  business_id uuid references public.businesses(id) on delete set null,
  entity_type public.integration_entity_type,
  entity_id uuid,
  external_entity_id text,
  payload jsonb not null default '{}'::jsonb,
  status public.outbox_event_status not null default 'pending',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null default now(),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint outbox_event_type_not_blank check (btrim(event_type) <> ''),
  constraint outbox_payload_object check (jsonb_typeof(payload) = 'object')
);

create index outbox_events_dispatch_idx
  on public.outbox_events (status, available_at)
  where status in ('pending', 'failed');

create index outbox_events_entity_idx
  on public.outbox_events (entity_type, entity_id, created_at desc)
  where entity_type is not null and entity_id is not null;

-- Reuses the proven SnD ops_action_requests pattern for retry-safe consequential actions.
create table public.integration_action_requests (
  id uuid primary key default gen_random_uuid(),
  request_key text not null unique,
  actor_user_id uuid references public.profiles(id) on delete restrict,
  source text not null,
  action text not null,
  request_hash text not null,
  replay_result jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integration_action_key_not_blank check (btrim(request_key) <> ''),
  constraint integration_action_source_not_blank check (btrim(source) <> ''),
  constraint integration_action_name_not_blank check (btrim(action) <> ''),
  constraint integration_action_hash_not_blank check (btrim(request_hash) <> ''),
  constraint integration_action_replay_object check (
    replay_result is null or jsonb_typeof(replay_result) = 'object'
  )
);

create index integration_action_actor_idx
  on public.integration_action_requests (actor_user_id, created_at desc)
  where actor_user_id is not null;

create trigger integration_action_requests_set_updated_at
before update on public.integration_action_requests
for each row execute function public.set_updated_at();

alter table public.external_links enable row level security;
alter table public.inbox_events enable row level security;
alter table public.outbox_events enable row level security;
alter table public.integration_action_requests enable row level security;

revoke all on public.external_links, public.inbox_events, public.outbox_events,
  public.integration_action_requests from anon;

-- Human users may inspect integration state.
grant select on public.external_links, public.inbox_events, public.outbox_events,
  public.integration_action_requests to authenticated;

-- External link configuration is admin-controlled.
grant insert, update, delete on public.external_links to authenticated;

create policy "active team read external links"
on public.external_links for select to authenticated
using (public.is_active_member());

create policy "admins create external links"
on public.external_links for insert to authenticated
with check (public.is_admin());

create policy "admins update external links"
on public.external_links for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins delete external links"
on public.external_links for delete to authenticated
using (public.is_admin());

create policy "active team read inbox"
on public.inbox_events for select to authenticated
using (public.is_active_member());

create policy "active team read outbox"
on public.outbox_events for select to authenticated
using (public.is_active_member());

create policy "active team read integration requests"
on public.integration_action_requests for select to authenticated
using (public.is_active_member());

-- Intentionally no authenticated INSERT/UPDATE/DELETE policies on inbox/outbox
-- or integration_action_requests. Future integration workers use a controlled
-- server/edge-function service boundary after their auth/scopes are approved.
