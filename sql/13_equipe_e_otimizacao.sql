-- Presença+ 5.5 | Aprovações da Direção, gestão da equipe e otimização do banco.
-- Instalar APÓS 12_armazenamento.sql, no SQL Editor do Supabase, como proprietário do banco.
--
-- Equipe e aprovações:
--  * quem é da escola e não tem convite pode criar a conta: fica sem acesso até a Direção aceitar;
--  * a Direção adiciona funcionários, cancela convites, aceita ou recusa pedidos e remove da equipe;
--  * remover tira o acesso na hora e preserva a autoria dos registros já feitos.
--
-- Banco abaixo de 500 MB:
--  * verificação a cada hora, com limpeza de registros técnicos (Auth, pg_cron) sempre ativa;
--  * auditoria antiga sai a partir de 60% de uso; dados de quem saiu da escola a partir de 80%;
--  * a partir de 90% o prazo de espera cai para 30 dias e a auditoria guarda só 1 ano (90 dias acima de 95%);
--  * índices parciais, fillfactor e autovacuum mais frequente nas tabelas que mais crescem.
--
-- Nunca remove alunos ativos, renovações pendentes nem a equipe. Cada limpeza fica registrada, sem nomes.
begin;
set local lock_timeout='10s';
set local statement_timeout='300s';

do $check$
begin
 if to_regclass('public.storage_policy') is null then
  raise exception 'Instale antes o arquivo 12_armazenamento.sql';
 end if;
end;
$check$;

-- ---------- Colunas novas ----------
alter table public.profiles
 add column if not exists staff_pending boolean not null default false,
 add column if not exists removed_at timestamptz;
alter table public.staff_invites add column if not exists full_name text check(full_name is null or char_length(full_name) between 3 and 120);
alter table public.storage_policy
 add column if not exists emergency_percent integer not null default 90 check(emergency_percent between 70 and 98),
 add column if not exists audit_days integer not null default 730 check(audit_days between 180 and 3650);
create index if not exists profiles_staff_pending_idx on public.profiles(created_at) where staff_pending;

-- ---------- Cadastro: pedido de acesso da equipe sem convite ----------
-- O pedido nasce inativo: is_staff, is_admin e require_portal exigem active, então a conta não vê nada até ser aceita.
create or replace function private.create_portal_profile()
returns trigger language plpgsql security definer set search_path=''
as $portal_profile$
declare
  inv public.staff_invites%rowtype;
  en public.school_enrollments%rowtype;
  cl public.school_classes%rowtype;
  email_normalized text:=lower(trim(coalesce(new.email,'')));
  claimed_name text:=trim(coalesce(new.raw_user_meta_data->>'full_name',''));
  student_ra text;
  authorized_limit integer;
begin
  select * into inv from public.staff_invites
    where email=email_normalized and used_at is null and expires_at>now()
    for update;
  if found then
    if length(claimed_name) not between 3 and 120 then
      claimed_name:=coalesce(inv.full_name,'Equipe institucional');
    end if;
    insert into public.profiles(id,full_name,role,verified)
      values(new.id,claimed_name,inv.role,new.email_confirmed_at is not null);
    update public.staff_invites set used_at=now(),used_by=new.id where id=inv.id;
    return new;
  end if;

  if email_normalized !~ '^[0-9]{7,16}(sp)?@al[.]educacao[.]sp[.]gov[.]br$' then
    if coalesce(new.raw_user_meta_data->>'staff_request','')='true' and length(claimed_name) between 3 and 120 then
      insert into public.profiles(id,full_name,role,verified,active,staff_pending)
        values(new.id,claimed_name,'secretaria',new.email_confirmed_at is not null,false,true);
      return new;
    end if;
    raise exception 'E-mail escolar inválido ou convite institucional inexistente' using errcode='22023';
  end if;

  student_ra:=split_part(email_normalized,'@',1);
  select * into en from public.school_enrollments
   where email=email_normalized and ra=student_ra
     and active and profile_id is null for update;
  if found then
    select * into cl from public.school_classes where id=en.class_id and active;
    if found then
      select default_limit into authorized_limit from public.school_settings where id=true;
      insert into public.profiles
        (id,ra,full_name,grade,birth_date,role,verified,late_limit,class_id,enrollment_approved)
      values
        (new.id,en.ra,en.full_name,cl.grade||' • '||cl.name,en.birth_date,'aluno',
         new.email_confirmed_at is not null,coalesce(authorized_limit,5),cl.id,true);
      update public.school_enrollments set profile_id=new.id where id=en.id;
      return new;
    end if;
  end if;

  if length(claimed_name) not between 3 and 120 then
    claimed_name:='Aluno aguardando cadastro';
  end if;
  insert into public.profiles
    (id,ra,full_name,grade,birth_date,role,verified,enrollment_approved)
  values
    (new.id,student_ra,claimed_name,null,null,'aluno',
     new.email_confirmed_at is not null,false);
  return new;
end;
$portal_profile$;

create or replace function public.portal_registration_status()
returns text language sql stable security definer set search_path='' as $status$
 select case when p.id is null then 'sem_perfil'
  when not p.verified then 'aguardando_email'
  when p.staff_pending then 'aguardando_direcao'
  when not p.active then 'inativo'
  when p.role='aluno' and not p.enrollment_approved then 'aguardando_instituicao'
  else 'liberado' end
 from (select auth.uid() as uid) u
 left join public.profiles p on p.id=u.uid
 where u.uid is not null;
$status$;
revoke all on function public.portal_registration_status() from public,anon,authenticated;
grant execute on function public.portal_registration_status() to authenticated;

-- ---------- Gestão da equipe e aprovações (somente Direção) ----------
create or replace function private.staff_manage(p_action text, p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $staff$
declare
 me public.profiles; target public.profiles; v jsonb:=coalesce(p_args,'{}'::jsonb);
 em text:=lower(trim(coalesce(v->>'email','')));
 nm text:=trim(coalesce(v->>'name',''));
 rl text:=coalesce(v->>'role','secretaria');
 why text:=trim(coalesce(v->>'reason',''));
 uid uuid:=nullif(v->>'user','')::uuid;
begin
 me:=private.require_portal();
 if me.role<>'admin' then raise exception 'Operação reservada à Direção' using errcode='42501'; end if;

 if p_action='counts' then
  return (select jsonb_build_object('total',
    (select count(*) from public.profiles p where p.role='aluno' and p.active and p.archived_at is null and not p.enrollment_approved and p.verified)
   +(select count(*) from public.profiles p where p.staff_pending and p.verified)));
 elsif p_action='list' then
  return jsonb_build_object(
   'members',(select coalesce(jsonb_agg(x order by x.full_name,x.id),'[]'::jsonb) from (
     select p.id,p.full_name,p.role,p.active,p.verified,u.email
     from public.profiles p join auth.users u on u.id=p.id
     where p.role in ('admin','secretaria') and not p.staff_pending and p.removed_at is null
     order by p.full_name,p.id limit 300) x),
   'invites',(select coalesce(jsonb_agg(x order by x.created_at desc),'[]'::jsonb) from (
     select i.id,i.email,i.full_name,i.role,i.expires_at,i.created_at
     from public.staff_invites i where i.used_at is null and i.expires_at>now()
     order by i.created_at desc limit 100) x),
   'requests',(select coalesce(jsonb_agg(x order by x.created_at),'[]'::jsonb) from (
     select p.id,p.full_name,u.email,p.created_at
     from public.profiles p join auth.users u on u.id=p.id
     where p.staff_pending and p.verified
     order by p.created_at limit 100) x));
 end if;

 -- Mesmo lock da troca de cargos: dois diretores não alteram a equipe ao mesmo tempo.
 perform pg_catalog.pg_advisory_xact_lock(21945,18);
 if not public.is_admin() then raise exception 'Permissão alterada. Entre novamente.' using errcode='42501'; end if;
 if rl not in ('secretaria','admin') then raise exception 'Cargo inválido' using errcode='22023'; end if;

 if p_action='create' then
  if em !~ '^[^@[:space:]]{1,90}@[^@[:space:]]{1,90}[.][^@[:space:]]{2,40}$' then raise exception 'Informe um e-mail válido' using errcode='22023'; end if;
  if em ~ '@al[.]educacao[.]sp[.]gov[.]br$' then raise exception 'Este é um e-mail de aluno' using errcode='22023'; end if;
  if length(nm) not between 3 and 120 then raise exception 'Informe o nome completo' using errcode='22023'; end if;
  select id into uid from auth.users where lower(email)=em;
  if uid is not null then
   select * into target from public.profiles where id=uid for update;
   if target.id is null or target.role='aluno' then raise exception 'Este e-mail já é usado por outra conta' using errcode='23505'; end if;
   if target.removed_at is not null then
    update public.profiles set removed_at=null,active=true,role=rl where id=uid;
    update auth.users set banned_until=null where id=uid;
    insert into public.audit_events(actor_id,action,subject_id,detail) values(me.id,'STAFF_RESTORE',uid,rl);
    return jsonb_build_object('restored',true);
   elsif target.staff_pending then
    update public.profiles set staff_pending=false,active=true,role=rl where id=uid;
    insert into public.audit_events(actor_id,action,subject_id,detail) values(me.id,'STAFF_ACCEPT',uid,rl);
    return jsonb_build_object('accepted',true);
   end if;
   raise exception 'Esta pessoa já faz parte da equipe' using errcode='23505';
  end if;
  insert into public.staff_invites(email,role,invited_by,full_name) values(em,rl,me.id,nm)
  on conflict(email) do update set role=excluded.role,invited_by=excluded.invited_by,full_name=excluded.full_name,
   expires_at=now()+interval '14 days',used_at=null,used_by=null;
  insert into public.audit_events(actor_id,action,detail) values(me.id,'STAFF_INVITE',rl);
  return jsonb_build_object('invited',true);

 elsif p_action='cancel_invite' then
  delete from public.staff_invites where id=(v->>'id')::uuid and used_at is null;
  if not found then raise exception 'Convite não encontrado' using errcode='P0002'; end if;
  insert into public.audit_events(actor_id,action) values(me.id,'STAFF_INVITE_CANCEL');
  return jsonb_build_object('cancelled',true);
 end if;

 select * into target from public.profiles where id=uid for update;
 if target.id is null then raise exception 'Conta não encontrada' using errcode='P0002'; end if;

 if p_action='accept' then
  if not target.staff_pending then raise exception 'Este pedido já foi analisado' using errcode='22023'; end if;
  if not target.verified then raise exception 'A pessoa ainda não confirmou o e-mail' using errcode='22023'; end if;
  update public.profiles set staff_pending=false,active=true,role=rl where id=uid;
  insert into public.audit_events(actor_id,action,subject_id,detail) values(me.id,'STAFF_ACCEPT',uid,rl);
  return jsonb_build_object('accepted',true);

 elsif p_action='reject' then
  if not target.staff_pending then raise exception 'Este pedido já foi analisado' using errcode='22023'; end if;
  delete from auth.users where id=uid;
  insert into public.audit_events(actor_id,action) values(me.id,'STAFF_REJECT');
  return jsonb_build_object('rejected',true);

 elsif p_action='reject_student' then
  if target.role<>'aluno' or target.enrollment_approved then raise exception 'Este aluno já tem matrícula' using errcode='22023'; end if;
  if exists(select 1 from public.attendance_events e where e.student_id=uid)
     or exists(select 1 from public.academic_renewals r where r.student_id=uid)
     or exists(select 1 from public.school_enrollments s where s.profile_id=uid) then
   raise exception 'Este aluno já tem histórico na escola. Use Arquivar.' using errcode='22023';
  end if;
  delete from auth.users where id=uid;
  insert into public.audit_events(actor_id,action) values(me.id,'STUDENT_REJECT');
  return jsonb_build_object('rejected',true);

 elsif p_action='remove' then
  if uid=me.id then raise exception 'Você não pode remover a própria conta' using errcode='22023'; end if;
  if target.role not in ('secretaria','admin') or target.removed_at is not null then raise exception 'Esta pessoa não está na equipe' using errcode='22023'; end if;
  if length(why) not between 5 and 500 then raise exception 'Informe o motivo (5 a 500 caracteres)' using errcode='22023'; end if;
  -- O perfil continua existindo para preservar a autoria dos registros; o acesso termina aqui.
  update public.profiles set active=false,removed_at=now() where id=uid;
  update auth.users set banned_until=now()+interval '100 years' where id=uid;
  delete from auth.sessions where user_id=uid;
  insert into public.audit_events(actor_id,action,subject_id,detail) values(me.id,'STAFF_REMOVE',uid,left(why,500));
  return jsonb_build_object('removed',true);

 elsif p_action='set_password' then
  if uid=me.id then raise exception 'Para trocar a própria senha, use Esqueci a senha' using errcode='22023'; end if;
  if target.role not in ('secretaria','admin') or target.removed_at is not null or target.staff_pending then raise exception 'Esta pessoa não está na equipe' using errcode='22023'; end if;
  if length(coalesce(v->>'password','')) not between 10 and 72 or (v->>'password') !~ '[A-Za-z]' or (v->>'password') !~ '[0-9]' then
   raise exception 'Use de 10 a 72 caracteres, com letras e números' using errcode='22023';
  end if;
  update auth.users set encrypted_password=extensions.crypt(v->>'password',extensions.gen_salt('bf',10)),updated_at=now() where id=uid;
  delete from auth.sessions where user_id=uid;
  insert into public.audit_events(actor_id,action,subject_id) values(me.id,'STAFF_PASSWORD',uid);
  return jsonb_build_object('changed',true);
 end if;

 raise exception 'Ação desconhecida' using errcode='22023';
end;
$staff$;
create or replace function public.staff_manage(p_action text, p_args jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path='' as $wrap$
 select private.staff_manage(p_action,p_args);
$wrap$;
revoke all on function private.staff_manage(text,jsonb), public.staff_manage(text,jsonb) from public, anon, authenticated;
grant execute on function private.staff_manage(text,jsonb), public.staff_manage(text,jsonb) to authenticated;

-- ---------- Faxina que roda sempre: registros técnicos que crescem sem ninguém ver ----------
create or replace function private.storage_housekeeping()
returns integer language plpgsql security definer set search_path='' as $house$
declare n integer:=0; c integer; q text;
begin
 foreach q in array array[
  'delete from cron.job_run_details where end_time<now()-interval ''7 days''',
  'delete from auth.audit_log_entries where created_at<now()-interval ''30 days''',
  'delete from auth.flow_state where created_at<now()-interval ''7 days''',
  'delete from auth.one_time_tokens where created_at<now()-interval ''14 days''',
  'delete from auth.refresh_tokens where revoked and updated_at<now()-interval ''30 days''',
  'delete from auth.sessions where coalesce(refreshed_at,updated_at,created_at)<now()-interval ''90 days'''
 ] loop
  -- Cada versão do Supabase tem colunas um pouco diferentes: o que não existir é ignorado.
  begin
   execute q; get diagnostics c=row_count; n:=n+c;
  exception when undefined_table or undefined_column or insufficient_privilege then null;
  end;
 end loop;
 -- Cadastros abandonados e pedidos de equipe parados não têm dados escolares.
 delete from auth.users u using public.profiles p
  where p.id=u.id and p.staff_pending and p.created_at<now()-interval '90 days';
 get diagnostics c=row_count; n:=n+c;
 delete from auth.users u using public.profiles p
  where p.id=u.id and not p.verified and p.created_at<now()-interval '30 days'
    and (p.staff_pending or (p.role='aluno' and not p.enrollment_approved
      and not exists(select 1 from public.attendance_events e where e.student_id=p.id)
      and not exists(select 1 from public.academic_renewals r where r.student_id=p.id)
      and not exists(select 1 from public.school_enrollments s where s.profile_id=p.id)));
 get diagnostics c=row_count; n:=n+c;
 delete from public.storage_cleanups where id not in (select id from public.storage_cleanups order by ran_at desc limit 100);
 return n;
end;
$house$;

-- ---------- Limpeza em níveis ----------
create or replace function private.storage_cleanup(p_trigger text, p_actor uuid, p_dry_run boolean, p_force boolean)
returns jsonb language plpgsql security definer set search_path='' as $clean$
declare
 pol public.storage_policy; use jsonb; pct numeric; ids uuid[]; grace integer; keep_audit integer;
 n_events integer:=0; n_other integer:=0; n integer;
begin
 if p_trigger not in ('auto','manual') then raise exception 'Origem inválida' using errcode='22023'; end if;
 select * into pol from public.storage_policy where id;
 use:=private.storage_usage(); pct:=(use->>'percent')::numeric;
 grace:=case when pct>=pol.emergency_percent then least(pol.grace_days,30) else pol.grace_days end;
 keep_audit:=case when pct>=95 then 90 when pct>=pol.emergency_percent then least(pol.audit_days,365) else pol.audit_days end;
 select coalesce(array_agg(c.student_id),'{}') into ids from private.storage_candidates(grace) c;

 if p_dry_run then
  return jsonb_build_object('dry_run',true,'usage',use,
   'students',cardinality(ids),
   'events',(select count(*) from public.attendance_events where student_id=any(ids)),
   'invites',(select count(*) from public.staff_invites where (used_at is not null or expires_at<now()) and created_at<now()-interval '30 days'),
   'orphan_enrollments',(select count(*) from public.school_enrollments where not active and profile_id is null and created_at<now()-make_interval(days=>grace)),
   'audit',(select count(*) from public.audit_events where created_at<now()-make_interval(days=>keep_audit)));
 end if;

 if not p_force and (not pol.auto_enabled or pct < pol.trigger_percent) then
  return jsonb_build_object('skipped',true,'usage',use);
 end if;

 -- Mesmo lock exclusivo do encerramento de período: nenhum registro novo entra durante a limpeza.
 perform pg_catalog.pg_advisory_xact_lock(21945,17);

 delete from public.student_adjustments
  where student_id=any(ids) or event_id in (select id from public.attendance_events where student_id=any(ids));
 delete from public.attendance_events where student_id=any(ids);
 get diagnostics n_events=row_count;
 delete from public.academic_renewals where student_id=any(ids);
 delete from public.school_enrollments where profile_id=any(ids);
 delete from auth.users where id=any(ids);
 delete from public.profiles where id=any(ids);

 delete from public.staff_invites where (used_at is not null or expires_at<now()) and created_at<now()-interval '30 days';
 get diagnostics n=row_count; n_other:=n_other+n;
 delete from public.school_enrollments where not active and profile_id is null and created_at<now()-make_interval(days=>grace);
 get diagnostics n=row_count; n_other:=n_other+n;
 delete from public.audit_events where created_at<now()-make_interval(days=>keep_audit);
 get diagnostics n=row_count; n_other:=n_other+n;

 insert into public.storage_cleanups(trigger,actor_id,size_before,percent_before,students_removed,events_removed,other_removed)
  values(p_trigger,p_actor,(use->>'bytes')::bigint,pct,cardinality(ids),n_events,n_other);
 insert into public.audit_events(actor_id,action,detail)
  values(p_actor,'STORAGE_CLEANUP',format('%s: %s alunos, %s atrasos e %s outros registros removidos (uso antes: %s%%)',
         p_trigger,cardinality(ids),n_events,n_other,pct));

 return jsonb_build_object('dry_run',false,'trigger',p_trigger,'percent_before',pct,
  'students',cardinality(ids),'events',n_events,'other',n_other);
end;
$clean$;

-- A cada hora: faxina técnica sempre, auditoria antiga a partir de 20 pontos antes do limite e limpeza completa no limite.
create or replace function private.storage_guard()
returns jsonb language plpgsql security definer set search_path='' as $guard$
declare pol public.storage_policy; pct numeric; cleaned integer;
begin
 cleaned:=private.storage_housekeeping();
 select * into pol from public.storage_policy where id;
 pct:=(private.storage_usage()->>'percent')::numeric;
 if pol.auto_enabled and pct>=pol.trigger_percent-20 then
  delete from public.audit_events where created_at<now()-make_interval(days=>pol.audit_days);
 end if;
 return private.storage_cleanup('auto',null,false,false)||jsonb_build_object('housekeeping',cleaned);
end;
$guard$;

revoke all on function private.storage_housekeeping(), private.storage_guard(), private.storage_cleanup(text,uuid,boolean,boolean) from public, anon, authenticated;

-- ---------- Menos espaço por registro ----------
-- Quase toda linha tem estas colunas vazias: o índice parcial guarda só as preenchidas.
create index if not exists attendance_changed_by_partial_idx on public.attendance_events(changed_by) where changed_by is not null;
drop index if exists public.attendance_events_changed_by_idx;
create index if not exists adjustments_event_partial_idx on public.student_adjustments(event_id) where event_id is not null;
drop index if exists public.student_adjustments_event_id_idx;

-- A contagem de atrasos atualiza o perfil o tempo todo: sobra de espaço na página evita inchaço.
alter table public.profiles set (fillfactor=85, autovacuum_vacuum_scale_factor=0.05, autovacuum_analyze_scale_factor=0.05);
alter table public.attendance_events set (autovacuum_vacuum_scale_factor=0.05, autovacuum_analyze_scale_factor=0.05);
alter table public.audit_events set (autovacuum_vacuum_scale_factor=0.05, autovacuum_analyze_scale_factor=0.05);

-- Verificação a cada hora e VACUUM diário, para o espaço liberado voltar a ser usado.
select cron.schedule('presenca_storage_guard','17 * * * *','select private.storage_guard();');
select cron.schedule('presenca_storage_vacuum','0 7 * * *','VACUUM (ANALYZE) public.attendance_events, public.audit_events, public.student_adjustments, public.profiles, public.school_enrollments, public.academic_renewals, public.staff_invites, public.storage_cleanups');

-- ---------- Segurança: visitantes sem login não executam nenhuma função do portal ----------
do $harden$
declare r record;
begin
 for r in select p.oid, p.oid::regprocedure as sig from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
          where n.nspname='public' and p.prokind='f' and p.proname<>'project_keepalive'
            and not exists(select 1 from pg_catalog.pg_depend d where d.objid=p.oid and d.deptype='e')
 loop
  if pg_catalog.has_function_privilege('authenticated',r.oid,'execute') then
   execute format('grant execute on function %s to authenticated',r.sig);
  end if;
  execute format('revoke all on function %s from public, anon',r.sig);
 end loop;
end;
$harden$;

select private.storage_housekeeping();
insert into public.portal_migrations(version) values('5.5.0') on conflict(version) do nothing;
commit;
