-- Requer 01_portal.sql + 03_v4.sql + 04_v4_1.sql + 05_v4_1_2.sql.
-- Somente banco descartável de homologação. Tudo é revertido ao final.
begin;
create function pg_temp.check_true(value boolean,label text) returns void language plpgsql as $$begin if value is distinct from true then raise exception 'FALHOU: %',label;end if;raise notice 'PASSOU: %',label;end;$$;
create function pg_temp.denied(command text, expected text) returns void language plpgsql as $$begin
 begin execute command;exception when others then if position(expected in sqlerrm)>0 then raise notice 'PASSOU: acesso/operação negado: %',expected;return;else raise;end if;end;
 raise exception 'FALHOU: operação deveria ser negada: %',command;
end;$$;
insert into public.staff_invites(email,role) values('v4-admin@example.invalid','admin'),('v4-staff@example.invalid','secretaria');
insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values
 ('a4000000-0000-4000-8000-000000000001','v4-admin@example.invalid','{"full_name":"Teste Direção"}',now()),
 ('a4000000-0000-4000-8000-000000000002','v4-staff@example.invalid','{"full_name":"Teste Secretaria"}',now());
insert into public.school_classes(id,grade,name) values('a4000000-0000-4000-8000-000000000010','3º ano teste','T');
insert into public.school_enrollments(ra,email,full_name,birth_date,class_id) values
 ('9999999999001','9999999999001@al.educacao.sp.gov.br','Estudante teste um','2007-01-01','a4000000-0000-4000-8000-000000000010'),
 ('9999999999002','9999999999002@al.educacao.sp.gov.br','Estudante teste dois','2007-01-01','a4000000-0000-4000-8000-000000000010');
-- Solicitação espontânea com metadados incompletos deve ser criada como pendente,
-- sem obter autorização nem cargo institucional.
insert into auth.users(id,email,raw_user_meta_data) values
 ('a4000000-0000-4000-8000-000000000098','9999999999098@al.educacao.sp.gov.br','{"full_name":"Solicitação incompleta","role":"admin"}');
select pg_temp.check_true((select role='aluno' and not enrollment_approved and grade is null
 and birth_date is null from public.profiles where id='a4000000-0000-4000-8000-000000000098'),
 'solicitação incompleta permanece pendente, sem cargo nem dados escolares não verificados');
-- Aluno sem matrícula: Auth cria solicitação pendente, sem acesso aos registros.
insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values
 ('a4000000-0000-4000-8000-000000000099','9999999999099@al.educacao.sp.gov.br',
 '{"full_name":"Estudante aguardando","ra":"9999999999099","grade":"3º ano teste","birth_date":"2007-01-01","role":"admin"}',now());
select pg_temp.check_true((select role='aluno' and not enrollment_approved from public.profiles where id='a4000000-0000-4000-8000-000000000099'),'solicitação não ganha cargo nem autorização');
set local role authenticated;
set local request.jwt.claim.sub='a4000000-0000-4000-8000-000000000099';
select pg_temp.check_true(public.portal_registration_status()='aguardando_instituicao','aluno pendente vê somente estado');
select pg_temp.denied($q$select public.portal_read('me')$q$,'Matrícula aguardando autorização');
set local request.jwt.claim.sub='a4000000-0000-4000-8000-000000000002';
select public.portal_write('enrollment',jsonb_build_object('ra','9999999999099','email','9999999999099@al.educacao.sp.gov.br',
 'name','Nome aprovado pela escola','birth','2007-01-01','class','a4000000-0000-4000-8000-000000000010','active','true'));
-- A secretaria grava a matrícula via RPC; isso NÃO concede SELECT direto em
-- public.profiles ao papel authenticated (dados escolares são protegidos).
select pg_temp.denied($q$select enrollment_approved from public.profiles where id='a4000000-0000-4000-8000-000000000099'$q$,'permission denied');
reset role;
select pg_temp.check_true((select enrollment_approved and verified and full_name='Nome aprovado pela escola' from public.profiles where id='a4000000-0000-4000-8000-000000000099'),'secretaria vincula matrícula ao Auth já existente');
insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values
 ('a4000000-0000-4000-8000-000000000003','9999999999001@al.educacao.sp.gov.br','{"full_name":"Nome ignorado","ra":"9999999999001","birth_date":"2007-01-01","role":"admin"}',now()),
 ('a4000000-0000-4000-8000-000000000004','9999999999002@al.educacao.sp.gov.br','{"full_name":"Outro aluno","ra":"9999999999002","birth_date":"2007-01-01"}',now());
select pg_temp.check_true((select role='aluno' and full_name='Estudante teste um' from public.profiles where id='a4000000-0000-4000-8000-000000000003'),'metadados não concedem cargo nem mudam matrícula');
set local role authenticated;
set local request.jwt.claim.sub='a4000000-0000-4000-8000-000000000003';
select pg_temp.check_true(public.portal_read('me')->>'role'='aluno','perfil aluno');
select pg_temp.check_true(not(public.portal_read('me')?'birth_date'),'nascimento não exposto');
select pg_temp.denied($q$select public.portal_read('history','{"student":"a4000000-0000-4000-8000-000000000004"}')$q$,'Acesso negado');
select pg_temp.denied($q$select public.portal_read('team')$q$,'Somente a Direção');
select pg_temp.denied($q$select public.portal_export('students')$q$,'Exportação restrita à equipe institucional');
select pg_temp.denied($q$select public.portal_write('chance','{"student":"a4000000-0000-4000-8000-000000000003","reason":"invasao"}')$q$,'Operação institucional');
select pg_temp.denied($q$update public.profiles set role='admin' where id=auth.uid()$q$,'permission denied');
select pg_temp.denied($q$select birth_date from public.profiles$q$,'permission denied');
set local request.jwt.claim.sub='a4000000-0000-4000-8000-000000000002';
select pg_temp.check_true(jsonb_array_length(public.portal_export('students','{"grade":"3º ano teste","class":"a4000000-0000-4000-8000-000000000010"}')) >= 1,'Secretaria exporta lista filtrada por série e turma');
select pg_temp.check_true(jsonb_array_length(public.portal_export('enrollments','{"grade":"3º ano teste"}')) >= 2,'Secretaria exporta matrículas por série');
select pg_temp.denied($q$select public.portal_export('invalido')$q$,'Tipo de relatório inválido');
select pg_temp.denied($q$select public.portal_export('students','{"offset":200000}')$q$,'Limite de exportação atingido');
select pg_temp.denied($q$select public.portal_write('chance','{"student":"a4000000-0000-4000-8000-000000000003","reason":"nao pode"}')$q$,'Operação reservada');
select pg_temp.denied($q$select public.record_lateness('a4000000-0000-4000-8000-000000000003',false,'')$q$,'permission denied');
reset role;
update public.profiles set baseline_count=4,late_count=4,unjustified_count=4 where id='a4000000-0000-4000-8000-000000000003';
set local role authenticated;
select public.portal_write('record','{"student":"a4000000-0000-4000-8000-000000000003","request":"a4000000-0000-4000-8000-000000000020","reason":"teste"}');
select pg_temp.check_true(public.portal_write('record','{"student":"a4000000-0000-4000-8000-000000000003","request":"a4000000-0000-4000-8000-000000000020"}')->>'duplicate'='true','retry é idempotente');
reset role;
select pg_temp.check_true((select blocked and unjustified_count=5 from public.profiles where id='a4000000-0000-4000-8000-000000000003'),'quinto atraso bloqueia');
set local role authenticated;
select pg_temp.denied($q$select public.portal_write('record','{"student":"a4000000-0000-4000-8000-000000000003","request":"a4000000-0000-4000-8000-000000000021"}')$q$,'Limite atingido');
set local request.jwt.claim.sub='a4000000-0000-4000-8000-000000000001';
select public.portal_write('chance','{"student":"a4000000-0000-4000-8000-000000000003","reason":"Responsável compareceu"}');
reset role;
select pg_temp.check_true((select late_limit=6 and not blocked from public.profiles where id='a4000000-0000-4000-8000-000000000003'),'nova chance soma exatamente um');
set local role authenticated;
set local request.jwt.claim.sub='a4000000-0000-4000-8000-000000000002';
select pg_temp.denied($q$select public.portal_write('record','{"student":"a4000000-0000-4000-8000-000000000003","request":"a4000000-0000-4000-8000-000000000022"}')$q$,'últimos dois minutos');
select public.portal_write('undo',jsonb_build_object('event',public.portal_read('history','{"student":"a4000000-0000-4000-8000-000000000003"}')->0->>'id','reason','Aluno selecionado incorretamente'));
reset role;
select pg_temp.check_true((select count(*)=1 from public.attendance_events where student_id='a4000000-0000-4000-8000-000000000003' and status='void'),'desfazer preserva ocorrência');
select pg_temp.check_true((select change_reason='Aluno selecionado incorretamente' from public.attendance_events where student_id='a4000000-0000-4000-8000-000000000003' and status='void'),'desfazer registra justificativa');
select pg_temp.check_true((select unjustified_count=4 from public.profiles where id='a4000000-0000-4000-8000-000000000003'),'desfazer corrige contagem');
set local role authenticated;
select public.portal_write('record','{"student":"a4000000-0000-4000-8000-000000000003","request":"a4000000-0000-4000-8000-000000000023"}');
reset role;
-- Simula passagem da janela; mantém a ocorrência no período atual para testar perdão.
update public.profiles set count_from=now()-interval '1 day' where id='a4000000-0000-4000-8000-000000000003';
update public.attendance_events set occurred_at=now()-interval '3 minutes' where request_id='a4000000-0000-4000-8000-000000000023';
select set_config('test.event_id',(select public_id::text from public.attendance_events where request_id='a4000000-0000-4000-8000-000000000023'),true);
set local role authenticated;
select pg_temp.denied($q$select public.portal_write('undo',jsonb_build_object('event',current_setting('test.event_id'),'reason','teste janela expirada'))$q$,'Desfazimento expirado');
set local request.jwt.claim.sub='a4000000-0000-4000-8000-000000000001';
select public.portal_write('forgive',jsonb_build_object('event',current_setting('test.event_id'),'reason','Justificativa aceita pela Direção'));
reset role;
select pg_temp.check_true((select unjustified_count=4 from public.profiles where id='a4000000-0000-4000-8000-000000000003'),'perdão reduz contagem');
select pg_temp.check_true((select count(*)=2 from public.attendance_events where student_id='a4000000-0000-4000-8000-000000000003'),'perdão não apaga histórico');
select pg_temp.check_true((select change_reason='Justificativa aceita pela Direção' from public.attendance_events where request_id='a4000000-0000-4000-8000-000000000023'),'perdão registra justificativa');
select pg_temp.check_true(to_regprocedure('public.portal_import_batch(text,jsonb)') is null,'API de importação não está disponível');
update public.profiles set active=false where id='a4000000-0000-4000-8000-000000000002';
set local role authenticated;
set local request.jwt.claim.sub='a4000000-0000-4000-8000-000000000002';
select pg_temp.denied($q$select public.portal_read('students')$q$,'Sessão sem acesso');
reset role;
set local role anon;
select pg_temp.denied($q$select public.portal_read('dashboard')$q$,'permission denied');
select pg_temp.denied($q$select public.portal_export('students')$q$,'permission denied');
reset role;
select pg_temp.check_true(not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity),'RLS habilitado em todas as tabelas do projeto');
-- Keepalive público não expõe dados e deve funcionar sem sessão autenticada.
set local role anon;
select pg_temp.check_true(public.project_keepalive() is not null,'keepalive anônimo executa consulta mínima');
reset role;
select pg_temp.check_true((select not p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='project_keepalive'),'keepalive usa security invoker');
\i tests/annual-db.sql
rollback;
