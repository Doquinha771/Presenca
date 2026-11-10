import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
const sql=fs.readFileSync(new URL('../sql/10_virada_ano_letivo.sql',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../assets/academic-year.css',import.meta.url),'utf8');
test('renovações são internas à área Alunos e possuem filtro próprio',()=>{
 assert.match(source,/studentsTab='list'.*renewalView=false|renewalView=false;studentsTab=/);
 assert.match(source,/Pendentes de renovação/);
 assert.match(source,/function renewalPanel/);
 assert.match(source,/academic_renewals_list/);
 assert.match(source,/annual-renew/);
});
test('aluno pendente continua na própria conta e mantém acesso ao histórico',()=>{
 assert.match(source,/function renderAnnualPending/);
 assert.match(source,/state\.academic\?\.pending&&page!=='history'/);
 assert.match(sql,/not me\.enrollment_approved and p_kind not in \(''me'',''history''\)/);
 assert.match(sql,/where r\.student_id=me\.id and r\.status='pending'/);
 assert.doesNotMatch(sql,/auth\.users\s+set|update\s+auth\.users|delete\s+from\s+auth\.users/i);
});
test('virada depende de datas configuradas e não ocorre automaticamente em primeiro de janeiro',()=>{
 assert.match(sql,/p_action='configure'/);
 assert.match(sql,/v_close<=v_today/);
 assert.match(sql,/v_open_date<=v_today/);
 assert.match(sql,/if v_next is null then return;/);
 assert.match(sql,/academic_process_due/);
 assert.doesNotMatch(sql,/date_trunc\('year'/i);
});
test('resultado final restringe progressão de série e exige revisão de EJA',()=>{
 assert.match(sql,/v_outcome='reproved' and source_key<>target_key/);
 assert.match(sql,/source_key='medio:3'/);
 assert.match(sql,/source_key='fundamental:9'/);
 assert.match(sql,/eja\|/);
 assert.match(source,/function annualSuggestedKey/);
});
test('nenhum histórico ou senha é apagado e só o vínculo anual é encerrado',()=>{
 assert.match(sql,/update public\.profiles p set enrollment_approved=false/);
 assert.match(sql,/previous_grade text not null/);
 assert.match(sql,/student_id uuid not null references public\.profiles\(id\)/);
 assert.doesNotMatch(sql,/(delete\s+from|truncate\s+table)\s+(public\.)?(attendance_events|audit_events|auth\.users)/i);
});
test('interface respeita largura, acessibilidade e indicadores em telas pequenas',()=>{
 assert.match(html,/assets\/academic-year\.css/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
 assert.match(source,/Consultar meu histórico/);
 assert.match(source,/RENOVAÇÕES PENDENTES/);
});
