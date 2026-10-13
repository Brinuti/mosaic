// JELOLO SOR (a meresi oldal jovahagyta, #167 143. komment (b)): ha a level megerkezett, de nincs ervenyes e-mail, a foglalas_vendeg tablaba STRUKTURALIS jelolo sor kerul
// (email_h / tel_h / nev_h = NULL, forras = 'level_nincs_email' | 'sd_atvetel_nincs_email'). A reschedule-logika VALTOZATLAN. Az sd e-mail nelkuli viselkedese is itt van rogzitve (143. komment 4. kerdese).
//   node --test tools/test-vendeg-jelolo-sor.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { ELO_CELOK } from '../netlify/lib/meres/platformok.js';
import { FIX_UUID, NEV, SD_ENV, T0, VENDEG, iso, level, lezar, ujUuid, vilag } from './lib-sd-teszt.mjs';

const SD_ELOTT = T0 + 1300_000; // a letrehozo level utan ~21,7 perccel (a Zap 5. lepese)
const IDX_ENV = { MERES_SD_INDEX: '1', GUEST_HMAC_KEY_V1: SD_ENV.GUEST_HMAC_KEY_V1, SD_HMAC_KEY_V1: SD_ENV.SD_HMAC_KEY_V1 };
const EMAIL_NELKUL = { telefon: VENDEG.telefon };
const MEGJ_99 = 'A korábbi 16 órás foglalásomat cserélném erre.';
const sorok = (v) => v.sql('SELECT * FROM foglalas_vendeg ORDER BY ido, uuid');
const valodi = (v) => v.sql('SELECT COUNT(*) AS n FROM foglalas_vendeg WHERE email_h IS NOT NULL')[0].n;
const hivasNev = (v) => v.net.hivasok.map((h) => `${h.kulcs}:${h.body.data ? (h.body.data[0].event_name || h.body.data[0].event) : ''}`);

test('J1 e-mail nelkuli level -> pontosan egy JELOLO sor: email_h / tel_h / nev_h NULL, forras level_nincs_email, strukturalis mezok megvannak; idempotens (4 proba -> 1 sor); nincs PII', async () => {
  const v = vilag({ sd: false, env: IDX_ENV }); await v.kesz;
  const u = ujUuid();
  const a = await v.post(level(u, { vendeg: EMAIL_NELKUL }));
  assert.deepEqual(a.vendeg_index, { allapot: 'jelolo', kod: 'nincs_ervenyes_email', mezok: { email: 'hianyzik', telefon: 'ervenyes', nev: 'ervenyes' }, jelolo: 'uj' });
  const b = await v.post(level(u, { vendeg: EMAIL_NELKUL }));
  assert.deepEqual([b.vendeg_index.allapot, b.vendeg_index.jelolo], ['jelolo', 'meglevo']);
  const s = sorok(v);
  assert.equal(s.length, 1);
  assert.deepEqual([s[0].uuid, s[0].uzletag, s[0].allapot, s[0].forras, s[0].email_h, s[0].tel_h, s[0].nev_h, s[0].szolg_kulcs], [u, 'pmu', 'aktiv', 'level_nincs_email', null, null, null, 'soft powder']);
  assert.equal(s[0].kezdet, Date.parse('2026-10-20T14:00:00Z') / 1000);
  assert.equal(s[0].lejar - s[0].ido, 180 * 86400, 'a megorzes ugyanaz, mint a valodi soroke');
  const dump = JSON.stringify(s).toLowerCase();
  for (const t of [VENDEG.email, VENDEG.telefon, '36300000001', NEV, 'example.com']) assert.ok(!dump.includes(String(t).toLowerCase()), `PII a jelolo sorban: ${t}`);
  assert.equal(valodi(v), 0, 'valodi hash-index sor nincs');
  assert.equal(v.net.hivasok.length, 0, 'a jelolo kuldes nelkuli');
});

test('J2 jelolo csak ott, ahol a vendeg-objektum LETEZIK: nincs vendeg mezo / nem objektum / nincs GUEST kulcs / ismeretlen host -> NINCS jelolo (az valodi kimaradas marad, a kod megmondja az okot)', async () => {
  const v = vilag({ sd: false, env: IDX_ENV }); await v.kesz;
  assert.equal((await v.post(level(ujUuid(), { vendeg: undefined }))).vendeg_index.kod, 'nincs_vendeg_mezo');
  assert.equal((await v.post(level(ujUuid(), { vendeg: 'x' }))).vendeg_index.kod, 'vendeg_nem_objektum');
  assert.equal((await v.post(level(ujUuid(), { vendeg: EMAIL_NELKUL, host: 'ismeretlen.salonic.hu' }))).vendeg_index.kod, 'ismeretlen_host');
  const w = vilag({ sd: false, env: { MERES_SD_INDEX: '1', SD_HMAC_KEY_V1: SD_ENV.SD_HMAC_KEY_V1 } }); await w.kesz; // nincs GUEST kulcs
  assert.equal((await w.post(level(ujUuid(), { vendeg: EMAIL_NELKUL }))).vendeg_index.kod, 'nincs_guest_hmac_kulcs');
  assert.equal(sorok(v).length + sorok(w).length, 0);
});

test('J3 a JELOLOT a kesobbi ervenyes e-mailes sor FELULIRJA (a valodi sor viselkedese ugyanaz, mint jelolo nelkul); valodi sort a jelolo SOSEM ir felul', async () => {
  const v = vilag({ sd: false, env: IDX_ENV }); await v.kesz;
  const u = ujUuid();
  await v.post(level(u, { vendeg: EMAIL_NELKUL }));
  assert.equal(sorok(v)[0].forras, 'level_nincs_email');
  const be = await v.post(level(u, {})); // ugyanaz az UUID, most ervenyes e-maillel (pl. az sd 5. lepese vagy egy kesobbi proba)
  assert.deepEqual([be.vendeg_index.allapot, be.vendeg_index.kod], ['ok', 'ok_uj'], 'a felulirt jelolo "uj" valodi sor');
  let s = sorok(v);
  assert.equal(s.length, 1);
  assert.deepEqual([s[0].forras, s[0].allapot], ['level', 'aktiv']);
  assert.ok([s[0].email_h, s[0].tel_h, s[0].nev_h].every((x) => /^[0-9a-f]{32}$/.test(x)), 'mindharom hash megvan');
  const ujra = await v.post(level(u, {}));
  assert.deepEqual([ujra.vendeg_index.allapot, ujra.vendeg_index.kod], ['meglevo', 'ok_meglevo']);
  const rogzitett = JSON.stringify(sorok(v));
  const nincsEmail = await v.post(level(u, { vendeg: EMAIL_NELKUL })); // a valodi sor MARAD
  assert.equal(nincsEmail.vendeg_index.jelolo, 'meglevo');
  assert.equal(JSON.stringify(sorok(v)), rogzitett, 'a valodi sort az e-mail nelkuli hivas nem irja felul');
  // a valodi sor, amely sosem volt jelolo, a regi szerint viselkedik: a 2. proba ok_meglevo, a sor nem valtozik
  const w = vilag({ sd: false, env: IDX_ENV }); await w.kesz;
  const u2 = ujUuid(); await w.post(level(u2, {}));
  const elotte = JSON.stringify(sorok(w));
  assert.equal((await w.post(level(u2, { vendeg: { email: 'masik@example.com', telefon: VENDEG.telefon } }))).vendeg_index.kod, 'ok_meglevo');
  assert.equal(JSON.stringify(sorok(w)), elotte, 'valodi sort mas e-mail sem ir felul (ON CONFLICT ... WHERE email_h IS NULL)');
});

test('J4 REGRESSZIO / reschedule-logika VALTOZATLAN: ugyanaz az sd csere-dontes jelolo sorokkal es nelkuluk (S0-17 helyzet: ugyanaz a szolgaltatas es idopont, mint a regi foglalas)', async () => {
  async function futtat(jelolokkel) {
    const v = vilag(); await v.kesz;
    const regi = ujUuid();
    await v.post(level(regi, { ld: { startDate: '2026-10-16T16:00:00+02:00' }, level_datuma: iso(T0 - 3 * 86400_000), uj_vendeg: false }));
    if (jelolokkel) { // e-mail nelkuli foglalasok UGYANARRA az idopontra / szolgaltatasra / uzletagra (a jelolt-szuro ezeket nem lathatja) - tobbfele alak
      await v.post(level(ujUuid(), { ld: { startDate: '2026-10-16T16:00:00+02:00' }, level_datuma: iso(T0 - 3 * 86400_000), uj_vendeg: false, vendeg: EMAIL_NELKUL }));
      await v.post(level(ujUuid(), { ld: { startDate: '2026-10-16T16:00:00+02:00' }, level_datuma: iso(T0 - 3 * 86400_000), uj_vendeg: false, vendeg: { email: 'nem-email', telefon: VENDEG.telefon } }));
      assert.equal(sorok(v).filter((x) => x.email_h === null).length, 2);
    }
    const u = ujUuid(); const b = level(u, { megjegyzes: MEGJ_99 });
    await lezar(v, b); v.t.set(SD_ELOTT);
    const r = await v.sd(b);
    return { r, resz: v.sql('SELECT allapot, reschedule_from, reschedule_to, regi_aktiv FROM foglalas_reschedule WHERE uuid = ?1', u), kuldes: v.net.hivasok.length, regi8: regi.slice(0, 8) };
  }
  const a = await futtat(false); const b = await futtat(true);
  assert.deepEqual([a.r.allapot, a.r.csere.allapot, a.r.csere.regi_uuid_elo8 === a.regi8], ['reschedule_confirmed', 'confirmed', true]);
  assert.deepEqual([b.r.allapot, b.r.csere.allapot, b.r.csere.regi_uuid_elo8 === b.regi8], ['reschedule_confirmed', 'confirmed', true], 'a jeloltet a jelolo sorok nem zavarjak');
  assert.deepEqual(b.r.csere.jeloltek, a.r.csere.jeloltek, 'a jelolt-szuro ugyanazt latja (indexben / azonos / mutatott)');
  assert.deepEqual([b.r.csere.reschedule_from, b.r.csere.reschedule_to, b.r.riasztas, b.r.sd_allapot], [a.r.csere.reschedule_from, a.r.csere.reschedule_to, a.r.riasztas, a.r.sd_allapot]);
  assert.deepEqual(b.resz, a.resz);
  assert.equal(b.kuldes, 0); assert.equal(a.kuldes, 0);
});

test('J5 azonosVendeg / lookup: email_h = NULL SOHA nem azonos vendeg (sem NULL = NULL, sem tel_h / nev_h egyezes mellett)', async () => {
  const { azonosVendeg } = await import('../netlify/lib/meres/salonic-direct.js');
  assert.equal(azonosVendeg({ email_h: null, tel_h: 'a', nev_h: 'b' }, { email_h: null, tel_h: 'a', nev_h: 'b' }), false);
  assert.equal(azonosVendeg({ email_h: 'x', tel_h: 'a', nev_h: 'b' }, { email_h: null, tel_h: 'a', nev_h: 'b' }), false);
  const v = vilag({ sd: false, env: IDX_ENV }); await v.kesz;
  await v.post(level(ujUuid(), { vendeg: EMAIL_NELKUL }));
  assert.deepEqual(v.sql('SELECT uuid FROM foglalas_vendeg WHERE email_h = ?1', null), [], 'a csereDontes lookupja (WHERE email_h = ?1) NULL-ra nem ad talalatot');
});

test('J6 az sd 4. kerdes: e-mail nelkuli pmu/oxigen foglalas az sd-ben (143. komment): (a) csere-gyanu szo NELKUL -> normal: UJ konverzio, csak az ARNYEK celokra, jelolo sor; (b) csere-gyanu szoval -> HOLD (halasztva, riasztas, 0 kuldes)', async () => {
  { // (a)
    const v = vilag(); await v.kesz;
    const u = ujUuid(); const b = level(u, { vendeg: EMAIL_NELKUL, megjegyzes: 'Allergiás vagyok a latexre, köszönöm!', uj_vendeg: false });
    await lezar(v, b); v.t.set(SD_ELOTT);
    const r = await v.sd(b);
    assert.deepEqual([r.allapot, r.csere], ['kesz', null], 'nincs csere-gyanu: normal sd ut');
    assert.deepEqual(hivasNev(v), ['meta:PMU_Visszajaro', 'tiktok:PMU_Visszajaro'], 'uj konverzio kimegy - de csak az arnyek celokra');
    for (const h of v.net.hivasok) { const s = JSON.stringify(h); for (const id of [...ELO_CELOK.meta, ...ELO_CELOK.tiktok, ...ELO_CELOK.ga4]) assert.ok(!s.includes(id), 'elo cel: ' + id); }
    assert.deepEqual(sorok(v).map((x) => [x.uuid, x.email_h, x.forras]), [[u, null, 'level_nincs_email']], 'a jelolo sor megvan, valodi index-sor nincs');
  }
  { // (b)
    const v = vilag(); await v.kesz;
    const u = ujUuid(); const b = level(u, { vendeg: EMAIL_NELKUL, megjegyzes: MEGJ_99 });
    await lezar(v, b); v.t.set(SD_ELOTT);
    const r = await v.sd(b);
    assert.deepEqual([r.allapot, r.sd_allapot, r.csere.allapot, r.riasztas], ['halasztva', 'halasztva', 'suspected', true]);
    assert.match(r.csere.ok, /nincs vendeg-hash/);
    assert.equal(v.net.hivasok.length, 0, 'HOLD: nincs automatikus kuldes');
    assert.equal(v.sql("SELECT COUNT(*) AS n FROM meres_kuldes WHERE allapot = 'halasztva'")[0].n > 0, true);
  }
});

test('J7 az sd 5. lepese e-maillel, a level e-mail NELKUL jott: a valodi index-sor az sd_atvetelnel keletkezik (a jelolot felulirja); e-mail nelkuli sd-atvetel jelolot ir, ha a level-hook nem futott', async () => {
  { // a level jelolot irt, az sd mar e-maillel
    const v = vilag(); await v.kesz;
    const u = ujUuid(); const lev = level(u, { vendeg: EMAIL_NELKUL });
    await lezar(v, lev);
    assert.equal(sorok(v)[0].forras, 'level_nincs_email');
    v.t.set(SD_ELOTT);
    const r = await v.sd(level(u, {})); // az sd_atvetel torzs: ervenyes e-mail
    assert.equal(r.allapot, 'kesz');
    assert.deepEqual(sorok(v).map((x) => [x.forras, /^[0-9a-f]{32}$/.test(x.email_h)]), [['sd_atvetel', true]]);
  }
  { // a level-hook nem futott (vagy hibazott): az sd e-mail nelkuli atvetele ir jelolot
    const v = vilag(); await v.kesz;
    const u = ujUuid();
    v.t.set(SD_ELOTT);
    const r = await v.sd(level(u, { vendeg: EMAIL_NELKUL }));
    assert.equal(r.allapot, 'kesz');
    assert.deepEqual(sorok(v).map((x) => [x.forras, x.email_h]), [['sd_atvetel_nincs_email', null]]);
  }
});

test('J8 a BACKFILL (regi foglalasok) sosem ir jelolot: e-mail nelkuli elem hibas, nincs sor; a szaraz futas sem ir', async () => {
  const v = vilag({ sd: false, env: IDX_ENV }); await v.kesz;
  const elemek = [{ uuid: ujUuid(), host: 'mosaic-pmu.salonic.hu', szolgaltatas: 'Soft powder', idopont_szoveg: 'Október 20. (kedd) 16:00 - 17:00', level_datuma: iso(T0), vendeg: EMAIL_NELKUL, nev: NEV }];
  const szaraz = await v.post({ muvelet: 'index_backfill', elemek, szaraz: true });
  assert.equal(szaraz.hibas.length, 1);
  const be = await v.post({ muvelet: 'index_backfill', elemek });
  assert.deepEqual([be.uj, be.hibas.length, be.hibas[0].miert], [0, 1, 'nincs ervenyes e-mail']);
  assert.equal(sorok(v).length, 0);
});

test('J9 fail-open: a jelolo-iras hibaja nem akasztja meg a hookot / a parositast (jelolo: hiba, a valasz tovabbra is ok)', async () => {
  const v = vilag({ sd: false, env: IDX_ENV }); await v.kesz;
  const u0 = ujUuid(); await v.post(level(u0, { vendeg: EMAIL_NELKUL })); // a tabla megvan
  v.D.db.exec('DROP TABLE foglalas_vendeg');
  v.D.db.exec('CREATE TABLE foglalas_vendeg (uuid TEXT PRIMARY KEY, uzletag TEXT NOT NULL)'); // szandekosan hibas sema: a jelolo INSERT hibazik
  const a = await v.post(level(ujUuid(), { vendeg: EMAIL_NELKUL }));
  assert.equal(a.ok, true);
  assert.deepEqual([a.vendeg_index.allapot, a.vendeg_index.kod, a.vendeg_index.jelolo], ['kihagyva', 'nincs_ervenyes_email', 'hiba']);
});

test('J10 a QA-hoz: a foglalas_vendeg.forras szerint kulon szamolhato a jelolo (nincs_email) es a valodi sor; a "valodi kimaradas" (nincs sor) kulon marad', async () => {
  const v = vilag({ sd: false, env: IDX_ENV }); await v.kesz;
  await v.post(level(ujUuid(), {}));                                  // valodi sor
  await v.post(level(ujUuid(), { vendeg: EMAIL_NELKUL }));            // jelolo
  await v.post(level(ujUuid(), { vendeg: undefined }));               // valodi kimaradas (nincs sor)
  assert.deepEqual(v.sql("SELECT forras, COUNT(*) AS n FROM foglalas_vendeg GROUP BY forras ORDER BY forras"), [{ forras: 'level', n: 1 }, { forras: 'level_nincs_email', n: 1 }]);
  assert.equal(v.sql("SELECT COUNT(*) AS n FROM foglalas_egyeztetes e WHERE NOT EXISTS (SELECT 1 FROM foglalas_vendeg x WHERE x.uuid = e.uuid)")[0].n, 1, 'csak a valodi kimaradas hianyzik');
});

void FIX_UUID;
