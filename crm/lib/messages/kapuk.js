// Kuldesi kapuk: tiszta fuggvenyek (nincs I/O). A motor MINDEN job kuldese elott, a friss vendegallapottal hivja (spec 3.8).
//
//   kapuErtekel(uzenet, vendegAllapot, kontextus?) -> { dontes, eredmeny, ok, kodok, terminalis, ujraprobalhato, legkorabban? }
//
// eredmeny:  'SENT-ready' | 'SKIPPED_CONSENT_OR_STATE' | 'BLOCKED_MISSING_DATA' | 'SANDBOX_ONLY'   (+ nem vegleges: 'WINDOW_DEFERRED')
// dontes:    'mehet' (SENT-ready) | 'kihagy' (a tobbi) | 'kesleltet' (a kuldesi ablakon kivul: legkorabban = a kovetkezo ablak-nyitas)
//
// vendegAllapot mezoi (spec 3.8): guest_key, booking_status, service_type, course_status, package_owned, next_active_booking,
//   complaint_open, clinical_stop, consent_email, consent_sms, email_unsubscribe, sms_optout, content_ready, recipient_verified.
//   Opcionalis bovitesek: booking_start (epoch mp), assessment_credit_window_ok, unused_appointments, dokumentacio_hianyzik,
//   ma_kuldott (['R1', ...] a mai napon mar kikuldott sablonok), complaint_resolved_at (epoch mp), sandbox (bool).
//   `booking_status` az ADOTT job foglalasanak (context_id) allapota; `next_active_booking` a vendeg MASIK aktiv, jovobeli foglalasa (null = nincs).
//
// kontextus: { most (epoch mp), esedekes (epoch mp, a job tervezett ideje), booking_start (a job-hoz tartozo, utemezeskori idopont) }
import { helyi, helyiEpoch } from '../../../netlify/lib/lifecycle/ido.js';

export const EREDMENY = Object.freeze({
  KULDHETO: 'SENT-ready',
  KIHAGY: 'SKIPPED_CONSENT_OR_STATE',
  HIANYZO_ADAT: 'BLOCKED_MISSING_DATA',
  SANDBOX: 'SANDBOX_ONLY',
  ABLAK: 'WINDOW_DEFERRED',
});

/** Kuldesi ablakok (Europe/Budapest, helyi ora; a tort ora 20.5 = 20:30). */
export const ABLAKOK = Object.freeze({
  sms: Object.freeze({ tol: 8, ig: 20.5 }),
  email: Object.freeze({ tol: 7, ig: 21 }),
});

/** Az azonnali (tranzakcios) uzenetek: a kuldesi ablak nem vonatkozik rájuk. */
export const AZONNALI_KULDES = Object.freeze(new Set(['T0-F', 'T0-C', 'C0']));

/** Az ablak szerinti legkorabbi kuldesi ido: ablakban = valtozatlan; elotte = aznap nyitaskor; utana = masnap nyitaskor. */
export function kovetkezoAblak(csatorna, epoch) {
  const a = ABLAKOK[csatorna];
  if (!a || !Number.isFinite(epoch)) return epoch;
  const l = helyi(epoch);
  const ora = l.h + l.mi / 60;
  const nyit = (nap) => helyiEpoch(nap.y, nap.m, nap.d, Math.floor(a.tol), Math.round((a.tol % 1) * 60));
  if (ora >= a.tol && ora <= a.ig) return epoch;
  if (ora < a.tol) return nyit(l);
  return nyit(helyi(epoch + 86400));
}

/** Ablakban van-e a megadott pillanat az adott csatornan. */
export function ablakban(csatorna, epoch) {
  return kovetkezoAblak(csatorna, epoch) === epoch;
}

// ---------------------------------------------------------------- allapot-segedek
const definialt = (v) => v !== undefined;
const igaz = (v) => v === true;
const clinicalStopAktiv = (a) => !!a.clinical_stop || a.course_status === 'paused_clinical';
const kurzusLezarva = (a) => a.course_status === 'completed_11' || a.course_status === 'closed_individual';
const nincsKovetkezo = (a) => a.next_active_booking === null || a.next_active_booking === false;
const emailMarketing = (a) => igaz(a.consent_email) && !igaz(a.email_unsubscribe);
const smsMarketing = (a) => igaz(a.consent_sms) && !igaz(a.sms_optout);

/**
 * Nevesitett allapot-feltetelek a torzs-blokkokhoz ({ feltetel: 'nev', szoveg }). Ismeretlen / hianyzo allapot = false (biztonsagos).
 */
export const FELTETELEK = Object.freeze({
  marketing_email: (a) => emailMarketing(a),
  marketing_sms: (a) => smsMarketing(a),
  booking_cta_ok: (a) => emailMarketing(a) && nincsKovetkezo(a) && a.complaint_open === false
    && definialt(a.clinical_stop) && !clinicalStopAktiv(a) && !kurzusLezarva(a),
});

// ---------------------------------------------------------------- kapuk
// Minden kapu: (allapot, uzenet, kontextus) -> null (rendben) | { tipus: 'kihagy' | 'hianyzik', kod }
const kihagy = (kod) => ({ tipus: 'kihagy', kod });
const hianyzik = (kod) => ({ tipus: 'hianyzik', kod });

function bookingStatus(elvart, kod) {
  return (a) => {
    if (!definialt(a.booking_status)) return hianyzik('booking_status_missing');
    return a.booking_status === elvart ? null : kihagy(kod);
  };
}
function serviceType(elvart, kod) {
  return (a) => {
    if (!definialt(a.service_type)) return hianyzik('service_type_missing');
    return a.service_type === elvart ? null : kihagy(kod);
  };
}
function nincsFoglalas(a) {
  if (!definialt(a.next_active_booking)) return hianyzik('next_active_booking_missing');
  return nincsKovetkezo(a) ? null : kihagy('next_active_booking');
}

export const KAPUK = Object.freeze({
  booking_status_booked: bookingStatus('booked', 'booking_not_booked'),
  booking_status_cancelled: bookingStatus('cancelled', 'booking_not_cancelled'),
  booking_status_no_show: bookingStatus('no_show', 'booking_not_no_show'),
  booking_status_completed: bookingStatus('completed', 'booking_not_completed'),
  booking_start_current: (a, u, k) => {
    // a job az utemezeskori idopontra szol; ha a foglalas azota elmozdult, a job elavult (modositasnal uj T-72/T-24 keszul)
    if (!definialt(a.booking_start)) return hianyzik('booking_start_missing');
    if (k && Number.isFinite(k.booking_start) && a.booking_start !== k.booking_start) return kihagy('booking_start_changed');
    return null;
  },
  service_type_first_hair: serviceType('first_hair', 'wrong_service_type'),
  service_type_camera_assessment: serviceType('camera_assessment', 'wrong_service_type'),
  marketing_consent_email: (a) => {
    if (!igaz(a.consent_email)) return kihagy('no_marketing_consent_email');
    if (igaz(a.email_unsubscribe)) return kihagy('email_unsubscribe');
    return null;
  },
  marketing_consent_sms: (a) => {
    if (!igaz(a.consent_sms)) return kihagy('no_marketing_consent_sms');
    if (igaz(a.sms_optout)) return kihagy('sms_optout');
    return null;
  },
  no_next_booking: nincsFoglalas,
  no_first_booking: (a) => {
    if (!definialt(a.next_active_booking)) return hianyzik('next_active_booking_missing');
    if (nincsKovetkezo(a)) return null;
    const nb = a.next_active_booking;
    // objektum: csak az elso kezeles foglalasa szamit; egyeb (true / service_type nelkuli) esetben konzervativan: van foglalas
    if (nb && typeof nb === 'object' && nb.service_type && nb.service_type !== 'first_hair') return null;
    return kihagy('first_booking_exists');
  },
  no_open_complaint: (a) => (!definialt(a.complaint_open) ? hianyzik('complaint_open_missing') : a.complaint_open ? kihagy('complaint_open') : null),
  no_clinical_stop: (a) => {
    if (!definialt(a.clinical_stop)) return hianyzik('clinical_stop_missing');
    return clinicalStopAktiv(a) ? kihagy('clinical_stop') : null;
  },
  course_not_closed: (a) => (kurzusLezarva(a) ? kihagy('course_closed') : null),
  content_ready: (a) => (igaz(a.content_ready) ? null : hianyzik('content_not_ready')),
  recipient_verified: (a) => (igaz(a.recipient_verified) ? null : hianyzik('recipient_not_verified')),
  credit_window_valid: (a) => {
    if (!definialt(a.assessment_credit_window_ok)) return hianyzik('credit_window_unknown');
    return a.assessment_credit_window_ok ? null : kihagy('credit_window_expired');
  },
  package_has_unused: (a) => {
    if (!definialt(a.unused_appointments)) return hianyzik('unused_appointments_missing');
    return Number(a.unused_appointments) > 0 ? null : kihagy('no_unused_appointments');
  },
  doc_missing: (a) => {
    if (!definialt(a.dokumentacio_hianyzik)) return hianyzik('documentation_state_missing');
    return a.dokumentacio_hianyzik ? null : kihagy('documentation_complete');
  },
  no_same_day_rebook: (a) => {
    const ma = Array.isArray(a.ma_kuldott) ? a.ma_kuldott : [];
    return ma.some((k) => k === 'R1' || k === 'R2') ? kihagy('same_day_R1_R2') : null;
  },
});

export const ISMERT_GATEK = Object.freeze(Object.keys(KAPUK));

const lezart = (eredmeny, ok, kodok) => ({
  dontes: 'kihagy', eredmeny, ok, kodok, terminalis: eredmeny !== EREDMENY.HIANYZO_ADAT, ujraprobalhato: eredmeny === EREDMENY.HIANYZO_ADAT,
});

/**
 * A kuldes elotti kapu-ertekeles.
 * Sorrend: sandbox -> csoport-szintu hard szabalyok (marketing consent, nyitott panasz) -> katalogus-kapuk -> kuldesi ablak.
 * A SKIPPED (jogi / allapot) mindig elsobbseget elvez a BLOCKED (hianyzo adat) elott: consent nelkuli marketing SOHA nem "varakozik adatra".
 */
export function kapuErtekel(uzenet, vendegAllapot, kontextus = {}) {
  const a = vendegAllapot || {};
  const kod = { kihagy: [], hianyzik: [] };

  // 1. harmadik fel belso QA adata: soha nem megy valodi cimzettnek
  if (a.sandbox === true) return lezart(EREDMENY.SANDBOX, 'sandbox_data', ['sandbox_data']);

  // 2. hard szabalyok, a katalogus gate-listajatol fuggetlenul (vedelem a rosszul szerkesztett katalogus ellen)
  if (uzenet.csoport === 'marketing') {
    const ujcsatorna = uzenet.csatorna === 'sms' ? KAPUK.marketing_consent_sms : KAPUK.marketing_consent_email;
    const r = ujcsatorna(a);
    if (r) kod.kihagy.push(r.kod);
    if (a.complaint_open === true) kod.kihagy.push('complaint_open'); // nyitott panasz alatt sales / rebook STOP (tranzakcios marad)
    // panasz lezarasa utan nincs visszamenoleges potlas: a panasz lezarasa elott esedekes marketing job nem megy ki
    if (Number.isFinite(a.complaint_resolved_at) && Number.isFinite(kontextus.esedekes) && kontextus.esedekes <= a.complaint_resolved_at) {
      kod.kihagy.push('no_retroactive_backfill');
    }
  }

  // 3. katalogus-kapuk
  for (const nev of uzenet.gate || []) {
    const kapu = KAPUK[nev];
    if (!kapu) throw new Error(`ismeretlen kapu: ${nev} (${uzenet.id})`);
    const r = kapu(a, uzenet, kontextus);
    if (r) kod[r.tipus].push(r.kod);
  }
  const egyedi = (t) => [...new Set(t)];
  if (kod.kihagy.length) return lezart(EREDMENY.KIHAGY, egyedi(kod.kihagy)[0], egyedi([...kod.kihagy, ...kod.hianyzik]));
  if (kod.hianyzik.length) return lezart(EREDMENY.HIANYZO_ADAT, egyedi(kod.hianyzik)[0], egyedi(kod.hianyzik));

  // 4. kuldesi ablak (csak e-mail / SMS; a tranzakcios T0 / C0 azonnali)
  if (Number.isFinite(kontextus.most) && !AZONNALI_KULDES.has(uzenet.id) && ABLAKOK[uzenet.csatorna]) {
    const mikor = kovetkezoAblak(uzenet.csatorna, kontextus.most);
    if (mikor !== kontextus.most) {
      return { dontes: 'kesleltet', eredmeny: EREDMENY.ABLAK, ok: 'outside_send_window', kodok: ['outside_send_window'], terminalis: false, ujraprobalhato: true, legkorabban: mikor };
    }
  }
  return { dontes: 'mehet', eredmeny: EREDMENY.KULDHETO, ok: 'ok', kodok: [], terminalis: false, ujraprobalhato: false };
}
