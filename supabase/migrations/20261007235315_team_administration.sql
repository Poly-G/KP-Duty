-- Staff administration: explicit roster, no automatic privileges for future client identities.
alter table public.profiles add column revision bigint not null default 1;
revoke update on public.profiles from authenticated;
create policy "members read own profile status" on public.profiles for select to authenticated using(id=(select auth.uid()));
create table public.staff_invitations (
 id uuid primary key, email text not null check(email=lower(trim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 display_name text not null check(length(trim(display_name)) between 1 and 120),
 state text not null default 'prepared' check(state in ('prepared','linked','cancelled')),
 profile_id uuid references public.profiles(id), created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index staff_invitation_open_email on public.staff_invitations(email) where state<>'cancelled';
create index staff_invitation_profile on public.staff_invitations(profile_id);
create index staff_invitation_creator on public.staff_invitations(created_by);
create table public.team_admin_events (
 id uuid primary key default gen_random_uuid(), actor_id uuid not null references public.profiles(id),
 profile_id uuid references public.profiles(id), invitation_id uuid references public.staff_invitations(id),
 action text not null, reason text not null check(length(trim(reason)) between 5 and 2000),
 before_state jsonb, after_state jsonb, created_at timestamptz not null default now()
);
create index team_event_actor on public.team_admin_events(actor_id);
create index team_event_profile on public.team_admin_events(profile_id);
create index team_event_invitation on public.team_admin_events(invitation_id);
alter table public.staff_invitations enable row level security;
alter table public.team_admin_events enable row level security;
revoke all on public.staff_invitations,public.team_admin_events from public,anon,authenticated;
grant select on public.staff_invitations,public.team_admin_events to authenticated;
create policy "admins read staff invitations" on public.staff_invitations for select to authenticated using ((select private.is_admin()));
create policy "admins read team history" on public.team_admin_events for select to authenticated using ((select private.is_admin()));

create function private.guard_staff_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.id<>old.id then raise exception 'Staff identity cannot change';end if;
 if old.role='admin' and old.status='active' and (new.role<>'admin' or new.status<>'active') then
  perform pg_advisory_xact_lock(hashtextextended('kp-team-administration',0));
  if not exists(select 1 from public.profiles where id<>old.id and role='admin' and status='active') then raise exception 'Keep at least one active admin';end if;
 end if;
 new.revision:=old.revision+1;return new;
end $$;
revoke all on function private.guard_staff_profile() from public,anon,authenticated;
create trigger profiles_guard_team_changes before update on public.profiles for each row execute function private.guard_staff_profile();

create or replace function public.handle_new_auth_user() returns trigger language plpgsql security definer set search_path='' as $$
declare invitation public.staff_invitations;
begin
 if new.raw_app_meta_data->>'account_kind'='client' then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended('kp-team-administration',0));
 select * into invitation from public.staff_invitations where email=lower(new.email) and state='prepared' for update;
 if not found then return new;end if;
 insert into public.profiles(id,display_name,role,status) values(new.id,invitation.display_name,'team_member','disabled') on conflict(id) do nothing;
 update public.staff_invitations set profile_id=new.id,state='linked',updated_at=now() where id=invitation.id;
 insert into public.team_admin_events(actor_id,profile_id,invitation_id,action,reason,after_state) values(invitation.created_by,new.id,invitation.id,'identity_linked','Prepared staff identity linked; admin activation still required',jsonb_build_object('status','disabled','role','team_member'));
 return new;
end $$;
revoke all on function public.handle_new_auth_user() from public,anon,authenticated;

create function private.prepare_staff(p_id uuid,p_email text,p_name text,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare invitation public.staff_invitations; identity uuid;
begin
 if not private.is_admin() then raise exception 'Admin permission required';end if;
 if p_id is null or coalesce(length(trim(p_name)),0) not between 1 and 120 or coalesce(length(trim(p_reason)),0) not between 5 and 2000 or coalesce(length(p_email),0)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or p_email is null then raise exception 'Valid staff name, email and reason required';end if;
 p_email:=lower(trim(p_email));
 perform pg_advisory_xact_lock(hashtextextended('kp-team-administration',0));
 select * into invitation from public.staff_invitations where id=p_id;
 if found then
  if invitation.created_by<>auth.uid() or invitation.email<>p_email or invitation.display_name<>trim(p_name) then raise exception 'Staff preparation retry mismatch';end if;
  return p_id;
 end if;
 select id into identity from auth.users where lower(email)=p_email;
 if identity is not null and exists(select 1 from public.profiles where id=identity) then raise exception 'This person is already in the staff roster';end if;
 if identity is not null and exists(select 1 from auth.users where id=identity and raw_app_meta_data->>'account_kind'='client') then raise exception 'Client identity cannot be added as staff';end if;
 insert into public.staff_invitations(id,email,display_name,created_by) values(p_id,p_email,trim(p_name),auth.uid());
 if identity is not null then
  insert into public.profiles(id,display_name,role,status) values(identity,trim(p_name),'team_member','disabled');
  update public.staff_invitations set state='linked',profile_id=identity where id=p_id;
 end if;
 insert into public.team_admin_events(actor_id,profile_id,invitation_id,action,reason,after_state) values(auth.uid(),identity,p_id,'staff_prepared',trim(p_reason),jsonb_build_object('email',p_email,'display_name',trim(p_name),'status','disabled'));
 return p_id;
end $$;

create function private.change_staff(p_target uuid,p_revision bigint,p_name text,p_role public.app_role,p_status public.profile_status,p_reason text,p_confirmation text) returns bigint language plpgsql security definer set search_path='' as $$
declare member public.profiles; next_revision bigint;
begin
 if not private.is_admin() then raise exception 'Admin permission required';end if;
 if p_role is null or p_status is null or coalesce(length(trim(p_name)),0) not between 1 and 120 or coalesce(length(trim(p_reason)),0) not between 5 and 2000 then raise exception 'Name and reason required';end if;
 perform pg_advisory_xact_lock(hashtextextended('kp-team-administration',0));
 select * into member from public.profiles where id=p_target for update;
 if not found then raise exception 'Staff member unavailable';end if;
 if member.revision<>p_revision then raise exception 'Staff record changed; reload before saving';end if;
 if p_confirmation is distinct from 'UPDATE '||coalesce(member.display_name,member.id::text) then raise exception 'Type the exact confirmation';end if;
 if p_target=auth.uid() and (p_role<>member.role or p_status<>member.status) then raise exception 'Another admin must change your own access';end if;
 if p_status='active' and not exists(select 1 from auth.users where id=p_target and email_confirmed_at is not null and deleted_at is null and (banned_until is null or banned_until<=now())) then raise exception 'Confirmed, available login required before activation';end if;
 if (p_name,p_role,p_status) is not distinct from (member.display_name,member.role,member.status) then return member.revision;end if;
 update public.profiles set display_name=trim(p_name),role=p_role,status=p_status where id=p_target returning revision into next_revision;
 insert into public.team_admin_events(actor_id,profile_id,action,reason,before_state,after_state) values(auth.uid(),p_target,'staff_changed',trim(p_reason),jsonb_build_object('name',member.display_name,'role',member.role,'status',member.status,'revision',member.revision),jsonb_build_object('name',trim(p_name),'role',p_role,'status',p_status,'revision',next_revision));
 return next_revision;
end $$;

create function private.cancel_staff_preparation(p_id uuid,p_confirmation text,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare invitation public.staff_invitations;
begin
 if not private.is_admin() then raise exception 'Admin permission required';end if;
 perform pg_advisory_xact_lock(hashtextextended('kp-team-administration',0));
 select * into invitation from public.staff_invitations where id=p_id for update;
 if not found or invitation.state<>'prepared' then raise exception 'Only unlinked staff preparations can be cancelled';end if;
 if p_confirmation is distinct from 'CANCEL '||invitation.email or coalesce(length(trim(p_reason)),0) not between 5 and 2000 then raise exception 'Exact confirmation and reason required';end if;
 update public.staff_invitations set state='cancelled',updated_at=now() where id=p_id;
 insert into public.team_admin_events(actor_id,invitation_id,action,reason,before_state,after_state) values(auth.uid(),p_id,'preparation_cancelled',trim(p_reason),to_jsonb(invitation),jsonb_build_object('state','cancelled'));
end $$;

create function private.team_roster() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.is_admin() then raise exception 'Admin permission required';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'display_name',p.display_name,'role',p.role,'status',p.status,'revision',p.revision,'email',u.email,'confirmed',u.email_confirmed_at is not null,'last_sign_in_at',u.last_sign_in_at,'login_available',u.deleted_at is null and (u.banned_until is null or u.banned_until<=now()),'open_tasks',(select count(*) from public.tasks t where t.owner_id=p.id and t.archived_at is null and t.stage<>'finished'),'open_projects',(select count(*) from public.projects pr where pr.owner_id=p.id and pr.archived_at is null and pr.status not in ('complete','cancelled'))) order by p.display_name,p.id) from public.profiles p join auth.users u on u.id=p.id),'[]'::jsonb);
end $$;
revoke all on function private.prepare_staff(uuid,text,text,text),private.change_staff(uuid,bigint,text,public.app_role,public.profile_status,text,text),private.cancel_staff_preparation(uuid,text,text),private.team_roster() from public,anon;
grant execute on function private.prepare_staff(uuid,text,text,text),private.change_staff(uuid,bigint,text,public.app_role,public.profile_status,text,text),private.cancel_staff_preparation(uuid,text,text),private.team_roster() to authenticated;
create function public.kp_prepare_staff(p_id uuid,p_email text,p_name text,p_reason text) returns uuid language sql security invoker set search_path='' as $$select private.prepare_staff(p_id,p_email,p_name,p_reason)$$;
create function public.kp_change_staff(p_target uuid,p_revision bigint,p_name text,p_role public.app_role,p_status public.profile_status,p_reason text,p_confirmation text) returns bigint language sql security invoker set search_path='' as $$select private.change_staff(p_target,p_revision,p_name,p_role,p_status,p_reason,p_confirmation)$$;
create function public.kp_cancel_staff_preparation(p_id uuid,p_confirmation text,p_reason text) returns void language sql security invoker set search_path='' as $$select private.cancel_staff_preparation(p_id,p_confirmation,p_reason)$$;
create function public.kp_team_roster() returns jsonb language sql security invoker set search_path='' as $$select private.team_roster()$$;
revoke all on function public.kp_prepare_staff(uuid,text,text,text),public.kp_change_staff(uuid,bigint,text,public.app_role,public.profile_status,text,text),public.kp_cancel_staff_preparation(uuid,text,text),public.kp_team_roster() from public,anon;
grant execute on function public.kp_prepare_staff(uuid,text,text,text),public.kp_change_staff(uuid,bigint,text,public.app_role,public.profile_status,text,text),public.kp_cancel_staff_preparation(uuid,text,text),public.kp_team_roster() to authenticated;
