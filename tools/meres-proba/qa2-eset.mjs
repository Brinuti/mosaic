// QA-2 VALODI TESZTESET egy uzletagra a PR-ELONEZETEN: arkezesi adatok (kattintasazonositok, UTM, sutik, hozzajarulas) -> valodi, azonnal lemondando probafoglalas ("TESZT - Claude")
// -> a koszonooldal (elonezet) kuldi az erkezesi adatot -> nyers BONGESZOS naplo. A szerveres lepes (level -> parositas -> esemenyek -> platformvalasz) a qa2-szerver.mjs.
//
//   node tools/meres-proba/qa2-eset.mjs --bazis https://<ag>.mosaic-d77.pages.dev --eset headspa|fodrasz|oxigen|szor|pmu [--profil teljes|nincs|ana|dontes_nelkul] [--out naplo.json] [--start <unix>]
//        [--elso google|meta|tiktok|nincs --utolso google|meta|tiktok|nincs]  (QA-3: egy-egy platform kattintasa)  [--koszono-ujratoltes 1 [--varj-level <jelzes-fajl>]]  (QA-3: F5 + vissza gomb a koszonooldalon)
//   utana: node tools/meres-proba/lemond.mjs <a kiirt lemondo-URL>   (a szerveres lepes UTAN: az esemenyek kuldesekor a foglalasnak aktivnak kell lennie - elo allapot-ellenorzes)
//
// eset -> utvonal: headspa = PAROS HeadSpa; fodrasz = fodraszati konzultacio; oxigen = hajkamera-vizsgalat (akcios konzultacio, 4 990 Ft); oxigen-elso = FIZETOS elso oxigenterapias kezeles; szor = lezeres konzultacio;
//   pmu = PMU ingyenes konzultacio; pmu-kezeles = FIZETOS PMU kezeles (sajat PMU-foglalo)
// A KIMENO MERES (GA4, Meta, TikTok, Google Ads, Stape, Zapier) tiltott (tilt.mjs); az eles koszonooldal betoltese is (az eles oldal kodja nem fut). Csak elonezeten fut.
// SZINTETIKUS adatok (a naplo ezt jelzi): a kattintasazonositok formailag ervenyes, TESZT-jelolesu ertekek; a _fbp / _ttp / _ga sutiket a teszt allitja be (az elonezeten nem fut pixel / GA).
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { UA, platformOf, engedett, dnsArg, ures, esemenyIras, esemenyUres } from './tilt.mjs';
import { bookingUrlElemzes } from '../../netlify/lib/foglalas-kulcs.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const BAZIS = arg('bazis', ''), ESET = arg('eset', ''), PROFIL = arg('profil', 'teljes'), OUT = arg('out', ''), START = arg('start', '');
const NINCS_KULCSIRAS = arg('nincs-kulcsiras', '0') === '1'; // R7 (DONTES #108): a koszonooldali kulcs-iras (POST /api/foglalas-kulcs) blokkolva -> a foglalas SOHA nem parosithato (mint az eles oldalon, ahol nincs iras)
if (!/^https:\/\/[a-z0-9-]+\.mosaic-d77\.pages\.dev$/.test(BAZIS)) throw new Error('csak PR-elonezeten fut (--bazis https://<ag>.mosaic-d77.pages.dev)');
const ESETEK = {
  headspa: { opts: { business: 'headspa', service: 'paros' }, szakember: 'mindegy', uzletag: 'headspa' },
  fodrasz: { opts: { business: 'hair', service: 'konzult' }, szakember: 'mindegy', uzletag: 'fodrasz' },
  oxigen: { opts: { business: 'oxygen' }, szakember: 'mindegy', uzletag: 'oxigen', lepesek: ['Hajkamerás vizsgálat'] },
  szor: { opts: { business: 'laser', service: 'konzult' }, szakember: 'mindegy', uzletag: 'szor' },
  pmu: { pmu: true, uzletag: 'pmu' },
  // FIZETOS elso kezeles (a konzultacio-ertek nem fedi): a tenyleges ar megy
  'oxigen-elso': { opts: { business: 'oxygen' }, szakember: 'mindegy', uzletag: 'oxigen', lepesek: ['Első oxigénterápiás kezelés'] },
  'pmu-kezeles': { pmu: true, pmuKezeles: true, uzletag: 'pmu' },
};
const E = ESETEK[ESET]; if (!E) throw new Error('ismeretlen eset: ' + ESET);
const PROFILOK = { teljes: { ana: true, adv: true, fun: true }, nincs: { ana: false, adv: false, fun: false }, ana: { ana: true, adv: false, fun: true }, dontes_nelkul: null };
if (!(PROFIL in PROFILOK)) throw new Error('ismeretlen profil: ' + PROFIL);
const HOZZ = PROFILOK[PROFIL];
const TELEFON = process.env.MERES_TELEFON || '709420090';
const CHROME = process.env.CHROME_UTVONAL || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const T0 = Date.now(); const mp = () => Date.now() - T0;
const idovonal = [], tiltott = [], sajatKeresek = [], hibak = [], konzol = [], kulcsirasBlokkolva = [];
const lepes = (esemeny, extra = {}) => { idovonal.push({ t: mp(), esemeny, ...extra }); console.log(`[${String(mp()).padStart(6)}ms] ${esemeny}`, Object.keys(extra).length ? JSON.stringify(extra).slice(0, 300) : ''); };

// SZINTETIKUS arkezesi adatok (formailag ervenyes, TESZT-jelolesu); esetenkent egyedi
const S = `TESZT_${ESET}_${Date.now().toString(36)}`.toUpperCase();
// alapbol: 1. latogatas = Google-hirdetes, 2. latogatas = Meta + TikTok + Google wbraid (a QA-2 8 esete). QA-3: --elso / --utolso google|meta|tiktok|nincs = KOZLEMENYENKENT csak EGY platform kattintasa (pl. --elso tiktok --utolso meta)
const KATT = { google: (n) => ({ utm_source: 'google', utm_medium: 'cpc', utm_campaign: `qa2_${ESET}_${n}`, utm_content: 'hirdetes_a', gclid: `Cj0KCQjw_${S}_GCLID` }), meta: (n) => ({ utm_source: 'facebook', utm_medium: 'paid', utm_campaign: `qa2_${ESET}_${n}`, fbclid: `IwAR_${S}_FBCLID` }),
  tiktok: (n) => ({ utm_source: 'tiktok', utm_medium: 'paid', utm_campaign: `qa2_${ESET}_${n}`, ttclid: `E.C.P.${S}_TTCLID` }), nincs: () => ({}) };
if ([arg('elso'), arg('utolso')].some((x) => x !== undefined && !(x in KATT))) throw new Error('--elso / --utolso: google | meta | tiktok | nincs');
const ELSO = arg('elso') ? KATT[arg('elso')]('elso') : { utm_source: 'google', utm_medium: 'cpc', utm_campaign: `qa2_${ESET}_elso`, utm_content: 'hirdetes_a', gclid: `Cj0KCQjw_${S}_GCLID` };
const UTOLSO = arg('utolso') ? KATT[arg('utolso')]('utolso') : { utm_source: 'facebook', utm_medium: 'paid', utm_campaign: `qa2_${ESET}_utolso`, fbclid: `IwAR_${S}_FBCLID`, ttclid: `E.C.P.${S}_TTCLID`, wbraid: `CoMKCQ_${S}_WBRAID` };
const ts = Math.floor(Date.now() / 1000);
const SUTIK = { _fbp: `fb.1.${ts * 1000 - 5000000}.${Math.floor(Math.random() * 9e9 + 1e9)}`, _ttp: `${S}_ttp_${Math.random().toString(36).slice(2, 12)}`, _ga: `GA1.1.${Math.floor(Math.random() * 9e8 + 1e8)}.${ts - 86400}`, _ga_H4206SQ0Q7: `GS2.1.s${ts - 1200}$o1$g1$t${ts - 600}$j0$l0$h0` };

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--disable-blink-features=AutomationControlled', dnsArg()] });
const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 900 }, locale: 'hu-HU', timezoneId: 'Europe/Budapest', serviceWorkers: 'block' });
const host = new URL(BAZIS).hostname;
await ctx.addCookies(Object.entries(SUTIK).map(([name, value]) => ({ name, value, domain: host, path: '/' })));
await ctx.addInitScript(([h, hozz]) => { try { if (location.hostname === h && hozz && !localStorage.getItem('mh_cc')) localStorage.setItem('mh_cc', JSON.stringify({ v: 1, t: Date.now(), ...hozz })); } catch (e) { /* nem baj */ } }, [host, HOZZ]);
const elesNavigaciok = []; let kuldes = null;
await ctx.route('**/*', async (route) => {
  const req = route.request(), url = req.url(); let u; try { u = new URL(url); } catch (e) { return route.continue(); }
  if (/^(www\.)?mosaicheadspa\.hu$/.test(u.hostname) && req.resourceType() === 'document') { elesNavigaciok.push(url); return route.fulfill({ status: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, body: '<!doctype html><title>eles koszonooldal (a proba nem tolti be)</title>' }); }
  if (req.method() === 'POST' && /^[a-z0-9-]+\.salonic\.hu$/.test(u.hostname) && /^\/guestData\//.test(u.pathname)) {
    let resp; try { resp = await route.fetch(); } catch (e) { return route.abort(); }
    const szoveg = await resp.text().catch(() => null); let j = null; try { j = JSON.parse(szoveg); } catch (e) { /* nem JSON */ }
    kuldes = { status: resp.status(), url, json: j, szoveg: j ? null : (szoveg || '').slice(0, 300) };
    return route.fulfill({ response: resp, body: szoveg === null ? undefined : szoveg });
  }
  if (NINCS_KULCSIRAS && /\/api\/foglalas-kulcs(\?|$)/.test(url) && req.method() !== 'GET') { kulcsirasBlokkolva.push({ t: mp(), metodus: req.method(), ut: u.pathname }); return route.fulfill({ status: 503, headers: { 'content-type': 'application/json' }, body: '{"ok":false,"miert":"R7: a kulcs-iras blokkolva (teszt)"}' }); }
  if (esemenyIras(url, req.method())) return route.fulfill(esemenyUres());
  const plat = platformOf(url) || (engedett(url, req.method()) ? null : 'tiltott');
  if (plat) { tiltott.push({ t: mp(), plat, metodus: req.method(), host: u.host, ut: u.pathname.slice(0, 60) }); return route.fulfill(ures(req)); }
  return route.continue();
});
const page = await ctx.newPage();
page.on('pageerror', (e) => hibak.push(String(e.message).slice(0, 160)));
page.on('console', (m) => { if (/attribucio|mhAttr|meres/i.test(m.text())) konzol.push(m.text().slice(0, 200)); });
// a SAJAT vegpontok nyers keres- es valaszanaplo (azonos eredetu): /api/meres-erkezes, /api/foglalas-kulcs
page.on('request', (r) => { if (/\/api\/(meres-erkezes|foglalas-kulcs)/.test(r.url())) sajatKeresek.push({ t: mp(), irany: 'keres', metodus: r.method(), url: r.url(), torzs: r.postData() ? JSON.parse(r.postData()) : null }); });
page.on('response', async (r) => { if (/\/api\/(meres-erkezes|foglalas-kulcs)/.test(r.url())) sajatKeresek.push({ t: mp(), irany: 'valasz', status: r.status(), url: r.url(), torzs: await r.json().catch(() => null) }); });
const reteg = page.locator('#mosaic-booking-layer');
const lathato = async (loc, ido = 25000) => { await loc.first().waitFor({ state: 'visible', timeout: ido }); return loc.first(); };
const kontextus = () => page.evaluate(() => { try { return JSON.parse(sessionStorage.getItem('mhBookingCtx')); } catch (e) { return null; } });
const o = { bazis: BAZIS, eset: ESET, uzletag: E.uzletag, hozzajarulas_profil: PROFIL, hozzajarulas: HOZZ, szintetikus_adatok: { megjegyzes: 'a kattintasazonositok es a sutik SZINTETIKUSAK (TESZT-jelolesuek); az elonezeten nem fut pixel / GA, ezert a sutiket a teszt allitja be', elso_latogatas: ELSO, utolso_latogatas: UTOLSO, sutik: SUTIK } };

try {
  // 1. latogatas: Google-hirdetes (elso erintes), 2. latogatas: Meta / TikTok (utolso erintes) - platformonkent kulon utolso kattintas + idobelyeg, elso / utolso UTM
  const qs = (p) => '?' + new URLSearchParams(p).toString();
  await page.goto(BAZIS + '/booking-test' + qs(ELSO), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.mhAttribucio, null, { timeout: 15000 });
  lepes('1. latogatas (Google-hirdetes)', { url: '/booking-test' + qs(ELSO) });
  await page.waitForTimeout(2200);
  await page.goto(BAZIS + (E.pmu ? '/foglalo-pmu' : '/booking-test') + qs(UTOLSO), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.mhAttribucio, null, { timeout: 15000 });
  o.pillanatkep_a_foglalas_elott = await page.evaluate(() => JSON.parse(JSON.stringify(window.mhAttribucio.pillanatkep())));
  lepes('2. latogatas (Meta / TikTok / Google wbraid)', { pillanatkep: o.pillanatkep_a_foglalas_elott });

  if (E.pmu) {
    // sajat PMU-foglalo: ingyenes konzultacio (a lista aljan), utolso szabad nap utolso idopontja, "ez lesz az elso"
    await page.getByRole('button', { name: /IDŐPONTOT FOGLALOK/i }).first().click().catch(async () => { await page.locator('text=/IDŐPONTOT FOGLALOK/i').first().click(); });
    await page.waitForSelector('#kezelesek .kezeles', { timeout: 30000 });
    const kez = page.locator('#kezelesek .kezeles'); const kezValasztott = E.pmuKezeles ? kez.first() : kez.last(); const kezSzoveg = ((await kezValasztott.textContent()) || '').replace(/\s+/g, ' ').trim().slice(0, 100); await kezValasztott.click(); lepes('PMU: kezeles = ' + kezSzoveg);
    await page.waitForSelector('.nnap.szabad', { timeout: 45000 });
    const napok = page.locator('.nnap.szabad'); await napok.nth((await napok.count()) - 1).click(); await page.waitForTimeout(600);
    const idok = page.locator('.idogomb'); const db = await idok.count(); const ido = (await idok.nth(db - 1).textContent()).trim(); await idok.nth(db - 1).click();
    lepes('PMU: idopont valasztva', { ido });
    await page.locator('input[name=elozmeny][value=elso]').check(); await page.locator('#kerdes-tovabb').click();
    await page.waitForSelector('iframe#salonic', { timeout: 30000 }); await page.waitForTimeout(4500);
  } else {
    await page.waitForFunction(() => typeof window.openBooking === 'function', null, { timeout: 15000 });
    await page.evaluate((x) => window.openBooking(x), E.opts);
    await lathato(reteg.locator('.be-title'));
    lepes('reteg megnyilt', { azonosito: (await kontextus() || {}).id });
    const szakember = async () => { if (/szakembert|fodrászt/.test(((await reteg.locator('.be-title').first().textContent()) || ''))) { await reteg.locator('.be-choice', { hasText: 'Mindegy' }).first().click(); lepes('szakember: Mindegy (a Salonic oszt be)'); } };
    await szakember();
    for (const sz of E.lepesek || []) { await (await lathato(reteg.locator('.be-choice', { hasText: sz }))).click(); lepes('valasztas: ' + sz); await page.waitForTimeout(1500); await szakember(); } // oxigen: a szakember-valaszto a szandek UTAN jon
    await reteg.locator('.be-nnap.szabad, button:has-text("További időpontok")').first().waitFor({ state: 'visible', timeout: 25000 });
    const szabad = reteg.locator('.be-nnap.szabad'); let ido;
    if (START) {
      const r = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Budapest', hourCycle: 'h23', day: 'numeric', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(Number(START) * 1000)).map((p) => [p.type, p.value]));
      const nap = reteg.locator('.be-nnap.szabad').filter({ hasText: new RegExp('^' + Number(r.day) + '$') }); await nap.first().click(); await page.waitForTimeout(600);
      const cimke = r.hour + ':' + r.minute; await reteg.locator('.be-idogomb').filter({ hasText: new RegExp('^\\s*' + cimke + '\\s*$') }).first().click(); ido = cimke;
    } else if (await szabad.count()) { await szabad.nth((await szabad.count()) - 1).click(); await page.waitForTimeout(500); const g = reteg.locator('.be-idogomb'); const db = await g.count(); ido = (await g.nth(db - 1).textContent()).trim(); await g.nth(db - 1).click(); }
    else { await (await lathato(reteg.locator('button', { hasText: 'További időpontok' }))).click(); const napok = reteg.locator('.be-strip[aria-label="Nap"] .be-chip'); await lathato(napok); await napok.nth((await napok.count()) - 1).click(); await page.waitForTimeout(800); const idok = reteg.locator('.be-time'); const db = await idok.count(); ido = (await idok.nth(db - 1).textContent()).trim(); await idok.nth(db - 1).click(); }
    lepes('idopont valasztva (az utolso szabad nap utolso idopontja)', { ido });
    await reteg.locator('iframe.be-iframe').waitFor({ state: 'attached', timeout: 30000 }); o.iframe_src = await reteg.locator('iframe.be-iframe').getAttribute('src'); await page.waitForTimeout(4500);
  }
  const fr = page.frames().find((f) => /salonic\.hu\/guestData/.test(f.url())); if (!fr) throw new Error('nincs Salonic-keret');
  o.azonosito_a_keret_cimeben = new URL(fr.url()).searchParams.get('back'); o.keret_url = fr.url(); o.kontextus = await kontextus();
  lepes('Salonic-adatlap betoltve', { back: o.azonosito_a_keret_cimeben });
  const tolt = async (sel, ertek) => { const l = fr.locator(sel).first(); await l.click(); await l.pressSequentially(ertek, { delay: 45 }); };
  await tolt('#GuestDataForm_guestPhoneTemp', TELEFON); await tolt('#GuestDataForm_guestLastName', 'TESZT –'); await tolt('#GuestDataForm_guestFirstName', 'Claude'); await tolt('#GuestDataForm_guestEmail', 'deakfi@grantis.hu');
  await fr.locator('#GuestDataForm_acceptTerms').check();
  if (await page.locator('iframe[src*="recaptcha"][src*="bframe"]').count()) throw new Error('RECAPTCHA-KIHIVAS: megallok');
  lepes('urlap kitoltve, kuldes', { ido: new Date().toISOString() });
  await fr.locator('#button-submit-booking').click();
  const t1 = Date.now(); while (Date.now() - t1 < 60000 && !(kuldes && elesNavigaciok.length)) await page.waitForTimeout(500);
  await page.waitForTimeout(1500);
  const j = kuldes && kuldes.json; const redirectUrl = j && j.redirect && j.redirect.url;
  const uuid = ((j && j.redirect && j.redirect.url_back) || '').match(/bookingId=([0-9a-f-]{36})/);
  Object.assign(o, { salonic_status: kuldes && kuldes.status, redirect_url: redirectUrl || null, salonic_uuid: uuid ? uuid[1] : null, kereten_at_probalt_eles_navigaciok: elesNavigaciok });
  if (uuid) { const h = new URL(kuldes.url).host; o.salonic_host = h; o.lemondo_url = `https://${h}/booking/cancelBooking/${uuid[1]}`; console.log('\nLEMONDO URL:', o.lemondo_url); }
  lepes('foglalas-kuldes valasza', { uuid: o.salonic_uuid, redirect: redirectUrl });
  if (redirectUrl) {
    const lr = new URL(redirectUrl); const bu = lr.searchParams.get('bookingUrl');
    o.koszono_query = Object.fromEntries(lr.searchParams); o.bookingUrl = bu; o.bookingUrl_elemzes = bu ? bookingUrlElemzes(bu) : null; o.booking_id = o.bookingUrl_elemzes && o.bookingUrl_elemzes.bookingId;
    o.koszono_elonezeti_url = BAZIS + lr.pathname + lr.search;
    await page.goto(o.koszono_elonezeti_url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.mhAttribucioEredmeny && window.mhAttribucioEredmeny.allapot !== 'kuldve', null, { timeout: 20000 }).catch(() => {});
    await page.waitForFunction(() => window.mhKulcsEredmeny && window.mhKulcsEredmeny.allapot !== 'kuldve', null, { timeout: 20000 }).catch(() => {});
    o.mhAttribucioEredmeny = await page.evaluate(() => window.mhAttribucioEredmeny || null);
    o.mhKulcsEredmeny = await page.evaluate(() => window.mhKulcsEredmeny || null);
    o.tarolo = await page.evaluate(() => ({ mh_attr: localStorage.getItem('mh_attr'), mh_cc: localStorage.getItem('mh_cc'), sutik_nevei: document.cookie.split(';').map((c) => c.trim().split('=')[0]) }));
    lepes('koszonooldal (elonezet)', { booking_id: o.booking_id, attribucio: o.mhAttribucioEredmeny && o.mhAttribucioEredmeny.allapot, kulcs_iras: o.mhKulcsEredmeny && o.mhKulcsEredmeny.allapot });
    // QA-3 / 1. eset: a koszonooldal ujratoltese (F5) es a VISSZA gomb; --varj-level <fajl>: a level feldolgozasa UTAN (a hivo letrehozza a <fajl>.level-kesz jelzest) meg egy ujratoltes
    if (arg('koszono-ujratoltes', '0') === '1') {
      const posztok = () => sajatKeresek.filter((x) => x.irany === 'keres' && x.metodus === 'POST').length;
      const rogzit = async (cimke) => { await page.waitForTimeout(2500); const e = await page.evaluate(() => ({ a: window.mhAttribucioEredmeny || null, k: window.mhKulcsEredmeny || null })); const r = { lepes: cimke, url: page.url().replace(/\?.*$/, ''), post_keresek_osszesen: posztok(), attribucio: e.a && e.a.allapot, kulcs_iras: e.k && e.k.allapot }; o.koszono_ujratoltes.push(r); lepes('koszonooldal: ' + cimke, r); };
      o.koszono_ujratoltes = []; await rogzit('elso betoltes');
      await page.reload({ waitUntil: 'domcontentloaded' }); await rogzit('ujratoltes #1 (F5)');
      await page.reload({ waitUntil: 'domcontentloaded' }); await rogzit('ujratoltes #2 (F5)');
      await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => null); await rogzit('VISSZA gomb');
      await page.goForward({ waitUntil: 'domcontentloaded' }).catch(() => null); await rogzit('ELORE gomb (vissza a koszonooldalra)');
      const jelzes = arg('varj-level', '');
      if (jelzes) {
        if (OUT) fs.writeFileSync(OUT, JSON.stringify({ ...o, idovonal, sajat_keresek_nyers: sajatKeresek, reszleges: true }, null, 1)); // a hivo (qa3-futtat) ebbol olvassa a foglalas adatait a level-lepeshez
        fs.writeFileSync(jelzes + '.kesz1', '1'); const t2 = Date.now(); while (Date.now() - t2 < 300000 && !fs.existsSync(jelzes + '.level-kesz')) await page.waitForTimeout(1000);
        await page.reload({ waitUntil: 'domcontentloaded' }); await rogzit('ujratoltes a level feldolgozasa UTAN');
        await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => null); await rogzit('VISSZA gomb a level feldolgozasa UTAN');
      }
    }
  }
} catch (e) { lepes('HIBA', { uzenet: String(e.message || e).slice(0, 300) }); o.hiba = String(e.message || e).slice(0, 300); }
const keresek = {}; for (const n of tiltott) { const k = `${n.plat} ${n.host}${n.ut}`; keresek[k] = (keresek[k] || 0) + 1; }
console.log('Tiltott / naplozott kimeno keresek (semmi nem ment ki):', JSON.stringify(keresek)); console.log('JS-hibak:', hibak.length ? hibak.join(' | ') : 'nincs');
if (OUT) fs.writeFileSync(OUT, JSON.stringify({ ...o, idovonal, sajat_keresek_nyers: sajatKeresek, tiltott_kimeno_keresek: keresek, ...(NINCS_KULCSIRAS ? { kulcsiras_blokkolva: kulcsirasBlokkolva } : {}), js_hibak: hibak, konzol }, null, 1));
await browser.close();
