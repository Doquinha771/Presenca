-- Presença+ 5.4 | Controle de armazenamento do banco (limite de 500 MB do plano gratuito).
-- Instalar APÓS 11_keepalive_supabase.sql, no SQL Editor do Supabase, como proprietário do banco.
--
-- O que faz:
--  * mede o tamanho do banco e de cada tabela;
--  * todos os dias verifica o uso; ao passar do limite configurado (padrão: 80% de 500 MB),
--    remove dados de quem não pertence mais à escola:
--      - alunos arquivados (concluíram, foram transferidos ou saíram) há mais de N dias (padrão 180);
--      - cadastros abandonados: nunca confirmados, sem matrícula e sem atrasos, há mais de N dias;
--      - convites da equipe vencidos/usados há mais de 30 dias;
--      - matrículas inativas sem aluno vinculado há mais de N dias;
--  * toda semana roda VACUUM para que o espaço liberado seja reaproveitado;
--  * a Direção acompanha o uso, vê uma prévia, ajusta as regras e pode liberar espaço na hora.
--
-- Nunca remove alunos ativos, alunos com renovação pendente nem contas da equipe.
-- Cada limpeza fica registrada em public.storage_cleanups e na auditoria (sem nomes).
begin;
set local lock_timeout='10s';
set local statement_timeout='300s';

create table if not exists public.storage_policy (
 id boolean primary key default true check(id),
 limit_mb integer not null default 500 check(limit_mb between 50 and 100000),
 trigger_percent integer not null default 80 check(trigger_percent between 50 and 95),
 grace_days integer not null default 180 check(grace_days between 30 and 3650),
 auto_enabled boolean not null default true,
 updated_at timestamptz not null default now(),
 updated_by uuid references public.profiles(id) on delete set null
);
insert into public.storage_policy(id) values(true) on conflict(id) do nothing;

create table if not exists public.storage_cleanups (
 id bigint generated always as identity primary key,
 ran_at timestamptz not null default now(),
 trigger text not null check(trigger in ('auto','manual')),
 actor_id uuid references public.profiles(id) on delete set null,
 size_before bigint not null,
 percent_before numeric(5,1) not null,
 students_removed integer not null default 0,
 events_removed integer not null default 0,
 other_removed integer not null default 0
);

alter table public.storage_policy enable row level security;
alter table public.storage_cleanups enable row level security;
revoke all on public.storage_policy, public.storage_cleanups from public, anon, authenticated;

-- Tamanho do banco e das tabelas do portal.
create or replace function private.storage_usage()
returns jsonb language sql stable security definer set search_path='' as $usage$
 select jsonb_build_object(
  'bytes', s.bytes,
  'limit_bytes', p.limit_mb::bigint*1024*1024,
  'percent', round(100.0*s.bytes/(p.limit_mb::numeric*1024*1024),1),
  'tables', (select coalesce(jsonb_agg(jsonb_build_object('name',t.relname,'bytes',t.bytes,'rows',t.rows) order by t.bytes desc),'[]'::jsonb)
             from (select c.relname, pg_catalog.pg_total_relation_size(c.oid) bytes, greatest(c.reltuples,0)::bigint rows
                   from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
                   where n.nspname='public' and c.relkind='r') t))
 from public.storage_policy p,
      (select pg_catalog.pg_database_size(pg_catalog.current_database()) bytes) s
 where p.id;
$usage$;

-- Alunos que podem ser removidos: só quem saiu da escola ou nunca concluiu o cadastro.
create or replace function private.storage_candidates(p_grace_days integer)
returns table(student_id uuid, reason text, since timestamptz)
language sql stable security definer set search_path='' as $cand$
 select p.id,
        case when p.archived_at is not null then coalesce(nullif(p.archive_reason,''),'Arquivado pela escola')
             else 'Cadastro nunca confirmado' end,
        coalesce(p.archived_at,p.created_at)
 from public.profiles p
 where p.role='aluno'
   and (
        (p.archived_at is not null and p.archived_at < now()-make_interval(days=>p_grace_days))
     or (p.archived_at is null and not p.verified and not p.enrollment_approved
         and p.created_at < now()-make_interval(days=>p_grace_days)
         and not exists(select 1 from public.attendance_events e where e.student_id=p.id))
   )
   and not exists(select 1 from public.academic_renewals r where r.student_id=p.id and r.status='pending');
$cand$;

-- Limpeza. p_dry_run=true só conta o que seria removido. p_force=true ignora o limite (uso manual).
create or replace function private.storage_cleanup(p_trigger text, p_actor uuid, p_dry_run boolean, p_force boolean)
returns jsonb language plpgsql security definer set search_path='' as $clean$
declare
 pol public.storage_policy; use jsonb; pct numeric; ids uuid[];
 n_events integer:=0; n_other integer:=0; n integer;
begin
 if p_trigger not in ('auto','manual') then raise exception 'Origem inválida' using errcode='22023'; end if;
 select * into pol from public.storage_policy where id;
 use:=private.storage_usage(); pct:=(use->>'percent')::numeric;
 select coalesce(array_agg(c.student_id),'{}') into ids from private.storage_candidates(pol.grace_days) c;

 if p_dry_run then
  return jsonb_build_object('dry_run',true,'usage',use,
   'students',cardinality(ids),
   'events',(select count(*) from public.attendance_events where student_id=any(ids)),
   'invites',(select count(*) from public.staff_invites where (used_at is not null or expires_at<now()) and created_at<now()-interval '30 days'),
   'orphan_enrollments',(select count(*) from public.school_enrollments where not active and profile_id is null and created_at<now()-make_interval(days=>pol.grace_days)));
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
 -- Remove o login (o perfil sai junto, em cascata) e qualquer perfil que tenha ficado sem login.
 delete from auth.users where id=any(ids);
 delete from public.profiles where id=any(ids);

 delete from public.staff_invites where (used_at is not null or expires_at<now()) and created_at<now()-interval '30 days';
 get diagnostics n=row_count; n_other:=n_other+n;
 delete from public.school_enrollments where not active and profile_id is null and created_at<now()-make_interval(days=>pol.grace_days);
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

-- Chamado pelo agendador todos os dias: só age acima do limite configurado.
create or replace function private.storage_guard()
returns jsonb language sql security definer set search_path='' as $guard$
 select private.storage_cleanup('auto',null,false,false);
$guard$;

-- Painel da Direção: status, prévia, regras e limpeza manual com confirmação.
create or replace function private.storage_manage(p_action text, p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $manage$
declare me public.profiles; v jsonb:=coalesce(p_args,'{}'::jsonb);
begin
 me:=private.require_portal();
 if me.role<>'admin' then raise exception 'Operação reservada à Direção' using errcode='42501'; end if;
 if p_action='status' then
  return jsonb_build_object(
   'usage',private.storage_usage(),
   'policy',(select to_jsonb(p)-'id'-'updated_by' from public.storage_policy p where p.id),
   'preview',private.storage_cleanup('manual',me.id,true,false),
   'history',(select coalesce(jsonb_agg(to_jsonb(c)-'id'-'actor_id' order by c.ran_at desc),'[]'::jsonb)
              from (select * from public.storage_cleanups order by ran_at desc limit 10) c));
 elsif p_action='run' then
  if coalesce(v->>'confirm','')<>'LIBERAR' then raise exception 'Digite LIBERAR para confirmar' using errcode='22023'; end if;
  return private.storage_cleanup('manual',me.id,false,true);
 elsif p_action='policy' then
  update public.storage_policy set
   limit_mb=coalesce(nullif(v->>'limit_mb','')::integer,limit_mb),
   trigger_percent=coalesce(nullif(v->>'trigger_percent','')::integer,trigger_percent),
   grace_days=coalesce(nullif(v->>'grace_days','')::integer,grace_days),
   auto_enabled=coalesce(nullif(v->>'auto_enabled','')::boolean,auto_enabled),
   updated_at=now(), updated_by=me.id
  where id;
  insert into public.audit_events(actor_id,action,detail) values(me.id,'STORAGE_POLICY',left(v::text,500));
  return (select to_jsonb(p)-'id'-'updated_by' from public.storage_policy p where p.id);
 end if;
 raise exception 'Ação desconhecida' using errcode='22023';
end;
$manage$;
create or replace function public.storage_manage(p_action text, p_args jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path='' as $wrap$
 select private.storage_manage(p_action,p_args);
$wrap$;

do $grants$
begin
 revoke all on function private.storage_usage(), private.storage_candidates(integer),
  private.storage_cleanup(text,uuid,boolean,boolean), private.storage_guard(),
  private.storage_manage(text,jsonb), public.storage_manage(text,jsonb) from public, anon, authenticated;
 grant execute on function private.storage_manage(text,jsonb), public.storage_manage(text,jsonb) to authenticated;
end;
$grants$;

-- Agendamentos (horário UTC): verificação diária às 06:30 (03:30 em Brasília)
-- e VACUUM semanal para reaproveitar o espaço das linhas removidas.
select cron.schedule('presenca_storage_guard','30 6 * * *','select private.storage_guard();');
select cron.schedule('presenca_storage_vacuum','0 7 * * 0','VACUUM (ANALYZE) public.attendance_events, public.audit_events, public.student_adjustments, public.profiles, public.school_enrollments, public.academic_renewals, public.staff_invites');

insert into public.portal_migrations(version) values('5.4.0') on conflict(version) do nothing;
commit;
