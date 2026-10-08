// Az ajandekkartya-motor REGI konverzios kerete (lathatatlan, azonos eredetu iframe) + a regi urlap leadje: viselkedes-proba, kimeno meres TILTVA.
//
//   node tools/meres-proba/ajandek-keret-proba.mjs [--overlay dist] [--bazis https://...] [--landing /headspa-ajandekkartya] [--meres-proba 1]
//
// 1) A sikeres (szimulalt, szerver altal "fizetett") vasarlas utan a VEVO AZ UJ SIKER-NEZETBEN MARAD: a cimsor nem valt /success-ajandekkartya-stripe-ra,
//    a [data-ah-regi-konverzio] keret megvan, a keret dokumentuma nincs elrejtve (visibility nem hidden), a kereten belul a suti.js nem hajtja vegre az atiranyitast.
//    (--meres-proba 1: a ?meres_proba=1 parameter - elonezeten / teszt-modban a keret csak ezzel indul; az eles domainen nem kell.)
// 2) A klon.js a wixLead-et kiajanlja (window.mhWixLead): az utalasos igenyles ezt hivja (a regi "Ajandekkartya " urlap fuggvenye).
// A kartyas fizetes maga NEM tortenik meg (a Stripe.js tiltott, kartyaadat nincs); a szerver "fizetve" valaszat a proba adja a PaymentIntentre.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { UA, platformOf, engedett, dnsArg, ures, hozzajarulasScript } from './tilt.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const OVERLAY = arg('overlay', ''), BAZIS = arg('bazis', 'https://www.mosaicheadspa.hu'), LANDING = arg('landing', '/headspa-ajandekkartya'), MERES_PROBA = arg('meres-proba', '0') === '1';
const PI = 'pi_TESZT_KERET_' + Date.now(), ERTEK = 26900;
const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let fajlUtvonal = null;
if (OVERLAY) ({ fajlUtvonal } = await import('../serve-dist.mjs'));
const TIPUS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
const eredmeny = [];
const ok = (cimke, rendben, reszlet = '') => { eredmeny.push({ cimke, rendben }); console.log(`${rendben ? 'OK  ' : 'HIBA'} ${cimke}${reszlet ? ' | ' + reszlet : ''}`); };

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--disable-blink-features=AutomationControlled', dnsArg()] });
const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 900 }, locale: 'hu-HU', timezoneId: 'Europe/Budapest', serviceWorkers: 'block' });
await ctx.addInitScript(hozzajarulasScript);
const mer = []; // a kimeno meresi kereseket csak naplozzuk (tilt.mjs: tiltva)
await ctx.route('**/*', async (route) => {
  const req = route.request(), url = req.url(); let u; try { u = new URL(url); } catch (e) { return route.continue(); }
  if (/\/api\/ajandek\/rendeles/.test(u.pathname) && u.searchParams.get('pi') === PI) {
    await new Promise((ok) => setTimeout(ok, 1500)); // a valodi szerver a Stripe-tol kerdezi vissza a fizetest: nem azonnali (a beallitas-lekeres elobb megerkezik)
    return route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify({
      allapot: 'fizetve', visszavonva: false, rendeles_id: 'TESZT-KERET', atvetel: 'otthon', termek: 'egyeni', termek_nev: 'Egyéni Head Spa ajándékkártya (TESZT)', kartya_cim: 'Egyéni Head Spa',
      osszeg: ERTEK, penznem: 'HUF', email: 'keret-proba@example.com', fizetesi_mod: 'card', fizetve_ekkor: new Date().toISOString(), attr: {}, kartya: { allapot: 'keszul', ervenyes_ig: '2027-04-04' }, szemelyre: null }) });
  }
  if (OVERLAY && u.origin === BAZIS && req.method() === 'GET') {
    const e = fajlUtvonal(decodeURIComponent(u.pathname), req.headers()['user-agent'] || UA);
    if (e.atiranyit) return route.fulfill({ status: 301, headers: { location: encodeURI(e.atiranyit) + u.search } });
    if (fs.existsSync(e.fajl) && fs.statSync(e.fajl).isFile()) {
      let body = fs.readFileSync(e.fajl);
      if (body.length < 80 && /^[\w./-]+\.html$/.test(body.toString('utf8').trim())) { const cel = path.join(path.dirname(e.fajl), body.toString('utf8').trim()); if (fs.existsSync(cel)) body = fs.readFileSync(cel); }
      return route.fulfill({ status: 200, headers: { 'content-type': TIPUS[path.extname(e.fajl)] || 'application/octet-stream', 'cache-control': 'no-store' }, body });
    }
  }
  const plat = platformOf(url) || (engedett(url, req.method()) || u.origin === BAZIS ? null : 'tiltott');
  if (plat) { mer.push(plat); return route.fulfill(ures(req)); }
  return route.continue();
});
const page = await ctx.newPage();
const DEBUG = arg('debug', '0') === '1'; const hivasok = [];
if (DEBUG) page.on('request', (r) => { if (/\/api\/ajandek\//.test(r.url())) hivasok.push(Date.now() % 100000 + ' ' + r.method() + ' ' + new URL(r.url()).pathname + new URL(r.url()).search.slice(0, 40)); });
const hibak = []; page.on('pageerror', (e) => hibak.push(String(e.message).slice(0, 160)));
const qs = MERES_PROBA ? '&meres_proba=1' : '';

// 2) a wixLead kiajanlva
await page.goto(`${BAZIS}${LANDING}?x=1${qs}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(5000);
ok('a klon.js kiajanlja a wixLead-et (window.mhWixLead) az ajandekkartya-oldalon', await page.evaluate(() => typeof window.mhWixLead === 'function'));

// 1) szimulalt sikeres vasarlas: a motor sajat visszateresi utvonala (a Stripe visszateres), a szerver "fizetve" valasza
await page.evaluate(({ pi }) => { const t = JSON.parse(sessionStorage.getItem('ah_v1') || '{}'); t.termek = 'egyeni'; t.pi = pi; t.cs = pi + '_secret_TESZT'; t.fizetes_inditva = pi; sessionStorage.setItem('ah_v1', JSON.stringify(t)); }, { pi: PI });
const variant = await page.evaluate(() => (JSON.parse(sessionStorage.getItem('ah_v1') || '{}')).variant_id || 'GENERAL');
await page.goto(`${BAZIS}${LANDING}?variant=${encodeURIComponent(variant)}&payment_intent=${PI}&payment_intent_client_secret=${PI}_secret_TESZT&redirect_status=succeeded${qs}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('[data-ah-regi-konverzio]', { state: 'attached', timeout: 25000 }).catch(() => {});
await page.waitForTimeout(6000);
const fo = new URL(page.url());
if (DEBUG) { console.log('DEBUG api-hivasok:', hivasok.join(' | ')); console.log('DEBUG allapot:', JSON.stringify(await page.evaluate(() => (window.__ajandek && window.__ajandek.allapot ? window.__ajandek.allapot() : null)).catch(() => null))); console.log('DEBUG url:', page.url()); }
ok('a vevo az uj oldalon marad: a cimsor nem valt /success-ajandekkartya-stripe-ra', fo.pathname === LANDING && !/success-ajandekkartya/.test(page.url()), fo.pathname);
ok('a [data-ah-regi-konverzio] keret letezik', (await page.locator('[data-ah-regi-konverzio]').count()) === 1);
const keret = page.frames().find((f) => f.parentFrame() && /success-ajandekkartya-stripe/.test(f.url()));
ok('a keret a regi koszonooldalt tolti be (ertek + session_id)', !!keret && /ertek=26900/.test(keret.url()) && keret.url().includes('session_id=' + PI), keret ? keret.url().slice(0, 110) : 'nincs keret');
const lathatosag = keret ? await keret.evaluate(() => getComputedStyle(document.documentElement).visibility).catch(() => 'nem olvashato') : null;
ok('a keret dokumentuma nincs elrejtve (visibility nem hidden)', !!keret && lathatosag !== 'hidden', 'visibility=' + lathatosag);
const sikerSzoveg = await page.locator('#ah-siker-meta').innerText().catch(() => '');
ok('a fo ablakban az uj SIKER-nezet latszik (rendeles-azonosito + osszeg), a vevo nem kerult at a regi koszonooldalra', /TESZT-KERET/.test(sikerSzoveg) && fo.pathname === LANDING, sikerSzoveg.replace(/\s+/g, ' ').slice(0, 90));
ok('nincs JS-hiba', hibak.length === 0, hibak.join(' | '));
await browser.close();
const rossz = eredmeny.filter((x) => !x.rendben);
console.log(`\n${eredmeny.length} ellenorzes, ${rossz.length} hiba; kimeno meres (tiltva): ${mer.length} keres`);
process.exit(rossz.length ? 1 : 0);
