// MP lemondas / modositas a Salonic automatikus leveleibol ("Foglalas lemondas - ...", "Foglalas modositva paciens altal").
// Terv: Drive MP-LEMONDAS-FELDOLGOZAS-TERV-2026-10-15 + MP-LEMONDAS-LEVELSZERKEZET-2026-10-15 (ChatGPT-vel atnezve).
// Adatminimalizalas: CSAK a tipus, a munkatars-azonosito(k), az idopont(ok), a Salonic foglalasi azonosito (modositasnal) es a
// level ideje marad meg. A vendeg neve, telefonszama, e-mailje, a szolgaltatas es a LEMONDAS OKA (egeszsegugyi adat lehet) SOHA.
// Fail-closed: ha a level nem egyertelmu, 'bizonytalan' allapotot kap, foglalast nem jelol.
import { MUNKATARSAK, nevKulcs, budapestUnix } from './igazolas.js';

const HONAP = { januar: 1, februar: 2, marcius: 3, aprilis: 4, majus: 5, junius: 6, julius: 7, augusztus: 8, szeptember: 9, oktober: 10, november: 11, december: 12 };
const ekezetNelkul = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const html2txt = (s) => String(s || '').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ');

export const LEMONDAS_SEMA = `CREATE TABLE IF NOT EXISTS mp_lemondas (azon TEXT PRIMARY KEY, tipus TEXT NOT NULL, employee_ids TEXT,
  start_unix INTEGER, uj_start_unix INTEGER, booking_id TEXT, erkezett INTEGER NOT NULL, foglalas_kulcs TEXT, allapot TEXT NOT NULL, verzio INTEGER NOT NULL, rogzitve INTEGER NOT NULL)`;
export const ELEMZO_VERZIO = 1;

// Datum: "oktober 26. (hetfo) 10:00" vagy "2026. 10. 26. 10:00" (a modositasi levelben barmelyik lehet)
const DATUM = /(?:(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?|([a-záéíóöőúüű]+)\s+(\d{1,2})\.)\s*(?:\([^)]*\)\s*)?(\d{1,2}):(\d{2})/i;

/** Egy datum-szovegreszlet -> unix (Budapest), az ev a level idejehez kepest a kovetkezo ilyen datum, ha nincs megadva. */
function datumUnix(m, erk) {
  if (!m) return null;
  let ev, ho, nap;
  if (m[1]) { ev = +m[1]; ho = +m[2]; nap = +m[3]; } else { ho = HONAP[ekezetNelkul(m[4])]; nap = +m[5]; }
  if (!ho || ho > 12 || !nap) return null;
  const erkEv = new Date(erk * 1000).getUTCFullYear();
  let t = budapestUnix(ev || erkEv, ho, nap, +m[6], +m[7]);
  if (!ev && t < erk - 180 * 86400) t = budapestUnix(erkEv + 1, ho, nap, +m[6], +m[7]);
  return t;
}

const levelIdo = (d) => {
  let e = d;
  if (typeof e === 'string' && !/^\d+$/.test(e)) e = Date.parse(e) / 1000;
  e = Number(e);
  if (e > 1e12) e = Math.floor(e / 1000);
  return Number.isFinite(e) && e > 0 ? Math.floor(e) : null;
};

/** Munkatars a "Munkatars:" cimke utan, a kovetkezo cimkeig (Nagybetus szo(k) + kettospont). */
function munkatars(t) {
  const m = t.match(/Munkatárs:\s*(.+?)\s*(?=Foglaló adatai:|Szolgáltatás:|Lemondás oka:|Név:|Mobiltelefonszám:|Tervezett kezdés:|Várható időtartam:|Új dátum:|\S*\s*dátum:|Foglalás megtekintése|$)/i);
  return m ? m[1].trim() : null;
}

/**
 * -> { ok: true, tipus: 'lemondas'|'modositas', employeeIds, startUnix, ujStartUnix, bookingId, erkezett, bizonytalan }
 *  | { ok: false, hiba }. Csak minimalis mezoket ad vissza.
 */
export function lemondasErtelmezes(be = {}) {
  const from = String(be.from || '');
  const cim = ((from.match(/<([^>]+)>\s*$/) || [])[1] || from).trim().toLowerCase();
  if (cim !== 'app@salonic.hu') return { ok: false, hiba: 'nem_salonic_felado' };
  if (!/medical\s*piercing/i.test(from)) return { ok: false, hiba: 'nem_mp_fiok' };
  const targy = String(be.subject || '');
  const tipus = /^\s*Foglalás lemondás/i.test(targy) ? 'lemondas' : /^\s*Foglalás módosítva/i.test(targy) ? 'modositas' : null;
  if (!tipus) return { ok: false, hiba: 'nem_lemondas' };
  const erk = levelIdo(be.date);
  if (!erk) return { ok: false, hiba: 'nincs_level_ido' };
  const nyers = String(be.body || '');
  const t = html2txt(nyers);
  const mt = munkatars(t);
  const employeeIds = mt ? (MUNKATARSAK[nevKulcs(mt)] || []) : [];
  if (tipus === 'lemondas') {
    const resz = t.split(/lemondta:/i)[1];
    const startUnix = resz ? datumUnix(resz.match(DATUM), erk) : null;
    return { ok: true, tipus, employeeIds, startUnix, ujStartUnix: null, bookingId: null, erkezett: erk, bizonytalan: !startUnix || !employeeIds.length };
  }
  const id = (nyers.match(/bookingId(?:%3D|=)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i) || [])[1] || null;
  const ujResz = t.split(/Új dátum:/i)[1];
  const regiResz = (t.split(/Új dátum:/i)[0].match(/dátum:\s*(.*)$/i) || [])[1];
  const startUnix = regiResz ? datumUnix(regiResz.match(DATUM), erk) : null;
  const ujStartUnix = ujResz ? datumUnix(ujResz.match(DATUM), erk) : null;
  return { ok: true, tipus, employeeIds, startUnix, ujStartUnix, bookingId: id ? id.toLowerCase() : null, erkezett: erk,
    bizonytalan: !startUnix || !ujStartUnix || !(id || employeeIds.length) };
}

const kulcsResz = (k) => { const [p, e, s] = String(k).split('|'); return { place: p, emp: e, start: Number(s) }; };

/** A lemondott / athelyezett D1-foglalas kulcsa: bookingId-vel (modositas), kulonben munkatars + kezdes perce; csak egyertelmu talalat. */
async function foglalasKeres(db, l) {
  if (l.bookingId) {
    const ig = await db.prepare('SELECT kulcs FROM mp_salonic_igazolas WHERE booking_id = ? AND kulcs IS NOT NULL').bind(l.bookingId).first();
    if (ig && ig.kulcs) return ig.kulcs;
  }
  if (!l.startUnix || !l.employeeIds.length) return null;
  const r = await db.prepare("SELECT kulcs FROM mp_foglalas WHERE kornyezet = 'eles' AND kulcs LIKE ?").bind(`%|${l.startUnix}`).all();
  const jelolt = (r.results || []).filter((s) => l.employeeIds.includes(kulcsResz(s.kulcs).emp));
  return jelolt.length === 1 ? jelolt[0].kulcs : null;
}

const sha = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s))))].map((x) => x.toString(16).padStart(2, '0')).join('');

/** Egy ertelmezett level feldolgozasa: naplo (deduplikalva) + a D1-foglalas allapota. Soha nem dob. */
export async function lemondasRogzites(db, l, most) {
  try {
    await db.prepare(LEMONDAS_SEMA).run();
    try { await db.prepare('ALTER TABLE mp_foglalas ADD COLUMN allapot TEXT').run(); } catch (e) { /* mar van */ }
    const azon = (await sha(`${l.tipus}|${l.employeeIds.join(',')}|${l.startUnix}|${l.ujStartUnix}|${l.bookingId}|${l.erkezett}`)).slice(0, 32);
    const kulcs = l.bizonytalan ? null : await foglalasKeres(db, l);
    const allapot = l.bizonytalan ? 'bizonytalan' : kulcs ? 'feldolgozva' : 'nincs_foglalas';
    const r = await db.prepare(`INSERT OR IGNORE INTO mp_lemondas (azon, tipus, employee_ids, start_unix, uj_start_unix, booking_id, erkezett, foglalas_kulcs, allapot, verzio, rogzitve)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(azon, l.tipus, l.employeeIds.join(',') || null, l.startUnix, l.ujStartUnix, l.bookingId, l.erkezett, kulcs, allapot, ELEMZO_VERZIO, most).run();
    const uj = !!(r && r.meta && r.meta.changes);
    if (uj && kulcs) {
      await db.prepare('UPDATE mp_foglalas SET allapot = ? WHERE kulcs = ?').bind(l.tipus === 'lemondas' ? 'lemondva' : 'athelyezve', kulcs).run();
    }
    return { ok: true, uj, allapot, jelolve: !!(uj && kulcs) };
  } catch (e) {
    console.error('mp-meres: lemondas hiba', String(e && e.message || e).slice(0, 120));
    return { ok: false, hiba: 'feldolgozasi_hiba' };
  }
}
