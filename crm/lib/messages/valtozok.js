// Helyorzo-feloldo: {{nev}} -> ertek. Tiszta fuggvenyek, nincs I/O.
// Ujrahasznalja a lifecycle ido- es nev-kezeleset (netlify/lib/lifecycle/ido.js, nevek.js); azokat NEM modositja.
import { helyi, datumSzoveg, datumRagos, idopontSzoveg } from '../../../netlify/lib/lifecycle/ido.js';
import { keresztnev as keresztnevKinyer } from '../../../netlify/lib/lifecycle/nevek.js';

export const TZ = 'Europe/Budapest';
export const NBSP = ' ';

export const BLOCKED_MISSING_DATA = 'BLOCKED_MISSING_DATA';

/** Opcionalis helyorzok: ha nincs ertek, nem hiba. A keresztnev hianyaban a megszolitas "Szia!" lesz (rossz nevet nem mondunk). */
export const ALAPERTELMEZETT_OPCIONALIS = new Set(['keresztnev']);

const HELYORZO_RE = /\{\{\s*([a-z0-9_]+)\s*\}\}/g;

/** A szovegben szereplo helyorzok nevei (sorrendben, ismetlodes nelkul). */
export function helyorzokKigyujt(szoveg) {
  const ki = [];
  for (const m of String(szoveg ?? '').matchAll(HELYORZO_RE)) if (!ki.includes(m[1])) ki.push(m[1]);
  return ki;
}

const ures = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

/**
 * Egy szoveg kitoltese.
 * @param {string} szoveg  sablon {{nev}} helyorzokkal
 * @param {Record<string, string|number|null>} ertekek
 * @param {{opcionalis?: Iterable<string>}} [opc]
 * @returns {{szoveg: string, hianyzo: string[]}}  hianyzo: a hianyzo KOTELEZO helyorzok (ha nem ures: a szoveg nem kuldheto)
 */
export function feloldas(szoveg, ertekek, opc = {}) {
  const opcionalis = new Set([...(opc.opcionalis || []), ...ALAPERTELMEZETT_OPCIONALIS]);
  const hianyzo = [];
  let s = String(szoveg ?? '');
  // "Szia {{keresztnev}}!" -> "Szia!" (a hianyzo opcionalis nev elotti szokozzel egyutt esik ki)
  s = s.replace(/\s*\{\{\s*keresztnev\s*\}\}/g, (m) => (ures(ertekek.keresztnev) ? '' : m));
  s = s.replace(HELYORZO_RE, (m, nev) => {
    const v = ertekek[nev];
    if (ures(v)) {
      if (!opcionalis.has(nev) && !hianyzo.includes(nev)) hianyzo.push(nev);
      return '';
    }
    return String(v).replace(/\{\{|\}\}/g, ''); // az ertek nem hozhat letre uj helyorzot
  });
  return { szoveg: s, hianyzo };
}

// ---------------------------------------------------------------- formatumok

/** 29900 -> "29 900 Ft" (nem torheto szokozzel, ezres tagolas es "Ft" elott is) */
export function penz(osszeg) {
  const n = Math.round(Number(osszeg));
  if (!Number.isFinite(n)) return null;
  const tag = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${n < 0 ? '-' : ''}${tag}${NBSP}Ft`;
}

/** A szoveg "29 900 Ft" / "06 20 247 4444" jellegu szamcsoportjai koze nem torheto szokozt tesz (CSAK e-mailben; SMS-ben nem). */
export function nemTorhetoSzokoz(szoveg) {
  return String(szoveg).replace(/(?<=\d) (?=\d)/g, NBSP).replace(/(?<=\d) (?=Ft(?![a-záéíóöőúüű]))/g, NBSP);
}

/** epoch mp -> "november 25. (szerda)" (Europe/Budapest) */
export const datum = (epoch) => (Number.isFinite(epoch) ? datumSzoveg(epoch) : null);
/** epoch mp -> "november 25-én" */
export const datumRagosan = (epoch) => (Number.isFinite(epoch) ? datumRagos(epoch) : null);
/** epoch mp -> "16:00" */
export const ido = (epoch) => (Number.isFinite(epoch) ? idopontSzoveg(epoch) : null);
/** epoch mp -> "2026-11-25" (belso levelekhez, ha kell) */
export function isoDatum(epoch) {
  if (!Number.isFinite(epoch)) return null;
  const l = helyi(epoch);
  return `${l.y}-${String(l.m).padStart(2, '0')}-${String(l.d).padStart(2, '0')}`;
}

/** Keresztnev a teljes nevbol (a lifecycle nev-listaja szerint); bizonytalan eseten null -> "Szia!". */
export function keresztnevbol(nev) {
  return keresztnevKinyer(nev) || null;
}

/**
 * Helyorzo-ertekek epitese nyers bemenetbol.
 * @param {object} b
 * @param {string} [b.keresztnev]    ha megvan
 * @param {string} [b.nev]           teljes nev (ebbol keresztnev, ha nincs megadva)
 * @param {number} [b.booking_start] epoch mp -> datum, datum_ragos, ido
 * @param {number} [b.regi_start]    epoch mp -> regi_datum, regi_ido
 * @param {number} [b.lejarat]       epoch mp -> lejarat_datum, lejarat_datum_ragos
 * @param {number} [b.arak]          (nincs: az arak a sablon szovegeben vannak, nem helyorzok)
 * @returns {Record<string, string|number|null>} minden mas kulcs (kezelo, szolgaltatas, *_link, ...) valtozatlanul atmegy
 */
export function valtozokEpit(b = {}) {
  const { keresztnev, nev, booking_start, regi_start, lejarat, ...tobbi } = b;
  const ki = { ...tobbi };
  ki.keresztnev = !ures(keresztnev) ? String(keresztnev).trim() : (nev ? keresztnevbol(nev) : null);
  if (booking_start !== undefined) {
    ki.datum = datum(booking_start); ki.datum_ragos = datumRagosan(booking_start); ki.ido = ido(booking_start);
  }
  if (regi_start !== undefined) { ki.regi_datum = datum(regi_start); ki.regi_ido = ido(regi_start); }
  if (lejarat !== undefined) { ki.lejarat_datum = datum(lejarat); ki.lejarat_datum_ragos = datumRagosan(lejarat); }
  // a kerdoiv-link es az allapotfelmero-link ugyanaz a link (T0/T-72 vs. T-24 szoveg)
  if (ures(ki.kerdoiv_link) && !ures(ki.allapotfelmero_link)) ki.kerdoiv_link = ki.allapotfelmero_link;
  if (ures(ki.allapotfelmero_link) && !ures(ki.kerdoiv_link)) ki.allapotfelmero_link = ki.kerdoiv_link;
  return ki;
}
