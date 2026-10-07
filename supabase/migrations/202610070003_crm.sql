-- KP Duty — Gate C central CRM
-- Atomic contribution: company/contact/deal primitives.
-- KP changes: UUIDs, normalized relationships, per-business pipelines, stricter RLS.

create type public.opportunity_stage_kind as enum ('open', 'won', 'lost');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website text,
  domain text,
  phone text,
  public_email text,
  city text,
  state text,
  country text,
  description text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_name_not_blank check (btrim(name) <> '')
);

create unique index organizations_domain_uq
  on public.organizations (lower(domain))
  where domain is not null and archived_at is null;

create index organizations_name_idx
  on public.organizations (lower(name))
  where archived_at is null;

create table public.people (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  first_name text not null,
  last_name text,
  email text,
  phone text,
  title text,
  linkedin_url text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint people_first_name_not_blank check (btrim(first_name) <> '')
);

create index people_organization_idx
  on public.people (organization_id)
  where archived_at is null;

create index people_email_idx
  on public.people (lower(email))
  where email is not null and archived_at is null;

create table public.relationships (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  organization_id uuid references public.organizations(id) on delete cascade,
  person_id uuid references public.people(id) on delete cascade,
  relationship_type text not null,
  lifecycle_stage text,
  owner_id uuid references public.profiles(id) on delete restrict,
  source text,
  priority public.task_priority not null default 'normal',
  next_action text,
  next_action_at timestamptz,
  do_not_contact boolean not null default false,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint relationships_subject_present check (
    organization_id is not null or person_id is not null
  ),
  constraint relationships_type_not_blank check (btrim(relationship_type) <> '')
);

create index relationships_business_idx
  on public.relationships (business_id, relationship_type)
  where archived_at is null;

create index relationships_org_idx
  on public.relationships (organization_id)
  where archived_at is null;

create index relationships_person_idx
  on public.relationships (person_id)
  where archived_at is null;

create table public.pipelines (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  slug text not null,
  name text not null,
  is_default boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, slug)
);

create unique index pipelines_one_default_per_business_uq
  on public.pipelines (business_id)
  where is_default = true and archived_at is null;

create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.pipelines(id) on delete cascade,
  slug text not null,
  name text not null,
  position integer not null,
  kind public.opportunity_stage_kind not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pipeline_id, slug),
  unique (pipeline_id, position)
);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  pipeline_id uuid not null references public.pipelines(id) on delete restrict,
  stage_id uuid not null references public.pipeline_stages(id) on delete restrict,
  organization_id uuid references public.organizations(id) on delete set null,
  name text not null,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  source text,
  source_url text,
  priority public.task_priority not null default 'normal',
  amount_cents bigint check (amount_cents is null or amount_cents >= 0),
  currency text not null default 'USD',
  next_action text,
  next_action_at timestamptz,
  position integer not null default 0,
  won_at timestamptz,
  lost_at timestamptz,
  archived_at timestamptz,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  updated_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opportunities_name_not_blank check (btrim(name) <> ''),
  constraint opportunities_currency_not_blank check (btrim(currency) <> '')
);

create index opportunities_pipeline_stage_idx
  on public.opportunities (pipeline_id, stage_id, position)
  where archived_at is null;

create index opportunities_owner_idx
  on public.opportunities (owner_id, priority)
  where archived_at is null;

create index opportunities_org_idx
  on public.opportunities (organization_id)
  where archived_at is null;

create table public.opportunity_people (
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  role text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (opportunity_id, person_id)
);

create or replace function public.validate_opportunity_pipeline()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  stage_pipeline uuid;
  pipeline_business uuid;
begin
  select ps.pipeline_id
    into stage_pipeline
  from public.pipeline_stages ps
  where ps.id = new.stage_id;

  select p.business_id
    into pipeline_business
  from public.pipelines p
  where p.id = new.pipeline_id;

  if stage_pipeline is distinct from new.pipeline_id then
    raise exception 'stage does not belong to opportunity pipeline';
  end if;

  if pipeline_business is distinct from new.business_id then
    raise exception 'pipeline does not belong to opportunity business';
  end if;

  return new;
end;
$$;

create trigger opportunities_validate_pipeline
before insert or update of business_id, pipeline_id, stage_id
on public.opportunities
for each row execute function public.validate_opportunity_pipeline();

create or replace function public.set_opportunity_audit_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  next_kind public.opportunity_stage_kind;
begin
  new.updated_at = now();

  if auth.uid() is not null then
    new.updated_by = auth.uid();
  end if;

  select kind into next_kind
  from public.pipeline_stages
  where id = new.stage_id;

  if next_kind = 'won' and old.stage_id is distinct from new.stage_id then
    new.won_at = now();
    new.lost_at = null;
  elsif next_kind = 'lost' and old.stage_id is distinct from new.stage_id then
    new.lost_at = now();
    new.won_at = null;
  elsif next_kind = 'open' then
    new.won_at = null;
    new.lost_at = null;
  end if;

  return new;
end;
$$;

create trigger opportunities_set_audit_fields
before update on public.opportunities
for each row execute function public.set_opportunity_audit_fields();

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create trigger people_set_updated_at
before update on public.people
for each row execute function public.set_updated_at();

create trigger relationships_set_updated_at
before update on public.relationships
for each row execute function public.set_updated_at();

create trigger pipelines_set_updated_at
before update on public.pipelines
for each row execute function public.set_updated_at();

create trigger pipeline_stages_set_updated_at
before update on public.pipeline_stages
for each row execute function public.set_updated_at();

insert into public.pipelines (business_id, slug, name, is_default)
select id, 'sales', 'Solta Sales', true
from public.businesses
where slug = 'solta';

insert into public.pipelines (business_id, slug, name, is_default)
select id, 'opportunities', 'SnD Opportunities', true
from public.businesses
where slug = 'snd';

insert into public.pipelines (business_id, slug, name, is_default)
select id, 'providers', 'Nex Provider Relationships', true
from public.businesses
where slug = 'nex';

with stage_seed(business_slug, pipeline_slug, stage_slug, stage_name, stage_position, stage_kind) as (
  values
    ('solta', 'sales', 'qualified', 'Qualified', 10, 'open'::public.opportunity_stage_kind),
    ('solta', 'sales', 'ready-to-contact', 'Ready to Contact', 20, 'open'::public.opportunity_stage_kind),
    ('solta', 'sales', 'contacted', 'Contacted', 30, 'open'::public.opportunity_stage_kind),
    ('solta', 'sales', 'discussion', 'Discussion', 40, 'open'::public.opportunity_stage_kind),
    ('solta', 'sales', 'proposal', 'Proposal', 50, 'open'::public.opportunity_stage_kind),
    ('solta', 'sales', 'won', 'Won', 60, 'won'::public.opportunity_stage_kind),
    ('solta', 'sales', 'lost', 'Lost', 70, 'lost'::public.opportunity_stage_kind),

    ('snd', 'opportunities', 'found', 'Found', 10, 'open'::public.opportunity_stage_kind),
    ('snd', 'opportunities', 'screening', 'Screening', 20, 'open'::public.opportunity_stage_kind),
    ('snd', 'opportunities', 'qualified', 'Qualified', 30, 'open'::public.opportunity_stage_kind),
    ('snd', 'opportunities', 'ready-to-apply', 'Ready to Apply', 40, 'open'::public.opportunity_stage_kind),
    ('snd', 'opportunities', 'applied', 'Applied', 50, 'open'::public.opportunity_stage_kind),
    ('snd', 'opportunities', 'response', 'Response', 60, 'open'::public.opportunity_stage_kind),
    ('snd', 'opportunities', 'interview', 'Interview', 70, 'open'::public.opportunity_stage_kind),
    ('snd', 'opportunities', 'proposal', 'Proposal', 80, 'open'::public.opportunity_stage_kind),
    ('snd', 'opportunities', 'won', 'Won', 90, 'won'::public.opportunity_stage_kind),
    ('snd', 'opportunities', 'lost', 'Lost', 100, 'lost'::public.opportunity_stage_kind),

    ('nex', 'providers', 'identified', 'Identified', 10, 'open'::public.opportunity_stage_kind),
    ('nex', 'providers', 'contacted', 'Contacted', 20, 'open'::public.opportunity_stage_kind),
    ('nex', 'providers', 'interested', 'Interested', 30, 'open'::public.opportunity_stage_kind),
    ('nex', 'providers', 'onboarding', 'Onboarding', 40, 'open'::public.opportunity_stage_kind),
    ('nex', 'providers', 'listed', 'Listed', 50, 'won'::public.opportunity_stage_kind),
    ('nex', 'providers', 'not-fit', 'Not Fit', 60, 'lost'::public.opportunity_stage_kind)
)
insert into public.pipeline_stages (pipeline_id, slug, name, position, kind)
select p.id, s.stage_slug, s.stage_name, s.stage_position, s.stage_kind
from stage_seed s
join public.businesses b on b.slug = s.business_slug
join public.pipelines p
  on p.business_id = b.id
 and p.slug = s.pipeline_slug;

alter table public.organizations enable row level security;
alter table public.people enable row level security;
alter table public.relationships enable row level security;
alter table public.pipelines enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.opportunities enable row level security;
alter table public.opportunity_people enable row level security;

revoke all on public.organizations, public.people, public.relationships,
  public.pipelines, public.pipeline_stages, public.opportunities,
  public.opportunity_people from anon;

grant select, insert, update, delete on public.organizations, public.people,
  public.relationships, public.opportunities, public.opportunity_people
  to authenticated;

grant select, insert, update, delete on public.pipelines, public.pipeline_stages
  to authenticated;

create policy "active team read organizations"
on public.organizations for select to authenticated
using (public.is_active_member());

create policy "active team create organizations"
on public.organizations for insert to authenticated
with check (public.is_active_member());

create policy "active team update organizations"
on public.organizations for update to authenticated
using (public.is_active_member())
with check (public.is_active_member());

create policy "admins delete organizations"
on public.organizations for delete to authenticated
using (public.is_admin());

create policy "active team read people"
on public.people for select to authenticated
using (public.is_active_member());

create policy "active team create people"
on public.people for insert to authenticated
with check (public.is_active_member());

create policy "active team update people"
on public.people for update to authenticated
using (public.is_active_member())
with check (public.is_active_member());

create policy "admins delete people"
on public.people for delete to authenticated
using (public.is_admin());

create policy "active team read relationships"
on public.relationships for select to authenticated
using (public.is_active_member());

create policy "active team create relationships"
on public.relationships for insert to authenticated
with check (public.is_active_member());

create policy "active team update relationships"
on public.relationships for update to authenticated
using (public.is_active_member())
with check (public.is_active_member());

create policy "admins delete relationships"
on public.relationships for delete to authenticated
using (public.is_admin());

create policy "active team read pipelines"
on public.pipelines for select to authenticated
using (public.is_active_member());

create policy "admins create pipelines"
on public.pipelines for insert to authenticated
with check (public.is_admin());

create policy "admins update pipelines"
on public.pipelines for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins delete pipelines"
on public.pipelines for delete to authenticated
using (public.is_admin());

create policy "active team read stages"
on public.pipeline_stages for select to authenticated
using (public.is_active_member());

create policy "admins create stages"
on public.pipeline_stages for insert to authenticated
with check (public.is_admin());

create policy "admins update stages"
on public.pipeline_stages for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins delete stages"
on public.pipeline_stages for delete to authenticated
using (public.is_admin());

create policy "active team read opportunities"
on public.opportunities for select to authenticated
using (public.is_active_member());

create policy "active team create opportunities"
on public.opportunities for insert to authenticated
with check (
  public.is_active_member()
  and created_by = auth.uid()
  and updated_by = auth.uid()
);

create policy "active team update opportunities"
on public.opportunities for update to authenticated
using (public.is_active_member())
with check (public.is_active_member());

create policy "admins delete opportunities"
on public.opportunities for delete to authenticated
using (public.is_admin());

create policy "active team read opportunity people"
on public.opportunity_people for select to authenticated
using (public.is_active_member());

create policy "active team create opportunity people"
on public.opportunity_people for insert to authenticated
with check (public.is_active_member());

create policy "active team update opportunity people"
on public.opportunity_people for update to authenticated
using (public.is_active_member())
with check (public.is_active_member());

create policy "active team delete opportunity people"
on public.opportunity_people for delete to authenticated
using (public.is_active_member());
