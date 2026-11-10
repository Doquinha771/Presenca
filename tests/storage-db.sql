-- Controle de armazenamento (sql/12). Executado dentro da transação descartável de tests/database.sql.
-- Nunca executar no Supabase real.
reset role;
select pg_temp.check_true((select relrowsecurity from pg_class where oid='public.storage_policy'::regclass),'RLS na política de armazenamento');
select pg_temp.check_true((select relrowsecurity from pg_class where oid='public.storage_cleanups'::regclass),'RLS no histórico de limpezas');
select pg_temp.check_true((select limit_mb=500 and trigger_percent=80 and grace_days=180 and auto_enabled from public.storage_policy),'padrões: 500 MB, 80%, 180 dias');

-- Cenário: o concluinte (arquivado pelo teste anual) saiu há 200 dias e tinha atrasos.
update public.profiles set archived_at=now()-interval '200 days' where id='a4000000-0000-4000-8000-000000000005';
insert into public.attendance_events(student_id,reason,status) values
 ('a4000000-0000-4000-8000-000000000005','registro antigo','active'),
 ('a4000000-0000-4000-8000-000000000005','registro antigo 2','void');
-- Cadastro abandonado: nunca confirmado, sem matrícula, sem atrasos, criado há 1 ano.
update public.profiles set created_at=now()-interval '365 days' where id='a4000000-0000-4000-8000-000000000098';
-- Arquivado recentemente: ainda na carência, não pode sair.
insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values
 ('a4000000-0000-4000-8000-000000000006','9999999999006@al.educacao.sp.gov.br','{"full_name":"Arquivado recente"}',now());
update public.profiles set archived_at=now()-interval '10 days', active=false where id='a4000000-0000-4000-8000-000000000006';
-- Convite vencido há muito tempo.
insert into public.staff_invites(email,role,expires_at,created_at) values('antigo@example.invalid','secretaria',now()-interval '60 days',now()-interval '74 days');
select set_config('test.events_003',(select count(*)::text from public.attendance_events where student_id='a4000000-0000-4000-8000-000000000003'),true);

-- Permissões
set local role anon;
select pg_temp.denied($q$select public.storage_manage('status')$q$,'permission denied');
reset role;
set local role authenticated;
set local request.jwt.claim.sub='a4000000-0000-4000-8000-000000000003';
select pg_temp.denied($q$select public.storage_manage('status')$q$,'Operação reservada à Direção');
select pg_temp.denied($q$select private.storage_cleanup('manual',null,false,true)$q$,'permission denied');

-- Direção: status com prévia, sem apagar nada
set local request.jwt.claim.sub='a4000000-0000-4000-8000-000000000001';
select pg_temp.check_true((public.storage_manage('status')->'usage'->>'bytes')::bigint>0,'mostra o tamanho do banco');
select pg_temp.check_true((public.storage_manage('status')->'preview'->>'students')::int=2,'prévia conta concluinte antigo e cadastro abandonado');
select pg_temp.check_true((public.storage_manage('status')->'preview'->>'events')::int=2,'prévia conta os atrasos de quem sai');
select pg_temp.denied($q$select public.storage_manage('run','{}')$q$,'Digite LIBERAR');
select pg_temp.denied($q$select public.storage_manage('policy','{"trigger_percent":"99"}')$q$,'storage_policy_trigger_percent_check');
reset role;
select pg_temp.check_true((select count(*)=1 from public.profiles where id='a4000000-0000-4000-8000-000000000005'),'prévia e confirmação errada não apagam nada');

-- Agendador abaixo do limite não faz nada
select pg_temp.check_true(private.storage_guard()->>'skipped'='true','abaixo do limite a verificação automática não age');
select pg_temp.check_true((select count(*)=0 from public.storage_cleanups),'nenhuma limpeza registrada sem necessidade');

-- Limpeza manual confirmada
set local role authenticated;
set local request.jwt.claim.sub='a4000000-0000-4000-8000-000000000001';
select pg_temp.check_true((public.storage_manage('run','{"confirm":"LIBERAR"}')->>'students')::int=2,'Direção libera espaço com confirmação');
reset role;
select pg_temp.check_true(not exists(select 1 from public.profiles where id in ('a4000000-0000-4000-8000-000000000005','a4000000-0000-4000-8000-000000000098')),'perfis de quem saiu foram removidos');
select pg_temp.check_true(not exists(select 1 from auth.users where id in ('a4000000-0000-4000-8000-000000000005','a4000000-0000-4000-8000-000000000098')),'logins de quem saiu foram removidos');
select pg_temp.check_true(not exists(select 1 from public.attendance_events where student_id='a4000000-0000-4000-8000-000000000005'),'atrasos de quem saiu foram removidos');
select pg_temp.check_true(not exists(select 1 from public.academic_renewals where student_id='a4000000-0000-4000-8000-000000000005'),'renovações de quem saiu foram removidas');
select pg_temp.check_true(exists(select 1 from public.profiles where id='a4000000-0000-4000-8000-000000000006'),'arquivado dentro da carência permanece');
select pg_temp.check_true((select count(*)::text from public.attendance_events where student_id='a4000000-0000-4000-8000-000000000003')=current_setting('test.events_003'),'aluno ativo e seus atrasos permanecem intactos');
select pg_temp.check_true(exists(select 1 from public.profiles where id='a4000000-0000-4000-8000-000000000001' and role='admin'),'conta da Direção permanece');
select pg_temp.check_true(not exists(select 1 from public.staff_invites where email='antigo@example.invalid'),'convite vencido foi removido');
select pg_temp.check_true((select count(*)=1 and min(students_removed)=2 and min(trigger)='manual' from public.storage_cleanups),'limpeza fica registrada');
select pg_temp.check_true(exists(select 1 from public.audit_events where action='STORAGE_CLEANUP' and detail not like '%Concluinte%'),'auditoria registra a limpeza sem nomes');

-- Regras ajustáveis pela Direção
set local role authenticated;
set local request.jwt.claim.sub='a4000000-0000-4000-8000-000000000001';
select pg_temp.check_true((public.storage_manage('policy','{"grace_days":"365","trigger_percent":"75","auto_enabled":"false"}')->>'grace_days')::int=365,'Direção ajusta as regras');
reset role;
select pg_temp.check_true((select trigger_percent=75 and not auto_enabled from public.storage_policy),'regras gravadas');
