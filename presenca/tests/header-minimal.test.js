import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../assets/header-minimal.css',import.meta.url),'utf8');
const header=html.match(/<header class="page-header"[\s\S]*?<\/header>/)?.[0]||'';

test('cabeçalho global exibe somente o ícone da área e o botão Tema',()=>{
 assert.ok(header,'Cabeçalho não encontrado');
 assert.match(header,/<h1 id="pageTitle" class="header-page-icon"/);
 assert.doesNotMatch(header,/id="areaName"/);
 assert.doesNotMatch(header,/id="globalSearchInput"/);
 assert.doesNotMatch(header,/id="pageTitle"[^>]*>[^<\s]/);
 assert.match(header,/id="theme"/);
 assert.doesNotMatch(header,/id="refresh"/);
 assert.match(header,/id="pageDescription" class="sr-only"/);
 assert.match(app,/title\.innerHTML=uiIcon\(state\.page\)/);
 assert.match(app,/title\.setAttribute\('aria-label',label\)/);
 assert.doesNotMatch(app,/\$\('refresh'\)/);
});

test('pesquisa global removida e cada fluxo mantém seu próprio campo',()=>{
 assert.doesNotMatch(app,/globalSearchForm|globalSearchInput|class="global-search"/);
 for(const form of ['studentsFilter','enrollmentsFilter','announcementFilters','entryForm','historyFilters'])
  assert.match(app,new RegExp(`id="${form}"`),form);
 for(const input of ['studentSearch','announcementSearch','entrySearch'])
  assert.match(app,new RegExp(`id="${input}"`),input);
 assert.match(app,/renderHeaderChrome\(\)/);
});

test('cabeçalho compacto é o último CSS e permanece fixo em desktop e celular',()=>{
 assert.match(html,/history-layout\.css"><link rel="stylesheet" href="\.\/assets\/header-minimal\.css">/);
 assert.match(css,/position:sticky;top:0;z-index:25/);
 assert.match(css,/@media\(max-width:779px\)/);
 assert.match(css,/#pageUtility[\s\S]*?display:none!important/);
 assert.match(css,/#pageDescription[\s\S]*?position:absolute/);
});

// Regressão: o texto removido do cabeçalho não pode continuar sendo acessado no boot.
test('carregamento não procura elemento de cabeçalho que não existe',()=>{
 assert.doesNotMatch(app,/\$\(['\"]areaName['\"]\)/);
 assert.match(app,/\$\('dashboard'\)\.hidden=false/);
});


test('aba Matrículas e turmas possui um único controle e cabeçalho cosmético não derruba a sessão',()=>{
 const currentApp=readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
 const duplicate=(currentApp.match(/button\('Matrículas e turmas','students-tab','enrollments'\)/g)||[]).length;
 assert.equal(duplicate,0);
 assert.match(currentApp,/const pageDescription=\$\('pageDescription'\);if\(pageDescription\)pageDescription\.textContent/);
 assert.match(currentApp,/if\(schoolLabel\)schoolLabel\.textContent=SCHOOL_NAME/);
});
