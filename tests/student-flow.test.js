// O comportamento da tela (abas de Alunos, cadastro pela secretaria) é testado no navegador: tests/browser.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../sql/09_autocadastro_fichas_e_turmas.sql',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('pré-cadastros visíveis só à equipe; dados autodeclarados não concedem acesso',()=>{
 assert.match(sql,/viewer:=private\.require_portal\(\)/);
 assert.match(sql,/viewer\.role not in \('admin','secretaria'\)/);
 assert.match(sql,/not p\.enrollment_approved/);
 assert.match(sql,/not p\.enrollment_approved/);
 assert.match(sql,/join auth\.users u on u\.id=p\.id/);
 assert.match(sql,/grant execute on function public\.portal_applications\(integer,text\) to authenticated/);
 assert.doesNotMatch(sql,/grant .*portal_applications.* to anon/);
 assert.match(html,/criam a própria senha/);
});
