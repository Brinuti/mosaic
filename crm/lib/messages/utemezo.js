// Utemezo: egy domain-esemeny -> a letrehozando / torlendo uzenet-jobok. Tiszta fuggveny (nincs DB / ido-olvasas).
// A szabalyokat a katalogus trigger-mezoi adjak (katalog.js), igy egy helyen vannak.
//
//   jobokAzEsemenybol(esemeny, katalog?) -> [{ muvelet, template_key, template_version, esedekes, legkorabbi_kuldes, context_id, idempotency_key, csatorna, csoport }]
//
// esemeny:
//   tipus            'booking_confirmed' | 'booking_rescheduled' | 'booking_cancelled' | 'booking_no_show' | 'booking_completed' |
//                    'documentation_final' | 'survey_submitted' | 'complaint_created' | 'complaint_resolved' | 'control_due_passed' |
//                    'message_sent' | 'package_activated' | 'package_expiry_changed'
//   guest_key        (kotelezo)
//   context_id       foglalas UUID (booking_*, documentation_final, ...) / csomag-azonosito (package_*) / panasz-azonosito
//   esemeny_ido      epoch mp (az esemeny bekovetkezese) - a "most" alapja
//   booking_start    a foglalas idopontja (epoch mp); rescheduled: eredeti_start + uj_start
//   service_type     first_hair | followup_hair | camera_assessment | legacy_combo
//   treatment_index  1..11 (documentation_final / booking_completed)
import { MARKETING } from '../constants.js';
//   lejarat, eredeti_lejarat (package_*), kontroll_datum (control_due_passed), template_key (message_sent), pont / negativ (survey_submitted)
//   allapot          pillanatkep: { consent_email, consent_sms, email_unsubscribe, sms_optout, next_active_booking, complaint_open }
//                    A MARKETING jobok csak akkor kerulnek letrehozasra, ha az adott csatornara consent van (es nincs masik foglalas);
//                    a kuldeskori kapu (kapuk.js) ezt UJRA ellenorzi.
//
// muvelet: 'utemez' (uj job) | 'torol' (a fuggoben levo job torlese: foglalas modositasa / lemondasa / bérlet-lejarat valtozasa)
//   - reschedule: az eredeti T-72 / T-24 torlese + ujraütemezes az uj idopontra; context_id = <booking_uuid>:<idopont>
//   - cancelled: nincs emlekezteto (T-72 / T-24 torlese), C0 azonnal, C1 / C2 a szabaly szerint
//   - complaint_resolved: SEMMI (nincs visszamenoleges potlas); a kimaradt uzenetek nem torlodnak fel
//   - idempotency_key: guest_key | template_key | context_id | v<template_version>
import KATALOG from './katalog.js';
import { kovetkezoAblak, AZONNALI_KULDES } from './kapuk.js';

export function idempotencyKulcs(guestKey, templateKey, contextId, verzio) {
  return `${guestKey}|${templateKey}|${contextId}|v${verzio}`;
}

const tomb = (x) => (Array.isArray(x) ? x : [x]);

function feltetelEgyezik(f, e) {
  if (!f) return true;
  if (f.service_type && !f.service_type.includes(e.service_type)) return false;
  if (f.service_type_nem && (e.service_type === undefined || f.service_type_nem.includes(e.service_type))) return false;
  if (f.treatment_index !== undefined && e.treatment_index !== f.treatment_index) return false;
  if (f.template_key !== undefined && e.template_key !== f.template_key) return false;
  if (f.negativ === true && !(e.negativ === true || (Number.isFinite(e.pont) && e.pont <= 3))) return false;
  return true;
}

function referencia(ref, e, kezdet) {
  switch (ref) {
    case 'booking_start': return kezdet;
    case 'lejarat': return e.lejarat;
    case 'kontroll_datum': return e.kontroll_datum;
    default: return e.esemeny_ido;
  }
}

/** A foglalashoz kotott (T-72 / T-24) job context_id-je tartalmazza az idopontot: modositaskor uj kulcs keletkezik, az eredeti torolheto. */
function contextId(u, e, kezdet) {
  switch (u.trigger.ref) {
    case 'booking_start': return `${e.context_id}:${kezdet}`;
    case 'lejarat': return `${e.context_id}:${e.lejarat}`;
    case 'kontroll_datum': return `${e.context_id}:${e.kontroll_datum}`;
    default: return e.context_id;
  }
}

/** Marketing job csak consenttel, es ha az enqueue-kori pillanatkep szerint nincs masik foglalas / nyitott panasz. */
function marketingMehet(u, snap) {
  if (!MARKETING.be) return false;   // az indulaskor nincs marketing (tulajdonosi dontes)
  if (!snap) return false;
  const consent = u.csatorna === 'sms' ? snap.consent_sms === true && snap.sms_optout !== true : snap.consent_email === true && snap.email_unsubscribe !== true;
  if (!consent) return false;
  if (snap.complaint_open === true) return false;
  if (u.gate.includes('no_next_booking') && snap.next_active_booking) return false;
  if (u.gate.includes('no_first_booking') && snap.next_active_booking) {
    const nb = snap.next_active_booking;
    if (!(nb && typeof nb === 'object' && nb.service_type && nb.service_type !== 'first_hair')) return false;
  }
  return true;
}

function job(u, e, muvelet, ctx, esedekes) {
  return {
    muvelet, template_key: u.id, template_version: u.verzio, esedekes,
    legkorabbi_kuldes: esedekes === null || u.csatorna === 'internal' || AZONNALI_KULDES.has(u.id) ? esedekes : kovetkezoAblak(u.csatorna, esedekes),
    context_id: ctx, idempotency_key: idempotencyKulcs(e.guest_key, u.id, ctx, u.verzio), csatorna: u.csatorna, csoport: u.csoport,
  };
}

/**
 * @param {object} esemeny  lasd a fajl elejen
 * @param {object[]} [katalog]  alapbol a katalog.js
 */
export function jobokAzEsemenybol(esemeny, katalog = KATALOG) {
  const e = esemeny || {};
  if (!e.tipus) throw new Error('esemeny.tipus kotelezo');
  if (!e.guest_key) throw new Error('esemeny.guest_key kotelezo');
  if (e.tipus === 'complaint_resolved') return []; // nincs visszamenoleges potlas
  const ki = [];

  // --- torlesek: foglalas lemondasa / modositasa, bérlet-lejarat valtozasa
  const regiKezdet = e.tipus === 'booking_rescheduled' ? e.eredeti_start : e.booking_start;
  const regiLejarat = e.eredeti_lejarat;
  for (const u of katalog) {
    if (!(u.trigger.torli || []).includes(e.tipus)) continue;
    let ctx = null;
    if (u.trigger.ref === 'booking_start' && Number.isFinite(regiKezdet)) ctx = `${e.context_id}:${regiKezdet}`;
    if (u.trigger.ref === 'lejarat' && Number.isFinite(regiLejarat)) ctx = `${e.context_id}:${regiLejarat}`;
    if (ctx) ki.push(job(u, e, 'torol', ctx, null));
  }

  // --- utemezes. Az athelyezes = az uj idopontra ujra-utemezheto (foglalashoz kotott) sablonok; a T0 nem ismetlodik.
  const reschedule = e.tipus === 'booking_rescheduled';
  const tipus = reschedule ? 'booking_confirmed' : e.tipus;
  const kezdet = reschedule ? e.uj_start : e.booking_start;
  for (const u of katalog) {
    const t = u.trigger;
    if (!tomb(t.esemeny).includes(tipus)) continue;
    if (reschedule && t.ref !== 'booking_start') continue;
    if (!feltetelEgyezik(t.feltetel, e)) continue;
    const ref = referencia(t.ref, e, kezdet);
    if (!Number.isFinite(ref)) continue;
    const esedekes = ref + t.keses_mp;
    // a mar elmult ido-pontra (pl. a foglalas T-72 elott kevesebb mint 72 oraval jott) nem utemezunk
    if (t.keses_mp < 0 && Number.isFinite(e.esemeny_ido) && esedekes < e.esemeny_ido) continue;
    if (u.csoport === 'marketing' && !marketingMehet(u, e.allapot)) continue;
    ki.push(job(u, e, 'utemez', contextId(u, e, kezdet), esedekes));
  }
  return ki.sort((a, b) => (a.esedekes ?? -1) - (b.esedekes ?? -1) || a.template_key.localeCompare(b.template_key));
}
