// Mutatok (spec 3.11 / API.md GET /merok): merok(db, {tol, ig, kezeloId, most}). DEFINICIO, nem mutatoszam: kohorsz-ervenyesites, nincs becsult retencio.
//
// Minden mutato: { ertek: szam | null, szamlalo, nevezo, ok: 'ok' | 'nincs_adat' | 'kohorsz_nem_ert_meg' | ..., ... }.
//  - ertek === null + ok === 'kohorsz_nem_ert_meg': az R2/R5/R10/R11 (es az ASSESS_TO_FIRST) csak az EDDIG ERETT vendegeket szamolja (nem korai szamlalas); ha egyik sem ert meg: nincs becslés.
//  - kohorsz: az elso igazolt kezeles (SHOW1) ideje szerinti kohorsz [tol, ig]; ERES: egy vendeg az n. alkalomra akkor "ert", ha az elso kezeles + (n-1) * ritmus * szorzo mar elmult.
//  - kezeloId: az adott kezelore szukit (a kohorszoknal az 1. kezelest vegzo kezelo); a kezelo_bontas a kezelonkenti reszlet (csak ha van adat).
//  - kampany_bontas: a CRM nem tarol forras / kampany mezot a foglalason (REQUIRES_VERIFICATION: Google Ads / Meta / TikTok attribucio csak bizonyithato forrasadatbol) -> nincs bontas.
// Csak olvas. Ido: epoch mp; ig alapja a "most".
import { most as maMost, elso, mind, helyiNap } from './db.js';
import { KEZELES_RITMUS_NAP, MASODPERC, PANASZ_HATARIDO, DOKUMENTUM_HATARIDO, KURA_HOSSZ } from './constants.js';

const NAP = MASODPERC.NAP;
/** kohorsz-ervenyesites: REQUIRES_VERIFICATION - a szorzo (kesesek / kihagyott ritmus tolerancia) uzleti dontes, itt konzervativ 1.5 */
export const ERES = Object.freeze({ ritmus_nap: KEZELES_RITMUS_NAP, szorzo: 1.5 });
export const ALKALMAK = Object.freeze({ R2: 2, R5: 5, R10: 10, R11: 11 });

const arany = (szamlalo, nevezo, extra = {}) => (nevezo > 0 ? { ertek: szamlalo / nevezo, szamlalo, nevezo, ok: 'ok', ...extra } : { ertek: null, szamlalo, nevezo, ok: 'nincs_adat', ...extra });
const eresIdo = (n) => Math.ceil((n - 1) * ERES.ritmus_nap * ERES.szorzo * NAP);

/** az 1. alkalom (vendegenkent az ELSO igazolt) kohorsz: a SHOW1 */
async function kohorsz(db, { tol, ig, kezeloId }) {
  return mind(db, `SELECT s.guest_id, s.course_id, s.confirmed_at, s.therapist_id, s.booking_id FROM treatment_session s
    WHERE s.treatment_index = 1 AND s.confirmed_at BETWEEN ?1 AND ?2 AND (?3 IS NULL OR s.therapist_id = ?3)
      AND s.confirmed_at = (SELECT MIN(x.confirmed_at) FROM treatment_session x WHERE x.guest_id = s.guest_id AND x.treatment_index = 1)
    ORDER BY s.confirmed_at`, tol, ig, kezeloId);
}

async function alkalomMutato(db, tag, n, { most }) {
  const maxIdx = new Map();
  const zart = new Set();
  if (tag.length) {
    const sessionok = await mind(db, `SELECT guest_id, course_id, MAX(treatment_index) AS m FROM treatment_session WHERE confirmed_at <= ?1 AND guest_id IN (${tag.map((_, i) => `?${i + 2}`).join(', ')}) GROUP BY guest_id, course_id`, most, ...tag.map((k) => k.guest_id));
    for (const s of sessionok) maxIdx.set(`${s.guest_id}|${s.course_id}`, s.m);
    const kurak = await mind(db, `SELECT id, status FROM course WHERE id IN (${tag.map((_, i) => `?${i + 1}`).join(', ')})`, ...tag.map((k) => k.course_id));
    for (const k of kurak) if (['closed_individual', 'paused_clinical'].includes(k.status)) zart.add(k.id);
  }
  const kuszob = eresIdo(n);
  const erett = tag.filter((k) => most >= k.confirmed_at + kuszob);
  const elert = erett.filter((k) => (maxIdx.get(`${k.guest_id}|${k.course_id}`) ?? 0) >= n);
  const alap = {
    kohorsz: tag.length, ert: erett.length, nem_ert_meg: tag.length - erett.length, eres_nap: Math.ceil(kuszob / NAP),
    szakmai_zart_az_erettek_kozt: erett.filter((k) => zart.has(k.course_id)).length,   // a nevezoben marad, kulon jelolve
  };
  if (!tag.length) return { ertek: null, szamlalo: 0, nevezo: 0, ok: 'nincs_adat', ...alap };
  if (!erett.length) return { ertek: null, szamlalo: 0, nevezo: 0, ok: 'kohorsz_nem_ert_meg', ...alap };
  return arany(elert.length, erett.length, alap);
}

async function bookFirst(db, { tol, ig, kezeloId }) {
  const sorok = await mind(db, `SELECT guest_id, MIN(booked_at) AS t FROM booking WHERE service_code = 'first_hair' AND duplicate_of IS NULL AND (?1 IS NULL OR therapist_id = ?1) GROUP BY guest_id`, kezeloId);
  const n = sorok.filter((s) => s.t >= tol && s.t <= ig).length;
  return { ertek: n, ok: 'ok', megjegyzes: 'vendegenkent az elso first_hair foglalas, duplikacio nelkul (kulon: camera-only foglalo nem szamit ide)' };
}

async function showRate(db, { tol, ig, kezeloId, most }) {
  const vege = Math.min(ig, most);
  const sorok = await mind(db, `SELECT status, reschedule_count FROM booking WHERE service_code = 'first_hair' AND duplicate_of IS NULL AND start_at BETWEEN ?1 AND ?2 AND (?3 IS NULL OR therapist_id = ?3)`, tol, vege, kezeloId);
  const db_ = (f) => sorok.filter(f).length;
  const teljesitett = db_((s) => s.status === 'completed');
  const noShow = db_((s) => s.status === 'no_show');
  const igazolatlan = db_((s) => ['booked', 'rescheduled'].includes(s.status));   // az idopont elmult, de nincs kezeloi igazolas
  const lemondott = db_((s) => s.status === 'cancelled');
  const r = arany(teljesitett, teljesitett + noShow + igazolatlan, {
    nevezo_reszletek: { teljesitett, no_show: noShow, igazolatlan, lemondott_kihagyva: lemondott, athelyezett_db: sorok.filter((s) => s.reschedule_count > 0).length },
  });
  if (igazolatlan > 0) r.figyelmeztetes = 'IGAZOLATLAN_ELMULT_FOGLALASOK (kezeloi igazolas nelkul nem szamit megjelentnek)';
  return r;
}

async function nextBookedOnSite(db, { tol, ig, kezeloId }) {
  const kezelesek = await mind(db, `SELECT s.guest_id, s.booking_id, s.confirmed_at, s.treatment_index, b.start_at FROM treatment_session s JOIN booking b ON b.id = s.booking_id
    WHERE s.confirmed_at BETWEEN ?1 AND ?2 AND s.treatment_index < ?4 AND (?3 IS NULL OR s.therapist_id = ?3)`, tol, ig, kezeloId, KURA_HOSSZ);
  let helyszinen = 0;
  for (const k of kezelesek) {
    const kov = await mind(db, `SELECT booked_at, external_id FROM booking WHERE guest_id = ?1 AND id <> ?2 AND duplicate_of IS NULL AND status IN ('booked', 'rescheduled', 'completed') AND start_at > ?3 AND booked_at >= ?3 AND external_id NOT LIKE 'szint-%'`, k.guest_id, k.booking_id, k.start_at);
    // a kezelo a kezeles napjan, a kezeles kezdete utan rogzitette, elo Salonic azonositoval
    if (kov.some((b) => helyiNap(b.booked_at) === helyiNap(k.confirmed_at))) helyszinen += 1;
  }
  return arany(helyszinen, kezelesek.length, { megjegyzes: 'kezeles napjan, a kezelo altal rogzitett, elo (nem szintetikus) Salonic azonositoju kovetkezo foglalas; a 11. alkalom nem szamit' });
}

async function csomagArany(db, tag, tipus) {
  if (!tag.length) return { ertek: null, szamlalo: 0, nevezo: 0, ok: 'nincs_adat' };
  const vasarlok = await mind(db, `SELECT guest_id, MAX(early_purchase) AS elore, COUNT(*) AS db FROM package_purchase WHERE package_type = ?1 AND status <> 'refunded' AND guest_id IN (${tag.map((_, i) => `?${i + 2}`).join(', ')}) GROUP BY guest_id`, tipus, ...tag.map((k) => k.guest_id));
  const elore = vasarlok.filter((v) => v.elore === 1).length;
  return arany(vasarlok.length, tag.length, {
    elore_vasarlok: elore, kezeles_utan_vasarlok: vasarlok.length - elore, ertek_kezeles_utan: (vasarlok.length - elore) / tag.length,
    megjegyzes: 'igazolt, helyszinen rogzitett vasarlok / az elso kezelest teljesito kohorsz; az elso kezeles elott / napjan vasarolt (elore) kulon jelolve',
  });
}

async function assessToFirst(db, { tol, ig, kezeloId, most }) {
  const felmeresek = await mind(db, `SELECT b.id, b.guest_id, b.completed_at, c.window_end FROM booking b JOIN assessment_credit c ON c.camera_booking_id = b.id
    WHERE b.service_code = 'camera_assessment' AND b.status = 'completed' AND b.completed_at BETWEEN ?1 AND ?2 AND (?3 IS NULL OR b.therapist_id = ?3)`, tol, ig, kezeloId);
  const erett = felmeresek.filter((f) => most > f.window_end);
  let atment = 0, megjelent = 0;
  for (const f of erett) {
    const e = await elso(db, `SELECT COUNT(*) AS n FROM booking WHERE guest_id = ?1 AND service_code = 'first_hair' AND duplicate_of IS NULL AND status <> 'cancelled' AND booked_at BETWEEN ?2 AND ?3`, f.guest_id, f.completed_at, f.window_end);
    if (e.n > 0) {
      atment += 1;
      if ((await elso(db, 'SELECT COUNT(*) AS n FROM treatment_session WHERE guest_id = ?1 AND treatment_index = 1', f.guest_id)).n > 0) megjelent += 1;
    }
  }
  const alap = { felmeres_db: felmeresek.length, ert: erett.length, nem_ert_meg: felmeresek.length - erett.length, kesobb_megjelent_az_elso_kezelesre: megjelent };
  if (!felmeresek.length) return { ertek: null, szamlalo: 0, nevezo: 0, ok: 'nincs_adat', ...alap };
  if (!erett.length) return { ertek: null, szamlalo: 0, nevezo: 0, ok: 'kohorsz_nem_ert_meg', ...alap };
  return arany(atment, erett.length, alap);
}

async function creditRedeem(db, { tol, ig, kezeloId }) {
  const sorok = await mind(db, `SELECT c.status FROM assessment_credit c JOIN booking b ON b.id = c.camera_booking_id WHERE c.eligible_at BETWEEN ?1 AND ?2 AND (?3 IS NULL OR b.therapist_id = ?3)`, tol, ig, kezeloId);
  const felhasznalt = sorok.filter((c) => c.status === 'used').length;
  return arany(felhasznalt, sorok.length, { megjegyzes: 'kezi, egyszeri levonas / a jogosulta valt creditek (nem a jogosultsag letezese)' });
}

async function hozzajarulasArany(db, csatorna, { tol, ig, kezeloId }) {
  const sorok = await mind(db, `SELECT (SELECT action FROM consent_event c WHERE c.guest_id = g.id AND c.channel = ?1 ORDER BY c.at DESC, c.rowid DESC LIMIT 1) AS utolso
    FROM guest g WHERE g.status = 'active' AND g.created_at BETWEEN ?2 AND ?3 AND (?4 IS NULL OR g.therapist_id = ?4)`, csatorna, tol, ig, kezeloId);
  const igen = sorok.filter((s) => s.utolso === 'granted').length;
  return arany(igen, sorok.length, { visszavont: sorok.filter((s) => s.utolso === 'withdrawn').length, megjegyzes: 'jelenlegi allapot (a csatorna legutolso esemenye); marketing-hozzajarulas soha nem elofeltetel' });
}

async function uzenetKezbesites(db, { tol, ig }) {
  const sorok = await mind(db, `SELECT l.outcome, l.channel, l.template_key, j.status AS job_status FROM message_ledger l LEFT JOIN message_job j ON j.id = l.job_id
    WHERE l.at BETWEEN ?1 AND ?2 AND l.channel <> 'internal' AND l.rowid = (SELECT MAX(x.rowid) FROM message_ledger x WHERE x.job_id = l.job_id)`, tol, ig);
  const csoport = (f) => sorok.filter(f).length;
  const kikuldve = csoport((s) => s.outcome === 'sent');
  const hibas = csoport((s) => s.outcome === 'failed' && s.job_status !== 'pending');
  const dry = csoport((s) => s.outcome === 'dry_run');
  const alap = {
    kikuldve, dry_run: dry, hibas, ujraprobalas_alatt: csoport((s) => s.outcome === 'failed' && s.job_status === 'pending'),
    kihagyva: csoport((s) => s.outcome === 'skipped'), blokkolva: csoport((s) => s.outcome === 'blocked'),
    csatornankent: Object.fromEntries(['email', 'sms'].map((c) => [c, { kikuldve: csoport((s) => s.channel === c && s.outcome === 'sent'), hibas: csoport((s) => s.channel === c && s.outcome === 'failed' && s.job_status !== 'pending') }])),
  };
  if (kikuldve + hibas === 0) return { ertek: null, szamlalo: 0, nevezo: 0, ok: dry > 0 ? 'csak_dry_run' : 'nincs_adat', ...alap };
  return arany(kikuldve, kikuldve + hibas, alap);
}

async function panasz24(db, { tol, ig, kezeloId, most }) {
  const sorok = await mind(db, `SELECT opened_at, due_at, resolved_at, first_contact_at, status FROM complaint WHERE opened_at BETWEEN ?1 AND ?2 AND (?3 IS NULL OR therapist_id = ?3)`, tol, ig, kezeloId);
  const erett = sorok.filter((c) => c.status === 'resolved' || c.due_at <= most);
  const gyors = erett.filter((c) => c.resolved_at !== null && c.resolved_at <= c.opened_at + PANASZ_HATARIDO).length;
  const kontakt = erett.filter((c) => c.first_contact_at !== null && c.first_contact_at <= c.due_at).length;
  return arany(gyors, erett.length, { osszes: sorok.length, nyitott: sorok.filter((c) => c.status === 'open').length, elso_kapcsolat_24h_ertek: erett.length ? kontakt / erett.length : null });
}

async function dokumentacio24(db, { tol, ig, kezeloId, most }) {
  const sorok = await mind(db, `SELECT p.due_at, p.final_at, p.status, p.id FROM treatment_plan p WHERE p.created_at BETWEEN ?1 AND ?2 AND (?3 IS NULL OR p.therapist_id = ?3)`, tol, ig, kezeloId);
  const erett = sorok.filter((p) => p.final_at !== null || p.due_at <= most);
  const idoben = erett.filter((p) => p.final_at !== null && p.final_at <= p.due_at).length;
  const doc24 = (await elso(db, 'SELECT COUNT(*) AS n FROM outbox_event WHERE event_type = \'alert.doc24\' AND created_at BETWEEN ?1 AND ?2', tol, ig)).n;
  const doc48 = (await elso(db, 'SELECT COUNT(*) AS n FROM outbox_event WHERE event_type = \'alert.doc48\' AND created_at BETWEEN ?1 AND ?2', tol, ig)).n;
  return arany(idoben, erett.length, { osszes: sorok.length, riasztas_24h: doc24, riasztas_48h: doc48, hatarido_mp: DOKUMENTUM_HATARIDO.KEZELO_RIASZTAS });
}

async function szinkronKeses(db, { tol, ig, kezeloId }) {
  const sorok = await mind(db, `SELECT e.event_at, e.created_at FROM booking_event e JOIN booking b ON b.id = e.booking_id
    WHERE e.type IN ('booked', 'rescheduled', 'cancelled', 'no_show') AND e.created_at BETWEEN ?1 AND ?2 AND (?3 IS NULL OR b.therapist_id = ?3)`, tol, ig, kezeloId);
  const acc = await elso(db, 'SELECT last_sync_at FROM salonic_account WHERE id = \'mosaic-oxigen\'');
  const keses = sorok.map((e) => Math.max(0, e.created_at - e.event_at)).sort((a, b) => a - b);
  if (!keses.length) return { ertek: null, ok: 'nincs_adat', db: 0, utolso_szinkron: acc?.last_sync_at ?? null };
  const kvantilis = (q) => keses[Math.min(keses.length - 1, Math.ceil(q * keses.length) - 1)];
  return { ertek: keses.reduce((a, b) => a + b, 0) / keses.length, ok: 'ok', egyseg: 'mp', db: keses.length, median_mp: kvantilis(0.5), p95_mp: kvantilis(0.95), max_mp: keses[keses.length - 1], utolso_szinkron: acc?.last_sync_at ?? null };
}

async function osszevonasFuggo(db, { kezeloId, most }) {
  const sorok = await mind(db, `SELECT requested_at, involved_staff FROM identity_merge_request WHERE status = 'pending'`);
  const szurt = kezeloId ? sorok.filter((s) => String(s.involved_staff || '').includes(`"${kezeloId}"`)) : sorok;
  return { ertek: szurt.length, ok: 'ok', legregebbi_nap: szurt.length ? Math.floor((most - Math.min(...szurt.map((s) => s.requested_at))) / NAP) : null };
}

/**
 * @param {object} db
 * @param {{tol?: number, ig?: number, kezeloId?: string|null, most?: number}} [p]
 */
export async function merok(db, { tol = 0, ig = null, kezeloId = null, most = null, now = null, _bontas = true } = {}) {
  most = most ?? now ?? maMost();
  const veg = ig ?? most;
  const p = { tol, ig: veg, kezeloId: kezeloId || null, most };
  const tag = await kohorsz(db, p);
  const ki = {
    idoszak: { tol, ig: veg }, most, kezelo: p.kezeloId,
    BOOK_FIRST: await bookFirst(db, p),
    SHOW1: { ertek: tag.length, ok: 'ok', megjegyzes: 'az elso VERIFIKALT (kezelo-igazolt) kezelest teljesito egyedi vendegek (nem booked, nem no-show, nem naptari ido)' },
    SHOW_RATE: await showRate(db, p),
  };
  for (const [nev, n] of Object.entries(ALKALMAK)) ki[nev] = await alkalomMutato(db, tag, n, p);
  ki.NEXT_BOOKED_ON_SITE = await nextBookedOnSite(db, p);
  ki.PACKAGE_RATE_5 = await csomagArany(db, tag, 'package_5');
  ki.PACKAGE_RATE_10 = await csomagArany(db, tag, 'package_10');
  ki.ASSESS_TO_FIRST = await assessToFirst(db, p);
  ki.CREDIT_REDEEM = await creditRedeem(db, p);
  ki.CONSENT_EMAIL = await hozzajarulasArany(db, 'email_marketing', p);
  ki.CONSENT_SMS = await hozzajarulasArany(db, 'sms_marketing', p);
  ki.MESSAGE_DELIVERY = await uzenetKezbesites(db, p);
  ki.COMPLAINT_RESOLUTION_24H = await panasz24(db, p);
  ki.DOC_COMPLETION_24H = await dokumentacio24(db, p);
  ki.SALONIC_SYNC_LATENCY = await szinkronKeses(db, p);
  ki.MERGE_REVIEW_PENDING = await osszevonasFuggo(db, p);
  ki.kampany_bontas = { ok: 'NINCS_FORRAS_ADAT', megjegyzes: 'a foglalas nem tarol forras / kampany mezot; a Google Ads / Meta / TikTok attribucio csak hozzaferheto, bizonyithato forrasadatbol kerulhet be' };
  ki.kezelo_bontas = [];
  if (_bontas && !p.kezeloId) {
    const kezelok = await mind(db, `SELECT DISTINCT s.therapist_id AS id, u.name FROM treatment_session s LEFT JOIN staff_user u ON u.id = s.therapist_id WHERE s.confirmed_at BETWEEN ?1 AND ?2
      UNION SELECT DISTINCT c.therapist_id, u.name FROM complaint c LEFT JOIN staff_user u ON u.id = c.therapist_id WHERE c.opened_at BETWEEN ?1 AND ?2 ORDER BY 2`, tol, veg);
    for (const k of kezelok) {
      if (!k.id) continue;
      const m = await merok(db, { tol, ig: veg, kezeloId: k.id, most, _bontas: false });
      ki.kezelo_bontas.push({ kezelo_id: k.id, nev: k.name, SHOW1: m.SHOW1.ertek, SHOW_RATE: m.SHOW_RATE, R2: m.R2, R5: m.R5, R10: m.R10, R11: m.R11, NEXT_BOOKED_ON_SITE: m.NEXT_BOOKED_ON_SITE, COMPLAINT_RESOLUTION_24H: m.COMPLAINT_RESOLUTION_24H, DOC_COMPLETION_24H: m.DOC_COMPLETION_24H });
    }
  }
  return ki;
}
