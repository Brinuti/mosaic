// A ket UJ foglalasi ut elo merese VALODI proba-foglalassal (lemondas kulon: lemond.mjs), alapbol tiltott kimeno meresi keresekkel
// (capig.stape.*, capi-pmu.mosaicheadspa.hu, Google, TikTok, Zapier is: tilt.mjs). Minden kerest naplozunk, semmi nem megy ki a hirdetesi fiokokba.
//
//   node tools/meres-proba/uj-utak-proba.mjs --ut pmu|lezer [--bazis https://www.mosaicheadspa.hu] [--out naplo.json] [--megall 1]
//                                            [--kezeles <resz a PMU kezeles nevebol>] [--varakozas 20000]
//
//   --ut pmu    /sminktetovalas-budapest (a hirdetesi kattintas azonositoival) -> a beagyazott foglalo (/foglalo-pmu?beagyazva=1) -> kezeles -> naptar
//               -> kerdes -> Salonic-adatlap (egy MASIK keretben) -> a Salonic a /pmu-ok oldalra iranyit (ket keret melyen) -> a foglalo a TELJES ABLAKBAN
//               nyitja meg (mh_proba=pmu) -> ott fut a meres. Naplozza az elozmeny-valtasokat (pushState/replaceState/hashchange) es a fo ablak navigaciojat is.
//   --ut lezer  /lezeres-szortelenites-budapest (azonositokkal) -> a landing sajat naptara -> egy idopontra kattintva a vendeg atmegy a Salonic
//               /guestData/ oldalara (salonic.hu, ugyanabban a lapban) -> a Salonic az /elysion-ok oldalra iranyit -> ott fut a meres.
//   --megall 1  az adatlapot NEM toltjuk ki (foglalas nem jon letre): csak az eddigi lepesek es a landing-meres
//   --mod szim  a Salonic-adatlap helyett a Salonic atiranyitasa a koszonooldalra (foglalas NEM jon letre): ugyanaz a keret-atadas, mint a valodiban
//   --mod nativ osszehasonlitasi alap: a koszonooldal KOZVETLENUL a fo ablakban (landing a click-azonositokkal, majd a Salonic-referrerrel a koszonooldal)
//   --vissza 1  a koszonooldal utan a bongeszo "vissza" gombja (history.back), es az utana kimeno meres is naplozva ('vissza' fazis)
//
// A foglalas: az utolso szabad nap utolso idopontja, "TESZT – Claude" nev, deakfi@grantis.hu, a tulajdonos sajat telefonszama (MERES_TELEFON).
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { UA, platformOf, engedett, dnsArg, ures, hozzajarulasScript, esemenyIras, esemenyUres } from './tilt.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const UT = arg('ut', 'pmu');
const BAZIS = arg('bazis', 'https://www.mosaicheadspa.hu');
const OUT = arg('out', `uj-ut-${UT}.json`);
const MEGALL = arg('megall', '0') === '1';
const KEZELES = arg('kezeles', '');
const VAR = +arg('varakozas', '20000');
const MOD = arg('mod', 'valodi'); // valodi | szim | nativ
const VISSZA = arg('vissza', '0') === '1';
const TELEFON = process.env.MERES_TELEFON || '709420090';
const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CLICK = { gclid: 'TESZT123', fbclid: 'TESZT456', ttclid: 'TESZT789' };
const CLICK_QS = `gclid=${CLICK.gclid}&fbclid=${CLICK.fbclid}&ttclid=${CLICK.ttclid}&utm_source=teszt&utm_medium=cpc`;
const RUTIN_GA = /^(page_view|user_engagement|scroll|visit|session_start|first_visit|gtm\.[a-z]+|consent_update)$/i;
const RUTIN_TT = /^(Pageview|LandingPageView|EngagedSession|EnrichIpv6|InitiateCheckout|EnrichAM|ViewContent)$/;
const UTVONALAK = {
  pmu: { landing: '/sminktetovalas-budapest', koszono: /\/pmu-ok(\?|$)/ },
  lezer: { landing: '/lezeres-szortelenites-budapest', koszono: /\/elysion-ok(\?|$)/ },
};
const U = UTVONALAK[UT];
if (!U) throw new Error('ismeretlen --ut: ' + UT);
// a Salonic-atiranyitas (szim / nativ mod): a valodi koszonooldal-URL szerkezete (first_booking, service, category, price, location, employee, g, bookingUrl)
const SIM = {
  pmu: { host: 'mosaic-pmu.salonic.hu', ut: '/pmu-ok', employeeId: 32428, placeId: 14585, serviceId: 471034, service: 'Ajaktetoválás - Aquarell - 124.900 Ft helyett most', category: 'Természetes sminktetoválás', price: 99000, location: 'Mosaic PMU', employee: 'Töreki Melitta' },
  lezer: { host: 'mosaic-elysion.salonic.hu', ut: '/elysion-ok', employeeId: 32417, placeId: 14586, serviceId: 476488, service: 'TEST - Teljes hónalj + állapotfelmérés -20% kedvezménnyel', category: 'Végleges Szőrtelenítés - 1. Alkalom', price: 15200, location: 'Mosaic Elysion', employee: 'Elysion Pro Szőrtelenítés' },
}[UT];
let simSzam = 0;
function koszonoUrl(start) {
  const bookingUrl = `https://${SIM.host}/guestData/?anyone=true&employeeId=${SIM.employeeId}&placeId=${SIM.placeId}&serviceId=${SIM.serviceId}&startDate=${start}&back=`;
  const p = new URLSearchParams({ first_booking: 'true', service: SIM.service, category: SIM.category, price: String(SIM.price), location: SIM.location, employee: SIM.employee, g: 'g:99000' + (++simSzam), bookingUrl });
  return `${BAZIS}${SIM.ut}?${p.toString()}`;
}

const T0 = Date.now(); const mp = () => Date.now() - T0;
const idovonal = [], naplo = [], hist = [], iras = [], hibak = [];
let fazis = 'landing';
const lepes = (esemeny, extra = {}) => { idovonal.push({ t: mp(), fazis, esemeny, ...extra }); console.log(`[${String(mp()).padStart(6)}ms] ${esemeny}`, Object.keys(extra).length ? JSON.stringify(extra).slice(0, 200) : ''); };

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--disable-blink-features=AutomationControlled', dnsArg()] });
const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 1000 }, locale: 'hu-HU', timezoneId: 'Europe/Budapest', serviceWorkers: 'block' });
await ctx.addInitScript(hozzajarulasScript);
// elozmeny-valtasok naplozasa MINDEN keretben (a GTM "History Change" triggere ezekre mer): pushState / replaceState / hashchange / popstate
await ctx.addInitScript(() => {
  try {
    if (!/(^|\.)mosaicheadspa\.hu$/.test(location.hostname)) return;
    const naplo = (tipus, ures) => { try { console.log('__HIST__' + JSON.stringify({ tipus, url: location.href.slice(0, 160), kulso: window.top !== window.self })); } catch (e) { /* nem baj */ } };
    for (const m of ['pushState', 'replaceState']) { const eredeti = history[m]; history[m] = function () { naplo(m); return eredeti.apply(this, arguments); }; }
    addEventListener('hashchange', () => naplo('hashchange'));
    addEventListener('popstate', () => naplo('popstate'));
  } catch (e) { /* nem baj */ }
});

function mely(req) { try { let f = req.frame(), d = 0; while (f.parentFrame()) { d++; f = f.parentFrame(); } return d; } catch (e) { return -1; } }
function tartalmaz(szoveg) {
  const s = (() => { try { return decodeURIComponent(szoveg); } catch (e) { return szoveg; } })();
  return { gclid: s.includes(CLICK.gclid), fbclid: s.includes(CLICK.fbclid), ttclid: s.includes(CLICK.ttclid) };
}

await ctx.route('**/*', async (route) => {
  const req = route.request(), url = req.url();
  let u; try { u = new URL(url); } catch (e) { return route.continue(); }
  if (MOD === 'szim' && u.hostname === SIM.host && u.pathname.startsWith('/guestData') && req.resourceType() === 'document') {
    const cel = koszonoUrl(u.searchParams.get('startDate') || '1793458800');
    lepes('szimulalt Salonic-atiranyitas a koszonooldalra', { mely: mely(req), cel: cel.replace(/(bookingUrl=)[^&]+/, '$1…').slice(0, 150) });
    return route.fulfill({ status: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, body: `<!doctype html><meta charset="utf-8"><script>location.replace(${JSON.stringify(cel)});</script>` });
  }
  if (esemenyIras(url, req.method())) { iras.push(req.postData()); return route.fulfill(esemenyUres()); } // a foglalasi jegyzettombbe a proba nem irhat
  const plat = platformOf(url) || (engedett(url, req.method()) ? null : 'ismeretlen-tiltott');
  if (!plat) return route.continue();
  const torzs = req.postData() || '';
  const b = { t: mp(), fazis, plat, mely: mely(req), metodus: req.method(), host: u.host, ut: u.pathname.slice(0, 70), ...tartalmaz(url + '\n' + torzs) };
  const p = { ...Object.fromEntries(u.searchParams), ...Object.fromEntries(new URLSearchParams(torzs.startsWith('{') ? '' : torzs)) };
  if (plat === 'meta') Object.assign(b, { ev: p.ev, pixel: p.id, eid: p.eid, fbc: p.fbc || null, fbp: p.fbp || null, ertek_param: p['cd[value]'] || null, penznem: p['cd[currency]'] || null, oldal: (p.dl || '').slice(0, 120) });
  else if (plat === 'tiktok') { try { const j = JSON.parse(torzs); Object.assign(b, { ev: j.event, pixel: j.context && j.context.pixel && j.context.pixel.code, ertek_param: j.properties && j.properties.value, oldal: ((j.context && j.context.page && j.context.page.url) || '').slice(0, 120) }); } catch (e) { b.ev = '?'; } }
  else if (plat === 'google-ads') Object.assign(b, { en: p.en || null, cimke: (p.label || '').slice(0, 12) || null, ertek_param: p.value || null, penznem: p.currency_code || null, oid: p.oid || p.transaction_id || null, gclaw: p.gclaw || p.gclid || null });
  else if (plat === 'ga4' || plat === 'stape') {
    if (/capig|capi-pmu/.test(u.host) || (torzs.startsWith('{') && /event_name/.test(torzs))) { try { const j = JSON.parse(torzs); Object.assign(b, { capi: true, ev: j.event_name, pixel: j['fb.pixel_id'] || j.pixel_id, eid: j.event_id }); } catch (e) { b.capi = true; b.ev = '?'; } }
    else {
      const sorok = torzs && !torzs.startsWith('{') ? torzs.split('\n') : [''];
      const esemenyek = sorok.map((sor) => ({ ...Object.fromEntries(u.searchParams), ...Object.fromEntries(new URLSearchParams(sor)) }));
      b.esemenyek = esemenyek.map((e) => e.en).filter(Boolean);
      const fontos = esemenyek.find((e) => e.en && !RUTIN_GA.test(e.en)) || {};
      Object.assign(b, { en: fontos.en || null, ertek_param: fontos['epn.value'] || fontos['ep.value'] || fontos.value || null, penznem: fontos.cu || null, oldal: (fontos.dl || esemenyek[0].dl || '').slice(0, 120) });
    }
  } else if (plat === 'zapier') b.torzs_hossz = torzs.length;
  naplo.push(b);
  return route.fulfill(ures(req));
});

const page = await ctx.newPage();
page.on('pageerror', (e) => hibak.push(String(e.message).slice(0, 160)));
page.on('console', (m) => { const t = m.text(); if (t.startsWith('__HIST__')) { try { hist.push({ t: mp(), fazis, ...JSON.parse(t.slice(8)) }); } catch (e) { /* nem baj */ } } });
page.on('framenavigated', (f) => {
  let d = 0, x = f; while (x.parentFrame()) { d++; x = x.parentFrame(); }
  const url = f.url();
  if (/^about:/.test(url)) return;
  const koszono = d === 0 && U.koszono.test(url);
  if (koszono && fazis !== 'koszono') fazis = 'koszono';
  idovonal.push({ t: mp(), fazis, esemeny: 'navigacio', mely: d, url: url.replace(/(bookingUrl=)[^&]+/, '$1…').slice(0, 170) });
});

const lathato = async (loc, ido = 25000) => { await loc.first().waitFor({ state: 'visible', timeout: ido }); return loc.first(); };
// a Salonic-adatlap kitoltese es elkuldese (valodi foglalas); a keret: a lapon (lezer) vagy egy beagyazott keretben (pmu)
async function adatlap(fr) {
  const tolt = async (sel, ertek) => { const l = fr.locator(sel).first(); await l.waitFor({ state: 'visible', timeout: 30000 }); await l.click(); await l.pressSequentially(ertek, { delay: 45 }); }; // valodi billentyuleutesek: a telefonmezo (intl-tel-input) rejtett mezoi igy frissulnek
  await tolt('#GuestDataForm_guestPhoneTemp', TELEFON);
  await tolt('#GuestDataForm_guestLastName', 'TESZT –');
  await tolt('#GuestDataForm_guestFirstName', 'Claude');
  await tolt('#GuestDataForm_guestEmail', 'deakfi@grantis.hu');
  await fr.locator('#GuestDataForm_acceptTerms').check(); // csak a feltetel (hirlevel NEM)
  if (await page.locator('iframe[src*="recaptcha"][src*="bframe"]').count()) throw new Error('RECAPTCHA-KIHIVAS: megallok');
  lepes('urlap kitoltve, kuldes', { ido: new Date().toISOString() });
  await fr.locator('#button-submit-booking').click();
}
// az utolso szabad nap utolso idopontja: a "nap" es "ido" kijelolok az adott naptar-valtozathoz
async function utolsoIdopont(napLoc, idoLoc, ido = 60000) {
  await napLoc.first().waitFor({ state: 'visible', timeout: ido });
  const n = await napLoc.count();
  await napLoc.nth(n - 1).click();
  await page.waitForTimeout(700);
  await idoLoc.first().waitFor({ state: 'visible', timeout: 15000 });
  const m = await idoLoc.count();
  const szoveg = ((await idoLoc.nth(m - 1).textContent()) || '').trim();
  return { szoveg, loc: idoLoc.nth(m - 1) };
}

try {
  // 1) hirdetesi kattintas: a landing a click-azonositokkal
  lepes('indulas: landing (hirdetes-kattintas utanzata)', { url: BAZIS + U.landing + '?' + CLICK_QS });
  await page.goto(BAZIS + U.landing + '?' + CLICK_QS, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);
  const sutikLanding = Object.fromEntries((await ctx.cookies()).filter((c) => /^(_fbc|_gcl_aw|ttclid)/.test(c.name)).map((c) => [c.name, c.value.slice(0, 50)]));
  lepes('landing betoltve', { sutik: sutikLanding });
  fazis = 'foglalas';

  if (MOD === 'nativ') {
    const cel = koszonoUrl('1793458800');
    lepes('nativ koszonooldal (Salonic-referrerrel, a landing utan)', { cel: cel.replace(/(bookingUrl=)[^&]+/, '$1…').slice(0, 150) });
    await page.goto(cel, { referer: `https://${SIM.host}/guestData/`, waitUntil: 'domcontentloaded', timeout: 60000 });
  } else if (UT === 'pmu') {
    const fo = page.frameLocator('#foglalo');
    await page.locator('#foglalo').scrollIntoViewIfNeeded();
    await (await lathato(fo.locator('button[data-ugrik="szolg"]'))).click(); lepes('foglalo: Idopontot foglalok');
    await lathato(fo.locator('.kezeles'), 40000);
    const kez = fo.locator('.kezeles');
    const nevek = await kez.locator('.nev').allTextContents();
    let idx = 0;
    if (KEZELES) idx = nevek.findIndex((n) => n.toLowerCase().includes(KEZELES.toLowerCase()));
    if (idx < 0) throw new Error('nincs ilyen kezeles: ' + nevek.join(' | '));
    const valasztott = ((await kez.nth(idx).textContent()) || '').replace(/\s+/g, ' ').trim();
    await kez.nth(idx).click(); lepes('kezeles valasztva', { kezeles: valasztott.slice(0, 100) });
    const ido = await utolsoIdopont(fo.locator('.nnap.szabad'), fo.locator('.idogomb'));
    lepes('idopont valasztva (az utolso szabad nap utolso idopontja)', { ido: ido.szoveg });
    await ido.loc.click(); // egy erintes az idoponton = tovabb
    await (await lathato(fo.locator('input[name=elozmeny][value=elso]'), 20000)).check(); lepes('kerdes: ez lesz az elso');
    await fo.locator('#kerdes-tovabb').click();
    if (MOD === 'valodi') await lathato(fo.locator('#salonic'), 20000); // szim modban a keret mar a koszonooldalra iranyit (a fo ablak elhagyja a landinget)
    if (MOD === 'valodi') await page.waitForTimeout(5000);
    const fr = page.frames().find((f) => /salonic\.hu\/guestData/.test(f.url()));
    if (MOD === 'valodi') {
      if (!fr) throw new Error('nincs Salonic-keret: ' + page.frames().map((f) => f.url()).join(' | '));
      lepes('Salonic-adatlap betoltve (a beagyazott foglaloban)', { keret: fr.url().slice(0, 110) });
      if (MEGALL) { lepes('megallas (--megall)'); }
      else await adatlap(fr);
    }
  } else {
    // lezer: a landing sajat naptara; az alapertelmezett allapot (Kezelest, honalj) ido-gombja
    await page.locator('#foglalo').scrollIntoViewIfNeeded();
    const ido = await utolsoIdopont(page.locator('#naptar button.naptar-nap'), page.locator('#idok a.ido'), 90000);
    const href = await ido.loc.getAttribute('href');
    lepes('idopont valasztva (az utolso szabad nap utolso idopontja)', { ido: ido.szoveg, href: href.replace(/startDate=\d+/, 'startDate=…') });
    await ido.loc.click();
    if (MOD === 'valodi') {
      await page.waitForURL(/salonic\.hu\/guestData/, { timeout: 45000 });
      lepes('a vendeg a Salonic oldalan', { url: page.url().slice(0, 120) });
      await page.waitForTimeout(4000);
      if (MEGALL) { lepes('megallas (--megall)'); }
      else await adatlap(page.mainFrame());
    }
  }

  if (!MEGALL) {
    // 2) a Salonic atiranyit a koszonooldalra; a fo ablak URL-jere varunk
    // varakozas a koszonooldalra (lekerdezessel: a waitForURL elszall, ha a fo ablak navigacioja kozben megszakad)
    for (const t1 = Date.now(); !U.koszono.test(page.url()) && Date.now() - t1 < 120000;) await page.waitForTimeout(300);
    if (!U.koszono.test(page.url())) throw new Error('a koszonooldal nem erkezett meg: ' + page.url().slice(0, 100));
    lepes('koszonooldal a fo ablakban', { url: page.url().replace(/(bookingUrl=)[^&]+/, '$1…').slice(0, 170) });
    await page.waitForLoadState('load').catch(() => {});
    await page.waitForTimeout(VAR);
    lepes('varakozas vege (az osszes kesobbi meresi keres begyujtve)', { url: page.url().replace(/(bookingUrl=)[^&]+/, '$1…').slice(0, 170) });
    if (VISSZA) {
      fazis = 'vissza';
      lepes('bongeszo "vissza" gomb (history.back)');
      await page.goBack({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch((e) => lepes('goBack hiba', { uzenet: String(e.message).slice(0, 120) }));
      await page.waitForTimeout(12000);
      lepes('vissza utan', { url: page.url().replace(/(bookingUrl=)[^&]+/, '$1…').slice(0, 170) });
    }
  }
} catch (e) {
  lepes('HIBA', { uzenet: String(e.message || e).slice(0, 400) });
}

const sutik = Object.fromEntries((await ctx.cookies()).filter((c) => /^(_fbc|_fbp|_gcl_aw|ttclid|_ttp)/.test(c.name)).map((c) => [c.name, c.value.slice(0, 50)]));
let dataLayer = null;
try { dataLayer = await Promise.race([page.evaluate(() => { const o = {}; for (const e of (window.dataLayer || [])) if (e && e.event) o[e.event] = (o[e.event] || 0) + 1; return o; }), new Promise((ok) => setTimeout(() => ok('NEM-VALASZOL'), 8000))]); } catch (e) { /* az oldal esetleg navigalt */ }
const vegeUrl = page.url().replace(/(bookingUrl=)[^&]+/, '$1…');

// --- osszesites -----------------------------------------------------------------------------------------------------------------
const konverzio = (n) => {
  if (n.plat === 'meta') return n.ev && !/^(PageView|SubscribedButtonClick|Microdata)$/.test(n.ev);
  if (n.plat === 'tiktok') return n.ev && !RUTIN_TT.test(n.ev);
  if (n.plat === 'google-ads') return n.en === 'conversion';
  if ((n.plat === 'ga4' || n.plat === 'stape') && n.capi) return n.ev && n.ev !== 'PageView';
  if (n.plat === 'ga4' || n.plat === 'stape') return n.en && !RUTIN_GA.test(n.en);
  return n.plat === 'zapier';
};
const konv = naplo.filter(konverzio);
const osszesito = {};
for (const k of konv) { const kulcs = `${k.fazis}/${k.plat}${k.capi ? '(capi)' : ''}/mely${k.mely}/${k.ev || k.en || k.ut}`; osszesito[kulcs] = (osszesito[kulcs] || 0) + 1; }
const mind = {};
for (const n of naplo) { const kulcs = `${n.fazis}/${n.plat}${n.capi ? '(capi)' : ''}/mely${n.mely}/${n.ev || (n.esemenyek && n.esemenyek.join('+')) || n.en || n.ut}`; mind[kulcs] = (mind[kulcs] || 0) + 1; }
const tiltott = [...new Set(naplo.filter((n) => n.plat === 'ismeretlen-tiltott').map((n) => `${n.metodus} ${n.host}${n.ut}`))];

fs.writeFileSync(OUT, JSON.stringify({ ut: UT, bazis: BAZIS, mod: MOD, megall: MEGALL, ido: new Date().toISOString(), kattintasAzonositok: CLICK, vegeUrl, sutik, dataLayer, idovonal, elozmeny: hist, konverziok: konv, osszesito, mindenKimeno: mind, tiltottIsmeretlen: tiltott, jegyzettombIras: iras.length, hibak, naplo }, null, 1));
console.log('\n=== KONVERZIOK (fazis/platform/keret-melyseg/esemeny: db) ===');
for (const [k, v] of Object.entries(osszesito).sort()) console.log(' ', v + 'x', k);
console.log('elozmeny-valtasok a koszono fazisban:', hist.filter((h) => h.fazis === 'koszono').map((h) => h.tipus + '@' + h.url.replace(/\?.*/, '')).join(', ') || '(nincs)');
console.log('dataLayer (fo ablak):', JSON.stringify(dataLayer));
console.log('vege:', vegeUrl.slice(0, 120), '| sutik:', JSON.stringify(sutik));
console.log('kesz:', OUT, '| naplozott kimeno kerelmek:', naplo.length, '| tiltott ismeretlen:', JSON.stringify(tiltott));
await browser.close();
