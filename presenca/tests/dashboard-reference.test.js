import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../assets/dashboard-reference.css',import.meta.url),'utf8');

test('referência desktop é a última camada visual e mantém o shell responsivo',()=>{
 assert.match(html,/interface-refresh\.css"><link rel="stylesheet" href="\.\/assets\/dashboard-reference\.css">/);
 assert.match(css,/#dashboard\{grid-template-columns:265px minmax\(0,1fr\)/);
 assert.match(css,/reference-metrics/);
 assert.match(css,/@media\(max-width:779px\)/);
 assert.doesNotMatch(css,/backdrop-filter|filter:\s*blur|animation:\s*[^;]*infinite/i);
});

test('sidebar segue a hierarquia da referência sem separar os módulos de Alunos',()=>{
 assert.match(app,/sidebarMenus=\{/);
 assert.match(app,/\['overview','Início','overview'\]/);
 assert.match(app,/\['classes','Turmas','classes'\]/);
 assert.match(app,/\['enrollments','Cadastros','enrollments'\]/);
 assert.match(app,/\['enrollments','classes'\]\.includes\(p\)\?'students':p/);
 assert.match(app,/studentsTab==='classes'/);
 assert.match(app,/studentsTab==='enrollments'/);
});

test('visão geral reproduz pesquisa, cinco indicadores e quatro blocos principais',()=>{
 assert.match(app,/id="dashboardSearch"/);
 assert.match(app,/Buscar aluno por nome, RA ou turma/);
 assert.match(app,/reference-metrics/);
 for(const label of ['Alunos','Hoje','Na semana','No mês','Em atenção']) assert.match(app,new RegExp(`label:'${label}'`));
 assert.match(app,/dashboardTrendSvg/);
 assert.match(app,/class-summary-table/);
 assert.match(app,/dashboard-announcements/);
 assert.match(app,/reference-quick-grid/);
});
