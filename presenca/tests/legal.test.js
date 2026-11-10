import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(join(root,p),'utf8');
const home=read('index.html'),terms=read('termos.html'),privacy=read('privacidade.html'),app=read('assets/app.js');
test('documentos legais estão disponíveis antes do login e sem requisições externas',()=>{
  for(const page of [terms,privacy]){
    assert.match(page, /<html lang="pt-BR">/);
    assert.match(page, /<main[^>]*id="main"/);
    assert.match(page, /<meta[^>]*http-equiv="Content-Security-Policy"/);
    assert.doesNotMatch(page,/<script|<iframe|<form/i);
    assert.doesNotMatch(page, /Minuta para aprovação da instituição|validar com a instituição|aguardando identificação/i);
    assert.match(page, /Versão 2\.1/);
  }
  assert.ok(existsSync(join(root,'assets/legal.css')));
  assert.match(terms,/privacidade\.html/);
  assert.match(privacy,/termos\.html/);
});
test('documentos estão visíveis no login e no painel; formulário exige ciência de leitura',()=>{
  assert.match(home, /id="consentField"[^>]*>[\s\S]*?type="checkbox"[\s\S]*?termos\.html[\s\S]*?privacidade\.html/);
  assert.match(home,/id="termsLink" href="\.\/termos\.html"/);
  assert.match(home,/id="privacyLink" href="\.\/privacidade\.html"/);
  assert.match(home,/class="app-footer"[\s\S]*?termos\.html[\s\S]*?privacidade\.html/);
  assert.match(app,/if\(!d\.consent\)throw Error\('Leia e confirme/);
  assert.doesNotMatch(app,/\$\('privacyLink'\)\.onclick/);
});
test('política distingue autorização institucional, base legal e hospedagem internacional',()=>{
  assert.match(privacy,/us-west-2, Estados Unidos/);
  assert.match(privacy,/art\. 18 da LGPD/);
  assert.match(privacy,/art\. 14/);
  assert.match(privacy,/não constitui consentimento genérico/);
  assert.match(terms,/não equivale a consentimento geral/);
  assert.match(read('README.md'),/não\*\*\s*\nrepresenta consentimento genérico/);
});
test('licença é restrita e protege direitos legais; nenhum segredo é publicado em páginas jurídicas',()=>{
  const license=read('LICENSE');
  assert.match(license,/RESTRICTED INSTITUTIONAL SOFTWARE LICENSE/);
  assert.match(license,/Nothing in this license waives statutory/);
  for(const item of [home,terms,privacy,read('README.md'),license]){
    assert.doesNotMatch(item,/sb_secret_[A-Za-z0-9_-]{16,}/);
    assert.doesNotMatch(item,/service_role\s*[:=]\s*["'][A-Za-z0-9_.-]{20,}/);
  }
});

test('política descreve endereço, dados, direitos, ausência de retenção fixa e canal público',()=>{
  assert.match(privacy,/us-west-2, Estados Unidos/);
  assert.match(privacy,/não há prazo único de eliminação automática/i);
  assert.match(privacy,/art\. 18 da LGPD/);
  assert.match(privacy,/atendimento\.educacao\.sp\.gov\.br/);
  assert.match(privacy,/não é o portal oficial|não é uma plataforma oficial|não substitui os sistemas da rede/i);
  assert.match(home,/Esta confirmação de leitura não constitui consentimento genérico/);
  for(const p of [terms,privacy]) {
    assert.doesNotMatch(p, /<form|<script|<iframe/i);
    assert.doesNotMatch(p, /secretaria\.educacao\.sp\.gov\.br@|@example\.com/);
  }
});

test('origem estudantil, apoio escolar e limites de demonstração aparecem sem branding acadêmico',()=>{
  for(const page of [terms,privacy]){
    assert.match(page,/grupo de estudantes/);
    assert.match(page,/secretaria escolar/);
    assert.match(page,/dados (fictícios|sintéticos)/);
    assert.doesNotMatch(page,/Trabalho de Conclusão de Curso|\bTCC\b|protótipo acadêmico/i);
    assert.doesNotMatch(page,/validar com a instituição|Minuta para aprovação/i);
  }
  assert.match(home,/feito pelos alunos do 3-A e com apoio da direção\./);
  assert.match(read('README.md'),/Trabalho de Conclusão de Curso|Projeto de TCC/i);
  assert.doesNotMatch(read('README.md'),/## Instalação|## Download|estrutura do projeto/i);
});
