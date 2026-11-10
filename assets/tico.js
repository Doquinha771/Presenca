/* Tico, a calopsita do Presença+.
   Um desenho só, em SVG, usado no carregamento, no login e no Início do aluno.
   As partes têm classes próprias (t-body, t-crest, t-wing, t-eyes…) para o CSS animar com calma. */
(function () {
 const INK = '#1d1a19';
 // Rosto conforme o humor: feliz, preocupado (gota de suor) ou alarmado (sobrancelhas tensas).
 const extras = {
  happy: '',
  worried: `<path class="t-sweat" d="M80 30c-2.4 3.4-3.6 5.6-3.6 7.2a3.6 3.6 0 0 0 7.2 0c0-1.6-1.2-3.8-3.6-7.2z" fill="#9fd3ff" stroke="${INK}" stroke-width="1.6"/>`,
  alarmed: `<g class="t-brows" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"><path d="M33 35l8 3"/><path d="M67 35l-8 3"/></g>`
 };
 let uid = 0;
 function svg(mood = 'happy') {
  const m = extras[mood] !== undefined ? mood : 'happy';
  // Cada desenho tem o próprio degradê: um Tico escondido não pode apagar a cor dos outros.
  const g = 'ticoHead' + (++uid);
  return `<svg class="tico tico-${m}" data-mood="${m}" viewBox="0 0 100 100" aria-hidden="true" focusable="false">`
   + `<defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff07a"/><stop offset=".55" stop-color="#fffbe0"/><stop offset="1" stop-color="#ffffff"/></linearGradient></defs>`
   + `<ellipse class="t-shadow" cx="52" cy="95" rx="28" ry="3.6" fill="#0a2f63" opacity=".14"/>`
   + `<g class="t-all">`
   // cauda
   + `<path class="t-tail" d="M30 78c-9 2-17 1-23-2c5 7 15 10 25 8z" fill="#fff6b8" stroke="${INK}" stroke-width="2.8" stroke-linejoin="round"/>`
   // topete
   + `<path class="t-crest" d="M36 30c-4-5-4-11-1-15l4 6c-1-7 2-13 6-16l2 7c1-8 6-14 13-16c-3 7-3 14 1 21c-9-3-19 3-25 13z" fill="#ffe14d" stroke="${INK}" stroke-width="2.8" stroke-linejoin="round"/>`
   // corpo
   + `<path class="t-body" d="M50 20c19 0 32 15 32 36c0 22-14 36-32 36s-32-14-32-36c0-21 13-36 32-36z" fill="url(#${g})" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`
   // peito
   + `<path d="M58 66c2 1 2 3 0 4c2 1 2 3 0 4" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`
   // asa
   + `<path class="t-wing" d="M24 58c6-4 13-2 14 4c1 7-6 14-16 15c-4-6-4-15 2-19z" fill="#fffbe6" stroke="${INK}" stroke-width="2.8" stroke-linejoin="round"/>`
   // bochechas
   + `<circle cx="34" cy="50" r="6" fill="#f2862e" opacity=".9"/><circle cx="72" cy="48" r="5" fill="#f2862e" opacity=".9"/>`
   // olhos (piscam)
   + `<g class="t-eyes" fill="${INK}"><circle class="t-eye" cx="40" cy="43" r="3.6"/><circle class="t-eye" cx="66" cy="41" r="3.4"/><circle cx="41.2" cy="41.8" r="1.1" fill="#fff"/><circle cx="67.1" cy="39.8" r="1" fill="#fff"/></g>`
   // bico
   + `<path class="t-beak" d="M50 45c3-3 9-2 9 3c0 4-4 7-6 9c-2-3-6-6-5-9c0-1 1-2 2-3z" fill="#f6b48f" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>`
   + extras[m]
   // patinhas
   + `<g class="t-feet" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"><path d="M44 90l-3 6M44 90l1 6"/><path d="M60 90l-1 6M60 90l3 6"/></g>`
   + `</g></svg>`;
 }
 // Troca os marcadores <span data-tico="humor"> pelo desenho.
 function mount(root = document) {
  root.querySelectorAll('[data-tico]').forEach((el) => {
   const holder = document.createElement('span');
   holder.innerHTML = svg(el.dataset.tico);
   const art = holder.firstChild;
   if (el.dataset.ticoClass) art.classList.add(...el.dataset.ticoClass.split(/\s+/).filter(Boolean));
   if (el.dataset.ticoId) art.id = el.dataset.ticoId;
   el.replaceWith(art);
  });
 }
 // Piscadas em intervalos irregulares, como um passarinho de verdade. Com "reduzir movimento", fica parado.
 const calm = Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
 function blinkLoop() {
  if (!calm && !document.hidden) {
   document.querySelectorAll('svg.tico').forEach((t) => {
    if (Math.random() < 0.55) { t.classList.add('blink'); setTimeout(() => t.classList.remove('blink'), 150); }
   });
  }
  setTimeout(blinkLoop, 2200 + Math.random() * 2400);
 }
 window.TicoArt = { svg, mount };
 const start = () => { mount(); blinkLoop(); };
 if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
