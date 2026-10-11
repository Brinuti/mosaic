// Sebessegmeres: oldalanként a betoltes fobb mutatoi asztali es mobil nezetben.
//
//   node tools/sebesseg.mjs                      (helyi kiszolgalo, http://localhost:4290)
//   CIM=https://www.medicalpiercing.hu node tools/sebesseg.mjs / /migren-piercing
//
// Mutatok: TTFB, FCP, LCP (es az LCP-elem), CLS (es a legnagyobb elmozdulast okozo elemek),
// a betoltes vege, a keresek szama es merete tipusonkent (sajat / kulso), a hosszu JS-feladatok
// osszideje (TBT-kozelites). Az eles cimen a merokodok betoltodnek, de minden adatkuldo kerest
// elkapunk es eldobunk (mint a tools/meres-teszt.mjs): a meres nem kuld adatot sehova.
// Mobilon 4x-es CPU-lassitas es lassu 4G (mint a Lighthouse mobil profilja).
import { chromium, devices } from './pw.mjs';

const CIM = (process.env.CIM || 'http://localhost:4290').replace(/\/+$/, '');
const utak = process.argv.slice(2).length ? process.argv.slice(2) : ['/', '/kozerzetjavito-piercing-soft-akcio', '/migren-piercing', '/idopontfoglalas'];
const SZABAD = /^https:\/\/(www\.googletagmanager\.com\/(gtm|gtag\/js)|connect\.facebook\.net\/(en_US\/fbevents\.js|signals\/config\/)|analytics\.tiktok\.com\/i18n\/pixel\/)/;
const sajat = (u) => u.startsWith(CIM);
const NEZETEK = [
  ['asztali', { viewport: { width: 1440, height: 900 } }, null],
  ['mobil', { ...devices['Pixel 5'] }, { cpu: 4, le: 1.6e6 / 8, fel: 750e3 / 8, kesl: 150 }],
];

const b = await chromium.launch();
for (const ut of utak) {
  for (const [nezet, opt, lassit] of NEZETEK) {
    const ctx = await b.newContext({ ...opt, userAgent: nezet === 'asztali' ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' : opt.userAgent });
    const keresek = [];
    await ctx.route((u) => !sajat(u.toString()), (r) => {
      const u = r.request().url();
      // eles cimen: a kulso szkriptek, kepek, betuk johetnek, az adatkuldes nem
      if (r.request().method() !== 'GET' || /\/(collect|tr|pixel|track|log|events?|beacon|monitor|g\/collect)\b|[?&](tid|ev|en)=/.test(u) && !SZABAD.test(u)) return r.abort();
      return r.continue();
    });
    const p = await ctx.newPage();
    p.on('requestfinished', async (rq) => {
      const s = await rq.sizes().catch(() => null);
      keresek.push({ u: rq.url(), t: rq.resourceType(), b: s ? s.responseBodySize + s.responseHeadersSize : 0 });
    });
    if (lassit) {
      const cdp = await ctx.newCDPSession(p);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: lassit.cpu });
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: lassit.kesl, downloadThroughput: lassit.le, uploadThroughput: lassit.fel });
    }
    await p.addInitScript(() => {
      window.__m = { lcp: 0, lcpEl: '', cls: 0, elm: [], tbt: 0 };
      const leir = (n) => { if (!n || !n.tagName) return '?'; const c = (n.id ? '#' + n.id : '') + (n.className && typeof n.className === 'string' ? '.' + n.className.trim().split(/\s+/).slice(0, 2).join('.') : ''); return n.tagName.toLowerCase() + c; };
      new PerformanceObserver((l) => { for (const e of l.getEntries()) { window.__m.lcp = e.startTime; window.__m.lcpEl = leir(e.element) + (e.url ? ' ' + e.url.split('/').pop().slice(0, 40) : ''); } }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) { if (e.hadRecentInput) continue; window.__m.cls += e.value; for (const s of e.sources || []) window.__m.elm.push([e.value, leir(s.node)]); } }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__m.tbt += Math.max(0, e.duration - 50); }).observe({ type: 'longtask', buffered: true });
    });
    const t0 = Date.now();
    await p.goto(CIM + ut, { waitUntil: 'load', timeout: 120000 });
    const betoltes = Date.now() - t0;
    await p.waitForTimeout(lassit ? 6000 : 3000);
    const m = await p.evaluate(() => {
      const n = performance.getEntriesByType('navigation')[0];
      const fcp = (performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime || 0;
      return { ttfb: n.responseStart, fcp, html: n.transferSize, dom: n.domContentLoadedEventEnd, ...window.__m };
    });
    const tip = {};
    for (const k of keresek) { const kulcs = (sajat(k.u) ? '' : 'kulso ') + k.t; tip[kulcs] = tip[kulcs] || [0, 0]; tip[kulcs][0]++; tip[kulcs][1] += k.b; }
    const ossz = keresek.reduce((a, k) => a + k.b, 0);
    const elm = Object.entries(m.elm.reduce((a, [v, e]) => { a[e] = (a[e] || 0) + v; return a; }, {})).sort((a, c) => c[1] - a[1]).slice(0, 4);
    console.log(`\n== ${nezet} ${ut}  TTFB ${m.ttfb | 0} ms | FCP ${m.fcp | 0} | LCP ${m.lcp | 0} (${m.lcpEl}) | DCL ${m.dom | 0} | load ${betoltes} ms | CLS ${m.cls.toFixed(3)} | TBT ${m.tbt | 0} ms`);
    console.log(`   ${keresek.length} keres, ${(ossz / 1024).toFixed(0)} kB (HTML ${(m.html / 1024).toFixed(0)} kB): ` + Object.entries(tip).sort((a, c) => c[1][1] - a[1][1]).map(([k, [db, bt]]) => `${k} ${db}/${(bt / 1024).toFixed(0)}kB`).join(', '));
    if (elm.length) console.log('   elmozdulas: ' + elm.map(([e, v]) => `${e} ${v.toFixed(3)}`).join(' | '));
    await ctx.close();
  }
}
await b.close();
