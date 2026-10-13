// Forras-cimke (sessionStorage "mp_forras", hozzajarulastol fuggetlen), Meta / TikTok azonositok (csak hozzajarulassal) es a
// koszonooldali "Honnan hallottal rolunk?" kartya bongeszos probaja (assets/js/mp-meres.js).
//   node tools/build.mjs && node tools/serve.mjs &   majd   node tools/forras-pw.mjs
// A helyi kiszolgalot www.medicalpiercing.hu neven nyitja; minden kulso kerest eldob. Az /api/mp-foglalas es /api/mp-onbevallas
// hivast a VALODI szerverkod (lib/meres/lanc.js) szolgalja ki node:sqlite-os D1-utanzattal, igy a D1-sort ellenorizzuk.
import { DatabaseSync } from 'node:sqlite';
import { chromium } from './pw.mjs';
import { foglalasErkezes, onbevallasErkezes, _semaTorles } from '../lib/meres/lanc.js';
import { forrasVegpont } from '../lib/meres/cimke.js';

const PORT = +process.env.PORT || 4290;
const CIM = `http://www.medicalpiercing.hu:${PORT}`;
const T = Date.now();
const TTCLID = 'E.C.P.TESZTttclid_' + T;
const G = 'Cj0KCQjwTESZTFORRAS_' + T;
let start = 1900000000 + Math.floor(Math.random() * 1e6);
const BURL = (s) => encodeURIComponent(`https://medicalpiercing.salonic.hu/booking/selectDate/?placeId=12169&serviceId=9001&employeeId=555&startDate=${s}`);
// a motor altal a fo ablakban nyitott koszonooldal (ugyanazok a parameterek + booking_id)
const koszono = (s, ut = '/foglalas-ok-mi') => `${CIM}${ut}?first_booking=true&price=24900&bookingUrl=${BURL(s)}&booking_id=mb_forras${s}`;
const suti = (igen) => ({ name: 'mp_suti', value: `v1-s${igen ? 1 : 0}-m${igen ? 1 : 0}-t${Math.floor(Date.now() / 1000)}`, domain: 'www.medicalpiercing.hu', path: '/' });

function d1() {
  const s = new DatabaseSync(':memory:');
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    run: async () => { const r = s.prepare(sql).run(...args); return { meta: { changes: r.changes } }; },
    first: async () => s.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: s.prepare(sql).all(...args).map((o) => ({ ...o })) }),
  });
  return { _s: s, prepare: (sql) => stmt(sql), batch: async (l) => { const o = []; for (const x of l) o.push(await x.run()); return o; } };
}
_semaTorles();
const db = d1();
const env = { MP_MERES_DB: db };
const sor = (s) => db._s.prepare('SELECT * FROM mp_foglalas WHERE kulcs = ?').get(`12169|555|${s}`) || null;

const b = await chromium.launch({ args: ['--host-resolver-rules=MAP www.medicalpiercing.hu 127.0.0.1'] });
let hiba = 0;
const ok = (nev, felt, info = '') => { console.log((felt ? 'PASS ' : 'FAIL ') + nev + (info ? ' | ' + info : '')); if (!felt) hiba++; };

async function kornyezet(hozzajarul) {
  const ctx = await b.newContext();
  if (hozzajarul !== undefined) await ctx.addCookies([suti(hozzajarul)]);
  const kuldott = [], ob = [], kulso = [], lpt = [];
  await ctx.route('**/*', async (r) => {
    const q = r.request(), u = q.url();
    for (const [ut, fv, lista] of [['/api/mp-foglalas', foglalasErkezes, kuldott], ['/api/mp-onbevallas', onbevallasErkezes, ob], ['/api/mp-forras', forrasVegpont, lpt]]) {
      if (!u.startsWith(CIM + ut)) continue;
      const h = await q.allHeaders();
      lista.push(JSON.parse(q.postData()));
      const keres = new Request(`https://www.medicalpiercing.hu${ut}`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: h.cookie || '' }, body: q.postData() });
      const v = await fv({ request: keres, env }, { fetchImpl: async () => { throw new Error('kulso hivas tilos'); } });
      const sc = v.headers.get('set-cookie');
      if (sc) lista.push({ setCookie: sc });
      // a helyi proba http-n fut: a Secure sutit a bongeszo itt nem fogadna el, ezert a bongeszonek Secure nelkul adjuk at
      // (a fejlecet a "lista" az eredeti alakban rogziti es azt ellenorizzuk)
      const headers = sc ? { 'set-cookie': sc.replace('; Secure', '') } : {};
      return r.fulfill({ status: v.status, contentType: 'application/json', headers, body: await v.text() });
    }
    if (u.startsWith(CIM)) return r.continue();
    kulso.push(u); return r.abort();
  });
  return { ctx, kuldott, ob, kulso, lpt };
}
const forras = (p) => p.evaluate(() => { try { return JSON.parse(sessionStorage.getItem('mp_forras') || 'null'); } catch (e) { return 'hiba'; } });
const varRa = async (f, ms = 8000) => { for (let i = 0; i < ms / 100 && !(await f()); i++) await new Promise((r) => setTimeout(r, 100)); return f(); };

// 1. ?ttclid hozzajarulas NELKUL (elutasitva): csak a cimke, azonosito sehol; a D1-sor forras_platform = tiktok, ttclid NINCS
{
  const s = ++start;
  const { ctx, kuldott, kulso } = await kornyezet(false);
  const p = await ctx.newPage();
  await p.goto(`${CIM}/?ttclid=${TTCLID}`, { waitUntil: 'load' });
  const fo = await forras(p);
  ok('1a erkezes ?ttclid-del: sessionStorage mp_forras = tiktok', fo && fo.p === 'tiktok' && /^\d+$/.test(String(fo.t)), JSON.stringify(fo));
  const tarolt = await p.evaluate(() => JSON.stringify(sessionStorage.getItem('mp_forras')) + localStorage.getItem('mp_gk'));
  ok('1b az mp_forras-ban / mp_gk-ban nincs azonosito', !tarolt.includes(TTCLID) && !tarolt.includes('TESZTttclid'), tarolt);
  await p.goto(koszono(s), { waitUntil: 'load' });
  await varRa(() => sor(s));
  const r = sor(s);
  ok('1c D1: forras_platform = tiktok, tiktok_ttclid NULL', r && r.forras_platform === 'tiktok' && r.tiktok_ttclid === null && r.hozzajarulas_hirdetes === 0, JSON.stringify(r && { fp: r.forras_platform, tt: r.tiktok_ttclid }));
  ok('1d a keresben nincs kattintasazonosito', kuldott.length >= 1 && !kuldott[0].kattintas && kuldott[0].forras_platform === 'tiktok');
  ok('1e kulso keres nem kapja meg a ttclid-et', !kulso.some((u) => u.includes(TTCLID)));
  await ctx.close();
}
// 2. ?ttclid hozzajarulassal: a ttclid a D1-ben
{
  const s = ++start;
  const { ctx } = await kornyezet(true);
  const p = await ctx.newPage();
  await p.goto(`${CIM}/?ttclid=${TTCLID}`, { waitUntil: 'load' });
  await p.goto(koszono(s), { waitUntil: 'load' });
  await varRa(() => sor(s));
  const r = sor(s);
  ok('2 hozzajarulassal: tiktok_ttclid tarolva, forras = tiktok', r && r.tiktok_ttclid === TTCLID && r.forras_platform === 'tiktok' && r.tiktok_kattintas_ido > 0, JSON.stringify(r && { fp: r.forras_platform, tt: r.tiktok_ttclid }));
  await ctx.close();
}
// 3. Last paid click (forras v2): a kesobbi fizetett ?gclid felulirja a tiktok-cimket, a nem fizetett utm_source=facebook nem
{
  const s = ++start;
  const { ctx } = await kornyezet(false);
  const p = await ctx.newPage();
  await p.goto(`${CIM}/?ttclid=${TTCLID}`, { waitUntil: 'load' });
  await p.goto(`${CIM}/elerhetosegek?gclid=${G}`, { waitUntil: 'load', referer: 'https://www.google.com/' });
  await p.goto(`${CIM}/?utm_source=facebook`, { waitUntil: 'load', referer: 'https://www.facebook.com/' });
  const f3 = await forras(p);
  ok('3a harom erkezes utan google (utolso fizetett), kp = gclid, ertek nelkul', f3?.p === 'google' && f3.kp === 'gclid' && !JSON.stringify(f3).includes(G), JSON.stringify(f3));
  await p.goto(koszono(s), { waitUntil: 'load' });
  await varRa(() => sor(s));
  ok('3b D1: forras_platform = google, forras_cimke = google_nem_markas (nincs kampany-ID)', sor(s)?.forras_platform === 'google' && sor(s)?.forras_cimke === 'google_nem_markas' && sor(s)?.cimke_megjegyzes === 'nincs_kampany_id', JSON.stringify(sor(s) && [sor(s).forras_cimke, sor(s).cimke_megjegyzes]));
  // uj lap (uj munkamenet) utm_source=ig (nem fizetett) -> egyeb; parameter nelkul -> direkt erintes; mas utm_source -> egyeb
  // (a 2 oras latogatas-tarolot - "mp_forras_l" - elotte uritjuk, kulonben az uj lap az elozo latogatas erinteset folytatja: 11. pont)
  const urit = () => p.evaluate(() => localStorage.removeItem('mp_forras_l'));
  await urit();
  const p2 = await ctx.newPage();
  await p2.goto(`${CIM}/?utm_source=ig&utm_medium=social`, { waitUntil: 'load' });
  ok('3c uj lap: utm_source=ig&utm_medium=social -> egyeb (nem fizetett)', (await forras(p2))?.p === 'egyeb');
  await urit();
  const p3 = await ctx.newPage();
  await p3.goto(`${CIM}/elerhetosegek`, { waitUntil: 'load' });
  const f3d = await forras(p3);
  ok('3d uj lap parameter nelkul: direkt erintes (rk = nincs, p = null)', f3d && f3d.p == null && f3d.rk === 'nincs', JSON.stringify(f3d));
  await urit();
  const p4 = await ctx.newPage();
  await p4.goto(`${CIM}/?utm_source=meta&utm_medium=paid_social&utm_campaign=120001`, { waitUntil: 'load' });
  ok('3e uj lap: utm_source=meta&utm_medium=paid_social -> meta', (await forras(p4))?.p === 'meta');
  await ctx.close();
}
// 4. A kerdes-kartya 2026-10-13 ota NINCS (Feri dontese): a fo ablak koszonooldalan sem jelenik meg
{
  const s = ++start;
  const { ctx } = await kornyezet(false);
  const p = await ctx.newPage();
  const hibak = []; p.on('pageerror', (e) => hibak.push(e.message));
  await p.goto(`${CIM}/?fbclid=TESZTfbclid_${T}`, { waitUntil: 'load' });
  await p.goto(koszono(s), { waitUntil: 'load' });
  await varRa(() => sor(s));
  await p.waitForTimeout(1500);
  ok('4a nincs kerdes-kartya', (await p.locator('#mp-ob').count()) === 0);
  ok('4b a foglalas rogzitve, forras = meta', sor(s)?.forras_platform === 'meta');
  ok('4c nincs JS-hiba', hibak.length === 0, hibak.join(' | '));
  await ctx.close();
}
// 5. Keretben (regi, kozvetlenul beagyazott Salonic-naptar): a keret is latja a munkamenet cimkejet, kartya NINCS
{
  const s = ++start;
  const { ctx, kuldott } = await kornyezet(false);
  const p = await ctx.newPage();
  await p.goto(`${CIM}/?ttclid=${TTCLID}`, { waitUntil: 'load' });
  await p.evaluate((u) => { const f = document.createElement('iframe'); f.src = u; f.style.cssText = 'width:600px;height:400px'; document.body.appendChild(f); }, koszono(s));
  await varRa(() => sor(s), 9000);
  const keret = p.frames().find((f) => f !== p.mainFrame() && f.url().includes('foglalas-ok'));
  ok('5a keretbol jelzett foglalas: forras_platform = tiktok (kozos sessionStorage)', sor(s)?.forras_platform === 'tiktok' && kuldott.at(-1)?.forras_platform === 'tiktok');
  ok('5c keretbol is: forras_cimke = tiktok, forras_keret = 1, kattintas_param = ttclid', sor(s)?.forras_cimke === 'tiktok' && sor(s)?.forras_keret === 1 && sor(s)?.kattintas_param === 'ttclid', JSON.stringify(sor(s) && [sor(s).forras_cimke, sor(s).forras_keret]));
  await p.waitForTimeout(600);
  ok('5b keretben nincs kartya', keret && (await keret.locator('#mp-ob').count()) === 0 && (await p.locator('#mp-ob').count()) === 0);
  await ctx.close();
}
// 6. Fizetett -> organikus kereso: nem irja felul
{
  const s = ++start;
  const { ctx } = await kornyezet(false);
  const p = await ctx.newPage();
  await p.goto(`${CIM}/?utm_source=meta&utm_medium=paid_social&utm_campaign=120001&utm_term=120002&utm_content=120003&fbclid=TESZTfbclid_${T}`, { waitUntil: 'load', referer: 'https://l.instagram.com/' });
  await p.goto(`${CIM}/elerhetosegek`, { waitUntil: 'load', referer: 'https://www.google.com/' });
  const f = await forras(p);
  ok('6a organikus kereses utan is meta (fizetett marad)', f?.p === 'meta' && f.rk === 'social' && f.uc === '120001', JSON.stringify(f));
  await p.goto(koszono(s), { waitUntil: 'load' });
  await varRa(() => sor(s));
  const r = sor(s);
  ok('6b D1: meta, utm_* tarolva, referrer_kat = social, hozzajarulas nelkul', r && r.forras_cimke === 'meta' && r.utm_campaign === '120001' && r.utm_term === '120002' && r.utm_content === '120003' && r.referrer_kat === 'social' && r.hozzajarulas_hirdetes === 0 && r.meta_fbc === null, JSON.stringify(r && [r.forras_cimke, r.utm_campaign, r.referrer_kat]));
  await ctx.close();
}
// 7. Meta -> TikTok: az uj fizetett kattintas felulir
{
  const s = ++start;
  const { ctx } = await kornyezet(false);
  const p = await ctx.newPage();
  await p.goto(`${CIM}/?utm_source=meta&utm_medium=paid_social&utm_campaign=120001&fbclid=TESZTfbclid_${T}`, { waitUntil: 'load' });
  await p.goto(`${CIM}/?utm_source=tiktok&utm_medium=paid_social&utm_campaign=777&ttclid=${TTCLID}`, { waitUntil: 'load', referer: 'https://www.tiktok.com/' });
  ok('7a meta -> tiktok: tiktok', (await forras(p))?.p === 'tiktok');
  await p.goto(koszono(s), { waitUntil: 'load' });
  await varRa(() => sor(s));
  ok('7b D1: forras_cimke = tiktok, utm_campaign = 777', sor(s)?.forras_cimke === 'tiktok' && sor(s)?.utm_campaign === '777');
  await ctx.close();
}
// 8. Hozzajarulas nelkul: nincs mp_lpt suti (sem /api/mp-forras hivas), a bizonyitek megis a D1-ben
{
  const s = ++start;
  const { ctx, lpt } = await kornyezet(false);
  const p = await ctx.newPage();
  await p.goto(`${CIM}/?utm_source=google&utm_medium=cpc&utm_campaign=999&gclid=${G}`, { waitUntil: 'load', referer: 'https://www.google.com/' });
  await p.waitForTimeout(400);
  const sutik = (await ctx.cookies()).map((c) => c.name);
  ok('8a nincs mp_lpt suti es nincs Set-Cookie', !sutik.includes('mp_lpt') && !lpt.some((x) => x.setCookie && /^mp_lpt=[^;]/.test(x.setCookie)), sutik.join(','));
  await p.goto(koszono(s), { waitUntil: 'load' });
  await varRa(() => sor(s));
  const r = sor(s);
  ok('8b D1: google, utm_campaign = 999, kattintas_param = gclid, kattintas_ertek NULL', r && r.forras_cimke === 'google_nem_markas' && r.utm_campaign === '999' && r.kattintas_param === 'gclid' && r.kattintas_ertek === null && r.bizonyitek_forras === 'munkamenet', JSON.stringify(r && [r.forras_cimke, r.cimke_megjegyzes]));
  await ctx.close();
}
// 9. Hozzajarulassal: Set-Cookie mp_lpt HttpOnly; Secure; SameSite=Lax; 30 nap; a sutiben nincs kattintasazonosito-ertek; uj munkamenetben tartalek
{
  const s = ++start;
  const { ctx, lpt } = await kornyezet(true);
  const p = await ctx.newPage();
  await p.goto(`${CIM}/?utm_source=meta&utm_medium=paid_social&utm_campaign=120001&fbclid=TESZTfbclid_${T}`, { waitUntil: 'load' });
  await varRa(async () => lpt.some((x) => x.setCookie));
  const sc = lpt.find((x) => x.setCookie)?.setCookie || '';
  ok('9a Set-Cookie: mp_lpt, HttpOnly, Secure, SameSite=Lax, Max-Age 30 nap', /^mp_lpt=[A-Za-z0-9_-]+; Max-Age=2592000; Path=\/; HttpOnly; Secure; SameSite=Lax$/.test(sc), sc);
  const c = (await ctx.cookies()).find((x) => x.name === 'mp_lpt');
  ok('9b a bongeszoben HttpOnly suti, JS nem latja', c && c.httpOnly && !(await p.evaluate(() => document.cookie)).includes('mp_lpt'));
  ok('9c a suti erteke nem tartalmaz kattintasazonositot', c && !Buffer.from(c.value, 'base64url').toString().includes('TESZTfbclid'));
  // uj lap (uj munkamenet), direkt erkezes, foglalas: a suti a tartalek -> meta, bizonyitek_forras = suti
  // (a 2 oras latogatas-tarolo nelkul, mintha a latogatas mar lejart volna; vele 'latogatas' lenne: 11. pont)
  await p.evaluate(() => localStorage.removeItem('mp_forras_l'));
  const p2 = await ctx.newPage();
  await p2.goto(`${CIM}/elerhetosegek`, { waitUntil: 'load' });
  await p2.goto(koszono(s), { waitUntil: 'load' });
  await varRa(() => sor(s));
  ok('9d uj munkamenet direkt erkezessel: forras_cimke = meta a sutibol', sor(s)?.forras_cimke === 'meta' && sor(s)?.bizonyitek_forras === 'suti', JSON.stringify(sor(s) && [sor(s).forras_cimke, sor(s).bizonyitek_forras]));
  await ctx.close();
}
// 10. Divat fulpiercing (/fulbevalo-ok*, a motor a fo ablakban nyitja booking_id-vel): ugyanugy egy D1-sor forras v2 bizonyitekkal es
//     cimkevel, tipus = 'ful'; a fizetett erintes a "06 - Altalanos fulpiercing" kampanybol. Valodi adatok a lekepezesbol
//     (tools/mp-salonic-lekepezes.json): Sopron 9067, "2 db Fulbevalo" 402057, Mester Brigitta 20562. F5 / uj ful: nincs uj kuldes.
{
  const s = ++start, KULCS = `9067|20562|${s}`;
  const FBURL = encodeURIComponent(`https://medicalpiercing.salonic.hu/booking/selectDate/?placeId=9067&serviceId=402057&employeeId=20562&startDate=${s}`);
  const fsor = () => db._s.prepare('SELECT * FROM mp_foglalas WHERE kulcs = ?').get(KULCS) || null;
  const { ctx, kuldott, kulso } = await kornyezet(false);
  const p = await ctx.newPage();
  const hibak = []; p.on('pageerror', (e) => hibak.push(e.message));
  await p.goto(`${CIM}/ful-piercing-beloves-budapest?utm_source=google&utm_medium=cpc&utm_campaign=2306&gclid=${G}`, { waitUntil: 'load', referer: 'https://www.google.com/' });
  await p.goto(`${CIM}/fulbevalo-ok2?first_booking=true&price=20000&service=2%20db%20F%C3%BClbeval%C3%B3&location=Sopron&employee=Mester%20Brigitta&bookingUrl=${FBURL}&booking_id=mb_ful${s}`, { waitUntil: 'load' });
  await varRa(() => fsor());
  await p.waitForTimeout(800);
  const r = fsor();
  ok('10a /fulbevalo-ok2: pontosan 1 POST /api/mp-foglalas, ut = /fulbevalo-ok (semleges), szolgaltatasnev / helyszin / munkatars nelkul',
    kuldott.length === 1 && kuldott[0].ut === '/fulbevalo-ok' && !/F%C3%BClbeval|Fülbeval|Sopron|Mester/.test(JSON.stringify(kuldott[0])), JSON.stringify(kuldott.map((k) => k.ut)));
  ok('10b D1-sor: tipus = ful, helyszin = sopron, ertek 20000, motor, forras v2 (google_nem_markas, utm_campaign 2306, gclid tipus)',
    r && r.tipus === 'ful' && r.helyszin === 'sopron' && r.ertek === 20000 && r.forras === 'motor' && r.forras_verzio === 'mp_v2' && r.forras_cimke === 'google_nem_markas' && r.utm_campaign === '2306' && r.kattintas_param === 'gclid' && r.kattintas_ertek === null,
    JSON.stringify(r && [r.tipus, r.helyszin, r.forras_cimke, r.utm_campaign]));
  ok('10c a cim semleges: /fulbevalo-ok?price&first_booking&mert=1', new URL(p.url()).pathname === '/fulbevalo-ok' && [...new URL(p.url()).searchParams.keys()].sort().join(',') === 'first_booking,mert,price', p.url().replace(CIM, ''));
  ok('10d kulso keres nem kapja: fulbevalo-ok2, serviceId, bookingUrl, booking_id, Sopron', !kulso.some((u) => /fulbevalo-ok2|serviceId|bookingUrl|booking_id|Sopron|402057/.test(u)), `${kulso.length} kulso keres`);
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(1200);
  const p2 = await ctx.newPage(); await p2.goto(p.url(), { waitUntil: 'load' }); await p2.waitForTimeout(1200);
  ok('10e F5 es a tisztitott cim uj fulben: nincs uj POST, egy D1-sor', kuldott.length === 1 && db._s.prepare("SELECT COUNT(*) n FROM mp_foglalas WHERE kulcs LIKE '9067|%'").get().n === 1, `${kuldott.length} POST`);
  ok('10f nincs JS-hiba', hibak.length === 0, hibak.join(' | '));
  await ctx.close();
}
// 11. Latogatas-tarolo (localStorage "mp_forras_l", 2 ora; Feri dontese 2026-10-13): A lapon ?gclid erkezes, B lap (noopener ->
//     ures sessionStorage) belso oldallal, ott foglalas -> google, bizonyitek_forras = latogatas; 2 ora utan (eltolt ido) -> nincs_jel.
{
  const s = ++start, s2 = ++start;
  const { ctx, kuldott } = await kornyezet(false);
  const hibak = [];
  const a = await ctx.newPage(); a.on('pageerror', (e) => hibak.push(e.message));
  await a.goto(`${CIM}/?utm_source=google&utm_medium=cpc&utm_campaign=999&gclid=${G}`, { waitUntil: 'load', referer: 'https://www.google.com/' });
  const l = await a.evaluate(() => localStorage.getItem('mp_forras_l'));
  ok('11a A lap: latogatas-tarolo google, lejarat ~2 ora, kattintasazonosito-ertek nelkul', !!l && JSON.parse(l).e.kp === 'gclid' && Math.abs(JSON.parse(l).lej - Date.now() / 1000 - 7200) < 120 && !l.includes(G), l);
  const [bLap] = await Promise.all([ctx.waitForEvent('page'), a.evaluate(() => window.open('/elerhetosegek', '_blank', 'noopener'))]);
  bLap.on('pageerror', (e) => hibak.push(e.message));
  await bLap.waitForLoadState('load');
  const fb = await forras(bLap);
  ok('11b B lap (noopener): a sessionStorage a latogatas-tarolobol, b = l', fb && fb.p === 'google' && fb.kp === 'gclid' && fb.b === 'l', JSON.stringify(fb));
  await bLap.goto(koszono(s), { waitUntil: 'load' });
  await varRa(() => sor(s));
  const r = sor(s);
  ok('11c D1: google_nem_markas, bizonyitek_forras = latogatas, kattintas_ertek NULL', r && r.forras_cimke === 'google_nem_markas' && r.bizonyitek_forras === 'latogatas' && r.kattintas_param === 'gclid' && r.kattintas_ertek === null, JSON.stringify(r && [r.forras_cimke, r.bizonyitek_forras]));
  ok('11d D1 diag: oldalak = 2, opener = 0, elso_ref = belso, nav kitoltve', r && r.diag_oldalak === 2 && r.diag_opener === 0 && r.diag_elso_ref === 'belso' && ['navigate', 'reload', 'back_forward', 'prerender'].includes(r.diag_nav), JSON.stringify(r && [r.diag_oldalak, r.diag_opener, r.diag_elso_ref, r.diag_nav]));
  ok('11e a jelzesben nincs kattintasazonosito-ertek, nincs URL a diag-ban', !JSON.stringify(kuldott.at(-1)).includes(G) && !/http/.test(JSON.stringify(kuldott.at(-1).diag || {})));
  // C lap 3 oraval kesobb (eltolt Date.now): a latogatas-tarolo lejart -> nincs_jel, diag kitoltve
  const c = await ctx.newPage(); c.on('pageerror', (e) => hibak.push(e.message));
  await c.addInitScript(() => { const valodi = Date.now.bind(Date); Date.now = () => valodi() + 3 * 3600 * 1000; });
  await c.goto(`${CIM}/elerhetosegek`, { waitUntil: 'load', referer: `${CIM}/` });
  ok('11f C lap 3 ora mulva: nincs erintes, a lejart latogatas-tarolo torolve', (await forras(c)) === null && (await c.evaluate(() => localStorage.getItem('mp_forras_l'))) === null);
  await c.goto(koszono(s2), { waitUntil: 'load' });
  await varRa(() => sor(s2));
  const r2 = sor(s2);
  ok('11g D1: ismeretlen / nincs_jel, bizonyitek_forras NULL, diag: oldalak = 2, elso_ref = belso, opener = 0', r2 && r2.forras_cimke === 'ismeretlen' && r2.ismeretlen_ok === 'nincs_jel' && r2.bizonyitek_forras === null && r2.diag_oldalak === 2 && r2.diag_elso_ref === 'belso' && r2.diag_opener === 0 && !!r2.diag_nav, JSON.stringify(r2 && [r2.forras_cimke, r2.ismeretlen_ok, r2.diag_oldalak, r2.diag_elso_ref, r2.diag_nav]));
  ok('11h nincs JS-hiba', hibak.length === 0, hibak.join(' | '));
  await ctx.close();
}
await b.close();
console.log(hiba ? `\n${hiba} HIBA` : '\nMIND PASS');
process.exit(hiba ? 1 : 0);
