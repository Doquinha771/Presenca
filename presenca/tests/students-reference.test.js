import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../assets/students-reference.css',import.meta.url),'utf8');
const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));

test('Alpha 1.0 usa a casca visual específica da área Alunos',()=>{
 assert.equal(pkg.version,'1.0.0-alpha.1');
 assert.match(html,/assets\/students-reference\.css/);
 assert.match(app,/studentReferenceTop\('list'/);
 assert.match(app,/student-reference-top-action/);
 assert.match(app,/student-reference-filter-card/);
 assert.match(app,/student-reference-list-card/);
 assert.match(app,/Filtros avançados/);
 assert.match(app,/Exportar Excel/);
 assert.match(app,/Nome \(A → Z\)/);
 assert.match(app,/10 por página/);
 assert.match(app,/ÚLTIMA OCORRÊNCIA/);
 assert.match(css,/student-reference-tabs/);
 assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
});

test('cabeçalho da área Alunos mantém busca global e apenas Tema',()=>{
 assert.match(app,/\['overview','students','history'\]\.includes\(state\.page\)/);
 assert.match(app,/Ctrl \+ K/);
 assert.doesNotMatch(html,/id="refresh"/);
 assert.match(css,/students-page \.page-header \.page-copy\{display:none!important\}/);
});
