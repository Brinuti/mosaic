// SALONIC-DIRECT (sd) SMOKE ELLENORZOLISTA (a meresi oldal / GPT DECISION #166 6.): CSAK OLVASO SQL-ek + tiszta ertekelo, EGY foglalasra (uuid 8 karakteres elotagja).
// Ugyanaz fut a TERMESZETES kozvetlen pmu / oxigen foglalasra es az (ha 10-15 12:30 UTC-ig nincs ilyen) 1 kontrollalt TESZTFOGLALASRA; a tesztfoglalas utana lemondando, es NEM szamit a T2-mintaba (a napi QA-hivasban ?proba=<u8>).
//
//   node tools/sd-smoke-ellenorzes.mjs jeloltek [--tol <unix>]         a jeloltek lekerdezese (pmu / oxigen letrehozo levelek; HeadSpa: csak a motoron kivuliek) -> SQL (JSON)
//   node tools/sd-smoke-ellenorzes.mjs sql <u8>                         a lista SQL-jei (JSON: [{ nev, sql, params }]) - a D1-en (csak olvasas) futtatando
//   node tools/sd-smoke-ellenorzes.mjs ertekel <u8> <eredmenyek.json>   az eredmenyek ({ nev: [sorok] }) ertekelese -> PASS / FAIL / FOLYAMATBAN tabla
//
// Semmit nem ir, nem kuld; a kimenet nev / e-mail / telefon / hash nelkuli (uuid csak 8 karakteres elotag). Szarmaztatott tesztek: tools/test-sd-smoke.mjs.
import { ELO_CELOK } from '../netlify/lib/meres/platformok.js';
import { arnyekCel } from '../netlify/lib/meres/qa-nap.js';
import { SD_MIN_KOR_MP } from '../netlify/lib/meres/salonic-direct.js';

// C4 - IDEIGLENES szabaly (DECISION #183, a meresi oldal, 2026-10-14, ChatGPT-vel egyeztetve; a Drive-os DECISION-LOG-ban is rogzitve): a kor a foglalas_egyeztetes.letrehozva-tol merve PASS,
// ha >= 1140 mp (= SD_MIN_KOR_MP 1200 - 60 mp tures, az ismert Zapier-keses). Ok: a production a level SAJAT datumatol szamol (salonic-direct.js: kor = t - level_datuma), a sor letrehozasa kesobbi.
// VEGLEGES (kesobb): a level datuma kerul a D1-be (level_datuma oszlop, D1-semabovites), a C4 kizarolag ebbol: levéldatum + 1200 mp, +-30 mp (#180). Akkor ez a tures kiveheto.
export const C4_TURES_MP = 60;
export const C4_MIN_MP = SD_MIN_KOR_MP - C4_TURES_MP;

const U8 = /^[0-9a-f]{8}$/;
const SD_UZLETAGOK = Object.freeze({ 14585: 'pmu', 14409: 'oxigen', 10427: 'headspa' }); // placeId -> uzletag; a HeadSpa a DECISION #191 elokeszitese (a salonic_direct:headspa kapcsolo bekapcsolasa kulon dontes)
const SD_UZLET_LISTA = Object.values(SD_UZLETAGOK);
const ELO_ID_LISTA = Object.freeze([...ELO_CELOK.meta, ...ELO_CELOK.tiktok, ...ELO_CELOK.ga4, ...ELO_CELOK.google_primary]);
const ELO_LIKE = ELO_ID_LISTA.map((id) => `kerelem LIKE '%${id}%'`).join(' OR ');
const UUID_SOR = "FROM foglalas_egyeztetes WHERE uuid LIKE ?1 || '%'";

/** A jeloltek (pmu / oxigen letrehozo levelek + a HeadSpa-nal csak a motoron kivuli: sd-atvett / parositatlan / ellentmondo) lekerdezese: params = [tolUnix]. */
export const jeloltekSql = (tolUnix) => ({
  nev: 'jeloltek',
  sql: "SELECT substr(e.uuid, 1, 8) AS u8, substr(e.kulcs, 1, instr(e.kulcs, '|') - 1) AS place, v.uzletag AS index_uzletag, e.allapot, e.letrehozva, e.sd_allapot, e.sd_ido FROM foglalas_egyeztetes e LEFT JOIN foglalas_vendeg v ON v.uuid = e.uuid WHERE e.letrehozva >= ?1 AND (e.kulcs LIKE '14585|%' OR e.kulcs LIKE '14409|%' OR v.uzletag IN ('pmu', 'oxigen') OR ((e.kulcs LIKE '10427|%' OR v.uzletag = 'headspa') AND (e.sd_id IS NOT NULL OR e.allapot IN ('parositatlan', 'ellentmondas'))) OR EXISTS (SELECT 1 FROM meres_kuldes k WHERE k.salonic_uuid = e.uuid AND k.uzletag = 'headspa' AND k.forras = 'salonic_direct')) ORDER BY e.letrehozva DESC LIMIT 20",
  params: [String(tolUnix)],
});

/** Az ellenorzolista SQL-jei egy foglalasra (mind csak SELECT; ?1 = a 8 karakteres uuid-elotag). */
export function smokeSql(u8) {
  if (typeof u8 !== 'string' || !U8.test(u8)) throw new Error('u8: 8 karakteres kisbetus hexa uuid-elotag kell');
  const p = [u8];
  const sdId = `(SELECT sd_id ${UUID_SOR})`, bookingId = `(SELECT booking_id ${UUID_SOR})`;
  return [
    { nev: 'level', sql: `SELECT substr(uuid, 1, 8) AS u8, kulcs, allapot, letrehozva, booking_id IS NOT NULL AS van_booking, kuldve IS NOT NULL AS kuldve, sd_id IS NOT NULL AS van_sd, sd_allapot, sd_ido, riasztas ${UUID_SOR}`, params: p },
    { nev: 'index', sql: "SELECT uzletag, forras, allapot, email_h IS NOT NULL AS van_email_h FROM foglalas_vendeg WHERE uuid LIKE ?1 || '%'", params: p },
    { nev: 'cellak', sql: `SELECT platform, uzletag, esemeny_tipus, esemeny_nev, allapot, forras, substr(indok, 1, 60) AS indok, json_extract(kerelem, '$.url') AS url, json_extract(kerelem, '$.cel') AS cel FROM meres_kuldes WHERE source_id = ${sdId} ORDER BY id`, params: p },
    { nev: 'motor_cellak', sql: `SELECT COUNT(*) AS db FROM meres_kuldes WHERE source_id = ${bookingId}`, params: p },
    { nev: 'dupla', sql: "SELECT esemeny_nev, platform, COUNT(*) AS db FROM meres_kuldes WHERE salonic_uuid LIKE ?1 || '%' AND allapot = 'elkuldve' GROUP BY esemeny_nev, platform HAVING COUNT(*) > 1", params: p },
    { nev: 'elo_id', sql: `SELECT COUNT(*) AS db FROM meres_kuldes WHERE (source_id = ${sdId} OR source_id = ${bookingId}) AND (${ELO_LIKE})`, params: p },
    { nev: 'reschedule', sql: "SELECT allapot, regi_aktiv, substr(ok, 1, 80) AS ok FROM foglalas_reschedule WHERE uuid LIKE ?1 || '%'", params: p },
    { nev: 'kapcsolok', sql: "SELECT kulcs, be FROM meres_kapcsolo WHERE kulcs IN ('mind', 'salonic_direct', 'salonic_direct:oxigen', 'salonic_direct:pmu', 'salonic_direct:headspa')", params: [] },
  ];
}

const K = (id, nev, allapot, reszlet) => ({ id, nev, allapot, reszlet });
const PLATFORMOK = ['meta', 'tiktok', 'google', 'ga4'];
const reszletKerelem = (c) => { // arnyekCel() a meres_kuldes.kerelem {url, cel} alakjat varja
  let cel = c.cel; if (typeof cel === 'string') { try { cel = JSON.parse(cel); } catch (e) { cel = null; } }
  return JSON.stringify({ url: c.url || '', cel });
};

/**
 * A lista ertekelese. r = { level, index, cellak, motor_cellak, dupla, elo_id, reschedule, kapcsolok } (a smokeSql() nev -> sorok). -> { u8, verdikt: 'PASS' | 'FAIL' | 'FOLYAMATBAN', kriteriumok: [{ id, nev, allapot: 'PASS'|'FAIL'|'WARN'|'NA'|'FOLYAMATBAN', reszlet }] }
 * opciok: { mostSec } (a "korai" / "elmaradt" sd megitelesehez), { env } (GA4_TESZT_MEASUREMENT_ID az arnyekCel-hez).
 */
export const EREDMENY_KULCSOK = Object.freeze(['level', 'index', 'cellak', 'motor_cellak', 'dupla', 'elo_id', 'reschedule', 'kapcsolok']);
export function ertekel(u8, r, { mostSec = Math.floor(Date.now() / 1000), env = {} } = {}) {
  const COUNT_KULCSOK = ['motor_cellak', 'elo_id']; // a COUNT(*) lekerdezes MINDIG pontosan 1 sort ad: az ures tomb = a futtato elnyelte / kihagyta
  const hianyzo = EREDMENY_KULCSOK.filter((x) => !r || !Array.isArray(r[x]) || (COUNT_KULCSOK.includes(x) && r[x].length !== 1));
  if (hianyzo.length) return { u8, verdikt: 'FAIL', kriteriumok: [K('C0', 'eredmenyek_teljesek', 'FAIL', `hianyzo / nem tomb eredmeny-halmaz (a COUNT-os motor_cellak es elo_id eredmenye pontosan 1 sor kell): ${hianyzo.join(', ')} (mind a ${EREDMENY_KULCSOK.length} SELECT eredmenye kell; egy kimaradt lekerdezes nem lehet PASS)`)] };
  const k = [];
  const level = (r.level || [])[0];
  if (!level) return { u8, verdikt: 'FAIL', kriteriumok: [K('C1', 'level_latva', 'FAIL', 'nincs ilyen foglalas_egyeztetes sor')] };
  if ((r.level || []).length > 1) return { u8, verdikt: 'FAIL', kriteriumok: [K('C1', 'level_latva', 'FAIL', `az elotag nem egyertelmu (${r.level.length} talalat)`)] };
  const place = Number(String(level.kulcs || '').split('|')[0]);
  const idx0 = (r.index || [])[0], cella0 = (r.cellak || [])[0];
  const uzletag = SD_UZLETAGOK[place] || (idx0 && SD_UZLET_LISTA.includes(idx0.uzletag) ? idx0.uzletag : null) || (cella0 && SD_UZLET_LISTA.includes(cella0.uzletag) ? cella0.uzletag : null); // a kulcs (place) -> a hash-index uzletag -> az sd cellak uzletag
  k.push(K('C1', 'level_latva', uzletag ? 'PASS' : (r.level[0].van_sd ? 'FAIL' : 'WARN'), uzletag ? `${uzletag}, allapot=${level.allapot}` : `nem pmu / oxigen / headspa (place=${Number.isFinite(place) && place ? place : '?'}) vagy kulcs / index nelkuli level: az sd smoke csak pmu / oxigen / headspa`));

  const idx = (r.index || [])[0];
  k.push(!idx ? K('C2', 'hash_index', 'WARN', 'nincs foglalas_vendeg sor (valodi kimaradas, vagy a jelolo-ag elott az e-mail nelkuli level)')
    : /_nincs_email$/.test(idx.forras || '') ? K('C2', 'hash_index', 'WARN', `jelolo sor (${idx.forras}): nincs e-mail, a csere-felismeres nem lehetseges`)
      : K('C2', 'hash_index', idx.van_email_h ? 'PASS' : 'WARN', `forras=${idx.forras}, email_h ${idx.van_email_h ? 'van' : 'nincs'}`));

  const kor = level.sd_ido != null ? level.sd_ido - level.letrehozva : null;
  const motorNyert = !level.van_sd && (level.allapot === 'parositott' || level.kuldve);
  let sdVan = !!level.van_sd;
  if (sdVan) {
    k.push(K('C3', 'sd_atvetel', level.sd_allapot === 'kesz' ? 'PASS' : ['atveve', 'koran'].includes(level.sd_allapot) ? 'FOLYAMATBAN' : 'FAIL', `sd_allapot=${level.sd_allapot}${level.riasztas ? ', riasztas=1' : ''}`));
    const sdHozta = level.sd_ido != null && level.sd_ido === level.letrehozva; // az sd INSERT-je hozta letre a sort (a letrehozo level horga nem futott): a level valodi kora nem ismert
    k.push(K('C4', 'kor_ido', sdHozta ? 'WARN' : kor != null && kor >= C4_MIN_MP ? 'PASS' : 'FAIL', sdHozta ? 'az sd hozta letre a sort (nincs levelhorog-ido): a level kora nem ellenorizheto' : kor != null ? `${kor} mp a letrehozo sor utan (ideiglenes minimum ${C4_MIN_MP} = ${SD_MIN_KOR_MP} - ${C4_TURES_MP} mp tures, DECISION #183; vegleges: levéldatum + ${SD_MIN_KOR_MP} mp, +-30 mp)` : 'nincs sd_ido'));
  } else if (motorNyert) {
    k.push(K('C3', 'sd_atvetel', 'NA', 'a motor parositotta es kuldte (booking_id): az sd nem vett at - a motoros ut (nem az sd) a smoke targya, az sd smoke itt nem teljesul'));
    k.push(K('C4', 'kor_ido', 'NA', 'nincs sd-atvetel'));
  } else {
    const eletkor = mostSec - level.letrehozva;
    const varhato = eletkor < SD_MIN_KOR_MP + 600; // 20 perc + a Zap 5. lepesenek 10 perc tartaleka
    k.push(K('C3', 'sd_atvetel', varhato ? 'FOLYAMATBAN' : 'FAIL', varhato ? `meg nincs sd-atvetel (a level ${Math.round(eletkor / 60)} perces; az sd >= ${SD_MIN_KOR_MP / 60} perc utan jon)` : `elmaradt az sd-atvetel (${Math.round(eletkor / 60)} perc, allapot=${level.allapot}): sd_hianyzik`));
    k.push(K('C4', 'kor_ido', 'NA', 'nincs sd-atvetel'));
  }

  const cellak = r.cellak || [];
  if (sdVan) {
    const alap = (p) => cellak.filter((c) => c.platform === p && c.esemeny_tipus === 'alap');
    const hianyzik = PLATFORMOK.filter((p) => !alap(p).length);
    k.push(K('C5', 'esemeny_sorok', hianyzik.length ? 'FAIL' : 'PASS', hianyzik.length ? `nincs alap esemeny-sor: ${hianyzik.join(', ')}` : `${cellak.length} sor; alap esemeny: ${[...new Set(cellak.filter((c) => c.esemeny_tipus === 'alap').map((c) => c.esemeny_nev))].join('+')}`));
    const forrasRossz = cellak.filter((c) => c.forras !== 'salonic_direct');
    k.push(K('C6', 'forras', forrasRossz.length ? 'FAIL' : 'PASS', forrasRossz.length ? `${forrasRossz.length} sor nem salonic_direct forrasu` : 'minden sor forras=salonic_direct'));
    const kuldott = cellak.filter((c) => c.allapot === 'elkuldve' || c.allapot === 'hiba');
    const rosszCel = kuldott.filter((c) => !arnyekCel({ platform: c.platform, kerelem: reszletKerelem(c) }, env));
    k.push(K('C7', 'cel_arnyek', !kuldott.length ? 'WARN' : rosszCel.length ? 'FAIL' : 'PASS', !kuldott.length ? 'nincs kiment kerelem' : rosszCel.length ? `${rosszCel.length} kiment kerelem celpontja NEM az ARNYEK (${[...new Set(rosszCel.map((c) => c.platform))].join(', ')})` : `${kuldott.length} kiment kerelem, mind ARNYEK cel (Meta dataset + tesztkod, TikTok pixel + tesztkod, GA4 teszt property, Google ARNYEK akciok)`));
    const hibas = cellak.filter((c) => c.allapot === 'hiba'), tiltott = cellak.filter((c) => c.allapot === 'tiltva');
    const meta = alap('meta').some((c) => c.allapot === 'elkuldve'), tiktok = alap('tiktok').some((c) => c.allapot === 'elkuldve');
    k.push(K('C8', 'allapotok', hibas.length || !meta || !tiktok ? 'FAIL' : tiltott.length ? 'WARN' : 'PASS', `hiba=${hibas.length}, tiltva=${tiltott.length}; alap esemeny elkuldve: meta=${meta}, tiktok=${tiktok}${!meta || !tiktok ? ' - a Meta es a TikTok alap esemenynek kimennie kell (egyik sem ment ki: a smoke nem PASS)' : ''}${PLATFORMOK.filter((p) => alap(p).some((c) => c.allapot === 'kihagyva')).length ? ' (kihagyva: ' + PLATFORMOK.filter((p) => alap(p).some((c) => c.allapot === 'kihagyva')).join(', ') + ')' : ''}`));
  }
  const eloDb = Number(((r.elo_id || [])[0] || {}).db) || 0;
  k.push(K('C9', 'elo_id', eloDb === 0 ? 'PASS' : 'FAIL', eloDb === 0 ? '0 elo ID a kerelmekben' : `${eloDb} sorban ELO ID`));
  const dupla = r.dupla || [];
  const motorDb = Number(((r.motor_cellak || [])[0] || {}).db) || 0;
  k.push(K('C10', 'dupla', dupla.length || (sdVan && motorDb > 0) ? 'FAIL' : 'PASS', dupla.length ? `duplikalt kimeno esemeny: ${dupla.map((d) => d.esemeny_nev + '/' + d.platform + ' x' + d.db).join(', ')}` : sdVan && motorDb > 0 ? `az sd ES a motor is kuldott (${motorDb} motoros sor)` : 'nincs duplikalt (esemeny, platform); sd vs motor: egyik sem kuldott ketszer'));
  const resz = (r.reschedule || [])[0];
  k.push(!resz ? K('C11', 'reschedule', 'PASS', 'nincs csere-gyanu / reschedule sor (normal ut)') : K('C11', 'reschedule', 'WARN', `reschedule sor: ${resz.allapot}${resz.ok ? ' (' + resz.ok + ')' : ''} - csak akkor varhato, ha a foglalas valoban csere`));
  const kap = Object.fromEntries((r.kapcsolok || []).map((x) => [x.kulcs, x.be]));
  const sdKulcs = uzletag ? `salonic_direct:${uzletag}` : null;
  const mindBe = kap.mind !== 0; // a kuldesi fo-kapcsolo: hianyzo sor = be (csak a 0 allitja le)
  const sdBe = !!(sdKulcs && (kap[sdKulcs] === 1 || (kap.salonic_direct === 1 && kap[sdKulcs] !== 0))); // az sd kapcsolo ALAPBOL KI: az uzletag-sor 1, vagy a globalis sor 1 es az uzletag-sor nem 0
  k.push(K('C12', 'kapcsolok', mindBe && sdBe ? 'PASS' : 'WARN', `mind=${kap.mind ?? 'nincs sor (be)'}, ${sdKulcs || 'salonic_direct:?'}=${sdKulcs ? (kap[sdKulcs] ?? 'nincs sor') : '?'}, salonic_direct=${kap.salonic_direct ?? 'nincs sor'}`));

  const verdikt = k.some((x) => x.allapot === 'FAIL') ? 'FAIL' : k.some((x) => x.allapot === 'FOLYAMATBAN') ? 'FOLYAMATBAN' : sdVan ? 'PASS' : 'FOLYAMATBAN';
  return { u8, verdikt, kriteriumok: k, megjegyzes: sdVan ? null : 'nincs sd-atvetel: az sd smoke csak sd-atvetellel teljesulhet' };
}

// ---------- CLI ----------
async function fo() {
  const [, , parancs, arg1, arg2] = process.argv;
  const fs = await import('node:fs');
  if (parancs === 'jeloltek') { const i = process.argv.indexOf('--tol'); console.log(JSON.stringify(jeloltekSql(i > 0 ? process.argv[i + 1] : Math.floor(Date.now() / 1000) - 48 * 3600), null, 2)); return; }
  if (parancs === 'sql') { console.log(JSON.stringify(smokeSql(arg1), null, 2)); return; }
  if (parancs === 'ertekel') {
    const e = ertekel(arg1, JSON.parse(fs.readFileSync(arg2, 'utf8')));
    for (const x of e.kriteriumok) console.log(`${x.allapot.padEnd(12)} ${x.id.padEnd(4)} ${x.nev.padEnd(14)} ${x.reszlet}`);
    console.log(`\nVERDIKT: ${e.verdikt}${e.megjegyzes ? ' - ' + e.megjegyzes : ''}`);
    process.exitCode = e.verdikt === 'FAIL' ? 2 : 0;
    return;
  }
  console.error('hasznalat: node tools/sd-smoke-ellenorzes.mjs jeloltek [--tol <unix>] | sql <u8> | ertekel <u8> <eredmenyek.json>');
  process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1]).href) await fo(); // (Windows-on is helyes: a `file://${argv[1]}` osszehasonlitas ott sosem egyezett)
