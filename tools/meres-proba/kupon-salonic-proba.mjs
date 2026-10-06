// A kuponkod VALODI Salonic adatlapon (nem szimulalt): a GTM-cimke (docs/booking-engine/gtm-kupon-kitolto.html) tenyleg beirja-e a kodot a kupon mezobe, es elindul-e a Salonic sajat ellenorzese.
//
//   node tools/meres-proba/kupon-salonic-proba.mjs [--overlay dist] [--bazis https://...] [--mobil 1] [--gtm-kornyezet 2:<kod>] [--kontroll 1]
//
// --gtm-kornyezet <id>:<auth>: a GTM-et NEM az eles (publikalt) valtozatbol toltjuk, hanem egy GTM-kornyezetbol (a beepitett "Latest" = a legutobb letrehozott, MEG NEM publikalt
//   verzio: 2:<kod>), igy a cimke a PUBLIKALAS ELOTT kiprobalhato. Nelkule az ELES valtozat fut (a cimke 2026-10-06 ota el, GTM 53): a mezo kitoltodik; `--kontroll 1` = a cimke nelkuli allapot (a mezo ures marad, a foglalo a kezi tartalekot mutatja).
// A valodi adatlapot a proba a LEGTAVOLABBI szabad idopontra iranyitja (a Salonic 5 percre "tartja": igy senki foglalasat nem zavarja), foglalas nincs, a "kod ellenorzese" a Salonic
// olvaso (nem beváltó) hivasa, hamis kodra. Kimeno meres (GA4, Meta, TikTok, Ads, Stape, Zapier) tiltva (tilt.mjs).
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { UA, UA_MOBIL, platformOf, engedett, dnsArg, ures } from './tilt.mjs';
import { createSalonicAdapter } from '../../assets/js/booking-engine/salonic-adapter.js';
import { staffCoverServices } from '../../assets/js/booking-engine/flow.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const OVERLAY = arg('overlay', ''), MOBIL = arg('mobil', '0') === '1', OLDAL = arg('oldal', '/booking-test'), BAZIS = arg('bazis', 'https://www.mosaicheadspa.hu');
const UZ = arg('uzletag', 'hair'); // hair | oxygen | headspa (a Salonic-fiokjuk: mosaic-hair / mosaic-oxigen / mosaicheadspa); a lezer fiokban nincs kupon mezo
const KONTROLL = arg('kontroll', '0') === '1'; // az ELES GTM-ben a cimke NINCS kozzetetve (a 2026-10-06 elotti allapot): a mezo ures marad
const GTM_KORNYEZET = (() => { const v = arg('gtm-kornyezet', ''); if (!v) return null; const [id, auth] = v.split(':'); return { id, auth }; })();
const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let fajlUtvonal = null;
if (OVERLAY) ({ fajlUtvonal } = await import('../serve-dist.mjs'));
const TIPUS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
const KOD = 'PROBAKOD123';
const eredmeny = [];
const ok = (cimke, rendben, reszlet = '') => { eredmeny.push({ cimke, rendben }); console.log(`${rendben ? 'OK  ' : 'HIBA'} ${cimke}${reszlet ? ' | ' + reszlet : ''}`); };

const adapter = createSalonicAdapter({ fetchImpl: (u, o) => fetch(u, o) });
const services = (await adapter.getServices(UZ)).filter((s) => s.bookingType !== 'voucher_redemption' && !/ajándékkártya|ajandekkartya|kupon/i.test(s.name));
let SVC = null, STAFF = null;
for (const s of staffCoverServices(services)) { const st = (await adapter.getStaff(UZ, s.serviceId, { days: 60 }))[0]; if (st && s.durationMin && s.bookingType !== 'consultation') { SVC = s; STAFF = st; break; } }
const tavoli = (await adapter.getAvailability(UZ, SVC.serviceId, { days: 90, staffId: STAFF.staff_id })).at(-1);
const TAVOLI_URL = (await adapter.beginBooking({ business: UZ, serviceId: SVC.serviceId, startUnix: tavoli.start_unix, staffId: tavoli.staff_id })).guestDataUrl;

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--disable-blink-features=AutomationControlled', dnsArg()] });
const ctx = await browser.newContext({ userAgent: MOBIL ? UA_MOBIL : UA, viewport: MOBIL ? { width: 390, height: 844 } : { width: 1280, height: 900 }, locale: 'hu-HU', timezoneId: 'Europe/Budapest', serviceWorkers: 'block', isMobile: MOBIL, hasTouch: MOBIL });
const naplo = { tiltott: 0, ellenorzes: [], gtmKornyezet: 0, kereses: [] };
await ctx.route('**/*', async (route) => {
  const req = route.request(), url = req.url(); let u; try { u = new URL(url); } catch (e) { return route.continue(); }
  naplo.kereses.push({ url, post: req.postData() || '' });
  if (/salonic\.hu$/.test(u.hostname) && /\/guestData\//.test(u.pathname) && req.method() === 'GET') return route.continue({ url: TAVOLI_URL }); // a legtavolabbi szabad idopont (senkit nem zavar)
  if (/salonic\.hu$/.test(u.hostname) && /checkCouponCode/.test(u.pathname)) { naplo.ellenorzes.push(req.postData()); return route.continue(); }
  if (/\/api\/foglalo-szamlalo$/.test(u.pathname)) return route.fulfill({ status: 204 });
  if (/\/api\/foglalas-esemeny(\?|$)/.test(u.pathname + u.search)) return route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: req.method() === 'GET' ? '{"kor_ms":null}' : '{"irva":false,"ok":"proba"}' });
  if (GTM_KORNYEZET && /^https:\/\/www\.googletagmanager\.com\/gtm\.js\?/.test(url)) { naplo.gtmKornyezet++; return route.continue({ url: url + '&gtm_auth=' + GTM_KORNYEZET.auth + '&gtm_preview=env-' + GTM_KORNYEZET.id + '&gtm_cookies_win=x' }); }
  if (/^https:\/\/www\.googletagmanager\.com\/gtm\.js\?/.test(url)) return route.continue();
  if (OVERLAY && u.origin === BAZIS && req.method() === 'GET') {
    const e = fajlUtvonal(decodeURIComponent(u.pathname), req.headers()['user-agent'] || UA);
    if (e.atiranyit) return route.fulfill({ status: 301, headers: { location: encodeURI(e.atiranyit) + u.search } });
    if (fs.existsSync(e.fajl) && fs.statSync(e.fajl).isFile()) {
      let body = fs.readFileSync(e.fajl);
      if (body.length < 80 && /^[\w./-]+\.html$/.test(body.toString('utf8').trim())) { const cel = path.join(path.dirname(e.fajl), body.toString('utf8').trim()); if (fs.existsSync(cel)) body = fs.readFileSync(cel); }
      return route.fulfill({ status: 200, headers: { 'content-type': TIPUS[path.extname(e.fajl)] || 'application/octet-stream', 'cache-control': 'no-store' }, body });
    }
  }
  const plat = platformOf(url) || (engedett(url, req.method()) || u.origin === BAZIS || /salonic\.hu$/.test(u.hostname) || /(^|\.)(jquery|jsdelivr|cloudflare|cdnjs|gstatic|googleapis)\./.test(u.hostname) ? null : 'tiltott');
  if (plat) { naplo.tiltott++; return route.fulfill(ures(req)); }
  return route.continue();
});
const page = await ctx.newPage();
const hibak = []; page.on('pageerror', (e) => hibak.push(String(e.message).slice(0, 160)));
await page.goto(BAZIS + OLDAL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.openBooking === 'function', null, { timeout: 15000 });
const L = page.locator('#mosaic-booking-layer');
await page.evaluate((o) => window.openBooking(o), { business: UZ, service: SVC.serviceId, staff: STAFF.staff_id, kupon: KOD });
await L.locator('.be-nnap.szabad').first().waitFor({ timeout: 40000 });
await L.locator('.be-idogomb').first().click();
await page.waitForFunction(() => !!document.querySelector('#mosaic-booking-layer')?.shadowRoot?.querySelector('iframe.be-iframe'), null, { timeout: 25000 });
// a valodi Salonic-oldal betoltese + a GTM + a cimke (legfeljebb ~15 mp)
let frame = null;
for (let i = 0; i < 60 && !frame; i++) { await page.waitForTimeout(250); frame = page.frames().find((f) => /salonic\.hu\/guestData\//.test(f.url())) || null; }
ok('a valodi Salonic adatlap betoltodott a keretben', !!frame, frame ? frame.url().replace(/\?.*/, '') : 'nincs');
if (frame) {
  await frame.waitForSelector('#GuestDataForm_couponCode', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(GTM_KORNYEZET ? 6000 : 7000); // a GTM betoltese + a cimke futasa + a Salonic ellenorzese
  const a = await frame.evaluate(() => ({ nev: window.name, mezo: (document.getElementById('GuestDataForm_couponCode') || {}).value, uzenet: (document.querySelector('#GuestDataForm_couponCode')?.closest('.mb-3, .form-group, div')?.parentElement?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 140), gtm: Object.keys(window.google_tag_manager || {}).filter((k) => /^GTM-/.test(k)) }));
  const sor = ((await L.locator('.be-kupon').first().textContent({ timeout: 1000 }).catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  console.log('  adatlap:', JSON.stringify(a), '| gtm.js a kornyezetbol:', naplo.gtmKornyezet, '| foglalo-sor:', sor);
  if (!KONTROLL) {
    const cim = GTM_KORNYEZET ? 'GTM (Latest kornyezet)' : 'GTM (eles)';
    ok(cim + ': a valodi adatlapon a kupon mezo ki van toltve a kuppal', a.mezo === KOD, JSON.stringify(a.mezo));
    ok(cim + ': a Salonic sajat ellenorzese lefutott a kodra (hamis kod: "nem hasznalhato")', naplo.ellenorzes.some((p) => new RegExp('code=' + KOD).test(p || '')) && /nem használható/.test(a.uzenet), (naplo.ellenorzes.at(-1) || '') + ' | ' + a.uzenet);
    ok(cim + ': a foglalo is latja a visszajelzest ("beirtuk az urlapba")', /beírtuk az űrlapba/.test(sor), sor);
    ok(cim + ': a keret neve torolve (a kod nem marad ott)', a.nev === '', JSON.stringify(a.nev));
  } else {
    ok('KONTROLL (a cimke nincs a GTM-ben): a mezo ures marad', a.mezo === '', JSON.stringify(a.mezo));
    ok('KONTROLL: a foglalo a kezi tartalekot mutatja (4 mp utan: kod + Masolas)', /másold be/.test(sor), sor);
  }
}
const szivarog = naplo.kereses.filter((k) => !/salonic\.hu/.test(k.url) && (k.url.includes(KOD) || k.post.includes(KOD)));
ok('a kod semelyik NEM-Salonic kimeno keresben nem szerepel (URL, torzs)', szivarog.length === 0, szivarog.map((k) => k.url.slice(0, 80)).join(' | '));
const szivarogSalonic = naplo.kereses.filter((k) => /salonic\.hu/.test(k.url) && k.url.includes(KOD));
ok('a kod a Salonic URL-jeiben sem szerepel (csak a Salonic sajat ellenorzo hivasanak torzsében)', szivarogSalonic.length === 0, szivarogSalonic.map((k) => k.url.slice(0, 100)).join(' | '));
ok('nincs JS-hiba az oldalunkon', hibak.length === 0, hibak.join(' | '));
console.log(`  kimeno meres tiltva: ${naplo.tiltott} kereses (a Google-hoz / Meta-hoz / TikTokhoz semmi nem jutott el)`);
await browser.close();
const hibas = eredmeny.filter((e) => !e.rendben);
console.log(`\n${eredmeny.length} ellenorzes, ${hibas.length} hiba${MOBIL ? ' (mobil)' : ' (asztali)'}${GTM_KORNYEZET ? ' [GTM Latest]' : KONTROLL ? ' [kontroll]' : ' [GTM eles]'}`);
if (hibas.length) { for (const e of hibas) console.log('  HIBA:', e.cimke); process.exit(1); }
