// QA-4 SMOKE TEST - bongeszo-oldali resz (DECISION #120 / 2. pont (a) es (b)): a koszonooldali kulcs-iro (assets/js/foglalas-kulcs.js) + az erkezesi gyujto (assets/js/attribucio.js)
//   (a) nem lassit es nem blokkol: a lap betoltese, a fo szal es a vendeg elso kattintasa a vegpont lassu / lógo valaszanal sem romlik a kontrollhoz kepest
//   (b) fail-open: a vegpont hibaja (503 vészkapcsoló, 500 HTML, halozati hiba, ervenytelen JSON, lógas) / tiltott tarolo mellett a lapon nincs kezeletlen hiba, a folyamat zavartalan
// Futtatas:  node tools/meres-proba/qa4-smoke-bongeszo.mjs [--dist dist] [--ki docs/booking-engine/meres-naplo/qa4-smoke-bongeszo-<nap>.json]
//   A dist/-et helyben szolgalja ki (tools/netlify-build.mjs kimenete); minden kulso (nem helyi) keres le van tiltva; az /api/* a forgatokonyv szerint van hamisitva (route), VALODI vegpontot nem er el.
// Kornyezet: PLAYWRIGHT_UTVONAL (a playwright-core szulomappaja), CHROME_UTVONAL (a Chromium futtathatoja).
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

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
function szerver() {
  return new Promise((ok) => {
    const s = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://x'); let p = decodeURIComponent(u.pathname);
      const jelolt = [p, p + '.html', '/_a' + p + '.html', '/_a' + (p === '/' ? '/index' : p) + '.html', path.posix.join(p, 'index.html')];
      for (const j of jelolt) { const f = path.join(DIST, j); if (f.startsWith(DIST) && fs.existsSync(f) && fs.statSync(f).isFile()) { res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); return fs.createReadStream(f).pipe(res); } }
      res.writeHead(404, { 'content-type': 'text/plain' }); res.end('nincs');
    });
    s.listen(0, '127.0.0.1', () => ok({ s, port: s.address().port }));
  });
}

const BID = 'mb_0muwq2ciorsos0tznsfyliq';
const BOOKING_URL = `https://mosaic-hair.salonic.hu/guestData/?anyone=true&employeeId=25095&placeId=10823&serviceId=232804&startDate=1792512000&back=${BID}`;
const KOSZONO = (bid = BID) => `/fodrasz-ok?first_booking=true&service=${encodeURIComponent('Fodrász konzultáció')}&price=0&location=Mosaic+Hair&employee=Noel&g=g:3385039&bookingUrl=${encodeURIComponent(BOOKING_URL.replace(BID, bid))}`;

// az /api/* forgatokonyvek: fv(route, kerelem) a hamis szerver
const FORGATOKONYV = {
  gyors_200: async (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, irva: true }) }),
  lassu_8mp: async (r) => { await new Promise((k) => setTimeout(k, 8000)); await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, irva: true }) }).catch(() => {}); },
  logo_vegtelen: async () => { await new Promise((k) => setTimeout(k, 120000)); },
  veszkapcsolo_503: async (r) => r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, ki: true, miert: 'veszkapcsolo: az uj irasok ki vannak kapcsolva' }) }),
  hiba_500_html: async (r) => r.fulfill({ status: 500, contentType: 'text/html', body: '<html><body>Internal Server Error</body></html>' }),
  halozati_hiba: async (r) => r.abort('failed'),
  ervenytelen_json_200: async (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{nem json' }),
  ures_200: async (r) => r.fulfill({ status: 200, body: '' }),
};

async function futtat(bongeszo, bazis, nev, { forgatokonyv = 'gyors_200', szkriptTiltas = false, tarolasTiltva = false, ut = KOSZONO(), vartIras = true } = {}) {
  const ctx = await bongeszo.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const lap = await ctx.newPage();
  const hibak = [], konzolHibak = [], api = [];
  lap.on('pageerror', (e) => hibak.push(String(e.message || e).slice(0, 160)));
  lap.on('console', (m) => { if (m.type() === 'error') konzolHibak.push(m.text().slice(0, 160)); });
  await lap.route('**/*', async (r) => {
    const u = new URL(r.request().url());
    if (u.hostname !== '127.0.0.1') return r.abort('blockedbyclient'); // kulso szkript / pixel / font nem kell: a mereshez csak a sajat kod szamit
    if (szkriptTiltas && /\/assets\/js\/(foglalas-kulcs|attribucio)\.js$/.test(u.pathname)) return r.abort('blockedbyclient');
    if (u.pathname === '/api/foglalas-kulcs' || u.pathname === '/api/meres-erkezes') {
      api.push({ ut: u.pathname, metodus: r.request().method(), ido: Date.now() });
      return FORGATOKONYV[forgatokonyv](r, r.request());
    }
    return r.continue();
  });
  if (tarolasTiltva) await lap.addInitScript(() => {
    const dob = () => { throw new DOMException('tiltott tarolo', 'SecurityError'); };
    for (const k of ['localStorage', 'sessionStorage']) Object.defineProperty(window, k, { get: dob, configurable: true });
  });
  // fo szal: hosszu feladatok (>50 ms) es a betoltesi idok
  await lap.addInitScript(() => {
    window.__hosszu = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__hosszu.push(Math.round(e.duration)); }).observe({ type: 'longtask', buffered: true }); } catch (e) { /* nincs longtask */ }
  });
  const t0 = Date.now();
  await lap.goto(bazis + ut, { waitUntil: 'load', timeout: 60000 });
  const betoltes = Date.now() - t0;
  await lap.waitForTimeout(300);
  const meres = await lap.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0] || {};
    return { dcl: Math.round(n.domContentLoadedEventEnd || 0), load: Math.round(n.loadEventEnd || 0), readyState: document.readyState, hosszuFeladatok: window.__hosszu || [], kulcsEredmeny: window.mhKulcsEredmeny ? { allapot: window.mhKulcsEredmeny.allapot, status: window.mhKulcsEredmeny.status } : null, attrEredmeny: window.mhAttribucioEredmeny ? { allapot: window.mhAttribucioEredmeny.allapot, status: window.mhAttribucioEredmeny.status } : null, mhAttribucio: typeof window.mhAttribucio };
  });
  // a vendeg elso kattintasa: egy belso link - mennyi ido, mire a bongeszo elindítja a navigaciot (a hamis API lassusaga ezt nem kesleltetheti)
  const link = await lap.evaluate(() => { const a = [...document.querySelectorAll('a[href]')].find((x) => /^\//.test(x.getAttribute('href')) && x.offsetParent !== null); return a ? a.getAttribute('href') : null; });
  let kattintas = null;
  if (link) {
    const k0 = Date.now();
    try {
      await Promise.all([lap.waitForRequest((q) => q.isNavigationRequest() && q.frame() === lap.mainFrame(), { timeout: 8000 }), lap.click(`a[href="${link}"]`, { timeout: 8000, noWaitAfter: true })]);
      kattintas = { link, ms: Date.now() - k0 };
    } catch (e) { kattintas = { link, hiba: String(e.message).slice(0, 120) }; }
  }
  const eredmeny = { nev, forgatokonyv, szkriptTiltas, tarolasTiltva, betoltesMs: betoltes, dclMs: meres.dcl, loadMs: meres.load, readyState: meres.readyState, hosszuFeladatMs: meres.hosszuFeladatok.reduce((a, b) => a + b, 0), hosszuFeladatDb: meres.hosszuFeladatok.length, kattintas, apiHivasok: api.map((x) => `${x.metodus} ${x.ut}`), kezeletlenHibak: hibak, konzolHibak, kulcsEredmeny: meres.kulcsEredmeny, attrEredmeny: meres.attrEredmeny };
  await ctx.close();
  return eredmeny;
}

const kozep = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const { s, port } = await szerver();
const bazis = `http://127.0.0.1:${port}`;
const bongeszo = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const naplo = { futtatva: new Date().toISOString(), dist: path.relative(GYOKER, DIST), leiras: 'QA-4 smoke test, bongeszo-oldal (Chromium, mobil viewport, helyi dist, hamisitott /api/*)', forgatokonyvek: [], osszegzes: {} };
const kontroll = [], iro = [];
const N = 5;
// kontroll: az iro / gyujto szkript nelkul (az elso futas a gyorsitotarat nem hasznalja: no-store) vs. az irokkal, gyors valasz: N-szer, median
for (let i = 0; i < N; i++) { kontroll.push(await futtat(bongeszo, bazis, `kontroll_szkript_nelkul_${i + 1}`, { szkriptTiltas: true })); iro.push(await futtat(bongeszo, bazis, `iro_gyors_${i + 1}`, { forgatokonyv: 'gyors_200' })); }
naplo.forgatokonyvek.push(...kontroll, ...iro);
const stat = (lista, mezo) => lista.map((x) => x[mezo]).filter((v) => typeof v === 'number');
const kattMs = (lista) => lista.map((x) => x.kattintas && x.kattintas.ms).filter((v) => typeof v === 'number');
naplo.osszegzes.kontroll = { n: N, median_dcl_ms: kozep(stat(kontroll, 'dclMs')), median_load_ms: kozep(stat(kontroll, 'loadMs')), median_hosszu_feladat_ms: kozep(stat(kontroll, 'hosszuFeladatMs')), median_kattintas_ms: kozep(kattMs(kontroll)) };
naplo.osszegzes.iro_gyors = { n: N, median_dcl_ms: kozep(stat(iro, 'dclMs')), median_load_ms: kozep(stat(iro, 'loadMs')), median_hosszu_feladat_ms: kozep(stat(iro, 'hosszuFeladatMs')), median_kattintas_ms: kozep(kattMs(iro)) };
// hibaforgatokonyvek: egyszer-egyszer
const HIBAK = [['lassu_8mp', {}], ['logo_vegtelen', {}], ['veszkapcsolo_503', {}], ['hiba_500_html', {}], ['halozati_hiba', {}], ['ervenytelen_json_200', {}], ['ures_200', {}], ['gyors_200', { tarolasTiltva: true }], ['logo_vegtelen', { tarolasTiltva: true }]];
for (const [fv, extra] of HIBAK) naplo.forgatokonyvek.push(await futtat(bongeszo, bazis, `${fv}${extra.tarolasTiltva ? '_tarolas_tiltva' : ''}`, { forgatokonyv: fv, ...extra }));
await bongeszo.close(); s.close();

// ertekeles
const hibaForg = naplo.forgatokonyvek.filter((x) => !x.nev.startsWith('kontroll_') && !x.nev.startsWith('iro_gyors_'));
const kontrollKatt = naplo.osszegzes.kontroll.median_kattintas_ms;
const ellenorzesek = [];
const ell = (nev, ok, adat) => ellenorzesek.push({ nev, ok: !!ok, adat });
ell('minden forgatokonyvben 0 kezeletlen JS-hiba (pageerror)', naplo.forgatokonyvek.every((x) => x.kezeletlenHibak.length === 0), naplo.forgatokonyvek.filter((x) => x.kezeletlenHibak.length).map((x) => [x.nev, x.kezeletlenHibak]));
ell('minden forgatokonyvben a lap teljesen betoltott (readyState = complete)', naplo.forgatokonyvek.every((x) => x.readyState === 'complete'), null);
ell('az iro valoban probalkozott irni (kulcs-iras + erkezesi adat), a gyors es a hibas forgatokonyvekben is', [...iro, ...hibaForg].every((x) => x.apiHivasok.includes('POST /api/foglalas-kulcs') && x.apiHivasok.includes('POST /api/meres-erkezes') || x.tarolasTiltva), [...iro, ...hibaForg].map((x) => [x.nev, x.apiHivasok]));
ell('a kontrollban (szkript tiltva) nincs iras', kontroll.every((x) => x.apiHivasok.length === 0), null);
ell('a betoltes (load) nem lassul: az irokkal a median a kontroll medianja + 150 ms alatt', naplo.osszegzes.iro_gyors.median_load_ms <= naplo.osszegzes.kontroll.median_load_ms + 150, { kontroll: naplo.osszegzes.kontroll.median_load_ms, iro: naplo.osszegzes.iro_gyors.median_load_ms });
ell('a fo szal nem blokkolodik: a hosszu feladatok osszege az irokkal legfeljebb 100 ms-sal tobb', naplo.osszegzes.iro_gyors.median_hosszu_feladat_ms <= naplo.osszegzes.kontroll.median_hosszu_feladat_ms + 100, { kontroll: naplo.osszegzes.kontroll.median_hosszu_feladat_ms, iro: naplo.osszegzes.iro_gyors.median_hosszu_feladat_ms });
ell('a vendeg elso kattintasa lassu / logo vegpontnal sem lassabb 500 ms-nal a kontrollnal (lassu 8 mp, logo vegtelen)', hibaForg.filter((x) => /lassu|logo/.test(x.nev)).every((x) => x.kattintas && typeof x.kattintas.ms === 'number' && x.kattintas.ms <= kontrollKatt + 500), hibaForg.filter((x) => /lassu|logo/.test(x.nev)).map((x) => [x.nev, x.kattintas]));
ell('minden hibaforgatokonyvben a kattintas sikeres (a navigacio elindul)', hibaForg.every((x) => x.kattintas && typeof x.kattintas.ms === 'number'), hibaForg.map((x) => [x.nev, x.kattintas]));
ell('a hibas valaszok nem hagynak "sikeres iras" jelet (a kliens csak 2xx-re jegyzi meg)', hibaForg.filter((x) => /503|500|halozati|ervenytelen_json/.test(x.nev)).every((x) => !x.kulcsEredmeny || x.kulcsEredmeny.allapot !== 'valasz' || x.kulcsEredmeny.status !== 200 || /ervenytelen/.test(x.nev)), null);
naplo.ellenorzesek = ellenorzesek;
naplo.eredmeny = ellenorzesek.every((x) => x.ok) ? 'PASS' : 'FAIL';
const szoveg = JSON.stringify(naplo, null, 1);
if (KI) { fs.mkdirSync(path.dirname(path.resolve(GYOKER, KI)), { recursive: true }); fs.writeFileSync(path.resolve(GYOKER, KI), szoveg + '\n'); }
console.log(JSON.stringify({ eredmeny: naplo.eredmeny, osszegzes: naplo.osszegzes, ellenorzesek: ellenorzesek.map((x) => `${x.ok ? 'OK  ' : 'HIBA'} ${x.nev}`), forgatokonyvek: hibaForg.map((x) => ({ nev: x.nev, loadMs: x.loadMs, hosszuMs: x.hosszuFeladatMs, kattintasMs: x.kattintas && x.kattintas.ms, hibak: x.kezeletlenHibak.length, api: x.apiHivasok.length })) }, null, 1));
process.exit(naplo.eredmeny === 'PASS' ? 0 : 1);
