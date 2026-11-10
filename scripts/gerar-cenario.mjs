// Desenha o cenário do login em estilo de giz de cera, a partir dos modelos em "Desenhos Presenca":
// chão de grama com florzinhas (emenda dos dois lados, para repetir), tufos de grama, moita e nuvem.
// Uso: node scripts/gerar-cenario.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const out = (name, svg) => fs.writeFileSync(path.join(root, 'assets', name), svg);

// Textura de giz: borda levemente tremida e falhas brancas por dentro, como no papel.
const giz = (id, seed, t = .62) => `<filter id="${id}" x="-10%" y="-10%" width="120%" height="120%">`
 + `<feTurbulence type="fractalNoise" baseFrequency=".04" numOctaves="2" seed="${seed}" result="w"/>`
 + `<feDisplacementMap in="SourceGraphic" in2="w" scale="3" result="d"/>`
 + `<feTurbulence type="fractalNoise" baseFrequency=".9 .35" numOctaves="2" seed="${seed + 3}" result="g"/>`
 + `<feColorMatrix in="g" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -8 ${(8 * t + 1).toFixed(2)}" result="m"/>`
 + `<feComposite in="d" in2="m" operator="in"/></filter>`;

// Uma folha de grama: traço curvo grosso, com ponta fina.
const blade = (x, y, h, lean, w = 3.2) => `<path d="M${x} ${y}q${lean * .3} ${-h * .55} ${lean} ${-h}" stroke-width="${w}" stroke-linecap="round" fill="none"/>`;
const tuft = (x, y, s, color) => `<g stroke="${color}">${[[-6, .8, -9], [-2, 1, -3], [2, .95, 4], [6, .75, 10], [0, .6, 1]].map(([dx, k, l]) => blade(x + dx * s, y, 22 * s * k, l * s)).join('')}</g>`;
const daisy = (x, y, r) => `<g>${[0, 72, 144, 216, 288].map(a => `<ellipse cx="${x}" cy="${y - r * .9}" rx="${r * .55}" ry="${r * .85}" fill="#fffdf4" transform="rotate(${a} ${x} ${y})"/>`).join('')}<circle cx="${x}" cy="${y}" r="${r * .45}" fill="#f6b21b"/></g>`;
const clover = (x, y, r, c) => `<g fill="${c}">${[[-.6, -.2], [.6, -.2], [0, .55]].map(([dx, dy]) => `<circle cx="${x + dx * r}" cy="${y + dy * r}" r="${r * .62}"/>`).join('')}</g>`;

// ---------- Chão: 600 x 120, a borda de cima é ondulada e as duas laterais se encaixam ----------
{
 const W = 600, H = 120;
 const top = `M0 30C60 22 110 34 170 28S290 18 350 27S470 36 530 26S590 24 600 30V${H}H0Z`;
 const tufts = [[30, 44], [120, 52], [205, 40], [300, 50], [390, 42], [470, 54], [560, 44], [80, 88], [250, 92], [430, 86], [540, 96]]
  .map(([x, y], i) => tuft(x, y, i % 3 ? .9 : 1.15, i % 2 ? '#2f8a3a' : '#3f9e45')).join('');
 const daisies = [[60, 70, 6], [165, 62, 7.5], [330, 74, 6], [455, 66, 8], [585, 78, 5.5], [15, 78, 5.5], [210, 100, 5], [380, 104, 6]].map(([x, y, r]) => daisy(x, y, r)).join('');
 const clovers = [[100, 74, 6, '#5a9b3a'], [280, 66, 5, '#6aa844'], [505, 80, 6, '#5a9b3a'], [345, 98, 5, '#6aa844'], [150, 104, 5, '#5a9b3a']].map(a => clover(...a)).join('');
 out('chao-grama.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
 <title>Chão de grama</title>
 <defs>${giz('g1', 4, .68)}${giz('g2', 9, .6)}<linearGradient id="terra" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5cb84c"/><stop offset=".5" stop-color="#4aa443"/><stop offset="1" stop-color="#3b8d3a"/></linearGradient></defs>
 <path d="${top}" fill="url(#terra)" filter="url(#g1)"/>
 <path d="M0 30C60 22 110 34 170 28S290 18 350 27S470 36 530 26S590 24 600 30" fill="none" stroke="#2f7d33" stroke-width="5" stroke-linecap="round" filter="url(#g2)"/>
 <g filter="url(#g2)">${tufts}${clovers}</g>
 <g filter="url(#g1)">${daisies}</g>
</svg>
`);
}

// ---------- Tufo de grama (balança com o vento) ----------
out('tufo.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 60">
 <title>Tufo de grama</title>
 <defs>${giz('g', 12, .62)}</defs>
 <g filter="url(#g)">${tuft(40, 58, 2.1, '#2f8a3a')}${tuft(28, 58, 1.4, '#3f9e45')}${tuft(54, 58, 1.5, '#3f9e45')}</g>
</svg>
`);

// ---------- Moita: contorno em ondinhas, preenchimento claro riscado ----------
out('moita.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 80">
 <title>Moita</title>
 <defs>${giz('g', 21, .62)}${giz('h', 27, .6)}</defs>
 <path d="M8 76C2 62 10 48 24 48C24 34 40 26 52 34C58 20 80 18 88 32C100 24 118 30 118 44C132 44 140 60 132 76Z" fill="#7cc46a" filter="url(#h)"/>
 <path d="M8 76C2 62 10 48 24 48C24 34 40 26 52 34C58 20 80 18 88 32C100 24 118 30 118 44C132 44 140 60 132 76" fill="none" stroke="#2f7d33" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" filter="url(#g)"/>
 <g fill="none" stroke="#2f7d33" stroke-width="3.2" stroke-linecap="round" filter="url(#g)"><path d="M40 56q8-8 16 0"/><path d="M76 50q8-8 16 0"/><path d="M58 66q7-7 14 0"/></g>
</svg>
`);

// ---------- Nuvem: giz azul-claro por fora e branco por dentro, para aparecer no céu azul ----------
out('nuvem.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 120">
 <title>Nuvem</title>
 <defs>${giz('g', 31, .66)}${giz('h', 35, .58)}</defs>
 <path d="M30 104C10 104 6 80 22 72C14 52 34 38 52 48C58 22 92 16 106 38C116 22 146 22 152 46C172 38 196 52 190 74C210 78 210 104 190 104Z" fill="#ffffff" filter="url(#g)"/>
 <path d="M30 104C10 104 6 80 22 72C14 52 34 38 52 48C58 22 92 16 106 38C116 22 146 22 152 46C172 38 196 52 190 74C210 78 210 104 190 104Z" fill="none" stroke="#a9d2f7" stroke-width="7" stroke-linejoin="round" filter="url(#h)"/>
 <path d="M48 86q20 10 44 0M110 90q22 8 46-2" fill="none" stroke="#d6ebfc" stroke-width="6" stroke-linecap="round" filter="url(#h)"/>
</svg>
`);
console.log('Cenário gerado: chao-grama.svg, tufo.svg, moita.svg e nuvem.svg.');
