// A Wix-klon oldalak tartalmanak kinyerese JSON-ba (uj-oldalak/tartalom/<kulcs>.json) - a tukor-oldalak (/uj/...) forrasa.
// Egyszer fut (fejlesztoi gepen / a munkamenetben), az eredmeny a repoban van: a Cloudflare-build nem hasznal bongeszot.
//
//   node tools/build.mjs && node tools/serve.mjs &        (helyi kiszolgalo a klonnal, :4290)
//   node tools/uj-oldalak/kinyer.mjs                      az osszes oldal
//   node tools/uj-oldalak/kinyer.mjs /rolunk /blog        csak ezek
//   BASE=http://localhost:4290 PARHUZAM=4 node ...
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '../pw.mjs';
import { oldalak } from '../oldalak.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const BASE = process.env.BASE || 'http://localhost:4290';
const PARHUZAM = +process.env.PARHUZAM || 4;
const KOD = fs.readFileSync(path.join(import.meta.dirname, 'kinyer-oldalon.js'), 'utf8');
const KI = path.join(ROOT, 'uj-oldalak/tartalom');
fs.mkdirSync(KI, { recursive: true });

const kert = process.argv.slice(2);
const lista = oldalak().filter((o) => !kert.length || kert.includes(o.ut));

const b = await chromium.launch();
const jegyzek = [];
let kovetkezo = 0;
async function munkas() {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  // kulso szolgaltatasok (meres, beagyazasok) nem kellenek a tartalomhoz
  await ctx.route(/googletagmanager|google-analytics|doubleclick|stape|googlesyndication|cloudflareinsights|connect\.facebook|analytics\.tiktok|cdn\.trustindex|youtube|maps\.google|salonic|gstatic/, (r) => r.abort());
  while (kovetkezo < lista.length) {
    const o = lista[kovetkezo++];
    const p = await ctx.newPage();
    try {
      await p.goto(BASE + encodeURI(o.ut) + (o.ut === '/' ? '?' : '?') + 'motor=0', { waitUntil: 'load', timeout: 60000 });
      // lusta kepek / galeriak betoltese: vegiggorgetjuk az oldalt
      await p.evaluate(async () => {
        document.querySelectorAll('img[loading=lazy]').forEach((i) => { i.loading = 'eager'; });
        const h = document.documentElement.scrollHeight;
        for (let y = 0; y < h; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
        window.scrollTo(0, 0);
      });
      await p.waitForTimeout(700);
      const r = await p.evaluate(KOD);
      if (r.hiba) throw new Error(r.hiba);
      fs.writeFileSync(path.join(KI, o.kulcs.replace(/\//g, '__') + '.json'), JSON.stringify({ ut: o.ut, kulcs: o.kulcs, ...r }, null, 0));
      jegyzek.push({ ut: o.ut, kulcs: o.kulcs, tipus: r.tipus, szekcio: r.szekciok.length, magassag: r.magassag, cim: r.cim });
      process.stdout.write('.');
    } catch (e) {
      console.log(`\nHIBA ${o.ut}: ${e.message}`);
      jegyzek.push({ ut: o.ut, kulcs: o.kulcs, hiba: e.message });
    }
    await p.close();
  }
  await ctx.close();
}
await Promise.all(Array.from({ length: PARHUZAM }, munkas));
await b.close();
// a tukrozott oldalak jegyzeke (a build ebbol irja at a belso linkeket /uj/...-ra: tools/uj-fooldal.mjs, linkAtiras)
const KIHAGY = new Set(['/', '/idopontfoglalas', '/kontroll']);
if (!kert.length) fs.writeFileSync(path.join(ROOT, 'uj-oldalak/jegyzek.json'), JSON.stringify(jegyzek.filter((x) => !x.hiba && !KIHAGY.has(x.ut)).map((x) => ({ ut: x.ut })).sort((a, c) => a.ut.localeCompare(c.ut)), null, 0));
if (!kert.length) fs.writeFileSync(path.join(KI, '_jegyzek.json'), JSON.stringify(jegyzek.sort((a, c) => a.ut.localeCompare(c.ut)), null, 1));
console.log(`\n${jegyzek.length} oldal, hiba: ${jegyzek.filter((x) => x.hiba).length}`);
