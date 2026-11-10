import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {esc,SCHOOL_EMAIL,errorText,dateBR} from '../assets/utils.js';
test('escape de conteúdo escolar impede HTML ativo',()=>assert.equal(esc('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'));
test('formato institucional aceita RA e recusa domínios parecidos',()=>{assert.ok(SCHOOL_EMAIL.test('0000111@al.educacao.sp.gov.br'));assert.ok(SCHOOL_EMAIL.test('0000111sp@al.educacao.sp.gov.br'));for(const s of ['a@al.educacao.sp.gov.br','0000111@gmail.com','0000111@al.educacao.sp.gov.br.evil'])assert.equal(SCHOOL_EMAIL.test(s),false);});
test('erros de permissão e conexão são apresentados sem detalhes internos',()=>{assert.match(errorText({code:'42501'}),/não permite/);assert.match(errorText({message:'Failed to fetch'}),/conexão/);});
test('horário escolar é exibido em São Paulo',()=>assert.match(dateBR('2026-09-20T01:15:00Z'),/19\/09\/2026.*22:15/));
test('migração fecha caminhos antigos e contém proteções de concorrência',()=>{const sql=fs.readFileSync(new URL('../sql/03_v4.sql',import.meta.url),'utf8');for(const pattern of [/pg_advisory_xact_lock_shared/,/for update/,/request_id uuid unique/,/revoke all on function public.record_lateness/,/clock_timestamp\(\)/,/enrollment_approved/,/late_limit=late_limit\+1/,/interval '2 minutes'/])assert.match(sql,pattern);assert.doesNotMatch(sql,/drop table|truncate /i);});
test('artefatos públicos não incluem chave secreta ou banco local',()=>{for(const f of ['../assets/app.js','../config.js','../index.html']){const s=fs.readFileSync(new URL(f,import.meta.url),'utf8');assert.doesNotMatch(s,/sb_secret_[A-Za-z0-9]{8}|localhost|sqlite|service_role\s*[:=]/i);}const app=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');assert.equal((app.match(/localStorage\.setItem/g)||[]).length,1);assert.match(app,/localStorage\.setItem\('presenca-theme'/);});


test('cadastro pendente não depende de nascimento e turma antes da autorização escolar',()=>{
 const sql=fs.readFileSync(new URL('../sql/05_v4_1_2.sql',import.meta.url),'utf8');
 assert.match(sql,/not enrollment_approved or \(grade is not null and birth_date is not null\)/);
 assert.match(sql,/student_ra:=split_part\(email_normalized/);
 assert.match(sql,/new\.email_confirmed_at is not null,false/);
 assert.match(sql,/values\s*\(new\.id,student_ra,claimed_name,null,null,'aluno'/);
 assert.doesNotMatch(sql,/raise exception 'Dados escolares incompletos ou inválidos'/);
 assert.match(sql,/convite institucional inexistente/);
 assert.match(sql,/where email=email_normalized and used_at is null/);
});
test('README é informativo e não contém instruções para instalar, baixar ou aplicar',()=>{
 const readme=fs.readFileSync(new URL('../README.md',import.meta.url),'utf8');
 assert.doesNotMatch(readme,/## Instalação|## Download|## Como (instalar|baixar|aplicar)|Deploy from a branch|npm install|git clone|git push/i);
 assert.match(readme,/## Funcionalidades/);
 assert.match(readme,/## Licença/);
});
test('CI usa a migração de cadastro pendente e o teste de matrícula mantém SELECT direto bloqueado',()=>{
 const workflow=fs.readFileSync(new URL('../.github/workflows/verify.yml',import.meta.url),'utf8');
 const testSql=fs.readFileSync(new URL('./database.sql',import.meta.url),'utf8');
 assert.match(workflow,/psql -v ON_ERROR_STOP=1 -f sql\/05_v4_1_2\.sql[\s\S]*psql -v ON_ERROR_STOP=1 -f tests\/database\.sql/);
 assert.match(testSql,/select pg_temp\.denied\(\$q\$select enrollment_approved from public\.profiles[\s\S]*reset role;\s*select pg_temp\.check_true\(\(select enrollment_approved and verified/);
 assert.match(testSql,/and birth_date is null[\s\S]*'solicitação incompleta permanece pendente/);
});
