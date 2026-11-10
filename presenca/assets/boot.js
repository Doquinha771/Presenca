/* Um erro no módulo ou na CDN precisa ser visível, nunca uma página branca. */
const boot = document.getElementById('boot');
const bootText = document.getElementById('bootText');
const bootStep = document.getElementById('bootStep');
const bootBar = document.getElementById('bootBar');
const fail = (message) => {
 document.getElementById('boot').hidden = true;
 document.getElementById('fatal').hidden = false;
 document.getElementById('fatalText').textContent = message;
};
document.getElementById('reload').onclick = () => location.reload();
const steps = [
 ['Conectando aos serviços da escola…', 14],
 ['Verificando sua sessão e as permissões…', 38],
 ['Montando a interface para este dispositivo…', 68],
 ['Finalizando o carregamento…', 92]
];
let stepIndex = 0;
const interval = setInterval(() => {
 if (!boot || boot.hidden) return;
 const [message, progress] = steps[Math.min(stepIndex, steps.length - 1)];
 if (bootStep) bootStep.textContent = message;
 if (bootBar) bootBar.style.width = progress + '%';
 if (bootText && stepIndex === 1) bootText.textContent = 'Seu ambiente está sendo preparado para uso no celular ou no computador.';
 if (bootText && stepIndex === 3) bootText.textContent = 'Quase pronto. O portal está alinhando dados e interface.';
 if (stepIndex < steps.length - 1) stepIndex += 1;
}, 850);
const clearBoot = () => {
 clearInterval(interval);
 if (bootBar) bootBar.style.width = '100%';
};
const timer = setTimeout(() => { clearBoot(); fail('O carregamento demorou mais que o esperado. Confira a conexão e tente novamente.'); }, 18000);
import('./app.js').then(() => {
 clearTimeout(timer);
 clearBoot();
 document.getElementById('boot').hidden = true;
 document.getElementById('fatal').hidden = true;
}).catch(() => {
 clearTimeout(timer);
 clearBoot();
 fail('Falha ao carregar o portal. Confira a conexão e o acesso ao provedor de autenticação.');
});
