// A foglalo lepes-merese (DECISION-LOG #88) bongeszoben, TILTOTT kimeno merressel: minden lepes pontosan egyszer jon-e, a bezarasnal jo-e a step.
//
//   node tools/meres-proba/lepes-proba.mjs [--overlay dist] [--bazis https://www.mosaicheadspa.hu] [--mobil 1] [--oldal /paros-headspa-budapest] [--ga4 1]
// --gtm-kornyezet <id>:<auth>: a GTM-et NEM az eles (publikalt) valtozatbol toltjuk, hanem egy GTM-kornyezetbol (pl. a beepitett "Latest" = a legutobb letrehozott verzio: 2:u4SS...),
//   igy a GA4-tag a PUBLIKALAS ELOTT kiprobalhato (a hitek elfogva, a Google-hoz sosem jutnak el). A kodok a GTM felulet Admin > Environments oldalan / az API-ban lathatok.
// --ga4 1: a GTM-trigger PUBLIKALASA UTAN (vagy --gtm-kornyezettel az elott), az eles oldalon (nincs --overlay): a GA4-hitek (a Stape-en / Google-on at; a proba elfogja, a Google-hoz SOSEM jut el) minden lepesre megjelennek-e.
//
// Ket csatorna: (1) GA4 dataLayer (csak elfogadott statisztikai hozzajarulassal), (2) a nevtelen szamlalo (POST /api/foglalo-szamlalo; a proba elfogja es naplozza,
// a valodi vegpontra SOSEM megy). A Salonic naptar-API mockolt (nincs valodi foglalas, nincs terheles), a Salonic-atiranyitas szimulalt (?atadas=0: a motor maga mutatja a sikert).
// A kimeno merest (GA4, Meta, TikTok, Google Ads, Stape, Zapier) a tilt.mjs alapbol tiltja; a proba azt is ellenorzi, hogy a foglalo lepesei NEM inditottak meresi kerest.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { UA, UA_MOBIL, platformOf, engedett, dnsArg, ures, esemenyIras, esemenyUres } from './tilt.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const GA4 = arg('ga4', '0') === '1';
const GTM_KORNYEZET = (() => { const v = arg('gtm-kornyezet', ''); if (!v) return null; const [id, auth] = v.split(':'); return { id, auth }; })();
const OVERLAY = arg('overlay', ''), MOBIL = arg('mobil', '0') === '1', OLDAL = arg('oldal', '/paros-headspa-budapest'), BAZIS = arg('bazis', 'https://www.mosaicheadspa.hu');
const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let fajlUtvonal = null;
if (OVERLAY) ({ fajlUtvonal } = await import('../serve-dist.mjs'));
const TIPUS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
const ua = MOBIL ? UA_MOBIL : UA;
const SORREND = ['booking_open', 'booking_business', 'booking_service', 'booking_slots_loaded', 'booking_slot', 'booking_form_start', 'booking_submit', 'booking_success', 'booking_close'];
const UJ = new Set([...SORREND, 'booking_error']);

const eredmeny = [];
const ok = (cimke, rendben, reszlet = '') => { eredmeny.push({ cimke, rendben }); console.log(`${rendben ? 'OK  ' : 'HIBA'} ${cimke}${reszlet ? ' | ' + reszlet : ''}`); };

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--disable-blink-features=AutomationControlled', dnsArg()] });
const alap = Math.floor(Date.now() / 86400000) * 86400;
const idopont = (nap, ora = 10) => alap + nap * 86400 + ora * 3600;
const mockAlap = (idok) => (startDate, days) => {
  const blocks = {}; let i = 0;
  for (const ts of idok.filter((x) => x >= startDate && x < startDate + days * 86400)) { const nap = new Date(ts * 1000).toISOString().slice(0, 10); ((blocks[nap] ||= { 111: { employeeName: 'Teszt Szakember', slots: {} } })[111].slots)['s' + (i++)] = { timestamp: ts, formatted: '' }; }
  return { status: 'success', data: { blocks, placeName: 'Mosaic Headspa', placeAddress: '1023 Budapest, Bécsi út 4.' } };
};

// egy uj, tiszta bongeszo-kontextus: mockolt naptar, elfogott szamlalo, tiltott kimeno meres; hozzajarulas / robot-jelzes kapcsolhato
async function ujLap({ hozzajarul, idok = [idopont(1), idopont(2), idopont(3)], apiHiba = false, robot = false }) {
  // (a bongeszo az AutomationControlled jelzes nelkul indul, mint a tobbi proba: a navigator.webdriver ilyenkor false; a "robot" forgatokonyv kenyszeriti)
  const ctx = await browser.newContext({ userAgent: ua, viewport: MOBIL ? { width: 390, height: 844 } : { width: 1280, height: 900 }, locale: 'hu-HU', timezoneId: 'Europe/Budapest', serviceWorkers: 'block', isMobile: MOBIL, hasTouch: MOBIL });
  const naplo = { szamlalo: [], mer: [], kuldve: [] }; // szamlalo: az elfogott POST-ok; mer: a FO ablak kimeno meresi kerelmei
  await ctx.route('**/*', async (route) => {
    const req = route.request(), url = req.url(); let u; try { u = new URL(url); } catch (e) { return route.continue(); }
    if (/api\.salonic\.hu\/calendar\/getAvailableTimes/.test(url)) {
      if (apiHiba) return route.fulfill({ status: 500, headers: { 'access-control-allow-origin': '*' }, body: 'hiba' });
      return route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify(mockAlap(idok)(+u.searchParams.get('startDate'), +u.searchParams.get('days'))) });
    }
    if (/\/api\/foglalo-szamlalo$/.test(u.pathname)) { naplo.szamlalo.push({ metodus: req.method(), test: req.postData() || '', hdr: req.headers()['content-type'] || '' }); return route.fulfill({ status: 204 }); } // sosem a valodi vegpont
    if (/\/api\/foglalas-esemeny(\?|$)/.test(u.pathname + u.search)) return route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: req.method() === 'GET' ? '{"kor_ms":null}' : '{"irva":false,"ok":"proba"}' });
    if (OVERLAY && u.origin === BAZIS && req.method() === 'GET') {
      const e = fajlUtvonal(decodeURIComponent(u.pathname), req.headers()['user-agent'] || ua);
      if (e.atiranyit) return route.fulfill({ status: 301, headers: { location: encodeURI(e.atiranyit) + u.search } });
      if (fs.existsSync(e.fajl) && fs.statSync(e.fajl).isFile()) {
        let body = fs.readFileSync(e.fajl);
        if (body.length < 80 && /^[\w./-]+\.html$/.test(body.toString('utf8').trim())) { const cel = path.join(path.dirname(e.fajl), body.toString('utf8').trim()); if (fs.existsSync(cel)) body = fs.readFileSync(cel); }
        return route.fulfill({ status: 200, headers: { 'content-type': TIPUS[path.extname(e.fajl)] || 'application/octet-stream', 'cache-control': 'no-store' }, body });
      }
    }
    if (esemenyIras(url, req.method())) return route.fulfill(esemenyUres());
    if (GTM_KORNYEZET && /^https:\/\/www\.googletagmanager\.com\/gtm\.js\?/.test(url)) return route.continue({ url: url + '&gtm_auth=' + GTM_KORNYEZET.auth + '&gtm_preview=env-' + GTM_KORNYEZET.id + '&gtm_cookies_win=x' });
    const plat = platformOf(url) || (engedett(url, req.method()) || u.origin === BAZIS ? null : 'tiltott');
    if (plat) {
      if (req.frame() && req.frame().parentFrame() === null) {
        const q = Object.fromEntries(u.searchParams); let evek = [''];
        if (plat === 'meta') evek = [new URLSearchParams(req.postData() || '').get('ev') || q.ev || '']; else if (plat === 'tiktok') { try { evek = [JSON.parse(req.postData() || '{}').event || '']; } catch (e) { evek = ['']; } }
        else { // GA4 / Stape / Google Ads: az esemeny neve az URL-ben (en=) VAGY a torzsben (tobb esemeny egy keresben: soronkent egy)
          const nev = new Set(); if (q.en) nev.add(q.en);
          for (const sor of String(req.postData() || '').split(/\r?\n/)) { const m = /(?:^|&)en=([^&]+)/.exec(sor); if (m) nev.add(decodeURIComponent(m[1])); }
          evek = nev.size ? [...nev] : [''];
        }
        for (const ev of evek) naplo.mer.push({ plat, ev, ut: u.pathname.slice(0, 40), nyers: /^booking_/.test(ev) ? (u.search + '\n' + (req.postData() || '')).slice(0, 4000) : '' });
      }
      return route.fulfill(ures(req));
    }
    return route.continue();
  });
  const page = await ctx.newPage();
  const hibak = []; page.on('pageerror', (e) => hibak.push(String(e.message).slice(0, 160)));
  await page.addInitScript(([h, r]) => {
    if (r) { try { Object.defineProperty(navigator, 'webdriver', { get: () => true }); } catch (e) { /* nem baj */ } }
    if (!r) window.__MH_SZAMLALO_PROBA = true; // a proba elfogja a szamlalo-kerest, ezert a robot-szuro kikapcsolhato (a "robot" forgatokonyv ezt ellenorzi)
    if (h) { try { localStorage.setItem('mh_cc', JSON.stringify({ v: 1, t: Date.now(), fun: true, ana: true, adv: true })); } catch (e) { /* nem baj */ } }
    else { try { localStorage.setItem('mh_cc', JSON.stringify({ v: 1, t: Date.now(), fun: false, ana: false, adv: false })); } catch (e) { /* nem baj */ } }
  }, [hozzajarul, robot]);
  await page.goto(BAZIS + OLDAL + '?atadas=0', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openBooking === 'function' && !!window.mhSuti, null, { timeout: 15000 }); // a foglalo-inditó es a suti-kezelo (mhSuti) is betoltott
  await page.waitForTimeout(3500); // a lap sajat betoltesi merese (GTM, pixelek) lecsendesedik: ami ezutan jon, azt a foglalo lepesei okozhatjak
  naplo.alap = naplo.mer.length;
  return { ctx, page, naplo, hibak };
}
const reteg = (p) => p.locator('#mosaic-booking-layer');
const cim = async (p, ido = 20000) => { const c = reteg(p).locator('.be-title').first(); try { await c.waitFor({ timeout: ido }); return (await c.textContent()).trim(); } catch (e) { return null; } };
const dl = (p) => p.evaluate(() => (window.dataLayer || []).filter((e) => e && typeof e.event === 'string' && /^booking_/.test(e.event)).map((e) => ({ ...e })));
const szamlaloLepesek = (naplo) => naplo.szamlalo.map((s) => { try { return JSON.parse(s.test); } catch (e) { return { hibas: s.test }; } });
const nevek = (lista) => lista.map((e) => e.event);
// A foglalo lepesei utan (a nyitas elotti allapothoz kepest) erkezett kimeno meresi kerelmek: nem lehet koztuk konverzio / marketing-esemeny. Megengedett: a GA4 booking_* esemenyei (a GTM-trigger publikalasa utan,
// csak hozzajarulassal) es a lap sajat, idozitett jelzesei (TikTok monitor, GA4 user_engagement / scroll, page_view): ezek nem a foglalotol jonnek.
const LAP_JELZES = /^(|visit|page_view|user_engagement|scroll|session_start|first_visit|PageView|ViewContent|pixel|monitor|enrich_ipv6|gtm\.[a-z]+)$/i;
const lepesMeres = (naplo) => naplo.mer.slice(naplo.alap).filter((x) => !(LAP_JELZES.test(x.ev) || /monitor|enrich_ipv6|\/pixel/.test(x.ut)));
const csakGa4Booking = (lista) => lista.every((x) => /^booking_/.test(x.ev)); // (a GA4 a Stape-en at is mehet: plat = stape / ga4 / google-ads, az esemeny neve a lenyeg)
const uj = (lista) => lista.filter((e) => UJ.has(e.event));
async function zar(p) { await reteg(p).locator('#be-close').click(); await p.waitForFunction(() => !document.getElementById('mosaic-booking-layer'), null, { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(400); }

// a Salonic atiranyitasanak szimulacioja (mint a reteg-proba): sikeres foglalas a motor vart valasztasaval
async function atiranyit(p) {
  const keret = await reteg(p).locator('iframe.be-iframe').getAttribute('src');
  const ar = (((await reteg(p).locator('.be-mini').textContent().catch(() => '')) || '').match(/(\d[\d\s\u00a0]*)\s*Ft/) || [])[1];
  const href = BAZIS + '/success-foglalas?first_booking=false&price=' + (ar ? ar.replace(/\D/g, '') : '1') + '&employee=Teszt+Szakember&location=Budapest&service=Proba&g=g:2461999&bookingUrl=' + encodeURIComponent(keret);
  await p.evaluate((h) => window.mhKeretbenOldal(h), href);
}

// ---- 1. a teljes sikeres ut, hozzajarulassal: link + konkret szolgaltatas (HeadSpa paros) ------------------------------------------------------------
{
  const u = await ujLap({ hozzajarul: true });
  await u.page.evaluate(() => window.openBooking({ business: 'headspa', service: 'paros' }));
  await reteg(u.page).locator('.be-nnap.szabad').first().waitFor({ timeout: 25000 });
  await reteg(u.page).locator('.be-idogomb').first().click();
  await reteg(u.page).locator('iframe.be-iframe').waitFor({ state: 'attached', timeout: 20000 });
  await atiranyit(u.page);
  await reteg(u.page).locator('.be-kosz-kartya').waitFor({ timeout: 15000 }).catch(() => {});
  await zar(u.page);
  const e = uj(await dl(u.page)); const sz = szamlaloLepesek(u.naplo);
  ok('1. teljes ut: a dataLayer-ben pontosan ez a 9 lepes jon, ebben a sorrendben, mind EGYSZER', JSON.stringify(nevek(e)) === JSON.stringify(SORREND), nevek(e).join(' > '));
  // (a kulcsok megvannak, de ertekuk undefined: a GTM ezt torli a modellbol; az oroklodes ellen a --ga4 ellenorzes a valodi garancia)
  ok('1. teljes ut: a dataLayer-ben a load_ms csak a slots_loaded-en, a step csak a close-on van, az error_type egyiken sem (nincs regi ertek a kulcsokban)', e.every((x) => (x.event === 'booking_slots_loaded') === (x.load_ms !== undefined)) && e.every((x) => (x.event === 'booking_close') === (x.step !== undefined)) && e.every((x) => x.error_type === undefined) && e[8].step === 'C6', JSON.stringify(e.map((x) => [x.event.replace('booking_', ''), x.load_ms, x.step, x.error_type])));
  ok('1. teljes ut: minden esemenyen ott van a business, service_id, source_page', e.every((x) => x.business === 'headspa' && typeof x.service_id === 'string' && x.source_page === OLDAL), JSON.stringify(e[2]));
  ok('1. teljes ut: a szolgaltatas-lepeseken (service..close) a service_id az igazi azonosito, nem "none"', e.slice(2).every((x) => /^\d+$/.test(x.service_id)) && e[0].service_id === 'none', e.map((x) => x.service_id).join(','));
  ok('1. teljes ut: booking_slots_loaded.load_ms szam (>= 0)', typeof e[3].load_ms === 'number' && e[3].load_ms >= 0 && e[3].load_ms < 60000, 'load_ms=' + e[3].load_ms);
  ok('1. teljes ut: booking_close.step = C6 (a sikerkepernyon zartak be)', e[8].step === 'C6', 'step=' + e[8].step);
  ok('1. teljes ut: nincs booking_error', !e.some((x) => x.event === 'booking_error'));
  ok('1. teljes ut: a nevtelen szamlalo ugyanezt a 9 lepest kapta, egyszer-egyszer', JSON.stringify(sz.map((s) => s.lepes)) === JSON.stringify(['open', 'business', 'service', 'slots_loaded', 'slot', 'form_start', 'submit', 'success', 'close']), sz.map((s) => s.lepes).join(' > '));
  ok('1. teljes ut: a szamlalo bezaras-lepese C6, a betoltesi ido szam, minden uzletag headspa', sz.at(-1).tipus === 'C6' && typeof sz[3].load_ms === 'number' && sz.every((s) => s.uzletag === 'headspa'), JSON.stringify(sz.at(-1)));
  ok('1. teljes ut: a szamlalo-kereseket text/plain POST-kent kuldte (suti / fejlec nelkul), a torzs csak a zart mezoket tartalmazza', u.naplo.szamlalo.every((s) => s.metodus === 'POST' && /^text\/plain/.test(s.hdr)) && sz.every((s) => Object.keys(s).every((k) => ['lepes', 'uzletag', 'tipus', 'load_ms'].includes(k))), '');
  const mind = JSON.stringify([e, sz]);
  ok('1. teljes ut: nincs szemelyes adat (nev, e-mail, telefon, foglalas-azonosito, URL-lekerdezes) sem a dataLayer-ben, sem a szamlalo kereseiben', !/@|Teszt|\+36|g:2461999|atadas|bookingUrl|first_booking/.test(mind), '');
  // a GA4 a gyors, egymas utani esemenyeket kotegelve, kesleltetve kuldi: --ga4 modban legfeljebb 15 mp-ig varjuk, mig mind a 9 megjelenik
  if (GA4) for (let i = 0; i < 30 && !SORREND.every((n) => lepesMeres(u.naplo).some((x) => x.ev === n)); i++) await u.page.waitForTimeout(500);
  const hitek = {}; for (const x of lepesMeres(u.naplo)) hitek[x.ev] = (hitek[x.ev] || 0) + 1;
  console.log('INFO 1. teljes ut: a lepesek utan elfogott GA4-/Stape-hitek esemenyenkent: ' + JSON.stringify(hitek));
  if (GA4) { // a hitek parameterei: az esemeny sorabol (a GA4 ep. = szoveg-, epn. = szam-parameter)
    const par = {}; for (const x of lepesMeres(u.naplo)) if (x.nyers) { const sorok = x.nyers.split(/\r?\n|&(?=en=)/); const sor = sorok.find((s) => new RegExp('(^|&)en=' + x.ev + '(&|$)').test(s)) || x.nyers; par[x.ev] = [...sor.matchAll(/(?:^|&|\?)(epn?\.[a-z_]+)=([^&]*)/g)].map((m) => m[1] + '=' + decodeURIComponent(m[2])).join(' '); }
    console.log('INFO 1. teljes ut (--ga4): a hitek parameterei: ' + JSON.stringify(par));
    const van = (ev, k) => new RegExp('(^| )' + k + '=').test(par[ev] || '');
    ok('1. teljes ut (--ga4): a GA4-hitekben NINCS ertek-oroklodes: csak az adott esemenynek ertelmezett parameter van rajta (load_ms csak a slots_loaded-en, step csak a close-on, error_type egyen sem)', SORREND.every((n) => (n === 'booking_slots_loaded') === van(n, 'epn.load_ms')) && SORREND.every((n) => (n === 'booking_close') === van(n, 'ep.step')) && SORREND.every((n) => !van(n, 'ep.error_type')), JSON.stringify(par).slice(0, 900));
    ok('1. teljes ut (--ga4): a GA4-hitek hordozzak a business / service_id / source_page parametert (booking_open: business, service_id, source_page; booking_slots_loaded: load_ms; booking_close: step)', /ep\.business=headspa/.test(par.booking_service || '') && /ep\.service_id=\d+/.test(par.booking_service || '') && /ep\.source_page=/.test(par.booking_open || '') && /epn\.load_ms=\d+/.test(par.booking_slots_loaded || '') && /ep\.step=C6/.test(par.booking_close || ''), JSON.stringify(par).slice(0, 700));
  }
  if (GA4) ok('1. teljes ut (--ga4): mind a 9 booking_* esemeny elment a GA4 fele (elfogva), egyik sem tobbszor-annyi, mint kellene; nincs mas esemeny', SORREND.every((n) => hitek[n] >= 1) && Object.keys(hitek).every((n) => UJ.has(n)) && Object.values(hitek).every((n) => n <= 2), JSON.stringify(hitek));
  ok('1. teljes ut: a lepesek NEM inditottak konverziot / marketing-esemenyt (Meta, TikTok, Ads, Stape); GA4-ben legfeljebb booking_* (a GTM-trigger utan)', csakGa4Booking(lepesMeres(u.naplo)), JSON.stringify(lepesMeres(u.naplo)));
  ok('1. teljes ut: nincs JS-hiba', u.hibak.length === 0, u.hibak.join(' | '));
  await u.ctx.close();
}

// ---- 2. kezdo kepernyorol valasztott uzletag, bezaras kozben: a business 1x, a close.step a nezet kodja ---------------------------------------------------
{
  const u = await ujLap({ hozzajarul: true });
  await u.page.evaluate(() => window.openBooking({}));
  const c0 = await cim(u.page);
  await reteg(u.page).locator('.be-choice', { hasText: 'Head Spa' }).first().click();
  const c1 = await cim(u.page);
  await zar(u.page);
  const e = uj(await dl(u.page));
  ok('2. kezdo kepernyo: a megnyitaskor meg nincs uzletag (business=none), a valasztas utan booking_business (headspa), bezaraskor booking_close', JSON.stringify(nevek(e)) === JSON.stringify(['booking_open', 'booking_business', 'booking_close']) && e[0].business === 'none' && e[1].business === 'headspa', nevek(e).join(' > ') + ' | cimek: ' + c0 + ' / ' + c1);
  ok('2. kezdo kepernyo: a booking_close.step a HeadSpa-kezdo nezet (HS1), a business a bezaraskor mar headspa', e[2] && e[2].step === 'HS1' && e[2].business === 'headspa', JSON.stringify(e[2]));
  await u.ctx.close();
}
{ // 2b. bezaras a legelso kepernyon
  const u = await ujLap({ hozzajarul: true });
  await u.page.evaluate(() => window.openBooking({}));
  await cim(u.page); await zar(u.page);
  const e = uj(await dl(u.page));
  ok('2b. bezaras a kezdo kepernyon: booking_open + booking_close(step=H0), business=none, egyik sem ketszer', JSON.stringify(nevek(e)) === JSON.stringify(['booking_open', 'booking_close']) && e[1].step === 'H0' && e[1].business === 'none', JSON.stringify(e));
  await u.ctx.close();
}

// ---- 3. hozzajarulas NELKUL: dataLayer ures, a nevtelen szamlalo ettol fuggetlenul megkapja ------------------------------------------------------------
{
  const u = await ujLap({ hozzajarul: false });
  await u.page.evaluate(() => window.openBooking({ business: 'headspa', service: 'paros' }));
  await reteg(u.page).locator('.be-nnap.szabad').first().waitFor({ timeout: 25000 });
  await reteg(u.page).locator('.be-idogomb').first().click();
  await reteg(u.page).locator('iframe.be-iframe').waitFor({ state: 'attached', timeout: 20000 });
  await zar(u.page);
  const e = uj(await dl(u.page)); const sz = szamlaloLepesek(u.naplo);
  ok('3. hozzajarulas nelkul: a dataLayer-ben EGYETLEN uj lepes-esemeny sincs', e.length === 0, nevek(e).join(','));
  ok('3. hozzajarulas nelkul: a nevtelen szamlalo megkapja: open, business, service, slots_loaded, slot, form_start, close(step=C4), egyszer-egyszer',
    JSON.stringify(sz.map((s) => s.lepes)) === JSON.stringify(['open', 'business', 'service', 'slots_loaded', 'slot', 'form_start', 'close']) && sz.at(-1).tipus === 'C4', sz.map((s) => s.lepes + (s.tipus ? ':' + s.tipus : '')).join(' > '));
  ok('3. hozzajarulas nelkul: a lepesek nem inditottak semmilyen kimeno meresi kerest', lepesMeres(u.naplo).length === 0, JSON.stringify(lepesMeres(u.naplo)));
  await u.ctx.close();
}

// ---- 4. hibak: nincs szabad idopont (no_slots), a Salonic-API hibaja (salonic_api) --------------------------------------------------------------------
{
  const u = await ujLap({ hozzajarul: true, idok: [] });
  await u.page.evaluate(() => window.openBooking({ business: 'headspa', service: 'paros' }));
  await reteg(u.page).locator('.be-title', { hasText: 'Nincs megfelelő időpont' }).waitFor({ timeout: 30000 }).catch(() => {});
  await zar(u.page);
  const e = uj(await dl(u.page)); const sz = szamlaloLepesek(u.naplo);
  const h = e.filter((x) => x.event === 'booking_error');
  ok('4. nincs szabad idopont: pontosan egy booking_error, error_type=no_slots, aztan booking_close (step=A1)', h.length === 1 && h[0].error_type === 'no_slots' && e.at(-1).event === 'booking_close' && e.at(-1).step === 'A1', nevek(e).join(' > ') + ' | ' + JSON.stringify(h[0]));
  ok('4. nincs szabad idopont: a szamlalo is egy error(no_slots)-t kap', sz.filter((s) => s.lepes === 'error').length === 1 && sz.find((s) => s.lepes === 'error').tipus === 'no_slots', JSON.stringify(sz.find((s) => s.lepes === 'error')));
  await u.ctx.close();
}
{
  const u = await ujLap({ hozzajarul: true, apiHiba: true });
  await u.page.evaluate(() => window.openBooking({ business: 'headspa', service: 'paros' }));
  await reteg(u.page).locator('.be-title', { hasText: 'Most nem sikerült betölteni' }).waitFor({ timeout: 60000 }).catch(() => {});
  await zar(u.page);
  const e = uj(await dl(u.page)); const h = e.filter((x) => x.event === 'booking_error');
  ok('4b. a Salonic-API hibaja: pontosan egy booking_error, error_type=salonic_api (nem client_error), booking_close step=A3', h.length === 1 && h[0].error_type === 'salonic_api' && e.at(-1).event === 'booking_close' && e.at(-1).step === 'A3', nevek(e).join(' > ') + ' | ' + JSON.stringify(h[0]));
  await u.ctx.close();
}

// ---- 5. robot (Playwright / WebDriver): a belso szamlaloba NEM szamolodik (egy eles bejaras ne torzitsa a szamokat) ------------------------------------
{
  const u = await ujLap({ hozzajarul: true, robot: true });
  await u.page.evaluate(() => window.openBooking({}));
  await cim(u.page); await zar(u.page);
  ok('5. robot (webdriver): a nevtelen szamlaloba nem kerul semmi', u.naplo.szamlalo.length === 0, u.naplo.szamlalo.length + ' kuldes');
  ok('5. robot (webdriver): a dataLayer ettol fuggetlenul megkapja a lepeseket (hozzajarulassal)', uj(await dl(u.page)).length === 2);
  await u.ctx.close();
}

await browser.close();
const rossz = eredmeny.filter((x) => !x.rendben);
console.log(`\n${eredmeny.length} ellenorzes, ${rossz.length} hiba${MOBIL ? ' (mobil)' : ' (asztali)'}`);
process.exit(rossz.length ? 1 : 0);
