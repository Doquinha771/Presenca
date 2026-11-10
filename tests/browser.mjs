import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {fixture} from './browser-fixture.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const server=http.createServer(async(req,res)=>{try{const relative=decodeURIComponent(new URL(req.url,'http://x').pathname).replace(/^\/presenca\//,'/');const file=path.resolve(root,'.'+(relative==='/'?'/index.html':relative));if(!file.startsWith(root+path.sep))throw Error();const body=await fs.readFile(file);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':file.endsWith('.svg')?'image/svg+xml':'text/html');res.end(body);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/presenca/`;
const browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.PRESENCA_BROWSER_PATH?{executablePath:process.env.PRESENCA_BROWSER_PATH}:{})});let checks=0;const errors=[];
async function setup(role='admin',width=1366,signedOut=false,annual=false){const context=await browser.newContext({viewport:{width,height:900}});await context.addInitScript(({role,signedOut,annual})=>{window.__testRole=role;window.__signedOut=signedOut;window.__annualFixture=annual;window.__pendingStudent=annual&&role==='aluno';},{role,signedOut,annual});await context.route('https://cdn.jsdelivr.net/**',r=>r.fulfill({contentType:'text/javascript',body:fixture}));const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.locator(signedOut?'#authView':'#dashboard').waitFor({state:'visible'});return {context,page};}
try{
 const {context,page}=await setup();
 for(const name of ['overview','entry','students','history','enrollments','classes','team','adjustments','announcements','archive','period','audit','privacy','reports','storage','calendar']){await page.goto(base+'#/'+name);await page.waitForFunction(()=>!document.getElementById('view').hasAttribute('aria-busy'));const navLink=page.locator(`#nav [data-page="${name}"]`);if(await navLink.count())assert.equal(await navLink.first().evaluate(el=>el.classList.contains('active')),true,`menu ${name} deveria estar ativo`);assert.equal(await page.locator('#view').getByText('Não foi possível carregar os dados',{exact:true}).count(),0);checks++;}
 // As três abas continuam dentro de Alunos; a sidebar também oferece atalhos para Cadastros e Turmas.
 await page.goto(base+'#/enrollments');
 await page.waitForFunction(()=>document.querySelector('.student-tabs button.selected')?.dataset.id==='enrollments');
 assert.equal(await page.locator('#nav [data-page="enrollments"]').count(),1);
 assert.equal(await page.locator('#nav [data-page="students"]').count(),1);
 assert.equal(await page.locator('.student-tabs button').count(),3);
 assert.equal(await page.locator('[data-action="students-tab"][data-id="enrollments"]').count(),1);
 assert.equal(await page.locator('#studentClassManager').count(),0);
 assert.equal(await page.locator('#applicationsTitle').count(),1);
 assert.equal(await page.locator('.application-card').count(),1);
 await page.locator('[data-action="enrollment-from-application"]').click();
 assert.equal(await page.locator('#modal [name="ra"]').inputValue(),'0000222');
 assert.equal(await page.locator('#modal [name="email"]').inputValue(),'0000222@al.educacao.sp.gov.br');
 await page.locator('#modal').evaluate(el=>el.close());
 await page.locator('[data-action="students-tab"][data-id="classes"]').click();
 await page.waitForFunction(()=>document.querySelector('.student-tabs button.selected')?.dataset.id==='classes');
 assert.equal(await page.locator('#studentClassManager').count(),1);
 assert.equal(await page.locator('#studentClassManager [data-action="class-edit"]').count(),1);
 assert.equal(await page.locator('[data-action="class-new"]').count(),1);
 await page.locator('#studentClassManager [data-action="class-edit"]').click();
 assert.equal(await page.locator('#modalTitle').innerText(),'Editar série e turma');
 await page.locator('#modal').evaluate(el=>el.close());
 await page.locator('[data-action="students-tab"][data-id="list"]').click();
 await page.waitForFunction(()=>document.querySelector('.student-tabs button.selected')?.dataset.id==='list');
 assert.equal(await page.locator('.student-reference-top-action [data-action="enrollment-new"]').count(),1);
 await page.goto(base+'#/classes');
 await page.waitForFunction(()=>document.querySelector('.student-tabs button.selected')?.dataset.id==='classes');
 await page.goto(base+'#/students');
 await page.waitForFunction(()=>document.querySelector('.student-tabs button.selected')?.dataset.id==='list');
 checks++;
 await page.goto(base+'#/reports');
 await page.locator('[data-action="export-report"]').waitFor();
 const downloadPromise=page.waitForEvent('download');
 await page.locator('[data-action="export-report"]').click();
 const download=await downloadPromise;
 assert.match(download.suggestedFilename(),/\.xlsx$/);
 const exported=await fs.readFile(await download.path());
 assert.equal(exported.subarray(0,4).toString('hex'),'504b0304');
 assert.equal(await page.evaluate(()=>window.__calls.some(x=>x.name==='portal_import_batch')),false);
 checks++;
 await page.goto(base+'#/history');await page.waitForFunction(()=>document.querySelector('table'));assert.equal(await page.locator('#view img').count(),0);assert.match(await page.locator('#view').innerText(),/<img src=x/);checks++;
 await page.goto(base+'#/entry');await page.locator('#entrySearch').fill('João');await page.locator('[data-pick="0"]').waitFor();await page.locator('#entrySearch').press('ArrowDown');await page.locator('#entrySearch').press('Enter');await page.locator('#recordBtn').press('Enter');await page.getByText('Atraso registrado.',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.__calls.filter(c=>c.args.p_action==='record').length),1);assert.equal(await page.locator('#entrySearch').inputValue(),'');checks++;
 await page.goto(base+'#/students');await page.locator('[data-action="student-manage"]').click();await page.locator('#modal [data-action="chance"]').click();await page.locator('#modal textarea').fill('Responsável compareceu à escola.');await page.locator('#modal button[type=submit]').click();await page.waitForFunction(()=>window.__calls.some(c=>c.args.p_action==='chance'));checks++;
 await page.goto(base+'#/overview');await page.waitForFunction(()=>document.querySelector('.staff-home'));await page.screenshot({path:path.join(root,'tests/desktop.png'),fullPage:true});
 assert.equal(await page.locator('#refresh').count(),0);assert.equal(await page.locator('#theme').isVisible(),true);checks++;
 await context.close();
 for(const role of ['aluno','secretaria','admin']){const {context,page}=await setup(role,390);for(const route of role==='admin'?['overview','students','history','period','reports']:role==='secretaria'?['entry','history','reports']:['overview','achievements','history','announcements']){await page.goto(base+'#/'+route);await page.locator('#dashboard').waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('#view').hasAttribute('aria-busy'));const navLink=page.locator(`#nav [data-page="${route}"]`);if(await navLink.count())assert.equal(await navLink.first().evaluate(el=>el.classList.contains('active')),true,`${role}/${route} deveria estar ativo quando visível na sidebar`);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),role+'/'+route+' overflow');checks++;}if(role==='secretaria'){
 await page.goto(base+'#/students');await page.locator('[data-action="students-tab"][data-id="classes"]').click();
 await page.waitForFunction(()=>document.querySelector('.student-tabs button.selected')?.dataset.id==='classes');
 assert.equal(await page.locator('#studentClassManager').count(),1);
 assert.equal(await page.locator('[data-action="class-new"]').count(),0);
 assert.equal(await page.locator('[data-action="class-edit"]').count(),0);checks++;
 }
 if(role==='aluno'){await page.goto(base+'#/achievements');await page.locator('.ach-grid').waitFor();assert.equal(await page.locator('.ach-card').count(),10);assert.equal(await page.locator('#mobileNav [data-page="achievements"]').count(),1);checks++;await page.goto(base+'#/reports');await page.waitForFunction(()=>document.querySelector('#nav a.active')?.dataset.page==='overview');assert.equal(await page.locator('#nav [data-page=reports]').count(),0);checks++;await page.goto(base+'#/team');await page.waitForFunction(()=>document.querySelector('#nav a.active')?.dataset.page==='overview');assert.equal(await page.locator('#nav [data-page="team"]').count(),0);checks++;}if(role==='admin'){await page.goto(base+'#/overview');await page.waitForFunction(()=>document.querySelector('.staff-home'));await page.screenshot({path:path.join(root,'tests/mobile.png'),fullPage:true});}await page.reload();await page.locator('#dashboard').waitFor();checks++;await context.setOffline(true);await page.locator('#connection').waitFor({state:'visible'});checks++;await context.close();}
 // Renovação anual: aluno pendente entra na conta sem acessar painel escolar.
 {
  const {context:pendingContext,page:pendingPage}=await setup('aluno',390,false,true);
  await pendingPage.locator('#annualPendingTitle').waitFor();
  assert.match(await pendingPage.locator('#view').innerText(),/Última matrícula/i);
  assert.equal(await pendingPage.locator('[data-action="annual-history"]').count(),1);
  await pendingPage.locator('[data-action="annual-history"]').click();
  await pendingPage.waitForFunction(()=>location.hash==='#/history');
  await pendingPage.locator('.history-card').first().waitFor();
  await pendingContext.close();checks++;
 }
 // Secretaria enxerga a fila dentro de Alunos, com série prevista e turma selecionável.
 {
  const {context:yearContext,page:yearPage}=await setup('secretaria',1280,false,true);
  await yearPage.goto(base+'#/students');
  // O atalho de renovação aparece direto na lista, sem abrir painel extra.
  await yearPage.locator('[data-action="renewal-show"]').click();
  await yearPage.locator('#renewalTitle').waitFor();
  assert.equal(await yearPage.locator('[data-action="annual-renew"]').count(),1);
  await yearPage.locator('[data-action="annual-renew"]').click();
  assert.equal(await yearPage.locator('#renewalClass option').count(),2);
  assert.match(await yearPage.locator('#renewalHint').innerText(),/Série calculada automaticamente/i);
  await yearContext.close();checks++;
 }
 // A casca desktop deve ser a mesma em resoluções diferentes, sem rolagem horizontal da página.
 for(const width of [780,900,1024,1100,1280,1366,1600,1920,2560]){
  const {context,page}=await setup('admin',width);
  for(const route of ['overview','students','enrollments','history','reports','classes','period']){
   await page.goto(base+'#/'+route);
   await page.waitForFunction(()=>!document.getElementById('view').hasAttribute('aria-busy'));
   const d=await page.evaluate(()=>({w:innerWidth,doc:document.documentElement.scrollWidth,layout:document.getElementById('dashboard').getBoundingClientRect().right,sideClosed:getComputedStyle(document.querySelector('#sidebar')).visibility==='hidden'}));
   assert.ok(d.doc<=d.w+1,`desktop/${route} ${width}px overflow: ${d.doc}px`);
   assert.ok(d.layout<=d.w+1,`desktop/${route} ${width}px layout fora da tela`);
   // O painel da conta fica fechado até a pessoa abrir; nunca cobre a página sozinho.
   assert.ok(d.sideClosed,`desktop/${route} ${width}px painel da conta aberto sem pedir`);
   checks++;
  }
  await context.close();
 }
 // Regressão: nomes longos no perfil não podem criar rolagem lateral no painel da Direção.
 for(const width of [320,390,430,780,900]){
  const {context,page}=await setup('admin',width);
  await page.goto(base+'#/overview');
  await page.waitForFunction(()=>!document.getElementById('view').hasAttribute('aria-busy'));
  const dimensions=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,profileRight:document.querySelector('.topbar-tools').getBoundingClientRect().right}));
  assert.ok(dimensions.document<=dimensions.viewport+1,`admin/overview ${width}px overflow: ${dimensions.document}px`);
  if(width<780)assert.ok(dimensions.profileRight<=dimensions.viewport+1,`admin/overview ${width}px perfil fora da tela`);
  checks++;
  await context.close();
 }
 // Link de trocar senha do e-mail: o site confere o código e abre a tela de nova senha (sem passar por localhost).
 {const {context,page}=await setup('aluno',390,true);await page.goto(base+'?token_hash=abc123&type=recovery');await page.locator('#authTitle',{hasText:'Definir nova senha'}).waitFor();assert.deepEqual(await page.evaluate(()=>window.__verify),{token_hash:'abc123',type:'recovery'});assert.equal(await page.evaluate(()=>location.search),'');assert.equal(await page.locator('#emailField').isVisible(),false);await page.locator('[name="password"]').fill('NovaSenha123!');await page.locator('#authSubmit').click();await page.getByText('Senha alterada. Entre com a nova senha.',{exact:true}).waitFor();checks++;await page.goto('about:blank');await page.goto(base+'#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');await page.getByText('Este link expirou ou já foi usado. Peça um novo link abaixo.',{exact:true}).waitFor();checks++;await page.evaluate(()=>{window.__otpFail=true;});await context.addInitScript(()=>{window.__otpFail=true;});await page.goto(base+'?token_hash=velho&type=recovery');await page.locator('#authTitle',{hasText:'Recuperar senha'}).waitFor();await page.getByText('Este link expirou ou já foi usado. Peça um novo link abaixo.',{exact:true}).waitFor();checks++;await context.close();}
 {const {context,page}=await setup('aluno',390,true);await page.locator('[data-auth="signup"]').click();await page.locator('[name="name"]').fill('João Pedro');await page.locator('[name="ra"]').fill('0000111');await page.locator('[name="grade"]').fill('3º A');await page.locator('[name="birth"]').fill('2007-12-27');await page.locator('[name="email"]').fill('0000111@al.educacao.sp.gov.br');await page.locator('[name="password"]').fill('Teste-123456');await page.locator('[name="consent"]').check();await page.locator('#authSubmit').click();await page.waitForFunction(()=>window.__signup);assert.equal(await page.evaluate(()=>window.__signup.options.data.ra),'0000111');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(root,'tests/login.png'),fullPage:true});checks++;await context.close();}
 // ---------- Comportamento: o que a pessoa vê e faz, sem depender do texto do código ----------
 // Fila sem internet: o atraso fica pendente no aparelho e é enviado uma vez só quando a conexão volta.
 {const {context,page}=await setup('admin');await page.goto(base+'#/entry');await page.locator('#entrySearch').fill('João');await page.locator('[data-pick="0"]').waitFor();await page.locator('#entrySearch').press('ArrowDown');await page.locator('#entrySearch').press('Enter');
  await context.setOffline(true);await page.locator('#recordBtn').click();await page.locator('#pendingQueue',{hasText:'1 atraso pendente de envio'}).waitFor();
  assert.equal(await page.evaluate(()=>window.__calls.filter(c=>c.args?.p_action==='record').length),0,'sem internet nada vai para o banco');
  assert.equal(await page.locator('#connection').isVisible(),true,'faixa de sem internet aparece');
  await context.setOffline(false);await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.locator('#pendingQueue').waitFor({state:'hidden'});
  const sent=await page.evaluate(()=>window.__calls.filter(c=>c.args?.p_action==='record'));assert.equal(sent.length,1,'enviado uma vez ao voltar');assert.match(sent[0].args.p_args.reason,/Registrado sem internet às/);
  checks++;await context.close();}
 // Início do aluno: sequência sempre com número, Tico reage ao toque e escola da estação no topo.
 {const {context,page}=await setup('aluno');await page.goto(base+'#/overview');await page.locator('.s-streak .streak strong').waitFor();
  assert.match(await page.locator('.s-streak .streak strong').innerText(),/^\d+$/,'número de dias visível');
  const before=await page.locator('.s-message').innerText();await page.locator('.tico-btn').click();await page.waitForFunction(b=>document.querySelector('.s-message').textContent!==b,before);
  assert.equal(await page.locator('.tico.hop').count(),1,'Tico pula ao toque');
  const season=await page.evaluate(()=>document.documentElement.dataset.season);assert.ok(['primavera','verao','outono','inverno'].includes(season),'estação marcada');
  assert.ok((await page.evaluate(()=>getComputedStyle(document.querySelector('.page-head-inner'),'::after').backgroundImage)).includes(`escola-${season}.svg`),'escola da estação no topo');
  checks++;await context.close();}
 // Painel lateral: o botão visível do topo abre as áreas da Direção; calendário cadastra e lista.
 {const {context,page}=await setup('admin');await page.goto(base+'#/overview');await page.locator('.top-more').click();await page.locator('#sidebar.open').waitFor();
  await page.locator('#sidebar a[data-page="calendar"]').click();await page.locator('#calendarForm').waitFor();
  assert.ok(await page.locator('.calendar-list li',{hasText:'Proclamação da República'}).count()>=1,'dias sem aula listados');
  assert.equal(await page.locator('.calendar-list li',{hasText:'Férias'}).count(),1,'dias seguidos viram um período só');
  await page.locator('#calendarForm [name="from"]').fill('2026-11-20');await page.locator('#calendarForm [name="label"]').fill('Consciência Negra');await page.locator('#calendarForm button').click();await page.getByText('1 dia salvo no calendário.').waitFor();
  checks++;await context.close();}
 // Equipe: cada pessoa em um cartão e a própria conta sem botões de remover.
 {const {context,page}=await setup('admin');await page.goto(base+'#/team');await page.locator('.team-member').first().waitFor();
  assert.equal(await page.locator('.team-member',{hasText:'Sua conta'}).locator('[data-action="staff-remove"]').count(),0,'não dá para remover a si mesmo');
  checks++;await context.close();}
 // Login: a escola ocupa a lateral esquerda e não cobre o texto.
 {const {context,page}=await setup('aluno',1366,true);const art=await page.locator('.auth-art').boundingBox(),hero=await page.locator('.auth-hero').boundingBox(),pts=await page.locator('.auth-points').boundingBox();
  assert.ok(art.width>=hero.width*0.6,'escola larga');assert.ok(art.y>=pts.y+pts.height-2,'escola abaixo dos tópicos');checks++;await context.close();}
 assert.deepEqual(errors,[]);console.log(`${checks} verificações de navegador passaram (rede Supabase simulada).`);
}finally{await browser.close();server.close();}
