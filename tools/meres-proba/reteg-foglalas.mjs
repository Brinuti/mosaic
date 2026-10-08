// VALODI foglalas a retegen at (a Salonic elo naptara): az utolso szabad nap utolso idopontjara, "TESZT - Claude" nevvel. A lemondas kulon: lemond.mjs.
//
//   node tools/meres-proba/reteg-foglalas.mjs --bazis https://www.mosaicheadspa.hu|https://<ag>.mosaic-d77.pages.dev --utvonal h0-headspa|hair-konzult|... [--overlay dist] [--mobil 1] [--out naplo.json]
//
// Utvonalak: h0-headspa (szolgaltatas-elso: Head Spa -> Egyeni HeadSpa -> havi naptar), hair-konzult, oxigen-1, oxigen-2, lezer-konzult.
// A kimeno meres (capig.stape.do is) alapbol tiltva (tilt.mjs), a naplo a tiltott kereseket is tartalmazza. A telefonszam: MERES_TELEFON (alap: a tulajdonos sajat szama; a szalon szama egy valodi vendeg kartonjahoz tartozik a Salonicban).
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { UA, UA_MOBIL, platformOf, engedett, dnsArg, ures, esemenyIras, esemenyUres } from './tilt.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const BAZIS = arg('bazis', 'https://www.mosaicheadspa.hu'), UTVONAL = arg('utvonal', 'hair-konzult'), OVERLAY = arg('overlay', ''), MOBIL = arg('mobil', '0') === '1', OUT = arg('out', '');
const TELEFON = process.env.MERES_TELEFON || '709420090'; // a +36 utani resz: a tulajdonos sajat szama (a szalon szama egy valodi vendeg kartonjara parosulna)
const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let fajlUtvonal = null;
if (OVERLAY) ({ fajlUtvonal } = await import('../serve-dist.mjs'));
const TIPUS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
const ua = MOBIL ? UA_MOBIL : UA;
const T0 = Date.now(); const mp = () => Date.now() - T0;
const idovonal = [], naplo = [], jegyzettombIras = []; // jegyzettombIras: a (blokkolt) foglalasi jegyzettomb-jelzesek

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--disable-blink-features=AutomationControlled', dnsArg()] });
const ctx = await browser.newContext({ userAgent: ua, viewport: MOBIL ? { width: 390, height: 844 } : { width: 1280, height: 900 }, locale: 'hu-HU', timezoneId: 'Europe/Budapest', serviceWorkers: 'block', isMobile: MOBIL, hasTouch: MOBIL });
await ctx.route('**/*', async (route) => {
  const req = route.request(), url = req.url();
  let u; try { u = new URL(url); } catch (e) { return route.continue(); }
  if (OVERLAY && u.origin === BAZIS && req.method() === 'GET') {
    const e = fajlUtvonal(decodeURIComponent(u.pathname), req.headers()['user-agent'] || ua);
    if (e.atiranyit) return route.fulfill({ status: 301, headers: { location: encodeURI(e.atiranyit) + u.search } });
    if (fs.existsSync(e.fajl) && fs.statSync(e.fajl).isFile()) {
      let body = fs.readFileSync(e.fajl);
      if (body.length < 80 && /^[\w./-]+\.html$/.test(body.toString('utf8').trim())) { const cel = path.join(path.dirname(e.fajl), body.toString('utf8').trim()); if (fs.existsSync(cel)) body = fs.readFileSync(cel); }
      return route.fulfill({ status: 200, headers: { 'content-type': TIPUS[path.extname(e.fajl)] || 'application/octet-stream', 'cache-control': 'no-store' }, body });
    }
  }
  if (esemenyIras(url, req.method())) { jegyzettombIras.push(req.postData()); return route.fulfill(esemenyUres()); } // a foglalasi jegyzettombbe a proba nem irhat (tilt.mjs); a jelzest naplozzuk
  const plat = platformOf(url) || (engedett(url, req.method()) || u.origin === BAZIS ? null : 'tiltott');
  if (plat) { naplo.push({ t: mp(), plat, metodus: req.method(), host: u.host, ut: u.pathname.slice(0, 60), keret: req.frame() === page.mainFrame() ? 'FO' : (req.frame() && req.frame().url().slice(0, 70)) }); return route.fulfill(ures(req)); }
  return route.continue();
});
const page = await ctx.newPage();
const hibak = [];
page.on('pageerror', (e) => hibak.push(String(e.message).slice(0, 160)));
const lepes = (esemeny, extra = {}) => { idovonal.push({ t: mp(), esemeny, ...extra }); console.log(`[${String(mp()).padStart(6)}ms] ${esemeny}`, Object.keys(extra).length ? JSON.stringify(extra).slice(0, 160) : ''); };
const reteg = page.locator('#mosaic-booking-layer');
const lathato = async (loc, ido = 25000) => { await loc.first().waitFor({ state: 'visible', timeout: ido }); return loc.first(); };

try {
  await page.goto(BAZIS + '/booking-test', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openBooking === 'function', null, { timeout: 15000 });
  const opts = { 'h0-headspa': {}, 'hair-konzult': { business: 'hair', service: 'konzult' }, 'oxigen-1': { business: 'oxygen', service: '466110' }, 'oxigen-2': { business: 'oxygen', service: '466158' }, 'lezer-konzult': { business: 'laser', service: 'konzult' } }[UTVONAL];
  if (!opts) throw new Error('ismeretlen utvonal: ' + UTVONAL);
  await page.evaluate((o) => window.openBooking(o), opts);
  await lathato(reteg.locator('.be-title'));
  lepes('reteg megnyilt', { utvonal: UTVONAL, url: page.url().slice(0, 120) });
  if (UTVONAL === 'h0-headspa') {
    await (await lathato(reteg.locator('.be-choice', { hasText: 'Head Spa' }))).click(); lepes('H0: Head Spa');
    await (await lathato(reteg.locator('.be-choice', { hasText: 'Normál foglalás' }))).click(); lepes('HS1: Normál foglalás (kuponkód nélkül)');
    await (await lathato(reteg.locator('.be-choice', { hasText: 'Egyéni HeadSpa' }))).click(); lepes('HS2: Egyéni HeadSpa');
  }
  // szakember-valaszto (oxigen / fodraszat): "Mindegy" (a Salonic oszt be)
  if (/szakembert|fodrászt/.test(((await reteg.locator('.be-title').first().textContent()) || ''))) { await reteg.locator('.be-choice', { hasText: 'Mindegy' }).first().click(); lepes('szakember: Mindegy'); }
  // idopont: HeadSpan a PMU-foglalo havi naptara (az utolso szabad nap utolso idopontja), egyebkent a "tovabbi idopontok" naptar-sav
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
  lepes('időpont választva', { ido });
  // az ujban rogton az adatlap; a regi motornal elobb az osszegzo kepernyo (C3) jott
  await reteg.locator('button:has-text("Tovább az adatokhoz"), iframe.be-iframe').first().waitFor({ state: 'attached', timeout: 30000 });
  const tovabb = reteg.locator('button', { hasText: 'Tovább az adatokhoz' });
  if (await tovabb.count()) { lepes('összegzés (C3, a régi motoron)'); await tovabb.first().click(); }
  await reteg.locator('iframe.be-iframe').waitFor({ state: 'attached', timeout: 30000 });
  await page.waitForTimeout(4500);
  const fr = page.frames().find((f) => /salonic\.hu\/guestData/.test(f.url()));
  if (!fr) throw new Error('nincs Salonic-keret: ' + page.frames().map((f) => f.url()).join(' | '));
  lepes('Salonic-adatlap betöltve (a rétegben)', { keret: fr.url().slice(0, 100) });
  const tolt = async (sel, ertek) => { const l = fr.locator(sel).first(); await l.click(); await l.pressSequentially(ertek, { delay: 45 }); };
  await tolt('#GuestDataForm_guestPhoneTemp', TELEFON);
  await tolt('#GuestDataForm_guestLastName', 'TESZT –');
  await tolt('#GuestDataForm_guestFirstName', 'Claude');
  await tolt('#GuestDataForm_guestEmail', 'deakfi@grantis.hu');
  await fr.locator('#GuestDataForm_acceptTerms').check(); // csak a feltetel (hirlevel NEM)
  if (await page.locator('iframe[src*="recaptcha"][src*="bframe"]').count()) throw new Error('RECAPTCHA-KIHIVAS: megallok');
  lepes('űrlap kitöltve, küldés', { ido: new Date().toISOString() });
  await fr.locator('#button-submit-booking').click();
  // a vegeredmeny: a motor sikerkepernyoje (C6) / ellenorizetlen (A3U), vagy a keretben a (nem ertesito) koszonooldal
  const t1 = Date.now(); let veg = null;
  while (Date.now() - t1 < 60000 && !veg) {
    const c = reteg.locator('.be-title'); const cim = (await c.count()) ? (await c.first().textContent()).trim() : '';
    if (/Sikeres foglalás|Foglalásod sikeres|A foglalásodat feldolgoztuk|Ez az időpont közben elkelt|Most nem tudjuk/.test(cim)) veg = cim;
    else if (page.url().includes('bookingUrl=')) veg = 'A FO ABLAK koszonooldalra navigalt: ' + page.url().slice(0, 100);
    else await page.waitForTimeout(700);
  }
  const keretUrlok = page.frames().map((f) => f.url().slice(0, 120));
  lepes('vég', { veg, keretek: keretUrlok.filter((x) => !x.startsWith('about:')) });
  lepes('jegyzettomb-jelzes (blokkolva, nem ment ki)', { db: jegyzettombIras.length, tartalom: jegyzettombIras[0] || null }); // valodi, ellenorzott foglalasnal EGY jelzes (az eles atadasnal is: keepalive)
  const c6 = reteg.locator('.be-kosz-kartya');
  if (await c6.count()) lepes('sikerkepernyo kartya', { szoveg: (await c6.first().textContent()).replace(/\s+/g, ' ').trim().slice(0, 240) });
  await page.waitForTimeout(6000);
} catch (e) { lepes('HIBA', { uzenet: String(e.message || e).slice(0, 300) }); }
const keresek = {}; for (const n of naplo) { const k = `${n.plat} ${n.host}${n.ut}`; keresek[k] = (keresek[k] || 0) + 1; }
console.log('\nTiltott / naplózott kimenő kérések (semmi nem ment ki):'); for (const [k, v] of Object.entries(keresek).sort()) console.log(' ', v + 'x', k);
if (OUT) fs.writeFileSync(OUT, JSON.stringify({ utvonal: UTVONAL, bazis: BAZIS, idovonal, naplo, hibak }, null, 1));
await browser.close();
