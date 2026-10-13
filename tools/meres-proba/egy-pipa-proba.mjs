// A Salonic adatlapon (a foglaloban beagyazott keretben) CSAK EGY pipa latszik: a kotelezo adatkezelesi / foglalasi szabalyzat elfogadasa; a hirlevel-pipa rejtett.
//
//   node tools/meres-proba/egy-pipa-proba.mjs [--overlay dist] [--bazis https://...] [--mobil 1] [--uzletag hair|oxygen|headspa] [--css salonic/mosaic.css] [--kep mappa]
//
// A VALODI Salonic adatlap (a legtavolabbi szabad idopont: senkit nem zavar; foglalas nincs, nem kuldunk be semmit), a mi /salonic/mosaic.css-unkkel (--css: a helyi, meg nem epitett fajl).
// Kimeno meres tiltva (tilt.mjs).
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { UA, UA_MOBIL, platformOf, engedett, dnsArg, ures } from './tilt.mjs';
import { createSalonicAdapter } from '../../assets/js/booking-engine/salonic-adapter.js';
import { staffCoverServices } from '../../assets/js/booking-engine/flow.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const OVERLAY = arg('overlay', ''), MOBIL = arg('mobil', '0') === '1', OLDAL = arg('oldal', '/booking-test'), BAZIS = arg('bazis', 'https://www.mosaicheadspa.hu'), UZ = arg('uzletag', 'hair'), KEP = arg('kep', ''), CSS = arg('css', '');
const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let fajlUtvonal = null;
if (OVERLAY) ({ fajlUtvonal } = await import('../serve-dist.mjs'));
if (KEP) fs.mkdirSync(KEP, { recursive: true });
const TIPUS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
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
let tiltott = 0, cssKiszolgalva = 0;
await ctx.route('**/*', async (route) => {
  const req = route.request(), url = req.url(); let u; try { u = new URL(url); } catch (e) { return route.continue(); }
  if (/salonic\.hu$/.test(u.hostname) && /\/guestData\//.test(u.pathname) && req.method() === 'GET') return route.continue({ url: TAVOLI_URL });
  if (/salonic\.hu$/.test(u.hostname) && req.method() === 'POST' && !/checkCouponCode/.test(u.pathname)) { tiltott++; return route.abort(); } // semmit nem kuldunk be
  if (/\/api\/foglalo-szamlalo$/.test(u.pathname)) return route.fulfill({ status: 204 });
  if (/\/api\/foglalas-esemeny(\?|$)/.test(u.pathname + u.search)) return route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: req.method() === 'GET' ? '{"kor_ms":null}' : '{"irva":false,"ok":"proba"}' });
  if (CSS && /\/salonic\/(mosaic|pmu)\.css$/.test(u.pathname)) { cssKiszolgalva++; return route.fulfill({ status: 200, headers: { 'content-type': 'text/css', 'cache-control': 'no-store', 'access-control-allow-origin': '*' }, body: fs.readFileSync(CSS) }); }
  if (OVERLAY && u.origin === BAZIS && req.method() === 'GET') {
    const e = fajlUtvonal(decodeURIComponent(u.pathname), req.headers()['user-agent'] || UA);
    if (e.atiranyit) return route.fulfill({ status: 301, headers: { location: encodeURI(e.atiranyit) + u.search } });
    if (fs.existsSync(e.fajl) && fs.statSync(e.fajl).isFile()) {
      let body = fs.readFileSync(e.fajl);
      if (body.length < 80 && /^[\w./-]+\.html$/.test(body.toString('utf8').trim())) { const cel = path.join(path.dirname(e.fajl), body.toString('utf8').trim()); if (fs.existsSync(cel)) body = fs.readFileSync(cel); }
      return route.fulfill({ status: 200, headers: { 'content-type': TIPUS[path.extname(e.fajl)] || 'application/octet-stream', 'cache-control': 'no-store' }, body });
    }
  }
  const plat = platformOf(url) || (engedett(url, req.method()) || u.origin === BAZIS || /salonic\.hu$/.test(u.hostname) || /(^|\.)(jquery|jsdelivr|cloudflare|cdnjs|gstatic|googleapis|googletagmanager)\./.test(u.hostname) ? null : 'tiltott');
  if (plat) { tiltott++; return route.fulfill(ures(req)); }
  return route.continue();
});
const page = await ctx.newPage();
await page.goto(BAZIS + OLDAL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.openBooking === 'function', null, { timeout: 15000 });
const L = page.locator('#mosaic-booking-layer');
await page.evaluate((o) => window.openBooking(o), { business: UZ, service: SVC.serviceId, staff: STAFF.staff_id });
await L.locator('.be-nnap.szabad').first().waitFor({ timeout: 40000 });
await L.locator('.be-idogomb').first().click();
await page.waitForFunction(() => !!document.querySelector('#mosaic-booking-layer')?.shadowRoot?.querySelector('iframe.be-iframe'), null, { timeout: 25000 });
let frame = null;
for (let i = 0; i < 80 && !frame; i++) { await page.waitForTimeout(250); frame = page.frames().find((f) => /salonic\.hu\/guestData\//.test(f.url())) || null; }
if (!frame) { ok('a valodi Salonic adatlap betoltodott', false, 'nincs keret'); process.exit(1); }
await frame.waitForSelector('#GuestDataForm_acceptTerms', { state: 'attached', timeout: 20000 }).catch(() => {});
await page.waitForTimeout(2000);

const m = await frame.evaluate(() => {
  const lathato = (e) => { if (!e) return false; const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
  const dobozok = [...document.querySelectorAll('#guestDataForm input[type=checkbox]')].map((e) => ({ id: e.id, lathato: lathato(e) || lathato(e.closest('label')) || lathato(e.nextElementSibling), szulo: lathato(e.closest('.form-check')) }));
  const gomb = document.querySelector('.btn-submit-booking');
  const hn = document.getElementById('ytGuestDataForm_newsletter');
  const szoveg = [...document.querySelectorAll('#guestDataForm .form-check')].filter(lathato).map((e) => e.textContent.replace(/\s+/g, ' ').trim().slice(0, 90));
  return { dobozok, lathatoBlokkok: szoveg, kuldes: !!gomb && lathato(gomb), hirlevelRejtettErtek: hn ? hn.value : null, hirlevelContainerDisplay: getComputedStyle(document.querySelector('.newsletter-container') || document.body).display };
});
console.log('  helyi CSS kiszolgalva:', cssKiszolgalva, '| lathato jelolonegyzetek/blokkok:', JSON.stringify(m.lathatoBlokkok));
const lathatoPipak = m.dobozok.filter((d) => d.szulo);
ok('csak EGY pipa latszik az adatlapon', lathatoPipak.length === 1, JSON.stringify(m.dobozok));
ok('a latszo pipa a KOTELEZO adatkezelesi / foglalasi szabalyzat elfogadasa', lathatoPipak.length === 1 && lathatoPipak[0].id === 'GuestDataForm_acceptTerms' && m.lathatoBlokkok.some((s) => /adatvédelmi tájékoztatót/.test(s)), m.lathatoBlokkok.join(' || '));
ok('a hirlevel-pipa nem latszik (a rejtett "newsletter" mezo erteke 0 marad: nincs feliratkozas)', !m.lathatoBlokkok.some((s) => /e-mailben értesítést/.test(s)) && String(m.hirlevelRejtettErtek) === '0', `hidden=${m.hirlevelRejtettErtek} display=${m.hirlevelContainerDisplay}`);
ok('a "Foglalas elkuldese" gomb latszik (az urlap hasznalhato)', m.kuldes, '');
// a kotelezo pipa tovabbra is mukodik: bepipalhato (a Salonic sajat ellenorzese miatt a kuldes gombra nem kattintunk)
await frame.evaluate(() => { const c = document.getElementById('GuestDataForm_acceptTerms'); c.click(); });
const bent = await frame.evaluate(() => document.getElementById('GuestDataForm_acceptTerms').checked);
ok('a kotelezo pipa bepipalhato', bent === true, String(bent));
if (KEP) await page.screenshot({ path: path.join(KEP, `egy-pipa-${UZ}-${MOBIL ? 'mobil' : 'asztali'}.png`) });
console.log(`  kimeno meres tiltva / nem kuldott: ${tiltott}`);
await browser.close();
const hibas = eredmeny.filter((e) => !e.rendben);
console.log(`\n${eredmeny.length} ellenorzes, ${hibas.length} hiba${MOBIL ? ' (mobil)' : ' (asztali)'} [${UZ}]`);
if (hibas.length) { for (const e of hibas) console.log('  HIBA:', e.cimke); process.exit(1); }
