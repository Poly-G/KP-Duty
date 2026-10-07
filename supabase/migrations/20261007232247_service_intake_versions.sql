alter table public.client_engagements drop constraint client_engagements_template_version_check;
alter table public.client_engagements add constraint client_engagements_template_version_check check(template_version in (1,2));
alter table public.client_engagements alter column template_version set default 2;
create function private.onboarding_required_keys(p_service text,p_version integer,p_answers jsonb) returns text[] language plpgsql immutable security invoker set search_path='' as $$
declare keys text[]:=array['goal','approver_email'];
begin
 if p_version=1 then
 keys:=keys||case p_service when 'website' then array['website_pages','content_owner'] when 'branding' then array['audience','brand_deliverables'] when 'less_office' then array['systems','workflow'] when 'care' then array['site_url','care_priorities'] else array['systems','agreed_plan','measurement'] end;
 elsif p_version=2 then
 keys:=keys||array['business_facts','client_contact','agreed_scope','dependencies']||case p_service when 'website' then array['website_pages','content_owner','customer_path','proof','existing_brand','assets','domain','contact_method','branding_included'] when 'branding' then array['audience','brand_deliverables','brand_context','brand_constraints','brand_uses','assets'] when 'less_office' then array['systems','workflow','trigger','workflow_steps','sanitized_example','exceptions','desired_result'] when 'care' then array['site_url','care_priorities','ownership','handoff','known_issues'] when 'snd' then array['systems','agreed_plan','measurement','audience_signals','baseline','access_plan','asset_inventory','handoff_owner'] else '{}'::text[] end;
 if p_service='website' and p_answers->>'branding_included'='yes' then keys:=keys||array['brand_context','brand_constraints']; end if;
 else raise exception 'Unknown onboarding template'; end if;
 return keys;
end $$;
revoke all on function private.onboarding_required_keys(text,integer,jsonb) from public,anon;
grant execute on function private.onboarding_required_keys(text,integer,jsonb) to authenticated;
create or replace function private.check_client_engagement() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.projects; slug text; required_key text; keys text[];
begin
 if not private.is_active_member() then raise exception 'Active team membership required'; end if;
 select * into p from public.projects where id=new.id and archived_at is null;
 select b.slug into slug from public.businesses b where b.id=p.business_id and b.is_active;
 if p.id is null or p.organization_id is null or slug not in ('solta','snd') then raise exception 'Active business and client company required'; end if;
 if (slug='snd') <> (new.service='snd') then raise exception 'Service does not belong to this business'; end if;
 if tg_op='INSERT' then
  if p.status<>'planned' or new.started_at is not null or new.started_by is not null or new.revision<>1 then raise exception 'New delivery must start in preparation'; end if;
 else
  if new.id<>old.id or new.service<>old.service or new.template_version<>old.template_version then raise exception 'Project and template cannot change'; end if;
  if old.started_at is not null and (new.started_at is distinct from old.started_at or new.started_by is distinct from old.started_by) then raise exception 'Start approval is immutable'; end if;
  if not private.is_admin() and (new.scope_approved is distinct from old.scope_approved or new.payment_required is distinct from old.payment_required or new.payment_evidence is distinct from old.payment_evidence or new.capacity_ready is distinct from old.capacity_ready or new.started_at is distinct from old.started_at or new.started_by is distinct from old.started_by) then raise exception 'Admin approval required'; end if;
  if new.answers is distinct from old.answers then new.onboarding_reviewed=false; if new.submitted_at is not distinct from old.submitted_at then new.submitted_at=null; end if; end if;
  new.revision=old.revision+1;
 end if;
 keys=private.onboarding_required_keys(new.service,new.template_version,new.answers);
 if exists(select 1 from jsonb_each(new.answers) a where jsonb_typeof(a.value)<>'string' or length(a.value#>>'{}')>10000) then raise exception 'Answers must be bounded text'; end if;
 if new.submitted_at is not null then
  foreach required_key in array keys loop
   if coalesce(length(btrim(new.answers->>required_key)),0)=0 then raise exception 'Complete required onboarding fields before submitting'; end if;
  end loop;
  if new.template_version=2 and new.service='website' and new.answers->>'branding_included' not in ('yes','no') then raise exception 'Choose whether branding is included'; end if;
  if (new.answers->>'approver_email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Valid approver email required'; end if;
 end if;
 if new.onboarding_reviewed and new.submitted_at is null then raise exception 'Submit onboarding before review'; end if;
 if new.started_at is not null and (tg_op='INSERT' or old.started_at is null) then
  if not private.is_admin() or new.started_by is distinct from auth.uid() then raise exception 'Admin start approval required'; end if;
  if not(new.scope_approved and new.onboarding_reviewed and new.submitted_at is not null and new.access_ready and new.capacity_ready) or (new.payment_required and coalesce(length(btrim(new.payment_evidence)),0)=0) then raise exception 'Resolve readiness checks before starting delivery'; end if;
  if not exists(select 1 from public.profiles where id=p.owner_id and status='active') then raise exception 'Active project owner required'; end if;
 end if;
 new.updated_at=now(); return new;
end $$;
create or replace function private.create_deliverable(p_id uuid,p_project uuid,p_title text,p_kind text,p_reviewer uuid,p_requirement text) returns uuid language plpgsql security definer set search_path='' as $$
declare owner uuid; existing public.project_deliverables; service text; allowed text[];
begin
 perform private.require_deliverable_project(p_project);
 select owner_id into owner from public.projects where id=p_project;
 if not private.is_admin() and p_reviewer is distinct from owner then raise exception 'Admin assigns a different reviewer'; end if;
 if not exists(select 1 from public.profiles where id=p_reviewer and status='active') then raise exception 'Active reviewer required'; end if;
 select e.service into service from public.client_engagements e where id=p_project;
 select private.onboarding_required_keys(e.service,e.template_version,e.answers)||array['optional_notes'] into allowed from public.client_engagements e where e.id=p_project;
 if p_requirement is not null and not p_requirement=any(allowed) then raise exception 'Unknown onboarding requirement'; end if;
 select * into existing from public.project_deliverables where id=p_id;
 if found then
  if existing.project_id is distinct from p_project or existing.title is distinct from p_title or existing.kind is distinct from p_kind or existing.reviewer_id is distinct from p_reviewer or existing.requirement_key is distinct from p_requirement or existing.created_by<>auth.uid() then raise exception 'Deliverable retry mismatch'; end if;
  return p_id;
 end if;
 insert into public.project_deliverables(id,project_id,title,kind,reviewer_id,requirement_key,created_by) values(p_id,p_project,p_title,p_kind,p_reviewer,p_requirement,auth.uid());
 return p_id;
end $$;

