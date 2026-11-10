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
