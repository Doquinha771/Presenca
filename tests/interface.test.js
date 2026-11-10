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

test('desktop com navegação no topo; celular com barra inferior; conta e administração no painel',()=>{
 assert.match(css,/@media \(min-width:960px\)/);
 // Computador: cabeçalho fixo com navegação principal e botão da conta.
 assert.match(html,/<header class="site-header">[\s\S]*<nav id="topNav"[\s\S]*id="menu" class="account-btn"/);
 assert.match(css,/\.site-header\{position:sticky/);
 assert.match(css,/\.top-nav\{display:flex/);
 assert.match(app,/const topNav=\$\('topNav'\);if\(topNav\)topNav\.innerHTML=/);
 // O grupo principal não se repete no painel da conta no computador.
 assert.match(css,/#nav \.main-group\{display:none\}/);
 assert.match(css,/#mobileNav,\.desktop-hide\{display:none!important\}/);
 assert.match(css,/#sidebar\.open\{transform:none/);
 assert.match(css,/#mobileNav\{position:fixed/);
 // Tabelas viram cartões no celular e voltam a ser tabelas no computador.
 assert.match(css,/table\.responsive td::before\{content:attr\(data-label\)/);
 assert.match(css,/table\.responsive\{display:table\}/);
});

test('informações não se repetem entre cabeçalho, menu e página',()=>{
 assert.doesNotMatch(app,/id="dashboardSearch"|Ctrl \+ K|globalSearchInput/);
 assert.doesNotMatch(app,/Ações rápidas|reference-quick-grid|quick-links/);
 assert.doesNotMatch(app,/ÚLTIMA OCORRÊNCIA|student-row-check|data-action="student-more"/);
 assert.doesNotMatch(app,/history-code/);
 // Item que já está na barra inferior não reaparece dentro da gaveta do celular.
 assert.match(app,/inTabbar\.includes\(page\)\?'in-tabbar'/);
 assert.match(css,/#nav a\.in-tabbar\{display:none\}/);
 // Links jurídicos aparecem uma vez por tela.
 const auth=html.slice(html.indexOf('id="authView"'),html.indexOf('id="dashboard"'));
 assert.equal((auth.match(/href="\.\/termos\.html"/g)||[]).length,2); // aviso de leitura + rodapé
});

test('cabeçalho mostra o nome da área por extenso e as preferências de acessibilidade',()=>{
 assert.match(html,/<h1 id="pageTitle"><\/h1>/);
 assert.match(html,/id="theme"[^>]*aria-pressed="false"/);
 assert.match(html,/id="textSize"[^>]*aria-pressed="false"[^>]*><i class="fi fi-rr-glasses"/);
 assert.doesNotMatch(html,/A<sup>\+<\/sup>/);
 assert.match(app,/title\.textContent=home\?\(studentView\(\)\?`Olá, \$\{[^`]+\}!`:'Início'\):paths\[state\.page\]\[0\]/);
 assert.match(app,/const pageDescription=\$\('pageDescription'\);if\(pageDescription\)pageDescription\.textContent/);
 assert.match(css,/html:has\(body\.large-text\)\{font-size:122%\}/);
 assert.doesNotMatch(app,/\$\('refresh'\)|\$\(['"]areaName['"]\)/);
});

test('acessibilidade: foco visível, alvos de toque grandes e movimento reduzido',()=>{
 assert.match(css,/:focus-visible\{outline:3px solid var\(--focus\)/);
 // Alvos de toque de no mínimo 44px (WCAG 2.5.5 / diretrizes móveis), sem campos exagerados.
 assert.match(css,/\.primary,\.outline,\.danger\{[^}]*min-height:44px/);
 assert.match(css,/input,select,textarea\{width:100%;min-height:44px/);
 assert.match(css,/@media \(prefers-reduced-motion:reduce\)/);
 assert.match(css,/@media \(forced-colors:active\)/);
 assert.match(html,/class="skip" href="#content"/);
 assert.match(html,/id="revealPassword"[^>]*aria-label="Mostrar senha"/);
});

test('animações sutis, sem efeitos pesados e uma vez por rota',()=>{
 // Animações contínuas só existem na cena do clima/mascote (seção 17); o resto do site é calmo.
 const calm=css.replace(/\/\* ---------- 17\.[\s\S]*?(?=\/\* ---------- 14\.)/,'');
 assert.ok(calm.length<css.length,'seção 17 encontrada');
 assert.doesNotMatch(calm,/infinite|backdrop-filter|filter:\s*blur|transition:all/i);
 assert.match(app,/pendingRouteMotion=true;\$\('view'\)\.replaceChildren\(\)/);
 assert.match(app,/function playRouteMotion\(view,markupLength\)/);
 assert.match(app,/pendingRouteMotion=false;[\s\S]*?prefers-reduced-motion/);
 assert.match(app,/bindPage\(\);playRouteMotion\(view,html\.length\)/);
 assert.match(app,/markupLength>30000/);
 assert.match(app,/navigator\.connection\?\.saveData/);
});

test('área do aluno: situação em linguagem simples e gráficos compatíveis com a CSP',()=>{
 assert.match(app,/function renderStudentHome\(d,notes,recent\)/);
 for(const label of ['Tudo certo','Atenção','Limite atingido','Ver meu histórico','Avisos da escola','Últimos registros']) assert.ok(app.includes(label),label);
 assert.match(app,/function ringSvg\(/);
 // A CSP bloqueia style="" inline: medidores usam atributos SVG.
 assert.doesNotMatch(app,/style="/);
 assert.match(css,/\.s-home\{grid-template-columns:repeat\(12,minmax\(0,1fr\)\)/);
});

test('equipe: destaque do dia e indicadores reais, sem cartões vazios',()=>{
 assert.match(app,/function renderStaffHome\(d,notes,pendingApprovals=0\)/);
 for(const label of ['Na semana','No mês','Em atenção','Alunos']) assert.ok(app.includes(`['${label}'`),label);
 assert.match(app,/Atrasos nos últimos 14 dias/);
 assert.match(app,/dashboardTrendSvg/);
 assert.doesNotMatch(app,/Próximos eventos|Educação transforma realidades/);
});

test('Alunos mantém as três abas, filtros com menos passos e ações sem duplicar',()=>{
 assert.match(app,/sidebarMenus=\{/);
 assert.match(app,/\['enrollments','classes'\]\.includes\(p\)\?'students':p/);
 assert.match(app,/visiblePages=\(\)=>allowed\(\)\.filter\(page=>page!=='enrollments'&&page!=='classes'\)/);
 assert.match(app,/function studentHubHeader\(/);
 assert.match(app,/Cadastrar aluno','enrollment-new'/);
 assert.match(app,/Pendentes de renovação/);
 assert.match(app,/form\.querySelectorAll\('select'\)\.forEach\(select=>select\.onchange/);
 assert.match(app,/clear-student-filters/);
 assert.match(app,/clear-enrollment-search/);
 assert.match(app,/id="inlineClassForm"/);
 assert.match(app,/select.innerHTML=classesOptions\(chosen.id,false\)/);
 assert.match(app,/autoEmail/);
 assert.match(app,/Nome \(A → Z\)/);
});

test('histórico institucional mantém colunas, ações e paginação',()=>{
 for(const header of ['Quando','Aluno','Situação','Observação','Registrado por','Ações']) assert.ok(app.includes(`<th scope="col">${header}</th>`),header);
 assert.match(app,/studentView\(\)\?renderStudentHistory\(rows,await summary\):renderStaffHistory\(rows\)/);
 assert.match(app,/data-action="history-actions"/);
 for(const action of ["'undo'","'correct'","'forgive'","'all-history'","'clear-history-filters'","'history-prev'","'history-next'"]) assert.ok(app.includes(action));
 assert.match(app,/10 por página/);
});

test('ícones Uicons, rodapé com crédito e permissões preservadas',()=>{
 assert.match(html,/cdn-uicons\.flaticon\.com\/4\.0\.0/);
 assert.match(html,/Ícones Uicons por Flaticon/);
 assert.match(html,/feito pelos alunos do 3-A e com apoio da direção\./);
 assert.match(app,/fi fi-rr-/);
 assert.match(app,/const allowed=\(\)=>/);
 assert.match(app,/const read=\(kind,args=\{\}\)=>rpc\('portal_read'/);
 assert.match(app,/renderMobileNav\(\)/);
 assert.match(app,/\$\('dashboard'\)\.hidden=false/);
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
 assert.match(app,/\['approvals','Aprovações','approvals'\],\['team','Equipe','team'\]/);
 for(const a of ['staff-accept','staff-reject','student-reject','staff-remove','invite-cancel']) assert.ok(app.includes(`a==='${a}'`),a);
 assert.match(app,/Adicionar funcionário','invite','','primary'/);
 const sql=read('sql/13_equipe_e_otimizacao.sql');
 for(const a of ["'create'","'accept'","'reject'","'reject_student'","'remove'","'cancel_invite'","'set_password'"]) assert.ok(sql.includes('p_action='+a),a);
 assert.match(sql,/if uid=me\.id then raise exception/);
 assert.match(sql,/staff_pending/);
 assert.match(sql,/cron\.schedule\('presenca_storage_guard','17 \* \* \* \*'/);
});

test('histórico do aluno agrupado por mês e explícito sobre o que conta no limite',()=>{
 assert.match(app,/function renderStudentHistory\(rows,d=\{\}\)/);
 assert.match(app,/studentHistoryMonths\(rows\)/);
 for(const label of ['Conta no limite','Perdoado','Justificado','Anulado','Filtrar por data']) assert.ok(app.includes(label),label);
 assert.match(css,/\.lh-month \.history-card\{/);
});





test('menu: item escolhido e item sob o mouse ficam bem visíveis',()=>{
 assert.match(css,/\.top-nav a:hover::before\{background:/);
 assert.match(css,/\.top-nav a\.active::before\{background:var\(--primary-soft\)/);
 assert.match(css,/#nav a\.active::before\{/);
 assert.match(css,/#mobileNav a\.active::before\{/);
});

test('conquistas: página própria do aluno, fora do menu da equipe',()=>{
 assert.match(app,/achievements:\['Minhas conquistas'/);
 assert.match(app,/state\.me\?\.role==='aluno'\?\['overview','achievements','history','announcements'\]/);
 assert.match(app,/Object\.keys\(paths\)\.filter\(p=>p!=='achievements'\)/);
 assert.match(app,/function renderAchievements\(d,recent\)/);
 assert.match(app,/page==='achievements'\)\{const \[d,recent\]=await Promise\.all/);
 for(const m of ['Primeiro passo','Céu limpo','Longe do limite','1 semana','2 semanas','1 mês','Bimestre','Semestre','Volta por cima','Ficha limpa']) assert.ok(app.includes(`'${m}'`),m);
 // No Início fica só um atalho: as medalhas não se repetem.
 assert.match(app,/class="ach-link" href="#\/achievements"/);
 assert.doesNotMatch(app,/class="badges"/);
 // Barras com papel de progresso para leitores de tela.
 assert.match(app,/class="ach-bar" role="progressbar"/);
});

test('links dos e-mails: o portal confere o código e nunca depende de localhost',()=>{
 assert.match(app,/async function handleEmailLink\(\)/);
 assert.match(app,/db\.auth\.verifyOtp\(\{token_hash:tokenHash,type\}\)/);
 assert.match(app,/if\(!await handleEmailLink\(\)\)\{if\(recovering\)auth\('reset'\);else await loadSession\(\);\}/);
 assert.match(app,/Este link expirou ou já foi usado/);
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
 assert.match(app,/function setStudentMood\(tone\)/);
});

test('atualização do banco que falta: aviso único, sem travar o site, e arquivo de instalação em dia',async()=>{
 assert.match(app,/function setupCard\(feature\)/);
 assert.match(app,/html=st\?renderStorage\(st\):setupCard\(/);
 assert.match(app,/const migrationNotice=setupCard\(/);
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
