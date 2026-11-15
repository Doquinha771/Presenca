/* Conquistas por temporada.
   O ano é dividido pelas datas especiais (Ano Novo, Carnaval, Páscoa, Dia das Mães, São João,
   Dia do Estudante, Independência, Dia das Crianças e Natal). Quando uma delas chega, começa uma
   temporada nova e as medalhas zeram. Tudo é calculado com o histórico: nada novo vai para o banco. */

// Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher).
function easter(y){
 const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3);
 const h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/114);
 return new Date(y,Math.floor((h+l-7*m+114)/31)-1,((h+l-7*m+114)%31)+1);
}
const addDays=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
const day0=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
function specialDates(y){
 const mothers=new Date(y,4,1);mothers.setDate(1+((7-mothers.getDay())%7)+7);
 return [
  {key:'ano-novo',name:'Ano Novo',emoji:'🎆',date:new Date(y,0,1)},
  {key:'carnaval',name:'Carnaval',emoji:'🎭',date:addDays(easter(y),-47)},
  {key:'pascoa',name:'Páscoa',emoji:'🐣',date:easter(y)},
  {key:'maes',name:'Dia das Mães',emoji:'💐',date:mothers},
  {key:'sao-joao',name:'São João',emoji:'🌽',date:new Date(y,5,24)},
  {key:'estudante',name:'Dia do Estudante',emoji:'📚',date:new Date(y,7,11)},
  {key:'independencia',name:'Independência',emoji:'🇧🇷',date:new Date(y,8,7)},
  {key:'criancas',name:'Dia das Crianças',emoji:'🪁',date:new Date(y,9,12)},
  {key:'natal',name:'Natal',emoji:'🎄',date:new Date(y,11,25)}
 ];
}
// Temporada atual: começa na última data especial e termina na próxima.
export function seasonInfo(now=new Date()){
 const today=day0(now),y=today.getFullYear();
 const all=[...specialDates(y-1),...specialDates(y),...specialDates(y+1)].sort((a,b)=>a.date-b.date);
 const idx=all.findLastIndex(s=>s.date<=today),start=all[idx],next=all[idx+1];
 const daysLeft=Math.round((next.date-today)/864e5);
 return {key:`${start.key}-${start.date.getFullYear()}`,name:`Temporada ${start.name}`,emoji:start.emoji,start:start.date,end:next.date,next,daysLeft};
}

// ctx: {now, season, events (atrasos da temporada, sem anulados), count, limit, isSchoolDay(d), visits}
export function buildAchievements(ctx){
 const {season,isSchoolDay}=ctx,today=day0(ctx.now||new Date());
 const lateDays=new Set(ctx.events.map(e=>day0(new Date(e.occurred_at)).getTime()));
 const lateOn=d=>lateDays.has(day0(d).getTime());
 // Dias letivos já vividos na temporada (sem contar hoje, que ainda está acontecendo).
 const passed=[];for(let d=day0(season.start);d<today;d=addDays(d,1))if(isSchoolDay(d))passed.push(d);
 const lateToday=lateOn(today);
 let streak=0;for(let i=passed.length-1;i>=0&&!lateOn(passed[i]);i--)streak++;
 if(lateToday)streak=0;
 const lates=lateDays.size;
 // Semanas completas (segunda a sexta já passadas) sem nenhum atraso.
 let weeks=0;{let w=day0(season.start);while(w.getDay()!==1)w=addDays(w,1);
  for(;addDays(w,4)<today;w=addDays(w,7)){const days=[0,1,2,3,4].map(i=>addDays(w,i)).filter(isSchoolDay);if(days.length&&!days.some(lateOn))weeks++;}}
 // Meses inteiros dentro da temporada, já encerrados, sem atraso.
 let months=0;for(let m=new Date(season.start.getFullYear(),season.start.getMonth()+(season.start.getDate()>1?1:0),1);new Date(m.getFullYear(),m.getMonth()+1,0)<today;m=new Date(m.getFullYear(),m.getMonth()+1,1)){const ds=passed.filter(d=>d.getMonth()===m.getMonth()&&d.getFullYear()===m.getFullYear());if(ds.length&&!ds.some(lateOn))months++;}
 const weekday=k=>{const ds=passed.filter(d=>d.getDay()===k);const late=ds.some(lateOn);return {n:ds.length,late,ok:ds.length>=4&&!late};};
 const firstWeek=passed.slice(0,5),lastStretch=passed.filter(d=>(season.end-d)/864e5<=21);
 const count=Number(ctx.count)||0,limit=Number(ctx.limit)||0,visits=Number(ctx.visits)||0;
 const list=[];
 const add=(id,group,icon,name,desc,goal,value,tone,unit='')=>list.push({id,group,icon,name,desc,goal,value:Math.max(0,Math.min(goal,value)),got:value>=goal,tone,unit});
 // 1. Sequência (14)
 [[1,'Pé direito','sun'],[3,'Aquecendo','sun'],[5,'Semana cheia','leaf'],[7,'Ritmo bom','leaf'],[10,'Dezena pontual','leaf'],[15,'Quinzena de ouro','sky'],[20,'Relógio suíço','sky'],[30,'Mês sem tropeço','violet'],[40,'Imparável','violet'],[50,'Meio século','violet'],[60,'Maratonista','gold'],[75,'Lenda viva','gold'],[90,'Inabalável','gold'],[100,'Centenário','gold']]
  .forEach(([n,name,tone])=>add('seq-'+n,'Sequência',n>=30?'trophy':n>=10?'medal':'flame',name,`${n} ${n===1?'dia letivo':'dias letivos'} seguidos sem atraso nesta temporada.`,n,streak,tone,'dias'));
 // 2. Temporada limpa (4)
 [[5,'Largada limpa'],[10,'Duas semanas limpas'],[20,'Temporada brilhando'],[40,'Céu de brigadeiro']]
  .forEach(([n,name])=>add('limpa-'+n,'Temporada limpa','forgiven',name,`Nenhum atraso nos primeiros ${n} dias letivos da temporada.`,n,lates?0:passed.length,'sky','dias'));
 // 3. Poucos tropeços (2)
 add('pouco-1','Temporada limpa','limit','Só um tropeço','No máximo 1 atraso depois de 20 dias letivos.',20,lates<=1?passed.length:0,'coral','dias');
 add('pouco-2','Temporada limpa','limit','Quase perfeito','No máximo 2 atrasos depois de 30 dias letivos.',30,lates<=2?passed.length:0,'coral','dias');
 // 4. Semanas perfeitas (6)
 [1,2,4,6,8,12].forEach(n=>add('semana-'+n,'Semanas','calendar-check',n===1?'Semana perfeita':`${n} semanas perfeitas`,`${n} ${n===1?'semana':'semanas'} de segunda a sexta sem atraso.`,n,weeks,n>=6?'gold':'leaf','semanas'));
 // 5. Meses perfeitos (2)
 add('mes-1','Semanas','calendar','Mês impecável','Um mês inteiro da temporada sem atraso.',1,months,'violet');
 add('mes-2','Semanas','calendar','Bimestre impecável','Dois meses inteiros sem atraso.',2,months,'gold','meses');
 // 6. Dias da semana (5)
 [[1,'Segunda sem preguiça'],[2,'Terça tranquila'],[3,'Quarta em dia'],[4,'Quinta certeira'],[5,'Sextou no horário']]
  .forEach(([k,name])=>{const w=weekday(k);add('dia-'+k,'Dias da semana','clock',name,'Nenhum atraso nesse dia da semana (depois de 4 deles).',4,w.late?0:w.n,'sun','dias');});
 // 7. Presença no app (5)
 [[1,'Olá, temporada!'],[5,'Visitante'],[10,'Frequentador'],[20,'De casa'],[30,'Fã do Presença+']]
  .forEach(([n,name])=>add('visita-'+n,'No app','bell',name,`Abriu o Presença+ em ${n} ${n===1?'dia':'dias diferentes'} nesta temporada.`,n,visits,'sky','dias'));
 // 8. Limite (2)
 add('limite-metade','Limite','limit','Longe do limite','Ficar abaixo da metade do limite de atrasos.',1,limit&&count<limit/2?1:0,'sky');
 add('limite-zero','Limite','forgiven','Contador zerado','Nenhum atraso contando para o limite agora.',1,count===0?1:0,'leaf');
 // 9. Volta por cima (3)
 [[7,'Recomeço'],[14,'Volta por cima'],[30,'Virada histórica']]
  .forEach(([n,name])=>add('volta-'+n,'Volta por cima','refresh',name,`Teve atraso na temporada e emendou ${n} dias letivos sem nenhum.`,n,lates?streak:0,'coral','dias'));
 // 10. Momentos da temporada (3)
 add('comeco','Momentos','flag','Começo com o pé direito','Nenhum atraso na primeira semana de aula da temporada.',5,lates&&firstWeek.some(lateOn)?0:firstWeek.length,'leaf','dias');
 add('reta-final','Momentos','flag',`Reta final: ${season.next.name}`,`Nenhum atraso nas 3 semanas antes de ${season.next.name}.`,5,lastStretch.some(lateOn)?0:lastStretch.length,'violet','dias');
 add('guardiao','Momentos','trophy',`Guardião ${season.emoji}`,`20 dias letivos seguidos sem atraso em plena ${season.name.toLowerCase()}.`,20,streak,'gold','dias');
 // 11. Coleção (4): conta as outras 46.
 const got=list.filter(a=>a.got).length;
 [[10,'Colecionador'],[20,'Estante cheia'],[30,'Museu de medalhas'],[40,'Mestre da temporada']]
  .forEach(([n,name])=>add('colecao-'+n,'Coleção','trophy',name,`Ganhe ${n} outras medalhas nesta temporada.`,n,got,'gold','medalhas'));
 return {list,streak,lateToday,lates,schoolDays:passed.length};
}
