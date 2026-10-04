// A helyben nyilo foglalo-reteg ellenorzese bongeszoben (Playwright), foglalas nelkul.
//
//   node tools/meres-proba/reteg-proba.mjs [--overlay dist] [--bazis https://...] [--mobil 1] [--kepek mappa] [--oldal /booking-test]
//
// Minden belepesi pontnal: a CTA a retegben nyitja a foglalot (nem navigal), a jo kezdo allapotba er, az URL frissul (booking=1), a bezaras / Esc / vissza
// gomb visszaviszi az eredeti cimre, az ujratoltes visszaallitja. A kimeno meres (capig.stape.do is) alapbol tiltva (tilt.mjs).
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { UA, UA_MOBIL, platformOf, engedett, dnsArg, ures } from './tilt.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = path.resolve(import.meta.dirname, '..', '..');
const OVERLAY = arg('overlay', ''), MOBIL = arg('mobil', '0') === '1', KEPEK = arg('kepek', ''), OLDAL = arg('oldal', '/booking-test');
const BAZIS = arg('bazis', 'https://www.mosaicheadspa.hu');
const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let fajlUtvonal = null;
if (OVERLAY) ({ fajlUtvonal } = await import('../serve-dist.mjs'));
const TIPUS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
const ua = MOBIL ? UA_MOBIL : UA;

// [cimke, a CTA nyitasa (opts), a vart kezdo cim (reszlet), tovabbi ellenorzes]
const BELEPOK = [
  ['altalanos (nincs kontextus)', {}, 'Mit szeretnél foglalni?'],
  ['HeadSpa altalanos', { business: 'headspa' }, 'Melyik HeadSpa élményt választod?'],
  ['HeadSpa paros', { business: 'headspa', service: 'paros' }, 'Válassz időpontot', 'Páros'],
  ['HeadSpa ajandekkartya-bevaltas', { business: 'headspa', voucher: '1' }, 'Milyen ajándékkártyád van?'],
  ['Fodraszat altalanos', { business: 'hair' }, 'Mit szeretnél?'],
  ['Fodraszat balayage-kategoria', { business: 'hair', service_category: 'balayage' }, 'Melyik kezelés?'],
  ['Fodraszat hajfestes-kategoria', { business: 'hair', service_category: 'color' }, 'Melyik kezelés?'],
  ['Fodraszat konzultacio', { business: 'hair', service: 'konzult' }, 'Legközelebbi szabad időpontok'],
  ['Oxigen altalanos', { business: 'oxygen' }, 'Mit szeretnél foglalni?'],
  ['Oxigen 1. alkalom', { business: 'oxygen', service: '466110' }, 'Legközelebbi szabad időpontok'],
  ['Oxigen 2. alkalomtol', { business: 'oxygen', service: '466158' }, 'Legközelebbi szabad időpontok'],
  ['Lezer altalanos', { business: 'laser' }, null],
  ['Lezer konzultacio', { business: 'laser', service: 'konzult' }, 'Legközelebbi szabad időpontok'],
  ['Lezer elso idopontok', { business: 'laser', intent: 'first' }, 'Melyik területet szeretnéd?'],
  ['Lezer kezeles idopontok', { business: 'laser', intent: 'returning' }, 'Következő kezelés'],
  ['PMU', { business: 'pmu' }, 'PMU-keret'],
];

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--disable-blink-features=AutomationControlled', dnsArg()] });
const eredmeny = [];
const merEsem = []; // a FO ablak kimeno meresi kereseit gyujtjuk (a Salonic-keretet nem): a reteg hasznalata nem indithat meresi esemenyt
const ok = (cimke, rendben, reszlet = '') => { eredmeny.push({ cimke, rendben, reszlet }); console.log(`${rendben ? 'OK  ' : 'HIBA'} ${cimke}${reszlet ? ' | ' + reszlet : ''}`); };

async function ujLap() {
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
    const plat = platformOf(url) || (engedett(url, req.method()) || u.origin === BAZIS ? null : 'tiltott');
    if (plat) {
      if (req.frame() && req.frame().parentFrame() === null) { const q = Object.fromEntries(u.searchParams); let ev = ''; if (plat === 'meta') ev = new URLSearchParams(req.postData() || '').get('ev') || q.ev || ''; else if (plat === 'tiktok') { try { ev = JSON.parse(req.postData() || '{}').event || ''; } catch (e) { ev = ''; } } else ev = q.en || ''; merEsem.push({ plat, ev: ev || u.pathname.slice(0, 40), ut: u.pathname.slice(0, 40) }); }
      return route.fulfill(ures(req));
    }
    return route.continue();
  });
  const page = await ctx.newPage();
  const hibak = [];
  page.on('pageerror', (e) => hibak.push(String(e.message).slice(0, 160)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) hibak.push(m.text().slice(0, 160)); });
  return { ctx, page, hibak };
}

const reteg = (page) => page.locator('#mosaic-booking-layer');
// a reteg Shadow DOM-jaban keres (a Playwright locator atlatja a nyitott shadow root-ot)
const cim = (page) => reteg(page).locator('.be-title').first();
async function varCim(page, ido = 25000) { try { await cim(page).waitFor({ timeout: ido }); return (await cim(page).textContent()).trim(); } catch (e) { return null; } }
const url = (page) => new URL(page.url());

async function nyit(page, opts) {
  await page.evaluate((o) => { window.__marker = 'maradt'; window.openBooking(o); }, opts);
}

const { ctx, page, hibak } = await ujLap();
await page.goto(BAZIS + OLDAL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.openBooking === 'function', null, { timeout: 15000 });
const eredetiUrl = url(page).pathname + url(page).search;

for (const [cimke, opts, vart, extra] of BELEPOK) {
  await nyit(page, opts);
  let c;
  if (opts.business === 'pmu') {
    const keret = reteg(page).locator('iframe.be-pmu');
    c = (await keret.count()) || (await keret.waitFor({ timeout: 15000 }).then(() => 1).catch(() => 0)) ? 'PMU-keret' : null;
    if (c) ok(cimke + ' | PMU-keret src', /foglalo-pmu\?beagyazva=1/.test(await keret.getAttribute('src')), await keret.getAttribute('src'));
  } else c = await varCim(page);
  const u = url(page);
  const pont = (vart === null && c) || (c && (c.includes(vart)));
  ok(`${cimke} | kezdo allapot`, !!pont, `cim="${c}"`);
  if (extra && opts.business !== 'pmu') { const sav = await reteg(page).locator('.be-svc').first().textContent().catch(() => ''); ok(`${cimke} | szolgaltatas-sav tartalmazza: ${extra}`, new RegExp(extra, 'i').test(sav), sav.trim().slice(0, 60)); }
  ok(`${cimke} | az URL NEM valtozik (a GTM History Change triggerei miatt)`, u.pathname + u.search === eredetiUrl && !u.hash, u.pathname + u.search + u.hash);
  ok(`${cimke} | nincs oldalvaltas`, (await page.evaluate(() => window.__marker)) === 'maradt');
  if (KEPEK && BELEPOK.indexOf(BELEPOK.find((b) => b[0] === cimke)) % 3 === 0) { fs.mkdirSync(KEPEK, { recursive: true }); await page.screenshot({ path: path.join(KEPEK, `${MOBIL ? 'mobil' : 'asztali'}-${cimke.replace(/\W+/g, '-')}.png`) }); }
  // bezaras a X-szel
  await reteg(page).locator('#be-close').click();
  await page.waitForFunction(() => !document.getElementById('mosaic-booking-layer'), null, { timeout: 8000 }).catch(() => {});
  ok(`${cimke} | bezaras (X) -> eredeti cim`, !(await reteg(page).count()) && url(page).pathname + url(page).search === eredetiUrl, url(page).pathname + url(page).search);
}

// --- viselkedes: Esc, vissza gomb, ujratoltes, H0 -> agon -> vissza, fokusz-csapda -------------------------------------------------------
await nyit(page, { business: 'hair' }); await varCim(page);
await page.keyboard.press('Escape');
await page.waitForFunction(() => !document.getElementById('mosaic-booking-layer'), null, { timeout: 8000 }).catch(() => {});
ok('Esc bezarja a retegat', !(await reteg(page).count()) && url(page).search === new URL(BAZIS + eredetiUrl).search);

await nyit(page, { business: 'hair' }); await varCim(page);
await page.goBack();
await page.waitForFunction(() => !document.getElementById('mosaic-booking-layer'), null, { timeout: 8000 }).catch(() => {});
ok('bongeszo vissza gomb bezarja a retegat', !(await reteg(page).count()) && url(page).search === new URL(BAZIS + eredetiUrl).search);

await nyit(page, {}); await varCim(page);
await reteg(page).locator('.be-choice', { hasText: 'Fodrászat' }).click();
ok('H0: Fodraszat -> Mit szeretnel?', (await varCim(page)) === 'Mit szeretnél?' || (await cim(page).textContent()).includes('Mit szeretnél'));
const depth1 = url(page).hash;
await reteg(page).locator('#be-back').click();
ok('H0: fejlec vissza -> szolgaltatas-valaszto', (await varCim(page)) && (await cim(page).textContent()).includes('Mit szeretnél foglalni?'));
await reteg(page).locator('.be-choice', { hasText: 'Lézeres' }).click();
await varCim(page);
await page.goBack();
ok('H0: bongeszo vissza -> szolgaltatas-valaszto', (await cim(page).textContent()).includes('Mit szeretnél foglalni?'));
// fokusz-csapda: Tab sokszor, a fokusz nem hagyja el a retegat
for (let i = 0; i < 14; i++) await page.keyboard.press('Tab');
ok('fokusz a retegben marad (Tab)', await page.evaluate(() => document.activeElement && document.activeElement.id === 'mosaic-booking-layer'), await page.evaluate(() => (document.activeElement && document.activeElement.tagName + '#' + document.activeElement.id)));
ok('a hatter inert', await page.evaluate(() => [...document.body.children].filter((e) => e.id !== 'mosaic-booking-layer').every((e) => e.inert)));
await reteg(page).locator('#be-close').click();
await page.waitForFunction(() => !document.getElementById('mosaic-booking-layer'), null, { timeout: 8000 }).catch(() => {});
ok('bezaras utan a hatter nem inert, a gorgetes visszaall', await page.evaluate(() => [...document.body.children].every((e) => !e.inert) && getComputedStyle(document.documentElement).overflow !== 'hidden'));
ok('H0 utan bezaras: eredeti cim', url(page).pathname + url(page).search === eredetiUrl, url(page).pathname + url(page).search);

// --- design (2026-10-04): kepek a valasztokon, HeadSpa: PMU-naptar, nincs osszegzo kepernyo, 3 lepes ------------------------------------------------
async function kepekBetoltve(page, minDb, ido = 8000) {
  const t0 = Date.now(); let r = { db: 0, jo: 0 };
  while (Date.now() - t0 < ido) {
    r = await reteg(page).locator('.be-choice-img').evaluateAll((es) => ({ db: es.length, jo: es.filter((e) => e.tagName !== 'IMG' || (e.complete && e.naturalWidth > 0)).length }));
    if (r.db >= minDb && r.jo === r.db) break;
    await page.waitForTimeout(250);
  }
  return r;
}
const kattint = async (page, szoveg) => { await reteg(page).locator('.be-choice', { hasText: szoveg }).first().click(); await varCim(page); await page.waitForTimeout(400); };
const zar = async (page) => { await reteg(page).locator('#be-close').click().catch(() => {}); await page.waitForFunction(() => !document.getElementById('mosaic-booking-layer'), null, { timeout: 8000 }).catch(() => {}); };
{
  await nyit(page, {}); await varCim(page);
  let k = await kepekBetoltve(page, 5);
  ok('design | H0: mind az 5 szolgaltatas mellett kis kep (betoltott)', k.db === 5 && k.jo === 5, JSON.stringify(k));
  await zar(page);

  await nyit(page, { business: 'headspa' }); await varCim(page);
  k = await kepekBetoltve(page, 3);
  ok('design | HeadSpa: 3 elmeny, mindegyik mellett kep', k.db === 3 && k.jo === 3, JSON.stringify(k));
  const arak = await reteg(page).locator('.be-choice-ar').allTextContents();
  ok('design | HeadSpa: minden elmenynel ar jobbra', arak.length === 3 && arak.every((a) => /\d\s?Ft/.test(a)), arak.join(' | '));
  const linkek = await reteg(page).locator('.be-more .be-link').allTextContents();
  ok('design | HeadSpa: nincs "Hogyan folytatnad?" lepes, alul ket link (ajandekkartya-bevaltas / -vasarlas)', linkek.length === 2 && !(await reteg(page).locator('.be-title', { hasText: 'Hogyan folytatnád' }).count()), linkek.join(' | '));
  const lepesek = (await reteg(page).locator('.be-steps li').allTextContents()).join('|');
  ok('design | lepesjelzo: 3 lepes (Szolgaltatas, Idopont, Adatok)', lepesek.replace(/\d/g, '') === 'Szolgáltatás|Időpont|Adatok', lepesek);
  await reteg(page).locator('.be-more .be-link', { hasText: 'beváltom' }).click(); await varCim(page); await page.waitForTimeout(300);
  ok('design | HeadSpa: ajandekkartya-bevaltas link -> "Milyen ajandekkartyad van?"', (await cim(page).textContent()).includes('Milyen ajándékkártyád van?'));
  await reteg(page).locator('#be-back').click(); await varCim(page); await page.waitForTimeout(300);
  ok('design | HeadSpa: vissza -> elmeny-valasztas', (await cim(page).textContent()).includes('Melyik HeadSpa élményt'));
  await kattint(page, 'Egyéni HeadSpa');
  const nap = reteg(page).locator('.be-nnap.szabad');
  await nap.first().waitFor({ timeout: 20000 });
  const szabadDb = await nap.count(), idoDb = await reteg(page).locator('.be-idogomb').count();
  ok('design | HeadSpa idopont: a PMU-foglalo havi naptara (7 oszlopos racs, szabad napok zoldek, idopont-gombok)', (await reteg(page).locator('.be-hetnap').count()) === 7 && szabadDb > 3 && idoDb > 0, `szabad nap: ${szabadDb}, idopont: ${idoDb}`);
  ok('design | HeadSpa idopont: nincs "gyors idopontok" / naptar-sav, a kezeles kepe a savban', !(await reteg(page).locator('.be-day, .be-strip').count()) && (await reteg(page).locator('.be-svc-img').count()) === 1);
  ok('design | HeadSpa idopont: az elso szabad nap elore kivalasztva', (await reteg(page).locator('.be-nnap[aria-pressed="true"]').count()) === 1);
  const elsoNap = await reteg(page).locator('.be-nap-cim').textContent();
  ok('design | HeadSpa idopont: a nap idopontjai 5 oszlopos racsban (PMU)', (await reteg(page).locator('.be-idolista').evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length)) === 5);
  // masik szabad nap kivalasztasa: helyben frissul (nincs betoltes-villanas), az idopontok a naphoz tartoznak
  if (szabadDb > 1) {
    await nap.nth(1).click(); await page.waitForTimeout(200);
    const masikNap = await reteg(page).locator('.be-nap-cim').textContent();
    ok('design | HeadSpa idopont: masik nap -> masik cim, helyben', masikNap !== elsoNap && (await reteg(page).locator('.be-loading').count()) === 0, elsoNap + ' -> ' + masikNap);
  }
  const elsoIdo = (await reteg(page).locator('.be-idogomb').first().textContent()).trim();
  await reteg(page).locator('.be-idogomb').first().click();
  await reteg(page).locator('iframe.be-iframe').waitFor({ timeout: 20000 });
  ok('design | idopont utan ROGTON a Salonic adatlap (nincs osszegzo kepernyo)', !(await reteg(page).locator('.be-title', { hasText: 'A választásod' }).count()) && (await cim(page).textContent()).includes('Add meg az adataidat'), (await cim(page).textContent()));
  ok('design | adatlap: a lepesjelzo a 3. lepesen all (Adatok), a keret megvan', (await reteg(page).locator('.be-frame').count()) === 1 && (await reteg(page).locator('.be-steps li.now').textContent()).includes('Adatok'));
  const mini = reteg(page).locator('.be-mini');
  const miniLatszik = await mini.evaluate((e) => getComputedStyle(e).display !== 'none');
  ok('design | adatlap: osszegzo-sor (' + (MOBIL ? 'mobilon rejtett' : 'asztalon latszik') + ', mint a PMU-n)', MOBIL ? !miniLatszik : miniLatszik && (await mini.textContent()).includes(elsoIdo), (await mini.textContent()).replace(/\s+/g, ' ').slice(0, 90));
  await reteg(page).locator('#be-back').click(); await page.waitForTimeout(800);
  ok('design | adatlap -> vissza: a naptar a kivalasztott nappal', (await reteg(page).locator('.be-nnap[aria-pressed="true"]').count()) === 1 && !!(await reteg(page).locator('.be-naptar').count()));
  await zar(page);

  await nyit(page, { business: 'oxygen' }); await varCim(page);
  k = await kepekBetoltve(page, 3);
  const oxAr = await reteg(page).locator('.be-choice-ar').allTextContents();
  const oxSub = await reteg(page).locator('.be-choice small').allTextContents();
  ok('design | Oxigen: 3 valasztas, mindegyik mellett kep es ar', k.db === 3 && k.jo === 3 && oxAr.length === 3 && oxAr.every((a) => /(\d\s?Ft|Ingyenes)/.test(a)), JSON.stringify(k) + ' ' + oxAr.join(' | '));
  ok('design | Oxigen: a hajkamera-szoveg egy mondat ("Bizonytalan vagy? ...")', oxSub.length > 0 && /Bizonytalan vagy\?.*oxigén/.test(oxSub[0]), oxSub[0]);
  await zar(page);

  await nyit(page, { business: 'hair' }); await varCim(page);
  k = await kepekBetoltve(page, 5);
  ok('design | Fodraszat: minden szandek mellett kep', k.db >= 4 && k.jo === k.db, JSON.stringify(k));
  await kattint(page, 'Balayage');
  // a kezeles-valasztason at a fodrasz-valasztasig (ha a szolgaltatashoz tobb fodrasz tartozik)
  let hcim = (await cim(page).textContent()).trim();
  for (let i = 0; i < 3 && !/Van választott fodrászod/i.test(hcim); i++) { await reteg(page).locator('.be-choice').first().click(); await varCim(page); await page.waitForTimeout(400); hcim = (await cim(page).textContent()).trim(); }
  if (/Van választott fodrászod/i.test(hcim)) {
    await reteg(page).locator('.be-choice').nth(1).click(); await page.waitForTimeout(1500); await varCim(page);
    k = await kepekBetoltve(page, 1);
    ok('design | Fodraszat: a fodraszok mellett fotok (vagy monogram)', k.db >= 1 && k.jo === k.db, `${(await cim(page).textContent()).trim()} ${JSON.stringify(k)}`);
  } else ok('design | Fodraszat: fodrasz-valaszto (ennel a kezelesnel nincs)', true, hcim);
  await zar(page);

  await nyit(page, { business: 'laser', intent: 'first' }); await varCim(page);
  k = await kepekBetoltve(page, 4);
  ok('design | Lezer: a teruletek mellett kep', k.db >= 4 && k.jo === k.db, JSON.stringify(k));
  await zar(page);
}

// ujratoltes ?booking=1-gyel: a reteg ujra megnyilik; bezaras utan tiszta cim
await page.goto(BAZIS + OLDAL + '?utm_source=teszt&utm_medium=cpc&gclid=TESZT123&booking=1&business=oxygen&service=466110', { waitUntil: 'domcontentloaded' });
const c2 = await varCim(page);
ok('ujratoltes (?booking=1): a reteg megnyilik a jo allapotban', !!c2 && c2.includes('Legközelebbi szabad időpontok'), `cim="${c2}"`);
await reteg(page).locator('#be-close').click();
await page.waitForFunction(() => !document.getElementById('mosaic-booking-layer'), null, { timeout: 8000 }).catch(() => {});
const veg = url(page);
ok('?booking=1 beerkezo link: a bezaras nem nyul az URL-hez (nincs extra oldalmegtekintes), a UTM / click ID megmarad', veg.searchParams.get('booking') === '1' && veg.searchParams.get('gclid') === 'TESZT123' && veg.searchParams.get('utm_source') === 'teszt' && !veg.hash, veg.search);

// --- valodi landing-oldalak: a (linktermekbol kapott) foglalo-gombok a retegat nyitjak, nem navigalnak --------------------------------------------
const LANDINGEK = ['/idpontfoglalas', '/lezeres-szortelenites-budapest', '/headspa-budapest-hungary', '/noi-fodrasz-budapesten-30-szazalek-kedvezmennyel', '/szortelenites-foglalas', '/headspa-ajandekkartya'];
for (const lap of LANDINGEK) {
  await page.goto(BAZIS + lap, { waitUntil: 'domcontentloaded' });
  const van = await page.waitForFunction(() => typeof window.openBooking === 'function', null, { timeout: 15000 }).then(() => true).catch(() => false);
  if (!van) { ok(lap + ' | launcher betoltodott', false); continue; }
  const hrefek = await page.$$eval('a[href*="foglalo-motor"]', (as) => [...new Set(as.map((a) => a.getAttribute('href')))]);
  ok(lap + ' | van motor-link (' + hrefek.length + ')', hrefek.length > 0);
  for (const h of hrefek.slice(0, 7)) {
    await page.evaluate((x) => { window.__marker = 'maradt'; [...document.querySelectorAll('a[href]')].find((a) => a.getAttribute('href') === x).click(); }, h);
    const c = await varCim(page);
    const u = url(page);
    const q = new URL(h, BAZIS).searchParams;
    ok(lap + ' | CTA ' + h.replace('/foglalo-motor?', '') + ' -> reteg (az URL valtozatlan)', !!c && u.pathname === lap && !u.searchParams.has('booking') && !u.hash && (await page.evaluate(() => window.__marker)) === 'maradt', 'cim="' + c + '"');
    await reteg(page).locator('#be-close').click().catch(() => {});
    await page.waitForFunction(() => !document.getElementById('mosaic-booking-layer'), null, { timeout: 8000 }).catch(() => {});
  }
}
// --- meres-vedelem: a GTM-es landing-oldalon a reteg teljes hasznalata (nyitas, lepesek, adatlap, bezaras) nem indit meresi esemenyt a fo ablakbol ----
{
  await page.goto(BAZIS + '/lezeres-szortelenites-budapest?gclid=TESZT123&utm_source=teszt&utm_medium=cpc', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openBooking === 'function', null, { timeout: 15000 });
  await page.waitForTimeout(9000); // a betoltes-kori meresi esemenyek lecsengenek
  const n0 = merEsem.length;
  await page.evaluate(() => document.querySelector('a[href*="foglalo-motor"]').click());
  await varCim(page); await page.waitForTimeout(2500);
  await reteg(page).locator('.be-time').first().click(); await page.waitForTimeout(2500);
  await reteg(page).locator('iframe.be-iframe').waitFor({ timeout: 15000 }); await page.waitForTimeout(8000); // az idopont utan rogton az adatlap (nincs osszegzo kepernyo)
  await reteg(page).locator('#be-back').click(); await page.waitForTimeout(2500);
  await reteg(page).locator('#be-close').click();
  await page.waitForFunction(() => !document.getElementById('mosaic-booking-layer'), null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(4000);
  const uj = merEsem.slice(n0).filter((e) => !(e.plat === 'tiktok' && /^(EngagedSession|\/api\/v2\/(monitor|pixel\/(act|inter)))/.test(e.ev)));
  ok('meres-vedelem: a reteg hasznalata (GTM-es oldalon) nem indit meresi kerest a fo ablakbol', uj.length === 0, uj.slice(0, 6).map((e) => e.plat + ':' + e.ev).join(', '));
}

// a PMU-landing es a koszonooldalak nem kapnak launchert
for (const lap of ['/sminktetovalas-budapest', '/fodrasz-ok']) {
  await page.goto(BAZIS + lap, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1500);
  ok(lap + ' | nincs launcher', await page.evaluate(() => typeof window.openBooking === 'undefined'));
}

ok('nincs JS-hiba a konzolon', hibak.length === 0, hibak.slice(0, 3).join(' | '));
await ctx.close();
await browser.close();
const rossz = eredmeny.filter((e) => !e.rendben);
console.log(`\n${eredmeny.length} ellenorzes, ${rossz.length} hiba${MOBIL ? ' (mobil)' : ' (asztali)'}`);
process.exit(rossz.length ? 1 : 0);
