/* Tela de carregamento: logotipo, nome da escola e uma barra de progresso discreta.
   Um erro no módulo ou na CDN precisa ser visível, nunca uma página branca. */
const boot = document.getElementById('boot');
const fail = (message) => {
 boot.hidden = true;
 document.getElementById('fatal').hidden = false;
 document.getElementById('fatalText').textContent = message;
};
document.getElementById('reload').onclick = () => location.reload();
// Estação do ano no Brasil (hemisfério sul): as árvores da escola mudam com ela.
function season(d = new Date()) {
 const md = (d.getMonth() + 1) * 100 + d.getDate();
 if (md >= 1221 || md < 320) return 'verao';
 if (md < 621) return 'outono';
 if (md < 922) return 'inverno';
 return 'primavera';
}
const now = season();
document.documentElement.dataset.season = now;
const school = document.getElementById('authSchool');
if (school) school.src = `./assets/escola-${now}.svg?v=5.0.0`;
// A barra avança aos poucos enquanto o portal carrega e completa quando tudo estiver pronto.
const bar = document.getElementById('bootBar');
let progress = 8;
const step = setInterval(() => {
 progress = Math.min(90, progress + (90 - progress) * 0.12);
 if (bar) bar.style.width = progress + '%';
}, 180);
const timer = setTimeout(() => { clearInterval(step); fail('O carregamento demorou mais que o esperado. Confira a conexão e tente novamente.'); }, 18000);
// Impede que outro site abra o portal escondido dentro de uma moldura.
if (window.top !== window.self && location.hostname !== 'localhost') window.top.location = location.href;
// A versão no endereço obriga o navegador a baixar a atualização inteira, sem misturar arquivos antigos.
import('./app.js?v=5.0.0').then(() => {
 clearTimeout(timer);
 clearInterval(step);
 if (bar) bar.style.width = '100%';
 boot.hidden = true;
 document.getElementById('fatal').hidden = true;
}).catch(() => {
 clearTimeout(timer);
 clearInterval(step);
 fail('Falha ao carregar o portal. Confira a conexão e o acesso ao provedor de autenticação.');
});
