// Fixture-ok az uzenetmotor tesztjeihez (nincs valodi vendeg-adat).
import KATALOG from '../lib/messages/katalog.js';
import { valtozokEpit } from '../lib/messages/valtozok.js';
import { helyiEpoch } from '../../netlify/lib/lifecycle/ido.js';

/** helyi (Europe/Budapest) idopont -> epoch mp */
export const ep = (y, m, d, h = 12, mi = 0) => helyiEpoch(y, m, d, h, mi);

/** "most": 2026-10-14 12:00 (nyari ido) */
export const MOST = ep(2026, 10, 14, 12, 0);
export const ORA = 3600;
export const NAP = 86400;

/** Fixture-vendeg: minden helyorzo kitoltve (a *_link kulcsok teszt-URL-ek). */
export function teljesErtekek(extra = {}) {
  const nevek = new Set(KATALOG.flatMap((u) => u.valtozok));
  const alap = valtozokEpit({
    keresztnev: 'Réka',
    booking_start: ep(2026, 10, 20, 16, 0),
    regi_start: ep(2026, 10, 16, 10, 30),
    lejarat: ep(2026, 11, 30, 12, 0),
    kezelo: 'Evelin',
    szolgaltatas: 'Oxygeni fejbőrkezelés',
    tipus: '10 alkalmas',
    maradek_alkalom: 3,
    guest_id: 'G-TESZT-1',
    booking_id: 'B-TESZT-1',
    ...extra,
  });
  for (const n of nevek) {
    if (n !== 'keresztnev' && alap[n] === undefined) alap[n] = /_link$/.test(n) ? `https://teszt.example/${n}` : `Teszt ${n}`;
  }
  return alap;
}

/** Teljes, "minden rendben" vendegallapot (a marketing consent MEGVAN). */
export function allapot(extra = {}) {
  return {
    guest_key: 'g-teszt-1', booking_status: 'booked', service_type: 'first_hair', course_status: 'active', package_owned: false,
    next_active_booking: null, complaint_open: false, clinical_stop: null, consent_email: true, consent_sms: true,
    email_unsubscribe: false, sms_optout: false, content_ready: true, recipient_verified: true,
    booking_start: ep(2026, 10, 20, 16, 0), assessment_credit_window_ok: true, unused_appointments: 3, dokumentacio_hianyzik: true,
    ...extra,
  };
}

/** Az adott uzenethez illo allapot (booking_status, service_type). */
export function allapotAzonosithoz(u, extra = {}) {
  const st = { 'T0-F': 'booked', 'T0-C': 'booked', 'T-72': 'booked', 'T-24': 'booked', C0: 'cancelled', C1: 'cancelled', C2: 'cancelled', N0: 'no_show' }[u.id] || 'completed';
  const svc = u.id === 'T0-C' || u.id === 'A1' || u.id === 'A2' ? 'camera_assessment' : 'first_hair';
  return allapot({ booking_status: st, service_type: svc, ...extra });
}
