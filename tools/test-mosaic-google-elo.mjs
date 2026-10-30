// UJ-63 / #502 (Mosaic HeadSpa, VAZLAT) - netlify/lib/meres/google-elo.js OFFLINE TESZTEK
//   node --test tools/test-mosaic-google-elo.mjs
// Valodi SQLite (node:sqlite) a D1 helyett, hamis halozat (OAuth + uploadClickConversions), fix ora; semmi nem megy ki, nincs titok.
import test from 'node:test';
import assert from 'node:assert/strict';
import { meresSema } from '../netlify/lib/meres/elosztas.js';
import { ELO_CELOK } from '../netlify/lib/meres/platformok.js';
import { ELO_AKCIO, ELO_FIOK, eloKonverzio, eloMod, eloPotlas, elesKuldesE, valaszErtekel } from '../netlify/lib/meres/google-elo.js';
import { d1 } from './lib-sd-teszt.mjs';

const MOST = Date.UTC(2026, 9, 30, 12, 0, 0) / 1000;
const TOL = MOST - 3 * 86400;
const GCLID = 'CjwKCAjwTESZTmosaicgclid_' + 'a'.repeat(30);
const ENV = { MOSAIC_GADS_ELO: 'dry', MOSAIC_GADS_ELO_TOL: String(TOL), GOOGLE_ADS_DEVELOPER_TOKEN: 'd', GOOGLE_ADS_CLIENT_ID: 'c', GOOGLE_ADS_CLIENT_SECRET: 's', GOOGLE_ADS_REFRESH_TOKEN: 'r', GOOGLE_ADS_LOGIN_CUSTOMER_ID: '123-456-7890' };

async function adatbazis(sorok) {
  const D = d1(); await meresSema(D);
  for (const s of sorok) {
    const attr = s.nincsKattintas ? {} : { google: { gclid: { ertek: GCLID, ts: s.kattTs ?? MOST - 86400 } } };
    await D.prepare('INSERT INTO meres_erkezes (source_id, uzletag, tipus, attr, hozz, ido, frissitve) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)').bind(s.source, 'headspa', 'foglalas', JSON.stringify(attr), JSON.stringify(s.hozz || {}), MOST - 7200).run();
    await D.prepare("INSERT INTO meres_kuldes (esemeny_id, esemeny_nev, esemeny_tipus, platform, platform_nev, uzletag, source_id, allapot, ertek, probalkozas, letrehozva, frissitve) VALUES (?1, ?2, 'alap', 'google', 'ARNYEK-7825199989', ?3, ?4, ?7, ?5, 1, ?6, ?6)")
      .bind(s.esemeny, s.nev || 'FoglalasElso', s.uzletag || 'headspa', s.source, s.ertek ?? 15000, s.letrehozva ?? MOST - 7200, s.allapot || 'elkuldve').run();
  }
  return D;
}
function halozat(valasz = { status: 200, body: '{}' }) {
  const hivasok = [];
  const fetchImpl = async (url, opt) => {
    hivasok.push({ url: String(url), body: opt && opt.body ? String(opt.body) : '' , fejlec: opt && opt.headers });
    if (String(url).includes('oauth2')) return { ok: true, status: 200, json: async () => ({ access_token: 'T' }), text: async () => '{}' };
    return { ok: valasz.status < 300, status: valasz.status, text: async () => valasz.body, json: async () => JSON.parse(valasz.body) };
  };
  return { fetchImpl, hivasok };
}
const feltoltesek = (h) => h.hivasok.filter((x) => x.url.includes('uploadClickConversions'));
const tabla = async (D) => (await D.prepare('SELECT * FROM meres_google_elo ORDER BY esemeny_id').all()).results;

test('a cel az elo HeadSpa akcio, a fiok az ARNYEK/Mosaic fiok, es a vedohalo elo-listaja tartalmazza', () => {
  assert.equal(ELO_AKCIO, '7030256606'); assert.equal(ELO_FIOK, '6088874770');
  assert.ok(ELO_CELOK.google_primary.includes(ELO_AKCIO));
});

test('alapbol KI: nincs halozat, nincs iras; tol / szallito nelkul sem kuld', async () => {
  const D = await adatbazis([{ source: 's1', esemeny: 'e1' }]); const h = halozat();
  assert.deepEqual(await eloPotlas({ db: D, env: {}, host: 'www.mosaicheadspa.hu', most: MOST, fetchImpl: h.fetchImpl }), { allapot: 'ki' });
  assert.equal((await eloPotlas({ db: D, env: { ...ENV, MOSAIC_GADS_ELO_TOL: '' }, most: MOST, fetchImpl: h.fetchImpl })).allapot, 'nincs_tol');
  assert.equal((await eloPotlas({ db: D, env: { MOSAIC_GADS_ELO: 'dry', MOSAIC_GADS_ELO_TOL: String(TOL) }, most: MOST, fetchImpl: h.fetchImpl })).allapot, 'nincs_szallito');
  assert.equal(h.hivasok.length, 0);
});

test('dry: validateOnly, kattintas + ido + ertek, NINCS vendegadat, a kattintas nem kerul a D1-be', async () => {
  const D = await adatbazis([{ source: 's1', esemeny: 'e1' }]); const h = halozat();
  const r = await eloPotlas({ db: D, env: ENV, host: 'www.mosaicheadspa.hu', most: MOST, fetchImpl: h.fetchImpl });
  assert.equal(r.allapot, 'kesz'); assert.deepEqual(r.eredmenyek, { elfogadva: 1 });
  const f = feltoltesek(h); assert.equal(f.length, 1);
  assert.ok(f[0].url.includes(`/customers/${ELO_FIOK}:uploadClickConversions`));
  const b = JSON.parse(f[0].body); assert.equal(b.validateOnly, true); assert.equal(b.partialFailure, true);
  const k = b.conversions[0]; assert.equal(k.conversionAction, `customers/${ELO_FIOK}/conversionActions/${ELO_AKCIO}`); assert.equal(k.gclid, GCLID);
  assert.equal(k.conversionValue, 15000); assert.equal(k.consent.adUserData, 'GRANTED'); assert.equal(k.orderId, undefined);
  assert.deepEqual(Object.keys(k).sort(), ['conversionAction', 'conversionDateTime', 'conversionValue', 'consent', 'currencyCode', 'gclid'].sort());
  assert.equal(f[0].fejlec['login-customer-id'], '1234567890');
  const t = await tabla(D); assert.equal(t.length, 1); assert.equal(t[0].mod, 'dry'); assert.ok(!JSON.stringify(t).includes(GCLID)); assert.match(t[0].kattintas_maszk, /^[0-9a-f]{8}$/);
});

test('az eles mod kapui: engedely-jelzo + eles host nelkul dry (validateOnly) marad', async () => {
  assert.equal(eloMod({ MOSAIC_GADS_ELO: 'eles' }), 'eles');
  assert.equal(elesKuldesE({ MOSAIC_GADS_ELO: 'eles' }, 'www.mosaicheadspa.hu'), false);
  assert.equal(elesKuldesE({ MOSAIC_GADS_ELO: 'eles', MOSAIC_GADS_ELO_ENGEDELY: 'DECISION-ELES' }, 'preview.mosaic-d77.pages.dev'), false);
  assert.equal(elesKuldesE({ MOSAIC_GADS_ELO: 'dry', MOSAIC_GADS_ELO_ENGEDELY: 'DECISION-ELES' }, 'www.mosaicheadspa.hu'), false);
  assert.equal(elesKuldesE({ MOSAIC_GADS_ELO: 'eles', MOSAIC_GADS_ELO_ENGEDELY: 'DECISION-ELES' }, 'www.mosaicheadspa.hu'), true);
  const D = await adatbazis([{ source: 's1', esemeny: 'e1' }]); const h = halozat();
  await eloPotlas({ db: D, env: { ...ENV, MOSAIC_GADS_ELO: 'eles' }, host: 'www.mosaicheadspa.hu', most: MOST, fetchImpl: h.fetchImpl });
  assert.equal(JSON.parse(feltoltesek(h)[0].body).validateOnly, true);
});

test('eles (minden kapu nyitva): valodi feltoltes, idempotens (masodszor nem megy ki)', async () => {
  const env = { ...ENV, MOSAIC_GADS_ELO: 'eles', MOSAIC_GADS_ELO_ENGEDELY: 'DECISION-ELES' };
  const D = await adatbazis([{ source: 's1', esemeny: 'e1' }]); const h = halozat();
  const r = await eloPotlas({ db: D, env, host: 'www.mosaicheadspa.hu', most: MOST, fetchImpl: h.fetchImpl });
  assert.deepEqual(r.eredmenyek, { elkuldve: 1 }); assert.equal(JSON.parse(feltoltesek(h)[0].body).validateOnly, false);
  await eloPotlas({ db: D, env, host: 'www.mosaicheadspa.hu', most: MOST + 60, fetchImpl: h.fetchImpl });
  assert.equal(feltoltesek(h).length, 1);
});

test('kihagyasok: tol elotti, tul friss, mas uzletag / esemeny, nincs kattintas, ablakon kivuli kattintas', async () => {
  const D = await adatbazis([
    { source: 'a', esemeny: 'regi', letrehozva: TOL - 10 },
    { source: 'b', esemeny: 'friss', letrehozva: MOST - 60 },
    { source: 'c', esemeny: 'szor', uzletag: 'szor' },
    { source: 'd', esemeny: 'konz', nev: 'Konzultacio' },
    { source: 'e', esemeny: 'nincskatt', nincsKattintas: true },
    { source: 'f', esemeny: 'lejart', kattTs: MOST - 40 * 86400 },
    { source: 'g', esemeny: 'jo' },
    { source: 'h', esemeny: 'lemondott', allapot: 'kihagyva' }, // a lemondott / kizart sort a meglevo lanc mar kiszurte: kattintassal sem toltjuk fel
  ]);
  const h = halozat(); const r = await eloPotlas({ db: D, env: ENV, most: MOST, fetchImpl: h.fetchImpl, limit: 10 });
  assert.deepEqual(r.eredmenyek, { kihagyva_nincs_kattintas: 1, kihagyva_ablakon_kivul: 1, elfogadva: 1 });
  assert.equal(feltoltesek(h).length, 1);
});

test('mar bent / hiba: a partialFailure "mar bent" kod sikernek szamit, mas hiba legfeljebb 3 probalkozas', async () => {
  const pf = (kod) => JSON.stringify({ partialFailureError: { details: [{ errors: [{ errorCode: { conversionUploadError: kod } }] }] } });
  assert.deepEqual(valaszErtekel(200, pf('CLICK_CONVERSION_ALREADY_EXISTS'), { validate: false }), { allapot: 'mar_bent', kod: 'CLICK_CONVERSION_ALREADY_EXISTS' });
  assert.equal(valaszErtekel(200, pf('EXPIRED_EVENT'), { validate: false }).allapot, 'hiba');
  assert.equal(valaszErtekel(500, 'x', { validate: true }).kod, 'HTTP_500');
  const D = await adatbazis([{ source: 's1', esemeny: 'e1' }]); const h = halozat({ status: 400, body: pf('EXPIRED_EVENT') });
  for (let i = 0; i < 5; i++) await eloPotlas({ db: D, env: ENV, most: MOST + i, fetchImpl: h.fetchImpl });
  assert.equal(feltoltesek(h).length, 3); assert.equal((await tabla(D))[0].probalkozas, 3);
});

test('a valasz kattintas-visszhangja kitakarva, a hiba a naploba nem viszi a gclid-et; eloKonverzio tiszta fuggveny', async () => {
  const D = await adatbazis([{ source: 's1', esemeny: 'e1' }]); const h = halozat({ status: 400, body: JSON.stringify({ error: { status: 'INVALID', message: GCLID } }) });
  await eloPotlas({ db: D, env: ENV, most: MOST, fetchImpl: h.fetchImpl });
  assert.ok(!JSON.stringify(await tabla(D)).includes(GCLID));
  assert.equal(eloKonverzio({ ido: MOST, kattintas: { tipus: 'x', ertek: 'a' } }), null);
  assert.equal(eloKonverzio({ ido: MOST, ertek: 0, kattintas: { tipus: 'gclid', ertek: 'a' }, jel: { ad_user_data: 'DENIED' } }).consent.adUserData, 'DENIED');
});

// --- kezi potlas-vegpont (netlify/lib/meres/google-potlas.js) ---
import crypto from 'node:crypto';
import { potlasVegpont } from '../netlify/lib/meres/google-potlas.js';
const KULCS = 'teszt-egyeztetes-kulcs';
const KULCS_HASH = crypto.createHash('sha256').update(KULCS).digest('hex');
const kerelem = (torzs, { kulcs = KULCS, metodus = 'POST', host = 'www.mosaicheadspa.hu' } = {}) => new Request(`https://${host}/api/mosaic-potlas`, { method: metodus, headers: kulcs ? { 'x-egyeztetes-kulcs': kulcs, 'content-type': 'application/json' } : {}, body: metodus === 'POST' ? JSON.stringify(torzs) : undefined });
const vegpont = async (D, h, torzs, env = {}, opt = {}) => { const r = await potlasVegpont({ request: kerelem(torzs, opt), env: { ...ENV, EGYEZTETES_KULCS_HASH: KULCS_HASH, KULCS_DB: D, ...env }, deps: { most: MOST, fetchImpl: h.fetchImpl } }); return { status: r.status, body: await r.json() }; };

test('vegpont: kulcs nelkul / rossz kulccsal / GET: 404, halozat nincs', async () => {
  const D = await adatbazis([{ source: 's1', esemeny: 'ev1' }]); const h = halozat();
  assert.equal((await vegpont(D, h, { esemeny_idk: ['ev1'], mod: 'dry' }, {}, { kulcs: '' })).status, 404);
  assert.equal((await vegpont(D, h, { esemeny_idk: ['ev1'], mod: 'dry' }, {}, { kulcs: 'rossz' })).status, 404);
  assert.equal((await vegpont(D, h, null, {}, { metodus: 'GET' })).status, 404);
  assert.equal(h.hivasok.length, 0);
});

test('vegpont: torzs-ellenorzes (1-3 azonosito, ismetlodes nincs, mod) es a globalis KI kapu', async () => {
  const D = await adatbazis([{ source: 's1', esemeny: 'ev1' }]); const h = halozat();
  assert.equal((await vegpont(D, h, { esemeny_idk: [], mod: 'dry' })).status, 400);
  assert.equal((await vegpont(D, h, { esemeny_idk: ['ev1', 'ev2', 'ev3', 'ev4'], mod: 'dry' })).status, 400);
  assert.equal((await vegpont(D, h, { esemeny_idk: ['ev1', 'ev1'], mod: 'dry' })).status, 400);
  assert.equal((await vegpont(D, h, { esemeny_idk: ['e1;drop'], mod: 'dry' })).status, 400);
  assert.equal((await vegpont(D, h, { esemeny_idk: ['ev1'], mod: 'x' })).status, 400);
  assert.equal((await vegpont(D, h, { esemeny_idk: ['ev1'], mod: 'dry' }, { MOSAIC_GADS_ELO: 'ki' })).status, 409);
  assert.equal(h.hivasok.length, 0);
});

test('vegpont: dry csak a megadott esemenyre fut, a valasz csak darabszam (nincs gclid)', async () => {
  const D = await adatbazis([{ source: 's1', esemeny: 'ev1' }, { source: 's2', esemeny: 'ev2' }]); const h = halozat();
  const r = await vegpont(D, h, { esemeny_idk: ['ev2'], mod: 'dry' });
  assert.equal(r.status, 200); assert.deepEqual(r.body, { ok: true, mod: 'dry', allapot: 'kesz', feldolgozva: 1, eredmenyek: { elfogadva: 1 } });
  assert.equal(feltoltesek(h).length, 1); assert.ok(!JSON.stringify(r.body).includes(GCLID));
  assert.deepEqual((await tabla(D)).map((x) => x.esemeny_id), ['ev2']);
});

test('vegpont: eles kapu zarva (nincs engedely-jelzo / nem eles host) -> 409; kapuk nyitva -> valodi feltoltes', async () => {
  const D = await adatbazis([{ source: 's1', esemeny: 'ev1' }]); const h = halozat();
  assert.equal((await vegpont(D, h, { esemeny_idk: ['ev1'], mod: 'eles' }, { MOSAIC_GADS_ELO: 'eles' })).status, 409);
  assert.equal((await vegpont(D, h, { esemeny_idk: ['ev1'], mod: 'eles' }, { MOSAIC_GADS_ELO: 'eles', MOSAIC_GADS_ELO_ENGEDELY: 'DECISION-ELES' }, { host: 'preview.mosaic-d77.pages.dev' })).status, 409);
  assert.equal((await vegpont(D, h, { esemeny_idk: ['ev1'], mod: 'eles' }, { MOSAIC_GADS_ELO: 'dry', MOSAIC_GADS_ELO_ENGEDELY: 'DECISION-ELES' })).status, 409);
  assert.equal(h.hivasok.length, 0);
  const ok = await vegpont(D, h, { esemeny_idk: ['ev1'], mod: 'eles' }, { MOSAIC_GADS_ELO: 'eles', MOSAIC_GADS_ELO_ENGEDELY: 'DECISION-ELES' });
  assert.equal(ok.status, 200); assert.deepEqual(ok.body.eredmenyek, { elkuldve: 1 }); assert.equal(JSON.parse(feltoltesek(h)[0].body).validateOnly, false);
});

test('nem ideiglenes Google-hiba (pl. INVALID_CONVERSION_ACTION_TYPE): egy probalkozas utan vegleges, nem ismetlodik', async () => {
  const pf = JSON.stringify({ partialFailureError: { details: [{ errors: [{ errorCode: { conversionUploadError: 'INVALID_CONVERSION_ACTION_TYPE' } }] }] } });
  const D = await adatbazis([{ source: 's1', esemeny: 'ev1' }]); const h = halozat({ status: 200, body: pf });
  for (let i = 0; i < 4; i++) await eloPotlas({ db: D, env: ENV, most: MOST + i, fetchImpl: h.fetchImpl });
  assert.equal(feltoltesek(h).length, 1); const t = await tabla(D); assert.equal(t[0].allapot, 'hiba'); assert.equal(t[0].probalkozas, 3);
});
