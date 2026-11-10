import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createReportWorkbook,createInstitutionalWorkbook} from '../assets/report-xlsx.js';

const fake={today:6,week:18,month:43,
 classes:[{grade:'3º ano • A',students:30,total:21,full_name:'NOME_NAO_EXPORTAR',ra:'RA_NAO_EXPORTAR'},
          {grade:'3º ano • B',students:27,total:22}],
 trend:[{day:'2026-09-20',total:6},{day:'2026-09-19',total:4}],
 user:{name:'SEGREDO_NAO_EXPORTAR',email:'DADO_PESSOAL_NAO_EXPORTAR'},reason:'MOTIVO_NAO_EXPORTAR'};

async function files(blob){const data=Buffer.from(await blob.arrayBuffer()),results=new Map();
 for(let i=0;i+30<data.length;){if(data.readUInt32LE(i)!==0x04034b50)break;
 const len=data.readUInt16LE(i+26),extra=data.readUInt16LE(i+28),size=data.readUInt32LE(i+18);
 const start=i+30+len+extra;const name=data.subarray(i+30,i+30+len).toString('utf8');
 results.set(name,data.subarray(start,start+size).toString('utf8'));i=start+size;}
 return results;}

test('gera XLSX OOXML com 3 abas de dados agregados e configuração de impressão',async()=>{
 const workbook=createReportWorkbook(fake,new Date('2026-09-20T12:00:00-03:00'));
 assert.equal(workbook.type,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
 const list=await files(workbook);
 assert.equal(list.size,8);
 assert.match(list.get('xl/workbook.xml'),/Por turma/);
 assert.match(list.get('xl/workbook.xml'),/Últimos 14 dias/);
 assert.match(list.get('xl/worksheets/sheet2.xml'),/3º ano • A/);
 assert.match(list.get('xl/worksheets/sheet2.xml'),/<v>21<\/v>/);
 assert.match(list.get('xl/worksheets/sheet1.xml'),/Atrasos registrados neste mês/);
 for(const content of list.values())if(content.startsWith('<?xml'))assert.match(content,/^<\?xml/);
 for(const xml of [list.get('xl/worksheets/sheet1.xml'),list.get('xl/worksheets/sheet2.xml'),list.get('xl/worksheets/sheet3.xml')])assert.match(xml,/<pageSetup[^>]+paperSize="9"[^>]+orientation="landscape"/);
});

test('não exporta dados individuais nem permite injeção de fórmulas em turmas',async()=>{
 const data={...fake,classes:[{grade:'=HYPERLINK("https://exemplo.invalid")',total:5,ra:'SEGREDO_RA'}]};
 const list=await files(createReportWorkbook(data));const joined=[...list.values()].join('\n');
 for(const secret of ['NOME_NAO_EXPORTAR','RA_NAO_EXPORTAR','SEGREDO_NAO_EXPORTAR','DADO_PESSOAL_NAO_EXPORTAR','MOTIVO_NAO_EXPORTAR','SEGREDO_RA'])assert.ok(!joined.includes(secret),secret);
 assert.match(list.get('xl/worksheets/sheet2.xml'),/t="inlineStr"/);
 assert.doesNotMatch(list.get('xl/worksheets/sheet2.xml'),/<f\b/);
 assert.match(list.get('xl/worksheets/sheet2.xml'),/HYPERLINK/);
});

test('site só expõe relatórios à equipe e não mantém interface de importação de planilhas',()=>{
 const source=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
 const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 for(const fragment of ['import-ui.js','spreadsheet.js','portal_import_batch','open-import','Exportar CSV','Importar Excel','importData'])assert.equal(source.includes(fragment),false,fragment);
 assert.match(source,/if\(a==='export-report'\)\{if\(!staff\(\)/);
 assert.match(source,/reports:\['Relatórios Excel'/);
 assert.doesNotMatch(index,/type="file"/);
 assert.equal(fs.existsSync(new URL('../assets/import-ui.js',import.meta.url)),false);
 assert.equal(fs.existsSync(new URL('../assets/spreadsheet.js',import.meta.url)),false);
});


test('planilhas institucionais têm abas, colunas corretas e filtros de turma e série',async()=>{
 const examples={
  students:{name:'Aluno Teste',ra:'0000111',grade:'3º ano',class_name:'A',active_count:3,late_limit:5,situation:'Regular'},
  history:{occurred_on:'2026-09-20 07:10',name:'Aluno Teste',ra:'0000111',grade:'3º ano',class_name:'A',situation:'Válido',justified:'Não'},
  enrollments:{name:'Aluno Teste',ra:'0000111',email:'0000111@al.educacao.sp.gov.br',grade:'3º ano',class_name:'A',situation:'Conta vinculada',created_on:'2026-09-20'}
 };
 for(const [kind,row] of Object.entries(examples)){
  const list=await files(createInstitutionalWorkbook(kind,[{...row,birth_date:'SEGREDO_NASCIMENTO',password:'SEGREDO_SENHA'}],{grade:'3º ano',className:'A'}));
  assert.equal(list.size,7);
  assert.match(list.get('xl/workbook.xml'),/Identificação/);
  const data=list.get('xl/worksheets/sheet2.xml');
  assert.match(data,/Aluno Teste/);
  assert.match(data,/0000111/);
  assert.match(data,/3º ano/);
  assert.doesNotMatch(data,/SEGREDO_NASCIMENTO|SEGREDO_SENHA/);
  assert.match(list.get('xl/worksheets/sheet1.xml'),/Documento de uso interno/);
  if(kind==='enrollments')assert.match(data,/E-mail institucional/);
  if(kind==='history')assert.match(data,/Data \/ hora/);
  if(kind==='students')assert.match(data,/<v>3<\/v>/);
 }
});

test('exportação de dados identificáveis preserva texto e não executa fórmulas de planilha',async()=>{
 const list=await files(createInstitutionalWorkbook('students',[{name:'=HYPERLINK("https://exemplo.invalid")',ra:'0000111',grade:'3º ano',class_name:'A',active_count:1,late_limit:5,situation:'Regular'}]));
 const data=list.get('xl/worksheets/sheet2.xml');
 assert.match(data,/HYPERLINK/);
 assert.match(data,/t="inlineStr"/);
 assert.doesNotMatch(data,/<f[\s>]/);
 assert.throws(()=>createInstitutionalWorkbook('audit',[]),/inválidos/);
 assert.throws(()=>createInstitutionalWorkbook('students',Array(10201).fill({})),/inválidos/);
});

test('exportação nominal exige RPC próprio de staff e migração de autorização no banco',()=>{
 const js=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
 const sql=fs.readFileSync(new URL('../sql/07_exportacoes_institucionais.sql',import.meta.url),'utf8');
 const css=fs.readFileSync(new URL('../assets/portal-layout.css',import.meta.url),'utf8');
 assert.match(js,/rpc\('portal_export'/);
 assert.match(js,/document\.body\.classList\.add\('portal-layout'\)/);
 assert.match(sql,/me\.role not in \('admin','secretaria'\)/);
 assert.match(sql,/private\.require_portal\(\)/);
 assert.match(sql,/revoke all on function public\.portal_export/);
 assert.match(sql,/limit v_limit offset v_offset/);
 assert.match(css,/@media\(min-width:780px\)/);
 assert.match(css,/@media\(max-width:779px\)/);
});
