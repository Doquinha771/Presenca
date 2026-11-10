-- Presença+ 5.2 · Executar no SQL Editor do mesmo projeto Supabase, após 05_v4_1_2.sql.
-- Migração aditiva: não altera/exclui registros existentes nem substitui portal_read.
-- Somente usuários autenticados e habilitados da Secretaria/Direção recebem linhas individuais.
begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';

create or replace function public.portal_export(p_kind text, p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  me public.profiles;
  v_class uuid := nullif(p_args->>'class','')::uuid;
  v_grade text := nullif(trim(coalesce(p_args->>'grade','')),'');
  v_from date := nullif(p_args->>'from','')::date;
  v_to date := nullif(p_args->>'to','')::date;
  v_status text := coalesce(p_args->>'status','');
  v_scope text := coalesce(p_args->>'scope','active');
  v_offset integer := coalesce((p_args->>'offset')::integer,0);
  v_limit integer := 200;
  result jsonb;
begin
  me := private.require_portal();
  if me.role not in ('admin','secretaria') then
    raise exception 'Exportação restrita à equipe institucional' using errcode='42501';
  end if;
  if p_kind not in ('students','history','enrollments') then
    raise exception 'Tipo de relatório inválido' using errcode='22023';
  end if;
  if v_grade is not null and length(v_grade)>70 then raise exception 'Série inválida' using errcode='22023';end if;
  if v_from is not null and v_to is not null and v_from>v_to then raise exception 'Intervalo de datas inválido' using errcode='22023';end if;
  if v_offset<0 or v_offset>10000 or v_offset%v_limit<>0 then
    raise exception 'Limite de exportação atingido. Filtre por série, turma ou período.' using errcode='22023';
  end if;
  if p_kind='students' then
    if v_scope not in ('active','archived','all') then raise exception 'Escopo inválido' using errcode='22023';end if;
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (
      select p.full_name as name,p.ra,coalesce(c.grade,p.grade,'') as grade,coalesce(c.name,'') as class_name,
             p.unjustified_count as active_count,p.late_limit,
             case when p.archived_at is not null then 'Arquivado'
                  when not p.enrollment_approved then 'Matrícula pendente'
                  when p.blocked then 'Limite atingido' else 'Regular' end as situation
      from public.profiles p left join public.school_classes c on c.id=p.class_id
      where p.role='aluno' and (v_scope='all' or (v_scope='active' and p.archived_at is null) or (v_scope='archived' and p.archived_at is not null))
        and (v_class is null or p.class_id=v_class)
        and (v_grade is null or coalesce(c.grade,p.grade)=v_grade)
      order by p.full_name,p.id limit v_limit offset v_offset
    ) x;
  elsif p_kind='enrollments' then
    if v_scope not in ('active','inactive','all') then raise exception 'Escopo inválido' using errcode='22023';end if;
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (
      select e.full_name as name,e.ra,e.email,c.grade,c.name as class_name,
             case when not e.active then 'Inativa' when e.profile_id is not null then 'Conta vinculada' else 'Aguardando acesso' end as situation,
             (e.created_at at time zone 'America/Sao_Paulo')::date::text as created_on
      from public.school_enrollments e join public.school_classes c on c.id=e.class_id
      where (v_scope='all' or (v_scope='active' and e.active) or (v_scope='inactive' and not e.active))
        and (v_class is null or e.class_id=v_class) and (v_grade is null or c.grade=v_grade)
      order by e.full_name,e.id limit v_limit offset v_offset
    ) x;
  else
    if v_status not in ('','active','forgiven','void') then raise exception 'Situação inválida' using errcode='22023';end if;
    select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (
      select (e.occurred_at at time zone 'America/Sao_Paulo')::timestamp::text as occurred_on,
             p.full_name as name,p.ra,coalesce(c.grade,p.grade,'') as grade,coalesce(c.name,'') as class_name,
             case e.status when 'active' then 'Válido' when 'forgiven' then 'Perdoado' when 'void' then 'Anulado' else e.status end as situation,
             case when e.justified then 'Sim' else 'Não' end as justified
      from public.attendance_events e join public.profiles p on p.id=e.student_id
        left join public.school_classes c on c.id=p.class_id
      where (v_class is null or p.class_id=v_class) and (v_grade is null or coalesce(c.grade,p.grade)=v_grade)
        and (v_from is null or e.occurred_at >= (v_from::timestamp at time zone 'America/Sao_Paulo'))
        and (v_to is null or e.occurred_at < ((v_to+1)::timestamp at time zone 'America/Sao_Paulo'))
        and (v_status='' or e.status=v_status)
      order by e.occurred_at desc,e.id desc limit v_limit offset v_offset
    ) x;
  end if;
  -- Primeiro lote registra a solicitação sem incluir nomes, RA, e-mail ou linhas no log.
  if v_offset=0 then
    insert into public.audit_events(actor_id,action,detail)
      values(me.id,'EXPORT_REPORT',left('tipo='||p_kind||'; turma='||coalesce(v_class::text,'todas')||'; série='||coalesce(v_grade,'todas')||'; período='||coalesce(v_from::text,'livre')||'..'||coalesce(v_to::text,'livre'),500));
  end if;
  return result;
end;
$$;
revoke all on function public.portal_export(text,jsonb) from public,anon,authenticated;
grant execute on function public.portal_export(text,jsonb) to authenticated;

-- Filtros mais comuns, sem índices para cada combinação e sem modificar dados históricos.
create index if not exists profiles_school_report_idx on public.profiles(class_id,full_name,id) where role='aluno';
create index if not exists enrollment_school_report_idx on public.school_enrollments(class_id,full_name,id);
commit;
