// Az oldalak lementese UGY, AHOGY A BONGESZOBEN KIRAJZOLODNAK (a Wix JS-e utan).
//
//   node tools/elo-mentes.mjs [--mobil] [--ujra] [kulcs...]  -> tools/elo-dom/<asztali|mobil>/<kulcs>.html
//
// A Wix szerveroldali HTML-je (tools/raw/) sok dobozt uresen hagy, amit a JS-e
// tolt ki futas kozben (ismetlok elrendezese, galeriak, HTML-beagyazasok,
// videok, terkep). Itt a kesz oldalt mentjuk: betoltes, vegiggorgetes (a lusta
// kepek es dobozok miatt), visszagorgetes a tetejere, majd a teljes DOM. A
// wix2static.mjs ezt hasznalja, ha megvan, kulonben a tools/raw/ mentest.
import fs from 'node:fs';
import path from 'node:path';
import { chromium, devices } from './pw.mjs';
import { mindenOldal as oldalak } from './oldalak.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const MOBIL = process.argv.includes('--mobil');
const OUT = path.join(ROOT, 'tools/elo-dom', MOBIL ? 'mobil' : 'asztali');
const kertek = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const ujra = process.argv.includes('--ujra') || kertek.length > 0;
// a 404-es lapot a Wix futas kozben uresre rajzolja: annal a szerveroldali mentes (tools/raw) a forras
const lista = oldalak().filter((o) => o.kulcs !== '404').filter((o) => (!kertek.length || kertek.includes(o.kulcs)) && (ujra || !fs.existsSync(path.join(OUT, o.kulcs + '.html'))));

const b = await chromium.launch();
const ctxOpt = MOBIL ? { ...devices['Pixel 5'] } : { viewport: { width: 1440, height: 900 } };
let kesz = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  const ctx = await b.newContext({ ...ctxOpt, locale: 'hu-HU' });
  // a Google-terkep keretenek a Wix uzenetben kuldi el a helyszineket - ezt elkapjuk
  await ctx.addInitScript(() => {
    if (!location.href.includes('googleMap')) return;
    window.__mpUzenetek = [];
    window.addEventListener('message', (e) => { if (e.data && e.data.type === 'SET_INITIAL_LOCATIONS') window.__mpUzenetek.push(e.data.data); });
  });
  while (lista.length) {
    const o = lista.shift();
    const p = await ctx.newPage();
    try {
      await p.goto(o.url, { waitUntil: 'load', timeout: 90000 });
      // vegiggorgetes; amig az oldal no (pl. a blog gorgetesre tolt be ujabb bejegyzeseket),
      // addig folytatjuk, igy a klonban minden bejegyzes benne van (legfeljebb 3 percig)
      await p.evaluate(async () => {
        const var_ = (ms) => new Promise((r) => setTimeout(r, ms));
        const t0 = Date.now();
        let y = 0, stabil = 0, utolso = 0;
        while (stabil < 3 && Date.now() - t0 < 180000) {
          for (; y < document.body.scrollHeight; y += 400) { scrollTo(0, y); await var_(150); }
          await var_(1500);
          if (document.body.scrollHeight === utolso) stabil++; else { stabil = 0; utolso = document.body.scrollHeight; }
        }
      });
      await p.waitForTimeout(2500);
      // Google-terkepek: a helyszinek a keret data-mp-terkep attributumaba (a wix2static ebbol
      // keszit sajat terkep-keretet)
      for (const f of p.frames()) {
        const m = f.url().match(/googleMap[^?]*\?.*\bid=([^&]+)/);
        if (!m) continue;
        const adat = await f.evaluate(() => (window.__mpUzenetek || [])[0] || null).catch(() => null);
        if (adat) await p.evaluate(({ id, adat }) => { for (const k of document.querySelectorAll(`iframe[src*="id=${id}"]`)) k.setAttribute('data-mp-terkep', adat); }, { id: m[1], adat });
      }
      // diavetitesek: a Wix mindig csak az aktualis diat tartja a DOM-ban, ezert vegiglapozunk
      // rajtuk, es minden diat elteszunk (a klon.js lapoz koztuk)
      const diak = await p.evaluate(async () => {
        const ki = [];
        for (const [i, sh] of [...document.querySelectorAll('.wixui-slideshow')].entries()) {
          const w = sh.querySelector('[data-testid="slidesWrapper"]');
          const kov = sh.querySelector('[data-testid="nextButton"]');
          if (!w || !kov) continue;
          sh.scrollIntoView();
          await new Promise((r) => setTimeout(r, 800));
          const aktiv = () => [...w.children].sort((a, b) => +getComputedStyle(b).opacity - +getComputedStyle(a).opacity)[0];
          const lista = [];
          for (let k = 0; k < 30; k++) {
            const a = aktiv();
            if (!a || lista.some((x) => x.id === a.id)) break;
            lista.push({ id: a.id, html: a.outerHTML });
            kov.click();
            await new Promise((r) => setTimeout(r, 1400));
          }
          sh.dataset.mpIndex = String(i);
          ki.push(lista);
        }
        return ki;
      });
      await p.evaluate(() => scrollTo(0, 0));
      await p.waitForTimeout(1500);
      const html = await p.evaluate((diak) => {
        // egy szinkron lepesben: minden diavetites az elso diaval, utana a tobbi rejtve
        for (const sh of document.querySelectorAll('.wixui-slideshow[data-mp-index]')) {
          const lista = diak[+sh.dataset.mpIndex];
          const w = sh.querySelector('[data-testid="slidesWrapper"]');
          if (!lista || !lista.length || !w) continue;
          w.innerHTML = lista.map((d, j) => j ? d.html.replace(/^<(\w+)/, '<$1 data-mp-dia hidden') : d.html.replace(/^<(\w+)/, '<$1 data-mp-dia')).join('');
          for (const el of w.children) el.style.opacity = '';
          sh.removeAttribute('data-mp-index');
        }
        return '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
      }, diak);
      fs.mkdirSync(path.dirname(path.join(OUT, o.kulcs)), { recursive: true });
      fs.writeFileSync(path.join(OUT, o.kulcs + '.html'), html);
      console.log(`${++kesz} ${o.kulcs} ${(html.length / 1024) | 0} kB`);
    } catch (e) { console.log(`HIBA ${o.kulcs}: ${e.message}`); }
    await p.close();
  }
  await ctx.close();
}));
await b.close();
