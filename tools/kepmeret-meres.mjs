// A kepek tenyleges megjelenitesi meretenek merese (Playwright), a
// tools/kepek-kicsinyites.py ehhez igazitja a kepfajlokat.
//
//   ELES=1 node tools/netlify-build.mjs && node tools/serve-dist.mjs &
//   node tools/kepmeret-meres.mjs        -> tools/kepmeretek.json
//
// Minden oldalt asztalin (1920 px szeles ablak) es mobilon vegiggorget, es
// kepfajlonkent feljegyzi a legnagyobb aranyt: megjelenitett meret / a fajl
// sajat merete ("szuks"). 1 alatt a fajl nagyobb a kelleténél.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(process.env.PLAYWRIGHT_UTVONAL || '/opt/node22/lib/node_modules/');
const { chromium, devices } = require('playwright');
const oldalak = fs.readdirSync('dist/_a').filter(f => f.endsWith('.html')).map(f => f.replace(/\.html$/, ''));
const b = await chromium.launch();
const max = {}; // fajl -> {w,h,nw,nh,lapok}
for (const mob of [false, true]) {
  const ctx = await b.newContext(mob ? { ...devices['Pixel 5'] } : { viewport: { width: 1920, height: 1080 } });
  for (const o of oldalak) {
    const p = await ctx.newPage();
    try {
      await p.goto('http://localhost:4191/' + (o === 'fooldal' ? '' : o), { waitUntil: 'load', timeout: 60000 });
      const H = await p.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < H; y += 700) { await p.evaluate((y) => window.scrollTo(0, y), y); await p.waitForTimeout(60); }
      await p.waitForTimeout(800);
      const r = await p.evaluate(() => [...document.querySelectorAll('img')].map(i => { const q = i.getBoundingClientRect(); return [i.currentSrc || i.src, q.width, q.height, i.naturalWidth, i.naturalHeight, getComputedStyle(i).objectFit]; }));
      for (const [src, w, h, nw, nh, fit] of r) {
        const m = /\/assets\/img\/(m\/)?([^?#]+)/.exec(src); if (!m || !w) continue;
        const k = (m[1] || '') + decodeURIComponent(m[2]);
        // a megjelenitett resz kepe: cover eseten a rovidebb arany szamit
        const sk = fit === 'cover' ? Math.max(w / nw, h / nh) : Math.min(w / nw, h / nh);
        const e = max[k] || (max[k] = { szuks: 0, nw, nh, n: 0 });
        e.szuks = Math.max(e.szuks, sk); e.n++;
      }
    } catch (e) { console.error(o, e.message); }
    await p.close();
  }
  await ctx.close();
}
await b.close();
fs.writeFileSync('tools/kepmeretek.json', JSON.stringify(max, null, 1));
console.log(Object.keys(max).length, 'kep -> tools/kepmeretek.json');
