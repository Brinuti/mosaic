// Forras-cimke (sessionStorage "mp_forras", hozzajarulastol fuggetlen), Meta / TikTok azonositok (csak hozzajarulassal) es a
// koszonooldali "Honnan hallottal rolunk?" kartya bongeszos probaja (assets/js/mp-meres.js).
//   node tools/build.mjs && node tools/serve.mjs &   majd   node tools/forras-pw.mjs
// A helyi kiszolgalot www.medicalpiercing.hu neven nyitja; minden kulso kerest eldob. Az /api/mp-foglalas es /api/mp-onbevallas
// hivast a VALODI szerverkod (lib/meres/lanc.js) szolgalja ki node:sqlite-os D1-utanzattal, igy a D1-sort ellenorizzuk.
import { DatabaseSync } from 'node:sqlite';
import { chromium } from './pw.mjs';
import { foglalasErkezes, onbevallasErkezes, _semaTorles } from '../lib/meres/lanc.js';

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
  const kuldott = [], ob = [], kulso = [];
  await ctx.route('**/*', async (r) => {
    const q = r.request(), u = q.url();
    for (const [ut, fv, lista] of [['/api/mp-foglalas', foglalasErkezes, kuldott], ['/api/mp-onbevallas', onbevallasErkezes, ob]]) {
      if (!u.startsWith(CIM + ut)) continue;
      const h = await q.allHeaders();
      lista.push(JSON.parse(q.postData()));
      const keres = new Request(`https://www.medicalpiercing.hu${ut}`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: h.cookie || '' }, body: q.postData() });
      const v = await fv({ request: keres, env }, { fetchImpl: async () => { throw new Error('kulso hivas tilos'); } });
      return r.fulfill({ status: v.status, contentType: 'application/json', body: await v.text() });
    }
    if (u.startsWith(CIM)) return r.continue();
    kulso.push(u); return r.abort();
  });
  return { ctx, kuldott, ob, kulso };
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
// 3. Elso erintes: a kesobbi ?gclid nem irja felul a munkamenet tiktok-cimkejet
{
  const s = ++start;
  const { ctx } = await kornyezet(false);
  const p = await ctx.newPage();
  await p.goto(`${CIM}/?ttclid=${TTCLID}`, { waitUntil: 'load' });
  await p.goto(`${CIM}/elerhetosegek?gclid=${G}`, { waitUntil: 'load' });
  await p.goto(`${CIM}/?utm_source=facebook`, { waitUntil: 'load' });
  ok('3a harom erkezes utan is tiktok', (await forras(p))?.p === 'tiktok');
  await p.goto(koszono(s), { waitUntil: 'load' });
  await varRa(() => sor(s));
  ok('3b D1: forras_platform = tiktok', sor(s)?.forras_platform === 'tiktok');
  // uj lap (uj munkamenet) utm_source=ig -> meta; parameter nelkul -> nincs cimke
  const p2 = await ctx.newPage();
  await p2.goto(`${CIM}/?utm_source=ig&utm_medium=social`, { waitUntil: 'load' });
  ok('3c uj lap: utm_source=ig -> meta', (await forras(p2))?.p === 'meta');
  const p3 = await ctx.newPage();
  await p3.goto(`${CIM}/elerhetosegek`, { waitUntil: 'load' });
  ok('3d uj lap parameter nelkul: nincs cimke', (await forras(p3)) === null);
  const p4 = await ctx.newPage();
  await p4.goto(`${CIM}/?utm_source=hirlevel`, { waitUntil: 'load' });
  ok('3e uj lap: mas utm_source -> egyeb', (await forras(p4))?.p === 'egyeb');
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
  await p.waitForTimeout(600);
  ok('5b keretben nincs kartya', keret && (await keret.locator('#mp-ob').count()) === 0 && (await p.locator('#mp-ob').count()) === 0);
  await ctx.close();
}
await b.close();
console.log(hiba ? `\n${hiba} HIBA` : '\nMIND PASS');
process.exit(hiba ? 1 : 0);
