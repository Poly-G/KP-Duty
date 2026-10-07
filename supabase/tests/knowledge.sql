begin;
select set_config('qa.admin',(select id::text from profiles where role='admin' and status='active' order by created_at,id limit 1),true);
select set_config('qa.member',(select id::text from profiles where role='team_member' and status='active' order by created_at,id limit 1),true);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('qa.admin'),true);
insert into public.knowledge_documents(title,content,category,status) values('[QA] Library permissions','Original content','company','draft') returning id;
select set_config('qa.doc',(select id::text from knowledge_documents where title='[QA] Library permissions'),true);
update public.knowledge_documents set content='Saved revision' where id=current_setting('qa.doc')::uuid and revision=1;
do $$ begin
 if not exists(select 1 from knowledge_revisions where document_id=current_setting('qa.doc')::uuid and content='Original content' and revision=1) then raise exception 'Original revision missing'; end if;
 update public.knowledge_documents set content='Stale overwrite' where id=current_setting('qa.doc')::uuid and revision=1;
 if found then raise exception 'Stale edit overwrote newer guide'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('qa.member'),true);
do $$ declare denied boolean:=false; begin
 if not exists(select 1 from knowledge_documents where id=current_setting('qa.doc')::uuid and content='Saved revision') then raise exception 'Member cannot read library'; end if;
 if not exists(select 1 from knowledge_revisions where document_id=current_setting('qa.doc')::uuid) then raise exception 'Member cannot read history'; end if;
 update public.knowledge_documents set content='Unauthorized overwrite' where id=current_setting('qa.doc')::uuid;
 if found then raise exception 'Member changed approved company guide'; end if;
 begin insert into public.knowledge_documents(title,content) values('Unauthorized','Unauthorized'); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Member published guide'; end if;
 if has_table_privilege('anon','public.knowledge_documents','select') or has_table_privilege('authenticated','public.knowledge_revisions','update') then raise exception 'Anonymous read or history edit exposed'; end if;
end $$;
select set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
do $$ begin if exists(select 1 from public.knowledge_documents) then raise exception 'Nonmember can read library'; end if; end $$;
rollback;
