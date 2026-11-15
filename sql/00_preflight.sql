-- Somente leitura: executar antes de 03_v4.sql num banco existente.
-- Deve corresponder às tabelas e funções da versão Portal enviada com este projeto.
select table_name,column_name,data_type,is_nullable from information_schema.columns
where table_schema='public' and table_name in ('profiles','attendance_events','staff_invites','audit_events','period_resets') order by table_name,ordinal_position;
select c.relname as tabela,c.relrowsecurity as rls from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('profiles','attendance_events','staff_invites','audit_events','period_resets');
select 'profiles' as tabela,count(*) as registros from public.profiles union all
select 'attendance_events',count(*) from public.attendance_events union all
select 'audit_events',count(*) from public.audit_events;
select role,count(*),sum(late_count) as total_periodo,sum(unjustified_count) as total_contabilizado from public.profiles group by role;
select routine_name from information_schema.routines where routine_schema='public' and routine_name in ('record_lateness','student_action','create_staff_invite','change_staff_role','reset_period_now');
