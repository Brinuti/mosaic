// UJ-51 (Feri 2026-10-24): a szolgaltatas-lista betoltesi hibaja ellen (a Salonic bizonyos kliensekre 302-vel a fooldalra iranyit) - mind az 5 Mosaic-motor bongeszoben, MOCKOLT Salonic-oldalakkal.
//   node tools/netlify-build.mjs ; CHROME_UTVONAL=<chrome> node tools/meres-proba/salonic-ujraproba-proba.mjs [--mobil 1]
// Forgatokonyvek uzletagonkent: (A) az elso lekeres 302 (-> fooldal), a masodik jo: a motor ELSO latszolagos hiba nelkul megnyilik, pontosan 2 belépő-lekeres; (B) minden lekeres 302: hibakepernyo + a belso szamlalo
// `salonic_api.<nezet>.REDIRECT.0` reszlete (a PARSE-tol kulon); (C) a belepo oldal 200, de ures (PARSE): egyszer ujraprobal, utana hibakepernyo `...PARSE.0`. Valodi Salonic / foglalas / kimeno meres NINCS (a szamlalo-POST-ot a proba elfogja).
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { UA, UA_MOBIL, platformOf, engedett, dnsArg, ures } from './tilt.mjs';
import { ervenyesit } from '../../netlify/lib/foglalo-szamlalo.js';
import { fajlUtvonal } from '../serve-dist.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const MOBIL = arg('mobil', '0') === '1', BAZIS = 'https://www.mosaicheadspa.hu', OLDAL = '/paros-headspa-budapest';
const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const here = path.dirname(new URL(import.meta.url).pathname);
const fx = (f) => fs.readFileSync(path.join(here, '..', 'fixtures', 'salonic', f), 'utf8');
const TIPUS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
const ua = MOBIL ? UA_MOBIL : UA;
const HIBA_CIM = 'Most nem sikerült betölteni az időpontokat.';
const FOOLDAL = '<html><body><a href="/">Főoldal</a></body></html>';
const UZLETAGAK = [ // belepo oldal = az az oldal, amelyikbol a motor a szolgaltatas-listat kezdi olvasni
  { uzletag: 'headspa', nyit: { business: 'headspa', service: 'paros' }, host: 'mosaicheadspa.salonic.hu', belepo: /\/selectSpecialization\//, tartalom: () => fx('headspa-selectSpecialization.html') },
  { uzletag: 'hair', host: 'mosaic-hair.salonic.hu', belepo: /\/selectSpecialization\//, tartalom: () => fx('headspa-selectSpecialization.html') },
  { uzletag: 'oxygen', host: 'mosaic-oxigen.salonic.hu', belepo: /\/selectSpecialization\//, tartalom: () => fx('headspa-selectSpecialization.html') },
  { uzletag: 'laser', host: 'mosaic-elysion.salonic.hu', belepo: /\/showServices\//, tartalom: () => fx('hair-showServices.html') },
  { uzletag: 'pmu', host: 'mosaic-pmu.salonic.hu', belepo: /\/employees\/32428\//, tartalom: () => fx('pmu-employees.html') },
];

const eredmeny = [];
const ok = (cimke, rendben, reszlet = '') => { eredmeny.push({ cimke, rendben }); console.log(`${rendben ? 'OK  ' : 'HIBA'} ${cimke}${reszlet ? ' | ' + reszlet : ''}`); };
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--disable-blink-features=AutomationControlled', dnsArg()] });

async function futtat(ub, mod) { // mod: 'rendben' (kontroll) | 'egyszer' | 'mindig' | 'ures'
  const ctx = await browser.newContext({ userAgent: ua, viewport: MOBIL ? { width: 390, height: 844 } : { width: 1280, height: 900 }, locale: 'hu-HU', timezoneId: 'Europe/Budapest', serviceWorkers: 'block', isMobile: MOBIL, hasTouch: MOBIL });
  const st = { belepo: 0, szamlalo: [], kimeno: [] };
  await ctx.route('**/*', async (route) => {
    const req = route.request(), url = req.url(); let u; try { u = new URL(url); } catch (e) { return route.continue(); }
    const CORS = { 'access-control-allow-origin': '*' };
    if (/\.salonic\.hu$/.test(u.hostname) && u.hostname !== 'api.salonic.hu') {
      if (u.hostname !== ub.host) return route.fulfill({ status: 404, headers: CORS, body: 'nincs' });
      if (ub.belepo.test(u.pathname)) {
        st.belepo += 1;
        if (mod === 'mindig' || (mod === 'egyszer' && st.belepo === 1)) return route.fulfill({ status: 302, headers: { ...CORS, location: `https://${ub.host}/` }, body: '' });
        if (mod === 'ures') return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'text/html' }, body: FOOLDAL });
        return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'text/html' }, body: ub.tartalom() });
      }
      if (u.pathname === '/') return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'text/html' }, body: FOOLDAL });
      if (/\/showServices\//.test(u.pathname)) return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'text/html' }, body: fx('hair-showServices.html') });
      if (/\/employees\//.test(u.pathname)) return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'text/html' }, body: fx('pmu-employees.html') });
      return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'text/html' }, body: FOOLDAL });
    }
    if (/api\.salonic\.hu\//.test(url)) return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify({ status: 'success', data: { blocks: {}, placeName: 'Teszt', placeAddress: 'Teszt' } }) });
    if (/\/api\/foglalo-szamlalo$/.test(u.pathname)) { st.szamlalo.push(req.postData() || ''); return route.fulfill({ status: 204 }); }
    if (u.origin === BAZIS && req.method() === 'GET') {
      const e = fajlUtvonal(decodeURIComponent(u.pathname), req.headers()['user-agent'] || ua);
      if (e.atiranyit) return route.fulfill({ status: 301, headers: { location: encodeURI(e.atiranyit) + u.search } });
      if (fs.existsSync(e.fajl) && fs.statSync(e.fajl).isFile()) {
        let body = fs.readFileSync(e.fajl);
        if (body.length < 80 && /^[\w./-]+\.html$/.test(body.toString('utf8').trim())) { const cel = path.join(path.dirname(e.fajl), body.toString('utf8').trim()); if (fs.existsSync(cel)) body = fs.readFileSync(cel); }
        return route.fulfill({ status: 200, headers: { 'content-type': TIPUS[path.extname(e.fajl)] || 'application/octet-stream', 'cache-control': 'no-store' }, body });
      }
    }
    const plat = platformOf(url) || (engedett(url, req.method()) || u.origin === BAZIS ? null : 'tiltott');
    if (plat) { st.kimeno.push(plat); return route.fulfill(ures(req)); }
    return route.continue();
  });
  const page = await ctx.newPage();
  const hibak = []; page.on('pageerror', (e) => hibak.push(String(e.message).slice(0, 160)));
  await page.addInitScript(() => { window.__MH_SZAMLALO_PROBA = true; try { localStorage.setItem('mh_cc', JSON.stringify({ v: 1, t: Date.now(), fun: false, ana: false, adv: false })); } catch (e) { /* nem baj */ } });
  await page.goto(BAZIS + OLDAL + '?atadas=0', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openBooking === 'function' && !!window.mhSuti, null, { timeout: 15000 });
  await page.waitForTimeout(3500); // a lap sajat betoltesi merese lecsendesedik
  st.kimeno.length = 0;
  st.belepo = 0; st.szamlalo.length = 0; // csak a foglalo megnyitasa utani lekeresek / beaconok szamitanak
  // (1) maga az adapter a valodi bongeszoben (fetch + CORS-os 302 kovetes: r.redirected / r.url), ugyanazzal a mockolt Salonic-gal
  st.belepo = 0;
  const ad = await page.evaluate(async ([b]) => {
    const { createSalonicAdapter } = await import('/assets/js/booking-engine/salonic-adapter.js');
    const a = createSalonicAdapter({ parseRetryMs: 50, storage: null });
    try { const l = await a.getServices(b); return { ok: true, n: l.length }; } catch (e) { return { ok: false, code: e && e.code }; }
  }, [ub.uzletag]);
  st.adapter = ad; st.adapterBelepo = st.belepo;
  st.belepo = 0; st.szamlalo.length = 0; st.kimeno.length = 0; // a foglalo (engine) sajat lekeresei kulon szamolnak
  // (2) a teljes foglalo (engine)
  await page.evaluate((o) => window.openBooking(o), ub.nyit || { business: ub.uzletag });
  const cim = page.locator('#mosaic-booking-layer .be-title').first();
  let szoveg = null;
  try {
    await cim.waitFor({ timeout: 20000 });
    szoveg = ((await cim.textContent()) || '').trim();
  } catch (e) { szoveg = null; }
  await page.waitForTimeout(2500);
  try { szoveg = ((await cim.textContent({ timeout: 2000 })) || '').trim(); } catch (e) { /* marad */ }
  const sz = st.szamlalo.map((s) => { try { return JSON.parse(s); } catch (e) { return { hibas: s }; } });
  if (process.env.DEBUG_PROBA) console.log('DEBUG', ub.uzletag, mod, JSON.stringify((await page.evaluate(() => (document.getElementById('mosaic-booking-layer') || {}).innerText || 'nincs reteg')).slice(0, 300)), JSON.stringify(sz.slice(0, 6)));
  await ctx.close();
  return { st, szoveg, sz, hibak, adapter: st.adapter, adapterBelepo: st.adapterBelepo };
}

const VAR = { // adapter-szintu elvaras (valodi bongeszo): [mod] -> { ok, kod, belepo }; a laser 2 kategoria-oldalt kerdez PARHUZAMOSAN (specIds), ezert ott a szamok mas alakuak
  headspa: { rendben: { ok: true, belepo: 1 }, egyszer: { ok: true, belepo: 2 }, mindig: { ok: false, code: 'REDIRECT', belepo: 2 }, ures: { ok: false, code: 'PARSE', belepo: 2 } },
  hair: { rendben: { ok: true, belepo: 1 }, egyszer: { ok: true, belepo: 2 }, mindig: { ok: false, code: 'REDIRECT', belepo: 2 }, ures: { ok: false, code: 'PARSE', belepo: 2 } },
  oxygen: { rendben: { ok: true, belepo: 1 }, egyszer: { ok: true, belepo: 2 }, mindig: { ok: false, code: 'REDIRECT', belepo: 2 }, ures: { ok: false, code: 'PARSE', belepo: 2 } },
  laser: { rendben: { ok: true, belepo: 2 }, egyszer: { ok: true, belepo: 2 }, mindig: { ok: false, code: 'REDIRECT', belepo: 4 }, ures: { ok: false, code: 'EMPTY', belepo: 4 } }, // egyszer: csak az elso kategoria-oldal 302, a masodik szolgaltatast ad: nincs hiba, nincs ujraproba
  pmu: { rendben: { ok: true, belepo: 1 }, egyszer: { ok: true, belepo: 2 }, mindig: { ok: false, code: 'REDIRECT', belepo: 2 }, ures: { ok: false, code: 'PARSE', belepo: 2 } },
};
for (const ub of UZLETAGAK) {
  const K = await futtat(ub, 'rendben');
  const kontrollHiba = K.sz.filter((x) => /error/.test(x.lepes)).map((x) => x.tipus || x.lepes);
  ok(`${ub.uzletag} (kontroll) egeszseges Salonic: az adapter hiba nelkul olvas, a foglalo megnyilik`, K.adapter.ok === K.adapter.ok && K.adapter.ok === VAR[ub.uzletag].rendben.ok && K.adapterBelepo === VAR[ub.uzletag].rendben.belepo && (K.szoveg !== null || ub.uzletag === 'pmu') && K.hibak.length === 0, JSON.stringify({ adapter: K.adapter, belepo: K.adapterBelepo, cim: K.szoveg, hiba: K.hibak }));
  for (const mod of ['egyszer', 'mindig', 'ures']) {
    const R = await futtat(ub, mod); const v = VAR[ub.uzletag][mod];
    const ad = R.adapter.ok === v.ok && (v.ok || R.adapter.code === v.code) && R.adapterBelepo === v.belepo;
    ok(`${ub.uzletag} (${mod}) adapter a bongeszoben: ${v.ok ? 'sikeres' : 'hiba ' + v.code}, ${v.belepo} belepo-lekeres`, ad, JSON.stringify({ adapter: R.adapter, belepo: R.adapterBelepo }));
    const reszlet = R.sz.filter((x) => x.lepes === 'error_reszlet').map((x) => x.tipus);
    const zartOk = R.sz.filter((x) => x.lepes === 'error_reszlet').every((x) => ervenyesit(JSON.stringify(x)).ok);
    if (mod === 'egyszer') {
      ok(`${ub.uzletag} (egyszer) a foglalo ugyanazt mutatja, mint az egeszseges Salonic (cim + hibabeaconok azonosak)`, R.szoveg === K.szoveg && JSON.stringify(R.sz.filter((x) => /error/.test(x.lepes)).map((x) => x.tipus || x.lepes)) === JSON.stringify(kontrollHiba), JSON.stringify({ cim: R.szoveg, kontroll: K.szoveg, hiba: reszlet }));
    } else {
      const ujHiba = reszlet.filter((t) => !kontrollHiba.includes(t));
      const kod = mod === 'mindig' ? 'REDIRECT' : ub.uzletag === 'laser' ? 'EMPTY' : 'PARSE';
      ok(`${ub.uzletag} (${mod}) a foglalo: ha hibat jelez, a belso szamlalo kodja ${kod} (nem a masik), a szerver elfogadja`, ujHiba.every((t) => new RegExp(`^salonic_api\\.[A-Z][A-Z0-9_]{0,11}\\.${kod}\\.0$`).test(t)) && zartOk, JSON.stringify({ cim: R.szoveg, beacon: reszlet }));
    }
    const tiltott = R.st.kimeno.filter((x) => x !== 'ga4' && x !== 'stape'); // a lap SAJAT idozitett GA4 / Stape jelzese (page_view, user_engagement) nem a foglalotol jon; konverzios platform (Meta, TikTok, Google Ads, Zapier) / ismeretlen host nem lehet
    ok(`${ub.uzletag} (${mod}) nincs JS-hiba, a foglalo nem indit konverzios / ismeretlen kimeno meres`, R.hibak.length === 0 && tiltott.length === 0, JSON.stringify({ hibak: R.hibak, kimeno: [...new Set(R.st.kimeno)] }));
  }
}
await browser.close();
const hibas = eredmeny.filter((x) => !x.rendben);
console.log(`\n${MOBIL ? 'MOBIL' : 'ASZTALI'}: ${eredmeny.length} ellenorzes, ${hibas.length} hiba`);
process.exit(hibas.length ? 1 : 0);
