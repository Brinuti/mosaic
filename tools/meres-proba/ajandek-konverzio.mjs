// Az ajandekkartya-motor REGI konverziojanak elo probaja: a sikeres vasarlas utan a motor egy lathatatlan, azonos eredetu keretben betolti a regi koszono-oldalt
// (/success-ajandekkartya-stripe?ertek=<Ft>&session_id=<pi_...>), igy a GTM / Meta / TikTok / GA4 kodok pontosan ugy futnak, mint a regi fizetolinkes vasarlasnal.
// A szkript azt meri, HANY konverzio megy ki platformonkent, melyik ablakbol (fo ablak / rejtett keret), milyen ertekkel es azonositoval, es hogy a gclid /
// fbc / ttclid benne van-e. MINDEN kimeno meresi kereset naplozva ES letiltva (tilt.mjs: alapbol tilto, a capig.stape is): semmi nem jut el a hirdetesi fiokokba.
//
//   node tools/meres-proba/ajandek-konverzio.mjs [--mod motor|regi] [--base https://www.mosaicheadspa.hu] [--landing /headspa-ajandekkartya]
//                                                [--termek egyeni] [--ertek 26900] [--pi pi_TESZT...] [--out konverzio.json] [--varakozas 14000]
//
//   --mod motor  (alap) a hirdetesi kattintas (gclid, fbclid, ttclid, utm_*) utan a motor SAJAT visszateresi utvonala: a szerver "fizetve" valaszat utanozzuk
//                (a /api/ajandek/rendeles kerest megvalaszoljuk egy kamu, fizetett rendelessel), minden mas a valodi, elesben futo kod. A kartyas fizetes
//                maga NEM torténik meg (a Stripe.js tiltott, es kartyaadatot nem adunk meg): ezt csak egy valodi vasarlas igazolja.
//   --mod regi   a regi koszono-oldal KOZVETLENUL a fo ablakban (a regi fizetolinkes vasarlas): osszehasonlitasi alap
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { UA, platformOf, engedett, dnsArg, ures, hozzajarulasScript } from './tilt.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('base', 'https://www.mosaicheadspa.hu');
const MOD = arg('mod', 'motor');
const LANDING = arg('landing', '/headspa-ajandekkartya');
const TERMEK = arg('termek', 'egyeni');
const ERTEK = +arg('ertek', '26900');
const PI = arg('pi', 'pi_TESZT_MERES_' + Date.now());
const VAR = +arg('varakozas', '14000');
const OUT = arg('out', `konverzio-${MOD}.json`);
const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CLICK = { gclid: 'TESZT123', fbclid: 'TESZT456', ttclid: 'TESZT789' };
const CLICK_QS = `gclid=${CLICK.gclid}&fbclid=${CLICK.fbclid}&ttclid=${CLICK.ttclid}&utm_source=teszt&utm_medium=cpc`;
const RUTIN_GA = /^(page_view|user_engagement|scroll|visit|session_start|first_visit|gtm\.[a-z]+|consent_update)$/i;
const RUTIN_TT = /^(Pageview|LandingPageView|EngagedSession|EnrichIpv6|InitiateCheckout|EnrichAM)$/;

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--disable-blink-features=AutomationControlled', dnsArg()] });
const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 900 }, locale: 'hu-HU', timezoneId: 'Europe/Budapest', serviceWorkers: 'block' });
await ctx.addInitScript(hozzajarulasScript);

const naplo = [];     // minden kimeno meresi kereses (tiltva)
const tiltott = [];   // ismeretlen host / nem engedett metodus
let fazis = 'landing';

function keretNev(req) {
  try { const f = req.frame(); return f.parentFrame() ? 'rejtett-keret' : 'fo-ablak'; } catch (e) { return 'ismeretlen'; }
}
function tartalmaz(szoveg) {
  const s = (() => { try { return decodeURIComponent(szoveg); } catch (e) { return szoveg; } })();
  return { gclid: s.includes(CLICK.gclid), fbclid: s.includes(CLICK.fbclid), ttclid: s.includes(CLICK.ttclid), pi: s.includes(PI), ertek: new RegExp('(^|[^0-9])' + ERTEK + '([^0-9]|$)').test(s) };
}
const par = (u, torzs) => ({ ...Object.fromEntries(u.searchParams), ...Object.fromEntries(new URLSearchParams(torzs.startsWith('{') ? '' : torzs)) });

await ctx.route('**/*', async (route) => {
  const req = route.request(), url = req.url();
  let u; try { u = new URL(url); } catch (e) { return route.continue(); }
  const plat = platformOf(url) || (engedett(url, req.method()) ? null : 'ismeretlen-tiltott');
  if (!plat) return route.continue();
  const torzs = req.postData() || '';
  if (plat === 'ismeretlen-tiltott') tiltott.push(`${req.method()} ${u.host}${u.pathname.slice(0, 40)}`);
  else {
    const bejegyzes = { fazis, plat, keret: keretNev(req), metodus: req.method(), host: u.host, ut: u.pathname.slice(0, 70), ...tartalmaz(url + '\n' + torzs) };
    const p = par(u, torzs);
    if (plat === 'meta') Object.assign(bejegyzes, { ev: p.ev, pixel: p.id, eid: p.eid, fbc: p.fbc || null, fbp: p.fbp || null, ertek_param: p['cd[value]'] || null, penznem: p['cd[currency]'] || null, oldal: p.dl });
    else if (plat === 'tiktok') { try { const b = JSON.parse(torzs); Object.assign(bejegyzes, { ev: b.event, pixel: b.context && b.context.pixel && b.context.pixel.code, ertek_param: b.properties && b.properties.value, penznem: b.properties && b.properties.currency, oldal: b.context && b.context.page && b.context.page.url }); } catch (e) { bejegyzes.ev = '?'; } }
    else if (plat === 'google-ads') Object.assign(bejegyzes, { en: p.en || null, cimke: (p.label || '').slice(0, 12) || null, ertek_param: p.value || null, penznem: p.currency_code || null, oid: p.oid || p.transaction_id || null, gclaw: p.gclaw || p.gclid || null });
    else if (plat === 'ga4' || plat === 'stape') {
      // a GA4 egy kerelemben tobb esemenyt is kuldhet (a torzs soronkent egy)
      const sorok = torzs && !torzs.startsWith('{') ? torzs.split('\n') : [''];
      const esemenyek = sorok.map((sor) => ({ ...Object.fromEntries(u.searchParams), ...Object.fromEntries(new URLSearchParams(sor)) }));
      bejegyzes.esemenyek = esemenyek.map((e) => e.en).filter(Boolean);
      const fontos = esemenyek.find((e) => e.en && !RUTIN_GA.test(e.en)) || {};
      Object.assign(bejegyzes, { en: fontos.en || null, ertek_param: fontos['epn.value'] || fontos['ep.value'] || fontos.value || null, penznem: fontos.cu || null, tid: fontos.tid || null, tranzakcio: fontos['ep.transaction_id'] || fontos['epn.transaction_id'] || null });
    }
    naplo.push(bejegyzes);
  }
  return route.fulfill(ures(req));
});

// a kamu, fizetett rendeles (csak MOD=motor): a szerver "fizetve" valasza a PI-re; minden mas keres a valodi szerverre megy
const rendeles = () => ({
  allapot: 'fizetve', visszavonva: false, rendeles_id: 'TESZT-MERES', atvetel: 'otthon', termek: TERMEK, termek_nev: 'Egyéni Head Spa ajándékkártya (TESZT)', kartya_cim: 'Egyéni Head Spa',
  osszeg: ERTEK, penznem: 'HUF', email: 'meres-proba@example.com', fizetesi_mod: 'card', fizetve_ekkor: new Date().toISOString(),
  attr: { utm_source: 'teszt', utm_medium: 'cpc', gclid: CLICK.gclid, fbclid: CLICK.fbclid, ttclid: CLICK.ttclid },
  kartya: { allapot: 'keszul', ervenyes_ig: '2027-04-04' }, szemelyre: null,
});
let rendelesKeres = 0;
if (MOD === 'motor') {
  await ctx.route('**/api/ajandek/rendeles*', async (route) => {
    if (!route.request().url().includes('pi=' + PI)) return route.fallback();
    rendelesKeres++;
    return route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(rendeles()) });
  });
}

const page = await ctx.newPage();
const konzol = [];
page.on('console', (m) => { if (m.type() === 'error') konzol.push(m.text().slice(0, 160)); });

// 1) hirdetesi kattintas: landing a click-azonositokkal (a pixelek ekkor menti a _fbc / _gcl_aw / ttclid sutit, a motor az attribuciot a munkamenetbe)
await page.goto(`${BASE}${LANDING}?${CLICK_QS}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
console.error('landing betoltve'); await page.waitForTimeout(8000);
const sutikLanding = Object.fromEntries((await ctx.cookies()).filter((c) => /^(_fbc|_fbp|_gcl_aw|_gcl_au|_ttp|ttclid|_ga)/.test(c.name) || /ttclid/.test(c.name)).map((c) => [c.name, c.value.slice(0, 60)]));
const landingAttr = await page.evaluate(() => { try { return (JSON.parse(sessionStorage.getItem('ah_v1')) || {}).attr || null; } catch (e) { return null; } });
fazis = 'vasarlas';
const landingNaplo = naplo.length;

if (MOD === 'motor') {
  // 2) a fizetes inditasa a munkamenetben (a motor ezt a vevo bongeszojeben jegyzi), majd a Stripe visszateres (3DS / atiranyitasos fizetesi mod): ez a motor valodi utja
  const variant = await page.evaluate((pi) => {
    const t = JSON.parse(sessionStorage.getItem('ah_v1') || '{}');
    t.termek = t.termek || null;
    return t.variant_id || null;
  }, PI);
  await page.evaluate(({ pi, termek }) => {
    const t = JSON.parse(sessionStorage.getItem('ah_v1') || '{}');
    t.termek = termek; t.pi = pi; t.cs = pi + '_secret_TESZT'; t.fizetes_inditva = pi;
    sessionStorage.setItem('ah_v1', JSON.stringify(t));
  }, { pi: PI, termek: TERMEK });
  const vissza = `${BASE}${LANDING}?variant=${encodeURIComponent(variant || 'GENERAL')}&payment_intent=${PI}&payment_intent_client_secret=${PI}_secret_TESZT&redirect_status=succeeded`;
  console.error('visszateres...'); await page.goto(vissza, { waitUntil: 'domcontentloaded', timeout: 60000 });
} else {
  await page.goto(`${BASE}/success-ajandekkartya-stripe?ertek=${ERTEK}&session_id=${PI}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
}
console.error('varakozas...'); await page.waitForTimeout(VAR);

// egy lefagyott oldal / keret ne akassza meg a probat
const biztos = (p, ms, tartalek) => Promise.race([p, new Promise((ok) => setTimeout(() => ok(tartalek), ms))]);
// --- eredmeny ------------------------------------------------------------------------------------------------------------------------------
const keretek = page.frames().map((f) => ({ url: f.url().replace(/(payment_intent_client_secret=)[^&]+/, '$1…').slice(0, 130), szulo: !!f.parentFrame() }));
console.error('allapot...');
const allapot = await biztos(page.evaluate(() => { try { return window.__ajandek ? window.__ajandek.allapot() : null; } catch (e) { return null; } }), 8000, 'NEM-VALASZOL');
const dl = [];
for (const f of page.frames()) {
  try { dl.push({ keret: f.parentFrame() ? 'rejtett-keret' : 'fo-ablak', purchase: await biztos(f.evaluate(() => (window.dataLayer || []).filter((e) => e && (e.event === 'purchase' || e.event === 'generate_lead' || e.event === 'gtm.historyChange-v2' && false)).map((e) => ({ event: e.event, id: e.transaction_id || null, value: e.value || null }))), 8000, 'NEM-VALASZOL') }); } catch (e) { /* keret mar nincs */ }
}
console.error('kulcs...');
const purchaseKulcs = await biztos(page.evaluate((pi) => { try { return localStorage.getItem('ah_purchase_' + pi); } catch (e) { return null; } }, PI), 8000, 'NEM-VALASZOL');
const sutikVege = Object.fromEntries((await ctx.cookies()).filter((c) => /^(_fbc|_gcl_aw|ttclid)/.test(c.name)).map((c) => [c.name, c.value.slice(0, 60)]));
await browser.close();

const konv = naplo.filter((n) => n.fazis === 'vasarlas').filter((n) => {
  if (n.plat === 'meta') return n.ev && !/^(PageView|SubscribedButtonClick|Microdata)$/.test(n.ev);
  if (n.plat === 'tiktok') return n.ev && !RUTIN_TT.test(n.ev);
  if (n.plat === 'google-ads') return n.en === 'conversion' || /\/(1p-)?conversion\//.test(n.ut);
  if (n.plat === 'ga4' || n.plat === 'stape') return n.en && !RUTIN_GA.test(n.en);
  return n.plat === 'zapier';
});
const osszesito = {};
for (const k of konv) {
  const kulcs = `${k.plat}/${k.keret}/${k.ev || k.en || k.cimke || k.ut}`;
  osszesito[kulcs] = (osszesito[kulcs] || 0) + 1;
}
// minden kimeno meresi kereses (a rutinok is: page_view stb.) fazisonkent / platformonkent / ablakonkent
const mind = {};
for (const n of naplo) { const kulcs = n.fazis + '/' + n.plat + '/' + n.keret + '/' + (n.ev || (n.esemenyek && n.esemenyek.join('+')) || n.en || n.ut); mind[kulcs] = (mind[kulcs] || 0) + 1; }
const eredmeny = {
  ido: new Date().toISOString(), mod: MOD, base: BASE, landing: LANDING, pi: PI, ertek: ERTEK, kattintasAzonositok: CLICK,
  landingAttr, sutikLanding, sutikVege, motorAllapot: allapot, rendelesKeres, purchaseKulcs, keretek, dataLayer: dl,
  konverziok: konv, osszesito, mindenKimeno: mind, landingMeresKeres: landingNaplo, tiltottIsmeretlen: [...new Set(tiltott)], konzolHiba: konzol.slice(0, 5),
};
fs.writeFileSync(OUT, JSON.stringify(eredmeny, null, 1));
console.log(JSON.stringify({ mod: MOD, pi: PI, motorAllapot: allapot, purchaseKulcs, rendelesKeres, keretek, dataLayer: dl, osszesito, tiltottIsmeretlen: eredmeny.tiltottIsmeretlen }, null, 1));
console.log('kesz:', OUT, '| konverzios kerelmek:', konv.length);
