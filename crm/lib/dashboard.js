// Dashboard (API.md GET /dashboard?nezet=kezelo|menedzsment): dashboard(db, {nezet, staffId, most}).
//  - 'kezelo': a belepett kezelo SAJAT vendegei / foglalasai (a szakmai vezeto, clinical_lead az osszes kezelore lat); jogosultsag: assessment.read (therapist, clinical_lead).
//    ma / holnap foglalasok, uj elso kezelesek, felmeresek, teljesitett alkalmak, keszulo A5 (24h / 48h), lejaro berletek, STOP-ok, kuldesi hibak.
//  - 'menedzsment': CSAK aggregalt szamok (darabszam), vendeg-azonosito / nev / nyers egeszsegi adat nelkul; jogosultsag: stats_aggregate.read (salon_manager, marketing, admin).
// Csak olvas (a tiltott hozzaferes auditalt: rbac.megkoveteli). Ido: epoch mp; a "nap" budapesti naptari nap.
import { CrmHiba, most as maMost, elso, mind, helyi, helyiEpoch, naptariNapHozzaad, helyiNap } from './db.js';
import { megkoveteli, szerepek } from './rbac.js';
import { DOKUMENTUM_HATARIDO, MASODPERC, BERLET_ERTESITO_NAP } from './constants.js';
import { kameraKotelezo } from './course.js';
import { szabadAlkalmak } from './package.js';

const NAP = MASODPERC.NAP;

function napHatarok(most) {
  const l = helyi(most);
  const ma = helyiEpoch(l.y, l.m, l.d, 0, 0);
  const holnap = naptariNapHozzaad(ma, 1);
  return { ma, holnap, holnapUtan: naptariNapHozzaad(ma, 2) };
}
const svc = (k) => (k === 'legacy_combo_only' ? 'legacy_combo' : k);
const szintDoc = (p, most) => {
  if (most >= p.confirmed_at + DOKUMENTUM_HATARIDO.JANKA_RIASZTAS) return 'DOC48';
  if (most >= p.confirmed_at + DOKUMENTUM_HATARIDO.KEZELO_RIASZTAS) return 'DOC24';
  return null;
};

// ---------------------------------------------------------------------------------------------------------------------------------
async function kezeloNezet(db, { staffId, most }) {
  await megkoveteli(db, staffId, 'read', 'assessment', { now: most });
  const sz = await szerepek(db, staffId);
  const osszes = sz.includes('clinical_lead');           // a szakmai vezeto az osszes kezelo vendegeit latja (szakmai riasztasok)
  const k = osszes ? null : staffId;
  const { ma, holnap, holnapUtan } = napHatarok(most);

  const foglalasok = await mind(db, `SELECT b.id, b.start_at, b.service_code, b.status, b.guest_id, b.therapist_id, g.name AS vendeg_nev, g.clinical_stop,
      (SELECT s.status FROM assessment_submission s WHERE s.booking_id = b.id ORDER BY s.issued_at DESC LIMIT 1) AS kerdoiv,
      (SELECT s.safety_flag FROM assessment_submission s WHERE s.booking_id = b.id ORDER BY s.issued_at DESC LIMIT 1) AS jelzes,
      (SELECT c.status FROM assessment_credit c WHERE c.first_booking_id = b.id LIMIT 1) AS credit,
      (SELECT COALESCE(co.treatment_index, 0) FROM course co WHERE co.guest_id = b.guest_id AND co.status IN ('not_started', 'active', 'paused_clinical') LIMIT 1) AS kura_index
    FROM booking b JOIN guest g ON g.id = b.guest_id
    WHERE b.start_at >= ?1 AND b.start_at < ?2 AND b.status IN ('booked', 'rescheduled', 'completed', 'no_show') AND b.duplicate_of IS NULL AND (?3 IS NULL OR b.therapist_id = ?3)
    ORDER BY b.start_at`, ma, holnapUtan, k);
  const sor = (b) => {
    const kovIdx = ['first_hair', 'followup_hair'].includes(b.service_code) ? (b.kura_index || 0) + 1 : null;
    return {
      bookingId: b.id, kezdet: b.start_at, szolgaltatas: svc(b.service_code), allapot: b.status === 'rescheduled' ? 'booked' : b.status,
      vendeg: { id: b.guest_id, nev: b.vendeg_nev },
      kerdoiv: b.kerdoiv || 'missing', kontraindikacio_jelzes: b.jelzes === 1 || !!b.clinical_stop,
      kezeles_sorszam: kovIdx, kamera_kotelezo: kovIdx ? kameraKotelezo(kovIdx) : false, credit_jogosult: b.credit === 'eligible',
    };
  };
  const napra = (tol, ig) => foglalasok.filter((b) => b.start_at >= tol && b.start_at < ig).map(sor);
  const mai = napra(ma, holnap), holnapi = napra(holnap, holnapUtan);
  const elsoK = (l) => l.filter((b) => b.szolgaltatas === 'first_hair' && b.allapot === 'booked');

  const teljesitett = async (tol) => (await elso(db, 'SELECT COUNT(*) AS n FROM treatment_session WHERE confirmed_at >= ?1 AND confirmed_at <= ?2 AND (?3 IS NULL OR therapist_id = ?3)', tol, most, k)).n;
  const igazolasraVar = await mind(db, `SELECT b.id, b.start_at, b.service_code FROM booking b WHERE b.status IN ('booked', 'rescheduled') AND b.start_at <= ?1 AND b.start_at >= ?2 AND b.duplicate_of IS NULL AND (?3 IS NULL OR b.therapist_id = ?3) ORDER BY b.start_at`, most, most - 3 * NAP, k);

  const a5 = await mind(db, `SELECT p.id, p.guest_id, p.kind, p.status, p.due_at, s.confirmed_at, g.name AS vendeg_nev FROM treatment_plan p JOIN treatment_session s ON s.id = p.session_id JOIN guest g ON g.id = p.guest_id
    WHERE p.status IN ('missing', 'draft') AND (?1 IS NULL OR p.therapist_id = ?1) ORDER BY p.due_at`, k);

  const berletek = await mind(db, `SELECT p.id, p.guest_id, p.package_type, p.expires_at, g.name AS vendeg_nev FROM package_purchase p JOIN guest g ON g.id = p.guest_id
    WHERE p.status IN ('paid_active', 'extended_by_manager') AND p.expires_at > ?1 AND p.expires_at <= ?2 AND (?3 IS NULL OR g.therapist_id = ?3) ORDER BY p.expires_at`, most, most + BERLET_ERTESITO_NAP.EMAIL * NAP, k);
  const lejaro = [];
  for (const p of berletek) lejaro.push({ purchaseId: p.id, vendeg: { id: p.guest_id, nev: p.vendeg_nev }, tipus: p.package_type, lejarat: p.expires_at, maradek_nap: Math.ceil((p.expires_at - most) / NAP), szabad_alkalom: await szabadAlkalmak(db, p.id, { now: most }) });

  const stopVendeg = await mind(db, `SELECT id, name, clinical_stop, clinical_stop_at FROM guest WHERE clinical_stop IS NOT NULL AND status = 'active' AND (?1 IS NULL OR therapist_id = ?1) ORDER BY clinical_stop_at`, k);
  const riasztasok = await mind(db, `SELECT a.id, a.guest_id, a.status, a.created_at, g.name AS vendeg_nev FROM contraindication_alert a JOIN guest g ON g.id = a.guest_id
    WHERE a.status IN ('open', 'acknowledged') AND (?1 IS NULL OR a.therapist_id = ?1 OR g.therapist_id = ?1) ORDER BY a.created_at`, k);
  const panaszok = await mind(db, `SELECT c.id, c.guest_id, c.due_at, c.first_contact_at, c.opened_at, g.name AS vendeg_nev FROM complaint c JOIN guest g ON g.id = c.guest_id WHERE c.status = 'open' AND (?1 IS NULL OR c.therapist_id = ?1) ORDER BY c.due_at`, k);
  const hibak = await mind(db, `SELECT j.id, j.template_key, j.channel, j.status, j.stop_reason, j.guest_id FROM message_job j JOIN guest g ON g.id = j.guest_id
    WHERE j.status IN ('dead', 'failed', 'blocked') AND (?1 IS NULL OR g.therapist_id = ?1) ORDER BY j.created_at DESC LIMIT 20`, k);

  return {
    nezet: 'kezelo', hatokor: osszes ? 'osszes' : 'sajat', staffId, most,
    ma: { datum: helyiNap(ma), foglalasok: mai }, holnap: { datum: helyiNap(holnap), foglalasok: holnapi },
    uj_elso_kezelesek: { ma: elsoK(mai), holnap: elsoK(holnapi) },
    felmeresek: { ma: mai.filter((b) => b.szolgaltatas === 'camera_assessment'), holnap: holnapi.filter((b) => b.szolgaltatas === 'camera_assessment') },
    teljesitett_alkalmak: { ma: await teljesitett(ma), het: await teljesitett(most - 7 * NAP), honap: await teljesitett(most - 30 * NAP) },
    igazolasra_var: igazolasraVar.map((b) => ({ bookingId: b.id, kezdet: b.start_at, szolgaltatas: svc(b.service_code) })),
    keszulo_a5: a5.map((p) => ({ planId: p.id, vendeg: { id: p.guest_id, nev: p.vendeg_nev }, fajta: p.kind, allapot: p.status, hatarido: p.due_at, kesett: p.due_at <= most, szint: szintDoc(p, most) })),
    lejaro_berletek: lejaro,
    stopok: {
      klinikai: stopVendeg.map((g) => ({ vendeg: { id: g.id, nev: g.name }, ok: g.clinical_stop, mikor: g.clinical_stop_at })),
      ellenjavallati_riasztasok: riasztasok.map((a) => ({ alertId: a.id, vendeg: { id: a.guest_id, nev: a.vendeg_nev }, allapot: a.status, mikor: a.created_at })),
      nyitott_panaszok: panaszok.map((c) => ({ complaintId: c.id, vendeg: { id: c.guest_id, nev: c.vendeg_nev }, hatarido: c.due_at, kesett: c.first_contact_at === null && c.due_at < most, elso_kapcsolat: c.first_contact_at })),
    },
    kuldesi_hibak: hibak.map((j) => ({ jobId: j.id, sablon: j.template_key, csatorna: j.channel, allapot: j.status, ok: j.stop_reason, guestId: j.guest_id })),
  };
}

// ---------------------------------------------------------------------------------------------------------------------------------
const db_ = async (db, sql, ...p) => (await elso(db, sql, ...p)).n;

async function menedzsmentNezet(db, { staffId, most }) {
  await megkoveteli(db, staffId, 'read', 'stats_aggregate', { now: most });
  const { ma, holnap, holnapUtan } = napHatarok(most);
  const szolgBontas = async (tol, ig) => {
    const sorok = await mind(db, `SELECT service_code AS s, COUNT(*) AS n FROM booking WHERE start_at >= ?1 AND start_at < ?2 AND status IN ('booked', 'rescheduled', 'completed', 'no_show') AND duplicate_of IS NULL GROUP BY service_code`, tol, ig);
    const m = Object.fromEntries(sorok.map((r) => [svc(r.s), r.n]));
    return { osszes: sorok.reduce((a, r) => a + r.n, 0), first_hair: m.first_hair || 0, followup_hair: m.followup_hair || 0, camera_assessment: m.camera_assessment || 0, legacy_combo: m.legacy_combo || 0 };
  };
  const teljesitett = (tol) => db_(db, 'SELECT COUNT(*) AS n FROM treatment_session WHERE confirmed_at >= ?1 AND confirmed_at <= ?2', tol, most);
  const kezelonkent = await mind(db, `SELECT COALESCE(u.name, 'ismeretlen') AS nev, COUNT(*) AS n FROM treatment_session s LEFT JOIN staff_user u ON u.id = s.therapist_id WHERE s.confirmed_at >= ?1 AND s.confirmed_at <= ?2 GROUP BY s.therapist_id ORDER BY n DESC, nev`, most - 30 * NAP, most);
  const hianyzo = await mind(db, `SELECT s.confirmed_at FROM treatment_plan p JOIN treatment_session s ON s.id = p.session_id WHERE p.status IN ('missing', 'draft')`);
  const berletek = await mind(db, `SELECT id, expires_at FROM package_purchase WHERE status IN ('paid_active', 'extended_by_manager') AND expires_at > ?1 AND expires_at <= ?2`, most, most + BERLET_ERTESITO_NAP.EMAIL * NAP);
  let szabadOsszes = 0, szabad7 = 0;
  for (const p of berletek) { const sz = await szabadAlkalmak(db, p.id, { now: most }); szabadOsszes += sz; if (p.expires_at <= most + BERLET_ERTESITO_NAP.SMS * NAP) szabad7 += sz; }
  const jobAllapot = async (st) => db_(db, 'SELECT COUNT(*) AS n FROM message_job WHERE status = ?1', st);
  const napKezd = (n) => ma - n * NAP;
  return {
    nezet: 'menedzsment', most, adat: 'aggregalt',
    foglalasok: { ma: await szolgBontas(ma, holnap), holnap: await szolgBontas(holnap, holnapUtan) },
    uj_elso_kezelesek: { ma: (await szolgBontas(ma, holnap)).first_hair, holnap: (await szolgBontas(holnap, holnapUtan)).first_hair },
    felmeresek: { ma: (await szolgBontas(ma, holnap)).camera_assessment, holnap: (await szolgBontas(holnap, holnapUtan)).camera_assessment },
    teljesitett_alkalmak: { ma: await teljesitett(ma), het: await teljesitett(napKezd(7)), honap: await teljesitett(napKezd(30)), kezelonkent_30_nap: kezelonkent.map((r) => ({ kezelo: r.nev, db: r.n })) },
    dokumentacio: { hianyzo: hianyzo.length, kesett_24h: hianyzo.filter((p) => most >= p.confirmed_at + DOKUMENTUM_HATARIDO.KEZELO_RIASZTAS).length, kesett_48h: hianyzo.filter((p) => most >= p.confirmed_at + DOKUMENTUM_HATARIDO.JANKA_RIASZTAS).length },
    lejaro_berletek: { harminc_napon_belul: berletek.length, het_napon_belul: berletek.filter((p) => p.expires_at <= most + BERLET_ERTESITO_NAP.SMS * NAP).length, szabad_alkalom_osszes: szabadOsszes, szabad_alkalom_7_napon_belul: szabad7 },
    stopok: {
      klinikai_stop_db: await db_(db, 'SELECT COUNT(*) AS n FROM guest WHERE clinical_stop IS NOT NULL AND status = \'active\''),
      nyitott_ellenjavallati_riasztas_db: await db_(db, 'SELECT COUNT(*) AS n FROM contraindication_alert WHERE status IN (\'open\', \'acknowledged\')'),
      nyitott_panasz_db: await db_(db, 'SELECT COUNT(*) AS n FROM complaint WHERE status = \'open\''),
      kesett_panasz_db: await db_(db, 'SELECT COUNT(*) AS n FROM complaint WHERE status = \'open\' AND first_contact_at IS NULL AND due_at < ?1', most),
      fuggo_kompenzacio_db: await db_(db, 'SELECT COUNT(*) AS n FROM compensation_approval WHERE status = \'pending\''),
      fuggo_osszevonas_db: await db_(db, 'SELECT COUNT(*) AS n FROM identity_merge_request WHERE status = \'pending\''),
    },
    kuldesi_hibak: { dead: await jobAllapot('dead'), failed: await jobAllapot('failed'), blocked: await jobAllapot('blocked'), fuggo: await jobAllapot('pending') },
    uzenetek_utolso_24h: {
      kikuldve: await db_(db, 'SELECT COUNT(*) AS n FROM message_ledger WHERE outcome = \'sent\' AND at > ?1 AND channel <> \'internal\'', most - NAP),
      dry_run: await db_(db, 'SELECT COUNT(*) AS n FROM message_ledger WHERE outcome = \'dry_run\' AND at > ?1 AND channel <> \'internal\'', most - NAP),
      kihagyva: await db_(db, 'SELECT COUNT(*) AS n FROM message_ledger WHERE outcome = \'skipped\' AND at > ?1', most - NAP),
    },
  };
}

/**
 * @param {object} db
 * @param {{nezet: 'kezelo'|'menedzsment', staffId: string, most?: number, now?: number}} p  (most / now ekvivalens)
 */
export async function dashboard(db, { nezet, staffId, most = null, now = null } = {}) {
  most = most ?? now ?? maMost();
  if (nezet === 'kezelo') return kezeloNezet(db, { staffId, most });
  if (nezet === 'menedzsment') return menedzsmentNezet(db, { staffId, most });
  throw new CrmHiba('ISMERETLEN_NEZET', 'nezet: kezelo | menedzsment', 400);
}
