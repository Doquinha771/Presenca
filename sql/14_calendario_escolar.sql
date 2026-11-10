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
