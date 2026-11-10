-- Presença+ | Instalação das atualizações pendentes do banco (10 a 14), na ordem certa.
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em Run, como proprietário do banco.
-- Cada parte roda em bloco: se uma falhar, nada dela é aplicado. Rodar de novo não duplica nada.
-- Arquivo gerado por scripts/gerar-instalacao.mjs a partir de sql/10 a sql/14. Não edite à mão.

-- As tarefas automáticas (virada do ano e limpeza do banco) usam o agendador pg_cron do Supabase.
create extension if not exists pg_cron with schema pg_catalog;

-- ===================== sql/10_virada_ano_letivo.sql =====================
-- Presença+ 5.3 | Virada de ano letivo. Instalar APÓS 09_autocadastro_fichas_e_turmas.sql.
-- Aditiva: não encerra o ano atual nem altera alunos ao instalar.
-- Apenas a Direção agenda datas; pg_cron executa encerramento/abertura na data escolar.
begin;
set local lock_timeout='10s';
set local statement_timeout='120s';

create table if not exists public.academic_years (
 year integer primary key check(year between 2020 and 2100),
 opens_on date not null,
 closes_on date,
 status text not null check(status in ('planned','open','closed')),
 opened_at timestamptz,
 closed_at timestamptz,
 configured_by uuid references public.profiles(id),
 check(closes_on is null or closes_on >= opens_on)
);
create unique index if not exists academic_one_open_year on public.academic_years(status) where status='open';
create table if not exists public.academic_renewals (
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references public.profiles(id),
 year integer not null references public.academic_years(year),
 previous_year integer not null,
 previous_grade text not null,
 previous_class_name text not null,
 previous_class_id uuid references public.school_classes(id),
 status text not null default 'pending' check(status in ('pending','active','completed','transferred')),
 outcome text check(outcome in ('approved','reproved','completed','transferred')),
 destination_class_id uuid references public.school_classes(id),
 destination_grade text,
 destination_class_name text,
 reviewed_by uuid references public.profiles(id),
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 unique(student_id,year),
 check((status='pending' and outcome is null and destination_class_id is null and reviewed_at is null)
    or (status='active' and outcome in ('approved','reproved') and destination_class_id is not null and destination_grade is not null and destination_class_name is not null and reviewed_at is not null)
    or (status in ('completed','transferred') and outcome=status and destination_class_id is null and reviewed_at is not null))
);
create index if not exists academic_renewals_queue_idx on public.academic_renewals(year,status,created_at,id);
create index if not exists academic_renewals_student_idx on public.academic_renewals(student_id,year desc);
alter table public.academic_years enable row level security;
alter table public.academic_renewals enable row level security;
revoke all on public.academic_years,public.academic_renewals from public,anon,authenticated;

-- Registra o ano já em curso sem atribuir uma data de abertura retrospectiva à escola.
insert into public.academic_years(year,opens_on,status,opened_at)
select extract(year from now() at time zone 'America/Sao_Paulo')::integer,
       (now() at time zone 'America/Sao_Paulo')::date,'open',now()
where not exists (select 1 from public.academic_years);

create or replace function private.academic_year_current()
returns integer language sql stable security definer set search_path='' as $current$
 select year from public.academic_years where status='open' order by year desc limit 1;
$current$;
create or replace function private.academic_year_destination()
returns integer language sql stable security definer set search_path='' as $destination$
 select year from public.academic_years where status in ('planned','open') order by year desc limit 1;
$destination$;

-- Identificação deliberadamente restrita: EJA e série ambígua exigem revisão manual
-- antes da movimentação; nunca avançar aluno para turma por aproximação textual.
create or replace function private.academic_grade_key(p_grade text)
returns text language plpgsql immutable security invoker set search_path='' as $grade$
declare m text[]; level text; raw text:=lower(coalesce(p_grade,''));
begin
 if raw ~ 'eja|educa[cç][aã]o de jovens' then return null; end if;
 m:=regexp_match(raw,'^\s*([1-9])\s*(?:º|°|ª|a|o)?\s*(?:ano|s[ée]rie)');
 if m is null then return null; end if;
 if raw ~ 'm[ée]dio|ensino m[ée]dio' then level:='medio';
 elsif raw ~ 'fundamental' then level:='fundamental';
 else return null; end if;
 if level='medio' and m[1]::integer>3 then return null; end if;
 return level||':'||m[1];
end;
$grade$;

create or replace function private.academic_prepare(p_from integer,p_to integer)
returns void language plpgsql security definer set search_path='' as $prepare$
begin
 -- Chamado exclusivamente pela rotina interna, nunca pela API pública.
 insert into public.academic_renewals(student_id,year,previous_year,previous_grade,previous_class_name,previous_class_id)
 select p.id,p_to,p_from,coalesce(c.grade,p.grade,'Série não identificada'),coalesce(c.name,'Turma não identificada'),c.id
 from public.profiles p left join public.school_classes c on c.id=p.class_id
 join public.school_enrollments e on e.profile_id=p.id and e.active
 where p.role='aluno' and p.active and p.archived_at is null and p.enrollment_approved
 on conflict(student_id,year) do nothing;
 -- Também encerra matrículas oficiais de alunos que ainda não criaram conta.
 -- Senão um cadastro novo no próximo ano poderia herdar matrícula vencida.
 update public.school_enrollments set active=false where active;
 update public.profiles p set enrollment_approved=false
 from public.academic_renewals r
 where r.student_id=p.id and r.year=p_to and r.status='pending';
 insert into public.audit_events(action,detail)
 values('ACADEMIC_YEAR_CLOSED','Ano '||p_from||' encerrado; renovações criadas para '||p_to);
end;
$prepare$;

create or replace function private.academic_process_due()
returns void language plpgsql security definer set search_path='' as $due$
declare v_today date:=(now() at time zone 'America/Sao_Paulo')::date;
        v_open integer; v_next integer; v_close date; v_open_date date;
begin
 perform pg_catalog.pg_advisory_xact_lock(21945,24);
 select year,closes_on into v_open,v_close from public.academic_years where status='open' for update;
 select year,opens_on into v_next,v_open_date from public.academic_years where status='planned' order by year limit 1 for update;
 if v_next is null then return; end if;
 if v_open is not null and v_next<>v_open+1 then raise exception 'Sequência de anos letivos inválida'; end if;
 if v_open is not null and v_close is not null and v_close<=v_today then
   -- Mesmo lock dos cadastros oficiais e registros de atraso.
   perform pg_catalog.pg_advisory_xact_lock(21945,17);
   perform private.academic_prepare(v_open,v_next);
   update public.academic_years set status='closed',closed_at=now() where year=v_open;
   v_open:=null;
 end if;
 if v_open is null and v_open_date<=v_today then
   update public.academic_years set status='open',opened_at=now() where year=v_next;
   insert into public.audit_events(action,detail) values('ACADEMIC_YEAR_OPENED','Ano '||v_next||' aberto');
 end if;
end;
$due$;

create or replace function private.academic_require_staff()
returns public.profiles language plpgsql stable security definer set search_path='' as $staff$
declare me public.profiles;
begin
 me:=private.require_portal();
 if me.role not in ('admin','secretaria') then raise exception 'Acesso restrito à equipe' using errcode='42501'; end if;
 return me;
end;
$staff$;

create or replace function private.academic_portal_state()
returns jsonb language plpgsql stable security definer set search_path='' as $state$
declare me public.profiles; v_year integer; v_status text; v_row public.academic_renewals;
begin
 select * into me from public.profiles where id=auth.uid();
 if me.id is null or not me.active or not me.verified or me.archived_at is not null then
  raise exception 'Sessão não autorizada' using errcode='42501';
 end if;
 select year,status into v_year,v_status from public.academic_years
 where status in ('open','planned') order by year desc limit 1;
 if me.role<>'aluno' then return jsonb_build_object('year',v_year,'year_status',coalesce(v_status,'closed'),'pending',false,
 'current_year',(select year from public.academic_years where status='open' limit 1),
 'closes_on',(select closes_on from public.academic_years where status='open' limit 1),
 'opens_on',(select opens_on from public.academic_years where status='planned' order by year limit 1)); end if;
 select * into v_row from public.academic_renewals r where r.student_id=me.id and r.status='pending'
 order by r.year desc limit 1;
 return jsonb_build_object('year',coalesce(v_row.year,v_year),'year_status',coalesce(v_status,'closed'),
   'pending',v_row.id is not null,'previous_year',v_row.previous_year,
   'previous_grade',v_row.previous_grade,'previous_class_name',v_row.previous_class_name,
   'registration_pending',not me.enrollment_approved and v_row.id is null);
end;
$state$;

create or replace function public.academic_portal_state()
returns jsonb language sql stable security invoker set search_path='' as $wrap_state$
 select private.academic_portal_state();
$wrap_state$;

create or replace function private.academic_renewals_list(p_status text,p_offset integer,p_search text)
returns jsonb language plpgsql stable security definer set search_path='' as $list$
declare me public.profiles; dest integer; search_term text:=lower(trim(coalesce(p_search,'')));
begin
 me:=private.academic_require_staff();
 if p_status not in ('pending','active','completed','transferred','all')
   or p_offset<0 or p_offset>10000 or length(search_term)>100 then raise exception 'Filtro inválido' using errcode='22023'; end if;
 select year into dest from public.academic_years where status in ('planned','open') order by year desc limit 1;
 return jsonb_build_object('year',dest,'year_status',(select status from public.academic_years where year=dest),
  'pending_count',(select count(*) from public.academic_renewals where year=dest and status='pending'),
  'active_count',(select count(*) from public.academic_renewals where year=dest and status='active'),
  'completed_count',(select count(*) from public.academic_renewals where year=dest and status='completed'),
  'transferred_count',(select count(*) from public.academic_renewals where year=dest and status='transferred'),
  'rows',coalesce((select jsonb_agg(x) from (
    select r.id,r.student_id,r.year,r.previous_year,r.previous_grade,r.previous_class_name,
     r.status,r.outcome,r.destination_class_id,r.destination_grade,r.destination_class_name as destination_class,p.full_name,p.ra
    from public.academic_renewals r join public.profiles p on p.id=r.student_id
    where r.year=dest and (p_status='all' or r.status=p_status)
      and (search_term='' or position(search_term in lower(p.full_name))>0 or position(search_term in lower(p.ra))>0)
    order by r.created_at,r.id limit 25 offset p_offset
  ) x),'[]'::jsonb));
end;
$list$;
create or replace function public.academic_renewals_list(p_status text default 'pending',p_offset integer default 0,p_search text default '')
returns jsonb language sql stable security invoker set search_path='' as $wrap_list$
 select private.academic_renewals_list(p_status,p_offset,p_search);
$wrap_list$;

create or replace function private.academic_manage(p_action text,p_args jsonb)
returns jsonb language plpgsql security definer set search_path='' as $manage$
declare me public.profiles; yr public.academic_years; r public.academic_renewals; dest public.school_classes;
 v_now date:=(now() at time zone 'America/Sao_Paulo')::date;
 v_close date; v_open date; v_year integer; v_outcome text; source_key text; target_key text; n integer;
begin
 me:=private.academic_require_staff();
 perform pg_catalog.pg_advisory_xact_lock(21945,24);
 if p_action='configure' then
  if me.role<>'admin' then raise exception 'Apenas a Direção pode configurar o calendário' using errcode='42501';end if;
  v_year:=(p_args->>'year')::integer; v_close:=(p_args->>'close')::date; v_open:=(p_args->>'open')::date;
  select * into yr from public.academic_years where status='open' for update;
  if yr.year is null or v_year<>yr.year+1 or v_close<v_now or v_open<v_close or v_open>v_close+interval '365 days'
    or exists(select 1 from public.academic_years where status='planned' and year<>v_year)
    or exists(select 1 from public.academic_years where year=v_year and status<>'planned') then
    raise exception 'Configure apenas o próximo ano, com encerramento a partir de hoje e abertura após o encerramento' using errcode='22023';
  end if;
  -- Não permite reagendar depois de criar renovações pendentes ou encerrar o ano.
  if exists(select 1 from public.academic_renewals where year=v_year) then raise exception 'O processamento do ano já começou' using errcode='22023';end if;
  if exists(select 1 from public.academic_renewals where year=yr.year and status='pending') then raise exception 'Resolva as renovações pendentes do ano atual antes de agendar o próximo' using errcode='22023';end if;
  update public.academic_years set closes_on=v_close where year=yr.year;
  insert into public.academic_years(year,opens_on,status,configured_by) values(v_year,v_open,'planned',me.id)
    on conflict(year) do update set opens_on=excluded.opens_on,configured_by=excluded.configured_by;
  insert into public.audit_events(actor_id,action,detail) values(me.id,'ACADEMIC_YEAR_CONFIGURED',v_year||': encerra '||v_close||', abre '||v_open);
  return jsonb_build_object('year',v_year,'closes_on',v_close,'opens_on',v_open);
 elsif p_action='process_due' then
  if me.role<>'admin' then raise exception 'Apenas a Direção pode processar o calendário' using errcode='42501';end if;
  perform private.academic_process_due();
  return jsonb_build_object('processed',true);
 elsif p_action='renew' then
  v_outcome:=p_args->>'outcome';
  select * into r from public.academic_renewals where id=(p_args->>'id')::uuid for update;
  if not found or r.status<>'pending' then raise exception 'Renovação inexistente ou já processada' using errcode='22023'; end if;
  select * into yr from public.academic_years where year=r.year;
  if yr.status<>'open' then raise exception 'O novo ano letivo ainda não foi aberto' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(21945,17);
  if v_outcome in ('approved','reproved') then
   select * into dest from public.school_classes where id=(p_args->>'class')::uuid and active for update;
   if not found then raise exception 'Selecione uma turma ativa de destino' using errcode='22023';end if;
   source_key:=private.academic_grade_key(r.previous_grade);
   target_key:=private.academic_grade_key(dest.grade);
   if source_key is null or target_key is null then raise exception 'Série não reconhecida: a Direção precisa padronizar os nomes das séries antes da renovação' using errcode='22023';end if;
   if v_outcome='reproved' and source_key<>target_key then raise exception 'Reprovado deve permanecer na mesma série' using errcode='22023'; end if;
   if v_outcome='approved' then
    if source_key='medio:3' then raise exception 'Para a última série do ensino médio, utilize Concluiu o ensino médio' using errcode='22023';end if;
    if source_key='fundamental:9' and target_key<>'medio:1' then raise exception 'Aprovado no 9º ano deve ir para o 1º ano do ensino médio' using errcode='22023';end if;
    if source_key<>'fundamental:9' and (split_part(target_key,':',1)<>split_part(source_key,':',1)
       or split_part(target_key,':',2)::integer<>split_part(source_key,':',2)::integer+1) then
      raise exception 'A série de destino não corresponde à progressão de um ano' using errcode='22023';end if;
   end if;
   -- A matrícula anual ocupa uma única linha operacional; o histórico permanece no registro de renovação.
   update public.school_enrollments e set class_id=dest.id,active=true
     where e.profile_id=r.student_id;
   if not found then raise exception 'Matrícula escolar não encontrada' using errcode='22023';end if;
   update public.profiles set class_id=dest.id,grade=dest.grade||' • '||dest.name,
     enrollment_approved=true,active=true,archived_at=null,archive_reason=null,
     count_from=clock_timestamp(),baseline_count=0,late_count=0,unjustified_count=0,
     late_limit=(select default_limit from public.school_settings where id),blocked=false
     where id=r.student_id;
   update public.academic_renewals set status='active',outcome=v_outcome,destination_class_id=dest.id,destination_grade=dest.grade,destination_class_name=dest.name,
     reviewed_by=me.id,reviewed_at=now() where id=r.id;
  elsif v_outcome in ('completed','transferred') then
   if v_outcome='completed' and private.academic_grade_key(r.previous_grade)<>'medio:3' then
     raise exception 'Conclusão do ensino médio exige matrícula anterior na 3ª série do ensino médio' using errcode='22023';
   end if;
   update public.school_enrollments set active=false where profile_id=r.student_id;
   update public.profiles set active=false,enrollment_approved=false,archived_at=now(),
     archive_reason=case when v_outcome='completed' then 'Conclusão do ensino médio em '||r.year else 'Transferência/saída em '||r.year end
     where id=r.student_id;
   update public.academic_renewals set status=v_outcome,outcome=v_outcome,reviewed_by=me.id,reviewed_at=now() where id=r.id;
  else raise exception 'Situação escolar inválida' using errcode='22023';end if;
  insert into public.audit_events(actor_id,action,subject_id,detail)
     values(me.id,'ACADEMIC_RENEWAL',r.student_id,r.year||': '||v_outcome||coalesce(' / turma '||dest.id::text,''));
  return jsonb_build_object('year',r.year,'status',case when v_outcome in ('approved','reproved') then 'active' else v_outcome end);
 end if;
 raise exception 'Ação desconhecida' using errcode='22023';
end;
$manage$;
create or replace function public.academic_manage(p_action text,p_args jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path='' as $wrap_manage$
 select private.academic_manage(p_action,p_args);
$wrap_manage$;

-- Aluno em renovação pode ler o próprio perfil e histórico. Pré-cadastro espontâneo continua aguardando matrícula.
create or replace function private.require_portal()
returns public.profiles language plpgsql stable security definer set search_path='' as $require$
declare me public.profiles;
begin
 select * into me from public.profiles where id=auth.uid();
 if auth.uid() is null or me.id is null or not me.verified or not me.active or me.archived_at is not null then
  raise exception 'Sessão sem acesso autorizado' using errcode='42501';end if;
 if me.role='aluno' and not me.enrollment_approved
   and not exists(select 1 from public.academic_renewals r where r.student_id=me.id and r.status='pending') then
  raise exception 'Matrícula aguardando autorização da instituição' using errcode='42501';end if;
 return me;
end;
$require$;

-- Faz o isolamento de acesso também no servidor, não apenas na tela do navegador.
do $guard$
declare definition text; needle text;
begin
 select pg_get_functiondef('private.portal_read(text,jsonb)'::regprocedure) into definition;
 needle:='me:=private.require_portal();';
 if position(needle in definition)=0 then raise exception 'Versão inesperada de portal_read: não aplicada';end if;
 if position('Matrícula pendente de renovação: funções escolares temporariamente indisponíveis' in definition)=0 then
 definition:=replace(definition,needle,needle||E'\n if me.role=''aluno'' and not me.enrollment_approved and p_kind not in (''me'',''history'') then raise exception ''Matrícula pendente de renovação: funções escolares temporariamente indisponíveis'' using errcode=''42501''; end if;');
 execute definition;
 end if;
 select pg_get_functiondef('private.portal_write(text,jsonb)'::regprocedure) into definition;
 needle:='if p_action=''record'' then';
 if position(needle in definition)=0 then raise exception 'Versão inesperada de portal_write: não aplicada';end if;
 if position('Use o fluxo de renovação anual para esta matrícula' in definition)=0 then
 definition:=replace(definition,needle,E'if p_action=''record'' and not exists(select 1 from public.academic_years where status=''open'') then raise exception ''Ano letivo encerrado'' using errcode=''42501''; end if;\n if p_action in (''enrollment'',''approve'') and not exists(select 1 from public.academic_years where status=''open'') then raise exception ''Aguarde a abertura do novo ano letivo para confirmar matrículas'' using errcode=''42501''; end if;
 if p_action in (''enrollment'',''approve'') and exists (select 1 from public.academic_renewals r join public.profiles p on p.id=r.student_id left join public.school_enrollments e on e.profile_id=p.id where r.status=''pending'' and (p.id::text=coalesce(p_args->>''student'','''') or p.ra=coalesce(p_args->>''ra'','''') or e.id::text=coalesce(p_args->>''id'','''') or e.email=lower(coalesce(p_args->>''email'','''')))) then raise exception ''Use o fluxo de renovação anual para esta matrícula'' using errcode=''42501''; end if;\n '||needle);
 execute definition;
 end if;
end;
$guard$;

-- São funções chamadas pelo frontend, protegidas por identidade real em public.profiles.
do $grants$
begin
 revoke all on function private.academic_year_current(),private.academic_year_destination(),private.academic_grade_key(text),
 private.academic_prepare(integer,integer),private.academic_process_due(),private.academic_portal_state(),
 private.academic_renewals_list(text,integer,text),private.academic_manage(text,jsonb),private.academic_require_staff()
 from public,anon,authenticated;
 revoke all on function public.academic_portal_state(),public.academic_renewals_list(text,integer,text),public.academic_manage(text,jsonb)
 from public,anon,authenticated;
 grant execute on function private.academic_portal_state(),private.academic_renewals_list(text,integer,text),private.academic_manage(text,jsonb) to authenticated;
 grant execute on function public.academic_portal_state(),public.academic_renewals_list(text,integer,text),public.academic_manage(text,jsonb) to authenticated;
end;
$grants$;

-- Execução idempotente e diária por hora: só age quando as datas configuradas chegarem.
-- Não cria nem agenda 2027 por conta própria.
select cron.schedule('presenca_academic_rollover','0 * * * *','select private.academic_process_due();');
commit;

-- ===================== sql/11_keepalive_supabase.sql =====================
-- Presença+ 5.3.1 — consulta mínima de atividade para evitar pausa por inatividade.
-- Não lê, altera nem expõe dados escolares.
create or replace function public.project_keepalive()
returns timestamptz
language sql
volatile
security invoker
set search_path = ''
as $$
  select pg_catalog.clock_timestamp();
$$;

revoke all on function public.project_keepalive() from public, anon, authenticated;
grant execute on function public.project_keepalive() to anon, authenticated;

-- ===================== sql/12_armazenamento.sql =====================
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

-- ===================== sql/13_equipe_e_otimizacao.sql =====================
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

-- ===================== sql/14_calendario_escolar.sql =====================
-- Presença+ 5.0.1 | Calendário escolar: feriados, recessos e férias.
-- Instalar APÓS 13_equipe_e_otimizacao.sql, no SQL Editor do Supabase, como proprietário do banco.
--
-- O que faz:
--  * guarda os dias sem aula da escola (feriado, recesso ou férias);
--  * a Direção cadastra e remove dias ou períodos inteiros;
--  * toda a equipe e os alunos podem consultar (a sequência sem atraso e os relatórios ignoram esses dias).
-- Pode rodar mais de uma vez: nada é duplicado.
begin;
set local lock_timeout='10s';
set local statement_timeout='120s';

do $check$
begin
 if to_regprocedure('private.staff_manage(text,jsonb)') is null then
  raise exception 'Instale antes o arquivo 13_equipe_e_otimizacao.sql';
 end if;
end;
$check$;

create table if not exists public.school_calendar_days (
 day date primary key,
 kind text not null check(kind in ('feriado','recesso','ferias')),
 label text not null check(char_length(label) between 2 and 80),
 created_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now()
);
alter table public.school_calendar_days enable row level security;
revoke all on public.school_calendar_days from public, anon, authenticated;

create or replace function private.calendar_manage(p_action text, p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $cal$
declare
 me public.profiles; v jsonb:=coalesce(p_args,'{}'::jsonb);
 d_from date; d_to date; n integer:=0;
 k text:=coalesce(v->>'kind','feriado');
 lb text:=trim(coalesce(v->>'label',''));
 yr integer:=coalesce(nullif(v->>'year','')::integer, extract(year from (now() at time zone 'America/Sao_Paulo'))::integer);
begin
 me:=private.require_portal();

 if p_action='list' then
  return coalesce((select jsonb_agg(jsonb_build_object('day',c.day,'kind',c.kind,'label',c.label) order by c.day)
   from public.school_calendar_days c where c.day between make_date(yr-1,12,1) and make_date(yr+1,1,31)),'[]'::jsonb);
 end if;

 if me.role<>'admin' then raise exception 'Somente a Direção altera o calendário escolar' using errcode='42501'; end if;
 d_from:=nullif(v->>'from','')::date;
 d_to:=coalesce(nullif(v->>'to','')::date,d_from);
 if d_from is null then raise exception 'Informe a data' using errcode='22023'; end if;
 if d_to<d_from then raise exception 'A data final vem antes da inicial' using errcode='22023'; end if;
 if d_to-d_from>120 then raise exception 'Use períodos de até 120 dias' using errcode='22023'; end if;

 if p_action='add' then
  if k not in ('feriado','recesso','ferias') then raise exception 'Tipo inválido' using errcode='22023'; end if;
  if char_length(lb) not between 2 and 80 then raise exception 'Escreva um nome de 2 a 80 letras' using errcode='22023'; end if;
  insert into public.school_calendar_days(day,kind,label,created_by)
   select g::date,k,lb,me.id from generate_series(d_from,d_to,interval '1 day') g
   on conflict(day) do update set kind=excluded.kind,label=excluded.label,created_by=excluded.created_by,created_at=now();
  get diagnostics n=row_count;
  insert into public.audit_events(actor_id,action,detail) values(me.id,'CALENDAR_ADD',left(format('%s a %s: %s (%s)',d_from,d_to,lb,k),500));
  return jsonb_build_object('saved',n);
 elsif p_action='remove' then
  delete from public.school_calendar_days where day between d_from and d_to;
  get diagnostics n=row_count;
  insert into public.audit_events(actor_id,action,detail) values(me.id,'CALENDAR_REMOVE',left(format('%s a %s',d_from,d_to),500));
  return jsonb_build_object('removed',n);
 end if;
 raise exception 'Ação desconhecida' using errcode='22023';
end;
$cal$;

create or replace function public.calendar_manage(p_action text, p_args jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path='' as $wrap$
 select private.calendar_manage(p_action,p_args);
$wrap$;
revoke all on function private.calendar_manage(text,jsonb), public.calendar_manage(text,jsonb) from public, anon, authenticated;
grant execute on function private.calendar_manage(text,jsonb), public.calendar_manage(text,jsonb) to authenticated;

insert into public.portal_migrations(version) values('5.0.1-calendario') on conflict(version) do nothing;
commit;
