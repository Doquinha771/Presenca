import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const html=read('index.html'),app=read('assets/app.js'),css=read('assets/ui.css');

test('uma única folha de estilo, sem camadas legadas',()=>{
 const sheets=[...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(sheets,['https://cdn-uicons.flaticon.com/4.0.0/uicons-regular-rounded/css/uicons-regular-rounded.css','./assets/ui.css?v=5.0.0']);
 for(const old of ['app','portal-layout','desktop-shell','ergonomia','header-minimal','motion','interface-refresh','dashboard-reference','students-reference','history-reference'])
  assert.ok(!existsSync(new URL(`../assets/${old}.css`,import.meta.url)),old);
 assert.doesNotMatch(css,/https?:\/\//);
 assert.doesNotMatch(html,/watermark|protótipo acadêmico|\bTCC\b/i);
});

test('ícones Uicons, rodapé com crédito e permissões preservadas',()=>{
 assert.match(html,/cdn-uicons\.flaticon\.com\/4\.0\.0/);
 assert.match(html,/Ícones Uicons por Flaticon/);
 assert.match(html,/feito pelos alunos do 3-A e com apoio da direção\./);
});

test('cores com papéis claros: azul para ação, vermelho só para perigo, base neutra',()=>{
 assert.match(css,/--primary:#0a4fa3/);
 assert.match(css,/--red:#c8102e/);
 assert.match(css,/--surface:#fff/);
 assert.match(css,/body::before\{[^}]*linear-gradient\(90deg,var\(--primary\)[^}]*var\(--red\)/);
 // Botão principal é azul; vermelho fica para ações perigosas.
 assert.match(css,/\.primary\{background:var\(--primary\)/);
 assert.match(css,/\.danger\{background:var\(--surface\);border-color:var\(--danger\)/);
 // Sem as cores decorativas antigas (roxo, âmbar de enfeite, azul-céu).
 assert.doesNotMatch(css,/--violet|--sky|--coral|--sun:/);
 // Sem brasão, logotipo ou nome oficial do governo: o portal não é oficial.
 assert.doesNotMatch(html,/Governo do Estado|bras[ãa]o/i);
});

test('todos os arquivos do site usam a mesma versão, para o navegador nunca misturar antigo com novo',()=>{
 const boot=read('assets/boot.js');
 const versions=[...html.matchAll(/\?v=([0-9.]+)/g),...boot.matchAll(/\?v=([0-9.]+)/g),...app.matchAll(/\?v=([0-9.]+)/g)].map(m=>m[1]);
 assert.ok(versions.length>=7,'versão em ui.css, boot.js, app.js, config.js, utils.js e planilhas');
 assert.equal(new Set(versions).size,1,'versões diferentes entre arquivos: '+[...new Set(versions)].join(', '));
 assert.match(html,/assets\/ui\.css\?v=/);
 assert.match(html,/assets\/boot\.js\?v=/);
 assert.match(boot,/import\('\.\/app\.js\?v=/);
 assert.match(app,/from '\.\.\/config\.js\?v=/);
 assert.match(app,/from '\.\/utils\.js\?v=/);
});

test('Direção: aprovações e equipe com criar, aceitar, recusar e remover',()=>{
 const sql=read('sql/13_equipe_e_otimizacao.sql');
 for(const a of ["'create'","'accept'","'reject'","'reject_student'","'remove'","'cancel_invite'","'set_password'"]) assert.ok(sql.includes('p_action='+a),a);
 assert.match(sql,/if uid=me\.id then raise exception/);
 assert.match(sql,/staff_pending/);
 assert.match(sql,/cron\.schedule\('presenca_storage_guard','17 \* \* \* \*'/);
});

test('links dos e-mails: o portal confere o código e nunca depende de localhost',()=>{
 const pasta=new URL('../supabase/templates/',import.meta.url);
 const tipos={'confirmar-cadastro':'email','redefinir-senha':'recovery','convite':'invite','link-de-acesso':'email','trocar-email':'email_change'};
 for(const [arquivo,tipo] of Object.entries(tipos)){
  const t=readFileSync(new URL(arquivo+'.html',pasta),'utf8');
  assert.ok(t.includes(`?token_hash={{ .TokenHash }}&type=${tipo}`),arquivo);
  assert.doesNotMatch(t,/localhost|ConfirmationURL/i,arquivo);
  assert.match(t,/<html lang="pt-BR">/,arquivo);
 }
 assert.match(readFileSync(new URL('codigo-de-confirmacao.html',pasta),'utf8'),/\{\{ \.Token \}\}/);
});

test('visual escolar: sem cursor próprio, sem cenários de jogo e sem mascote animado',()=>{
 assert.doesNotMatch(css,/cursor:url\(/);
 assert.doesNotMatch(html+css+app,/arco-iris|arvore\.svg|ceu-limpo|paisagem|tico-fly|auth-scene|weatherScene|ticoHome/);
 assert.doesNotMatch(read('assets/boot.js'),/giz-po|pointermove/);
 for(const f of ['arco-iris','arvore','estudos','sol','raio']) assert.ok(!existsSync(new URL(`../assets/${f}.svg`,import.meta.url)),f);
 // Faixa de título com a escola em lápis de cor; as árvores mudam com a estação do ano.
 for(const s of ['primavera','verao','outono','inverno']){
  assert.ok(existsSync(new URL(`../assets/escola-${s}.svg`,import.meta.url)),s);
  if(s!=='primavera')assert.ok(css.includes(`:root[data-season="${s}"]{--escola:url("escola-${s}.svg`),s);
 }
 assert.ok(read('assets/boot.js').includes('document.documentElement.dataset.season = now'));
});

test('carregamento: logotipo, nome e barra de progresso, com falha sempre visível',()=>{
 const boot=read('assets/boot.js');
 const screen=html.slice(html.indexOf('<div id="boot"'),html.indexOf('<div id="fatal"'));
 assert.match(screen,/boot-tico[\s\S]*boot-name[\s\S]*boot-logo[\s\S]*id="bootBar"/);
 assert.match(boot,/fail\('O carregamento demorou mais que o esperado/);
 assert.match(boot,/import\('\.\/app\.js\?v=/);
});

test('login: painel azul com tópicos da escola e o prédio em traço',()=>{
 assert.match(html,/class="auth-points"/);
 assert.match(html,/class="auth-school" id="authSchool" src="\.\/assets\/escola-primavera\.svg/);
});

test('atualização do banco que falta: aviso único, sem travar o site, e arquivo de instalação em dia',async()=>{
 assert.doesNotMatch(app,/Rode o arquivo <strong>sql\/12/);
 const {bundle}=await import('../scripts/gerar-instalacao.mjs');
 assert.equal(read('sql/instalar_atualizacoes.sql').replace(/\r\n/g,'\n'),bundle(),'rode node scripts/gerar-instalacao.mjs');
});

test('aluno e Tico: o comportamento é testado no navegador (tests/browser.mjs); aqui só o essencial dos arquivos',()=>{
 for(const badge of ['Céu limpo','1 semana','1 mês','Bimestre','Ficha limpa']) assert.ok(app.includes(`'${badge}'`),badge);
 assert.match(read('assets/tico.js'),/prefers-reduced-motion: reduce/);
 assert.ok(html.indexOf('assets/tico.js')<html.indexOf('assets/boot.js'),'tico.js antes do boot.js');
 assert.ok(css.includes('animation-duration:.001ms!important;animation-iteration-count:1!important'),'reduzir movimento desliga as animações');
});

test('calendário escolar e fila sem internet: arquivos de banco e de instalação em dia',()=>{
 const cal=read('sql/14_calendario_escolar.sql');
 assert.match(cal,/enable row level security/);
 assert.match(cal,/Somente a Direção altera o calendário escolar/);
 assert.ok(read('.github/workflows/verify.yml').includes('sql/13_equipe_e_otimizacao.sql'),'atualização 13 no teste do GitHub');
 assert.ok(read('.github/workflows/verify.yml').includes('sql/14_calendario_escolar.sql'),'atualização 14 no teste do GitHub');
});
