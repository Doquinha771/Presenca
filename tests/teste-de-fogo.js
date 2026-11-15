// Teste de fogo: uso contínuo e acelerado do portal (rode com tests/servidor-teste.mjs, ?papel=admin).
// Carregue no console: const s=document.createElement('script');s.src='/tests/teste-de-fogo.js';document.body.append(s);
// Resultado em window.__fogo (ações feitas, erros de JavaScript, avisos de erro mostrados na tela).
(()=>{
 const F=window.__fogo={start:Date.now(),acts:{},jsErrors:[],toastErrors:[],stuck:[],done:false};
 const ms=Number(window.__fogoMs)||180000,$=id=>document.getElementById(id),sleep=t=>new Promise(r=>setTimeout(r,t));
 const count=k=>F.acts[k]=(F.acts[k]||0)+1;
 addEventListener('error',e=>F.jsErrors.push(String(e.message)));
 addEventListener('unhandledrejection',e=>F.jsErrors.push('promise: '+String(e.reason?.message||e.reason)));
 new MutationObserver(list=>list.forEach(m=>m.addedNodes.forEach(n=>{if(n.classList?.contains('toast-error'))F.toastErrors.push(n.textContent.trim());}))).observe($('toasts'),{childList:true});
 const go=async(page)=>{location.hash='/'+page;await sleep(250);count('nav:'+page);};
 const idle=async()=>{for(let i=0;i<40&&$('view').getAttribute('aria-busy')==='true';i++)await sleep(50);if($('view').getAttribute('aria-busy')==='true')F.stuck.push(location.hash);};
 const closeModal=()=>{if($('modal').open)$('modal').close();};
 const ra=()=>String(Math.floor(1e11+Math.random()*9e11))+(Math.random()<.5?'sp':'');
 async function registrar(){
  await go('entry');await idle();
  const s=$('entrySearch');if(!s)return;
  s.value=['Jo','0000','João','xyz'][Math.floor(Math.random()*4)];s.dispatchEvent(new Event('input'));await sleep(120);
  $('entryResults')?.querySelector('[data-pick]')?.click();await sleep(60);
  if(!$('recordBtn')?.disabled){$('entryReason').value='Teste '+Date.now();$('entryForm').requestSubmit();count('atraso');await sleep(150);
   const undo=$('lastRecord')?.querySelector('[data-action=undo]');if(undo&&Math.random()<.3){undo.click();await sleep(100);closeModal();count('desfazer');}}
  else count('atraso-bloqueado');
 }
 async function cadastrar(){
  await go('students');await idle();
  $('view').querySelector('[data-action=enrollment-new]')?.click();await sleep(150);
  const f=$('modalBody')?.querySelector('form');if(!f||!$('modal').open)return;
  for(let i=0;i<3;i++){
   f.elements.name.value=['Ana','Bruno','Carla','Diego'][i%4]+'  da   Silva '+Math.floor(Math.random()*999);
   const r=ra();f.elements.ra.value=(Math.random()<.4?' '+r.toUpperCase().replace(/(\d{3})/,'$1.')+' ':r);f.elements.ra.dispatchEvent(new Event('input'));f.elements.ra.dispatchEvent(new Event('blur'));
   f.elements.birth.value='2009-0'+(1+i)+'-1'+i;
   if(!f.elements.class.value)f.elements.class.selectedIndex=1;
   const again=f.querySelector('[data-again]');f.requestSubmit(i<2&&again?again:undefined);count('cadastro');await sleep(220);
   if(!$('modal').open)break;
  }
  closeModal();
 }
 async function historico(){
  await go('history');await idle();
  const chips=[...$('view').querySelectorAll('[data-action=history-range],[data-action=history-status]')];
  chips[Math.floor(Math.random()*chips.length)]?.click();await sleep(150);await idle();
  const s=$('historyStudentSearch');if(s){s.value='jo';s.dispatchEvent(new Event('input'));}
  $('view').querySelector('[data-action=history-next]:not([disabled])')?.click();count('historico');await sleep(100);
 }
 async function comunicados(){
  await go('announcements');await idle();const s=$('announcementSearch');
  if(s){s.focus();for(const ch of 'bem'){s.value+=ch;s.dispatchEvent(new Event('input'));await sleep(30);}if(document.activeElement!==s)F.jsErrors.push('busca de comunicados perdeu o foco');}
  count('comunicados');
 }
 async function semInternet(){
  Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false});dispatchEvent(new Event('offline'));
  await registrar();
  Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>true});dispatchEvent(new Event('online'));await sleep(300);count('offline');
 }
 async function correria(){for(const p of ['overview','students','history','reports','team','approvals','calendar','storage','period','overview'])location.hash='/'+p;await sleep(400);await idle();count('correria');}
 const tasks=[registrar,registrar,registrar,cadastrar,cadastrar,historico,comunicados,correria,semInternet,async()=>{$('theme').click();count('tema');}];
 (async()=>{
  while(Date.now()-F.start<ms){
   try{await tasks[Math.floor(Math.random()*tasks.length)]();}catch(e){F.jsErrors.push('robô: '+e.message);}
   closeModal();
  }
  F.done=true;F.seconds=Math.round((Date.now()-F.start)/1000);
 })();
})();
