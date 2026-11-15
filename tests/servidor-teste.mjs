// Servidor local SÓ para testes visuais. Não conecta no Supabase: troca o cliente pelo dublê de tests/browser-fixture.mjs.
// Uso: node tests/servidor-teste.mjs  →  http://localhost:5173/?papel=aluno  (ou admin, secretaria)
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,join,normalize} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fixture} from './browser-fixture.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),port=Number(process.env.PORT)||5173;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json'};
const mock=fixture.replace("window.__testRole||'admin'","(new URLSearchParams(location.search).get('papel')||'admin')");
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
