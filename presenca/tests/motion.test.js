import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../assets/motion.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('estilos leves são carregados após a casca existente, sem bibliotecas adicionais',()=>{
 assert.match(html,/header-minimal\.css[^]*?motion\.css/);
 assert.match(css,/#view>\.panel,#view>\.grid-two,#view>\.welcome,#view>\.metrics\{animation:none\}/);
 assert.doesNotMatch(css,/infinite|filter:blur|backdrop-filter|transition:all/i);
});
test('entrada da página ocorre uma vez por rota, nunca a cada pesquisa ou atualização',()=>{
 assert.match(app,/pendingRouteMotion=true;\$\('view'\)\.replaceChildren\(\)/);
 assert.match(app,/function playRouteMotion\(view,markupLength\)/);
 assert.match(app,/pendingRouteMotion=false;[\s\S]*?prefers-reduced-motion/);
 assert.match(app,/bindPage\(\);playRouteMotion\(view,html\.length\)/);
 assert.match(app,/markupLength>30000/);
});
test('respeita movimento reduzido e evita mudanças de tamanho do layout',()=>{
 assert.match(css,/@media \(prefers-reduced-motion:reduce\)/);
 assert.match(css,/animation:none!important;transition:none!important/);
 assert.match(css,/@media \(hover:hover\) and \(pointer:fine\)/);
 assert.match(app,/navigator\.connection\?\.saveData/);
});
