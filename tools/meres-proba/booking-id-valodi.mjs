// VALODI (azonnal lemondando) probafoglalas a PR-ELONEZETEN: visszajon-e a foglalo SAJAT booking_id-ja (QA-1) a Salonic sikeres foglalas utani atiranyitasaban?
//
//   node tools/meres-proba/booking-id-valodi.mjs --bazis https://<ag>.mosaic-d77.pages.dev [--utvonal hair-konzult|lezer-konzult] [--out naplo.json] [--szaraz 1]
//   --szaraz 1: szaraz futas - a valodi Salonic-adatlapig megy (az idopontot ~5 percre tartja, foglalas NEM jon letre), kitoltes es kuldes nelkul
//   utana: node tools/meres-proba/lemond.mjs <a kiirt lemondo-URL>
//
// Csak elonezeten fut (az eles domainre a szkript nem enged). Egyetlen foglalas: az ingyenes konzultacio, az utolso szabad nap utolso idopontja (nem foglal el kozeli idopontot),
// "TESZT - Claude" nev (a Zapier probavedelme: nev "teszt", az e-mail a teszt-listan, a telefon a tulajdonos 709420090-es szama: mindharom talal), hirlevel NEM.
// Mit mer: (1) az adatlap (iframe) cimen ott van-e a back=<azonosito>; (2) a Salonic foglalas-kuldes (AJAX) valaszaban a redirect.url tartalmazza-e; (3) a keretet atiranyito koszonooldal
// URL-jeben (bookingUrl) ott van-e. A KIMENO MERES (GA4, Meta, TikTok, Google Ads, Stape, Zapier) tiltott (tilt.mjs), ES az eles koszonooldalt (www.mosaicheadspa.hu) a szkript
// sem tolti be: a keret navigalasat elfogja es egy ures oldallal valaszolja meg, csak a cimet naplozza - igy az eles oldal kodja (suti.js, pixelek) egyaltalan nem fut.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { UA, UA_MOBIL, platformOf, engedett, dnsArg, ures, esemenyIras, esemenyUres } from './tilt.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const BAZIS = arg('bazis', ''), UTVONAL = arg('utvonal', 'hair-konzult'), OUT = arg('out', ''), SZARAZ = arg('szaraz', '0') === '1';
if (!/^https:\/\/[a-z0-9-]+\.mosaic-d77\.pages\.dev$/.test(BAZIS)) throw new Error('csak PR-elonezeten fut (--bazis https://<ag>.mosaic-d77.pages.dev); az eles domainre nem engedett: ' + BAZIS);
const TELEFON = process.env.MERES_TELEFON || '709420090'; // a +36 utani resz: a tulajdonos sajat szama
const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const T0 = Date.now(); const mp = () => Date.now() - T0;
const idovonal = [], naplo = [];
const lepes = (esemeny, extra = {}) => { idovonal.push({ t: mp(), esemeny, ...extra }); console.log(`[${String(mp()).padStart(6)}ms] ${esemeny}`, Object.keys(extra).length ? JSON.stringify(extra).slice(0, 400) : ''); };

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--disable-blink-features=AutomationControlled', dnsArg()] });
const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 900 }, locale: 'hu-HU', timezoneId: 'Europe/Budapest', serviceWorkers: 'block' });
const elesNavigaciok = []; // az eles koszonooldal cimei, amiket a keret tolteni probalt (a szkript NEM tolti be)
await ctx.route('**/*', async (route) => {
  const req = route.request(), url = req.url();
  let u; try { u = new URL(url); } catch (e) { return route.continue(); }
  if (/^(www\.)?mosaicheadspa\.hu$/.test(u.hostname) && req.resourceType() === 'document') { elesNavigaciok.push(url); return route.fulfill({ status: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, body: '<!doctype html><title>eles koszonooldal (a proba nem tolti be)</title>' }); }
  if (esemenyIras(url, req.method())) return route.fulfill(esemenyUres());
  const plat = platformOf(url) || (engedett(url, req.method()) ? null : 'tiltott');
  if (plat) { naplo.push({ t: mp(), plat, metodus: req.method(), host: u.host, ut: u.pathname.slice(0, 60) }); return route.fulfill(ures(req)); }
  return route.continue();
});
const page = await ctx.newPage();
const hibak = []; page.on('pageerror', (e) => hibak.push(String(e.message).slice(0, 160)));
// a Salonic foglalas-kuldese (AJAX POST a /guestData/ cimre): a valasz redirect.url-je a koszonooldal cime
let kuldes = null;
page.on('response', async (r) => {
  try {
    if (r.request().method() !== 'POST' || !/salonic\.hu\/guestData\//.test(r.url())) return;
    const szoveg = await r.text(); let j = null; try { j = JSON.parse(szoveg); } catch (e) { /* nem JSON */ }
    kuldes = { status: r.status(), url: r.url(), json: j, szoveg: j ? null : szoveg.slice(0, 300) };
  } catch (e) { /* a valasz mar nem olvashato */ }
});
const reteg = page.locator('#mosaic-booking-layer');
const lathato = async (loc, ido = 25000) => { await loc.first().waitFor({ state: 'visible', timeout: ido }); return loc.first(); };
const kontextus = () => page.evaluate(() => { try { return JSON.parse(sessionStorage.getItem('mhBookingCtx')); } catch (e) { return null; } });
// szemelyes adat kimaszkolasa a naplobol (a sajat probaadatunk, de a naplo a repoba kerul)
const maszk = (o) => JSON.parse(JSON.stringify(o, (k, v) => (/name|email|phone|tel|mail/i.test(k) && typeof v === 'string' ? '<maszkolva>' : v)));
const osszefoglalo = { bazis: BAZIS, utvonal: UTVONAL };

try {
  await page.goto(BAZIS + '/booking-test', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openBooking === 'function', null, { timeout: 15000 });
  const opts = { 'hair-konzult': { business: 'hair', service: 'konzult' }, 'lezer-konzult': { business: 'laser', service: 'konzult' } }[UTVONAL];
  if (!opts) throw new Error('ismeretlen utvonal: ' + UTVONAL);
  lepes('a motor megnyitasa elott a kontextus', { kontextus: await kontextus() });
  await page.evaluate((o) => window.openBooking(o), opts);
  await lathato(reteg.locator('.be-title'));
  const k0 = await kontextus(); lepes('reteg megnyilt (a folyamat eleje)', { azonosito: k0 && k0.id });
  if (/szakembert|fodrászt/.test(((await reteg.locator('.be-title').first().textContent()) || ''))) { await reteg.locator('.be-choice', { hasText: 'Mindegy' }).first().click(); lepes('szakember: Mindegy (a Salonic oszt be)'); }
  await reteg.locator('.be-nnap.szabad, button:has-text("További időpontok")').first().waitFor({ state: 'visible', timeout: 25000 });
  let ido;
  const szabadNapok = reteg.locator('.be-nnap.szabad');
  if (await szabadNapok.count()) {
    await szabadNapok.nth((await szabadNapok.count()) - 1).click(); await page.waitForTimeout(500);
    const gombok = reteg.locator('.be-idogomb'); const db = await gombok.count();
    ido = (await gombok.nth(db - 1).textContent()).trim(); await gombok.nth(db - 1).click();
  } else {
    await (await lathato(reteg.locator('button', { hasText: 'További időpontok' }))).click();
    const napok = reteg.locator('.be-strip[aria-label="Nap"] .be-chip'); await lathato(napok);
    await napok.nth((await napok.count()) - 1).click();
    await page.waitForTimeout(800);
    const idok = reteg.locator('.be-time'); const db = await idok.count();
    ido = (await idok.nth(db - 1).textContent()).trim(); await idok.nth(db - 1).click();
  }
  lepes('idopont valasztva (az utolso szabad nap utolso idopontja)', { ido });
  await reteg.locator('iframe.be-iframe').waitFor({ state: 'attached', timeout: 30000 });
  const src = await reteg.locator('iframe.be-iframe').getAttribute('src');
  await page.waitForTimeout(4500);
  const fr = page.frames().find((f) => /salonic\.hu\/guestData/.test(f.url()));
  if (!fr) throw new Error('nincs Salonic-keret: ' + page.frames().map((f) => f.url()).join(' | '));
  const k1 = await kontextus();
  Object.assign(osszefoglalo, { azonosito: k1 && k1.id, kontextus_az_adatlapnal: k1, iframe_src: src, iframe_url_betoltve: fr.url() });
  lepes('Salonic-adatlap betoltve', { azonosito: k1 && k1.id, src, betoltott_url: fr.url() });
  const action = await fr.locator('#guestDataForm').getAttribute('action').catch(() => null);
  osszefoglalo.urlap_action = action;
  lepes('az adatlap urlapjanak action-je (a Salonic ezt hasznalja a foglalas-kuldeshez)', { action, tartalmazza_az_azonositot: !!(action && k1 && action.includes(k1.id)) });
  if (SZARAZ) { lepes('SZARAZ FUTAS: itt megallok, foglalas nem jott letre'); throw new Error('szaraz-futas-vege'); }
  const tolt = async (sel, ertek) => { const l = fr.locator(sel).first(); await l.click(); await l.pressSequentially(ertek, { delay: 45 }); };
  await tolt('#GuestDataForm_guestPhoneTemp', TELEFON);
  await tolt('#GuestDataForm_guestLastName', 'TESZT –');
  await tolt('#GuestDataForm_guestFirstName', 'Claude');
  await tolt('#GuestDataForm_guestEmail', 'deakfi@grantis.hu');
  await fr.locator('#GuestDataForm_acceptTerms').check(); // csak a feltetel (hirlevel NEM)
  if (await page.locator('iframe[src*="recaptcha"][src*="bframe"]').count()) throw new Error('RECAPTCHA-KIHIVAS: megallok');
  lepes('urlap kitoltve, kuldes', { ido: new Date().toISOString() });
  await fr.locator('#button-submit-booking').click();
  const t1 = Date.now();
  while (Date.now() - t1 < 60000 && !(kuldes && elesNavigaciok.length)) await page.waitForTimeout(500);
  await page.waitForTimeout(1500);
  const j = kuldes && kuldes.json;
  const redirectUrl = j && j.redirect && j.redirect.url;
  const bookingUuid = j && j.booking && j.booking.id;
  lepes('foglalas-kuldes valasza (AJAX)', { status: kuldes && kuldes.status, kuldes_url: kuldes && kuldes.url, kulcsok: j && Object.keys(j), booking_kulcsok: j && j.booking && Object.keys(j.booking), booking_id: bookingUuid, redirect_url: redirectUrl });
  Object.assign(osszefoglalo, { kuldes_url: kuldes && kuldes.url, kuldes_status: kuldes && kuldes.status, ajax_valasz_maszkolva: j ? maszk(j) : kuldes && kuldes.szoveg, salonic_booking_id: bookingUuid || null, redirect_url: redirectUrl || null, kereten_at_probalt_eles_navigaciok: elesNavigaciok });
  const mind = [redirectUrl, ...elesNavigaciok].filter(Boolean);
  const azon = osszefoglalo.azonosito;
  const hol = [];
  for (const x of mind) {
    let uu; try { uu = new URL(x); } catch (e) { continue; }
    for (const [k, v] of uu.searchParams) { if (v === azon) hol.push('param:' + k); if (k === 'bookingUrl') { try { for (const [k2, v2] of new URL(v).searchParams) if (v2 === azon) hol.push('bookingUrl:' + k2); } catch (e) { /* nem URL */ } } }
    if (x.includes(azon) && !hol.length) hol.push('az URL maskent tartalmazza');
  }
  osszefoglalo.visszajott = hol.length > 0; osszefoglalo.hol = [...new Set(hol)];
  osszefoglalo.kontextus_a_vegen = await kontextus();
  lepes('EREDMENY', { azonosito: azon, visszajott: osszefoglalo.visszajott, hol: osszefoglalo.hol });
  if (bookingUuid) {
    const host = new URL(kuldes.url).host;
    osszefoglalo.lemondo_url = `https://${host}/booking/cancelBooking/${bookingUuid}`;
    console.log('\nLEMONDO URL (azonnal lemondani: node tools/meres-proba/lemond.mjs <url>):', osszefoglalo.lemondo_url);
  } else console.log('\nFIGYELEM: nincs foglalas-azonosito a valaszban: a foglalas letrejotte nem igazolt, a lemondast az e-mailbol kell elvegezni.');
} catch (e) { if (e.message !== 'szaraz-futas-vege') { lepes('HIBA', { uzenet: String(e.message || e).slice(0, 300) }); osszefoglalo.hiba = String(e.message || e).slice(0, 300); } }
const keresek = {}; for (const n of naplo) { const k = `${n.plat} ${n.host}${n.ut}`; keresek[k] = (keresek[k] || 0) + 1; }
console.log('\nTiltott / naplozott kimeno keresek (semmi nem ment ki):'); for (const [k, v] of Object.entries(keresek).sort()) console.log(' ', v + 'x', k);
console.log('JS-hibak:', hibak.length ? hibak.join(' | ') : 'nincs');
if (OUT) fs.writeFileSync(OUT, JSON.stringify({ osszefoglalo, idovonal, tiltott_kimeno_keresek: keresek, hibak }, null, 1));
await browser.close();
