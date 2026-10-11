// GOLDEN-KEP a MOTOROS (sajat booking_id-s) arnyek-kuldesrol - a Salonic-direct safety net (DECISION #127 (b), v2 terv) paritas-vedoje.
// A fixture (tools/fixtures/golden-motor-kerelem.json) a safety net MODOSITASA ELOTTI kodbol keszult; a teszt (tools/test-salonic-direct.mjs) ugyanezt a kepet
// ujraszamolja es BAJTRA azonosnak kovetel: a motoros foglalasok platform-kereseinek torzse, URL-je es a meres_kuldes naplo regi oszlopai nem valtozhatnak.
//   node tools/meres-proba/golden-motor.mjs --ir     a fixture ujrairasa (CSAK szandekos, jovahagyott valtozasnal!)
//   node tools/meres-proba/golden-motor.mjs           kiirja a kep meretet
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { esemenyek } from '../../netlify/lib/meres/esemeny-modell.js';
import { hashEmail, hashTelefon, sha256hex } from '../../netlify/lib/meres/hash.js';
import { erkezesTisztit } from '../../netlify/lib/meres/erkezes.js';
import { hozzajarulasTisztit, platformSzabaly } from '../../netlify/lib/meres/hozzajarulas.js';
import { KEREM_EPITO, PLATFORMOK } from '../../netlify/lib/meres/platformok.js';
import { elosztas, erkezesMent } from '../../netlify/lib/meres/elosztas.js';

export const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'golden-motor-kerelem.json');
const BID = 'mb_0muwq2ciorsos0tznsfyliq';
const PI = 'pi_3Sabc123XYZabc456';
const NOW = Date.UTC(2026, 9, 6, 14, 0, 0);
const IDO = Math.floor(NOW / 1000) - 60;
const ENV = { META_TESZT_KOD: 'TEST12345', TIKTOK_TESZT_KOD: 'TEST67890', GA4_TESZT_MEASUREMENT_ID: 'G-TESZT00001' };
const TELJES_ENV = { ...ENV, MERES_ELOSZTO: '1', META_CAPI_TOKEN: 't', TIKTOK_EVENTS_TOKEN: 't', GOOGLE_ARNYEK_WEBHOOK_URL: 'https://hooks.zapier.com/hooks/catch/1/teszt/', GA4_TESZT_API_SECRET: 't' };
const BE = () => ({
  google: { gclid: { ertek: 'Cj0KCQjw_TESZT_gclid_0123456789', ts: IDO - 100 }, wbraid: { ertek: 'CoMKCQ_wbraid_TESZT_0123', ts: IDO - 50 } },
  meta: { fbc: `fb.1.${(IDO - 90) * 1000}.IwAR_fbclid_TESZT_01`, fbclid: 'IwAR_fbclid_TESZT_01', ts: IDO - 90 },
  tiktok: { ttclid: { ertek: 'E.C.P.ttclid_TESZT_01', ts: IDO - 80 } },
  utm_elso: { source: 'google', medium: 'cpc', campaign: 'elso', ts: IDO - 5000 }, utm_utolso: { source: 'facebook', medium: 'paid', campaign: 'utolso', ts: IDO - 90 },
  fbp: `fb.1.${(IDO - 9000) * 1000}.1234567890`, ttp: 'ttp_TESZT_0123456789abcdef',
  ga4: { client_id: '1234567890.1759759200', session_id: '1759759200', measurement_id: 'G-H4206SQ0Q7' },
});
const FK = (o = {}) => ({ tipus: 'foglalas', uzletag: 'headspa', source_entity_id: BID, jelleg: 'elso', kupon: false, ertek: 26900, ido: IDO, szolgaltatas: 'HeadSpa', vendeg: { email: 'Teszt.Claude@Example.com', telefon: '06 70 942 0090' }, ...o });

async function ctxEpit(fkMod, hozz, erk) {
  const fk = FK(fkMod); const v = fk.vendeg; const h = hozzajarulasTisztit(hozz);
  return { fk, erk, ua: 'Mozilla/5.0 TESZT', ip: '203.0.113.7', oldal: 'https://www.mosaicheadspa.hu/koszonjuk', hozz: { meta: platformSzabaly('meta', h), tiktok: platformSzabaly('tiktok', h), google: platformSzabaly('google', h), ga4: platformSzabaly('ga4', h) },
    hash: { em: await hashEmail(v.email), ph_meta: await hashTelefon(v.telefon), ph_e164: await hashTelefon(v.telefon, { plusz: true }), ext: await sha256hex(v.email.toLowerCase()) } };
}
function d1() {
  const db = new DatabaseSync(':memory:');
  const kot = (sql, args = []) => ({
    run: async () => { const r = db.prepare(sql).run(...args); return { success: true, meta: { changes: Number(r.changes) } }; },
    first: async () => db.prepare(sql).get(...args) || null,
    all: async () => ({ results: db.prepare(sql).all(...args).map((r) => ({ ...r })) }),
  });
  return { db, prepare: (sql) => ({ bind: (...args) => kot(sql, args), ...kot(sql, []) }), batch: async (stmts) => { for (const s of stmts) await s.run(); } };
}
const SIKER = { 'graph.facebook.com': { events_received: 1, fbtrace_id: 'x' }, 'business-api.tiktok.com': { code: 0, message: 'OK' }, 'hooks.zapier.com': { results: [{}] }, 'google-analytics.com': {} };
function hamisFetch() {
  const hivasok = [];
  const f = async (url, o = {}) => {
    const u = String(url);
    if (u.includes('/debug/mp/collect')) return { status: 200, text: async () => JSON.stringify({ validationMessages: [] }) };
    const host = Object.keys(SIKER).find((h) => u.includes(h));
    hivasok.push({ url: u.replace(/access_token=[^&]*/, 'access_token=*'), method: o.method || 'GET', body: o.body ? JSON.parse(o.body) : null });
    return { status: 200, text: async () => JSON.stringify(host ? SIKER[host] : {}) };
  };
  return { f, hivasok };
}

/** A teljes golden-kep: (1) a platform-kerelem epitok kimenete a motoros esetek matrixara; (2) az elosztas() vegpontig menő HTTP-kereseit es a naplo REGI oszlopait. */
export async function motorKepek() {
  const kerelmek = {};
  const valtozatok = { teljes: [{ ana: true, adv: true }, () => erkezesTisztit(BE(), NOW).adat], ures: [null, () => ({})], hozzajarulasNelkul: [{ ana: false, adv: false }, () => erkezesTisztit(BE(), NOW).adat] };
  const esetek = [];
  for (const uzletag of ['headspa', 'fodrasz', 'oxigen', 'szor', 'pmu']) for (const jelleg of ['elso', 'konzultacio', 'visszajaro']) for (const kupon of [false, true]) esetek.push({ uzletag, jelleg, kupon });
  esetek.push({ uzletag: 'headspa', tipus: 'ajandekkartya', jelleg: undefined, source_entity_id: PI, ertek: 53800, kupon: false });
  for (const [vnev, [hozz, erkF]] of Object.entries(valtozatok)) {
    for (const eset of esetek) {
      const ctx = await ctxEpit(eset, hozz, erkF());
      for (const e of esemenyek(ctx.fk)) for (const p of PLATFORMOK) {
        const kulcs = [vnev, eset.uzletag, eset.tipus || eset.jelleg, eset.kupon ? 'kupon' : 'nemkupon', e.esemeny_id, p].join('|');
        kerelmek[kulcs] = KEREM_EPITO[p](e, ctx, ENV);
      }
    }
  }
  const elosztasok = {};
  // az *_uuid esetek a VALODI motoros utat adjak (foglalas-esemeny.js: fk.uuid = a Salonic-UUID): a regi naplo-oszlopok es a kerelmek ettol sem valtozhatnak
  const UUID_A = '7d3f1c52-3b0a-4f59-9a1e-5c2d8b6e4a10'; const UUID_B = '2e9b4a67-81c3-4d05-b7f2-0a6c9d1e3f48'; const UUID_C = 'c4a85e13-6f2d-4b90-8e37-1d5a7f0b9c26';
  for (const [nev, fkMod, erkMod] of [['headspa_elso', {}, {}], ['pmu_konzultacio', { uzletag: 'pmu', jelleg: 'konzultacio', ertek: 0 }, { uzletag: 'pmu' }], ['fodrasz_visszajaro', { uzletag: 'fodrasz', jelleg: 'visszajaro' }, { uzletag: 'fodrasz' }],
    ['headspa_elso_uuid', { uuid: UUID_A }, {}], ['pmu_konzultacio_uuid', { uzletag: 'pmu', jelleg: 'konzultacio', ertek: 0, uuid: UUID_B }, { uzletag: 'pmu' }], ['fodrasz_visszajaro_uuid', { uzletag: 'fodrasz', jelleg: 'visszajaro', uuid: UUID_C.toUpperCase() }, { uzletag: 'fodrasz' }]]) {
    const db = d1(); const { f, hivasok } = hamisFetch();
    await erkezesMent(db, { source_id: BID, uzletag: 'headspa', attr: BE(), hozz: { ana: true, adv: true, fun: true }, ua: 'UA TESZT', ip: '203.0.113.7', oldal: 'https://www.mosaicheadspa.hu/koszonjuk', ...erkMod }, NOW);
    const r = await elosztas(db, FK(fkMod), { env: TELJES_ENV, fetchImpl: f, now: () => NOW });
    const sorok = db.db.prepare('SELECT esemeny_id, esemeny_nev, esemeny_tipus, platform, platform_nev, uzletag, source_id, allapot, indok, ertek, penznem, hozzajarulas, kerelem, http_status, platform_valasz, kuldo, probalkozas, letrehozva, frissitve FROM meres_kuldes ORDER BY id').all().map((x) => ({ ...x }));
    elosztasok[nev] = { allapot: r.allapot, hivasok, sorok };
  }
  return JSON.parse(JSON.stringify({ kerelmek, elosztasok }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const kep = await motorKepek();
  if (process.argv.includes('--ir')) { fs.mkdirSync(path.dirname(FIXTURE), { recursive: true }); fs.writeFileSync(FIXTURE, JSON.stringify(kep) + '\n'); console.log('fixture irva:', FIXTURE); }
  console.log('kerelmek:', Object.keys(kep.kerelmek).length, '| elosztas esetek:', Object.keys(kep.elosztasok).length, '| hivasok:', Object.values(kep.elosztasok).reduce((a, x) => a + x.hivasok.length, 0), '| naplosorok:', Object.values(kep.elosztasok).reduce((a, x) => a + x.sorok.length, 0));
}
