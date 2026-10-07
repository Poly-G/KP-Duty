-- KP Duty — Airtable migration fidelity
-- Preserve live operational data without forcing business-specific detail into core columns.

alter table public.tasks
  alter column owner_id drop not null,
  add column reference_code text,
  add column instructions text,
  add column notes text;

create unique index tasks_reference_code_uq
  on public.tasks (reference_code)
  where reference_code is not null;

alter table public.opportunities
  alter column owner_id drop not null,
  add column reference_code text,
  add column metadata jsonb not null default '{}'::jsonb,
  add constraint opportunities_metadata_object
    check (jsonb_typeof(metadata) = 'object');

create unique index opportunities_reference_code_uq
  on public.opportunities (reference_code)
  where reference_code is not null;

alter table public.decisions
  add column reference_code text;

create unique index decisions_reference_code_uq
  on public.decisions (reference_code)
  where reference_code is not null;
