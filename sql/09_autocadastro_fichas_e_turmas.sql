-- Presença+ 5.3: fichas de pré-cadastro visíveis somente à equipe.
-- A migração 4.1.2 já vincula automaticamente a conta à matrícula preexistente.
-- Não mexe nas tabelas, no Auth existente, nas senhas nem nas políticas RLS.
begin;
set local lock_timeout='10s';
set local statement_timeout='90s';

-- Consulta privilegiada isolada. O cargo é conferido no banco e os valores
-- de cadastro espontâneo são explicitamente apresentados como NÃO verificados.
create or replace function private.portal_applications(p_offset integer, p_search text)
returns jsonb language plpgsql stable security definer set search_path='' as $applications$
declare
  viewer public.profiles;
  term text:=lower(trim(coalesce(p_search,'')));
begin
  viewer:=private.require_portal();
  if viewer.role not in ('admin','secretaria') then
    raise exception 'Acesso exclusivo à equipe escolar' using errcode='42501';
  end if;
  if p_offset is null or p_offset<0 or p_offset>10000 or length(term)>100 then
    raise exception 'Filtro inválido' using errcode='22023';
  end if;
  return coalesce((select jsonb_agg(x) from (
    select p.id,p.full_name,p.ra,
      coalesce(p.grade,nullif(left(trim(u.raw_user_meta_data->>'grade'),90),'')) as grade,
      coalesce(p.birth_date::text,case when
        (u.raw_user_meta_data->>'birth_date') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        and pg_catalog.pg_input_is_valid(u.raw_user_meta_data->>'birth_date','date')
        then (u.raw_user_meta_data->>'birth_date') else null end) as birth_date,
      p.verified,p.created_at
    from public.profiles p join auth.users u on u.id=p.id
    where p.role='aluno' and p.active and p.archived_at is null
      and not p.enrollment_approved
      and (term='' or position(term in lower(p.full_name))>0 or position(term in lower(p.ra))>0)
    order by p.created_at desc,p.id desc limit 25 offset p_offset
  ) x),'[]'::jsonb);
end;
$applications$;

-- Wrapper invoker em public: não tem privilégios elevados.
create or replace function public.portal_applications(p_offset integer default 0,p_search text default '')
returns jsonb language sql stable security invoker set search_path='' as $wrapper$
 select private.portal_applications(p_offset,p_search);
$wrapper$;
revoke all on function private.portal_applications(integer,text) from public,anon,authenticated;
revoke all on function public.portal_applications(integer,text) from public,anon,authenticated;
grant execute on function private.portal_applications(integer,text) to authenticated;
grant execute on function public.portal_applications(integer,text) to authenticated;

-- Mensagem de confirmação de e-mail é mais útil que estado da matrícula enquanto
-- a conta ainda não possui titularidade do endereço verificada.
create or replace function public.portal_registration_status()
returns text language sql stable security definer set search_path='' as $status$
 select case when p.id is null then 'sem_perfil'
  when not p.verified then 'aguardando_email'
  when not p.active then 'inativo'
  when p.role='aluno' and not p.enrollment_approved then 'aguardando_instituicao'
  else 'liberado' end
 from (select auth.uid() as uid) u
 left join public.profiles p on p.id=u.uid
 where u.uid is not null;
$status$;
revoke all on function public.portal_registration_status() from public,anon,authenticated;
grant execute on function public.portal_registration_status() to authenticated;
commit;
