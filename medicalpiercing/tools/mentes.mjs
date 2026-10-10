// Az eles Wix-oldalak lementese mindket valtozatban (a Wix a bongeszo azonositoja
// alapjan kulon asztali es kulon mobil oldalt szolgal ki).
//
//   node tools/mentes.mjs                 minden oldal, ami meg nincs lementve
//   node tools/mentes.mjs --friss         minden oldal ujra
//   node tools/mentes.mjs rolunk blog     csak a megadott kulcsu oldalak (ujra)
//
// Eredmeny: tools/raw/<kulcs>.html (asztali) es tools/raw-mobil/<kulcs>.html (mobil).
// A ket mappa nincs a tarhazban (nagy, es barmikor ujra lementheto).
import fs from 'node:fs';
import path from 'node:path';
import { mindenOldal as oldalak } from './oldalak.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
export const ASZTALI_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
export const MOBIL_UA = 'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

const kertek = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const friss = process.argv.includes('--friss') || kertek.length > 0;
const lista = oldalak().filter((o) => !kertek.length || kertek.includes(o.kulcs));

const feladatok = [];
for (const o of lista) for (const [mappa, ua] of [['tools/raw', ASZTALI_UA], ['tools/raw-mobil', MOBIL_UA]]) {
  const cel = path.join(ROOT, mappa, o.kulcs + '.html');
  if (!friss && fs.existsSync(cel)) continue;
  feladatok.push({ o, cel, ua, mappa });
}

let kesz = 0, hiba = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (feladatok.length) {
    const f = feladatok.shift();
    for (let proba = 1; proba <= 3; proba++) {
      try {
        const v = await fetch(f.o.url, { headers: { 'user-agent': f.ua, 'accept-language': 'hu-HU,hu;q=0.9' } });
        const html = await v.text();
        if (!v.ok && f.o.kulcs !== '404') throw new Error('HTTP ' + v.status);
        fs.mkdirSync(path.dirname(f.cel), { recursive: true });
        fs.writeFileSync(f.cel, html);
        const nezet = /id="wixMobileViewport"/.test(html) ? 'mobil' : 'asztali';
        if (++kesz % 20 === 0 || kertek.length) console.log(`${kesz}  ${(html.length / 1024).toFixed(0).padStart(5)} kB  ${nezet.padEnd(8)} ${path.relative(ROOT, f.cel)}`);
        break;
      } catch (e) {
        if (proba === 3) { hiba++; console.log(`HIBA ${f.o.url}: ${e.message}`); }
        else await new Promise((r) => setTimeout(r, 2000 * proba));
      }
    }
  }
}));
console.log(`Kesz: ${kesz} lementve, ${hiba} hiba`);
