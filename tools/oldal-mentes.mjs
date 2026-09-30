// Egy eles oldal lementese mindket valtozatban:
//   node tools/oldal-mentes.mjs <utvonal> [fajlnev]
// pl. node tools/oldal-mentes.mjs post/suti-tajekoztato suti-tajekoztato
//      node tools/oldal-mentes.mjs / index   (nyitooldal)
// Eredmeny: tools/raw/<fajlnev>.html es tools/raw-mobil/<fajlnev>.html
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const ASZTALI = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const MOBIL = 'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

const ut = (process.argv[2] || '').replace(/^\/+/, '');
const nev = process.argv[3] || (ut.split('/').pop() || 'index');
if (process.argv[2] === undefined) { console.error('Hasznalat: node tools/oldal-mentes.mjs <utvonal> [fajlnev]'); process.exit(1); }

for (const [mappa, ua] of [['tools/raw', ASZTALI], ['tools/raw-mobil', MOBIL]]) {
  const v = await fetch(`https://www.mosaicheadspa.hu/${ut}`, { headers: { 'user-agent': ua, 'accept-language': 'hu-HU,hu;q=0.9' } });
  const html = await v.text();
  const cel = path.join(ROOT, mappa, nev + '.html');
  fs.writeFileSync(cel, html);
  const nezet = /id="wixMobileViewport"/.test(html) ? 'mobil' : 'asztali';
  console.log(`${v.status}  ${(html.length / 1024).toFixed(0).padStart(5)} kB  ${nezet.padEnd(8)} -> ${path.relative(ROOT, cel)}`);
}
