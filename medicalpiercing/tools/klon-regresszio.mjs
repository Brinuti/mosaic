// Ket klon-build osszevetese kepkockankent (pl. egy takaritas vagy atalakitas elott es utan):
// minden oldal asztali es mobil nezetben, a nezetablak minden magassagban lefotozva, pixelre
// osszevetve, plusz a lap szovege es linkjei.
//
//   cp -r dist /tmp/dist-elotte          (a valtoztatas elott)
//   PORT=4291 DIST=/tmp/dist-elotte node tools/serve.mjs   (masik ablakban; a 4290-en az uj)
//   node tools/klon-regresszio.mjs [kulcs...]
//
// A kulso beagyazasokat (iframe) es az idozitoket mindket oldalon kikapcsolja, igy csak a
// valodi elteres marad. Eredmeny: tools/osszevetes/regresszio/ (kepek a nagyobb elteresekrol).
import fs from 'node:fs';
import path from 'node:path';
import { chromium, devices } from './pw.mjs';
import { mindenOldal } from './oldalak.mjs';

const REGI = process.env.REGI || 'http://localhost:4291';
const UJ = process.env.UJ || 'http://localhost:4290';
const PARHUZAMOS = +process.env.PARHUZAMOS || 4;
const HATAR = +process.env.HATAR || 0.002;
const kertek = process.argv.slice(2);
const OUT = path.join(import.meta.dirname, 'osszevetes', 'regresszio');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
// mobilon egesz kepponts-suruseg (a Pixel 5 2,75-os erteke kerekitesi zajt ad a kepeken)
const NEZETEK = [['asztali', { viewport: { width: 1440, height: 900 } }], ['mobil', { ...devices['Pixel 5'], deviceScaleFactor: 2 }]];
const b = await chromium.launch();
const kepLap = await (await b.newContext()).newPage();
await kepLap.setContent('<canvas id="a"></canvas><canvas id="b"></canvas>');
const elter = (a, c) => kepLap.evaluate(async ({ a, c }) => {
  const t = (s) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = 'data:image/png;base64,' + s; });
  const [ia, ic] = await Promise.all([t(a), t(c)]);
  if (ia.width !== ic.width || ia.height !== ic.height) return 1;
  const r = (id, img) => { const x = document.getElementById(id); x.width = img.width; x.height = img.height; const g = x.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height).data; };
  const da = r('a', ia), dc = r('b', ic);
  let n = 0;
  for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - dc[i]) + Math.abs(da[i + 1] - dc[i + 1]) + Math.abs(da[i + 2] - dc[i + 2]) > 30) n++;
  return n / (da.length / 4);
}, { a: a.toString('base64'), c: c.toString('base64') });

const ALLJ = () => {
  // idozitok nelkul (diavetites, videok), kulso beagyazasok nelkul
  window.setInterval = () => 0;
  document.addEventListener('DOMContentLoaded', () => {
    const s = document.createElement('style');
    s.textContent = 'iframe{visibility:hidden!important} *{animation:none!important;transition:none!important;caret-color:transparent!important} #SITE_HEADER{transform:none!important}';
    document.head.appendChild(s);
  });
};
async function megnyit(ctx, cim) {
  const p = await ctx.newPage();
  await p.addInitScript(ALLJ);
  await p.goto(cim, { waitUntil: 'load', timeout: 60000 });
  await p.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } scrollTo(0, 0); });
  // a betuk betoltese nelkul a szoveg lathatatlan lehet (font-display: block)
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(800);
  return p;
}
const ADAT = () => ({ szoveg: document.body.innerText.replace(/\s+/g, ' '), linkek: [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')).join('\n'), magassag: document.documentElement.scrollHeight });

const feladatok = [];
for (const o of mindenOldal().filter((o) => !kertek.length || kertek.includes(o.kulcs))) for (const n of NEZETEK) feladatok.push([o, n]);
const eredmeny = [];
let kesz = 0;
async function egy([o, [nezet, opt]]) {
  const ctx = await b.newContext(opt);
  const hibak = [];
  try {
    const [pr, pu] = await Promise.all([megnyit(ctx, REGI + encodeURI(o.ut)), megnyit(ctx, UJ + encodeURI(o.ut))]);
    const [ar, au] = await Promise.all([pr.evaluate(ADAT), pu.evaluate(ADAT)]);
    if (ar.szoveg !== au.szoveg) hibak.push('mas szoveg');
    if (ar.linkek !== au.linkek) hibak.push('mas linkek');
    if (ar.magassag !== au.magassag) hibak.push(`mas magassag ${ar.magassag} -> ${au.magassag}`);
    const vh = opt.viewport.height;
    for (let y = 0; y < Math.min(ar.magassag, au.magassag); y += vh) {
      await Promise.all([pr.evaluate((y) => scrollTo(0, y), y), pu.evaluate((y) => scrollTo(0, y), y)]);
      await Promise.all([pr.waitForTimeout(250), pu.waitForTimeout(250)]);
      await Promise.all([pr.evaluate(() => document.fonts.ready), pu.evaluate(() => document.fonts.ready)]);
      const [kr, ku] = await Promise.all([pr.screenshot(), pu.screenshot()]);
      const e = await elter(kr, ku);
      if (e > HATAR) {
        const f = `${nezet}-${o.kulcs.replace(/\//g, '__')}-y${y}`;
        fs.writeFileSync(path.join(OUT, f + '-regi.png'), kr);
        fs.writeFileSync(path.join(OUT, f + '-uj.png'), ku);
        hibak.push(`mas kep ${y}px: ${(e * 100).toFixed(2)}% -> ${f}`);
      }
    }
  } catch (e) { hibak.push('hiba: ' + e.message.split('\n')[0]); }
  await ctx.close();
  eredmeny.push({ oldal: o.ut, nezet, hibak });
  kesz++;
  if (hibak.length) console.log(`HIBA ${nezet} ${o.ut}: ${hibak.join(' | ')}`);
  if (kesz % 40 === 0) console.log(`  ${kesz}/${feladatok.length}`);
}
const sor = [...feladatok];
await Promise.all(Array.from({ length: PARHUZAMOS }, async () => { while (sor.length) await egy(sor.shift()); }));
await b.close();
fs.writeFileSync(path.join(OUT, 'eredmeny.json'), JSON.stringify(eredmeny, null, 1));
const rossz = eredmeny.filter((x) => x.hibak.length).length;
console.log(`\n${eredmeny.length} lap, ${rossz} elteressel`);
process.exit(rossz ? 1 : 0);
