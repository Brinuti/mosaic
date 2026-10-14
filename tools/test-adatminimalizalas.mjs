// ADATMINIMALIZALAS - OFFLINE TESZTEK (a meresi oldal SPEC-je, #167 120. komment, GPT atnezte)
//   node --test tools/test-adatminimalizalas.mjs
// Az egeszsegkozeli szolgaltatas (PMU, oxigen, lezer) TELJES Salonic-neve SOHA nem mehet harmadik felnek (Meta, TikTok, GA4), es a meres_kuldes.kerelem naploba sem:
// csak a platformKod (`${uzletag}_${e.nev}` kisbetuvel; ajandekkartyanal 'ajandekkartya'). Az esemeny, az ertek, az order_id nem valtozik. A Google SOHA nem kapott szolgaltatasnevet (regresszio).
// A motoros (sajat booking_id) es a salonic_direct agon is; a D1-ben a nyers szolgaltatas belso egyeztetesre marad (nem tesztelt itt: nem kimeno torzs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { KEREM_EPITO, PLATFORMOK, platformKod } from '../netlify/lib/meres/platformok.js';
import { esemenyek } from '../netlify/lib/meres/esemeny-modell.js';
import { elosztas, erkezesMent } from '../netlify/lib/meres/elosztas.js';
import { BE, BID, ENV, FK, NOW, PI, TELJES_ENV, ctxEpit, d1, hamisFetch } from './meres-proba/golden-motor.mjs';
import { T0, level, lezar, ujUuid, vilag } from './lib-sd-teszt.mjs';

// kulonleges, egyertelmuen felismerheto szolgaltatasnev (ekezettel, kotojellel, kis-/nagybetuvel): barmilyen alakban kiszivarogna, a teszt megfogja
const SZOLG = 'Lézeres szőrtelenítés - teljes láb ZZTESZT';
const ALAKOK = [SZOLG, SZOLG.toLowerCase(), SZOLG.toUpperCase(), 'ZZTESZT', 'zzteszt', encodeURIComponent(SZOLG), 'Lézeres szőrtelenítés', 'lezeres szortelenites'];
const nemTartalmaz = (kep, mit) => { const s = typeof kep === 'string' ? kep : JSON.stringify(kep); for (const a of ALAKOK) assert.ok(!s.includes(a), `${mit}: kiszivargott a szolgaltatasnev (${a})`); };
const ERK = () => ({
  google: { gclid: { ertek: 'Cj0KCQjw_TESZT_gclid_0123456789', ts: 1 } },
  meta: { fbc: 'fb.1.1791295050000.IwAR_fbclid_TESZT_01', fbclid: 'IwAR_fbclid_TESZT_01', ts: 1 },
  tiktok: { ttclid: { ertek: 'E.C.P.ttclid_TESZT_01', ts: 1 } }, fbp: 'fb.1.1791286140000.1234567890', ttp: 'ttp_TESZT_0123456789abcdef',
  ga4: { client_id: '1234567890.1759759200', session_id: '1759759200', measurement_id: 'G-TESZT00001' },
});
const HOZZ = { ana: true, adv: true };

test('A1 platformKod: `${uzletag}_${e.nev}` kisbetuvel; ajandekkartyanal "ajandekkartya"; a nyers szolgaltatasra nem tamaszkodik', () => {
  const k = (fk, nev) => platformKod({ nev }, { fk });
  assert.equal(k({ tipus: 'foglalas', uzletag: 'headspa', szolgaltatas: SZOLG }, 'FoglalasElso'), 'headspa_foglalaselso');
  assert.equal(k({ tipus: 'foglalas', uzletag: 'pmu', szolgaltatas: SZOLG }, 'Konzultacio'), 'pmu_konzultacio');
  assert.equal(k({ tipus: 'foglalas', uzletag: 'fodrasz', szolgaltatas: null }, 'Visszajaro'), 'fodrasz_visszajaro');
  assert.equal(k({ tipus: 'ajandekkartya', uzletag: 'headspa', szolgaltatas: SZOLG }, 'Ajandekkartya'), 'ajandekkartya');
  assert.equal(k({ tipus: 'ajandekkartya', uzletag: 'headspa', szolgaltatas: SZOLG }, 'Schedule'), 'ajandekkartya');
  for (const f of [{ tipus: 'foglalas', uzletag: 'oxigen' }, { tipus: 'foglalas', uzletag: 'oxigen', szolgaltatas: SZOLG }, { tipus: 'foglalas', uzletag: 'oxigen', szolgaltatas: '' }]) assert.equal(k(f, 'FoglalasElso'), 'oxigen_foglalaselso');
});

test('A2 Meta / TikTok / GA4 epito: a szolgaltatas teljes neve SEHOL nem szerepel, a motoros ES a salonic_direct agon is, minden uzletag x jelleg x kupon esetre', async () => {
  let ellenorzott = 0; const platformok = new Set(); const agak = new Set();
  for (const forras of [undefined, 'salonic_direct']) for (const uzletag of ['headspa', 'fodrasz', 'oxigen', 'szor', 'pmu']) for (const jelleg of ['elso', 'konzultacio', 'visszajaro']) for (const kupon of [false, true]) {
    const ctx = await ctxEpit({ uzletag, jelleg, kupon, szolgaltatas: SZOLG, ...(forras ? { forras } : {}) }, HOZZ, ERK());
    for (const e of esemenyek(ctx.fk)) for (const p of PLATFORMOK) {
      const r = KEREM_EPITO[p](e, ctx, ENV);
      if (!r.body) continue; // kihagyva / tiltva: nincs kimeno torzs
      nemTartalmaz(r.body, `${p}/${uzletag}/${jelleg}/${forras || 'motor'}`); nemTartalmaz(r.url, `${p} url`);
      const kod = platformKod(e, ctx);
      if (p === 'meta') assert.equal(r.body.data[0].custom_data.content_name, kod, 'Meta content_name = platformKod');
      if (p === 'tiktok') { const c = r.body.data[0].properties.contents[0]; assert.deepEqual([c.content_id, c.content_name], [kod, kod], 'TikTok content_id = content_name = platformKod'); }
      if (p === 'ga4') assert.equal(r.body.events[0].params.items, undefined, 'GA4: uj items[] nem kerul be a nem-ajandekkartya esemenyre');
      ellenorzott++; platformok.add(p); agak.add(forras || 'motor');
    }
  }
  assert.ok(ellenorzott > 100, 'nem ures teszt: ' + ellenorzott);
  assert.deepEqual([...platformok].sort(), ['ga4', 'google', 'meta', 'tiktok']);
  assert.deepEqual([...agak].sort(), ['motor', 'salonic_direct']);
});

test('A3 az ertek / az esemeny / az order_id valtozatlan (az optimalizalasra nincs hatas): csak a content_name / content_id / item_* mezok kodosak', async () => {
  const ctx = await ctxEpit({ uzletag: 'pmu', jelleg: 'elso', kupon: false, szolgaltatas: SZOLG, ertek: 53800 }, HOZZ, ERK());
  const [alap] = esemenyek(ctx.fk).filter((e) => e.tipus === 'alap');
  const m = KEREM_EPITO.meta(alap, ctx, ENV).body.data[0]; const t = KEREM_EPITO.tiktok(alap, ctx, ENV).body.data[0]; const g = KEREM_EPITO.ga4(alap, ctx, ENV).body.events[0];
  assert.deepEqual([m.event_id, m.custom_data.order_id, m.custom_data.value, m.custom_data.content_category], [alap.esemeny_id, BID, 53800, 'pmu']);
  assert.deepEqual([t.event_id, t.properties.order_id, t.properties.value, t.properties.contents[0].price], [alap.esemeny_id, BID, 53800, 53800]);
  assert.equal(g.params.esemeny_id, alap.esemeny_id); assert.equal(g.params.uzletag, 'pmu');
});

test('A4 TikTok: fallback nelkul - nyers nev nelkul (null / ures szolgaltatas) is a kod megy, es nyers nevvel sem szivarog', async () => {
  for (const szolg of [null, '', SZOLG]) {
    const ctx = await ctxEpit({ uzletag: 'oxigen', jelleg: 'konzultacio', szolgaltatas: szolg }, HOZZ, ERK());
    for (const e of esemenyek(ctx.fk)) {
      const r = KEREM_EPITO.tiktok(e, ctx, ENV); if (!r.body) continue;
      const c = r.body.data[0].properties.contents[0];
      assert.deepEqual([c.content_id, c.content_name], [platformKod(e, ctx), platformKod(e, ctx)]);
      nemTartalmaz(r.body, 'tiktok fallback');
    }
  }
});

test('A5 ajandekkartya: GA4 items[] item_id = item_name = "ajandekkartya"; Meta / TikTok sem kap szolgaltatasnevet (motoros ag)', async () => {
  const ctx = await ctxEpit({ tipus: 'ajandekkartya', uzletag: 'headspa', jelleg: undefined, source_entity_id: PI, ertek: 53800, kupon: false, szolgaltatas: 'Ajándékkártya - ' + SZOLG }, HOZZ, ERK());
  let ga4 = 0;
  for (const e of esemenyek(ctx.fk)) for (const p of PLATFORMOK) {
    const r = KEREM_EPITO[p](e, ctx, ENV); if (!r.body) continue;
    nemTartalmaz(r.body, `ajandekkartya ${p}`);
    if (p === 'ga4' && e.nev === 'Ajandekkartya') { const it = r.body.events[0].params.items; assert.equal(it.length, 1); assert.deepEqual([it[0].item_id, it[0].item_name, it[0].price, it[0].quantity], ['ajandekkartya', 'ajandekkartya', 53800, 1]); ga4++; }
    if (p === 'meta') assert.equal(r.body.data[0].custom_data.content_name, 'ajandekkartya');
    if (p === 'tiktok') assert.deepEqual([r.body.data[0].properties.contents[0].content_id, r.body.data[0].properties.contents[0].content_name], ['ajandekkartya', 'ajandekkartya']);
  }
  assert.equal(ga4, 1, 'pontosan egy GA4 purchase items[] (ajandekkartya)');
});

test('A6 Google regresszio: a Zapier-torzs tovabbra is csak a Zap mezoit tartalmazza, szolgaltatasnev nelkul', async () => {
  const MEZOK = ['ad_user_data', 'conversion_action_id', 'conversion_date_time', 'currency', 'gclid', 'order_id', 'value'];
  let db = 0;
  for (const forras of [undefined, 'salonic_direct']) for (const uzletag of ['headspa', 'fodrasz', 'oxigen', 'szor', 'pmu']) {
    const ctx = await ctxEpit({ uzletag, jelleg: 'elso', szolgaltatas: SZOLG, ...(forras ? { forras } : {}) }, HOZZ, ERK());
    for (const e of esemenyek(ctx.fk)) {
      const r = KEREM_EPITO.google(e, ctx, ENV); if (!r.body) continue;
      assert.deepEqual(Object.keys(r.body).sort(), MEZOK, 'a Google-torzs mezoi valtozatlanok'); nemTartalmaz(r.body, 'google'); nemTartalmaz(r.cel, 'google cel'); db++;
    }
  }
  assert.ok(db > 0, 'volt Google-torzs');
});

test('A7 motoros vegpontig: az elosztas() HTTP-hivasai ES a meres_kuldes.kerelem naplo sem tartalmazza a szolgaltatasnevet; a kod igen', async () => {
  const adb = d1(); const { f, hivasok } = hamisFetch();
  await erkezesMent(adb, { source_id: BID, uzletag: 'pmu', attr: BE(), hozz: { ana: true, adv: true, fun: true }, ua: 'UA TESZT', ip: '203.0.113.7', oldal: 'https://www.mosaicheadspa.hu/koszonjuk' }, NOW);
  const r = await elosztas(adb, FK({ uzletag: 'pmu', jelleg: 'konzultacio', ertek: 0, szolgaltatas: SZOLG }), { env: TELJES_ENV, fetchImpl: f, now: () => NOW });
  assert.ok(hivasok.length >= 2, 'volt kimeno hivas: ' + hivasok.length);
  nemTartalmaz(hivasok, 'elosztas hivasok');
  const sorok = adb.db.prepare('SELECT platform, allapot, kerelem FROM meres_kuldes').all();
  assert.ok(sorok.some((s) => s.allapot === 'elkuldve'), 'volt elkuldott sor');
  for (const s of sorok) if (s.kerelem) nemTartalmaz(s.kerelem, 'meres_kuldes.kerelem (' + s.platform + ')');
  assert.ok(sorok.some((s) => s.kerelem && s.kerelem.includes('pmu_konzultacio')), 'a naploban a kodos valtozat szerepel');
  assert.ok(r.allapot);
});

test('A8 salonic_direct vegpontig: az sd kimeno hivasai ES a meres_kuldes.kerelem naplo sem tartalmazza a Salonic-szolgaltatas nevet', async () => {
  const v = vilag(); await v.kesz;
  const u = ujUuid(); const b = level(u, { szolgaltatas: 'Soft powder', uj_vendeg: true });
  await lezar(v, b); v.t.set(T0 + 1300_000);
  const r = await v.sd(b);
  assert.equal(r.allapot, 'kesz', 'az sd atvette: ' + JSON.stringify(r).slice(0, 200));
  assert.ok(v.net.hivasok.length >= 4, 'volt kimeno sd-hivas: ' + v.net.hivasok.length);
  const ALAK = /soft\s*powder/i;
  assert.ok(!ALAK.test(JSON.stringify(v.net.hivasok)), 'kimeno hivasok: nincs szolgaltatasnev');
  const sorok = v.sql("SELECT platform, forras, kerelem FROM meres_kuldes WHERE forras = 'salonic_direct'");
  assert.ok(sorok.length >= 4, 'sd-naplosorok: ' + sorok.length);
  for (const s of sorok) assert.ok(!ALAK.test(s.kerelem || ''), 'meres_kuldes.kerelem (' + s.platform + ') nem tartalmaz szolgaltatasnevet');
  assert.ok(sorok.some((s) => /pmu_/.test(s.kerelem || '')), 'a naploban a kodos valtozat szerepel');
});
