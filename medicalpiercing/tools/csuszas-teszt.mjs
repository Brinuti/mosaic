// Elrendezes-csuszas (CLS) minden uj lapon, kesleltetett kepekkel (gyorsitas, 2026-10-17): a Lighthouse a varos- es allasajanlat-lapokon csuszast mert, mert a
// kep doboza a betoltes elott 0 x 0 volt (width:auto + height:auto), es a kep megerkezesekor lejjebb tolta a tartalmat. Itt a kepek 1,5 s-mal kesve jonnek
// (a tobbi fajl azonnal), es a lap elso kepernyojen mert csuszasok osszeget irjuk ki lapankent, asztalon (1350 px) es mobilon (360 px).
//   node tools/csuszas-teszt.mjs [kuszob=0.02]          (a helyi szerver: node tools/serve.mjs)
import fs from 'node:fs';
import { chromium, devices } from './pw.mjs';
const BASE = (process.env.BASE || 'http://localhost:4290').replace(/\/$/, '');
const KUSZOB = +process.argv[2] || 0.02;
const lapok = (ki) => fs.readdirSync('dist/' + ki, { recursive: true }).filter((x) => x.endsWith('.html') && !/^regi[\\/]/.test(x)).map((x) => x.replace(/\\/g, '/').replace(/\.html$/, ''));
const b = await chromium.launch();
const hibak = [];
for (const [ki, nev, opt] of [['_a', 'asztali', { viewport: { width: 1350, height: 940 } }], ['_m', 'mobil', { ...devices['Moto G4'] }]]) {
  const k = await b.newContext(opt);
  await k.addInitScript(() => { window.__cls = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls.push({ v: e.value, n: (e.sources || []).map((s) => s.node && (s.node.className || s.node.tagName)).join(' | ').slice(0, 120) }); }).observe({ type: 'layout-shift', buffered: true }); });
  await k.route('**/*', async (r) => {
    const u = r.request().url();
    if (!u.startsWith(BASE)) return r.abort();
    if (r.request().resourceType() === 'image') await new Promise((x) => setTimeout(x, 1500));
    return r.continue().catch(() => {});
  });
  const sor = lapok(ki); const db = sor.length;
  const munkas = async () => { const p = await k.newPage(); while (sor.length) { const l = sor.shift();
    try {
      await p.goto(`${BASE}/${ki}/${l}.html?motor=0`, { waitUntil: 'load', timeout: 60000 });
      await p.waitForTimeout(600);
      const c = await p.evaluate(() => window.__cls);
      const ossz = c.reduce((s, x) => s + x.v, 0);
      if (ossz > KUSZOB) hibak.push({ nezet: nev, lap: l, cls: +ossz.toFixed(3), forras: [...new Set(c.filter((x) => x.v > 0.005).map((x) => x.n))].slice(0, 3) });
    } catch (e) { hibak.push({ nezet: nev, lap: l, hiba: String(e).slice(0, 100) }); }
  } await p.close(); };
  await Promise.all([munkas(), munkas(), munkas(), munkas()]);
  await k.close();
  console.log(`${nev}: ${db} lap`);
}
await b.close();
for (const h of hibak.sort((x, y) => (y.cls || 9) - (x.cls || 9))) console.log('CSUSZAS', h.nezet, h.lap, h.cls ?? h.hiba, JSON.stringify(h.forras || ''));
console.log(hibak.length ? `\n${hibak.length} lapon csuszas (> ${KUSZOB})` : '\nminden rendben: nincs csuszas');
process.exit(hibak.length ? 1 : 0);
