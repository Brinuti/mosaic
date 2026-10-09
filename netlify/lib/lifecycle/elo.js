// A foglalas NYILVANOS Salonic-oldalanak elo ellenorzese (DECISION #117, D6). Csak olvasas: GET https://<fiok>.salonic.hu/booking/bookingDetails/<uuid>.
//   - torolt foglalas: a Salonic a /booking/deleteSuccess/<uuid> oldalra iranyit (a QA-3 / QA-1 nyomok mindegyikeben) -> allapot 'torolve'.
//     CSAK ez dont: a felirat ("Időpont törölve!") onmagaban nem eleg, mert a Salonic oldalai a forditasi szovegeket elo foglalas oldalan is hordozhatjak.
//   - elo foglalas: a "Foglalás módosítása" link (/selectDate/?startDate=<unix>&bookingId=<uuid>) hordozza a kezdest -> 'aktiv' + startUnix
//   - minden mas (halozati hiba, idotullepes, ismeretlen oldal) -> 'ismeretlen' (a hivo ilyenkor SOHA nem valtoztat allapotot)
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const FIOK_RE = /^[a-z0-9-]{3,40}$/;

/** A letoltott oldal elemzese. @returns {{allapot:'aktiv'|'torolve'|'ismeretlen', startUnix?:number, miert?:string}} */
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

/** @returns {Promise<{allapot:string, startUnix?:number, miert?:string}>} - sosem dob hibat */
export async function eloAllapot({ fiok, id, fetchFn = fetch, ms = 4000 }) {
  if (!FIOK_RE.test(String(fiok || '')) || !UUID_RE.test(String(id || ''))) return { allapot: 'ismeretlen', miert: 'ervenytelen_azonosito' };
  const url = `https://${fiok}.salonic.hu/booking/bookingDetails/${id}`;
  const ab = new AbortController();
  const idozito = setTimeout(() => ab.abort(), ms);
  try {
    const r = await fetchFn(url, { redirect: 'follow', signal: ab.signal, headers: { 'user-agent': 'Mozilla/5.0 (compatible; MosaicLifecycle/1.0)', accept: 'text/html' } });
    const html = r.ok ? await r.text() : '';
    return eloElemzes({ status: r.status, url: r.url || url, html, id });
  } catch (hiba) {
    return { allapot: 'ismeretlen', miert: `lekeres_hiba:${String(hiba && hiba.name || hiba).slice(0, 40)}` };
  } finally { clearTimeout(idozito); }
}

/** A hivo fuggveny a tick-hez / befogadashoz; null, ha az ellenorzes ki van kapcsolva (LIFECYCLE_ELO_ELLENORZES = ki). */
export function eloEllenorzoKeszit(env = {}, fetchFn = fetch) {
  if (String(env.LIFECYCLE_ELO_ELLENORZES || '').toLowerCase() === 'ki') return null;
  return (f) => eloAllapot({ fiok: f.fiok, id: f.id, fetchFn });
}
