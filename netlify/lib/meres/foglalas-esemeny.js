// QA-2: a parositott Salonic-foglalasbol (booking_id) az esemenyek kuldese. A foglalas-kulcs.js kezelEgyeztetes-e hivja (deps.esemenyKuldo), MERES_ELOSZTO=1 mellett.
// Bemenet a hivo (a Salonic-levelet feldolgozo folyamat) oldalarol: bejovo.vendeg { email, telefon }, bejovo.uj_vendeg (a Salonic "uj vendeg" jelzese: boolean), bejovo.ar (tartalek);
// az ar alapbol a levelbol jon (emailElemzes().ar: "Fizetendo varhatoan" / "Price"); az erkezesi adat a bongeszotol (meres_erkezes, booking_id kulccsal).
import { elosztas, erkezesOlvas } from './elosztas.js';
import { foglalasJelleg, SALONIC_UZLETAG } from './esemeny-modell.js';
import { jellegRogzit } from './jelleg-rogzites.js';
import { jellegSzabaly } from './jelleg-oldal.js';
import { foglalasAllapot, emailElemzes } from '../foglalas-kulcs.js';
import { vendegNev } from './vendeg-nev.js';
import { tiktokEloKuld } from './tiktok-elo.js'; // UJ-67/69/71/73: kodos elo TikTok-esemeny (alapbol KI)
import { metaEloKuld } from './meta-elo.js'; // DECISION #240: HeadSpa Meta Schedule az elo pixelre (alapbol KI)
import { pvKuld } from './meta-pageview.js'; // UJ-74: Oxigen / Fodrasz szerveres PageView a Hair-pixelre (alapbol KI)

export async function foglalasEsemenyKuldes({ db, env, mezok, bejovo = {}, eredmeny, fetchImpl, now, kuldo }) {
  const uzletag = SALONIC_UZLETAG[mezok.host];
  if (!uzletag) return { allapot: 'nincs_uzletag', miert: 'ismeretlen Salonic-host: ' + mezok.host };
  const sourceId = eredmeny.booking_id;
  const erk = await erkezesOlvas(db, sourceId);
  const b = (erk && erk.bongeszo) || {};
  const html = typeof bejovo.email_html === 'string' ? emailElemzes(bejovo.email_html) : {};
  // a Salonic "uj vendeg" jelzese az igazsag; a bongeszos first_booking csak tartalek; ismeretlen = nem allitjuk, hogy uj vendeg
  const ujVendeg = typeof bejovo.uj_vendeg === 'boolean' ? bejovo.uj_vendeg : (typeof b.first_booking === 'boolean' ? b.first_booking : null);
  const kapott0 = foglalasJelleg({ szolgaltatasNev: mezok.szolgaltatas || b.szolgaltatas || '', ujVendeg, kategoria: b.kategoria || '' });
  // UJ-68: a jelleg a KOSZONOOLDALBOL / a szolgaltatas nevebol is (szor/oxigen uj-visszajaro oldalak, fodrasz/PMU konzultacio-nev); a kupon-jelzes valtozatlan (jelleg-oldal.js)
  const kapott = jellegSzabaly({ uzletag, oldal: (erk && erk.oldal) || b.oldal || '', szolgaltatasNev: mezok.szolgaltatas || b.szolgaltatas || '', kapott: kapott0, env });
  // X1: az alapesemeny tipusa (es a kupon-jelzes) foglalasonkent az ELSO levelnel rogzul; a kesobbi, elteros jelzesu level nem kepez masik alapesemenyt (jelleg-rogzites.js)
  const zar = String((env || {}).MERES_ELOSZTO) === '1' ? await jellegRogzit(db, sourceId, kapott, now ? now() : Date.now()) : { ...kapott, forras: 'nincs_rogzites' };
  const { jelleg, kupon } = zar;
  const ar = [bejovo.ar, html.ar, b.ar].map(Number).find((x) => Number.isFinite(x) && x >= 0);
  const leveldatum = Date.parse(mezok.leveldatum || '');
  const ido = Math.floor((Number.isFinite(leveldatum) ? leveldatum : (now ? now() : Date.now())) / 1000);
  const v = (bejovo.vendeg && typeof bejovo.vendeg === 'object') ? bejovo.vendeg : {};
  const fk = { tipus: 'foglalas', uzletag, source_entity_id: sourceId, jelleg, kupon, ertek: ar ?? 0, ido, szolgaltatas: mezok.szolgaltatas || b.szolgaltatas || null, vendeg: { email: v.email, telefon: v.telefon, g: b.g || null, nev: vendegNev({ ...bejovo, vendeg: v }) }, oldal: b.oldal || null, uuid: mezok.uuid }; // nev (DECISION #202): a Zap `nev` mezoje, tartalekban a level szovegebol; csak hash-elesre (a nyers nev nem naplozodik)
  let eloAllapot = null; const eloEllenorzes = () => (eloAllapot ||= foglalasAllapot({ host: mezok.host, uuid: mezok.uuid, fetchImpl }).then((x) => x.allapot)); // egy Salonic-lekeres az elosztasnak es az elo TikTok-kuldesnek
  const r = await elosztas(db, fk, { env, fetchImpl, now, kuldo, eloEllenorzes });
  const tiktokElo = await tiktokEloKuld(db, { ...fk, uuid: mezok.uuid }, { env, fetchImpl, now, eloEllenorzes });
  const metaElo = await metaEloKuld(db, { ...fk, uuid: mezok.uuid }, { env, fetchImpl, now, eloEllenorzes });
  const metaPv = await pvKuld(db, { ...fk, uuid: mezok.uuid }, { env, fetchImpl, now, eloEllenorzes });
  return { ...r, ...(tiktokElo.allapot !== 'ki' ? { tiktok_elo: tiktokElo } : {}), ...(metaElo.allapot !== 'ki' ? { meta_elo: metaElo } : {}), ...(metaPv.allapot !== 'ki' ? { meta_pv: metaPv } : {}), jelleg, kupon, uj_vendeg: ujVendeg, jelleg_rogzites: { forras: zar.forras, oldal_szabaly: kapott.szabaly, modell_jelleg: kapott0.jelleg, kapott_jelleg: kapott.jelleg, kapott_kupon: kapott.kupon, eltero: kapott.jelleg !== jelleg || kapott.kupon !== kupon }, salonic_ar: fk.ertek, ertek: (r.esemenyek && r.esemenyek[0] ? r.esemenyek[0].ertek : null), ar_forras: bejovo.ar != null ? 'bejovo' : html.ar != null ? 'level' : b.ar != null ? 'bongeszo' : 'nincs', uzletag };
}
