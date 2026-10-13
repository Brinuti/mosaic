// Bongeszos teszt a foglalas-meresre (assets/js/mp-meres.js + /api/mp-foglalas).
//   helyben:       node tools/build.mjs && node tools/serve.mjs & node tools/mp-meres-pw.mjs
//                  (a vegpontot a teszt utanozza: a helyi kiszolgalo nem futtat fuggvenyt)
//   PR-elonezeten: BASE=https://<ag>.medicalpiercing.pages.dev node tools/mp-meres-pw.mjs
//                  (valodi fuggveny + D1; titok nelkul Google-hivas nincs, a rekord kornyezete "elonezet")
import assert from 'node:assert/strict';
import { chromium } from './pw.mjs';

const BASE = (process.env.BASE || 'http://localhost:4290').replace(/\/$/, '');
const HELYI = /localhost|127\.0\.0\.1/.test(BASE);
const GCLID = 'Cj0KCQjwPWTESZT_' + Date.now();
const START = 1900000000 + Math.floor(Math.random() * 1e6); // egyedi kulcs futasonkent
const BURL = encodeURIComponent(`https://medicalpiercing.salonic.hu/booking/selectDate/?placeId=12169&serviceId=9001&employeeId=555&startDate=${START}`);
const KOSZONO = `${BASE}/foglalas-ok-mi?first_booking=true&location=Szeged&employee=X&bookingUrl=${BURL}&price=24900&service=Migr%C3%A9n%20piercing&g=2038420&category=Gy%C3%B3gy`;
// a sajat suti-sav (assets/js/suti.js) dontese
const SUTI = (igen) => ({ name: 'mp_suti', value: `v1-s${igen ? 1 : 0}-m${igen ? 1 : 0}-t${Math.floor(Date.now() / 1000)}`, url: BASE });

async function eset(bongeszo, hozzajarul, koszono = KOSZONO) {
  const ctx = await bongeszo.newContext();
  await ctx.addCookies([SUTI(hozzajarul)]);
  const page = await ctx.newPage();
  const hibak = []; page.on('pageerror', (e) => hibak.push(e.message));
  const kuldott = [];
  if (HELYI) await page.route('**/api/mp-foglalas', (r) => { kuldott.push(JSON.parse(r.request().postData())); r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"uj":true}' }); });
  else page.on('request', (r) => { if (r.url().endsWith('/api/mp-foglalas')) kuldott.push(JSON.parse(r.postData())); });
  // 1) erkezes hirdetesbol
  await page.goto(`${BASE}/?gclid=${GCLID}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  const tarolt = await page.evaluate(() => localStorage.getItem('mp_gk'));
  // 2) koszonooldal
  const valasz = HELYI ? null : page.waitForResponse((r) => r.url().endsWith('/api/mp-foglalas'), { timeout: 15000 });
  await page.goto(koszono, { waitUntil: 'domcontentloaded' });
  const v = valasz ? await (await valasz).json() : null;
  await page.waitForTimeout(800);
  // 3) frissites: deduplikalt
  let v2 = null;
  if (!HELYI) {
    const w2 = page.waitForResponse((r) => r.url().endsWith('/api/mp-foglalas'), { timeout: 15000 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    v2 = await (await w2).json();
  }
  await ctx.close();
  return { tarolt, kuldott, v, v2, hibak };
}

const b = await chromium.launch();
try {
  const igen = await eset(b, true);
  assert.ok(igen.tarolt && igen.tarolt.includes(GCLID), 'hozzajarulassal a gclid eltarolva');
  assert.ok(igen.kuldott.length >= 1, 'a koszonooldal kuldott');
  const t = igen.kuldott[0];
  assert.equal(t.kattintas.gclid.ertek, GCLID);
  assert.deepEqual(Object.keys(t.p).sort(), ['bookingUrl', 'first_booking', 'price']);
  const s = JSON.stringify(t);
  for (const tilt of ['Migr', 'Gy', '2038420', 'service=', 'category', 'Szeged']) assert.ok(!s.includes(tilt), 'nem megy ki: ' + tilt);
  assert.deepEqual(igen.hibak, []);
  if (!HELYI) { assert.deepEqual(igen.v, { ok: true, uj: true }); assert.deepEqual(igen.v2, { ok: true, uj: false }, 'frissites: deduplikalva'); }

  const nem = await eset(b, false);
  assert.equal(nem.tarolt, null, 'hozzajarulas nelkul nincs tarolt gclid');
  assert.equal(nem.kuldott[0].kattintas, null, 'hozzajarulas nelkul nincs kattintasazonosito a keresben');
  if (!HELYI) assert.equal(nem.v.uj, false, 'ugyanaz a foglalas (kulcs): deduplikalva');
  // divat fulpiercing (/fulbevalo-ok*): ugyanugy jelez, semleges uttal; uj kulcs (Sopron 9067, 2 db fulbevalo 402057, 20562)
  const FSTART = START + 7;
  const FBURL = encodeURIComponent(`https://medicalpiercing.salonic.hu/booking/selectDate/?placeId=9067&serviceId=402057&employeeId=20562&startDate=${FSTART}`);
  const ful = await eset(b, true, `${BASE}/fulbevalo-ok2?first_booking=true&location=Sopron&employee=X&bookingUrl=${FBURL}&price=20000&service=2%20db%20F%C3%BClbeval%C3%B3`);
  assert.equal(ful.kuldott.length, 1, 'fulbevalo: pontosan egy kuldes');
  assert.equal(ful.kuldott[0].ut, '/fulbevalo-ok', 'fulbevalo: semleges ut');
  assert.deepEqual(Object.keys(ful.kuldott[0].p).sort(), ['bookingUrl', 'first_booking', 'price']);
  assert.ok(!/Sopron|F%C3%BClbeval|Fülbeval/.test(JSON.stringify(ful.kuldott[0])), 'fulbevalo: szolgaltatasnev / helyszin nem megy');
  assert.deepEqual(ful.hibak, []);
  if (!HELYI) { assert.deepEqual(ful.v, { ok: true, uj: true }); assert.deepEqual(ful.v2, { ok: true, uj: false }, 'fulbevalo frissites: deduplikalva'); }
  console.log(`OK (${HELYI ? 'helyi, mockolt vegpont' : 'elonezet, valodi fuggveny + D1'}), kulcs: 12169|555|${START}`);
} finally { await b.close(); }
