// A helyben nyilo foglalo-reteg ellenorzese bongeszoben (Playwright), foglalas nelkul.
//
//   node tools/meres-proba/reteg-proba.mjs [--overlay dist] [--bazis https://...] [--mobil 1] [--kepek mappa] [--oldal /booking-test]
//
// Minden belepesi pontnal: a CTA a retegben nyitja a foglalot (nem navigal), a jo kezdo allapotba er, az URL frissul (booking=1), a bezaras (X) / vissza
// gomb visszaviszi az eredeti cimre (az Esc es a hatterre kattintas NEM zar), az ujratoltes visszaallitja; az ujranyitas ott folytatja, ahol tartott. A kimeno meres (capig.stape.do is) alapbol tiltva (tilt.mjs).
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
  ['Lezer altalanos', { business: 'laser' }, null],
  ['Lezer konzultacio', { business: 'laser', service: 'konzult' }, 'Válassz időpontot'],
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
  ok('design | HeadSpa: elso kerdes "Ajandekkartyaval vagy anelkul foglalsz?", ket valasztas ikonnal', (await cimSzoveg(page)) === 'Ajándékkártyával vagy anélkül foglalsz?' && hs1.length === 2 && (await reteg(page).locator('.be-ikon').count()) === 2, hs1.map((x) => x.trim()).join(' | '));
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
  ok('design | HeadSpa idopont: a PMU-foglalo havi naptara (7 oszlopos racs, szabad napok zoldek, idopont-gombok)', (await reteg(page).locator('.be-hetnap').count()) === 7 && szabadDb > 3 && idoDb > 0, `szabad nap: ${szabadDb}, idopont: ${idoDb}`);
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
  ok('design | Oxigen: a szakember-valaszto az idopont ELOTT, kepes kartyakon (a Salonic fotoi, nem monogram, nem legordulo)', /szakembert/.test(szakCim) && szakDb >= 3 && (await reteg(page).locator('select').count()) === 0 && (await reteg(page).locator('img.be-choice-img').count()) === 3 && k.jo === k.db, `${szakCim} (${szakDb} kartya) ${JSON.stringify(k)}`);
  await reteg(page).locator('.be-choice').first().click();
  await reteg(page).locator('.be-nnap.szabad').first().waitFor({ timeout: 25000 });
  ok('design | Oxigen: a valasztott szakember neve a savban, a naptar a szakember idopontjaival, nincs legordulo', (await reteg(page).locator('select').count()) === 0 && (await reteg(page).locator('.be-idogomb').count()) > 0 && /Bozsoki|Szűcs|Menyhárt/.test(await reteg(page).locator('.be-svc').first().textContent()), (await reteg(page).locator('.be-svc').first().textContent()).replace(/\s+/g, ' ').trim().slice(0, 100));
  await zar(page);

  // Fodraszat: a BELEPO a fodrasz-valaszto; utana szandekek, kezelesek (ikonnal), hajhosszok (hajhossz-ikonnal); a valasztott fodrasz idopontjai
  await nyit(page, { business: 'hair' }); await varCim(page); await page.waitForTimeout(1200);
  k = await kepekBetoltve(page, 3);
  ok('design | Fodraszat: a belepo a fodrasz-valaszto (kepek, "Mindegy"), csak utana a szolgaltatas', (await cimSzoveg(page)) === 'Melyik fodrászt választod?' && k.db >= 4 && k.jo === k.db && (await reteg(page).locator('.be-ikon').count()) === 1, JSON.stringify(k));
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
  ok('design | Fodraszat: nincs "Egyeb fodraszati szolgaltatas", az elemei kulon kartyak', !szand.includes('Egyéb fodrászati szolgáltatás') && ['Női szárítás', 'Hajszerkezet újraépítés', 'Póthaj'].every((x) => szand.includes(x)), szand.join(' | '));
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
    if (szakember) { ok(`design | ${cimke}: a landing a szakember-valasztoval kezdodik`, /szakembert/.test(await cimSzoveg(page))); await reteg(page).locator('.be-choice').last().click(); }
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

// --- sebesseg: a naptar mennyi ido alatt jelenik meg hideg gyorsitotarral (uj kontextus, nincs elomelegites), uzletagankent ------------------------
const SEBESSEG = [['HeadSpa paros', { business: 'headspa', service: 'paros' }, null], ['Fodraszat konzultacio', { business: 'hair', service: 'konzult' }, null], ['Lezer konzultacio', { business: 'laser', service: 'konzult' }, null], ['Oxigen 1. alkalom', { business: 'oxygen', service: '466110' }, 'szakember']];
for (const [cimke, opts, elso] of SEBESSEG) {
  const u = await ujLap();
  await u.page.goto(BAZIS + OLDAL, { waitUntil: 'domcontentloaded' });
  await u.page.waitForFunction(() => typeof window.openBooking === 'function', null, { timeout: 15000 });
  const t0 = Date.now();
  await u.page.evaluate((o) => window.openBooking(o), opts);
  let t1 = 0;
  if (elso) { await u.page.locator('#mosaic-booking-layer').locator('.be-choice').first().waitFor({ timeout: 25000 }); t1 = Date.now() - t0; await u.page.locator('#mosaic-booking-layer').locator('.be-choice').last().click(); }
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
  await reteg(page).locator('.be-idogomb').first().click(); await page.waitForTimeout(2500);
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
