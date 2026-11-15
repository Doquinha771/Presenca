// Desenha o prédio da escola em estilo de lápis de cor, com as árvores de cada estação do ano.
// Gera assets/escola-primavera.svg, escola-verao.svg, escola-outono.svg e escola-inverno.svg.
// Uso: node scripts/gerar-escola.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

const LINE = '#b7a999', WALL = '#fbfaf6', SHADE = '#ece8e0', WIN = '#6b9ad6', WIN2 = '#8db3e6', DOOR = '#4c84cf', TRUNK = '#ef9a2e';

// Copa feita de várias bolinhas, como folhagem desenhada à mão.
const blobs = (cx, cy, s) => [[0, -34], [-16, -24], [16, -24], [-20, -6], [20, -6], [-10, 8], [10, 8], [0, -12]]
 .map(([x, y], i) => [cx + x * s, cy + y * s, (i === 7 ? 16 : 14) * s]);

const seasons = {
 primavera: {leaf: '#5cbf55', leaf2: '#7fd36a', bush: '#2f8a43', bush2: '#3c9d4f', extra: 'flores'},
 verao: {leaf: '#3fae46', leaf2: '#62c95a', bush: '#23793a', bush2: '#2f8a43', extra: ''},
 outono: {leaf: '#f0a43a', leaf2: '#e8743b', bush: '#8f8a3a', bush2: '#a6963f', extra: 'folhas'},
 inverno: {leaf: '#9db58a', leaf2: '#b9c9a6', bush: '#4f7656', bush2: '#5f8565', extra: 'galhos'}
};

function tree(cx, base, s, c, extra) {
 const crownY = base - 62 * s;
 const parts = blobs(cx, crownY, s);
 const sparse = extra === 'galhos';
 let out = `<rect x="${cx - 4 * s}" y="${crownY}" width="${8 * s}" height="${base - crownY}" rx="${3 * s}" fill="${TRUNK}"/>`;
 if (sparse) out += `<g fill="none" stroke="${TRUNK}" stroke-width="${3 * s}" stroke-linecap="round"><path d="M${cx} ${crownY + 6 * s}l-${16 * s} -${22 * s}M${cx} ${crownY - 2 * s}l${15 * s} -${24 * s}M${cx} ${crownY - 10 * s}v-${26 * s}"/></g>`;
 out += parts.map(([x, y, r], i) => `<circle cx="${x}" cy="${y}" r="${sparse ? r * 0.62 : r}" fill="${i % 3 ? c.leaf : c.leaf2}"${sparse ? ' opacity=".9"' : ''}/>`).join('');
 if (extra === 'flores') out += parts.slice(0, 7).map(([x, y]) => `<circle cx="${x + 5 * s}" cy="${y - 3 * s}" r="${2.6 * s}" fill="#f48fb1"/><circle cx="${x - 6 * s}" cy="${y + 4 * s}" r="${2.2 * s}" fill="#fff"/>`).join('');
 if (extra === 'folhas') out += [[-22, 30], [18, 40], [30, 18], [-30, 52]].map(([x, y], i) => `<ellipse class="folha f${i}" cx="${cx + x * s}" cy="${crownY + y * s}" rx="${3.4 * s}" ry="${2 * s}" fill="${i % 2 ? c.leaf : c.leaf2}" transform="rotate(${30 + i * 40} ${cx + x * s} ${crownY + y * s})"/>`).join('');
 return out;
}

function windowPair(x, y) {
 return [0, 32].map((dx) => `<rect x="${x + dx}" y="${y}" width="22" height="18" rx="1.5" fill="${WIN}"/><rect x="${x + dx + 2}" y="${y + 2}" width="8" height="6" fill="${WIN2}"/>`).join('');
}

function wing(x) {
 // Ala de três andares, com laje saliente em cada andar.
 return `<rect x="${x}" y="58" width="92" height="132" fill="${WALL}" stroke="${LINE}" stroke-width="3"/>`
  + `<rect x="${x - 6}" y="50" width="104" height="11" rx="1.5" fill="${WALL}" stroke="${LINE}" stroke-width="3"/>`
  + `<rect x="${x - 4}" y="98" width="100" height="9" fill="${WALL}" stroke="${LINE}" stroke-width="3"/>`
  + `<rect x="${x - 4}" y="142" width="100" height="9" fill="${WALL}" stroke="${LINE}" stroke-width="3"/>`
  + windowPair(x + 19, 72) + windowPair(x + 19, 116) + windowPair(x + 19, 160);
}

function school(name) {
 const c = seasons[name];
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 0 364 205">
 <title>Escola (${name})</title>
 <defs><filter id="lapis" x="-8%" y="-10%" width="116%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="7" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="2.4"/></filter></defs>
 <g filter="url(#lapis)" stroke-linejoin="round">
  <ellipse cx="170" cy="196" rx="160" ry="6" fill="#0a2f63" opacity=".08"/>
  <g>${[[14, 160, 22], [36, 150, 26], [58, 166, 20], [284, 166, 20], [306, 150, 26], [326, 160, 22]].map(([x, y, r], i) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${i % 2 ? c.bush : c.bush2}"/>`).join('')}<rect x="-8" y="160" width="84" height="34" fill="${c.bush}"/><rect x="264" y="160" width="84" height="34" fill="${c.bush}"/></g>
  ${wing(56)}${wing(192)}
  <rect x="140" y="14" width="60" height="176" fill="${WALL}" stroke="${LINE}" stroke-width="3"/>
  <rect x="140" y="14" width="60" height="6" fill="${SHADE}"/>
  <circle cx="170" cy="48" r="18" fill="#fff" stroke="${LINE}" stroke-width="3"/>
  <path d="M170 48v-11M170 48h-8" stroke="#3a3a3a" stroke-width="3" stroke-linecap="round" fill="none"/>
  <rect x="146" y="148" width="48" height="10" rx="1.5" fill="${WALL}" stroke="${LINE}" stroke-width="3"/>
  <rect x="152" y="158" width="36" height="32" fill="${DOOR}" stroke="${LINE}" stroke-width="2"/>
  <path d="M170 160v30" stroke="#3f72b8" stroke-width="2"/>
  ${tree(34, 196, 1.12, c, c.extra)}${tree(306, 196, 1.12, c, c.extra)}
 </g>
</svg>
`;
}

for (const name of Object.keys(seasons)) fs.writeFileSync(path.join(root, 'assets', `escola-${name}.svg`), school(name));
console.log('Escolas das quatro estações geradas em assets/.');
