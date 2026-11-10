// Exportação XLSX local, somente agregados previamente calculados no painel.
// Sem bibliotecas externas, arquivos recebidos, identificadores de aluno ou fórmulas.
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
function sheet(rows,widths){const max=rows.reduce((n,r)=>Math.max(n,r.length),0);const colXML=widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('');
 const body=rows.map((cells,r)=>`<row r="${r+1}">${cells.map((cell,c)=>{
 const address=col(c)+(r+1),kind=typeof cell==='number' && Number.isFinite(cell);
 // Texto é sempre inlineStr, inclusive quando inicia por '=': Excel não executa fórmulas.
 return kind?`<c r="${address}" s="2" t="n"><v>${cell}</v></c>`:`<c r="${address}" s="${r===0?1:0}" t="inlineStr"><is><t>${xml(cell)}</t></is></c>`;
 }).join('')}</row>`).join('');
 return XML+`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><sheetFormatPr defaultRowHeight="17"/><cols>${colXML}</cols><sheetData>${body}</sheetData><printOptions horizontalCentered="1"/><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
}
export function createReportWorkbook(d,now=new Date()){
 if(!d || !Array.isArray(d.classes) || !Array.isArray(d.trend))throw Error('Resumo escolar indisponível.');
 const val=v=>{const n=Number(v);return Number.isFinite(n)&&n>=0?Math.trunc(n):0;};
 const day=now.toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'});
 const month=now.toLocaleDateString('pt-BR',{month:'long',year:'numeric',timeZone:'America/Sao_Paulo'});
 const summary=[['PRESENÇA+ · RELATÓRIO ESCOLAR'],['Documento de uso interno · Dados agregados, sem identificação direta de estudantes'],['Gerado em',day],['Referência mensal',month],['Indicador','Ocorrências'],['Atrasos registrados hoje',val(d.today)],['Atrasos registrados nesta semana',val(d.week)],['Atrasos registrados neste mês',val(d.month)],['Nota','Contagem de ocorrências não anuladas; não corresponde ao número de alunos.']];
 const classes=[['Turma','Atrasos no mês'],...d.classes.map(c=>[String(c.grade || 'Sem turma').slice(0,70),val(c.total)])];
 const trend=[['Data','Ocorrências'],...d.trend.map(x=>[String(x.day||'').slice(0,10),val(x.total)])];
 const names=['Resumo','Por turma','Últimos 14 dias'],sheets=[summary,classes,trend],files=[];
 files.push(['[Content_Types].xml',XML+`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${names.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`]);
 files.push(['_rels/.rels',XML+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>']);
 files.push(['xl/workbook.xml',XML+`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${names.map((name,i)=>`<sheet name="${xml(name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets><calcPr calcId="0"/></workbook>`]);
 files.push(['xl/_rels/workbook.xml.rels',XML+`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${names.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`]);
 files.push(['xl/styles.xml',XML+`<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/><xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`]);
 sheets.forEach((rows,i)=>files.push([`xl/worksheets/sheet${i+1}.xml`,sheet(rows,i===0?[75,22]:[42,24])]));
 return zip(files);
}
export function saveReportWorkbook(data){const blob=createReportWorkbook(data),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='presenca-relatorio-escolar.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}

// Documentos detalhados restritos: somente linhas entregues pelo RPC portal_export
// com autorização verificada no PostgreSQL; nenhum dado vem de formulários/DOM.
const institutionalColumns={
 students:[['name','Nome completo'],['ra','RA'],['grade','Série / ano'],['class_name','Turma / sala'],['active_count','Atrasos válidos'],['late_limit','Limite atual'],['situation','Situação']],
 history:[['occurred_on','Data / hora'],['name','Nome completo'],['ra','RA'],['grade','Série / ano'],['class_name','Turma / sala'],['situation','Situação'],['justified','Justificado']],
 enrollments:[['name','Nome completo'],['ra','RA'],['email','E-mail institucional'],['grade','Série / ano'],['class_name','Turma / sala'],['situation','Situação'],['created_on','Matrícula cadastrada em']]
};
export function createInstitutionalWorkbook(kind,records,filters={},now=new Date()){
 const columns=institutionalColumns[kind];
 if(!columns||!Array.isArray(records)||records.length>10200)throw Error('Dados de exportação inválidos ou extensos demais.');
 const names=['Identificação','Registros'];
 const heading={students:'LISTA DE ALUNOS',history:'HISTÓRICO DE ATRASOS',enrollments:'MATRÍCULAS'}[kind];
 const info=[['PRESENÇA+ · '+heading],['Documento de uso interno · Contém dados escolares identificáveis.'],['Gerado em',now.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})],['Série',filters.grade||'Todas'],['Turma',filters.className||'Todas'],['Período inicial',filters.from||'Não definido'],['Período final',filters.to||'Não definido'],['Situação',filters.status||filters.scope||'Todas'],['Quantidade de registros',records.length],['Segurança','Não publicar nem compartilhar fora dos canais autorizados da escola.']];
 const values=[columns.map(([,label])=>label),...records.map(r=>columns.map(([key])=>{
   const value=r?.[key];return key==='active_count'||key==='late_limit'?Math.max(0,Number(value)||0):String(value??'').slice(0,500);
 }))];
 const tabs=[info,values],files=[];
 files.push(['[Content_Types].xml',XML+`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${names.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`]);
 files.push(['_rels/.rels',XML+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>']);
 files.push(['xl/workbook.xml',XML+`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${names.map((name,i)=>`<sheet name="${xml(name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`]);
 files.push(['xl/_rels/workbook.xml.rels',XML+`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`]);
 files.push(['xl/styles.xml',XML+'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/><xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>']);
 tabs.forEach((rows,i)=>files.push([`xl/worksheets/sheet${i+1}.xml`,sheet(rows,i===0?[63,60]:columns.map(([,label])=>label==='Nome completo'?37:label==='E-mail institucional'?49:label==='Data / hora'?24:21))]));
 return zip(files);
}
export function saveInstitutionalWorkbook(kind,records,filters={}){
 const blob=createInstitutionalWorkbook(kind,records,filters),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=`presenca-${kind}-${new Date().toISOString().slice(0,10)}.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
}
