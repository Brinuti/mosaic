// Teszt-fixture-ok a CRM modulokhoz: memoria-DB (migraciokkal), munkatarsak minden szerepkorben, vendegek, foglalas/kezeles-segedek, memoria-tarolo.
// Egy Salonic-fiok: 'mosaic-oxigen' (alap). A ketfiokos tesztekhez a masodik fiok neve 'teszt-masodik-fiok'.
import { ujAdatbazis } from '../lib/testdb.js';
import { helyiEpoch } from '../lib/db.js';
import { FIOK_ALAP, MASODPERC } from '../lib/constants.js';
import { ingestBookingEvent, igazolCompleted } from '../lib/booking.js';

export const FIOK_2 = 'teszt-masodik-fiok';
export const NAP = MASODPERC.NAP;
/** fix "most": 2026-10-12 (hetfo) 10:00 budapesti ido */
export const BASE = helyiEpoch(2026, 10, 12, 10, 0);

export const VENDEG_A = Object.freeze({ nev: 'Teszt Anna', email: 'anna.teszt@example.com', telefon: '+36 30 111 2222' });
export const VENDEG_B = Object.freeze({ nev: 'Teszt Bela', email: 'bela.teszt@example.com', telefon: '+36 20 333 4444' });

/** memoria-tarolo a tarolo-feluletre: put(kulcs, bajtok, {mime, meret}), get(kulcs) -> {bajtok, mime}|null, del(kulcs) */
export function memTarolo() {
  const m = new Map();
  return {
    m,
    async put(kulcs, bajtok, { mime, meret } = {}) { m.set(kulcs, { bajtok, mime, meret: meret ?? bajtok?.length ?? 0 }); },
    async get(kulcs) { const x = m.get(kulcs); return x ? { bajtok: x.bajtok, mime: x.mime } : null; },
    async del(kulcs) { m.delete(kulcs); },
  };
}

let szamlalo = 0;
export async function munkatars(db, nev, szerepek, { salonicNev = null } = {}) {
  const id = crypto.randomUUID();
  await db.prepare('INSERT INTO staff_user (id, email, name, salonic_name, active, created_at) VALUES (?1, ?2, ?3, ?4, 1, ?5)').bind(id, `${nev.toLowerCase().replace(/\W+/g, '.')}.${++szamlalo}@mosaic.test`, nev, salonicNev, BASE).run();
  for (const r of szerepek) await db.prepare('INSERT INTO staff_role (staff_id, role_id, granted_by, granted_at) VALUES (?1, ?2, \'fixture\', ?3)').bind(id, r, BASE).run();
  return id;
}

/** teljes teszt-kornyezet: DB, munkatarsak, tarolo, segedek */
export async function ujTeszt({ masodikFiok = false } = {}) {
  const db = await ujAdatbazis();
  if (masodikFiok) await db.prepare('INSERT INTO salonic_account (id, label, active, status, created_at) VALUES (?1, ?1, 1, \'INTEGRATION_BLOCKED\', ?2)').bind(FIOK_2, BASE).run();
  const staff = {
    terapeuta: await munkatars(db, 'Kezelo Kata', ['therapist'], { salonicNev: 'Kata' }),
    terapeuta2: await munkatars(db, 'Kezelo Zita', ['therapist'], { salonicNev: 'Zita' }),
    janka: await munkatars(db, 'Szakmai Janka', ['clinical_lead']),
    recepcio: await munkatars(db, 'Recepcios Reka', ['reception']),
    vezeto: await munkatars(db, 'Vezeto Vilma', ['salon_manager']),
    marketing: await munkatars(db, 'Marketing Mate', ['marketing']),
    admin: await munkatars(db, 'Admin Ador', ['admin']),
  };
  const t = { db, staff, fiok: FIOK_ALAP, tarolo: memTarolo(), szam: 0 };
  return t;
}

/** foglalas beerkeztetese (booked). Visszaad: ingest eredmeny + externalId */
export async function foglal(t, { service = 'first_hair', start = BASE + 7 * NAP, vendeg = VENDEG_A, externalId = null, account = null, status = 'booked', kezelo = 'Kata', eventAt = null, bookedAt = null, now = null, guestExternalId = null } = {}) {
  const ext = externalId || `fogl-${++t.szam}`;
  const r = await ingestBookingEvent(t.db, {
    account: account || t.fiok, externalId: ext, service, start, status, therapist: kezelo ? { nev: kezelo } : null,
    guest: { ...vendeg, externalId: guestExternalId }, eventAt: eventAt ?? now ?? undefined, bookedAt: bookedAt ?? undefined, now: now ?? undefined,
  });
  return { ...r, externalId: ext };
}

/** egy vendeg n kezelesenek (1..n) lefuttatasa: foglalas + kezelo-igazolas, 14 naponkent; visszaadja a booking/session sorokat */
export async function kezelesek(t, { vendeg = VENDEG_A, db = t.db, n = 1, kezdet = BASE, staffId = t.staff.terapeuta, elsoIdx = 1 } = {}) {
  const ki = [];
  for (let i = elsoIdx; i <= n; i++) {
    const start = kezdet + (i - 1) * 14 * NAP;
    const r = await foglal(t, { service: i === 1 ? 'first_hair' : 'followup_hair', start, vendeg, bookedAt: start - 3 * NAP, now: start - 3 * NAP });
    const c = await igazolCompleted(db, { bookingId: r.bookingId, staffId, now: start + 2 * 3600 });
    ki.push({ ...r, ...c });
  }
  return ki;
}

export const elso = (db, sql, ...p) => db.prepare(sql).bind(...p).first();
export const mind = async (db, sql, ...p) => (await db.prepare(sql).bind(...p).all()).results;
export async function szamol(db, tabla, feltetel = '1=1', ...p) { return (await elso(db, `SELECT COUNT(*) AS n FROM ${tabla} WHERE ${feltetel}`, ...p)).n; }

/** elvart hiba: a CrmHiba kodjat adja vissza (vagy null, ha nem dobott) */
export async function hibaKod(fn) { try { await fn(); return null; } catch (e) { return e.kod || `RAW:${e.message}`; } }
