// Munkatars-link (?staff=) bongeszoben, a Salonic JELENLEGI (valodi, csak olvasott) adataival: foglalas nincs, a Salonic adatlapot (guestData) a proba elfogja.
//
//   node tools/meres-proba/munkatars-proba.mjs [--overlay dist] [--bazis https://...] [--mobil 1] [--oldal /booking-test]
//
// Minden szakemberre (fodraszat, oxigenterapia): a link megnyitasa utan a szakember-valaszto KIMARAD, a fejlecben a munkatars neve latszik, az elso szabad idopontra
// koppintva a Salonic adatlap cime a munkatars azonositojat hordozza (employeeId) - vagyis tenyleg az o idopontjat foglalnank. Ismeretlen kulcsra a valaszto jelenik meg
// (megjegyzessel). Kimeno meres (GA4, Meta, TikTok, Ads, Stape, Zapier) tiltva (tilt.mjs); a szamlalo-kereseket a proba elfogja.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { UA, UA_MOBIL, platformOf, engedett, dnsArg, ures } from './tilt.mjs';
import { createSalonicAdapter } from '../../assets/js/booking-engine/salonic-adapter.js';
import { staffCoverServices, staffLinkKey, staffDisplayName } from '../../assets/js/booking-engine/flow.js';
import { HAIR } from '../../assets/js/booking-engine/flows/hair.js';
import { OXYGEN } from '../../assets/js/booking-engine/flows/oxygen.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const OVERLAY = arg('overlay', ''), MOBIL = arg('mobil', '0') === '1', OLDAL = arg('oldal', '/booking-test'), BAZIS = arg('bazis', 'https://www.mosaicheadspa.hu');
const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let fajlUtvonal = null;
if (OVERLAY) ({ fajlUtvonal } = await import('../serve-dist.mjs'));
const TIPUS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
const ua = MOBIL ? UA_MOBIL : UA;
const eredmeny = [];
const ok = (cimke, rendben, reszlet = '') => { eredmeny.push({ cimke, rendben }); console.log(`${rendben ? 'OK  ' : 'HIBA'} ${cimke}${reszlet ? ' | ' + reszlet : ''}`); };

// --- a Salonic jelenlegi adatai (olvasas): kik a szakemberek, melyik szolgaltatast vegzik ---------------------------------------------------------------
const adapter = createSalonicAdapter({ fetchImpl: (u, o) => fetch(u, o) });
const ADAT = {};
for (const [business, flow] of [['hair', HAIR], ['oxygen', OXYGEN]]) {
  const services = (await adapter.getServices(business)).filter((s) => s.bookingType !== 'voucher_redemption' && !/ajándékkártya|ajandekkartya|kupon/i.test(s.name));
  const nevek = new Map();
  for (const s of staffCoverServices(services)) for (const x of await adapter.getStaff(business, s.serviceId, { days: 60 })) if (x.staff_label && !nevek.has(String(x.staff_id))) nevek.set(String(x.staff_id), x.staff_label);
  const lista = [...nevek].map(([id, label]) => ({ id, label }));
  ADAT[business] = { flow, services, lista };
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--disable-blink-features=AutomationControlled', dnsArg()] });
async function ujLap() {
  const ctx = await browser.newContext({ userAgent: ua, viewport: MOBIL ? { width: 390, height: 844 } : { width: 1280, height: 900 }, locale: 'hu-HU', timezoneId: 'Europe/Budapest', serviceWorkers: 'block', isMobile: MOBIL, hasTouch: MOBIL });
  const naplo = { guest: [], mer: 0 };
  await ctx.route('**/*', async (route) => {
    const req = route.request(), url = req.url(); let u; try { u = new URL(url); } catch (e) { return route.continue(); }
    if (/salonic\.hu$/.test(u.hostname) && /\/guestData\//.test(u.pathname)) { naplo.guest.push(Object.fromEntries(u.searchParams)); return route.fulfill({ status: 200, headers: { 'content-type': 'text/html' }, body: '<!doctype html><title>proba</title><p>proba</p>' }); } // az adatlapot nem toltjuk (nincs foglalas, nincs tartas)
    if (/\/api\/foglalo-szamlalo$/.test(u.pathname)) return route.fulfill({ status: 204 });
    if (/\/api\/foglalas-esemeny(\?|$)/.test(u.pathname + u.search)) return route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: req.method() === 'GET' ? '{"kor_ms":null}' : '{"irva":false,"ok":"proba"}' });
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
    if (plat) { naplo.mer++; return route.fulfill(ures(req)); }
    return route.continue();
  });
  const page = await ctx.newPage();
  const hibak = []; page.on('pageerror', (e) => hibak.push(String(e.message).slice(0, 160)));
  await page.goto(BAZIS + OLDAL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openBooking === 'function', null, { timeout: 15000 });
  return { ctx, page, naplo, hibak };
}
const L = (p) => p.locator('#mosaic-booking-layer'); // (a reteg Shadow DOM-ja: a lancolt locator atlatja)
const cim = async (p, ido = 25000) => { const c = L(p).locator('.be-title').first(); try { await c.waitFor({ timeout: ido }); return (await c.textContent()).trim(); } catch (e) { return null; } };

// --- 1) minden szakemberre: a valaszto kimarad, a fejlecben a nev, az idopont az o azonositojaval megy az adatlapra ------------------------------------------
for (const [business, { flow, services, lista }] of Object.entries(ADAT)) {
  ok(`${business}: a Salonic szakember-listaja nem ures`, lista.length >= 2, lista.map((x) => staffDisplayName(x.label)).join(', '));
  for (const x of lista) {
    const kulcs = staffLinkKey(x.label, lista); const nev = staffDisplayName(x.label);
    const svc = services.find((s) => s.durationMin && s.bookingType !== 'consultation' && (s.staffIds || []).map(String).includes(String(x.id)));
    if (!svc) { ok(`${business} / ${nev}: van kezelese a Salonicban`, false, 'nincs szolgaltatas'); continue; }
    const u = await ujLap();
    await u.page.evaluate((o) => window.openBooking(o), { business, service: svc.serviceId, staff: kulcs });
    await L(u.page).locator('.be-nnap.szabad').first().waitFor({ timeout: 40000 }).catch(() => {});
    const naptarVan = (await L(u.page).locator('.be-nnap.szabad').count()) > 0;
    const fej = ((await L(u.page).locator('.be-svc small').first().textContent({ timeout: 3000 }).catch(() => '')) || '').trim();
    const cimMost = await cim(u.page, 1000);
    ok(`${business} / ${nev} (?staff=${kulcs}): a szakember-valaszto KIMARAD, rogton az idopont-naptar`, naptarVan && cimMost !== flow.copy.staffListTitle, `cim=${cimMost}`);
    ok(`${business} / ${nev}: a fejlecben a munkatars neve latszik`, new RegExp(nev.split(/\s+/).pop().normalize('NFD').replace(/[\u0300-\u036f]/g, ''), 'i').test(fej.normalize('NFD').replace(/[\u0300-\u036f]/g, '')), fej);
    if (naptarVan) {
      await L(u.page).locator('.be-idogomb').first().click();
      await u.page.waitForFunction(() => !!document.querySelector('#mosaic-booking-layer')?.shadowRoot?.querySelector('iframe.be-iframe'), null, { timeout: 25000 }).catch(() => {});
      await u.page.waitForTimeout(800);
      const g = u.naplo.guest.at(-1) || {};
      ok(`${business} / ${nev}: az adatlap (Salonic) a munkatars azonositojaval nyilik (employeeId=${x.id}): az o idopontjat foglalnank`, String(g.employeeId) === String(x.id) && String(g.serviceId) === String(svc.serviceId), JSON.stringify(g).slice(0, 120));
    }
    ok(`${business} / ${nev}: nincs JS-hiba, nincs kimeno meres`, u.hibak.length === 0 && u.naplo.mer === 0, u.hibak.join(' | ') + (u.naplo.mer ? ' mer=' + u.naplo.mer : ''));
    await u.ctx.close();
  }
}

// --- 1b) a tobbi belepesi tipus: nincs szolgaltatas (szakember -> kezeles-szandekok), kategoria-landing, konzultacio (egyenesen a naptar) ----------------------------------
{
  const { flow, services, lista } = ADAT.hair;
  const x = lista.find((y) => /betti/i.test(y.label)) || lista[0]; const kulcs = staffLinkKey(x.label, lista); const nev = staffDisplayName(x.label);
  let u = await ujLap();
  await u.page.evaluate((o) => window.openBooking(o), { business: 'hair', staff: kulcs });
  let c = await cim(u.page);
  ok(`hair / ${nev}: ?staff= szolgaltatas nelkul: a fodrasz-valaszto kimarad, a kezeles-szandekek jonnek (cim: ${c})`, c === flow.copy.introTitle, '');
  ok('hair / ' + nev + ': a szandek-kartyak megvannak (a munkatars kezelesei)', (await L(u.page).locator('.be-choice').count()) >= 2, '');
  await u.ctx.close();
  u = await ujLap();
  await u.page.evaluate((o) => window.openBooking(o), { business: 'hair', category: 'balayage', staff: kulcs });
  c = await cim(u.page);
  ok(`hair / ${nev}: ?category=balayage&staff= : a valaszto kimarad (cim: ${c})`, !!c && c !== flow.copy.staffListTitle, '');
  await u.ctx.close();
  const konz = services.find((s) => /konzult/i.test(s.name) && (s.staffIds || []).length);
  const kx = konz && lista.find((y) => konz.staffIds.map(String).includes(String(y.id)));
  if (konz && kx) {
    u = await ujLap();
    await u.page.evaluate((o) => window.openBooking(o), { business: 'hair', service: konz.serviceId, staff: staffLinkKey(kx.label, lista) });
    await L(u.page).locator('.be-nnap.szabad').first().waitFor({ timeout: 40000 }).catch(() => {});
    const fej = ((await L(u.page).locator('.be-svc small').first().textContent({ timeout: 3000 }).catch(() => '')) || '').trim();
    ok(`hair konzultacio / ${staffDisplayName(kx.label)}: egyenesen a naptar, a fejlecben a munkatars neve (${fej})`, fej.includes(staffDisplayName(kx.label)), '');
    await u.ctx.close();
  } else console.log('INFO: nincs olyan hair konzultacio, amit konkret munkatars vegez - a konzultacios eset kimarad');
}

// --- 1c) a link PONTOSAN igy, ahogy a vendeg megnyitja: a /foglalo-motor oldal kozvetlenul (nem a reteg a mas oldalon), a megadott cimen ------------------------------
for (const [business, { flow, services, lista }] of Object.entries(ADAT)) {
  for (const x of lista) {
    const kulcs = staffLinkKey(x.label, lista); const nev = staffDisplayName(x.label);
    const svc = services.find((s) => s.durationMin && s.bookingType !== 'consultation' && (s.staffIds || []).map(String).includes(String(x.id)));
    // a) csak uzletag + munkatars (a legegyszerubb link): a szakember-valaszto nem jelenhet meg
    let u = await ujLap();
    await u.page.goto(BAZIS + '/foglalo-motor?business=' + business + '&staff=' + kulcs, { waitUntil: 'domcontentloaded' });
    const c = await u.page.locator('.be-title').first().textContent({ timeout: 40000 }).then((s) => s.trim()).catch(() => null);
    ok(`LINK /foglalo-motor?business=${business}&staff=${kulcs}: a szakember-valaszto nem jelenik meg (cim: ${c})`, !!c && c !== flow.copy.staffListTitle, '');
    await u.ctx.close();
    // b) uzletag + munkatars + szolgaltatas: egyenesen a naptar, a munkatars neve a fejlecben, az adatlap az o azonositojaval
    if (!svc) continue;
    u = await ujLap();
    await u.page.goto(BAZIS + '/foglalo-motor?business=' + business + '&staff=' + kulcs + '&service=' + svc.serviceId, { waitUntil: 'domcontentloaded' });
    await u.page.locator('.be-nnap.szabad').first().waitFor({ timeout: 40000 }).catch(() => {});
    const fej = ((await u.page.locator('.be-svc small').first().textContent({ timeout: 3000 }).catch(() => '')) || '').trim();
    ok(`LINK /foglalo-motor?business=${business}&staff=${kulcs}&service=...: a naptar a(z) ${nev} neveivel (${fej})`, fej.includes(nev), '');
    await u.page.locator('.be-idogomb').first().click().catch(() => {});
    await u.page.waitForTimeout(2500);
    const g = u.naplo.guest.at(-1) || {};
    ok(`LINK ${business} / ${nev}: a Salonic adatlap az o azonositojaval (employeeId=${x.id}) nyilik`, String(g.employeeId) === String(x.id), JSON.stringify(g).slice(0, 110));
    await u.ctx.close();
  }
}

// --- 2) ismeretlen kulcs: a valaszto jelenik meg, megjegyzessel; a foglalas nem akad el ----------------------------------------------------------------------
for (const [business, { flow }] of Object.entries(ADAT)) {
  const u = await ujLap();
  const svc = ADAT[business].services.find((s) => s.durationMin && s.bookingType !== 'consultation');
  await u.page.evaluate((o) => window.openBooking(o), business === 'hair' ? { business, staff: 'nincsilyenmunkatars' } : { business, service: svc.serviceId, staff: 'nincsilyenmunkatars' });
  const c = await cim(u.page);
  ok(`${business}: ismeretlen ?staff= -> a szakember-valaszto jelenik meg (cim: ${c})`, c === flow.copy.staffListTitle, '');
  const jegyzet = ((await L(u.page).locator('.be-note').first().textContent({ timeout: 3000 }).catch(() => '')) || '').trim();
  ok(`${business}: ismeretlen ?staff= -> rovid megjegyzes, hogy a munkatars nem talalhato`, /nem találjuk/.test(jegyzet), jegyzet.slice(0, 80));
  const kartyak = await L(u.page).locator('.be-choice').count();
  ok(`${business}: a valaszto kartyai megvannak (a "Mindegy" + a szakemberek)`, kartyak >= 3, 'kartya=' + kartyak);
  await u.ctx.close();
}

// --- 3) staff nelkul minden valtozatlan: a valaszto megjelenik -------------------------------------------------------------------------------------------------
{
  const u = await ujLap();
  await u.page.evaluate(() => window.openBooking({ business: 'hair' }));
  const c = await cim(u.page);
  ok('hair, ?staff= nelkul: a fodrasz-valaszto megjelenik (valtozatlan), megjegyzes nelkul', c === HAIR.copy.staffListTitle && (await L(u.page).locator('.be-note').count()) === 0, 'cim=' + c);
  await u.ctx.close();
}

await browser.close();
const rossz = eredmeny.filter((x) => !x.rendben);
console.log(`\n${eredmeny.length} ellenorzes, ${rossz.length} hiba${MOBIL ? ' (mobil)' : ' (asztali)'}`);
process.exit(rossz.length ? 1 : 0);
