import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../assets/history-reference.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('histórico institucional mantém filtros e oito colunas sem cabeçalho redundante',()=>{
 for(const marker of [
  'renderStaffHistory(rows)','Filtros de busca','id="historyFilters"',
  'id="fromDate"','id="toDate"','id="historyStudentSearch"','id="historyClass"','id="historyStatus"',
  'Limpar filtros','Aplicar filtros','historyResultsTitle','historyRows','history-reference-pager'
 ]) assert.ok(app.includes(marker),marker);
 for(const header of ['Data e hora','Aluno','Turma','Tipo','Situação','Observação','Responsável','Ações']) assert.ok(app.includes(`<th scope="col">${header}</th>`),header);
});

test('histórico mantém correções, ações existentes e paginação configurável',()=>{
 assert.match(app,/studentView\(\)\?renderStudentHistory\(rows\):renderStaffHistory\(rows\)/);
 assert.match(app,/data-action="history-actions"/);
 for(const action of ["'undo'","'correct'","'forgive'","'all-history'","'clear-history-filters'","'history-prev'","'history-next'"]) assert.ok(app.includes(action));
 assert.match(app,/10 por página/);
 assert.match(app,/20 por página/);
 assert.match(app,/historyPageSize/);
});

test('folha da referência é carregada por último e adapta desktop e mobile',()=>{
 assert.ok(html.indexOf('assets/history-reference.css')>html.indexOf('assets/students-reference.css'));
 for(const width of ['max-width:1300px','max-width:900px','max-width:779px','max-width:520px']) assert.ok(css.includes(width),width);
 assert.doesNotMatch(app,/Consulte o histórico de ocorrências, atrasos e alterações dos alunos\./);
 assert.doesNotMatch(app,/O histórico mostra as ocorrências registradas/);
 assert.match(css,/history-period-control/);
 assert.match(css,/history-table th:nth-child\(8\)/);
 assert.match(css,/history-reference-pager/);
});
