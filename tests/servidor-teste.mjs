// Servidor local SÓ para testes visuais. Não conecta no Supabase: troca o cliente pelo dublê de tests/browser-fixture.mjs.
// Uso: node tests/servidor-teste.mjs  →  http://localhost:5173/?papel=aluno  (ou admin, secretaria)
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,join,normalize} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fixture} from './browser-fixture.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),port=Number(process.env.PORT)||5173;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json'};
// ?data=AAAA-MM-DD simula outro dia (útil para ver o período de testes antes, durante e depois).
const fakeDate="{const d=new URLSearchParams(location.search).get('data');if(d){const R=Date,off=new R(d+'T10:00:00')-R.now();globalThis.Date=class extends R{constructor(...a){super(...(a.length?a:[R.now()+off]));}static now(){return R.now()+off;}};}}\n";
// Relatos de exemplo para a tela Sistema › Testes.
const reports="if(name==='test_feedback'){if(args.p_action==='list')return {data:{open:2,resolved:1,auto:5,rows:[{id:1,created_at:new Date().toISOString(),role:'secretaria',kind:'erro',page:'entry',device:'computador · Chrome · tela 1366×768',version:'5.3.0',message:'Cliquei em Registrar e demorou muito para aparecer.',occurrences:1,status:'aberto',full_name:'Paula da Secretaria'},{id:2,created_at:new Date().toISOString(),role:'aluno',kind:'automatico',page:'achievements',device:'celular · Chrome · tela 390×844',version:'5.3.0',message:'app.js:120: Cannot read properties of undefined',occurrences:5,status:'aberto',full_name:'João Pedro da Silva'}]}};return {data:{id:9}};}\n";
const mock=fakeDate+fixture.replace("window.__testRole||'admin'","(new URLSearchParams(location.search).get('papel')||'admin')").replace("if(name!=='portal_read')return {data:{}};",reports+"if(name!=='portal_read')return {data:{}};");
createServer(async(req,res)=>{
 const path=decodeURIComponent(new URL(req.url,'http://x').pathname);
 if(path==='/__supabase.js'){res.writeHead(200,{'content-type':types['.js']});return res.end(mock);}
 const file=normalize(join(root,path==='/'?'index.html':path));
 if(!file.startsWith(normalize(root))){res.writeHead(403);return res.end();}
 try{
  let body=await readFile(file);
  if(file.endsWith(join('assets','app.js')))body=String(body).replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[^']+/,'/__supabase.js');
  res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(body);
 }catch{res.writeHead(404);res.end('não encontrado');}
}).listen(port,()=>console.log(`Presença+ (teste) em http://localhost:${port}/?papel=aluno`));
