// A helyben nyilo foglalo-reteg ellenorzese bongeszoben (Playwright), foglalas nelkul.
//
//   node tools/meres-proba/reteg-proba.mjs [--overlay dist] [--bazis https://...] [--mobil 1] [--kepek mappa] [--oldal /booking-test]
//
// Minden belepesi pontnal: a CTA a retegben nyitja a foglalot (nem navigal), a jo kezdo allapotba er, az URL frissul (booking=1), a bezaras (X) / vissza
// gomb visszaviszi az eredeti cimre (az Esc es a hatterre kattintas NEM zar), az ujratoltes visszaallitja; az ujranyitas ott folytatja, ahol tartott. A kimeno meres (capig.stape.do is) alapbol tiltva (tilt.mjs).
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { UA, UA_MOBIL, platformOf, engedett, dnsArg, ures, esemenyIras, esemenyUres } from './tilt.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = path.resolve(import.meta.dirname, '..', '..');
const OVERLAY = arg('overlay', ''), MOBIL = arg('mobil', '0') === '1', KEPEK = arg('kepek', ''), OLDAL = arg('oldal', '/booking-test');
const BAZIS = arg('bazis', 'https://www.mosaicheadspa.hu');
const LANDINGEK_TESZT = arg('landingek', '1') === '1'; // 0: csak a /booking-test (pl. az eles oldalon, ahol a landing-gombok meg Salonic-linkek)
const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let fajlUtvonal = null;
if (OVERLAY) ({ fajlUtvonal } = await import('../serve-dist.mjs'));
const TIPUS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
const ua = MOBIL ? UA_MOBIL : UA;

// [cimke, a CTA nyitasa (opts), a vart kezdo cim (reszlet), tovabbi ellenorzes]
const BELEPOK = [
  ['altalanos (nincs kontextus)', {}, 'Mit szeretnél foglalni?'],
  ['HeadSpa altalanos', { business: 'headspa' }, 'Ajándékkártyával vagy anélkül foglalsz?'],
  ['HeadSpa paros', { business: 'headspa', service: 'paros' }, 'Válassz időpontot', 'Páros'],
  ['HeadSpa ajandekkartya-bevaltas', { business: 'headspa', voucher: '1' }, 'Milyen ajándékkártyád van?'],
  ['Fodraszat altalanos', { business: 'hair' }, 'Melyik fodrászt választod?'],
  ['Fodraszat balayage-kategoria', { business: 'hair', service_category: 'balayage' }, 'Melyik fodrászt választod?'],
  ['Fodraszat hajfestes-kategoria', { business: 'hair', service_category: 'color' }, 'Melyik fodrászt választod?'],
  ['Fodraszat konzultacio', { business: 'hair', service: 'konzult' }, 'Válassz időpontot'],
  ['Oxigen altalanos', { business: 'oxygen' }, 'Mit szeretnél foglalni?'],
  ['Oxigen 1. alkalom', { business: 'oxygen', service: '466110' }, 'Melyik szakembert választod?'],
  ['Oxigen 2. alkalomtol', { business: 'oxygen', service: '466158' }, 'Melyik szakembert választod?'],
  ['Oxigen allapotfelmeres (uj oxigen-landing)', { business: 'oxygen', service: '466147' }, 'Válassz időpontot'], // egy szakember: nincs szakember-valaszto, egyenesen a naptar
  ['Lezer altalanos', { business: 'laser' }, null],
  ['Lezer konzultacio', { business: 'laser', service: 'konzult' }, 'Válassz időpontot'],
  ['Lezer elso idopontok', { business: 'laser', intent: 'first' }, 'Melyik területet szeretnéd?'],
  ['Lezer kezeles idopontok', { business: 'laser', intent: 'returning' }, 'Következő kezelés'],
  ['PMU', { business: 'pmu' }, 'PMU-keret'],
];

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--disable-blink-features=AutomationControlled', dnsArg()] });
const eredmeny = [];
let apiMock = null; // fuggveny(startDate, days) -> a Salonic naptar-API valasza (az "Elo foglaltsag" probahoz)
// a foglalasi jegyzettomb (/api/foglalas-esemeny) MINDIG mockolt: GET -> esemenyMock(url) (alapbol nincs adat), a POST-ok naploba kerulnek (a valodi vegpontra sosem megy)
let esemenyMock = () => ({ kor_ms: null });
const esemenyNaplo = [];
let cssKesleltet = 0; // ms: a booking-engine.css kiszolgalasanak keslelteteset a "stilus elotti villanas" proba allitja
const merEsem = []; // a FO ablak kimeno meresi kereseit gyujtjuk (a Salonic-keretet nem): a reteg hasznalata nem indithat meresi esemenyt
const ok = (cimke, rendben, reszlet = '') => { eredmeny.push({ cimke, rendben, reszlet }); console.log(`${rendben ? 'OK  ' : 'HIBA'} ${cimke}${reszlet ? ' | ' + reszlet : ''}`); };

async function ujLap() {
  const ctx = await browser.newContext({ userAgent: ua, viewport: MOBIL ? { width: 390, height: 844 } : { width: 1280, height: 900 }, locale: 'hu-HU', timezoneId: 'Europe/Budapest', serviceWorkers: 'block', isMobile: MOBIL, hasTouch: MOBIL });
  await ctx.route('**/*', async (route) => {
    const req = route.request(), url = req.url();
    let u; try { u = new URL(url); } catch (e) { return route.continue(); }
    if (apiMock && /api\.salonic\.hu\/calendar\/getAvailableTimes/.test(url)) return route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify(apiMock(+u.searchParams.get('startDate'), +u.searchParams.get('days'))) });
    if (/\/api\/foglalas-esemeny(\?|$)/.test(u.pathname + u.search)) { esemenyNaplo.push({ metodus: req.method(), ut: u.pathname + u.search, test: req.postData() || null }); return route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(req.method() === 'GET' ? esemenyMock(u) : { irva: false, ok: 'proba' }) }); }
    if (cssKesleltet && /booking-engine\.css/.test(u.pathname)) await new Promise((r) => setTimeout(r, cssKesleltet));
    if (OVERLAY && u.origin === BAZIS && req.method() === 'GET') {
      const e = fajlUtvonal(decodeURIComponent(u.pathname), req.headers()['user-agent'] || ua);
      if (e.atiranyit) return route.fulfill({ status: 301, headers: { location: encodeURI(e.atiranyit) + u.search } });
      if (fs.existsSync(e.fajl) && fs.statSync(e.fajl).isFile()) {
        let body = fs.readFileSync(e.fajl);
        if (body.length < 80 && /^[\w./-]+\.html$/.test(body.toString('utf8').trim())) { const cel = path.join(path.dirname(e.fajl), body.toString('utf8').trim()); if (fs.existsSync(cel)) body = fs.readFileSync(cel); }
        return route.fulfill({ status: 200, headers: { 'content-type': TIPUS[path.extname(e.fajl)] || 'application/octet-stream', 'cache-control': 'no-store' }, body });
      }
    }
    if (esemenyIras(url, req.method())) return route.fulfill(esemenyUres()); // a foglalasi jegyzettombbe a proba nem irhat (tilt.mjs)
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
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|violates the following report-only Content Security Policy/.test(m.text())) hibak.push(m.text().slice(0, 160)); });
  return { ctx, page, hibak };
}

const reteg = (page) => page.locator('#mosaic-booking-layer');
// a reteg Shadow DOM-jaban keres (a Playwright locator atlatja a nyitott shadow root-ot)
const cim = (page) => reteg(page).locator('.be-title').first();
async function varCim(page, ido = 25000) { try { await cim(page).waitFor({ timeout: ido }); return (await cim(page).textContent()).trim(); } catch (e) { return null; } }
const url = (page) => new URL(page.url());

async function nyit(page, opts, { folytat = false } = {}) {
  await page.evaluate(([o, f]) => { if (!f) { try { sessionStorage.removeItem('mhFoglaloAllapot'); } catch (e) { /* nincs tarolo */ } } window.__marker = 'maradt'; window.openBooking(o); }, [opts, folytat]);
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
await page.waitForTimeout(500);
ok('Esc NEM zarja be a retegat (csak az X)', (await reteg(page).count()) === 1);
await page.mouse.click(4, 4); // a panelen kivul (asztalon a hatterre, mobilon a panelre): nem zarhat be
await page.waitForTimeout(500);
ok('a hatterre kattintas NEM zarja be a retegat', (await reteg(page).count()) === 1);

await nyit(page, { business: 'hair' }); await varCim(page);
await page.goBack();
await page.waitForFunction(() => !document.getElementById('mosaic-booking-layer'), null, { timeout: 8000 }).catch(() => {});
ok('bongeszo vissza gomb bezarja a retegat', !(await reteg(page).count()) && url(page).search === new URL(BAZIS + eredetiUrl).search);

await nyit(page, {}); await varCim(page);
await reteg(page).locator('.be-choice', { hasText: 'Fodrászat' }).click();
ok('H0: Fodraszat -> Melyik fodraszt valasztod? (fodrasz-valaszto a belepo)', (await varCim(page)) === 'Melyik fodrászt választod?' || (await cim(page).textContent()).includes('Melyik fodrászt'));
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

// --- design (2026-10-04): kepek / ikonok a valasztokon, HeadSpa ajandekkartya-kerdes, egyenlo kartyak, fodrasz-elso, oxigen-szakember, PMU-naptar, 3 lepes ----
async function kepekBetoltve(page, minDb, ido = 8000) {
  const t0 = Date.now(); let r = { db: 0, jo: 0 };
  while (Date.now() - t0 < ido) {
    r = await reteg(page).locator('.be-choice-img').evaluateAll((es) => ({ db: es.length, jo: es.filter((e) => e.tagName !== 'IMG' || (e.complete && e.naturalWidth > 0)).length }));
    if (r.db >= minDb && r.jo === r.db) break;
    await page.waitForTimeout(250);
  }
  return r;
}
const kattint = async (page, szoveg) => { await reteg(page).locator('.be-choice', { hasText: szoveg }).first().click(); await varCim(page); await page.waitForTimeout(500); };
const zar = async (page) => { await reteg(page).locator('#be-close').click().catch(() => {}); await page.waitForFunction(() => !document.getElementById('mosaic-booking-layer'), null, { timeout: 8000 }).catch(() => {}); };
const cimSzoveg = async (page) => (await cim(page).textContent()).trim();
const egyenloMagas = async (page) => { const m = await reteg(page).locator('.be-egyenlo .be-choice').evaluateAll((es) => es.map((e) => Math.round(e.getBoundingClientRect().height))); return { db: m.length, egyenlo: m.length > 0 && m.every((x) => x === m[0]), m }; };
{
  await nyit(page, {}); await varCim(page);
  let k = await kepekBetoltve(page, 5);
  ok('design | H0: mind az 5 szolgaltatas mellett kis kep (betoltott), egyforma kartyak', k.db === 5 && k.jo === 5 && (await egyenloMagas(page)).egyenlo, JSON.stringify(k));
  await zar(page);

  // HeadSpa: ajandekkartya-kerdes -> elmenyek (ar jobbra) -> naptar -> adatlap; kuponkodos kartyak
  await nyit(page, { business: 'headspa' }); await varCim(page);
  const hs1 = await reteg(page).locator('.be-choice').allTextContents();
  ok('design | HeadSpa: elso kerdes "Ajandekkartyaval vagy anelkul foglalsz?", ket valasztas illusztracioval (ajandek, naptar)', (await cimSzoveg(page)) === 'Ajándékkártyával vagy anélkül foglalsz?' && hs1.length === 2 && (await reteg(page).locator('img.be-choice-img').count()) === 2 && !(await reteg(page).locator('.be-ikon').count()), hs1.map((x) => x.trim()).join(' | '));
  const lepesek = (await reteg(page).locator('.be-steps li').allTextContents()).join('|');
  ok('design | lepesjelzo: 3 lepes (Szolgaltatas, Idopont, Adatok)', lepesek.replace(/\d/g, '') === 'Szolgáltatás|Időpont|Adatok', lepesek);
  await kattint(page, 'Normál foglalás');
  k = await kepekBetoltve(page, 3);
  const arak = await reteg(page).locator('.be-choice-ar').allTextContents();
  const idok = await reteg(page).locator('.be-choice small').allTextContents();
  ok('design | HeadSpa: 3 elmeny kepekkel, arral jobbra, egyforma kartyak, nincs ajandekkartya-link alul', k.db === 3 && k.jo === 3 && arak.length === 3 && arak.every((a) => /\d\s?Ft/.test(a)) && (await egyenloMagas(page)).egyenlo && !(await reteg(page).locator('.be-more').count()), arak.join(' | '));
  ok('design | HeadSpa: az idotartam a Salonic ideje (1 ora 20 perc)', idok.length === 3 && idok.every((x) => x.trim() === '1 óra 20 perc'), idok.join(' | '));
  await reteg(page).locator('#be-back').click(); await varCim(page); await page.waitForTimeout(300);
  await kattint(page, 'Ajándékkártyával (kuponkóddal)');
  const kuponAr = await reteg(page).locator('.be-choice-ar').allTextContents();
  const kuponSub = await reteg(page).locator('.be-choice small').allTextContents();
  ok('design | HeadSpa kuponkodos kartyak: ugyanolyan formatum (kep, idotartam), jobbra "Kuponkoddal"', (await reteg(page).locator('.be-choice-img').count()) === 3 && kuponAr.length === 3 && kuponAr.every((a) => a.trim() === 'Kuponkóddal') && kuponSub.every((x) => x.trim() === '1 óra 20 perc'), kuponAr.join(' | ') + ' / ' + kuponSub.join(' | '));
  await reteg(page).locator('#be-back').click(); await varCim(page); await page.waitForTimeout(300);
  await kattint(page, 'Normál foglalás'); await kattint(page, 'Egyéni HeadSpa');
  const nap = reteg(page).locator('.be-nnap.szabad');
  await nap.first().waitFor({ timeout: 20000 });
  const szabadDb = await nap.count(), idoDb = await reteg(page).locator('.be-idogomb').count();
  ok('design | HeadSpa idopont: a PMU-foglalo havi naptara (7 oszlopos racs, szabad napok zoldek, idopont-gombok)', (await reteg(page).locator('.be-hetnap').count()) === 7 && szabadDb > 0 && idoDb > 0, `szabad nap: ${szabadDb}, idopont: ${idoDb}`);
  ok('design | HeadSpa idopont: a kezeles kepe a savban, 1 ora 20 perc, a kep es a Modositas nem er a sav szelehez', (await reteg(page).locator('.be-svc-img').count()) === 1 && /1 óra 20 perc/.test(await reteg(page).locator('.be-svc').first().textContent()) && await reteg(page).locator('.be-svc').first().evaluate((s) => { const r = s.getBoundingClientRect(); const i = s.querySelector('.be-svc-img').getBoundingClientRect(); const l = s.querySelector('.be-link').getBoundingClientRect(); return i.left - r.left >= 6 && r.right - l.right >= 10; }));
  ok('design | Egyeni HeadSpa: a Relax / Hair valtozat jeloles nem latszik (egy szolgaltatas)', !/Relax|Hair/.test(await reteg(page).locator('.be-svc').first().textContent()), (await reteg(page).locator('.be-svc b').first().textContent()).trim());
  ok('design | naptar: a lapozo nyilak SVG-k, a kor kozepen (nincs szoveg-jel)', (await reteg(page).locator('.be-lapoz svg').count()) === 2 && !(await reteg(page).locator('.be-lapoz').first().textContent()).trim());
  ok('design | HeadSpa idopont: az elso szabad nap elore kivalasztva, 5 oszlopos idoracs', (await reteg(page).locator('.be-nnap[aria-pressed="true"]').count()) === 1 && (await reteg(page).locator('.be-idolista').evaluate((e) => getComputedStyle(e).gridTemplateColumns.split(' ').length)) === 5);
  const elsoNap = await reteg(page).locator('.be-nap-cim').textContent();
  if (szabadDb > 1) {
    await nap.nth(1).click(); await page.waitForTimeout(200);
    const masikNap = await reteg(page).locator('.be-nap-cim').textContent();
    ok('design | HeadSpa idopont: masik nap -> masik cim, helyben', masikNap !== elsoNap && (await reteg(page).locator('.be-loading').count()) === 0, elsoNap + ' -> ' + masikNap);
  }
  const szell = await reteg(page).evaluate((h) => { const q = (s) => h.shadowRoot.querySelector(s); const c = q('.be-nap-cim').getBoundingClientRect(); const n = q('.be-naptar').getBoundingClientRect(); const l = q('.be-link-tavol').getBoundingClientRect(); const t = q('.be-idolista').getBoundingClientRect(); return { cimFelett: Math.round(c.top - n.bottom), linkFelett: Math.round(l.top - t.bottom) }; });
  ok('design | naptar: szellosebb (a nap-cim es a "Nem talalok" fole van hely)', szell.cimFelett >= 18 && szell.linkFelett >= 22, JSON.stringify(szell));
  const elsoIdo = (await reteg(page).locator('.be-idogomb').first().textContent()).trim();
  await reteg(page).locator('.be-idogomb').first().click();
  await reteg(page).locator('iframe.be-iframe').waitFor({ timeout: 20000 });
  ok('design | idopont utan ROGTON a Salonic adatlap, az "Add meg az adataidat" cim nincs kiirva, nincs "Elonezet / valodi foglalas" jelzes', (await cimSzoveg(page)).includes('Add meg az adataidat') && (await reteg(page).locator('main h2.be-title:not(.be-sr)').count()) === 0 && !(await reteg(page).locator('.be-proba').count()) && !/Előnézet/.test(await reteg(page).locator('main').textContent()));
  if (MOBIL) { await page.waitForTimeout(600); const fr = await reteg(page).locator('.be-frame').evaluate((e) => ({ alja: Math.round(e.getBoundingClientRect().bottom), ablak: window.innerHeight })); ok('design | adatlap mobilon egy kepernyore fer, gorgetes nelkul (a keret alja az ablakon belul)', fr.alja <= fr.ablak, `keret alja ${fr.alja}px, ablak ${fr.ablak}px`); }
  await page.waitForTimeout(3500);
  ok('design | adatlap alatt: nincs magyarazo szoveg, a "Masik idopontot valasztok" link (nem gomb)', !/Ha az űrlap helyett/.test(await reteg(page).locator('main').textContent()) && (await reteg(page).locator('.be-help .be-link').count()) === 1 && !(await reteg(page).locator('.be-help .be-btn').count()));
  const mini = reteg(page).locator('.be-mini');
  const miniLatszik = await mini.evaluate((e) => getComputedStyle(e).display !== 'none');
  ok('design | adatlap: osszegzo-sor (' + (MOBIL ? 'mobilon rejtett' : 'asztalon latszik') + ', mint a PMU-n)', MOBIL ? !miniLatszik : miniLatszik && (await mini.textContent()).includes(elsoIdo) && /1 óra 20 perc/.test(await mini.textContent()), (await mini.textContent()).replace(/\s+/g, ' ').slice(0, 90));
  await reteg(page).locator('.be-help .be-link').click(); await page.waitForTimeout(800);
  ok('design | "Masik idopontot valasztok" -> vissza a naptarhoz, a kivalasztott nappal', (await reteg(page).locator('.be-nnap[aria-pressed="true"]').count()) === 1 && !!(await reteg(page).locator('.be-naptar').count()));
  await zar(page);

  // Oxigen: egyforma kartyak kepekkel + arakkal + a pontos hajkamera-szoveg; a szakember az idopont elott, kepes (monogramos) kartyakon, nem legordulo
  await nyit(page, { business: 'oxygen' }); await varCim(page);
  k = await kepekBetoltve(page, 3);
  const oxAr = await reteg(page).locator('.be-choice-ar').allTextContents();
  const oxSub = await reteg(page).locator('.be-choice small').allTextContents();
  const oxMagas = await egyenloMagas(page);
  ok('design | Oxigen: 3 valasztas kepekkel es arakkal, MINDEGYIK KARTYA UGYANAKKORA', k.db === 3 && k.jo === 3 && oxAr.length === 3 && oxAr.every((a) => /(\d\s?Ft|Ingyenes)/.test(a)) && oxMagas.egyenlo, JSON.stringify(k) + ' ' + oxAr.join(' | ') + ' magassag ' + oxMagas.m.join('/'));
  ok('design | Oxigen: a hajkamera pontos szovege', oxSub.some((x) => x.trim() === 'Megnézzük a fejbőröd állapotát + átbeszéljük milyen eredményt várhatsz'), oxSub[0]);
  await kattint(page, 'Első oxigénterápiás');
  if (/Melyiket választod/.test(await cimSzoveg(page))) { await reteg(page).locator('.be-choice').first().click(); await varCim(page); await page.waitForTimeout(500); }
  const szakCim = await cimSzoveg(page);
  const szakDb = await reteg(page).locator('.be-choice').count();
  k = await kepekBetoltve(page, 4);
  ok('design | Oxigen: a szakember-valaszto az idopont ELOTT, kepes kartyakon (a Salonic fotoi, nem monogram, nem legordulo)', /szakembert/.test(szakCim) && szakDb >= 3 && (await reteg(page).locator('select').count()) === 0 && (await reteg(page).locator('img.be-choice-img').count()) === 4 && k.jo === k.db, `${szakCim} (${szakDb} kartya) ${JSON.stringify(k)}`);
  await reteg(page).locator('.be-choice:not(.be-choice-fo)').first().click();
  await reteg(page).locator('.be-nnap.szabad').first().waitFor({ timeout: 25000 });
  ok('design | Oxigen: a valasztott szakember neve a savban, a naptar a szakember idopontjaival, nincs legordulo', (await reteg(page).locator('select').count()) === 0 && (await reteg(page).locator('.be-idogomb').count()) > 0 && /Bozsoki|Szűcs|Menyhárt/.test(await reteg(page).locator('.be-svc').first().textContent()), (await reteg(page).locator('.be-svc').first().textContent()).replace(/\s+/g, ' ').trim().slice(0, 100));
  await zar(page);

  // Fodraszat: a BELEPO a fodrasz-valaszto; utana szandekek, kezelesek (ikonnal), hajhosszok (hajhossz-ikonnal); a valasztott fodrasz idopontjai
  await nyit(page, { business: 'hair' }); await varCim(page); await page.waitForTimeout(1200);
  k = await kepekBetoltve(page, 3);
  ok('design | Fodraszat: a belepo a fodrasz-valaszto (kepek, "Mindegy"), csak utana a szolgaltatas', (await cimSzoveg(page)) === 'Melyik fodrászt választod?' && k.db >= 4 && k.jo === k.db && !(await reteg(page).locator('.be-ikon').count()) && (await reteg(page).locator('.be-choice', { hasText: 'Mindegy' }).locator('img.be-choice-img').count()) === 1, JSON.stringify(k));
  await kattint(page, 'Betti');
  k = await kepekBetoltve(page, 4);
  ok('design | Fodraszat: a fodrasz utan a szandekok (kepekkel)', (await cimSzoveg(page)) === 'Mit szeretnél?' && k.db >= 4 && k.jo === k.db, JSON.stringify(k));
  await kattint(page, 'Balayage');
  k = await kepekBetoltve(page, 2);
  ok('design | Fodraszat: kezelesek illusztraciokkal (a tulajdonos mintakepei) es "-tol" arral (kevesebb info)', (await cimSzoveg(page)) === 'Melyik kezelés?' && (await reteg(page).locator('img.be-choice-img').count()) >= 2 && !(await reteg(page).locator('.be-ikon').count()) && k.jo === k.db && (await reteg(page).locator('.be-choice-ar').count()) >= 2 && new Set(await reteg(page).locator('img.be-choice-img').evaluateAll((es) => es.map((e) => e.getAttribute('src')))).size === (await reteg(page).locator('img.be-choice-img').count()), (await reteg(page).locator('.be-choice-ar').allTextContents()).join(' | '));
  for (let i = 0; i < 3 && !/Milyen hosszú/.test(await cimSzoveg(page)); i++) { await reteg(page).locator('.be-choice').first().click(); await varCim(page); await page.waitForTimeout(500); if (/Milyen hosszú|Válassz időpontot/.test(await cimSzoveg(page))) break; }
  if (/Milyen hosszú/.test(await cimSzoveg(page))) {
    k = await kepekBetoltve(page, 2);
    const hh = await reteg(page).locator('img.be-choice-img').evaluateAll((es) => es.map((e) => e.getAttribute('src').split('?')[0]));
    ok('design | Fodraszat: hajhosszak mindegyike kulon hajhossz-illusztracioval', hh.length >= 2 && new Set(hh).size === hh.length && k.jo === k.db && hh.every((s) => /\/hh-/.test(s)), hh.map((s) => s.split('/').pop()).join(' | '));
    await reteg(page).locator('.be-choice').first().click();
  }
  await reteg(page).locator('.be-nnap.szabad').first().waitFor({ timeout: 25000 });
  const savSzoveg = await reteg(page).locator('.be-svc').first().textContent();
  ok('design | Fodraszat: a valasztott fodrasz (Betti) idopontjai a naptarban, a neve a savban, nincs legordulo', (await reteg(page).locator('select').count()) === 0 && (await reteg(page).locator('.be-idogomb').count()) > 0 && /Betti/.test(savSzoveg), savSzoveg.replace(/\s+/g, ' ').trim().slice(0, 100));
  await zar(page);
  // Fodraszat kategoria-landing: fodrasz-valaszto, utana a kezeles-pontositas
  await nyit(page, { business: 'hair', service_category: 'balayage' }); await varCim(page); await page.waitForTimeout(800);
  ok('design | Fodraszat kategoria-landing: elobb a fodrasz-valaszto', (await cimSzoveg(page)) === 'Melyik fodrászt választod?');
  await kattint(page, 'Mindegy');
  ok('design | Fodraszat kategoria-landing: fodrasz utan a kezeles-pontositas', (await cimSzoveg(page)) === 'Melyik kezelés?');
  await zar(page);

  // Lezer: teruletek (szoveg nelkuli kepek, "Tobb terulet" mozaik), csomagok testreszekkel
  await nyit(page, { business: 'laser', intent: 'first' }); await varCim(page);
  k = await kepekBetoltve(page, 4);
  ok('design | Lezer: a teruletek mellett kep, mind egyforma kartya', k.db >= 4 && k.jo === k.db && (await egyenloMagas(page)).egyenlo, JSON.stringify(k));
  await kattint(page, 'Csomagok');
  const csomagSzoveg = await reteg(page).locator('main').textContent();
  ok('design | Lezer csomagok: testreszek kis ikonokkal (nincs "allapotfelmeres" / "kedvezmennyel" felirat)', (await reteg(page).locator('.be-resz').count()) >= 8 && !/állap\w*felmér|kedvezménnyel/i.test(csomagSzoveg), `${await reteg(page).locator('.be-resz').count()} jelveny`);
  ok('design | Lezer csomagok: BASIC = Honalj + Teljes intim; az egyedi csomagnal a leiras', /Hónalj/.test(await reteg(page).locator('.be-choice', { hasText: 'BASIC' }).first().textContent()) && /Teljes intim/.test(await reteg(page).locator('.be-choice', { hasText: 'BASIC' }).first().textContent()) && /válogatod össze/.test(await reteg(page).locator('.be-choice', { hasText: 'EGYEDI' }).first().textContent()));
  await zar(page);

  // 5. visszajelzes-csomag: kozepre igazitott cimek, fodraszat "egyeb" elemei kulon (gorgetes nelkul), "Csomagok" elol, verzios kep-URL
  await nyit(page, { business: 'hair' }); await varCim(page); await page.waitForTimeout(1000);
  ok('design | minden cim kozepre igazitva', (await reteg(page).locator('.be-title').first().evaluate((e) => getComputedStyle(e).textAlign)) === 'center');
  await kattint(page, 'Mindegy');
  const szand = (await reteg(page).locator('.be-choice b').allTextContents()).map((x) => x.trim());
  ok('design | Fodraszat: nincs "Egyeb fodraszati szolgaltatas", az elemei kulon kartyak', !szand.includes('Egyéb fodrászati szolgáltatás') && ['Női szárítás', 'Joico hajszerkezet újraépítés', 'Póthaj'].every((x) => szand.includes(x)), szand.join(' | '));
  if (MOBIL) { const gorg = await reteg(page).locator('.be-scroll').evaluate((e) => e.scrollHeight - e.clientHeight); ok('design | Fodraszat: a szandekok gorgetes nelkul elferenk mobilon', gorg <= 1, `tobblet: ${gorg}px`); }
  await zar(page);
  await nyit(page, { business: 'laser', intent: 'first' }); await varCim(page); await kepekBetoltve(page, 4);
  const teruletek = (await reteg(page).locator('.be-choice b').allTextContents()).map((x) => x.trim());
  ok('design | Lezer: a "Csomagok" kartya van elol (nem "Tobb terulet")', teruletek[0] === 'Csomagok' && !teruletek.includes('Több terület'), teruletek.join(' | '));
  ok('design | kepek verzios URL-lel (a kicserelt kep ne maradjon a gyorsitotarban)', await reteg(page).locator('img.be-choice-img').evaluateAll((es) => es.length > 0 && es.every((e) => /\.jpg\?v=\w{6,}/.test(e.getAttribute('src')))));
  await zar(page);

  // minden uzletag idopont-valasztoja a havi naptar (PMU); a szakember-valaszto kepes kartyakkal az idopont elott
  for (const [cimke, opts, szakember] of [['Oxigen 1. alkalom', { business: 'oxygen', service: '466110' }, true], ['Fodraszat konzultacio', { business: 'hair', service: 'konzult' }, false], ['Lezer konzultacio', { business: 'laser', service: 'konzult' }, false]]) {
    await nyit(page, opts);
    if (szakember) { ok(`design | ${cimke}: a landing a szakember-valasztoval kezdodik`, /szakembert/.test(await cimSzoveg(page))); await reteg(page).locator('.be-choice', { hasText: 'Mindegy' }).click(); }
    await reteg(page).locator('.be-nnap.szabad').first().waitFor({ timeout: 25000 });
    ok(`design | ${cimke}: az idopont-valaszto a havi naptar (nincs gyors idopontok / napszak-sav / legordulo)`, (await reteg(page).locator('.be-hetnap').count()) === 7 && (await reteg(page).locator('.be-idogomb').count()) > 0 && !(await reteg(page).locator('.be-day, .be-strip, select').count()));
    await reteg(page).locator('.be-idogomb').first().click();
    await reteg(page).locator('iframe.be-iframe').waitFor({ timeout: 25000 });
    ok(`design | ${cimke}: idopont utan rogton az adatlap`, (await cimSzoveg(page)).includes('Add meg az adataidat'));
    await zar(page);
  }
}

// --- 2026-10-04 (3. kor): kattinthato lepesjelzo, folytatas ujranyitas utan, gyors naptar ----------------------------------------------------------
const sav = (page) => reteg(page).locator('.be-steps').first();
{
  // HeadSpa: Szolgaltatas -> Idopont (naptar): a "Szolgaltatas" kesz lepes gomb, ra kattintva vissza az elmeny-valasztora
  await nyit(page, { business: 'headspa' }); await varCim(page);
  ok('lepesjelzo: az elso kepernyon nincs kattinthato (kesz) lepes', (await sav(page).locator('.be-step-btn').count()) === 0);
  await kattint(page, 'Normál foglalás'); await kattint(page, 'Egyéni HeadSpa');
  await reteg(page).locator('.be-nnap.szabad').first().waitFor({ timeout: 25000 });
  ok('lepesjelzo: a naptarnal a "Szolgaltatas" kesz es kattinthato (gomb), az "Idopont" az aktualis', (await sav(page).locator('li.done .be-step-btn').count()) === 1 && /Időpont/.test(await sav(page).locator('li.now').textContent()), (await sav(page).textContent()).replace(/\s+/g, ' '));
  const elsoNap0 = await reteg(page).locator('.be-nap-cim').textContent();
  await sav(page).locator('li.done .be-step-btn').click(); await page.waitForTimeout(700);
  ok('lepesjelzo: a "Szolgaltatas"-ra kattintva vissza az elmeny-valasztora (nincs oldalvaltas)', (await reteg(page).locator('.be-nnap').count()) === 0 && (await reteg(page).locator('.be-choice').count()) >= 3 && /Szolgáltatás/.test(await sav(page).locator('li.now').textContent()) && (await page.evaluate(() => window.__marker)) === 'maradt', (await cimSzoveg(page)));
  await kattint(page, 'Egyéni HeadSpa');
  await reteg(page).locator('.be-nnap.szabad').first().waitFor({ timeout: 25000 });
  await reteg(page).locator('.be-idogomb').first().click();
  await reteg(page).locator('iframe.be-iframe').waitFor({ timeout: 25000 });
  ok('lepesjelzo: az adatlapnal a Szolgaltatas es az Idopont is kesz (gomb), az Adatok az aktualis', (await sav(page).locator('li.done .be-step-btn').count()) === 2 && /Adatok/.test(await sav(page).locator('li.now').textContent()), (await sav(page).textContent()).replace(/\s+/g, ' '));
  await sav(page).locator('li.done .be-step-btn').nth(1).click(); await page.waitForTimeout(800);
  ok('lepesjelzo: az "Idopont"-ra kattintva vissza a naptarhoz (a Salonic-keret nelkul)', (await reteg(page).locator('.be-nnap.szabad').count()) > 0 && (await reteg(page).locator('iframe.be-iframe').count()) === 0 && (await reteg(page).locator('.be-nnap[aria-pressed="true"]').count()) === 1);
  await zar(page);

  // folytatas: bezaras utan ugyanazzal a belepessel ott folytatja (naptar, kivalasztott nap), a vissza gomb az elozo nezetekre lep
  await nyit(page, { business: 'headspa' }); await varCim(page);
  await kattint(page, 'Normál foglalás'); await kattint(page, 'Egyéni HeadSpa');
  await reteg(page).locator('.be-nnap.szabad').first().waitFor({ timeout: 25000 });
  if ((await reteg(page).locator('.be-nnap.szabad').count()) > 1) { await reteg(page).locator('.be-nnap.szabad').nth(1).click(); await page.waitForTimeout(300); }
  const napElotte = await reteg(page).locator('.be-nap-cim').textContent();
  await zar(page);
  await nyit(page, { business: 'headspa' }, { folytat: true });
  await reteg(page).locator('.be-naptar').first().waitFor({ timeout: 15000 });
  await reteg(page).locator('.be-nnap.szabad').first().waitFor({ timeout: 25000 });
  ok('folytatas: ujranyitas utan a naptar nyilik (nem az elso kerdes), ugyanazzal a nappal, az Egyeni HeadSpa a savban', (await reteg(page).locator('.be-nap-cim').textContent()) === napElotte && /egyéni/i.test(await reteg(page).locator('.be-svc').first().textContent()), napElotte);
  await reteg(page).locator('#be-back').click(); await varCim(page);
  ok('folytatas: a vissza gomb az elozo nezetre (elmeny-valaszto) lep, nem az elso kerdesre', (await reteg(page).locator('.be-choice').count()) >= 3 && !/Ajándékkártyával vagy anélkül/.test(await cimSzoveg(page)), await cimSzoveg(page));
  await reteg(page).locator('#be-back').click(); await varCim(page);
  ok('folytatas: es meg egyet vissza: az elso kerdes (Ajandekkartyaval vagy anelkul)', /Ajándékkártyával vagy anélkül/.test(await cimSzoveg(page)), await cimSzoveg(page));
  await zar(page);

  // masik belepesi pontnal nem folytat (az uzletag-valaszto jon)
  await nyit(page, { business: 'oxygen' }, { folytat: true }); await varCim(page);
  ok('folytatas: masik belepesnel (oxigen) nem a HeadSpa-allapot jon', /Mit szeretnél foglalni\?/.test(await cimSzoveg(page)), await cimSzoveg(page));
  await zar(page);

  // fodraszat: tobblepcsos utvonal (fodrasz -> szandek -> kezeles): bezaras utan a kezeles-valasztonal folytatja
  await nyit(page, { business: 'hair' }); await varCim(page); await page.waitForTimeout(800);
  await kattint(page, 'Betti'); await kattint(page, 'Balayage');
  const kezCim = await cimSzoveg(page);
  await zar(page);
  await nyit(page, { business: 'hair' }, { folytat: true });
  const cimUj = await varCim(page);
  ok('folytatas (fodraszat): bezaras utan a kezeles-valasztonal folytatja', kezCim === 'Melyik kezelés?' && cimUj === kezCim, `${kezCim} -> ${cimUj}`);
  await reteg(page).locator('#be-back').click(); await varCim(page);
  ok('folytatas (fodraszat): a vissza gomb a szandek-valasztora (Mit szeretnel?) lep', (await cimSzoveg(page)) === 'Mit szeretnél?', await cimSzoveg(page));
  await zar(page);

  // lejart (30 percnel regebbi) mentes nem folytat
  await nyit(page, { business: 'hair' }); await varCim(page); await page.waitForTimeout(800);
  await kattint(page, 'Betti'); await kattint(page, 'Balayage');
  await page.evaluate(() => { const k = 'mhFoglaloAllapot'; const s = JSON.parse(sessionStorage.getItem(k)); s.t -= 31 * 60 * 1000; sessionStorage.setItem(k, JSON.stringify(s)); });
  await zar(page);
  await nyit(page, { business: 'hair' }, { folytat: true });
  ok('folytatas: a 30 percnel regebbi mentes nem folytat (fodrasz-valaszto jon)', (await varCim(page)) === 'Melyik fodrászt választod?', await cimSzoveg(page));
  await zar(page);
}

// --- 2026-10-04 (4. kor): villanasok, sminktetovalo-lepegetes, lezer-illusztraciok, csomag-lista egy kepernyon -----------------------------------------
const VAR = 25000;
// a bezaras kozben lathato allapotok (cim, PMU-keret) es a bezaras ideje
async function zarFigyelve(page) {
  await page.evaluate(() => {
    window.__latott = []; window.__zarT0 = performance.now(); window.__zarT1 = null;
    const mintaz = () => {
      const h = document.getElementById('mosaic-booking-layer');
      if (h) { const s = h.shadowRoot; const c = s.querySelector('.be-title'); window.__latott.push(getComputedStyle(h).visibility + '|' + (s.querySelector('iframe.be-pmu') ? 'PMU' : '') + '|' + (c ? c.textContent.trim().slice(0, 40) : '')); window.__raf = requestAnimationFrame(mintaz); }
      else window.__zarT1 = performance.now();
    };
    mintaz();
  });
  await reteg(page).locator('#be-close').click();
  await page.waitForFunction(() => window.__zarT1 !== null, null, { timeout: 8000 }).catch(() => {});
  return page.evaluate(() => ({ ms: window.__zarT1 === null ? null : Math.round(window.__zarT1 - window.__zarT0), latott: [...new Set(window.__latott.filter((x) => !x.startsWith('hidden')))] }));
}
{
  // 1. az elso megnyitasnal (a stilus kesve erkezik) a reteg nem villan fel stilus nelkul (nagy kek telefon-ikon)
  cssKesleltet = 1200;
  const u = await ujLap();
  await u.page.goto(BAZIS + OLDAL, { waitUntil: 'domcontentloaded' });
  await u.page.waitForFunction(() => typeof window.openBooking === 'function', null, { timeout: 15000 });
  await u.page.evaluate(() => {
    window.__stilustalan = 0; window.__latszott = 0;
    const mintaz = () => {
      const h = document.getElementById('mosaic-booking-layer');
      if (h) { const ikon = h.shadowRoot.querySelector('a.be-icon svg'); const lat = getComputedStyle(h).visibility !== 'hidden'; if (lat) { window.__latszott++; if (ikon && ikon.getBoundingClientRect().width > 60) window.__stilustalan++; } }
      window.__raf = requestAnimationFrame(mintaz);
    };
    mintaz();
    window.openBooking({ business: 'headspa' });
  });
  await u.page.waitForTimeout(2600);
  const vill = await u.page.evaluate(() => ({ stilustalan: window.__stilustalan, latszott: window.__latszott, ikon: Math.round(document.getElementById('mosaic-booking-layer').shadowRoot.querySelector('a.be-icon svg').getBoundingClientRect().width) }));
  ok('villanas: lassu stilusnal a reteg a stilus megerkezeseig rejtett (nincs stilus nelkuli nagy telefon-ikon), utana lathato, az ikon 22 px', vill.stilustalan === 0 && vill.latszott > 0 && vill.ikon < 40, JSON.stringify(vill));
  await u.ctx.close();
  cssKesleltet = 0;

  // 2. sminktetovalo (PMU) a retegben: lepesjelzo, bongeszo vissza / elore, a keret sajat vissza nyila, bezaras (nem villan fel), folytatas
  const F = () => reteg(page).frameLocator('iframe.be-pmu');
  const pmuNezet = async () => F().locator('[data-nezet]:not([hidden])').first().getAttribute('data-nezet');
  await nyit(page, {}); await varCim(page);
  await kattint(page, 'Sminktetoválás');
  await reteg(page).locator('iframe.be-pmu').waitFor({ timeout: VAR });
  await F().locator('[data-nezet=kezdo]:not([hidden])').waitFor({ timeout: VAR });
  await F().locator('[data-ugrik=szolg]').first().click();
  await F().locator('.kezeles').first().waitFor({ timeout: VAR });
  await F().locator('.kezeles').first().click();
  await F().locator('.nnap.szabad').first().waitFor({ timeout: VAR });
  await F().locator('.idogomb').first().click();
  await F().locator('[data-nezet=kerdes]:not([hidden])').waitFor({ timeout: VAR });
  ok('PMU: a lepesjelzo kesz lepesei (Kezeles, Idopont) kattinthatok', (await F().locator('#lepesjelzo .lepes-gomb').count()) === 2 && /Kérdés/.test(await F().locator('#lepesjelzo li.most').textContent()));
  await F().locator('#lepesjelzo .lepes-gomb').first().click(); await page.waitForTimeout(600);
  ok('PMU: a "Kezeles" lepesre kattintva vissza a kezelesvalasztora', (await pmuNezet()) === 'szolg');
  await page.goBack(); await page.waitForTimeout(700);
  const v1 = await pmuNezet(); const nyitva1 = (await reteg(page).count()) === 1;
  await page.goBack(); await page.waitForTimeout(700);
  const v2 = await pmuNezet();
  await page.goForward(); await page.waitForTimeout(700);
  const v3 = await pmuNezet();
  ok('PMU: a bongeszo vissza / elore gombja lepesenkent lep (szolg <- kerdes <- ido, elore: kerdes), a reteg nyitva marad', v1 === 'kerdes' && nyitva1 && v2 === 'ido' && v3 === 'kerdes', [v1, v2, v3].join(' / '));
  await page.goBack(); await page.waitForTimeout(500);
  await F().locator('#vissza').click(); await page.waitForTimeout(600);
  ok('PMU: a keret sajat vissza nyila az elozo lepesre visz', (await pmuNezet()) === 'szolg');
  const zar1 = await zarFigyelve(page);
  ok('bezaras PMU-bol: azonnal eltunik (nincs masik ablak villanasa)', zar1.ms !== null && zar1.ms < 700 && zar1.latott.every((x) => x.startsWith('visible|PMU')), JSON.stringify(zar1));
  ok('bezaras utan az oldal ugyanott, nincs oldalvaltas', url(page).pathname + url(page).search === eredetiUrl && (await page.evaluate(() => window.__marker)) === 'maradt');
  await nyit(page, {}, { folytat: true });
  await reteg(page).locator('iframe.be-pmu').waitFor({ timeout: VAR });
  await F().locator('[data-nezet]:not([hidden])').first().waitFor({ timeout: VAR });
  await page.waitForTimeout(2500);
  ok('PMU: ujranyitas utan ott folytatja, ahol tartott (kezelesvalaszto, nem az elso kepernyo)', (await pmuNezet()) === 'szolg', await pmuNezet());
  await page.goBack(); await page.waitForTimeout(800);
  ok('PMU: folytatas utan a bongeszo vissza gombja az elozo lepesre lep (a reteg nyitva marad)', (await pmuNezet()) === 'ido' && (await reteg(page).count()) === 1, await pmuNezet());
  await zar(page);

  // 3. PMU hasznalat utan egyetlen masik ablak bezarasakor sem villan fel a PMU (elavult elozmeny-bejegyzes)
  for (const [cimke, opts, elo] of [['HeadSpa 2. kepernyo', { business: 'headspa' }, 'Normál foglalás'], ['Fodraszat belepo', { business: 'hair' }, null], ['Lezer csomagok', { business: 'laser', intent: 'first' }, 'Csomagok']]) {
    await nyit(page, opts); await varCim(page); await page.waitForTimeout(500);
    if (elo) await kattint(page, elo);
    const z = await zarFigyelve(page);
    ok('bezaras PMU hasznalat utan (' + cimke + '): azonnal eltunik, nem villan fel a PMU / masik nezet', z.ms !== null && z.ms < 700 && z.latott.every((x) => x.startsWith('visible||')) && z.latott.length === 1, JSON.stringify(z));
  }

  // 4. lezer: a kezelesek illusztraciokkal (terulet / csomag), a csomag-testreszek illusztracioval; a csomaglista egy kepernyore fer (mobilon is)
  await nyit(page, { business: 'laser', intent: 'first' }); await varCim(page);
  await kepekBetoltve(page, 4);
  await kattint(page, 'Láb');
  const labKartyak = await reteg(page).locator('.be-choice').count();
  const labKepek = await reteg(page).locator('img.be-choice-img').count();
  ok('lezer: a terulet kezelesei (Lab) az uzletag illusztracioival, nem vonalikonnal', labKartyak >= 1 && labKepek === labKartyak && !(await reteg(page).locator('.be-ikon').count()), labKepek + '/' + labKartyak);
  await reteg(page).locator('#be-back').click(); await varCim(page); await page.waitForTimeout(300);
  await kattint(page, 'Csomagok');
  const cs = await kepekBetoltve(page, 8);
  const resz = await reteg(page).locator('img.be-resz-kep').evaluateAll((es) => ({ db: es.length, jo: es.filter((e) => e.complete && e.naturalWidth > 0).length }));
  ok('lezer csomagok: minden kartyan illusztracio, a testreszek jelvenyein is illusztracio (nincs vonalikon)', cs.db >= 8 && cs.jo === cs.db && resz.db >= 12 && resz.jo === resz.db && !(await reteg(page).locator('.be-ikon, .be-resz svg').count()), JSON.stringify(cs) + ' jelveny: ' + JSON.stringify(resz));
  const gorg = await reteg(page).locator('.be-scroll').evaluate((e) => ({ tobblet: e.scrollHeight - e.clientHeight, kartya: e.querySelectorAll('.be-choice').length }));
  if (MOBIL) ok('lezer csomagok (mobil, 390x844): az osszes csomag egy kepernyore fer, gorgetes nelkul', gorg.tobblet <= 1 && gorg.kartya >= 8, JSON.stringify(gorg));
  else ok('lezer csomagok (asztali): mind a ' + gorg.kartya + ' csomag latszik', gorg.kartya >= 8, JSON.stringify(gorg));
  await zar(page);
}

// --- koszono kepernyok (mintanezet, foglalas es kuldes nelkul): minden uzletagnal egyforma, a PMU-koszono mintajara -------------------------------------
{
  const u = await ujLap(); const pg = u.page;
  const posztok = []; pg.on('request', (r) => { if (r.method() === 'POST') posztok.push(r.url()); });
  const MINTAK = [['HeadSpa', '', null], ['Fodraszat', '&business=hair', 'Betti'], ['Oxigen', '&business=oxygen', 'Bozsoki'], ['Lezer', '&business=laser', 'Zsófi']];
  for (const [cimke, q, kezelo] of MINTAK) {
    await pg.goto(BAZIS + '/foglalo-motor?minta=siker' + q, { waitUntil: 'domcontentloaded' });
    await pg.locator('.be-success').waitFor({ timeout: 15000 });
    await pg.waitForTimeout(600);
    const cim = (await pg.locator('.be-success .be-title').textContent()).trim();
    const lepesek = await pg.locator('.be-lepesek li').count();
    const kezeloDb = await pg.locator('.be-kezelo').count();
    const kezeloSzoveg = kezeloDb ? await pg.locator('.be-kezelo').first().textContent() : '';
    // a kezelo a kartyan BELUL, a szoveg es a terkep kozott
    const sorrend = await pg.locator('.be-kosz-kartya').evaluate((k) => [...k.children].map((c) => c.className.split(' ')[0]).join(','));
    const foto = kezeloDb ? await pg.locator('.be-kezelo img.be-kezelo-kep').evaluateAll((es) => es.map((e) => e.complete && e.naturalWidth > 0)) : [];
    ok(`koszono (${cimke}): "Sikeres foglalas!", kartya + terkep, "Ott leszek", naptar, "Mi tortenik most?" (3 pont)`, cim === 'Sikeres foglalás!' && (await pg.locator('.be-kosz-kartya .be-terkep').count()) === 1 && (await pg.locator('.be-ott').count()) === 1
      && (await pg.locator('.be-naptar-link').count()) === 1 && lepesek === 3 && /Ott leszek/.test(await pg.locator('.be-ott').textContent()), `${cim} / ${lepesek} pont`);
    ok(`koszono (${cimke}): ${kezelo ? 'a kezelo (' + kezelo + ') kepe es neve a kartyan belul, a szoveg es a terkep kozott, "var teged"' : 'nincs kezelo (szobak vannak, nem kezelok): a kartya = szoveg + terkep'}`,
      kezelo ? kezeloDb === 1 && kezeloSzoveg.includes(kezelo) && /vár téged/.test(kezeloSzoveg) && foto.length === 1 && foto[0] && sorrend === 'be-kosz-adat,be-kezelo,be-terkep' : kezeloDb === 0 && sorrend === 'be-kosz-adat,be-terkep', sorrend + ' | ' + kezeloSzoveg.replace(/\s+/g, ' ').trim());
    if (cimke === 'Lezer') ok('koszono (Lezer): a kezelesre vonatkozo tudnivalok (borotvalas, napozas)', /borotváld le/.test(await pg.locator('.be-lepesek').textContent()) && /napozást/.test(await pg.locator('.be-lepesek').textContent()));
    if (cimke === 'Oxigen') ok('koszono (Oxigen): hajmosas / hajfestes tudnivalo', /48 órával ne moss hajat/.test(await pg.locator('.be-lepesek').textContent()));
  }
  // "Ott leszek": a gomb zold lesz, a mintanezetben NEM megy el kuldes (nem keletkezik e-mail a szalonnak)
  await pg.goto(BAZIS + '/foglalo-motor?minta=siker&business=oxygen', { waitUntil: 'domcontentloaded' });
  await pg.locator('.be-ott').waitFor({ timeout: 15000 });
  await pg.locator('.be-ott').click(); await pg.waitForTimeout(500);
  ok('koszono: az "Ott leszek" megerositi (zold, "Koszonom, varunk!"), mintanezetben nincs kuldes', /Köszönöm, várunk/.test(await pg.locator('.be-ott').textContent()) && await pg.locator('.be-ott').isDisabled() && posztok.length === 0, 'POST: ' + posztok.length);
  // visszahivas utan: mi fog tortenni (idopont nelkul), nincs kezelo-sor
  await pg.goto(BAZIS + '/foglalo-motor?minta=visszahivas-kesz', { waitUntil: 'domcontentloaded' });
  await pg.locator('.be-success').waitFor({ timeout: 15000 });
  const vhSzoveg = await pg.locator('main').textContent();
  ok('koszono (visszahivas): "Visszahivast kertel!", "Mi tortenik most?" 3 pont, nincs idopont-allitas, nincs lepesjelzo, nincs "ha kozben valtozik a terved, hivj" sor', /Visszahívást kértél!/.test(vhSzoveg) && (await pg.locator('.be-lepesek li').count()) === 3 && /felhív a megadott számon/.test(vhSzoveg) && !(await pg.locator('.be-steps:not([hidden])').count()) && !/változik a terved/.test(vhSzoveg), '');
  // sminktetovalo: a kezelo (Melitta) kepe es neve a kartya / terkep es a szoveg kozott, mindegyik koszonon
  for (const [cimke, ut, nezet] of [['foglalas', '/foglalo-pmu?minta=kezeles#koszonjuk', 'koszonjuk'], ['szemelyes konzultacio', '/foglalo-pmu?minta=konz#koszonjuk-konzultacio', 'koszonjuk'], ['visszahivas', '/foglalo-pmu?minta=visszahivas', 'c-kesz'], ['fotokuldes', '/foglalo-pmu?minta=foto', 'foto-kesz']]) {
    await pg.goto(BAZIS + ut, { waitUntil: 'domcontentloaded' });
    await pg.locator('[data-nezet=' + nezet + ']:not([hidden])').waitFor({ timeout: 15000 });
    await pg.waitForTimeout(400);
const sor = pg.locator('[data-nezet=' + nezet + ']:not([hidden]) .kezelo-oszlop');
    const kartyaban = await sor.evaluate((e) => !!e.closest('.kosz-kartya, .osszegzes-kartya'));
    const sz = await pg.locator('[data-nezet=' + nezet + ']:not([hidden])').textContent();
    ok('koszono (PMU ' + cimke + '): Toreki Melitta kepe es neve a kartyan belul' + (nezet === 'koszonjuk' ? ' (a szoveg es a terkep kozott)' : '') + (nezet === 'c-kesz' ? ', nincs "ha kozben valtozik a terved, hivj" sor' : ''),
      (await sor.count()) === 1 && /Töreki Melitta/.test(await sor.textContent()) && kartyaban && await sor.locator('img').evaluate((e) => e.complete && e.naturalWidth > 0) && (nezet !== 'c-kesz' || !/változik a terved/.test(sz))
      && (nezet !== 'koszonjuk' || (await pg.locator('.kosz-kartya').evaluate((k) => [...k.children].map((c) => c.className.split(' ')[0]).join(',')) === 'adat,kezelo-oszlop,terkep')), (await sor.textContent()).replace(/\s+/g, ' ').trim());
  }
  await u.ctx.close();
}

// --- 2026-10-04 (7. kor): "Elo foglaltsag" sav a naptar alatt (valodi szabad idopontok), a szakember-valaszto "Mindegy"-je legfelul ----------------------------
{
  const alap = Math.floor(Date.now() / 86400000) * 86400; // a mai UTC nap eleje
  const idopont = (nap, ora = 10) => alap + nap * 86400 + ora * 3600; // nap 1..6: a kovetkezo 7 napon belul; 10+: azon tul
  let apiHivas = 0; // hany naptar-API kerest szolgalt ki a mock
  const mockAlap = (idok) => (startDate, days) => {
    apiHivas++;
    const blocks = {}; let i = 0;
    for (const ts of idok.filter((x) => x >= startDate && x < startDate + days * 86400)) { const nap = new Date(ts * 1000).toISOString().slice(0, 10); ((blocks[nap] ||= { 111: { employeeName: 'Teszt Szakember', slots: {} } })[111].slots)['s' + (i++)] = { timestamp: ts, formatted: '' }; }
    return { status: 'success', data: { blocks, placeName: 'Mosaic Headspa', placeAddress: '1023 Budapest, Bécsi út 4.' } };
  };
  const sav = (pg) => pg.locator('#mosaic-booking-layer').locator('.be-elo');
  async function eloLap(idok, { oldal = OLDAL } = {}) {
    apiMock = mockAlap(idok);
    const u = await ujLap();
    await u.page.addInitScript(() => { window.__MH_ELO_MS = 1500; });
    await u.page.goto(BAZIS + oldal, { waitUntil: 'domcontentloaded' });
    await u.page.waitForFunction(() => typeof window.openBooking === 'function', null, { timeout: 15000 });
    await u.page.evaluate(() => window.openBooking({ business: 'headspa', service: 'paros' }));
    await sav(u.page).waitFor({ timeout: 25000 });
    return u;
  }
  const szabadNapok = (pg) => pg.locator('#mosaic-booking-layer').locator('.be-nnap.szabad').count();

  // 1. kevés szabad idopont a 7 napban: "mar csak 3 ... maradt", narancs (surgos) jelzes; kapacitas / esemeny nelkul nincs tovabbi sor
  let u = await eloLap([idopont(1), idopont(2), idopont(3), idopont(10), idopont(20), idopont(40)]);
  let s = sav(u.page);
  const uz1 = (await s.locator('.be-elo-uzenet').textContent()).trim();
  ok('elo foglaltsag: "A kovetkezo 7 napra mar csak 3 szabad idopont maradt." (a Salonic adatabol szamolva), "Elo foglaltsag" cim, surgos (narancs) jelzes', uz1 === 'A következő 7 napra már csak 3 szabad időpont maradt.' && (await s.locator('.be-elo-cim').textContent()) === 'Élő foglaltság' && /keves/.test(await s.getAttribute('class')), uz1);
  ok('elo foglaltsag: kapacitas / foglalasi esemeny nelkul nincs "X%-a foglalt" es nincs "N perce foglaltak" sor; a segedsor: "Az elerhetoseg automatikusan frissul."', (await s.locator('.be-elo-sor').count()) === 0 && /automatikusan frissül/.test(await s.locator('.be-elo-also').textContent()), '');
  const rend = await u.page.locator('#mosaic-booking-layer').evaluate((h) => { const r = h.shadowRoot; const n = r.querySelector('.be-naptar'); const e = r.querySelector('.be-elo'); const l = r.querySelector('.be-link-tavol'); return !!(n.compareDocumentPosition(e) & 4) && !!(e.compareDocumentPosition(l) & 4); });
  ok('elo foglaltsag: a sav a naptar ALATT, a "Nem talalok megfelelo idopontot" fole van', rend);
  const anim = await s.locator('.be-elo-pont').evaluate((e) => getComputedStyle(e).animationName);
  ok('elo foglaltsag: egyetlen enyhe pulzalo pont (egy animacio, 2 mp-nel lassabb)', anim === 'be-elo-pulz' && (await s.locator('.be-elo-pont').evaluate((e) => parseFloat(getComputedStyle(e).animationDuration))) >= 2, anim);
  // nem "ugralhat": valtozas nelkul a szoveg nem valtozik, es nincs valtozas-animacio (a hook 1,5 mp-es frissitesevel nezzuk)
  const napokElobb = await szabadNapok(u.page);
  await u.page.waitForTimeout(5000);
  ok('elo foglaltsag: valtozas nelkul nem ugrik (a szoveg ugyanaz, nincs "Most frissult", nincs valtozas-animacio)', (await s.locator('.be-elo-uzenet').textContent()).trim() === uz1 && (await s.locator('.be-elo-cim').textContent()) === 'Élő foglaltság' && !(await s.locator('.be-elo-uzenet.valt').count()));
  // valodi valtozas: az egyik idopont elfogy -> "Most frissult", "mar csak 2", a naptar is frissul
  apiMock = mockAlap([idopont(1), idopont(3), idopont(10), idopont(20), idopont(40)]);
  await s.locator('.be-elo-cim', { hasText: 'Most frissült' }).waitFor({ timeout: 9000 }).catch(() => {});
  const uz2 = (await s.locator('.be-elo-uzenet').textContent()).trim();
  ok('elo foglaltsag: valodi valtozaskor (egy idopont elfogyott) finoman frissul: "Most frissult", "mar csak 2", a naptar szabad napjai is', (await s.locator('.be-elo-cim').textContent()) === 'Most frissült' && uz2 === 'A következő 7 napra már csak 2 szabad időpont maradt.' && (await szabadNapok(u.page)) === napokElobb - 1, uz2 + ' | szabad napok: ' + napokElobb + ' -> ' + (await szabadNapok(u.page)));
  await s.locator('.be-elo-cim', { hasText: 'Élő foglaltság' }).waitFor({ timeout: 16000 }).catch(() => {});
  ok('elo foglaltsag: a "Most frissult" cim egy ido utan visszall "Elo foglaltsag"-ra, az uzenet a frissitett marad', (await s.locator('.be-elo-cim').textContent()) === 'Élő foglaltság' && (await s.locator('.be-elo-uzenet').textContent()).trim() === uz2);
  // bezaras utan nincs halott idozito / halott motor: nem megy tovabb naptar-kereses, es a mentett allapotot sem irja felul
  await u.page.locator('#mosaic-booking-layer').locator('#be-close').click();
  await u.page.waitForFunction(() => !document.getElementById('mosaic-booking-layer'), null, { timeout: 8000 }).catch(() => {});
  await u.page.waitForTimeout(500);
  const hivasZaraskor = apiHivas; const snapZaraskor = await u.page.evaluate(() => sessionStorage.getItem('mhFoglaloAllapot'));
  await u.page.waitForTimeout(5000);
  ok('elo foglaltsag: bezaras utan nem fut tovabb a frissites (nincs halott idozito), a mentett allapotot sem irja felul', apiHivas === hivasZaraskor && (await u.page.evaluate(() => sessionStorage.getItem('mhFoglaloAllapot'))) === snapZaraskor, 'API-hivas: ' + hivasZaraskor + ' -> ' + apiHivas);
  await u.ctx.close();

  // 2. sok szabad idopont: semleges megallapitas (nem allitunk szukoseget, ami nincs)
  u = await eloLap([1, 2, 3, 4, 5, 6].flatMap((n) => [idopont(n, 9), idopont(n, 14)]).concat([idopont(20)]));
  s = sav(u.page);
  const uz3 = (await s.locator('.be-elo-uzenet').textContent()).trim();
  ok('elo foglaltsag: sok szabad idopontnal semleges ("A kovetkezo 7 napra 12 szabad idopont van."), zold jelzes, nincs "mar csak"', uz3 === 'A következő 7 napra 12 szabad időpont van.' && /jo/.test(await s.getAttribute('class')) && !/már csak/.test(uz3), uz3);
  await u.ctx.close();

  // 3. nincs szabad idopont a 7 napban: ezt mondja, es a legkozelebbit
  u = await eloLap([idopont(12), idopont(20)]);
  s = sav(u.page);
  const uz4 = (await s.locator('.be-elo-uzenet').textContent()).trim();
  ok('elo foglaltsag: ha a 7 napban nincs szabad idopont, ezt mondja es megnevezi a legkozelebbit', /^A következő 7 napra nincs szabad időpont\. A legközelebbi: .+\.$/.test(uz4) && /nincs/.test(await s.getAttribute('class')), uz4);
  await u.ctx.close();

  // --- 2026-10-04 (8. kor): a foglalasi jegyzettomb (szerver-oldali, valodi foglalasi esemenyek): "N perce foglaltak utoljara erre a kezelesre" + az iras a megerositett foglalasnal ---
  const IDOK = [idopont(1), idopont(2), idopont(3), idopont(10), idopont(40)];
  // a) van valodi bejegyzes: a sav masodik sora; a szamlalo percenkent leptet (59 perc -> 1 orája), nem ugrik; a jegyzettomb ritkan kerdezodik
  let esemenyT = null;
  esemenyMock = () => ({ kor_ms: Date.now() - (esemenyT ||= Date.now() - (59 * 60000 + 57000)) });
  esemenyNaplo.length = 0;
  u = await eloLap(IDOK);
  s = sav(u.page);
  await s.locator('.be-elo-sor').first().waitFor({ timeout: 10000 }).catch(() => {});
  const sor1 = (await s.locator('.be-elo-sor').first().textContent().catch(() => '')).trim();
  ok('jegyzettomb: valodi bejegyzesnel a savban megjelenik: "59 perce foglaltak utoljara erre a kezelesre." (a masik sor valtozatlan)', /^59 perce foglaltak utoljára erre a kezelésre\.$/.test(sor1) && /^A következő 7 napra/.test(await s.locator('.be-elo-uzenet').textContent()), sor1);
  await s.locator('.be-elo-sor', { hasText: 'órája' }).waitFor({ timeout: 9000 }).catch(() => {});
  const sor2 = (await s.locator('.be-elo-sor').first().textContent().catch(() => '')).trim();
  ok('jegyzettomb: a szamlalo percenkent leptet ("59 perce" -> "1 oraja foglaltak utoljara erre a kezelesre."), nincs valtozas-animacio, a cim marad', sor2 === '1 órája foglaltak utoljára erre a kezelésre.' && (await s.locator('.be-elo-cim').textContent()) === 'Élő foglaltság' && !(await s.locator('.be-elo-uzenet.valt').count()), sor2);
  await u.page.waitForTimeout(6500); // a 2. olvasas az 5. frissitesi korben jon (~7,5 mp a sav megjelenesetol)
  const olvasasok = esemenyNaplo.filter((e) => e.metodus === 'GET');
  ok('jegyzettomb: az olvasas a kezeles azonositoival megy (uzletag + szolgaltatas), ritkan (nem minden frissitesi korben): 2-3 olvasas ~12 mp alatt, iras nincs', olvasasok.length >= 2 && olvasasok.length <= 3 && /uzletag=headspa&szolgaltatas=\d+(,\d+)*$/.test(olvasasok[0].ut) && !esemenyNaplo.some((e) => e.metodus !== 'GET'), olvasasok.length + ' olvasas: ' + (olvasasok[0] || {}).ut);
  await u.ctx.close();

  // b) tul regi (25 oras) vagy ertelmetlen adat: a sor nem jelenik meg (nem mondunk semmit, ami nem igaz / nem biztos)
  for (const [cimke, mock] of [['25 oras bejegyzes', () => ({ kor_ms: 25 * 3600 * 1000 })], ['ertelmetlen adat', () => ({ kor_ms: 'x' })], ['hianyzo adat', () => ({})]]) {
    esemenyMock = mock;
    u = await eloLap(IDOK); s = sav(u.page);
    await u.page.waitForTimeout(2500);
    ok('jegyzettomb: ' + cimke + ' -> nincs "N perce foglaltak" sor (csak az elsodleges uzenet)', (await s.locator('.be-elo-sor').count()) === 0 && /^A következő 7 napra/.test(await s.locator('.be-elo-uzenet').textContent()), '');
    await u.ctx.close();
  }
  esemenyMock = () => ({ kor_ms: null });

  // c) iras: CSAK a megerositett (a motor vart valasztasaval egyezo) foglalasnal; hibas atiranyitasnal nem. (atadas=0: a motor maga mutatja a sikert, nem ad at az eles koszonooldalnak)
  const atiranyitas = async (pg, felul = {}) => {
    const keret = await reteg(pg).locator('iframe.be-iframe').getAttribute('src');
    const g = new URL(keret);
    const ar = (((await reteg(pg).locator('.be-mini').textContent().catch(() => '')) || '').match(/(\d[\d\s\u00a0]*)\s*Ft/) || [])[1];
    const cena = ar ? ar.replace(/\D/g, '') : '1';
    const bu = new URL(keret); for (const [k, v] of Object.entries(felul)) bu.searchParams.set(k, v);
    return { g, href: BAZIS + '/success-foglalas?first_booking=false&price=' + cena + '&employee=Teszt+Szakember&location=Budapest&service=Proba&g=g:2461999&bookingUrl=' + encodeURIComponent(bu.href) };
  };
  async function elokeszit() {
    const uu = await eloLap(IDOK, { oldal: OLDAL + '?atadas=0' });
    await reteg(uu.page).locator('.be-nnap.szabad').first().waitFor({ timeout: 20000 });
    await reteg(uu.page).locator('.be-idogomb').first().click();
    await reteg(uu.page).locator('iframe.be-iframe').waitFor({ state: 'attached', timeout: 20000 }); // csak a megjelenese kell (a Salonic-keret kitoltese a mockolt idopontra nem kell)
    return uu;
  }
  esemenyNaplo.length = 0;
  u = await elokeszit();
  let a = await atiranyitas(u.page, { startDate: String(+(await atiranyitas(u.page)).g.searchParams.get('startDate') + 1800) }); // masik idopont, mint amit valasztott
  await u.page.evaluate((h) => window.mhKeretbenOldal(h), a.href);
  await u.page.waitForTimeout(2500);
  ok('jegyzettomb: ha a Salonic atiranyitasa NEM egyezik a vart valasztassal (masik idopont), nem keletkezik jelzes (nincs iras)', !esemenyNaplo.some((e) => e.metodus === 'POST') && !(await reteg(u.page).locator('.be-kosz-kartya').count()), esemenyNaplo.map((e) => e.metodus).join(','));
  await u.ctx.close();

  u = await elokeszit();
  a = await atiranyitas(u.page);
  await u.page.evaluate((h) => window.mhKeretbenOldal(h), a.href);
  await reteg(u.page).locator('.be-kosz-kartya').waitFor({ timeout: 10000 }).catch(() => {});
  const posztok = esemenyNaplo.filter((e) => e.metodus === 'POST');
  let adat = null; try { adat = JSON.parse((posztok[0] || {}).test || 'null'); } catch (e) { adat = null; }
  ok('jegyzettomb: megerositett foglalasnal EGY jelzes megy: uzletag, szolgaltatas, kezdes (a motor vart valasztasa), vendeg-azonosito (a Salonic atiranyitasabol)',
    posztok.length === 1 && adat && adat.uzletag === 'headspa' && adat.szolgaltatas === a.g.searchParams.get('serviceId') && adat.kezdes === +a.g.searchParams.get('startDate') && adat.vendeg === '2461999' && Object.keys(adat).length === 4, posztok.length + ' iras: ' + ((posztok[0] || {}).test || ''));
  ok('jegyzettomb: a jelzes nem tartalmaz szemelyes adatot (nev, e-mail, telefon), csak azonositokat es idot', !!adat && !/@|\+36|Teszt|Proba/.test(JSON.stringify(adat)), JSON.stringify(adat));
  await u.ctx.close();
  apiMock = null;

  // szakember-valaszto: a "Mindegy - a legkorabbi idopont erdekel" legfelul, elsodleges (kiemelt) opcio
  for (const [cimke, opts] of [['Oxigen', { business: 'oxygen', service: '466110' }], ['Fodraszat', { business: 'hair' }]]) {
    await nyit(page, opts); await varCim(page); await page.waitForTimeout(600);
    const kartyak = await reteg(page).locator('.be-choice').evaluateAll((es) => es.map((e) => ({ szoveg: e.textContent.trim().slice(0, 40), fo: e.classList.contains('be-choice-fo') })));
    ok('szakember-valaszto (' + cimke + '): a "Mindegy - a legkorabbi idopont erdekel" legfelul, kiemelt elsodleges opcio, utana a szakemberek', kartyak.length >= 3 && /Mindegy/.test(kartyak[0].szoveg) && kartyak[0].fo && kartyak.slice(1).every((k) => !k.fo && !/Mindegy/.test(k.szoveg)), kartyak.map((k) => k.szoveg).join(' | '));
    await zar(page);
  }
}

// --- sebesseg: a naptar mennyi ido alatt jelenik meg hideg gyorsitotarral (uj kontextus, nincs elomelegites), uzletagankent ------------------------
const SEBESSEG = [['HeadSpa paros', { business: 'headspa', service: 'paros' }, null], ['Fodraszat konzultacio', { business: 'hair', service: 'konzult' }, null], ['Lezer konzultacio', { business: 'laser', service: 'konzult' }, null], ['Oxigen 1. alkalom', { business: 'oxygen', service: '466110' }, 'szakember']];
for (const [cimke, opts, elso] of SEBESSEG) {
  const u = await ujLap();
  await u.page.goto(BAZIS + OLDAL, { waitUntil: 'domcontentloaded' });
  await u.page.waitForFunction(() => typeof window.openBooking === 'function', null, { timeout: 15000 });
  const t0 = Date.now();
  await u.page.evaluate((o) => window.openBooking(o), opts);
  let t1 = 0;
  if (elso) { await u.page.locator('#mosaic-booking-layer').locator('.be-choice').first().waitFor({ timeout: 25000 }); t1 = Date.now() - t0; await u.page.locator('#mosaic-booking-layer').locator('.be-choice', { hasText: 'Mindegy' }).click(); }
  const t2 = Date.now();
  await u.page.locator('#mosaic-booking-layer').locator('.be-naptar').first().waitFor({ timeout: 25000 });
  const vazMs = Date.now() - t2;
  await u.page.locator('#mosaic-booking-layer').locator('.be-nnap.szabad').first().waitFor({ timeout: 25000 });
  const szabadMs = Date.now() - t2;
  ok(`sebesseg | ${cimke}: a naptar-vaz azonnal (<1,5 mp), az elso szabad nap hideg gyorsitotarral is gyors (<4 mp)`, vazMs < 1500 && szabadMs < 4000, `vaz ${vazMs} ms, elso szabad nap ${szabadMs} ms${elso ? ', szakember-valaszto ' + t1 + ' ms' : ''}`);
  await u.ctx.close();
}

// ujratoltes ?booking=1-gyel: a reteg ujra megnyilik; bezaras utan tiszta cim
await page.goto(BAZIS + OLDAL + '?utm_source=teszt&utm_medium=cpc&gclid=TESZT123&booking=1&business=oxygen&service=466110', { waitUntil: 'domcontentloaded' });
const c2 = await varCim(page);
ok('ujratoltes (?booking=1): a reteg megnyilik a jo allapotban', !!c2 && c2.includes('Melyik szakembert választod?'), `cim="${c2}"`);
await reteg(page).locator('#be-close').click();
await page.waitForFunction(() => !document.getElementById('mosaic-booking-layer'), null, { timeout: 8000 }).catch(() => {});
const veg = url(page);
ok('?booking=1 beerkezo link: a bezaras nem nyul az URL-hez (nincs extra oldalmegtekintes), a UTM / click ID megmarad', veg.searchParams.get('booking') === '1' && veg.searchParams.get('gclid') === 'TESZT123' && veg.searchParams.get('utm_source') === 'teszt' && !veg.hash, veg.search);

if (LANDINGEK_TESZT) {
// --- valodi landing-oldalak: a (linktermekbol kapott) foglalo-gombok a retegat nyitjak, nem navigalnak --------------------------------------------
// 2026-10-04 (elesites): a fomenu "FOGLALAS" gombja es az oldalak gombjai MINDEN oldalon a foglalo retegat nyitjak (asztalon es mobilon is); uzletagankent egy-ket jellemzo oldal
const LANDINGEK = ['/lezeres-szortelenites-budapest', '/headspa-budapest-hungary', '/noi-fodrasz-budapesten-30-szazalek-kedvezmennyel',
  '/headspa-budapest', '/home', '/noi-fodraszat-budapest', '/balayage-haj-festes-budapest', '/oxigenterapia-budapest', '/vegleges-szortelenites-ferfiaknak', '/sminktetovalas-regi', '/ajandekkartya-szulinapra', '/aszf']; // a /headspa-ajandekkartya a #64 (Gift Commerce Engine) ota az uj ajandekkartya-vasarlo oldal: nincs rajta foglalo-gomb
for (const lap of LANDINGEK) {
  await page.goto(BAZIS + lap, { waitUntil: 'domcontentloaded' });
  const van = await page.waitForFunction(() => typeof window.openBooking === 'function', null, { timeout: 15000 }).then(() => true).catch(() => false);
  if (!van) { ok(lap + ' | launcher betoltodott', false); continue; }
  const hrefek = await page.$$eval('a[href*="foglalo-motor"]', (as) => [...new Set(as.map((a) => a.getAttribute('href')))]);
  ok(lap + ' | van motor-link (' + hrefek.length + ')', hrefek.length > 0);
  // a regi foglalo-oldalakra mutato gomb nem maradt (a hub-oldalak sajat fulei kivetel)
  const regi = await page.$$eval('a[href]', (as) => as.map((a) => [a.getAttribute('href'), (a.textContent || '').replace(/\s+/g, ' ').trim()]).filter(([h]) => /^\/(idpontfoglalas|mosaic-hair-idopontfoglalas|szortelenites-foglalas|pmu-foglalas)\/?(\?|#|$)/.test(h)));
  ok(lap + ' | nem maradt gomb a regi foglalo-oldalakra (' + regi.length + ')', regi.every(([h]) => h.split(/[?#]/)[0].replace(/\/$/, '') === lap), regi.slice(0, 3).map((r) => r.join(' ')).join(' | '));
  // a fomenu "FOGLALAS" gombja: lathato, es az altalanos kezdoallapotot (Mit szeretnel foglalni?) nyitja a retegben
  const menu = page.locator('a[href="/foglalo-motor"]:visible').first();
  {
    const lathato = (await menu.count()) > 0;
    ok(lap + ' | fomenu: lathato FOGLALAS gomb a foglalora kotve', lathato, '');
    if (lathato) {
      await page.evaluate(() => { window.__marker = 'maradt'; });
      await menu.click({ timeout: 8000 }).catch(() => page.evaluate(() => document.querySelector('a[href="/foglalo-motor"]').click()));
      const cm = await varCim(page);
      ok(lap + ' | fomenu: FOGLALAS -> reteg, "Mit szeretnel foglalni?" (az URL valtozatlan, nincs oldalvaltas)', cm === 'Mit szeretnél foglalni?' && url(page).pathname === lap && !url(page).hash && (await page.evaluate(() => window.__marker)) === 'maradt', 'cim="' + cm + '"');
      await reteg(page).locator('#be-close').click().catch(() => {});
      await page.waitForFunction(() => !document.getElementById('mosaic-booking-layer'), null, { timeout: 8000 }).catch(() => {});
    }
  }
  for (const h of hrefek.filter((x) => x !== '/foglalo-motor').slice(0, 5)) {
    await page.evaluate((x) => { window.__marker = 'maradt'; [...document.querySelectorAll('a[href]')].find((a) => a.getAttribute('href') === x).click(); }, h);
    const q = new URL(h, BAZIS).searchParams;
    const pmu = q.get('business') === 'pmu';
    const c = pmu ? ((await reteg(page).locator('iframe.be-pmu').waitFor({ timeout: 15000 }).then(() => 'PMU-keret').catch(() => null))) : await varCim(page);
    const u = url(page);
    ok(lap + ' | CTA ' + h.replace('/foglalo-motor?', '') + ' -> reteg (az URL valtozatlan)', !!c && u.pathname === lap && !u.searchParams.has('booking') && !u.hash && (await page.evaluate(() => window.__marker)) === 'maradt', 'cim="' + c + '"');
    await reteg(page).locator('#be-close').click().catch(() => {});
    await page.waitForFunction(() => !document.getElementById('mosaic-booking-layer'), null, { timeout: 8000 }).catch(() => {});
  }
}
// --- lejjebb gorgetett oldalon (2026-10-05): a gorgetes-zar NEM mozgatja az oldalt (korabban body fixed + top:-scrollY volt: telefonon a lap aljan a reteg letrejott, de FEHER kepernyo maradt) ---
for (const lap of ['/', '/paros-headspa-budapest', '/lezeres-szortelenites-budapest', '/oxigenterapia-budapest']) {
  await page.goto(BAZIS + lap, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openBooking === 'function', null, { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => { window.scrollTo({ top: Math.round(document.documentElement.scrollHeight * 0.4), behavior: 'instant' }); return null; }); // a landingeken scroll-behavior:smooth lehet: azonnali ugras kell
  await page.waitForTimeout(700);
  const y0 = await page.evaluate(() => Math.round(window.scrollY));
  await page.evaluate(() => { const a = [...document.querySelectorAll('a[href*="foglalo-motor?business"]')].filter((e) => e.getBoundingClientRect().height > 4).pop(); (a || document.querySelector('a[href*="foglalo-motor"]')).click(); });
  await varCim(page);
  const st = await page.evaluate(() => { const h = document.getElementById('mosaic-booking-layer'); const r = h.getBoundingClientRect(); const felso = document.elementsFromPoint(innerWidth / 2, innerHeight / 2)[0]; return { bodyPos: getComputedStyle(document.body).position, bodyTop: getComputedStyle(document.body).top, y: Math.round(scrollY), host: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], vw: innerWidth, vh: innerHeight, felul: felso === h }; });
  ok(lap + ' | lejjebb gorgetve (y=' + y0 + '): a body NEM fixed / eltolt, az oldal helyzete megmarad', y0 > 500 && st.bodyPos !== 'fixed' && Math.abs(st.y - y0) <= 2, JSON.stringify(st));
  ok(lap + ' | lejjebb gorgetve: a reteg a teljes ablakot fedi es legfelul van', st.host[0] === 0 && st.host[1] === 0 && st.host[2] === st.vw && st.host[3] === st.vh && st.felul, JSON.stringify(st));
  await reteg(page).locator('#be-close').click().catch(() => {});
  await page.waitForFunction(() => !document.getElementById('mosaic-booking-layer'), null, { timeout: 8000 }).catch(() => {});
  const y1 = await page.evaluate(() => Math.round(scrollY));
  ok(lap + ' | lejjebb gorgetve: bezaras utan az oldal ugyanott van, a gorgetes visszaall', Math.abs(y1 - y0) <= 2 && (await page.evaluate(() => getComputedStyle(document.body).overflow !== 'hidden' && getComputedStyle(document.documentElement).overflow !== 'hidden')), y0 + ' -> ' + y1);
}
// --- a regi foglalo-oldalak: ures oldal + bezarhatatlan felugro (a cim megmarad, a tartalom rejtett, a foglalo magatol megnyilik, nincs X); a kuponos oldalak 301 a fooldalra ---
{
  const URES = [['/idpontfoglalas', 'Mit szeretnél foglalni?'], ['/mosaic-hair-idopontfoglalas', 'Mit szeretnél foglalni?'], ['/szortelenites-foglalas', null], ['/pmu-foglalas', 'PMU'], ['/smink-foglalas', 'PMU'], ['/naptar', 'Mit szeretnél foglalni?']];
  for (const [lap, vart] of URES) {
    await page.goto(BAZIS + '/aszf', { waitUntil: 'domcontentloaded' }); // elozo oldal: innen lepunk a regi foglalo-oldalra (a visszalepes proba)
    await page.evaluate(() => { try { sessionStorage.clear(); } catch (e) { /* nincs tarolo */ } }); // uj latogato: nincs mentett allapot (a 30 percen beluli ujranyitas ott folytatja, ahol tartott, es a vissza gomb elobb az elozo lepesre lep)
    await page.goto(BAZIS + lap + '?utm_source=teszt&fbclid=TESZT', { waitUntil: 'domcontentloaded' });
    const c = vart === 'PMU' ? ((await reteg(page).locator('iframe.be-pmu').waitFor({ timeout: 25000 }).then(() => 'PMU-keret').catch(() => null))) : await varCim(page);
    ok(lap + ' | ures oldal: a foglalo MAGATOL megnyilik' + (vart && vart !== 'PMU' ? ' ("' + vart + '")' : vart ? ' (PMU-keret)' : ''), !!c && (!vart || vart === 'PMU' || c === vart), 'cim="' + c + '"');
    await page.waitForTimeout(3000); // a PMU-keret betoltese utan (ember-szeru kesleltetes)
    const allapot = await page.evaluate(() => { const s = document.getElementById('SITE_CONTAINER'); const b = document.getElementById('mh-cc'); return { tartalomRejtett: !s || getComputedStyle(s).display === 'none', mero: typeof window.openBooking === 'function', sutiSavInert: b ? b.inert : null, sutiSavZ: b ? getComputedStyle(b).zIndex : null, utvonal: location.pathname }; });
    ok(lap + ' | ures oldal: a regi tartalom rejtett, az URL valtozatlan', allapot.tartalomRejtett && allapot.utvonal === lap, JSON.stringify(allapot));
    ok(lap + ' | ures oldal: NINCS bezaras gomb (X), a foglalo kozepen / teljes kepernyon van', (await reteg(page).locator('#be-close').count()) === 0 && (await reteg(page).count()) === 1);
    ok(lap + ' | ures oldal: a suti-sav a foglalo folott marad es kattinthato (a hozzajarulas megadhato)', allapot.sutiSavInert !== true && (allapot.sutiSavZ === null || +allapot.sutiSavZ > 2147483000), 'inert=' + allapot.sutiSavInert + ' z=' + allapot.sutiSavZ);
    await page.keyboard.press('Escape'); await page.mouse.click(4, 4); await page.waitForTimeout(500);
    ok(lap + ' | ures oldal: Esc es a hatterre kattintas sem zar (a foglalo marad)', (await reteg(page).count()) === 1);
    await page.evaluate(() => history.back());
    await page.waitForURL((u) => new URL(u).pathname !== lap, { timeout: 8000 }).catch(() => {});
    ok(lap + ' | ures oldal: a bongeszo vissza gombja az elso lepesnel elhagyja az oldalt (nem marad ures oldal)', url(page).pathname === '/aszf' || url(page).pathname === '/', url(page).pathname);
  }
  for (const lap of ['/fodraszat-foglalas', '/kupon-utan-foglalas']) {
    await page.goto(BAZIS + lap + '?utm_source=teszt', { waitUntil: 'domcontentloaded' });
    ok(lap + ' | megszunt: 301 a fooldalra (az UTM megmarad)', url(page).pathname === '/' && url(page).searchParams.get('utm_source') === 'teszt', url(page).pathname + url(page).search);
  }
}
// --- meres-vedelem: a GTM-es landing-oldalon a reteg teljes hasznalata (nyitas, lepesek, adatlap, bezaras) nem indit meresi esemenyt a fo ablakbol ----
{
  await page.goto(BAZIS + '/lezeres-szortelenites-budapest?gclid=TESZT123&utm_source=teszt&utm_medium=cpc', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openBooking === 'function', null, { timeout: 15000 });
  await page.waitForTimeout(9000); // a betoltes-kori meresi esemenyek lecsengenek
  const n0 = merEsem.length;
  await page.evaluate(() => document.querySelector('a[href*="foglalo-motor"][href*="service=konzult"]').click());
  await varCim(page); await page.waitForTimeout(2500);
  await reteg(page).locator('.be-idogomb').first().click(); await page.waitForTimeout(2500);
  await reteg(page).locator('iframe.be-iframe').waitFor({ timeout: 15000 }); await page.waitForTimeout(8000); // az idopont utan rogton az adatlap (nincs osszegzo kepernyo)
  await reteg(page).locator('#be-back').click(); await page.waitForTimeout(2500);
  await reteg(page).locator('#be-close').click();
  await page.waitForFunction(() => !document.getElementById('mosaic-booking-layer'), null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(4000);
  const uj = merEsem.slice(n0).filter((e) => !(e.plat === 'tiktok' && /^(EngagedSession|\/api\/v2\/(monitor|pixel\/(act|inter)))/.test(e.ev)) && !(e.plat === 'tiltott' && /^\/csp\//.test(e.ev))); // (a bongeszo CSP-jelentesei nem meresi esemenyek)
  ok('meres-vedelem: a reteg hasznalata (GTM-es oldalon) nem indit meresi kerest a fo ablakbol', uj.length === 0, uj.slice(0, 6).map((e) => e.plat + ':' + e.ev).join(', '));
}

// a PMU-landing es a koszonooldalak nem kapnak launchert
for (const lap of ['/sminktetovalas-budapest', '/fodrasz-ok']) {
  await page.goto(BAZIS + lap, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1500);
  ok(lap + ' | nincs launcher', await page.evaluate(() => typeof window.openBooking === 'undefined'));
}

}
ok('nincs JS-hiba a konzolon', hibak.length === 0, hibak.slice(0, 3).join(' | '));
await ctx.close();
await browser.close();
const rossz = eredmeny.filter((e) => !e.rendben);
console.log(`\n${eredmeny.length} ellenorzes, ${rossz.length} hiba${MOBIL ? ' (mobil)' : ' (asztali)'}`);
process.exit(rossz.length ? 1 : 0);
