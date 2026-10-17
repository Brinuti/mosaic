// A kepek megjelenesi szelessege az uj oldalakon (gyorsitas, 2026-10-17): a build (tools/build.mjs, valaszado kepek) ebbol irja a <img> "sizes" attributumat,
// hogy a bongeszo a tools/kep-valtozatok.py kisebb valtozatai kozul a kepernyohoz illot toltse (ne a 2560 px-es eredetit egy 300 px-es helyre).
//   node tools/build.mjs && python3 tools/kep-valtozatok.py && node tools/serve.mjs &      majd:     node tools/kep-meretek.mjs     (utana ujra: node tools/build.mjs)
// Az asztali lapok (dist/_a) 1440 es 820 px szelesen (az iPad is az asztali lapot kapja), a mobil lapok (dist/_m) 390 px szelesen; csak a valtozattal
// rendelkezo kepek (assets/img/valtozat/jegyzek.json). Kimenet: uj-oldalak/kep-meretek.json  { "_a/<lap>": { "<kep>": [w1440, w820] }, "_m/<lap>": { "<kep>": [w390] } }
// Ha egy lap uj kepet kap vagy az elrendezese valtozik, futtasd ujra (a merve nem levo kep srcset nelkul, az eredeti meretben marad).
import fs from 'node:fs';
import path from 'node:path';
import { chromium, devices } from './pw.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const BASE = process.env.BASE || 'http://localhost:4290';
const jegyzek = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/img/valtozat/jegyzek.json'), 'utf8'));
const lapok = (ki) => fs.readdirSync(path.join(ROOT, 'dist', ki), { recursive: true }).filter((x) => x.endsWith('.html') && !x.startsWith('regi/') && !x.startsWith('regi' + path.sep)).sort();
const ered = {};
const b = await chromium.launch();
async function mer(ki, rel, szelessegek) {
  const ctx = await b.newContext(ki === '_m' ? { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } } : { viewport: { width: szelessegek[0], height: 900 } });
  await ctx.route((u) => !u.toString().startsWith(BASE), (r) => r.abort());
  const p = await ctx.newPage();
  const sor = {};
  try {
    await p.goto(`${BASE}/${ki}/${rel}`, { waitUntil: 'load', timeout: 30000 });
    await p.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach((i) => { i.loading = 'eager'; }));
    await p.waitForFunction(() => [...document.images].every((i) => !i.getAttribute('src') || i.complete), null, { timeout: 15000 }).catch(() => {});
    for (const [n, w] of szelessegek.entries()) {
      if (n) { await p.setViewportSize({ width: w, height: 900 }); await p.waitForTimeout(250); }
      const m = await p.evaluate(() => {
        const o = {};
        for (const i of document.images) {
          const s = (i.getAttribute('src') || '').replace(/[?#].*$/, '');
          if (!s.startsWith('/assets/img/') || i.closest('dialog')) continue;
          const w = Math.ceil(i.getBoundingClientRect().width);
          if (w > (o[s] || 0)) o[s] = w;
        }
        return o;
      });
      for (const [s, w] of Object.entries(m)) {
        const k = s.slice('/assets/img/'.length);
        if (!jegyzek[k]) continue;
        (sor[k] = sor[k] || [])[n] = w;
      }
    }
  } catch (e) { console.log('HIBA', ki, rel, e.message.slice(0, 80)); }
  await ctx.close();
  const tiszta = Object.fromEntries(Object.entries(sor).filter(([, v]) => v.every((x) => x > 0) && v.length === szelessegek.length));
  if (Object.keys(tiszta).length) ered[`${ki}/${rel.replace(/\.html$/, '')}`] = tiszta;
}
const munkak = [...lapok('_a').map((r) => ['_a', r, [1440, 820]]), ...lapok('_m').map((r) => ['_m', r, [390]])];
const PAR = +process.env.PARHUZAM || 3;
await Promise.all(Array.from({ length: PAR }, async () => { while (munkak.length) { const [ki, r, sz] = munkak.shift(); await mer(ki, r, sz); } }));
await b.close();
const rendezett = Object.fromEntries(Object.keys(ered).sort().map((k) => [k, Object.fromEntries(Object.keys(ered[k]).sort().map((s) => [s, ered[k][s]]))]));
fs.writeFileSync(path.join(ROOT, 'uj-oldalak/kep-meretek.json'), JSON.stringify(rendezett, null, 0).replace(/\],"/g, '],\n"').replace(/\},"/g, '},\n"'));
console.log(`${Object.keys(ered).length} lap, ${Object.values(ered).reduce((n, o) => n + Object.keys(o).length, 0)} kep-elofordulas`);
