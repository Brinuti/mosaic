// QA-2: a parositott Salonic-foglalasbol (booking_id) az esemenyek kuldese. A foglalas-kulcs.js kezelEgyeztetes-e hivja (deps.esemenyKuldo), MERES_ELOSZTO=1 mellett.
// Bemenet a hivo (a Salonic-levelet feldolgozo folyamat) oldalarol: bejovo.vendeg { email, telefon }, bejovo.uj_vendeg (a Salonic "uj vendeg" jelzese: boolean), bejovo.ar (tartalek);
// az ar alapbol a levelbol jon (emailElemzes().ar: "Fizetendo varhatoan" / "Price"); az erkezesi adat a bongeszotol (meres_erkezes, booking_id kulccsal).
import { elosztas, erkezesOlvas } from './elosztas.js';
import { foglalasJelleg, SALONIC_UZLETAG } from './esemeny-modell.js';
import { jellegRogzit } from './jelleg-rogzites.js';
import { foglalasAllapot, emailElemzes } from '../foglalas-kulcs.js';

export async function foglalasEsemenyKuldes({ db, env, mezok, bejovo = {}, eredmeny, fetchImpl, now, kuldo }) {
  const uzletag = SALONIC_UZLETAG[mezok.host];
  if (!uzletag) return { allapot: 'nincs_uzletag', miert: 'ismeretlen Salonic-host: ' + mezok.host };
  const sourceId = eredmeny.booking_id;
  const erk = await erkezesOlvas(db, sourceId);
  const b = (erk && erk.bongeszo) || {};
  const html = typeof bejovo.email_html === 'string' ? emailElemzes(bejovo.email_html) : {};
  // a Salonic "uj vendeg" jelzese az igazsag; a bongeszos first_booking csak tartalek; ismeretlen = nem allitjuk, hogy uj vendeg
  const ujVendeg = typeof bejovo.uj_vendeg === 'boolean' ? bejovo.uj_vendeg : (typeof b.first_booking === 'boolean' ? b.first_booking : null);
  const kapott = foglalasJelleg({ szolgaltatasNev: mezok.szolgaltatas || b.szolgaltatas || '', ujVendeg, kategoria: b.kategoria || '' });
  // X1: az alapesemeny tipusa (es a kupon-jelzes) foglalasonkent az ELSO levelnel rogzul; a kesobbi, elteros jelzesu level nem kepez masik alapesemenyt (jelleg-rogzites.js)
  const zar = String((env || {}).MERES_ELOSZTO) === '1' ? await jellegRogzit(db, sourceId, kapott, now ? now() : Date.now()) : { ...kapott, forras: 'nincs_rogzites' };
  const { jelleg, kupon } = zar;
  const ar = [bejovo.ar, html.ar, b.ar].map(Number).find((x) => Number.isFinite(x) && x >= 0);
  const leveldatum = Date.parse(mezok.leveldatum || '');
  const ido = Math.floor((Number.isFinite(leveldatum) ? leveldatum : (now ? now() : Date.now())) / 1000);
  const v = (bejovo.vendeg && typeof bejovo.vendeg === 'object') ? bejovo.vendeg : {};
  const fk = { tipus: 'foglalas', uzletag, source_entity_id: sourceId, jelleg, kupon, ertek: ar ?? 0, ido, szolgaltatas: mezok.szolgaltatas || b.szolgaltatas || null, vendeg: { email: v.email, telefon: v.telefon, g: b.g || null }, oldal: b.oldal || null, uuid: mezok.uuid };
  const r = await elosztas(db, fk, { env, fetchImpl, now, kuldo, eloEllenorzes: async () => (await foglalasAllapot({ host: mezok.host, uuid: mezok.uuid, fetchImpl })).allapot });
  return { ...r, jelleg, kupon, uj_vendeg: ujVendeg, jelleg_rogzites: { forras: zar.forras, kapott_jelleg: kapott.jelleg, kapott_kupon: kapott.kupon, eltero: kapott.jelleg !== jelleg || kapott.kupon !== kupon }, salonic_ar: fk.ertek, ertek: (r.esemenyek && r.esemenyek[0] ? r.esemenyek[0].ertek : null), ar_forras: bejovo.ar != null ? 'bejovo' : html.ar != null ? 'level' : b.ar != null ? 'bongeszo' : 'nincs', uzletag };
}
