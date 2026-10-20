// 7 NAPOS UTOLSO FIZETETT KATTINTAS - bongeszos E2E uzletagankent (docs/booking-engine/FORRAS_LPT.md). SZINTETIKUS azonositok, VALODI Salonic-foglalas NELKUL, vendegadat nelkul.
//
// Lepesek (uzletag x platform; a "Safari 7 napos JS-tarolo-vagas" szimulalasa):
//   1. landing ?gclid=<szintetikus>&utm_source=google&utm_medium=cpc&utm_campaign=<szam> (Meta: ?fbclid=.. + utm_source=meta&utm_medium=paid_social + utm_id / ad_id; TikTok: ?ttclid=..)
//      -> POST /api/mosaic-forras -> Set-Cookie mh_lpt (HttpOnly, Secure, SameSite=Lax, ~30 nap); JS-bol NEM olvashato; a tarolokban nincs nyers azonosito
//   2. sessionStorage + localStorage torlese (a Safari-vagas); a suti marad
//   3. kozvetlen visszateres (nincs parameter / hivatkozo) a foglalo oldalara: a sutibol visszanyert azonosito (GET) + a foglalo-atadas (engine.js / foglalo-pmu.js mhKeretbenOldal, ?atadas=1)
//      a koszonooldal URL-jebe fuzi (a koszonooldal az ELONEZETI oldalunk: az eles domainre SOHA nem navigalunk, valodi foglalas nincs)
//   4. a koszonooldali jelzes (assets/js/foglalas-kulcs.js -> mhAttribucio.kuld) szintetikus mb_... foglalas-azonositoval (mint a qa2 / qa4 probak)
//   5. ellenorzes: mhAttribucioEredmeny.valasz.forras = { cimke, bizonyitek_forras: 'suti', klikk_potolt (a platform azonositoja), kesei_fizetett: false }; a kuldott torzsben nincs nyers azonosito
//   6. organikus visszateres NEM ir felul (a suti valtozatlan); ujabb fizetett kattintas felulir; kifejezett elutasitas torli a sutit (es nem potol)
//
//   node tools/meres-proba/lpt-e2e.mjs --bazis https://<ag>.mosaic-d77.pages.dev [--uzletag headspa|hair|laser|oxygen|pmu|mind] [--platform google|meta|tiktok|mind] [--mobil 1] [--ki naplo.json]
//   BAZIS=https://<ag>.mosaic-d77.pages.dev node tools/meres-proba/lpt-e2e.mjs
//   node tools/meres-proba/lpt-e2e.mjs --lokalis [--dist dist]        helyi kiprobalas: a dist/-et + a VALODI vegpont-kodot (functions/api/*) szolgalja ki, memoria-D1-gyel (a node tools/netlify-build.mjs utan)
// NE futtasd az eles domainen: a --bazis csak PR-elonezet (*.mosaic-d77.pages.dev) vagy a --lokalis szerver lehet. Az elonezeti D1-be szintetikus meres_erkezes / meres_forras / foglalas_kulcs sor kerul (mb_lpte2e...).
// A kimeno meres (GA4, Meta, TikTok, Google Ads, Stape, Zapier) tiltott (tilt.mjs); a Salonic csak olvasas (naptar-API), foglalas nem jon letre.
// Kornyezet: PLAYWRIGHT_UTVONAL (a playwright-core szulomappaja), CHROME_UTVONAL.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { UA, UA_MOBIL, platformOf, engedett, dnsArg, ures, esemenyIras, esemenyUres } from './tilt.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const flag = (k) => process.argv.includes('--' + k);
const GYOKER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LOKALIS = flag('lokalis');
const BAZIS_ARG = (arg('bazis', '') || process.env.BAZIS || '').replace(/\/+$/, '');
const UZLETAG = arg('uzletag', 'mind'), PLATFORM = arg('platform', 'mind'), MOBIL = arg('mobil', '0') === '1', KI = arg('ki', '');
const DIST = path.resolve(GYOKER, arg('dist', 'dist'));
if (!LOKALIS && !/^https:\/\/[a-z0-9-]+\.mosaic-d77\.pages\.dev$/.test(BAZIS_ARG)) { console.error('csak PR-elonezeten fut: --bazis https://<ag>.mosaic-d77.pages.dev (vagy BAZIS=...), vagy --lokalis. Az eles domain TILOS.'); process.exit(2); }
const PW = [process.env.PLAYWRIGHT_UTVONAL, '/opt/node-tools/node_modules', path.join(GYOKER, 'node_modules'), '/opt/node22/lib/node_modules/playwright/node_modules'].filter(Boolean);
const playwright = () => { for (const k of PW) { try { return createRequire(path.join(k, 'x.js'))('playwright-core'); } catch (e) { /* kovetkezo */ } } throw new Error('playwright-core nem talalhato (PLAYWRIGHT_UTVONAL)'); };
const { chromium } = playwright();
const CHROME = process.env.CHROME_UTVONAL || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

// ---------- uzletagak ----------
// landing: a hirdetes erkezesi oldala; motor: a foglalo oldala (a foglalo-atadas ott fut); koszono: a Salonic atiranyitasanak celja (ELONEZETI oldal); host: a Salonic-fiok (foglalas-kulcs.js UZLETAG-terkep); szerver: a meres_forras.uzletag
const UZLETAGOK = {
  headspa: { landing: '/headspa-budapest', motor: '/foglalo-motor?business=headspa', koszono: '/foglalas-ok', host: 'mosaicheadspa.salonic.hu', szerver: 'headspa' },
  hair: { landing: '/noi-fodraszat-budapest', motor: '/foglalo-motor?business=hair', koszono: '/fodrasz-ok', host: 'mosaic-hair.salonic.hu', szerver: 'fodrasz' },
  laser: { landing: '/lezeres-szortelenites-budapest', motor: '/foglalo-motor?business=laser', koszono: '/elysion-ok', host: 'mosaic-elysion.salonic.hu', szerver: 'szor' },
  oxygen: { landing: '/oxigenterapia-budapest', motor: '/foglalo-motor?business=oxygen', koszono: '/oxigenterapia-ok', host: 'mosaic-oxigen.salonic.hu', szerver: 'oxigen' },
  pmu: { landing: '/sminktetovalas-budapest', motor: '/foglalo-pmu', koszono: '/pmu-ok', host: 'mosaic-pmu.salonic.hu', szerver: 'pmu', pmu: true },
};
const PLATFORMOK = { google: { kp: 'gclid', cimkek: ['google_nem_markas', 'google_markas'] }, meta: { kp: 'fbclid', cimkek: ['meta'] }, tiktok: { kp: 'ttclid', cimkek: ['tiktok'] } };
const uzletagok = UZLETAG === 'mind' ? Object.keys(UZLETAGOK) : UZLETAG.split(',');
const platformok = PLATFORM === 'mind' ? Object.keys(PLATFORMOK) : PLATFORM.split(',');
for (const u of uzletagok) if (!UZLETAGOK[u]) { console.error('ismeretlen uzletag: ' + u); process.exit(2); }
for (const p of platformok) if (!PLATFORMOK[p]) { console.error('ismeretlen platform: ' + p); process.exit(2); }

// ---------- helyi szerver (--lokalis): dist + a VALODI vegpont-kod, memoria-D1-gyel ----------
let lokalis = null;
async function lokalisSzerver() {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  const kot = (sql, args = []) => ({
    run: async () => { const r = db.prepare(sql).run(...args); return { success: true, meta: { changes: Number(r.changes) } }; },
    first: async () => db.prepare(sql).get(...args) || null,
    all: async () => ({ results: db.prepare(sql).all(...args).map((r) => ({ ...r })) }),
  });
  const KULCS_DB = { prepare: (sql) => ({ bind: (...a) => kot(sql, a), ...kot(sql, []) }), batch: async (s) => { for (const x of s) await x.run(); } };
  const imp = (p) => import(pathToFileURL(path.join(GYOKER, p)).href);
  const forras = await imp('functions/api/mosaic-forras.js'), erkezes = await imp('functions/api/meres-erkezes.js');
  const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
  const env = { KULCS_DB };
  const szerver = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x'); const p = decodeURIComponent(u.pathname);
    if (p.startsWith('/api/')) {
      const chunks = []; for await (const c of req) chunks.push(c);
      const szoveg = Buffer.concat(chunks).toString();
      const nev = p.replace('/api/', '');
      if (nev === 'mosaic-forras' || nev === 'meres-erkezes') {
        const request = new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers: Object.fromEntries(Object.entries(req.headers).filter(([k]) => !['host', 'connection', 'content-length'].includes(k)).map(([k, v]) => [k, String(v)])), ...(req.method !== 'GET' && req.method !== 'HEAD' ? { body: szoveg } : {}) });
        const r = await (nev === 'mosaic-forras' ? forras : erkezes).onRequest({ request, env });
        const fejlec = {}; r.headers.forEach((v, k) => { fejlec[k] = v; }); const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : []; if (sc.length) fejlec['set-cookie'] = sc;
        res.writeHead(r.status, fejlec); return res.end(await r.text());
      }
      res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{"ok":true,"irva":false,"proba":"lokalis"}'); // foglalas-kulcs / szamlalo / jegyzettomb: a helyi probaban nem irunk
    }
    for (const j of [p, p + '.html', '/_a' + p + '.html', '/_a' + (p === '/' ? '/index' : p) + '.html', path.posix.join(p, 'index.html')]) {
      const f = path.join(DIST, j);
      if (f.startsWith(DIST) && fs.existsSync(f) && fs.statSync(f).isFile()) { res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); return fs.createReadStream(f).pipe(res); }
    }
    res.writeHead(404, { 'content-type': 'text/plain' }); res.end('nincs');
  });
  await new Promise((ok) => szerver.listen(0, '127.0.0.1', ok));
  return { szerver, db, bazis: `http://127.0.0.1:${szerver.address().port}` };
}
if (LOKALIS) { if (!fs.existsSync(path.join(DIST, '_a'))) { console.error('nincs dist/ (node tools/netlify-build.mjs)'); process.exit(2); } lokalis = await lokalisSzerver(); }
const BAZIS = LOKALIS ? lokalis.bazis : BAZIS_ARG;
const BAZIS_HOST = new URL(BAZIS).host;

// ---------- segedek ----------
const eredmenyek = [];
const ok = (cimke, rendben, reszlet = '') => { eredmenyek.push({ cimke, rendben: !!rendben, reszlet: reszlet === undefined ? '' : String(reszlet).slice(0, 300) }); console.log(`${rendben ? 'OK  ' : 'HIBA'} ${cimke}${reszlet !== '' && reszlet !== undefined ? ' | ' + String(reszlet).slice(0, 220) : ''}`); };
const veletlen = () => Math.random().toString(36).slice(2, 10).replace(/[^a-z0-9]/g, 'x').padEnd(8, 'x');
const KOD = Date.now().toString(36).toUpperCase();
function parameterek(platform, uz) { // szintetikus, formailag ervenyes azonositok (TESZT-jelolessel)
  const s = `${KOD}_${uz}`.toUpperCase().replace(/[^A-Z0-9_]/g, '');
  if (platform === 'google') return { id: `Cj0KCQjw_LPTE2E_${s}_GCLID`, query: (id) => `gclid=${id}&utm_source=google&utm_medium=cpc&utm_campaign=${Math.floor(Math.random() * 9e9 + 1e9)}&gad_campaignid=2345678901&adgroupid=3456789012&adid=456789012` };
  if (platform === 'meta') return { id: `IwAR_LPTE2E_${s}_FBCLID`, query: (id) => `fbclid=${id}&utm_source=meta&utm_medium=paid_social&utm_campaign=${encodeURIComponent('LPT E2E teszt | ' + uz)}&utm_term=csoport&utm_content=hirdetes&utm_id=23850123456&ad_id=6001234567` };
  return { id: `E.C.P.LPTE2E_${s}_TTCLID`, query: (id) => `ttclid=${id}&utm_source=tiktok&utm_medium=paid_social&utm_campaign=lpt_e2e_${uz}` };
}
const koszonoHref = (uz, bid) => {
  const U = UZLETAGOK[uz];
  const bu = `https://${U.host}/guestData/?anyone=true&employeeId=25095&placeId=10823&serviceId=232804&startDate=${Math.floor(Date.now() / 1000) + 5 * 86400}&back=${bid}`;
  return `${BAZIS}${U.koszono}?first_booking=true&service=${encodeURIComponent('LPT E2E proba')}&price=0&location=Mosaic&employee=Teszt&g=g:1&bookingUrl=${encodeURIComponent(bu)}`;
};

async function ujKontextus(bongeszo, hozzajarulas = 'granted') {
  const ctx = await bongeszo.newContext({ userAgent: MOBIL ? UA_MOBIL : UA, viewport: MOBIL ? { width: 390, height: 844 } : { width: 1280, height: 900 }, locale: 'hu-HU', timezoneId: 'Europe/Budapest', serviceWorkers: 'block', ignoreHTTPSErrors: !LOKALIS });
  const naplo = { tiltott: [], mer: [], api: [], navigaciok: [] };
  await ctx.route('**/*', async (route) => {
    const req = route.request(), url = req.url(); let u; try { u = new URL(url); } catch (e) { return route.continue(); }
    if (u.host === BAZIS_HOST) {
      if (/^\/api\//.test(u.pathname)) {
        naplo.api.push({ ut: u.pathname + u.search, metodus: req.method(), torzs: req.postData() ? String(req.postData()).slice(0, 3000) : null });
        if (/^\/api\/(foglalas-esemeny|foglalo-szamlalo)/.test(u.pathname) && req.method() !== 'GET') return route.fulfill(esemenyUres()); // a probak nem irnak a jegyzettombbe / tolcser-szamlaloba
      }
      return route.continue();
    }
    if (/^(www\.)?mosaicheadspa\.hu$/.test(u.hostname) && req.resourceType() === 'document') { naplo.tiltott.push('ELES-NAVIGACIO ' + url); return route.abort('blockedbyclient'); } // az eles domainre SOHA
    const plat = platformOf(url); if (plat) { naplo.mer.push({ plat, host: u.host }); return route.fulfill(ures(req)); }
    if (LOKALIS && /salonic\.hu$/.test(u.hostname)) return route.abort('blockedbyclient'); // helyi probaban nincs halozat
    if (!engedett(url, req.method())) { naplo.tiltott.push(req.method() + ' ' + u.host); return route.abort('blockedbyclient'); }
    return route.continue();
  });
  await ctx.addInitScript((hozz) => { try { if (hozz === 'granted' && !localStorage.getItem('mh_cc')) localStorage.setItem('mh_cc', JSON.stringify({ v: 1, t: Date.now(), fun: true, ana: true, adv: true })); } catch (e) { /* nem baj */ } }, hozzajarulas);
  return { ctx, naplo };
}
const sutiNyers = async (ctx) => (await ctx.cookies()).find((c) => c.name === 'mh_lpt') || null; // (a cookies(url) szuro a Secure sutit http:// cimen kihagyja: helyi probanal is jo)
const var_ = (lap, fv, arg, ido = 20000) => lap.waitForFunction(fv, arg, { timeout: ido });
const eredmenyVar = (lap) => var_(lap, () => window.mhAttribucioEredmeny && typeof window.mhAttribucioEredmeny.status === 'number', null, 25000);

async function egyEset(bongeszo, uz, platform) {
  const U = UZLETAGOK[uz], P = PLATFORMOK[platform], cim = `[${uz}/${platform}]`;
  const { id, query } = parameterek(platform, uz);
  const bid = 'mb_lpte2e' + veletlen() + veletlen();
  const { ctx, naplo } = await ujKontextus(bongeszo);
  const lap = await ctx.newPage(); const hibak = []; lap.on('pageerror', (e) => hibak.push(String(e.message || e).slice(0, 160)));
  try {
    // 1. landing fizetett erkezes -> suti
    const poszt = lap.waitForResponse((r) => /\/api\/mosaic-forras$/.test(r.url()) && r.request().method() === 'POST', { timeout: 30000 });
    await lap.goto(`${BAZIS}${U.landing}?${query(id)}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const r1 = await poszt.catch(() => null);
    ok(`${cim} 1. fizetett erkezes: POST /api/mosaic-forras 200`, r1 && r1.status() === 200, r1 && r1.status());
    const fej = r1 ? (await r1.allHeaders())['set-cookie'] || '' : '';
    ok(`${cim} 1. Set-Cookie: mh_lpt; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax`, /^mh_lpt=[A-Za-z0-9_-]+; Max-Age=2592000; Path=\/; HttpOnly; Secure; SameSite=Lax$/.test(fej), fej.slice(0, 40) + '...');
    let c1 = await sutiNyers(ctx);
    ok(`${cim} 1. a suti a bongeszoben: HttpOnly, Secure, SameSite=Lax, ~30 nap`, c1 && c1.httpOnly && c1.secure && c1.sameSite === 'Lax' && Math.abs((c1.expires - Date.now() / 1000) - 2592000) < 600, c1 && JSON.stringify({ httpOnly: c1.httpOnly, secure: c1.secure, sameSite: c1.sameSite, nap: Math.round((c1.expires - Date.now() / 1000) / 86400) }));
    ok(`${cim} 1. JS-bol (document.cookie) nem olvashato`, !(await lap.evaluate(() => document.cookie)).includes('mh_lpt'));
    const tarolo = await lap.evaluate(() => JSON.stringify({ ss: Object.fromEntries(Object.entries(sessionStorage).filter(([k]) => /^mh_(forras|lpt)/.test(k))), ls: Object.fromEntries(Object.entries(localStorage).filter(([k]) => /^mh_forras/.test(k))) }));
    ok(`${cim} 1. a munkamenet / latogatas-tarolo tisztitott erintest tarol, nyers azonosito nelkul`, /"mh_forras"/.test(tarolo) && /"mh_forras_l"/.test(tarolo) && !tarolo.includes(id), tarolo.slice(0, 200));
    const poszTorzs = naplo.api.find((a) => a.metodus === 'POST' && /mosaic-forras/.test(a.ut));
    ok(`${cim} 1. az azonositot CSAK a sutit iro POST viszi (kv), hozzajarulassal`, poszTorzs && poszTorzs.torzs.includes(id) && /"adv":true/.test(poszTorzs.torzs), poszTorzs && poszTorzs.torzs.slice(0, 160));
    // 2. Safari-vagas: a JS-tarolok torlese, a suti marad
    await lap.evaluate(() => { sessionStorage.clear(); localStorage.clear(); });
    const c2 = await sutiNyers(ctx); ok(`${cim} 2. a tarolok torlese utan a suti megvan`, c2 && c2.value === c1.value);
    // 3. kozvetlen visszateres a foglalo oldalara (nincs parameter, nincs hivatkozo): visszanyeres + atadas
    await lap.goto(`${BAZIS}${U.motor}${U.motor.includes('?') ? '&' : '?'}atadas=1`, { waitUntil: 'domcontentloaded', timeout: 60000 }); // atadas=1: az elonezeten is atad a koszonooldalnak (a sajat oldalunkra: a href az elonezeti origin)
    await var_(lap, () => !!window.mhAttribucio && typeof window.mhKeretbenOldal === 'function', null, 40000).catch(() => {});
    const vissza = await lap.evaluate(async () => (window.mhAttribucio ? JSON.parse(JSON.stringify(await window.mhAttribucio.lptKlikkVar())) : null));
    ok(`${cim} 3. GET /api/mosaic-forras: a sutibol visszanyert azonosito (a tarolok ures)`, vissza && vissza[P.kp] === id && Object.keys(vissza).length === 1, vissza && Object.keys(vissza).join(','));
    const reszl = await lap.evaluate(() => JSON.parse(JSON.stringify(window.mhAttribucio.klikkReszletes())));
    ok(`${cim} 3. klikkReszletes: a sutibol potolt kulcs = ${P.kp}`, reszl.ids[P.kp] === id && reszl.lpt.includes(P.kp), JSON.stringify(reszl.lpt));
    const getKeres = naplo.api.filter((a) => a.metodus === 'GET' && /mosaic-forras/.test(a.ut)); ok(`${cim} 3. a lekeres egyszer megy (memoria)`, getKeres.length === 1, getKeres.length);
    const mkv = await lap.evaluate(() => typeof window.mhKeretbenOldal);
    ok(`${cim} 3. a foglalo atiranyitasi kapuja (mhKeretbenOldal) elerheto`, mkv === 'function', mkv);
    // 4. a Salonic atiranyitasanak szimulacioja a SAJAT (elonezeti / helyi) koszonooldalra; a foglalo-atadas fuzi az azonositot az URL-hez
    const href = koszonoHref(uz, bid);
    const nav = lap.waitForURL((u) => u.pathname === U.koszono, { timeout: 40000 }).catch(() => null);
    await lap.evaluate((h) => window.mhKeretbenOldal(h), href);
    const navEredmeny = await nav;
    const vegso = new URL(lap.url());
    ok(`${cim} 4. a foglalo-atadas a koszonooldalra navigalt (${U.koszono}), az ELONEZETI oldalunkra`, navEredmeny !== null && vegso.pathname === U.koszono && vegso.host === BAZIS_HOST, lap.url().slice(0, 120));
    ok(`${cim} 4. a koszonooldal URL-je tartalmazza a visszanyert ${P.kp}-t`, vegso.searchParams.get(P.kp) === id, [...vegso.searchParams.keys()].join(','));
    ok(`${cim} 4. a tobbi parameter (bookingUrl, first_booking, ...) valtozatlan`, vegso.searchParams.get('bookingUrl') && vegso.searchParams.get('bookingUrl').includes('back=' + bid) && vegso.searchParams.get('first_booking') === 'true', '');
    // 5. a koszonooldali jelzes
    await eredmenyVar(lap);
    const er = await lap.evaluate(() => JSON.parse(JSON.stringify({ allapot: window.mhAttribucioEredmeny.allapot, status: window.mhAttribucioEredmeny.status, valasz: window.mhAttribucioEredmeny.valasz, kuldott: window.mhAttribucioEredmeny.kuldott })));
    ok(`${cim} 5. a koszonooldali jelzes (POST /api/meres-erkezes) 200, ok:true`, er.status === 200 && er.valasz && er.valasz.ok === true, `${er.status} ${JSON.stringify(er.valasz).slice(0, 120)}`);
    const f = er.valasz && er.valasz.forras;
    ok(`${cim} 5. forras.cimke = ${P.cimkek.join(' | ')}`, f && P.cimkek.includes(f.cimke), f && f.cimke);
    ok(`${cim} 5. forras.bizonyitek_forras = 'suti'`, f && f.bizonyitek_forras === 'suti', f && f.bizonyitek_forras);
    ok(`${cim} 5. forras.klikk_potolt tartalmazza: ${P.kp}`, f && typeof f.klikk_potolt === 'string' && f.klikk_potolt.split(',').includes(P.kp), f && f.klikk_potolt);
    ok(`${cim} 5. forras.kesei_fizetett = false`, f && f.kesei_fizetett === false);
    const kt = er.kuldott || {};
    ok(`${cim} 5. a kuldott torzs: forras_tarolo + lpt_potlas; a forras-jelzesben nincs nyers azonosito`, kt.forras_tarolo && Array.isArray(kt.lpt_potlas) && kt.lpt_potlas.includes(P.kp) && !JSON.stringify(kt.forras || {}).includes(id), JSON.stringify({ tarolo: kt.forras_tarolo, potlas: kt.lpt_potlas }));
    ok(`${cim} 5. uzletag a koszonooldalon: ${U.szerver} (a Salonic-host szerint)`, kt.uzletag === U.szerver, kt.uzletag);
    // F2: a sutibol potolt azonosito idobelyege a suti VALODI kattintasi ideje (nem a koszonooldal betoltese): a shadow-lanc fbc / ts ideje
    const sutiT = JSON.parse(Buffer.from(c1.value, 'base64url').toString()).t;
    const attrTs = P.kp === 'fbclid' ? kt.attr && kt.attr.meta && kt.attr.meta.ts : P.kp === 'ttclid' ? kt.attr && kt.attr.tiktok && kt.attr.tiktok.ttclid && kt.attr.tiktok.ttclid.ts : kt.attr && kt.attr.google && kt.attr.google.gclid && kt.attr.google.gclid.ts;
    ok(`${cim} 5. a kuldott attr ts-e a suti kattintasi ideje (nem a foglalas / a betoltes ideje)`, attrTs === sutiT, `attr.ts=${attrTs} suti.t=${sutiT}`);
    ok(`${cim} 5. a kuldott torzs forras_adv = true (a hatalyos marketing-allapot), a hozz (nyers mh_cc) mellette`, kt.forras_adv === true && typeof kt.hozz === 'object', JSON.stringify({ forras_adv: kt.forras_adv, hozz: kt.hozz }));
    ok(`${cim} 5. a koszonooldal NEM hozott uj fizetett erintest (a visszanyert azonosito az URL-ben nem "uj kattintas")`, await lap.evaluate(() => { try { const o = JSON.parse(sessionStorage.getItem('mh_forras') || 'null'); return !o || !o.kp; } catch (e) { return true; } }));
    if (LOKALIS) {
      const sor = lokalis.db.prepare('SELECT * FROM meres_forras WHERE source_id = ?').get(bid);
      ok(`${cim} 5. [helyi D1] meres_forras sor: suti, kor_nap, nyers azonosito nelkul`, sor && sor.bizonyitek_forras === 'suti' && sor.uzletag === U.szerver && !JSON.stringify(sor).includes(id) && sor.kattintas_kor_nap === 0, sor && JSON.stringify({ c: sor.forras_cimke, b: sor.bizonyitek_forras, p: sor.platform, k: sor.klikk_potolt, nap: sor.kattintas_kor_nap, kamp: sor.utm_campaign, gc: sor.gad_campaignid, ad: sor.adid }));
    }
    // 6a. organikus / direkt visszateres NEM ir felul
    const elotte = (await sutiNyers(ctx)).value;
    const postElotte = naplo.api.filter((a) => a.metodus === 'POST' && /mosaic-forras/.test(a.ut)).length;
    await lap.goto(`${BAZIS}${U.landing}?utm_source=hirlevel&utm_medium=email`, { waitUntil: 'domcontentloaded', timeout: 60000 }); await lap.waitForTimeout(800);
    ok(`${cim} 6a. organikus / direkt visszateres: a suti valtozatlan, nincs uj POST`, (await sutiNyers(ctx)).value === elotte && naplo.api.filter((a) => a.metodus === 'POST' && /mosaic-forras/.test(a.ut)).length === postElotte);
    // 6b. ujabb fizetett kattintas (masik platform) felulir
    const masik = platform === 'meta' ? 'tiktok' : 'meta', M = parameterek(masik, uz), MP = PLATFORMOK[masik];
    const poszt2 = lap.waitForResponse((r) => /\/api\/mosaic-forras$/.test(r.url()) && r.request().method() === 'POST', { timeout: 30000 });
    await lap.goto(`${BAZIS}${U.landing}?${M.query(M.id)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }); await poszt2.catch(() => null);
    const c3 = await sutiNyers(ctx);
    ok(`${cim} 6b. ujabb fizetett kattintas (${masik}) felulirja a sutit`, c3 && c3.value !== elotte, '');
    await lap.evaluate(() => { sessionStorage.clear(); localStorage.clear(); });
    await lap.goto(`${BAZIS}${U.landing}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const vissza2 = await lap.evaluate(async () => JSON.parse(JSON.stringify(await window.mhAttribucio.lptKlikkVar())));
    ok(`${cim} 6b. a visszanyeres mar az UJ (${MP.kp}) kattintast adja`, vissza2[MP.kp] === M.id && !vissza2[P.kp], JSON.stringify(Object.keys(vissza2)));
    // 6c. kifejezett elutasitas: a suti torlodik, nincs visszanyeres
    await lap.evaluate(() => { localStorage.setItem('mh_cc', JSON.stringify({ v: 1, t: Date.now(), fun: false, ana: false, adv: false })); sessionStorage.clear(); });
    const torlo = lap.waitForResponse((r) => /\/api\/mosaic-forras$/.test(r.url()) && r.request().method() === 'POST', { timeout: 30000 });
    await lap.goto(`${BAZIS}${U.landing}`, { waitUntil: 'domcontentloaded', timeout: 60000 }); const rt = await torlo.catch(() => null);
    ok(`${cim} 6c. kifejezett elutasitas: torlo POST megy (azonosito nelkul)`, rt && rt.status() === 200 && /"adv":false/.test(rt.request().postData() || '') && !(rt.request().postData() || '').includes('kv'), rt && rt.request().postData());
    await lap.waitForTimeout(300);
    ok(`${cim} 6c. a suti torolve`, (await sutiNyers(ctx)) === null);
    const tiltott = await lap.evaluate(async () => JSON.parse(JSON.stringify({ lpt: window.mhAttribucio.lptKlikk(), ids: window.mhAttribucio.klikkAzonositok() })));
    ok(`${cim} 6c. elutasitas utan a kapu zarva: lptKlikk / klikkAzonositok ures`, Object.keys(tiltott.lpt).length === 0 && Object.keys(tiltott.ids).length === 0);
    ok(`${cim} nincs JS-hiba az oldalakon`, hibak.length === 0, hibak.join(' | '));
    ok(`${cim} nincs tiltott kimeno meres (a kimeno kereseket a tilt.mjs blokkolja, az eles domain nem erintett)`, naplo.tiltott.filter((x) => /ELES-NAVIGACIO/.test(x)).length === 0, naplo.tiltott.slice(0, 3).join(' ; '));
  } catch (e) { ok(`${cim} a forgatokonyv hiba nelkul lefutott`, false, String(e && e.stack || e).slice(0, 300)); }
  await ctx.close();
}

const bongeszo = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-blink-features=AutomationControlled', ...(LOKALIS ? [] : [dnsArg()])] });
console.log(`LPT E2E: bazis=${BAZIS}${LOKALIS ? ' (helyi)' : ''} uzletagok=${uzletagok.join(',')} platformok=${platformok.join(',')} ${MOBIL ? 'mobil' : 'asztali'}`);
try { for (const uz of uzletagok) for (const p of platformok) await egyEset(bongeszo, uz, p); }
finally { await bongeszo.close(); if (lokalis) lokalis.szerver.close(); }
const hibas = eredmenyek.filter((e) => !e.rendben);
console.log(`\nOSSZESEN: ${eredmenyek.length} ellenorzes, ${eredmenyek.length - hibas.length} OK, ${hibas.length} HIBA`);
for (const h of hibas) console.log('  HIBA: ' + h.cimke + (h.reszlet ? ' | ' + h.reszlet : ''));
if (KI) fs.writeFileSync(KI, JSON.stringify({ ido: new Date().toISOString(), bazis: LOKALIS ? 'lokalis' : BAZIS, uzletagok, platformok, mobil: MOBIL, ossz: eredmenyek.length, hibas: hibas.length, eredmenyek }, null, 1));
process.exit(hibas.length ? 1 : 0);
