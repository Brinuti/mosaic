// Szerepkor -> jogosultsag-matrix (MASTERPROMPT 3.10). A backend MINDEN muveletnel ezt hivja; a bongeszo nem donthet.
//   therapist: minden Oxygeni-vendeg kezelesi dokumentacioja (kezelo-valtas engedelyezett), egyeni belepessel
//   clinical_lead (Janka): szakmai riasztasok, kerdoiv-jovahagyas; NEM o intezi a panaszt
//   reception: minimalis kereskedelmi adat (idopont, berlet, ajandek, credit) - kep es kerdoiv NEM
//   salon_manager: penzugyi jovahagyas (hosszabbitas, refund, kompenzacio)
//   marketing: csak aggregalt statisztika;  admin: hozzaferes, beallitasok, audit-export (klinikai adat NEM)
import { CrmHiba, mind, elso } from './db.js';
import { naplo } from './audit.js';
import { SZEREPKOROK } from './constants.js';

const TERAPEUTA = {
  guest_basic: ['read', 'write'], booking: ['read', 'confirm'], course: ['read', 'write'], package: ['read'], credit: ['read', 'mark'],
  assessment: ['read', 'review'], contraindication_alert: ['read', 'resolve'], camera_image: ['read', 'write'], image_comparison: ['read', 'write'],
  share_grant: ['read', 'write', 'revoke'], plan: ['read', 'write'], treatment_note: ['read', 'write'], consent: ['read'],
  complaint: ['read', 'write'], compensation: ['read', 'request'], merge: ['read', 'approve'], message: ['read'],
};

export const MATRIX = Object.freeze({
  therapist: TERAPEUTA,
  clinical_lead: {
    ...TERAPEUTA,
    complaint: ['read'],                       // Janka tud a panaszrol, de NEM o intezi (nincs write)
    compensation: ['read'],
    assessment_version: ['read', 'write', 'approve'],
    share_grant: ['read', 'write', 'revoke'],
    plan: ['read', 'write', 'approve'],
  },
  reception: {
    guest_basic: ['read', 'write'], booking: ['read'], course: ['read'], package: ['read', 'write'], gift: ['read', 'write'],
    credit: ['read', 'mark'], consent: ['read', 'write'], message: ['read'],
    // NINCS: assessment, camera_image, image_comparison, plan, treatment_note, complaint, contraindication_alert
  },
  salon_manager: {
    guest_basic: ['read'], booking: ['read'], course: ['read'], package: ['read', 'approve'], gift: ['read'], credit: ['read'],
    complaint: ['read', 'reassign'], compensation: ['read', 'approve'], stats_aggregate: ['read'], audit: ['read'], settings: ['read', 'write'], merge: ['read'],
  },
  marketing: { stats_aggregate: ['read'], message_template: ['read', 'write'] },
  admin: {
    staff_admin: ['read', 'write'], settings: ['read', 'write'], audit: ['read', 'export'], export: ['export'], retention: ['read', 'write', 'execute'],
    message_template: ['read', 'write'], stats_aggregate: ['read'], guest_basic: ['read'], message: ['read'],
  },
});

const egyListaba = (szerep) => (Array.isArray(szerep) ? szerep : [szerep]).filter((x) => SZEREPKOROK.includes(x));

/** lehet(szerep | [szerepek], muvelet, eroforras) -> boolean (tiszta fuggveny, nincs DB) */
export function lehet(szerep, muvelet, eroforras) {
  return egyListaba(szerep).some((r) => (MATRIX[r]?.[eroforras] || []).includes(muvelet));
}

/** az aktiv munkatars szerepkorei (inaktiv / ismeretlen: ures lista) */
export async function szerepek(db, staffId) {
  if (!staffId) return [];
  const sorok = await mind(db,
    'SELECT sr.role_id FROM staff_role sr JOIN staff_user u ON u.id = sr.staff_id WHERE sr.staff_id = ?1 AND u.active = 1', staffId);
  return sorok.map((r) => r.role_id);
}

/** igaz, ha a munkatars barmelyik szerepkore megteheti. Elutasitas NEM naplozodik (lasd megkoveteli). */
export async function szabad(db, staffId, muvelet, eroforras) { return lehet(await szerepek(db, staffId), muvelet, eroforras); }

/** kotelezo ellenorzes: elutasitasnal security_audit 'denied' sor + CrmHiba('TILTOTT', 403). Siker: a szerepkorok listaja. */
export async function megkoveteli(db, staffId, muvelet, eroforras, { guestId = null, resourceId = null, ipHash = null, now } = {}) {
  const sz = await szerepek(db, staffId);
  if (lehet(sz, muvelet, eroforras)) return sz;
  await naplo(db, { staffId, action: `${eroforras}.${muvelet}`, resource: eroforras, resourceId, guestId, result: 'denied', detail: { szerepek: sz }, ipHash, now });
  throw new CrmHiba('TILTOTT', `nincs jogosultsag: ${eroforras}.${muvelet}`, 403);
}

/** a munkatars letezik es aktiv? */
export async function aktivMunkatars(db, staffId) {
  return !!(await elso(db, 'SELECT 1 AS x FROM staff_user WHERE id = ?1 AND active = 1', staffId));
}
