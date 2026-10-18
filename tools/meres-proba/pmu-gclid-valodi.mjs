// R3 (DECISION #196 / 1.): a beagyazott PMU-foglalo SIKER UTANI top-navigacioja (foglalo-pmu.js mhKeretbenOldal) hordozza-e a Google-azonositokat - a VALODI fuggvenyt hivva a
// valodi keretben (a gclid-atadas-proba.mjs PMU-szakasza csak szimulalja az URL-t, ezt nem futtatja). FOGLALAST NEM ADUNK LE, kimeno meres / minden POST tiltva (tilt.mjs).
//
//   node tools/meres-proba/pmu-gclid-valodi.mjs --dist <abszolut dist-mappa> [--landing /sminktetovalas-budapest] [--out naplo.json]
//   export CHROME_UTVONAL=/opt/pw-browsers/chromium-1194/chrome-linux/chrome PLAYWRIGHT_UTVONAL=<node_modules mappa>
//
// Esetek (mind a landingen, a keretbol hivva a mhKeretbenOldal-t egy szimulalt /pmu-ok visszairanyitassal); A = a landing URL-jenek azonositoi, B = a mar tarolt mh_attr, C = a Google-cimke sutijei (_gcl_aw / _gcl_gb):
//   url              nincs dontes (a #170 alapertek: granted), A az URL-ben                                 -> a /pmu-ok URL-je hordozza az A-t
//   mentett          nincs dontes, a landing masodik betoltese azonosito NELKUL (mh_attr marad)             -> hordozza az A-t (mentett allapot)
//   tarolt-adv       adv:true, B tarolva + C sutik, azonosito nelkuli landing                                -> a B-t (a mh_attr az elsobbseg), wbraid is
//   kontroll-adv     adv:true, B + C + A az URL-ben                                                          -> az A-t (az aktualis URL az elsobbseg)
//   elutasit-url     adv:false (kifejezett elutasitas), A az URL-ben                                         -> NEM hordoz (a landing URL-je sem)
//   elutasit-tarolt  adv:false, B tarolva + C sutik, azonosito nelkuli landing                              -> NEM hordoz
//   elutasit-mind    adv:false, B + C + A egyszerre                                                         -> NEM hordoz
// Kimenet: JSON + soronkent OK / HIBA; kilepesi kod 1, ha az elvart (a --elvart be|ki: javitas utan "be", a regi / main kodon "ki": ott egyik eset sem hordoz semmit) nem teljesul.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { UA, platformOf, engedett, dnsArg, ures, esemenyIras, esemenyUres } from './tilt.mjs';
import { utvonal } from '../../netlify/lib/utvonal.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const BAZIS = 'https://www.mosaicheadspa.hu', DIST = path.resolve(arg('dist', 'dist')), LANDING = arg('landing', '/sminktetovalas-budapest'), OUT = arg('out', ''), ELVART = arg('elvart', 'be');
const CHROME = process.env.CHROME_UTVONAL || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TIPUS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain' };
const ber = Date.now().toString(36).toUpperCase();
const A = { gclid: `TESZTGCLIDPMUREAL${ber}`, gbraid: `TESZTGBRAIDPMUREAL${ber}`, wbraid: `TESZTWBRAIDPMUREAL${ber}` };
const B = { gclid: `TESZTGCLIDTAROLT${ber}`, gbraid: `TESZTGBRAIDTAROLT${ber}`, wbraid: `TESZTWBRAIDTAROLT${ber}` };
const C = { gclid: `TESZTGCLIDSUTI${ber}`, gbraid: `TESZTGBRAIDSUTI${ber}` };
const KLIKK = `gclid=${A.gclid}&gbraid=${A.gbraid}&wbraid=${A.wbraid}&utm_source=google&utm_medium=cpc&utm_campaign=r1r3-proba`;
const CEL = `${BAZIS}/pmu-ok?first_booking=true&service=Szajtetovalas&category=PMU&price=99000&g=g:SZIM1&bookingUrl=${encodeURIComponent('https://mosaic-pmu.salonic.hu/guestData/?anyone=true&back=mb_gclidproba0000')}`;

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--disable-blink-features=AutomationControlled', dnsArg()] });
const sorok = [];
async function kontextus({ mhcc = null, tarolt = false, suti = false } = {}) {
  const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 900 }, locale: 'hu-HU', timezoneId: 'Europe/Budapest', serviceWorkers: 'block' });
  // a hozzajarulas-dontes / a mar tarolt mh_attr az oldal scriptjei ELOTT kerul a tarolora (csak az eles hostnevre, csak ha meg nincs)
  await ctx.addInitScript(({ mhcc, tarolt, B }) => {
    try {
      if (!/(^|\.)mosaicheadspa\.hu$/.test(location.hostname)) return;
      if (mhcc && !localStorage.getItem('mh_cc')) localStorage.setItem('mh_cc', JSON.stringify({ v: 1, t: Date.now(), fun: true, ana: true, adv: mhcc === 'adv-true' }));
      if (tarolt && !localStorage.getItem('mh_attr')) { const ts = Math.floor(Date.now() / 1000) - 1000; localStorage.setItem('mh_attr', JSON.stringify({ v: 1, google: { gclid: { ertek: B.gclid, ts }, gbraid: { ertek: B.gbraid, ts }, wbraid: { ertek: B.wbraid, ts } } })); }
    } catch (e) { /* nem baj */ }
  }, { mhcc, tarolt, B });
  if (suti) await ctx.addCookies([{ name: '_gcl_aw', value: `GCL.1759759200.${C.gclid}`, domain: 'www.mosaicheadspa.hu', path: '/', secure: true }, { name: '_gcl_gb', value: `GCL.1759759200.${C.gbraid}`, domain: 'www.mosaicheadspa.hu', path: '/', secure: true }]);
  const tiltott = [];
  await ctx.route('**/*', async (route) => {
    const req = route.request(), url = req.url(); let u; try { u = new URL(url); } catch (e) { return route.continue(); }
    if (u.origin === BAZIS && req.method() === 'GET') {
      const d = utvonal(decodeURIComponent(u.pathname), req.headers()['user-agent'] || UA);
      if (d && d.atiranyit) return route.fulfill({ status: 301, headers: { location: encodeURI(d.atiranyit) + u.search } });
      let f = d ? d.atir : decodeURIComponent(u.pathname); if (!path.extname(f)) f += '.html'; const fajl = path.join(DIST, f);
      if (fs.existsSync(fajl) && fs.statSync(fajl).isFile()) {
        let body = fs.readFileSync(fajl);
        if (body.length < 80 && /^[\w./-]+\.html$/.test(body.toString('utf8').trim())) { const c = path.join(path.dirname(fajl), body.toString('utf8').trim()); if (fs.existsSync(c)) body = fs.readFileSync(c); }
        return route.fulfill({ status: 200, headers: { 'content-type': TIPUS[path.extname(fajl)] || 'application/octet-stream', 'cache-control': 'no-store' }, body });
      }
    }
    if (esemenyIras(url, req.method())) return route.fulfill(esemenyUres());
    const plat = platformOf(url) || (engedett(url, req.method()) ? null : (u.origin === BAZIS && req.method() === 'GET' ? null : 'tiltott'));
    if (plat) { tiltott.push({ plat, metodus: req.method(), host: u.host }); return route.fulfill(ures(req)); }
    return route.continue();
  });
  const page = await ctx.newPage();
  return { ctx, page, tiltott };
}
// a landing foglalo-kerete csak egy [data-foglalo] gomb kattintasara kap src-t (pmu-landing.js): ugyanazt tesszuk, mint a vendeg
async function keretNyit(page) {
  const g = page.locator('[data-foglalo]').first();
  await g.evaluate((e) => e.scrollIntoView({ block: 'center' }));
  await g.click({ timeout: 15000 });
  await page.waitForFunction(() => { const f = [...document.querySelectorAll('iframe')].find((x) => /foglalo-pmu/.test(x.getAttribute('src') || x.src || '')); return !!(f && f.contentWindow && typeof f.contentWindow.mhKeretbenOldal === 'function'); }, null, { timeout: 30000 });
}
const keretbolHiv = (page) => page.evaluate((cel) => {
  const f = [...document.querySelectorAll('iframe')].find((x) => /foglalo-pmu/.test(x.getAttribute('src') || x.src || ''));
  if (!f || !f.contentWindow || typeof f.contentWindow.mhKeretbenOldal !== 'function') return 'nincs-mhKeretbenOldal';
  f.contentWindow.mhKeretbenOldal(cel); return 'meghivva';
}, CEL);
const azon = (url) => { const q = new URL(url).searchParams; return Object.fromEntries(['gclid', 'gbraid', 'wbraid'].map((k) => [k, q.get(k)])); };
const jegyez = (eset, allapot, cimke, bizonyitek) => { sorok.push({ eset, allapot, cimke, bizonyitek }); console.log(`${allapot.padEnd(5)}[${eset}] ${cimke} | ${bizonyitek}`); };

async function eset(nev, { mhcc = null, tarolt = false, suti = false, urlAzon = true, masodik = false, be = null }) {
  const k = await kontextus({ mhcc, tarolt, suti });
  try {
    await k.page.goto(BAZIS + LANDING + (urlAzon ? '?' + KLIKK : ''), { waitUntil: 'domcontentloaded' });
    await k.page.waitForTimeout(3500);
    if (masodik) { await k.page.goto(BAZIS + LANDING, { waitUntil: 'domcontentloaded' }); await k.page.waitForTimeout(3500); }
    await keretNyit(k.page);
    const h = await keretbolHiv(k.page);
    if (h !== 'meghivva') { jegyez(nev, 'HIBA', 'a keret mhKeretbenOldal fuggvenye elerheto', h); await k.ctx.close(); return; }
    await k.page.waitForURL(/\/pmu-ok/, { timeout: 20000 }).catch(() => {});
    const url = k.page.url(), a = azon(url);
    const vart = ELVART === 'be' ? be : null; // null = nem hordoz semmit (a main-en egyik eset sem hordoz)
    const ok = vart ? ['gclid', 'gbraid', 'wbraid'].every((x) => a[x] === vart[x]) : ['gclid', 'gbraid', 'wbraid'].every((x) => !a[x]);
    const szivarog = [A, B, C].some((m) => ['gclid', 'gbraid', 'wbraid'].some((x) => a[x] && a[x] === m[x]));
    jegyez(nev, ok ? 'OK' : 'HIBA', vart ? 'a /pmu-ok URL-je a varhato gclid + gbraid + wbraid-et hordozza' : 'a /pmu-ok URL-je NEM hordoz gclid / gbraid / wbraid-et', `${url.replace(BAZIS, '').slice(0, 100)} | gclid=${a.gclid ? 'van' : 'nincs'} gbraid=${a.gbraid ? 'van' : 'nincs'} wbraid=${a.wbraid ? 'van' : 'nincs'}${vart ? '' : (szivarog ? ' | SZIVARGAS' : '')} | mh_proba=${new URL(url).searchParams.get('mh_proba')} | tiltott kimeno kerelem: ${k.tiltott.length}`);
  } catch (e) { jegyez(nev, 'HIBA', 'az eset futasa', String(e.message).slice(0, 200)); }
  await k.ctx.close();
}
await eset('url', { be: A });
await eset('mentett', { masodik: true, be: A });
await eset('tarolt-adv', { mhcc: 'adv-true', tarolt: true, suti: true, urlAzon: false, be: { gclid: B.gclid, gbraid: B.gbraid, wbraid: B.wbraid } });
await eset('kontroll-adv', { mhcc: 'adv-true', tarolt: true, suti: true, be: A });
await eset('elutasit-url', { mhcc: 'adv-false' });
await eset('elutasit-tarolt', { mhcc: 'adv-false', tarolt: true, suti: true, urlAzon: false });
await eset('elutasit-mind', { mhcc: 'adv-false', tarolt: true, suti: true });
await browser.close();
const hiba = sorok.filter((s) => s.allapot === 'HIBA').length;
console.log(`\nOSSZESEN: OK ${sorok.length - hiba} | HIBA ${hiba} (elvart: ${ELVART})`);
if (OUT) fs.writeFileSync(OUT, JSON.stringify({ futtatva: new Date().toISOString(), dist: DIST, elvart: ELVART, sorok }, null, 1));
process.exit(hiba ? 1 : 0);
