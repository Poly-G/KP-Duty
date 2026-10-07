-- KP Duty — Gate A foundation
-- Reuse:
-- SnD: explicit identity/ownership and safe durable state.
-- Atomic CRM: auth.users -> app-profile mapping + RLS-first Supabase model.
-- Internal AI System: deny-by-default, business scoping, no secrets in app tables.

create type public.app_role as enum ('admin', 'team_member');
create type public.profile_status as enum ('active', 'disabled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role public.app_role not null default 'team_member',
  status public.profile_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.businesses (slug, name, is_active)
values
  ('solta', 'Solta Works', true),
  ('snd', 'Sent & Delivered', true),
  ('nex', 'NexProviders', false);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger businesses_set_updated_at
before update on public.businesses
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(coalesce(new.email, 'team member'), '@', 1)
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and status = 'active'
  );
$$;

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;

revoke all on public.profiles from anon;
revoke all on public.businesses from anon;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.businesses to authenticated;

create policy "active team can read profiles"
on public.profiles
for select
to authenticated
using (public.is_active_member());

create policy "admins can update profiles"
on public.profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "active team can read businesses"
on public.businesses
for select
to authenticated
using (public.is_active_member());

create policy "admins can insert businesses"
on public.businesses
for insert
to authenticated
with check (public.is_admin());

create policy "admins can update businesses"
on public.businesses
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "admins can delete businesses"
on public.businesses
for delete
to authenticated
using (public.is_admin());
