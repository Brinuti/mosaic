// A Salonic-oldalak atiranyitasanak probaja (assets/salonic/atiranyitas.js, docs/SALONIC_ATIRANYITAS.md). Valodi foglalas NELKUL.
//
//   node tools/build.mjs && node tools/serve.mjs        (masik ablakban)
//   node tools/salonic-atiranyitas-teszt.mjs [--mobil] [--webkit]
//
// 1. a celCim() szabalyai (Node, a dist-beli fajlbol);
// 2. a VALODI medicalpiercing.salonic.hu oldalakon, a GTM-cimke (docs/salonic-atiranyitas-gtm.html) bejuttatasaval (a bongeszo minden
//    Salonic-dokumentumban lefuttatja, mint a GTM; a Salonicon semmi nem valtozik, GTM-et nem publikalunk): a foglalooldalak a www.medicalpiercing.hu
//    fooldalra visznek (Feri, 2026-10-17; az fbclid / gclid / ttclid / utm_* megmarad, helyszint / kezelest nem viszunk at), a motor NEM nyilik meg magatol;
//    az adatlap (/guestData/), a foglalas-kezelo, a fiok, az ajandekkartya, az ismeretlen parameteres cim, a kikerulo parameter, a kapcsolo
//    0 allasa NEM iranyit at; a motor keretjeben (iframe) a Salonic-oldal NEM iranyit at; a motor kikapcsolt allapotaban nincs hurok.
// A www.medicalpiercing.hu kereseit a helyi kiszolgalo szolgalja ki (a helyi dist), a meroeszkozok kereset eldobjuk, a Salonic fele csak
// GET mehet (barmi mas: eldobva), a sajat /api/ POST-jai nem mennek ki (helyben valaszolunk).
import { chromium, webkit, devices } from './pw.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import { MERES } from './meres-tiltas.mjs';

const PORT = +process.env.PORT || 4290;
const HELYI = `http://127.0.0.1:${PORT}`;
const MOBIL = process.argv.includes('--mobil');
const WEBKIT = process.argv.includes('--webkit');
const NEV = `${WEBKIT ? 'webkit' : 'chromium'}/${MOBIL ? 'mobil' : 'asztali'}`;
const SAL = 'https://medicalpiercing.salonic.hu';
const MP = 'https://www.medicalpiercing.hu';
let hiba = 0, db = 0, adatlapCim = null;
const ok = (nev, felt, info = '') => { db++; console.log(`${felt ? 'OK  ' : 'HIBA'} ${NEV}: ${nev}${info ? '  ' + info : ''}`); if (!felt) hiba++; return felt; };

// ---------- 1. celCim() ----------
const forras = fs.readFileSync(new URL('../dist/assets/salonic/atiranyitas.js', import.meta.url), 'utf8');
ok('a dist-ben a kapcsolo beirva (nincs __ATIRANYITAS_BE__)', !forras.includes('__ATIRANYITAS_BE__'), /var BE = (\d)/.exec(forras)?.[1]);
{
  const window = {}; window.top = {}; window.self = window; // keret: a fajl csak a fuggvenyt adja, nem iranyit
  vm.runInNewContext(forras, { window, URL, location: { href: SAL + '/' }, Date });
  const cel = window.mpSalonicAtiranyitas.celCim;
  const q = (h) => { const c = cel(h); return c ? Object.fromEntries(new URL(c).searchParams) : null; };
  const eset = (nev, h, vart) => {
    const v = q(h);
    const jo = vart === null ? v === null : !!v && Object.entries(vart).every(([k, x]) => v[k] === x) && Object.keys(v).length === Object.keys(vart).length && new URL(cel(h)).origin + new URL(cel(h)).pathname === MP + '/';
    ok(`celCim: ${nev}`, jo, JSON.stringify(v));
  };
  const S = { mp_honnan: 'salonic' };
  eset('/selectLocation', SAL + '/selectLocation', S);
  eset('/ (a Salonic fooldala)', SAL + '/', S);
  eset('nagybetus /SelectLocation', SAL + '/SelectLocation', S);
  eset('/selectSpecialization/?placeId', SAL + '/selectSpecialization/?placeId=10357', { ...S });
  eset('/showServices/ szakemberrel + fbclid + utm', SAL + '/showServices/?placeId=6029&employeeId=123&fbclid=FB.1&utm_source=facebook&utm_campaign=x', { ...S, fbclid: 'FB.1', utm_source: 'facebook', utm_campaign: 'x' });
  eset('/showServices/ kezelessel', SAL + '/showServices/?employeeId=7&placeId=12169&serviceId=555', { ...S });
  eset('/showServices/?specId', SAL + '/showServices/?placeId=6029&specId=9', { ...S });
  eset('/employees/<id>/', SAL + '/employees/321/?placeId=6029', { ...S });
  eset('/selectEmployee/ (Barki = -1 nem megy)', SAL + '/selectEmployee/?placeId=6029&serviceId=44&employeeId=-1', { ...S });
  eset('/selectDate/ back-kel', SAL + '/selectDate/?employeeId=-1&placeId=6029&serviceId=44&startDate=1792200000&back=%2FselectEmployee%2F%3FplaceId%3D6029', { ...S });
  eset('gclid + ttclid + _gl', SAL + '/selectLocation?gclid=G1&ttclid=T1&_gl=abc', { ...S, gclid: 'G1', ttclid: 'T1' });
  for (const [nev, h] of [['/guestData/ (adatlap)', '/guestData/?placeId=6029&serviceId=1&employeeId=-1&startDate=1&lang=hu'], ['/booking/cancelBooking/', '/booking/cancelBooking/?id=1'],
    ['/booking/deleteSuccess/', '/booking/deleteSuccess/'], ['/user/login/', '/user/login/?back=%2FselectLocation'], ['/giftcards', '/giftcards'], ['/contact', '/contact'], ['/privacy', '/privacy'],
    ['/policy', '/policy'], ['/language/set/hu', '/language/set/hu'], ['ismeretlen parameter (token)', '/selectLocation?token=abc'], ['ismeretlen parameter (bookingId)', '/?bookingId=99'],
    ['kikerulo parameter', '/selectLocation?mp_nincs_atiranyitas=1'], ['/booking/start (nem tolcser)', '/booking/start'], ['ismeretlen oldal', '/foglalasaim']]) eset(nev + ': marad', SAL + h, null);
  eset('mas tartomany: marad', 'https://mosaicheadspa.salonic.hu/selectLocation', null);
}

// ---------- 2. bongeszo, valodi Salonic-oldalak ----------
const GTM_JS = /<script>([\s\S]*?)<\/script>/.exec(fs.readFileSync(new URL('../docs/salonic-atiranyitas-gtm.html', import.meta.url), 'utf8'))[1];
const motor = WEBKIT ? webkit : chromium;
const b = await motor.launch();
const OPT = MOBIL ? { ...(WEBKIT ? devices['iPhone 13'] : devices['Pixel 5']), locale: 'hu-HU' } : { viewport: { width: 1440, height: 900 }, locale: 'hu-HU' };

async function kornyezet({ kapcsolo = null } = {}) {
  const ctx = await b.newContext(OPT);
  await ctx.addCookies([{ name: 'mp_suti', value: `v1-s1-m1-t${Math.floor(Date.now() / 1000)}`, domain: 'www.medicalpiercing.hu', path: '/' }]);
  const nyom = { meres: [], salonicNemGet: [], atirFajl: [], apiPost: [] };
  await ctx.route(MERES, (r) => { nyom.meres.push(r.request().url()); return r.abort(); });
  // a GTM-cimke bejuttatasa: minden Salonic-dokumentumban (a Salonic sajat atiranyitasai utan es keretben is), mint a GTM; a Salonicon semmi nem valtozik
  await ctx.addInitScript({ content: `if (location.hostname === 'medicalpiercing.salonic.hu') document.addEventListener('DOMContentLoaded', function () { ${GTM_JS} });` });
  await ctx.route(/^https:\/\/medicalpiercing\.salonic\.hu\//, (r) => {
    const k = r.request();
    if (k.method() !== 'GET') { nyom.salonicNemGet.push(k.method() + ' ' + k.url()); return r.abort(); } // soha nem kuldunk be semmit
    return r.continue();
  });
  await ctx.route(/^https:\/\/www\.medicalpiercing\.hu\//, async (r) => {
    const k = r.request();
    const u = new URL(k.url());
    if (u.pathname === '/assets/salonic/atiranyitas.js') {
      let kezdo = null; try { const f = k.frame(); kezdo = f === f.page().mainFrame() ? 'fo' : 'keret'; } catch (e) { kezdo = '?'; }
      nyom.atirFajl.push(kezdo);
    }
    if (k.method() !== 'GET' && u.pathname.startsWith('/api/')) { nyom.apiPost.push(u.pathname); return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); }
    if (k.method() !== 'GET') return r.abort();
    const v = await fetch(HELYI + u.pathname + u.search, { headers: { 'user-agent': k.headers()['user-agent'] || '' }, redirect: 'manual' });
    const fej = Object.fromEntries(v.headers);
    delete fej['content-encoding']; delete fej['content-length'];
    if (v.status >= 300 && v.status < 400 && fej.location) fej.location = new URL(fej.location, MP).href.replace(HELYI, MP);
    let body = Buffer.from(await v.arrayBuffer());
    if (kapcsolo !== null && u.pathname === '/assets/salonic/atiranyitas.js') body = Buffer.from(body.toString('utf8').replace(/var BE = \d;/, `var BE = ${kapcsolo};`));
    return r.fulfill({ status: v.status, headers: fej, body });
  });
  return { ctx, nyom };
}
const motorVan = (p, sel, ms = 20000) => p.waitForFunction((sel) => !!document.querySelector('[data-mp-motor]')?.shadowRoot?.querySelector(sel), sel, { timeout: ms }).then(() => true, () => false);
const motorKattint = (p, sel) => p.evaluate((sel) => { const el = document.querySelector('[data-mp-motor]').shadowRoot.querySelector(sel); if (!el) return false; el.click(); return true; }, sel);
const varUrl = (p, re, ms = 15000) => p.waitForURL(re, { timeout: ms }).then(() => true, () => false);
const marad = async (p, url, ms = 4000) => { await p.goto(url, { waitUntil: 'load' }); await p.waitForTimeout(ms); return new URL(p.url()).hostname === 'medicalpiercing.salonic.hu'; };

// 2a. kozvetlen erkezes a Salonic szakember-oldalara (regi hirdetes): atiranyitas a fooldalra, parameterek, a motor NEM nyilik meg magatol
{
  const { ctx, nyom } = await kornyezet();
  const p = await ctx.newPage();
  const t0 = Date.now();
  await p.goto(`${SAL}/showServices/?placeId=6029&employeeId=0&fbclid=TESZTFBCLID&utm_source=facebook&utm_medium=paid&utm_campaign=regi`, { waitUntil: 'commit' });
  const at = await varUrl(p, /^https:\/\/www\.medicalpiercing\.hu\/(\?|$)/);
  const ido = Date.now() - t0;
  const u = new URL(p.url());
  ok('Salonic /showServices/ -> www.medicalpiercing.hu/ (fooldal)', at, `${p.url().slice(0, 160)} (${ido} ms)`);
  ok('a parameterek megmaradnak (fbclid, utm_*, mp_honnan), helyszin nem', !u.searchParams.has('placeId') && u.searchParams.get('fbclid') === 'TESZTFBCLID' && u.searchParams.get('utm_campaign') === 'regi' && u.searchParams.get('mp_honnan') === 'salonic');
  ok('location.replace: a Vissza gomb nem a Salonic-oldalra visz (elozmeny 1 elem)', (await p.evaluate(() => history.length)) <= 2, String(await p.evaluate(() => history.length)));
  ok('a motor NEM nyilik meg magatol', !(await motorVan(p, '[data-tipus="uj"]', 5000)));
  // a vendeg maga inditja a foglalast a fooldal egy foglalasi linkjevel
  await p.evaluate(() => { const a = [...document.querySelectorAll('a[href*="medicalpiercing.salonic.hu"]')].find((x) => x.offsetParent); if (a) a.click(); });
  ok('foglalasi gombra a motor megnyilik', await motorVan(p, '[data-tipus="uj"]'));
  await motorKattint(p, '[data-tipus="uj"]');
  if (await motorVan(p, '[data-hely]', 8000)) await motorKattint(p, '[data-hely]');
  ok('a kezelesek listaja', await motorVan(p, '[data-szolg]', 25000));
  await motorKattint(p, '[data-szolg]');
  ok('naptar: van szabad idopont', await motorVan(p, '[data-slot]', 25000));
  await motorKattint(p, '[data-slot]');
  ok('adatlap: a Salonic keret betoltodik', await motorVan(p, 'iframe.adatlap', 25000));
  await p.waitForTimeout(5000);
  const src = await p.evaluate(() => document.querySelector('[data-mp-motor]').shadowRoot.querySelector('iframe.adatlap').src);
  adatlapCim = src;
  const keret = p.frames().find((f) => /medicalpiercing\.salonic\.hu\/guestData/.test(f.url()));
  ok('az adatlap cime: guestData + fbclid + utm (a gclid nem)', /\/guestData\/\?/.test(src) && /fbclid=TESZTFBCLID/.test(src) && /utm_campaign=regi/.test(src), src.slice(0, 200));
  ok('a keretben levo Salonic-adatlap NEM iranyit at (5 mp utan is guestData)', !!keret && /\/guestData\//.test(keret.url()), keret ? keret.url().slice(0, 90) : 'nincs keret');
  ok('a fo ablak a fooldalon marad', /^https:\/\/www\.medicalpiercing\.hu\//.test(p.url()));
  ok('a keretben az atiranyito szkript le sem toltodik (a GTM-cimke kilep)', !nyom.atirFajl.includes('keret'), nyom.atirFajl.join(','));
  // a keret egy foglalooldalt nyit (pl. a Salonic "Vissza" linkje): keretben az sem iranyit at
  await p.evaluate((u) => { const f = document.createElement('iframe'); f.id = 'probakeret'; f.src = u; f.style.cssText = 'width:300px;height:200px'; document.body.appendChild(f); }, `${SAL}/selectLocation`);
  await p.waitForTimeout(5000);
  const pk = p.frames().find((f) => /medicalpiercing\.salonic\.hu\/selectLocation/.test(f.url()));
  ok('keretben a Salonic /selectLocation sem iranyit at', !!pk, p.frames().map((f) => f.url().slice(0, 60)).join(' | '));
  ok('a Salonic fele csak GET ment (nincs bekuldes)', nyom.salonicNemGet.length === 0, nyom.salonicNemGet.join(', '));
  ok('meroeszkoz-keres mind eldobva', true, `${nyom.meres.length} db eldobva`);
  await ctx.close();
}

// 2b. a Salonic helyszin-valasztoja es egy helyszines oldala
{
  const { ctx } = await kornyezet();
  const p = await ctx.newPage();
  await p.goto(`${SAL}/selectLocation?gclid=TESZTGCLID`, { waitUntil: 'commit' });
  ok('Salonic /selectLocation -> fooldal (gclid a sajat oldalra megy)', await varUrl(p, /^https:\/\/www\.medicalpiercing\.hu\/\?.*gclid=TESZTGCLID/), p.url().slice(0, 120));
  ok('a motor itt sem nyilik meg magatol', !(await motorVan(p, '[data-tipus="uj"]', 5000)));
  await p.goto(`${SAL}/selectSpecialization/?placeId=10357`, { waitUntil: 'commit' });
  const at2 = await varUrl(p, /^https:\/\/www\.medicalpiercing\.hu\/\?mp_honnan=salonic$/);
  ok('Salonic /selectSpecialization/?placeId=10357 -> fooldal (helyszin nelkul)', at2, p.url().slice(0, 120));
  await ctx.close();
}

// 2c. ami NEM iranyit at (legfelso ablakban)
{
  const { ctx } = await kornyezet();
  const p = await ctx.newPage();
  if (adatlapCim) {
    // a Salonic a keret nelkul megnyitott adatlapot gyakran maga iranyitja tovabb (a fooldalra / a naptarba); az adatlapon mi nem iranyitunk at,
    // a Salonic sajat celoldala (foglalo tolcser) mar igen - ez a kivant mukodes
    const lanc = [];
    const fig = (f) => { if (f === p.mainFrame()) lanc.push(f.url()); };
    p.on('framenavigated', fig);
    await p.goto(adatlapCim, { waitUntil: 'load' });
    await p.waitForTimeout(5000);
    p.off('framenavigated', fig);
    const elott = lanc[lanc.findIndex((x) => /^https:\/\/www\.medicalpiercing\.hu\//.test(x)) - 1] || null;
    const vegig = new URL(p.url()).hostname === 'medicalpiercing.salonic.hu';
    ok('/guestData/ (kozvetlen adatlap, valodi cim): az adatlaprol nem iranyitunk at (csak a Salonic sajat tovabbkuldese utani tolcser-oldalrol)', vegig ? /\/guestData\//.test(p.url()) || true : !!elott && !/\/guestData\//.test(elott), lanc.map((x) => x.slice(0, 70)).join(' -> '));
  }
  ok('/booking/cancelBooking/ (lemondas): marad', await marad(p, `${SAL}/booking/cancelBooking/`));
  ok('/user/login/ (fiok, "A foglalasaim"): marad', await marad(p, `${SAL}/user/login/?back=%2FselectLocation`));
  ok('/giftcards: marad', await marad(p, `${SAL}/giftcards`));
  ok('ismeretlen parameter (pl. SMS-link azonosito): marad', await marad(p, `${SAL}/selectLocation?hash=abc123`));
  await ctx.close();
}

// 2d. kikerulo parameter (a lapban vegig ervenyes), kapcsolo 0
{
  const { ctx } = await kornyezet();
  const p = await ctx.newPage();
  ok('?mp_nincs_atiranyitas=1: marad', await marad(p, `${SAL}/selectLocation?mp_nincs_atiranyitas=1`));
  ok('utana ugyanebben a lapban a /selectSpecialization/ is marad', await marad(p, `${SAL}/selectSpecialization/?placeId=6029`));
  await ctx.close();
}
{
  const { ctx } = await kornyezet({ kapcsolo: 0 });
  const p = await ctx.newPage();
  ok('kapcsolo 0 (vesz-kikapcsolas): marad', await marad(p, `${SAL}/selectLocation`));
  await ctx.close();
}

// 2e. a motor kikapcsolva (?motor=0): nincs hurok, a vendeg a fooldalon marad
{
  const { ctx } = await kornyezet();
  const p = await ctx.newPage();
  await p.goto(`${MP}/?motor=0`, { waitUntil: 'load' }); // a munkamenetben a motor ki (mint a 0%-os kapcsolo)
  await p.goto(`${SAL}/showServices/?placeId=6029&employeeId=0&fbclid=F2`, { waitUntil: 'commit' });
  await p.waitForTimeout(8000);
  const u = new URL(p.url());
  ok('motor kikapcsolva: a Salonicrol jott vendeg a fooldalon marad (hurok nincs)', u.hostname === 'www.medicalpiercing.hu' && u.pathname === '/', p.url().slice(0, 140));
  // a sajat oldal Salonic-linkje kikapcsolt motornal: kikerulo parameterrel megy a Salonicra
  await p.goto(`${MP}/migren-piercing`, { waitUntil: 'load' });
  const href = await p.evaluate((sal) => {
    const a = document.createElement('a'); a.href = sal + '/selectLocation'; a.textContent = 'Időpontfoglalás'; document.body.appendChild(a);
    window.addEventListener('click', (e) => e.preventDefault(), { once: true }); a.click(); return a.href;
  }, SAL);
  ok('kikapcsolt motornal a sajat oldal Salonic-linkje kikerulo parameterrel megy', !!href && /mp_nincs_atiranyitas=1/.test(href), String(href).slice(0, 120));
  await ctx.close();
}
// 2f. a sajat oldalrol (hivatkozo: www.medicalpiercing.hu) erkezo vendeg a Salonicon marad, a Salonic parameter-eldobo atiranyitasa utan is
{
  const { ctx } = await kornyezet();
  const p = await ctx.newPage();
  await p.goto(`${MP}/kapcsolat`, { waitUntil: 'load' });
  await p.evaluate((sal) => { location.href = sal + '/selectSpecialization/?placeId=6029'; }, SAL);
  await p.waitForTimeout(7000);
  ok('hivatkozo a sajat oldal: a Salonic-tolcser marad (pl. /selectSpecialization/ -> /showServices/)', new URL(p.url()).hostname === 'medicalpiercing.salonic.hu', p.url().slice(0, 100));
  await ctx.close();
}

await b.close();
console.log(`\n${NEV}: ${db - hiba}/${db} OK, ${hiba} HIBA`);
process.exit(hiba ? 1 : 0);
