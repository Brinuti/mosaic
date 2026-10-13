// VENDEG-HASH INDEX "MIERT" KOD (a meresi oldal kerese, #167 137. komment): ha egy parositott letrehozo levelhez nem keszul foglalas_vendeg sor, az OK lathato legyen
// a /api/foglalas-egyeztetes valaszaban (r.vendeg_index) PII NELKUL (kod + mezo-allapot enum; ertek soha). A hook tovabbra is fail-open.
//   node --test tools/test-vendeg-index-miert.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { VENDEG, NEV, SD_ENV, level, ujUuid, vilag } from './lib-sd-teszt.mjs';
import { mezoAllapot, vendegMezoAllapot } from '../netlify/lib/meres/salonic-direct.js';
import { emailNormal, telefonSzamjegy } from '../netlify/lib/meres/hash.js';

const szamol = (v) => v.sql("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='foglalas_vendeg'")[0].n ? v.sql('SELECT COUNT(*) AS n FROM foglalas_vendeg')[0].n : 0;
const PII = [VENDEG.email, VENDEG.telefon, '36300000001', NEV, 'teszt.claude'];
const nincsPii = (o) => { const s = JSON.stringify(o).toLowerCase(); for (const t of PII) assert.ok(!s.includes(String(t).toLowerCase()), `PII a valaszban: ${t}`); };

test('M1 mezoAllapot / vendegMezoAllapot: csak enum, soha nem az ertek', () => {
  assert.equal(mezoAllapot(undefined, emailNormal), 'hianyzik');
  assert.equal(mezoAllapot(null, emailNormal), 'hianyzik');
  assert.equal(mezoAllapot('   ', emailNormal), 'hianyzik');
  assert.equal(mezoAllapot('nem-email', emailNormal), 'ervenytelen_formatum');
  assert.equal(mezoAllapot('valaki@pelda', emailNormal), 'ervenytelen_formatum', 'domain pont nelkul');
  assert.equal(mezoAllapot(' Valaki@Pelda.HU ', emailNormal), 'ervenyes');
  assert.equal(mezoAllapot('abc', telefonSzamjegy), 'ervenytelen_formatum');
  assert.equal(mezoAllapot('+36 30 000 0001', telefonSzamjegy), 'ervenyes');
  assert.deepEqual(vendegMezoAllapot({ email: '', telefon: '06 30 000 0001' }, 'Ab'), { email: 'hianyzik', telefon: 'ervenyes', nev: 'ervenytelen_formatum' });
  assert.deepEqual(vendegMezoAllapot(undefined, undefined), { email: 'hianyzik', telefon: 'hianyzik', nev: 'hianyzik' });
  for (const x of [vendegMezoAllapot({ email: 'titok@pelda.hu', telefon: '+36301234567' }, 'Kovacs Anna')]) for (const e of Object.values(x)) assert.ok(['hianyzik', 'ervenytelen_formatum', 'ervenyes'].includes(e));
});

test('M2 rendben: valos e-mail + telefon + nev -> ok_uj, a 2. proba ok_meglevo; a sor megvan; a valasz PII-mentes', async () => {
  const v = vilag({ sd: false, env: { MERES_SD_INDEX: '1', GUEST_HMAC_KEY_V1: SD_ENV.GUEST_HMAC_KEY_V1, SD_HMAC_KEY_V1: SD_ENV.SD_HMAC_KEY_V1 } }); await v.kesz;
  const u = ujUuid();
  const a = await v.post(level(u, {}));
  assert.deepEqual(a.vendeg_index, { allapot: 'ok', kod: 'ok_uj', mezok: { email: 'ervenyes', telefon: 'ervenyes', nev: 'ervenyes' } });
  const b = await v.post(level(u, {}));
  assert.deepEqual([b.vendeg_index.allapot, b.vendeg_index.kod], ['meglevo', 'ok_meglevo']);
  assert.equal(szamol(v), 1);
  nincsPii(a); nincsPii(b);
});

test('M3 nincs ervenyes e-mail (a 2026-10-13-i dca36449 / 9a03d9f7 eset): telefon van, e-mail hianyzik -> jelolo / nincs_ervenyes_email; nincs HASH-index sor (csak a jelolo, lasd test-vendeg-jelolo-sor.mjs); a parositas VALTOZATLAN', async () => {
  const v = vilag({ sd: false, env: { MERES_SD_INDEX: '1', GUEST_HMAC_KEY_V1: SD_ENV.GUEST_HMAC_KEY_V1, SD_HMAC_KEY_V1: SD_ENV.SD_HMAC_KEY_V1 } }); await v.kesz;
  const a = await v.post(level(ujUuid(), { vendeg: { telefon: VENDEG.telefon } }));
  assert.deepEqual(a.vendeg_index, { allapot: 'jelolo', kod: 'nincs_ervenyes_email', mezok: { email: 'hianyzik', telefon: 'ervenyes', nev: 'ervenyes' }, jelolo: 'uj' });
  assert.equal(v.sql('SELECT COUNT(*) AS n FROM foglalas_vendeg WHERE email_h IS NOT NULL')[0].n, 0, 'valodi hash-index sor nincs');
  assert.equal(szamol(v), 1, 'csak a jelolo sor');
  nincsPii(a);
  // ugyanaz a level e-mail NELKUL ugyanazt az allapotot adja a parositasra, mint e-mail-lel (a diagnosztika nem valtoztat a viselkedesen)
  const w = vilag({ sd: false, env: { MERES_SD_INDEX: '1', GUEST_HMAC_KEY_V1: SD_ENV.GUEST_HMAC_KEY_V1, SD_HMAC_KEY_V1: SD_ENV.SD_HMAC_KEY_V1 } }); await w.kesz;
  const b = await w.post(level(ujUuid(), {}));
  const { vendeg_index: _x, ...a2 } = a; const { vendeg_index: _y, ...b2 } = b;
  assert.equal(a2.allapot, b2.allapot);
});

test('M4 az e-mail mezo letezik, de ervenytelen formatumu -> mezok.email = ervenytelen_formatum (kulonbseg a "hianyzik"-tol)', async () => {
  const v = vilag({ sd: false, env: { MERES_SD_INDEX: '1', GUEST_HMAC_KEY_V1: SD_ENV.GUEST_HMAC_KEY_V1, SD_HMAC_KEY_V1: SD_ENV.SD_HMAC_KEY_V1 } }); await v.kesz;
  for (const email of ['nem-email', 'valaki@pelda', 'valaki pelda.hu', 'valaki@@pelda.hu']) {
    const a = await v.post(level(ujUuid(), { vendeg: { email, telefon: VENDEG.telefon } }));
    assert.equal(a.vendeg_index.kod, 'nincs_ervenyes_email', email);
    assert.equal(a.vendeg_index.mezok.email, 'ervenytelen_formatum', email);
    assert.ok(!JSON.stringify(a).includes('pelda'), 'az ertek nem szerepel');
  }
  assert.equal(v.sql('SELECT COUNT(*) AS n FROM foglalas_vendeg WHERE email_h IS NOT NULL')[0].n, 0, 'valodi hash-index sor nincs');
  assert.equal(szamol(v), 4, 'negy level -> negy jelolo sor');
});

test('M5 nincs vendeg mezo / nem objektum -> nincs_vendeg_mezo / vendeg_nem_objektum (korabban nema kihagyas)', async () => {
  const v = vilag({ sd: false, env: { MERES_SD_INDEX: '1', GUEST_HMAC_KEY_V1: SD_ENV.GUEST_HMAC_KEY_V1, SD_HMAC_KEY_V1: SD_ENV.SD_HMAC_KEY_V1 } }); await v.kesz;
  const a = await v.post(level(ujUuid(), { vendeg: undefined }));
  assert.deepEqual(a.vendeg_index, { allapot: 'kihagyva', kod: 'nincs_vendeg_mezo' });
  const b = await v.post(level(ujUuid(), { vendeg: null }));
  assert.equal(b.vendeg_index.kod, 'nincs_vendeg_mezo');
  const c = await v.post(level(ujUuid(), { vendeg: 'valaki@pelda.hu' }));
  assert.deepEqual(c.vendeg_index, { allapot: 'kihagyva', kod: 'vendeg_nem_objektum' });
  assert.ok(!JSON.stringify(c).includes('pelda'));
  assert.equal(szamol(v), 0);
});

test('M6 hianyzo GUEST_HMAC_KEY_V1 -> nincs_guest_hmac_kulcs; ismeretlen host -> ismeretlen_host', async () => {
  const v = vilag({ sd: false, env: { MERES_SD_INDEX: '1', SD_HMAC_KEY_V1: SD_ENV.SD_HMAC_KEY_V1 } }); await v.kesz; // nincs GUEST kulcs
  const a = await v.post(level(ujUuid(), {}));
  assert.equal(a.vendeg_index.kod, 'nincs_guest_hmac_kulcs');
  assert.equal(szamol(v), 0, 'GUEST kulcs nelkul a jelolo sem keszul (az sd ugyis inert)');
  const w = vilag({ sd: false, env: { MERES_SD_INDEX: '1', GUEST_HMAC_KEY_V1: SD_ENV.GUEST_HMAC_KEY_V1, SD_HMAC_KEY_V1: SD_ENV.SD_HMAC_KEY_V1 } }); await w.kesz;
  const b = await w.post(level(ujUuid(), { host: 'ismeretlen.salonic.hu' }));
  assert.equal(b.vendeg_index.kod, 'ismeretlen_host');
});

test('M7 kapu zarva (sem MERES_SALONIC_DIRECT, sem MERES_SD_INDEX): nincs vendeg_index kulcs a valaszban, nincs iras (a valasz alakja valtozatlan)', async () => {
  const v = vilag({ sd: false }); await v.kesz;
  const a = await v.post(level(ujUuid(), {}));
  assert.ok(!('vendeg_index' in a));
  assert.equal(szamol(v), 0);
});

test('M8 kivetel az index-irasban: allapot=hiba, kod=kivetel, a hibauzenet PII-mentesitve (e-mail, hosszu szamsor maszkolva, <= 120 + elotag); a PAROSITAS es az esemenyek kuldese nem akad meg', async () => {
  const v = vilag({ sd: false, env: { MERES_SD_INDEX: '1', GUEST_HMAC_KEY_V1: SD_ENV.GUEST_HMAC_KEY_V1, SD_HMAC_KEY_V1: SD_ENV.SD_HMAC_KEY_V1 } }); await v.kesz;
  const dob = async () => { throw new Error(`D1_ERROR: valami hiba valaki@pelda.hu 36301234567 ${'x'.repeat(300)}`); };
  const a = await v.post(level(ujUuid(), {}), { vendegIndexIr: dob });
  assert.equal(a.vendeg_index.allapot, 'hiba'); assert.equal(a.vendeg_index.kod, 'kivetel');
  assert.ok(a.vendeg_index.hiba.startsWith('Error: D1_ERROR'));
  assert.ok(!a.vendeg_index.hiba.includes('valaki@pelda.hu') && !a.vendeg_index.hiba.includes('36301234567'));
  assert.ok(a.vendeg_index.hiba.includes('<email>') && a.vendeg_index.hiba.includes('<szam>'));
  assert.ok(a.vendeg_index.hiba.length <= 120 + 'Error: '.length);
  assert.ok(['parositott', 'parositatlan', 'fuggoben'].includes(a.allapot) || typeof a.allapot === 'string', 'a parositas valaszt adott');
  assert.equal(a.ok, true);
});

test('M9 az index-iras eredmenye nem nyel el semmit: a backfill / dry-run (vendegIndexSor) kod + mezok mezoje is PII-mentes', async () => {
  const { vendegIndexSor } = await import('../netlify/lib/meres/salonic-direct.js');
  const v = vilag({ sd: false, env: { MERES_SD_INDEX: '1', GUEST_HMAC_KEY_V1: SD_ENV.GUEST_HMAC_KEY_V1, SD_HMAC_KEY_V1: SD_ENV.SD_HMAC_KEY_V1 } }); await v.kesz;
  const mezok = { uuid: ujUuid(), host: 'mosaic-pmu.salonic.hu', szolgaltatas: 'Soft powder', idopontSzoveg: 'Október 20. (kedd) 16:00 - 17:00', leveldatum: '2026-10-06T13:36:32Z' };
  const szaraz = await vendegIndexSor(v.db, v.e, { mezok, vendeg: { email: 'valaki@pelda.hu', telefon: '+36 30 000 0001' }, nev: 'Teszt Claude', szaraz: true });
  assert.deepEqual([szaraz.ok, szaraz.kod], [true, 'szaraz']);
  const hibas = await vendegIndexSor(v.db, v.e, { mezok, vendeg: { email: '', telefon: '+36 30 000 0001' }, nev: 'Teszt Claude', szaraz: true });
  assert.deepEqual([hibas.ok, hibas.kod, hibas.miert], [false, 'nincs_ervenyes_email', 'nincs ervenyes e-mail'], 'a regi miert-szoveg valtozatlan (visszafele kompatibilis)');
  assert.deepEqual(hibas.mezok, { email: 'hianyzik', telefon: 'ervenyes', nev: 'ervenyes' });
});
