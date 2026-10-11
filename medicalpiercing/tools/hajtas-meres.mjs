// Az elso kepernyo ("a hajtas felett") felmerese oldalankent, asztali es mobil nezetben:
// mely kepek latszanak betolteskor, es mely betufajlok kellenek az ott lathato szoveghez.
// A build (tools/gyorsitas.mjs) ebbol dolgozik: ezek a kepek azonnal toltodnek (a legnagyobbak
// elsobbseggel), a tobbi csak gorgeteskor; ezeket a betuket a lap eleje elore keri, igy a
// szoveg nem ugrik at a tartalekbeturol (a fejlec emiatt randult 8 px-et).
//
//   node tools/serve.mjs &   (a helyi kiszolgalo, a friss dist/-bol)
//   node tools/hajtas-meres.mjs [kulcs...]     -> tools/hajtas.json
//
// Ha a klon/ lapjai valtoznak (tools/wix2static.mjs), ezt is ujra kell futtatni; a meg fel nem
// mert lapokhoz a build nem nyul (a Wix-tol orokolt betoltesi jelek maradnak).
import fs from 'node:fs';
import path from 'node:path';
import { chromium, devices } from './pw.mjs';
import { mindenOldal } from './oldalak.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const KI = path.join(ROOT, 'tools/hajtas.json');
const HELYI = process.env.HELYI || 'http://localhost:4290';
const kertek = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const NEZETEK = { a: { viewport: { width: 1440, height: 900 } }, m: { ...devices['Pixel 5'] } };
const PARHUZAM = 4;

const eddigi = fs.existsSync(KI) ? JSON.parse(fs.readFileSync(KI, 'utf8')) : {};
const lapok = mindenOldal().filter((o) => !kertek.length || kertek.includes(o.kulcs));

async function meres(ctx, ut) {
  const p = await ctx.newPage();
  try {
    await p.goto(HELYI + encodeURI(ut), { waitUntil: 'load', timeout: 90000 });
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(400);
    return await p.evaluate(() => {
      const H = innerHeight;
      const ut = (u) => { try { const x = new URL(u, location.href); return x.origin === location.origin ? x.pathname : null; } catch (e) { return null; } };
      const lathato = (el) => { const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity !== 0; };
      // kepek: az elso kepernyon (es a hajtas alatti negyed kepernyon) belul
      const img = new Set(), terulet = new Map();
      for (const k of document.images) {
        const src = ut(k.currentSrc || k.src);
        if (!src) continue;
        const r = k.getBoundingClientRect();
        if (r.width < 2 || r.height < 2 || r.bottom <= 0 || r.top >= H * 1.25 || r.right <= 0 || r.left >= innerWidth || !lathato(k)) continue;
        img.add(src);
        if (r.top < H) {
          const t = (Math.min(r.bottom, H) - Math.max(r.top, 0)) * (Math.min(r.right, innerWidth) - Math.max(r.left, 0));
          terulet.set(src, Math.max(terulet.get(src) || 0, t));
        }
      }
      // a ket-harom legnagyobb lathato kep kap elsobbseget (koztuk az LCP-elem)
      const kiemelt = [...terulet].filter(([, t]) => t >= 20000).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([s]) => s);
      // betuk: az elso kepernyon lathato szoveg betucsaladja, vastagsaga, stilusa -> @font-face fajl
      const lapok = [];
      for (const ss of document.styleSheets) {
        let sz; try { sz = ss.cssRules; } catch (e) { continue; }
        for (const r of sz) {
          if (!(r instanceof CSSFontFaceRule)) continue;
          const m = /url\(["']?([^"')]+\.woff2)["']?\)/.exec(r.style.getPropertyValue('src'));
          if (!m) continue;
          const tart = (r.style.getPropertyValue('unicode-range') || 'U+0-10FFFF').split(',').map((x) => {
            const [a, b] = x.trim().replace(/^U\+/i, '').split('-');
            const k = parseInt(a.replace(/\?/g, '0'), 16), v = parseInt((b || a).replace(/\?/g, 'F'), 16);
            return [k, v];
          });
          const w = (r.style.getPropertyValue('font-weight') || '400').replace('normal', '400').replace('bold', '700').split(/\s+/).map(Number);
          lapok.push({ csalad: r.style.getPropertyValue('font-family').replace(/["']/g, '').trim().toLowerCase(), w: [w[0], w[w.length - 1]], dolt: /italic|oblique/.test(r.style.getPropertyValue('font-style')), tart, url: ut(new URL(m[1], ss.href || location.href).href) });
        }
      }
      const betu = new Map();
      const bejar = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = bejar.nextNode(); n; n = bejar.nextNode()) {
        const szoveg = n.nodeValue.replace(/\s+/g, '');
        if (!szoveg || !n.parentElement || n.parentElement.closest('script,style,template,noscript')) continue;
        const rr = document.createRange(); rr.selectNodeContents(n);
        const r = rr.getBoundingClientRect();
        if (r.width < 1 || r.bottom <= 0 || r.top >= H || r.right <= 0 || r.left >= innerWidth || !lathato(n.parentElement)) continue;
        const s = getComputedStyle(n.parentElement);
        const suly = +s.fontWeight, dolt = s.fontStyle !== 'normal';
        for (const cs of s.fontFamily.split(',').map((x) => x.replace(/["']/g, '').trim().toLowerCase())) {
          const jelolt = lapok.filter((l) => l.csalad === cs && l.dolt === dolt);
          if (!jelolt.length) continue;
          // a legkozelebbi vastagsag (a bongeszo is igy valaszt), azon belul a szoveg karaktereit lefedo fajlok
          const tav = (l) => (suly < l.w[0] ? l.w[0] - suly : suly > l.w[1] ? suly - l.w[1] : 0);
          const min = Math.min(...jelolt.map(tav));
          for (const l of jelolt.filter((x) => tav(x) === min)) {
            const db = [...szoveg].filter((c) => { const k = c.codePointAt(0); return l.tart.some(([a, b]) => k >= a && k <= b); }).length;
            if (db) betu.set(l.url, (betu.get(l.url) || 0) + db);
          }
          break;
        }
      }
      return { img: [...img].sort(), kiemelt, betu: [...betu].sort((x, y) => y[1] - x[1]).map(([u]) => u) };
    });
  } finally {
    await p.close();
  }
}

const b = await chromium.launch();
const ctxek = {};
for (const [n, opt] of Object.entries(NEZETEK)) {
  ctxek[n] = await b.newContext(opt);
  // csak a sajat fajlok: a kulso szolgaltatasok (meres, beagyazasok) nem kellenek a meres(hez)
  await ctxek[n].route((u) => !u.toString().startsWith(HELYI), (r) => r.abort());
}
const eredmeny = { ...eddigi };
let kesz = 0;
const sor = lapok.flatMap((o) => Object.keys(NEZETEK).map((n) => [o, n]));
await Promise.all(Array.from({ length: PARHUZAM }, async () => {
  for (let x = sor.shift(); x; x = sor.shift()) {
    const [o, n] = x;
    try {
      const m = await meres(ctxek[n], o.ut);
      eredmeny[o.kulcs] = { ...(eredmeny[o.kulcs] || {}), [n]: m };
    } catch (e) {
      console.warn(`  ! ${o.kulcs} (${n}): ${e.message.split('\n')[0]}`);
    }
    if (++kesz % 50 === 0) console.log(`  ${kesz} / ${lapok.length * 2}`);
  }
}));
await b.close();
const rendezett = Object.fromEntries(Object.keys(eredmeny).sort().map((k) => [k, eredmeny[k]]));
fs.writeFileSync(KI, JSON.stringify(rendezett, null, 1) + '\n');
console.log(`tools/hajtas.json: ${Object.keys(rendezett).length} oldal`);
