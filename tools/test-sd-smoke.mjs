// SD SMOKE ELLENORZOLISTA (tools/sd-smoke-ellenorzes.mjs) - OFFLINE TESZTEK a szimulalt sd-vilagon (valodi SQLite, node:sqlite), termeszetes ES tesztfoglalasra.
//   node --test tools/test-sd-smoke.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ELO_CELOK, ARNYEK } from '../netlify/lib/meres/platformok.js';
import { SD_MIN_KOR_MP } from '../netlify/lib/meres/salonic-direct.js';
import { ertekel, jeloltekSql, smokeSql } from './sd-smoke-ellenorzes.mjs';
import { T0, VENDEG, level, lezar, vilag } from './lib-sd-teszt.mjs';

const SD_ELOTT = T0 + 1300_000; // a letrehozo level utan ~21,7 perccel
const MEGJ_99 = 'A korábbi 16 órás foglalásomat cserélném erre.';
let szam = 0;
const uuid = (u8) => `${u8}-0000-4000-8000-${String(++szam).padStart(12, '0')}`;
const lefuttat = (v, u8) => Object.fromEntries(smokeSql(u8).map((q) => [q.nev, v.D.db.prepare(q.sql).all(...q.params).map((r) => ({ ...r }))]));
const allapotok = (e) => Object.fromEntries(e.kriteriumok.map((x) => [x.id, x.allapot]));

async function termeszetes({ host = 'mosaic-pmu.salonic.hu', uzletag = 'pmu', u8 = 'c0ffee01', lev = {}, mostSet = SD_ELOTT } = {}) {
  const v = vilag(); await v.kesz; await v.kapcsol(uzletag, true);
  const u = uuid(u8); const b = level(u, { host, ...lev });
  await lezar(v, b); v.t.set(mostSet);
  const r = await v.sd(b);
  return { v, u, b, r, u8 };
}

test('SM1 az SQL-lista: csak SELECT, 8 kerdes, ?1 = az u8; ervenytelen u8 elutasitva; a jeloltek-lekerdezes is csak SELECT', () => {
  const lista = smokeSql('c0ffee01');
  assert.deepEqual(lista.map((q) => q.nev), ['level', 'index', 'cellak', 'motor_cellak', 'dupla', 'elo_id', 'reschedule', 'kapcsolok']);
  for (const q of [...lista, jeloltekSql(1791000000)]) { assert.match(q.sql, /^SELECT\b/); assert.ok(!/\b(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|REPLACE)\b/i.test(q.sql), q.nev); assert.ok(Array.isArray(q.params)); }
  assert.deepEqual(lista[0].params, ['c0ffee01']);
  for (const rossz of ['', 'c0ffee0', 'C0FFEE01', 'c0ffee0g', "c0ffee01'; DROP TABLE x;--", null, undefined, 12345678]) assert.throws(() => smokeSql(rossz), /u8/, String(rossz));
  assert.ok(ELO_CELOK.meta.every((id) => lista.find((q) => q.nev === 'elo_id').sql.includes(id)), 'az elo ID-k mind benne vannak az elo_id lekerdezesben');
  const dump = JSON.stringify(lista).toLowerCase();
  assert.ok(!dump.includes('nev_h') && !dump.includes('tel_h') && !/select[^;]*\bemail_h\b(?! is not null)/.test(dump), 'hash-oszlop nincs a kimeneten (csak a van_email_h bit)');
});

test('SM2 TERMESZETES pmu foglalas: motor lezart (parositatlan), az sd >= 20 perc utan atveszi -> minden kriterium PASS (a hash-index PASS, a kapcsolok PASS), VERDIKT PASS', async () => {
  const { v, r, u8 } = await termeszetes();
  assert.equal(r.allapot, 'kesz');
  const e = ertekel(u8, lefuttat(v, u8), { mostSec: Math.floor(SD_ELOTT / 1000) + 5, env: { GA4_TESZT_MEASUREMENT_ID: 'G-TESZT00001' } });
  assert.equal(e.verdikt, 'PASS', JSON.stringify(e.kriteriumok.filter((x) => x.allapot !== 'PASS')));
  assert.deepEqual(allapotok(e), { C1: 'PASS', C2: 'PASS', C3: 'PASS', C4: 'PASS', C5: 'PASS', C6: 'PASS', C7: 'PASS', C8: 'PASS', C9: 'PASS', C10: 'PASS', C11: 'PASS', C12: 'PASS' });
  assert.match(e.kriteriumok.find((x) => x.id === 'C7').reszlet, /ARNYEK/);
  assert.match(e.kriteriumok.find((x) => x.id === 'C4').reszlet, new RegExp(`minimum ${SD_MIN_KOR_MP}`));
});

test('SM3 TESZTFOGLALAS ugyanaz a lista (oxigen host): a teszt-nev nem szamit az ellenorzesnek; VERDIKT PASS, uzletag = oxigen; a tesztfoglalas u8-ja a napi QA-hivasban ?proba=<u8> (nem szamit a T2-mintaba)', async () => {
  const { v, r, u8 } = await termeszetes({ host: 'mosaic-oxigen.salonic.hu', uzletag: 'oxigen', u8: 'de57ba01', lev: { nev: 'Teszt Claude', vendeg: { ...VENDEG, email: 'teszt.claude@example.com' } } });
  assert.equal(r.allapot, 'kesz');
  const e = ertekel(u8, lefuttat(v, u8), { mostSec: Math.floor(SD_ELOTT / 1000) + 5 });
  assert.equal(e.verdikt, 'PASS'); assert.match(e.kriteriumok[0].reszlet, /^oxigen/);
  // a QA-vegpont a probat kizarja: ?proba=<u8> -> proba_kizarva (a tesztfoglalas nem szamit a T2-mintaba)
  const { qaNap, napIntervallum } = await import('../netlify/lib/meres/qa-nap.js');
  const mostMs = SD_ELOTT + 3600_000;
  const nap = napIntervallum(new Date(mostMs).toISOString().slice(0, 10), mostMs);
  const j = await qaNap(v.db, nap, { proba: [u8], mostMs, env: v.e });
  const osszeg = (m) => Object.values(j.uzletagak).reduce((a, x) => a + x.valos[m], 0); // a szimulalt level kulcs nelkuli (a prodban a kulcs megvan): az 'ismeretlen' uzletagba esik, a lenyeg a kizaras
  assert.equal(osszeg('proba_kizarva'), 1); assert.equal(osszeg('letrehozo_level'), 0, 'a proba nem szamit a valos mintaba');
});

test('SM4 FOLYAMATBAN: a level 10 perces, az sd meg nem jott -> C3 FOLYAMATBAN (nem FAIL); 60 perc utan FAIL (sd_hianyzik)', async () => {
  const v = vilag(); await v.kesz; await v.kapcsol('pmu', true);
  const u = uuid('c0ffee04'); const b = level(u, {});
  await lezar(v, b);
  const korai = ertekel('c0ffee04', lefuttat(v, 'c0ffee04'), { mostSec: Math.floor(T0 / 1000) + 600 });
  assert.equal(korai.verdikt, 'FOLYAMATBAN'); assert.equal(allapotok(korai).C3, 'FOLYAMATBAN');
  const keso = ertekel('c0ffee04', lefuttat(v, 'c0ffee04'), { mostSec: Math.floor(T0 / 1000) + 3600 });
  assert.equal(keso.verdikt, 'FAIL'); assert.match(keso.kriteriumok.find((x) => x.id === 'C3').reszlet, /sd_hianyzik/);
});

test('SM5 az sd 20 percnel KORABBAN jott (kor_ido) -> FAIL; HOLD (csere-gyanu, nincs index-jelolt): sd_allapot=halasztva -> C3 FAIL, C11 WARN, VERDIKT FAIL', async () => {
  const { v, u8 } = await termeszetes({ u8: 'c0ffee05' });
  v.D.db.prepare('UPDATE foglalas_egyeztetes SET sd_ido = letrehozva + 600 WHERE uuid LIKE ?1').run('c0ffee05%');
  const e = ertekel(u8, lefuttat(v, u8), { mostSec: Math.floor(SD_ELOTT / 1000) });
  assert.equal(allapotok(e).C4, 'FAIL'); assert.equal(e.verdikt, 'FAIL');
  const h = await termeszetes({ u8: 'c0ffee06', lev: { megjegyzes: MEGJ_99 } });
  const he = ertekel('c0ffee06', lefuttat(h.v, 'c0ffee06'), { mostSec: Math.floor(SD_ELOTT / 1000) + 5 });
  assert.equal(h.r.allapot, 'halasztva'); assert.equal(allapotok(he).C3, 'FAIL'); assert.equal(allapotok(he).C11, 'WARN'); assert.equal(he.verdikt, 'FAIL');
  assert.match(he.kriteriumok.find((x) => x.id === 'C3').reszlet, /halasztva/);
});

test('SM6 a motor parositott (nincs sd-atvetel): C3 / C4 NA, VERDIKT nem PASS (az sd smoke nem teljesult), megjegyzessel; nem pmu / oxigen level: C1 WARN', async () => {
  const v = vilag(); await v.kesz;
  const u = uuid('c0ffee07');
  await lezar(v, level(u, {}));
  v.D.db.prepare("UPDATE foglalas_egyeztetes SET allapot = 'parositott', booking_id = 'mb_x1', kuldve = 1 WHERE uuid LIKE 'c0ffee07%'").run();
  const e = ertekel('c0ffee07', lefuttat(v, 'c0ffee07'), { mostSec: Math.floor(SD_ELOTT / 1000) });
  assert.equal(allapotok(e).C3, 'NA'); assert.notEqual(e.verdikt, 'PASS'); assert.match(e.megjegyzes, /csak sd-atvetellel/);
  const w = vilag(); await w.kesz; await w.kapcsol('mind', true);
  const u2 = uuid('c0ffee08'); await lezar(w, level(u2, { host: 'mosaic-hair.salonic.hu' }));
  const e2 = ertekel('c0ffee08', lefuttat(w, 'c0ffee08'), { mostSec: Math.floor(SD_ELOTT / 1000) });
  assert.equal(allapotok(e2).C1, 'WARN', 'nem pmu / oxigen level, sd nelkul: C1 WARN (a verdikt ugyis FOLYAMATBAN)'); assert.notEqual(e2.verdikt, 'PASS'); assert.equal(ertekel('c0ffee99', lefuttat(w, 'c0ffee99')).verdikt, 'FAIL', 'ismeretlen u8 = FAIL');
});

test('SM7 SZINTETIKUS HIBAK: nem ARNYEK cel, elo ID, duplikalt esemeny, az sd ES a motor is kuldott, hiba allapot, hianyzo platform, nem salonic_direct forras -> mind FAIL', () => {
  const alap = { level: [{ u8: 'c0ffee09', kulcs: '14585|1|1792000000', allapot: 'parositatlan', letrehozva: 1000, van_booking: 0, kuldve: 0, van_sd: 1, sd_allapot: 'kesz', sd_ido: 1000 + 1500, riasztas: 0 }], index: [{ forras: 'level', allapot: 'aktiv', van_email_h: 1 }], motor_cellak: [{ db: 0 }], dupla: [], elo_id: [{ db: 0 }], reschedule: [], kapcsolok: [{ kulcs: 'mind', be: 1 }, { kulcs: 'salonic_direct:pmu', be: 1 }],
    cellak: [
      { platform: 'meta', esemeny_tipus: 'alap', esemeny_nev: 'FoglalasElso', allapot: 'elkuldve', forras: 'salonic_direct', url: `https://graph.facebook.com/v23.0/${ARNYEK.meta.datasetId}/events`, cel: JSON.stringify({ dataset: ARNYEK.meta.datasetId, test_event_code: 'T1' }) },
      { platform: 'tiktok', esemeny_tipus: 'alap', esemeny_nev: 'FoglalasElso', allapot: 'elkuldve', forras: 'salonic_direct', url: 'https://business-api.tiktok.com/open_api/v1.3/event/track/', cel: JSON.stringify({ pixel_code: ARNYEK.tiktok.pixelCode, test_event_code: 'T2' }) },
      { platform: 'google', esemeny_tipus: 'alap', esemeny_nev: 'FoglalasElso', allapot: 'kihagyva', forras: 'salonic_direct', url: '', cel: null },
      { platform: 'ga4', esemeny_tipus: 'alap', esemeny_nev: 'FoglalasElso', allapot: 'elkuldve', forras: 'salonic_direct', url: 'https://www.google-analytics.com/mp/collect?measurement_id=G-TESZT00001', cel: JSON.stringify({ measurement_id: 'G-TESZT00001' }) },
    ] };
  const ok = ertekel('c0ffee09', alap, { mostSec: 5000, env: { GA4_TESZT_MEASUREMENT_ID: 'G-TESZT00001' } });
  assert.equal(ok.verdikt, 'PASS', JSON.stringify(ok.kriteriumok.filter((x) => x.allapot !== 'PASS')));
  const mut = (f) => ertekel('c0ffee09', f(structuredClone(alap)), { mostSec: 5000, env: { GA4_TESZT_MEASUREMENT_ID: 'G-TESZT00001' } });
  const eloMeta = mut((r) => { r.cellak[0].cel = JSON.stringify({ dataset: ELO_CELOK.meta[0], test_event_code: 'T1' }); r.cellak[0].url = `https://graph.facebook.com/v23.0/${ELO_CELOK.meta[0]}/events`; r.elo_id = [{ db: 1 }]; return r; });
  assert.equal(eloMeta.verdikt, 'FAIL'); assert.equal(allapotok(eloMeta).C7, 'FAIL'); assert.equal(allapotok(eloMeta).C9, 'FAIL');
  const tesztkodNelkul = mut((r) => { r.cellak[0].cel = JSON.stringify({ dataset: ARNYEK.meta.datasetId }); return r; });
  assert.equal(allapotok(tesztkodNelkul).C7, 'FAIL', 'test_event_code nelkul nem arnyek cel');
  assert.equal(allapotok(mut((r) => { r.dupla = [{ esemeny_nev: 'FoglalasElso', platform: 'meta', db: 2 }]; return r; })).C10, 'FAIL');
  assert.equal(allapotok(mut((r) => { r.motor_cellak = [{ db: 4 }]; return r; })).C10, 'FAIL');
  assert.equal(allapotok(mut((r) => { r.cellak[1].allapot = 'hiba'; return r; })).C8, 'FAIL');
  assert.equal(allapotok(mut((r) => { r.cellak.splice(3, 1); return r; })).C5, 'FAIL');
  assert.equal(allapotok(mut((r) => { r.cellak[2].forras = 'motor'; return r; })).C6, 'FAIL');
  assert.equal(allapotok(mut((r) => { r.kapcsolok = []; return r; })).C12, 'WARN');
  assert.equal(allapotok(mut((r) => { r.index = []; return r; })).C2, 'WARN', 'index nelkul WARN (nem FAIL)');
  assert.equal(allapotok(mut((r) => { r.index = [{ forras: 'level_nincs_email', allapot: 'aktiv', van_email_h: 0 }]; return r; })).C2, 'WARN');
  assert.equal(mut((r) => { r.index = []; return r; }).verdikt, 'PASS', 'a WARN nem buktatja a smoke-ot');
});

test('SM8 PII-mentes kimenet: sem e-mail, sem telefon, sem nev, sem hash, sem teljes UUID az ertekelesben; a CLI (sql / jeloltek / ertekel) mukodik, a FAIL kilepesi kodja 2', async () => {
  const { v, u, u8 } = await termeszetes({ u8: 'c0ffee0a', lev: { nev: 'Teszt Claude', vendeg: { ...VENDEG } } });
  const eredmeny = lefuttat(v, u8);
  const e = ertekel(u8, eredmeny, { mostSec: Math.floor(SD_ELOTT / 1000) + 5 });
  const szoveg = JSON.stringify({ e, eredmeny }).toLowerCase();
  for (const t of [VENDEG.email, VENDEG.telefon, '36300000001', 'teszt claude', 'example.com', u.toLowerCase()]) assert.ok(!szoveg.includes(String(t).toLowerCase()), 'PII / teljes UUID a kimenetben: ' + t);
  assert.ok(!/"(email_h|tel_h|nev_h)"/.test(szoveg));
  const cli = path.join(path.dirname(fileURLToPath(import.meta.url)), 'sd-smoke-ellenorzes.mjs');
  const sql = spawnSync(process.execPath, [cli, 'sql', u8], { encoding: 'utf8' });
  assert.equal(sql.status, 0); assert.equal(JSON.parse(sql.stdout).length, 8);
  assert.equal(JSON.parse(spawnSync(process.execPath, [cli, 'jeloltek', '--tol', '1791000000'], { encoding: 'utf8' }).stdout).params[0], '1791000000');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'smoke-'));
  const jo = path.join(tmp, 'jo.json'); fs.writeFileSync(jo, JSON.stringify(eredmeny));
  const rossz = path.join(tmp, 'rossz.json'); fs.writeFileSync(rossz, JSON.stringify({ ...eredmeny, level: [] }));
  const ok = spawnSync(process.execPath, [cli, 'ertekel', u8, jo], { encoding: 'utf8' });
  assert.match(ok.stdout, /VERDIKT: (PASS|FOLYAMATBAN|FAIL)/);
  const fail = spawnSync(process.execPath, [cli, 'ertekel', u8, rossz], { encoding: 'utf8' });
  assert.equal(fail.status, 2); assert.match(fail.stdout, /VERDIKT: FAIL/);
  assert.equal(spawnSync(process.execPath, [cli, 'sql', 'rossz'], { encoding: 'utf8' }).status !== 0, true);
});

test('SM9 a jeloltek-lekerdezes: csak pmu / oxigen letrehozo levelek, csokkeno idorendben, max. 20', async () => {
  const v = vilag(); await v.kesz;
  for (const [h, u8] of [['mosaic-pmu.salonic.hu', 'c0ffee11'], ['mosaic-hair.salonic.hu', 'c0ffee12'], ['mosaic-oxigen.salonic.hu', 'c0ffee13']]) { const u = uuid(u8); v.t.tick(60); await v.post(level(u, { host: h })); }
  v.D.db.prepare("UPDATE foglalas_egyeztetes SET kulcs = '14585|1|1792000000' WHERE uuid LIKE 'c0ffee11%'").run(); // a pmu level kulcsa (a prodban a Salonic-oldalbol szarmazik); az oxigen levelt a hash-index uzletagja talalja meg (nincs kulcsa)
  const q = jeloltekSql(Math.floor(T0 / 1000) - 10);
  const sorok = v.D.db.prepare(q.sql).all(...q.params).map((r) => ({ ...r }));
  assert.deepEqual(sorok.map((r) => r.u8).sort(), ['c0ffee11', 'c0ffee13'], 'a kulcsos pmu (place) es a kulcs nelkuli oxigen (hash-index uzletag) is');
  assert.ok(sorok[0].letrehozva >= sorok[1].letrehozva);
});

test('SM10 a REVIEW javitasai: hianyzo eredmeny-halmaz = FAIL (nem hallgatolagos PASS); ha a Meta / TikTok alap esemeny nem ment ki = FAIL; nem pmu / oxigen uzletagu sd-atvetel = FAIL; az sd-INSERT hozta sor (sd_ido = letrehozva) C4 WARN, nem hamis FAIL', async () => {
  const { v, u8 } = await termeszetes({ u8: 'c0ffee20' });
  const jo = lefuttat(v, u8); const ido = { mostSec: Math.floor(SD_ELOTT / 1000) + 5, env: { GA4_TESZT_MEASUREMENT_ID: 'G-TESZT00001' } };
  assert.equal(ertekel(u8, jo, ido).verdikt, 'PASS');
  for (const kulcs of ['elo_id', 'dupla', 'motor_cellak', 'reschedule', 'kapcsolok', 'index', 'cellak', 'level']) {
    const csonka = { ...jo }; delete csonka[kulcs];
    const e = ertekel(u8, csonka, ido);
    assert.equal(e.verdikt, 'FAIL', kulcs); assert.match(e.kriteriumok[0].reszlet, new RegExp(kulcs));
  }
  assert.equal(ertekel(u8, { ...jo, elo_id: 'nem tomb' }, ido).verdikt, 'FAIL');
  for (const kulcs of ['elo_id', 'motor_cellak']) assert.equal(ertekel(u8, { ...jo, [kulcs]: [] }, ido).verdikt, 'FAIL', 'a COUNT-os halmaz ures tombje = a futtato elnyelte: ' + kulcs);
  // minden cella tiltva (pl. hianyzo teszt-kod): semmi nem ment ki -> FAIL, nem PASS
  const tiltva = { ...jo, cellak: jo.cellak.map((c) => ({ ...c, allapot: 'tiltva', url: null, cel: null })) };
  const et = ertekel(u8, tiltva, ido); assert.equal(et.verdikt, 'FAIL'); assert.equal(allapotok(et).C8, 'FAIL');
  // minden cella kihagyva (mind=0): ugyanez
  assert.equal(ertekel(u8, { ...jo, cellak: jo.cellak.map((c) => ({ ...c, allapot: 'kihagyva', url: null, cel: null })), kapcsolok: [{ kulcs: 'mind', be: 0 }] }, ido).verdikt, 'FAIL');
  // sd-atvetel nem pmu / oxigen uzletagra
  const hair = JSON.parse(JSON.stringify(jo)); hair.level[0].kulcs = '10823|1|1792000000'; hair.index = []; hair.cellak = hair.cellak.map((c) => ({ ...c, uzletag: 'fodrasz' }));
  const eh = ertekel(u8, hair, ido); assert.equal(eh.verdikt, 'FAIL'); assert.equal(allapotok(eh).C1, 'FAIL');
  // az sd INSERT-je hozta letre a sort
  const sdHozta = JSON.parse(JSON.stringify(jo)); sdHozta.level[0].letrehozva = sdHozta.level[0].sd_ido;
  const es = ertekel(u8, sdHozta, ido); assert.equal(allapotok(es).C4, 'WARN'); assert.equal(es.verdikt, 'PASS');
});

