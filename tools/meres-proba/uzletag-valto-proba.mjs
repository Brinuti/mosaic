// Uzletag-valtas a foglaloban: a fejlecben az uzletag neve kattinthato (valtas), a legelso kepernyon a vissza nyil az uzletag-valasztora (H0) visz.
//
//   node tools/meres-proba/uzletag-valto-proba.mjs [--overlay dist] [--bazis https://...] [--mobil 1] [--oldal /booking-test]
//
// A Salonic JELENLEGI (valodi, csak olvasott) naptaradataival; az adatlapot (guestData) a proba elfogja es egy ures oldallal helyettesiti, foglalas nincs.
// Kimeno meres (GA4, Meta, TikTok, Ads, Stape, Zapier) tiltva (tilt.mjs).
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { UA, UA_MOBIL, platformOf, engedett, dnsArg, ures } from './tilt.mjs';
import { createSalonicAdapter } from '../../assets/js/booking-engine/salonic-adapter.js';
import { staffCoverServices } from '../../assets/js/booking-engine/flow.js';
import { CHOOSER } from '../../assets/js/booking-engine/families.js';
import { HAIR } from '../../assets/js/booking-engine/flows/hair.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const OVERLAY = arg('overlay', ''), MOBIL = arg('mobil', '0') === '1', OLDAL = arg('oldal', '/booking-test'), BAZIS = arg('bazis', 'https://www.mosaicheadspa.hu');
const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let fajlUtvonal = null;
if (OVERLAY) ({ fajlUtvonal } = await import('../serve-dist.mjs'));
const TIPUS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
const eredmeny = [];
const ok = (cimke, rendben, reszlet = '') => { eredmeny.push({ cimke, rendben }); console.log(`${rendben ? 'OK  ' : 'HIBA'} ${cimke}${reszlet ? ' | ' + reszlet : ''}`); };
const VALASZTO = CHOOSER.title; // "Mit szeretnél foglalni?"

// --- a Salonic jelenlegi adatai (olvasas): egy fodraszat-szolgaltatas es egy munkatarsa (a naptar rogton megnyilik) ---------------------------------------------------
const adapter = createSalonicAdapter({ fetchImpl: (u, o) => fetch(u, o) });
const services = (await adapter.getServices('hair')).filter((s) => s.bookingType !== 'voucher_redemption' && !/ajándékkártya|ajandekkartya|kupon/i.test(s.name));
let SVC = null, STAFF = null;
for (const s of staffCoverServices(services)) { const st = (await adapter.getStaff('hair', s.serviceId, { days: 60 }))[0]; if (st && s.durationMin && s.bookingType !== 'consultation') { SVC = s; STAFF = st; break; } }
if (!SVC) { console.log('HIBA nincs foglalhato fodraszat-szolgaltatas a Salonicban'); process.exit(1); }

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--disable-blink-features=AutomationControlled', dnsArg()] });
async function ujLap(url = OLDAL) {
  const ctx = await browser.newContext({ userAgent: MOBIL ? UA_MOBIL : UA, viewport: MOBIL ? { width: 390, height: 844 } : { width: 1280, height: 900 }, locale: 'hu-HU', timezoneId: 'Europe/Budapest', serviceWorkers: 'block', isMobile: MOBIL, hasTouch: MOBIL });
  const naplo = { mer: 0 };
  await ctx.route('**/*', async (route) => {
    const req = route.request(), u0 = req.url(); let u; try { u = new URL(u0); } catch (e) { return route.continue(); }
    if (/salonic\.hu$/.test(u.hostname) && /\/guestData\//.test(u.pathname)) return route.fulfill({ status: 200, headers: { 'content-type': 'text/html' }, body: '<!doctype html><title>proba</title><p>proba</p>' });
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
  return { ctx, page, naplo, hibak };
}
const ujLapReteg = async () => { const u = await ujLap(); await u.page.waitForFunction(() => typeof window.openBooking === 'function', null, { timeout: 15000 }); return u; };
// a motor DOM-ja: reteg-modban a Shadow DOM-ban, oldal-modban a dokumentumban
const R = (u, reteg = true) => (reteg ? u.page.locator('#mosaic-booking-layer') : u.page);
const cim = async (u, reteg = true, ido = 25000) => { const c = R(u, reteg).locator('.be-title').first(); try { await c.waitFor({ timeout: ido }); return ((await c.textContent()) || '').trim(); } catch (e) { return null; } };
const fej = (u, reteg = true) => u.page.evaluate((r) => { const gy = r ? document.querySelector('#mosaic-booking-layer')?.shadowRoot : document; if (!gy) return null; const h1 = gy.querySelector('#be-h1'), back = gy.querySelector('#be-back'), valt = gy.querySelector('.be-h1-valt'); const cs = getComputedStyle(back);
  return { szoveg: h1.textContent.replace(/\s+/g, ' ').trim(), valt: !!valt, valtSzoveg: valt ? valt.textContent.trim() : '', backLathato: cs.visibility === 'visible', backFelirat: back.getAttribute('aria-label'), levagva: h1.scrollWidth > h1.clientWidth + 1, panelVan: !!document.querySelector('#mosaic-booking-layer') }; }, reteg);
const kattint = async (u, sel, reteg = true) => { await R(u, reteg).locator(sel).first().click(); await u.page.waitForTimeout(500); };
const varTitle = async (u, reteg, kell, ido = 15000) => { const t0 = Date.now(); let c = null; while (Date.now() - t0 < ido) { c = await cim(u, reteg, 3000); if (c === kell) return c; await u.page.waitForTimeout(250); } return c; };
const varMas = async (u, reteg, nemEz, ido = 30000) => { const t0 = Date.now(); let c = null; while (Date.now() - t0 < ido) { c = await cim(u, reteg, 2000); if (c && c !== nemEz) return c; await u.page.waitForTimeout(250); } return c; };
const kartya = (nev) => `.be-choice:has-text("${nev}")`;

// --- 1) uzletag-oldalrol nyitva (hair): a legelso kepernyon vissza nyil -> valaszto -> vissza nyil -> az uzletag elso kepernyoje -------------------------------------
{
  const u = await ujLapReteg();
  await u.page.evaluate(() => window.openBooking({ business: 'hair' }));
  const elso = await cim(u);
  const f0 = await fej(u);
  ok('UZLETAG-OLDAL: a legelso kepernyon (fodraszat) van vissza nyil, "Másik üzletág választása" felirattal', !!f0 && f0.backLathato && f0.backFelirat === 'Másik üzletág választása', JSON.stringify(f0));
  ok('UZLETAG-OLDAL: a fejlecben az uzletag neve kattinthato gomb (Fodrászat)', !!f0 && f0.valt && /Fodrászat/.test(f0.valtSzoveg), f0 && f0.szoveg);
  await kattint(u, '#be-back');
  const c1 = await varTitle(u, true, VALASZTO);
  const f1 = await fej(u);
  ok('A vissza nyil az uzletag-valasztot nyitja ("Mit szeretnél foglalni?")', c1 === VALASZTO, String(c1));
  ok('A valasztonal a cim csak "Időpontfoglalás" (nincs uzletag), nincs uzletag-gomb, a vissza nyil "Vissza"', !!f1 && f1.szoveg === 'Időpontfoglalás' && !f1.valt && f1.backLathato && f1.backFelirat === 'Vissza', JSON.stringify(f1));
  const sorok = await R(u).locator('.be-choice').count();
  ok('A valasztonal minden uzletag megvan (Head Spa, Fodraszat, Oxigenterapia, Lezer, Sminktetovalas)', sorok === CHOOSER.families.length, String(sorok));
  await kattint(u, '#be-back');
  const c2 = await varTitle(u, true, elso);
  ok('A valasztorol visszalepve ugyanaz az uzletag-kepernyo jon (nem kezd elolrol mas uzletagot)', c2 === elso, `${c2} / ${elso}`);
  ok('nincs JS-hiba, nincs kimeno meres', u.hibak.length === 0 && u.naplo.mer === 0, u.hibak.join(' | ') + (u.naplo.mer ? ' mer=' + u.naplo.mer : ''));
  await u.ctx.close();
}

// --- 2) a fejlecbol valtas MASIK uzletagra (Fodraszat -> Oxigenterapia), vissza, bezaras ---------------------------------------------------------------------------------
{
  const u = await ujLapReteg();
  const eredetiUrl = await u.page.evaluate(() => location.href);
  await u.page.evaluate(() => window.openBooking({ business: 'hair' }));
  await cim(u);
  await kattint(u, '.be-h1-valt');
  ok('FEJLEC-VALTAS: az uzletag nevere kattintva az uzletag-valaszto jon', (await varTitle(u, true, VALASZTO)) === VALASZTO, '');
  await kattint(u, kartya('Oxigénterápia'));
  await R(u).locator('.be-choice:has-text("Hajkamerás")').first().waitFor({ timeout: 30000 }).catch(() => {}); // az oxigen belepo kepernyo cime ugyanaz, mint a valasztoe: a kartyai mutatjak
  const co = (await R(u).locator('.be-choice:has-text("Hajkamerás")').count()) > 0 ? 'oxigen kartyak' : await cim(u);
  const fo = await fej(u);
  ok('FEJLEC-VALTAS: az Oxigenterapia valasztasa utan az oxigen folyamat nyilik, a fejlecben Oxigénterápia', !!fo && /Oxigénterápia/.test(fo.valtSzoveg) && co === 'oxigen kartyak',`${co} | ${fo && fo.szoveg}`);
  ok('FEJLEC-VALTAS: az oxigen folyamat elso kepernyojen is van vissza nyil (a valasztora)', !!fo && fo.backLathato, JSON.stringify(fo && fo.backFelirat));
  await kattint(u, '#be-back'); // oxigen entry (depth 2) -> history.back -> H0 (depth 1)
  ok('FEJLEC-VALTAS: a vissza nyil az uzletag-valasztora vezet', (await varTitle(u, true, VALASZTO)) === VALASZTO, '');
  await kattint(u, '#be-back'); // H0 (depth 1) -> history.back -> a fodraszat-bejegyzes (masik uzletag): a valaszto jon, nem a fodraszat nezete
  const cv = await varTitle(u, true, VALASZTO);
  const fv = await fej(u);
  ok('FEJLEC-VALTAS: a valtas elotti uzletag korabbi nezetere visszalepve a valaszto jon (nem a regi, ervenytelen nezet)', cv === VALASZTO && !!fv && !fv.valt, `${cv} | ${fv && fv.szoveg}`);
  await kattint(u, '#be-close');
  await u.page.waitForTimeout(1500);
  const bent = await u.page.evaluate(() => !!document.querySelector('#mosaic-booking-layer'));
  const url = await u.page.evaluate(() => location.href);
  ok('FEJLEC-VALTAS: az X bezarja a foglalot, az oldal ugyanott marad', !bent && url === eredetiUrl, `${bent ? 'nyitva' : 'zarva'} ${url}`);
  ok('nincs JS-hiba, nincs kimeno meres', u.hibak.length === 0 && u.naplo.mer === 0, u.hibak.join(' | ') + (u.naplo.mer ? ' mer=' + u.naplo.mer : ''));
  await u.ctx.close();
}

// --- 3) ugyanazt az uzletagat valasztja: marad, ahol tartott (a naptar, a munkatars) --------------------------------------------------------------------------------------------
{
  const u = await ujLapReteg();
  await u.page.evaluate((o) => window.openBooking(o), { business: 'hair', service: SVC.serviceId, staff: STAFF.staff_id });
  await R(u).locator('.be-nnap.szabad').first().waitFor({ timeout: 40000 });
  const elotte = await fej(u);
  await kattint(u, '.be-h1-valt');
  await varTitle(u, true, VALASZTO);
  await kattint(u, kartya('Fodrászat'));
  await R(u).locator('.be-nnap.szabad').first().waitFor({ timeout: 15000 }).catch(() => {});
  const utana = await fej(u);
  const naptar = await R(u).locator('.be-nnap.szabad').count();
  ok('UGYANAZ A UZLETAG: a Fodraszatot ujra valasztva visszajon a naptar (nem kezdi elolrol), ugyanazzal a fejleccel', naptar > 0 && !!utana && utana.szoveg === elotte.szoveg, `${elotte && elotte.szoveg} -> ${utana && utana.szoveg}, ${naptar} szabad nap`);
  ok('UGYANAZ A UZLETAG: a naptar elso kepernyojen (depth 0) tovabbra is van vissza nyil', !!utana && utana.backLathato && utana.backFelirat === 'Másik üzletág választása', JSON.stringify(utana && utana.backFelirat));
  // majd a masik uzletag a naptarbol: a fodraszat-adatok nem maradnak meg
  await kattint(u, '.be-h1-valt');
  await varTitle(u, true, VALASZTO);
  await kattint(u, kartya('Head Spa'));
  const ch = await varMas(u, true, VALASZTO);
  const fh = await fej(u);
  ok('NAPTARBOL VALTAS: a Head Spa folyamata nyilik, a fodraszat munkatarsa nem latszik a fejlecben', !!fh && /Head Spa/.test(fh.valtSzoveg) && !new RegExp(String(STAFF.staff_label || 'zzz').split(/\s+/).pop()).test(fh.szoveg), `${ch} | ${fh && fh.szoveg}`);
  await u.ctx.close();
}

// --- 4) az adatlapon (Salonic keret) nincs valtas: a nev sima szoveg, az adatok nem vesznek el ----------------------------------------------------------------------------------
{
  const u = await ujLapReteg();
  await u.page.evaluate((o) => window.openBooking(o), { business: 'hair', service: SVC.serviceId, staff: STAFF.staff_id });
  await R(u).locator('.be-nnap.szabad').first().waitFor({ timeout: 40000 });
  await R(u).locator('.be-idogomb').first().click();
  await u.page.waitForFunction(() => !!document.querySelector('#mosaic-booking-layer')?.shadowRoot?.querySelector('iframe.be-iframe'), null, { timeout: 25000 });
  await u.page.waitForTimeout(800);
  const f = await fej(u);
  ok('ADATLAP: a fejlecben az uzletag sima szoveg (nem gomb: az adatok nem vesznek el veletlenul)', !!f && !f.valt && /Fodrászat/.test(f.szoveg), f && f.szoveg);
  ok('ADATLAP: a vissza nyil "Vissza" (a naptarra), nem az uzletag-valaszto', !!f && f.backLathato && f.backFelirat === 'Vissza', JSON.stringify(f && f.backFelirat));
  await u.ctx.close();
}

// --- 5) a kezdokepernyorol indulva (nincs uzletag): valasztas -> a fejlecben az uzletag gomb; a valaszto marad a "vissza" --------------------------------------------------------
{
  const u = await ujLapReteg();
  await u.page.evaluate(() => window.openBooking({}));
  ok('KEZDOKEPERNYO: uzletag nelkul a valaszto jon, a cimben nincs uzletag, nincs vissza nyil', (await varTitle(u, true, VALASZTO)) === VALASZTO && !(await fej(u)).backLathato && !(await fej(u)).valt, '');
  await kattint(u, kartya('Oxigénterápia'));
  await cim(u, true, 30000);
  const f = await fej(u);
  ok('KEZDOKEPERNYO: valasztas utan a fejlecben a (kattinthato) uzletag, a vissza nyil a valasztora', !!f && f.valt && /Oxigénterápia/.test(f.valtSzoveg) && f.backLathato && f.backFelirat === 'Vissza', JSON.stringify(f));
  await u.ctx.close();
}

// --- 6) onallo oldalon (/foglalo-motor, nincs reteg): ugyanez ---------------------------------------------------------------------------------------------------------------------
{
  const u = await ujLap('/foglalo-motor?business=hair');
  await u.page.waitForSelector('.be-title', { timeout: 30000 });
  const f0 = await fej(u, false);
  ok('OLDAL-MOD (/foglalo-motor): a legelso kepernyon van vissza nyil + kattinthato uzletag', !!f0 && f0.backLathato && f0.valt && f0.backFelirat === 'Másik üzletág választása', JSON.stringify(f0));
  await kattint(u, '#be-back', false);
  ok('OLDAL-MOD: a vissza nyil az uzletag-valasztot nyitja', (await varTitle(u, false, VALASZTO)) === VALASZTO, '');
  await kattint(u, kartya('Lézeres szőrtelenítés'), false);
  await cim(u, false, 30000);
  const f1 = await fej(u, false);
  ok('OLDAL-MOD: a Lezer valasztasa utan a fejlecben Lézeres szőrtelenítés', !!f1 && /Lézeres szőrtelenítés/.test(f1.valtSzoveg), f1 && f1.szoveg);
  ok('OLDAL-MOD: a cim egy sorban, nem vagodik le', !!f1 && !f1.levagva, JSON.stringify(f1 && f1.levagva));
  ok('nincs JS-hiba, nincs kimeno meres', u.hibak.length === 0 && u.naplo.mer === 0, u.hibak.join(' | ') + (u.naplo.mer ? ' mer=' + u.naplo.mer : ''));
  await u.ctx.close();
}

await browser.close();
const hibas = eredmeny.filter((e) => !e.rendben);
console.log(`\n${eredmeny.length} ellenorzes, ${hibas.length} hiba${MOBIL ? ' (mobil)' : ' (asztali)'}`);
if (hibas.length) { for (const e of hibas) console.log('  HIBA:', e.cimke); process.exit(1); }
