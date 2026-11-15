// Teste em PostgreSQL descartável. Requer psql e PGHOST/PGUSER/PGPASSWORD/PGDATABASE.
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
function sql(command,allowFailure=false){return new Promise((resolve,reject)=>{const p=spawn('psql',['-X','-qAt','-v','ON_ERROR_STOP=1'],{env:process.env});let out='',err='';p.stdout.on('data',x=>out+=x);p.stderr.on('data',x=>err+=x);p.on('error',reject);p.on('close',code=>code&&!allowFailure?reject(Error(err)):resolve({code,out:out.trim(),err}));p.stdin.end(command);});}
assert.match((await sql('select current_database();')).out,/_test$/,'Executar somente em banco de testes');
const admin=randomUUID(),staff=randomUUID(),student=randomUUID(),cls=randomUUID();const ra='98'+Date.now();
await sql(`insert into public.staff_invites(email,role) values('${admin}@example.invalid','admin'),('${staff}@example.invalid','secretaria');
insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values('${admin}','${admin}@example.invalid','{"full_name":"Teste Admin Concorrência"}',now()),('${staff}','${staff}@example.invalid','{"full_name":"Teste Staff Concorrência"}',now());
insert into public.school_classes(id,grade,name) values('${cls}','Teste concorrência','${ra}');
insert into public.school_enrollments(ra,email,full_name,birth_date,class_id) values('${ra}','${ra}@al.educacao.sp.gov.br','Aluno Concorrência','2007-01-01','${cls}');
insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values('${student}','${ra}@al.educacao.sp.gov.br','{"ra":"${ra}","birth_date":"2007-01-01"}',now());
update public.profiles set baseline_count=4,late_count=4,unjustified_count=4 where id='${student}';`);
const record=(actor,request)=>sql(`begin;set local role authenticated;set local request.jwt.claim.sub='${actor}';select public.portal_write('record','{"student":"${student}","request":"${request}"}');select pg_sleep(0.3);commit;`,true);
const first=await Promise.all([record(admin,randomUUID()),record(staff,randomUUID())]);
assert.equal(first.filter(x=>x.code===0).length,1);assert.match(first.find(x=>x.code!==0).err,/Limite atingido/);
assert.equal((await sql(`select count(*) from public.attendance_events where student_id='${student}';`)).out,'1');
assert.equal((await sql(`select unjustified_count::text||'/'||blocked::text from public.profiles where id='${student}';`)).out,'5/true');
// Novo período para testar retries simultâneos do mesmo pedido.
await sql(`update public.profiles set baseline_count=0,late_count=0,unjustified_count=0,blocked=false,count_from=clock_timestamp() where id='${student}';update public.attendance_events set occurred_at=now()-interval '3 minutes' where student_id='${student}';`);
const request=randomUUID();const retries=await Promise.all([record(staff,request),record(staff,request)]);
assert.ok(retries.every(x=>x.code===0));assert.equal((await sql(`select count(*) from public.attendance_events where request_id='${request}';`)).out,'1');
assert.equal((await sql(`select unjustified_count from public.profiles where id='${student}';`)).out,'1');
console.log('Concorrência: apenas um quinto atraso; retries simultâneos idempotentes.');
