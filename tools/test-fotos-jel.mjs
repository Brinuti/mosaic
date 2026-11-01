// PMU fotos foglalas: PII-mentes jelzes (Feri 2026-11-01, #588; 01-MERES #167 6562358324 + Feri 6562391072) - OFFLINE TESZTEK
//   node --test tools/test-fotos-jel.mjs
// Valodi SQLite (node:sqlite) D1-hej, hamis halozat (tools/lib-sd-teszt.mjs); semmi nem megy ki, nincs titok, a telefon kitalalt (+36 30 000 0001).
//   H*: a HMAC-keplet pontosan a vendeg-hash tel_h-ja; nyers telefon nincs a D1-ben; kapcsolo / titok hianya / hiba nem dob
//   S*: sd_atvetel (PMU): fotos jelzes -> 0 platform-esemeny, cellak 'kihagyva' (indok fotos_foglalas), a Salonic UUID parosul; nem fotos -> normal; idoablak; mas telefon; mas uzletag
//   M*: a motoros ut (foglalasEsemenyKuldes) ugyanazt a kizarast adja
import test from 'node:test';
import assert from 'node:assert/strict';
import { vendegHash, arFrissitesNullaz } from '../netlify/lib/meres/salonic-direct.js';
import { fotosJelIr, fotosJelEgyezik, telH, fotosSema, FOTOS_ELOTT_MP, FOTOS_UTAN_MP, FOTOS_INDOK } from '../netlify/lib/meres/fotos-jel.js';
import { foglalasEsemenyKuldes } from '../netlify/lib/meres/foglalas-esemeny.js';
import { T0, VENDEG, ENV_ALAP, SD_ENV, d1, level, lezar, ujUuid, vilag } from './lib-sd-teszt.mjs';

const PMU_HOST = 'mosaic-pmu.salonic.hu';
const SD_ELOTT = T0 + 1300_000;
const FOTOS_ENV = { PMU_FOTOS_JEL: '1' };
const T0S = Math.floor(T0 / 1000);
const pmuLevel = (u, o = {}) => level(u, { host: PMU_HOST, felado: 'Mosaic PMU', szolgaltatas: 'Ingyenes konzultáció', uj_vendeg: true, ...o });
const jelBeszur = (v, { tel = VENDEG.telefon, ido = T0S - 120 } = {}) => v.kesz.then(async () => {
  const h = await telH(v.e, tel);
  await fotosSema(v.db);
  await v.db.prepare('INSERT INTO pmu_fotos_jel (tel_h, ido, lejar, foglalassal) VALUES (?1, ?2, ?3, 1)').bind(h, ido, ido + 86400 * 30).run();
});
const platformHivasok = (v) => v.net.hivasok.filter((h) => ['meta', 'tiktok', 'google', 'ga4'].includes(h.kulcs));

test('H1 a telH() pontosan a vendegHash tel_h-ja (ugyanaz a keplet, ugyanaz a normalizalas: 06 / +36 / szokoz egyarant)', async () => {
  const env = { ...SD_ENV };
  const ref = (await vendegHash(env, { telefon: VENDEG.telefon }, '')).tel_h;
  assert.match(ref, /^[0-9a-f]{32}$/);
  for (const t of [VENDEG.telefon, '+36300000001', '06 30 000 0001', '0630-000-0001']) assert.equal(await telH(env, t), ref, t);
  assert.notEqual(await telH(env, '+36 30 000 0002'), ref);
  assert.equal(await telH({}, VENDEG.telefon), null, 'titok nelkul nincs hash');
  assert.equal(await telH(env, 'nincs szam'), null);
});

test('H2 fotosJelIr: csak HMAC + ido kerul a D1-be (nyers telefon nem); kapcsolo KI / titok nelkul / hibas db: nem iras, nem dob', async () => {
  const D = d1(); const db = { prepare: D.prepare };
  const env = { ...SD_ENV, ...FOTOS_ENV };
  const r = await fotosJelIr(db, env, { telefon: VENDEG.telefon, foglalassal: true, now: T0 });
  assert.deepEqual(r, { ok: true });
  const sorok = D.db.prepare('SELECT * FROM pmu_fotos_jel').all();
  assert.equal(sorok.length, 1);
  assert.equal(sorok[0].ido, T0S); assert.equal(sorok[0].foglalassal, 1); assert.equal(sorok[0].parositva, null);
  assert.ok(!JSON.stringify(sorok).includes('3000000') && !JSON.stringify(sorok).includes('+36'), 'nyers telefon nincs a tablaban');
  assert.deepEqual(Object.keys(sorok[0]).sort(), ['ertek', 'foglalassal', 'id', 'ido', 'lejar', 'parositva', 'salonic_uuid', 'tel_h']);
  // kapcsolo KI
  const D2 = d1();
  assert.equal((await fotosJelIr({ prepare: D2.prepare }, SD_ENV, { telefon: VENDEG.telefon })).ok, false);
  assert.equal(D2.db.prepare("SELECT name FROM sqlite_master WHERE name = 'pmu_fotos_jel'").all().length, 0, 'kapcsolo nelkul nincs tabla sem');
  // titok nelkul
  assert.equal((await fotosJelIr({ prepare: D2.prepare }, FOTOS_ENV, { telefon: VENDEG.telefon })).ok, false);
  // hibas db: nem dob
  const rossz = { prepare() { throw new Error('db'); } };
  const rr = await fotosJelIr(rossz, env, { telefon: VENDEG.telefon });
  assert.equal(rr.ok, false);
  // lejart jelzes torlodik az iraskor
  await fotosJelIr({ prepare: D.prepare }, env, { telefon: VENDEG.telefon, now: T0 + 40 * 86400 * 1000 });
  assert.equal(D.db.prepare('SELECT COUNT(*) n FROM pmu_fotos_jel').get().n, 1, 'a 30 napnal regebbi jelzes torlodik');
});

test('S1 sd_atvetel (PMU): fotos jelzes -> semmilyen platform-esemeny, a cellak kihagyva (fotos_foglalas), a Salonic UUID parosul', async () => {
  arFrissitesNullaz();
  const v = vilag({ kapcsolo: 'pmu', env: { ...FOTOS_ENV, META_ELO_BE: 'pmu', TIKTOK_ELO_BE: 'pmu' } }); await v.kesz; await jelBeszur(v);
  const u = ujUuid(); const b = pmuLevel(u);
  await lezar(v, b); v.t.set(SD_ELOTT);
  const r = await v.sd(b);
  assert.equal(r.allapot, 'kesz'); assert.equal(r.fotos_foglalas, true);
  assert.deepEqual(platformHivasok(v), [], 'a fotos foglalasra egyetlen platform-hivas sem megy');
  const sorok = v.sql("SELECT platform, allapot, indok FROM meres_kuldes WHERE salonic_uuid = ?1 OR source_id LIKE 'sd\\_%' ESCAPE '\\'", u);
  assert.ok(sorok.length > 0 && sorok.every((s) => s.allapot === 'kihagyva' && String(s.indok).startsWith(FOTOS_INDOK)), JSON.stringify(sorok));
  const jel = v.sql('SELECT salonic_uuid, parositva FROM pmu_fotos_jel');
  assert.deepEqual(jel.map((x) => [x.salonic_uuid, x.parositva]), [[u, 1]]);
});

test('S2 sd_atvetel (PMU): NEM fotos vendeg (nincs jelzes) -> a szokasos esemenyek mennek (ellenpelda); a jelzes-tabla hianya sem dob', async () => {
  arFrissitesNullaz();
  const v = vilag({ kapcsolo: 'pmu', env: { ...FOTOS_ENV, META_ELO_BE: 'pmu', TIKTOK_ELO_BE: 'pmu' } }); await v.kesz;
  const u = ujUuid(); const b = pmuLevel(u);
  await lezar(v, b); v.t.set(SD_ELOTT);
  const r = await v.sd(b);
  assert.equal(r.allapot, 'kesz'); assert.equal(r.fotos_foglalas, undefined);
  assert.ok(platformHivasok(v).length > 0, 'fotos jelzes nelkul a foglalas konverzio (normal ut)');
});

test('S3 idoablak: a foglalas [jelzes - 1 ora, jelzes + 7 nap] kozott kizart, azon kivul normal', async () => {
  const lat = async (jelIdo) => { // jelIdo: a jelzes ideje a foglalas (T0S) utan / elott
    arFrissitesNullaz();
    const v = vilag({ kapcsolo: 'pmu', env: { ...FOTOS_ENV, META_ELO_BE: 'pmu', TIKTOK_ELO_BE: 'pmu' } }); await v.kesz; await jelBeszur(v, { ido: jelIdo });
    const u = ujUuid(); const b = pmuLevel(u); await lezar(v, b); v.t.set(SD_ELOTT);
    const r = await v.sd(b); return { fotos: r.fotos_foglalas === true, hivas: platformHivasok(v).length };
  };
  // a foglalas T0S-kor jott letre
  assert.equal((await lat(T0S + FOTOS_ELOTT_MP - 1)).fotos, true, 'a foglalas 59:59-cel a jelzes ELOTT jott: kizart');
  assert.equal((await lat(T0S + FOTOS_ELOTT_MP + 60)).fotos, false, 'a foglalas 1 ora 1 perccel a jelzes elott jott: nem kizart');
  assert.equal((await lat(T0S - FOTOS_UTAN_MP + 5)).fotos, true, 'a foglalas 7 nap - 5 mp-cel a jelzes utan jott: kizart');
  assert.equal((await lat(T0S - FOTOS_UTAN_MP - 60)).fotos, false, 'a foglalas a jelzes utan 7 nap + 1 perccel (8. nap): normal');
  const kiv = await lat(T0S - FOTOS_UTAN_MP - 60); assert.ok(kiv.hivas > 0, 'a 8. napon a foglalas normal konverzio');
});

test('S4 mas telefon -> nem kizart; mas uzletag (HeadSpa) ugyanazzal a telefonnal -> nem kizart (a kizaras csak a PMU-ra szol)', async () => {
  arFrissitesNullaz();
  const v = vilag({ kapcsolo: 'mind', env: { ...FOTOS_ENV, META_ELO_BE: 'pmu', TIKTOK_ELO_BE: 'pmu' } }); await v.kesz; await jelBeszur(v);
  const u1 = ujUuid(); const b1 = pmuLevel(u1, { vendeg: { email: 'masik.teszt@example.com', telefon: '+36 30 000 0099' } });
  await lezar(v, b1); v.t.set(SD_ELOTT);
  const r1 = await v.sd(b1); assert.equal(r1.fotos_foglalas, undefined, 'mas telefon: nem fotos');
  const u2 = ujUuid(); const b2 = level(u2, { host: 'mosaicheadspa.salonic.hu', felado: 'Mosaic Headspa', szolgaltatas: 'Fejbőr kezelés', uj_vendeg: true }); // HeadSpa, a jelzes telefonjaval
  await lezar(v, b2); v.t.set(SD_ELOTT + 5000);
  const r2 = await v.sd(b2); assert.equal(r2.fotos_foglalas, undefined, 'mas uzletag: nem kizart');
});

test('S5 kapcsolo KI (PMU_FOTOS_JEL nincs) -> a jelzes nem szamit (alapbol KI, a regi viselkedes)', async () => {
  arFrissitesNullaz();
  const v = vilag({ kapcsolo: 'pmu', env: { META_ELO_BE: 'pmu', TIKTOK_ELO_BE: 'pmu' } }); await v.kesz; await jelBeszur(v);
  const u = ujUuid(); const b = pmuLevel(u); await lezar(v, b); v.t.set(SD_ELOTT);
  const r = await v.sd(b); assert.equal(r.fotos_foglalas, undefined); assert.ok(platformHivasok(v).length > 0);
});

test('S6 szaraz terv (irasmentes): a fotos foglalas fix_allapota kihagyva, a jelzes sora nem modosul', async () => {
  arFrissitesNullaz();
  const v = vilag({ kapcsolo: 'pmu', env: { ...FOTOS_ENV, META_ELO_BE: 'pmu', TIKTOK_ELO_BE: 'pmu' } }); await v.kesz; await jelBeszur(v);
  const u = ujUuid(); const b = pmuLevel(u); await lezar(v, b); v.t.set(SD_ELOTT);
  const r = await v.sd({ ...b, szaraz: true });
  assert.equal(r.allapot, 'szaraz_terv'); assert.equal(r.terv.fotos_foglalas, true); assert.equal(r.terv.fix_allapot && r.terv.fix_allapot.allapot, 'kihagyva'); assert.equal(r.terv.fix_allapot.indok, FOTOS_INDOK);
  assert.deepEqual(v.sql('SELECT salonic_uuid, parositva FROM pmu_fotos_jel').map((x) => [x.salonic_uuid, x.parositva]), [[null, null]]);
  assert.deepEqual(platformHivasok(v), []);
});

test('M1 a motoros ut (foglalasEsemenyKuldes): PMU + fotos jelzes -> kihagyva, platform-hivas nincs; nem PMU / nincs jelzes -> normal', async () => {
  const futtat = async (host, jelezzen) => {
    const D = d1(); const hivasok = [];
    const env = { ...ENV_ALAP, ...SD_ENV, ...FOTOS_ENV };
    const db = { prepare: D.prepare, batch: D.batch };
    if (jelezzen) { const h = await telH(env, VENDEG.telefon); await fotosSema(db); await db.prepare('INSERT INTO pmu_fotos_jel (tel_h, ido, lejar, foglalassal) VALUES (?1, ?2, ?3, 1)').bind(h, T0S - 60, T0S + 86400 * 30).run(); }
    const fetchImpl = async (url, o = {}) => { hivasok.push(String(url)); return { ok: true, status: 200, url: String(url), json: async () => ({}), text: async () => '{}' }; };
    const r = await foglalasEsemenyKuldes({ db, env, mezok: { host, uuid: ujUuid(), szolgaltatas: 'Ingyenes konzultáció', leveldatum: new Date(T0).toISOString(), munkatarsak: [] }, bejovo: { vendeg: VENDEG, uj_vendeg: true }, eredmeny: { booking_id: 'mb_aaaaaaaaaaaaaaaaaa' }, fetchImpl, now: () => T0 + 5000, kuldo: async () => ({ ok: true }) });
    const van = D.db.prepare("SELECT name FROM sqlite_master WHERE name = 'pmu_fotos_jel'").all().length > 0;
    const cellak = D.db.prepare("SELECT platform, allapot, indok FROM meres_kuldes").all().map((x) => ({ ...x }));
    return { r, hivasok, cellak, jel: van ? D.db.prepare("SELECT salonic_uuid, parositva FROM pmu_fotos_jel").all() : [] };
  };
  const fotos = await futtat(PMU_HOST, true);
  assert.ok(fotos.r.jelleg !== undefined);
  assert.equal(fotos.jel.length, 1); assert.equal(fotos.jel[0].parositva, 1, 'a motoros uton is parosul a Salonic UUID');
  assert.ok(fotos.cellak.length > 0 && fotos.cellak.every((c) => c.allapot === 'kihagyva' && String(c.indok).startsWith(FOTOS_INDOK)), JSON.stringify(fotos.cellak));
  assert.deepEqual(fotos.hivasok.filter((u) => /facebook|tiktok|zapier|google-analytics/.test(u)), [], 'fotos: nincs platform-hivas');
  const normal = await futtat(PMU_HOST, false);
  assert.equal(normal.jel.length, 0);
  assert.ok(normal.cellak.length > 0 && normal.cellak.some((c) => c.allapot !== 'kihagyva'), 'jelzes nelkul a cellak nem kihagyva (ellenpelda): ' + JSON.stringify(normal.cellak));
});
