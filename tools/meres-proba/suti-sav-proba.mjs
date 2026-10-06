// A Salonic adatlapon (a foglaloban beagyazott keretben) felbukkano sutisav (cookieconsent) merete: kompakt-e, olvashato-e, elerheto-e az "Elfogadom", nem takarja ki az urlapot.
//
//   node tools/meres-proba/suti-sav-proba.mjs [--overlay dist] [--bazis https://...] [--mobil 1] [--uzletag hair|oxygen|headspa] [--kep mappa]
//
// A VALODI Salonic adatlap (a legtavolabbi szabad idopont: senkit nem zavar; foglalas nincs), a mi /salonic/mosaic.css-unkkel (--overlay dist: a helyi valtozattal). Kimeno meres tiltva (tilt.mjs).
// A sutisav a cookieconsent@3 (edgeless tema); a Salonic ugy adja, hogy a keret aljan fekszik (fix), keskeny keretben (mobil) a szoveg tobb sorra tordel.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { UA, UA_MOBIL, platformOf, engedett, dnsArg, ures } from './tilt.mjs';
import { createSalonicAdapter } from '../../assets/js/booking-engine/salonic-adapter.js';
import { staffCoverServices } from '../../assets/js/booking-engine/flow.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const OVERLAY = arg('overlay', ''), MOBIL = arg('mobil', '0') === '1', OLDAL = arg('oldal', '/booking-test'), BAZIS = arg('bazis', 'https://www.mosaicheadspa.hu'), UZ = arg('uzletag', 'hair'), KEP = arg('kep', ''), CSS = arg('css', ''); // --css salonic/mosaic.css: a helyi fajlt toltjuk a Salonic-oldalon (epites nelkul)
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
  if (/\/api\/foglalo-szamlalo$/.test(u.pathname)) return route.fulfill({ status: 204 });
  if (/\/api\/foglalas-esemeny(\?|$)/.test(u.pathname + u.search)) return route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: req.method() === 'GET' ? '{"kor_ms":null}' : '{"irva":false,"ok":"proba"}' });
  if (CSS && /\/salonic\/(mosaic|pmu)\.css$/.test(u.pathname)) { cssKiszolgalva++; return route.fulfill({ status: 200, headers: { 'content-type': 'text/css', 'cache-control': 'no-store', 'access-control-allow-origin': '*' }, body: fs.readFileSync(CSS) }); } // a helyi (meg nem epitett) CSS
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
await frame.waitForSelector('#GuestDataForm_couponCode', { timeout: 20000 }).catch(() => {});
await frame.waitForSelector('.cc-window', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(1500);

const m = await frame.evaluate(() => {
  const w = document.querySelector('.cc-window'); if (!w) return null;
  const r = w.getBoundingClientRect(); const cs = getComputedStyle(w);
  const uz = w.querySelector('.cc-message'), gomb = w.querySelector('.cc-btn'), link = w.querySelector('.cc-link');
  const gr = gomb ? gomb.getBoundingClientRect() : null;
  const kep = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
  const ures = [...document.querySelectorAll('#guestDataForm input:not([type=hidden])')].map((e) => ({ id: e.id, ...kep(e) })).filter((e) => e.w > 0);
  const szabaly = []; for (const ss of document.styleSheets) { try { for (const r of ss.cssRules) if (/cc-window/.test(r.cssText) && /customer-mosaic/.test(r.cssText)) szabaly.push(r.cssText.slice(0, 120)); } catch (e) { szabaly.push('(nem olvashato: ' + (ss.href || 'inline') + ')'); } }
  return { osztalyok: w.className, szulo: w.parentElement.tagName + '.' + w.parentElement.className.slice(0, 40), egyezik: w.matches('body[class*=\"customer-mosaic\"] .cc-window.cc-banner'), szabaly: szabaly.slice(0, 5), fd: getComputedStyle(w).flexDirection, testOsztaly: document.body.className, stilusok: [...document.querySelectorAll('link[rel=stylesheet]')].map((l) => l.href).filter((h) => /mosaic|salonic\.hu\/.*custom/i.test(h)), vw: innerWidth, vh: innerHeight, ablak: kep(w), font: parseFloat(getComputedStyle(uz || w).fontSize), gombFont: gomb ? parseFloat(getComputedStyle(gomb).fontSize) : null, gomb: kep(gomb), poz: cs.position, tartalom: (w.textContent || '').replace(/\s+/g, ' ').trim(), mezok: ures.slice(0, 8), link: !!link, gombSzoveg: gomb ? gomb.textContent.trim() : '' };
});
if (!m) { ok('a sutisav megjelenik', false, 'nincs .cc-window (a Salonic mar megjegyezte a hozzajarulast?)'); await browser.close(); process.exit(1); }
console.log('  helyi CSS kiszolgalva:', cssKiszolgalva);
console.log('  oldal:', JSON.stringify({ body: m.testOsztaly, egyediCss: m.stilusok, flexDirection: m.fd, osztalyok: m.osztalyok, szulo: m.szulo, egyezik: m.egyezik }));
console.log('  sutisav:', JSON.stringify({ ablak: m.ablak, vh: m.vh, font: m.font, gombFont: m.gombFont, poz: m.poz }));
const arany = m.ablak.h / m.vh;
ok('a sutisav kompakt: a magassaga legfeljebb 100 px (a regi ~200 px volt)', m.ablak.h <= 100, `${Math.round(m.ablak.h)} px = a keret ${(arany * 100).toFixed(0)}%-a`);
ok('a szoveg olvashato marad (legalabb 11 px) es a teljes szoveg + a "Tovabbi informacio" link megvan', m.font >= 11 && /hozzájárulsz/.test(m.tartalom) && m.link, `${m.font}px`);
ok('az "Elfogadom" gomb megvan, jol erintheto (legalabb 40 x 44 px), a keren belul', !!m.gomb && m.gomb.h >= 44 && m.gomb.w >= 40 && m.gomb.b <= m.vh + 1 && m.gomb.r <= m.vw + 1 && /Elfogadom/.test(m.gombSzoveg), JSON.stringify(m.gomb));
const mezoTakart = m.mezok.filter((e) => e.t < m.ablak.t && e.b > m.ablak.t); // a sutisav felso elere eso mezo (resze takarva)
ok('az urlap felso reszet (telefon, nev) a sutisav nem takarja', m.mezok.slice(0, 3).every((e) => e.b <= m.ablak.t + 1), m.mezok.slice(0, 4).map((e) => `${e.id.replace('GuestDataForm_', '')}:${Math.round(e.b)}`).join(' ') + ` | sav teteje: ${Math.round(m.ablak.t)}`);
if (KEP) await page.screenshot({ path: path.join(KEP, `suti-sav-${UZ}-${MOBIL ? 'mobil' : 'asztali'}${OVERLAY ? '-uj' : ''}.png`) });
// az Elfogadom mukodik: a sav eltunik
await frame.locator('.cc-btn.cc-dismiss, .cc-btn.cc-allow, .cc-compliance .cc-btn').first().click({ timeout: 5000 }).catch(() => {});
await page.waitForTimeout(1200);
const eltunt = await frame.evaluate(() => { const w = document.querySelector('.cc-window'); return !w || getComputedStyle(w).display === 'none' || getComputedStyle(w).opacity === '0' || w.getBoundingClientRect().height === 0 || w.classList.contains('cc-invisible'); });
ok('az "Elfogadom"-ra a sutisav eltunik', eltunt, '');
console.log(`  kimeno meres tiltva: ${tiltott} kereses`);
await browser.close();
const hibas = eredmeny.filter((e) => !e.rendben);
console.log(`\n${eredmeny.length} ellenorzes, ${hibas.length} hiba${MOBIL ? ' (mobil)' : ' (asztali)'} [${UZ}]`);
if (hibas.length) { for (const e of hibas) console.log('  HIBA:', e.cimke); process.exit(1); }
