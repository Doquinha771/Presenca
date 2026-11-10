-- Somente banco PostgreSQL descartável do CI. Confere que sql/13 e sql/14 instalaram e respondem. Tudo é desfeito ao final.
begin;
create function pg_temp.check_true(value boolean,label text) returns void language plpgsql as $$begin if value is distinct from true then raise exception 'FALHOU: %',label;end if;raise notice 'PASSOU: %',label;end;$$;

select pg_temp.check_true(to_regprocedure('public.staff_manage(text,jsonb)') is not null,'equipe: função staff_manage instalada');
select pg_temp.check_true(exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='staff_pending'),'equipe: coluna staff_pending');
select pg_temp.check_true((select private.storage_housekeeping()) >= 0,'faxina roda mesmo sem as tabelas internas do Supabase');
select pg_temp.check_true(to_regprocedure('public.calendar_manage(text,jsonb)') is not null,'calendário: função instalada');
select pg_temp.check_true((select relrowsecurity from pg_class where oid='public.school_calendar_days'::regclass),'calendário: RLS ligado');
select pg_temp.check_true(not has_table_privilege('authenticated','public.school_calendar_days','select'),'calendário: tabela fechada para leitura direta');

-- Direção cadastra um período e qualquer pessoa da escola consulta.
insert into public.staff_invites(email,role) values('cal-admin@example.invalid','admin');
insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values
 ('c1400000-0000-4000-8000-000000000001','cal-admin@example.invalid','{"full_name":"Direção Calendário"}',now());
update public.profiles set verified=true,active=true where id='c1400000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','c1400000-0000-4000-8000-000000000001',true);
select pg_temp.check_true((public.calendar_manage('add','{"from":"2026-12-22","to":"2026-12-31","kind":"ferias","label":"Férias de fim de ano"}')->>'saved')::int=10,'calendário: período de 10 dias salvo');
select pg_temp.check_true(jsonb_array_length(public.calendar_manage('list','{"year":2026}'))=10,'calendário: lista o período');
select pg_temp.check_true((public.calendar_manage('remove','{"from":"2026-12-30","to":"2026-12-31"}')->>'removed')::int=2,'calendário: remove parte do período');
reset role;
rollback;
