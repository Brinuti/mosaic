// Kuponkod a linkbol (?kupon=NYAR20 / openBooking({kupon})) bongeszoben: a kod a Salonic adatlap keretenek NEVEBEN (iframe name="mhk:...") jut el az adatlapra,
// ahol a GTM-ben futo kis szkript (docs/booking-engine/gtm-kupon-kitolto.html - ugyanazt a szkriptet toltjuk be itt) beirja a kupon mezobe.
//
//   node tools/meres-proba/kupon-proba.mjs [--overlay dist] [--bazis https://...] [--mobil 1] [--oldal /booking-test]
//
// A Salonic JELENLEGI (valodi, csak olvasott) naptaradataival; az adatlapot (guestData) a proba elfogja es egy szimulalt oldallal helyettesiti (kupon mezo + jQuery-elemzes +
// a GTM-szkript), foglalas nincs. Kimeno meres (GA4, Meta, TikTok, Ads, Stape, Zapier) tiltva (tilt.mjs); a kod semelyik kimeno keresben nem szerepelhet.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { UA, UA_MOBIL, platformOf, engedett, dnsArg, ures } from './tilt.mjs';
import { createSalonicAdapter } from '../../assets/js/booking-engine/salonic-adapter.js';
import { staffCoverServices } from '../../assets/js/booking-engine/flow.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const OVERLAY = arg('overlay', ''), MOBIL = arg('mobil', '0') === '1', OLDAL = arg('oldal', '/booking-test'), BAZIS = arg('bazis', 'https://www.mosaicheadspa.hu');
const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let fajlUtvonal = null;
if (OVERLAY) ({ fajlUtvonal } = await import('../serve-dist.mjs'));
const TIPUS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
const KOD = 'NYAR20';
const eredmeny = [];
const ok = (cimke, rendben, reszlet = '') => { eredmeny.push({ cimke, rendben }); console.log(`${rendben ? 'OK  ' : 'HIBA'} ${cimke}${reszlet ? ' | ' + reszlet : ''}`); };

// a GTM-cimke szkriptje (az igazi forras: docs/booking-engine/gtm-kupon-kitolto.html)
const CIMKE = /<script>([\s\S]*?)<\/script>/.exec(fs.readFileSync(new URL('../../docs/booking-engine/gtm-kupon-kitolto.html', import.meta.url), 'utf8'))[1];
// a szimulalt Salonic adatlap: kupon mezo (+ elozetes ertek), jQuery-helyettes (a Salonic a keyup-ra ellenoriz), opcionalisan a GTM-cimke
const ADATLAP = ({ cimke = true, elotte = '' } = {}) => `<!doctype html><title>proba</title><input id="GuestDataForm_couponCode" value="${elotte}"><script>window.__keyup=0;window.jQuery=function(el){return{trigger:function(ev){if(ev==='keyup')window.__keyup++;el.dispatchEvent(new Event(ev));}};};</script>${cimke ? '<script>' + CIMKE + '</script>' : ''}`;

// --- a Salonic jelenlegi adatai (olvasas): egy fodraszat-szolgaltatas es annak egy munkatarsa (a naptar rogton megnyilik) ---------------------------------------------------
const adapter = createSalonicAdapter({ fetchImpl: (u, o) => fetch(u, o) });
const services = (await adapter.getServices('hair')).filter((s) => s.bookingType !== 'voucher_redemption' && !/ajándékkártya|ajandekkartya|kupon/i.test(s.name));
let SVC = null, STAFF = null;
for (const s of staffCoverServices(services)) { const st = (await adapter.getStaff('hair', s.serviceId, { days: 60 }))[0]; if (st && s.durationMin && s.bookingType !== 'consultation') { SVC = s; STAFF = st; break; } }
if (!SVC) { console.log('HIBA nincs foglalhato fodraszat-szolgaltatas a Salonicban'); process.exit(1); }
const OPT = { business: 'hair', service: SVC.serviceId, staff: STAFF.staff_id };

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--disable-blink-features=AutomationControlled', dnsArg()] });
async function ujLap(valtozat = {}, url = OLDAL) {
  const ctx = await browser.newContext({ userAgent: MOBIL ? UA_MOBIL : UA, viewport: MOBIL ? { width: 390, height: 844 } : { width: 1280, height: 900 }, locale: 'hu-HU', timezoneId: 'Europe/Budapest', serviceWorkers: 'block', isMobile: MOBIL, hasTouch: MOBIL, permissions: ['clipboard-read', 'clipboard-write'] });
  const naplo = { guest: [], kereses: [], mer: 0 };
  await ctx.route('**/*', async (route) => {
    const req = route.request(), u0 = req.url(); let u; try { u = new URL(u0); } catch (e) { return route.continue(); }
    naplo.kereses.push({ url: u0, post: req.postData() || '', ref: req.headers().referer || '' });
    if (/salonic\.hu$/.test(u.hostname) && /\/guestData\//.test(u.pathname)) { naplo.guest.push(Object.fromEntries(u.searchParams)); return route.fulfill({ status: 200, headers: { 'content-type': 'text/html' }, body: ADATLAP(valtozat) }); }
    if (/\/api\/foglalo-szamlalo$/.test(u.pathname)) return route.fulfill({ status: 204 });
    if (/\/api\/foglalas-esemeny(\?|$)/.test(u.pathname + u.search)) return route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: req.method() === 'GET' ? '{"kor_ms":null}' : '{"irva":false,"ok":"proba"}' });
    if (OVERLAY && u.origin === BAZIS && req.method() === 'GET') {
      const e = fajlUtvonal(decodeURIComponent(u.pathname), req.headers()['user-agent'] || UA);
      if (e.atiranyit) return route.fulfill({ status: 301, headers: { location: encodeURI(e.atiranyit) + u.search } });
      if (fs.existsSync(e.fajl) && fs.statSync(e.fajl).isFile()) {
        let body = fs.readFileSync(e.fajl);
        if (body.length < 80 && /^[\w./-]+\.html$/.test(body.toString('utf8').trim())) { const cel = path.join(path.dirname(e.fajl), body.toString('utf8').trim()); if (fs.existsSync(cel)) body = fs.readFileSync(cel); }
        return route.fulfill({ status: 200, headers: { 'content-type': TIPUS[path.extname(e.fajl)] || 'application/octet-stream', 'cache-control': 'no-store' }, body });
      }
    }
    const plat = platformOf(u0) || (engedett(u0, req.method()) || u.origin === BAZIS ? null : 'tiltott');
    if (plat) { naplo.mer++; return route.fulfill(ures(req)); }
    return route.continue();
  });
  const page = await ctx.newPage();
  const hibak = []; page.on('pageerror', (e) => hibak.push(String(e.message).slice(0, 160)));
  await page.goto(BAZIS + url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openBooking === 'function', null, { timeout: 15000 });
  return { ctx, page, naplo, hibak };
}
const L = (p) => p.locator('#mosaic-booking-layer');
const adatlapig = async (u, opt = OPT) => { // megnyitja a foglalot, kivalaszt egy idopontot -> a keret (adatlap) megjelenik
  await u.page.evaluate((o) => window.openBooking(o), opt);
  await L(u.page).locator('.be-nnap.szabad').first().waitFor({ timeout: 40000 });
  await L(u.page).locator('.be-idogomb').first().click();
  await u.page.waitForFunction(() => !!document.querySelector('#mosaic-booking-layer')?.shadowRoot?.querySelector('iframe.be-iframe'), null, { timeout: 25000 });
  await u.page.waitForTimeout(1200);
  const frame = u.page.frames().find((f) => /\/guestData\//.test(f.url()));
  return { frame };
};
const sor = async (u) => ({ szoveg: ((await L(u.page).locator('.be-kupon').first().textContent({ timeout: 800 }).catch(() => '')) || '').replace(/\s+/g, ' ').trim(), gomb: await L(u.page).locator('.be-kupon .be-link').first().isVisible({ timeout: 300 }).catch(() => false), db: await L(u.page).locator('.be-kupon').count() });
const adatlapAllapot = (frame) => frame.evaluate(() => ({ nev: window.name, mezo: document.getElementById('GuestDataForm_couponCode').value, keyup: window.__keyup }));
const frameNev = (u) => u.page.evaluate(() => document.querySelector('#mosaic-booking-layer')?.shadowRoot?.querySelector('iframe.be-iframe')?.getAttribute('name') || '');

// --- 1) a CTA-bol (openBooking({kupon})): a keret neve, a mezo kitoltve, a keyup lefutott, visszajelzes -------------------------------------------------------------------
{
  const u = await ujLap();
  const { frame } = await adatlapig(u, { ...OPT, kupon: KOD });
  ok('CTA (openBooking kupon): a keret neve a kod (mhk:KOD)', (await frameNev(u)) === 'mhk:' + KOD, await frameNev(u));
  const a = await adatlapAllapot(frame);
  ok('CTA: a Salonic kupon mezobe beirodott a kod', a.mezo === KOD, JSON.stringify(a));
  ok('CTA: a Salonic sajat ellenorzese (keyup) lefutott', a.keyup === 1, String(a.keyup));
  ok('CTA: a kod nem marad a keret nevében (window.name torolve)', a.nev === '', JSON.stringify(a.nev));
  const s = await sor(u);
  ok('CTA: a foglalo kiirja, hogy beirta (nincs "Masolas" gomb)', s.db === 1 && /beírtuk az űrlapba/.test(s.szoveg) && !s.gomb, s.szoveg + (s.gomb ? ' [gomb]' : ''));
  ok('CTA: a Salonic-cim (iframe src) NEM tartalmazza a kodot', u.naplo.guest.length > 0 && JSON.stringify(u.naplo.guest).indexOf(KOD) < 0, JSON.stringify(u.naplo.guest.at(-1) || {}).slice(0, 140));
  const szivarog = u.naplo.kereses.filter((k) => k.url.includes(KOD) || k.post.includes(KOD) || k.ref.includes(KOD));
  ok('CTA: a kod sehol nincs a kimeno keresekben (URL, torzs, referrer)', szivarog.length === 0, szivarog.map((k) => k.url.slice(0, 80)).join(' | '));
  const dl = await u.page.evaluate(() => JSON.stringify(window.dataLayer || []));
  const tar = await u.page.evaluate(() => { try { return JSON.stringify(localStorage); } catch (e) { return ''; } });
  ok('CTA: a kod nincs a dataLayerben, sem a localStorage-ben', dl.indexOf(KOD) < 0 && tar.indexOf(KOD) < 0, dl.slice(0, 80));
  ok('CTA: a kod nincs az oldal cimeben (nincs URL-allapot)', !(await u.page.evaluate(() => location.href)).includes(KOD), '');
  ok('CTA: nincs JS-hiba, nincs kimeno meres', u.hibak.length === 0 && u.naplo.mer === 0, u.hibak.join(' | ') + (u.naplo.mer ? ' mer=' + u.naplo.mer : ''));
  await u.ctx.close();
}

// --- 2) az oldal sajat URL-jen (?kupon=): barmelyik oldal, barmelyik gomb ------------------------------------------------------------------------------------------------------
{
  const u = await ujLap({}, OLDAL + '?kupon=' + KOD + '&utm_source=teszt');
  const { frame } = await adatlapig(u);
  ok('OLDAL-URL (?kupon=): a keret neve a kod, a mezo kitoltve', (await frameNev(u)) === 'mhk:' + KOD && (await adatlapAllapot(frame)).mezo === KOD, await frameNev(u));
  ok('OLDAL-URL: a Salonic-cim (iframe src) NEM tartalmazza a kodot', JSON.stringify(u.naplo.guest).indexOf(KOD) < 0, '');
  await u.ctx.close();
}

// --- 3) munkamenet: a kod megmarad, ha a vendeg egy MASIK oldalra megy, es ott nyitja a foglalot ---------------------------------------------------------------------------------
{
  const u = await ujLap({}, OLDAL + '?kupon=' + KOD);
  await u.page.goto(BAZIS + OLDAL, { waitUntil: 'domcontentloaded' }); // a kupon nelkuli cimre lep (ugyanaz a munkamenet)
  await u.page.waitForFunction(() => typeof window.openBooking === 'function', null, { timeout: 15000 });
  const { frame } = await adatlapig(u);
  ok('MUNKAMENET: masik oldalon, kupon nelkuli URL-lel is beirodik a kod', (await adatlapAllapot(frame)).mezo === KOD, await frameNev(u));
  await u.ctx.close();
}

// --- 4) ervenytelen kod / nincs kod: semmi nem tortenik --------------------------------------------------------------------------------------------------------------------------
for (const [cimke, opt, url] of [['ervenytelen kod (szokoz, jel)', { ...OPT, kupon: 'rossz kod!' }, OLDAL], ['tul rovid kod', { ...OPT, kupon: 'ab' }, OLDAL], ['ervenytelen kod az URL-ben', OPT, OLDAL + '?kupon=%3Cscript%3E'], ['nincs kod', OPT, OLDAL]]) {
  const u = await ujLap({}, url);
  const { frame } = await adatlapig(u, opt);
  const a = await adatlapAllapot(frame); const s = await sor(u);
  ok(`${cimke}: nincs keret-nev, a mezo ures, nincs kupon-sor`, (await frameNev(u)) === '' && a.mezo === '' && a.keyup === 0 && s.db === 0, JSON.stringify(a) + ' sor=' + s.db);
  await u.ctx.close();
}

// --- 5) a vendeg mar beirt valamit: nem irjuk felul -------------------------------------------------------------------------------------------------------------------------------------
{
  const u = await ujLap({ elotte: 'SAJAT1' });
  const { frame } = await adatlapig(u, { ...OPT, kupon: KOD });
  const a = await adatlapAllapot(frame);
  ok('ELOZETES ERTEK: a mar kitoltott kupon mezot nem irjuk felul', a.mezo === 'SAJAT1' && a.keyup === 0, JSON.stringify(a));
  await u.ctx.close();
}

// --- 6) tartalek: nem fut a szkript (hirdetes-blokkolo, nincs GTM): a foglalo kiirja a kodot, egy erintessel kimasolhato ---------------------------------------------------------------
{
  const u = await ujLap({ cimke: false });
  const { frame } = await adatlapig(u, { ...OPT, kupon: KOD });
  ok('TARTALEK: a szkript nelkul a mezo ures marad', (await adatlapAllapot(frame)).mezo === '', '');
  await u.page.waitForTimeout(4500);
  const s = await sor(u);
  ok('TARTALEK: 4 mp utan a foglalo kiirja a kodot es a "Masolas" gombot', /NYAR20/.test(s.szoveg) && s.gomb && /másold be/.test(s.szoveg), s.szoveg);
  await L(u.page).locator('.be-kupon .be-link').first().click();
  await u.page.waitForTimeout(400);
  const vagolap = await u.page.evaluate(() => navigator.clipboard.readText().catch(() => null));
  ok('TARTALEK: a "Masolas" a kodot a vagolapra teszi', vagolap === KOD, String(vagolap));
  if (MOBIL) { const doboz = await L(u.page).locator('.be-frame').boundingBox(); ok('TARTALEK (mobil): az urlap-keret magassaga megfelelo (>= 380 px)', !!doboz && doboz.height >= 380, doboz && String(Math.round(doboz.height))); }
  await u.ctx.close();
}

// --- 7) mobil/asztali elrendezes: a kupon-sor latszik, nem log ki, az urlap-keret megmarad ----------------------------------------------------------------------------------------------------
{
  const u = await ujLap();
  await adatlapig(u, { ...OPT, kupon: KOD });
  const m = await u.page.evaluate(() => { const r = document.querySelector('#mosaic-booking-layer').shadowRoot; const k = r.querySelector('.be-kupon').getBoundingClientRect(); const f = r.querySelector('.be-frame').getBoundingClientRect(); return { k: { t: k.top, b: k.bottom, l: k.left, r: k.right }, f: { t: f.top, b: f.bottom, h: f.height }, vw: innerWidth, vh: innerHeight }; });
  ok('ELRENDEZES: a kupon-sor a kepernyon belul van, az urlap-keret alatta', m.k.l >= 0 && m.k.r <= m.vw && m.k.b <= m.f.t + 1 && m.k.t >= 0, JSON.stringify(m));
  ok('ELRENDEZES: az urlap-keret magassaga megmarad (>= 380 px)', m.f.h >= 380, String(Math.round(m.f.h)));
  if (process.env.KEP) await u.page.screenshot({ path: path.join(process.env.KEP, `kupon-${MOBIL ? 'mobil' : 'asztali'}.png`) });
  await u.ctx.close();
}

await browser.close();
const hibas = eredmeny.filter((e) => !e.rendben);
console.log(`\n${eredmeny.length} ellenorzes, ${hibas.length} hiba${MOBIL ? ' (mobil)' : ' (asztali)'}`);
if (hibas.length) { for (const e of hibas) console.log('  HIBA:', e.cimke); process.exit(1); }
