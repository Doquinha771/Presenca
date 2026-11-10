import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,SCHOOL_NAME} from '../config.js?v=5.0.0';
import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/+esm';
import {esc,dateBR,errorText,roleName,SCHOOL_EMAIL} from './utils.js?v=5.0.0';
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
 // Entrada em cascata calma: cada bloco aparece um pouco depois do anterior.
 const blocks=[...view.querySelectorAll(':scope > *, :scope > * > .panel, :scope > * > .tile')].slice(0,10);
 (blocks.length?blocks:[view]).forEach((el,i)=>el.animate([{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'none'}],{duration:520,delay:i*90,easing:'cubic-bezier(.2,.7,.2,1)',fill:'backwards'}));
}
const reducedMotion=()=>Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
const paths={overview:['Visão geral','Resumo dos registros e avisos da escola.','M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z'],entry:['Registrar atraso','Localize o aluno e registre um atraso.','M12 8v4l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0'],students:['Alunos','Consulte alunos, matrículas, séries e turmas em um só lugar.','M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M20 8v6 M17 11h6'],history:['Histórico','Ocorrências preservadas, com suas correções e justificativas.','M4 3h16v18H4z M8 8h8 M8 12h8 M8 16h5'],enrollments:['Matrículas','Autorize o cadastro e mantenha os dados escolares.','M4 4h16v16H4z M8 8h8 M8 12h8 M8 16h4'],classes:['Séries e turmas','Cadastre turmas e consulte seus estudantes.','M3 21V7l9-5 9 5v14 M9 21v-7h6v7 M7 9h1 M16 9h1'],approvals:['Aprovações','Aceite ou recuse alunos e funcionários que pediram acesso.','M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M16 11l2 2 4-4'],team:['Equipe','Adicione, gerencie e remova os funcionários da escola.','M4 21v-3a5 5 0 0 1 10 0v3 M13 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M17 4a4 4 0 0 1 0 8 M18 15a4 4 0 0 1 3 4v2'],adjustments:['Novas chances e ajustes','Consulte alterações e justificativas registradas.','M4 5h16v14H4z M8 10h8 M12 6v8'],announcements:['Comunicados','Consulte e publique avisos da escola.','M3 10v4h4l11 5V5L7 10z M7 14l2 7'],archive:['Arquivo escolar','Consulte matrículas encerradas e histórico.','M3 3h18v5H3z M5 8v13h14V8 M9 12h6'],period:['Período e regras','Gerencie os períodos e as regras da escola.','M4 5h16v16H4z M8 2v6 M16 2v6 M4 10h16'],audit:['Auditoria','Consulte as operações administrativas.','M5 3h14v18H5z M9 7h6 M9 12h6 M9 17h6'],reports:['Relatórios Excel','Gere planilhas conforme os filtros selecionados.','M4 4h16v16H4z M8 8h8 M8 12h8 M8 16h8'],storage:['Armazenamento','Espaço do banco de dados e limpeza dos dados de quem saiu da escola.','M4 6h16v4H4z M4 14h16v4H4z'],achievements:['Minhas conquistas','Medalhas que você ganha chegando no horário.','M8 21h8 M12 17v4 M7 4h10v5a5 5 0 0 1-10 0z M7 6H4a3 3 0 0 0 3 4 M17 6h3a3 3 0 0 1-3 4'],calendar:['Calendário escolar','Feriados, recessos e férias: dias sem aula que não contam como letivos.','M4 5h16v15H4z M4 10h16 M8 3v4 M16 3v4'],privacy:['Privacidade','Consulte solicitações e incidentes de privacidade.','M12 2l8 4v6c0 5-8 10-8 10S4 17 4 12V6z M9 12l2 2 4-4']};
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
 const off=offDays(),noClass=list.map((r,i)=>{const d=new Date(String(r.day||'').slice(0,10)+'T12:00:00');return Number.isNaN(d.getTime())||isSchoolDay(d,off)?'':`<rect class="trend-off" x="${left+i*step-step/2}" y="${top}" width="${step}" height="${height-top-bottom}"><title>Sem aula</title></rect>`;}).join('');
 return `<svg class="dashboard-trend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Atrasos nos últimos 14 dias; faixas cinza são dias sem aula">${noClass}${grid}<polyline class="trend-line" pathLength="1" points="${points}"></polyline>${dots}${labels}</svg>`;
}
const allowed=()=>state.me?.role==='aluno'?['overview','achievements','history','announcements']:admin()?Object.keys(paths).filter(p=>p!=='achievements'):['overview','entry','students','history','enrollments','reports','announcements'];
// Matrículas e séries/turmas ficam dentro de Alunos. As rotas antigas continuam aceitas.
const visiblePages=()=>allowed().filter(page=>page!=='enrollments'&&page!=='classes');
let studentsTab='list',enrollmentSearch='',signupApplications=[],signupApplicationsOffset=0;
let renewalView=false,renewalFilter='pending',renewalSearch='',renewalOffset=0,renewalData=null;
let announcementFilter={query:'',type:'todos'};


// Flaticon Uicons: estilos carregados pela CDN oficial, com atribuição no rodapé.
const iconNames={flame:'flame',sun:'sun',medal:'medal',trophy:'trophy','calendar-check':'calendar-check',overview:'home',approvals:'user-add',entry:'clock',students:'users',history:'time-past',enrollments:'document-signed',classes:'graduation-cap',team:'user-gear',adjustments:'document',announcements:'megaphone',archive:'archive',period:'calendar-clock',audit:'shield-check',reports:'file-excel',storage:'database',achievements:'trophy',privacy:'shield',graduation:'graduation-cap',menu:'menu-burger',theme:'moon',refresh:'refresh',clock:'clock',limit:'chart-histogram',forgiven:'check-circle',announcement:'megaphone',calendar:'calendar',copy:'copy',chevron:'angle-right',back:'angle-left',quote:'quote-right',bell:'bell',users:'users',alert:'exclamation',flag:'flag',school:'school',search:'search',filter:'filter',download:'download',menuDots:'menu-dots-vertical',info:'info',plus:'plus'};
function uiIcon(name){return `<i class="fi fi-rr-${iconNames[name]||'document'}" aria-hidden="true"></i>`;}
const sidebarMenus={
 aluno:[['', [['overview','Início','overview'],['achievements','Conquistas','achievements'],['history','Histórico','history'],['announcements','Comunicados','announcements']]]],
 secretaria:[
  ['', [['overview','Início','overview'],['entry','Registrar atraso','plus'],['students','Alunos','students'],['history','Histórico','history'],['announcements','Comunicados','announcements'],['reports','Relatórios','reports']]],
  ['ADMINISTRAÇÃO',[['classes','Turmas','classes'],['enrollments','Cadastros','enrollments'],['period','Período e regras','period']]]
 ],
 admin:[
  ['', [['overview','Início','overview'],['entry','Registrar atraso','plus'],['students','Alunos','students'],['history','Histórico','history'],['announcements','Comunicados','announcements'],['reports','Relatórios','reports']]],
  ['ADMINISTRAÇÃO',[['approvals','Aprovações','approvals'],['team','Equipe','team'],['classes','Turmas','classes'],['enrollments','Cadastros','enrollments'],['period','Período e regras','period'],['calendar','Calendário','calendar'],['storage','Armazenamento','storage'],['privacy','Privacidade','privacy'],['audit','Auditoria','audit']]]
 ]
};
function renderSidebarNav(){
 const groups=sidebarMenus[state.me.role]||sidebarMenus.aluno;
 const inTabbar=[...tabbarPages(),...(staff()?['entry']:[])];
 $('nav').innerHTML=groups.map(([label,items])=>{
   // No celular, o que já está na barra inferior não se repete dentro do menu.
   // No computador, o grupo principal fica no topo e não se repete no painel da conta.
   const links=items.filter(([page])=>allowed().includes(page)).map(([page,text,icon])=>`<a href="#/${page}" data-page="${page}" class="${inTabbar.includes(page)?'in-tabbar':''}${label?'':' in-topnav'}"><span class="nav-icon" aria-hidden="true">${uiIcon(icon)}</span><span class="nav-text"><span>${esc(text)}</span>${label&&paths[page]?.[1]?`<small>${esc(paths[page][1])}</small>`:''}</span></a>`).join('');
   return links?`<div class="nav-group${label?'':' main-group'}">${label?`<p class="nav-heading">${label}</p>`:''}${links}</div>`:'';
 }).join('');
 // Navegação do topo: só o grupo principal; "Registrar atraso" vira o botão de ação.
 const [,mainItems]=groups[0];
 const topNav=$('topNav');if(topNav)topNav.innerHTML=mainItems.filter(([page])=>allowed().includes(page)).map(([page,text,icon])=>page==='entry'
  ?`<a href="#/entry" data-page="entry" class="top-cta">${uiIcon('plus')}<span>${esc(text)}</span></a>`
  :`<a href="#/${page}" data-page="${page}">${esc(text)}</a>`).join('')+moreButton(groups);
}
// Botão visível no topo que abre o painel lateral com as outras áreas (Equipe, Turmas, Armazenamento…).
function moreButton(groups){
 const extra=groups.slice(1).flatMap(([,items])=>items).filter(([page])=>allowed().includes(page)).length;
 if(!extra)return '';
 const label=admin()?'Administração':'Mais opções';
 return `<button type="button" class="top-more" data-open-menu aria-controls="sidebar" title="Abrir o painel com todas as áreas">${uiIcon('menu')}<span>${label}</span><b class="top-more-count">${extra}</b></button>`;
}

// A identificação fica somente na barra lateral, sem um segundo perfil no cabeçalho.
function renderPageProfile(){const el=$('pageProfile');if(el){el.replaceChildren();el.hidden=true;}}

// O cabeçalho mostra o nome da área por extenso e uma frase curta.
// A busca existe uma única vez: dentro da própria página.
function renderHeaderChrome(){
 const title=$('pageTitle');
 if(title&&state.me){const home=state.page==='overview';title.textContent=home?(studentView()?`Olá, ${String(state.me.full_name||'').split(' ')[0]}!`:'Início'):paths[state.page][0];}
 const icon=$('pageIcon');if(icon&&state.me)icon.innerHTML=uiIcon(state.page);
 const desc=$('pageDescription');
 if(desc&&state.me)desc.textContent=state.page==='overview'?(studentView()?'Aqui você confere seus atrasos e os avisos da escola.':cap(longDateBR())):paths[state.page][1];
}
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
  const dt=historyDateParts(r.occurred_at),s=studentEventState(r);
  const menu=`<button type="button" class="history-menu-btn" data-action="history-actions" data-id="${esc(r.id)}" aria-label="Ações do registro de ${esc(r.full_name)}" title="Ações deste registro">${uiIcon('menuDots')}</button>`;
  return `<tr class="lh-${s.key}"><td class="history-date" data-label="Quando"><strong>${dt.date}</strong><small>às ${dt.time}</small></td><td class="history-student" data-label="Aluno"><strong>${esc(r.full_name)}</strong><small>${r.ra?`RA ${esc(r.ra)} · `:''}${esc(historyClassName(r))}</small></td><td data-label="Situação"><div class="hr-state"><span class="lh-badge">${uiIcon(s.icon)}${s.label}</span></div></td><td class="history-comment" data-label="Observação">${esc(r.reason||'Sem observação')}${r.change_reason?`<small>Alteração: ${esc(r.change_reason)}</small>`:''}</td><td data-label="Registrado por">${esc(r.operator_name||'Sistema')}</td><td class="history-action-cell" data-label="Ações">${menu}</td></tr>`;
 }).join('')||'<tr><td colspan="6" class="history-empty">Nenhum atraso encontrado. Tente tirar um dos filtros.</td></tr>';
}
function historyReferencePager(rows){
 const page=Math.floor(state.offset/historyPageSize)+1;
 const knownTotal=rows.length<25?Math.max(page,Math.ceil((state.offset+rows.length)/historyPageSize)):null;
 return `<div class="history-reference-pager"><label class="history-page-size"><select id="historyPageSize" aria-label="Itens por página"><option value="10" ${historyPageSize===10?'selected':''}>10 por página</option><option value="15" ${historyPageSize===15?'selected':''}>15 por página</option><option value="20" ${historyPageSize===20?'selected':''}>20 por página</option></select></label><div class="history-page-nav"><button type="button" class="outline" data-action="history-prev" ${state.offset===0?'disabled':''}>${uiIcon('back')} <span>Anterior</span></button><strong>Página ${page}${knownTotal?' de '+knownTotal:''}</strong><button type="button" class="outline" data-action="history-next" ${rows.length<=historyPageSize?'disabled':''}><span>Próxima</span> ${uiIcon('chevron')}</button></div></div>`;
}
const historyRangeLabels={all:'todo o período',today:'hoje',7:'os últimos 7 dias',30:'os últimos 30 dias',custom:'as datas escolhidas'};
const historyStatusLabels={'':'todas as situações',active:'só os que valem',forgiven:'só os perdoados',void:'só os anulados'};
function historySentence(){
 const room=state.classes.find(c=>c.id===historyFilter.class);
 return `Mostrando ${room?`a turma ${esc(room.grade+' • '+room.name)}`:'todas as turmas'}, ${historyRangeLabels[historyRange]}, ${historyStatusLabels[historyFilter.status||'']}.`;
}
const historyCountLabel=n=>`${n} ${n===1?'atraso encontrado':'atrasos encontrados'}`;
function renderStaffHistory(rows){
 const filtered=historyFilteredRows(rows),n=filtered.slice(0,historyPageSize).length,status=historyFilter.status||'';
 const active=Boolean(historyFilter.class||status||historyRange!=='all'||historySearch);
 const chip=(action,value,label,on)=>`<button type="button" class="chip ${on?'active':''}" data-action="${action}" data-id="${value}" aria-pressed="${on}">${label}</button>`;
 const ranges=[['all','Tudo'],['today','Hoje'],['7','7 dias'],['30','30 dias'],['custom','Escolher datas']].map(([v,l])=>chip('history-range',v,l,historyRange===v)).join('');
 const statuses=[['','Todas'],['active','Valendo'],['forgiven','Perdoados'],['void','Anulados']].map(([v,l])=>chip('history-status',v,l,status===v)).join('');
 return `<section class="panel" aria-label="Filtrar o histórico"><form id="historyFilters" class="hf-form"><label>Buscar aluno<div class="history-search-control"><span>${uiIcon('search')}</span><input id="historyStudentSearch" type="search" value="${esc(historySearch)}" placeholder="Digite o nome ou o RA" autocomplete="off"></div></label><label>Turma<select id="historyClass" name="class">${classesOptions(historyFilter.class)}</select></label><div class="hf-group"><span class="hf-label">Período</span><div class="chip-row">${ranges}</div></div><div class="hf-group"><span class="hf-label">Situação</span><div class="chip-row">${statuses}</div></div><div class="hf-dates" ${historyRange==='custom'?'':'hidden'}><label>De<input id="fromDate" name="from" type="date" value="${esc(historyFilter.from||'')}"></label><label>Até<input id="toDate" name="to" type="date" value="${esc(historyFilter.to||'')}"></label></div><input type="hidden" id="historyStatus" value="${esc(status)}"></form>${state.historyStudent?`<div class="history-current-student">Vendo só um aluno. ${button('Mostrar todos','all-history')}</div>`:''}</section>
 <section class="panel" aria-labelledby="historyResultsTitle"><div class="hr-head"><h2 id="historyResultsTitle">${historyCountLabel(n)}</h2><p>${historySentence()}</p><div class="hr-tools"><label class="history-sort">Ordem <select id="historyOrder" aria-label="Ordenar registros"><option value="recent" ${historyOrder==='recent'?'selected':''}>Mais recentes primeiro</option><option value="oldest" ${historyOrder==='oldest'?'selected':''}>Mais antigos primeiro</option></select></label>${active?`<button type="button" class="outline" data-action="clear-history-filters">${uiIcon('refresh')}<span>Limpar filtros</span></button>`:''}</div></div>
 <div class="table-scroll history-table-wrap"><table class="responsive history-table"><thead><tr><th scope="col">Quando</th><th scope="col">Aluno</th><th scope="col">Situação</th><th scope="col">Observação</th><th scope="col">Registrado por</th><th scope="col">Ações</th></tr></thead><tbody id="historyRows">${renderHistoryRows(filtered)}</tbody></table></div>
 ${historyReferencePager(filtered)}</section>`;
}
// Histórico do aluno: o que conta para o limite fica claro em cada linha, agrupado por mês.
function studentEventState(r){
 if(r.status==='void')return {key:'void',label:'Anulado',note:'Foi cancelado e não conta.',icon:'document'};
 if(r.status==='forgiven')return {key:'forgiven',label:'Perdoado',note:'Não conta para o limite.',icon:'forgiven'};
 if(r.justified)return {key:'justified',label:'Justificado',note:'Não conta para o limite.',icon:'forgiven'};
 return {key:'counts',label:'Conta no limite',note:'Este atraso soma na sua contagem.',icon:'clock'};
}
const spFormat=(options,value)=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',...options}).format(new Date(value));
function studentHistoryMonths(rows){
 const months=new Map();
 rows.filter(r=>!Number.isNaN(new Date(r.occurred_at).getTime())).forEach(r=>{const label=cap(spFormat({month:'long',year:'numeric'},r.occurred_at));if(!months.has(label))months.set(label,[]);months.get(label).push(r);});
 return [...months];
}
function renderStudentHistory(rows,d={}){
 const count=Number(d.count)||0,limit=Number(d.limit)||0,forgiven=Number(d.forgiven)||0,total=Number(d.historical)||0;
 const summary=`<section class="lh-summary" aria-label="Resumo dos seus atrasos"><div class="lh-stat lh-counts"><strong>${count}${limit?`<small> de ${limit}</small>`:''}</strong><span>contam no limite agora</span></div><div class="lh-stat lh-forgiven"><strong>${forgiven}</strong><span>${forgiven===1?'perdoado':'perdoados'}</span></div><div class="lh-stat"><strong>${total}</strong><span>no histórico completo</span></div></section>`;
 const current=historyFilter.status||'';
 const chips=[['','Todos'],['active','Valendo'],['forgiven','Perdoados'],['void','Anulados']].map(([value,label])=>`<button type="button" class="chip ${current===value?'active':''}" data-action="history-status" data-id="${value}" aria-pressed="${current===value}">${label}</button>`).join('');
 const hasDates=Boolean(historyFilter.from||historyFilter.to);
 const filters=`<section class="panel lh-filters" aria-label="Filtros do histórico"><div class="chip-row" role="group" aria-label="Situação">${chips}</div><details class="lh-dates"${hasDates?' open':''}><summary>${uiIcon('calendar')}<span>Filtrar por data</span></summary><form id="historyFilters" class="lh-date-form"><input type="hidden" id="historyStatus" value="${esc(current)}"><label>De<input id="fromDate" type="date" value="${esc(historyFilter.from||'')}"></label><label>Até<input id="toDate" type="date" value="${esc(historyFilter.to||'')}"></label><button type="submit" class="primary">Aplicar</button><button type="button" class="outline" data-action="clear-history-filters">Limpar</button></form></details></section>`;
 const item=r=>{const s=studentEventState(r),dt=historyDateParts(r.occurred_at);return `<li class="history-card lh-${s.key}"><time class="lh-day" datetime="${esc(r.occurred_at)}"><strong>${spFormat({day:'2-digit'},r.occurred_at)}</strong><small>${spFormat({weekday:'short'},r.occurred_at).replace('.','')}</small></time><div class="lh-body"><p class="lh-time">Chegou às <strong>${dt.time}</strong></p><p class="lh-reason">${r.reason?esc(r.reason):'Sem observação'}</p>${r.change_reason?`<p class="lh-change">Alteração: ${esc(r.change_reason)}</p>`:''}<small>Registrado por ${esc(r.operator_name||'registro antigo')}</small></div><div class="lh-state"><span class="lh-badge">${uiIcon(s.icon)}${s.label}</span><small>${s.note}</small></div></li>`;};
 const groups=rows.length?studentHistoryMonths(rows).map(([month,list])=>`<section class="lh-month" aria-label="${esc(month)}"><h3><span>${esc(month)}</span><small>${list.length} ${list.length===1?'registro':'registros'}</small></h3><ol class="history-stack">${list.map(item).join('')}</ol></section>`).join(''):`<div class="panel">${emptyState('forgiven','Nenhum registro por aqui.',current||hasDates?'Tente mudar a situação ou as datas.':'Continue chegando no horário!')}</div>`;
 return summary+filters+groups+pager(rows);
}
// Medidor circular em SVG (atributos, não estilos inline, por causa da CSP).
function ringSvg(value,max,tone){
 const c=2*Math.PI*52,p=max>0?Math.min(1,value/max):0;
 const ticks=Array.from({length:12},(_,i)=>{const a=i*Math.PI/6,x1=60+44*Math.sin(a),y1=60-44*Math.cos(a),x2=60+(i%3?40:37)*Math.sin(a),y2=60-(i%3?40:37)*Math.cos(a);return `<line class="ring-tick${i%3?'':' major'}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"></line>`;}).join('');
 return `<svg class="ring ring-${tone}" viewBox="0 0 120 120" aria-hidden="true">${ticks}<circle class="ring-track" cx="60" cy="60" r="52"></circle><circle class="ring-fill" cx="60" cy="60" r="52" stroke-dasharray="${(c*p).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 60 60)"></circle></svg>`;
}
function barSvg(pct){return `<svg class="bar" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true"><rect class="bar-track" width="100" height="8" rx="4"></rect><rect class="bar-fill" width="${Math.max(0,Math.min(100,pct))}" height="8" rx="4"></rect></svg>`;}
// O fundo do site acompanha a situação do aluno: céu limpo, nublado ou tempestade.
function setStudentMood(tone){['ok','warn','danger'].forEach(t=>document.body.classList.toggle('mood-'+t,tone===t));}
function moodFromProfile(me){
 if(!me||typeof me.unjustified_count!=='number'||typeof me.late_limit!=='number')return '';
 return studentSituation({count:me.unjustified_count,limit:me.late_limit,blocked:me.blocked}).tone;
}
function studentSituation(d){
 const count=Number(d.count)||0,limit=Number(d.limit)||0,left=Math.max(0,limit-count);
 if(d.blocked||(limit&&count>=limit))return {tone:'danger',title:'Limite atingido',text:'Procure a Direção da escola para conversar sobre seus atrasos.'};
 if(limit&&left<=1)return {tone:'warn',title:'Atenção',text:'Falta só 1 atraso para chegar ao limite. Tente chegar no horário.'};
 return {tone:'ok',title:'Tudo certo',text:`Você ainda pode ter ${left} ${left===1?'atraso':'atrasos'} antes do limite.`};
}
function emptyState(icon,title,text=''){return `<div class="empty-state">${uiIcon(icon)}<strong>${title}</strong>${text?`<p>${text}</p>`:''}</div>`;}
function newsList(rows){return `<ul class="news-list">${rows.map(n=>{const [label,klass]=announcementTone(n);return `<li><span class="pill ${klass}">${label}</span><h4>${esc(n.title)}</h4><p>${esc(n.body)}</p><small>${dateBR(n.created_at)}</small></li>`;}).join('')}</ul>`;}
// Dias letivos (segunda a sexta) depois de "from" até hoje, contando hoje.
let schoolCalendar=null;
async function loadCalendar(force=false){
 if(schoolCalendar&&!force)return schoolCalendar;
 try{const rows=await rpc('calendar_manage',{p_action:'list',p_args:{}});schoolCalendar=Array.isArray(rows)?rows:[];}
 catch(e){schoolCalendar=[];schoolCalendar.missing=['PGRST202','42883'].includes(e?.code);}
 return schoolCalendar;
}
const dayKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const offDays=()=>new Set((schoolCalendar||[]).map(r=>String(r.day).slice(0,10)));
const isSchoolDay=(d,off=offDays())=>d.getDay()!==0&&d.getDay()!==6&&!off.has(dayKey(d));
function schoolDaysSince(from,off=offDays()){
 const day=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
 const end=day(new Date());let cur=day(from),n=0;
 while(cur<end){cur=new Date(cur.getFullYear(),cur.getMonth(),cur.getDate()+1);if(isSchoolDay(cur,off))n++;}
 return n;
}
// Sequência: dias letivos seguidos sem atraso. Sem nenhum atraso, conta desde o início do ano letivo (1º de fevereiro).
function studentStreak(recent){
 const valid=(Array.isArray(recent)?recent:[]).filter(r=>r.status!=='void').map(r=>new Date(r.occurred_at)).filter(d=>!Number.isNaN(d.getTime())).sort((a,b)=>b-a);
 const now=new Date(),yearStart=new Date(now.getFullYear()-(now.getMonth()<1?1:0),1,1);
 const never=!valid.length,lateToday=!never&&valid[0].toDateString()===now.toDateString();
 const days=lateToday?0:schoolDaysSince(never?new Date(yearStart.getTime()-864e5):valid[0]);
 const label=days===1?'1 dia letivo seguido sem atraso':`${days} dias letivos seguidos sem atraso`;
 const note=lateToday?'Hoje teve atraso registrado. A contagem recomeça amanhã.':never?'Contando desde o início do ano letivo. Você ainda não teve atrasos!':'Contando desde o seu último atraso. Fins de semana, feriados e férias não entram.';
 return {days,never,lateToday,label,note};
}
// Tico: desenho do assets/tico.js; ao toque, dá um pulinho e muda o recado.
function ticoSvg(mood){return window.TicoArt?window.TicoArt.svg(mood):'';}
const ticoLines={happy:['Pontualidade é o seu superpoder!','Hoje vai ser um ótimo dia de aula.','Mochila pronta, horário em dia!'],worried:['Que tal um alarme 10 minutos antes?','Arrume a mochila hoje à noite.','Ainda dá tempo de virar o jogo!'],alarmed:['Converse com a Direção, tá?','Respira fundo: amanhã é um novo dia.']};
function ticoPlay(){
 const t=$('view').querySelector('.s-tico-row .tico');if(!t)return;
 t.classList.remove('hop');void t.getBoundingClientRect();t.classList.add('hop');
 const lines=ticoLines[t.dataset.mood]||ticoLines.happy,msg=$('view').querySelector('.s-tico-row .s-message');
 if(msg)msg.textContent=lines[Math.floor(Math.random()*lines.length)];
}
function streakBox(streak){return `<div class="streak ${streak.days>0?'on':''}"><span class="streak-flame">${uiIcon('flame')}</span><strong>${streak.days}</strong><span><b>${streak.days===1?'dia letivo':'dias letivos'}</b> seguidos sem atraso</span></div>`;}
function studentMessage(sit,streak,first){
 if(sit.tone==='danger')return `${first}, você chegou ao limite de atrasos do período. Procure a Direção para conversar.`;
 if(sit.tone==='warn')return `${first}, falta só 1 atraso para o limite. Vale sair de casa um pouco mais cedo.`;
 if(streak.lateToday)return 'Hoje teve atraso. Amanhã é um novo dia para recomeçar a sequência.';
 return `Muito bem, ${first}! Continue chegando no horário.`;
}

// Conquistas do aluno: medalhas calculadas a partir do painel e do histórico (nada novo é guardado no banco).
function achievementList(d,recent,streak){
 const count=Number(d.count)||0,limit=Number(d.limit)||0,historical=Number(d.historical)||0;
 const valid=(Array.isArray(recent)?recent:[]).filter(r=>r.status!=='void');
 const days=streak.days;
 const run=(id,icon,name,desc,goal,tone)=>({id,icon,name,desc,goal,value:Math.min(goal,days),got:days>=goal,tone});
 return [
  {id:'start',icon:'flag',name:'Primeiro passo',desc:'Entrou no Presença+ para acompanhar seus horários.',goal:1,value:1,got:true,tone:'sky'},
  {id:'clean',icon:'sun',name:'Céu limpo',desc:'Nenhum atraso válido no período atual.',goal:1,value:count===0?1:0,got:count===0,tone:'sun'},
  {id:'half',icon:'limit',name:'Longe do limite',desc:'Ficar abaixo da metade do limite de atrasos.',goal:1,value:limit&&count<limit/2?1:0,got:!!limit&&count<limit/2,tone:'sky'},
  run('week','calendar-check','1 semana','7 dias seguidos sem atraso.',7,'leaf'),
  run('fortnight','calendar','2 semanas','14 dias seguidos sem atraso.',14,'leaf'),
  run('month','medal','1 mês','30 dias seguidos sem atraso.',30,'violet'),
  run('bimester','trophy','Bimestre','60 dias seguidos sem atraso.',60,'gold'),
  run('semester','graduation','Semestre','100 dias seguidos sem atraso.',100,'gold'),
  {id:'comeback',icon:'refresh',name:'Volta por cima',desc:'Já teve atraso, mas emendou 14 dias seguidos sem nenhum.',goal:14,value:valid.length?Math.min(14,days):0,got:valid.length>0&&days>=14,tone:'coral'},
  {id:'spotless',icon:'forgiven',name:'Ficha limpa',desc:'Nenhum atraso em todo o histórico.',goal:1,value:historical===0?1:0,got:historical===0,tone:'violet'}
 ];
}
function achBar(a){const pct=Math.round(Math.min(1,a.value/a.goal)*100);return `<div class="ach-bar" role="progressbar" aria-label="Progresso de ${esc(a.name)}" aria-valuemin="0" aria-valuemax="${a.goal}" aria-valuenow="${a.value}"><span class="ach-fill" data-pct="${pct}"></span></div><small class="ach-count">${a.goal>1?`${a.value} de ${a.goal} dias`:pct===100?'Pronto!':'Ainda não'}</small>`;}
function renderAchievements(d,recent){
 const first=esc(String(state.me.full_name||'').split(' ')[0]||'');
 const sit=studentSituation(d);setStudentMood(sit.tone);
 const mood={ok:'happy',warn:'worried',danger:'alarmed'}[sit.tone];
 const streak=studentStreak(recent),list=achievementList(d,recent,streak);
 const got=list.filter(a=>a.got).length,pct=Math.round(got/list.length*100);
 const next=list.filter(a=>!a.got).sort((a,b)=>(b.value/b.goal)-(a.value/a.goal))[0];
 const level=got>=9?'Lenda da pontualidade':got>=7?'Mestre do relógio':got>=5?'Pontual de carteirinha':got>=3?'Madrugador':'Começando a jornada';
 const say=next?`Bora, ${first}! A próxima é “${next.name}”.`:`Uau, ${first}! Você ganhou todas as medalhas!`;
 const head=`<section class="ach-hero mood-${mood}" aria-labelledby="achTitle"><div class="ach-hero-copy"><p class="s-status-kicker">Minhas conquistas</p><h2 id="achTitle">${level}</h2><p>${say} Você ganhou <strong>${got} de ${list.length}</strong> medalhas.</p><div class="ach-meter" role="progressbar" aria-label="Medalhas conquistadas" aria-valuemin="0" aria-valuemax="${list.length}" aria-valuenow="${got}"><span class="ach-fill" data-pct="${pct}"></span></div></div></section>`;
 const streakCard=`<section class="panel ach-streak" aria-labelledby="achStreak"><h3 id="achStreak">${uiIcon('flame')} Sequência</h3>${streakBox(streak)}<p>${streak.note}</p></section>`;
 const nextCard=next?`<section class="panel ach-next tone-${next.tone}" aria-labelledby="achNext"><h3 id="achNext">${uiIcon('flag')} Próxima medalha</h3><div class="ach-next-row"><span class="ach-coin">${uiIcon(next.icon)}</span><div><strong>${next.name}</strong><small>${next.desc}</small></div></div>${achBar(next)}</section>`:`<section class="panel ach-next tone-gold" aria-labelledby="achNext"><h3 id="achNext">${uiIcon('trophy')} Coleção completa</h3><p>Você conquistou todas as medalhas. Parabéns!</p></section>`;
 const grid=`<section class="panel ach-board" aria-labelledby="achAll"><div class="section-head"><h3 id="achAll">${uiIcon('medal')} Todas as medalhas</h3><span class="pill">${got}/${list.length}</span></div><ul class="ach-grid">${list.map(a=>`<li class="ach-card tone-${a.tone} ${a.got?'got':'locked'}"><span class="ach-coin">${uiIcon(a.icon)}${a.got?`<b class="ach-check" aria-hidden="true">${uiIcon('forgiven')}</b>`:''}</span><strong>${a.name}</strong><small>${a.desc}</small>${a.got?'<em>Conquistada</em>':achBar(a)}</li>`).join('')}</ul></section>`;
 return `<div class="ach-page">${head}${streakCard}${nextCard}${grid}</div>`;
}
// Área do aluno: uma informação principal (a situação) e o resto em apoio, sem repetir números.
function renderStudentHome(d,notes,recent){
 const first=esc(String(state.me.full_name||'').split(' ')[0]||'');
 const sit=studentSituation(d),count=Number(d.count)||0,limit=Number(d.limit)||0;
 setStudentMood(sit.tone);
 const latest=notes.filter(n=>n.active).slice(0,3),last=(Array.isArray(recent)?recent:[]).slice(0,4);
 const streak=studentStreak(recent),list=achievementList(d,recent,streak),got=list.filter(a=>a.got).length;
 const forgiven=Number(d.forgiven)||0,historical=Number(d.historical)||0;
 const status=`<section class="s-status tone-${sit.tone}" aria-labelledby="statusTitle"><p class="s-card-kicker">${uiIcon('limit')} Meus atrasos no período</p><div class="s-status-main"><div class="s-ring">${ringSvg(count,limit,sit.tone)}<p><strong>${count}</strong><small>de ${limit}</small></p></div><div class="s-status-copy"><h2 id="statusTitle">${sit.title}</h2><p>${sit.text}</p></div></div><dl class="s-facts"><div><dt>Limite do período</dt><dd>${limit} atrasos</dd></div><div><dt>Atrasos perdoados</dt><dd>${forgiven}</dd></div><div><dt>No histórico completo</dt><dd>${historical}</dd></div></dl><a class="primary" href="#/history">${uiIcon('history')}<span>Ver meu histórico</span></a></section>`;
 const streakCard=`<section class="panel s-streak mood-${sit.tone}" aria-labelledby="streakTitle"><p class="s-card-kicker" id="streakTitle">${uiIcon('flame')} Sequência sem atraso</p>${streakBox(streak)}<p class="s-streak-note">${streak.note}</p><div class="s-tico-row"><button type="button" class="tico-btn" data-action="tico-play" aria-label="Tocar no Tico">${ticoSvg({ok:'happy',warn:'worried',danger:'alarmed'}[sit.tone])}</button><p class="s-message" aria-live="polite">${studentMessage(sit,streak,first)}</p></div><a class="ach-link" href="#/achievements">${uiIcon('trophy')}<span><strong>Minhas conquistas</strong><small>${got} de ${list.length} medalhas</small></span>${uiIcon('chevron')}</a></section>`;
 const notice=!state.me.enrollment_approved?`<p class="notice s-wide">${uiIcon('info')} Sua matrícula ainda está sendo conferida pela escola. Seus dados estão guardados.</p>`:'';
 const news=`<section class="panel s-news" aria-labelledby="newsTitle"><div class="section-head"><h3 id="newsTitle">${uiIcon('announcement')} Avisos da escola</h3>${latest.length?`<a class="link-lite" href="#/announcements">Ver todos ${uiIcon('chevron')}</a>`:''}</div>${latest.length?newsList(latest):emptyState('bell','Nenhum aviso por enquanto.','Quando a escola publicar algo, aparece aqui.')}</section>`;
 const recentBox=`<section class="panel s-recent" aria-labelledby="recentTitle"><div class="section-head"><h3 id="recentTitle">${uiIcon('clock')} Últimos registros</h3>${last.length?`<a class="link-lite" href="#/history">Ver tudo ${uiIcon('chevron')}</a>`:''}</div>${last.length?`<ul class="recent-list">${last.map(r=>{const dt=historyDateParts(r.occurred_at);return `<li><time datetime="${esc(r.occurred_at)}"><strong>${dt.date.slice(0,5)}</strong><small>${dt.time}</small></time><span>${historyBadge(r)}${r.reason?`<small>${esc(r.reason)}</small>`:''}</span></li>`;}).join('')}</ul>`:emptyState('forgiven','Nenhum atraso registrado.','Continue assim!')}</section>`;
 const tips=`<section class="panel s-tips" aria-labelledby="tipsTitle"><div class="section-head"><h3 id="tipsTitle">${uiIcon('info')} Dicas para chegar no horário</h3></div><ul class="tips-list"><li>${uiIcon('calendar')}<span><strong>Prepare a mochila na noite anterior.</strong> De manhã sobra tempo.</span></li><li>${uiIcon('clock')}<span><strong>Saia 10 minutos mais cedo.</strong> Trânsito e ônibus atrasam.</span></li><li>${uiIcon('bell')}<span><strong>Vai se atrasar por um motivo sério?</strong> Avise a secretaria: dá para justificar.</span></li></ul></section>`;
 return `<div class="s-home">${notice}${status}${streakCard}${recentBox}${news}${tips}</div>`;
}
// Equipe: o número do dia em destaque, os demais como apoio; sem atalhos que repetem o menu.
function renderStaffHome(d,notes,pendingApprovals=0){
 const latest=notes.filter(n=>n.active).slice(0,3),classMax=Math.max(1,...d.classes.map(c=>Number(c.total)||0));
 const today=`<section class="today-card" aria-labelledby="todayTitle"><p class="today-kicker">${uiIcon('calendar')} Hoje</p><h2 id="todayTitle"><strong>${Number(d.today)||0}</strong> ${Number(d.today)===1?'atraso registrado':'atrasos registrados'}</h2><a class="link-lite today-link" href="#/history">Ver histórico ${uiIcon('chevron')}</a><span class="today-art" aria-hidden="true"></span></section>`;
 const tiles=[['Na semana',d.week,'limit','tile-blue','#/history'],['No mês',d.month,'history','tile-violet','#/history'],['Em atenção',d.warning,'alert','tile-amber','#/students'],['Alunos',d.students,'users','tile-green','#/students']];
 const tileHtml=`<div class="staff-tiles">${tiles.map(([label,n,icon,tone,href])=>`<a class="tile ${tone}" href="${href}"><span class="tile-icon">${uiIcon(icon)}</span><strong>${Number(n)||0}</strong><span>${label}</span></a>`).join('')}</div>`;
 const trend=`<section class="panel trend-panel" aria-labelledby="trendTitle"><div class="section-head"><h3 id="trendTitle">${uiIcon('limit')} Atrasos nos últimos 14 dias</h3>${allowed().includes('reports')?`<a class="link-lite" href="#/reports">Abrir relatórios ${uiIcon('chevron')}</a>`:''}</div>${dashboardTrendSvg(d.trend)}</section>`;
 const classes=`<section class="panel class-panel" aria-labelledby="classTitle"><div class="section-head"><h3 id="classTitle">${uiIcon('users')} Por turma nesta semana</h3><a class="link-lite" href="#/students">Ver alunos ${uiIcon('chevron')}</a></div>${d.classes.length?`<ul class="class-bars">${d.classes.map(c=>{const n=Number(c.total)||0;return `<li><span class="class-name">${esc(c.grade||'Sem turma')}</span><span class="class-value">${n} <small>${n===1?'atraso':'atrasos'} · ${Number(c.students)||0} alunos</small></span>${barSvg(Math.round(n/classMax*100))}</li>`;}).join('')}</ul>`:emptyState('users','Sem atrasos nesta semana.')}</section>`;
 const news=`<section class="panel staff-news" aria-labelledby="staffNewsTitle"><div class="section-head"><h3 id="staffNewsTitle">${uiIcon('announcement')} Comunicados recentes</h3><a class="link-lite" href="#/announcements">Ver todos ${uiIcon('chevron')}</a></div>${latest.length?newsList(latest):emptyState('bell','Nenhum comunicado publicado.')}</section>`;
 const waiting=Number(pendingApprovals)||0,alert=waiting?`<a class="approval-alert staff-alert" href="#/approvals">${uiIcon('alert')}<span><strong>${waiting} ${waiting===1?'pedido aguardando':'pedidos aguardando'}</strong> sua aprovação</span>${uiIcon('chevron')}</a>`:'';
 return `<div class="staff-home">${alert}${today}${tileHtml}${trend}${classes}${news}</div>`;
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
function tabbarPages(){return (state.me?.role==='aluno'?['overview','achievements','history','announcements']:['overview','students','history']).filter(k=>allowed().includes(k));}
const tabLabels={overview:'Início',achievements:'Conquistas',history:'Histórico',announcements:'Avisos',students:'Alunos'};
function renderMobileNav(){
 const shortcuts=tabbarPages(),pages=shortcuts.map(k=>`<a data-page="${k}" href="#/${k}">${uiIcon(k)}<span>${tabLabels[k]||paths[k][0]}</span></a>`);
 // A equipe ganha o botão principal no centro: registrar atraso é a tarefa mais frequente.
 if(staff()&&allowed().includes('entry'))pages.splice(1,0,`<a data-page="entry" href="#/entry" class="tab-main" aria-label="Registrar atraso">${uiIcon('plus')}<span>Atraso</span></a>`);
 $('mobileNav').hidden=false;
 $('mobileNav').innerHTML=pages.join('')+`<button type="button" id="mobileMore" aria-controls="sidebar" aria-expanded="false">${uiIcon(studentView()?'users':'menu')}<span>${studentView()?'Conta':'Mais'}</span></button>`;
 $('mobileMore').onclick=()=>toggleNavigation();
}
function closeNavigation(){
 $('sidebar').classList.remove('open');$('navScrim').hidden=true;document.body.classList.remove('nav-open');
 $('menu').setAttribute('aria-expanded','false');$('mobileMore')?.setAttribute('aria-expanded','false');
}
function toggleNavigation(){
 const open=!$('sidebar').classList.contains('open');
 $('sidebar').classList.toggle('open',open);$('navScrim').hidden=!open;document.body.classList.toggle('nav-open',open);
 $('menu').setAttribute('aria-expanded',String(open));$('mobileMore')?.setAttribute('aria-expanded',String(open));
 if(open)[...$('sidebar').querySelectorAll('a,button')].find(el=>el.offsetParent!==null)?.focus();
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
 'student-manage':'team','student-prev':'back','student-next':'chevron','retry':'refresh','invite':'team','role':'team',
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
function openModal(title,html,submit){$('modalBody').onclick=null;$('modalTitle').textContent=title;$('modalBody').innerHTML=html;$('modalError').hidden=true;$('modal').showModal();const form=$('modalBody').querySelector('form');if(form&&submit)form.onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;const btn=form.querySelector('[type=submit]');if(btn)btn.disabled=true;try{const outcome=await submit(dataForm(form));$('modal').close();if(outcome?.temporaryPassword){openModal('Acesso do aluno criado',`<p>Entregue os dados diretamente ao aluno. A senha é exibida apenas nesta tela e não é armazenada no portal.</p><p><strong>E-mail:</strong> ${esc(outcome.email)}</p><div class="credential-box" role="status">${esc(outcome.temporaryPassword)}</div><p class="credential-note">Oriente o aluno a alterar a senha no primeiro acesso por meio de Recuperar senha. Não encaminhe a senha em grupos ou planilhas.</p>`);}else msg(outcome?.notice||(outcome?.enrollment_id?(outcome.linked?'Matrícula registrada e conta existente vinculada. O aluno usa a própria senha após confirmar o e-mail.':'Matrícula salva. O aluno poderá criar a própria conta e senha usando o e-mail escolar.'):'Alterações salvas.'));await render();}catch(err){msg(errorText(err),'error','modalError');}finally{busy=false;if(btn)btn.disabled=false;}};}
const field=(label,name,type='text',value='',extra='')=>`<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra} required></label>`;
const strongPassword=p=>String(p||'').length>=10&&/[A-Za-z]/.test(p)&&/[0-9]/.test(p);
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
 form.elements.email.placeholder=access==='aluno'?'000123456789sp@al.educacao.sp.gov.br':'nome@instituicao.gov.br';
 $('accessExplain').textContent=access==='aluno'
  ?'Alunos usam só o e-mail escolar: RA + sp + @al.educacao.sp.gov.br. Sem ficha na escola, a coordenação precisa aceitar seu pedido antes do primeiro acesso.'
  :'É da equipe? Escolha “Criar minha conta”. Sem convite, seu pedido vai para a Direção aceitar.';
 $('authTitle').textContent={login:access==='aluno'?'Entrar como aluno':'Entrar como equipe',signup:access==='aluno'?'Criar minha conta':'Criar conta da equipe',recover:'Recuperar senha',reset:'Definir nova senha'}[next];
 $('authSubtitle').textContent=signup?(access==='aluno'
  ?'Preencha seus dados e crie uma senha. Depois, confirme no seu e-mail escolar. Se a escola já tiver sua matrícula, o acesso é liberado na hora.'
  :'Use seu e-mail institucional. Se a Direção já adicionou você, o acesso sai na hora.')
  :recover?'Enviaremos um link de recuperação para o e-mail cadastrado.'
  :access==='aluno'?'Use seu e-mail escolar e sua senha.':'Use seu e-mail institucional e sua senha.';
 $('authSubmit').textContent={login:'Entrar',signup:'Criar minha conta',recover:'Enviar link',reset:'Salvar nova senha'}[next];
 // O link da tela atual não aparece de novo: só as outras opções.
 document.querySelectorAll('[data-auth]').forEach(b=>{b.hidden=reset||b.dataset.auth===next;});
 document.querySelectorAll('[data-access]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.access===access)));
 $('authMessage').hidden=true;
}
$('authForm').onsubmit=async e=>{e.preventDefault();const btn=$('authSubmit');if(btn.disabled)return;btn.disabled=true;const d=dataForm(e.target),email=d.email?.trim().toLowerCase(),redirect=new URL('./',location.href).href;try{let result;if(authMode!=='reset'&&access==='aluno'&&!SCHOOL_EMAIL.test(email))throw Error('Aluno entra só com o e-mail escolar: RA + sp + @al.educacao.sp.gov.br. Exemplo: 000123456789sp@al.educacao.sp.gov.br.');if(authMode!=='reset'&&access==='equipe'&&SCHOOL_EMAIL.test(email))throw Error('Esse é um e-mail de aluno. Escolha “Sou aluno”.');if(authMode==='signup'){if(!strongPassword(d.password))throw Error('Crie uma senha com ao menos 10 caracteres, com letras e números.');if(!d.consent)throw Error('Leia e confirme os Termos de Uso e a Política de Privacidade antes de criar a conta.');if(d.name.trim().length<3)throw Error('Informe o nome completo.');if(access==='aluno'&&(!SCHOOL_EMAIL.test(email)||!d.ra||!d.birth||!d.grade))throw Error('Informe RA, e-mail institucional, série, turma e nascimento.');const normalizedRA=String(d.ra||'').trim().toLowerCase().replace(/@al\.educacao\.sp\.gov\.br$/,'');if(access==='aluno'&&normalizedRA!==email.split('@')[0])throw Error('O RA informado precisa corresponder ao início do e-mail escolar.');result=await db.auth.signUp({email,password:d.password,options:{emailRedirectTo:redirect,data:{full_name:d.name.trim(),ra:access==='aluno'?normalizedRA:'',grade:d.grade,birth_date:d.birth,staff_request:access==='equipe'?'true':''}}});if(result.error)throw result.error;msg(access==='aluno'?'Confira seu e-mail escolar e confirme o cadastro. Se sua matrícula já consta na escola, entre com a senha que você criou. Caso ainda não conste, sua ficha aparecerá para a Secretaria; não será necessário receber senha provisória. Se sua conta já existia, use Recuperar senha.':'Conta criada. Confirme o e-mail. Se a Direção já adicionou você, o acesso sai na hora; se não, seu pedido vai para a Direção aceitar.','success','authMessage');}
else if(authMode==='recover'){result=await db.auth.resetPasswordForEmail(email,{redirectTo:redirect});if(result.error)throw result.error;msg('Se o endereço estiver cadastrado, você receberá o link de recuperação.','success','authMessage');}
else if(authMode==='reset'){if(!strongPassword(d.password))throw Error('Crie uma senha com ao menos 10 caracteres, com letras e números.');result=await db.auth.updateUser({password:d.password});if(result.error){if(/session/i.test(result.error.message||'')){recovering=false;auth('recover');throw Error('O link de troca de senha expirou. Peça um novo link abaixo.');}throw result.error;}recovering=false;await db.auth.signOut();auth();msg('Senha alterada. Entre com a nova senha.','success','authMessage');}
else{result=await db.auth.signInWithPassword({email,password:d.password});if(result.error)throw result.error;await loadSession();}}catch(err){msg(errorText(err),'error','authMessage');}finally{btn.disabled=false;}};
document.querySelectorAll('[data-auth]').forEach(b=>b.onclick=()=>auth(b.dataset.auth));
document.querySelectorAll('[data-access]').forEach(b=>b.onclick=()=>{access=b.dataset.access;document.querySelectorAll('[data-access]').forEach(x=>x.classList.toggle('selected',x===b));auth();});
// Documentos jurídicos disponíveis em URLs estáticas mesmo sem autenticação.
$('closeModal').onclick=()=>$('modal').close();
async function loadSession(){if(authLoading||recovering)return;authLoading=true;try{const {data,error}=await db.auth.getUser();if(error||!data.user){state.me=null;auth();return;}state.me=await read('me');state.academic=await academicState();state.classes=state.academic?.pending?[]:await read('classes');$('authView').hidden=true;$('dashboard').hidden=false;document.body.classList.add('portal-layout');const schoolLabel=$('schoolLabel'),userName=$('userName'),userRole=$('userRole'),avatar=$('avatar');if(schoolLabel)schoolLabel.textContent=SCHOOL_NAME;if(userName)userName.textContent=state.me.full_name;if(userRole)userRole.textContent=roleName(state.me.role);if(avatar)avatar.textContent=initials(state.me.full_name);const setText=(id,v)=>{const el=$(id);if(el)el.textContent=v;};setText('menuAvatar',initials(state.me.full_name));setText('menuName',String(state.me.full_name||'').split(' ')[0]);setText('menuRole',roleName(state.me.role));renderSidebarNav();renderMobileNav();renderPageProfile();renderHeaderChrome();await route();}catch(err){state.me=null;auth();let notice=errorText(err);if(err?.code==='42501'){try{const pending=await rpc('portal_registration_status',{});if(pending==='aguardando_instituicao')notice='Sua conta foi criada, mas sua ficha ainda não está na escola. A coordenação precisa aceitar seu pedido ou cadastrar sua ficha; depois disso, é só entrar com a senha que você criou.';else if(pending==='aguardando_email')notice='Confirme o e-mail para ativar sua conta.';else if(pending==='aguardando_direcao')notice='Seu pedido de acesso está com a Direção. Assim que for aceito, você entra com a senha que criou.';}catch{ /* mantém o erro original sem expor informações */ }}msg(notice,err?.code==='42501'?'success':'error','authMessage');}finally{authLoading=false;}}
function clearSession(){document.body.classList.remove('student-overview-mode');document.body.classList.remove('desktop-overview-mode');document.body.classList.remove('staff-shell');document.body.classList.remove('history-page');document.body.classList.remove('students-page');document.body.classList.remove('student-area');setStudentMood('');studentsTab='list';enrollmentSearch='';signupApplications=[];signupApplicationsOffset=0;renewalView=false;renewalFilter='pending';renewalSearch='';renewalOffset=0;renewalData=null;state.academic=null;$('navScrim').after($('mobileNav'));document.body.classList.remove('portal-layout');renderToken++;searchToken++;state.me=null;state.rows=[];state.classes=[];state.search=[];state.selected=null;state.request=null;state.historyStudent='';state.report=null;$('mobileNav').hidden=true;historyFilter={};studentsFilter={};$('view').replaceChildren();$('modal').close();$('modalBody').replaceChildren();$('flash').hidden=true;auth();}
$('logout').onclick=async()=>{const {error}=await db.auth.signOut();if(error){msg(errorText(error),'error');return;}clearSession();};
$('menu').onclick=toggleNavigation;$('topNav').addEventListener('click',e=>{if(e.target.closest('[data-open-menu]'))toggleNavigation();});
// Preferências visuais: tema escuro e texto maior ficam salvos no aparelho.
function prefGet(key){try{return localStorage.getItem(key);}catch{return null;}}
function prefSet(key,value){try{localStorage.setItem(key,value);}catch{}}
function syncPrefs(){
 const dark=document.body.classList.contains('dark'),big=document.body.classList.contains('large-text');
 const t=$('theme');t.setAttribute('aria-pressed',String(dark));t.title=dark?'Modo claro':'Modo escuro';t.innerHTML=`<i class="fi fi-rr-${dark?'sun':'moon'}" aria-hidden="true"></i><span class="sr-only">${dark?'Usar modo claro':'Usar modo escuro'}</span>`;
 const s=$('textSize');s.setAttribute('aria-pressed',String(big));s.title=big?'Modo leitura ligado: voltar ao texto normal':'Modo leitura: texto maior';s.querySelector('.sr-only').textContent=s.title;
 document.querySelector('meta[name=theme-color]')?.setAttribute('content',dark?'#0e1420':'#034ea2');
}
{const saved=prefGet('presenca-theme');document.body.classList.toggle('dark',saved?saved==='dark':Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches));document.body.classList.toggle('large-text',prefGet('presenca-text')==='large');syncPrefs();}
$('theme').onclick=()=>{const dark=document.body.classList.toggle('dark');prefSet('presenca-theme',dark?'dark':'light');syncPrefs();};
$('textSize').onclick=()=>{const big=document.body.classList.toggle('large-text');prefSet('presenca-text',big?'large':'normal');syncPrefs();};
$('revealPassword').onclick=()=>{const input=$('authForm').elements.password,show=input.type==='password';input.type=show?'text':'password';$('revealPassword').setAttribute('aria-pressed',String(show));$('revealPassword').setAttribute('aria-label',show?'Esconder senha':'Mostrar senha');$('revealPassword').innerHTML=`<i class="fi fi-rr-${show?'eye-crossed':'eye'}" aria-hidden="true"></i>`;};
// ---------- Fila sem internet para o registro de atraso ----------
// Cada registro já tem um identificador único (request): reenviar nunca duplica o atraso no banco.
const QUEUE_KEY='presenca.fila-atrasos';
function queueRead(){try{const q=JSON.parse(localStorage.getItem(QUEUE_KEY)||'[]');return Array.isArray(q)?q:[];}catch{return [];}}
function queueSave(q){try{localStorage.setItem(QUEUE_KEY,JSON.stringify(q));}catch{}renderQueue();}
const offlineError=e=>!navigator.onLine||e instanceof TypeError||/failed to fetch|networkerror|load failed|fetch/i.test(String(e?.message||''));
function queueAdd(item){const q=queueRead();if(!q.some(x=>x.request===item.request))q.push(item);queueSave(q);}
let flushing=false;
async function flushQueue(){
 if(flushing||!navigator.onLine||!staff())return;
 // Cada pessoa envia só o que ela mesma registrou neste aparelho.
 let q=queueRead().filter(x=>x.op===state.me?.id);if(!q.length)return;
 flushing=true;let sent=0;const failed=[];
 try{
  for(const item of [...q]){
   const when=new Date(item.at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
   const note=[item.reason,`Registrado sem internet às ${when}`].filter(Boolean).join(' · ').slice(0,500);
   try{await write('record',{student:item.student,request:item.request,reason:note});sent++;}
   catch(e){if(offlineError(e))break;failed.push(`${item.name}: ${errorText(e)}`);}
   q=queueRead().filter(x=>x.request!==item.request);queueSave(q);
  }
 }finally{flushing=false;}
 if(sent||failed.length)msg([sent?`${sent} ${sent===1?'atraso pendente foi enviado':'atrasos pendentes foram enviados'}.`:'',failed.length?`Não foi possível enviar: ${failed.join('; ')}`:''].filter(Boolean).join(' '),failed.length?'error':'success');
 if(sent&&state.page==='history')await render();
}
function renderQueue(){
 const box=$('pendingQueue');const q=queueRead().filter(x=>!state.me||x.op===state.me.id);
 const banner=$('connection');if(banner)banner.textContent=navigator.onLine?'':`Sem internet. Atrasos registrados agora ficam guardados neste aparelho e são enviados quando a conexão voltar.${q.length?` Pendentes: ${q.length}.`:''}`;
 if(!box)return;
 box.hidden=!q.length;
 box.innerHTML=q.length?`<h3>${uiIcon('clock')} ${q.length} ${q.length===1?'atraso pendente de envio':'atrasos pendentes de envio'}</h3><ul>${q.map(x=>`<li><strong>${esc(x.name)}</strong><small>guardado às ${esc(new Date(x.at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}))}</small></li>`).join('')}</ul><p class="muted">${navigator.onLine?'A conexão voltou: envie agora.':'Serão enviados sozinhos quando a internet voltar.'}</p>${navigator.onLine?button('Enviar agora','queue-flush','','primary'):''}`:'';
}
function connection(){$('connection').hidden=navigator.onLine;renderQueue();if(navigator.onLine)void flushQueue();}
window.addEventListener('online',connection);window.addEventListener('offline',connection);connection();
window.addEventListener('hashchange',()=>{if(state.me)void route();});
async function route(){void flushQueue();const p=location.hash.replace('#/','');if((p==='enrollments'||p==='classes')&&allowed().includes(p))studentsTab=p==='classes'?'classes':'enrollments';else if(p==='students')studentsTab='list';state.page=allowed().includes(p)?(['enrollments','classes'].includes(p)?'students':p):'overview';if(state.academic?.pending&&state.page!=='history')state.page='overview';state.offset=0;state.selected=null;state.request=null;state.report=null;searchToken++;pendingRouteMotion=true;$('view').replaceChildren();closeNavigation();$('mobileNav').querySelectorAll('[data-page]').forEach(a=>{a.classList.toggle('active',a.dataset.page===state.page);a.setAttribute('aria-current',a.dataset.page===state.page?'page':'false');});$('nav').querySelectorAll('a').forEach(a=>{const p=a.dataset.page;const active=p===state.page||(state.page==='students'&&((studentsTab==='classes'&&p==='classes')||(studentsTab==='enrollments'&&p==='enrollments')||(studentsTab==='list'&&p==='students')));a.classList.toggle('active',active);});$('topNav')?.querySelectorAll('a').forEach(a=>{const on=a.dataset.page===state.page;a.classList.toggle('active',on);if(on)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});const pageDescription=$('pageDescription');if(pageDescription)pageDescription.textContent=paths[state.page][1];renderPageProfile();renderHeaderChrome();
 const home=studentView()&&state.page==='overview';
 document.body.classList.toggle('student-overview-mode',home);document.body.classList.toggle('desktop-overview-mode',staff()&&state.page==='overview');document.body.classList.toggle('staff-shell',staff());document.body.classList.toggle('history-page',staff()&&state.page==='history');document.body.classList.toggle('students-page',staff()&&state.page==='students');
 document.body.classList.toggle('student-area',studentView());
 setStudentMood(studentView()?moodFromProfile(state.me):'');
 window.scrollTo({top:0,behavior:'auto'});
 await render();}
// ---------- Calendário escolar (Direção cadastra; todos consultam) ----------
const calendarKinds={feriado:'Feriado',recesso:'Recesso',ferias:'Férias'};
function calendarPeriods(rows){
 const out=[];
 for(const r of rows){const day=String(r.day).slice(0,10),last=out[out.length-1];
  const next=last&&new Date(new Date(last.to+'T12:00:00').getTime()+864e5).toISOString().slice(0,10);
  if(last&&last.kind===r.kind&&last.label===r.label&&next===day)last.to=day;else out.push({from:day,to:day,kind:r.kind,label:r.label});}
 return out;
}
function renderCalendar(rows){
 if(rows.missing)return setupCard('O calendário escolar (feriados, recessos e férias) fica disponível depois dela.');
 const br=d=>d.split('-').reverse().join('/');
 const periods=calendarPeriods(rows);
 const form=`<section class="panel" aria-labelledby="calNew"><div class="section-head"><h3 id="calNew">${uiIcon('plus')} Cadastrar dias sem aula</h3></div><p class="muted">Esses dias não contam na sequência sem atraso dos alunos e aparecem como "sem aula" nos gráficos. Para um dia só, deixe a data final vazia.</p><form id="calendarForm" class="form-grid"><label>Primeiro dia<input name="from" type="date" required></label><label>Último dia<input name="to" type="date"></label><label>Tipo<select name="kind"><option value="feriado">Feriado</option><option value="recesso">Recesso</option><option value="ferias">Férias</option></select></label><label>Nome<input name="label" maxlength="80" placeholder="Ex.: Proclamação da República" required></label><button class="primary">Salvar no calendário</button></form></section>`;
 const list=periods.length?`<ul class="calendar-list">${periods.map(p=>`<li><span class="calendar-when"><strong>${br(p.from)}${p.to!==p.from?' a '+br(p.to):''}</strong><small>${calendarKinds[p.kind]||p.kind}</small></span><span class="calendar-name">${esc(p.label)}</span>${button('Remover','calendar-remove',p.from+'|'+p.to,'danger')}</li>`).join('')}</ul>`:emptyState('calendar','Nenhum dia sem aula cadastrado.','Cadastre os feriados e as férias do ano letivo.');
 return `<div class="calendar-page">${admin()?form:''}<section class="panel" aria-labelledby="calList"><div class="section-head"><h3 id="calList">${uiIcon('calendar')} Dias sem aula</h3></div>${list}</section></div>`;
}
// ---------- Equipe e aprovações (somente Direção) ----------
const staffManage=(action,args={})=>rpc('staff_manage',{p_action:action,p_args:args});
const missingRpc=e=>['PGRST202','42883'].includes(e?.code);
let staffData=null;
// Atualização do banco que ainda não foi instalada: o site continua funcionando e explica o passo a passo uma vez só.
const SQL_EDITOR_URL='https://supabase.com/dashboard/project/'+(String(SUPABASE_URL).match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1]||'_')+'/sql/new';
function setupCard(feature){
 return `<section class="setup-card" aria-labelledby="setupTitle"><h3 id="setupTitle">${uiIcon('info')} Falta uma atualização do banco de dados</h3><p>${feature} O restante do portal continua funcionando normalmente.</p><ol><li>Abra o <a href="${SQL_EDITOR_URL}" target="_blank" rel="noopener noreferrer">SQL Editor do Supabase</a> com a conta da escola.</li><li>Cole o conteúdo do arquivo <code>sql/instalar_atualizacoes.sql</code> do projeto e clique em <strong>Run</strong>.</li><li>Volte aqui e atualize a página.</li></ol><p class="muted">O arquivo junta as atualizações 10 a 14 na ordem certa. Pode rodar mais de uma vez sem problema.</p><div class="setup-actions">${button('Atualizar a página','reload-page','','outline')}</div></section>`;
}
const migrationNotice=setupCard('Os pedidos de acesso da equipe, a troca de senha e a remoção de funcionários ficam disponíveis depois dela.');
async function loadStaffData(){try{staffData=await staffManage('list');}catch(e){if(!missingRpc(e))throw e;staffData=null;}return staffData;}
function renderApprovals(applications){
 const requests=staffData?.requests||[],total=applications.length+requests.length;
 const summary=`<section class="approval-summary" aria-label="Resumo dos pedidos"><div class="tile"><strong>${applications.length}</strong><span>${applications.length===1?'aluno aguardando':'alunos aguardando'}</span></div><div class="tile"><strong>${requests.length}</strong><span>${requests.length===1?'pedido da equipe':'pedidos da equipe'}</span></div></section>`;
 const students=applications.length?`<div class="application-grid">${applications.map(r=>`<article class="application-card"><div class="application-card-head"><strong>${esc(r.full_name)}</strong><span class="pill ${r.verified?'ok':'warn'}">${r.verified?'E-mail confirmado':'E-mail pendente'}</span></div><dl><div><dt>RA informado</dt><dd>${esc(r.ra)}</dd></div><div><dt>Série / turma informada</dt><dd>${esc(r.grade||'Não informada')}</dd></div><div><dt>Nascimento informado</dt><dd>${esc(r.birth_date?dateBR(r.birth_date):'Não informado')}</dd></div></dl><div class="approval-actions">${button('Aceitar','enrollment-from-application',r.id,'primary')}${staffData?button('Recusar','student-reject',r.id,'danger'):''}</div></article>`).join('')}</div>`:emptyState('forgiven','Nenhum aluno aguardando.','Quando um aluno criar a conta, o pedido aparece aqui.');
 const team=!staffData?migrationNotice:requests.length?`<div class="application-grid">${requests.map(r=>`<article class="application-card"><div class="application-card-head"><strong>${esc(r.full_name)}</strong><span class="pill ok">E-mail confirmado</span></div><dl><div><dt>E-mail</dt><dd>${esc(r.email)}</dd></div><div><dt>Pediu em</dt><dd>${esc(dateBR(r.created_at))}</dd></div></dl><div class="approval-actions">${button('Aceitar','staff-accept',r.id,'primary')}${button('Recusar','staff-reject',r.id,'danger')}</div></article>`).join('')}</div>`:emptyState('forgiven','Nenhum pedido da equipe.','Funcionários sem convite aparecem aqui depois de confirmar o e-mail.');
 return `<div class="approval-page">${summary}<section class="panel" aria-labelledby="approvalStudents"><div class="section-head"><h3 id="approvalStudents">${uiIcon('students')} Alunos</h3></div><p class="muted approval-help">Confira os dados com a matrícula oficial antes de aceitar. ${total?'':'Tudo em dia por aqui.'}</p>${students}</section><section class="panel" aria-labelledby="approvalTeam"><div class="section-head"><h3 id="approvalTeam">${uiIcon('team')} Equipe</h3></div>${team}</section></div>`;
}
function renderTeam(legacyRows){
 const members=staffData?.members||legacyRows||[],invites=staffData?.invites||[],requests=staffData?.requests||[];
 const situation=r=>r.active?(r.verified?'<span class="pill ok">Ativo</span>':'<span class="pill warn">E-mail pendente</span>'):'<span class="pill block">Suspenso</span>';
 const initials=n=>esc(String(n||'?').split(/\s+/).filter(Boolean).slice(0,2).map(p=>p[0]).join('').toUpperCase());
 const roleTag=r=>`<span class="role-tag role-${esc(r.role)}">${roleName(r.role)}</span>`;
 const actions=r=>r.id===state.me.id?'<span class="you-tag">Sua conta</span>':`<div class="team-actions">${button('Mudar cargo','role',r.id)}${staffData?button('Trocar senha','staff-password',r.id)+button('Remover','staff-remove',r.id,'danger'):''}</div>`;
 const active=members.filter(r=>r.active).length;
 const summary=`<section class="approval-summary team-summary" aria-label="Resumo da equipe"><div class="tile"><strong>${active}</strong><span>${active===1?'pessoa com acesso':'pessoas com acesso'}</span></div><div class="tile"><strong>${invites.length}</strong><span>${invites.length===1?'convite aguardando':'convites aguardando'}</span></div>${staffData?`<a class="tile" href="#/approvals"><strong>${requests.length}</strong><span>${requests.length===1?'pedido para aprovar':'pedidos para aprovar'}</span></a>`:''}</section>`;
 const list=members.length?`<ul class="team-list">${members.map(r=>`<li class="team-member"><span class="avatar" aria-hidden="true">${initials(r.full_name)}</span><div class="team-who"><strong>${esc(r.full_name)}</strong>${staffData?`<small>${esc(r.email||'Sem e-mail')}</small>`:''}<span class="team-tags">${roleTag(r)}${situation(r)}</span></div>${actions(r)}</li>`).join('')}</ul>`:emptyState('users','Ninguém na equipe ainda.');
 const pending=invites.length?`<section class="panel" aria-labelledby="teamInvites"><div class="section-head"><h3 id="teamInvites">${uiIcon('clock')} Convites aguardando a pessoa criar a conta</h3></div><ul class="team-list">${invites.map(r=>`<li class="team-member"><span class="avatar" aria-hidden="true">${initials(r.full_name||r.email)}</span><div class="team-who"><strong>${esc(r.full_name||'—')}</strong><small>${esc(r.email)}</small><span class="team-tags">${roleTag(r)}<span class="pill warn">Vale até ${esc(dateBR(r.expires_at))}</span></span></div><div class="team-actions">${button('Cancelar convite','invite-cancel',r.id,'danger')}</div></li>`).join('')}</ul></section>`:'';
 const waiting=requests.length?`<a class="approval-alert" href="#/approvals">${uiIcon('alert')}<span><strong>${requests.length} ${requests.length===1?'pedido aguardando':'pedidos aguardando'}</strong> sua aprovação</span>${uiIcon('chevron')}</a>`:'';
 const head=`<div class="team-top"><div class="team-intro"><strong>Quem trabalha no portal</strong><p>Para adicionar alguém, informe o e-mail e o cargo. A pessoa recebe o convite e cria a própria senha.</p></div>${button('Adicionar funcionário','invite','','primary')}</div>`;
 return `<div class="team-page">${head}${staffData?'':migrationNotice}${waiting}${summary}<section class="panel" aria-labelledby="teamMembers"><div class="section-head"><h3 id="teamMembers">${uiIcon('users')} Equipe atual <span class="class-count">${members.length}</span></h3></div>${list}</section>${pending}</div>`;
}
function historyArgs(){return {student:state.historyStudent,from:$('fromDate')?.value||'',to:$('toDate')?.value||'',class:$('historyClass')?.value||'',status:$('historyStatus')?.value||'',offset:state.offset};}
let historyRange='all',historyFilter={},studentsFilter={},historyOrder='recent',historySearch='',historyPageSize=10,studentsSort='name-asc',studentPageSize=10;
// ---------- Armazenamento do banco (somente Direção) ----------
const mb=b=>(Number(b)||0)/1048576;
const fmtMB=b=>{const v=mb(b);return (v>=100?v.toFixed(0):v.toFixed(1)).replace('.',',')+' MB';};
const tableNames={attendance_events:'Atrasos',audit_events:'Auditoria',profiles:'Contas e perfis',student_adjustments:'Ajustes de alunos',school_enrollments:'Matrículas',academic_renewals:'Renovações',announcements:'Comunicados',staff_invites:'Convites da equipe',privacy_cases:'Privacidade',school_classes:'Turmas',period_resets:'Períodos',academic_years:'Anos letivos',storage_cleanups:'Limpezas',storage_policy:'Regras de armazenamento',school_settings:'Configurações',portal_migrations:'Versões do banco'};
function renderStorage(st){
 const u=st.usage||{},pol=st.policy||{},pre=st.preview||{},pct=Number(u.percent)||0,trigger=Number(pol.trigger_percent)||80;
 const tone=pct>=trigger?'danger':pct>=trigger-20?'warn':'ok';
 const label={ok:'Espaço tranquilo',warn:'Ficando cheio',danger:'Acima do limite: a limpeza automática vai agir'}[tone];
 const freeable=Number(pre.students)||0,events=Number(pre.events)||0,other=(Number(pre.invites)||0)+(Number(pre.orphan_enrollments)||0)+(Number(pre.audit)||0);
 const gauge=`<section class="panel storage-gauge tone-${tone}" aria-labelledby="storageTitle"><p class="eyebrow">Uso do banco de dados</p><h2 id="storageTitle"><strong>${pct.toLocaleString('pt-BR')}%</strong> <span>${fmtMB(u.bytes)} de ${fmtMB(u.limit_bytes)}</span></h2>${barSvg(Math.min(100,pct))}<p class="storage-state">${label}</p><p class="muted">A verificação roda a cada hora. Registros técnicos antigos são limpos sempre; dados de quem saiu da escola só quando o uso passa de <strong>${trigger}%</strong>. A partir de <strong>${Number(pol.emergency_percent)||90}%</strong>, o prazo de espera cai para 30 dias.${pol.auto_enabled?'':' <strong>A limpeza automática está desligada.</strong>'}</p></section>`;
 const preview=`<section class="panel storage-preview" aria-labelledby="previewTitle"><div class="section-head"><h3 id="previewTitle">${uiIcon('refresh')} Pode ser liberado agora</h3></div><ul class="storage-list"><li><strong>${freeable}</strong><span>${freeable===1?'aluno que saiu':'alunos que saíram'} da escola há mais de ${Number(pol.grace_days)||180} dias ou nunca concluíram o cadastro</span></li><li><strong>${events}</strong><span>${events===1?'atraso desses alunos':'atrasos desses alunos'}</span></li><li><strong>${other}</strong><span>convites vencidos, matrículas sem aluno e auditoria antiga</span></li></ul><p class="muted">Alunos ativos, renovações pendentes e contas da equipe nunca são removidos.</p>${button('Liberar espaço agora','storage-run','','danger')}</section>`;
 const policy=`<section class="panel" aria-labelledby="policyTitle"><h3 id="policyTitle">Regras da limpeza</h3><form id="storagePolicyForm" class="form-grid"><label>Limite do plano (MB)<input name="limit_mb" type="number" min="50" max="100000" value="${esc(pol.limit_mb??500)}" required></label><label>Limpar quando passar de (%)<input name="trigger_percent" type="number" min="50" max="95" value="${esc(trigger)}" required></label><label>Esperar após a saída do aluno (dias)<input name="grace_days" type="number" min="30" max="3650" value="${esc(pol.grace_days??180)}" required></label><label>Limpeza automática<select name="auto_enabled"><option value="true" ${pol.auto_enabled?'selected':''}>Ligada</option><option value="false" ${pol.auto_enabled?'':'selected'}>Desligada</option></select></label><button class="primary" type="submit">Salvar regras</button></form></section>`;
 const tables=(u.tables||[]).slice(0,6),top=Math.max(1,...tables.map(t=>Number(t.bytes)||0));
 const usage=`<section class="panel" aria-labelledby="tablesTitle"><h3 id="tablesTitle">O que mais ocupa espaço</h3><ul class="class-bars">${tables.map(t=>`<li><span class="class-name">${esc(tableNames[t.name]||t.name)}</span><span class="class-value">${fmtMB(t.bytes)} <small>· ${Number(t.rows).toLocaleString('pt-BR')} linhas</small></span>${barSvg(Math.round((Number(t.bytes)||0)/top*100))}</li>`).join('')}</ul></section>`;
 const hist=(st.history||[]);
 const history=`<section class="panel" aria-labelledby="historyTitle"><h3 id="historyTitle">Últimas limpezas</h3>${hist.length?table(['Data','Origem','Uso antes','Removidos'],hist.map(h=>[dateBR(h.ran_at),h.trigger==='auto'?'Automática':'Manual',`${String(h.percent_before).replace('.',',')}%`,`${h.students_removed} alunos · ${h.events_removed} atrasos · ${h.other_removed} outros`])):emptyState('history','Nenhuma limpeza feita ainda.','Ela só acontece quando o banco fica cheio ou quando a Direção pede.')}</section>`;
 return `<div class="storage-page">${gauge}${preview}${policy}${usage}${history}</div>`;
}

// ---------- Relatórios Excel: escolher, filtrar, conferir e baixar ----------
const reportKinds=[
 ['students','Lista de alunos','users','Nome, RA, turma, atrasos e situação de cada aluno.'],
 ['history','Histórico de atrasos','history','Cada atraso com data, hora, aluno, turma e situação.'],
 ['enrollments','Matrículas','enrollments','Nome, RA, e-mail escolar, turma e situação da matrícula.']
];
const reportStatusLabels={active:'Válidos',forgiven:'Perdoados',void:'Anulados'};
const reportScopeLabels={students:{active:'Ativos',archived:'Arquivados',all:'Todos'},enrollments:{active:'Ativas',inactive:'Inativas',all:'Todas'}};
function schoolDaysThisMonth(){
 const now=new Date(),off=offDays();let n=0,skipped=0;
 for(let d=new Date(now.getFullYear(),now.getMonth(),1);d<=now;d=new Date(d.getFullYear(),d.getMonth(),d.getDate()+1)){if(isSchoolDay(d,off))n++;else if(d.getDay()!==0&&d.getDay()!==6)skipped++;}
 return {n,skipped};
}
function renderReports(d){
 const grades=[...new Set(state.classes.map(c=>c.grade))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 const kind=reportFilter.kind||'students';
 const kinds=reportKinds.map(([id,label,icon,desc])=>`<label class="kind-card"><input type="radio" name="kind" value="${id}" ${kind===id?'checked':''}><span class="kind-icon">${uiIcon(icon)}</span><span class="kind-text"><strong>${label}</strong><small>${desc}</small></span></label>`).join('');
 const builder=`<form id="reportForm" class="panel report-builder" aria-labelledby="reportStep1">
  <div class="step"><span class="step-n" aria-hidden="true">1</span><h2 id="reportStep1">O que você quer baixar?</h2></div>
  <div class="report-kinds" role="radiogroup" aria-labelledby="reportStep1">${kinds}</div>
  <div class="step"><span class="step-n" aria-hidden="true">2</span><h2>Filtrar <small>(opcional)</small></h2></div>
  <div class="report-filter-grid">
   <label>Série / ano<select name="grade"><option value="">Todas as séries</option>${grades.map(g=>`<option value="${esc(g)}">${esc(g)}</option>`).join('')}</select></label>
   <label>Turma<select name="class">${classesOptions('',true)}</select></label>
   <label data-report-scope>Situação<select name="scope" id="reportScope"></select></label>
   <label data-report-history>De<input name="from" type="date"></label>
   <label data-report-history>Até<input name="to" type="date"></label>
   <label data-report-history>Situação do atraso<select name="status"><option value="">Todas</option><option value="active">Válidos</option><option value="forgiven">Perdoados</option><option value="void">Anulados</option></select></label>
  </div>
  <div class="step"><span class="step-n" aria-hidden="true">3</span><h2>Conferir e baixar</h2></div>
  <div class="report-preview"><p id="reportPreview" class="report-preview-title" aria-live="polite"></p><p id="reportDescription" class="muted"></p></div>
  <button type="submit" class="primary report-download">${uiIcon('download')}<span>Baixar planilha (.xlsx)</span></button>
  <p class="report-note">${uiIcon('info')}<span>A planilha tem nomes de alunos: use só dentro da escola. Senhas, observações e datas de nascimento nunca são exportadas.</span></p>
 </form>`;
 const summary=[['Hoje',d.today],['Nesta semana',d.week],['Neste mês',d.month]];
 const aggregate=`<section class="panel report-aggregate" aria-labelledby="aggregateTitle"><div class="section-head"><h3 id="aggregateTitle">${uiIcon('limit')} Resumo da escola</h3>${button('Baixar resumo (.xlsx)','export-report','','outline')}</div><p class="muted">Só totais, sem nomes de alunos. Bom para reuniões e murais.</p><div class="report-counters">${summary.map(([label,n])=>`<div><small>${label}</small><strong>${Number(n)||0}</strong></div>`).join('')}</div><h4 class="sub-title">Atrasos por turma no mês</h4>${table(['Turma','Atrasos'],d.classes.map(c=>[esc(c.grade||'Sem turma'),Number(c.total)||0]))}</section>`;
 const sd=schoolDaysThisMonth();
 const days=`<p class="notice">${uiIcon('calendar')} Este mês teve <strong>${sd.n} ${sd.n===1?'dia letivo':'dias letivos'}</strong> até hoje${sd.skipped?`, sem contar ${sd.skipped} ${sd.skipped===1?'dia sem aula':'dias sem aula'} do calendário escolar`:''}.</p>`;
 return `<div class="report-page">${days}${builder}${aggregate}</div>`;
}
function bindReportForm(){
 const form=$('reportForm');if(!form)return;
 const scope=$('reportScope'),grade=form.elements.grade,room=form.elements.class;
 form.elements.kind.value=reportFilter.kind||'students';grade.value=reportFilter.grade||'';room.value=reportFilter.class||'';
 const preview=()=>{
  const kind=form.elements.kind.value,title=reportKinds.find(k=>k[0]===kind)?.[1]||'';
  const roomName=state.classes.find(c=>c.id===room.value);
  const parts=[grade.value||'',roomName?`turma ${roomName.name}`:'' ].filter(Boolean);
  if(kind==='history'){const f=form.elements.from.value,t=form.elements.to.value;if(f||t)parts.push(`${f?dateBR(f):'início'} até ${t?dateBR(t):'hoje'}`);const st=form.elements.status.value;if(st)parts.push(reportStatusLabels[st].toLowerCase());}
  else{const sc=scope.value;if(sc&&sc!=='all')parts.push(reportScopeLabels[kind][sc].toLowerCase());}
  $('reportPreview').textContent=`${title} · ${parts.length?parts.join(' · '):'toda a escola'}`;
 };
 function update(){
  const type=form.elements.kind.value,historical=type==='history';
  form.querySelectorAll('[data-report-history]').forEach(el=>el.hidden=!historical);
  form.querySelectorAll('[data-report-scope]').forEach(el=>el.hidden=historical);
  const keep=scope.value;
  scope.innerHTML=Object.entries(reportScopeLabels[type==='enrollments'?'enrollments':'students']).map(([v,l])=>`<option value="${v}">${l}</option>`).join('');
  if([...scope.options].some(o=>o.value===keep))scope.value=keep;
  $('reportDescription').textContent={students:'Colunas: nome, RA, série, turma, atrasos válidos, limite e situação.',history:'Colunas: data e hora, nome, RA, série, turma, situação e se foi justificado. A turma é a atual do aluno.',enrollments:'Colunas: nome, RA, e-mail escolar, série, turma, situação e data da matrícula.'}[type];
  preview();
 }
 form.querySelectorAll('input[name=kind]').forEach(r=>r.onchange=()=>{reportFilter={...reportFilter,kind:r.value};update();});
 form.querySelectorAll('select,input[type=date]').forEach(el=>el.addEventListener('change',preview));
 update();
 form.onsubmit=e=>{e.preventDefault();if(busy)return;const args=dataForm(form);
  if(args.from&&args.to&&args.from>args.to){msg('A data inicial precisa ser igual ou anterior à data final.','error');return;}
  const chosenClass=state.classes.find(c=>c.id===args.class);
  if(chosenClass&&args.grade&&chosenClass.grade!==args.grade){msg('A turma escolhida é de outra série. Ajuste os filtros.','error');return;}
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
   if(!records.length)return {notice:'Nenhum registro encontrado com esses filtros. Nenhum arquivo foi criado.'};
   const {saveInstitutionalWorkbook}=await import('./report-xlsx.js?v=5.0.0');
   const statusLabel=args.kind==='history'?(reportStatusLabels[args.status]||'Todas'):(reportScopeLabels[args.kind==='enrollments'?'enrollments':'students'][args.scope]||'Todas');
   saveInstitutionalWorkbook(args.kind,records,{grade:args.grade,className:chosenClass?.name||'',from:args.from,to:args.to,status:args.status,scope:args.scope,statusLabel});
   return {notice:`Planilha baixada com ${records.length} ${records.length===1?'registro':'registros'}.`};
  },false);
 };
}

// ---------- Registrar atraso ----------
function renderEntry(){
 return `<div class="entry-layout"><section class="panel entry-panel" aria-labelledby="entryTitle"><h2 id="entryTitle">Quem chegou atrasado?</h2>
 <form id="entryForm"><label>Aluno<span class="entry-search">${uiIcon('search')}<input id="entrySearch" type="search" autocomplete="off" placeholder="Ex.: Maria ou 0000111" aria-controls="entryResults" aria-expanded="false" role="combobox"></span></label><div id="entryResults" class="results" role="listbox" aria-label="Alunos encontrados"></div><div id="selectedStudent" aria-live="polite"></div><label><span>Observação <small class="muted">(opcional)</small></span><textarea id="entryReason" maxlength="500" rows="2" placeholder="Ex.: ônibus atrasou"></textarea></label><button class="primary" id="recordBtn" type="submit" disabled>${uiIcon('clock')}<span>Registrar atraso</span></button></form><div id="lastRecord" aria-live="polite"></div></section>
 <aside class="panel entry-help" aria-labelledby="entryHelpTitle"><h3 id="entryHelpTitle">Como funciona</h3><ol class="steps-list"><li><span><strong>Busque</strong> o aluno pelo nome ou RA.</span></li><li><span><strong>Confira</strong> a turma e a contagem de atrasos.</span></li><li><span><strong>Registre.</strong> Errou? Dá para desfazer em até 2 minutos.</span></li></ol><p class="muted entry-keys">Pelo teclado: ↑ e ↓ escolhem, Enter confirma.</p><p class="muted">Sem internet, o atraso fica guardado neste aparelho e é enviado sozinho quando a conexão voltar.</p></aside><section id="pendingQueue" class="panel pending-queue" aria-live="polite" hidden></section></div>`;
}
// Diz por que um aluno não pode receber registro, em vez de só travar o botão.
function entryBlocker(s){
 if(s.blocked||Number(s.unjustified_count)>=Number(s.late_limit))return 'Este aluno já atingiu o limite de atrasos. Encaminhe à Direção.';
 if(!s.active)return 'A matrícula deste aluno está inativa.';
 if(!s.enrollment_approved)return 'A matrícula ainda precisa ser validada pela Direção (Alunos › Gerenciar › Validar matrícula).';
 if(!s.verified)return 'O aluno ainda não ativou a conta (confirmação do e-mail escolar). O registro é liberado depois que ele ativar.';
 return '';
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
if(studentView()&&state.academic?.pending&&page!=='history'){html=renderAnnualPending();}else if(page==='reports'){const [d]=await Promise.all([read('dashboard'),loadCalendar()]);state.report=d;html=renderReports(d);}else if(page==='overview'){const [d,notes,recent,waiting]=await Promise.all([read('dashboard'),read('announcements'),studentView()?read('history',{offset:0}).catch(()=>[]):Promise.resolve([]),admin()?staffManage('counts').then(c=>Number(c?.total)||0).catch(()=>0):Promise.resolve(0),loadCalendar()]);html=studentView()?renderStudentHome(d,notes,recent):renderStaffHome(d,notes,waiting);}else if(page==='achievements'){const [d,recent]=await Promise.all([read('dashboard'),read('history',{offset:0}).catch(()=>[]),loadCalendar()]);html=renderAchievements(d,recent);}else if(page==='entry'){html=renderEntry();
 }else if(page==='students'&&studentsTab==='classes'){
 html=`<section class="student-reference-shell student-hub">${studentReferenceTop('classes')}${classManager()}</section>`;
 }else if(page==='students'&&studentsTab==='enrollments'){
 const [enrollments,applications]=await Promise.all([read('enrollments',{offset:state.offset,search:enrollmentSearch}),readApplications(signupApplicationsOffset,enrollmentSearch)]);
 rows=enrollments;signupApplications=Array.isArray(applications)?applications:[];
 html=`<section class="student-reference-shell student-hub">${studentReferenceTop('enrollments')}<section class="panel student-secondary-panel"><form id="enrollmentsFilter" class="hub-search"><label>Buscar matrícula<input name="search" type="search" value="${esc(enrollmentSearch)}" maxlength="100" placeholder="Nome ou RA" autocomplete="off"></label><button type="submit" class="primary">${uiIcon('search')}<span>Buscar</span></button>${enrollmentSearch?button('Limpar','clear-enrollment-search'):''}</form><div class="context-note">${uiIcon('info')}<p>O aluno cria a própria senha com o e-mail escolar. Se a matrícula já existir, a conta é vinculada automaticamente após a confirmação do e-mail.</p></div><div id="enrollmentRows">${enrollmentTable(rows)}</div>${pager(rows)}${applicationsPanel(signupApplications)}</section></section>`;
}else if(page==='students'&&renewalView){renewalData=await readRenewals(renewalFilter,renewalOffset,renewalSearch);rows=renewalData.rows||[];html=renewalPanel(renewalData);
}else if(page==='students'||page==='archive'){if(page==='students')renewalData=await readRenewals('pending',0,'');rows=await read('students',{...studentsFilter,offset:state.offset,archived:page==='archive'?'true':'false'});html=page==='students'?studentReferenceList(rows,Number(renewalData?.pending_count||0)):`<section class="panel"><form id="studentsFilter" class="filters streamlined-filters"><label class="search-field">Buscar aluno<input name="search" id="studentSearch" type="search" value="${esc(studentsFilter.search||'')}" placeholder="Nome ou RA" autocomplete="off"></label><label>Turma<select name="class">${classesOptions(studentsFilter.class)}</select></label><label>Situação<select name="situation"><option value="">Todas</option><option value="regular">Regular</option><option value="warning">Em atenção</option><option value="blocked">Limite atingido</option></select></label><div class="filter-actions">${(studentsFilter.search||studentsFilter.class||studentsFilter.situation)?button('Limpar filtros','clear-student-filters'):''}${button('Exportar Excel','open-reports')}</div></form><div id="studentRows">${studentTable(rows,true)}</div>${pager(rows)}</section>`;
}else if(page==='history'){const summary=studentView()&&!state.academic?.pending?read('dashboard').catch(()=>({})):Promise.resolve({});rows=await read('history',{...historyFilter,student:state.historyStudent,offset:state.offset});if(staff())rows=await hydrateHistoryRa(rows);html=studentView()?renderStudentHistory(rows,await summary):renderStaffHistory(rows);

}else if(page==='team'){await loadStaffData();rows=staffData?staffData.members||[]:await read('team',{offset:state.offset});html=renderTeam(rows);
}else if(page==='approvals'){const [applications]=await Promise.all([readApplications(0,''),loadStaffData()]);signupApplications=Array.isArray(applications)?applications:[];html=renderApprovals(signupApplications);
}else if(page==='adjustments'){rows=await read('adjustments',{offset:state.offset});html=`<section class="panel">${table(['Data','Aluno','Ação','Justificativa'],rows.map(r=>[dateBR(r.created_at),esc(r.full_name),esc({chance:'Nova chance',forgive:'Perdão',correct:'Correção',undo:'Desfeito',approve:'Matrícula validada',reset_student:'Novo período',archive:'Arquivado',restore:'Restaurado',edit_student:'Dados corrigidos'}[r.action]||r.action),esc(r.reason)]))}${pager(rows)}</section>`;
}else if(page==='announcements'){rows=await read('announcements',{offset:state.offset});html=renderAnnouncements(rows);}else if(page==='audit'){rows=await read('audit',{offset:state.offset});html=`<section class="panel">${table(['Data','Operação','Responsável','Detalhe'],rows.map(r=>[dateBR(r.created_at),esc(r.action),esc(r.actor_name||'Sistema'),esc(r.detail||'—')]))}${pager(rows)}</section>`;
}else if(page==='privacy'){rows=await read('privacy',{offset:state.offset});html=`<section class="panel">${button('Registrar solicitação ou incidente','privacy-new')}${table(['Data','Tipo','Situação','Descrição','Ações'],rows.map(r=>[dateBR(r.created_at),r.kind==='incidente'?'Incidente':'Solicitação',esc(r.status.replace('_',' ')),esc(r.description),button('Acompanhar','privacy-edit',r.id)]))}${pager(rows)}</section>`;
}else if(page==='calendar'){html=renderCalendar(await loadCalendar(true));}else if(page==='storage'){let st=null;try{st=await rpc('storage_manage',{p_action:'status',p_args:{}});}catch(e){if(!['PGRST202','42883'].includes(e?.code))throw e;}html=st?renderStorage(st):setupCard('O controle de armazenamento (quanto do limite de 500 MB está em uso e a limpeza automática) fica disponível depois dela.');
}else if(page==='period'){const [settings,resets]=await Promise.all([read('settings'),read('resets',{offset:state.offset})]);rows=resets;state.settings=settings;html=`<div class="grid-two"><section class="panel"><h3>Regras e privacidade</h3><p>O limite padrão vale para novos cadastros e novos períodos. Limites individuais atuais são preservados.</p><form id="settingsForm">${field('Limite padrão de atrasos','limit','number',settings.default_limit,'min="1" max="100"')}${field('Responsável pelo tratamento de dados','controller','text',settings.controller,'maxlength="200"')}${field('Contato de privacidade','contact','text',settings.privacy_contact,'maxlength="200"')}<label>Aviso institucional<textarea name="notice" maxlength="4000" required>${esc(settings.privacy_notice)}</textarea></label><label>Política de retenção<textarea name="retention" maxlength="2000" required>${esc(settings.retention_policy)}</textarea></label>${save}</form></section><section class="panel"><h3>Período letivo</h3><p>Encerrar o período zera a contagem atual e preserva todas as ocorrências.</p><form id="periodForm">${field('Agendar encerramento','date','date')}<button class="primary" type="submit">Agendar</button></form><div class="toolbar">${button('Encerrar agora','reset-period','','danger')}</div><p>Agendamentos automáticos precisam do agendador configurado no Supabase.</p>${table(['Data','Situação','Ações'],resets.map(r=>[dateBR(r.scheduled_for),r.executed_at?'Executado':r.cancelled_at?'Cancelado':'Pendente',!r.executed_at&&!r.cancelled_at?button('Cancelar','cancel-reset',r.id):'—']))}${pager(rows)}</section></div>${annualCalendarPanel()}`;}
if(token!==renderToken)return;view.innerHTML=html;state.rows=rows;bindPager(rows);bindPage();playRouteMotion(view,html.length);}catch(e){if(token===renderToken){pendingRouteMotion=false;view.innerHTML=`<section class="panel"><h3>Não foi possível carregar os dados</h3><p>${esc(errorText(e))}</p>${button('Tentar novamente','retry')}</section>`;}}finally{if(token===renderToken)view.removeAttribute('aria-busy');}}
function studentTabs(){
 const tabs=[['list','Alunos','students'],['enrollments','Cadastros e acessos','enrollments'],['classes','Turmas','classes']];
 return `<div class="student-tabs student-reference-tabs" role="tablist" aria-label="Área de alunos">${tabs.map(([id,label,icon])=>`<button type="button" role="tab" class="${studentsTab===id?'selected':''}" data-action="students-tab" data-id="${id}" aria-selected="${studentsTab===id}" aria-pressed="${studentsTab===id}">${uiIcon(icon)}<span>${label}</span></button>`).join('')}</div>`;
}
function studentReferenceTop(tab='list',pending=0){
 let action='';
 if(tab==='list'||tab==='enrollments')action=button('Cadastrar aluno','enrollment-new','','primary');
 if(tab==='classes'&&admin())action=button('Nova turma','class-new','','primary');
 const help={list:'Todos os alunos da escola. Use “Ver atrasos” para o histórico de um aluno e “Gerenciar” para corrigir os dados.',enrollments:'Crie aqui a ficha do aluno. Com a ficha pronta, ele faz a própria conta com o e-mail escolar. Pedidos de quem ainda não tem ficha aparecem no fim da página.',classes:'Cadastre as turmas antes de colocar os alunos nelas.'}[tab];
 return `<section class="student-reference-top">${studentTabs()}<div class="student-reference-top-action">${action}</div></section><p class="student-help">${uiIcon('info')}<span>${help}</span></p>`;
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
 return `<section class="student-reference-shell student-hub">${studentReferenceTop('list',pending)}<section class="student-reference-filter-card"><form id="studentsFilter" class="student-reference-filters"><label class="student-search-field"><span>Buscar aluno</span><div class="student-search-control">${uiIcon('search')}<input name="search" id="studentSearch" type="search" value="${esc(studentsFilter.search||'')}" placeholder="Nome ou RA..." autocomplete="off"></div></label><label><span>Turma</span><select name="class">${classesOptions(studentsFilter.class)}</select></label><label><span>Situação</span><select name="situation"><option value="">Todas</option><option value="regular">Regular</option><option value="warning">Em atenção</option><option value="blocked">Limite atingido</option></select></label><div class="student-filter-buttons">${(studentsFilter.search||studentsFilter.class||studentsFilter.situation)?button('Limpar filtros','clear-student-filters'):''}${button('Exportar Excel','open-reports')}</div></form>${pending?`<div class="student-renewal-hint">${uiIcon('info')}<span>Há alunos aguardando renovação de matrícula.</span>${button(`Pendentes de renovação (${pending})`,'renewal-show')}</div>`:''}</section><section class="student-reference-list-card"><div class="student-list-head"><strong id="studentResultCount">${count} ${count===1?'aluno encontrado':'alunos encontrados'}</strong><label class="inline-select">Ordenar<select id="studentOrder"><option value="name-asc" ${studentsSort==='name-asc'?'selected':''}>Nome (A → Z)</option><option value="name-desc" ${studentsSort==='name-desc'?'selected':''}>Nome (Z → A)</option><option value="count-desc" ${studentsSort==='count-desc'?'selected':''}>Mais atrasos</option></select></label></div><div id="studentRows">${studentTable(rows,false)}</div>${studentReferencePager(rows)}</section></section>`;
}
function studentHubHeader(tab='list',pending=0){return studentReferenceTop(tab,pending);}
function classManager(){const rows=state.classes;return `<section id="studentClassManager" class="class-hub-content" aria-labelledby="classManagerTitle"><div class="class-hub-title"><div><h3 id="classManagerTitle">Séries e turmas <span class="class-count">${rows.length}</span></h3><p class="muted">Turmas disponíveis para selecionar na matrícula e no cadastro de alunos.</p></div></div>${table(admin()?['Série','Turma','Situação','Ações']:['Série','Turma','Situação'],rows.map(c=>admin()?[esc(c.grade),esc(c.name),c.active?'Ativa':'Inativa',button('Editar turma','class-edit',c.id)]:[esc(c.grade),esc(c.name),c.active?'Ativa':'Inativa']))}${!rows.some(c=>c.active)?`<p class="hint">${admin()?'Cadastre uma turma ativa para conseguir matricular os alunos.':'Ainda não há turmas disponíveis. Procure a Direção.'}</p>`:''}</section>`;}

function enrollmentTable(rows){return table(['Aluno','RA','Turma','Acesso','Ações'],rows.map(r=>[esc(r.full_name),esc(r.ra),esc(r.grade+' • '+r.class_name),r.profile_id?'Conta vinculada':r.active?'Aguardando aluno criar conta':'Inativa',button('Editar matrícula','enrollment-edit',r.id)]));}
function applicationsPanel(rows){return `<section class="application-section" aria-labelledby="applicationsTitle"><div class="class-hub-title"><div><h3 id="applicationsTitle">Fichas de pré-cadastro <span class="class-count">${rows.length}</span></h3><p class="muted">Dados informados pelo próprio aluno. Confira a matrícula escolar antes de criar o vínculo.</p></div></div>${rows.length?`<div class="application-grid">${rows.map(r=>`<article class="application-card"><div class="application-card-head"><strong>${esc(r.full_name)}</strong><span class="pill ${r.verified?'ok':'warn'}">${r.verified?'E-mail confirmado':'E-mail pendente'}</span></div><dl><div><dt>RA informado</dt><dd>${esc(r.ra)}</dd></div><div><dt>Série / turma informada</dt><dd>${esc(r.grade||'Não informada')}</dd></div><div><dt>Nascimento informado</dt><dd>${esc(r.birth_date?dateBR(r.birth_date):'Não informado')}</dd></div></dl><p class="hint">Este pré-cadastro não equivale a uma matrícula aprovada.</p>${button('Cadastrar matrícula','enrollment-from-application',r.id,'primary')}</article>`).join('')}</div><div class="toolbar application-pagination">${signupApplicationsOffset?button('Fichas anteriores','applications-prev'):''}<span>Página ${Math.floor(signupApplicationsOffset/25)+1}</span>${rows.length===25&&signupApplicationsOffset<10000?button('Próximas fichas','applications-next'):''}</div>`:'<p class="empty">Nenhuma ficha aguardando matrícula para a pesquisa atual.</p>'}</section>`;}
function studentTable(rows,archived){
 const visible=archived?rows:studentVisibleRows(rows);
 if(!visible.length)return '<div class="empty student-empty">Nenhum aluno encontrado.</div>';
 if(archived)return table(['Aluno','Turma','Contagem / limite','Situação','Ações'],visible.map(s=>[`${esc(s.full_name)}<small>RA ${esc(s.ra)}</small>`,esc(s.grade),`${s.unjustified_count} / ${s.late_limit}<small>${s.historical_count} ocorrências no histórico</small>`,status(s),`<div class="toolbar">${button('Histórico','history',s.id)}${admin()?button('Restaurar','restore',s.id):''}</div>`]));
 return `<div class="student-reference-table-wrap"><table class="student-reference-table responsive"><thead><tr><th scope="col">Aluno</th><th scope="col">Turma</th><th scope="col">Situação</th><th scope="col">Atrasos que contam</th><th scope="col"><span class="sr-only">Ações</span></th></tr></thead><tbody>${visible.map(s=>`<tr><td data-label="Aluno"><strong>${esc(s.full_name)}</strong><small>RA ${esc(s.ra)}</small></td><td data-label="Turma">${esc(s.grade||'—')}</td><td data-label="Situação">${status(s)}</td><td data-label="Atrasos"><strong>${Number(s.unjustified_count||0)} de ${Number(s.late_limit||0)}</strong>${barSvg(Math.round(Number(s.unjustified_count||0)/Math.max(1,Number(s.late_limit||0))*100))}<small>${Number(s.historical_count||0)} no total</small></td><td class="row-actions" data-label="Ações"><div class="student-row-actions">${button('Ver atrasos','history',s.id)}${admin()?button('Gerenciar','student-manage',s.id):''}</div></td></tr>`).join('')}</tbody></table></div>`;
}
function bindPage(){$('view').querySelectorAll('.ach-fill[data-pct]').forEach(el=>{el.style.width=el.dataset.pct+'%';});if($('reportForm'))bindReportForm();if($('enrollmentsFilter')){const form=$('enrollmentsFilter');form.onsubmit=e=>{e.preventDefault();enrollmentSearch=form.elements.search.value.trim();state.offset=0;signupApplicationsOffset=0;void render();};}if(state.page==='entry'){bindEntry();return;}if($('studentsFilter')){const form=$('studentsFilter');form.elements.situation.value=studentsFilter.situation||'';form.onsubmit=e=>{e.preventDefault();studentsFilter=dataForm(e.target);state.offset=0;void render();};form.querySelectorAll('select').forEach(select=>select.onchange=()=>{studentsFilter=dataForm(form);state.offset=0;void render();});$('studentSearch').oninput=async e=>{const token=++searchToken;studentsFilter=dataForm(form);state.offset=0;try{const rows=await read('students',{...studentsFilter,archived:state.page==='archive'?'true':'false',offset:0});if(token!==searchToken||!$('studentRows'))return;state.rows=rows;const pageLabel=$('view').querySelector('.pager span');if(pageLabel)pageLabel.textContent='Página 1';$('studentRows').innerHTML=studentTable(rows,state.page==='archive');const resultCount=$('studentResultCount');if(resultCount){const n=studentVisibleRows(rows).length;resultCount.textContent=`${n} ${n===1?'aluno encontrado':'alunos encontrados'}`;}bindStudentSelection();bindPager(rows);}catch(err){msg(errorText(err),'error');}};}
if($('studentOrder'))$('studentOrder').onchange=e=>{studentsSort=e.target.value;const box=$('studentRows');if(box)box.innerHTML=studentTable(state.rows,false);const count=$('studentResultCount');if(count){const n=studentVisibleRows(state.rows).length;count.textContent=`${n} ${n===1?'aluno encontrado':'alunos encontrados'}`;}bindStudentSelection();};
if($('studentPageSize'))$('studentPageSize').onchange=e=>{studentPageSize=Math.max(10,Math.min(20,Number(e.target.value)||10));state.offset=0;void render();};
bindStudentSelection();
if($('historyFilters')){$('historyStatus').value=historyFilter.status||'';const applyHistory=()=>{const from=$('fromDate')?.value,to=$('toDate')?.value;if(from&&to&&from>to){msg('A data inicial precisa ser anterior ou igual à data final.','error');return;}historyFilter=historyArgs();state.offset=0;void render();};$('historyFilters').onsubmit=e=>{e.preventDefault();applyHistory();};if($('historyClass')){$('historyClass').onchange=applyHistory;$('fromDate').onchange=applyHistory;$('toDate').onchange=applyHistory;}const historySearchInput=$('historyStudentSearch');if(historySearchInput)historySearchInput.oninput=e=>{historySearch=e.target.value;const list=historyFilteredRows(state.rows);$('historyRows').innerHTML=renderHistoryRows(list);$('historyResultsTitle').textContent=historyCountLabel(list.slice(0,historyPageSize).length);};}
if($('historyOrder'))$('historyOrder').onchange=e=>{historyOrder=e.target.value;void render();};
if($('historyPageSize'))$('historyPageSize').onchange=e=>{historyPageSize=Math.max(10,Math.min(20,Number(e.target.value)||10));state.offset=0;void render();};
const clearHistory=$('view').querySelector('[data-action=clear-history-filters]');if(clearHistory)clearHistory.onclick=()=>{historyRange='all';historyFilter={};historySearch='';state.historyStudent='';state.offset=0;void render();};
if($('announcementFilters')){$('announcementFilters').onsubmit=e=>e.preventDefault();const search=$('announcementSearch');if(search)search.oninput=e=>{announcementFilter={...announcementFilter,query:e.target.value};void render();};$('view').querySelectorAll('[data-announcement-type]').forEach(btn=>btn.onclick=()=>{announcementFilter={...announcementFilter,type:btn.dataset.announcementType};void render();});}
if($('renewalSearchForm')){const previous=$('view').querySelector('[data-action=renewal-prev]'),next=$('view').querySelector('[data-action=renewal-next]');if(previous)previous.disabled=renewalOffset===0;if(next)next.disabled=(renewalData?.rows?.length||0)<25;}
if($('renewalSearchForm'))$('renewalSearchForm').onsubmit=e=>{e.preventDefault();renewalSearch=e.target.elements.search.value.trim();renewalOffset=0;void render();};
if($('annualCalendarForm'))$('annualCalendarForm').onsubmit=e=>{e.preventDefault();const d=dataForm(e.target);if(d.open<d.close){msg('A abertura precisa ser na mesma data do encerramento ou depois.','error');return;}void run(async()=>{const result=await academicManage('configure',d);state.academic=await academicState();return result;});};
if($('calendarForm'))$('calendarForm').onsubmit=e=>{e.preventDefault();const d=dataForm(e.target);void run(async()=>{const r=await rpc('calendar_manage',{p_action:'add',p_args:d});return {notice:`${r?.saved||0} ${r?.saved===1?'dia salvo':'dias salvos'} no calendário.`};});};
if($('storagePolicyForm'))$('storagePolicyForm').onsubmit=e=>{e.preventDefault();const d=dataForm(e.target);void run(async()=>{await rpc('storage_manage',{p_action:'policy',p_args:d});return {notice:'Regras de armazenamento salvas.'};});};
if($('settingsForm'))$('settingsForm').onsubmit=e=>{e.preventDefault();void run(()=>write('settings',dataForm(e.target)));};
if($('periodForm'))$('periodForm').onsubmit=e=>{e.preventDefault();void run(()=>rpc('schedule_period_reset',{p_date:dataForm(e.target).date}));};}
function bindStudentSelection(){ /* seleção em massa removida: não havia ação associada */ }
function bindEntry(){state.selected=null;state.request=null;const search=$('entrySearch');search.focus();search.oninput=async()=>{state.selected=null;state.request=null;$('selectedStudent').innerHTML='';$('recordBtn').disabled=true;const term=search.value.trim(),token=++searchToken;if(!term){$('entryResults').innerHTML='';search.setAttribute('aria-expanded','false');return;}try{const rows=await read('students',{search:term});if(token!==searchToken||!$('entryResults'))return;state.search=rows;state.index=-1;$('entryResults').innerHTML=rows.map((s,i)=>`<button class="result" type="button" id="result-${i}" role="option" aria-selected="false" data-pick="${i}"><span>${esc(s.full_name)}<small>${esc(s.ra)} · ${esc(s.grade)}</small><span>${s.unjustified_count}/${s.late_limit}</span></button>`).join('')||'<p class="empty">Nenhum aluno encontrado.</p>';search.setAttribute('aria-expanded','true');}catch(e){msg(errorText(e),'error');}};
search.onkeydown=e=>{if(e.isComposing)return;if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();state.index=Math.max(0,Math.min(state.search.length-1,state.index+(e.key==='ArrowDown'?1:-1)));document.querySelectorAll('[data-pick]').forEach((b,i)=>b.setAttribute('aria-selected',String(i===state.index)));search.setAttribute('aria-activedescendant','result-'+state.index);}else if(e.key==='Enter'&&!state.selected){e.preventDefault();if(state.search.length)pick(Math.max(0,state.index));}};
$('entryResults').onclick=e=>{const b=e.target.closest('[data-pick]');if(b)pick(Number(b.dataset.pick));};
renderQueue();$('entryForm').onsubmit=async e=>{e.preventDefault();if(busy||!state.selected)return;const s=state.selected;busy=true;$('recordBtn').disabled=true;state.request??=crypto.randomUUID();const reason=$('entryReason').value.trim();const keep=()=>{queueAdd({op:state.me.id,request:state.request,student:s.id,name:s.full_name,reason,at:new Date().toISOString()});msg(`Sem internet: o atraso de ${s.full_name} ficou guardado neste aparelho e está pendente de envio.`,'warn');state.selected=null;state.request=null;state.search=[];$('entryForm').reset();$('selectedStudent').innerHTML='';$('entryResults').innerHTML='';};if(!navigator.onLine){keep();busy=false;return;}try{const r=await write('record',{student:s.id,request:state.request,reason});msg(r.duplicate?'Este registro já havia sido confirmado.':'Atraso registrado.');state.selected=null;state.request=null;state.search=[];$('entryForm').reset();$('selectedStudent').innerHTML='';$('entryResults').innerHTML='';$('lastRecord').innerHTML=`<p>Último registro: ${esc(s.full_name)}</p>${button('Desfazer em até 2 minutos','undo',r.id)}`;search.focus();}catch(err){if(offlineError(err)){keep();}else{msg(errorText(err),'error');$('recordBtn').disabled=false;}}finally{busy=false;}};}
function pick(i){const s=state.search[i];if(!s)return;state.selected=s;state.request=crypto.randomUUID();$('entrySearch').value=s.full_name;$('entrySearch').setAttribute('aria-expanded','false');$('entryResults').innerHTML='';const blocker=entryBlocker(s);$('selectedStudent').innerHTML=`<div class="selected-student${blocker?' is-blocked':''}"><div><h3>${esc(s.full_name)}</h3><p>${esc(s.grade)} · RA ${esc(s.ra)}</p></div><p class="selected-count"><strong>${s.unjustified_count} de ${s.late_limit}</strong> atrasos ${status(s)}</p>${blocker?`<p class="selected-blocker" role="alert">${uiIcon('info')}<span>${blocker}</span></p>`:''}</div>`;$('recordBtn').disabled=Boolean(blocker);if(!blocker)$('recordBtn').focus();}
async function run(fn,refresh=true){if(busy)return;busy=true;const buttons=[...$('view').querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);try{const r=await fn();msg(r?.notice||'Operação concluída.');if(refresh)await render();}catch(e){msg(errorText(e),'error');}finally{busy=false;buttons.filter(b=>b.isConnected).forEach(b=>b.disabled=false);bindPager(state.rows);}}
$('view').onclick=e=>{const b=e.target.closest('[data-action]');if(!b||b.disabled)return;void action(b.dataset.action,b.dataset.id).catch(err=>msg(errorText(err),'error'));};
async function action(a,id){

if(a==='student-prev'||a==='student-next'){state.offset=Math.max(0,state.offset+(a==='student-next'?studentPageSize:-studentPageSize));await render();return;}
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
if(a==='tico-play'){ticoPlay();return;}if(a==='queue-flush'){await flushQueue();return;}if(a==='calendar-remove'){const [from,to]=String(id).split('|');await run(async()=>{const r=await rpc('calendar_manage',{p_action:'remove',p_args:{from,to}});return {notice:`${r?.removed||0} ${r?.removed===1?'dia removido':'dias removidos'} do calendário.`};});return;}if(a==='reload-page'){location.reload();return;}if(a==='export-report'){if(!staff()||state.page!=='reports'||!state.report)throw Error('Relatório disponível apenas para a equipe institucional.');await run(async()=>{const {saveReportWorkbook}=await import('./report-xlsx.js?v=5.0.0');saveReportWorkbook(state.report);return {notice:'Resumo agregado exportado.'};},false);return;}
if(a==='privacy-notice'){const policy=await read('settings');openModal('Privacidade da escola',`<p class="prewrap">${esc(policy.privacy_notice)}</p><p>Responsável: ${esc(policy.controller||'Consulte a secretaria')}</p><p>Contato: ${esc(policy.privacy_contact||'Consulte a secretaria')}</p><p class="prewrap">${esc(policy.retention_policy)}</p>`);return;}
if(a==='retry'){await render();return;}
if(a==='history-actions'){
 if(!staff()||state.page!=='history'||!row)return;
 const options=[row.can_undo?button('Desfazer registro','undo',row.id):'',admin()&&row.status!=='void'?button('Corrigir / anular','correct',row.id):'',admin()&&row.status==='active'?button('Perdoar atraso','forgive',row.id):''].filter(Boolean);
 openModal('Ações do registro',`<p><strong>${esc(row.full_name)}</strong> · ${esc(dateBR(row.occurred_at))}</p><div class="history-modal-actions">${options.length?options.join(''):'<p>Não há alterações disponíveis para este registro.</p>'}</div>`);
 $('modalBody').onclick=e=>{const btn=e.target.closest('[data-action]');if(btn){$('modal').close();void action(btn.dataset.action,btn.dataset.id).catch(err=>msg(errorText(err),'error'));}};
 return;
}
if(a==='history-range'){historyRange=id;if(id!=='custom'){const day=ms=>new Date(ms).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'}),now=Date.now();$('fromDate').value=id==='all'?'':id==='today'?day(now):day(now-(Number(id)-1)*864e5);$('toDate').value=id==='all'?'':day(now);}historyFilter=historyArgs();state.offset=0;await render();return;}
if(a==='history-status'){const input=$('historyStatus');if(input)input.value=id||'';historyFilter=historyArgs();state.offset=0;await render();return;}
if(a==='clear-history-filters'){historyRange='all';historyFilter={};historySearch='';state.historyStudent='';state.offset=0;await render();return;}
if(a==='history'){state.historyStudent=id;historyFilter={};if(state.page==='history'){state.offset=0;await render();}else location.hash='/history';return;}
if(a==='all-history'){state.historyStudent='';state.offset=0;await render();return;}
if(['chance','undo','correct','forgive','archive','restore','approve','reset_student'].includes(a)){const title={chance:'Conceder mais um atraso de limite',undo:'Desfazer registro recente',correct:'Anular ocorrência incorreta',forgive:'Perdoar atraso',archive:'Arquivar aluno',restore:'Restaurar aluno',approve:'Validar matrícula existente',reset_student:'Iniciar novo período individual'}[a];await reasonAction(title,a,['undo','correct','forgive'].includes(a)?{event:id}:{student:id});return;}
if(a==='student-manage'){const item=(label,act,text,cls='outline')=>`<li>${button(label,act,id,cls)}<small>${text}</small></li>`;openModal(row.full_name,`<dl class="details"><div><dt>RA</dt><dd>${esc(row.ra)}</dd></div><div><dt>Turma</dt><dd>${esc(row.grade||'—')}</dd></div><div><dt>Atrasos que contam</dt><dd>${row.unjustified_count} de ${row.late_limit}</dd></div></dl><ul class="manage-list">${item('Editar dados','edit-student','Corrige nome, RA, nascimento ou turma.')}${item('Nova chance','chance','Aumenta em 1 o limite de atrasos deste aluno.')}${!row.enrollment_approved?item('Validar matrícula','approve','Libera o acesso do aluno ao portal.'):''}${item('Novo período','reset_student','Zera a contagem atual e guarda o histórico.')}${item('Arquivar','archive','Tira o aluno da lista, sem apagar nada.','danger')}</ul><p class="hint">Para perdoar ou corrigir um atraso específico, use o Histórico.</p>`);$('modalBody').onclick=e=>{const b=e.target.closest('[data-action]');if(b){$('modal').close();void action(b.dataset.action,b.dataset.id);}};return;}
if(a==='edit-student'){const detail=await read('student_admin',{student:id});openModal('Corrigir dados escolares',`<form>${field('Nome completo','name','text',row.full_name,'maxlength="120"')}${field('RA','ra','text',detail.ra,'pattern="[0-9]{7,16}(sp)?"')}${field('Data de nascimento','birth','date',detail.birth_date)}<label>Turma<select name="class" required>${classesOptions(row.class_id,false)}</select></label>${reasonField}${save}</form>`,d=>write('edit_student',{student:id,...d}));return;}
if(a==='class-new'||a==='class-edit'){if(!admin()||state.page!=='students'||!['classes','enrollments'].includes(studentsTab))throw Error('Gerenciamento de turmas reservado à Direção.');const r=a==='class-edit'?state.classes.find(c=>c.id===id):null;if(a==='class-edit'&&!r)throw Error('Turma não encontrada. Atualize a página.');openModal(id?'Editar série e turma':'Cadastrar série e turma',`<form>${field('Série / ano','grade','text',r?.grade||'','maxlength="70"')}${field('Turma','name','text',r?.name||'','maxlength="20"')}<label>Situação<select name="active"><option value="true">Ativa</option><option value="false" ${r?.active===false?'selected':''}>Inativa</option></select></label>${save}</form>`,async d=>{await write('class',{id:r?.id||null,...d});state.classes=await read('classes');});return;}
if(a==='enrollment-new'||a==='enrollment-edit'||a==='enrollment-from-application'){
 const application=a==='enrollment-from-application'?signupApplications.find(p=>p.id===id):null;
 if(a==='enrollment-from-application'&&!application)throw Error('Ficha não encontrada. Atualize a página.');
 const r=application?{full_name:application.full_name,ra:application.ra,email:application.ra+'@al.educacao.sp.gov.br',birth_date:application.birth_date||'',class_id:state.classes.find(c=>c.grade+' • '+c.name===application.grade)?.id||''}:row||{};
 const editing=a==='enrollment-edit';
 openModal(editing?'Editar matrícula':application&&state.page==='approvals'?'Aceitar aluno':'Cadastrar matrícula escolar',`<form><p class="hint">${application?'Os dados abaixo foram informados pelo aluno e não foram conferidos. Compare com a matrícula oficial antes de salvar.':'Informe os dados oficiais. O e-mail escolar é sugerido automaticamente a partir do RA.'}</p><div class="form-grid">${field('Nome completo','name','text',r.full_name||'','maxlength="120"')}${field('RA','ra','text',r.ra||'','pattern="[0-9]{7,16}(sp)?"')}${field('E-mail institucional','email','email',r.email||'')}${field('Data de nascimento','birth','date',r.birth_date||'')}<div class="enrollment-class-picker"><label>Série e turma<select id="enrollmentClassSelect" name="class" required>${classesOptions(r.class_id,false)}</select></label>${admin()?'<button id="inlineClassToggle" class="outline" type="button" aria-controls="inlineClassForm" aria-expanded="false">+ Criar turma</button>':''}</div>${editing?`<label>Situação<select name="active"><option value="true">Ativa</option><option value="false" ${r.active===false?'selected':''}>Inativa</option></select></label>`:'<input type="hidden" name="active" value="true">'}</div>${save}</form>${admin()?`<form id="inlineClassForm" class="inline-class-form" hidden><h3>Nova série e turma</h3><p class="muted">Cadastre a turma sem perder os dados do aluno. Ela será selecionada automaticamente.</p><label>Série / ano<input name="grade" maxlength="70" required placeholder="Ex.: 3º ano do Ensino Médio"></label><label>Turma<input name="name" maxlength="20" required placeholder="Ex.: A"></label><div class="toolbar"><button type="submit" class="primary">Salvar turma</button><button id="inlineClassCancel" type="button" class="outline">Cancelar</button></div></form>`:''}`,async d=>{
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
if(a==='invite'){openModal('Adicionar funcionário',`<form>${staffData?field('Nome completo','name','text','','maxlength="120" minlength="3"'):''}${field('E-mail','email','email')}<label>Cargo<select name="role"><option value="secretaria">Secretaria</option><option value="admin">Direção</option></select></label><p class="hint">Avise a pessoa para abrir o portal, escolher “Sou da escola” e “Criar minha conta” com este e-mail. O convite vale por 14 dias.</p><button class="primary" type="submit">Adicionar</button></form>`,async d=>{if(!staffData){await rpc('create_staff_invite',{p_email:d.email,p_role:d.role});return {notice:'Funcionário autorizado.'};}const r=await staffManage('create',d);return {notice:r?.restored?'Acesso reativado. A pessoa entra com a mesma senha, ou usa “Esqueci a senha”.':r?.accepted?'Pedido aceito. A pessoa já pode entrar.':'Funcionário adicionado. Agora é só ele criar a conta no portal.'};});return;}
if(a==='invite-cancel'){const r=staffData?.invites?.find(x=>x.id===id);if(!r)return;openModal('Cancelar convite?',`<p>${esc(r.email)} não poderá mais criar a conta da equipe com este convite.</p><form><button class="danger" type="submit">Cancelar convite</button></form>`,async()=>{await staffManage('cancel_invite',{id});return {notice:'Convite cancelado.'};});return;}
if(a==='staff-accept'){const r=staffData?.requests?.find(x=>x.id===id);if(!r)return;openModal('Aceitar '+r.full_name,`<p><strong>E-mail:</strong> ${esc(r.email)}</p><form><label>Cargo<select name="role"><option value="secretaria">Secretaria</option><option value="admin">Direção</option></select></label><button class="primary" type="submit">Aceitar na equipe</button></form>`,async d=>{await staffManage('accept',{user:id,role:d.role});return {notice:r.full_name+' agora faz parte da equipe.'};});return;}
if(a==='staff-reject'){const r=staffData?.requests?.find(x=>x.id===id);if(!r)return;openModal('Recusar pedido?',`<p>O pedido de <strong>${esc(r.full_name)}</strong> será apagado junto com a conta criada.</p><form><button class="danger" type="submit">Recusar pedido</button></form>`,async()=>{await staffManage('reject',{user:id});return {notice:'Pedido recusado.'};});return;}
if(a==='student-reject'){const r=signupApplications.find(x=>x.id===id);if(!r)return;openModal('Recusar aluno?',`<p>A conta de <strong>${esc(r.full_name)}</strong> será apagada. Se foi engano, o aluno pode se cadastrar de novo.</p><form><button class="danger" type="submit">Recusar aluno</button></form>`,async()=>{await staffManage('reject_student',{user:id});return {notice:'Cadastro recusado.'};});return;}
if(a==='staff-password'){const r=staffData?.members?.find(x=>x.id===id);if(!r)return;openModal('Trocar a senha de '+r.full_name,`<form><label>Nova senha<input name="password" type="password" minlength="10" maxlength="72" autocomplete="new-password" required></label><p class="hint">Mínimo de 10 caracteres, com letras e números. A pessoa sai de todos os aparelhos na hora; entregue a senha pessoalmente.</p><button class="primary" type="submit">Salvar nova senha</button></form><button type="button" class="outline" id="sendReset">Enviar link de troca por e-mail</button>`,async d=>{if(!strongPassword(d.password))throw Error('Use ao menos 10 caracteres, com letras e números.');await staffManage('set_password',{user:id,password:d.password});return {notice:'Senha de '+r.full_name+' alterada.'};});$('sendReset').onclick=async()=>{const {error}=await db.auth.resetPasswordForEmail(r.email,{redirectTo:new URL('./',location.href).href});if(error){msg(errorText(error),'error','modalError');return;}$('modal').close();msg('Link de troca de senha enviado para '+r.email+'.');};return;}
if(a==='staff-remove'){const r=staffData?.members?.find(x=>x.id===id);if(!r)return;openModal('Remover '+r.full_name+' da equipe?',`<p>A pessoa perde o acesso na hora. Os registros que ela fez continuam no histórico. Se precisar, é só adicionar o mesmo e-mail de novo.</p><form><label>Motivo<textarea name="reason" minlength="5" maxlength="500" required></textarea></label><button class="danger" type="submit">Remover da equipe</button></form>`,async d=>{await staffManage('remove',{user:id,reason:d.reason});return {notice:r.full_name+' foi removido da equipe.'};});return;}
if(a==='role'){openModal('Permissões de '+row.full_name,`<form><label>Cargo<select name="role"><option value="secretaria">Secretaria</option><option value="admin" ${row.role==='admin'?'selected':''}>Direção</option></select></label><label>Situação<select name="active"><option value="true">Ativo</option><option value="false" ${!row.active?'selected':''}>Suspenso</option></select></label>${reasonField}${save}</form>`,d=>write('role',{user:id,...d}));return;}
if(a==='announcement-new'||a==='announcement-edit'){const r=row||{};openModal('Comunicado escolar',`<form>${field('Título','title','text',r.title||'','maxlength="120"')}<label>Mensagem<textarea name="body" minlength="3" maxlength="2000" required>${esc(r.body||'')}</textarea></label><label>Público<select name="audience"><option value="todos">Todos</option><option value="aluno" ${r.audience==='aluno'?'selected':''}>Alunos</option><option value="equipe" ${r.audience==='equipe'?'selected':''}>Equipe</option></select></label><label>Publicação<select name="active"><option value="true">Visível</option><option value="false" ${r.active===false?'selected':''}>Arquivado</option></select></label>${save}</form>`,d=>write('announcement',{id:id||null,...d}));return;}
if(a==='privacy-new'||a==='privacy-edit'){const r=row||{};openModal('Solicitação ou incidente',`<form><label>Tipo<select name="kind"><option value="solicitacao">Solicitação</option><option value="incidente" ${r.kind==='incidente'?'selected':''}>Incidente</option></select></label><label>Descrição<textarea name="description" minlength="5" maxlength="2000" required ${id?'readonly':''}>${esc(r.description||'')}</textarea></label><label>Situação<select name="status"><option value="aberto">Aberto</option><option value="em_analise" ${r.status==='em_analise'?'selected':''}>Em análise</option><option value="concluido" ${r.status==='concluido'?'selected':''}>Concluído</option></select></label><label>Providências<textarea name="resolution" maxlength="2000">${esc(r.resolution||'')}</textarea></label>${save}</form>`,d=>write('privacy',{id:id||null,...d}));return;}
if(a==='reset-period'){openModal('Encerrar período agora?',`<p>Os contadores de todos os alunos não arquivados serão reiniciados. O histórico será preservado.</p><form>${field('Digite ENCERRAR para confirmar','confirm')}${save}</form>`,d=>{if(d.confirm!=='ENCERRAR')throw Error('Digite ENCERRAR.');return rpc('reset_period_now',{});});return;}
if(a==='storage-run'){openModal('Liberar espaço agora?',`<p>Os dados de alunos que saíram da escola (e que já passaram do prazo de espera) serão <strong>apagados para sempre</strong>, junto com os atrasos deles. Alunos ativos não são afetados.</p><form>${field('Digite LIBERAR para confirmar','confirm','text','','autocomplete="off"')}<button class="danger" type="submit">Liberar espaço</button></form>`,async d=>{const r=await rpc('storage_manage',{p_action:'run',p_args:{confirm:d.confirm.trim()}});return {notice:`Espaço liberado: ${r.students} ${r.students===1?'aluno':'alunos'}, ${r.events} atrasos e ${r.other} outros registros removidos.`};});return;}
if(a==='cancel-reset'){await run(()=>rpc('cancel_period_reset',{p_id:Number(id)}));return;}
}
// Limpa callbacks antigos dos modais para evitar ações reaproveitadas.
// Cada abertura reinicia os eventos específicos do modal.
// Computadores da escola são compartilhados: a equipe sai sozinha depois de 30 minutos parada.
let lastActivity=Date.now();
['pointerdown','keydown'].forEach(name=>window.addEventListener(name,()=>{lastActivity=Date.now();},{passive:true}));
setInterval(async()=>{if(!staff()||Date.now()-lastActivity<1800000)return;lastActivity=Date.now();await db.auth.signOut();clearSession();msg('Sua sessão foi encerrada depois de 30 minutos sem uso.','success','authMessage');},60000);
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
// Links dos e-mails (confirmar cadastro, trocar senha, convite): o próprio site confere o código do link.
// Assim o aluno nunca cai numa página de erro do próprio computador quando a URL do projeto no Supabase estiver errada.
const emailLinkTypes=['recovery','signup','email','invite','magiclink','email_change'];
const expiredLink=e=>e?.code==='otp_expired'||/expired|invalid|not found/i.test(e?.message||'');
async function handleEmailLink(){
 const query=new URLSearchParams(location.search),hash=new URLSearchParams(location.hash.replace(/^#\/?/,''));
 const tokenHash=query.get('token_hash'),type=query.get('type')||hash.get('type');
 const linkError=query.get('error_code')||hash.get('error_code')||hash.get('error');
 const setsPassword=type==='recovery'||type==='invite';
 if(linkError){
  history.replaceState(null,'',location.pathname);recovering=false;
  auth(setsPassword||/recovery/.test(location.href)?'recover':'login');
  msg(linkError==='otp_expired'||linkError==='access_denied'?'Este link expirou ou já foi usado. Peça um novo link abaixo.':'Não foi possível abrir o link do e-mail. Peça um novo link.','error','authMessage');
  return true;
 }
 if(!tokenHash||!emailLinkTypes.includes(type))return false;
 history.replaceState(null,'',location.pathname);
 if(setsPassword)recovering=true;
 const {error}=await db.auth.verifyOtp({token_hash:tokenHash,type});
 if(error){
  recovering=false;auth(setsPassword?'recover':'login');
  msg(expiredLink(error)?'Este link expirou ou já foi usado. Peça um novo link abaixo.':errorText(error),'error','authMessage');
  return true;
 }
 if(setsPassword){auth('reset');msg(type==='invite'?'Convite confirmado! Crie sua senha para entrar.':'Link confirmado! Agora é só escolher sua nova senha.','success','authMessage');return true;}
 await loadSession();
 if(state.me)msg('E-mail confirmado. Boas-vindas ao Presença+!','success');
 else msg('E-mail confirmado! Agora entre com seu e-mail e senha.','success','authMessage');
 return true;
}
if(!await handleEmailLink()){if(recovering)auth('reset');else await loadSession();}
