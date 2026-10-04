// Az oxigenterapia landing "hajkamera-nezet" illusztracioja (assets/img/oxigen/hajkamera-illusztracio.svg).
// Rajz, NEM vendegfoto: a hajkamera nagyitott kepenek hangulatat adja (fejbor + hajszalak). A landingen "Illusztracio" felirattal szerepel.
//   node tools/oxigen-hajkamera-svg.mjs
import fs from 'node:fs';
import path from 'node:path';

const KIMENET = path.resolve(import.meta.dirname, '..', 'assets', 'img', 'oxigen', 'hajkamera-illusztracio.svg');
const W = 960, H = 600;

// determinisztikus veletlen (ugyanabbol a kodbol mindig ugyanaz a rajz)
let mag = 20261004;
const r = () => { mag = (mag * 1664525 + 1013904223) >>> 0; return mag / 4294967296; };
const k = (a, b) => a + (b - a) * r();
const f = (n) => Math.round(n * 10) / 10;

const szalak = [];
const tobbi = [];
// egy hajszal: tapered (a gyokernel vastag, a vegen elvekonyodo) kitoltott alakzat egy gorbe menten
function szal(x, y, a, hossz, gorbe, vast, szin) {
  const x2 = x + Math.cos(a) * hossz, y2 = y + Math.sin(a) * hossz;
  const cx = (x + x2) / 2 + Math.cos(a + Math.PI / 2) * gorbe, cy = (y + y2) / 2 + Math.sin(a + Math.PI / 2) * gorbe;
  const pont = (t) => {
    const u = 1 - t;
    return [u * u * x + 2 * u * t * cx + t * t * x2, u * u * y + 2 * u * t * cy + t * t * y2];
  };
  const bal = [], jobb = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const t = i / N, [px, py] = pont(t), [qx, qy] = pont(Math.min(1, t + 0.02)), [ox, oy] = pont(Math.max(0, t - 0.02));
    const dx = qx - ox, dy = qy - oy, l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l, ny = dx / l;
    const w = (vast * (1 - t * 0.82)) / 2;
    bal.push([px + nx * w, py + ny * w]);
    jobb.push([px - nx * w, py - ny * w]);
  }
  const ut = bal.concat(jobb.reverse()).map((p, i) => (i ? 'L' : 'M') + f(p[0]) + ' ' + f(p[1])).join('') + 'Z';
  szalak.push('<path d="' + ut + '" fill="' + szin + '"/>');
  const [h1x, h1y] = pont(0.12), [h2x, h2y] = pont(0.7);
  szalak.push('<path d="M' + f(h1x - 1) + ' ' + f(h1y - 1) + 'Q' + f(cx - 1) + ' ' + f(cy - 1) + ' ' + f(h2x - 1) + ' ' + f(h2y - 1) + '" stroke="#fff" stroke-opacity=".14" stroke-width="' + f(vast * 0.22) + '" stroke-linecap="round" fill="none"/>');
}
const tuszok = 64;
for (let i = 0; i < tuszok; i++) {
  const x = k(-20, W + 20), y = k(-20, H + 20);
  const irany = (r() < 0.55 ? 0.35 : 0.35 + Math.PI * 0.62) + k(-0.45, 0.45); // ket fo irany: a hajszalak keresztezik egymast
  const db = r() < 0.4 ? 3 : r() < 0.7 ? 2 : 1;
  tobbi.push('<ellipse cx="' + f(x) + '" cy="' + f(y) + '" rx="' + f(k(5, 8)) + '" ry="' + f(k(3.5, 5)) + '" fill="#b87b72" opacity=".5"/>');
  for (let j = 0; j < db; j++) {
    szal(x, y, irany + k(-0.22, 0.22), k(150, 340), k(-45, 45), k(6, 10.5), ['#16100d', '#1d1511', '#261b15', '#33251c'][Math.floor(k(0, 4))]);
  }
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Illusztráció: hajkamerás nagyítás a fejbőrről és a hajszálakról">
<defs>
<radialGradient id="bor" cx="50%" cy="46%" r="75%"><stop offset="0" stop-color="#ecc7bd"/><stop offset=".6" stop-color="#d9a89d"/><stop offset="1" stop-color="#bf8479"/></radialGradient>
<radialGradient id="lencse" cx="50%" cy="50%" r="72%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#2a0f0c" stop-opacity=".55"/></radialGradient>
<filter id="lagy" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation=".35"/></filter>
</defs>
<rect width="${W}" height="${H}" fill="url(#bor)"/>
<g opacity=".5">${Array.from({ length: 140 }, () => `<circle cx="${f(k(0, W))}" cy="${f(k(0, H))}" r="${f(k(1, 3.2))}" fill="#e8bdb2"/>`).join('')}</g>
<g>${tobbi.join('')}</g>
<g filter="url(#lagy)">${szalak.join('')}</g>
<rect width="${W}" height="${H}" fill="url(#lencse)"/>
</svg>
`;
fs.mkdirSync(path.dirname(KIMENET), { recursive: true });
fs.writeFileSync(KIMENET, svg);
console.log(path.relative(process.cwd(), KIMENET), Math.round(svg.length / 1024) + ' KB');
