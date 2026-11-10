import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../assets/desktop-shell.css',import.meta.url),'utf8');
const app=readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');

test('desktop carrega uma única casca após as folhas legadas',()=>{
 assert.match(html,/portal-layout\.css.*desktop-shell\.css/);
 assert.doesNotMatch(html,/desktop-overview-fix\.css/);
 assert.match(app,/classList\.toggle\('staff-shell',staff\(\)\)/);
 assert.match(css,/@media \(min-width:780px\)/);
 assert.match(css,/@media \(min-width:780px\) and \(max-width:1100px\)/);
 assert.match(css,/grid-template-columns:clamp\(210px,19vw,292px\) minmax\(0,1fr\)/);
 assert.match(css,/#view \.table-scroll\{[^}]*overflow-x:auto/);
 assert.match(css,/#view table\{[^}]*min-width:580px/);
});

test('matrículas e alunos são uma única área sem duplicar item de menu',()=>{
 assert.match(app,/visiblePages=\(\)=>allowed\(\)\.filter\(page=>page!=='enrollments'&&page!=='classes'\)/);
 assert.match(app,/\['enrollments','classes'\]\.includes\(p\)\?'students':p/);
 assert.match(app,/function studentTabs\(\)/);
 assert.match(app,/function classManager\(\)/);
 assert.match(app,/\$\{classManager\(\)\}/);
 assert.match(app,/\['enrollments','Matrículas e acessos','enrollments'\]/);
 assert.match(app,/\['classes','Séries e turmas','classes'\]/);
 assert.match(app,/studentsTab==='classes'/);
 assert.match(app,/id=\"inlineClassForm\"/);
 assert.match(app,/select.innerHTML=classesOptions\(chosen.id,false\)/);
 assert.match(app,/state.classes.find\(c=>c.id===id\)/);
 assert.doesNotMatch(app, /\['classes','team','adjustments'\]/);
 assert.match(app,/data-action="students-tab"/);
 assert.match(app,/function enrollmentTable\(rows\)/);
 assert.match(app,/a==='students-tab'/);
 assert.match(app,/openModal\(editing\?'Editar matrícula':'Cadastrar matrícula escolar'/);
 assert.match(app,/autoEmail/);
});

test('casca preserva permissões, backend Supabase e menu móvel',()=>{
 assert.match(app,/const allowed=\(\)=>/);
 assert.match(app,/const read=\(kind,args=\{\}\)=>rpc\('portal_read'/);
 assert.match(app,/renderMobileNav\(\)/);
 assert.doesNotMatch(css,/https?:\/\//);
 assert.doesNotMatch(css,/position:fixed;inset:0/);
});


test('interface ergonômica mantém rodapé ao fundo, perfil único e ícones Uicons',()=>{
 const ergonomic=readFileSync(new URL('../assets/ergonomia.css',import.meta.url),'utf8');
 assert.match(html,/assets\/ergonomia\.css/);
 assert.match(html,/cdn-uicons\.flaticon\.com\/4\.0\.0/);
 assert.match(html,/feito pelos alunos do 3-A e com apoio da direção\./);
 assert.match(html,/Ícones Uicons por Flaticon/);
 assert.match(html,/id="pageProfile"[^>]*hidden aria-hidden="true"/);
 assert.match(ergonomic,/#pageProfile\{display:none!important\}/);
 assert.match(ergonomic,/\.app-footer\{[^}]*margin:auto 0 0/);
 assert.match(ergonomic,/#sidebar\{[^}]*position:sticky/);
 assert.match(ergonomic,/#nav\{[^}]*overflow-y:auto/);
 assert.match(app,/function renderSidebarNav\(\)/);
 assert.match(app,/sidebarMenus=\{/);
 assert.match(app,/fi fi-rr-/);
 assert.doesNotMatch(app,/<svg viewBox=/);
});
