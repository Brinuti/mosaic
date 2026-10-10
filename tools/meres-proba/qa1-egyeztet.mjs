// Az E-MAIL-OLDALI kliens a QA-1 probakhoz: a Salonic ertesito e-mailjenek mezoit elkuldi az ELONEZET /api/foglalas-egyeztetes vegpontjanak, es a teljes NYERS NYOMOT kiirja.
// Foglalast nem hoz letre, a Salonicra nem kuld semmit (a vegpont GET-tel olvassa a Salonic-oldalakat); csak elonezetre fut.
//
//  LETREHOZASI level (alap):
//   EGYEZTETES_KULCS=<olvaso kulcs> node tools/meres-proba/qa1-egyeztet.mjs --bazis https://<ag>.mosaic-d77.pages.dev --be <booking-trace.json> --eset <nev>
//        --felado "Mosaic Hair" --szolgaltatas "..." --munkatars "Noel - 20% kedvezmeny!|Masik" --idopont-szoveg "Oktober 20. (kedd) 18:00 - 18:30" [--ld-start 2026-10-20T18:00:00+02:00]
//        --level-datuma 2026-10-06T13:36:32Z [--uuid <Salonic UUID>] [--host mosaic-hair.salonic.hu] [--ismet 1] --ki <nyom.json>
//     A --be a booking-id-valodi.mjs --koszono 1 kimenete (--out); az e-mail mezoit a Gmail-bol olvassa az, aki futtatja.
//  LEMONDASI ertesito (--mod lemondas): nincs UUID / link / JSON-LD, csak felado, szolgaltatas, idopont-szoveg, munkatars, a level datuma (a kulcsot a nevtablabol kepezzuk):
//   ... --mod lemondas --be <a lemondott foglalas booking-trace-e, csak a nyomhoz> --eset <nev> --felado .. --szolgaltatas .. --munkatars .. --idopont-szoveg .. --level-datuma <a lemondasi level ideje> --ki <nyom.json>
import fs from 'node:fs';

const arg = (k, d = '') => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const BAZIS = arg('bazis'), BE = arg('be'), ESET = arg('eset', 'ismeretlen'), KI = arg('ki'), MOD = arg('mod', 'level');
if (!/^https:\/\/[a-z0-9-]+\.mosaic-d77\.pages\.dev$/.test(BAZIS)) throw new Error('csak elonezeten fut (--bazis https://<ag>.mosaic-d77.pages.dev)');
const KULCS = process.env.EGYEZTETES_KULCS;
if (!KULCS) throw new Error('EGYEZTETES_KULCS hianyzik');
const be = BE ? JSON.parse(fs.readFileSync(BE, 'utf8')).osszefoglalo : {};
const uuid = arg('uuid') || be.salonic_uuid;
const host = arg('host') || (be.kuldes_url ? new URL(be.kuldes_url).host : '');
const mezok = { felado: arg('felado'), szolgaltatas: arg('szolgaltatas'), munkatarsak: arg('munkatars').split('|').filter(Boolean), idopont_szoveg: arg('idopont-szoveg'), level_datuma: arg('level-datuma') };
const hivas = async (ut, opt = {}) => { const r = await fetch(BAZIS + ut, { ...opt, headers: { 'x-egyeztetes-kulcs': KULCS, 'content-type': 'application/json', ...(opt.headers || {}) } }); const szoveg = await r.text(); let j = null; try { j = JSON.parse(szoveg); } catch (e) { /* nem JSON */ } return { status: r.status, json: j, szoveg: j ? null : szoveg.slice(0, 300) }; };
const rekordLeker = async (k) => (k ? ((await hivas(`/api/foglalas-kulcs?k=${encodeURIComponent(k)}`)).json || null) : null);
const ido = () => new Date().toISOString();

if (MOD === 'lemondas') {
  const t0 = ido();
  const elotte = {}; // a kulcs allapota a lemondasi ertesito feldolgozasa ELOTT es UTAN (a kulcsot a valaszbol tudjuk, ezert a masodik hivas utan is lekerjuk)
  const r = await hivas('/api/foglalas-egyeztetes', { method: 'POST', body: JSON.stringify({ tipus: 'lemondas', ...mezok }) });
  const kulcs = r.json && r.json.nyom && r.json.nyom.ag2 && r.json.nyom.ag2.kulcsok && r.json.nyom.ag2.kulcsok[0];
  const utana = await rekordLeker(kulcs);
  const nyom = {
    eset: ESET, mod: 'lemondas', bazis: BAZIS, ido: t0,
    lemondott_foglalas: { booking_id: be.azonosito || null, salonic_uuid: uuid || null },
    email_relevans_mezok: { ...mezok, tipus: 'lemondas (nincs UUID / link / JSON-LD)' },
    kulcs_a_nevtablabol: kulcs || null,
    nevtabla_nyom: r.json && r.json.nyom && r.json.nyom.ag2,
    eredmeny: r.json ? { allapot: r.json.allapot, eredmenyek: r.json.eredmenyek, miert: r.json.miert } : r,
    kulcstabla_a_feldolgozas_utan: utana,
    http: r.status,
  };
  console.log(JSON.stringify(nyom, null, 1));
  if (KI) fs.writeFileSync(KI, JSON.stringify(nyom, null, 1));
  process.exit(0);
}

const level = { uuid, host, ...mezok, ld: arg('ld-start') ? { startDate: arg('ld-start') } : null, diagnosztika: true };
const kulcsElotte = be.kulcs_a_bookingUrlbol && be.kulcs_a_bookingUrlbol.kulcs ? await rekordLeker(be.kulcs_a_bookingUrlbol.kulcs) : null;
const elso = await hivas('/api/foglalas-egyeztetes', { method: 'POST', body: JSON.stringify(level) });
const e = (elso.json && elso.json.nyom) || {};
const emailKulcs = (e.ag1 && e.ag1.kulcs) || (e.ag2 && e.ag2.kulcsok && e.ag2.kulcsok[0]) || null;
const masodik = arg('ismet', '1') === '0' ? null : await hivas('/api/foglalas-egyeztetes', { method: 'POST', body: JSON.stringify({ ...level, diagnosztika: false }) }); // ismetlesre ne legyen ujabb esemeny
const rekord = await rekordLeker(emailKulcs);
const nyom = {
  eset: ESET, bazis: BAZIS, ido: ido(),
  booking_id: be.azonosito || null,
  bookingUrl_teljes: be.bookingUrl || null,
  kulcs_a_bookingUrlbol: be.kulcs_a_bookingUrlbol || null,
  koszonooldal_kulcs_iras: be.kulcs_iras || null,
  kulcstabla_rekord_a_koszonooldal_utan: be.kulcstabla_rekord || null,
  kulcstabla_a_parositas_elott: kulcsElotte,
  email_relevans_mezok: { ...mezok, ld_startDate: level.ld && level.ld.startDate, salonic_uuid: uuid, host },
  email_kulcs_1_ag_salonic_oldalak: { kulcs: e.ag1 && e.ag1.kulcs, serviceId: e.ag1 && e.ag1.serviceId, ok: e.ag1 && e.ag1.ok, miert: e.ag1 && e.ag1.miert, lepesek: e.ag1 && e.ag1.lepesek },
  email_kulcs_2_ag_nevtabla: e.ag2 || null,
  kulcs_jeloltek_a_keresnel: e.jeloltek || null,
  birtokos_elo_ellenorzes: e.birtokos_ellenorzes || null,
  valasztas: e.valasztas || null,
  kulcs_atadas: e.kulcs_atadas || null,
  kulcstabla_a_parositas_utan: rekord && rekord.rekord || null,
  kulcs_jeloltek_a_parositas_utan: rekord && rekord.jeloltek || null,
  kereses_eredmenye: elso.json ? { allapot: elso.json.allapot, kuldheto: elso.json.kuldheto, duplikalt: elso.json.duplikalt, kulcs: elso.json.kulcs, kulcs_forras: elso.json.kulcs_forras, service_egyezik: elso.json.service_egyezik, probalkozas: elso.json.probalkozas, riasztas: elso.json.riasztas, miert: elso.json.miert || null, kulcs_atadva: elso.json.kulcs_atadva || false, talalatok: e.talalatok } : elso,
  kapott_esemenyazonosito: elso.json && elso.json.esemeny_id || null,
  azonosito_egyezik_a_bongeszovel: !!(elso.json && elso.json.esemeny_id && be.azonosito && elso.json.esemeny_id === be.azonosito),
  masodik_kereses_ugyanarra: masodik && (masodik.json ? { allapot: masodik.json.allapot, kuldheto: masodik.json.kuldheto, duplikalt: masodik.json.duplikalt, esemeny_id: masodik.json.esemeny_id } : masodik),
  http: { elso: elso.status, masodik: masodik && masodik.status },
};
console.log(JSON.stringify(nyom, null, 1));
if (KI) fs.writeFileSync(KI, JSON.stringify(nyom, null, 1));
