// Ingyenes (OFL/Apache) helyettesito betuk letoltese a Google Fontsrol.
// Csak a latin es latin-ext reszkeszletet mentjuk - a magyar ekezetekhez ez kell.
// Hasznalat: node tools/fonts-letoltes.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'assets/fonts');
fs.mkdirSync(OUT, { recursive: true });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

// csalad -> szukseges vastagsagok
const KELL = {
  'Roboto': [100, 300, 400, 500, 700, 900],
  'Sarabun': [300, 400, 700],
  'Nunito Sans': [300, 400, 800],
  'Jost': [400],
  'Arimo': [400, 700],
  'Barlow': [300, 400, 700],
  'Hanken Grotesk': [400, 600],
};

async function css(family, weights) {
  const q = family.replace(/ /g, '+') + ':wght@' + weights.join(';');
  const r = await fetch(`https://fonts.googleapis.com/css2?family=${q}&display=swap`, { headers: { 'user-agent': UA } });
  if (!r.ok) throw new Error(`${family}: HTTP ${r.status}`);
  return r.text();
}

let jegyzek = [];
for (const [family, weights] of Object.entries(KELL)) {
  const text = await css(family, weights);
  // blokkokra vagjuk, es megtartjuk a latin / latin-ext kommenttel jelolteket
  const blokkok = text.split('/*').slice(1);
  for (const b of blokkok) {
    const nev = b.slice(0, b.indexOf('*/')).trim();
    if (nev !== 'latin' && nev !== 'latin-ext') continue;
    const w = (b.match(/font-weight:\s*(\d+)/) || [])[1];
    const url = (b.match(/url\((https:[^)]+)\)/) || [])[1];
    const range = (b.match(/unicode-range:\s*([^;]+);/) || [])[1];
    if (!w || !url) continue;
    const fajl = `${family.toLowerCase().replace(/ /g, '-')}-${w}-${nev}.woff2`;
    const cel = path.join(OUT, fajl);
    if (!fs.existsSync(cel)) {
      const rr = await fetch(url, { headers: { 'user-agent': UA } });
      fs.writeFileSync(cel, Buffer.from(await rr.arrayBuffer()));
    }
    jegyzek.push({ family, weight: +w, subset: nev, file: fajl, range: range.trim(), size: fs.statSync(cel).size });
  }
  console.log(`${family}: kesz`);
}
fs.writeFileSync(path.join(ROOT, 'tools/fonts-jegyzek.json'), JSON.stringify(jegyzek, null, 2));
console.log(`\n${jegyzek.length} fajl, osszesen ${(jegyzek.reduce((a, b) => a + b.size, 0) / 1024).toFixed(0)} kB`);
