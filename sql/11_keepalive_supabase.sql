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
