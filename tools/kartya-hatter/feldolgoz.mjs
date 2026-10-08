// Az ajandekkartya-dizajnok hatterkepeinek elokeszitese: a feltoltott terv (A5 vaszon) mintaszovegeit / mintafotojat kiszedi (diffuzios kitoltes + zaj), a
// vaszon VALTOZATLAN (nincs vagas, nincs nyujtas), es kiirja a szovegek dobozait + szineit (jelentes.json) a sablon (assets/js/ajandek-kartya.js) koordinatai-hoz.
// Hasznalat:  node tools/kartya-hatter/feldolgoz.mjs <forras-mappa (14.jpg ... 19.jpg)> <ki-mappa>      (JPGQ=3 a JPEG minosege, FFMPEG az ffmpeg utja)
// A "feladat" sorok a mostani harom terv meretei (a 14-19. kep: smaragd elol/hat = 14/17, virag elol/hat = 15/16, szalag elol/hat = 18/19); uj tervnel ugyanigy kell
// felvenni: [kulcs, [x0, y0, x1, y1] ablak, 'light' (vilagos betu sotet hatteren) | 'dark' | 'rect' (az egesz teglalap), kuszob, tagitas, opcionalis belul(x,y)].
// Leiras: AJANDEK.md ("Uj kartyadizajn felvetele").
import { olvas, ir } from './raw.mjs';
import fs from 'node:fs';

const W = 1491, H = 1055;
const lum = (b, i) => 0.3 * b[i] + 0.59 * b[i + 1] + 0.11 * b[i + 2];
const FORRAS = process.argv[2] || '.';
const KI = process.argv[3] || 'ki';
fs.mkdirSync(KI, { recursive: true });

function median(arr) { arr.sort((a, b) => a - b); return arr[Math.floor(arr.length / 2)]; }
function kitagit(m, r) {
  const n = new Uint8Array(m);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m[y * W + x]) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && dx * dx + dy * dy <= r * r + 1) n[yy * W + xx] = 1; }
  return n;
}
// szoveg-maszk egy ablakban: a hatterhez kepest vilagosabb ('light') / sotetebb ('dark') pixelek
function szovegMaszk(b, win, mod, delta, dil, belul) {
  const [x0, y0, x1, y1] = win;
  if (mod === 'rect') { const m = new Uint8Array(W * H); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m[y * W + x] = 1; return { m, bbox: win, szin: null, hatter: 0 }; }
  const ls = []; for (let y = y0; y <= y1; y += 2) for (let x = x0; x <= x1; x += 2) if (!belul || belul(x, y)) ls.push(lum(b, (y * W + x) * 3));
  const kozep = median(ls);
  const m = new Uint8Array(W * H); let x_min = 1e9, y_min = 1e9, x_max = -1, y_max = -1; const szinek = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (belul && !belul(x, y)) continue;
    const l = lum(b, (y * W + x) * 3);
    if (mod === 'light' ? l > kozep + delta : l < kozep - delta) {
      m[y * W + x] = 1; if (x < x_min) x_min = x; if (x > x_max) x_max = x; if (y < y_min) y_min = y; if (y > y_max) y_max = y;
      szinek.push([l, b[(y * W + x) * 3], b[(y * W + x) * 3 + 1], b[(y * W + x) * 3 + 2]]);
    }
  }
  // a szin: a betu magja (olyan pixelek, amelyeknek mind a 8 szomszedja is betu), nem az elvilagitott/anti-aliasolt szel
  const mag = [];
  for (let y = y0 + 1; y < y1; y++) for (let x = x0 + 1; x < x1; x++) { if (!m[y * W + x]) continue; let ok = true; for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1; dx++) if (!m[(y + dy) * W + x + dx]) { ok = false; break; } if (ok) mag.push([b[(y * W + x) * 3], b[(y * W + x) * 3 + 1], b[(y * W + x) * 3 + 2]]); }
  let forras = mag.length > 20 ? mag : szinek.map((v) => [v[1], v[2], v[3]]);
  // a betu "valodi" szine: a mag szelsoseges (sotetebb / vilagosabb) fele
  forras = forras.slice().sort((p, q) => (0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2]) - (0.3 * q[0] + 0.59 * q[1] + 0.11 * q[2]));
  forras = mod === 'light' ? forras.slice(Math.floor(forras.length / 2)) : forras.slice(0, Math.ceil(forras.length / 2));
  const atl = [0, 1, 2].map((c) => Math.round(forras.reduce((s, v) => s + v[c], 0) / forras.length));
  return { m: kitagit(m, dil), bbox: [x_min, y_min, x_max, y_max], szin: '#' + atl.map((v) => v.toString(16).padStart(2, '0')).join(''), hatter: Math.round(kozep) };
}
function egyesit(a, c) { const m = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) m[i] = a[i] | c[i]; return m; }
function kitolt(b, m, iter) {
  const f = new Float32Array(W * H * 3); for (let i = 0; i < W * H * 3; i++) f[i] = b[i];
  const ismert = new Uint8Array(W * H); let marad = 0; for (let i = 0; i < W * H; i++) { ismert[i] = m[i] ? 0 : 1; marad += m[i]; }
  while (marad > 0) {
    const uj = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (ismert[y * W + x]) continue;
      let s0 = 0, s1 = 0, s2 = 0, c = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H || !ismert[yy * W + xx]) continue; const i = (yy * W + xx) * 3; s0 += f[i]; s1 += f[i + 1]; s2 += f[i + 2]; c++; }
      if (c) uj.push([x, y, s0 / c, s1 / c, s2 / c]);
    }
    if (!uj.length) break;
    for (const [x, y, a, bb, c] of uj) { const i = (y * W + x) * 3; f[i] = a; f[i + 1] = bb; f[i + 2] = c; ismert[y * W + x] = 1; marad--; }
  }
  const pontok = []; for (let i = 0; i < W * H; i++) if (m[i]) pontok.push(i);
  const g = new Float32Array(f);
  for (let k = 0; k < iter; k++) {
    for (const p of pontok) { const x = p % W, y = (p - x) / W; for (let c = 0; c < 3; c++) { const l = x > 0 ? f[(p - 1) * 3 + c] : f[p * 3 + c], r = x < W - 1 ? f[(p + 1) * 3 + c] : f[p * 3 + c], u = y > 0 ? f[(p - W) * 3 + c] : f[p * 3 + c], d = y < H - 1 ? f[(p + W) * 3 + c] : f[p * 3 + c]; g[p * 3 + c] = (l + r + u + d) / 4; } }
    for (const p of pontok) { f[p * 3] = g[p * 3]; f[p * 3 + 1] = g[p * 3 + 1]; f[p * 3 + 2] = g[p * 3 + 2]; }
  }
  const o = new Uint8Array(W * H * 3);
  let seed = 4242; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < W * H * 3; i++) o[i] = Math.max(0, Math.min(255, Math.round(f[i] + (m[(i / 3) | 0] ? (rnd() - 0.5) * 2.2 : 0))));
  return o;
}

const jelentes = {};
function feladat(n, tema, oldal, szovegek, extra) {
  let b = olvas(`${FORRAS}/${n}.jpg`);
  let m = new Uint8Array(W * H);
  const kimenet = {};
  for (const [kulcs, win, mod, delta, dil, belul] of szovegek) {
    const r = szovegMaszk(b, win, mod, delta, dil, belul);
    m = egyesit(m, r.m); kimenet[kulcs] = { bbox: r.bbox, szin: r.szin, hatter: r.hatter };
  }
  if (extra) extra(b, m, kimenet);
  b = kitolt(b, m, 160);
  if (extra && extra.utan) b = extra.utan(b);
  ir(b, W, H, `${KI}/${tema}-${oldal}.jpg`);
  jelentes[`${tema}-${oldal}`] = kimenet;
  console.log(tema, oldal, JSON.stringify(kimenet));
}

// ------------------------------------------------------------------ SMARAGD elol (14)
{
  const kepiv = { cx: 416, cy: 408, r: 258, x0: 158, x1: 674, y0: 150, y1: 908 };
  const ivBelul = (x, y) => x >= kepiv.x0 && x <= kepiv.x1 && y >= kepiv.y0 && y <= kepiv.y1 && (y >= kepiv.cy || Math.hypot(x - kepiv.cx, y - kepiv.cy) <= kepiv.r);
  const f = (b, m, k) => {
    // az iv belseje: sotet, arnyalt (a fotohely helye) - a maszkba kerul, kozvetlenul beirjuk
  };
  feladat(14, 'smaragd', 'elol', [
    ['idezet', [790, 495, 1325, 680], 'light', 70, 14],
    ['nev', [848, 796, 1300, 858], 'light', 70, 14]
  ], Object.assign(f, {
    utan: (b) => {
      for (let y = kepiv.y0; y <= kepiv.y1; y++) for (let x = kepiv.x0; x <= kepiv.x1; x++) {
        if (!ivBelul(x, y)) continue;
        const t = (y - kepiv.y0) / (kepiv.y1 - kepiv.y0);
        const v = Math.min(1, Math.hypot((x - kepiv.cx) / kepiv.r, (y - (kepiv.cy + 150)) / 460));
        const kk = 1 + 0.85 * v;
        const i = (y * W + x) * 3;
        const d = Math.min(x - (kepiv.x0 - 0.4), (kepiv.x1 + 0.4) - x, (kepiv.y1 + 0.4) - y, y < kepiv.cy ? (kepiv.r + 0.4) - Math.hypot(x - kepiv.cx, y - kepiv.cy) : 1e9);
        const al = Math.max(0, Math.min(1, d + 0.5));
        const fr = Math.round((19 - 6 * t) / kk * 1.1), fg = Math.round((52 - 16 * t) / kk * 1.1), fb = Math.round((45 - 14 * t) / kk * 1.1);
        b[i] = Math.round(fr * al + b[i] * (1 - al)); b[i + 1] = Math.round(fg * al + b[i + 1] * (1 - al)); b[i + 2] = Math.round(fb * al + b[i + 2] * (1 - al));
      }
      return b;
    }
  }));
}
// ------------------------------------------------------------------ SMARAGD hat (17)
feladat(17, 'smaragd', 'hat', [
  ['termek', [395, 360, 1105, 485], 'light', 70, 14], ['termek_r', [394, 360, 1101, 488], 'rect'],
  ['ertek', [680, 540, 1040, 630], 'light', 70, 14], ['ertek_r', [682, 542, 1030, 622], 'rect'],
  ['kod', [560, 702, 935, 742], 'light', 70, 14], ['kod_r', [582, 696, 912, 746], 'rect'],
  ['ervenyes', [500, 818, 995, 862], 'light', 70, 14], ['ervenyes_r', [504, 808, 990, 866], 'rect']
]);
// ------------------------------------------------------------------ VIRAG elol (15)
{
  const rr = (x, y) => { const x0 = 169, x1 = 602, y0 = 173, y1 = 853, r = 14; const cx = Math.min(Math.max(x, x0 + r), x1 - r), cy = Math.min(Math.max(y, y0 + r), y1 - r); return x >= x0 && x <= x1 && y >= y0 && y <= y1 && Math.hypot(x - cx, y - cy) <= r; };
  feladat(15, 'virag', 'elol', [
    ['idezet', [690, 565, 1285, 715], 'dark', 55, 9],
    ['nev', [725, 805, 1245, 870], 'dark', 55, 9],
    ['ablak', [165, 170, 606, 856], 'dark', 28, 6, rr]
  ]);
}
// ------------------------------------------------------------------ VIRAG hat (16)
feladat(16, 'virag', 'hat', [
  ['termek', [355, 310, 1145, 440], 'dark', 55, 9],
  ['ertek', [650, 510, 1075, 605], 'dark', 55, 9],
  ['kod', [540, 698, 960, 745], 'dark', 55, 9],
  ['ervenyes', [485, 825, 1010, 870], 'dark', 55, 9]
]);
// ------------------------------------------------------------------ SZALAG elol (18)
feladat(18, 'szalag', 'elol', [
  ['idezet', [690, 485, 1310, 650], 'dark', 55, 9],
  ['nev', [705, 838, 1215, 900], 'dark', 55, 9],
  ['ablak', [90, 290, 600, 800], 'dark', 28, 6, (x, y) => Math.hypot(x - 346.7, y - 543.1) <= 250]
]);
// ------------------------------------------------------------------ SZALAG hat (19)
feladat(19, 'szalag', 'hat', [
  ['termek', [350, 425, 1145, 555], 'dark', 55, 9],
  ['ertek', [680, 600, 985, 685], 'dark', 55, 9],
  ['kod', [570, 765, 925, 830], 'dark', 55, 9],
  ['ervenyes', [500, 860, 995, 905], 'dark', 55, 9]
]);
fs.writeFileSync(`${KI}/jelentes.json`, JSON.stringify(jelentes, null, 1));
