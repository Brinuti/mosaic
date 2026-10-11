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
const SUTI = (igen) => ({ name: 'cookieyes-consent', value: encodeURIComponent(`consentid:pw,consent:${igen ? 'yes' : 'no'},action:yes,necessary:yes,functional:no,analytics:${igen ? 'yes' : 'no'},performance:no,advertisement:${igen ? 'yes' : 'no'},other:no`), url: BASE });

async function eset(bongeszo, hozzajarul) {
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
  await page.goto(KOSZONO, { waitUntil: 'domcontentloaded' });
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
  console.log(`OK (${HELYI ? 'helyi, mockolt vegpont' : 'elonezet, valodi fuggveny + D1'}), kulcs: 12169|555|${START}`);
} finally { await b.close(); }
