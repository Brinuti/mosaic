// GYOGYTORNASZOM.HU foglalomotor - SZERVEROLDALI Salonic-ellenorzesek (csak olvasas, GET). A Worker ezekkel ellenorzi a bongeszo allitasat.
//
//  - katalogusSzolgaltatas: a szolgaltatas ARA / neve a Salonic ELO listajabol (nem a bongeszo allitasabol): ebbol lesz a konverzio erteke.
//  - szabadMeg: a valasztott idopont MEG szabad-e a Salonic naptar-API-jaban. Sikeres foglalas utan a foglalt idopont eltunik a szabadok kozul;
//    ha meg szabad, a "foglalas" nem a Salonicban jott letre (vagy mas mar lemondta) -> nem eleg bizonyitek.
//  - eloAllapot: egy foglalas NYILVANOS Salonic-oldalanak elo ellenorzese (bookingDetails/<uuid>): aktiv | torolve | ismeretlen. A Salonic sajat
//    foglalas-azonositoja (UUID) CSAK a Salonic e-mailjebol (Zapier) vagy a vendeg linkjebol ismert, az atiranyitasban nincs (docs: BOOKING_ID.md).
// Sosem dob: hibaban 'ismeretlen' / null (a hivo ilyenkor nem dont es nem valtoztat allapotot).
import { createSalonicAdapter, FIOK, HOST, ANY_STAFF, HELYSZINEK } from '../public/assets/js/motor/salonic-adapter.js';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const FEJLEC = { 'user-agent': 'Mozilla/5.0 (compatible; GyogytornaFoglalo/1.0; +https://www.gyogytornaszom.hu)', accept: 'text/html,application/json' };

export function szerverAdapter(env = {}, fetchImpl = globalThis.fetch) {
  return createSalonicAdapter({ fetchImpl, timeoutMs: 4000, retries: 1, cacheMs: 5 * 60 * 1000, headers: FEJLEC });
}

/** A szolgaltatas elo adatai a helyszinen: { serviceId, name, activePrice, durationMin, staffIds } vagy null (nem talalhato / Salonic nem valaszol). */
export async function katalogusSzolgaltatas(adapter, placeId, serviceId) {
  try {
    const s = (await adapter.getServices(placeId)).find((x) => x.serviceId === String(serviceId));
    return s || null;
  } catch (e) { return null; }
}

/** @returns {Promise<true|false|null>} true: az idopont MEG szabad (nincs foglalas); false: nem szabad (foglalt); null: nem ellenorizheto */
export async function szabadMeg(adapter, { placeId, serviceId, staffId, startUnix }) {
  try {
    const l = await adapter.getAvailability(placeId, serviceId, { staffId: staffId === undefined || staffId === null ? ANY_STAFF : staffId, from: startUnix - 60, days: 1, fresh: true });
    const szabad = l.filter((x) => x.start_unix === startUnix && (+staffId === ANY_STAFF || String(x.staff_id) === String(staffId)));
    return szabad.length > 0;
  } catch (e) { return null; }
}

/** A letoltott bookingDetails-oldal elemzese (a Mosaic lifecycle/elo.js szerint). @returns {{allapot:'aktiv'|'torolve'|'ismeretlen', startUnix?:number, miert?:string}} */
export function eloElemzes({ status, url, html, id }) {
  const vegso = String(url || '');
  const szoveg = String(html || '');
  const torolt = /\/booking\/deleteSuccess\/([0-9a-f-]{36})/i.exec(vegso);
  if (torolt) return torolt[1].toLowerCase() === String(id).toLowerCase() ? { allapot: 'torolve', forras: 'atiranyitas' } : { allapot: 'ismeretlen', miert: 'masik_foglalas' };
  if (status && status !== 200) return { allapot: 'ismeretlen', miert: `http_${status}` };
  const m = /href="(\/selectDate\/\?startDate=(\d{9,11})&(?:amp;)?bookingId=([0-9a-f-]{36}))"/i.exec(szoveg);
  if (m && m[3].toLowerCase() === String(id).toLowerCase()) return { allapot: 'aktiv', startUnix: Number(m[2]) };
  if (/Visszaigazolt|\bConfirmed\b/.test(szoveg)) return { allapot: 'aktiv' };
  return { allapot: 'ismeretlen', miert: /Id[oő]pont t[oö]r[oö]lve|Appointment deleted/i.test(szoveg) ? 'torolve_felirat_atiranyitas_nelkul' : 'ismeretlen_oldal' };
}

export async function eloAllapot(id, { fetchFn = globalThis.fetch, ms = 4000 } = {}) {
  if (!UUID_RE.test(String(id || ''))) return { allapot: 'ismeretlen', miert: 'ervenytelen_azonosito' };
  const url = `${HOST}/booking/bookingDetails/${id}`;
  const ab = new AbortController();
  const idozito = setTimeout(() => ab.abort(), ms);
  try {
    const r = await fetchFn(url, { redirect: 'follow', signal: ab.signal, headers: FEJLEC });
    const html = r.ok ? await r.text() : '';
    return eloElemzes({ status: r.status, url: r.url || url, html, id });
  } catch (hiba) {
    return { allapot: 'ismeretlen', miert: `lekeres_hiba:${String(hiba && hiba.name || hiba).slice(0, 40)}` };
  } finally { clearTimeout(idozito); }
}

export { FIOK, HELYSZINEK };
