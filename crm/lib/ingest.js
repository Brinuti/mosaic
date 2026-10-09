// Lifecycle-esemeny -> CRM foglalas. A meglevo netlify/lib/lifecycle/parser.js ELEMZETT esemenyet (ertelmez() kimenete) alakitja booking.ingestBookingEvent hivassa.
//
//   ingestLifecycleEsemeny(db, esemeny, {most, noShowAuto, account}) -> { ok, valtozas, bookingId, guestId, ... } | { ok, figyelmen_kivul: true, ok_kod }
//
// esemeny (parser.js ertelmez(), ok:true): { tipus: 'foglalt'|'athelyezve'|'lemondva', uzletag, fiok, foglalasId, nev, telefonNyers, email, szolgaltatas, szolgaltatasok,
//   munkatars, kezdet, regiKezdet, lemondasOka }  + opcionalis: szolgaltatasId (Salonic szolgaltatas-azonosito), kuldve (a level kuldesi ideje, epoch mp), most.
// - CSAK a 'mosaic-oxigen' fiok / 'oxygen' uzletag kerul be; mas uzletag: figyelmen kivul hagyva (nem hiba, nem keletkezik adat).
// - Szolgaltatas: a service_catalog.salonic_service_ids az igazsag; ennek hianyaban az alap-azonositok (466110 first_hair, 466158 followup_hair, 466147 camera_assessment),
//   vegul az oxygen uzletag Salonic-pillanatkepenek neve (ismeretlen nev: nem talalgatunk -> 'kihagyva').
// - Idempotens: az ismetelt ertesito (a Salonic minden foglalasrol tobb levelet kuld) nem duplikal (booking.js: external_id + allapot + idopont).
// - A lemondas-ertesito azonosito nelkul jon: vendeg (e-mail / telefon) + idopont alapjan keressuk meg a foglalast (mint a lifecycle engine.js).
// - Utolagos torles (az idopont mar elmult) vagy "nem jelent meg" jelzes: NEM lemondas es NEM automatikus no_show (lifecycle DECISION #117): csak jelzes + audit, kiveve ha opc.noShowAuto.
import { szintetikusId } from '../../netlify/lib/lifecycle/parser.js';
import { normalizal as telefonNormalizal } from '../../netlify/lib/lifecycle/telefon.js';
import { szegmensek, ismertSzolgaltatas } from '../../netlify/lib/lifecycle/uzletag.js';
import { most as maMost, elso, keszit, normEmail, jsonIr, jsonOlvas } from './db.js';
import { FIOK_ALAP } from './constants.js';
import { auditStmt } from './audit.js';
import { ingestBookingEvent, szolgaltatasKod } from './booking.js';

export const UZLETAG = 'oxygen';
/** alap Salonic szolgaltatas-azonositok (a service_catalog.salonic_service_ids hianyaban; a katalogus feltoltese: szolgaltatasTerkepFeltolt) */
export const SALONIC_SZOLGALTATAS_ALAP = Object.freeze({ 466110: 'first_hair', 466158: 'followup_hair', 466147: 'camera_assessment' });
const TIPUS_ALLAPOT = Object.freeze({ foglalt: 'booked', athelyezve: 'rescheduled', lemondva: 'cancelled' });
const NEM_JELENT_MEG = /nem\s*jelent\s*meg|nem\s*j[öo]tt\s*el|nem\s*[ée]rkezett\s*meg|no[\s-]*show/i;
const NAP = 86400;

/** a service_catalog.salonic_service_ids feltoltese az alap azonositokkal (csak ha az adott fiokra meg nincs bejegyzes). Idempotens. */
export async function szolgaltatasTerkepFeltolt(db, { account = FIOK_ALAP } = {}) {
  let valtozott = 0;
  for (const [id, kod] of Object.entries(SALONIC_SZOLGALTATAS_ALAP)) {
    const sor = await elso(db, 'SELECT salonic_service_ids FROM service_catalog WHERE code = ?1', kod);
    if (!sor) continue;
    const terkep = jsonOlvas(sor.salonic_service_ids, {}) || {};
    if (Array.isArray(terkep[account]) && terkep[account].length) continue;
    terkep[account] = [String(id)];
    await keszit(db, 'UPDATE service_catalog SET salonic_service_ids = ?2 WHERE code = ?1', kod, jsonIr(terkep)).run();
    valtozott += 1;
  }
  return { valtozott };
}

async function szolgaltatasFeloldas(db, account, e) {
  const probak = [e.szolgaltatasId, e.szolgaltatasAzonosito].filter((x) => x !== undefined && x !== null && x !== '').map(String);
  for (const p of probak) {
    try { return await szolgaltatasKod(db, account, p); } catch { /* tovabb */ }
    if (SALONIC_SZOLGALTATAS_ALAP[p]) return SALONIC_SZOLGALTATAS_ALAP[p];
  }
  try { return await szolgaltatasKod(db, account, e.szolgaltatas); } catch { /* nev alapjan */ }
  if (!ismertSzolgaltatas(UZLETAG, e.szolgaltatas)) return null;   // ismeretlen szolgaltatas: nem talalgatunk
  const cimkek = szegmensek(UZLETAG, e.szolgaltatas);
  if (cimkek.includes('konzultacio')) return 'camera_assessment';
  if (cimkek.includes('visszatero')) return 'followup_hair';
  if (cimkek.includes('elso')) return 'first_hair';
  return null;
}

const ALLAPOT_LISTA = {
  aktiv: "('booked', 'rescheduled')",
  lemondott: "('cancelled')",
};
/** a vendeg (e-mail / telefon, a kapcsolt azonositokkal is) foglalasa az adott idopontra */
async function vendegFoglalasa(db, { account, email, telefon, kezdet, csoport }) {
  if (!Number.isFinite(kezdet) || (!email && !telefon)) return null;
  return elso(db, `SELECT b.* FROM booking b JOIN guest g ON g.id = b.guest_id
    WHERE b.account = ?1 AND b.start_at = ?2 AND b.status IN ${ALLAPOT_LISTA[csoport]} AND b.duplicate_of IS NULL
      AND (g.email = ?3 OR g.phone = ?4 OR EXISTS (SELECT 1 FROM salonic_guest_identity i WHERE i.guest_id = g.id AND (i.email = ?3 OR i.phone = ?4)))
    ORDER BY b.created_at DESC LIMIT 1`, account, kezdet, email, telefon);
}
const kulsoId = (db, account, id) => elso(db, 'SELECT * FROM booking WHERE account = ?1 AND external_id = ?2', account, id);

async function naplo(db, { most, ok, eredmeny, reszlet }) {
  await auditStmt(db, { action: 'ingest.lifecycle', resource: 'booking', result: ok ? 'ok' : 'error', detail: { eredmeny, ...reszlet }, now: most }).run();
}

/**
 * @param {object} db
 * @param {object} esemeny  a parser.js elemzett esemenye
 * @param {{most?: number, now?: number, noShowAuto?: boolean, account?: string}} [opc]  (a most / now ekvivalens; az API ingest(db, esemeny, {now, env}) alakban hivja)
 */
export async function ingestLifecycleEsemeny(db, esemeny, opc = {}) {
  const e = esemeny || {};
  const account = opc.account || FIOK_ALAP;
  const most = Number.isFinite(opc.most) ? opc.most : (Number.isFinite(opc.now) ? opc.now : (Number.isFinite(e.most) ? e.most : maMost()));
  if (e.ok === false || !TIPUS_ALLAPOT[e.tipus]) return { ok: false, valtozas: 'kihagyva', ok_kod: 'NEM_ERTELMEZETT_ESEMENY' };

  // csak az Oxygeni uzletag / fiok
  if (e.uzletag !== UZLETAG || (e.fiok && String(e.fiok).toLowerCase() !== account)) {
    await naplo(db, { most, ok: true, eredmeny: 'figyelmen_kivul', reszlet: { uzletag: e.uzletag ?? null } });
    return { ok: true, figyelmen_kivul: true, ok_kod: 'MAS_UZLETAG', uzletag: e.uzletag ?? null };
  }
  const kod = await szolgaltatasFeloldas(db, account, e);
  if (!kod) {
    await naplo(db, { most, ok: false, eredmeny: 'ismeretlen_szolgaltatas', reszlet: { tipus: e.tipus } });
    return { ok: false, valtozas: 'kihagyva', ok_kod: 'ISMERETLEN_SZOLGALTATAS' };
  }
  if (!Number.isInteger(e.kezdet)) return { ok: false, valtozas: 'kihagyva', ok_kod: 'HIANYZO_IDOPONT' };

  const email = normEmail(e.email);
  const telefon = telefonNormalizal(e.telefonNyers);
  const kuldve = Number.isFinite(Number(e.kuldve)) && Number(e.kuldve) > 1.6e9 && Number(e.kuldve) <= most ? Math.floor(Number(e.kuldve)) : most;
  const szint = (kezdet) => szintetikusId(UZLETAG, email || '', telefon, kezdet);

  // ---- a foglalas kulso azonositoja
  let externalId = e.foglalasId ? String(e.foglalasId).toLowerCase() : null;
  let allapot = TIPUS_ALLAPOT[e.tipus];
  let kezdet = e.kezdet;

  if (e.tipus === 'foglalt') {
    externalId ||= szint(e.kezdet);
  } else if (e.tipus === 'athelyezve') {
    let volt = externalId ? await kulsoId(db, account, externalId) : null;
    if (!volt && e.regiKezdet) volt = (await kulsoId(db, account, szint(e.regiKezdet))) || (await vendegFoglalasa(db, { account, email, telefon, kezdet: e.regiKezdet, csoport: 'aktiv' }));
    if (!volt) volt = await vendegFoglalasa(db, { account, email, telefon, kezdet: e.kezdet, csoport: 'aktiv' });   // a masodik (ketszer erkezo) ertesito: mar az uj idopontban van
    externalId = volt ? volt.external_id : (externalId || szint(e.kezdet));
  } else {   // lemondva
    let volt = externalId ? await kulsoId(db, account, externalId) : null;
    if (!volt) volt = (await kulsoId(db, account, szint(e.kezdet))) || (await vendegFoglalasa(db, { account, email, telefon, kezdet: e.kezdet, csoport: 'aktiv' })) || (await vendegFoglalasa(db, { account, email, telefon, kezdet: e.kezdet, csoport: 'lemondott' }));
    // utolagos torles / "nem jelent meg" jelzes: nem lemondas, nem automatikus no_show (csak jelzes)
    const nemJelent = NEM_JELENT_MEG.test(String(e.lemondasOka || ''));
    const utolagos = e.kezdet <= kuldve && kuldve - e.kezdet <= 3 * NAP;
    if (!opc.noShowAuto && (nemJelent || utolagos) && (!volt || AKTIV_STATUSZ.includes(volt.status))) {
      await naplo(db, { most, ok: true, eredmeny: nemJelent ? 'nem_jelent_meg_jelzes' : 'utolagos_torles', reszlet: { foglalas: volt?.id ?? null } });
      return { ok: true, valtozas: 'kihagyva', ok_kod: nemJelent ? 'NEM_JELENT_MEG_JELZES' : 'UTOLAGOS_TORLES', bookingId: volt?.id ?? null, valtoztatas: false };
    }
    if (nemJelent && opc.noShowAuto) allapot = 'no_show';
    externalId = volt ? volt.external_id : (externalId || szint(e.kezdet));
    if (volt) kezdet = volt.start_at;
  }

  const r = await ingestBookingEvent(db, {
    account, externalId, service: kod, start: kezdet, status: allapot, eventAt: kuldve, bookedAt: kuldve, now: most,
    therapist: e.munkatars ? { nev: e.munkatars } : null,
    guest: { externalId: null, nev: e.nev || null, email, telefon },
  });
  await keszit(db, 'UPDATE salonic_account SET last_sync_at = MAX(COALESCE(last_sync_at, 0), ?2) WHERE id = ?1', account, most).run();
  await naplo(db, { most, ok: true, eredmeny: r.valtozas, reszlet: { tipus: e.tipus, szolgaltatas: kod, foglalas: r.bookingId ?? null } });
  return { ok: true, ...r, externalId, szolgaltatas: kod };
}
const AKTIV_STATUSZ = ['booked', 'rescheduled'];

/** az API (api-admin.js POST /ingest) altal keresett nev */
export const ingest = ingestLifecycleEsemeny;
