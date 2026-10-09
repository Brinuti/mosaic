// Uzenet-MOTOR: outbox_event -> message_job -> (kuldeskori friss allapot + kapuk) -> render -> kuldo -> message_ledger. Platformfuggetlen (db/kuldo/tarolo parameter).
//
//   outboxFeldolgoz(db, {katalogus, most, limit})     a pending outbox_event-ek atomikus claim-je, a jobokAzEsemenybol (messages/utemezo.js) szerinti message_job sorok
//                                                      (UNIQUE idempotency_key; 'torol' = a fuggo job 'cancelled'), belso ertesitesek (alert.* -> DOC24/DOC48/NEG/COMPLAINT)
//   karbantartas(db, {most})                          DOC24/DOC48 riasztasok (plan.dokumentumRiasztasok), berlet-lejarat jobok (B30/B7), esedekes kontroll (E8), elakadt claim-ek
//   tick(db, {most, kuldo, tarolo, konfig, szemelyesAdatOlvaso})   karbantartas + outbox + az esedekes jobok atomikus claim-je es kuldese
//   vendegAllapot(db, {...})                          a kuldes PILLANATABAN osszeallitott allapot (spec 3.8): guest_key, booking_status, ... recipient_verified
//   ujrafuttat(db, jobId, opc)                        kezi ujrafuttatas (dead / failed / blocked job)
//
// Szabalyok: valodi kuldes CSAK ha konfig.kuldes === 'eles' (alapbol DRY_RUN); a tesztek soha nem allitjak 'eles'-re. Penz egesz Ft, ido epoch mp.
// A job-allapotok (message_job.status): pending | claimed | sent | dry_run | skipped | blocked | failed | dead | cancelled; a stop_reason: "<EREDMENY>:<kod>"
// (pl. SKIPPED_CONSENT_OR_STATE:no_marketing_consent_email, BLOCKED_MISSING_DATA:content_not_ready, SANDBOX_ONLY:sandbox_data, REQUIRES_VERIFICATION:NINCS_SZOVEG).
import KATALOG from './messages/katalog.js';
import { jobokAzEsemenybol, idempotencyKulcs } from './messages/utemezo.js';
import { kapuErtekel, EREDMENY, kovetkezoAblak } from './messages/kapuk.js';
import { renderel } from './messages/render.js';
import { valtozokEpit, datum as datumSz, ido as idoSz } from './messages/valtozok.js';
import { dryRunAdapter, kuldoKeszit, konfigEnvbol } from './messages/kuldo.js';
import { ALAP_URL, GOOGLE_VELEMENYEK_URL } from '../../netlify/lib/lifecycle/render.js';
import { UZLETAGAK } from '../../netlify/lib/lifecycle/uzletag.js';
import { UUID_RE } from '../../netlify/lib/lifecycle/elo.js';
import { uuid, most as maMost, elso, mind, keszit, tranzakcio, valtozas, jsonIr, jsonOlvas, normTelefon, normEmail, helyi, helyiEpoch, CrmHiba } from './db.js';
import { auditStmt } from './audit.js';
import { fuggoEsemenyek, claim as outboxClaim, kesz as outboxKesz, hibas as outboxHibas } from './outbox.js';
import { megkoveteli, lehet, szerepek as szerepekLekerdez } from './rbac.js';
import { vegleges } from './guest.js';
import { foglalas } from './booking.js';
import { marketingAllapot } from './consent.js';
import { nyitottPanasz, surveyKiad } from './complaint.js';
import { kuraAllapot } from './course.js';
import { kuraAjanlhato, kiadhato as kerdoivKiadhato, kiad as kerdoivKiad } from './assessment.js';
import { szabadAlkalmak, csomag } from './package.js';
import { kuldhetoE, dokumentumRiasztasok, elkuldve, mezok as tervMezok } from './plan.js';
import { linkKiad } from './images.js';
import { KEZELES_RITMUS_NAP, MASODPERC } from './constants.js';
import { leiratkozasLinkSync } from './api-token.js';

export { KATALOG };

export const KONFIG_ALAP = Object.freeze({
  kuldes: 'dry',                    // 'dry' | 'eles' (valodi kuldes CSAK 'eles'-nel)
  maxProba: 5,                      // kuldesi kiserletek (szolgaltatoi hiba) szama a dead-letter elott
  backoffMp: [300, 900, 3600, 10800, 43200],   // ujraprobalkozas: 5 perc, 15 perc, 1 ora, 3 ora, 12 ora
  hianyzoAdatUjraMp: 3600,          // BLOCKED_MISSING_DATA (ujraprobalhato): ennyi mp mulva ujra
  hianyzoAdatMaxProba: 72,          // ennyi ujraproba utan veglegesen 'blocked' (kezi ujrafuttatassal indithato)
  claimLejaratMp: 900,              // az ennyi ideje 'claimed' job visszakerul 'pending'-be (osszeomlas utan)
  batchMeret: 50,
  csakTesztCimzettek: null,         // lista (e-mail / telefon): ha meg van adva, MAS cimzett SANDBOX_ONLY
  kontrollMaxKesesNap: 14,          // E8: csak a legfeljebb ennyi napja esedekes kontrollra (nincs visszamenoleges potlas)
  maxKesesMp: {},                   // sablononkent felulirhato (lasd MAX_KESES_MP): az ennyivel kesobb esedekes job mar nem megy ki (leallas utani uzenet-hullam ellen)
  alapUrl: ALAP_URL,
  publikusAlap: `${ALAP_URL}/api/crm`,   // a vendeg-linkek alapja (API.md /public/...)
  linkek: {},                       // opcionalis felulirasok: { a5Pdf(ctx), a5Zaras(ctx), ertekeles(ctx), leiratkozas(ctx) } -> string|null
  belsoSzovegek: {},                // opcionalis: { NEG: {targy, torzs:[...]}, COMPLAINT: {...} } (a mesteranyag nem ad belso szoveget: REQUIRES_VERIFICATION)
});
const konfigEgyesit = (k) => ({ ...KONFIG_ALAP, ...(k || {}) });

/**
 * Konfig a Cloudflare env-bol: CRM_KULDES=dry|eles (barmi mas = dry), CRM_TESZT_CIMZETTEK=vesszovel elvalasztott e-mail / telefon lista (ha meg van adva, MAS cimzett SANDBOX_ONLY),
 * CRM_PUBLIKUS_URL=a vendeg-linkek alapja (alap: <ALAP_URL>/api/crm).
 */
export function motorKonfigEnvbol(env = {}) {
  const k = { ...konfigEnvbol(env) };
  const lista = String(env.CRM_TESZT_CIMZETTEK || '').split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
  if (lista.length) k.csakTesztCimzettek = lista;
  if (env.CRM_PUBLIKUS_URL) k.publikusAlap = String(env.CRM_PUBLIKUS_URL).replace(/\/+$/, '');
  // marketing e-mail leiratkozasi link (alairt, allapotmentes token; env.CRM_TITOK nelkul nincs link)
  const origin = String(env.CRM_PUBLIKUS_URL || ALAP_URL).replace(/\/api\/crm\/?$/, '').replace(/\/+$/, '');
  k.linkek = { leiratkozas: ({ guest }) => leiratkozasLinkSync(env, origin, guest.id) };
  return k;
}

const NAP = MASODPERC.NAP;
/**
 * Az esedekesseghez kepest legfeljebb ennyi masodperccel KESOBB mehet ki egy uzenet (a leallas / kimaradt tick utan nem potolunk regi uzenetet: "ne potolj regi uzenetet").
 * Ami itt nincs felsorolva (T0-F, T0-C, C0, P0, E5-E7, E10, belso ertesitesek): nincs ido-korlat (a tartalom-kapu / foglalas-allapot dont). REQUIRES_VERIFICATION: uzleti ertekek.
 */
export const MAX_KESES_MP = Object.freeze({
  'T-72': 12 * 3600, 'T-24': 6 * 3600, S0: 12 * 3600, G0: 3 * NAP, R1: 2 * NAP, R2: 2 * NAP, A1: 2 * NAP, A2: 2 * NAP, C1: 2 * NAP, C2: 2 * NAP, N0: 2 * NAP,
  E2: 3 * NAP, E3: 3 * NAP, E8: 7 * NAP, E9: 7 * NAP, B30: 3 * NAP, B7: 2 * NAP,
});
const BELSO_ALERT_ID = Object.freeze(['DOC24', 'DOC48', 'NEG', 'COMPLAINT']);
const svc = (kod) => (kod === 'legacy_combo_only' ? 'legacy_combo' : kod);
const bStatus = (s) => (s === 'rescheduled' ? 'booked' : s);   // a kapuk 'booked'-et varnak az aktiv foglalasra
const AKTIV = ['booked', 'rescheduled'];

// ---------------------------------------------------------------------------------------------------------------------------------
// Job-sorok
// ---------------------------------------------------------------------------------------------------------------------------------
const INSERT_JOB = `INSERT OR IGNORE INTO message_job (id, guest_id, template_key, template_version, channel, context_id, idempotency_key, status, run_at, attempts, payload, created_at)
  VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending', ?8, 0, ?9, ?10)`;

/** egy job beszurasa; ismetelt kulcs nem duplikal; a 'cancelled' (athelyezes-visszaallas) job ujraelesztheto. -> 'uj' | 'mar_volt' | 'ujraelesztve' */
async function jobBeszur(db, { guestId, j, payload, most }) {
  const runAt = j.legkorabbi_kuldes ?? j.esedekes ?? most;
  const p = { esedekes: j.esedekes ?? runAt, csoport: j.csoport, ...payload };
  const r = await keszit(db, INSERT_JOB, uuid(), guestId, j.template_key, j.template_version, j.csatorna, j.context_id, j.idempotency_key, runAt, jsonIr(p), most).run();
  if (valtozas(r) === 1) return 'uj';
  const u = await keszit(db, `UPDATE message_job SET status = 'pending', stop_reason = NULL, last_error = NULL, run_at = ?2, attempts = 0, payload = ?3, claimed_at = NULL, claimed_by = NULL
    WHERE idempotency_key = ?1 AND status = 'cancelled'`, j.idempotency_key, runAt, jsonIr(p)).run();
  return valtozas(u) === 1 ? 'ujraelesztve' : 'mar_volt';
}

async function jobTorol(db, kulcs, ok = 'CANCELLED_BY_EVENT') {
  const r = await keszit(db, 'UPDATE message_job SET status = \'cancelled\', stop_reason = ?2 WHERE idempotency_key = ?1 AND status = \'pending\'', kulcs, ok).run();
  return valtozas(r);
}

/** a scheduler-esemeny alapjan a jobok letrehozasa / torlese. szuro: kihagyando sablonok. */
async function utemez(db, { esemeny, katalogus, payload = {}, most, szuro = () => true }) {
  const stat = { uj: 0, mar_volt: 0, ujraelesztve: 0, torolve: 0 };
  for (const j of jobokAzEsemenybol(esemeny, katalogus)) {
    if (!szuro(j)) continue;
    if (j.muvelet === 'torol') { stat.torolve += await jobTorol(db, j.idempotency_key); continue; }
    stat[await jobBeszur(db, { guestId: esemeny.guest_key, j, payload, most })] += 1;
  }
  return stat;
}
const osszead = (a, b) => { for (const k of Object.keys(b)) a[k] = (a[k] || 0) + b[k]; return a; };

// ---------------------------------------------------------------------------------------------------------------------------------
// Vendeg-allapot (a kuldes pillanataban, a DB-bol)
// ---------------------------------------------------------------------------------------------------------------------------------
/** szemelyes cimzett-azonosito a teszt-szabalyhoz: kisbetus e-mail / normalizalt telefon */
const cimKulcs = (c) => (String(c || '').includes('@') ? normEmail(c) : normTelefon(c));

function sandboxE(guest, cimek, konfig, identitasok = []) {
  if (identitasok.some((x) => String(x.external_id).startsWith('demo-'))) return true;                    // demo-vendeg soha nem kap valodi uzenetet
  if (cimek.some((c) => /\.invalid$/i.test(String(c || '')))) return true;                                // RFC 2606: .invalid cim
  const lista = konfig.csakTesztCimzettek;
  if (Array.isArray(lista) && lista.length) {
    const engedett = new Set(lista.map(cimKulcs).filter(Boolean));
    return !cimek.some((c) => c && engedett.has(cimKulcs(c)));
  }
  return false;
}

/** az "alap" vendegallapot: ami nem a konkret jobtol fugg (a pillanatkephez is ezt hasznaljuk) */
async function alapAllapot(db, guestId, { most, kiveveBookingId = null }) {
  const gid = await vegleges(db, guestId);
  const guest = gid ? await elso(db, 'SELECT * FROM guest WHERE id = ?1', gid) : null;
  if (!guest) return { guestId: gid, guest: null, allapot: { guest_key: guestId, recipient_verified: false } };
  const [mEmail, mSms, panasz, kura, ajanlhato, csomagok, kov, feloldott] = await Promise.all([
    marketingAllapot(db, gid, 'email_marketing'), marketingAllapot(db, gid, 'sms_marketing'), nyitottPanasz(db, gid), kuraAllapot(db, gid), kuraAjanlhato(db, gid),
    elso(db, 'SELECT COUNT(*) AS n FROM package_purchase WHERE guest_id = ?1 AND status IN (\'paid_active\', \'extended_by_manager\') AND expires_at >= ?2', gid, most),
    elso(db, `SELECT id, start_at, service_code FROM booking WHERE guest_id = ?1 AND status IN ('booked', 'rescheduled') AND duplicate_of IS NULL AND start_at > ?2 AND id <> ?3 ORDER BY start_at LIMIT 1`, gid, most, kiveveBookingId || ''),
    elso(db, 'SELECT MAX(resolved_at) AS t FROM complaint WHERE guest_id = ?1 AND status = \'resolved\'', gid),
  ]);
  const fogyIgen = (m) => m.ok || ['NYITOTT_PANASZ', 'KLINIKAI_STOP', 'VISSZAVONVA'].includes(m.ok_kod);   // a panasz / stop / leiratkozas kulon mezoben van (consent = volt hozzajarulas)
  return {
    guestId: gid, guest,
    allapot: {
      guest_key: gid,
      course_status: kura.status,
      package_owned: csomagok.n > 0,
      next_active_booking: kov ? { id: kov.id, start_at: kov.start_at, service_type: svc(kov.service_code) } : null,
      complaint_open: panasz,
      clinical_stop: ajanlhato.ok ? null : ajanlhato.ok_kod,
      consent_email: fogyIgen(mEmail), consent_sms: fogyIgen(mSms),
      email_unsubscribe: mEmail.ok_kod === 'VISSZAVONVA', sms_optout: mSms.ok_kod === 'VISSZAVONVA',
      complaint_resolved_at: feloldott?.t ?? undefined,
    },
  };
}

/** a vendeg-pillanatkep az utemezonek (marketing job csak consenttel, masik foglalas / nyitott panasz nelkul jon letre) */
async function pillanatkep(db, guestId, { most, kiveveBookingId = null }) {
  const a = (await alapAllapot(db, guestId, { most, kiveveBookingId })).allapot;
  return { consent_email: !!a.consent_email, consent_sms: !!a.consent_sms, email_unsubscribe: !!a.email_unsubscribe, sms_optout: !!a.sms_optout, next_active_booking: a.next_active_booking ?? null, complaint_open: !!a.complaint_open };
}

const kezeloNev = async (db, booking, guest) => {
  if (booking?.therapist_name) return booking.therapist_name;
  const id = booking?.therapist_id || guest?.therapist_id;
  if (!id) return null;
  const u = await elso(db, 'SELECT name, salonic_name FROM staff_user WHERE id = ?1', id);
  return u ? (u.salonic_name || u.name) : null;
};

async function sessionKeres(db, bookingId) { return bookingId ? elso(db, 'SELECT * FROM treatment_session WHERE booking_id = ?1', bookingId) : null; }
async function tervKeres(db, sessionId, kind) { return sessionId ? elso(db, 'SELECT * FROM treatment_plan WHERE session_id = ?1 AND kind = ?2', sessionId, kind) : null; }

const VEGLEGES_DOKU = ['therapist_final', 'generated_pdf', 'sent'];
const TARTALOM_SABLONOK = new Set(['P0', 'E2', 'E5', 'E6', 'E7', 'E10']);
const KULDI_DOKUMENTUMOT = new Set(['P0', 'E6', 'E7', 'E10']);   // ezek a levelek maga a szemelyes dokumentum kezbesitese
const DOKU_FAJTA = { P0: 'plan', E2: 'plan', E6: 'review', E7: 'review', E10: 'closing' };

/** content_ready: a szemelyes tartalom megvan-e (kesz, jovahagyott kezeloi dokumentacio + kepek + ellenorzott cimzett). -> { kesz, hianyok[] } */
async function tartalomKesz(db, tpl, { guest, booking, session }) {
  if (!TARTALOM_SABLONOK.has(tpl.id)) return { kesz: true, hianyok: [] };
  if (!session) return { kesz: false, hianyok: ['NINCS_KEZELES'] };
  if (tpl.id === 'E5') {
    const n = await elso(db, 'SELECT id FROM treatment_note WHERE session_id = ?1 AND status = \'final\' AND kind IN (\'general\', \'camera_review\') ORDER BY final_at DESC LIMIT 1', session.id);
    return n ? { kesz: true, hianyok: [] } : { kesz: false, hianyok: ['JOVAHAGYOTT_KEZELOI_MEGJEGYZES_HIANYZIK'] };
  }
  const kind = DOKU_FAJTA[tpl.id];
  const dokuSession = tpl.id === 'E2' || tpl.id === 'P0' ? (await elso(db, 'SELECT * FROM treatment_session WHERE guest_id = ?1 AND treatment_index = 1 ORDER BY created_at LIMIT 1', guest.id)) : session;
  const terv = await tervKeres(db, dokuSession?.id, kind);
  if (!terv) return { kesz: false, hianyok: ['NINCS_DOKUMENTUM'] };
  if (tpl.id === 'E2') {
    const f = tervMezok(terv);
    return VEGLEGES_DOKU.includes(terv.status) && f.otthoni_apolas?.termek ? { kesz: true, hianyok: [] } : { kesz: false, hianyok: [`ALLAPOT:${terv.status}`] };
  }
  const k = await kuldhetoE(db, terv.id, { cimzett: guest.email });
  return { kesz: k.ok, hianyok: k.hianyok };
}

/**
 * A vendeg AKTUALIS allapota a kuldes pillanataban (spec 3.8). Visszaad: { allapot, guest, booking, session, staff, tartalomHianyok }.
 * job: a message_job sor (payload: booking_id | purchase_id | plan_id | staff_id ...); tpl: a katalogus-elem.
 */
export async function vendegAllapot(db, { job, tpl, most = maMost(), konfig = KONFIG_ALAP }) {
  konfig = konfigEgyesit(konfig);
  const payload = jsonOlvas(job.payload, {});
  const bookingId = payload.booking_id || null;
  const base = await alapAllapot(db, job.guest_id, { most, kiveveBookingId: bookingId });
  const { guest } = base;
  const a = { ...base.allapot };
  if (!guest) return { allapot: { ...a, recipient_verified: false }, guest: null, booking: null, session: null, staff: null, tartalomHianyok: [] };

  const booking = bookingId ? await foglalas(db, bookingId) : null;
  const session = await sessionKeres(db, bookingId);
  if (booking) {
    a.booking_status = bStatus(booking.status);
    a.booking_start = booking.start_at;
    a.service_type = svc(booking.service_code);
  }
  let staff = null;
  const cimek = [];
  if (tpl.csatorna === 'internal') {
    staff = payload.staff_id ? await elso(db, 'SELECT * FROM staff_user WHERE id = ?1 AND active = 1', payload.staff_id) : null;
    a.recipient_verified = !!(staff && normEmail(staff.email));
    cimek.push(staff?.email);
  } else if (tpl.csatorna === 'sms') {
    a.recipient_verified = !!(guest.phone && guest.phone_verified && normTelefon(guest.phone));
    cimek.push(guest.phone);
  } else {
    a.recipient_verified = !!(guest.email && guest.email_verified && normEmail(guest.email));
    cimek.push(guest.email);
  }
  const azonositok = await mind(db, 'SELECT external_id FROM salonic_guest_identity WHERE guest_id = ?1', guest.id);
  a.sandbox = sandboxE(guest, cimek, konfig, azonositok);

  const tart = await tartalomKesz(db, tpl, { guest, booking, session });
  a.content_ready = tart.kesz;

  const kapuk = new Set(tpl.gate || []);
  if (kapuk.has('credit_window_valid')) {
    const c = await elso(db, 'SELECT * FROM assessment_credit WHERE guest_id = ?1 ORDER BY window_start DESC LIMIT 1', guest.id);
    a.assessment_credit_window_ok = !!c && ['open', 'eligible'].includes(c.status) && most <= c.window_end;
  }
  if (kapuk.has('package_has_unused')) a.unused_appointments = payload.purchase_id ? await szabadAlkalmak(db, payload.purchase_id, { now: most }) : 0;
  if (kapuk.has('doc_missing')) {
    const p = payload.plan_id ? await elso(db, 'SELECT status FROM treatment_plan WHERE id = ?1', payload.plan_id) : null;
    a.dokumentacio_hianyzik = !!p && ['missing', 'draft'].includes(p.status);
  }
  if (kapuk.has('no_same_day_rebook')) {
    const nap0 = helyi(most);
    const mai = await mind(db, 'SELECT template_key FROM message_ledger WHERE guest_id = ?1 AND outcome IN (\'sent\', \'dry_run\') AND at >= ?2', guest.id, helyiEpoch(nap0.y, nap0.m, nap0.d, 0, 0));
    a.ma_kuldott = mai.map((r) => r.template_key);
  }
  return { allapot: a, guest, booking, session, staff, tartalomHianyok: tart.hianyok };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Szemelyes tartalom / helyorzo-ertekek (a kuldes pillanataban)
// ---------------------------------------------------------------------------------------------------------------------------------
const lista = (t) => (Array.isArray(t) ? t.filter((x) => typeof x === 'string' && x.trim()).join('; ') : (t || null));

function szolgNev(kod) {
  return { first_hair: 'Oxygeni fejbőrkezelés', followup_hair: 'Oxygeni fejbőrkezelés', camera_assessment: 'hajkamerás állapotfelmérés' }[kod] || 'Oxygeni kezelés';
}

const datumIdo = (e) => (Number.isFinite(e) ? `${datumSz(e)}, ${idoSz(e)}` : null);

/** kerdoiv-link a foglalashoz: { link, jelzes } - jovahagyatlan verzio / mar kitoltve: link nelkul (a T0 felmero-link nelkul megy es a job jelzi) */
async function felmeroLink(db, { guest, booking, most, konfig, elonezet = false }) {
  const k = await kerdoivKiadhato(db);
  if (!k.ok) return { link: null, jelzes: 'felmero_link_nelkul:nincs_jovahagyott_verzio' };
  if (elonezet) return { link: `${konfig.publikusAlap}/public/felmero/ELONEZET-TOKEN`, jelzes: null };   // az elonezet nem hoz letre tokent
  try {
    const r = await kerdoivKiad(db, { guestId: guest.id, bookingId: booking?.id ?? null, now: most });
    if (r.mar) return { link: null, jelzes: 'felmero_link_nelkul:mar_kitoltve' };
    return { link: `${konfig.publikusAlap}/public/felmero/${r.token}`, jelzes: null };
  } catch (e) {
    return { link: null, jelzes: `felmero_link_nelkul:${e.kod || 'hiba'}` };
  }
}

/** az alap szemelyes-adat olvaso: a DB-bol (kuraterv, kezeloi jegyzet, osszehasonlitas) tolti a sablon-valtozokat. -> { ertekek, jelzesek[] } */
export async function alapSzemelyesAdatOlvaso(db, c) {
  const { tpl, guest, booking, session, allapot, most, konfig, payload, elonezet = false } = c;
  const nevek = new Set(tpl.valtozok || []);
  const v = {}; const jelzesek = [];
  const kezelo = await kezeloNev(db, booking || (payload.therapist_id ? { therapist_id: payload.therapist_id } : null), guest);
  if (nevek.has('kezelo') && kezelo) v.kezelo = kezelo;
  if (nevek.has('szolgaltatas') && booking) v.szolgaltatas = szolgNev(booking.service_code);
  if (nevek.has('foglalas_link')) v.foglalas_link = UZLETAGAK.oxygen.foglalasUrl;
  if (nevek.has('idopont_link') && booking) v.idopont_link = UUID_RE.test(String(booking.external_id)) ? `https://${booking.account}.salonic.hu/booking/bookingDetails/${booking.external_id}` : UZLETAGAK.oxygen.foglalasUrl;
  if (nevek.has('google_ertekeles_link')) v.google_ertekeles_link = GOOGLE_VELEMENYEK_URL;

  // felmero-link (T0-F, T0-C, T-72, T-24): hiaba eseten nincs link, a sablon link-mondata kimarad
  if (['allapotfelmero_link', 'kerdoiv_link'].some((n) => nevek.has(n))) {
    const f = await felmeroLink(db, { guest, booking, most, konfig, elonezet });
    if (f.link) { v.allapotfelmero_link = f.link; v.kerdoiv_link = f.link; }
    if (f.jelzes) jelzesek.push(f.jelzes);
  }
  // S0: belso 1-5 kerdoiv
  if (nevek.has('rovid_kerdoiv_link')) {
    if (elonezet) v.rovid_kerdoiv_link = `${konfig.publikusAlap}/public/elegedettseg/ELONEZET-TOKEN`;
    else {
      const s = await surveyKiad(db, { bookingId: booking?.id, now: most });
      if (s.mar) jelzesek.push('survey_mar_kitoltve');
      else v.rovid_kerdoiv_link = `${konfig.publikusAlap}/public/elegedettseg/${s.token}`;
    }
  }
  // belso ertesitesek
  if (tpl.csatorna === 'internal') {
    v.guest_id = `g-${String(guest.id).slice(0, 8)}`;
    if (booking) { v.datum = datumSz(booking.start_at); v.booking_id = booking.external_id; }
  }
  // berlet
  if (payload.purchase_id && (nevek.has('tipus') || nevek.has('maradek_alkalom') || nevek.has('lejarat_datum_ragos'))) {
    const p = await csomag(db, payload.purchase_id);
    if (p) {
      v.tipus = p.package_type === 'package_5' ? '5 alkalmas' : '10 alkalmas';
      v.maradek_alkalom = String(allapot.unused_appointments ?? (await szabadAlkalmak(db, p, { now: most })));
      Object.assign(v, valtozokEpit({ lejarat: p.expires_at }));
    }
  }
  // kuraterv / dokumentacio alapu tartalmak
  const elsoSession = await elso(db, 'SELECT * FROM treatment_session WHERE guest_id = ?1 AND treatment_index = 1 ORDER BY created_at LIMIT 1', guest.id);
  const tervElso = await tervKeres(db, elsoSession?.id, 'plan');
  const fElso = tervElso ? tervMezok(tervElso) : {};
  const nb = allapot.next_active_booking;
  if (tpl.id === 'P0') {
    const f = fElso;
    Object.assign(v, { jo_hagyott_panasz: f.fo_panasz, kezelo_megfigyelese: lista(f.megfigyelesek), szemelyes_cel: f.cel });
    v.egyeni_ritmus = f.ritmus_nap ? (f.ritmus_nap === 14 ? 'kéthetente' : `${f.ritmus_nap} naponként`) : null;
    if (nb) v.kov_datum_ido = datumIdo(nb.start_at);
    else if (f.kovetkezo_idopont?.javasolt_intervallum) v.javasolt_idoszak = f.kovetkezo_idopont.javasolt_intervallum;
    const a5 = konfig.linkek?.a5Pdf?.({ guest, terv: tervElso, session });
    if (a5) v.biztonsagos_a5_pdf_link = a5;   // REQUIRES_VERIFICATION: a vendeg-oldali PDF-link nincs az API-ban; konfig.linkek.a5Pdf adja
  }
  if (tpl.id === 'E2') v.kezelo_otthoni_rutin = fElso.otthoni_apolas?.termek ? `${fElso.otthoni_apolas.termek}: ${fElso.otthoni_apolas.hasznalat}` : null;
  if (tpl.id === 'E5') {
    const n = session ? await elso(db, 'SELECT text FROM treatment_note WHERE session_id = ?1 AND status = \'final\' AND kind IN (\'general\', \'camera_review\') ORDER BY final_at DESC LIMIT 1', session.id) : null;
    v.kezelo_megjegyzes = n?.text || null;
    v.kov_datum_vagy_javasolt_idoszak = nb ? datumIdo(nb.start_at) : (booking ? `${datumSz(booking.start_at + KEZELES_RITMUS_NAP * NAP)} körüli időszak` : null);
  }
  if (tpl.id === 'E6' || tpl.id === 'E7' || tpl.id === 'E10') {
    const kind = tpl.id === 'E10' ? 'closing' : 'review';
    const terv = await tervKeres(db, session?.id, kind);
    const f = terv ? tervMezok(terv) : {};
    const osszeh = tpl.id === 'E10'
      ? await elso(db, 'SELECT c.* FROM image_comparison c WHERE c.guest_id = ?1 AND c.status = \'final\' ORDER BY c.final_at DESC, c.rowid DESC LIMIT 1', guest.id)
      : await elso(db, 'SELECT c.* FROM image_comparison c JOIN camera_image b ON b.id = c.image_b_id WHERE c.guest_id = ?1 AND c.status = \'final\' AND b.session_id = ?2 ORDER BY c.final_at DESC, c.rowid DESC LIMIT 1', guest.id, session?.id ?? '');
    if (osszeh && elonezet) v['30_napos_biztonsagos_link'] = `${konfig.publikusAlap}/public/kep/ELONEZET-TOKEN`;
    else if (osszeh) {
      try {
        const l = await linkKiad(db, { comparisonId: osszeh.id, kiadta: 'system', now: most });
        v['30_napos_biztonsagos_link'] = `${konfig.publikusAlap}/public/kep/${l.token}`;
      } catch (e) { jelzesek.push(`kep_link_nem_adhato:${e.kod || 'hiba'}`); }
    }
    if (tpl.id === 'E6') { v.szemelyes_2_3_mondat = osszeh?.note || f.ertekeles || null; v.otthoni_rutin = f.otthoni_rutin_kontroll || null; }
    if (tpl.id === 'E7') {
      v.eredeti_panasz = fElso.fo_panasz || null; v.szemelyes_2_3_mondat = osszeh?.note || f.ertekeles || null;
      v.vendeg_visszajelzes = f.vendeg_visszajelzes || null;   // a kezeloi urlap opcionalis mezoje (REQUIRES_VERIFICATION: az urlap nem koveteli meg)
    }
    if (tpl.id === 'E10') {
      Object.assign(v, { cel: f.cel || null, vendeg_visszajelzes: f.vendeg_visszajelzes || null, kezelo_vegso_ertekeles: f.zaro_ertekeles || null, egyeni_otthoni_rutin: f.otthoni_rutin || null, egyeni_fenntartas: f.fenntartasi_javaslat || null });
      const zaras = konfig.linkek?.a5Zaras?.({ guest, terv, session });
      if (zaras) v.biztonsagos_a5_zaras_link = zaras;
    }
  }
  if (tpl.id === 'A1') { const l = konfig.linkek?.ertekeles?.({ guest, booking }); if (l) v.biztonsagos_ertekeles_link = l; }   // REQUIRES_VERIFICATION: nincs forras-adat a CRM-ben
  if (tpl.id === 'E8') v.javasolt_ablak = Number.isFinite(payload.kontroll_datum) ? `${datumSz(payload.kontroll_datum)} körül` : null;
  return { ertekek: v, jelzesek };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Sablon-modositas: a link-mondatok elhagyasa, ha nincs link
// ---------------------------------------------------------------------------------------------------------------------------------
function mondatTorol(szoveg, nevek) {
  const jelek = nevek.map((n) => `{{${n}}}`);
  const mondatok = String(szoveg).match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [String(szoveg)];
  return mondatok.filter((m) => !jelek.some((j) => m.includes(j))).join('').trim();
}
/** a sablon masolata, amelybol a megadott (nem letezo) linkeket tartalmazo mondatok kimaradtak */
function linkNelkuliSablon(tpl, nevek) {
  const m = { ...tpl };
  if (typeof tpl.szoveg === 'string') m.szoveg = mondatTorol(tpl.szoveg, nevek);
  if (Array.isArray(tpl.torzs)) {
    m.torzs = tpl.torzs.map((b) => {
      if (typeof b === 'string') return b.split('\n').map((sor) => mondatTorol(sor, nevek)).filter(Boolean).join('\n');
      if (b && typeof b.szoveg === 'string') return { ...b, szoveg: mondatTorol(b.szoveg, nevek) };
      return b;
    }).filter((b) => b !== '');
  }
  return m;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Outbox -> jobok
// ---------------------------------------------------------------------------------------------------------------------------------
async function klinikusok(db) {
  return mind(db, `SELECT DISTINCT u.id FROM staff_user u JOIN staff_role r ON r.staff_id = u.id WHERE u.active = 1 AND r.role_id = 'clinical_lead' ORDER BY u.id`);
}

/** belso ertesites minden cimzettnek: egy-egy job (context_id = <alap>:<staff_id>), a cimzett a payloadban */
async function belsoJobok(db, { tplId, guestId, alapCtx, cimzettek, payload, most, katalogus }) {
  const tpl = katalogus.find((u) => u.id === tplId);
  const stat = { uj: 0, mar_volt: 0, ujraelesztve: 0, torolve: 0 };
  if (!tpl) return stat;
  if (!cimzettek.length) { stat.nincs_cimzett = 1; return stat; }
  for (const staffId of cimzettek) {
    const ctx = `${alapCtx}:${staffId}`;
    const j = { template_key: tpl.id, template_version: tpl.verzio, esedekes: most, legkorabbi_kuldes: most, context_id: ctx, idempotency_key: idempotencyKulcs(guestId, tpl.id, ctx, tpl.verzio), csatorna: tpl.csatorna, csoport: tpl.csoport };
    stat[await jobBeszur(db, { guestId, j, payload: { ...payload, staff_id: staffId }, most })] += 1;
  }
  return stat;
}

async function esemenyFeldolgoz(db, ev, { katalogus, most }) {
  const p = jsonOlvas(ev.payload, {});
  const guestId = ev.guest_id ? await vegleges(db, ev.guest_id) : null;
  const esemenyIdo = ev.created_at;
  const stat = {};
  const szuroDoc = (j) => !BELSO_ALERT_ID.includes(j.template_key);   // a DOC24 / DOC48 jobokat az alert.* esemenyek hozzak letre
  switch (ev.event_type) {
    case 'booking.confirmed': case 'booking.rescheduled': case 'booking.cancelled': case 'booking.no_show': case 'booking.completed': case 'assessment.completed': {
      if (!guestId) return { kihagyva: 'nincs_vendeg' };
      const b = await foglalas(db, p.booking_id);
      if (!b) return { kihagyva: 'nincs_foglalas' };
      const alap = { guest_key: guestId, context_id: b.id, esemeny_ido: esemenyIdo, service_type: svc(b.service_code) };
      const extra = { booking_id: b.id };
      if (ev.event_type === 'booking.confirmed') {
        return utemez(db, { esemeny: { ...alap, tipus: 'booking_confirmed', booking_start: p.start_at ?? b.start_at }, katalogus, payload: { ...extra, booking_start: p.start_at ?? b.start_at }, most });
      }
      if (ev.event_type === 'booking.rescheduled') {
        const e = { ...alap, tipus: 'booking_rescheduled', eredeti_start: p.old_start_at, uj_start: p.new_start_at };
        return utemez(db, { esemeny: e, katalogus, payload: { ...extra, booking_start: p.new_start_at }, most });
      }
      const snap = await pillanatkep(db, guestId, { most, kiveveBookingId: b.id });
      if (ev.event_type === 'booking.cancelled') {
        const r = await utemez(db, { esemeny: { ...alap, tipus: 'booking_cancelled', booking_start: b.start_at, allapot: snap }, katalogus, payload: { ...extra, booking_start: b.start_at }, most });
        // minden fuggo T-72 / T-24 ehhez a foglalashoz (barmelyik idoponttal) megszunik
        const t = await keszit(db, `UPDATE message_job SET status = 'cancelled', stop_reason = 'CANCELLED_BY_EVENT' WHERE status = 'pending' AND template_key IN ('T-72', 'T-24') AND context_id LIKE ?1`, `${b.id}:%`).run();
        r.torolve = (r.torolve || 0) + valtozas(t);
        return r;
      }
      if (ev.event_type === 'booking.no_show') return utemez(db, { esemeny: { ...alap, tipus: 'booking_no_show', booking_start: b.start_at, allapot: snap }, katalogus, payload: { ...extra, booking_start: b.start_at }, most });
      if (ev.event_type === 'assessment.completed') {
        return utemez(db, { esemeny: { ...alap, tipus: 'booking_completed', service_type: 'camera_assessment', booking_start: b.start_at, allapot: snap }, katalogus, payload: extra, most, szuro: szuroDoc });
      }
      return utemez(db, { esemeny: { ...alap, tipus: 'booking_completed', treatment_index: p.treatment_index, booking_start: b.start_at, allapot: snap }, katalogus, payload: { ...extra, treatment_index: p.treatment_index }, most, szuro: szuroDoc });
    }
    case 'plan.final': {
      const terv = await elso(db, 'SELECT * FROM treatment_plan WHERE id = ?1', p.plan_id);
      const s = terv ? await elso(db, 'SELECT * FROM treatment_session WHERE id = ?1', terv.session_id) : null;
      if (!s) return { kihagyva: 'nincs_dokumentum' };
      const g = await vegleges(db, terv.guest_id);
      const b = await foglalas(db, s.booking_id);
      const r = await utemez(db, { esemeny: { tipus: 'documentation_final', guest_key: g, context_id: b.id, esemeny_ido: esemenyIdo, treatment_index: s.treatment_index, service_type: svc(b.service_code), booking_start: b.start_at },
        katalogus, payload: { booking_id: b.id, treatment_index: s.treatment_index, plan_id: terv.id }, most, szuro: szuroDoc });
      // a tartalomra varo (blocked) jobok azonnal ujraprobalnak
      const u = await keszit(db, `UPDATE message_job SET status = 'pending', run_at = ?2, stop_reason = NULL, last_error = NULL, payload = json_set(COALESCE(payload, '{}'), '$.hiany', 0)
        WHERE guest_id = ?1 AND template_key IN ('P0', 'E2', 'E5', 'E6', 'E7', 'E10') AND status IN ('pending', 'blocked') AND context_id = ?3 AND stop_reason LIKE 'BLOCKED_MISSING_DATA%'`, g, most, b.id).run();
      r.ujraprobalva = valtozas(u);
      return r;
    }
    case 'package.purchased': {
      const pk = await csomag(db, p.purchase_id);
      if (!pk || !guestId) return { kihagyva: 'nincs_berlet' };
      return utemez(db, { esemeny: { tipus: 'package_activated', guest_key: guestId, context_id: pk.id, esemeny_ido: esemenyIdo, lejarat: pk.expires_at, allapot: await pillanatkep(db, guestId, { most }) },
        katalogus, payload: { purchase_id: pk.id, lejarat: pk.expires_at }, most });
    }
    case 'alert.doc24': case 'alert.doc48': {
      if (!guestId) return { kihagyva: 'nincs_vendeg' };
      const terv = await elso(db, 'SELECT * FROM treatment_plan WHERE id = ?1', p.plan_id);
      const s = terv ? await elso(db, 'SELECT * FROM treatment_session WHERE id = ?1', terv.session_id) : null;
      const cimzettek = ev.event_type === 'alert.doc24' ? [p.therapist_id || terv?.therapist_id || s?.therapist_id].filter(Boolean) : (await klinikusok(db)).map((x) => x.id);
      return belsoJobok(db, { tplId: ev.event_type === 'alert.doc24' ? 'DOC24' : 'DOC48', guestId, alapCtx: p.plan_id, cimzettek, katalogus, most,
        payload: { plan_id: p.plan_id, booking_id: s?.booking_id ?? null, therapist_id: p.therapist_id || terv?.therapist_id || s?.therapist_id || null, kind: p.kind } });
    }
    case 'alert.negative_survey': {
      if (!guestId) return { kihagyva: 'nincs_vendeg' };
      const sv = await elso(db, 'SELECT booking_id FROM survey_response WHERE id = ?1', p.survey_id);
      return belsoJobok(db, { tplId: 'NEG', guestId, alapCtx: p.survey_id, cimzettek: (await klinikusok(db)).map((x) => x.id), katalogus, most,
        payload: { survey_id: p.survey_id, complaint_id: p.complaint_id, score: p.score, therapist_id: p.therapist_id, booking_id: sv?.booking_id ?? null } });
    }
    case 'complaint.opened': {
      if (!guestId) return { kihagyva: 'nincs_vendeg' };
      const c = await elso(db, 'SELECT booking_id FROM complaint WHERE id = ?1', p.complaint_id);
      return belsoJobok(db, { tplId: 'COMPLAINT', guestId, alapCtx: p.complaint_id, cimzettek: [p.therapist_id].filter(Boolean), katalogus, most,
        payload: { complaint_id: p.complaint_id, therapist_id: p.therapist_id, due_at: p.due_at, booking_id: c?.booking_id ?? null } });
    }
    case 'complaint.resolved': {
      // nincs visszamenoleges potlas (jobokAzEsemenybol -> []); a marketing a friss allapot szerint folytatodik
      await utemez(db, { esemeny: { tipus: 'complaint_resolved', guest_key: guestId || 'ismeretlen', context_id: p.complaint_id, esemeny_ido: esemenyIdo }, katalogus, most });
      return { nincs_potlas: 1 };
    }
    case 'consent.withdrawn': {
      if (!guestId) return { kihagyva: 'nincs_vendeg' };
      const csat = p.channel === 'sms_marketing' ? 'sms' : p.channel === 'email_marketing' ? 'email' : null;
      if (!csat) return { kihagyva: 'nem_uzenet_csatorna' };
      const r = await keszit(db, `UPDATE message_job SET status = 'cancelled', stop_reason = 'CANCELLED_BY_EVENT:consent_withdrawn' WHERE guest_id = ?1 AND status = 'pending' AND channel = ?2
        AND json_extract(payload, '$.csoport') = 'marketing'`, guestId, csat).run();
      return { torolve: valtozas(r) };
    }
    case 'package.refunded': {
      const r = await keszit(db, `UPDATE message_job SET status = 'cancelled', stop_reason = 'CANCELLED_BY_EVENT:refunded' WHERE status = 'pending' AND template_key IN ('B30', 'B7') AND context_id LIKE ?1`, `${p.purchase_id}:%`).run();
      return { torolve: valtozas(r) };
    }
    default:
      // alert.contraindication (nincs katalogus-sablon: a kezelo a felulet riasztas-listajan latja), package.policy_violation, share.*, credit.*, plan.sent, ...
      return { nincs_sablon: 1 };
  }
}

/**
 * A pending outbox_event-ek feldolgozasa. Atomikus claim (pending -> processing); hiba eseten legfeljebb 3 probalkozas, utana 'failed'.
 * @returns {{talalt, feldolgozott, hibas, jobok:{uj, mar_volt, ujraelesztve, torolve}, reszletek: object[]}}
 */
export async function outboxFeldolgoz(db, { katalogus = KATALOG, most = maMost(), limit = 100 } = {}) {
  const ki = { talalt: 0, feldolgozott: 0, hibas: 0, kihagyott_claim: 0, jobok: { uj: 0, mar_volt: 0, ujraelesztve: 0, torolve: 0 }, reszletek: [] };
  const esemenyek = await fuggoEsemenyek(db, limit);
  ki.talalt = esemenyek.length;
  for (const ev of esemenyek) {
    if (!(await outboxClaim(db, ev.id))) { ki.kihagyott_claim += 1; continue; }   // masik worker elvitte
    try {
      const r = await esemenyFeldolgoz(db, ev, { katalogus, most });
      await tranzakcio(db, [
        keszit(db, 'UPDATE outbox_event SET status = \'processed\', processed_at = ?2 WHERE id = ?1', ev.id, most),
        auditStmt(db, { action: 'outbox.processed', resource: 'outbox_event', resourceId: ev.id, guestId: ev.guest_id, detail: { tipus: ev.event_type, ...r }, now: most }),
      ]);
      ki.feldolgozott += 1;
      for (const k of Object.keys(ki.jobok)) ki.jobok[k] += r[k] || 0;
      ki.reszletek.push({ id: ev.id, tipus: ev.event_type, ...r });
    } catch (e) {
      ki.hibas += 1;
      const probak = (await elso(db, 'SELECT attempts FROM outbox_event WHERE id = ?1', ev.id))?.attempts ?? 99;
      if (probak >= 3) await outboxHibas(db, ev.id);
      else await keszit(db, 'UPDATE outbox_event SET status = \'pending\' WHERE id = ?1 AND status = \'processing\'', ev.id).run();
      await auditStmt(db, { action: 'outbox.error', resource: 'outbox_event', resourceId: ev.id, guestId: ev.guest_id, result: 'error', detail: { tipus: ev.event_type, hiba: String(e?.message || e).slice(0, 200), probak }, now: most }).run();
      ki.reszletek.push({ id: ev.id, tipus: ev.event_type, hiba: String(e?.message || e).slice(0, 200) });
    }
  }
  return ki;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Karbantartas: riasztasok, berlet-lejarat, kontroll
// ---------------------------------------------------------------------------------------------------------------------------------
/**
 * B30 / B7 jobok a jelenlegi lejarathoz (hosszabbitas utan is: a hosszabbitas nem ir outbox esemenyt), a mar nem aktualis lejarathoz / visszateritett
 * berlethez tartozo fuggo jobok torlese. A job-letrehozas a lejarat elotti 45 napon belul indul (a tick legalabb naponta fut).
 */
async function berletLejaratJobok(db, { katalogus, most }) {
  const stat = { uj: 0, torolve: 0 };
  const t = await keszit(db, `UPDATE message_job SET status = 'cancelled', stop_reason = 'CANCELLED_BY_EVENT:expiry_changed' WHERE status = 'pending' AND template_key IN ('B30', 'B7')
    AND NOT EXISTS (SELECT 1 FROM package_purchase p WHERE p.id = json_extract(message_job.payload, '$.purchase_id') AND p.expires_at = json_extract(message_job.payload, '$.lejarat') AND p.status IN ('paid_active', 'extended_by_manager'))`).run();
  stat.torolve = valtozas(t);
  const sorok = await mind(db, 'SELECT * FROM package_purchase WHERE status IN (\'paid_active\', \'extended_by_manager\') AND expires_at > ?1 AND expires_at <= ?2', most, most + 45 * NAP);
  for (const pk of sorok) {
    const gid = await vegleges(db, pk.guest_id);
    if (!gid) continue;
    const r = await utemez(db, { esemeny: { tipus: 'package_expiry_changed', guest_key: gid, context_id: pk.id, esemeny_ido: most, lejarat: pk.expires_at, allapot: await pillanatkep(db, gid, { most }) }, katalogus, payload: { purchase_id: pk.id, lejarat: pk.expires_at }, most });
    stat.uj += r.uj + r.ujraelesztve;
  }
  return stat;
}

/** E8: a szemelyes terv szerinti kontroll elmult (a legutolso igazolt kezeles + ritmus), nincs foglalas -> control_due_passed */
async function kontrollJobok(db, { katalogus, most, konfig }) {
  const stat = { uj: 0 };
  const sorok = await mind(db, `SELECT s.id AS session_id, s.guest_id, s.course_id, s.treatment_index, s.booking_id, b.start_at FROM treatment_session s
    JOIN course c ON c.id = s.course_id JOIN booking b ON b.id = s.booking_id
    WHERE c.status = 'active' AND s.treatment_index = c.treatment_index AND s.treatment_index BETWEEN 1 AND 10`);
  for (const s of sorok) {
    const terv = await elso(db, 'SELECT fields FROM treatment_plan WHERE session_id = ?1 AND kind IN (\'plan\', \'review\') ORDER BY created_at LIMIT 1', s.session_id);
    const ritmus = Number(tervMezok(terv || {}).ritmus_nap) || KEZELES_RITMUS_NAP;
    const kontroll = s.start_at + ritmus * NAP;
    if (kontroll > most || kontroll < most - konfig.kontrollMaxKesesNap * NAP) continue;
    const gid = await vegleges(db, s.guest_id);
    const snap = await pillanatkep(db, gid, { most });
    if (snap.next_active_booking) continue;
    const r = await utemez(db, { esemeny: { tipus: 'control_due_passed', guest_key: gid, context_id: `${s.course_id}:${s.treatment_index}`, esemeny_ido: most, kontroll_datum: kontroll, allapot: snap }, katalogus,
      payload: { booking_id: s.booking_id, course_id: s.course_id, kontroll_datum: kontroll }, most });
    stat.uj += r.uj;
  }
  return stat;
}

/** elakadt 'claimed' jobok visszaallitasa, DOC24/DOC48 riasztasok, berlet-lejarat, kontroll */
export async function karbantartas(db, { most = maMost(), katalogus = KATALOG, konfig = KONFIG_ALAP } = {}) {
  konfig = konfigEgyesit(konfig);
  const vissza = await keszit(db, `UPDATE message_job SET status = 'pending', claimed_at = NULL, claimed_by = NULL, last_error = 'claim_lejart' WHERE status = 'claimed' AND claimed_at < ?1`, most - konfig.claimLejaratMp).run();
  const riasztasok = await dokumentumRiasztasok(db, { now: most });
  const berlet = await berletLejaratJobok(db, { katalogus, most });
  const kontroll = await kontrollJobok(db, { katalogus, most, konfig });
  return { visszaallitott_claim: valtozas(vissza), dokumentum_riasztasok: riasztasok.length, berlet, kontroll };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Kuldes (tick)
// ---------------------------------------------------------------------------------------------------------------------------------
const kodSzoveg = (eredmeny, ok) => `${eredmeny}:${ok}`;
/** szolgaltatoi hibauzenet a naploba: e-mail cim / telefonszam nelkul, roviditve (nincs szemelyes adat a last_error-ban) */
const hibaTisztit = (h) => String(h).replace(/[^\s@<>"']+@[^\s@<>"']+/g, '[e-mail]').replace(/\+?\d[\d\s().-]{7,}\d/g, '[szam]').slice(0, 200);

async function lezar(db, job, { status, stopReason = null, lastError = null, sentAt = null, runAt = null, attempts = null, payload, most, ledger = null, auditAction = null }) {
  const ut = [keszit(db, `UPDATE message_job SET status = ?2, stop_reason = ?3, last_error = ?4, sent_at = ?5, run_at = COALESCE(?6, run_at), attempts = COALESCE(?7, attempts), payload = ?8, claimed_at = NULL, claimed_by = NULL
    WHERE id = ?1 AND status = 'claimed'`, job.id, status, stopReason, lastError, sentAt, runAt, attempts, jsonIr(payload))];
  if (ledger) {
    ut.push(keszit(db, `INSERT INTO message_ledger (id, job_id, guest_id, template_key, channel, context_id, outcome, stop_reason, provider_id, at)
      SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10 WHERE EXISTS (SELECT 1 FROM message_job WHERE id = ?2 AND status = ?11)`,
    uuid(), job.id, job.guest_id, job.template_key, job.channel, job.context_id, ledger.outcome, ledger.stopReason ?? null, ledger.providerId ?? null, most, status));
  }
  if (auditAction) ut.push(auditStmt(db, { action: auditAction, resource: 'message_job', resourceId: job.id, guestId: job.guest_id, detail: { template: job.template_key, status, stop: stopReason }, now: most }));
  const r = await tranzakcio(db, ut);
  return valtozas(r[0]) === 1;
}

/**
 * Az uzenet osszeallitasa a friss allapotbol: szemelyes adatok (alap olvaso + opcionalis kiegeszito), link nelkuli sablon-valtozat, render.
 * elonezet = true: nem hoz letre tokent (nincs DB-iras), a token-linkek helyorzok.
 */
async function uzenetEpit(db, { job, tpl, st, most, konfig, szemelyesAdatOlvaso = null, tarolo = null, payload, elonezet = false }) {
  const olv = await alapSzemelyesAdatOlvaso(db, { tpl, guest: st.guest, booking: st.booking, session: st.session, allapot: st.allapot, most, konfig, payload, tarolo, elonezet });
  let ertekek = olv.ertekek;
  const jelzesek = olv.jelzesek;
  if (szemelyesAdatOlvaso) {
    const ext = await szemelyesAdatOlvaso(db, { tpl, job, guest: st.guest, booking: st.booking, session: st.session, allapot: st.allapot, most, konfig, payload, ertekek });
    if (ext && typeof ext === 'object') ertekek = { ...ertekek, ...(ext.ertekek || ext) };
  }
  const ertekekV = valtozokEpit({ nev: st.guest.name, booking_start: st.booking?.start_at, ...(tpl.id === 'C0' ? { regi_start: st.booking?.start_at } : {}), ...ertekek });
  let sablon = tpl;
  const linkNevek = ['allapotfelmero_link', 'kerdoiv_link'].filter((n) => (tpl.valtozok || []).includes(n) && !ertekekV[n]);
  if (linkNevek.length) sablon = linkNelkuliSablon(tpl, linkNevek);
  const leiratkozas = tpl.csoport === 'marketing' && tpl.csatorna === 'email' ? await konfig.linkek?.leiratkozas?.({ guest: st.guest, csatorna: 'email_marketing' }) : undefined;
  const r = renderel(sablon, ertekekV, { allapot: st.allapot, base: konfig.alapUrl, ...(leiratkozas ? { leiratkozas_link: leiratkozas } : {}) });
  return { r, jelzesek, ertekek: ertekekV };
}

const belsoSablon = (tpl, konfig) => {
  const s = konfig.belsoSzovegek?.[tpl.id];
  return s && tpl.szovegHianyzik ? { ...tpl, szovegHianyzik: false, targy: s.targy, torzs: s.torzs, elotag: s.elotag ?? null } : tpl;
};

/** egy claimelt job feldolgozasa. -> az eredmeny cimkeje */
async function jobFuttat(db, job, ctx) {
  const { katalogus, most, kuldo, konfig, szemelyesAdatOlvaso, tarolo } = ctx;
  const payload = jsonOlvas(job.payload, {});
  const tpl0 = katalogus.find((u) => u.id === job.template_key && u.verzio === job.template_version) || katalogus.find((u) => u.id === job.template_key);
  const vege = (status, stop, extra = {}) => lezar(db, job, { status, stopReason: stop, payload, most, auditAction: `message.${status}`, ...extra });
  if (!tpl0) { await vege('blocked', kodSzoveg(EREDMENY.HIANYZO_ADAT, 'template_missing'), { lastError: 'template_missing', ledger: { outcome: 'blocked', stopReason: kodSzoveg(EREDMENY.HIANYZO_ADAT, 'template_missing') } }); return 'blocked'; }
  const tpl = belsoSablon(tpl0, konfig);

  // elavult berlet-lejarat job (hosszabbitas / refund utan)
  if (tpl.trigger?.ref === 'lejarat') {
    const pk = payload.purchase_id ? await csomag(db, payload.purchase_id) : null;
    if (!pk || pk.expires_at !== payload.lejarat || pk.status === 'refunded') {
      const stop = kodSzoveg(EREDMENY.KIHAGY, 'expiry_changed');
      await vege('skipped', stop, { lastError: 'expiry_changed', ledger: { outcome: 'skipped', stopReason: stop } });
      return 'skipped';
    }
  }

  const esedekes = payload.esedekes ?? job.run_at;
  const maxKeses = konfig.maxKesesMp?.[tpl.id] ?? MAX_KESES_MP[tpl.id];
  if (Number.isFinite(maxKeses) && most - esedekes > maxKeses) {   // regi uzenetet nem potlunk
    const stop = kodSzoveg(EREDMENY.KIHAGY, 'overdue');
    await vege('skipped', stop, { lastError: `overdue:${most - esedekes}s`, ledger: { outcome: 'skipped', stopReason: stop } });
    return 'skipped';
  }
  const st = await vendegAllapot(db, { job, tpl, most, konfig });
  if ((tpl.gate || []).includes('booking_status_booked') && st.booking && st.booking.start_at <= most) {   // az idopont elmult: emlekezteto / visszaigazolas ertelmetlen
    const stop = kodSzoveg(EREDMENY.KIHAGY, 'appointment_passed');
    await vege('skipped', stop, { lastError: 'appointment_passed', ledger: { outcome: 'skipped', stopReason: stop } });
    return 'skipped';
  }
  const kontextus = { most, esedekes, booking_start: payload.booking_start };
  const d = kapuErtekel(tpl, st.allapot, kontextus);

  if (d.dontes === 'kesleltet') {   // kuldesi ablakon kivul: a legkozelebbi ablakra csuszik
    await lezar(db, job, { status: 'pending', stopReason: kodSzoveg(EREDMENY.ABLAK, d.ok), runAt: Math.max(d.legkorabban, most + 1), payload, most });
    return 'halasztva';
  }
  if (d.dontes === 'kihagy') {
    if (d.eredmeny === EREDMENY.HIANYZO_ADAT) return hianyzoAdat(db, job, payload, d.kodok.concat(st.tartalomHianyok || []), { most, konfig });
    // E8: ugyanazon a napon R1/R2 mar kiment -> nem veglegesen kihagyjuk, hanem a kovetkezo nyitasra csusztatjuk
    if (tpl.id === 'E8' && d.kodok.includes('same_day_R1_R2') && d.kodok.length === 1) {
      await lezar(db, job, { status: 'pending', stopReason: kodSzoveg(EREDMENY.ABLAK, 'same_day_R1_R2'), runAt: kovetkezoAblak('email', most + NAP), payload, most });
      return 'halasztva';
    }
    const stop = kodSzoveg(d.eredmeny, d.ok);
    const status = d.eredmeny === EREDMENY.SANDBOX ? 'skipped' : 'skipped';
    await vege(status, stop, { lastError: d.kodok.join(','), ledger: { outcome: 'skipped', stopReason: stop } });
    return d.eredmeny === EREDMENY.SANDBOX ? 'sandbox' : 'skipped';
  }

  // ---- mehet: szemelyes adatok + render
  let epites;
  try { epites = await uzenetEpit(db, { job, tpl, st, most, konfig, szemelyesAdatOlvaso, tarolo, payload }); } catch (e) {
    return hianyzoAdat(db, job, payload, [`adat_olvasas:${e.kod || String(e.message).slice(0, 60)}`], { most, konfig });
  }
  const { r, jelzesek } = epites;

  if (r.allapot === 'REQUIRES_VERIFICATION') {
    const stop = kodSzoveg('REQUIRES_VERIFICATION', r.figyelmeztetesek?.[0]?.kod || 'NINCS_SZOVEG');
    await vege('blocked', stop, { lastError: r.figyelmeztetesek?.[0]?.uzenet || null, ledger: { outcome: 'blocked', stopReason: stop } });
    return 'blocked';
  }
  if (r.allapot === 'BLOCKED_MISSING_DATA') return hianyzoAdat(db, job, payload, r.hianyzo.map((h) => `hianyzo:${h}`), { most, konfig });

  // ---- kuldes (DRY_RUN alapertelmezett)
  const cimzett = tpl.csatorna === 'sms' ? { telefon: st.guest.phone } : { email: tpl.csatorna === 'internal' ? st.staff.email : st.guest.email };
  const bemenet = { csatorna: tpl.csatorna, cimzett, targy: r.targy, html: r.html, szoveg: r.szoveg };
  let k;
  try { k = await kuldo.kuld(bemenet); } catch (e) { k = { allapot: 'FAILED', hiba: String(e?.message || e), vegleges: false }; }
  if (k.hiba) k.hiba = hibaTisztit(k.hiba);
  const proba = (job.attempts || 0) + 1;
  if (jelzesek.length) payload.jelzes = jelzesek;
  if (k.allapot === 'FAILED') {
    const vegleges_ = k.vegleges === true || proba >= konfig.maxProba;
    const stop = kodSzoveg('FAILED', vegleges_ ? 'dead_letter' : 'retry');
    if (vegleges_) await vege('dead', stop, { lastError: k.hiba || null, attempts: proba, ledger: { outcome: 'failed', stopReason: stop } });
    else await lezar(db, job, { status: 'pending', stopReason: stop, lastError: k.hiba || null, runAt: most + (konfig.backoffMp[Math.min(proba - 1, konfig.backoffMp.length - 1)] || 3600), attempts: proba, payload, most,
      ledger: { outcome: 'failed', stopReason: stop }, auditAction: 'message.retry' });
    return vegleges_ ? 'dead' : 'ujraprobalva';
  }
  const dry = k.allapot === 'DRY_RUN';
  await vege(dry ? 'dry_run' : 'sent', null, { sentAt: most, attempts: proba, ledger: { outcome: dry ? 'dry_run' : 'sent', providerId: k.szolgaltato_id ?? null } });
  await kuldesUtan(db, job, tpl, st, payload, { most, katalogus, dry });
  return dry ? 'dry_run' : 'sent';
}

/** BLOCKED_MISSING_DATA: ujraprobalhato (pending + keses), a limit utan veglegesen 'blocked' */
async function hianyzoAdat(db, job, payload, kodok, { most, konfig }) {
  const hiany = (payload.hiany || 0) + 1;
  const stop = kodSzoveg(EREDMENY.HIANYZO_ADAT, kodok[0] || 'hianyzo_adat');
  payload.hiany = hiany;
  if (hiany > konfig.hianyzoAdatMaxProba) {
    await lezar(db, job, { status: 'blocked', stopReason: stop, lastError: kodok.join(','), payload, most, ledger: { outcome: 'blocked', stopReason: stop }, auditAction: 'message.blocked' });
    return 'blocked';
  }
  await lezar(db, job, { status: 'pending', stopReason: stop, lastError: kodok.join(','), runAt: most + konfig.hianyzoAdatUjraMp, payload, most });
  return 'ujraprobalhato';
}

/** sikeres kuldes (vagy DRY_RUN) utani hatasok: Google-keres rogzitese, E8 -> E9 lanc, a szemelyes dokumentum "elkuldve" allapota (csak VALODI kuldes utan) */
async function kuldesUtan(db, job, tpl, st, payload, { most, katalogus, dry }) {
  if (tpl.id === 'G0' && payload.booking_id) await keszit(db, 'UPDATE review_request SET status = \'sent\', sent_at = ?2 WHERE booking_id = ?1 AND status = \'pending\'', payload.booking_id, most).run();
  if (tpl.id === 'E8') {
    await utemez(db, { esemeny: { tipus: 'message_sent', template_key: 'E8', guest_key: job.guest_id, context_id: job.context_id, esemeny_ido: most, allapot: await pillanatkep(db, job.guest_id, { most }) },
      katalogus, payload: { booking_id: payload.booking_id, course_id: payload.course_id }, most });
  }
  // a szemelyes dokumentum (A5 terv / kontroll / kurazaro) a levelezes utan 'sent'; DRY_RUN-nal NEM (a vendeg nem kapta meg)
  if (!dry && KULDI_DOKUMENTUMOT.has(tpl.id)) {
    const terv = payload.plan_id ? await elso(db, 'SELECT * FROM treatment_plan WHERE id = ?1', payload.plan_id) : await tervKeres(db, st.session?.id, DOKU_FAJTA[tpl.id]);
    if (terv && terv.status !== 'sent') {
      try { await elkuldve(db, { planId: terv.id, cimzett: st.guest.email, now: most }); } catch (e) { if (!(e instanceof CrmHiba)) throw e; }
    }
  }
}

/**
 * Egy tick: karbantartas + outbox + az esedekes jobok kuldese.
 *  - kuldo: adapter ({kuld(uzenet) -> {allapot: DRY_RUN|SENT|FAILED, szolgaltato_id}}); alap: a konfig szerint (env: kuldoKeszit), egyebkent DRY_RUN.
 *    Valodi kuldes CSAK konfig.kuldes === 'eles' eseten (az eles adapter ilyenkor is csak nem teszt_only cimzettnek kuld).
 *  - szemelyesAdatOlvaso(db, {tpl, job, guest, booking, session, allapot, most, konfig, payload, ertekek}) -> {ertekek} | ertekek: kiegesziti / felulirja az alap olvasot.
 *  - most (alias: now), env (alias-konfig: CRM_KULDES, CRM_TESZT_CIMZETTEK), konfig.tickOutbox === false: csak a jobokat kuldi (az outbox / karbantartas kulon hivando)
 * Az esedekes jobok claim-je atomikus (UPDATE ... WHERE status = 'pending'): egyetlen job sem mehet ketszer, parhuzamos tick sem.
 */
export async function tick(db, { most = null, now = null, env = null, kuldo = null, tarolo = null, konfig = null, szemelyesAdatOlvaso = null, katalogus = KATALOG } = {}) {
  most = most ?? now ?? maMost();
  const k = konfigEgyesit({ ...(env ? motorKonfigEnvbol(env) : {}), ...(konfig || {}) });
  const sajatKuldo = !kuldo && !!env;
  let adapter = kuldo || (env ? kuldoKeszit({ env, konfig: { kuldes: k.kuldes } }) : dryRunAdapter());
  if (k.kuldes !== 'eles' && adapter.nev === 'eles') adapter = adapter.tartalek || dryRunAdapter();   // eles adapter csak eles konfiggal
  const ki = { karbantartas: null, outbox: null, talalt: 0, claimelt: 0, kuldve: 0, dry_run: 0, kihagyva: 0, sandbox: 0, blokkolva: 0, ujraprobalhato: 0, halasztva: 0, ujraprobalva: 0, dead: 0, hibak: [] };
  try {
    if (k.tickOutbox !== false) {
      ki.karbantartas = await karbantartas(db, { most, katalogus, konfig: k });
      ki.outbox = await outboxFeldolgoz(db, { katalogus, most });
    }
    const esedekesek = await mind(db, 'SELECT * FROM message_job WHERE status = \'pending\' AND run_at <= ?1 ORDER BY run_at, rowid LIMIT ?2', most, k.batchMeret);
    ki.talalt = esedekesek.length;
    const munkas = `tick:${uuid().slice(0, 8)}`;
    const ctx = { katalogus, most, kuldo: adapter, konfig: k, szemelyesAdatOlvaso, tarolo };
    for (const j of esedekesek) {
      // atomikus claim: csak az kapja meg, akinek a pending -> claimed valtas sikerult
      const c = await keszit(db, 'UPDATE message_job SET status = \'claimed\', claimed_at = ?2, claimed_by = ?3 WHERE id = ?1 AND status = \'pending\' AND run_at <= ?2', j.id, most, munkas).run();
      if (valtozas(c) !== 1) continue;
      ki.claimelt += 1;
      try {
        const e = await jobFuttat(db, { ...j, status: 'claimed' }, ctx);
        const kulcs = { sent: 'kuldve', dry_run: 'dry_run', skipped: 'kihagyva', sandbox: 'sandbox', blocked: 'blokkolva', ujraprobalhato: 'ujraprobalhato', halasztva: 'halasztva', ujraprobalva: 'ujraprobalva', dead: 'dead' }[e];
        if (kulcs) ki[kulcs] += 1;
      } catch (err) {
        // varatlan hiba: a job visszakerul pending-be rovid keseleltetessel (a claim ne ragadjon be)
        ki.hibak.push({ job: j.id, hiba: String(err?.message || err).slice(0, 200) });
        await keszit(db, 'UPDATE message_job SET status = \'pending\', claimed_at = NULL, claimed_by = NULL, last_error = ?2, run_at = ?3 WHERE id = ?1 AND status = \'claimed\'', j.id, `motor_hiba:${String(err?.message || err).slice(0, 150)}`, most + 600).run();
      }
    }
  } finally {
    if (sajatKuldo && adapter.lezar) await adapter.lezar().catch(() => {});
  }
  return ki;
}

/**
 * Kezi ujrafuttatas (dead / failed / blocked): a job ujra pending, probalkozasok nullazva, azonnal feldolgozza. staffId (opcionalis): jogosultsag-ellenorzes + audit.
 * Hivasi alakok: ujrafuttat(db, jobId, opc) VAGY ujrafuttat(db, {jobId, staffId, now, env, ...}).
 * Nem engedelyezett: sent / dry_run / skipped (jogi-allapot dontes) / cancelled / claimed. Figyelem: ha a korabbi kiserlet valojaban kiment (a szolgaltato valaszolt, de a
 * naplozas elmaradt), az ujrafuttatas dupla kuldest okozhat - kezi dontes.
 */
export async function ujrafuttat(db, jobVagyOpc, opc2 = {}) {
  const opc = typeof jobVagyOpc === 'object' && jobVagyOpc !== null ? jobVagyOpc : { ...opc2, jobId: jobVagyOpc };
  const jobId = opc.jobId;
  const most = opc.most ?? opc.now ?? maMost();
  const { staffId = null, kuldo = null, tarolo = null, szemelyesAdatOlvaso = null, katalogus = KATALOG, env = null } = opc;
  if (staffId) await megkoveteli(db, staffId, 'write', 'message_template', { resourceId: jobId, now: most });
  const j = await elso(db, 'SELECT * FROM message_job WHERE id = ?1', jobId);
  if (!j) throw new CrmHiba('NINCS_JOB', 'nincs ilyen uzenet-job', 404);
  if (!['dead', 'failed', 'blocked'].includes(j.status)) throw new CrmHiba('NEM_UJRAFUTTATHATO', `a job allapota: ${j.status}`, 409);
  const p = jsonOlvas(j.payload, {}); p.hiany = 0; delete p.jelzes;
  const [r] = await tranzakcio(db, [
    keszit(db, 'UPDATE message_job SET status = \'pending\', attempts = 0, run_at = ?2, stop_reason = NULL, last_error = NULL, payload = ?3 WHERE id = ?1 AND status IN (\'dead\', \'failed\', \'blocked\')', jobId, most, jsonIr(p)),
    auditStmt(db, { staffId, action: 'message.rerun', resource: 'message_job', resourceId: jobId, guestId: j.guest_id, detail: { elozo: j.status, stop: j.stop_reason }, now: most }),
  ]);
  if (valtozas(r) !== 1) throw new CrmHiba('NEM_UJRAFUTTATHATO', 'a job kozben valtozott', 409);
  const k = konfigEgyesit({ ...(env ? motorKonfigEnvbol(env) : {}), ...(opc.konfig || {}) });
  const sajatKuldo = !kuldo && !!env;
  let adapter = kuldo || (env ? kuldoKeszit({ env, konfig: { kuldes: k.kuldes } }) : dryRunAdapter());
  if (k.kuldes !== 'eles' && adapter.nev === 'eles') adapter = adapter.tartalek || dryRunAdapter();
  try {
    const c = await keszit(db, 'UPDATE message_job SET status = \'claimed\', claimed_at = ?2, claimed_by = \'kezi\' WHERE id = ?1 AND status = \'pending\'', jobId, most).run();
    if (valtozas(c) !== 1) return { eredmeny: 'mar_foglalt' };
    const eredmeny = await jobFuttat(db, { ...j, status: 'claimed', payload: jsonIr(p), attempts: 0 }, { katalogus, most, kuldo: adapter, konfig: k, szemelyesAdatOlvaso, tarolo });
    return { eredmeny, job: await elso(db, 'SELECT * FROM message_job WHERE id = ?1', jobId) };
  } finally {
    if (sajatKuldo && adapter.lezar) await adapter.lezar().catch(() => {});
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Elonezet, sandbox-proba (API: POST /uzenetek/elonezet, POST /uzenetek/sandbox-proba) - SOHA nem valodi kuldes, nem hoz letre tokent
// ---------------------------------------------------------------------------------------------------------------------------------
const SZEMELYES_TARTALMU = new Set(['P0', 'E2', 'E5', 'E6', 'E7', 'E10', 'DOC24', 'DOC48', 'NEG', 'COMPLAINT']);

/** a vendeghez illo "pelda-kontextus" az elonezethez: foglalas / berlet / dokumentum a katalogus-sablonhoz */
async function elonezetKontextus(db, tpl, { guestId, bookingId, staffId, most }) {
  const payload = {};
  const b = bookingId ? await foglalas(db, bookingId) : await elso(db, `SELECT * FROM booking WHERE guest_id = ?1 AND duplicate_of IS NULL ORDER BY CASE WHEN status IN ('booked', 'rescheduled') AND start_at >= ?2 THEN 0 ELSE 1 END, ABS(start_at - ?2) LIMIT 1`, guestId, most);
  if (b && b.guest_id === guestId) { payload.booking_id = b.id; payload.booking_start = b.start_at; }
  else if (bookingId) throw new CrmHiba('NEM_EGYEZIK', 'a foglalas nem ennek a vendegnek a foglalasa', 400);
  if (tpl.trigger?.ref === 'lejarat') {
    const pk = await elso(db, `SELECT * FROM package_purchase WHERE guest_id = ?1 AND status IN ('paid_active', 'extended_by_manager') ORDER BY expires_at LIMIT 1`, guestId);
    if (pk) { payload.purchase_id = pk.id; payload.lejarat = pk.expires_at; }
  }
  if (tpl.csatorna === 'internal') {
    const terv = await elso(db, 'SELECT * FROM treatment_plan WHERE guest_id = ?1 ORDER BY created_at DESC LIMIT 1', guestId);
    if (terv) payload.plan_id = terv.id;
    payload.staff_id = staffId || terv?.therapist_id || null;
    payload.therapist_id = terv?.therapist_id || null;
  }
  if (tpl.id === 'E8' && b) payload.kontroll_datum = b.start_at + KEZELES_RITMUS_NAP * NAP;
  return payload;
}

/**
 * Uzenet-elonezet a vendeg AKTUALIS allapota szerint: { sablon, targy, html, szoveg, sms, allapot, hianyzo[], figyelmeztetesek[], kapu: {dontes, eredmeny, ok, kodok}, redacted }.
 * Az egeszsegi / szemelyes tartalmu sablonok (P0, E2, E5-E10, DOC*, NEG, COMPLAINT) tartalma CSAK olyan munkatarsnak jelenik meg, aki a dokumentaciot olvashatja
 * (plan.read: kezelo, szakmai vezeto); staffId nelkul vagy mas szerepkorrel `redacted: true` es a targy / torzs null.
 */
export async function elonezet(db, { templateKey, guestId, bookingId = null, staffId = null, now = null, most = null, env = null, konfig = null, katalogus = KATALOG } = {}) {
  const ido = most ?? now ?? maMost();
  const tpl0 = katalogus.find((u) => u.id === templateKey);
  if (!tpl0) throw new CrmHiba('ISMERETLEN_SABLON', `ismeretlen sablon: ${templateKey}`, 404);
  const gid = await vegleges(db, guestId);
  if (!gid) throw new CrmHiba('NINCS_VENDEG', 'nincs ilyen vendeg', 404);
  const k = konfigEgyesit({ ...(env ? motorKonfigEnvbol(env) : {}), ...(konfig || {}) });
  const tpl = belsoSablon(tpl0, k);
  const payload = await elonezetKontextus(db, tpl, { guestId: gid, bookingId, staffId, most: ido });
  const job = { id: 'elonezet', guest_id: gid, template_key: tpl.id, template_version: tpl.verzio, channel: tpl.csatorna, context_id: null, payload: jsonIr(payload), run_at: ido, attempts: 0 };
  const st = await vendegAllapot(db, { job, tpl, most: ido, konfig: k });
  if (!st.guest) throw new CrmHiba('NINCS_VENDEG', 'nincs aktiv vendeg', 404);
  const kapu = kapuErtekel(tpl, st.allapot, { most: ido, esedekes: ido, booking_start: payload.booking_start });
  const epites = await uzenetEpit(db, { job, tpl, st, most: ido, konfig: k, payload, elonezet: true });
  const szemelyes = SZEMELYES_TARTALMU.has(tpl.id);
  const sz = staffId ? await szerepekLekerdez(db, staffId) : [];
  const redacted = szemelyes && !lehet(sz, 'read', 'plan');
  const r = epites.r;
  return {
    sablon: tpl.id, csatorna: tpl.csatorna, csoport: tpl.csoport, guest_id: gid, redacted,
    allapot: r.allapot, targy: redacted ? null : r.targy, html: redacted ? null : r.html, szoveg: redacted ? null : r.szoveg, sms: redacted ? null : r.sms,
    hianyzo: r.hianyzo, figyelmeztetesek: r.figyelmeztetesek, jelzesek: epites.jelzesek,
    kapu: { dontes: kapu.dontes, eredmeny: kapu.eredmeny, ok: kapu.ok, kodok: kapu.kodok, legkorabban: kapu.legkorabban ?? null },
  };
}

/**
 * Kezi sandbox-proba: a sablon a munkatars SAJAT cimere megy DRY_RUN adapterrel (SOHA valodi kuldes, konfigtol fuggetlenul); ledger-sor (job nelkul), a vendeg-allapot kapui
 * nem akadalyozzak (a proba a kapu-dontest is visszaadja). Az egeszsegi tartalmu sablonok a plan.read joggal nem rendelkezo munkatarsnak nem probalhatok.
 */
export async function sandboxProba(db, { templateKey, guestId, staffId, now = null, most = null, env = null, konfig = null, katalogus = KATALOG } = {}) {
  const ido = most ?? now ?? maMost();
  if (!staffId) throw new CrmHiba('TILTOTT', 'sandbox-probahoz munkatars kell', 403);
  const el = await elonezet(db, { templateKey, guestId, staffId, most: ido, env, konfig, katalogus });
  if (el.redacted) throw new CrmHiba('TILTOTT', 'szemelyes tartalmu sablon sandbox-probaja csak a dokumentaciot olvasni jogosult munkatarsnak lehetseges', 403);
  if (el.allapot !== 'OK') return { eredmeny: 'NEM_KULDHETO', allapot: el.allapot, hianyzo: el.hianyzo, kapu: el.kapu };
  const staff = await elso(db, 'SELECT email FROM staff_user WHERE id = ?1 AND active = 1', staffId);
  if (!staff) throw new CrmHiba('TILTOTT', 'nincs aktiv munkatars', 403);
  const adapter = dryRunAdapter();
  const k = await adapter.kuld({ csatorna: 'internal', cimzett: { email: staff.email }, targy: `[SANDBOX] ${el.targy || templateKey}`, html: el.html, szoveg: el.szoveg });
  await tranzakcio(db, [
    keszit(db, 'INSERT INTO message_ledger (id, job_id, guest_id, template_key, channel, context_id, outcome, stop_reason, provider_id, at) VALUES (?1, NULL, ?2, ?3, ?4, NULL, \'dry_run\', \'SANDBOX_TRIAL\', ?5, ?6)', uuid(), el.guest_id, templateKey, el.csatorna, k.szolgaltato_id ?? null, ido),
    auditStmt(db, { staffId, action: 'message.sandbox_trial', resource: 'message_template', resourceId: templateKey, guestId: el.guest_id, detail: { dontes: el.kapu.dontes }, now: ido }),
  ]);
  return { eredmeny: k.allapot, valos_kuldes: false, kapu: el.kapu, targy: el.targy, cimzett: 'a belepett munkatars sajat cime' };
}

/** job-lista (API: GET /uzenetek/jobok): szuro: allapot, guestId; a ledger-sorokkal. */
export async function jobLista(db, { allapot = null, guestId = null, limit = 100 } = {}) {
  const felt = [], p = [];
  if (allapot) { p.push(allapot); felt.push(`status = ?${p.length}`); }
  if (guestId) { p.push(guestId); felt.push(`guest_id = ?${p.length}`); }
  p.push(Math.min(Number(limit) || 100, 500));
  const jobok = await mind(db, `SELECT * FROM message_job ${felt.length ? 'WHERE ' + felt.join(' AND ') : ''} ORDER BY created_at DESC, rowid DESC LIMIT ?${p.length}`, ...p);
  const ki = [];
  for (const j of jobok) ki.push({ ...j, payload: jsonOlvas(j.payload, {}), ledger: await mind(db, 'SELECT * FROM message_ledger WHERE job_id = ?1 ORDER BY at, rowid', j.id) });
  return ki;
}

/** GET /uzenetek/uzemmod */
export const uzemmod = (konfig) => ({ kuldes: konfigEgyesit(konfig).kuldes === 'eles' ? 'eles' : 'dry', csakTesztCimzettek: !!konfigEgyesit(konfig).csakTesztCimzettek });
