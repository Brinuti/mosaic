// Allapot-cimkek (magyar felirat + jelveny-hang) a spec 3.4 allapotgepeihez
import { jelveny } from './crm-ui.js';

const T = {
  booking: { booked: ['Foglalt', 'info'], rescheduled: ['Átfoglalt', 'figyelem'], cancelled: ['Lemondva', ''], no_show: ['Nem jelent meg', 'veszely'], completed: ['Teljesítve', 'ok'] },
  course: { not_started: ['Nem indult', ''], active: ['Aktív', 'ok'], completed_11: ['11 alkalom teljesítve', 'ok'], paused_clinical: ['Szakmai szünet', 'veszely'], closed_individual: ['Egyéni lezárás', ''] },
  package: { paid_active: ['Aktív', 'ok'], exhausted: ['Felhasználva', ''], expired: ['Lejárt', 'figyelem'], extended_by_manager: ['Hosszabbítva', 'info'], refunded: ['Visszatérítve', ''] },
  plan: { missing: ['Hiányzik', 'veszely'], draft: ['Piszkozat', 'figyelem'], therapist_final: ['Kezelő által véglegesítve', 'ok'], generated_pdf: ['PDF elkészült', 'ok'], sent: ['Elküldve', 'ok'] },
  complaint: { open: ['Nyitott', 'veszely'], resolved: ['Megoldva', 'ok'] },
  consent: { granted: ['Megadva', 'ok'], opt_in: ['Megadva', 'ok'], withdrawn: ['Visszavonva', 'veszely'], opt_out: ['Visszavonva', 'veszely'], none: ['Nincs', ''], unknown: ['Nincs adat', ''] },
  job: { pending: ['Várakozik', 'info'], sent: ['Elküldve', 'ok'], skipped: ['Kihagyva', 'figyelem'], failed: ['Hibás', 'veszely'], dead: ['Elakadt (dead-letter)', 'veszely'], sandbox: ['Sandbox', 'info'], dry: ['Dry-run', 'info'], claimed: ['Feldolgozás alatt', 'info'], dry_run: ['Dry-run (nem ment ki)', 'info'], blocked: ['Blokkolva (hiányzó adat)', 'figyelem'], cancelled: ['Törölve', ''] },
  felmero: { issued: ['Kiadva', 'figyelem'], submitted: ['Beadva', 'info'], reviewed: ['Átnézve', 'ok'], missing: ['Nincs kitöltve', 'veszely'], none: ['Nincs', ''] },
  kompenzacio: { pending: ['Jóváhagyásra vár', 'figyelem'], approved: ['Jóváhagyva', 'ok'], rejected: ['Elutasítva', 'veszely'] },
  merge: { pending: ['Jóváhagyásra vár', 'figyelem'], approved: ['Jóváhagyva', 'ok'], rejected: ['Elutasítva', ''], auto: ['Automatikus', 'info'], reverted: ['Visszafordítva', ''] },
};
export const SZEREPEK = { therapist: 'Oxygeni-kezelő', clinical_lead: 'Szakmai vezető', reception: 'Recepció', salon_manager: 'Szalonvezető', marketing: 'Marketing', admin: 'Admin' };
export const SZOLGALTATAS = { first_hair: 'Első Oxygeni kezelés', followup_hair: 'Folytató kezelés', camera_assessment: 'Hajkamerás felmérés', legacy_combo_only: 'Régi kombinált' };
export const CSATORNA = { email_marketing: 'Marketing e-mail', sms_marketing: 'Marketing SMS', image_marketing: 'Képfelhasználás (marketing)', privacy: 'Adatkezelési tájékoztató' };
export const BERLET = { package_5: '5 alkalmas bérlet', package_10: '10 alkalmas bérlet' };

export function cimke(tipus, ertek) { const e = (T[tipus] || {})[ertek]; return e ? e[0] : (ertek === undefined || ertek === null || ertek === '' ? '–' : String(ertek)); }
export function allapotJelveny(tipus, ertek) {
  const e = (T[tipus] || {})[ertek];
  return jelveny(e ? e[0] : (ertek === undefined || ertek === null || ertek === '' ? '–' : String(ertek)), e ? e[1] : '');
}
export const szolgNev = (k) => SZOLGALTATAS[k] || k || '–';
