import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,SCHOOL_NAME} from '../config.js';
import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/+esm';
import {esc,dateBR,errorText,roleName,SCHOOL_EMAIL} from './utils.js';
const $=id=>document.getElementById(id);
if(!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(SUPABASE_URL)||!/^sb_publishable_/.test(SUPABASE_PUBLISHABLE_KEY))throw Error('Configuração inválida');
const db=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const state={academic:null,me:null,page:'overview',offset:0,rows:[],classes:[],selected:null,search:[],index:-1,historyStudent:'',request:null,report:null};
let reportFilter={kind:'students',class:'',grade:''};
let authMode='login',access='aluno',recovering=/(?:[?#&])type=recovery(?:[&#]|$)/.test(location.href),busy=false,renderToken=0,searchToken=0,authLoading=false;
// A animação de entrada pertence à troca de página, não a cada consulta ou digitação.
let pendingRouteMotion=false;
function playRouteMotion(view,markupLength){
 if(!pendingRouteMotion)return;
 pendingRouteMotion=false;
 // Respeita acessibilidade, economia de dados e evita camadas grandes em tabelas extensas.
 if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||navigator.connection?.saveData||markupLength>30000||typeof view.animate!=='function')return;
 view.animate([{opacity:.88,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:170,easing:'cubic-bezier(.2,.7,.2,1)'});
}
const paths={overview:['Visão geral','Resumo dos registros e avisos da escola.','M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z'],entry:['Registrar atraso','Localize o aluno e registre um atraso.','M12 8v4l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0'],students:['Alunos','Consulte alunos, matrículas, séries e turmas em um só lugar.','M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M20 8v6 M17 11h6'],history:['Histórico','Ocorrências preservadas, com suas correções e justificativas.','M4 3h16v18H4z M8 8h8 M8 12h8 M8 16h5'],enrollments:['Matrículas','Autorize o cadastro e mantenha os dados escolares.','M4 4h16v16H4z M8 8h8 M8 12h8 M8 16h4'],classes:['Séries e turmas','Cadastre turmas e consulte seus estudantes.','M3 21V7l9-5 9 5v14 M9 21v-7h6v7 M7 9h1 M16 9h1'],team:['Equipe','Gerencie os acessos da equipe escolar.','M4 21v-3a5 5 0 0 1 10 0v3 M13 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M17 4a4 4 0 0 1 0 8 M18 15a4 4 0 0 1 3 4v2'],adjustments:['Novas chances e ajustes','Consulte alterações e justificativas registradas.','M4 5h16v14H4z M8 10h8 M12 6v8'],announcements:['Comunicados','Consulte e publique avisos da escola.','M3 10v4h4l11 5V5L7 10z M7 14l2 7'],archive:['Arquivo escolar','Consulte matrículas encerradas e histórico.','M3 3h18v5H3z M5 8v13h14V8 M9 12h6'],period:['Período e regras','Gerencie os períodos e as regras da escola.','M4 5h16v16H4z M8 2v6 M16 2v6 M4 10h16'],audit:['Auditoria','Consulte as operações administrativas.','M5 3h14v18H5z M9 7h6 M9 12h6 M9 17h6'],reports:['Relatórios Excel','Gere planilhas conforme os filtros selecionados.','M4 4h16v16H4z M8 8h8 M8 12h8 M8 16h8'],privacy:['Privacidade','Consulte solicitações e incidentes de privacidade.','M12 2l8 4v6c0 5-8 10-8 10S4 17 4 12V6z M9 12l2 2 4-4']};
const staff=()=>Boolean(state.me && state.me.role!=='aluno');
const admin=()=>state.me?.role==='admin';
const studentView=()=>state.me?.role==='aluno';
const initials=name=>String(name||'').split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase()||'').join('')||'??';
const cap=s=>String(s||'').charAt(0).toUpperCase()+String(s||'').slice(1);
function longDateBR(value=new Date()){const date=value instanceof Date?value:new Date(value);return new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}).format(date).replace(/,/,',').replace(/^./,m=>m.toUpperCase());}
function shortDateTimeBR(value){const d=new Date(value);if(Number.isNaN(d.getTime()))return {date:'—',time:''};return {date:new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}).format(d),time:new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit'}).format(d)};}
function dashboardTrendSvg(rows){
 const list=Array.isArray(rows)?rows:[];const width=760,height=176,left=28,right=10,top=12,bottom=30;const max=Math.max(5,...list.map(x=>Number(x.total)||0));
 const step=list.length>1?(width-left-right)/(list.length-1):0;const y=v=>top+(height-top-bottom)*(1-(Number(v)||0)/max);
 const points=list.map((r,i)=>`${left+i*step},${y(r.total)}`).join(' ');
 const grid=Array.from({length:6},(_,i)=>{const val=Math.round(max-(max*i/5));const yy=top+(height-top-bottom)*(i/5);return `<g class="trend-grid"><line x1="${left}" y1="${yy}" x2="${width-right}" y2="${yy}"></line><text x="2" y="${yy+4}">${val}</text></g>`;}).join('');
 const labels=list.map((r,i)=>`<text class="trend-label" x="${left+i*step}" y="${height-7}" text-anchor="middle">${String(r.day||'').slice(8,10)}/${String(r.day||'').slice(5,7)}</text>`).join('');
 const dots=list.map((r,i)=>`<circle class="trend-dot" cx="${left+i*step}" cy="${y(r.total)}" r="4"></circle>`).join('');
 return `<svg class="dashboard-trend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Atrasos nos últimos 14 dias">${grid}<polyline class="trend-line" points="${points}"></polyline>${dots}${labels}</svg>`;
}
const allowed=()=>state.me?.role==='aluno'?['overview','history','announcements']:admin()?Object.keys(paths):['overview','entry','students','history','enrollments','reports','announcements'];
// Matrículas e séries/turmas ficam dentro de Alunos. As rotas antigas continuam aceitas.
const visiblePages=()=>allowed().filter(page=>page!=='enrollments'&&page!=='classes');
let studentsTab='list',enrollmentSearch='',signupApplications=[],signupApplicationsOffset=0;
let renewalView=false,renewalFilter='pending',renewalSearch='',renewalOffset=0,renewalData=null;
let announcementFilter={query:'',type:'todos'};


// Flaticon Uicons: estilos carregados pela CDN oficial, com atribuição no rodapé.
const iconNames={overview:'home',entry:'clock',students:'users',history:'time-past',enrollments:'document-signed',classes:'graduation-cap',team:'user-gear',adjustments:'document',announcements:'megaphone',archive:'archive',period:'calendar-clock',audit:'shield-check',reports:'file-excel',privacy:'shield',graduation:'graduation-cap',menu:'menu-burger',theme:'moon',refresh:'refresh',clock:'clock',limit:'chart-histogram',forgiven:'check-circle',announcement:'megaphone',calendar:'calendar',copy:'copy',chevron:'angle-right',back:'angle-left',quote:'quote-right',bell:'bell',users:'users',alert:'exclamation',flag:'flag',school:'school',search:'search',filter:'filter',download:'download',menuDots:'menu-dots-vertical',info:'info',plus:'plus'};
function uiIcon(name){return `<i class="fi fi-rr-${iconNames[name]||'document'}" aria-hidden="true"></i>`;}
const sidebarMenus={
 aluno:[['', [['overview','Início','overview'],['history','Histórico','history'],['announcements','Comunicados','announcements']]]],
 secretaria:[
  ['', [['overview','Início','overview'],['students','Alunos','students'],['history','Histórico','history'],['announcements','Comunicados','announcements'],['reports','Relatórios','reports']]],
  ['ADMINISTRAÇÃO',[['classes','Turmas','classes'],['enrollments','Cadastros','enrollments'],['period','Período e regras','period']]]
 ],
 admin:[
  ['', [['overview','Início','overview'],['students','Alunos','students'],['history','Histórico','history'],['announcements','Comunicados','announcements'],['reports','Relatórios','reports']]],
  ['ADMINISTRAÇÃO',[['classes','Turmas','classes'],['enrollments','Cadastros','enrollments'],['period','Período e regras','period'],['privacy','Privacidade','privacy'],['audit','Auditoria','audit']]]
 ]
};
function renderSidebarNav(){
 const groups=sidebarMenus[state.me.role]||sidebarMenus.aluno;
 $('nav').innerHTML=groups.map(([label,items])=>{
   const links=items.filter(([page])=>allowed().includes(page)).map(([page,text,icon])=>`<a href="#/${page}" data-page="${page}"><span class="nav-icon" aria-hidden="true">${uiIcon(icon)}</span><span>${esc(text)}</span></a>`).join('');
   return links?`<div class="nav-group">${label?`<p class="nav-heading">${label}</p>`:''}${links}</div>`:'';
 }).join('');
}

// A identificação fica somente na barra lateral, sem um segundo perfil no cabeçalho.
function renderPageProfile(){const el=$('pageProfile');if(el){el.replaceChildren();el.hidden=true;}}

// O cabeçalho concentra somente o ícone da área, o tema e a atualização.
// A pesquisa fica exclusivamente no formulário da página correspondente.
function renderHeaderChrome(){
 const title=$('pageTitle');
 if(title&&state.me){const label=paths[state.page][0];title.innerHTML=uiIcon(state.page);title.setAttribute('aria-label',label);title.title=label;}
 const utility=$('pageUtility');
 if(utility){
  utility.replaceChildren();utility.hidden=true;
  if(staff()&&['overview','students','history'].includes(state.page)){
   utility.innerHTML=`<form id="dashboardSearch" class="dashboard-search" role="search"><span class="dashboard-search-icon">${uiIcon('search')}</span><input id="dashboardSearchInput" type="search" autocomplete="off" value="${esc(studentsFilter.search||'')}" placeholder="Buscar aluno por nome, RA ou turma…" aria-label="Buscar aluno por nome, RA ou turma"><kbd aria-hidden="true">Ctrl + K</kbd><button type="submit" class="sr-only">Buscar</button></form>`;
   utility.hidden=false;
   const form=$('dashboardSearch');if(form)form.onsubmit=e=>{e.preventDefault();const input=$('dashboardSearchInput');const term=input?.value.trim()||'';const q=term.toLocaleLowerCase('pt-BR');const room=q?state.classes.find(c=>`${c.grade} ${c.name}`.toLocaleLowerCase('pt-BR').includes(q)):null;state.offset=0;if(state.page==='history'){historySearch=term;historyFilter={...historyFilter,class:room?.id||historyFilter.class||''};void render();return;}studentsFilter=room?{search:'',class:room.id,situation:''}:{...studentsFilter,search:term};studentsTab='list';if(state.page==='students')void render();else location.hash='#/students';};
  }
 }
 const status=$('pageStatusCard');if(status){status.replaceChildren();status.hidden=true;}
 const campus=$('sidebarCampus');if(campus)campus.replaceChildren();
}
window.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'&&state.me&&staff()&&['overview','students','history'].includes(state.page)){event.preventDefault();$('dashboardSearchInput')?.focus();}});
function historyStatus(r){
 if(r.status==='void')return ['Anulado','status-void'];
 if(r.status==='forgiven')return ['Perdoado','status-forgiven'];
 if(r.justified)return ['Justificado','status-justified'];
 return ['Registrado','status-active'];
}
function historyBadge(r){const [label,tone]=historyStatus(r);return `<span class="history-status ${tone}">${label}</span>`;}
function historyType(r){
 if(r.change_reason)return ['Correção','document'];
 if(r.justified)return ['Justificativa','enrollments'];
 return ['Atraso','calendar'];
}
function historyDateParts(value){
 const d=new Date(value);if(Number.isNaN(d.getTime()))return {date:'—',time:''};
 return {date:new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'America/Sao_Paulo'}).format(d),time:new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'}).format(d)};
}
async function hydrateHistoryRa(rows){
 const ids=[...new Set(rows.filter(r=>!r.ra).map(r=>r.student_id).filter(Boolean))];
 if(!ids.length||typeof db.from!=='function')return rows;
 try{
  const {data,error}=await db.from('profiles').select('id,ra').in('id',ids);
  if(error||!Array.isArray(data))return rows;
  const byId=new Map(data.map(p=>[p.id,p.ra]));
  return rows.map(r=>r.ra?r:{...r,ra:byId.get(r.student_id)||''});
 }catch{return rows;}
}
function historyClassName(r){
 const label=String(r.grade||'');
 const room=state.classes.find(c=>label===c.grade+' • '+c.name);
 return room?room.grade+' • '+room.name:label||'Turma não informada';
}
function historyFilteredRows(rows){
 const q=historySearch.trim().toLocaleLowerCase('pt-BR');
 if(!q)return rows;
 return rows.filter(r=>`${r.full_name||''} ${r.ra||''} ${historyClassName(r)}`.toLocaleLowerCase('pt-BR').includes(q));
}
function renderHistoryRows(rows){
 const ordered=historyOrder==='oldest'?[...rows].reverse():rows;
 return ordered.slice(0,historyPageSize).map(r=>{
  const dt=historyDateParts(r.occurred_at),[type,typeIcon]=historyType(r);
  const menu=`<button type="button" class="history-menu-btn" data-action="history-actions" data-id="${esc(r.id)}" aria-label="Ações do registro de ${esc(r.full_name)}" title="Ações deste registro">${uiIcon('menuDots')}</button>`;
  return `<tr><td class="history-date" data-label="Data e hora"><strong>${dt.date}, ${dt.time}</strong></td><td class="history-student" data-label="Aluno"><strong>${esc(r.full_name)}</strong>${r.ra?`<small>RA ${esc(r.ra)}</small>`:''}</td><td class="history-class" data-label="Turma">${esc(historyClassName(r))}</td><td class="history-type" data-label="Tipo"><span>${uiIcon(typeIcon)}</span>${type}</td><td data-label="Situação">${historyBadge(r)}</td><td class="history-comment" data-label="Observação">${esc(r.reason||'—')}${r.change_reason?`<small>Alteração: ${esc(r.change_reason)}</small>`:''}</td><td data-label="Responsável">${esc(r.operator_name||'Sistema')}</td><td class="history-action-cell" data-label="Ações">${menu}</td></tr>`;
 }).join('')||'<tr><td colspan="8" class="history-empty">Nenhum registro encontrado para os filtros selecionados.</td></tr>';
}
function historyReferencePager(rows){
 const page=Math.floor(state.offset/historyPageSize)+1;
 const knownTotal=rows.length<25?Math.max(page,Math.ceil((state.offset+rows.length)/historyPageSize)):null;
 return `<div class="history-reference-pager"><label class="history-page-size"><select id="historyPageSize" aria-label="Itens por página"><option value="10" ${historyPageSize===10?'selected':''}>10 por página</option><option value="15" ${historyPageSize===15?'selected':''}>15 por página</option><option value="20" ${historyPageSize===20?'selected':''}>20 por página</option></select></label><div class="history-page-nav"><button type="button" class="outline" data-action="history-prev" ${state.offset===0?'disabled':''}>${uiIcon('back')} <span>Anterior</span></button><strong>Página ${page}${knownTotal?' de '+knownTotal:''}</strong><button type="button" class="outline" data-action="history-next" ${rows.length<=historyPageSize?'disabled':''}><span>Próxima</span> ${uiIcon('chevron')}</button></div></div>`;
}
function renderStaffHistory(rows){
 const filtered=historyFilteredRows(rows),shown=filtered.slice(0,historyPageSize),n=shown.length;
 return `<section class="panel history-filter-panel" aria-labelledby="historyFilterTitle">
  <div class="history-panel-head"><div class="history-title"><span class="history-heading-icon">${uiIcon('filter')}</span><h2 id="historyFilterTitle">Filtros de busca</h2></div><div class="history-filter-actions"><button type="button" class="outline history-clear" data-action="clear-history-filters">${uiIcon('refresh')} Limpar filtros</button><button type="submit" form="historyFilters" class="primary history-filter-submit">${uiIcon('search')} Aplicar filtros</button></div></div>
  <form id="historyFilters" class="history-filter-grid">
   <label class="history-period-label">Período<div class="history-period-control"><span>${uiIcon('calendar')}</span><input id="fromDate" name="from" type="date" value="${esc(historyFilter.from||'')}"><b aria-hidden="true">→</b><input id="toDate" name="to" type="date" value="${esc(historyFilter.to||'')}"></div></label>
   <label>Aluno<div class="history-search-control"><span>${uiIcon('search')}</span><input id="historyStudentSearch" type="search" value="${esc(historySearch)}" placeholder="Nome ou RA…" autocomplete="off"></div></label>
   <label>Turma<select id="historyClass" name="class">${classesOptions(historyFilter.class)}</select></label>
   <label>Situação<select id="historyStatus" name="status"><option value="">Todas</option><option value="active">Registrados</option><option value="forgiven">Perdoados</option><option value="void">Anulados</option></select></label>
  </form>${state.historyStudent?`<div class="history-current-student">Histórico individual selecionado. ${button('Mostrar todos','all-history')}</div>`:''}
 </section>
 <section class="panel history-results-panel" aria-labelledby="historyResultsTitle"><div class="history-results-head"><div class="history-results-caption"><span class="history-heading-icon">${uiIcon('history')}</span><h2 id="historyResultsTitle">Registros encontrados</h2><span class="history-count">${n} ${n===1?'registro':'registros'}</span></div><label class="history-sort">Ordenar por <select id="historyOrder" aria-label="Ordenar registros"><option value="recent" ${historyOrder==='recent'?'selected':''}>Data (mais recente)</option><option value="oldest" ${historyOrder==='oldest'?'selected':''}>Data (mais antiga)</option></select></label></div>
 <div class="table-scroll history-table-wrap"><table class="responsive history-table"><thead><tr><th scope="col">Data e hora</th><th scope="col">Aluno</th><th scope="col">Turma</th><th scope="col">Tipo</th><th scope="col">Situação</th><th scope="col">Observação</th><th scope="col">Responsável</th><th scope="col">Ações</th></tr></thead><tbody id="historyRows">${renderHistoryRows(filtered)}</tbody></table></div>
 ${historyReferencePager(filtered)}</section>`;
}
function renderStudentHistory(rows){
 const filters=`<section class="panel filters-card"><div class="section-head"><h3>Filtros</h3><button type="button" class="link-lite" data-action="clear-history-filters">Limpar filtros</button></div><form id="historyFilters" class="filters mobile-history-filters"><label>De<input id="fromDate" type="date" value="${esc(historyFilter.from||'')}"></label><label>Até<input id="toDate" type="date" value="${esc(historyFilter.to||'')}"></label><label>Situação<select id="historyStatus"><option value="">Todas</option><option value="active">Válidos</option><option value="forgiven">Perdoados</option><option value="void">Anulados</option></select></label><button type="submit" class="primary">Filtrar</button></form></section>`;
 const header=`<div class="section-inline"><h3>Resultados <span class="result-count">${rows.length} ${rows.length===1?'registro':'registros'}</span></h3></div>`;
 const cards=rows.length?`<div class="history-stack">${rows.map((r,i)=>`<article class="history-card"><div class="history-card-top"><div><small>Data</small><strong>${dateBR(r.occurred_at)}</strong></div><span class="history-code">#${String(state.offset+i+1).padStart(4,'0')}</span></div><div class="history-grid"><div><small>Situação</small>${historyBadge(r)}</div><div><small>Observação</small><p>${esc(r.reason||'—')}</p>${r.change_reason?`<small class="muted">Alteração: ${esc(r.change_reason)}</small>`:''}</div><div><small>Responsável</small><p>${esc(r.operator_name||'Registro legado')}</p></div></div></article>`).join('')}</div>`:'<div class="panel empty-card"><strong>Nenhum outro registro encontrado.</strong><p>Tente ajustar os filtros ou o período de busca.</p></div>';
 return filters+header+cards+pager(rows);
}
function announcementTone(r){
 const text=((r.title||'')+' '+(r.body||'')).toLowerCase();
 if(/atividade|prova|bimestre|trabalho|acad[eê]mic/.test(text))return ['Acadêmico','tone-academic'];
 if(/evento|reuni[aã]o|semana|feira|palestra|encontro/.test(text))return ['Evento','tone-event'];
 if(/urgente|aten[cç][aã]o|importante|respons[aá]veis|prazo/.test(text))return ['Importante','tone-important'];
 return ['Geral','tone-general'];
}
function renderAnnouncements(rows){
 const filtered=rows.filter(r=>{const [tone]=announcementTone(r);const hit=!announcementFilter.query||((r.title||'')+' '+(r.body||'')).toLowerCase().includes(announcementFilter.query.toLowerCase());const kind=announcementFilter.type==='todos'||tone.toLowerCase()===announcementFilter.type;return hit&&kind;});
 const chips=[['todos','Todos'],['importante','Importantes'],['acadêmico','Acadêmicos'],['evento','Eventos']];
 const tools=`<section class="panel filters-card"><form id="announcementFilters" class="announcement-tools"><label class="search-field">Buscar comunicados<input id="announcementSearch" type="search" value="${esc(announcementFilter.query||'')}" placeholder="Buscar comunicados…"></label><div class="chip-row">${chips.map(([value,label])=>`<button type="button" class="chip ${announcementFilter.type===value?'active':''}" data-announcement-type="${value}">${label}</button>`).join('')}</div></form></section>`;
 const actions=admin()?`<div class="toolbar">${button('Publicar comunicado','announcement-new','','primary')}</div>`:'';
 const cards=filtered.length?filtered.map(r=>{const [label,klass]=announcementTone(r);return `<article class="announcement-card ${klass}"><div class="announcement-meta"><span class="pill ${klass}">${label}</span><small>${dateBR(r.created_at)}</small></div><h3>${esc(r.title)}</h3><p>${esc(r.body)}</p><div class="announcement-actions">${!r.active?'<small>Arquivado</small>':''}${admin()?button('Editar','announcement-edit',r.id):''}</div></article>`;}).join(''):'<div class="panel empty-card"><strong>Nenhum comunicado.</strong><p>Quando houver novos comunicados, eles aparecerão aqui.</p></div>';
 return `<section class="panel announcement-shell">${actions}${tools}<div class="announcement-list">${cards}</div>${pager(rows)}</section>`;
}
function renderMobileNav(){
 const shortcuts=state.me.role==='aluno'?['overview','history','announcements']:['overview','entry','students','history'];
 $('mobileNav').hidden=false;
 $('mobileNav').innerHTML=shortcuts.filter(k=>allowed().includes(k)).map(k=>`<a data-page="${k}" href="#/${k}" aria-label="${paths[k][0]}">${uiIcon(k)}<span>${k==='overview'?'Início':k==='entry'?'Atraso':paths[k][0]}</span></a>`).join('')+`<button type="button" id="mobileMore" aria-controls="sidebar" aria-expanded="false" aria-label="Mais opções">${uiIcon('menu')}<span>Mais</span></button>`;
 $('mobileMore').onclick=()=>toggleNavigation();
}
function closeNavigation(){
 $('sidebar').classList.remove('open');$('navScrim').hidden=true;
 $('menu').setAttribute('aria-expanded','false');$('mobileMore')?.setAttribute('aria-expanded','false');
}
function toggleNavigation(){
 const open=!$('sidebar').classList.contains('open');
 $('sidebar').classList.toggle('open',open);$('navScrim').hidden=!open;
 $('menu').setAttribute('aria-expanded',String(open));$('mobileMore')?.setAttribute('aria-expanded',String(open));
 if(open)$('sidebar').querySelector('a')?.focus();
}
$('navScrim').onclick=closeNavigation;
window.addEventListener('keydown',event=>{if(event.key==='Escape')closeNavigation();});
function msg(text,kind='success',target='flash'){const n=$(target);n.hidden=false;n.className='message '+kind;n.textContent=text;}
async function rpc(name,args){const {data,error}=await db.rpc(name,args);if(error){if(['PGRST301','PGRST303'].includes(error.code)){clearSession();msg('Sua sessão expirou. Entre novamente.','error','authMessage');}throw error;}return data;}
const read=(kind,args={})=>rpc('portal_read',{p_kind:kind,p_args:args});
const write=(action,args)=>rpc('portal_write',{p_action:action,p_args:args});
const readApplications=(offset=0,search='')=>rpc('portal_applications',{p_offset:offset,p_search:search});
async function academicState(){try{return await rpc('academic_portal_state',{});}catch(e){if(['PGRST202','42883'].includes(e?.code))return {year:new Date().getFullYear(),year_status:'open',pending:false,setup_missing:true};throw e;}}
const readRenewals=(status='pending',offset=0,search='')=>state.academic?.setup_missing?Promise.resolve({year:state.academic.year,year_status:'open',pending_count:0,rows:[]}):rpc('academic_renewals_list',{p_status:status,p_offset:offset,p_search:search});
const academicManage=(action,args={})=>state.academic?.setup_missing?Promise.reject(Error('Instale a migração de virada de ano no Supabase antes de usar esta função.')):rpc('academic_manage',{p_action:action,p_args:args});

const actionIcons={
 'prev':'back','next':'chevron','renewal-prev':'back','renewal-next':'chevron',
 'enrollment-new':'plus','enrollment-from-application':'enrollments',
 'class-new':'classes','class-edit':'classes','renewal-show':'refresh','renewal-hide':'back',
 'open-reports':'reports','export-report':'download','history':'history','annual-history':'history',
 'student-manage':'team','student-more':'menuDots','student-advanced':'filter','student-prev':'back','student-next':'chevron','retry':'refresh','invite':'team','role':'team',
 'announcement-new':'announcements','announcement-edit':'announcements','privacy-new':'privacy',
 'reset-period':'refresh','clear-student-filters':'filter','clear-enrollment-search':'search'
};
function button(label,action,id='',cls='outline'){
 const icon=actionIcons[action];
 return `<button type="button" class="${cls}" data-action="${action}" data-id="${esc(id)}">${icon?uiIcon(icon):''}<span>${esc(label)}</span></button>`;
}
function table(headers,rows){return rows.length?`<div class="table-scroll"><table class="responsive"><thead><tr>${headers.map(x=>`<th scope="col">${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows.map(cells=>`<tr>${cells.map((v,i)=>`<td data-label="${esc(headers[i])}">${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:'<div class="empty">Nenhum registro encontrado.</div>';}
function pager(rows){return `<div class="pager">${button('Anterior','prev')}<span>Página ${state.offset/25+1}</span>${button('Próxima','next')}</div>`;}
function bindPager(rows){const p=$('view').querySelector('[data-action=prev]'),n=$('view').querySelector('[data-action=next]');if(p)p.disabled=state.offset===0;if(n)n.disabled=rows.length<25;}
const status=s=>`<span class="pill ${s.blocked?'block':s.unjustified_count>=s.late_limit-1?'warn':''}">${!s.enrollment_approved?'Matrícula pendente':s.blocked?'Limite atingido':s.unjustified_count>=s.late_limit-1?'Em atenção':'Regular'}</span>`;
function classesOptions(value='',all=true){return `${all?'<option value="">Todas as turmas</option>':'<option value="">Selecione</option>'}${state.classes.filter(c=>all||c.active||c.id===value).map(c=>`<option value="${esc(c.id)}" ${c.id===value?'selected':''}>${esc(c.grade+' • '+c.name)}${c.active?'':' (inativa)'}</option>`).join('')}`;}
const dataForm=form=>Object.fromEntries(new FormData(form));
function openModal(title,html,submit){$('modalBody').onclick=null;$('modalTitle').textContent=title;$('modalBody').innerHTML=html;$('modalError').hidden=true;$('modal').showModal();const form=$('modalBody').querySelector('form');if(form&&submit)form.onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;const btn=form.querySelector('[type=submit]');if(btn)btn.disabled=true;try{const outcome=await submit(dataForm(form));$('modal').close();if(outcome?.temporaryPassword){openModal('Acesso do aluno criado',`<p>Entregue os dados diretamente ao aluno. A senha é exibida apenas nesta tela e não é armazenada no portal.</p><p><strong>E-mail:</strong> ${esc(outcome.email)}</p><div class="credential-box" role="status">${esc(outcome.temporaryPassword)}</div><p class="credential-note">Oriente o aluno a alterar a senha no primeiro acesso por meio de Recuperar senha. Não encaminhe a senha em grupos ou planilhas.</p>`);}else msg(outcome?.linked?'Matrícula registrada e conta existente vinculada. O aluno usa a própria senha após confirmar o e-mail.':'Matrícula salva. O aluno poderá criar a própria conta e senha usando o e-mail escolar.');await render();}catch(err){msg(errorText(err),'error','modalError');}finally{busy=false;if(btn)btn.disabled=false;}};}
const field=(label,name,type='text',value='',extra='')=>`<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra} required></label>`;
const reasonField='<label>Justificativa<textarea name="reason" minlength="5" maxlength="500" required></textarea></label>';
const save='<button class="primary" type="submit">Salvar</button>';
async function reasonAction(title,action,args){openModal(title,`<form>${reasonField}${save}</form>`,d=>write(action,{...args,reason:d.reason}));}
function auth(next='login'){
 authMode=next;$('authView').hidden=false;$('dashboard').hidden=true;
 const signup=next==='signup',reset=next==='reset',recover=next==='recover';
 $('signupFields').hidden=!signup;$('studentSignup').hidden=access!=='aluno';$('consentField').hidden=!signup;
 $('emailField').hidden=reset;$('passwordField').hidden=recover;
 const form=$('authForm');form.elements.email.required=!reset;form.elements.password.required=!recover;
 form.elements.password.minLength=signup||reset?10:1;form.elements.password.autocomplete=signup||reset?'new-password':'current-password';
 form.elements.birth.disabled=!signup||access!=='aluno';
 $('emailField').firstChild.nodeValue=access==='aluno'?'E-mail escolar':'E-mail institucional';
 form.elements.email.placeholder=access==='aluno'?'0000111@al.educacao.sp.gov.br':'nome@instituicao.gov.br';
 $('accessExplain').textContent=access==='aluno'
  ?'Use seu e-mail escolar e sua senha. Se sua matrícula já está cadastrada, crie sua conta; se já existe uma conta, recupere a senha.'
  :'Para Secretaria e Direção: acesso exclusivo à equipe autorizada. Sua conta precisa de um convite da Direção.';
 $('authTitle').textContent={login:access==='aluno'?'Entrar como aluno':'Entrar como instituição',signup:access==='aluno'?'Criar minha conta':'Ativar acesso da equipe',recover:'Recuperar senha',reset:'Definir nova senha'}[next];
 $('authSubtitle').textContent=signup?(access==='aluno'
  ?'Use seu RA, crie sua própria senha e confirme o e-mail escolar. Se já houver matrícula registrada pela escola, o acesso será liberado sem aprovação adicional. Caso contrário, sua ficha ficará disponível para conferência da Secretaria.'
  :'Use somente o e-mail previamente convidado pela Direção e confirme a titularidade da conta.')
  :recover?'Enviaremos um link de recuperação para o e-mail cadastrado.'
  :access==='aluno'?'Acompanhe sua frequência e os comunicados da escola.':'Gerencie matrículas e registros conforme seu cargo.';
 $('authSubmit').textContent={login:'Entrar',signup:access==='aluno'?'Criar minha conta':'Ativar conta institucional',recover:'Enviar link',reset:'Salvar nova senha'}[next];
 document.querySelectorAll('[data-auth]').forEach(b=>{b.hidden=(reset || (b.dataset.auth==='signup'&&next==='signup'));});
 document.querySelectorAll('[data-access]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.access===access)));
 $('authMessage').hidden=true;
}
$('authForm').onsubmit=async e=>{e.preventDefault();const btn=$('authSubmit');if(btn.disabled)return;btn.disabled=true;const d=dataForm(e.target),email=d.email?.trim().toLowerCase(),redirect=new URL('./',location.href).href;try{let result;if(authMode==='signup'){if(!d.consent)throw Error('Leia e confirme os Termos de Uso e a Política de Privacidade antes de criar a conta.');if(d.name.trim().length<3)throw Error('Informe o nome completo.');if(access==='aluno'&&(!SCHOOL_EMAIL.test(email)||!d.ra||!d.birth||!d.grade))throw Error('Informe RA, e-mail institucional, série, turma e nascimento.');const normalizedRA=String(d.ra||'').trim().toLowerCase().replace(/@al\.educacao\.sp\.gov\.br$/,'');if(access==='aluno'&&normalizedRA!==email.split('@')[0])throw Error('O RA informado precisa corresponder ao início do e-mail escolar.');result=await db.auth.signUp({email,password:d.password,options:{emailRedirectTo:redirect,data:{full_name:d.name.trim(),ra:access==='aluno'?normalizedRA:'',grade:d.grade,birth_date:d.birth}}});if(result.error)throw result.error;msg(access==='aluno'?'Confira seu e-mail escolar e confirme o cadastro. Se sua matrícula já consta na escola, entre com a senha que você criou. Caso ainda não conste, sua ficha aparecerá para a Secretaria; não será necessário receber senha provisória. Se sua conta já existia, use Recuperar senha.':'Conta solicitada. Confirme o e-mail institucional. O convite da Direção deve estar válido.','success','authMessage');}
else if(authMode==='recover'){result=await db.auth.resetPasswordForEmail(email,{redirectTo:redirect});if(result.error)throw result.error;msg('Se o endereço estiver cadastrado, você receberá o link de recuperação.','success','authMessage');}
else if(authMode==='reset'){result=await db.auth.updateUser({password:d.password});if(result.error)throw result.error;recovering=false;await db.auth.signOut();auth();msg('Senha alterada. Entre com a nova senha.','success','authMessage');}
else{result=await db.auth.signInWithPassword({email,password:d.password});if(result.error)throw result.error;await loadSession();}}catch(err){msg(errorText(err),'error','authMessage');}finally{btn.disabled=false;}};
document.querySelectorAll('[data-auth]').forEach(b=>b.onclick=()=>auth(b.dataset.auth));
document.querySelectorAll('[data-access]').forEach(b=>b.onclick=()=>{access=b.dataset.access;document.querySelectorAll('[data-access]').forEach(x=>x.classList.toggle('selected',x===b));auth();});
// Documentos jurídicos disponíveis em URLs estáticas mesmo sem autenticação.
$('closeModal').onclick=()=>$('modal').close();
async function loadSession(){if(authLoading||recovering)return;authLoading=true;try{const {data,error}=await db.auth.getUser();if(error||!data.user){state.me=null;auth();return;}state.me=await read('me');state.academic=await academicState();state.classes=state.academic?.pending?[]:await read('classes');$('authView').hidden=true;$('dashboard').hidden=false;document.body.classList.add('portal-layout');const schoolLabel=$('schoolLabel'),userName=$('userName'),userRole=$('userRole'),avatar=$('avatar');if(schoolLabel)schoolLabel.textContent=SCHOOL_NAME;if(userName)userName.textContent=state.me.full_name;if(userRole)userRole.textContent=roleName(state.me.role);if(avatar)avatar.textContent=initials(state.me.full_name);renderSidebarNav();renderMobileNav();renderPageProfile();renderHeaderChrome();await route();}catch(err){state.me=null;auth();let notice=errorText(err);if(err?.code==='42501'){try{const pending=await rpc('portal_registration_status',{});if(pending==='aguardando_instituicao')notice='Conta criada. Sua ficha está disponível para a Secretaria. Quando sua matrícula for registrada, você poderá entrar com a senha que escolheu, sem precisar pedir uma senha provisória.';else if(pending==='aguardando_email')notice='Confirme o e-mail escolar para ativar sua conta.';}catch{ /* mantém o erro original sem expor informações */ }}msg(notice,err?.code==='42501'?'success':'error','authMessage');}finally{authLoading=false;}}
function clearSession(){document.body.classList.remove('student-overview-mode');document.body.classList.remove('desktop-overview-mode');document.body.classList.remove('staff-shell');document.body.classList.remove('history-page');document.body.classList.remove('students-page');studentsTab='list';enrollmentSearch='';signupApplications=[];signupApplicationsOffset=0;renewalView=false;renewalFilter='pending';renewalSearch='';renewalOffset=0;renewalData=null;state.academic=null;$('navScrim').after($('mobileNav'));document.body.classList.remove('portal-layout');renderToken++;searchToken++;state.me=null;state.rows=[];state.classes=[];state.search=[];state.selected=null;state.request=null;state.historyStudent='';state.report=null;$('mobileNav').hidden=true;historyFilter={};studentsFilter={};$('view').replaceChildren();$('modal').close();$('modalBody').replaceChildren();$('flash').hidden=true;auth();}
$('logout').onclick=async()=>{const {error}=await db.auth.signOut();if(error){msg(errorText(error),'error');return;}clearSession();};
$('menu').onclick=toggleNavigation;
try{document.body.classList.toggle('dark',localStorage.getItem('presenca-theme')==='dark');}catch{}
$('theme').onclick=()=>{const dark=document.body.classList.toggle('dark');try{localStorage.setItem('presenca-theme',dark?'dark':'light');}catch{}};
function connection(){$('connection').hidden=navigator.onLine;}window.addEventListener('online',connection);window.addEventListener('offline',connection);connection();
window.addEventListener('hashchange',()=>{if(state.me)void route();});
async function route(){const p=location.hash.replace('#/','');if((p==='enrollments'||p==='classes')&&allowed().includes(p))studentsTab=p==='classes'?'classes':'enrollments';else if(p==='students')studentsTab='list';state.page=allowed().includes(p)?(['enrollments','classes'].includes(p)?'students':p):'overview';if(state.academic?.pending&&state.page!=='history')state.page='overview';state.offset=0;state.selected=null;state.request=null;state.report=null;searchToken++;pendingRouteMotion=true;$('view').replaceChildren();closeNavigation();$('mobileNav').querySelectorAll('[data-page]').forEach(a=>{a.classList.toggle('active',a.dataset.page===state.page);a.setAttribute('aria-current',a.dataset.page===state.page?'page':'false');});$('nav').querySelectorAll('a').forEach(a=>{const p=a.dataset.page;const active=p===state.page||(state.page==='students'&&((studentsTab==='classes'&&p==='classes')||(studentsTab==='enrollments'&&p==='enrollments')||(studentsTab==='list'&&p==='students')));a.classList.toggle('active',active);});const pageDescription=$('pageDescription');if(pageDescription)pageDescription.textContent=paths[state.page][1];renderPageProfile();renderHeaderChrome();
 const home=studentView()&&state.page==='overview';
 document.body.classList.toggle('student-overview-mode',home);document.body.classList.toggle('desktop-overview-mode',staff()&&state.page==='overview');document.body.classList.toggle('staff-shell',staff());document.body.classList.toggle('history-page',staff()&&state.page==='history');document.body.classList.toggle('students-page',staff()&&state.page==='students');
 // Mesma estrutura de cabeçalho e navegação em todas as telas e perfis.
 $('content').querySelector('.app-footer').before($('mobileNav'));
 $('menu').hidden=true;
 const themeButton=$('theme');
 if(themeButton){themeButton.hidden=false;themeButton.innerHTML=`${uiIcon('theme')}<span>Tema</span>`;}
 await render();}
function historyArgs(){return {student:state.historyStudent,from:$('fromDate')?.value||'',to:$('toDate')?.value||'',class:$('historyClass')?.value||'',status:$('historyStatus')?.value||'',offset:state.offset};}
let historyFilter={},studentsFilter={},historyOrder='recent',historySearch='',historyPageSize=10,studentsSort='name-asc',studentPageSize=10;
function bindReportForm(){
 const form=$('reportForm');if(!form)return;
 const kind=$('reportKind'),scope=$('reportScope'),grade=form.elements.grade,room=form.elements.class;
 kind.value=reportFilter.kind||'students';grade.value=reportFilter.grade||'';room.value=reportFilter.class||'';
 function update(){
  const type=kind.value,historical=type==='history';
  form.querySelectorAll('[data-report-history]').forEach(el=>el.hidden=!historical);
  form.querySelectorAll('[data-report-scope]').forEach(el=>el.hidden=historical);
  scope.innerHTML=type==='enrollments'?'<option value="active">Ativas</option><option value="inactive">Inativas</option><option value="all">Todas</option>':'<option value="active">Ativos</option><option value="archived">Arquivados</option><option value="all">Todos</option>';
  const reportDescription=$('reportDescription');if(reportDescription)reportDescription.textContent={students:'Inclui nome, RA, série, turma, contagem atual, limite e situação. Sem dados de contato ou nascimento.',history:'Inclui nome, RA, turma, data do atraso, situação e se foi justificado. Turma e série refletem o cadastro atual do aluno.',enrollments:'Inclui nome, RA, e-mail institucional, série, turma, situação e data de matrícula. Sem senha ou data de nascimento.'}[type];
 }
 kind.onchange=()=>{reportFilter={...reportFilter,kind:kind.value};update();};update();
 form.onsubmit=e=>{e.preventDefault();if(busy)return;const args=dataForm(form);
  if(args.from&&args.to&&args.from>args.to){msg('A data inicial deve ser anterior ou igual à final.','error');return;}
  const chosenClass=state.classes.find(c=>c.id===args.class);
  if(chosenClass&&args.grade&&chosenClass.grade!==args.grade){msg('A turma selecionada pertence a outra série. Corrija os filtros.','error');return;}
  reportFilter={kind:args.kind,grade:args.grade,class:args.class};
  void run(async()=>{
   const records=[];let offset=0;
   while(true){
    const batch=await rpc('portal_export',{p_kind:args.kind,p_args:{...args,offset}});
    if(!Array.isArray(batch))throw Error('Resposta inválida do servidor de relatórios.');
    records.push(...batch);
    if(batch.length<200)break;
    offset+=200;
    if(offset>10000)throw Error('Relatório muito grande. Escolha uma turma, série ou período menor.');
   }
   if(!records.length)return {notice:'Não há registros para os filtros selecionados. Nenhum arquivo foi criado.'};
   const {saveInstitutionalWorkbook}=await import('./report-xlsx.js');
   saveInstitutionalWorkbook(args.kind,records,{grade:args.grade,className:chosenClass?.name||'',from:args.from,to:args.to,status:args.status,scope:args.scope});
   return {notice:`Relatório Excel gerado com ${records.length} ${records.length===1?'registro':'registros'}.`};
  },false);
 };
}
// Renovação anual: a identidade Auth permanece a mesma; somente a matrícula muda.
function renderAnnualPending(){
 const y=state.academic||{};
 const last=[y.previous_grade,y.previous_class_name].filter(Boolean).join(' • ');
 return `<section class="panel annual-pending" aria-labelledby="annualPendingTitle"><span class="pill warn">${esc(y.year||'Ano letivo')} · Renovação</span><h2 id="annualPendingTitle">Matrícula pendente</h2><p>Sua matrícula para o ano letivo de ${esc(y.year||'o próximo ano')} ainda não foi atualizada pela Secretaria.</p><p>Você continua usando a mesma conta e senha. As funções escolares ficarão disponíveis após a confirmação dos seus dados.</p><div class="annual-last"><small>ÚLTIMA MATRÍCULA</small><strong>${esc(last||'Consulte a Secretaria')} · ${esc(y.previous_year||'Ano anterior')}</strong><span>Seu histórico permanece preservado.</span></div><p>Se seus dados já foram atualizados, clique em Atualizar ou procure a Secretaria.</p>${button('Consultar meu histórico','annual-history','','primary')}</section>`;
}
function annualGradeKey(grade){
 const lower=String(grade||'').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 if(lower.includes('eja'))return null;
 const match=lower.match(/^\s*([1-9])\s*(?:º|°|ª|a|o)?\s*(?:ano|serie)/);
 const level=lower.includes('medio')?'medio':lower.includes('fundamental')?'fundamental':null;
 return match&&level?level+':'+match[1]:null;
}
function annualSuggestedKey(grade,outcome){
 const key=annualGradeKey(grade);if(!key)return null;
 if(outcome==='reproved')return key;
 if(outcome==='approved'){
  if(key==='medio:3')return null;
  if(key==='fundamental:9')return 'medio:1';
  const [level,n]=key.split(':');return level+':'+(Number(n)+1);
 }
 return null;
}
function renewalPanel(data){
 const choices=[['pending','Pendentes'],['active','Ativos'],['completed','Concluídos'],['transferred','Transferidos']];
 const total=Number(data.pending_count||0);
 const tabs=choices.map(([id,label])=>button(label+(id==='pending'?' ('+total+')':''),'renewal-filter',id,renewalFilter===id?'primary':'outline')).join('');
 const rows=data.rows||[];
 return `<section class="panel renewal-panel" aria-labelledby="renewalTitle"><div class="hub-top"><div><span class="eyebrow">Ano letivo ${esc(data.year||'a definir')}</span><h2 id="renewalTitle">Renovações de matrícula</h2><p>Alunos aguardando atualização pela escola. Os dados de ${esc(data.year||'o novo ano')} só entram em vigor após a abertura oficial.</p></div>${button('Voltar aos alunos','renewal-hide')}</div>${studentTabs()}<div class="annual-stat"><small>RENOVAÇÕES PENDENTES</small><strong>${total}</strong><span>Alunos aguardando atualização de matrícula</span></div><div class="annual-filters" role="group" aria-label="Situação das renovações">${tabs}</div><form id="renewalSearchForm" class="hub-search"><label>Nome ou RA<input name="search" type="search" maxlength="100" value="${esc(renewalSearch)}" placeholder="Pesquisar aluno"></label><button type="submit">Pesquisar</button></form>${table(['Aluno','Última matrícula','Situação','Ação'],rows.map(r=>[`${esc(r.full_name)}<small>RA ${esc(r.ra)}</small>`,`${esc(r.previous_grade)} • ${esc(r.previous_class_name)}<small>${esc(r.previous_year)}</small>`,r.status==='pending'?'Pendente':r.status==='active'?'Ativo':r.status==='completed'?'Concluído':'Transferido',r.status==='pending'?button('Atualizar matrícula','annual-renew',r.id,'primary'):'—']))}<div class="pager">${button('Anterior','renewal-prev')}<span>Página ${renewalOffset/25+1}</span>${button('Próxima','renewal-next')}</div>${data.year_status!=='open'?'<p class="hint">Ano ainda não aberto. O processamento de renovações será liberado após a data programada pela Direção.</p>':''}</section>`;
}
function annualCalendarPanel(){
 if(!admin())return '';
 if(state.academic?.setup_missing)return '<section class="panel"><h3>Virada de ano letivo</h3><p>A atualização do banco de dados ainda não foi aplicada. Instale a migração 10 antes de ativar o calendário.</p></section>';
 if(!state.academic?.current_year&&state.academic?.year_status==='planned')return `<section class="panel annual-calendar"><h3>Abertura do ano ${esc(state.academic.year)}</h3><p>O ano anterior já foi encerrado. A abertura e a renovação das matrículas seguirão o calendário programado.</p>${button('Ver renovações','annual-open-list')}${button('Processar datas já alcançadas','annual-process')}</section>`;
 const year=Number(state.academic?.current_year||state.academic?.year||new Date().getFullYear());
 return `<section class="panel annual-calendar"><h3>Virada de ano letivo</h3><p>Defina quando as matrículas deixarão de valer e quando começará o próximo ano. Nenhum aluno é movido apenas por mudar o calendário civil.</p><form id="annualCalendarForm" class="annual-form"><label>Próximo ano<input name="year" type="number" min="2020" max="2100" required value="${state.academic?.year_status==='planned'?state.academic.year:year+1}"></label><label>Encerrar ano atual em<input name="close" type="date" required value="${esc(state.academic?.closes_on||'')}"></label><label>Abrir próximo ano em<input name="open" type="date" required value="${esc(state.academic?.opens_on||'')}"></label><button type="submit" class="primary">Salvar calendário letivo</button></form><div class="toolbar">${button('Ver renovações','annual-open-list')}${button('Processar datas já alcançadas','annual-process')}</div><p class="hint">A rotina automática verifica as datas periodicamente. A Direção deve conferir o calendário antes de salvar.</p></section>`;
}
async function render(){if(!state.me)return;const token=++renderToken,page=state.page;const view=$('view');view.setAttribute('aria-busy','true');if(!view.childElementCount)view.innerHTML='<p class="empty">Carregando informações…</p>';try{let html='',rows=[];
if(studentView()&&state.academic?.pending&&page!=='history'){html=renderAnnualPending();}else if(page==='reports'){const d=await read('dashboard');state.report=d;const summary=[['Hoje',d.today],['Nesta semana',d.week],['Neste mês',d.month]];const grades=[...new Set(state.classes.map(c=>c.grade))].sort((a,b)=>a.localeCompare(b,'pt-BR'));html=`<section class="panel report-hero"><span class="eyebrow">RELATÓRIOS DA ESCOLA</span><h2>Exportar dados para Excel</h2><p>Escolha os dados e delimite a turma, a série ou o período. Os filtros são aplicados no Supabase e o arquivo é montado no seu dispositivo, sem enviar a planilha para outro serviço.</p><form id="reportForm" class="report-form"><label>Tipo de relatório<select name="kind" id="reportKind"><option value="students">Lista de alunos</option><option value="history">Histórico de atrasos</option><option value="enrollments">Matrículas</option></select></label><div class="report-filter-grid"><label>Série / ano<select name="grade"><option value="">Todas as séries</option>${grades.map(g=>`<option value="${esc(g)}">${esc(g)}</option>`).join('')}</select></label><label>Turma / sala<select name="class">${classesOptions('',true)}</select></label><label data-report-scope>Situação<select name="scope" id="reportScope"></select></label><label data-report-history>De<input name="from" type="date"></label><label data-report-history>Até<input name="to" type="date"></label><label data-report-history>Situação do atraso<select name="status"><option value="">Todas</option><option value="active">Válidos</option><option value="forgiven">Perdoados</option><option value="void">Anulados</option></select></label></div><p class="report-note" id="reportDescription"></p><button type="submit" class="primary report-download">Baixar Excel filtrado (.xlsx)</button></form><p class="report-note">Dados identificáveis são de uso interno da Secretaria/Direção. Evite compartilhar planilhas com terceiros; não há senhas, observações individuais ou datas de nascimento nas exportações.</p></section><section class="panel"><div class="section-head"><h3>Resumo agregado</h3>${button('Baixar resumo (.xlsx)','export-report','','outline')}</div><p class="muted">Sem identificação dos alunos. Totais por turma e tendência dos últimos 14 dias.</p><div class="report-counters">${summary.map(([label,n])=>`<div><small>${label}</small><strong>${Number(n)||0}</strong></div>`).join('')}</div><h3>Atrasos por turma · mês atual</h3>${table(['Turma','Ocorrências'],d.classes.map(c=>[esc(c.grade||'Sem turma'),Number(c.total)||0]))}</section>`;}else if(page==='overview'){const [d,notes]=await Promise.all([read('dashboard'),read('announcements')]);if(studentView()){const studentCards=[{label:'Atrasos válidos',value:d.count,desc:'Contagem do período',icon:'clock',tone:'mint',href:'#/history'},{label:'Limite atual',value:d.limit,desc:'Definido pela escola',icon:'limit',tone:'sky',href:'#/history'},{label:'Histórico total',value:d.historical,desc:'Todas as ocorrências',icon:'history',tone:'violet',href:'#/history'},{label:'Perdoados',value:d.forgiven,desc:'Mantidos no histórico',icon:'forgiven',tone:'amber',href:'#/history'}];const latestNotes=notes.filter(n=>n.active).slice(0,3);const schoolSignature=SCHOOL_NAME==='E.E. Amador e Catharina Saporito Augusto'?`<span class="school-line">${uiIcon('graduation')} E.E. Amador e Catharina</span><span class="school-line school-line-secondary">Saporito Augusto <small>PEI</small></span>`:`<span class="school-line">${uiIcon('graduation')} ${esc(SCHOOL_NAME)}</span>`;html=`<section class="welcome hero-panel student-home" aria-label="Resumo do aluno"><div class="hero-copy"><span class="hero-kicker">MINHA FREQUÊNCIA</span><h2>Olá, ${esc(state.me.full_name.split(' ')[0])}.</h2><p>Acompanhe seus atrasos e os comunicados da escola em um só lugar.</p></div><div class="hero-side"><strong>${schoolSignature}</strong>${d.blocked?'<span class="hero-warning">Limite atingido: procure a Direção.</span>':''}</div></section><div class="metrics student-metrics">${studentCards.map(card=>`<a class="metric metric-card tone-${card.tone}" href="${card.href}" aria-label="${card.label}: ${card.value}. ${card.desc}. Abrir histórico"><span class="metric-icon">${uiIcon(card.icon)}</span><div class="metric-copy"><span>${card.label}</span><strong>${card.value}</strong><small>${card.desc}</small></div><span class="metric-arrow">${uiIcon('chevron')}</span></a>`).join('')}</div>${!state.me.enrollment_approved?'<p class="notice">Seu cadastro anterior foi preservado. A Direção precisa validar a matrícula antes de novos registros.</p>':''}<section class="panel homepage-list student-section"><div class="section-head"><h3><span class="section-icon">${uiIcon('announcement')}</span>Comunicados da escola</h3><a class="link-lite" href="#/announcements">Ver todos ${uiIcon('chevron')}</a></div>${latestNotes.length?latestNotes.map(n=>`<article class="announcement quick-announcement"><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p></article>`).join(''):`<div class="empty-overview"><span class="empty-overview-icon">${uiIcon('history')}</span><strong>Nenhum comunicado publicado.</strong><p>Quando houver novos comunicados, eles aparecerão aqui.</p></div>`}</section><section class="panel homepage-list student-section"><div class="section-head"><h3><span class="section-icon">${uiIcon('history')}</span>Acesso rápido</h3></div><div class="quick-links"><a href="#/history">${uiIcon('history')}<span><strong>Meu histórico</strong><small>Consultar todos os registros</small></span></a><a href="#/announcements">${uiIcon('announcement')}<span><strong>Comunicados</strong><small>Ver avisos da escola</small></span></a></div></section>`;}else{const metrics=[
 {label:'Alunos',value:d.students,desc:'Base escolar',icon:'users',tone:'blue',href:'#/students'},
 {label:'Hoje',value:d.today,desc:'Ocorrências registradas',icon:'calendar',tone:'green',href:'#/history'},
 {label:'Na semana',value:d.week,desc:'Desde segunda-feira',icon:'limit',tone:'orange',href:'#/history'},
 {label:'No mês',value:d.month,desc:'Mês atual',icon:'history',tone:'red',href:'#/history'},
 {label:'Em atenção',value:d.warning,desc:'A um atraso do limite',icon:'alert',tone:'purple',href:'#/students'}
 ];const latestNotes=notes.filter(n=>n.active).slice(0,2);
 html=`<div class="metrics reference-metrics">${metrics.map(card=>`<a class="metric reference-metric ref-tone-${card.tone}" href="${card.href}" aria-label="${card.label}: ${card.value}. ${card.desc}."><span class="metric-icon">${uiIcon(card.icon)}</span><div class="metric-copy"><span>${card.label}</span><strong>${card.value}</strong><small>${card.desc}</small></div></a>`).join('')}</div>`;
 const classMax=Math.max(1,...d.classes.map(c=>Number(c.total)||0));
 html+=`<div class="grid-two reference-dashboard-grid"><section class="panel reference-panel trend-panel"><div class="section-head"><h3><span class="section-icon">${uiIcon('limit')}</span>Atrasos nos últimos 14 dias</h3></div>${dashboardTrendSvg(d.trend)}</section><section class="panel reference-panel class-panel"><div class="section-head"><h3><span class="section-icon">${uiIcon('users')}</span>Por turma (semana atual)</h3></div><div class="class-summary-table"><div class="class-summary-head"><span>TURMA</span><span>ALUNOS</span><span>ATRASOS</span><span>%</span></div>${d.classes.length?d.classes.map(c=>{const pct=Math.round(((Number(c.total)||0)/classMax)*100);return `<a href="#/classes" class="class-summary-row"><strong>${esc(c.grade||'Sem turma')}</strong><span>${Number(c.students)||0}</span><span>${Number(c.total)||0}</span><span class="class-rate"><b>${pct}%</b><i><em style="width:${pct}%"></em></i></span></a>`;}).join(''):`<div class="class-summary-empty">Nenhuma turma com dados no período.</div>`}</div></section></div>`;
 html+=`<div class="grid-two reference-dashboard-grid lower"><section class="panel reference-panel announcements-panel"><div class="section-head"><h3><span class="section-icon">${uiIcon('announcement')}</span>Comunicados da escola</h3></div><div class="dashboard-announcements">${latestNotes.length?latestNotes.map((n,i)=>{const dt=shortDateTimeBR(n.created_at);const badge=n.audience==='equipe'?'Equipe':n.audience==='aluno'?'Alunos':i%2?'Informativo':'Aviso';return `<a href="#/announcements" class="dashboard-announcement"><span class="announcement-badge badge-${i%2?'info':'notice'}">${badge}</span><span class="announcement-copy"><strong>${esc(n.title)}</strong><small>${esc(n.body)}</small></span><span class="announcement-time"><b>${dt.date}</b><small>${dt.time}</small></span><span class="announcement-arrow">${uiIcon('chevron')}</span></a>`;}).join(''):`<div class="dashboard-empty">Nenhum comunicado publicado.</div>`}</div></section><section class="panel reference-panel actions-panel"><div class="section-head"><h3><span class="section-icon">${uiIcon('limit')}</span>Ações rápidas</h3></div><div class="reference-quick-grid"><a href="#/entry" class="quick-action qa-blue">${uiIcon('users')}<span><strong>Registrar atraso</strong><small>Adicionar ocorrência</small></span>${uiIcon('chevron')}</a><a href="#/students" class="quick-action qa-blue">${uiIcon('users')}<span><strong>Ver alunos</strong><small>Gerenciar alunos</small></span>${uiIcon('chevron')}</a><a href="#/reports" class="quick-action qa-purple">${uiIcon('reports')}<span><strong>Gerar relatório</strong><small>Exportar dados</small></span>${uiIcon('chevron')}</a>${admin()?`<a href="#/period" class="quick-action qa-orange">${uiIcon('period')}<span><strong>Período e regras</strong><small>Configurações do sistema</small></span>${uiIcon('chevron')}</a>`:`<a href="#/announcements" class="quick-action qa-orange">${uiIcon('announcements')}<span><strong>Comunicados</strong><small>Avisos da escola</small></span>${uiIcon('chevron')}</a>`}</div></section></div>`;}}else if(page==='entry'){html=`<section class="panel entry-panel"><h3>Quem chegou?</h3><form id="entryForm"><label>Pesquisar aluno por nome ou RA<input id="entrySearch" type="search" autocomplete="off" placeholder="Comece a digitar…" aria-controls="entryResults" aria-expanded="false" role="combobox"></label><div id="entryResults" class="results" role="listbox" aria-label="Alunos encontrados"></div><div id="selectedStudent"></div><label>Observação opcional<textarea id="entryReason" maxlength="500" rows="2"></textarea></label><button class="primary" id="recordBtn" type="submit" disabled>Registrar atraso</button></form><p class="muted">Use ↑ e ↓ para selecionar e Enter para continuar. Após selecionar, Enter registra o atraso.</p><div id="lastRecord"></div></section>`;

 }else if(page==='students'&&studentsTab==='classes'){
 html=`<section class="student-reference-shell student-hub">${studentReferenceTop('classes')}${classManager()}</section>`;
 }else if(page==='students'&&studentsTab==='enrollments'){
 const [enrollments,applications]=await Promise.all([read('enrollments',{offset:state.offset,search:enrollmentSearch}),readApplications(signupApplicationsOffset,enrollmentSearch)]);
 rows=enrollments;signupApplications=Array.isArray(applications)?applications:[];
 html=`<section class="student-reference-shell student-hub">${studentReferenceTop('enrollments')}<section class="panel student-secondary-panel"><form id="enrollmentsFilter" class="hub-search"><label>Buscar matrícula<input name="search" type="search" value="${esc(enrollmentSearch)}" maxlength="100" placeholder="Nome ou RA" autocomplete="off"></label><button type="submit" class="primary">${uiIcon('search')}<span>Buscar</span></button>${enrollmentSearch?button('Limpar','clear-enrollment-search'):''}</form><div class="context-note">${uiIcon('info')}<p>O aluno cria a própria senha com o e-mail escolar. Se a matrícula já existir, a conta é vinculada automaticamente após a confirmação do e-mail.</p></div><div id="enrollmentRows">${enrollmentTable(rows)}</div>${pager(rows)}${applicationsPanel(signupApplications)}</section></section>`;
}else if(page==='students'&&renewalView){renewalData=await readRenewals(renewalFilter,renewalOffset,renewalSearch);rows=renewalData.rows||[];html=renewalPanel(renewalData);
}else if(page==='students'||page==='archive'){if(page==='students')renewalData=await readRenewals('pending',0,'');rows=await read('students',{...studentsFilter,offset:state.offset,archived:page==='archive'?'true':'false'});html=page==='students'?studentReferenceList(rows,Number(renewalData?.pending_count||0)):`<section class="panel"><form id="studentsFilter" class="filters streamlined-filters"><label class="search-field">Buscar aluno<input name="search" id="studentSearch" type="search" value="${esc(studentsFilter.search||'')}" placeholder="Nome ou RA" autocomplete="off"></label><label>Turma<select name="class">${classesOptions(studentsFilter.class)}</select></label><label>Situação<select name="situation"><option value="">Todas</option><option value="regular">Regular</option><option value="warning">Em atenção</option><option value="blocked">Limite atingido</option></select></label><div class="filter-actions">${(studentsFilter.search||studentsFilter.class||studentsFilter.situation)?button('Limpar filtros','clear-student-filters'):''}${button('Exportar Excel','open-reports')}</div></form><div id="studentRows">${studentTable(rows,true)}</div>${pager(rows)}</section>`;
}else if(page==='history'){rows=await read('history',{...historyFilter,student:state.historyStudent,offset:state.offset});if(staff())rows=await hydrateHistoryRa(rows);html=studentView()?renderStudentHistory(rows):renderStaffHistory(rows);

}else if(page==='team'){rows=await read('team',{offset:state.offset});html=`<section class="panel"><div class="toolbar">${button('Autorizar funcionário','invite')}</div><p>O funcionário cria sua própria senha e confirma o e-mail após a autorização.</p>${table(['Nome','Cargo','Situação','Ações'],rows.map(r=>[esc(r.full_name),roleName(r.role),r.active?(r.verified?'Ativo':'E-mail pendente'):'Suspenso',r.id===state.me.id?'Sua conta':button('Gerenciar','role',r.id)]))}${pager(rows)}</section>`;
}else if(page==='adjustments'){rows=await read('adjustments',{offset:state.offset});html=`<section class="panel">${table(['Data','Aluno','Ação','Justificativa'],rows.map(r=>[dateBR(r.created_at),esc(r.full_name),esc({chance:'Nova chance',forgive:'Perdão',correct:'Correção',undo:'Desfeito',approve:'Matrícula validada',reset_student:'Novo período',archive:'Arquivado',restore:'Restaurado',edit_student:'Dados corrigidos'}[r.action]||r.action),esc(r.reason)]))}${pager(rows)}</section>`;
}else if(page==='announcements'){rows=await read('announcements',{offset:state.offset});html=renderAnnouncements(rows);}else if(page==='audit'){rows=await read('audit',{offset:state.offset});html=`<section class="panel">${table(['Data','Operação','Responsável','Detalhe'],rows.map(r=>[dateBR(r.created_at),esc(r.action),esc(r.actor_name||'Sistema'),esc(r.detail||'—')]))}${pager(rows)}</section>`;
}else if(page==='privacy'){rows=await read('privacy',{offset:state.offset});html=`<section class="panel">${button('Registrar solicitação ou incidente','privacy-new')}${table(['Data','Tipo','Situação','Descrição','Ações'],rows.map(r=>[dateBR(r.created_at),r.kind==='incidente'?'Incidente':'Solicitação',esc(r.status.replace('_',' ')),esc(r.description),button('Acompanhar','privacy-edit',r.id)]))}${pager(rows)}</section>`;
}else if(page==='period'){const [settings,resets]=await Promise.all([read('settings'),read('resets',{offset:state.offset})]);rows=resets;state.settings=settings;html=`<div class="grid-two"><section class="panel"><h3>Regras e privacidade</h3><p>O limite padrão vale para novos cadastros e novos períodos. Limites individuais atuais são preservados.</p><form id="settingsForm">${field('Limite padrão de atrasos','limit','number',settings.default_limit,'min="1" max="100"')}${field('Responsável pelo tratamento de dados','controller','text',settings.controller,'maxlength="200"')}${field('Contato de privacidade','contact','text',settings.privacy_contact,'maxlength="200"')}<label>Aviso institucional<textarea name="notice" maxlength="4000" required>${esc(settings.privacy_notice)}</textarea></label><label>Política de retenção<textarea name="retention" maxlength="2000" required>${esc(settings.retention_policy)}</textarea></label>${save}</form></section><section class="panel"><h3>Período letivo</h3><p>Encerrar o período zera a contagem atual e preserva todas as ocorrências.</p><form id="periodForm">${field('Agendar encerramento','date','date')}<button class="primary" type="submit">Agendar</button></form><div class="toolbar">${button('Encerrar agora','reset-period','','danger')}</div><p>Agendamentos automáticos precisam do agendador configurado no Supabase.</p>${table(['Data','Situação','Ações'],resets.map(r=>[dateBR(r.scheduled_for),r.executed_at?'Executado':r.cancelled_at?'Cancelado':'Pendente',!r.executed_at&&!r.cancelled_at?button('Cancelar','cancel-reset',r.id):'—']))}${pager(rows)}</section></div>${annualCalendarPanel()}`;}
if(token!==renderToken)return;view.innerHTML=html;state.rows=rows;bindPager(rows);bindPage();playRouteMotion(view,html.length);}catch(e){if(token===renderToken){pendingRouteMotion=false;view.innerHTML=`<section class="panel"><h3>Não foi possível carregar os dados</h3><p>${esc(errorText(e))}</p>${button('Tentar novamente','retry')}</section>`;}}finally{if(token===renderToken)view.removeAttribute('aria-busy');}}
function studentTabs(){
 const tabs=[['list','Lista de alunos','students'],['enrollments','Matrículas e acessos','enrollments'],['classes','Séries e turmas','classes']];
 return `<div class="student-tabs student-reference-tabs" role="tablist" aria-label="Área de alunos">${tabs.map(([id,label,icon])=>`<button type="button" role="tab" class="${studentsTab===id?'selected':''}" data-action="students-tab" data-id="${id}" aria-selected="${studentsTab===id}" aria-pressed="${studentsTab===id}">${uiIcon(icon)}<span>${label}</span></button>`).join('')}</div>`;
}
function studentReferenceTop(tab='list',pending=0){
 let action='';
 if(tab==='list'||tab==='enrollments')action=button('Nova matrícula','enrollment-new','','primary');
 if(tab==='classes'&&admin())action=button('Nova turma','class-new','','primary');
 return `<section class="student-reference-top">${studentTabs()}<div class="student-reference-top-action">${action}</div></section>`;
}
function studentSortRows(rows){
 const copy=[...rows];
 if(studentsSort==='name-desc')return copy.sort((a,b)=>String(b.full_name||'').localeCompare(String(a.full_name||''),'pt-BR'));
 if(studentsSort==='count-desc')return copy.sort((a,b)=>Number(b.unjustified_count||0)-Number(a.unjustified_count||0)||String(a.full_name||'').localeCompare(String(b.full_name||''),'pt-BR'));
 return copy.sort((a,b)=>String(a.full_name||'').localeCompare(String(b.full_name||''),'pt-BR'));
}
function studentVisibleRows(rows){return studentSortRows(rows).slice(0,studentPageSize);}
function studentReferencePager(rows){
 const visible=studentVisibleRows(rows),page=Math.floor(state.offset/studentPageSize)+1;
 const knownLast=rows.length<25,knownTotal=knownLast?Math.max(page,Math.ceil((state.offset+rows.length)/studentPageSize)):null;
 return `<div class="student-reference-pager"><label class="student-page-size"><select id="studentPageSize" aria-label="Itens por página"><option value="10" ${studentPageSize===10?'selected':''}>10 por página</option><option value="15" ${studentPageSize===15?'selected':''}>15 por página</option><option value="20" ${studentPageSize===20?'selected':''}>20 por página</option></select></label><div class="student-page-nav"><button type="button" class="outline square" data-action="student-prev" ${state.offset===0?'disabled':''} aria-label="Página anterior">${uiIcon('back')}</button><span>Página ${page}${knownTotal?' de '+knownTotal:''}</span><button type="button" class="outline square" data-action="student-next" ${rows.length<=studentPageSize?'disabled':''} aria-label="Próxima página">${uiIcon('chevron')}</button></div></div>`;
}
function studentReferenceList(rows,pending=0){
 const visible=studentVisibleRows(rows),count=visible.length;
 return `<section class="student-reference-shell student-hub">${studentReferenceTop('list',pending)}<section class="student-reference-filter-card"><form id="studentsFilter" class="student-reference-filters"><label class="student-search-field"><span>Buscar aluno</span><div class="student-search-control">${uiIcon('search')}<input name="search" id="studentSearch" type="search" value="${esc(studentsFilter.search||'')}" placeholder="Nome ou RA..." autocomplete="off"></div></label><label><span>Turma</span><select name="class">${classesOptions(studentsFilter.class)}</select></label><label><span>Situação</span><select name="situation"><option value="">Todas</option><option value="regular">Regular</option><option value="warning">Em atenção</option><option value="blocked">Limite atingido</option></select></label><div class="student-filter-buttons"><button type="button" class="outline" data-action="student-advanced">${uiIcon('filter')}<span>Filtros avançados</span></button><i class="student-filter-separator" aria-hidden="true"></i>${button('Exportar Excel','open-reports')}</div></form><div id="studentAdvancedPanel" class="student-advanced-panel" hidden>${pending?button(`Pendentes de renovação (${pending})`,'renewal-show'):''}${(studentsFilter.search||studentsFilter.class||studentsFilter.situation)?button('Limpar filtros','clear-student-filters'):''}</div></section><section class="student-reference-list-card"><div class="student-list-head"><strong id="studentResultCount">${count} ${count===1?'aluno encontrado':'alunos encontrados'}</strong><label>Ordenar por:<select id="studentOrder"><option value="name-asc" ${studentsSort==='name-asc'?'selected':''}>Nome (A → Z)</option><option value="name-desc" ${studentsSort==='name-desc'?'selected':''}>Nome (Z → A)</option><option value="count-desc" ${studentsSort==='count-desc'?'selected':''}>Mais atrasos</option></select></label></div><div id="studentRows">${studentTable(rows,false)}</div>${studentReferencePager(rows)}</section></section>`;
}
function studentHubHeader(tab='list',pending=0){return studentReferenceTop(tab,pending);}
function classManager(){const rows=state.classes;return `<section id="studentClassManager" class="class-hub-content" aria-labelledby="classManagerTitle"><div class="class-hub-title"><div><h3 id="classManagerTitle">Séries e turmas <span class="class-count">${rows.length}</span></h3><p class="muted">Turmas disponíveis para selecionar na matrícula e no cadastro de alunos.</p></div></div>${table(admin()?['Série','Turma','Situação','Ações']:['Série','Turma','Situação'],rows.map(c=>admin()?[esc(c.grade),esc(c.name),c.active?'Ativa':'Inativa',button('Editar turma','class-edit',c.id)]:[esc(c.grade),esc(c.name),c.active?'Ativa':'Inativa']))}${!rows.some(c=>c.active)?`<p class="hint">${admin()?'Cadastre uma turma ativa para conseguir matricular os alunos.':'Ainda não há turmas disponíveis. Procure a Direção.'}</p>`:''}</section>`;}

function enrollmentTable(rows){return table(['Aluno','RA','Turma','Acesso','Ações'],rows.map(r=>[esc(r.full_name),esc(r.ra),esc(r.grade+' • '+r.class_name),r.profile_id?'Conta vinculada':r.active?'Aguardando aluno criar conta':'Inativa',button('Editar matrícula','enrollment-edit',r.id)]));}
function applicationsPanel(rows){return `<section class="application-section" aria-labelledby="applicationsTitle"><div class="class-hub-title"><div><h3 id="applicationsTitle">Fichas de pré-cadastro <span class="class-count">${rows.length}</span></h3><p class="muted">Dados informados pelo próprio aluno. Confira a matrícula escolar antes de criar o vínculo.</p></div></div>${rows.length?`<div class="application-grid">${rows.map(r=>`<article class="application-card"><div class="application-card-head"><strong>${esc(r.full_name)}</strong><span class="pill ${r.verified?'ok':'warn'}">${r.verified?'E-mail confirmado':'E-mail pendente'}</span></div><dl><div><dt>RA informado</dt><dd>${esc(r.ra)}</dd></div><div><dt>Série / turma informada</dt><dd>${esc(r.grade||'Não informada')}</dd></div><div><dt>Nascimento informado</dt><dd>${esc(r.birth_date?dateBR(r.birth_date):'Não informado')}</dd></div></dl><p class="hint">Este pré-cadastro não equivale a uma matrícula aprovada.</p>${button('Cadastrar matrícula','enrollment-from-application',r.id,'primary')}</article>`).join('')}</div><div class="toolbar application-pagination">${signupApplicationsOffset?button('Fichas anteriores','applications-prev'):''}<span>Página ${Math.floor(signupApplicationsOffset/25)+1}</span>${rows.length===25&&signupApplicationsOffset<10000?button('Próximas fichas','applications-next'):''}</div>`:'<p class="empty">Nenhuma ficha aguardando matrícula para a pesquisa atual.</p>'}</section>`;}
function studentTable(rows,archived){
 const visible=archived?rows:studentVisibleRows(rows);
 if(!visible.length)return '<div class="empty student-empty">Nenhum aluno encontrado.</div>';
 if(archived)return table(['Aluno','Turma','Contagem / limite','Situação','Ações'],visible.map(s=>[`${esc(s.full_name)}<small>RA ${esc(s.ra)}</small>`,esc(s.grade),`${s.unjustified_count} / ${s.late_limit}<small>${s.historical_count} ocorrências no histórico</small>`,status(s),`<div class="toolbar">${button('Histórico','history',s.id)}${admin()?button('Restaurar','restore',s.id):''}</div>`]));
 return `<div class="student-reference-table-wrap"><table class="student-reference-table"><thead><tr><th class="select-col"><input id="studentSelectAll" type="checkbox" aria-label="Selecionar todos desta página"></th><th>ALUNO <span>◆</span></th><th>TURMA <span>◆</span></th><th>SITUAÇÃO <span>◆</span></th><th>CONTAGEM / LIMITE <span>◆</span></th><th>ÚLTIMA OCORRÊNCIA <span>◆</span></th><th>AÇÕES</th></tr></thead><tbody>${visible.map(s=>`<tr><td class="select-col"><input class="student-row-check" type="checkbox" value="${esc(s.id)}" aria-label="Selecionar ${esc(s.full_name)}"></td><td><strong>${esc(s.full_name)}</strong><small>RA ${esc(s.ra)}</small></td><td>${esc(s.grade||'—')}</td><td>${status(s)}</td><td><strong>${Number(s.unjustified_count||0)} / ${Number(s.late_limit||0)}</strong><small>${Number(s.historical_count||0)} ${Number(s.historical_count||0)===1?'ocorrência':'ocorrências'} no histórico</small></td><td class="last-occurrence">—</td><td><div class="student-row-actions">${button('Histórico','history',s.id)}${admin()?button('Gerenciar','student-manage',s.id):''}<button type="button" class="outline square" data-action="student-more" data-id="${esc(s.id)}" aria-label="Mais ações para ${esc(s.full_name)}">${uiIcon('menuDots')}</button></div></td></tr>`).join('')}</tbody></table></div>`;
}
function bindPage(){if($('reportForm'))bindReportForm();if($('enrollmentsFilter')){const form=$('enrollmentsFilter');form.onsubmit=e=>{e.preventDefault();enrollmentSearch=form.elements.search.value.trim();state.offset=0;signupApplicationsOffset=0;void render();};}if(state.page==='entry'){bindEntry();return;}if($('studentsFilter')){const form=$('studentsFilter');form.elements.situation.value=studentsFilter.situation||'';form.onsubmit=e=>{e.preventDefault();studentsFilter=dataForm(e.target);state.offset=0;void render();};form.querySelectorAll('select').forEach(select=>select.onchange=()=>{studentsFilter=dataForm(form);state.offset=0;void render();});$('studentSearch').oninput=async e=>{const token=++searchToken;studentsFilter=dataForm(form);state.offset=0;try{const rows=await read('students',{...studentsFilter,archived:state.page==='archive'?'true':'false',offset:0});if(token!==searchToken||!$('studentRows'))return;state.rows=rows;const pageLabel=$('view').querySelector('.pager span');if(pageLabel)pageLabel.textContent='Página 1';$('studentRows').innerHTML=studentTable(rows,state.page==='archive');const resultCount=$('studentResultCount');if(resultCount){const n=studentVisibleRows(rows).length;resultCount.textContent=`${n} ${n===1?'aluno encontrado':'alunos encontrados'}`;}bindStudentSelection();bindPager(rows);}catch(err){msg(errorText(err),'error');}};}
if($('studentOrder'))$('studentOrder').onchange=e=>{studentsSort=e.target.value;const box=$('studentRows');if(box)box.innerHTML=studentTable(state.rows,false);const count=$('studentResultCount');if(count){const n=studentVisibleRows(state.rows).length;count.textContent=`${n} ${n===1?'aluno encontrado':'alunos encontrados'}`;}bindStudentSelection();};
if($('studentPageSize'))$('studentPageSize').onchange=e=>{studentPageSize=Math.max(10,Math.min(20,Number(e.target.value)||10));state.offset=0;void render();};
bindStudentSelection();
if($('historyFilters')){$('historyStatus').value=historyFilter.status||'';$('historyFilters').onsubmit=e=>{e.preventDefault();const from=$('fromDate')?.value,to=$('toDate')?.value;if(from&&to&&from>to){msg('A data inicial precisa ser anterior ou igual à data final.','error');return;}historySearch=$('historyStudentSearch')?.value.trim()||'';historyFilter=historyArgs();state.offset=0;void render();};const historySearchInput=$('historyStudentSearch');if(historySearchInput)historySearchInput.oninput=e=>{historySearch=e.target.value;};}
if($('historyOrder'))$('historyOrder').onchange=e=>{historyOrder=e.target.value;void render();};
if($('historyPageSize'))$('historyPageSize').onchange=e=>{historyPageSize=Math.max(10,Math.min(20,Number(e.target.value)||10));state.offset=0;void render();};
const clearHistory=$('view').querySelector('[data-action=clear-history-filters]');if(clearHistory)clearHistory.onclick=()=>{historyFilter={};historySearch='';state.historyStudent='';state.offset=0;void render();};
if($('announcementFilters')){$('announcementFilters').onsubmit=e=>e.preventDefault();const search=$('announcementSearch');if(search)search.oninput=e=>{announcementFilter={...announcementFilter,query:e.target.value};void render();};$('view').querySelectorAll('[data-announcement-type]').forEach(btn=>btn.onclick=()=>{announcementFilter={...announcementFilter,type:btn.dataset.announcementType};void render();});}
if($('renewalSearchForm')){const previous=$('view').querySelector('[data-action=renewal-prev]'),next=$('view').querySelector('[data-action=renewal-next]');if(previous)previous.disabled=renewalOffset===0;if(next)next.disabled=(renewalData?.rows?.length||0)<25;}
if($('renewalSearchForm'))$('renewalSearchForm').onsubmit=e=>{e.preventDefault();renewalSearch=e.target.elements.search.value.trim();renewalOffset=0;void render();};
if($('annualCalendarForm'))$('annualCalendarForm').onsubmit=e=>{e.preventDefault();const d=dataForm(e.target);if(d.open<d.close){msg('A abertura precisa ser na mesma data do encerramento ou depois.','error');return;}void run(async()=>{const result=await academicManage('configure',d);state.academic=await academicState();return result;});};
if($('settingsForm'))$('settingsForm').onsubmit=e=>{e.preventDefault();void run(()=>write('settings',dataForm(e.target)));};
if($('periodForm'))$('periodForm').onsubmit=e=>{e.preventDefault();void run(()=>rpc('schedule_period_reset',{p_date:dataForm(e.target).date}));};}
function bindStudentSelection(){
 const all=$('studentSelectAll'),checks=[...document.querySelectorAll('.student-row-check')];
 if(!all)return;
 all.onchange=()=>checks.forEach(c=>c.checked=all.checked);
 checks.forEach(c=>c.onchange=()=>{all.checked=checks.length>0&&checks.every(x=>x.checked);all.indeterminate=!all.checked&&checks.some(x=>x.checked);});
}
function bindEntry(){state.selected=null;state.request=null;const search=$('entrySearch');search.focus();search.oninput=async()=>{state.selected=null;state.request=null;$('selectedStudent').innerHTML='';$('recordBtn').disabled=true;const term=search.value.trim(),token=++searchToken;if(!term){$('entryResults').innerHTML='';search.setAttribute('aria-expanded','false');return;}try{const rows=await read('students',{search:term});if(token!==searchToken||!$('entryResults'))return;state.search=rows;state.index=-1;$('entryResults').innerHTML=rows.map((s,i)=>`<button class="result" type="button" id="result-${i}" role="option" aria-selected="false" data-pick="${i}"><span>${esc(s.full_name)}<small>${esc(s.ra)} · ${esc(s.grade)}</small><span>${s.unjustified_count}/${s.late_limit}</span></button>`).join('')||'<p class="empty">Nenhum aluno encontrado.</p>';search.setAttribute('aria-expanded','true');}catch(e){msg(errorText(e),'error');}};
search.onkeydown=e=>{if(e.isComposing)return;if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();state.index=Math.max(0,Math.min(state.search.length-1,state.index+(e.key==='ArrowDown'?1:-1)));document.querySelectorAll('[data-pick]').forEach((b,i)=>b.setAttribute('aria-selected',String(i===state.index)));search.setAttribute('aria-activedescendant','result-'+state.index);}else if(e.key==='Enter'&&!state.selected){e.preventDefault();if(state.search.length)pick(Math.max(0,state.index));}};
$('entryResults').onclick=e=>{const b=e.target.closest('[data-pick]');if(b)pick(Number(b.dataset.pick));};
$('entryForm').onsubmit=async e=>{e.preventDefault();if(busy||!state.selected)return;const s=state.selected;busy=true;$('recordBtn').disabled=true;state.request??=crypto.randomUUID();try{const r=await write('record',{student:s.id,request:state.request,reason:$('entryReason').value.trim()});msg(r.duplicate?'Este registro já havia sido confirmado.':'Atraso registrado.');state.selected=null;state.request=null;state.search=[];$('entryForm').reset();$('selectedStudent').innerHTML='';$('entryResults').innerHTML='';$('lastRecord').innerHTML=`<p>Último registro: ${esc(s.full_name)}</p>${button('Desfazer em até 2 minutos','undo',r.id)}`;search.focus();}catch(err){msg(errorText(err),'error');$('recordBtn').disabled=false;}finally{busy=false;}};}
function pick(i){const s=state.search[i];if(!s)return;state.selected=s;state.request=crypto.randomUUID();$('entrySearch').value=s.full_name;$('entrySearch').setAttribute('aria-expanded','false');$('entryResults').innerHTML='';$('selectedStudent').innerHTML=`<div class="selected-student"><h3>${esc(s.full_name)}</h3><p>${esc(s.grade)} · RA ${esc(s.ra)}</p><p><strong>${s.unjustified_count} de ${s.late_limit} atrasos</strong> · ${status(s)}</p></div>`;$('recordBtn').disabled=s.blocked||!s.active||!s.verified||!s.enrollment_approved;if(!$('recordBtn').disabled)$('recordBtn').focus();}
async function run(fn,refresh=true){if(busy)return;busy=true;const buttons=[...$('view').querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);try{const r=await fn();msg(r?.notice||'Operação concluída.');if(refresh)await render();}catch(e){msg(errorText(e),'error');}finally{busy=false;buttons.filter(b=>b.isConnected).forEach(b=>b.disabled=false);bindPager(state.rows);}}
$('view').onclick=e=>{const b=e.target.closest('[data-action]');if(!b||b.disabled)return;void action(b.dataset.action,b.dataset.id).catch(err=>msg(errorText(err),'error'));};
async function action(a,id){
if(a==='student-advanced'){const panel=$('studentAdvancedPanel');if(panel)panel.hidden=!panel.hidden;return;}
if(a==='student-prev'||a==='student-next'){state.offset=Math.max(0,state.offset+(a==='student-next'?studentPageSize:-studentPageSize));await render();return;}
if(a==='student-more'){const row=state.rows.find(r=>String(r.id)===id);if(!row)return;openModal('Ações de '+row.full_name,`<div class="history-modal-actions">${button('Histórico','history',row.id)}${admin()?button('Gerenciar','student-manage',row.id):''}</div>`);$('modalBody').onclick=e=>{const btn=e.target.closest('[data-action]');if(btn){$('modal').close();void action(btn.dataset.action,btn.dataset.id).catch(err=>msg(errorText(err),'error'));}};return;}
if(a==='clear-student-filters'){studentsFilter={};state.offset=0;await render();return;}
if(a==='clear-enrollment-search'){enrollmentSearch='';state.offset=0;signupApplicationsOffset=0;await render();return;}
if(a==='annual-history'){location.hash='/history';return;}
if(a==='renewal-show'||a==='annual-open-list'){renewalView=true;renewalFilter='pending';renewalOffset=0;studentsTab='list';if(state.page==='students')await render();else location.hash='/students';return;}
if(a==='renewal-hide'){renewalView=false;renewalOffset=0;await render();return;}
if(a==='renewal-filter'){renewalFilter=id;renewalOffset=0;await render();return;}
if(a==='renewal-prev'||a==='renewal-next'){renewalOffset=Math.max(0,renewalOffset+(a==='renewal-next'?25:-25));await render();return;}
if(a==='annual-process'){await run(async()=>{const result=await academicManage('process_due');state.academic=await academicState();return result;});return;}
if(a==='annual-renew'){const r=renewalData?.rows?.find(x=>x.id===id);if(!r)return;
 const options=state.classes.filter(c=>c.active);
 openModal('Atualizar matrícula de '+r.full_name,`<form id="renewalForm"><p>Última matrícula: <strong>${esc(r.previous_grade)} • ${esc(r.previous_class_name)} (${r.previous_year})</strong></p><label>Situação final<select name="outcome" id="renewalOutcome" required><option value="approved">Aprovado</option><option value="reproved">Reprovado</option><option value="completed">Concluiu o ensino médio</option><option value="transferred">Transferido ou saiu da escola</option></select></label><p id="renewalHint" class="hint" aria-live="polite"></p><label id="renewalClassLabel">Turma de destino<select name="class" id="renewalClass" required></select></label><p>Esta confirmação altera a matrícula do aluno e é registrada na auditoria.</p><button type="submit" class="primary">Confirmar renovação</button></form>`,async d=>{const result=await academicManage('renew',{id,...d});renewalOffset=0;state.academic=await academicState();return result;});
 const select=$('renewalOutcome'),target=$('renewalClass'),label=$('renewalClassLabel'),hint=$('renewalHint');
 const update=()=>{const key=annualSuggestedKey(r.previous_grade,select.value),needsClass=['approved','reproved'].includes(select.value);label.hidden=!needsClass;target.disabled=!needsClass;target.required=needsClass;const matching=options.filter(c=>annualGradeKey(c.grade)===key);target.innerHTML='<option value="">Selecione a turma</option>'+matching.map(c=>`<option value="${esc(c.id)}">${esc(c.grade+' • '+c.name)}</option>`).join('');hint.textContent=!needsClass?'O aluno deixará a lista de matrículas ativas.':!key?'Não foi possível determinar a série. Para última série do ensino médio, escolha Concluiu; para outras séries, peça à Direção para padronizar a nomenclatura.':!matching.length?'Ainda não existe turma ativa na série prevista. A Direção precisa cadastrar a turma de destino antes da renovação.':`Série calculada automaticamente: ${matching[0].grade}. Selecione a turma de destino.`;};select.onchange=update;update();return;}
const row=state.rows.find(r=>String(r.id)===id);if(a==='applications-next'||a==='applications-prev'){signupApplicationsOffset=Math.max(0,Math.min(10000,signupApplicationsOffset+(a==='applications-next'?25:-25)));await render();return;}
if(a==='students-tab'){renewalView=false;studentsTab=['list','enrollments','classes'].includes(id)?id:'list';state.offset=0;searchToken++;await render();return;}
if(a==='history-prev'||a==='history-next'){state.offset=Math.max(0,state.offset+(a==='history-next'?historyPageSize:-historyPageSize));await render();return;}
if(a==='prev'||a==='next'){state.offset=Math.max(0,state.offset+(a==='next'?25:-25));await render();return;}
if(a==='open-reports'){reportFilter={kind:state.page==='history'?'history':state.page==='enrollments'||state.page==='students'&&studentsTab==='enrollments'?'enrollments':'students',class:state.page==='history'?historyFilter.class||'':state.page==='students'?studentsFilter.class||'':'',grade:''};location.hash='/reports';return;}
if(a==='export-report'){if(!staff()||state.page!=='reports'||!state.report)throw Error('Relatório disponível apenas para a equipe institucional.');await run(async()=>{const {saveReportWorkbook}=await import('./report-xlsx.js');saveReportWorkbook(state.report);return {notice:'Resumo agregado exportado.'};},false);return;}
if(a==='privacy-notice'){const policy=await read('settings');openModal('Privacidade da escola',`<p class="prewrap">${esc(policy.privacy_notice)}</p><p>Responsável: ${esc(policy.controller||'Consulte a secretaria')}</p><p>Contato: ${esc(policy.privacy_contact||'Consulte a secretaria')}</p><p class="prewrap">${esc(policy.retention_policy)}</p>`);return;}
if(a==='retry'){await render();return;}
if(a==='history-actions'){
 if(!staff()||state.page!=='history'||!row)return;
 const options=[row.can_undo?button('Desfazer registro','undo',row.id):'',admin()&&row.status!=='void'?button('Corrigir / anular','correct',row.id):'',admin()&&row.status==='active'?button('Perdoar atraso','forgive',row.id):''].filter(Boolean);
 openModal('Ações do registro',`<p><strong>${esc(row.full_name)}</strong> · ${esc(dateBR(row.occurred_at))}</p><div class="history-modal-actions">${options.length?options.join(''):'<p>Não há alterações disponíveis para este registro.</p>'}</div>`);
 $('modalBody').onclick=e=>{const btn=e.target.closest('[data-action]');if(btn){$('modal').close();void action(btn.dataset.action,btn.dataset.id).catch(err=>msg(errorText(err),'error'));}};
 return;
}
if(a==='clear-history-filters'){historyFilter={};historySearch='';state.historyStudent='';state.offset=0;await render();return;}
if(a==='history'){state.historyStudent=id;historyFilter={};if(state.page==='history'){state.offset=0;await render();}else location.hash='/history';return;}
if(a==='all-history'){state.historyStudent='';state.offset=0;await render();return;}
if(['chance','undo','correct','forgive','archive','restore','approve','reset_student'].includes(a)){const title={chance:'Conceder mais um atraso de limite',undo:'Desfazer registro recente',correct:'Anular ocorrência incorreta',forgive:'Perdoar atraso',archive:'Arquivar aluno',restore:'Restaurar aluno',approve:'Validar matrícula existente',reset_student:'Iniciar novo período individual'}[a];await reasonAction(title,a,['undo','correct','forgive'].includes(a)?{event:id}:{student:id});return;}
if(a==='student-manage'){openModal(row.full_name,`<dl class="details"><div><dt>RA</dt><dd>${esc(row.ra)}</dd></div><div><dt>Contagem</dt><dd>${row.unjustified_count}/${row.late_limit}</dd></div></dl><div class="toolbar">${button('Editar dados','edit-student',id)}${button('Nova chance','chance',id)}${!row.enrollment_approved?button('Validar matrícula','approve',id):''}${button('Novo período','reset_student',id)}${button('Arquivar','archive',id,'danger')}</div><p>Perdão e correção são feitos sobre cada ocorrência no Histórico.</p>`);$('modalBody').onclick=e=>{const b=e.target.closest('[data-action]');if(b){$('modal').close();void action(b.dataset.action,b.dataset.id);}};return;}
if(a==='edit-student'){const detail=await read('student_admin',{student:id});openModal('Corrigir dados escolares',`<form>${field('Nome completo','name','text',row.full_name,'maxlength="120"')}${field('RA','ra','text',detail.ra,'pattern="[0-9]{7,16}(sp)?"')}${field('Data de nascimento','birth','date',detail.birth_date)}<label>Turma<select name="class" required>${classesOptions(row.class_id,false)}</select></label>${reasonField}${save}</form>`,d=>write('edit_student',{student:id,...d}));return;}
if(a==='class-new'||a==='class-edit'){if(!admin()||state.page!=='students'||!['classes','enrollments'].includes(studentsTab))throw Error('Gerenciamento de turmas reservado à Direção.');const r=a==='class-edit'?state.classes.find(c=>c.id===id):null;if(a==='class-edit'&&!r)throw Error('Turma não encontrada. Atualize a página.');openModal(id?'Editar série e turma':'Cadastrar série e turma',`<form>${field('Série / ano','grade','text',r?.grade||'','maxlength="70"')}${field('Turma','name','text',r?.name||'','maxlength="20"')}<label>Situação<select name="active"><option value="true">Ativa</option><option value="false" ${r?.active===false?'selected':''}>Inativa</option></select></label>${save}</form>`,async d=>{await write('class',{id:r?.id||null,...d});state.classes=await read('classes');});return;}
if(a==='enrollment-new'||a==='enrollment-edit'||a==='enrollment-from-application'){
 const application=a==='enrollment-from-application'?signupApplications.find(p=>p.id===id):null;
 if(a==='enrollment-from-application'&&!application)throw Error('Ficha não encontrada. Atualize a página.');
 const r=application?{full_name:application.full_name,ra:application.ra,email:application.ra+'@al.educacao.sp.gov.br',birth_date:application.birth_date||'',class_id:state.classes.find(c=>c.grade+' • '+c.name===application.grade)?.id||''}:row||{};
 const editing=a==='enrollment-edit';
 openModal(editing?'Editar matrícula':'Cadastrar matrícula escolar',`<form><p class="hint">${application?'Os dados abaixo foram informados pelo aluno e não foram conferidos. Compare com a matrícula oficial antes de salvar.':'Informe os dados oficiais. O e-mail escolar é sugerido automaticamente a partir do RA.'}</p><div class="form-grid">${field('Nome completo','name','text',r.full_name||'','maxlength="120"')}${field('RA','ra','text',r.ra||'','pattern="[0-9]{7,16}(sp)?"')}${field('E-mail institucional','email','email',r.email||'')}${field('Data de nascimento','birth','date',r.birth_date||'')}<div class="enrollment-class-picker"><label>Série e turma<select id="enrollmentClassSelect" name="class" required>${classesOptions(r.class_id,false)}</select></label>${admin()?'<button id="inlineClassToggle" class="outline" type="button" aria-controls="inlineClassForm" aria-expanded="false">+ Criar turma</button>':''}</div>${editing?`<label>Situação<select name="active"><option value="true">Ativa</option><option value="false" ${r.active===false?'selected':''}>Inativa</option></select></label>`:'<input type="hidden" name="active" value="true">'}</div>${save}</form>${admin()?`<form id="inlineClassForm" class="inline-class-form" hidden><h3>Nova série e turma</h3><p class="muted">Cadastre a turma sem perder os dados do aluno. Ela será selecionada automaticamente.</p><label>Série / ano<input name="grade" maxlength="70" required placeholder="Ex.: 3º ano do Ensino Médio"></label><label>Turma<input name="name" maxlength="20" required placeholder="Ex.: A"></label><div class="toolbar"><button type="submit" class="primary">Salvar turma</button><button id="inlineClassCancel" type="button" class="outline">Cancelar</button></div></form>`:''}`,async d=>{
  if(!SCHOOL_EMAIL.test(d.email)||d.email.toLowerCase()!==d.ra.trim().toLowerCase()+'@al.educacao.sp.gov.br')throw Error('Confira o RA e o e-mail institucional. Eles precisam corresponder.');
  const saved=await write('enrollment',{id:editing?id:null,...d});studentsTab='enrollments';enrollmentSearch='';state.offset=0;
  return saved;
 });
 const form=$('modalBody').querySelector('form');const ra=form.elements.ra,email=form.elements.email;
 // Não substitui e-mails já editados manualmente ou matrículas existentes.
 let autoEmail=!editing&&!email.value;
 ra.addEventListener('input',()=>{const value=ra.value.trim().toLowerCase();if(autoEmail)email.value=/^[0-9]{7,16}(sp)?$/.test(value)?value+'@al.educacao.sp.gov.br':'';});
 email.addEventListener('input',()=>{autoEmail=false;});
 // A criação de turma fica dentro do mesmo diálogo, sem destruir o formulário do aluno.
 const classForm=$('inlineClassForm'),classToggle=$('inlineClassToggle');
 if(classForm&&classToggle){
  const toggle=show=>{classForm.hidden=!show;classToggle.setAttribute('aria-expanded',String(show));if(show)classForm.elements.grade.focus();else classToggle.focus();};
  classToggle.onclick=()=>toggle(classForm.hidden);
  $('inlineClassCancel').onclick=()=>toggle(false);
  classForm.onsubmit=async event=>{
   event.preventDefault();if(busy)return;
   const submit=classForm.querySelector('[type=submit]');busy=true;submit.disabled=true;$('modalError').hidden=true;
   try{
    const data=dataForm(classForm);
    const grade=data.grade.trim(),name=data.name.trim();
    if(!grade||!name)throw Error('Informe a série e a turma.');
    const already=state.classes.find(c=>c.grade.toLocaleLowerCase('pt-BR')===grade.toLocaleLowerCase('pt-BR')&&c.name.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR'));
    if(already)throw Error(already.active?'Esta turma já está cadastrada. Selecione-a na lista.':'Esta turma está inativa. A Direção precisa reativá-la antes de usar.');
    await write('class',{grade,name,active:'true'});
    state.classes=await read('classes');
    // Escolhe a turma recém-criada e mantém o cadastro de aluno intacto.
    const chosen=state.classes.find(c=>c.active&&c.grade===grade&&c.name===name);
    const select=$('enrollmentClassSelect');
    if(!chosen||!select)throw Error('Turma salva, mas a lista precisa ser atualizada.');
    select.innerHTML=classesOptions(chosen.id,false);
    select.value=chosen.id;
    classForm.reset();toggle(false);select.focus();
   }catch(err){msg(errorText(err),'error','modalError');}
   finally{busy=false;submit.disabled=false;}
  };
 }
 return;
}
if(a==='invite'){openModal('Autorizar funcionário',`<form>${field('E-mail autorizado','email','email')}<label>Cargo<select name="role"><option value="secretaria">Secretaria</option><option value="admin">Direção</option></select></label><p>A autorização dura 14 dias. O funcionário deve abrir o portal, escolher Acesso institucional e criar a própria conta.</p>${save}</form>`,d=>rpc('create_staff_invite',{p_email:d.email,p_role:d.role}));return;}
if(a==='role'){openModal('Permissões de '+row.full_name,`<form><label>Cargo<select name="role"><option value="secretaria">Secretaria</option><option value="admin" ${row.role==='admin'?'selected':''}>Direção</option></select></label><label>Situação<select name="active"><option value="true">Ativo</option><option value="false" ${!row.active?'selected':''}>Suspenso</option></select></label>${reasonField}${save}</form>`,d=>write('role',{user:id,...d}));return;}
if(a==='announcement-new'||a==='announcement-edit'){const r=row||{};openModal('Comunicado escolar',`<form>${field('Título','title','text',r.title||'','maxlength="120"')}<label>Mensagem<textarea name="body" minlength="3" maxlength="2000" required>${esc(r.body||'')}</textarea></label><label>Público<select name="audience"><option value="todos">Todos</option><option value="aluno" ${r.audience==='aluno'?'selected':''}>Alunos</option><option value="equipe" ${r.audience==='equipe'?'selected':''}>Equipe</option></select></label><label>Publicação<select name="active"><option value="true">Visível</option><option value="false" ${r.active===false?'selected':''}>Arquivado</option></select></label>${save}</form>`,d=>write('announcement',{id:id||null,...d}));return;}
if(a==='privacy-new'||a==='privacy-edit'){const r=row||{};openModal('Solicitação ou incidente',`<form><label>Tipo<select name="kind"><option value="solicitacao">Solicitação</option><option value="incidente" ${r.kind==='incidente'?'selected':''}>Incidente</option></select></label><label>Descrição<textarea name="description" minlength="5" maxlength="2000" required ${id?'readonly':''}>${esc(r.description||'')}</textarea></label><label>Situação<select name="status"><option value="aberto">Aberto</option><option value="em_analise" ${r.status==='em_analise'?'selected':''}>Em análise</option><option value="concluido" ${r.status==='concluido'?'selected':''}>Concluído</option></select></label><label>Providências<textarea name="resolution" maxlength="2000">${esc(r.resolution||'')}</textarea></label>${save}</form>`,d=>write('privacy',{id:id||null,...d}));return;}
if(a==='reset-period'){openModal('Encerrar período agora?',`<p>Os contadores de todos os alunos não arquivados serão reiniciados. O histórico será preservado.</p><form>${field('Digite ENCERRAR para confirmar','confirm')}${save}</form>`,d=>{if(d.confirm!=='ENCERRAR')throw Error('Digite ENCERRAR.');return rpc('reset_period_now',{});});return;}
if(a==='cancel-reset'){await run(()=>rpc('cancel_period_reset',{p_id:Number(id)}));return;}
}
// Limpa callbacks antigos dos modais para evitar ações reaproveitadas.
// Cada abertura reinicia os eventos específicos do modal.
db.auth.onAuthStateChange(event=>{if(event==='PASSWORD_RECOVERY'){recovering=true;auth('reset');}else if(event==='SIGNED_OUT')clearSession();else if(event==='SIGNED_IN'&&!recovering&&!state.me)setTimeout(()=>void loadSession(),0);});
// Uma consulta por minuto, somente na tela pendente e com aba visível.
// A aprovação da Secretaria libera a sessão existente sem novo login.
setInterval(async()=>{
 if(document.hidden||state.me?.role!=='aluno'||!state.academic?.pending||authLoading)return;
 try{
  const next=await academicState();
  if(next?.pending)return;
  state.me=await read('me');state.classes=await read('classes');state.academic=next;
  await route();
 }catch{ /* Mantém a tela pendente e permite tentar Atualizar manualmente. */ }
},60000);
if(recovering)auth('reset');else await loadSession();
