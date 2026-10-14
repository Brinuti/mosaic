// attribucio.js HOZZAJARULAS-FUGGO TAROLAS - bongeszo-ellenorzes (GPT-dontes, 2026-10-10, QA-5 elotti higienia).
//   consent=false -> 0 attribucios localStorage-iras ('mh_attr'); consent=true -> az iras megtortenik; a memoriabeli adat a szervernek megy (SZ-38 valtozatlan); a foglalasi / ajandekkartya oldal nem torik.
//   2026-10-14 (meresi oldal DECISION #170): a suti-sav nem jelenik meg, az uj latogato alapertekei: statisztika + marketing GRANTED -> dontes nelkul az iras megtortenik;
//   a tiltas (consent=false) a korabban TAROLT elutasitassal (mh_cc) vagy a beallitasokban (lablec-link / mhSuti.beallitasok()) tortenik.
// Futtatas:  node tools/meres-proba/attribucio-hozzajarulas-bongeszo.mjs [--dist dist] [--ki docs/booking-engine/meres-naplo/attribucio-hozzajarulas-<nap>.json]
//   A dist/-et helyben szolgalja ki; minden kulso keres tiltva; az /api/* hamisitva (VALODI vegpontot nem er el). A valodi suti.js-t hasznalja (beallitasok: Mindet elfogadom / Mindet elutasitom / Kivalasztottak mentese).
// Kornyezet: PLAYWRIGHT_UTVONAL (a playwright-core szulomappaja), CHROME_UTVONAL.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const arg = (nev, alap) => { const i = process.argv.indexOf('--' + nev); return i >= 0 ? process.argv[i + 1] : alap; };
const GYOKER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST = path.resolve(GYOKER, arg('dist', 'dist'));
const KI = arg('ki', null);
const PW = process.env.PLAYWRIGHT_UTVONAL || '/opt/node22/lib/node_modules/playwright/node_modules';
const CHROME = process.env.CHROME_UTVONAL || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const { chromium } = createRequire(path.join(PW, 'x.js'))('playwright-core');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
function szerver() {
  return new Promise((ok) => {
    const s = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://x'); const p = decodeURIComponent(u.pathname);
      for (const j of [p, p + '.html', '/_a' + p + '.html', '/_a' + (p === '/' ? '/index' : p) + '.html', path.posix.join(p, 'index.html')]) {
        const f = path.join(DIST, j);
        if (f.startsWith(DIST) && fs.existsSync(f) && fs.statSync(f).isFile()) { res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); return fs.createReadStream(f).pipe(res); }
      }
      res.writeHead(404, { 'content-type': 'text/plain' }); res.end('nincs');
    });
    s.listen(0, '127.0.0.1', () => ok({ s, port: s.address().port }));
  });
}

const GCLID = 'Cj0KCQjw_TESZT_gclid_0123456789';
const BID = 'mb_hozzajarulas0001xxxxxx';
const BOOKING_URL = `https://mosaic-hair.salonic.hu/guestData/?anyone=true&employeeId=25095&placeId=10823&serviceId=232804&startDate=1792512000&back=${BID}`;
const KOSZONO = `/fodrasz-ok?gclid=${GCLID}&fbclid=IwAR_fbclid_TESZT_01&ttclid=E.C.P.ttclid_TESZT_01&utm_source=google&utm_medium=cpc&utm_campaign=elso&first_booking=true&service=${encodeURIComponent('Fodrász konzultáció')}&price=0&location=Mosaic+Hair&employee=Noel&g=g:3385039&bookingUrl=${encodeURIComponent(BOOKING_URL)}`;

const eredmenyek = [];
const ell = (nev, ok, adat) => { eredmenyek.push({ nev, ok: !!ok, adat: adat === undefined ? null : adat }); };

async function ujLap(bongeszo, bazis, { kontext = null } = {}) {
  const ctx = kontext || await bongeszo.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const lap = await ctx.newPage();
  const hibak = [], erkezes = [];
  lap.on('pageerror', (e) => hibak.push(String(e.message || e).slice(0, 160)));
  await lap.addInitScript(() => { // a localStorage-irasok naplozasa (kulcsonkent): a 'mh_attr' irasait szamoljuk
    window.__lsIras = []; const eredeti = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { try { if (this === window.localStorage) window.__lsIras.push(k); } catch (e) { /* nem baj */ } return eredeti.call(this, k, v); };
  });
  await lap.route('**/*', async (r) => {
    const u = new URL(r.request().url());
    if (u.hostname !== '127.0.0.1') return r.abort('blockedbyclient');
    if (u.pathname === '/api/meres-erkezes' || u.pathname === '/api/foglalas-kulcs') {
      if (u.pathname === '/api/meres-erkezes') { try { erkezes.push(JSON.parse(r.request().postData() || '{}')); } catch (e) { /* nem baj */ } }
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, irva: true }) });
    }
    return r.continue();
  });
  return { ctx, lap, hibak, erkezes };
}
const allapot = (lap) => lap.evaluate(() => ({ mhAttr: localStorage.getItem('mh_attr'), mhCc: localStorage.getItem('mh_cc'), attrIras: window.__lsIras.filter((k) => k === 'mh_attr').length }));
const var_ = (lap) => lap.waitForFunction(() => window.mhAttribucioEredmeny && typeof window.mhAttribucioEredmeny.status === 'number', null, { timeout: 8000 }).catch(() => {});

const { s, port } = await szerver();
const bazis = `http://127.0.0.1:${port}`;
const bongeszo = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
try {
  // A) UJ latogato, tarolt dontes NELKUL (DECISION #170: alapertek = granted): a sav nem latszik, az iras az elso betoltesnel megtortenik, a szerver megkapja az adatot, nincs JS-hiba
  { const { ctx, lap, hibak, erkezes } = await ujLap(bongeszo, bazis);
    await lap.goto(bazis + KOSZONO, { waitUntil: 'load' }); await var_(lap); await lap.waitForTimeout(300);
    const a = await allapot(lap);
    const t0 = a.mhAttr ? JSON.parse(a.mhAttr) : null;
    ell('A) dontes nelkul (alapertek granted): az attribucios adat kiirodik (gclid, fbclid, ttclid, UTM)', !!t0 && t0.google.gclid.ertek === GCLID && !!t0.meta.fbclid && !!t0.tiktok.ttclid.ertek && t0.utm_elso.campaign === 'elso' && a.attrIras >= 1, { attrIras: a.attrIras, kulcsok: t0 && Object.keys(t0) });
    ell('A) dontes nelkul: a sav NEM latszik, a tarolt dontes (mh_cc) nincs', (await lap.locator('#mh-cc').isVisible()) === false && a.mhCc === null);
    ell('A) dontes nelkul: a szerver megkapja a memoriabeli adatot (SZ-38 valtozatlan)', erkezes.length === 1 && erkezes[0].attr && erkezes[0].attr.google && erkezes[0].attr.google.gclid.ertek === GCLID && !!erkezes[0].attr.meta && !!erkezes[0].attr.tiktok && erkezes[0].attr.utm_elso.campaign === 'elso', erkezes[0] && { hozz: erkezes[0].hozz, kulcsok: Object.keys(erkezes[0].attr || {}) });
    ell('A) nincs kezeletlen JS-hiba', hibak.length === 0, hibak);
    // A2) a beallitasokban MINDET ELFOGADOM -> a tarolt dontes (mh_cc) megszuletik, az adat megmarad
    await lap.evaluate(() => window.mhSuti.beallitasok()); await lap.waitForTimeout(200);
    await lap.click('#mh-cc-settings [data-mh="accept"]'); await lap.waitForTimeout(300);
    const b = await allapot(lap); const t = b.mhAttr ? JSON.parse(b.mhAttr) : null;
    ell('A2) Mindet elfogadom utan: a dontes (mh_cc) tarolt es a pillanatkep megmarad (gclid, fbclid, ttclid, UTM)', !!t && t.google.gclid.ertek === GCLID && !!t.meta.fbclid && !!t.tiktok.ttclid.ertek && t.utm_elso.campaign === 'elso' && !!b.mhCc && JSON.parse(b.mhCc).adv === true, { attrIras: b.attrIras, kulcsok: t && Object.keys(t) });
    // A3) ujratoltes (mar engedelyezve): az adat megmarad, tobbet nem kell kerni
    await lap.goto(bazis + '/fodrasz-ok', { waitUntil: 'load' }); await lap.waitForTimeout(300);
    const c = await allapot(lap);
    ell('A3) engedellyel a tarolt adat megmarad a kovetkezo oldalon', !!c.mhAttr && JSON.parse(c.mhAttr).google.gclid.ertek === GCLID, null);
    // A4) VISSZAVONAS: beallitasok -> marketing ki -> mentes: a tarolt adat torlodik
    await lap.evaluate(() => window.mhSuti.beallitasok()); await lap.waitForTimeout(200); // a beallitasok megnyitasa (ugyanaz, mint a lablec-link)
    await lap.evaluate(() => { document.getElementById('mh-cc-adv').checked = false; });
    await lap.click('#mh-cc [data-mh="save"]'); await lap.waitForTimeout(300);
    const d = await allapot(lap);
    ell('A4) visszavonas (marketing ki) utan a tarolt adat torlodik', d.mhAttr === null, null);
    await ctx.close(); }

  // B) Mindet elutasitom (a beallitasokban): a tarolt adat torlodik, tobbet nem ir; a szervernek az URL-bol szarmazo (memoriabeli) adat megy
  { const { ctx, lap, hibak, erkezes } = await ujLap(bongeszo, bazis);
    await lap.goto(bazis + KOSZONO, { waitUntil: 'load' }); await var_(lap);
    await lap.evaluate(() => window.mhSuti.beallitasok()); await lap.waitForTimeout(200);
    await lap.click('#mh-cc-settings [data-mh="reject"]'); await lap.waitForTimeout(300);
    const a = await allapot(lap);
    ell('B) Mindet elutasitom: a tarolt attribucios adat torlodik, a dontes (mh_cc) elutasitott', a.mhAttr === null && !!a.mhCc && JSON.parse(a.mhCc).adv === false, a);
    ell('B) elutasitas mellett is megy a szervernek az (URL-bol szarmazo) adat', erkezes.length === 1 && erkezes[0].attr.google.gclid.ertek === GCLID, erkezes[0] && erkezes[0].hozz);
    ell('B) nincs kezeletlen JS-hiba', hibak.length === 0, hibak);
    await ctx.close(); }

  // B2) a korabban TAROLT elutasitas (mh_cc) az alapertek folott all: 0 attribucios iras (az elozo, "dontes nelkul" 0-iras garancia ez az eset)
  { const ctx = await bongeszo.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__be')) { localStorage.setItem('mh_cc', JSON.stringify({ v: 1, t: Date.now(), fun: false, ana: false, adv: false })); sessionStorage.setItem('__be', '1'); } } catch (e) { /* nem baj */ } });
    const { lap, hibak, erkezes } = await ujLap(bongeszo, bazis, { kontext: ctx });
    await lap.goto(bazis + KOSZONO, { waitUntil: 'load' }); await var_(lap); await lap.waitForTimeout(300);
    const a = await allapot(lap);
    ell('B2) korabbi elutasitas: 0 attribucios localStorage-iras, nincs mh_attr, a sav sem latszik', a.attrIras === 0 && a.mhAttr === null && (await lap.locator('#mh-cc').isVisible()) === false, a);
    ell('B2) korabbi elutasitas mellett is megy a szervernek az (URL-bol szarmazo) adat; hozz.adv = false', erkezes.length === 1 && erkezes[0].attr.google.gclid.ertek === GCLID && erkezes[0].hozz && erkezes[0].hozz.adv === false, erkezes[0] && erkezes[0].hozz);
    ell('B2) nincs kezeletlen JS-hiba', hibak.length === 0, hibak);
    await ctx.close(); }

  // C) a dontes mar korabban megszuletett (adv: true): az iras az elso betoltesnel megtortenik
  { const ctx = await bongeszo.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await ctx.addInitScript(() => { try { if (!localStorage.getItem('mh_cc')) localStorage.setItem('mh_cc', JSON.stringify({ v: 1, t: Date.now(), fun: true, ana: true, adv: true })); } catch (e) { /* nem baj */ } });
    const { lap, hibak } = await ujLap(bongeszo, bazis, { kontext: ctx });
    await lap.goto(bazis + KOSZONO, { waitUntil: 'load' }); await var_(lap); await lap.waitForTimeout(300);
    const a = await allapot(lap);
    ell('C) engedellyel (mh_cc.adv=true) az iras megtortenik', !!a.mhAttr && JSON.parse(a.mhAttr).google.gclid.ertek === GCLID && a.attrIras >= 1, { attrIras: a.attrIras });
    ell('C) nincs kezeletlen JS-hiba', hibak.length === 0, hibak);
    await ctx.close(); }

  // D) a regebbi verzio altal engedely elott felirt adat ELUTASITOTT hozzajarulasnal torlodik (nem hasznalodik fel); DECISION #170 ota "engedely nelkul" = tarolt elutasitas
  { const ctx = await bongeszo.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__beallitva')) { localStorage.setItem('mh_cc', JSON.stringify({ v: 1, t: Date.now(), fun: false, ana: false, adv: false })); localStorage.setItem('mh_attr', JSON.stringify({ v: 1, google: { gclid: { ertek: 'Cj0KCQjw_REGI_gclid_0123456789', ts: Math.floor(Date.now() / 1000) - 100 } } })); sessionStorage.setItem('__beallitva', '1'); } } catch (e) { /* nem baj */ } });
    const { lap, erkezes } = await ujLap(bongeszo, bazis, { kontext: ctx });
    await lap.goto(bazis + '/fodrasz-ok?first_booking=true&bookingUrl=' + encodeURIComponent(BOOKING_URL), { waitUntil: 'load' }); await var_(lap); await lap.waitForTimeout(300);
    const a = await lap.evaluate(() => ({ mhAttr: localStorage.getItem('mh_attr') }));
    ell('D) elutasitott hozzajarulasnal a regebben tarolt adat torlodik', a.mhAttr === null, a);
    ell('D) ...es nem kerul a szerverhez', erkezes.length === 1 && !(erkezes[0].attr && erkezes[0].attr.google), erkezes[0] && Object.keys(erkezes[0].attr || {}));
    await ctx.close(); }

  // E) a foglalasi / ajandekkartya oldalak betoltenek, nincs JS-hiba, a sav mukodik
  for (const ut of ['/headspa-ajandekkartya', '/fodrasz-foglalas', '/']) {
    const { ctx, lap, hibak } = await ujLap(bongeszo, bazis);
    const r = await lap.goto(bazis + ut + '?gclid=' + GCLID, { waitUntil: 'load' }).catch(() => null); await lap.waitForTimeout(400);
    if (r && r.status() === 404) { await ctx.close(); continue; }
    const a = await allapot(lap);
    ell(`E) ${ut}: betolt, 0 JS-hiba, a sav nem latszik, dontes nelkul (alapertek granted) az URL-beli kattintas-azonosito kiirodik`, !!r && r.status() === 200 && hibak.length === 0 && (await lap.locator('#mh-cc').isVisible()) === false && a.attrIras >= 1, { status: r && r.status(), hibak, attrIras: a.attrIras });
    await ctx.close();
  }
} finally { await bongeszo.close(); s.close(); }

const naplo = { futtatva: new Date().toISOString(), leiras: 'attribucio.js hozzajarulas-fuggo tarolas, valodi Chromium + valodi suti.js, helyi dist, hamisitott /api/*', eredmeny: eredmenyek.every((x) => x.ok) ? 'PASS' : 'FAIL', ellenorzesek: eredmenyek };
if (KI) { fs.mkdirSync(path.dirname(path.resolve(GYOKER, KI)), { recursive: true }); fs.writeFileSync(path.resolve(GYOKER, KI), JSON.stringify(naplo, null, 1) + '\n'); }
for (const e of eredmenyek) console.log(`${e.ok ? 'OK  ' : 'HIBA'} ${e.nev}${e.ok ? '' : '  ' + JSON.stringify(e.adat)}`);
console.log(naplo.eredmeny);
process.exit(naplo.eredmeny === 'PASS' ? 0 : 1);
