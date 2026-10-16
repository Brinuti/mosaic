// A Helyszíneink oldal hősképe: Magyarország térképe mind a 15 helyszínnel (a városok valódi földrajzi helyén), a főoldal színeivel.
// Programozottan készül (beágyazott SVG, a lap betűjével), mint a foglalómotor kis térkép-ikonjai (tools/helyszin-ikonok.mjs, ugyanaz a határvonal).
//
//   node tools/uj-helyszin-terkep.mjs   ->  uj-oldalak/reszek/helyszin-terkep.html   (közös rész: <!--#helyszin-terkep-->)
import fs from 'node:fs';
const KI = new URL('../uj-oldalak/reszek/helyszin-terkep.html', import.meta.url).pathname;

// a johan/world.geo.json (HUN) egyszerűsített határa (lon, lat), mint a helyszin-ikonok.mjs-ben
const HATAR = [[16.202298, 46.852386], [16.534268, 47.496171], [16.340584, 47.712902], [16.903754, 47.714866], [16.979667, 48.123497], [17.488473, 47.867466], [17.857133, 47.758429], [18.696513, 47.880954], [18.777025, 48.081768], [19.174365, 48.111379], [19.661364, 48.266615], [19.769471, 48.202691], [20.239054, 48.327567], [20.473562, 48.56285], [20.801294, 48.623854], [21.872236, 48.319971], [22.085608, 48.422264], [22.64082, 48.15024], [22.710531, 47.882194], [22.099768, 47.672439], [21.626515, 46.994238], [21.021952, 46.316088], [20.220192, 46.127469], [19.596045, 46.17173], [18.829838, 45.908878], [18.456062, 45.759481], [17.630066, 45.951769], [16.882515, 46.380632], [16.564808, 46.503751], [16.370505, 46.841327]];
// a Duna és a Tisza (vázlatos), a Balaton
const DUNA = [[17.16, 48.0], [17.6, 47.83], [18.2, 47.75], [18.74, 47.79], [18.92, 47.82], [19.07, 47.77], [19.06, 47.6], [19.05, 47.5], [18.98, 47.3], [18.94, 47.12], [18.93, 46.96], [18.87, 46.7], [18.9, 46.42], [18.95, 46.18], [18.83, 45.92]];
const TISZA = [[22.62, 48.12], [22.3, 48.14], [21.85, 48.2], [21.41, 48.13], [21.08, 47.93], [20.78, 47.63], [20.45, 47.42], [20.19, 47.17], [20.14, 46.9], [20.12, 46.6], [20.15, 46.25], [20.17, 46.14]];
const BALATON = [[17.24, 46.73], [17.42, 46.71], [17.62, 46.76], [17.86, 46.86], [18.04, 46.96], [18.13, 47.03], [18.04, 47.05], [17.86, 46.96], [17.66, 46.88], [17.46, 46.8], [17.3, 46.77]];
// varos -> [szélesség, hosszúság, felirat-eltolás (dx, dy), igazítás]; a Budapest állandó szalon
const VAROSOK = [
  ['Budapest', 47.4979, 19.0402, 0, -30, 'middle', true],
  ['Sopron', 47.6817, 16.5845, -4, -20, 'middle'], ['Szombathely', 47.2307, 16.6218, 16, 6, 'start'], ['Zalaegerszeg', 46.8417, 16.8416, -6, -18, 'middle'],
  ['Keszthely', 46.7684, 17.2427, 16, 24, 'start'], ['Nagykanizsa', 46.459, 16.9897, 0, 30, 'middle'], ['Kaposvár', 46.3594, 17.7968, 0, 30, 'middle'],
  ['Pécs', 46.0727, 18.2323, 0, 30, 'middle'], ['Székesfehérvár', 47.186, 18.4221, -14, 30, 'middle'], ['Kecskemét', 46.8964, 19.6897, 0, 30, 'middle'],
  ['Szeged', 46.253, 20.1414, 0, 30, 'middle'], ['Békéscsaba', 46.6735, 21.0877, 0, 30, 'middle'], ['Debrecen', 47.5316, 21.6273, 0, 30, 'middle'],
  ['Nyíregyháza', 47.9495, 21.7244, 0, -18, 'middle'], ['Miskolc', 48.1035, 20.7784, 0, -18, 'middle'],
];

// egyenterű vetítés a 47,2 fokos szélességen; 1000 egység széles, körben margó
const K = Math.cos((47.2 * Math.PI) / 180);
const lon0 = Math.min(...HATAR.map((p) => p[0])), lon1 = Math.max(...HATAR.map((p) => p[0]));
const lat0 = Math.min(...HATAR.map((p) => p[1])), lat1 = Math.max(...HATAR.map((p) => p[1]));
const M = 60, SZ = 1000 - 2 * M, SK = SZ / ((lon1 - lon0) * K);
const W = 1000, H = Math.round((lat1 - lat0) * SK + 2 * M);
const px = (lon) => +(M + (lon - lon0) * K * SK).toFixed(1);
const py = (lat) => +(M + (lat1 - lat) * SK).toFixed(1);
const pont = ([lo, la]) => [px(lo), py(la)];

// sima görbe a pontokon át (Catmull-Rom -> köbös Bézier); zart: a határ és a Balaton
function gorbe(pontok, zart) {
  const p = pontok.map(pont), n = p.length, t = 0.5;
  const at = (i) => p[zart ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  let d = `M${p[0][0]} ${p[0][1]}`;
  for (let i = 0; i < (zart ? n : n - 1); i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1 = [p1[0] + ((p2[0] - p0[0]) * t) / 3, p1[1] + ((p2[1] - p0[1]) * t) / 3];
    const c2 = [p2[0] - ((p3[0] - p1[0]) * t) / 3, p2[1] - ((p3[1] - p1[1]) * t) / 3];
    d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0]} ${p2[1]}`;
  }
  return d + (zart ? 'Z' : '');
}

const tuk = VAROSOK.map(([nev, la, lo, dx, dy, ig, fo]) => {
  const x = px(lo), y = py(la);
  return fo
    ? `<g class="ht-fo"><circle cx="${x}" cy="${y}" r="30" fill="#ab6354" fill-opacity=".16"/><circle cx="${x}" cy="${y}" r="15" fill="#ab6354" stroke="#fff" stroke-width="5"/><text x="${x + dx}" y="${y + dy}" text-anchor="${ig}" class="ht-nev ht-nev-fo">${nev}</text><text x="${x}" y="${y + 50}" text-anchor="middle" class="ht-al">Állandó szalon</text></g>`
    : `<g><circle cx="${x}" cy="${y}" r="10" fill="#d7aba8" stroke="#fff" stroke-width="4"/><text x="${x + dx}" y="${y + dy}" text-anchor="${ig}" class="ht-nev">${nev}</text></g>`;
}).join('');

const svg = `<svg class="helyszin-terkep" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="ht-cim" xmlns="http://www.w3.org/2000/svg"><title id="ht-cim">Magyarország térképe a 15 helyszínünkkel: Budapest (állandó szalon), Békéscsaba, Debrecen, Kaposvár, Kecskemét, Keszthely, Miskolc, Nagykanizsa, Nyíregyháza, Pécs, Sopron, Szeged, Székesfehérvár, Szombathely, Zalaegerszeg</title>`
  + `<defs><linearGradient id="ht-fold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbf3ef"/><stop offset="1" stop-color="#f2dfdb"/></linearGradient><filter id="ht-arnyek" x="-5%" y="-5%" width="110%" height="115%"><feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#8a5a52" flood-opacity=".18"/></filter></defs>`
  + `<path d="${gorbe(HATAR, true)}" fill="url(#ht-fold)" stroke="#d7aba8" stroke-width="4" stroke-linejoin="round" filter="url(#ht-arnyek)"/>`
  + `<path d="${gorbe(DUNA, false)}" fill="none" stroke="#bcd2df" stroke-width="5" stroke-linecap="round"/><path d="${gorbe(TISZA, false)}" fill="none" stroke="#bcd2df" stroke-width="4" stroke-linecap="round"/>`
  + `<path d="${gorbe(BALATON, true)}" fill="#c9dde8"/>`
  + tuk + '</svg>';

const html = `  <!-- a Helyszíneink hősképe: generált térkép (tools/uj-helyszin-terkep.mjs), a 15 helyszín a valódi helyén -->\n  ${svg}\n`;
fs.writeFileSync(KI, html);
console.log(`${VAROSOK.length} helyszín, ${W}x${H}: ${KI}`);
