// A Wix felugro ablakainak (lightbox) lementese. A Wix ezeket kattintasra tolti le
// es rajzolja ki, a lementett oldalakban nincsenek benne. Itt az eles oldalon
// megnyitjuk oket, es elmentjuk a kirajzolt ablakot (#POPUPS_ROOT) a kozben
// betoltott stilusokkal egyutt.
//
//   node tools/popup-mentes.mjs   -> assets/popup/<id>-asztali.html, <id>-mobil.html
//
// Egy olyan oldalon nyitjuk meg, ami nincs a menuben (igy egyik menupont sincs
// kiemelve); az aktualis oldal kiemeleset a klon.js teszi ra.
import fs from 'node:fs';
import path from 'node:path';
import { chromium, devices } from './pw.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const OLDAL = 'https://www.medicalpiercing.hu/aszf';
const b = await chromium.launch();
for (const [nezet, opt] of [['asztali', { viewport: { width: 1440, height: 900 } }], ['mobil', devices['Pixel 5']]]) {
  const ctx = await b.newContext(opt);
  const p = await ctx.newPage();
  await p.goto(OLDAL, { waitUntil: 'load', timeout: 90000 });
  await p.waitForTimeout(5000);
  const idk = await p.$$eval('[data-popupid]', (l) => [...new Set(l.map((e) => e.dataset.popupid))]);
  for (const id of idk) {
    const elotte = await p.evaluate(() => { document.querySelectorAll('style').forEach((s) => { s.dataset.mpRegi = '1'; }); return 1; });
    void elotte;
    // a lathato peldanyra kattintunk (mobilon ket menugomb is van, az egyik rejtett)
    await p.$$eval(`[data-popupid="${id}"]`, (l) => { const e = l.find((x) => x.getBoundingClientRect().width > 0) || l[0]; e.click(); });
    await p.waitForSelector('#POPUPS_ROOT', { timeout: 20000 });
    await p.waitForTimeout(4000);
    const { html, css } = await p.evaluate(() => {
      const root = document.getElementById('POPUPS_ROOT');
      const css = [...document.querySelectorAll('style:not([data-mp-regi])')].map((s) => s.textContent).join('\n');
      return { html: root.outerHTML, css };
    });
    const ki = path.join(ROOT, 'assets/popup', `${id}-${nezet}.html`);
    fs.writeFileSync(ki, `<style>${css}</style>\n${html}`);
    console.log(`${id} ${nezet}: ${(html.length / 1024) | 0} kB HTML, ${(css.length / 1024) | 0} kB CSS -> ${path.relative(ROOT, ki)}`);
    await p.keyboard.press('Escape');
    await p.waitForTimeout(1500);
  }
  await ctx.close();
}
await b.close();
