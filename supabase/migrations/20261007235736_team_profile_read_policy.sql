-- Single read policy: active staff see the roster; inactive staff see only their own status.
alter policy "active team can read profiles" on public.profiles using ((select private.is_active_member()) or id=(select auth.uid()));
drop policy "members read own profile status" on public.profiles;
