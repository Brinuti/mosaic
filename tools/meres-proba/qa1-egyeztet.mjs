// Az E-MAIL-OLDALI kliens egy probafoglalasra (QA-1 folytatas): a Salonic ertesito e-mailjenek mezoit elkuldi az ELONEZET /api/foglalas-egyeztetes vegpontjanak, es a teljes NYERS NYOMOT
// (booking_id, teljes bookingUrl, abbol kepzett kulcs, kulcstabla-rekord, az e-mail releváns mezoi, az e-mailbol kepzett kulcs, a kereses eredmenye, a kapott esemenyazonosito) kiirja.
// Foglalast nem hoz letre, a Salonicra nem kuld semmit (a vegpont GET-tel olvassa a Salonic-oldalakat); csak elonezetre fut.
//
//   EGYEZTETES_KULCS=<olvaso kulcs> node tools/meres-proba/qa1-egyeztet.mjs --bazis https://<ag>.mosaic-d77.pages.dev --be <booking-trace.json> --eset <nev>
//        --felado "Mosaic Hair" --szolgaltatas "..." --munkatars "Noel - 20% kedvezmeny!|Masik" --idopont-szoveg "Oktober 20. (kedd) 18:00 - 18:30" --ld-start 2026-10-20T18:00:00+02:00
//        --level-datuma 2026-10-06T13:36:32Z [--uuid <Salonic UUID>] [--host mosaic-hair.salonic.hu] --ki <nyom.json>
// A --be a booking-id-valodi.mjs --koszono 1 kimenete (--out); az e-mail mezoit a Gmail-bol olvassa az, aki futtatja (felado, szolgaltatas, munkatarsak, idopont-szoveg, JSON-LD startDate, a Foglalas reszletek link UUID-ja).
import fs from 'node:fs';

const arg = (k, d = '') => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const BAZIS = arg('bazis'), BE = arg('be'), ESET = arg('eset', 'ismeretlen'), KI = arg('ki');
if (!/^https:\/\/[a-z0-9-]+\.mosaic-d77\.pages\.dev$/.test(BAZIS)) throw new Error('csak elonezeten fut (--bazis https://<ag>.mosaic-d77.pages.dev)');
const KULCS = process.env.EGYEZTETES_KULCS;
if (!KULCS) throw new Error('EGYEZTETES_KULCS hianyzik');
const be = BE ? JSON.parse(fs.readFileSync(BE, 'utf8')).osszefoglalo : {};
const uuid = arg('uuid') || be.salonic_uuid;
const host = arg('host') || (be.kuldes_url ? new URL(be.kuldes_url).host : '');
const level = {
  uuid, host, felado: arg('felado'), szolgaltatas: arg('szolgaltatas'), munkatarsak: arg('munkatars').split('|').filter(Boolean), idopont_szoveg: arg('idopont-szoveg'),
  ld: arg('ld-start') ? { startDate: arg('ld-start') } : null, level_datuma: arg('level-datuma'), diagnosztika: true,
};
const hivas = async (ut, opt = {}) => { const r = await fetch(BAZIS + ut, { ...opt, headers: { 'x-egyeztetes-kulcs': KULCS, 'content-type': 'application/json', ...(opt.headers || {}) } }); const szoveg = await r.text(); let j = null; try { j = JSON.parse(szoveg); } catch (e) { /* nem JSON */ } return { status: r.status, json: j, szoveg: j ? null : szoveg.slice(0, 300) }; };

const elso = await hivas('/api/foglalas-egyeztetes', { method: 'POST', body: JSON.stringify(level) });
const masodik = await hivas('/api/foglalas-egyeztetes', { method: 'POST', body: JSON.stringify({ ...level, diagnosztika: false }) }); // ismetlesre ne legyen ujabb esemeny
const e = (elso.json && elso.json.nyom) || {};
const emailKulcs = (e.ag1 && e.ag1.kulcs) || null;
const rekord = emailKulcs ? (await hivas(`/api/foglalas-kulcs?k=${encodeURIComponent(emailKulcs)}`)).json : null;
const nyom = {
  eset: ESET, bazis: BAZIS, ido: new Date().toISOString(),
  booking_id: be.azonosito || null,
  bookingUrl_teljes: be.bookingUrl || null,
  kulcs_a_bookingUrlbol: be.kulcs_a_bookingUrlbol || null,
  koszonooldal_kulcs_iras: be.kulcs_iras || null,
  kulcstabla_rekord_a_koszonooldal_utan: be.kulcstabla_rekord || null,
  email_relevans_mezok: { felado: level.felado, szolgaltatas: level.szolgaltatas, munkatarsak: level.munkatarsak, idopont_szoveg: level.idopont_szoveg, ld_startDate: level.ld && level.ld.startDate, level_datuma: level.level_datuma, salonic_uuid: uuid, host },
  email_kulcs_1_ag_salonic_oldalak: { kulcs: emailKulcs, serviceId: e.ag1 && e.ag1.serviceId, ok: e.ag1 && e.ag1.ok, miert: e.ag1 && e.ag1.miert, lepesek: e.ag1 && e.ag1.lepesek },
  email_kulcs_2_ag_nevtabla: e.ag2 || null,
  kulcstabla_rekord_az_email_kulcsara: rekord && rekord.rekord || null,
  kereses_eredmenye: elso.json ? { allapot: elso.json.allapot, kuldheto: elso.json.kuldheto, duplikalt: elso.json.duplikalt, kulcs: elso.json.kulcs, kulcs_forras: elso.json.kulcs_forras, service_egyezik: elso.json.service_egyezik, probalkozas: elso.json.probalkozas, riasztas: elso.json.riasztas, talalatok: e.talalatok } : elso,
  kapott_esemenyazonosito: elso.json && elso.json.esemeny_id || null,
  azonosito_egyezik_a_bongeszovel: !!(elso.json && elso.json.esemeny_id && be.azonosito && elso.json.esemeny_id === be.azonosito),
  masodik_kereses_ugyanarra: masodik.json ? { allapot: masodik.json.allapot, kuldheto: masodik.json.kuldheto, duplikalt: masodik.json.duplikalt, esemeny_id: masodik.json.esemeny_id } : masodik,
  http: { elso: elso.status, masodik: masodik.status },
};
console.log(JSON.stringify(nyom, null, 1));
if (KI) fs.writeFileSync(KI, JSON.stringify(nyom, null, 1));
