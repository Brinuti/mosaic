// A foglalo -> koszonooldal lanc meresi ellenorzese: MINDEN keretben naplozza a kimeno meresi kereseket (Google Ads, GA4, stape, Meta, TikTok,
// Zapier), es le is tiltja oket (200-as ures valasz): igy semmi nem jut el a hirdetesi fiokokba.
//
//   node meres-proba.mjs --szenario hair|oxigen2|lezer --mod szim|valodi --out x.json [--overlay <dist-mappa>] [--clickids 1] [--fejes 1] [--megall 1]
//
//   --mod szim     a Salonic adatlap (iframe) helyett csak a Salonic atiranyitasa fut (a koszonooldalra), foglalas NEM jon letre
//   --mod valodi   valodi foglalas a Salonic-urlappal (csak a kert szenarional; a lemondast kulon kell elvegezni)
//   --overlay      az eles tartomany (www.mosaicheadspa.hu) oldalait a helyi dist/-bol szolgalja ki (meg nem deployolt valtozat kiprobalasa)
//   --clickids 1   a foglalot hirdetesi kattintast utanzo URL-rol inditja (gclid, fbclid, ttclid, utm_*)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SZ = arg('szenario', 'hair'), MOD = arg('mod', 'szim'), OUT = arg('out', `meres-${SZ}-${MOD}.json`);
const OVERLAY = arg('overlay', ''), CLICK = arg('clickids', '0') === '1', FEJES = arg('fejes', '0') === '1', MEGALL = arg('megall', '0') === '1';
const BASE = 'https://www.mosaicheadspa.hu';
const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const CLICK_QS = 'gclid=TESZT123&fbclid=TESZT456&ttclid=TESZT789&utm_source=teszt&utm_medium=cpc';

// landing: a "hirdetes -> landing -> motor" utvonalhoz (--landing 1): az oldal, es a motorra vezeto gomb szelektora (csak a link-atkotessel epitett dist-ben van)
const SZENARIOK = {
  hair: { start: '/foglalo-motor?business=hair&service=konzult', salonic: 'mosaic-hair.salonic.hu', landing: { elo: '/noi-fodrasz-budapesten-30-szazalek-kedvezmennyel', ut: '/noi-fodrasz-budapesten-30-szazalek-kedvezmennyel', link: 'a[href*="business=hair"]', engedMotor: 'Ingyenes konzultáció' },
    sim: { ut: '/fodrasz-ok', first: true, service: 'Fodrász konzultáció (9.900 Ft helyett most 0 Ft!)', category: 'Ingyenes Fodrász konzultáció', price: 0, location: 'Mosaic Hair', employee: 'Noel - 20% kedvezmény!', employeeId: 25095, placeId: 10823, serviceId: 232804 } },
  oxigen2: { start: '/foglalo-motor?business=oxygen&service=466158', salonic: 'mosaic-oxigen.salonic.hu', landing: { elo: '/oxigenterapia-budapest', ut: '/idpontfoglalas', link: 'a[href*="service=466158"]' },
    sim: { ut: '/oxigenterapia-masodik', first: false, service: 'Haj Oxigénterápia - 2. alkalomtól', category: 'Oxigénterápia - 2.alkalomtól', price: 26000, location: 'Mosaic Oxigén', employee: 'Menyhárt Móni', employeeId: 32969, placeId: 14409, serviceId: 466158 } },
  lezer: { start: '/foglalo-motor?business=laser&intent=first', salonic: 'mosaic-elysion.salonic.hu', terulet: /^Arc/, landing: { elo: '/lezeres-szortelenites-budapest', ut: '/idpontfoglalas', link: 'a[href*="intent=first"]' },
    sim: { ut: '/elysion-ok', first: true, service: 'ARC - Teljes arc', category: 'Végleges Szőrtelenítés - 1. Alkalom', price: 27000, location: 'Mosaic Elysion', employee: 'Elysion Pro Szőrtelenítés', employeeId: 32417, placeId: 14586, serviceId: 0 } },
};
const sc = SZENARIOK[SZ];
if (!sc) throw new Error('ismeretlen szenario: ' + SZ);
const LANDING = arg('landing', '0') === '1';
// a Salonic altal elallitott koszonooldal-URL (a szimulalt atiranyitashoz es a natív alapvonalhoz)
function koszonoUrl(host, start, sid) {
  const s = sc.sim;
  const bookingUrl = `https://${host}/guestData/?anyone=true&employeeId=${s.employeeId}&placeId=${s.placeId}&serviceId=${sid}&startDate=${start}&back=`;
  const p = new URLSearchParams({ first_booking: String(s.first), service: s.service, category: s.category, price: String(s.price), location: s.location, employee: s.employee, g: 'g:SZIM' + start, bookingUrl });
  return `${BASE}${s.ut}?${p.toString()}`;
}

// --- kimeno meresi kerelmek: naplozas + tiltas -----------------------------------------------------------------------------------------
const SZABALYOK = [
  ['google-ads', /^https:\/\/(www\.googleadservices\.com\/(pagead|ccm)\/|googleads\.g\.doubleclick\.net\/pagead\/|www\.google\.(com|hu)\/(pagead\/|rmkt\/|ccm\/)|pagead2\.googlesyndication\.com\/|ad\.doubleclick\.net\/)/],
  ['ga4', /^https:\/\/(region\d\.analytics\.google\.com\/|www\.google-analytics\.com\/|analytics\.google\.com\/|stats\.g\.doubleclick\.net\/g\/|www\.google\.hu\/ads\/ga-audiences)/],
  ['stape', /^https:\/\/(stape\.mosaicheadspa\.hu\/(g\/collect|data|_\/)|capig\.stape\.[a-z]+\/)/],
  ['meta', /^https:\/\/www\.facebook\.com\/tr[/?]/],
  ['tiktok', /^https:\/\/(analytics\.tiktok\.com\/api\/|analytics-ipv6\.tiktokw\.us\/|mcs\.tiktok\.com\/)/],
  ['zapier', /^https:\/\/hooks\.zapier\.com\//],
];
const platformOf = (url) => (SZABALYOK.find(([, re]) => re.test(url)) || [])[0] || null;
// ALAPBOL TILTVA: a sajat es a Salonic-oldalakon kivul minden harmadik fel fele csak a (GET) szkript- / betutoltes engedett; minden mas
// (barmilyen POST, ismeretlen host, stape-es meresi vegpont) naplozva es tiltva. Igy semmi nem szivarog ki, akkor sem, ha uj vegpont jelenik meg.
const ENGEDETT_GET = [
  /^https:\/\/(www\.)?mosaicheadspa\.hu\//,
  /^https:\/\/[a-z0-9.-]*salonic\.hu\//,
  /^https:\/\/www\.googletagmanager\.com\/(gtm\.js|gtag\/js|gtag\/destination)/,
  /^https:\/\/connect\.facebook\.net\/[^?]*(fbevents\.js|signals\/config\/)/,
  /^https:\/\/analytics\.tiktok\.com\/i18n\/pixel\/[^?]*\.js/,
  /^https:\/\/cdn\.trustindex\.io\//,
  /^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com)\//,
  /^https:\/\/stape\.mosaicheadspa\.hu\/[^?]*\.js(\?|$)/,
  /^https:\/\/www\.(facebook|youtube|youtube-nocookie)\.com\/(embed|plugins|v\d)/,
  /^https:\/\/(i\.ytimg\.com|img\.youtube\.com)\//,
  // statikus konyvtar-CDN-ek (a Salonic-urlap suti-sav, ikonok, jQuery): nem meres, de nelkuluk az urlap szkriptje elromlik
  /^https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|code\.jquery\.com|ajax\.googleapis\.com|maxcdn\.bootstrapcdn\.com|stackpath\.bootstrapcdn\.com|use\.fontawesome\.com)\//,
];
// a Salonic maga (naptar-API, oldalak) barmilyen metodussal engedett: szimulalt modban az adatlap ugyis ki van valtva, a foglalas nem jon letre;
// a valodi foglalashoz a Salonic-urlap reCAPTCHA-ja is kell (nem meres, a Salonic sajat vedelme): barmilyen metodussal engedett
const engedett = (url, method) => /^https:\/\/[a-z0-9.-]*salonic\.hu\//.test(url) || /^https:\/\/(www\.google\.com\/recaptcha\/|www\.gstatic\.com\/recaptcha\/|www\.recaptcha\.net\/)/.test(url) || (method === 'GET' && ENGEDETT_GET.some((re) => re.test(url)));
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

const naplo = [], idovonal = [], harmadik = new Map();
const t0 = Date.now();
const mp = () => Date.now() - t0;

// Masodik vedvonal (a route-tiltason felul): a kizarolag meresre szolgalo hostok DNS-szinten sem feloldhatok, igy semmi nem juthat ki,
// meg akkor sem, ha egy kerest a route nem lat (pl. worker). A megosztott hostok (www.google.com/hu, www.facebook.com, analytics.tiktok.com,
// stape.mosaicheadspa.hu a szkriptje miatt) a route-tiltasra bizva maradnak.
const DNS_TILTAS = ['capig.stape.do', 'capig.stape.de', 'capig.stape.io', 'analytics-ipv6.tiktokw.us', 'mcs.tiktok.com', 'hooks.zapier.com', 'region1.analytics.google.com',
  'www.googleadservices.com', 'googleads.g.doubleclick.net', 'ad.doubleclick.net', 'stats.g.doubleclick.net', 'pagead2.googlesyndication.com', 'www.google-analytics.com', 'analytics.google.com'];
const browser = await chromium.launch({ executablePath: CHROME, headless: !FEJES, args: ['--disable-blink-features=AutomationControlled', '--host-resolver-rules=' + DNS_TILTAS.map((h) => `MAP ${h} ~NOTFOUND`).join(', ')] });
const context = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 900 }, locale: 'hu-HU', timezoneId: 'Europe/Budapest', serviceWorkers: 'block' });
// Hozzajarulas (a tulajdonos jovahagyasaval: "Elfogadom"): a sajat tarolonkba irva, mint a suti-sav gombja
await context.addInitScript(() => {
  try { if (/(^|\.)mosaicheadspa\.hu$/.test(location.hostname) && !localStorage.getItem('mh_cc')) localStorage.setItem('mh_cc', JSON.stringify({ v: 1, t: Date.now(), fun: true, ana: true, adv: true })); } catch (e) { /* nem baj */ }
});

const TIPUS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };
let fajlUtvonal = null;
if (OVERLAY) ({ fajlUtvonal } = await import('../serve-dist.mjs'));

function felvesz(req, plat, extra = {}) {
  let frame = null; try { const f = req.frame(); frame = { fo: f === f.page().mainFrame(), url: f.url().slice(0, 140) }; } catch (e) { frame = { fo: null, url: '?' }; }
  const u = new URL(req.url());
  const params = {}; for (const [k, v] of u.searchParams) (params[k] ||= []).push(v);
  const body = req.postData();
  naplo.push({ n: naplo.length + 1, t: mp(), plat, metodus: req.method(), keret: frame, host: u.host, ut: u.pathname, params, body: body ? body.slice(0, 8000) : null, ...extra });
}

await context.route('**/*', async (route) => {
  const req = route.request(); const url = req.url(); let u; try { u = new URL(url); } catch (e) { return route.continue(); }
  // 1) a meg nem deployolt valtozat kiprobalasa: az eles tartomany oldalai a helyi dist/-bol
  if (OVERLAY && u.hostname === 'www.mosaicheadspa.hu' && req.method() === 'GET') {
    const e = fajlUtvonal(decodeURIComponent(u.pathname), req.headers()['user-agent'] || UA);
    if (e.atiranyit) return route.fulfill({ status: 301, headers: { location: encodeURI(e.atiranyit) + u.search } });
    if (fs.existsSync(e.fajl) && fs.statSync(e.fajl).isFile()) {
      return route.fulfill({ status: 200, headers: { 'content-type': TIPUS[path.extname(e.fajl)] || 'application/octet-stream', 'cache-control': 'no-store' }, body: fs.readFileSync(e.fajl) });
    }
  }
  // 2) szimulalt mod: a Salonic adatlap (iframe) helyett a Salonic atiranyitasa a koszonooldalra (foglalas nem jon letre)
  if (MOD === 'szim' && u.hostname.endsWith('.salonic.hu') && u.pathname.startsWith('/guestData') && req.resourceType() === 'document' && req.frame().parentFrame()) {
    const s = sc.sim, q = u.searchParams;
    const start = q.get('startDate') || '1', sid = q.get('serviceId') || String(s.serviceId);
    const bookingUrl = `https://${u.hostname}/guestData/?anyone=true&employeeId=${s.employeeId}&placeId=${s.placeId}&serviceId=${sid}&startDate=${start}&back=`;
    const p = new URLSearchParams({ first_booking: String(s.first), service: s.service, category: s.category, price: String(s.price), location: s.location, employee: s.employee, g: 'g:SZIM' + start, bookingUrl });
    const cel = `${BASE}${s.ut}?${p.toString().replace(/\+/g, '+')}`;
    idovonal.push({ t: mp(), esemeny: 'szimulalt Salonic-atiranyitas', cel });
    return route.fulfill({ status: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, body: `<!doctype html><meta charset="utf-8"><script>location.replace(${JSON.stringify(cel)});</script>` });
  }
  // 3) kimeno meresi keres (vagy bármi, ami nincs az engedelyezett listan): naplozzuk, es NEM engedjuk ki
  const plat = platformOf(url) || (engedett(url, req.method()) ? null : 'ismeretlen-tiltott');
  if (plat) {
    felvesz(req, plat);
    const cors = { 'access-control-allow-origin': req.headers().origin || '*', 'access-control-allow-credentials': 'true', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (req.resourceType() === 'image') return route.fulfill({ status: 200, headers: { 'content-type': 'image/gif', ...cors }, body: GIF });
    return route.fulfill({ status: 200, headers: { 'content-type': 'application/json', ...cors }, body: '{}' });
  }
  if (!/(^|\.)(mosaicheadspa\.hu|salonic\.hu)$/.test(u.hostname)) harmadik.set(u.hostname, (harmadik.get(u.hostname) || 0) + 1);
  return route.continue();
});

const page = await context.newPage();
page.on('framenavigated', (f) => idovonal.push({ t: mp(), esemeny: 'navigacio', fo: f === page.mainFrame(), url: f.url().slice(0, 200) }));
page.on('pageerror', (e) => idovonal.push({ t: mp(), esemeny: 'oldalhiba', uzenet: String(e.message).slice(0, 200) }));

async function elsoLathato(loc, ms = 20000) { await loc.first().waitFor({ state: 'visible', timeout: ms }); return loc.first(); }

// "hirdetes -> landing": a reprezentativ landing (ahol a Google-cimke, a Meta-pixel es a TikTok-pixel is fut) a klikk-azonositokkal; ha a foglalo-gomb egy masik oldalon van
// (pl. az /idpontfoglalas kozpont), arra ugyanabban a lapban tovabblep (azonositok nelkul, referrerrel).
async function landingLepes() {
  const L = sc.landing, elo = L.elo || L.ut, sQ = CLICK ? CLICK_QS : '';
  idovonal.push({ t: mp(), esemeny: 'indulas: landing (hirdetes-kattintas utanzata)', url: BASE + elo + (sQ ? '?' + sQ : ''), mod: MOD, szenario: SZ, overlay: !!OVERLAY });
  await page.goto(BASE + elo + (sQ ? '?' + sQ : ''), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);
  if (L.ut !== elo) { idovonal.push({ t: mp(), esemeny: 'tovabblepes a foglalasi oldalra', url: BASE + L.ut }); await page.goto(BASE + L.ut, { waitUntil: 'domcontentloaded', referer: BASE + elo }); await page.waitForTimeout(3000); }
}

try {
  const sQ = CLICK ? CLICK_QS : '';
  if (MOD === 'nativ') {
    // ALAPVONAL: a mostani, Salonic-saját útvonal: a koszonooldal kozvetlenul (motor nelkul), Salonic-referrerrel; --landing 1: elotte a landing a klikk-azonositokkal
    if (LANDING && sc.landing) await landingLepes();
    const start = '1793377800', sid = sc.sim.serviceId || 476485;
    const cel = koszonoUrl(sc.salonic, start, sid);
    idovonal.push({ t: mp(), esemeny: 'natív koszonooldal (Salonic-referrerrel)', cel });
    await page.goto(cel, { referer: `https://${sc.salonic}/guestData/?placeId=${sc.sim.placeId}&serviceId=${sid}&employeeId=-1&startDate=${start}`, waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load').catch(() => {});
    await page.waitForTimeout(15000);
  } else {
  let startUrl;
  if (LANDING && sc.landing) {
    // "hirdetes -> landing -> motor": a landing a klikk-azonositokkal, majd a rajta levo gombbal a motorra (ugyanabban a lapban)
    await landingLepes();
    const a = page.locator(sc.landing.link).first();
    const href = await a.getAttribute('href');
    idovonal.push({ t: mp(), esemeny: 'a landing gombja a motorra mutat', href });
    await a.evaluate((e) => e.removeAttribute('target'));
    await a.click();
    await page.waitForURL(/\/foglalo-motor/, { timeout: 30000 });
  } else {
    startUrl = BASE + sc.start + (CLICK ? '&' + CLICK_QS : '');
    idovonal.push({ t: mp(), esemeny: 'indulas', url: startUrl, mod: MOD, szenario: SZ, overlay: !!OVERLAY });
    await page.goto(startUrl, { waitUntil: 'domcontentloaded' });
  }
  await page.locator('main section').first().waitFor({ timeout: 30000 });
  if (LANDING && sc.landing && sc.landing.engedMotor) { // pl. fodraszat: HA1 -> "Ingyenes konzultáció"
    await page.waitForTimeout(1500);
    await (await elsoLathato(page.locator('main button', { hasText: sc.landing.engedMotor }))).click();
  }
  // lezer: terulet -> (kezeles)
  if (sc.terulet) {
    // a belepo-kerdes (LA1), ha az intent-belepes nincs meg az eles motorban: "Mar tudom, mit szeretnek"
    await page.waitForTimeout(1500);
    const mar = page.locator('main button', { hasText: 'Már tudom' });
    if (await mar.count()) { idovonal.push({ t: mp(), esemeny: 'LA1: "Már tudom" (az eles motor meg nem ismeri az intent-belepest)' }); await mar.first().click(); }
    await (await elsoLathato(page.locator('main button', { hasText: sc.terulet }))).click();
    await page.waitForTimeout(1500);
    if (await page.locator('main button', { hasText: /Tovább az adatokhoz|További időpontok/ }).count() === 0) {
      const b = await elsoLathato(page.locator('.be-list button')); idovonal.push({ t: mp(), esemeny: 'kezeles', szoveg: (await b.textContent()).replace(/\s+/g, ' ').trim().slice(0, 120) }); await b.click();
    }
  }
  await (await elsoLathato(page.locator('main button', { hasText: 'További időpontok' }))).click();
  await elsoLathato(page.locator('.be-strip[aria-label="Nap"] .be-chip'));
  const napok = page.locator('.be-strip[aria-label="Nap"] .be-chip'); await napok.nth((await napok.count()) - 1).click();
  await page.waitForTimeout(800);
  const idok = page.locator('.be-time'); const db = await idok.count();
  const idoSzoveg = (await idok.nth(db - 1).textContent()).trim(); await idok.nth(db - 1).click();
  idovonal.push({ t: mp(), esemeny: 'idopont valasztva', ido: idoSzoveg });
  await (await elsoLathato(page.locator('main button', { hasText: 'Tovább az adatokhoz' }))).click();
  await page.locator('iframe').first().waitFor({ state: 'attached', timeout: 30000 });
  idovonal.push({ t: mp(), esemeny: 'Salonic-adatlap (iframe) betoltve' });

  if (MOD === 'valodi') {
    await page.waitForTimeout(4000);
    const fr = page.frames().find((f) => /salonic\.hu\/guestData/.test(f.url()));
    if (!fr) throw new Error('nem talalom a Salonic-keretet: ' + page.frames().map((f) => f.url()).join(' | '));
    const mezok = await fr.evaluate(() => [...document.querySelectorAll('input,textarea,select,button')].map((e) => ({ tag: e.tagName, type: e.type, name: e.name, id: e.id, ph: e.placeholder, txt: (e.textContent || '').trim().slice(0, 30), req: e.required, chk: e.checked })));
    idovonal.push({ t: mp(), esemeny: 'Salonic-urlap mezok', mezok });
    if (MEGALL) { idovonal.push({ t: mp(), esemeny: 'megallas (--megall): az urlapot nem toltom ki' }); }
    else {
      const tolt = async (sel, ertek) => { const l = fr.locator(sel).first(); await l.click(); await l.pressSequentially(ertek, { delay: 45 }); }; // valodi billentyuleutesek: a telefonmezo (intl-tel-input) rejtett mezoi igy frissulnek
      await tolt('#GuestDataForm_guestPhoneTemp', '709420090');
      await tolt('#GuestDataForm_guestLastName', 'TESZT –');
      await tolt('#GuestDataForm_guestFirstName', 'Claude');
      await tolt('#GuestDataForm_guestEmail', 'deakfi@grantis.hu');
      await fr.locator('#GuestDataForm_acceptTerms').check(); // csak a feltetel (hirlevel NEM)
      // reCAPTCHA-kihivas eseten megallunk (CAPTCHA-t nem oldunk meg)
      if (await page.locator('iframe[src*="recaptcha"][src*="bframe"]').count()) throw new Error('RECAPTCHA-KIHIVAS: megallok');
      idovonal.push({ t: mp(), esemeny: 'urlap kitoltve, kuldes', ido: new Date().toISOString() });
      await fr.locator('#button-submit-booking').click();
      await page.waitForTimeout(6000);
      const hibak = await fr.evaluate(() => [...document.querySelectorAll('.has-error .help-block, .errorMessage, .alert-danger, .field-error, [class*=error]')].map((e) => (e.textContent || '').trim()).filter(Boolean).slice(0, 8)).catch(() => []);
      const rejtett = await fr.evaluate(() => Object.fromEntries(['guestPhone', 'guestPhoneFull', 'reCaptcha'].map((k) => [k, (document.querySelector('[name=\"GuestDataForm[' + k + ']\"]') || {}).value || ''].map((x, i) => (i ? String(x).slice(0, 40) : x))))).catch(() => ({}));
      idovonal.push({ t: mp(), esemeny: 'kuldes utani allapot', keretUrl: fr.url().slice(0, 140), hibak, rejtett });
    }
  }
  if (!(MOD === 'valodi' && MEGALL)) {
    await page.waitForURL((u) => /bookingUrl=/.test(u.toString()) && !u.toString().includes('/foglalo-motor'), { timeout: 90000 });
    idovonal.push({ t: mp(), esemeny: 'koszonooldal a fo ablakban', url: page.url().slice(0, 1800) });
    await page.waitForLoadState('load').catch(() => {});
    await page.waitForTimeout(15000); // az osszes kesobbi meresi keres begyujtese
  }
  } // else (motor-utvonal) vege
} catch (e) {
  idovonal.push({ t: mp(), esemeny: 'HIBA', uzenet: String(e.message || e).slice(0, 400) });
}

const sutik = (await context.cookies()).filter((c) => /^(_gcl|_fbc|_fbp|_ga|FPLC|FPID|FPGSID|FPAU|ttclid|_ttp|_tt_|consent)/i.test(c.name)).map((c) => ({ nev: c.name, ertek: String(c.value).slice(0, 90), domain: c.domain }));
const vegeUrl = page.url();
fs.writeFileSync(OUT, JSON.stringify({ szenario: SZ, mod: MOD, overlay: !!OVERLAY, landing: LANDING, clickids: CLICK, vegeUrl, idovonal, sutik, harmadikFelHostok: Object.fromEntries(harmadik), naplo }, null, 1));
console.log(`kesz: ${OUT} | meresi keresek: ${naplo.length} | vege: ${vegeUrl.slice(0, 120)}`);
await browser.close();



