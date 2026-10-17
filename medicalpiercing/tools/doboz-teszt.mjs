// A kepek / videok doboza a betoltes elott ugyanakkora-e, mint utana (elrendezes-csuszas, CLS; gyorsitas, 2026-10-17), minden uj lapon, asztalon (1350 px) es mobilon.
//   node tools/doboz-teszt.mjs [ki.json] [alap.json]
// A "betoltes elott" meres: a kepek / videok kerese 12 s-ig fuggoben marad (a meres elotte); "utana": minden kep betoltve (a lusta kepek is).
// ki.json: a betoltes utani dobozok lapankent (osszevetesre); alap.json megadasakor a betoltes utani dobozokat ahhoz meri (a vegleges kinezet nem valtozhat).
import fs from 'node:fs';
import { chromium, devices } from './pw.mjs';
const BASE = 'http://localhost:4290';
const [KI, ALAP] = process.argv.slice(2);
const alap = ALAP ? JSON.parse(fs.readFileSync(ALAP, 'utf8')) : null;
const lapok = (ki) => fs.readdirSync('dist/' + ki, { recursive: true }).filter((x) => x.endsWith('.html') && !/^regi[\\/]/.test(x)).map((x) => x.replace(/\\/g, '/').replace(/\.html$/, ''));
const meres = () => [...document.querySelectorAll('img, video')].map((e) => { const r = e.getBoundingClientRect(); const p = e.parentElement; return { t: e.tagName, c: (e.getAttribute('class') || '') + (e.hasAttribute('data-teljes') ? ' [teljes]' : ''), p: p ? (p.getAttribute('class') || p.tagName) : '', src: (e.getAttribute('src') || '').split('/').pop().slice(0, 40), x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height), lathato: getComputedStyle(e).display !== 'none' && r.width + r.height > 0 }; });
const b = await chromium.launch();
const csop = {}, valt = {}, ki = {};
let lapDb = 0;
for (const [mappa, nev, opt] of [['_a', 'asztali', { viewport: { width: 1350, height: 940 } }], ['_m', 'mobil', { ...devices['Moto G4'] }]]) {
  const k1 = await b.newContext(opt), k2 = await b.newContext(opt);
  await k1.route('**/*', (r) => { if (!r.request().url().startsWith(BASE)) return r.abort(); const t = r.request().resourceType(); if (t === 'image' || t === 'media') return new Promise((x) => setTimeout(x, 12000)).then(() => r.abort()).catch(() => {}); return r.continue().catch(() => {}); });
  await k2.route('**/*', (r) => (!r.request().url().startsWith(BASE) ? r.abort() : r.continue()).catch(() => {}));
  const sor = lapok(mappa);
  const munkas = async () => { while (sor.length) { const l = sor.shift(); lapDb++;
    const p1 = await k1.newPage(), p2 = await k2.newPage();
    try {
      await p1.goto(`${BASE}/${mappa}/${l}.html?motor=0`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await p1.waitForFunction(() => [...document.querySelectorAll('link[rel=stylesheet]')].every((l) => l.sheet), null, { timeout: 30000 }); await p1.evaluate(() => document.fonts.ready); await p1.waitForTimeout(500);
      const a = await p1.evaluate(meres);
      await p2.goto(`${BASE}/${mappa}/${l}.html?motor=0`, { waitUntil: 'load', timeout: 60000 });
      await p2.evaluate(async () => { document.querySelectorAll('img[loading=lazy]').forEach((i) => (i.loading = 'eager')); await Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((x) => { i.onload = i.onerror = x; setTimeout(x, 8000); })))); await new Promise((x) => setTimeout(x, 400)); });
      const u = await p2.evaluate(meres);
      ki[`${nev}/${l}`] = u.map((y) => [y.src, y.w, y.h]);
      if (a.length === u.length) a.forEach((x, i) => { const y = u[i]; if (!y.lathato) return; if (Math.abs(x.w - y.w) > 2 || Math.abs(x.h - y.h) > 2) { const kk = `${nev} ${x.t} .${x.c} < .${x.p}`; const e = (csop[kk] = csop[kk] || { db: 0, lapok: new Set(), pl: '' }); e.db++; e.lapok.add(l); if (!e.pl) e.pl = `${l}: ${x.w}x${x.h} -> ${y.w}x${y.h}`; } });
      const r = alap && alap[`${nev}/${l}`];
      if (r) { if (r.length !== u.length) (valt[`${nev}/${l}`] = valt[`${nev}/${l}`] || []).push(`elemszam ${r.length} -> ${u.length}`); else u.forEach((y, i) => { const [s, w, h] = r[i]; if (Math.abs(w - y.w) > 1 || Math.abs(h - y.h) > 1) (valt[`${nev}/${l}`] = valt[`${nev}/${l}`] || []).push(`${y.c} ${s}: ${w}x${h} -> ${y.w}x${y.h}`); }); }
    } catch (e) { console.log('hiba', nev, l, String(e).slice(0, 80)); }
    await p1.close({ runBeforeUnload: false }).catch(() => {}); await p2.close().catch(() => {});
  } };
  await Promise.all(Array.from({ length: 6 }, munkas));
  await k1.close(); await k2.close();
}
await b.close();
if (KI) fs.writeFileSync(KI, JSON.stringify(ki));
const sorok = Object.entries(csop).sort((x, y) => y[1].db - x[1].db);
for (const [kk, e] of sorok) console.log('CSUSZIK', String(e.db).padStart(4), kk.slice(0, 110), '|', e.lapok.size, 'lap | pl.', e.pl.slice(0, 90));
const vl = Object.entries(valt);
for (const [l, v] of vl.slice(0, 40)) console.log('VALTOZOTT', l, v.slice(0, 3).join('; '));
console.log(`\n${lapDb} lapnezet; betoltes elott / utana eltero doboz: ${sorok.reduce((s, x) => s + x[1].db, 0)}${alap ? `; a vegleges kinezet ${vl.length} lapon valtozott` : ''}`);
