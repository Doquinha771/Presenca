import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../assets/interface-refresh.css',import.meta.url),'utf8');
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('camada de revisão é carregada por último e não reintroduz branding de TCC',()=>{
 assert.match(html,/academic-year\.css"><link rel="stylesheet" href="\.\/assets\/interface-refresh\.css">/);
 assert.doesNotMatch(html,/watermark|protótipo acadêmico|\bTCC\b/i);
 for(const page of [read('termos.html'),read('privacidade.html')])
   assert.doesNotMatch(page,/Trabalho de Conclusão de Curso|\bTCC\b|protótipo acadêmico/i);
 assert.match(read('README.md'),/Trabalho de Conclusão de Curso|Projeto de TCC/i);
});

test('Alunos usa ações contextuais e filtros com menos passos',()=>{
 assert.match(app,/function studentHubHeader\(/);
 assert.match(app,/Nova matrícula','enrollment-new'/);
 assert.match(app,/Pendentes de renovação/);
 assert.match(app,/form\.querySelectorAll\('select'\)\.forEach\(select=>select\.onchange/);
 assert.match(app,/clear-student-filters/);
 assert.match(app,/clear-enrollment-search/);
 assert.doesNotMatch(app,/Novo aluno','enrollment-new'/);
});

test('visão geral usa dados reais e atalhos funcionais no lugar de cartões vazios',()=>{
 assert.match(app,/Atrasos nos últimos 14 dias/);
 assert.match(app,/Comunicados da escola/);
 assert.match(app,/Ações rápidas/);
 assert.match(app,/reference-metrics/);
 assert.doesNotMatch(app,/Próximos eventos|Educação transforma realidades|Cada passo na escola constrói o seu futuro/);
 assert.match(css,/dashboard-metrics/);
 assert.match(css,/@media \(min-width:780px\) and \(max-width:1099px\)/);
 assert.match(css,/\.quick-links/);
});

test('controles e tabelas mantêm adaptação móvel sem efeitos pesados',()=>{
 assert.match(css,/@media \(max-width:779px\)/);
 assert.match(css,/\.streamlined-filters\{grid-template-columns:1fr/);
 assert.doesNotMatch(css,/backdrop-filter|filter:\s*blur|animation:\s*[^;]*infinite/i);
 assert.match(app,/const actionIcons=/);
});
