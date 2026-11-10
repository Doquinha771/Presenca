import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
const sql=readFileSync(new URL('../sql/09_autocadastro_fichas_e_turmas.sql',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('três abas de Alunos com Séries e Turmas independentes',()=>{
 assert.match(app,/\['list','Lista de alunos','students'\],\['enrollments','Matrículas e acessos','enrollments'\],\['classes','Séries e turmas','classes'\]/);
 assert.match(app,/page==='students'&&studentsTab==='classes'/);
 assert.match(app,/page==='students'&&studentsTab==='enrollments'/);
 assert.match(app,/\['enrollments','classes'\]\.includes\(p\)\?'students':p/);
 assert.match(app,/studentsTab=\['list','enrollments','classes'\]\.includes\(id\)/);
});
test('matrícula de secretaria não cria senha provisória e usa RA/e-mail escolar',()=>{
 assert.doesNotMatch(app,/return provisionEnrollment\(saved\.enrollment_id\)/);
 assert.doesNotMatch(app,/button\('Criar acesso','enrollment-provision'/);
 assert.match(app,/await write\('enrollment',\{id:editing\?id:null,\.\.\.d\}\)/);
 assert.match(app,/d\.email\.toLowerCase\(\)!==d\.ra\.trim\(\)\.toLowerCase\(\)\+'@al\.educacao\.sp\.gov\.br'/);
 assert.match(app,/Recuperar senha/);
});
test('pré-cadastros visíveis só à equipe; dados autodeclarados não concedem acesso',()=>{
 assert.match(sql,/viewer:=private\.require_portal\(\)/);
 assert.match(sql,/viewer\.role not in \('admin','secretaria'\)/);
 assert.match(sql,/not p\.enrollment_approved/);
 assert.match(sql,/not p\.enrollment_approved/);
 assert.match(sql,/join auth\.users u on u\.id=p\.id/);
 assert.match(sql,/grant execute on function public\.portal_applications\(integer,text\) to authenticated/);
 assert.doesNotMatch(sql,/grant .*portal_applications.* to anon/);
 assert.match(app,/applicationsPanel\(signupApplications\)/);
 assert.match(app,/Dados informados pelo próprio aluno/);
 assert.match(html,/criam a própria senha/);
});
