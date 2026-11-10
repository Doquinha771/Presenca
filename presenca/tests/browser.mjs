import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fixture} from './browser-fixture.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');}
const root=path.resolve(new URL('..',import.meta.url).pathname);
const server=http.createServer(async(req,res)=>{try{const relative=decodeURIComponent(new URL(req.url,'http://x').pathname).replace(/^\/presenca\//,'/');const file=path.resolve(root,'.'+(relative==='/'?'/index.html':relative));if(!file.startsWith(root+path.sep))throw Error();const body=await fs.readFile(file);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html');res.end(body);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/presenca/`;
const browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.PRESENCA_BROWSER_PATH?{executablePath:process.env.PRESENCA_BROWSER_PATH}:{})});let checks=0;const errors=[];
async function setup(role='admin',width=1366,signedOut=false,annual=false){const context=await browser.newContext({viewport:{width,height:900}});await context.addInitScript(({role,signedOut,annual})=>{window.__testRole=role;window.__signedOut=signedOut;window.__annualFixture=annual;window.__pendingStudent=annual&&role==='aluno';},{role,signedOut,annual});await context.route('https://cdn.jsdelivr.net/**',r=>r.fulfill({contentType:'text/javascript',body:fixture}));const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.locator(signedOut?'#authView':'#dashboard').waitFor({state:'visible'});return {context,page};}
try{
 const {context,page}=await setup();
 for(const name of ['overview','entry','students','history','enrollments','classes','team','adjustments','announcements','archive','period','audit','privacy','reports']){await page.goto(base+'#/'+name);await page.waitForFunction(()=>!document.getElementById('view').hasAttribute('aria-busy'));const navLink=page.locator(`#nav [data-page="${name}"]`);if(await navLink.count())assert.equal(await navLink.first().evaluate(el=>el.classList.contains('active')),true,`menu ${name} deveria estar ativo`);assert.equal(await page.locator('#view').getByText('Não foi possível carregar os dados',{exact:true}).count(),0);checks++;}
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
 await page.goto(base+'#/overview');await page.waitForFunction(()=>document.querySelector('.metrics'));await page.screenshot({path:path.join(root,'tests/desktop.png'),fullPage:true});
 assert.equal(await page.locator('#refresh').count(),0);assert.equal(await page.locator('#theme').isVisible(),true);checks++;
 await context.close();
 for(const role of ['aluno','secretaria','admin']){const {context,page}=await setup(role,390);for(const route of role==='admin'?['overview','students','history','period','reports']:role==='secretaria'?['entry','history','reports']:['overview','history','announcements']){await page.goto(base+'#/'+route);await page.locator('#dashboard').waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('#view').hasAttribute('aria-busy'));const navLink=page.locator(`#nav [data-page="${route}"]`);if(await navLink.count())assert.equal(await navLink.first().evaluate(el=>el.classList.contains('active')),true,`${role}/${route} deveria estar ativo quando visível na sidebar`);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),role+'/'+route+' overflow');checks++;}if(role==='secretaria'){
 await page.goto(base+'#/students');await page.locator('[data-action="students-tab"][data-id="classes"]').click();
 await page.waitForFunction(()=>document.querySelector('.student-tabs button.selected')?.dataset.id==='classes');
 assert.equal(await page.locator('#studentClassManager').count(),1);
 assert.equal(await page.locator('[data-action="class-new"]').count(),0);
 assert.equal(await page.locator('[data-action="class-edit"]').count(),0);checks++;
 }
 if(role==='aluno'){await page.goto(base+'#/reports');await page.waitForFunction(()=>document.querySelector('#nav a.active')?.dataset.page==='overview');assert.equal(await page.locator('#nav [data-page=reports]').count(),0);checks++;await page.goto(base+'#/team');await page.waitForFunction(()=>document.querySelector('#nav a.active')?.dataset.page==='overview');assert.equal(await page.locator('#nav [data-page="team"]').count(),0);checks++;}if(role==='admin'){await page.goto(base+'#/overview');await page.waitForFunction(()=>document.querySelector('.metrics'));await page.screenshot({path:path.join(root,'tests/mobile.png'),fullPage:true});}await page.reload();await page.locator('#dashboard').waitFor();checks++;await context.setOffline(true);await page.locator('#connection').waitFor({state:'visible'});checks++;await context.close();}
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
  await yearPage.locator('[data-action="student-advanced"]').click();
  await yearPage.locator('#studentAdvancedPanel').waitFor({state:'visible'});
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
   const d=await page.evaluate(()=>({w:innerWidth,doc:document.documentElement.scrollWidth,layout:document.getElementById('dashboard').getBoundingClientRect().right,side:document.querySelector('#sidebar').getBoundingClientRect().right}));
   assert.ok(d.doc<=d.w+1,`desktop/${route} ${width}px overflow: ${d.doc}px`);
   assert.ok(d.layout<=d.w+1,`desktop/${route} ${width}px layout fora da tela`);
   assert.ok(d.side<d.w,`desktop/${route} ${width}px barra lateral ocupa a página inteira`);
   checks++;
  }
  await context.close();
 }
 // Regressão: nomes longos no perfil não podem criar rolagem lateral no painel da Direção.
 for(const width of [320,390,430,780,900]){
  const {context,page}=await setup('admin',width);
  await page.goto(base+'#/overview');
  await page.waitForFunction(()=>!document.getElementById('view').hasAttribute('aria-busy'));
  const dimensions=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,profileRight:document.querySelector('#pageProfile').getBoundingClientRect().right}));
  assert.ok(dimensions.document<=dimensions.viewport+1,`admin/overview ${width}px overflow: ${dimensions.document}px`);
  if(width<780)assert.ok(dimensions.profileRight<=dimensions.viewport+1,`admin/overview ${width}px perfil fora da tela`);
  checks++;
  await context.close();
 }
 {const {context,page}=await setup('aluno',390,true);await page.locator('[data-auth="signup"]').click();await page.locator('[name="name"]').fill('João Pedro');await page.locator('[name="ra"]').fill('0000111');await page.locator('[name="grade"]').fill('3º A');await page.locator('[name="birth"]').fill('2007-12-27');await page.locator('[name="email"]').fill('0000111@al.educacao.sp.gov.br');await page.locator('[name="password"]').fill('Teste-123456');await page.locator('[name="consent"]').check();await page.locator('#authSubmit').click();await page.waitForFunction(()=>window.__signup);assert.equal(await page.evaluate(()=>window.__signup.options.data.ra),'0000111');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(root,'tests/login.png'),fullPage:true});checks++;await context.close();}
 assert.deepEqual(errors,[]);console.log(`${checks} verificações de navegador passaram (rede Supabase simulada).`);
}finally{await browser.close();server.close();}
