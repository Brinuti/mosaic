// Elemenkenti osszevetes: az eles Wix-oldal es a klon minden [id^=comp-] elemenek
// helye es merete. Kiirja az elso eltero elemeket (a legfelso eltérés az oka a
// tobbinek), igy latszik, hol kezd elcsuszni a klon.
//
//   node tools/elteres.mjs [--mobil] <kulcs> [kulcs...]
import { chromium, devices } from './pw.mjs';
import { meresTiltas } from './meres-tiltas.mjs';
import { oldalak } from './oldalak.mjs';

const MOBIL = process.argv.includes('--mobil');
const HELYI = process.env.HELYI || 'http://localhost:4290';
const kertek = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const b = await chromium.launch();
const ctxOpt = MOBIL ? { ...devices['Pixel 5'] } : { viewport: { width: 1440, height: 900 } };

async function geometria(url) {
  const ctx = await b.newContext(ctxOpt);
  await meresTiltas(ctx);
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: 'load', timeout: 90000 });
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 100)); } scrollTo(0, 0); });
  await p.waitForTimeout(2500);
  const g = await p.evaluate(() => {
    const o = {};
    for (const el of document.querySelectorAll('[id^="comp-"]')) {
      const r = el.getBoundingClientRect();
      o[el.id] = [Math.round(r.left), Math.round(r.top + scrollY), Math.round(r.width), Math.round(r.height), (el.className || '').toString().split(' ').find((c) => c.startsWith('wixui-')) || ''];
    }
    const diak = [...document.querySelectorAll('.wixui-slideshow [data-testid="slidesWrapper"] [id^="comp-"], .wixui-slideshow [data-testid="slidesWrapper"] > [id]')].map((x) => x.id);
    return { o, h: document.documentElement.scrollHeight, diak };
  });
  await ctx.close();
  return g;
}
for (const o of oldalak().filter((x) => kertek.includes(x.kulcs))) {
  const e = await geometria(o.url);
  const k = await geometria(HELYI + encodeURI(o.ut));
  const elterok = [];
  const diak = new Set([...e.diak, ...k.diak]);
  for (const [id, ge] of Object.entries(e.o)) {
    const gk = k.o[id];
    // a diavetitesek diai idofuggok (a mereskor mas dia latszhat): ezeket nem vetjuk ossze
    if (diak.has(id)) continue;
    if (!gk) { if (ge[3] > 0) elterok.push([ge[1], `${id} ${ge[4]} hianyzik a klonbol (${ge.slice(0, 4)})`]); continue; }
    if (ge.slice(0, 4).some((v, i) => Math.abs(v - gk[i]) > 1)) elterok.push([ge[1], `${id} ${ge[4]} eredeti ${ge.slice(0, 4)} klon ${gk.slice(0, 4)}`]);
  }
  elterok.sort((a, b) => a[0] - b[0]);
  console.log(`\n== ${o.kulcs}: magassag ${e.h} / ${k.h}, ${elterok.length} eltero elem`);
  for (const [, s] of elterok.slice(0, 12)) console.log('  ' + s);
}
await b.close();
