// Exportação XLSX montada no próprio navegador, sem bibliotecas externas.
// Texto é sempre gravado como texto (inlineStr): o Excel nunca executa fórmulas vindas dos dados.
const encoder = new TextEncoder();
const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const xml = v => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const col = i => {let out='';for(let n=i+1;n;n=Math.floor((n-1)/26))out=String.fromCharCode(65+(n-1)%26)+out;return out;};
const crcTable = Uint32Array.from({length:256},(_,i)=>{let c=i;for(let j=0;j<8;j++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc32(buffer){let c=0xffffffff;for(const b of buffer)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function zip(files){const chunks=[],central=[];let offset=0;
 const add=part=>{chunks.push(part);offset+=part.length;};
 for(const [name,content] of files){const data=encoder.encode(content),filename=encoder.encode(name),start=offset,crc=crc32(data);
  const local=new Uint8Array(30+filename.length),l=new DataView(local.buffer);
  l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint16(6,0x800,true);l.setUint16(8,0,true);
  l.setUint32(14,crc,true);l.setUint32(18,data.length,true);l.setUint32(22,data.length,true);l.setUint16(26,filename.length,true);local.set(filename,30);
  add(local);add(data);
  const cen=new Uint8Array(46+filename.length),v=new DataView(cen.buffer);
  v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint16(8,0x800,true);
  v.setUint32(16,crc,true);v.setUint32(20,data.length,true);v.setUint32(24,data.length,true);v.setUint16(28,filename.length,true);v.setUint32(42,start,true);cen.set(filename,46);central.push(cen);
 }
 const start=offset;for(const part of central)add(part);
 const end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,offset-start,true);v.setUint32(16,start,true);add(end);
 return new Blob(chunks,{type:MIME});
}

// Estilos: azul institucional no cabeçalho, linhas alternadas e bordas finas.
const S={text:0,head:1,num:2,title:3,note:4,zebra:5,zebraNum:6,cell:7,cellNum:8,label:9};
const STYLES=XML+`<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
 +`<fonts count="5"><font><sz val="11"/><color rgb="FF1C2433"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="16"/><color rgb="FF034EA2"/><name val="Calibri"/></font><font><i/><sz val="10"/><color rgb="FF5B6475"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF1C2433"/><name val="Calibri"/></font></fonts>`
 +`<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF034EA2"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2F5FA"/><bgColor indexed="64"/></patternFill></fill></fills>`
 +`<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFD9E0EA"/></bottom><diagonal/></border></borders>`
 +`<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>`
 +`<cellXfs count="10">`
 +`<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>`
 +`<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>`
 +`<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>`
 +`<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>`
 +`<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>`
 +`<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>`
 +`<xf numFmtId="1" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" horizontal="center"/></xf>`
 +`<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>`
 +`<xf numFmtId="1" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" horizontal="center"/></xf>`
 +`<xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>`
 +`</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

const isNum=v=>typeof v==='number'&&Number.isFinite(v);
function cellXML(value,r,c,style){
 const address=col(c)+(r+1);
 return isNum(value)?`<c r="${address}" s="${style}" t="n"><v>${value}</v></c>`:`<c r="${address}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
}
// Tabela de dados: cabeçalho fixo, filtro em todas as colunas e linhas alternadas.
function tableSheet(rows,widths){
 const n=rows[0].length,last=col(n-1)+rows.length;
 const body=rows.map((cells,r)=>`<row r="${r+1}"${r===0?' ht="24" customHeight="1"':''}>${cells.map((v,c)=>cellXML(v,r,c,r===0?S.head:(r%2===0?(isNum(v)?S.zebraNum:S.zebra):(isNum(v)?S.cellNum:S.cell)))).join('')}</row>`).join('');
 return XML+`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${last}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols>${widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${body}</sheetData>${rows.length>1?`<autoFilter ref="A1:${last}"/>`:''}<printOptions horizontalCentered="1"/><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/><headerFooter><oddFooter>&amp;LPresença+ · uso interno da escola&amp;RPágina &amp;P de &amp;N</oddFooter></headerFooter></worksheet>`;
}
// Aba de identificação: título, aviso e pares "campo: valor".
function infoSheet(title,note,pairs){
 const rows=[[title],[note],[],...pairs];
 const body=rows.map((cells,r)=>`<row r="${r+1}"${r===0?' ht="26" customHeight="1"':''}>${cells.map((v,c)=>cellXML(v,r,c,r===0?S.title:r===1?S.note:c===0?S.label:isNum(v)?S.cellNum:S.cell)).join('')}</row>`).join('');
 return XML+`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols><col min="1" max="1" width="30" customWidth="1"/><col min="2" max="2" width="62" customWidth="1"/></cols><sheetData>${body}</sheetData><mergeCells count="1"><mergeCell ref="A2:B2"/></mergeCells><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
}
function workbook(names,sheets){
 const files=[];
 files.push(['[Content_Types].xml',XML+`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${names.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`]);
 files.push(['_rels/.rels',XML+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>']);
 // Filtro automático precisa do nome definido _FilterDatabase em cada aba com tabela.
 const defined=sheets.map((s,i)=>s.filter?`<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${xml(names[i])}'!${s.filter}</definedName>`:'').join('');
 files.push(['xl/workbook.xml',XML+`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${names.map((name,i)=>`<sheet name="${xml(name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets>${defined?`<definedNames>${defined}</definedNames>`:''}<calcPr calcId="0"/></workbook>`]);
 files.push(['xl/_rels/workbook.xml.rels',XML+`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${names.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`]);
 files.push(['xl/styles.xml',STYLES]);
 sheets.forEach((s,i)=>files.push([`xl/worksheets/sheet${i+1}.xml`,s.xml]));
 return zip(files);
}
const table=(rows,widths)=>({xml:tableSheet(rows,widths),filter:rows.length>1?`$A$1:$${col(rows[0].length-1)}$${rows.length}`:''});
const brDay=v=>{const m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})/);return m?`${m[3]}/${m[2]}/${m[1]}`:String(v||'');};
const brDateTime=v=>{const m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);return m?`${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`:brDay(v);};
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
const safeName=s=>String(s).replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,' ').trim().slice(0,120);
const today=(now=new Date())=>now.toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'}).replaceAll('/','-');

// ---------- Resumo da escola: somente números agregados, sem identificar alunos ----------
export function createReportWorkbook(d,now=new Date()){
 if(!d || !Array.isArray(d.classes) || !Array.isArray(d.trend))throw Error('Resumo escolar indisponível.');
 const val=v=>{const n=Number(v);return Number.isFinite(n)&&n>=0?Math.trunc(n):0;};
 const day=now.toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'});
 const month=now.toLocaleDateString('pt-BR',{month:'long',year:'numeric',timeZone:'America/Sao_Paulo'});
 const indicators=[['Indicador','Atrasos'],['Atrasos registrados hoje',val(d.today)],['Atrasos registrados nesta semana',val(d.week)],['Atrasos registrados neste mês',val(d.month)]];
 const classes=[['Turma','Atrasos no mês'],...d.classes.map(c=>[String(c.grade || 'Sem turma').slice(0,70),val(c.total)])];
 const trend=[['Data','Atrasos'],...d.trend.map(x=>[brDay(String(x.day||'').slice(0,10)),val(x.total)])];
 const about=infoSheet('Presença+ · Resumo da escola','Uso interno. Apenas totais: nenhum aluno é identificado neste arquivo. Os números contam registros não anulados, não a quantidade de alunos.',[['Gerado em',day],['Mês de referência',month]]);
 return workbook(['Resumo','Por turma','Últimos 14 dias','Sobre este arquivo'],[table(indicators,[42,16]),table(classes,[42,18]),table(trend,[18,14]),{xml:about}]);
}
export function saveReportWorkbook(data){download(createReportWorkbook(data),`Presença+ - Resumo da escola - ${today()}.xlsx`);}

// ---------- Planilhas com nomes: somente linhas entregues pelo RPC portal_export ----------
// A autorização é verificada no banco; nada vem de formulários ou da página.
const institutionalColumns={
 students:[['name','Nome completo',36],['ra','RA',16],['grade','Série / ano',22],['class_name','Turma',10],['active_count','Atrasos válidos',15],['late_limit','Limite',10],['situation','Situação',20]],
 history:[['occurred_on','Data / hora',18],['name','Nome completo',36],['ra','RA',16],['grade','Série / ano',22],['class_name','Turma',10],['situation','Situação',16],['justified','Justificado',13]],
 enrollments:[['name','Nome completo',36],['ra','RA',16],['email','E-mail institucional',40],['grade','Série / ano',22],['class_name','Turma',10],['situation','Situação',22],['created_on','Cadastrada em',15]]
};
export const REPORT_TITLES={students:'Lista de alunos',history:'Histórico de atrasos',enrollments:'Matrículas'};
export function createInstitutionalWorkbook(kind,records,filters={},now=new Date()){
 const columns=institutionalColumns[kind];
 if(!columns||!Array.isArray(records)||records.length>10200)throw Error('Dados de exportação inválidos ou extensos demais.');
 const values=[columns.map(([,label])=>label),...records.map(r=>columns.map(([key])=>{
  const value=r?.[key];
  if(key==='active_count'||key==='late_limit')return Math.max(0,Number(value)||0);
  if(key==='occurred_on')return brDateTime(value);
  if(key==='created_on')return brDay(value);
  return String(value??'').slice(0,500);
 }))];
 const period=filters.from||filters.to?`${filters.from?brDay(filters.from):'início'} até ${filters.to?brDay(filters.to):'hoje'}`:'Todo o período';
 const about=infoSheet(`Presença+ · ${REPORT_TITLES[kind]}`,'Documento de uso interno da escola. Contém dados de alunos: não publique nem envie para fora dos canais da escola.',[
  ['Gerado em',now.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'})],
  ['Série',filters.grade||'Todas'],['Turma',filters.className||'Todas'],
  ...(kind==='history'?[['Período',period]]:[]),
  ['Situação',filters.statusLabel||filters.status||filters.scope||'Todas'],
  ['Quantidade de registros',records.length]]);
 return workbook([REPORT_TITLES[kind].slice(0,31),'Identificação'],[table(values,columns.map(([,, w])=>w)),{xml:about}]);
}
export function institutionalFileName(kind,filters={},now=new Date()){
 const scope=[filters.grade,filters.className].filter(Boolean).join(' ');
 return safeName(`Presença+ - ${REPORT_TITLES[kind]}${scope?' - '+scope:''} - ${today(now)}`)+'.xlsx';
}
export function saveInstitutionalWorkbook(kind,records,filters={}){
 download(createInstitutionalWorkbook(kind,records,filters),institutionalFileName(kind,filters));
}
