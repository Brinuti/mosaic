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
  const p2 = await ctx.newPage();
  await p2.goto(`${CIM}/?utm_source=ig&utm_medium=social`, { waitUntil: 'load' });
  ok('3c uj lap: utm_source=ig&utm_medium=social -> egyeb (nem fizetett)', (await forras(p2))?.p === 'egyeb');
  const p3 = await ctx.newPage();
  await p3.goto(`${CIM}/elerhetosegek`, { waitUntil: 'load' });
  const f3d = await forras(p3);
  ok('3d uj lap parameter nelkul: direkt erintes (rk = nincs, p = null)', f3d && f3d.p == null && f3d.rk === 'nincs', JSON.stringify(f3d));
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
  const p2 = await ctx.newPage();
  await p2.goto(`${CIM}/elerhetosegek`, { waitUntil: 'load' });
  await p2.goto(koszono(s), { waitUntil: 'load' });
  await varRa(() => sor(s));
  ok('9d uj munkamenet direkt erkezessel: forras_cimke = meta a sutibol', sor(s)?.forras_cimke === 'meta' && sor(s)?.bizonyitek_forras === 'suti', JSON.stringify(sor(s) && [sor(s).forras_cimke, sor(s).bizonyitek_forras]));
  await ctx.close();
}
await b.close();
console.log(hiba ? `\n${hiba} HIBA` : '\nMIND PASS');
process.exit(hiba ? 1 : 0);
