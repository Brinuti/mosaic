// A foglalo SAJAT foglalas-azonositoja (booking_id, QA-1) bongeszoben, MOCKOLT Salonickal, TILTOTT kimeno merressel (foglalas nem jon letre, elo pixelre nem megy semmi):
//   node tools/meres-proba/booking-id-proba.mjs [--overlay dist] [--bazis https://<ag>.mosaic-d77.pages.dev] [--mobil 1]
//
// Ellenorzi: az azonosito a folyamat elejen szuletik, a sessionStorage-ba (mhBookingCtx) kerul, minden booking_* eseményen rajta van, a Salonic adatlap (iframe) cimen ott van
// a "back" parameter, bezaras-ujranyitas ugyanazt folytatja, siker utan a kontextus lezarul (visszhanggal vagy anelkul), a kovetkezo foglalas uj azonositot kap.
// A Salonic naptar-API es az adatlap mockolt (a valodi Salonicra nem megy keres), a kimeno meres (GA4, Meta, TikTok, Google Ads, Stape, Zapier) a tilt.mjs szerint tiltott.
// A valodi Salonic-visszhang meresere: reteg-foglalas.mjs (valodi, lemondando probafoglalas) - lasd docs/booking-engine/BOOKING_ID.md.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { UA, UA_MOBIL, platformOf, engedett, dnsArg, ures, esemenyIras, esemenyUres } from './tilt.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const OVERLAY = arg('overlay', ''), MOBIL = arg('mobil', '0') === '1', BAZIS = arg('bazis', 'https://www.mosaicheadspa.hu'), OLDAL = arg('oldal', '/paros-headspa-budapest');
const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let fajlUtvonal = null;
if (OVERLAY) ({ fajlUtvonal } = await import('../serve-dist.mjs'));
const TIPUS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
const ua = MOBIL ? UA_MOBIL : UA;
const eredmeny = [];
const ok = (cimke, rendben, reszlet = '') => { eredmeny.push({ cimke, rendben }); console.log(`${rendben ? 'OK  ' : 'HIBA'} ${cimke}${reszlet ? ' | ' + reszlet : ''}`); };
const ID = /^mb_[a-z0-9]{12,40}$/;

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--disable-blink-features=AutomationControlled', dnsArg()] });
const alap = Math.floor(Date.now() / 86400000) * 86400;
const idopont = (nap, ora = 10) => alap + nap * 86400 + ora * 3600;
const mockNaptar = (idok) => (startDate, days) => {
  const blocks = {}; let i = 0;
  for (const ts of idok.filter((x) => x >= startDate && x < startDate + days * 86400)) { const nap = new Date(ts * 1000).toISOString().slice(0, 10); ((blocks[nap] ||= { 111: { employeeName: 'Teszt Szakember', slots: {} } })[111].slots)['s' + (i++)] = { timestamp: ts, formatted: '' }; }
  return { status: 'success', data: { blocks, placeName: 'Mosaic Headspa', placeAddress: '1023 Budapest, Bécsi út 4.' } };
};

async function ujLap({ hozzajarul = true } = {}) {
  const ctx = await browser.newContext({ userAgent: ua, viewport: MOBIL ? { width: 390, height: 844 } : { width: 1280, height: 900 }, locale: 'hu-HU', timezoneId: 'Europe/Budapest', serviceWorkers: 'block', isMobile: MOBIL, hasTouch: MOBIL });
  const naplo = { mer: [], salonic: [] };
  await ctx.route('**/*', async (route) => {
    const req = route.request(), url = req.url(); let u; try { u = new URL(url); } catch (e) { return route.continue(); }
    if (/api\.salonic\.hu\/calendar\/getAvailableTimes/.test(url)) {
      return route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify(mockNaptar([idopont(1), idopont(2), idopont(3)])(+u.searchParams.get('startDate'), +u.searchParams.get('days'))) });
    }
    if (/\.salonic\.hu$/.test(u.hostname) && /\/guestData\//.test(u.pathname)) { naplo.salonic.push(url); return route.fulfill({ status: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, body: '<!doctype html><title>Salonic adatlap (proba-helyettes)</title><p>mock</p>' }); } // valodi Salonic-adatlap SOSEM toltodik be
    if (/\/api\/foglalo-szamlalo$/.test(u.pathname)) return route.fulfill({ status: 204 });
    if (/\/api\/foglalas-esemeny(\?|$)/.test(u.pathname + u.search)) return route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: req.method() === 'GET' ? '{"kor_ms":null}' : '{"irva":false,"ok":"proba"}' });
    if (OVERLAY && u.origin === BAZIS && req.method() === 'GET') {
      const e = fajlUtvonal(decodeURIComponent(u.pathname), req.headers()['user-agent'] || ua);
      if (e.atiranyit) return route.fulfill({ status: 301, headers: { location: encodeURI(e.atiranyit) + u.search } });
      if (fs.existsSync(e.fajl) && fs.statSync(e.fajl).isFile()) {
        let body = fs.readFileSync(e.fajl);
        if (body.length < 80 && /^[\w./-]+\.html$/.test(body.toString('utf8').trim())) { const cel = path.join(path.dirname(e.fajl), body.toString('utf8').trim()); if (fs.existsSync(cel)) body = fs.readFileSync(cel); }
        return route.fulfill({ status: 200, headers: { 'content-type': TIPUS[path.extname(e.fajl)] || 'application/octet-stream', 'cache-control': 'no-store' }, body });
      }
    }
    if (esemenyIras(url, req.method())) return route.fulfill(esemenyUres());
    const plat = platformOf(url) || (engedett(url, req.method()) || u.origin === BAZIS ? null : 'tiltott');
    if (plat) { naplo.mer.push({ plat, host: u.host }); return route.fulfill(ures(req)); }
    return route.continue();
  });
  const page = await ctx.newPage();
  const hibak = []; page.on('pageerror', (e) => hibak.push(String(e.message).slice(0, 200)));
  await page.addInitScript((h) => { try { localStorage.setItem('mh_cc', JSON.stringify({ v: 1, t: Date.now(), fun: h, ana: h, adv: h })); } catch (e) { /* nem baj */ } }, hozzajarul);
  await page.goto(BAZIS + OLDAL + '?atadas=0', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openBooking === 'function' && !!window.mhSuti, null, { timeout: 20000 });
  return { ctx, page, naplo, hibak };
}
const reteg = (p) => p.locator('#mosaic-booking-layer');
const kontextus = (p) => p.evaluate(() => { try { return JSON.parse(sessionStorage.getItem('mhBookingCtx')); } catch (e) { return null; } });
const dl = (p) => p.evaluate(() => (window.dataLayer || []).filter((e) => e && typeof e.event === 'string' && /^booking_/.test(e.event)).map((e) => ({ ...e })));
const idopontig = async (p, opts) => { // megnyitas -> idopont -> az adatlap (iframe) betoltodik
  await p.evaluate((o) => window.openBooking(o), opts);
  await reteg(p).locator('.be-nnap.szabad').first().waitFor({ timeout: 25000 });
  await reteg(p).locator('.be-idogomb').first().click();
  await reteg(p).locator('iframe.be-iframe').waitFor({ state: 'attached', timeout: 20000 });
  return reteg(p).locator('iframe.be-iframe').getAttribute('src');
};
async function zar(p) { await reteg(p).locator('#be-close').click(); await p.waitForFunction(() => !document.getElementById('mosaic-booking-layer'), null, { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(300); }
// a Salonic atiranyitasanak szimulacioja: sikeres foglalas a motor vart valasztasaval; echo: a bookingUrl (a Salonic adatlap cime) a sajat azonositot is tartalmazza-e
async function atiranyit(p, { echo }) {
  const keret = new URL(await reteg(p).locator('iframe.be-iframe').getAttribute('src'));
  const bu = new URL(`${keret.origin}/guestData/`);
  bu.searchParams.set('anyone', 'true'); bu.searchParams.set('employeeId', '25095');
  for (const k of ['placeId', 'serviceId', 'startDate']) bu.searchParams.set(k, keret.searchParams.get(k));
  bu.searchParams.set('back', echo ? keret.searchParams.get('back') : ''); // a valodi Salonic a kanonikus cimet adja (a vegen "back="); a visszhang a back erteke
  const ar = (((await reteg(p).locator('.be-mini').textContent().catch(() => '')) || '').match(/(\d[\d\s\u00a0]*)\s*Ft/) || [])[1];
  const href = BAZIS + '/success-foglalas?first_booking=false&price=' + (ar ? ar.replace(/\D/g, '') : '1') + '&employee=Teszt+Szakember&location=Budapest&service=Proba&g=g:2461999&bookingUrl=' + encodeURIComponent(bu.toString());
  await p.evaluate((h) => window.mhKeretbenOldal(h), href);
}

// ---- 1. a folyamat elejen szuletik az azonosito, a kontextusba kerul, a Salonic adatlap cimen ott van, siker utan lezarul (visszhanggal) -------------------------------
let elsoId = null;
{
  const u = await ujLap();
  const elotte = await kontextus(u.page);
  ok('1. a motor megnyitasa elott nincs kontextus (az azonosito a FOLYAMAT ELEJEN szuletik, nem az oldalbetoltesnel)', elotte === null);
  const src = await idopontig(u.page, { business: 'headspa', service: 'paros' });
  const k = await kontextus(u.page);
  ok('1. a megnyitas utan van kontextus, az azonosito alakja mb_[a-z0-9]', !!k && ID.test(k.id), k && k.id);
  elsoId = k && k.id;
  const url = new URL(src);
  ok('1. az adatlap (iframe) cimen a "back" parameter a sajat azonosito; a Salonic tobbi parametere valtozatlan', url.searchParams.get('back') === elsoId && /^\d+$/.test(url.searchParams.get('serviceId')) && /^\d+$/.test(url.searchParams.get('startDate')) && url.searchParams.get('employeeId') === '-1', src);
  ok('1. a kontextusban: uzletag, szolgaltatas-azonosito, idopont, szakember (-1 = barmelyik), hordozo, kuldes ideje; szemelyes adat nincs', k.business === 'headspa' && /^\d+$/.test(k.service_id) && Number.isFinite(k.slot_unix) && k.staff_id === '-1' && k.carrier === 'back' && Number.isFinite(k.sent_at) && !k.completed_at && !/@|\+36|g:/.test(JSON.stringify(k)), JSON.stringify(k));
  // a regi tracking.js-szerzodes esemenyei (booking_service_selected, _slot_viewed, _slot_selected, _details_started, _completed); a lepes-meres (lepes-meres.js: booking_open / _business / _service /
  // _slots_loaded / _slot / _form_start / _submit / _success / _close / _error) kulon csatorna (GA4 + nevtelen szamlalo), azon NINCS booking_id (a GA4-be kerulesehez a GTM-ben kulon dontes kell)
  const LEPES = new Set(['booking_open', 'booking_business', 'booking_service', 'booking_slots_loaded', 'booking_slot', 'booking_form_start', 'booking_submit', 'booking_success', 'booking_close', 'booking_error']);
  const e0 = (await dl(u.page)).filter((x) => !LEPES.has(x.event));
  ok('1. a tracker (regi szerzodes) minden booking_* esemenyen rajta van ugyanaz a booking_id', e0.length >= 3 && e0.every((x) => x.booking_id === elsoId), e0.map((x) => x.event + ':' + (x.booking_id || '-').slice(0, 8)).join(' '));
  const lm = (await dl(u.page)).filter((x) => LEPES.has(x.event));
  ok('1. a lepes-meres (GA4) esemenyei valtozatlanok: nincs rajtuk booking_id (a GA4-be nem visszuk, amig nincs ra dontes)', lm.length >= 3 && lm.every((x) => !('booking_id' in x)), lm.map((x) => x.event).join(' '));
  // bezaras - ujranyitas: ugyanazt a (lezaratlan) foglalast folytatja
  await zar(u.page);
  await u.page.evaluate(() => window.openBooking({ business: 'headspa', service: 'paros' }));
  await reteg(u.page).locator('.be-title').first().waitFor({ timeout: 20000 });
  const k2 = await kontextus(u.page);
  ok('1. bezaras-ujranyitas: ugyanaz az azonosito (ugyanaz a foglalas folytatodik)', !!k2 && k2.id === elsoId, k2 && k2.id);
  // idopont ujra, majd a sikeres atiranyitas (a Salonic visszaadja a sajat azonositot a bookingUrl-ben)
  await reteg(u.page).locator('iframe.be-iframe, .be-nnap.szabad').first().waitFor({ timeout: 25000 });
  if (!(await reteg(u.page).locator('iframe.be-iframe').count())) { await reteg(u.page).locator('.be-idogomb').first().click(); await reteg(u.page).locator('iframe.be-iframe').waitFor({ state: 'attached', timeout: 20000 }); }
  await atiranyit(u.page, { echo: true });
  await reteg(u.page).locator('.be-kosz-kartya').waitFor({ timeout: 15000 }).catch(() => {});
  const z = await kontextus(u.page);
  ok('1. siker utan a kontextus lezarul, a visszhang rogzul (hol jott vissza)', !!z && z.id === elsoId && !!z.completed_at && z.returned && z.returned.returned === true && z.returned.where === 'bookingUrl:back', JSON.stringify(z && { id: z.id, completed_at: !!z.completed_at, returned: z.returned }));
  const e1 = await dl(u.page); const kesz = e1.find((x) => x.event === 'booking_completed');
  ok('1. booking_completed: booking_id = a sajat azonosito, booking_ref = a szintetikus (g-serviceId-startDate), booking_id_echo = bookingUrl:back', !!kesz && kesz.booking_id === elsoId && /^g:2461999-\d+-\d+$/.test(kesz.booking_ref || '') && kesz.booking_id_echo === 'bookingUrl:back', JSON.stringify(kesz));
  ok('1. a motor a (mockolt) Salonic-adatlapot ezzel a "back" azonositoval kerte; valodi Salonic-adatlap nem toltodott be', u.naplo.salonic.length >= 1 && u.naplo.salonic.every((x) => x.includes('back=' + elsoId)), `salonic-keres=${u.naplo.salonic.length}`);
  console.log(`INFO tiltott kimeno meresi kerelem (a lap sajat mereskodese; mind elfogva, egy sem jutott ki a platformokhoz): ${u.naplo.mer.length}`);
  await zar(u.page);
  // a kovetkezo foglalas (lezart utan) uj azonositot kap
  await idopontig(u.page, { business: 'headspa', service: 'paros' });
  const k3 = await kontextus(u.page);
  ok('1. lezart foglalas utan a kovetkezo uj azonositot kap, es az uj azonosito megy az adatlap cimere', !!k3 && ID.test(k3.id) && k3.id !== elsoId && !k3.completed_at, k3 && k3.id);
  ok('1. nincs JS-hiba', u.hibak.length === 0, u.hibak.join(' | '));
  await u.ctx.close();
}

// ---- 2. a Salonic NEM adja vissza az azonositot (ures back): a foglalas ettol meg valodi, a visszhang "none" -------------------------------------------------
{
  const u = await ujLap();
  await idopontig(u.page, { business: 'headspa', service: 'paros' });
  const id = (await kontextus(u.page)).id;
  await atiranyit(u.page, { echo: false });
  await reteg(u.page).locator('.be-kosz-kartya').waitFor({ timeout: 15000 });
  const z = await kontextus(u.page); const kesz = (await dl(u.page)).find((x) => x.event === 'booking_completed');
  ok('2. visszhang nelkul is sikeres a foglalas (C6), a kontextus lezarul, returned=false', !!z && z.id === id && !!z.completed_at && z.returned.returned === false && z.returned.where === null, JSON.stringify(z && z.returned));
  ok('2. booking_completed.booking_id_echo = none, a sajat azonosito megvan', !!kesz && kesz.booking_id === id && kesz.booking_id_echo === 'none', JSON.stringify(kesz));
  ok('2. nincs JS-hiba', u.hibak.length === 0, u.hibak.join(' | '));
  await u.ctx.close();
}

// ---- 3. mintanezet (?minta=siker): nincs tarolas ---------------------------------------------------------------------------------------------------------
{
  const u = await ujLap();
  await u.page.evaluate(() => window.openBooking({ business: 'headspa', service: 'paros' })); // (a mintanezet az onallo /foglalo-motor oldalon fut; itt a retegben a kontextus-szuletest nezzuk meg ujra)
  await reteg(u.page).locator('.be-title').first().waitFor({ timeout: 20000 });
  const k = await kontextus(u.page);
  ok('3. a retegben nyitott motor kontextust ir (kontroll a mintanezethez)', !!k && ID.test(k.id));
  const p2 = await u.ctx.newPage();
  await p2.goto(BAZIS + '/foglalo-motor?minta=siker&atadas=0', { waitUntil: 'domcontentloaded' });
  await p2.locator('.be-title').first().waitFor({ timeout: 20000 });
  const k2 = await p2.evaluate(() => sessionStorage.getItem('mhBookingCtx'));
  ok('3. mintanezetben (?minta=siker) nem keletkezik tarolt kontextus', k2 === null, String(k2));
  await u.ctx.close();
}

await browser.close();
const hibas = eredmeny.filter((x) => !x.rendben);
console.log(`\n${eredmeny.length - hibas.length}/${eredmeny.length} rendben${hibas.length ? ', HIBA: ' + hibas.map((x) => x.cimke).join(' ; ') : ''}`);
process.exit(hibas.length ? 1 : 0);
