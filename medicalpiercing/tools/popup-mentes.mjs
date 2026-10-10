// A Wix felugro ablakainak (lightbox) lementese. A Wix ezeket kattintasra tolti le
// es rajzolja ki, a lementett oldalakban nincsenek benne. Itt az eles oldalon
// megnyitjuk oket, es elmentjuk a kirajzolt ablakot (#POPUPS_ROOT) a kozben
// betoltott stilusokkal egyutt.
//
//   node tools/popup-mentes.mjs   -> assets/popup/<id>-asztali.html, <id>-mobil.html
//                                    assets/css/wix/felugro.css
//
// A Wix az ablak megnyitasakor kulso stilusfajlokat is betolt (<link>: a felugro ablak, a
// menu-skin, a bezaro gomb stilusa) - ezek nelkul a menupontok formazatlanok (10 px-es kek
// linkek). Ezeket a helyi assets/css/wix/felugro.css-be gyujtjuk, a klon.js tolti be.
//
// Egy olyan oldalon nyitjuk meg, ami nincs a menuben (igy egyik menupont sincs
// kiemelve); az aktualis oldal kiemeleset a klon.js teszi ra.
import fs from 'node:fs';
import path from 'node:path';
import { chromium, devices } from './pw.mjs';
import { meresTiltas } from './meres-tiltas.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const OLDAL = 'https://www.medicalpiercing.hu/aszf';
const b = await chromium.launch();
const kulsoCss = [];
for (const [nezet, opt] of [['asztali', { viewport: { width: 1440, height: 900 } }], ['mobil', devices['Pixel 5']]]) {
  const ctx = await b.newContext(opt);
  await meresTiltas(ctx);
  const p = await ctx.newPage();
  await p.goto(OLDAL, { waitUntil: 'load', timeout: 90000 });
  await p.waitForTimeout(5000);
  const idk = await p.$$eval('[data-popupid]', (l) => [...new Set(l.map((e) => e.dataset.popupid))]);
  for (const id of idk) {
    const elotte = await p.evaluate(() => { document.querySelectorAll('style, link[rel="stylesheet"]').forEach((s) => { s.dataset.mpRegi = '1'; }); return 1; });
    void elotte;
    // a lathato peldanyra kattintunk (mobilon ket menugomb is van, az egyik rejtett)
    await p.$$eval(`[data-popupid="${id}"]`, (l) => { const e = l.find((x) => x.getBoundingClientRect().width > 0) || l[0]; e.click(); });
    await p.waitForSelector('#POPUPS_ROOT', { timeout: 20000 });
    await p.waitForTimeout(4000);
    const { html, css, linkek } = await p.evaluate(() => {
      const root = document.getElementById('POPUPS_ROOT');
      const css = [...document.querySelectorAll('style:not([data-mp-regi])')].map((s) => s.textContent).join('\n');
      const linkek = [...document.querySelectorAll('link[rel="stylesheet"]:not([data-mp-regi])')].map((l) => l.href);
      return { html: root.outerHTML, css, linkek };
    });
    for (const l of linkek) if (!kulsoCss.includes(l)) kulsoCss.push(l);
    const ki = path.join(ROOT, 'assets/popup', `${id}-${nezet}.html`);
    fs.writeFileSync(ki, `<style>${css}</style>\n${html}`);
    console.log(`${id} ${nezet}: ${(html.length / 1024) | 0} kB HTML, ${(css.length / 1024) | 0} kB CSS -> ${path.relative(ROOT, ki)}`);
    await p.keyboard.press('Escape');
    await p.waitForTimeout(1500);
  }
  await ctx.close();
}
await b.close();
// a kulso stilusfajlok egy helyi fajlba, a Wix betoltesi sorrendjeben
const reszek = [];
for (const u of kulsoCss) {
  const v = await fetch(u);
  if (!v.ok) throw new Error(`${u}: HTTP ${v.status}`);
  reszek.push(`/* ${decodeURIComponent(u.split('/').pop())} */\n${await v.text()}`);
}
const cel = path.join(ROOT, 'assets/css/wix/felugro.css');
fs.writeFileSync(cel, `/* A Wix felugro ablakanak kulso stilusai (tools/popup-mentes.mjs) */\n${reszek.join('\n')}\n`);
console.log(`${kulsoCss.length} kulso stilusfajl -> ${path.relative(ROOT, cel)}`);
