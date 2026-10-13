// NAPI T2 QA-VEGPONT (GET /api/meres-admin?qa=nap&datum=YYYY-MM-DD) - OFFLINE TESZTEK (a meresi oldal SPEC-je, #167 131. komment)
//   node --test tools/test-qa-nap.mjs
// Valodi SQLite (node:sqlite) a D1 helyett, hamis ora; semmi nem megy ki a halozatra, nincs titok. A tesztek a SPEC minden pontjat lefedik:
// Budapest-nap -> UTC intervallum (nyar / tel / atallasi napok), 401/403/405/429/400, no-store, uzletagonkenti valos/arnyek/biztonsag/sd/pre288/foglalas_vendeg, lampa, PII-mentesseg, CSAK OLVAS.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { sema } from '../netlify/lib/foglalas-kulcs.js';
import { meresSema } from '../netlify/lib/meres/elosztas.js';
import { kezelAdmin } from '../netlify/lib/meres/vegpontok.js';
import { ARNYEK, ELO_CELOK } from '../netlify/lib/meres/platformok.js';
import { PRE288_EPOCH, T2_ACCEPTANCE, arnyekCel, budapestEjfel, lemondasOsztaly, napIntervallum, qaKorlatNullaz, qaNap, t2Start } from '../netlify/lib/meres/qa-nap.js';
import { KULCS_SZOVEG, d1 } from './lib-sd-teszt.mjs';

const NAP = '2026-10-12'; // Budapest, nyari ido (UTC+2): [2026-10-11 22:00Z, 2026-10-12 22:00Z)
const FROM = Date.UTC(2026, 9, 11, 22, 0, 0) / 1000;
const TO = Date.UTC(2026, 9, 12, 22, 0, 0) / 1000;
const MOST = Date.UTC(2026, 9, 13, 12, 0, 0);
const KULCS_HASH = crypto.createHash('sha256').update(KULCS_SZOVEG).digest('hex');
const HEADSPA = (n = 1) => `10427|${n}|1792000000`;
const FODRASZ = (n = 1) => `10823|${n}|1792000000`;
const OXIGEN = (n = 1) => `14409|${n}|1792000000`;
const PMU = (n = 1) => `14585|${n}|1792000000`;
const SZOR = (n = 1) => `14586|${n}|1792000000`;

async function vilag({ semak = true, env = {} } = {}) {
  qaKorlatNullaz();
  const D = d1();
  const db = { prepare: D.prepare, batch: D.batch };
  if (semak) { await sema(db); await meresSema(db); }
  const e = { KULCS_DB: db, EGYEZTETES_KULCS_HASH: KULCS_HASH, GA4_TESZT_MEASUREMENT_ID: 'G-TESZT00001', ...env };
  const sql = (q, ...a) => D.db.prepare(q).all(...a).map((r) => ({ ...r }));
  const futtat = (q, ...a) => D.db.prepare(q).run(...a);
  let cnt = 0;
  const w = {
    D, db, e, sql, futtat,
    uuid: (pre) => `${pre}${String(++cnt).padStart(8 - pre.length, '0')}-0000-4000-8000-${String(cnt).padStart(12, '0')}`,
    egyeztetes(o) { futtat('INSERT INTO foglalas_egyeztetes (uuid, allapot, kulcs, letrehozva, frissitve, sd_allapot, sd_ido, booking_id, sd_id) VALUES (?,?,?,?,?,?,?,?,?)', o.uuid, o.allapot || 'parositott', o.kulcs ?? null, o.t, o.t, o.sd_allapot ?? null, o.sd_ido ?? null, o.booking_id ?? null, o.sd_id ?? null); return o.uuid; },
    lemondas(o) { futtat('INSERT INTO foglalas_lemondas (kulcs, tulajdonos_uuid, eredmeny, ido) VALUES (?,?,?,?)', o.kulcs ?? null, o.tulajdonos_uuid ?? null, o.eredmeny || 'felszabadult', o.t); },
    vendeg(o) { futtat("INSERT INTO foglalas_vendeg (uuid, uzletag, nev_h, tel_h, email_h, allapot, forras, ido, lejar) VALUES (?,?,?,?,?,'aktiv',?,?,?)", o.uuid, o.uzletag, o.nev_h || null, o.tel_h || null, o.email_h || null, o.forras || 'level', o.t, o.t + 86400 * 30); },
    reschedule(o) { futtat('INSERT INTO foglalas_reschedule (uuid, sd_id, allapot, ido, frissitve) VALUES (?,?,?,?,?)', o.uuid, o.sd_id || 'sd_x', o.allapot, o.t, o.t); },
    kuldes(o) {
      const k = o.kerelem === undefined ? cel(o.platform) : o.kerelem;
      futtat('INSERT INTO meres_kuldes (esemeny_id, esemeny_nev, esemeny_tipus, platform, platform_nev, uzletag, source_id, allapot, kerelem, letrehozva, frissitve, forras, indok, hozzajarulas) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        o.esemeny_id, o.nev || 'FoglalasElso', o.tipus || 'alap', o.platform, o.platform_nev === undefined ? 'HeadSpa_FoglalasElso' : o.platform_nev, o.uzletag, o.source_id || 's_' + o.esemeny_id, o.allapot || 'elkuldve', k ? JSON.stringify(k) : null, o.t, o.t, o.forras || 'motor', o.indok ?? null, o.hozz ? JSON.stringify(o.hozz) : null);
    },
    kerj: (q = `qa=nap&datum=${NAP}`, { kulcs = KULCS_SZOVEG, method = 'GET', ip = '1.2.3.4', now = MOST, env: ee = e } = {}) => kezelAdmin(new Request(`https://x.pages.dev/api/meres-admin?${q}`, { method, headers: { ...(kulcs ? { 'x-egyeztetes-kulcs': kulcs } : {}), 'cf-connecting-ip': ip } }), ee, { now: () => now }),
    async jelentes(q, o) { const r = await w.kerj(q, o); assert.equal(r.status, 200); return r.json(); },
  };
  return w;
}
const cel = (platform) => ({
  url: platform === 'meta' ? `https://graph.facebook.com/v23.0/${ARNYEK.meta.datasetId}/events` : platform === 'tiktok' ? 'https://business-api.tiktok.com/open_api/v1.3/event/track/' : platform === 'ga4' ? 'https://www.google-analytics.com/mp/collect?measurement_id=G-TESZT00001' : 'zapier-webhook: GOOGLE_ARNYEK_WEBHOOK_URL (titok, nem naplozott)',
  cel: platform === 'meta' ? { dataset: ARNYEK.meta.datasetId, nev: ARNYEK.meta.nev, test_event_code: 'TEST1' }
    : platform === 'tiktok' ? { pixel_code: ARNYEK.tiktok.pixelCode, nev: ARNYEK.tiktok.nev, test_event_code: 'TEST2' }
      : platform === 'ga4' ? { measurement_id: 'G-TESZT00001' }
        : { customer_id: ARNYEK.google.customerId, conversion_action_id: '7825199989', athidalas: 'zapier-webhook' },
});

// ---------- N1: a Budapest-nap UTC-intervalluma ----------
test('N1 Budapest-nap -> UTC: nyar, tel, atallasi napok; ervenytelen datum = null', () => {
  const KESOBB = Date.UTC(2026, 10, 5, 12); // a tavaszi / oszi atallasi napok miatt kesobbi "most"
  const i = (d) => { const n = napIntervallum(d, KESOBB); return n && [new Date(n.from_ms).toISOString(), new Date(n.to_ms).toISOString()]; };
  assert.deepEqual(i('2026-10-12'), ['2026-10-11T22:00:00.000Z', '2026-10-12T22:00:00.000Z']); // CEST
  assert.deepEqual(i('2026-01-15'), ['2026-01-14T23:00:00.000Z', '2026-01-15T23:00:00.000Z']); // CET
  assert.deepEqual(i('2026-10-25'), ['2026-10-24T22:00:00.000Z', '2026-10-25T23:00:00.000Z']); // oszi atallas: 25 oras nap
  assert.deepEqual(i('2026-03-29'), ['2026-03-28T23:00:00.000Z', '2026-03-29T22:00:00.000Z']); // tavaszi atallas: 23 oras nap
  assert.equal(budapestEjfel('2026-10-25'), Date.UTC(2026, 9, 24, 22));
  for (const rossz of ['', null, undefined, '2026-2-3', '2026-02-30', '2026-13-01', '2025-12-31', '2026-10-15', '12026-10-12', "2026-10-12'; DROP TABLE x;--", '2026-10-12T00:00:00Z']) assert.equal(napIntervallum(rossz, MOST), null, String(rossz));
  assert.ok(napIntervallum('2026-10-14', MOST), 'a "holnap" meg megengedett (a Budapest-nap mar elkezdodhet)');
});

// ---------- N2: hitelesites, metodus, fejlecek ----------
test('N2 401 (nincs kulcs) / 403 (rossz kulcs) / 405 (nem GET) / URL-kulcs nem jo / no-store', async () => {
  const w = await vilag();
  assert.equal((await w.kerj(undefined, { kulcs: '' })).status, 401);
  assert.equal((await w.kerj(undefined, { kulcs: 'rossz' })).status, 403);
  const urlKulcs = await w.kerj(`qa=nap&datum=${NAP}&kulcs=${KULCS_SZOVEG}`, { kulcs: '' });
  assert.equal(urlKulcs.status, 401, 'a kulcs az URL-ben (naploba kerulhet) NEM fogadhato el');
  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) assert.equal((await w.kerj(undefined, { method })).status, 405, method);
  const ok = await w.kerj();
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('cache-control'), 'no-store');
  assert.match(ok.headers.get('content-type'), /application\/json/);
  for (const r of [await w.kerj(undefined, { kulcs: '' }), await w.kerj(undefined, { kulcs: 'rossz' })]) assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.equal((await w.kerj(undefined, { env: { ...w.e, EGYEZTETES_KULCS_HASH: '' } })).status, 403, 'kulcs-hash nelkul semmi nem nyilik ki');
  assert.equal((await w.kerj(undefined, { env: { ...w.e, KULCS_DB: undefined } })).status, 503);
});

test('N3 rate-limit: 30 kereses / perc / IP (429), a rossz kulcs 5 / perc utan 429; mas IP nincs erintve; az ablak lejar', async () => {
  const w = await vilag();
  for (let i = 0; i < 30; i++) assert.equal((await w.kerj(undefined, { ip: '9.9.9.9' })).status, 200, `#${i + 1}`);
  assert.equal((await w.kerj(undefined, { ip: '9.9.9.9' })).status, 429);
  assert.equal((await w.kerj(undefined, { ip: '8.8.8.8' })).status, 200);
  assert.equal((await w.kerj(undefined, { ip: '9.9.9.9', now: MOST + 61000 })).status, 200, 'egy perc mulva ujra nyitva');
  qaKorlatNullaz();
  const st = []; for (let i = 0; i < 8; i++) st.push((await w.kerj(undefined, { ip: '7.7.7.7', kulcs: 'rossz' })).status);
  assert.deepEqual(st, [403, 403, 403, 403, 403, 429, 429, 429]);
});

test('N4 hibas parameterek: datum (400) es proba (400); a kapcsolok / fuggo / source_id admin-agak valtozatlanok', async () => {
  const w = await vilag();
  assert.equal((await w.kerj('qa=nap')).status, 400);
  assert.equal((await w.kerj('qa=nap&datum=2026-02-30')).status, 400);
  assert.equal((await w.kerj(`qa=nap&datum=${NAP}&proba=zzzzzzzz`)).status, 400);
  assert.equal((await w.kerj(`qa=nap&datum=${NAP}&proba=${Array.from({ length: 101 }, (_, i) => String(i).padStart(8, '0')).join(',')}`)).status, 400);
  assert.equal((await w.kerj(`qa=nap&datum=${NAP}&proba=abcdef01,ABCDEF02`)).status, 200);
  // a tobbi admin-ag valtozatlan: kulcs nelkul 404 (nem 401), kulccsal a sajat valasza
  assert.equal((await w.kerj('kapcsolok=1', { kulcs: '' })).status, 404);
  assert.equal((await w.kerj('kapcsolok=1')).status, 200);
  assert.equal((await w.kerj('fuggo=1')).status, 200);
  assert.equal((await w.kerj('')).status, 400); // source_id kell
  assert.equal((await w.kerj('qa=egyeb&kapcsolok=1')).status, 200, 'csak a qa=nap kerul az uj agra');
});

// ---------- N5: valos ----------
test('N5 valos: a nap hatarai [from, to), uzletagonkent, parositott / parositatlan, lemondasok, probak nelkul', async () => {
  const w = await vilag();
  const u = (p) => w.uuid(p);
  w.egyeztetes({ uuid: u('b0'), kulcs: HEADSPA(), t: FROM - 1 }); // elozo nap 23:59:59 Budapest
  w.egyeztetes({ uuid: u('b1'), kulcs: HEADSPA(), t: FROM }); // pontosan ejfel: bent
  w.egyeztetes({ uuid: u('b2'), kulcs: HEADSPA(2), t: TO - 1 }); // 23:59:59: bent
  w.egyeztetes({ uuid: u('b3'), kulcs: HEADSPA(), t: TO }); // kovetkezo nap ejfel: kint
  w.egyeztetes({ uuid: u('b4'), kulcs: FODRASZ(), t: FROM + 3600, allapot: 'parositatlan' });
  w.egyeztetes({ uuid: u('b5'), kulcs: OXIGEN(), t: FROM + 7200, allapot: 'fuggoben' });
  w.egyeztetes({ uuid: u('b6'), kulcs: SZOR(), t: FROM + 7300 });
  w.egyeztetes({ uuid: u('b7'), kulcs: PMU(), t: FROM + 7400 });
  w.egyeztetes({ uuid: u('b8'), kulcs: null, t: FROM + 7500, allapot: 'parositatlan' }); // kulcs nelkul: ismeretlen uzletag
  w.lemondas({ kulcs: HEADSPA(), eredmeny: 'felszabadult (1 jelolt var a sajat levelere: ott, elo ellenorzes utan kapja meg)', t: FROM + 10 });
  w.lemondas({ kulcs: HEADSPA(), eredmeny: 'nincs bejegyzes', t: FROM + 20 });
  w.lemondas({ kulcs: FODRASZ(), eredmeny: 'a birtokos foglalas EL: a kulcs nem szabadul fel (az ertesito mas, korabbi foglalasra vonatkozik)', t: FROM + 30 });
  w.lemondas({ kulcs: PMU(), eredmeny: 'nem ellenorizheto: a birtokos foglalas Salonic-UUID-ja ismeretlen', t: FROM + 40 });
  w.lemondas({ kulcs: PMU(), eredmeny: 'valami ujabb szoveg', t: FROM + 50 });
  w.lemondas({ kulcs: HEADSPA(), t: FROM - 5 }); // kint
  const j = await w.jelentes();
  assert.equal(j.datum, NAP); assert.equal(j.timezone, 'Europe/Budapest');
  assert.equal(j.from_utc, '2026-10-11T22:00:00Z'); assert.equal(j.to_utc, '2026-10-12T22:00:00Z');
  const v = (n) => j.uzletagak[n].valos;
  assert.deepEqual([v('headspa').letrehozo_level, v('headspa').parositott], [2, 2]);
  assert.deepEqual([v('fodrasz').letrehozo_level, v('fodrasz').parositott, v('fodrasz').parositatlan], [1, 0, 1]);
  assert.deepEqual([v('oxigen').letrehozo_level, v('oxigen').egyeb_allapot], [1, 1]);
  assert.equal(v('szor').letrehozo_level, 1); assert.equal(v('pmu').letrehozo_level, 1);
  assert.equal(j.uzletagak.ismeretlen.valos.letrehozo_level, 1, 'a kulcs nelkuli sor nem vész el, kulon "ismeretlen" uzletagban latszik');
  assert.deepEqual(v('headspa').lemondas, { db: 2, felszabadult: 1, nincs_bejegyzes: 1, nem_ellenorizheto: 0, birtokos_el: 0, egyeb: 0 });
  assert.equal(v('fodrasz').lemondas.birtokos_el, 1); assert.equal(v('pmu').lemondas.nem_ellenorizheto, 1); assert.equal(v('pmu').lemondas.egyeb, 1);
  assert.equal(j.osszes.valos.letrehozo_level, 7); assert.equal(j.osszes.valos.lemondas, 5);
});

test('N6 proba-szabaly: alapbol minden sor valos; a ?proba=<uuid8> kizarja (es megmutatja, mit zart ki)', async () => {
  const w = await vilag();
  const a = w.egyeztetes({ uuid: 'aaaa1111-0000-4000-8000-000000000001', kulcs: HEADSPA(), t: FROM + 100 });
  w.egyeztetes({ uuid: 'bbbb2222-0000-4000-8000-000000000002', kulcs: HEADSPA(), t: FROM + 200 });
  assert.equal((await w.jelentes()).uzletagak.headspa.valos.letrehozo_level, 2);
  const j = await w.jelentes(`qa=nap&datum=${NAP}&proba=${a.slice(0, 8)}`);
  assert.equal(j.uzletagak.headspa.valos.letrehozo_level, 1);
  assert.equal(j.uzletagak.headspa.valos.proba_kizarva, 1);
  assert.deepEqual(j.proba_megadva, [a.slice(0, 8)]);
  assert.match(j.proba_szabaly, /minden foglalas_egyeztetes sor valos/);
});

// ---------- N7: arnyek + lampa ----------
test('N7 arnyek: platformonkent x allapot x forras; alap-esemeny szamlalo; lampa sarga ha Meta/TikTok < 0,9 x valos, n/a ha valos=0; GA4 / Google tajekoztato', async () => {
  const w = await vilag();
  // headspa: 10 valos, Meta 9 alap elkuldve (0,9 -> zold), TikTok 8 (sarga); fodrasz: 5 valos, 0 kuldes -> sarga; oxigen: 0 valos -> n/a
  for (let i = 0; i < 10; i++) w.egyeztetes({ uuid: w.uuid('c0'), kulcs: HEADSPA(), t: FROM + 100 + i });
  for (let i = 0; i < 5; i++) w.egyeztetes({ uuid: w.uuid('c1'), kulcs: FODRASZ(), t: FROM + 200 + i });
  let n = 0;
  for (let i = 0; i < 9; i++) w.kuldes({ esemeny_id: 'm' + ++n, platform: 'meta', uzletag: 'headspa', t: FROM + 300 + i });
  for (let i = 0; i < 8; i++) w.kuldes({ esemeny_id: 't' + ++n, platform: 'tiktok', uzletag: 'headspa', t: FROM + 300 + i });
  w.kuldes({ esemeny_id: 'e1', platform: 'meta', uzletag: 'headspa', tipus: 'ernyo', platform_nev: 'Schedule', t: FROM + 400 }); // ernyo: nem szamit a 0,9-be
  w.kuldes({ esemeny_id: 'e2', platform: 'meta', uzletag: 'headspa', platform_nev: 'HeadSpa_Ajandekkartya', t: FROM + 401 }); // ajandekkartya: nem foglalas-level
  w.kuldes({ esemeny_id: 'e3', platform: 'meta', uzletag: 'headspa', allapot: 'tiltva', t: FROM + 402, kerelem: null });
  w.kuldes({ esemeny_id: 'e4', platform: 'meta', uzletag: 'headspa', allapot: 'kihagyva', t: FROM + 403, kerelem: null });
  w.kuldes({ esemeny_id: 'e5', platform: 'meta', uzletag: 'headspa', allapot: 'hiba', t: FROM + 404, kerelem: cel('meta') });
  w.kuldes({ esemeny_id: 'g1', platform: 'ga4', uzletag: 'headspa', t: FROM + 405 });
  w.kuldes({ esemeny_id: 'g2', platform: 'google', uzletag: 'headspa', platform_nev: 'ARNYEK-7825199989', t: FROM + 406 });
  w.kuldes({ esemeny_id: 's1', platform: 'meta', uzletag: 'headspa', forras: 'salonic_direct', platform_nev: 'HeadSpa_FoglalasElso', t: FROM + 407 });
  w.kuldes({ esemeny_id: 'o1', platform: 'meta', uzletag: 'headspa', t: FROM - 1 }); // elozo nap: kint
  const j = await w.jelentes();
  const a = j.uzletagak.headspa.arnyek;
  assert.equal(a.meta.elkuldve, 12, '9 alap + ernyo + ajandekkartya + sd (minden elkuldve, forrastol / tipustol fuggetlenul)');
  assert.equal(a.meta.alap_elkuldve, 10, '9 motor + 1 salonic_direct; az ernyo es az ajandekkartya nem szamit');
  assert.equal(a.meta.tiltva, 1); assert.equal(a.meta.kihagyva, 1); assert.equal(a.meta.hiba, 1);
  assert.equal(a.meta.forras.motor.elkuldve, 11); assert.equal(a.meta.forras.salonic_direct.elkuldve, 1);
  assert.equal(a.meta.lampa, 'zold', '10 >= 0,9 x 10'); assert.equal(a.meta.arany, 1); assert.equal(a.tiktok.arany, 0.8);
  assert.equal(j.uzletagak.oxigen.arnyek.meta.arany, null, 'valos=0 -> nincs arany');
  assert.equal(a.tiktok.alap_elkuldve, 8); assert.equal(a.tiktok.lampa, 'sarga', '8 < 9');
  assert.equal(a.ga4.lampa, 'tajekoztato'); assert.equal(a.google.lampa, 'tajekoztato'); assert.equal(a.ga4.elkuldve, 1); assert.equal(a.google.elkuldve, 1);
  assert.equal(j.uzletagak.headspa.lampa, 'sarga');
  assert.equal(j.uzletagak.fodrasz.arnyek.meta.lampa, 'sarga', '5 valos, 0 kuldes');
  assert.equal(j.uzletagak.oxigen.arnyek.meta.lampa, 'n/a', 'valos=0 -> n/a');
  assert.equal(j.uzletagak.oxigen.lampa, 'zold');
  assert.equal(j.lampa, 'sarga');
  assert.deepEqual(j.szekcio_hibak, []);
});

test('N7b lampa-alap a valos.parositott (meresi oldal / GPT dontese, #167 134. komment): a parositatlan level nem tesz sargava; valos > 0, de parositott = 0 -> n/a; az arany a valos-hoz, az arany_parositott a lampa alapjahoz', async () => {
  const w = await vilag();
  for (let i = 0; i < 8; i++) w.egyeztetes({ uuid: w.uuid('l0'), kulcs: HEADSPA(), t: FROM + 10 + i, allapot: 'parositott' });
  for (let i = 0; i < 2; i++) w.egyeztetes({ uuid: w.uuid('l1'), kulcs: HEADSPA(), t: FROM + 30 + i, allapot: 'parositatlan' });
  for (let i = 0; i < 8; i++) { w.kuldes({ esemeny_id: 'm' + i, platform: 'meta', uzletag: 'headspa', t: FROM + 100 + i }); w.kuldes({ esemeny_id: 't' + i, platform: 'tiktok', uzletag: 'headspa', t: FROM + 100 + i }); }
  w.egyeztetes({ uuid: w.uuid('l2'), kulcs: PMU(), t: FROM + 50, allapot: 'parositatlan' }); // csak parositatlan
  let j = await w.jelentes();
  const h = j.uzletagak.headspa;
  assert.deepEqual([h.valos.letrehozo_level, h.valos.parositott, h.valos.parositatlan], [10, 8, 2]);
  assert.equal(h.arnyek.meta.lampa, 'zold', '8 alap >= 0,9 x 8 parositott (a valos=10 szerint sarga lenne)');
  assert.equal(h.arnyek.meta.arany, 0.8); assert.equal(h.arnyek.meta.arany_parositott, 1);
  assert.equal(h.lampa, 'zold'); assert.equal(j.lampa, 'zold');
  assert.equal(j.uzletagak.pmu.valos.letrehozo_level, 1);
  assert.equal(j.uzletagak.pmu.arnyek.meta.lampa, 'n/a', 'nincs parositott level -> nincs mihez merni');
  assert.equal(j.uzletagak.pmu.arnyek.meta.arany_parositott, null);
  w.futtat("DELETE FROM meres_kuldes WHERE esemeny_id IN ('m0', 'm1')");
  j = await w.jelentes();
  assert.equal(j.uzletagak.headspa.arnyek.meta.lampa, 'sarga', '6 alap < 0,9 x 8'); assert.equal(j.uzletagak.headspa.arnyek.tiktok.lampa, 'zold');
  assert.equal(j.lampa, 'sarga');
});

test('N8 lampa: pontosan 0,9 x valos zold; ures nap zold; a sarga a piros alatt marad', async () => {
  const w = await vilag();
  assert.equal((await w.jelentes()).lampa, 'zold');
  for (let i = 0; i < 20; i++) w.egyeztetes({ uuid: w.uuid('d0'), kulcs: PMU(), t: FROM + i });
  for (let i = 0; i < 18; i++) { w.kuldes({ esemeny_id: 'm' + i, platform: 'meta', uzletag: 'pmu', t: FROM + 100 + i }); w.kuldes({ esemeny_id: 't' + i, platform: 'tiktok', uzletag: 'pmu', t: FROM + 100 + i }); }
  assert.equal((await w.jelentes()).uzletagak.pmu.lampa, 'zold', '18 = 0,9 x 20: nem kevesebb');
  w.futtat("DELETE FROM meres_kuldes WHERE esemeny_id = 'm0'");
  const j = await w.jelentes();
  assert.equal(j.uzletagak.pmu.arnyek.meta.lampa, 'sarga'); assert.equal(j.uzletagak.pmu.arnyek.tiktok.lampa, 'zold'); assert.equal(j.lampa, 'sarga');
});

// ---------- N9: biztonsag ----------
test('N9 biztonsag: elo azonosito a kerelemben, dupla elkuldve, nem arnyek cel -> piros; tiszta nap = 0 / 0 / 0', async () => {
  const w = await vilag();
  w.kuldes({ esemeny_id: 'ok1', platform: 'meta', uzletag: 'headspa', t: FROM + 1 });
  w.kuldes({ esemeny_id: 'ok2', platform: 'tiktok', uzletag: 'headspa', t: FROM + 2 });
  w.kuldes({ esemeny_id: 'ok3', platform: 'ga4', uzletag: 'headspa', t: FROM + 3 });
  w.kuldes({ esemeny_id: 'ok4', platform: 'google', uzletag: 'headspa', platform_nev: 'ARNYEK-7825199989', t: FROM + 4 });
  let j = await w.jelentes();
  assert.deepEqual(j.osszes.biztonsag, { elo_id_talalat: 0, dupla: 0, nem_arnyek_cel: 0 });
  assert.equal(j.lampa, 'zold');

  // 1) elo azonosito a kerelem barmely helyen (a cel mezo nelkul is): mindegyik elo ID-t megfogja
  const eloIdk = [...ELO_CELOK.meta, ...ELO_CELOK.tiktok, ...ELO_CELOK.ga4, ...ELO_CELOK.google_primary];
  eloIdk.forEach((id, i) => w.kuldes({ esemeny_id: 'elo' + i, platform: 'meta', uzletag: 'fodrasz', allapot: 'tiltva', t: FROM + 10 + i, kerelem: { url: `https://x/${id}/events` } }));
  w.kuldes({ esemeny_id: 'nem-elo', platform: 'meta', uzletag: 'fodrasz', allapot: 'tiltva', t: FROM + 99, kerelem: { x: '1' + ELO_CELOK.meta[0] + '9', ido: 17918851870 } }); // csak hosszabb szam resze: NEM talalat
  j = await w.jelentes();
  assert.equal(j.uzletagak.fodrasz.biztonsag.elo_id_talalat, eloIdk.length);
  assert.equal(j.uzletagak.fodrasz.lampa, 'piros'); assert.equal(j.lampa, 'piros');
  assert.equal(j.uzletagak.headspa.lampa, 'zold', 'a masik uzletag lampaja onallo (nincs valos -> n/a, nem piros)');
});

test('N10 dupla es nem_arnyek_cel kulon-kulon pirosra visz; a unique index mellett a dupla "0" (a vedelem), index nelkul kimutatja', async () => {
  const w = await vilag();
  w.kuldes({ esemeny_id: 'x1', platform: 'meta', uzletag: 'oxigen', t: FROM + 1 });
  assert.throws(() => w.kuldes({ esemeny_id: 'x1', platform: 'meta', uzletag: 'oxigen', t: FROM + 2 }), /UNIQUE/, 'a sema maga is tiltja a duplat');
  w.futtat('DROP INDEX meres_kuldes_egyedi'); // ha a vedelem valamiert hianyozna: a jelentes akkor is kimutatja
  w.kuldes({ esemeny_id: 'x1', platform: 'meta', uzletag: 'oxigen', t: FROM + 3 });
  w.kuldes({ esemeny_id: 'x1', platform: 'tiktok', uzletag: 'oxigen', t: FROM + 4 }); // mas platform: nem dupla
  w.kuldes({ esemeny_id: 'x2', platform: 'meta', uzletag: 'oxigen', allapot: 'tiltva', t: FROM + 5, kerelem: null });
  w.kuldes({ esemeny_id: 'x2', platform: 'meta', uzletag: 'oxigen', allapot: 'kihagyva', t: FROM + 6, kerelem: null }); // nem "elkuldve": nem dupla
  let j = await w.jelentes();
  assert.equal(j.uzletagak.oxigen.biztonsag.dupla, 1); assert.equal(j.lampa, 'piros');

  const v = await vilag();
  v.kuldes({ esemeny_id: 'y1', platform: 'meta', uzletag: 'szor', t: FROM + 1, kerelem: { url: 'https://graph.facebook.com/v23.0/1234567890/events', cel: { dataset: '1234567890', test_event_code: 'T' } } }); // nem az ARNYEK dataset
  j = await v.jelentes();
  assert.equal(j.uzletagak.szor.biztonsag.nem_arnyek_cel, 1); assert.equal(j.uzletagak.szor.biztonsag.elo_id_talalat, 0); assert.equal(j.lampa, 'piros');
});

test('N11 arnyekCel: a kuldott kerelem csak az ARNYEK celpontokra "jo" (Meta tesztkoddal, TikTok tesztkoddal, GA4 nem elo, Google ARNYEK akcio); minden mas / olvashatatlan = nem', () => {
  const m = cel('meta'); const t = cel('tiktok'); const g = cel('ga4'); const go = cel('google');
  const be = (platform, k, e = { GA4_TESZT_MEASUREMENT_ID: 'G-TESZT00001' }) => arnyekCel({ platform, kerelem: k === null ? null : typeof k === 'string' ? k : JSON.stringify(k) }, e);
  assert.ok(be('meta', m)); assert.ok(be('tiktok', t)); assert.ok(be('ga4', g)); assert.ok(be('google', go));
  assert.ok(be('ga4', { cel: { measurement_id: 'G-BARMI0001' } }, {}), 'env nelkul: barmilyen nem elo G- azonosito');
  assert.ok(!be('ga4', { cel: { measurement_id: 'G-BARMI0001' } }), 'ha van GA4_TESZT_MEASUREMENT_ID, csak az az egy');
  assert.ok(!be('ga4', { cel: { measurement_id: ELO_CELOK.ga4[0] } }, {}), 'az elo property soha');
  assert.ok(!be('meta', { ...m, cel: { ...m.cel, test_event_code: '' } }), 'tesztkod nelkul nem');
  assert.ok(!be('meta', { ...m, cel: { ...m.cel, dataset: ELO_CELOK.meta[0] } }));
  assert.ok(!be('meta', { url: `https://graph.facebook.com/v23.0/${ELO_CELOK.meta[0]}/events`, cel: m.cel }), 'az url-ben mas dataset');
  assert.ok(!be('tiktok', { cel: { pixel_code: ELO_CELOK.tiktok[0], test_event_code: 'T' } }));
  assert.ok(!be('tiktok', { cel: { pixel_code: ARNYEK.tiktok.pixelCode } }), 'tesztkod nelkul nem');
  assert.ok(!be('google', { cel: { customer_id: ARNYEK.google.customerId, conversion_action_id: ELO_CELOK.google_primary[0] } }));
  assert.ok(!be('google', { cel: { customer_id: '1', conversion_action_id: '7825199989' } }));
  assert.ok(!be('meta', null)); assert.ok(!be('meta', 'nem json')); assert.ok(!be('meta', '[]')); assert.ok(!be('meta', {})); assert.ok(!be('masik', m));
  assert.ok(be('meta', JSON.stringify({ ...m, cel: JSON.stringify(m.cel) })), 'a cel szovegkent tarolt alakja is');
});

// ---------- N12: sd ----------
test('N12 sd: sd_allapot szerint (uzletagonkent, a nap sd_ido-je szerint) es a csere-felismeres (foglalas_reschedule.allapot)', async () => {
  const w = await vilag();
  const p1 = w.egyeztetes({ uuid: w.uuid('e0'), kulcs: null, t: FROM - 86400, sd_allapot: 'pending', sd_ido: FROM + 100 });
  w.vendeg({ uuid: p1, uzletag: 'pmu', forras: 'sd_atvetel', t: FROM + 100 });
  const p2 = w.egyeztetes({ uuid: w.uuid('e1'), kulcs: null, t: FROM + 5, sd_allapot: 'kuldve', sd_ido: FROM + 200 });
  w.vendeg({ uuid: p2, uzletag: 'pmu', forras: 'sd_atvetel', t: FROM + 200 });
  w.egyeztetes({ uuid: w.uuid('e2'), kulcs: OXIGEN(), t: FROM + 6, sd_allapot: 'kuldve', sd_ido: FROM + 300 }); // nincs vendeg-sor: a kulcs adja az uzletagot
  w.egyeztetes({ uuid: w.uuid('e3'), kulcs: PMU(), t: FROM + 7, sd_allapot: 'kuldve', sd_ido: FROM - 100 }); // elozo nap: kint
  w.reschedule({ uuid: p1, allapot: 'reschedule_felismert', t: FROM + 400 });
  w.reschedule({ uuid: p2, allapot: 'bizonytalan_cserekor_nincs_uj_konverzio', t: FROM + 500 });
  w.reschedule({ uuid: w.uuid('e4'), allapot: 'reschedule_felismert', t: TO + 5 }); // kovetkezo nap: kint
  const j = await w.jelentes();
  assert.deepEqual(j.uzletagak.pmu.sd.sd_allapot, { pending: 1, kuldve: 1 });
  assert.deepEqual(j.uzletagak.oxigen.sd.sd_allapot, { kuldve: 1 });
  assert.deepEqual(j.uzletagak.pmu.sd.csere, { reschedule_felismert: 1, bizonytalan_cserekor_nincs_uj_konverzio: 1 });
  assert.deepEqual(j.uzletagak.pmu.foglalas_vendeg, { sd_atvetel: 2 });
});

// ---------- N13: pre288_missing_hmac_index ----------
test('N13 pre288: #288 elotti uuid, nincs foglalas_vendeg sora, lemondas +-60 percen belul, ugyanabban az uzletagban -> db + minta (uuid_prefix 8 kar., uzletag, ido)', async () => {
  const w = await vilag();
  const regiTalalat = w.egyeztetes({ uuid: 'aaaaaaaa-1111-4111-8111-000000000001', kulcs: HEADSPA(), t: PRE288_EPOCH - 3 * 86400 });
  const regiVendeggel = w.egyeztetes({ uuid: 'bbbbbbbb-1111-4111-8111-000000000002', kulcs: HEADSPA(), t: PRE288_EPOCH - 3 * 86400 });
  w.vendeg({ uuid: regiVendeggel, uzletag: 'headspa', t: PRE288_EPOCH - 3 * 86400 });
  const regiMasUzletag = w.egyeztetes({ uuid: 'cccccccc-1111-4111-8111-000000000003', kulcs: FODRASZ(), t: PRE288_EPOCH - 3 * 86400 });
  const regiTavoli = w.egyeztetes({ uuid: 'dddddddd-1111-4111-8111-000000000004', kulcs: HEADSPA(), t: PRE288_EPOCH - 3 * 86400 });
  const regiUtana = w.egyeztetes({ uuid: 'eeeeeeee-1111-4111-8111-000000000005', kulcs: HEADSPA(), t: PRE288_EPOCH + 10 }); // mar a #288 utan jott letre: hash-indexe lenne
  // aznapi uj foglalasok: u1 (headspa), u2 (headspa, sd), u3 (fodrasz)
  const u1 = w.egyeztetes({ uuid: 'f1f1f1f1-2222-4222-8222-000000000011', kulcs: HEADSPA(2), t: FROM + 10000 });
  const u2 = w.egyeztetes({ uuid: 'f2f2f2f2-2222-4222-8222-000000000012', kulcs: null, t: FROM + 20000, sd_allapot: 'kuldve', sd_ido: FROM + 21000 });
  w.vendeg({ uuid: u2, uzletag: 'headspa', forras: 'sd_atvetel', t: FROM + 20000 });
  const u3 = w.egyeztetes({ uuid: 'f3f3f3f3-2222-4222-8222-000000000013', kulcs: FODRASZ(2), t: FROM + 30000 });
  w.lemondas({ kulcs: HEADSPA(), tulajdonos_uuid: regiTalalat, t: FROM + 10000 + 59 * 60 }); // u1 +59 perc: TALALAT
  w.lemondas({ kulcs: HEADSPA(), tulajdonos_uuid: regiVendeggel, t: FROM + 10000 }); // van hash-index: nem
  w.lemondas({ kulcs: FODRASZ(), tulajdonos_uuid: regiMasUzletag, t: FROM + 10000 }); // fodrasz regi, de a kozeli uj foglalas headspa: mas uzletag, nem
  w.lemondas({ kulcs: HEADSPA(), tulajdonos_uuid: regiTavoli, t: FROM + 10000 + 61 * 60 }); // u1 +61 perc: nem (u2 -tol meg messzebb)
  w.lemondas({ kulcs: HEADSPA(), tulajdonos_uuid: regiUtana, t: FROM + 10000 }); // a #288 utan letrehozott: nem
  w.lemondas({ kulcs: HEADSPA(), tulajdonos_uuid: regiTalalat, t: FROM + 20000 - 3500 }); // u2 -58 perc: TALALAT (az sd-foglalas mellett is)
  w.lemondas({ kulcs: FODRASZ(), tulajdonos_uuid: regiMasUzletag, t: FROM + 30000 + 600 }); // u3 mellett ugyanabban az uzletagban, de nincs vendeg-sor: TALALAT (fodrasz)
  const j = await w.jelentes();
  const h = j.uzletagak.headspa.pre288_missing_hmac_index;
  assert.equal(h.db, 2, 'u1 es u2 (ugyanaz a regi foglalas mindketto mellett)');
  assert.deepEqual(h.mintak.map((m) => m.uuid_prefix).sort(), ['f1f1f1f1', 'f2f2f2f2']);
  for (const m of h.mintak) { assert.deepEqual(Object.keys(m).sort(), ['ido', 'uuid_prefix', 'uzletag']); assert.equal(m.uzletag, 'headspa'); assert.match(m.ido, /^2026-10-1[12]T\d\d:\d\d:\d\dZ$/); assert.equal(m.uuid_prefix.length, 8); }
  assert.equal(j.uzletagak.fodrasz.pre288_missing_hmac_index.db, 1);
  assert.equal(j.uzletagak.fodrasz.pre288_missing_hmac_index.mintak[0].uuid_prefix, 'f3f3f3f3');
  assert.equal(j.osszes.pre288_missing_hmac_index, 3);
  assert.notEqual(j.lampa, 'piros', 'a pre288 tajekoztato adat: onmagaban nem piros');
  // probakent megadott uj foglalas nem szamit
  const k = await w.jelentes(`qa=nap&datum=${NAP}&proba=f1f1f1f1`);
  assert.equal(k.uzletagak.headspa.pre288_missing_hmac_index.db, 1);
  void u3; void u1;
});

test('N14 pre288: a minta legfeljebb 20 elem, a db a teljes szam', async () => {
  const w = await vilag();
  const regi = w.egyeztetes({ uuid: 'aaaaaaaa-1111-4111-8111-000000000001', kulcs: HEADSPA(), t: PRE288_EPOCH - 86400 });
  for (let i = 0; i < 25; i++) {
    w.egyeztetes({ uuid: `${(0x10000000 + i).toString(16)}-2222-4222-8222-0000000000${String(i).padStart(2, '0')}`, kulcs: HEADSPA(2), t: FROM + 1000 + i * 60 });
  }
  w.lemondas({ kulcs: HEADSPA(), tulajdonos_uuid: regi, t: FROM + 1000 + 600 });
  const h = (await w.jelentes()).uzletagak.headspa.pre288_missing_hmac_index;
  assert.equal(h.db, 25); assert.equal(h.mintak.length, 20);
});

// ---------- N15: foglalas_vendeg ----------
test('N15 foglalas_vendeg: a nap uj sorai forras szerint, uzletagonkent', async () => {
  const w = await vilag();
  for (const [uz, f, t] of [['headspa', 'level', FROM + 1], ['headspa', 'level', FROM + 2], ['headspa', 'sd_atvetel', FROM + 3], ['fodrasz', 'level', FROM + 4], ['pmu', 'sd_atvetel', TO - 1], ['pmu', 'level', TO], ['oxigen', 'level', FROM - 1]]) w.vendeg({ uuid: w.uuid('f0'), uzletag: uz, forras: f, t });
  const j = await w.jelentes();
  assert.deepEqual(j.uzletagak.headspa.foglalas_vendeg, { level: 2, sd_atvetel: 1 });
  assert.deepEqual(j.uzletagak.fodrasz.foglalas_vendeg, { level: 1 });
  assert.deepEqual(j.uzletagak.pmu.foglalas_vendeg, { sd_atvetel: 1 });
  assert.deepEqual(j.uzletagak.oxigen.foglalas_vendeg, {});
  assert.equal(j.osszes.foglalas_vendeg, 5);
});

// ---------- N16: PII ----------
test('N16 PII-mentes: nincs nev / e-mail / telefon / hash / teljes UUID a valaszban (csak a pre288 mintak 8 karakteres uuid-elotagja)', async () => {
  const w = await vilag();
  const NEV_H = 'a'.repeat(63) + '1'; const TEL_H = 'b'.repeat(63) + '2'; const EMAIL_H = 'c'.repeat(63) + '3';
  const regi = w.egyeztetes({ uuid: '12345678-aaaa-4bbb-8ccc-1234567890ab', kulcs: PMU(), t: PRE288_EPOCH - 86400 });
  const uj = w.egyeztetes({ uuid: '9abcdef0-aaaa-4bbb-8ccc-1234567890ab', kulcs: PMU(2), t: FROM + 5000 });
  w.vendeg({ uuid: uj, uzletag: 'pmu', nev_h: NEV_H, tel_h: TEL_H, email_h: EMAIL_H, forras: 'sd_atvetel', t: FROM + 5000 });
  w.lemondas({ kulcs: PMU(), tulajdonos_uuid: regi, t: FROM + 5100 });
  w.kuldes({ esemeny_id: 'abcdef12-3456-4789-8abc-def012345678', platform: 'meta', uzletag: 'pmu', t: FROM + 6000, kerelem: { ...cel('meta'), body: { data: [{ user_data: { em: [EMAIL_H], ph: [TEL_H] }, email: 'vendeg@example.com' }] } } });
  const szoveg = JSON.stringify(await w.jelentes());
  for (const tiltott of [NEV_H, TEL_H, EMAIL_H, 'vendeg@example.com', '12345678-aaaa', '9abcdef0-aaaa', 'abcdef12-3456', '1234567890ab', 'user_data']) assert.ok(!szoveg.includes(tiltott), `nem szabad szerepelnie: ${tiltott}`);
  assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i.test(szoveg), 'teljes UUID semmilyen alakban');
  assert.ok(!/[0-9a-f]{32,}/i.test(szoveg), 'hash / hosszu hex semmilyen alakban');
  assert.ok(!szoveg.includes('@'));
  assert.ok(szoveg.includes('9abcdef0'), 'a 8 karakteres elotag a pre288 mintaban latszik');
  assert.ok(!szoveg.includes(KULCS_SZOVEG) && !szoveg.includes(KULCS_HASH), 'a kulcs / hash sem');
});

// ---------- N17: csak olvas ----------
test('N17 CSAK OLVAS: egy jelentes sem ir, nem hoz letre tablat, nem valtoztat sort (ures adatbazison sem)', async () => {
  const w = await vilag();
  w.egyeztetes({ uuid: w.uuid('g0'), kulcs: HEADSPA(), t: FROM + 1 });
  w.kuldes({ esemeny_id: 'z1', platform: 'meta', uzletag: 'headspa', t: FROM + 2 });
  const dump = () => JSON.stringify(w.sql("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").map((t) => [t.name, t.name.startsWith('sqlite_') ? null : w.sql(`SELECT * FROM ${t.name}`)]));
  const elotte = dump();
  for (let i = 0; i < 3; i++) await w.jelentes();
  await w.jelentes(`qa=nap&datum=${NAP}&proba=abcdef01`);
  assert.equal(dump(), elotte);

  const u = await vilag({ semak: false });
  const j = await u.jelentes();
  assert.equal(u.sql("SELECT name FROM sqlite_master WHERE type='table'").length, 0, 'ures adatbazison sem hoz letre tablat');
  assert.equal(j.lampa, 'zold'); assert.deepEqual(j.szekcio_hibak, []);
  assert.equal(j.osszes.valos.letrehozo_level, 0);
});

test('N18 a SQL csak SELECT / PRAGMA: a modul semmilyen irasi utasitast nem add ki', async () => {
  const w = await vilag();
  const lekerdezesek = [];
  const db = { prepare: (sql) => { lekerdezesek.push(sql); return w.db.prepare(sql); } };
  w.egyeztetes({ uuid: w.uuid('h0'), kulcs: HEADSPA(), t: FROM + 1 });
  await qaNap(db, napIntervallum(NAP, MOST), { mostMs: MOST });
  assert.ok(lekerdezesek.length >= 8);
  for (const q of lekerdezesek) assert.match(q.trim(), /^SELECT\b/i, q.slice(0, 80));
  assert.ok(!lekerdezesek.some((q) => /\b(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|REPLACE|PRAGMA\s+\w+\s*=)\b/i.test(q)));
});

// ---------- N19: hianyzo tabla / reszleges hiba ----------
test('N19 hianyzo tablak: csak a foglalas_egyeztetes letezik (regi seman) -> 200, a tobbi szekcio ures; egy szekcio hibaja nem viszi el a tobbit, a lampa sarga', async () => {
  const w = await vilag({ semak: false });
  w.futtat('CREATE TABLE foglalas_egyeztetes (uuid TEXT PRIMARY KEY, allapot TEXT NOT NULL, kulcs TEXT, letrehozva INTEGER NOT NULL, frissitve INTEGER NOT NULL)'); // sd oszlopok nelkul
  w.futtat("INSERT INTO foglalas_egyeztetes (uuid, allapot, kulcs, letrehozva, frissitve) VALUES (?, 'parositott', ?, ?, ?)", w.uuid('i0'), HEADSPA(), FROM + 1, FROM + 1);
  const j = await w.jelentes();
  assert.equal(j.uzletagak.headspa.valos.letrehozo_level, 1);
  assert.deepEqual(j.szekcio_hibak, []);

  const x = await vilag();
  x.egyeztetes({ uuid: x.uuid('i1'), kulcs: HEADSPA(), t: FROM + 1 });
  x.kuldes({ esemeny_id: 'q1', platform: 'meta', uzletag: 'headspa', t: FROM + 2 });
  const torott = { ...x.e, KULCS_DB: { prepare: (sql) => { if (/FROM foglalas_vendeg\s+WHERE ido/.test(sql) || /GROUP BY uzletag, forras/.test(sql)) throw new Error('D1_ERROR: boom'); return x.db.prepare(sql); } } };
  const r = await x.kerj(undefined, { env: torott });
  assert.equal(r.status, 200);
  const k = await r.json();
  assert.deepEqual(k.szekcio_hibak, ['foglalas_vendeg']);
  assert.equal(k.uzletagak.headspa.valos.letrehozo_level, 1, 'a tobbi szekcio adata megvan');
  assert.equal(k.uzletagak.headspa.arnyek.meta.elkuldve, 1);
  assert.equal(k.lampa, 'sarga', 'hianyos jelentes nem lehet zold');
  assert.ok(!JSON.stringify(k).includes('boom'), 'a hibauzenet nem kerul ki');

  const mindent = { ...x.e, KULCS_DB: { prepare: () => { throw new Error('D1_ERROR: leallt'); } } };
  const r2 = await x.kerj(undefined, { env: mindent });
  assert.equal(r2.status, 200); const k2 = await r2.json();
  assert.ok(k2.szekcio_hibak.length >= 3); assert.equal(k2.lampa, 'sarga');
});

// ---------- N20: Budapest-nap hatar ----------
test('N20 egy 23:30 UTC-s (= Budapest 01:30 kovetkezo nap) esemeny a Budapest-szerinti napjahoz tartozik', async () => {
  const w = await vilag();
  w.egyeztetes({ uuid: w.uuid('j0'), kulcs: HEADSPA(), t: Date.UTC(2026, 9, 11, 21, 59, 59) / 1000 }); // 23:59:59 Budapest okt 11.
  w.egyeztetes({ uuid: w.uuid('j1'), kulcs: HEADSPA(), t: Date.UTC(2026, 9, 11, 22, 0, 0) / 1000 }); // 00:00:00 okt 12.
  w.egyeztetes({ uuid: w.uuid('j2'), kulcs: HEADSPA(), t: Date.UTC(2026, 9, 12, 21, 59, 59) / 1000 }); // 23:59:59 okt 12.
  w.egyeztetes({ uuid: w.uuid('j3'), kulcs: HEADSPA(), t: Date.UTC(2026, 9, 12, 22, 0, 0) / 1000 }); // 00:00:00 okt 13.
  assert.equal((await w.jelentes('qa=nap&datum=2026-10-12')).uzletagak.headspa.valos.letrehozo_level, 2);
  assert.equal((await w.jelentes('qa=nap&datum=2026-10-11')).uzletagak.headspa.valos.letrehozo_level, 1);
  assert.equal((await w.jelentes('qa=nap&datum=2026-10-13')).uzletagak.headspa.valos.letrehozo_level, 1);
});

test('N21 lemondasOsztaly: az eredmeny szoveg elotagja dont', () => {
  assert.equal(lemondasOsztaly('felszabadult'), 'felszabadult');
  assert.equal(lemondasOsztaly('felszabadult (2 jelolt var a sajat levelere: ott, elo ellenorzes utan kapja meg)'), 'felszabadult');
  assert.equal(lemondasOsztaly('nincs bejegyzes'), 'nincs_bejegyzes');
  assert.equal(lemondasOsztaly('nem ellenorizheto: nincs UUID'), 'nem_ellenorizheto');
  assert.equal(lemondasOsztaly('a birtokos foglalas EL: a kulcs nem szabadul fel'), 'birtokos_el');
  assert.equal(lemondasOsztaly(null), 'egyeb'); assert.equal(lemondasOsztaly('?'), 'egyeb');
});

// ---------- N22–N23: kiegeszito vedelmek ----------
test('N22 egy kiment, de hibazott kerelem celpontja is csak ARNYEK lehet (hiba + elo dataset = piros); a kihagyva / tiltva sor cel nelkul nem szamit', async () => {
  const w = await vilag();
  w.kuldes({ esemeny_id: 'h1', platform: 'meta', uzletag: 'pmu', allapot: 'hiba', t: FROM + 1, kerelem: { url: 'https://graph.facebook.com/v23.0/9999999999/events', cel: { dataset: '9999999999', test_event_code: 'T' } } });
  w.kuldes({ esemeny_id: 'h2', platform: 'meta', uzletag: 'pmu', allapot: 'kihagyva', t: FROM + 2, kerelem: null });
  w.kuldes({ esemeny_id: 'h3', platform: 'tiktok', uzletag: 'pmu', allapot: 'tiltva', t: FROM + 3, kerelem: null });
  const j = await w.jelentes();
  assert.equal(j.uzletagak.pmu.biztonsag.nem_arnyek_cel, 1);
  assert.equal(j.lampa, 'piros');
  assert.equal(j.uzletagak.pmu.arnyek.meta.hiba, 1);
});

test('N23 "ismeretlen" uzletag: csak ha van oda eso adat; az arnyek-sorai latszanak, a lampaja nem lesz sarga (nincs rajta alap-aranyitas), a biztonsag viszont piros lehet', async () => {
  const w = await vilag();
  assert.equal((await w.jelentes()).uzletagak.ismeretlen, undefined, 'ures napon nincs "ismeretlen"');
  w.kuldes({ esemeny_id: 'u1', platform: 'meta', uzletag: 'valami-uj', t: FROM + 1 });
  w.egyeztetes({ uuid: w.uuid('k0'), kulcs: null, t: FROM + 2, allapot: 'parositatlan' });
  let j = await w.jelentes();
  assert.equal(j.uzletagak.ismeretlen.arnyek.meta.elkuldve, 1, 'az ismeretlen uzletagu kuldes nem vész el');
  assert.equal(j.uzletagak.ismeretlen.valos.letrehozo_level, 1);
  assert.equal(j.uzletagak.ismeretlen.arnyek.meta.lampa, 'n/a');
  assert.equal(j.uzletagak.ismeretlen.lampa, 'zold');
  assert.equal(j.lampa, 'zold');
  w.kuldes({ esemeny_id: 'u2', platform: 'meta', uzletag: 'valami-uj', allapot: 'tiltva', t: FROM + 3, kerelem: { url: `https://x/${ELO_CELOK.tiktok[0]}` } });
  j = await w.jelentes();
  assert.equal(j.uzletagak.ismeretlen.biztonsag.elo_id_talalat, 1); assert.equal(j.lampa, 'piros');
});

// ---------- N24: post288_missing_hmac_index (a meresi oldal jovahagyta, #167 137. komment) ----------
test('N24 post288_missing_hmac_index: a #288 UTAN letrehozott PAROSITOTT level foglalas_vendeg sor nelkul; a #288 elotti, az indexelt, a parositatlan (kulon szamlalo) es a proba nem; mintak <= 20', async () => {
  const w = await vilag();
  const E = PRE288_EPOCH; const KESOBB = Date.UTC(2026, 9, 14, 12); // a 2026-10-13-i nap (a #288 napja); a "most" tobb, mint a nap vege
  const talalat = w.egyeztetes({ uuid: 'a1a1a1a1-1111-4111-8111-000000000001', kulcs: HEADSPA(), t: E + 100 }); // parositott, nincs index: TALALAT
  const indexelt = w.egyeztetes({ uuid: 'b2b2b2b2-1111-4111-8111-000000000002', kulcs: HEADSPA(), t: E + 200 });
  w.vendeg({ uuid: indexelt, uzletag: 'headspa', t: E + 150 });
  w.egyeztetes({ uuid: 'c3c3c3c3-1111-4111-8111-000000000003', kulcs: PMU(), t: E + 300 }); // pmu: TALALAT
  w.egyeztetes({ uuid: 'd4d4d4d4-1111-4111-8111-000000000004', kulcs: FODRASZ(), t: E + 400, allapot: 'parositatlan' }); // nem parositott: kulon szamlalo
  const proba = w.egyeztetes({ uuid: 'e5e5e5e5-1111-4111-8111-000000000005', kulcs: OXIGEN(), t: E + 500 }); // proba: nem szamit
  w.egyeztetes({ uuid: 'f6f6f6f6-1111-4111-8111-000000000006', kulcs: null, t: E + 600 }); // kulcs nelkul parositott: ismeretlen uzletag
  let j = await w.jelentes(`qa=nap&datum=2026-10-13&proba=${proba.slice(0, 8)}`, { now: KESOBB });
  const h = j.uzletagak.headspa.post288_missing_hmac_index;
  assert.equal(h.db, 1); assert.deepEqual(h.mintak.map((m) => m.uuid_prefix), [talalat.slice(0, 8)]);
  assert.deepEqual(Object.keys(h.mintak[0]).sort(), ['ido', 'uuid_prefix', 'uzletag']); assert.equal(h.mintak[0].uzletag, 'headspa');
  assert.equal(j.uzletagak.pmu.post288_missing_hmac_index.db, 1);
  assert.equal(j.uzletagak.fodrasz.post288_missing_hmac_index.db, 0); assert.equal(j.uzletagak.fodrasz.post288_missing_hmac_index.parositatlan_db, 1);
  assert.equal(j.uzletagak.oxigen.post288_missing_hmac_index.db, 0, 'a proba nem szamit');
  assert.equal(j.uzletagak.ismeretlen.post288_missing_hmac_index.db, 1, 'kulcs nelkuli parositott level nem vész el');
  assert.equal(j.osszes.post288_missing_hmac_index, 3);
  assert.notEqual(j.lampa, 'piros', 'a szamlalo tajekoztato: onmagaban nem piros');
  // probakent nem megadva az oxigen is szamit
  j = await w.jelentes('qa=nap&datum=2026-10-13', { now: KESOBB });
  assert.equal(j.uzletagak.oxigen.post288_missing_hmac_index.db, 1);
  assert.ok(!JSON.stringify(j).includes(talalat) && !JSON.stringify(j).includes('a1a1a1a1-1111'), 'teljes UUID nincs a valaszban');
});

test('N24b post288: a #288 elotti letrehozo level nem szamit (az a pre288 teruletenek); a hatar pontos (PRE288_EPOCH benne, -1 kint); mintak <= 20; csak olvas', async () => {
  const w = await vilag();
  // a #288 elotti sor: a nap [FROM, TO) kozott, de PRE288_EPOCH ele esik -> a 2026-10-13 elotti napra kell tenni
  const regiNap = '2026-10-12'; // PRE288_EPOCH = 2026-10-13 09:53:07Z, ezert a regiNap egyetlen sora sem "post288"
  w.egyeztetes({ uuid: 'a1a1a1a1-1111-4111-8111-000000000001', kulcs: HEADSPA(), t: FROM + 100 });
  let j = await w.jelentes(`qa=nap&datum=${regiNap}`);
  assert.equal(j.uzletagak.headspa.post288_missing_hmac_index.db, 0, 'a #288 elotti nap sora nem post288');
  assert.equal(j.uzletagak.headspa.valos.letrehozo_level, 1);
  // a 2026-10-13-i nap: [2026-10-12 22:00Z, 2026-10-13 22:00Z)
  w.egyeztetes({ uuid: 'b2b2b2b2-1111-4111-8111-000000000002', kulcs: HEADSPA(), t: PRE288_EPOCH - 1 }); // 1 mp-cel a #288 elott: nem
  w.egyeztetes({ uuid: 'c3c3c3c3-1111-4111-8111-000000000003', kulcs: HEADSPA(), t: PRE288_EPOCH }); // pontosan a #288: igen
  for (let i = 0; i < 25; i++) w.egyeztetes({ uuid: `${(0x20000000 + i).toString(16)}-1111-4111-8111-0000000000${String(i).padStart(2, '0')}`, kulcs: FODRASZ(), t: PRE288_EPOCH + 60 + i });
  j = await w.jelentes('qa=nap&datum=2026-10-13', { now: Date.UTC(2026, 9, 14, 12) });
  assert.equal(j.uzletagak.headspa.post288_missing_hmac_index.db, 1);
  assert.equal(j.uzletagak.fodrasz.post288_missing_hmac_index.db, 25);
  assert.equal(j.uzletagak.fodrasz.post288_missing_hmac_index.mintak.length, 20);
  const dump = () => JSON.stringify(w.sql("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").map((t) => [t.name, w.sql(`SELECT * FROM ${t.name}`)]));
  const elotte = dump(); await w.jelentes('qa=nap&datum=2026-10-13', { now: Date.UTC(2026, 9, 14, 12) }); assert.equal(dump(), elotte);
});

// ---------- N25: post288_nincs_email (a meresi oldal jovahagyta, #167 143. komment (b)) ----------
test('N25 post288_nincs_email: a jelolo soros (forras *_nincs_email) letrehozo level KULON szamlalo, a post288_missing_hmac_index CSAK a valodi kimaradast mutatja; a jelolo agig a szamlalo 0', async () => {
  const w = await vilag();
  const E = PRE288_EPOCH; const KESOBB = Date.UTC(2026, 9, 14, 12);
  const jelolo = w.egyeztetes({ uuid: 'a1a1a1a1-2222-4222-8222-000000000001', kulcs: HEADSPA(), t: E + 100 });
  w.vendeg({ uuid: jelolo, uzletag: 'headspa', forras: 'level_nincs_email', t: E + 100 });                 // jelolo sor: nincs e-mail
  const jeloloSd = w.egyeztetes({ uuid: 'b2b2b2b2-2222-4222-8222-000000000002', kulcs: HEADSPA(), t: E + 200 });
  w.vendeg({ uuid: jeloloSd, uzletag: 'headspa', forras: 'sd_atvetel_nincs_email', t: E + 200 });          // az sd-atvetel jelolo
  const kimaradas = w.egyeztetes({ uuid: 'c3c3c3c3-2222-4222-8222-000000000003', kulcs: HEADSPA(), t: E + 300 }); // sem sor, sem jelolo: VALODI kimaradas
  const valodi = w.egyeztetes({ uuid: 'd4d4d4d4-2222-4222-8222-000000000004', kulcs: HEADSPA(), t: E + 400 });
  w.vendeg({ uuid: valodi, uzletag: 'headspa', email_h: 'a'.repeat(32), forras: 'level', t: E + 400 });      // valodi index-sor: egyik szamlalobol sem
  w.egyeztetes({ uuid: 'e5e5e5e5-2222-4222-8222-000000000005', kulcs: FODRASZ(), t: E + 500, allapot: 'parositatlan' }); // parositatlan, jelolo nelkul: missing.parositatlan_db
  const jeloloParositatlan = w.egyeztetes({ uuid: 'f6f6f6f6-2222-4222-8222-000000000006', kulcs: FODRASZ(), t: E + 600, allapot: 'parositatlan' });
  w.vendeg({ uuid: jeloloParositatlan, uzletag: 'fodrasz', forras: 'level_nincs_email', t: E + 600 });
  const probaJelolo = w.egyeztetes({ uuid: '99999999-2222-4222-8222-000000000009', kulcs: PMU(), t: E + 700 });
  w.vendeg({ uuid: probaJelolo, uzletag: 'pmu', forras: 'level_nincs_email', t: E + 700 });
  const j = await w.jelentes(`qa=nap&datum=2026-10-13&proba=${probaJelolo.slice(0, 8)}`, { now: KESOBB });
  const h = j.uzletagak.headspa;
  assert.equal(h.post288_nincs_email.db, 2); assert.deepEqual(h.post288_nincs_email.mintak.map((m) => m.uuid_prefix).sort(), [jelolo.slice(0, 8), jeloloSd.slice(0, 8)].sort());
  assert.equal(h.post288_missing_hmac_index.db, 1); assert.deepEqual(h.post288_missing_hmac_index.mintak.map((m) => m.uuid_prefix), [kimaradas.slice(0, 8)], 'csak a valodi kimaradas');
  assert.equal(j.uzletagak.fodrasz.post288_nincs_email.parositatlan_db, 1); assert.equal(j.uzletagak.fodrasz.post288_nincs_email.db, 0);
  assert.equal(j.uzletagak.fodrasz.post288_missing_hmac_index.parositatlan_db, 1, 'a jelolo nelkuli parositatlan marad a missing-ben');
  assert.equal(j.uzletagak.pmu.post288_nincs_email.db, 0, 'a proba nem szamit');
  assert.equal(j.osszes.post288_nincs_email, 2); assert.equal(j.osszes.post288_missing_hmac_index, 1);
  assert.deepEqual(Object.keys(h.post288_nincs_email.mintak[0]).sort(), ['ido', 'uuid_prefix', 'uzletag']);
  assert.notEqual(j.lampa, 'piros', 'tajekoztato szamlalo');
  assert.ok(!JSON.stringify(j).includes('a1a1a1a1-2222'), 'teljes UUID nincs a valaszban');
  // a jelolo-ag elott (nincs *_nincs_email sor) a szamlalo 0
  const u = await vilag(); u.egyeztetes({ uuid: 'a7a7a7a7-2222-4222-8222-000000000007', kulcs: HEADSPA(), t: E + 100 });
  const k = await u.jelentes('qa=nap&datum=2026-10-13', { now: KESOBB });
  assert.equal(k.uzletagak.headspa.post288_nincs_email.db, 0); assert.equal(k.uzletagak.headspa.post288_missing_hmac_index.db, 1);
});

// ---------- N26-N27: T2_START (DECISION #166 3.) ----------
const TITKOK = { META_CAPI_TOKEN: 'TITOK-META-123', TIKTOK_EVENTS_TOKEN: 'TITOK-TT-456', GA4_TESZT_API_SECRET: 'TITOK-GA-789', GOOGLE_ARNYEK_WEBHOOK_URL: 'https://hooks.zapier.com/hooks/catch/TITOK-HOOK/', SD_HMAC_KEY_V1: 'TITOK-SD-1', GUEST_HMAC_KEY_V1: 'TITOK-GUEST-2' };
test('N26 ?qa=t2start: ugyanaz a hozzaferes (401 / 403 / 405 / 429), no-store; idopont, kod- es D1-sema-ujjlenyomat, sorok, kapcsolok, arnyekcel-ID-k, acceptance; a titkok NEM szivarognak (csak jelenlet-bit)', async () => {
  const w = await vilag({ env: { ...TITKOK, MERES_ELOSZTO: '1', MERES_SALONIC_DIRECT: '1', MERES_SD_NS: 'prod', META_TESZT_KOD: 'TEST83939', TIKTOK_TESZT_KOD: 'TEST83543' } });
  assert.equal((await w.kerj('qa=t2start', { kulcs: null })).status, 401);
  assert.equal((await w.kerj('qa=t2start', { kulcs: 'rossz' })).status, 403);
  assert.equal((await w.kerj('qa=t2start', { method: 'POST' })).status, 405);
  assert.equal((await w.kerj(`qa=t2start&kulcs=${KULCS_SZOVEG}`, { kulcs: null })).status, 401, 'az URL-ben kapott kulcs nem fogadhato el');
  w.futtat("INSERT INTO meres_kapcsolo (kulcs, be, ok, ido) VALUES ('mind', 1, ?, ?)", 'x'.repeat(200), MOST / 1000 - 100);
  w.egyeztetes({ uuid: w.uuid('t0'), kulcs: HEADSPA(), t: FROM + 1 });
  w.kuldes({ esemeny_id: 'k1', platform: 'meta', uzletag: 'headspa', t: FROM + 2 });
  const r = await w.kerj('qa=t2start'); assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'no-store');
  const j = await r.json();
  assert.equal(j.ok, true); assert.equal(j.qa, 't2start'); assert.equal(j.t2_start_utc, '2026-10-13T12:00:00Z'); assert.equal(j.t2_start_budapest, '2026-10-13 14:00');
  assert.deepEqual(j.acceptance, { min_nap: 7, max_nap: 14, min_valos_jogosult_foglalas: 200 }); assert.deepEqual(j.acceptance, T2_ACCEPTANCE);
  assert.match(j.kod.kod_ujjlenyomat, /^[0-9a-f]{64}$/); assert.match(j.d1.sema_ujjlenyomat, /^[0-9a-f]{64}$/);
  assert.deepEqual(j.kod.elo_tiltolista_db, { meta: 5, tiktok: 1, ga4: 1, google_primary: 9 });
  assert.equal(j.kod.production_sha, null); assert.equal(j.kod.production_sha_forras, 'nincs'); assert.equal(j.zap.revizio, null);
  assert.equal(j.d1.sorok.meres_kuldes.db, 1); assert.equal(j.d1.sorok.meres_kuldes.max_id, 1); assert.equal(j.d1.sorok.foglalas_egyeztetes.db, 1); assert.equal(j.d1.sorok.foglalas_vendeg.db, 0);
  assert.deepEqual(j.kapcsolok.d1.map((k) => [k.kulcs, k.be]), [['mind', true]]); assert.equal(j.kapcsolok.d1[0].ok.length, 80, 'a megjegyzes 80 karakterre vagva');
  assert.deepEqual(j.kapcsolok.env, { MERES_ELOSZTO: '1', MERES_SALONIC_DIRECT: '1', MERES_SD_INDEX: null, MERES_SD_NS: 'prod', MERES_IRAS_KI: null, META_API_VERSION: null });
  assert.deepEqual(j.kapcsolok.titkok_jelen, { META_CAPI_TOKEN: true, TIKTOK_EVENTS_TOKEN: true, GA4_TESZT_API_SECRET: true, GOOGLE_ARNYEK_WEBHOOK_URL: true, SD_HMAC_KEY_V1: true, GUEST_HMAC_KEY_V1: true, EGYEZTETES_KULCS_HASH: true });
  assert.equal(j.arnyekcelok.meta.dataset, ARNYEK.meta.datasetId); assert.equal(j.arnyekcelok.meta.test_event_code, 'TEST83939'); assert.equal(j.arnyekcelok.tiktok.pixel_code, ARNYEK.tiktok.pixelCode); assert.equal(j.arnyekcelok.tiktok.test_event_code, 'TEST83543');
  assert.equal(j.arnyekcelok.ga4.measurement_id, 'G-TESZT00001'); assert.equal(j.arnyekcelok.google.customer_id, ARNYEK.google.customerId); assert.deepEqual(j.arnyekcelok.google.akciok, ARNYEK.google.akciok);
  assert.deepEqual(j.szekcio_hibak, []);
  const szoveg = JSON.stringify(j);
  for (const titok of [...Object.values(TITKOK), KULCS_SZOVEG, KULCS_HASH, 'hooks.zapier.com']) assert.ok(!szoveg.includes(titok), 'titok / kulcs a valaszban: ' + titok);
  for (const id of [...ELO_CELOK.meta, ...ELO_CELOK.tiktok, ...ELO_CELOK.ga4, ...ELO_CELOK.google_primary]) assert.ok(!szoveg.includes(id), 'elo ID a valaszban: ' + id);
  assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-/.test(szoveg), 'teljes UUID nincs');
});

test('N26b t2start ujjlenyomatok: a kod-ujjlenyomat es a D1-sema-ujjlenyomat stabil (adat nem valtoztatja), a sema-valtozasra (uj oszlop / tabla) VALTOZIK; sha / zap_rev: validalt, visszaadott; CF_PAGES_COMMIT_SHA csak ha van', async () => {
  const w = await vilag();
  const a = await w.jelentes('qa=t2start');
  w.egyeztetes({ uuid: w.uuid('t1'), kulcs: HEADSPA(), t: FROM + 1 }); w.kuldes({ esemeny_id: 'k2', platform: 'meta', uzletag: 'headspa', t: FROM + 2 });
  const b = await w.jelentes('qa=t2start');
  assert.equal(b.d1.sema_ujjlenyomat, a.d1.sema_ujjlenyomat, 'adat nem valtoztat'); assert.equal(b.kod.kod_ujjlenyomat, a.kod.kod_ujjlenyomat);
  assert.equal(b.d1.sorok.meres_kuldes.db, 1);
  w.futtat('ALTER TABLE meres_kuldes ADD COLUMN uj_oszlop TEXT');
  const c = await w.jelentes('qa=t2start');
  assert.notEqual(c.d1.sema_ujjlenyomat, a.d1.sema_ujjlenyomat, 'uj oszlop = uj sema-ujjlenyomat'); assert.equal(c.kod.kod_ujjlenyomat, a.kod.kod_ujjlenyomat);
  w.futtat('CREATE TABLE uj_tabla (x TEXT)');
  const d = await w.jelentes('qa=t2start'); assert.notEqual(d.d1.sema_ujjlenyomat, c.d1.sema_ujjlenyomat); assert.equal(d.d1.tablak_db, a.d1.tablak_db + 1);
  const e = await w.jelentes('qa=t2start&sha=ABCDEF1234567&zap_rev=zap-rev_2026.10.13:7');
  assert.equal(e.kod.production_sha, 'abcdef1234567'); assert.equal(e.kod.production_sha_forras, 'hivo'); assert.equal(e.zap.revizio, 'zap-rev_2026.10.13:7'); assert.equal(e.zap.forras, 'hivo');
  for (const rossz of ['sha=xyz', 'sha=abc', 'sha=' + 'a'.repeat(41), 'zap_rev=a%20b', 'zap_rev=' + 'a'.repeat(41), "zap_rev=a'b"]) assert.equal((await w.kerj('qa=t2start&' + rossz)).status, 400, rossz);
  const v = await vilag({ env: { CF_PAGES_COMMIT_SHA: 'f'.repeat(40) } });
  const f = await v.jelentes('qa=t2start'); assert.equal(f.kod.production_sha, null); assert.equal(f.kod.production_sha_forras, 'env'); assert.equal(f.kod.env_sha, 'f'.repeat(40));
});

test('N27 t2start CSAK OLVAS: minden SQL SELECT; ures adatbazison sem hoz letre tablat; hianyzo tablak = null sorok, nem hiba', async () => {
  const w = await vilag();
  const lekerdezesek = [];
  const db = { prepare: (sql) => { lekerdezesek.push(sql); return w.db.prepare(sql); } };
  w.egyeztetes({ uuid: w.uuid('t2'), kulcs: HEADSPA(), t: FROM + 1 });
  const j = await t2Start(db, { EGYEZTETES_KULCS_HASH: KULCS_HASH }, MOST);
  assert.ok(lekerdezesek.length >= 5);
  for (const q of lekerdezesek) assert.match(q.trim(), /^SELECT\b/i, q.slice(0, 80));
  assert.ok(!lekerdezesek.some((q) => /\b(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|REPLACE|PRAGMA\s+\w+\s*=)\b/i.test(q)));
  assert.equal(j.ok, true);
  const u = await vilag({ semak: false });
  const k = await u.jelentes('qa=t2start');
  assert.equal(u.sql("SELECT name FROM sqlite_master WHERE type='table'").length, 0, 'ures adatbazison sem hoz letre tablat');
  assert.equal(k.d1.tablak_db, 0); assert.match(k.d1.sema_ujjlenyomat, /^[0-9a-f]{64}$/); assert.ok(Object.values(k.d1.sorok).every((x) => x === null)); assert.equal(k.kapcsolok.d1, null); assert.deepEqual(k.szekcio_hibak, []);
});

// a meres_kuldes.hozzajarulas PRODUKCIOS alakja (elosztas.js): { allapot: { ana, adv, fun, dontes }, szabaly: {...} }
const HOZZ = (allapot) => ({ allapot, szabaly: { kuldheto: true, felhasznaloi_adat: false } });

// ---------- N28-N29: booking coverage + platform eligibility (DECISION #166 5.) ----------
test('N28 booking coverage: latott (a rendszer altal latott valos levelek) / elvart (FUGGETLEN forrasbol, ?elvart=) / lefedettseg / hiany; elvart nelkul a nevezo a latott (nevezo_forras jelzi); ervenytelen elvart = 400', async () => {
  const w = await vilag();
  for (let i = 0; i < 3; i++) w.egyeztetes({ uuid: w.uuid('c' + i), kulcs: HEADSPA(i + 1), t: FROM + 10 + i });
  const proba = w.egyeztetes({ uuid: w.uuid('c9'), kulcs: HEADSPA(9), t: FROM + 20 });
  w.egyeztetes({ uuid: w.uuid('cf'), kulcs: FODRASZ(), t: FROM + 30 });
  for (const rossz of ['elvart=headspa:abc', 'elvart=foo:3', 'elvart=headspa:1,headspa:2', 'elvart=headspa', 'elvart=headspa:-1', 'elvart=headspa:1000000', 'elvart=Headspa:3', 'elvart=headspa:3,']) assert.equal((await w.kerj(`qa=nap&datum=${NAP}&${rossz}`)).status, 400, rossz);
  let j = await w.jelentes(`qa=nap&datum=${NAP}&proba=${proba.slice(0, 8)}&elvart=headspa:4,fodrasz:3,pmu:0`);
  const h = j.uzletagak.headspa.lefedettseg;
  assert.deepEqual([h.latott, h.elvart, h.nevezo_forras, h.lefedettseg, h.hiany], [3, 4, 'elvart', 0.75, 1]);
  const f = j.uzletagak.fodrasz.lefedettseg; assert.deepEqual([f.latott, f.elvart, f.lefedettseg, f.hiany], [1, 3, 0.33, 2]);
  const p = j.uzletagak.pmu.lefedettseg; assert.deepEqual([p.latott, p.elvart, p.lefedettseg, p.hiany, p.nevezo_forras], [0, 0, null, 0, 'elvart'], '0 elvart -> nincs hanyados, nincs hiany');
  const o = j.uzletagak.oxigen.lefedettseg; assert.deepEqual([o.latott, o.elvart, o.nevezo_forras, o.lefedettseg, o.hiany], [0, null, 'latott', null, null]);
  assert.deepEqual(j.osszes.lefedettseg, { latott: 4, elvart: 7, latott_az_elvart_uzletagakban: 4, elvart_hianyos: true, hiany: 3, parositott_esemeny_nelkul: 0, szabalyos_esemeny_nelkul: 0, friss_kizarva: 0, lefedettseg: 0.57 });
  j = await w.jelentes(`qa=nap&datum=${NAP}&elvart=headspa:4,fodrasz:1,oxigen:0,szor:0,pmu:0`);
  assert.equal(j.osszes.lefedettseg.elvart_hianyos, false); assert.equal(j.osszes.lefedettseg.hiany, 0, 'probakizaras nelkul a headspa 4 latott = 4 elvart, a fodrasz 1 = 1'); assert.equal(j.osszes.lefedettseg.lefedettseg, 1);
  j = await w.jelentes();
  assert.equal(j.osszes.lefedettseg.elvart, null); assert.equal(j.osszes.lefedettseg.hiany, null); assert.ok(!('elvart_hianyos' in j.osszes.lefedettseg)); assert.equal(j.osszes.lefedettseg.latott, 5);
  assert.notEqual(j.lampa, 'piros', 'tajekoztato szamlalo: nem valtoztatja a lampat');
});

test('N29 platform eligibility: kuldve / szabalyos_nulla (jogos_0) / technikai_hiany (hiba, tiltva, veszkapcsolo, halasztva) / nincs_sor (parositott level esemeny-sor nelkul); a TECHNIKAI KIMARADAS a nevezoben marad: jogosult = kuldve + technikai_hiany + nincs_sor', async () => {
  const w = await vilag();
  const cella = (src, platform, allapot, extra = {}) => w.kuldes({ esemeny_id: `${src}:${platform}`, platform, allapot, uzletag: 'headspa', source_id: src, t: FROM + 100, ...extra });
  const A = w.egyeztetes({ uuid: w.uuid('ea'), kulcs: HEADSPA(1), t: FROM + 100, booking_id: 'mb_A' });
  cella('mb_A', 'meta', 'elkuldve'); cella('mb_A', 'tiktok', 'elkuldve');
  cella('mb_A', 'google', 'kihagyva', { indok: 'nincs kattintasazonosito' });                                             // jogos_0
  cella('mb_A', 'ga4', 'tiltva', { indok: 'nincs GA4 client_id', hozz: HOZZ({ ana: false, adv: false, fun: false, dontes: true }), kerelem: null });  // jogos_0 (analytics-hozzajarulas elutasitva)
  const B = w.egyeztetes({ uuid: w.uuid('eb'), kulcs: HEADSPA(2), t: FROM + 200, booking_id: 'mb_B' });
  cella('mb_B', 'meta', 'hiba'); cella('mb_B', 'tiktok', 'elkuldve');
  cella('mb_B', 'google', 'tiltva', { indok: 'a celpont nem az ARNYEK', kerelem: null });                                  // technikai
  cella('mb_B', 'ga4', 'kihagyva', { indok: 'veszkapcsolo: mind', kerelem: null });                                         // technikai (veszkapcsolo)
  const C = w.egyeztetes({ uuid: w.uuid('ec'), kulcs: HEADSPA(3), t: FROM + 300, booking_id: 'mb_C' });                       // parositott, NINCS esemeny-sor: nincs_sor
  const D = w.egyeztetes({ uuid: w.uuid('ed'), kulcs: HEADSPA(4), t: FROM + 40000, booking_id: 'mb_D' });                      // parositott, esemeny-sor nelkul, de FRISS (a "most" 5 perccel kesobb)
  const E = w.egyeztetes({ uuid: w.uuid('ee'), kulcs: HEADSPA(5), t: FROM + 400, allapot: 'parositatlan', sd_id: 'sd_E', sd_allapot: 'kesz' }); // az sd-atvett, kesz: az esemenyek az sd_id alatt
  for (const p of ['meta', 'tiktok', 'google', 'ga4']) cella('sd_E', p, 'elkuldve', { forras: 'salonic_direct' });
  w.egyeztetes({ uuid: w.uuid('ef'), kulcs: HEADSPA(6), t: FROM + 500, allapot: 'parositatlan', sd_id: 'sd_F', sd_allapot: 'kesz' }); // sd kesz, esemeny-sor nelkul: nincs_sor
  w.egyeztetes({ uuid: w.uuid('eg'), kulcs: HEADSPA(7), t: FROM + 600, allapot: 'parositatlan', sd_id: 'sd_G', sd_allapot: 'halasztva' }); // sd HOLD: nem "kesz" -> nem nincs_sor (a cellak 'halasztva')
  cella('sd_G', 'meta', 'halasztva', { forras: 'salonic_direct', indok: 'reschedule_suspected: HOLD' });
  cella('mb_A', 'meta', 'hiba', { esemeny_id: 'ernyo1', tipus: 'ernyo' });                                                       // ernyo-esemeny: nem szamit
  cella('mb_A', 'meta', 'hiba', { esemeny_id: 'kartya1', platform_nev: 'HeadSpa_Ajandekkartya' });                              // ajandekkartya: nem szamit
  cella('mb_A', 'meta', 'hiba', { esemeny_id: 'kartya2', forras: 'kartya' });                                                    // kartya forras: nem szamit
  const proba = w.egyeztetes({ uuid: w.uuid('e9'), kulcs: HEADSPA(8), t: FROM + 700, booking_id: 'mb_P' });                     // proba, esemeny-sor nelkul: nem szamit
  const q = `qa=nap&datum=${NAP}&proba=${proba.slice(0, 8)}`;
  let j = await w.jelentes(q);
  const J = j.uzletagak.headspa.jogosultsag;
  assert.deepEqual([J.meta.kuldve, J.meta.technikai_hiany, J.meta.technikai_hiany_okok, J.meta.szabalyos_nulla, J.meta.nincs_sor, J.meta.jogosult, J.meta.arany],
    [2, 2, { hiba: 1, halasztva: 1 }, 0, 3, 7, 0.29], 'meta: A, E ok; B hiba + G halasztva (technikai); nincs_sor: C, D (a MOSTHOZ kepest regi), F');
  assert.deepEqual([J.tiktok.kuldve, J.tiktok.technikai_hiany, J.tiktok.nincs_sor, J.tiktok.jogosult, J.tiktok.arany], [3, 0, 3, 6, 0.5]);
  assert.deepEqual([J.google.kuldve, J.google.szabalyos_nulla, J.google.technikai_hiany, J.google.technikai_hiany_okok, J.google.nincs_sor, J.google.jogosult, J.google.arany], [1, 1, 1, { tiltva: 1 }, 3, 5, 0.2]);
  assert.deepEqual([J.ga4.kuldve, J.ga4.szabalyos_nulla, J.ga4.technikai_hiany, J.ga4.technikai_hiany_okok, J.ga4.nincs_sor, J.ga4.jogosult], [1, 1, 1, { veszkapcsolo: 1 }, 3, 5]);
  assert.equal(J.meta.cellak, 4, 'cellak = az alap-esemeny cellak (ernyo / kartya nelkul)');
  assert.deepEqual(j.uzletagak.headspa.lefedettseg.parositott_esemeny_nelkul, 3);
  assert.deepEqual(j.osszes.jogosultsag.meta, { kuldve: 2, szabalyos_nulla: 0, technikai_hiany: 2, nincs_sor: 3, jogosult: 7, arany: 0.29 });
  assert.equal(j.uzletagak.fodrasz.jogosultsag.meta.arany, null, 'ures uzletag: nincs hanyados');
  // FRISS levelek: a D 5 perce jott -> nem technikai kimaradas (friss_kizarva), a nincs_sor eggyel kevesebb
  j = await w.jelentes(q, { now: (FROM + 40000 + 300) * 1000 });
  assert.equal(j.uzletagak.headspa.lefedettseg.friss_kizarva, 1); assert.equal(j.uzletagak.headspa.lefedettseg.parositott_esemeny_nelkul, 2); assert.equal(j.uzletagak.headspa.jogosultsag.meta.nincs_sor, 2);
  // a technikai kimaradas NEM esik ki a nevezobol: egy tovabbi hiba csokkenti az aranyt (a jogosult no)
  cella('mb_B', 'tiktok', 'hiba', { esemeny_id: 'tt2' });
  j = await w.jelentes(q);
  assert.equal(j.uzletagak.headspa.jogosultsag.tiktok.technikai_hiany, 1); assert.equal(j.uzletagak.headspa.jogosultsag.tiktok.jogosult, 7); assert.equal(j.uzletagak.headspa.jogosultsag.tiktok.arany, 0.43);
  assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-/.test(JSON.stringify(j)), 'teljes UUID nincs a valaszban');
  void [A, B, C, D, E];
});

// ---------- N30-N35: a fuggetlen review (#310, 4e151e2) javitasai ----------
test('N30 GA4 hozzajarulas: a PRODUKCIOS alak ({ allapot: {ana...}, szabaly }) szerint osztalyoz - analytics-hozzajarulas VAN, de nincs client_id = TECHNIKAI hiany (nevezoben marad); nincs dontes / elutasitva = szabalyos nulla; nincs pillanatkep = technikai', async () => {
  const w = await vilag();
  const cella = (src, ga4Hozz, id) => w.kuldes({ esemeny_id: id, platform: 'ga4', allapot: 'tiltva', uzletag: 'headspa', source_id: src, t: FROM + 100, indok: 'nincs GA4 client_id (nincs _ga suti)', kerelem: null, hozz: ga4Hozz });
  w.egyeztetes({ uuid: w.uuid('a1'), kulcs: HEADSPA(1), t: FROM + 100, booking_id: 'mb_h1' }); cella('mb_h1', HOZZ({ ana: true, adv: false, fun: false, dontes: true }), 'h1');   // ana VAN -> technikai
  w.egyeztetes({ uuid: w.uuid('a2'), kulcs: HEADSPA(2), t: FROM + 100, booking_id: 'mb_h2' }); cella('mb_h2', HOZZ({ ana: false, adv: false, fun: false, dontes: true }), 'h2'); // elutasitva -> szabalyos nulla
  w.egyeztetes({ uuid: w.uuid('a3'), kulcs: HEADSPA(3), t: FROM + 100, booking_id: 'mb_h3' }); cella('mb_h3', HOZZ({ ana: null, adv: null, fun: null, dontes: false }), 'h3'); // nincs dontes (a prod mostani GA4 tiltva sorai) -> szabalyos nulla
  w.egyeztetes({ uuid: w.uuid('a4'), kulcs: HEADSPA(4), t: FROM + 100, booking_id: 'mb_h4' }); cella('mb_h4', null, 'h4');                                                       // nincs pillanatkep -> technikai
  const j = await w.jelentes();
  const g = j.uzletagak.headspa.jogosultsag.ga4;
  assert.deepEqual([g.szabalyos_nulla, g.technikai_hiany, g.technikai_hiany_okok, g.kuldve, g.nincs_sor, g.jogosult, g.arany], [2, 2, { ga4_ana_van_client_id_nincs: 1, ga4_nincs_pillanatkep: 1 }, 0, 0, 2, 0]);
});

test('N31 ?proba=: a proba-level cellai KI vannak zarva a kuldott-aranybol (alap_elkuldve, jogosultsag) - mint a nevezobol -, a biztonsagi ellenorzesek viszont minden kuldesre futnak; a lampa nem zold hamisan', async () => {
  const w = await vilag();
  const cella = (src, platform, extra = {}) => w.kuldes({ esemeny_id: `${src}:${platform}`, platform, uzletag: 'headspa', source_id: src, t: FROM + 100, ...extra });
  w.egyeztetes({ uuid: w.uuid('b1'), kulcs: HEADSPA(1), t: FROM + 100, booking_id: 'mb_A' }); cella('mb_A', 'meta');          // valos, elkuldve
  w.egyeztetes({ uuid: w.uuid('b2'), kulcs: HEADSPA(2), t: FROM + 100, booking_id: 'mb_B' });                               // valos, esemeny nelkul
  const P = w.egyeztetes({ uuid: w.uuid('b9'), kulcs: HEADSPA(3), t: FROM + 100, booking_id: 'mb_P' }); cella('mb_P', 'meta'); // PROBA, elkuldve
  const sd = w.egyeztetes({ uuid: w.uuid('b8'), kulcs: HEADSPA(4), t: FROM + 100, allapot: 'parositatlan', sd_id: 'sd_P', sd_allapot: 'kesz' }); cella('sd_P', 'meta', { forras: 'salonic_direct' }); // PROBA (sd-ut)
  cella('mb_P', 'tiktok', { kerelem: { url: 'https://business-api.tiktok.com/open_api/v1.3/event/track/', cel: { pixel_code: ELO_CELOK.tiktok[0], test_event_code: 'T' } } }); // a proba ELO-celra ment: a biztonsag ezt MEGLATJA
  const nelkule = await w.jelentes();
  const vele = await w.jelentes(`qa=nap&datum=${NAP}&proba=${P.slice(0, 8)},${sd.slice(0, 8)}`);
  const m0 = nelkule.uzletagak.headspa, m1 = vele.uzletagak.headspa;
  assert.deepEqual([m0.valos.parositott, m0.arnyek.meta.alap_elkuldve, m0.jogosultsag.meta.kuldve], [3, 3, 3], 'proba nelkul mindharom szamit (a sd-s parositatlan)');
  assert.deepEqual([m1.valos.parositott, m1.valos.proba_kizarva, m1.arnyek.meta.alap_elkuldve, m1.arnyek.meta.proba_cella_kizarva, m1.arnyek.meta.elkuldve], [2, 2, 1, 2, 3], 'a nevezo es a szamlalo is a proba nelkul: 1 elkuldve / 2 valos; az allapot-szamlalo (elkuldve) minden kuldest mutat');
  assert.deepEqual([m1.jogosultsag.meta.kuldve, m1.jogosultsag.meta.nincs_sor, m1.jogosultsag.meta.jogosult, m1.jogosultsag.meta.arany], [1, 1, 2, 0.5]);
  assert.equal(m1.arnyek.meta.lampa, 'sarga', 'valos.parositott=2, alap_elkuldve=1 < 0,9 x 2: sarga (korabban a proba cellaja miatt hamisan zold)');
  assert.deepEqual([m1.biztonsag.nem_arnyek_cel, m1.biztonsag.elo_id_talalat], [1, 1], 'a proba-level ELO celu kuldese a biztonsagban TOVABBRA is latszik (nem-arnyek cel + elo ID talalat)');
});

test('N32 elvart: reszleges elvart mellett az osszesites like-for-like (csak az elvart-tal rendelkezo uzletagak latottja); a hiany nem negativ', async () => {
  const w = await vilag();
  for (let i = 0; i < 9; i++) w.egyeztetes({ uuid: w.uuid('d' + i), kulcs: HEADSPA(i + 1), t: FROM + 10 + i });
  for (let i = 0; i < 5; i++) w.egyeztetes({ uuid: w.uuid('e' + i), kulcs: OXIGEN(i + 1), t: FROM + 30 + i });
  let j = await w.jelentes(`qa=nap&datum=${NAP}&elvart=headspa:12`);
  assert.deepEqual([j.osszes.lefedettseg.latott, j.osszes.lefedettseg.latott_az_elvart_uzletagakban, j.osszes.lefedettseg.elvart, j.osszes.lefedettseg.lefedettseg, j.osszes.lefedettseg.hiany, j.osszes.lefedettseg.elvart_hianyos], [14, 9, 12, 0.75, 3, true]);
  j = await w.jelentes(`qa=nap&datum=${NAP}&elvart=headspa:4,oxigen:5`); // latott > elvart: a hiany 0 (nem negativ), a lefedettseg > 1 megengedett
  assert.deepEqual([j.uzletagak.headspa.lefedettseg.hiany, j.uzletagak.headspa.lefedettseg.lefedettseg, j.osszes.lefedettseg.hiany, j.osszes.lefedettseg.latott_az_elvart_uzletagakban], [0, 2.25, 0, 14]);
});

test('N33 lefedettseg szelei: a nap hatara felig nyitott [from, to); sd csak "kesz" allapotban nincs_sor (atveve / halasztva cella nelkul nem); a meres_kuldes cellak ablaka is felig nyitott; HeadSpa konzultacio esemeny nelkul SZABALYOS', async () => {
  const w = await vilag();
  const nincsCella = (pre, t, extra = {}) => w.egyeztetes({ uuid: w.uuid(pre), kulcs: HEADSPA(Math.floor(Math.random() * 1000)), t, booking_id: 'mb_' + pre + t, ...extra });
  nincsCella('f1', FROM);       // pontosan a hatar: BENNE
  nincsCella('f2', FROM - 1);   // elotte: nem
  nincsCella('f3', TO);         // a kovetkezo nap eleje: nem
  nincsCella('f4', TO - 1);     // az utolso masodperc: benne
  w.egyeztetes({ uuid: w.uuid('f5'), kulcs: HEADSPA(5), t: FROM + 100, allapot: 'parositatlan', sd_id: 'sd_atveve', sd_allapot: 'atveve' });   // folyamatban: nem hiany
  w.egyeztetes({ uuid: w.uuid('f6'), kulcs: HEADSPA(6), t: FROM + 100, allapot: 'parositatlan', sd_id: 'sd_halasztva', sd_allapot: 'halasztva' }); // HOLD, cella nelkul: nem hiany (a sd szekcioban latszik)
  w.egyeztetes({ uuid: w.uuid('f7'), kulcs: HEADSPA(7), t: FROM + 100, allapot: 'parositatlan', sd_id: 'sd_kesz', sd_allapot: 'kesz' });           // kesz, cella nelkul: HIANY
  w.futtat('CREATE TABLE IF NOT EXISTS meres_jelleg (source_id TEXT PRIMARY KEY, jelleg TEXT NOT NULL, kupon INTEGER NOT NULL, forras TEXT NOT NULL, ido INTEGER NOT NULL) WITHOUT ROWID'); // a jelleg-rogzites.js DDL-je
  const konz = nincsCella('f8', FROM + 200); w.futtat("INSERT INTO meres_jelleg (source_id, jelleg, kupon, forras, ido) VALUES (?, 'konzultacio', 0, 'elso_level', ?)", 'mb_f8' + (FROM + 200), FROM + 200); // HeadSpa konzultacio: nincs esemeny (#101)
  void konz;
  w.kuldes({ esemeny_id: 'ablak1', platform: 'meta', uzletag: 'headspa', t: TO - 1 });   // benne
  w.kuldes({ esemeny_id: 'ablak2', platform: 'meta', uzletag: 'headspa', t: TO });       // kint
  w.kuldes({ esemeny_id: 'ablak3', platform: 'meta', uzletag: 'headspa', t: FROM - 1 }); // kint
  const j = await w.jelentes();
  const h = j.uzletagak.headspa;
  assert.deepEqual([h.lefedettseg.parositott_esemeny_nelkul, h.lefedettseg.szabalyos_esemeny_nelkul], [3, 1], 'f1, f4 (hatar-benn) + f7 (sd kesz); a f8 HeadSpa konzultacio szabalyos');
  assert.equal(h.arnyek.meta.elkuldve, 1, 'a meres_kuldes cellak ablaka felig nyitott');
  assert.equal(j.osszes.lefedettseg.szabalyos_esemeny_nelkul, 1);
});

test('N34 az adatbazisbol jovo szoveg nem lehet objektum-kulcs veszely: forras / sd_allapot "__proto__" / "constructor" nem torik el a jelentest', async () => {
  const w = await vilag();
  w.egyeztetes({ uuid: w.uuid('g1'), kulcs: HEADSPA(), t: FROM + 10, allapot: 'parositatlan', sd_id: 'sd_x', sd_allapot: 'constructor', sd_ido: FROM + 10 });
  w.kuldes({ esemeny_id: 'p1', platform: 'meta', uzletag: 'headspa', t: FROM + 11, forras: '__proto__' });
  w.kuldes({ esemeny_id: 'p2', platform: 'meta', uzletag: 'headspa', t: FROM + 12, forras: 'constructor' });
  const j = await w.jelentes();
  assert.deepEqual(j.szekcio_hibak, []);
  assert.equal(j.uzletagak.headspa.sd.sd_allapot.ismeretlen, 1); assert.equal(Object.hasOwn(j.uzletagak.headspa.sd.sd_allapot, 'constructor'), false, 'a tiltott kulcs nem sajat tulajdonsag');
  assert.equal(j.uzletagak.headspa.arnyek.meta.forras.ismeretlen.elkuldve, 2);
  assert.equal(Object.getPrototypeOf(j.uzletagak.headspa.arnyek.meta.forras), Object.prototype, 'a prototipus nem modosult');
});

test('N35 t2start: a konfiguralt teszt-ID-k csonkolva; ha a GA4 teszt measurement ID az ELO listan van, NEM irjuk ki (jelzes), egyebkent igen', async () => {
  const w = await vilag({ env: { META_TESZT_KOD: 'M'.repeat(80), TIKTOK_TESZT_KOD: 'T'.repeat(80), META_API_VERSION: 'v'.repeat(80), GA4_TESZT_MEASUREMENT_ID: ELO_CELOK.ga4[0] } });
  const j = await w.jelentes('qa=t2start');
  assert.equal(j.arnyekcelok.meta.test_event_code.length, 40); assert.equal(j.arnyekcelok.tiktok.test_event_code.length, 40); assert.equal(j.arnyekcelok.meta.api_verzio.length, 40);
  assert.equal(j.arnyekcelok.ga4.measurement_id, null); assert.match(j.arnyekcelok.ga4.hiba, /ELO/);
  assert.ok(!JSON.stringify(j).includes(ELO_CELOK.ga4[0]), 'az elo GA4 ID nem kerul ki');
  const v = await vilag({ env: { GA4_TESZT_MEASUREMENT_ID: 'G-TESZT00001' } });
  assert.equal((await v.jelentes('qa=t2start')).arnyekcelok.ga4.measurement_id, 'G-TESZT00001');
});

