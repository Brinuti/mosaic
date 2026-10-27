// MOSAIC - "7 napos UTOLSO FIZETETT KATTINTAS" forrasmeres, MIND AZ 5 UZLETAGRA (headspa, fodrasz, oxigen, szor, pmu).
// Leiras: docs/booking-engine/FORRAS_LPT.md. Referencia (az MP-n elo): medicalpiercing/lib/meres/cimke.js (itt a Mosaic alakjaira portolva, kulon fajlban: a ket projekt kodja nem kozos).
//
// Feri kifejezett kerese (2026-10-19, #167 6275958914; kozos szabaly: FORRASMERES-KOZOS-SZABALY-4-PROJEKT-2026-10-13.md "FERI DONTESE (2026-10-14 21:30)"):
//   1) SZERVER ALTAL IRT, HttpOnly, sajat domaines suti (mh_lpt, 30 nap): minden fizetett erkezeskor az UTOLSO fizetett kattintas (platform, tisztitott UTM, kampany / hirdetescsoport / hirdetes
//      azonosito, ido, a NYERS kattintasazonosito alak- es hosszellenorzessel). A Safari 7 napos JS-tarolo-vagasa nem erinti (nem JS-sel irjuk).
//   2) Foglalaskor (koszonooldali jelzes -> sajat D1, meres_forras): ha a latogatason belul nincs fizetett erintes, a suti 7 napon beluli fizetett kattintasa adja a forras-cimket.
//      Organikus / direkt visszateres NEM ir felul (a sutit sem), ujabb fizetett kattintas igen. 8-30 napos kattintas: a cimke NEM valtozik, csak "kesei fizetett kattintas" jelzes.
//      Kulon bizonyitek-forras mezo (munkamenet | latogatas | suti): lassuk, mennyit hoz a suti.
//   3) A sutibol visszanyert kattintasazonositoval a foglalas ELO esemenye (a bongeszobol indulo GTM / pixel a koszonooldal URL-jebol veszi) kitoltheto, ha a bongeszobol nem jott (GET ide;
//      a kliens a foglalo-atadasnal fuzi az URL-hez: assets/js/attribucio.js, booking-engine/flow.js, foglalo-pmu.js). Uj konverzio nincs: csak TOBB ADAT egy mar el konverziohoz (4/a szabaly).
//
// ADATVEDELEM: a meres_forras NEM tarol nyers kattintasazonositot, IP-t, user agentet, vendegadatot. A suti marketing-hozzajarulas nelkul (kifejezett elutasitas: hozz.adv === false) nem iratik, a meglevot
// toroljuk; a kattintasazonosito-ertek CSAK a sutibe (es a visszanyeresi GET valaszba) kerul, sehova mashova. Veszkapcsolo: MOSAIC_LPT_KI=1 (a vegpont 503, a koszonooldali resz nem fut).
import { azonosEredet } from '../foglalas-kulcs.js';
import { erkezesTisztit } from './erkezes.js';
import { hozzajarulasTisztit } from './hozzajarulas.js';
import { SOURCE_ID_MINTA, UZLETAGAK } from './esemeny-modell.js';
import { oszlopokBiztosit } from './sema-seged.js';
import { vidMukodik, vidKulcs, vidUj, vidOlvas, vidSuti, vidSutiVan, vidHash, klikkHash, erintesSor, erintesIr, vidErkezesIr, utvonalLezar } from './erintesnaplo.js'; // #495 (UJ-80): erintesnaplo, MERES_VID_BE=1 mellett

export const CIMKEK = Object.freeze(['meta', 'tiktok', 'google_nem_markas', 'google_markas', 'organikus_direkt', 'ismeretlen']);
export const KATT_PARAMOK = Object.freeze(['gclid', 'gbraid', 'wbraid', 'fbclid', 'ttclid']);
export const REFERRER_KAT = Object.freeze(['search', 'social', 'egyeb', 'nincs']);
export const FIZETETT_MEDIUM = Object.freeze(['cpc', 'ppc', 'paid', 'paid_social', 'paidsocial', 'paid_search', 'cpm']);
export const BIZONYITEK_FORRASOK = Object.freeze(['munkamenet', 'latogatas', 'suti']);
const META_FORRAS = ['meta', 'facebook', 'fb', 'instagram', 'ig'];
const TIKTOK_FORRAS = ['tiktok'];
const GOOGLE_FORRAS = ['google', 'adwords', 'googleads'];
export const LPT_SUTI = 'mh_lpt';
export const LPT_VERZIO = 1;
export const LPT_NAP = 30; // a suti elettartama es a visszanyerheto kattintas legnagyobb kora
export const LPT_ABLAK_NAP = 7; // a forras-cimkehez hasznalhato kattintas legnagyobb kora
export const POTLAS_NAP = 7; // a sutibol visszanyert kattintasazonosito (az elo esemenybe es a shadow-lancba potlas) legnagyobb kora: MIND az 5 tipusra 7 nap (= a cimke-ablak; MP #432 LPT_CIMKE_NAP); a 8-30 napos kattintas csak "kesei" jelzes
export const LPT_MAX_HOSSZ = 1200; // a suti ertekenek (base64url) legnagyobb hossza
export const MEGORZES_NAP = 30; // mint a meres_erkezes-nel (elosztas.js): MOSAIC_LPT_MEGORZES_NAP-pal felulirhato (7-3650)
const MAX_TORZS = 4000; // a sutit iro POST torzsenek korlatja
const MAX_ERKEZES_TORZS = 8000; // = vegpontok.js kezelErkezes
// = erkezes.js MINTA (a kattintasazonositok alak- es hosszellenorzese)
export const KATT_MINTA = Object.freeze({
  gclid: /^[A-Za-z0-9_-]{10,200}$/, gbraid: /^[A-Za-z0-9_-]{10,200}$/, wbraid: /^[A-Za-z0-9_-]{10,200}$/,
  fbclid: /^[A-Za-z0-9_-]{8,200}$/, ttclid: /^[A-Za-z0-9_.-]{8,200}$/,
});
const SZAM_MINTA = /^\d{1,20}$/;
const kis = (v) => (v == null ? '' : String(v).toLowerCase());
const sec = (ms) => Math.floor(ms / 1000);

// ---------- tisztitas ----------
/**
 * Egy utm-ertek tisztitasa: trim, ELOBB ekezetmentesites (NFD + a kombinalo jelek torlese: a, o, u ekezetei), UTANA a nem engedett karakterek (nem [A-Za-z0-9._~:+-]) "_"-ra csereldnek,
 * legfeljebb 100 karakter; ures / nem szoveg = null. (A Meta kotelezo UTM-je a kampany NEVET adja szokozokkel, ekezetekkel: "Karacsonyi akcio" ekezetesen -> "Karacsonyi_akcio".)
 */
export function utmTisztit(v) {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const s = String(v).trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9._~:+-]+/g, '_').slice(0, 100).replace(/^_+|_+$/g, '');
  return s || null;
}
/** Hirdetesi azonosito (kampany / hirdetescsoport / hirdetes): csak szamjegyek, legfeljebb 20; kulonben null. */
export function szamTisztit(v) {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const s = String(v).trim();
  return SZAM_MINTA.test(s) ? s : null;
}
/** A NYERS kattintasazonosito: csak ha a tipus ismert es az ertek az erkezes.js MINTA szerinti; kulonben null. */
export function klikkTisztit(kp, kv) {
  return KATT_PARAMOK.includes(kp) && typeof kv === 'string' && KATT_MINTA[kp].test(kv) ? kv : null;
}

/** Fizetett-e az erintes: barmely kattintasi parameter VAGY fizetett utm_medium. */
export function fizetett(e) {
  return !!e && (KATT_PARAMOK.includes(e.kp) || FIZETETT_MEDIUM.includes(kis(e.um)));
}
/** A sutibol visszanyert kattintasazonosito potlasra hasznalhato-e (a kattintas legfeljebb POTLAS_NAP napos)? s: lptDekodol eredmenye. */
export const potlasAblakban = (s) => !!s && s.kor_s <= POTLAS_NAP * 86400;
/**
 * A marketing-hozzajarulas HATALYOS allapota a koszonooldali jelzesben: a kliens "forras_adv" mezoje (a hatalyos engedely: suti.js dontese / alapertek, a reszleges mh_cc bejegyzes NEM elutasitas), ha van;
 * kulonben a nyers "hozz" (mh_cc) szerint: csak a kifejezett elutasitas (adv === false) tilt. A "hozz" mezo (SZ-38) valtozatlan marad.
 */
export const advEngedett = (be) => (be && typeof be.forras_adv === 'boolean' ? be.forras_adv : hozzajarulasTisztit(be && be.hozz).adv !== false);
/** A fizetett erintes platformja (google | meta | tiktok) vagy null. Elobb a platform altal tett kattintasi parameter, utana az utm_source. */
export function fizetettPlatform(e) {
  if (!fizetett(e)) return null;
  if (e.kp === 'gclid' || e.kp === 'gbraid' || e.kp === 'wbraid') return 'google';
  if (e.kp === 'fbclid') return 'meta';
  if (e.kp === 'ttclid') return 'tiktok';
  const s = kis(e.us);
  if (META_FORRAS.includes(s)) return 'meta';
  if (TIKTOK_FORRAS.includes(s)) return 'tiktok';
  if (GOOGLE_FORRAS.includes(s)) return 'google';
  return null;
}

/**
 * Egy erintes (a bongeszo tisztitott erintese VAGY az mh_lpt suti tartalma) szerver-oldali ujratisztitasa. Ismeretlen mezo eldobva; a kattintasi parameterbol a TIPUS (feher lista); a nyers
 * kattintasazonosito (kv) csak opt.kv eseten es csak mintaval; az ido (t) egesz, 2020 utani, legfeljebb 5 perccel a "most" utani. v !== 1 -> null.
 * -> { v:1, us?, um?, uc?, ut?, uco?, gc?, ag?, ad?, kp?, kv?, rk?, t? }
 */
export function erintesTisztit(e, most, { kv = false } = {}) {
  if (!e || typeof e !== 'object' || Array.isArray(e) || e.v !== LPT_VERZIO) return null;
  const o = { v: LPT_VERZIO };
  const mezo = (k, v) => { if (v != null) o[k] = v; };
  mezo('us', utmTisztit(e.us)); mezo('um', utmTisztit(e.um)); mezo('uc', utmTisztit(e.uc)); mezo('ut', utmTisztit(e.ut)); mezo('uco', utmTisztit(e.uco));
  mezo('gc', szamTisztit(e.gc)); mezo('ag', szamTisztit(e.ag)); mezo('ad', szamTisztit(e.ad));
  if (KATT_PARAMOK.includes(e.kp)) { o.kp = e.kp; if (kv) mezo('kv', klikkTisztit(e.kp, e.kv)); }
  mezo('rk', REFERRER_KAT.includes(e.rk) ? e.rk : null);
  const t = Number(e.t);
  if (Number.isInteger(t) && t > 1600000000 && (most == null || t <= most + 300)) o.t = t;
  return o;
}

// ---------- suti ----------
const b64urlKi = (s) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlBe = (s) => atob(String(s).replace(/-/g, '+').replace(/_/g, '/'));
/** A Cookie fejlec -> { nev: ertek } (az elso elofordulas nyer; nincs prototipus). */
export function sutik(fejlec) {
  const o = Object.create(null);
  for (const p of String(fejlec || '').split(';')) {
    const i = p.indexOf('='); if (i < 0) continue;
    const k = p.slice(0, i).trim(); if (!k || k in o) continue;
    o[k] = p.slice(i + 1).trim();
  }
  return o;
}

/** A suti kompakt alakja ({ v, p, us, um, uc, ut, uco, gc, ag, ad, kp, kv, t }); a hosszkorlat (LPT_MAX_HOSSZ) miatt szukseg eseten a kevesbe fontos utm-mezok elmaradnak. */
export function lptKodol(e) {
  const m = { v: LPT_VERZIO };
  const p = fizetettPlatform(e); if (p) m.p = p;
  for (const k of ['us', 'um', 'uc', 'ut', 'uco', 'gc', 'ag', 'ad', 'kp', 'kv', 't']) if (e[k] != null) m[k] = e[k];
  let s = b64urlKi(JSON.stringify(m));
  for (const k of ['ut', 'uco', 'us', 'um']) { if (s.length <= LPT_MAX_HOSSZ) break; delete m[k]; s = b64urlKi(JSON.stringify(m)); }
  return s;
}
/** Az mh_lpt suti ertekenek (base64url) visszafejtese -> a tisztitott, FIZETETT erintes + { p, kor_s, kor_nap }, vagy null (nincs / hibas / hamis / jovobeli / 30 napnal regebbi / nem fizetett). */
export function lptDekodol(ertek, most) {
  if (typeof ertek !== 'string' || !ertek || ertek.length > LPT_MAX_HOSSZ || !/^[A-Za-z0-9_-]+$/.test(ertek)) return null;
  let o; try { o = JSON.parse(b64urlBe(ertek)); } catch (e) { return null; }
  const e = erintesTisztit(o, most, { kv: true });
  if (!e || !e.t || !fizetett(e)) return null;
  delete e.rk; // a sutiben nincs hivatkozo-kategoria
  const kor = most - e.t;
  if (kor > LPT_NAP * 86400) return null;
  return { ...e, p: fizetettPlatform(e), kor_s: Math.max(0, kor), kor_nap: Math.floor(Math.max(0, kor) / 86400) };
}
/** A Cookie fejlecbol az mh_lpt suti -> lptDekodol eredmenye vagy null. */
export function lptOlvas(cookieFejlec, most) {
  const v = sutik(cookieFejlec)[LPT_SUTI];
  return v ? lptDekodol(v, most) : null;
}
/** A Set-Cookie fejlec: HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=30 nap (torol = true: Max-Age=0). */
export function lptSuti(e, torol = false) {
  return `${LPT_SUTI}=${torol ? '' : lptKodol(e)}; Max-Age=${torol ? 0 : LPT_NAP * 86400}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

// ---------- bizonyitek-valasztas ----------
/**
 * A foglalas forras-bizonyiteke:
 *   1) a latogatas FIZETETT erintese (munkamenet = sessionStorage, vagy a 2 oras latogatas-tarolo) -> 'munkamenet' | 'latogatas';
 *   2) ha nincs fizetett erintes a latogatasban: a mh_lpt suti, HA a kattintasa legfeljebb LPT_ABLAK_NAP (7) napos -> 'suti' (a cimke a sutibol);
 *   3) kulonben a munkamenet nem fizetett erintese (organikus / direkt / ismeretlen) -> 'munkamenet' | 'latogatas' (vagy nincs bizonyitek).
 * Ha a suti kattintasa 8-30 napos ES a cimke nem a sutibol jott: kesei = { platform, kor_nap } (a cimke valtozatlan).
 * munkamenet: erintesTisztit eredmeny (rk kotelezo), tarolo: 'latogatas' | 'munkamenet', suti: lptOlvas eredmenye (hozzajarulas nelkul null).
 */
export function bizonyitekValaszt({ munkamenet = null, tarolo = 'munkamenet', suti = null } = {}) {
  const mForras = tarolo === 'latogatas' ? 'latogatas' : 'munkamenet';
  if (munkamenet && fizetett(munkamenet)) return { bizonyitek: munkamenet, bizonyitek_forras: mForras, kesei: null };
  if (suti && suti.kor_s <= LPT_ABLAK_NAP * 86400) return { bizonyitek: suti, bizonyitek_forras: 'suti', kesei: null };
  const kesei = suti ? { platform: suti.p, kor_nap: suti.kor_nap } : null;
  return { bizonyitek: munkamenet || null, bizonyitek_forras: munkamenet ? mForras : null, kesei };
}

// ---------- cimke ----------
/** google_markas_kampanyok (vesszovel elvalasztott szamjegy-azonositok) -> tomb, vagy null (nincs beallitva). */
export function markasListaErtelmez(ertek) {
  if (ertek == null) return null;
  return String(ertek).split(',').map((s) => s.trim()).filter((s) => SZAM_MINTA.test(s));
}
/**
 * A vegso cimke - DETERMINISZTIKUS az erintesbol (utm / kattintasi parameter / hivatkozo-kategoria). e: erintesTisztit / lptDekodol eredmenye vagy null; markasLista: kampany-ID tomb vagy null.
 * -> { forras_cimke, ismeretlen_ok, cimke_megjegyzes }
 */
export function cimkez(e, markasLista) {
  const ki = (forras_cimke, ismeretlen_ok = null, cimke_megjegyzes = null) => ({ forras_cimke, ismeretlen_ok, cimke_megjegyzes });
  if (!e) return ki('ismeretlen', 'nincs_jel');
  if (fizetett(e)) {
    const p = fizetettPlatform(e);
    if (!p) return ki('ismeretlen', 'hianyos_utm'); // fizetett medium, de ismeretlen utm_source
    if (p === 'google') {
      const kampanyok = [e.uc, e.gc].filter(Boolean).map(String);
      if (!kampanyok.length) return ki('google_nem_markas', null, 'nincs_kampany_id');
      if (markasLista == null) return ki('google_nem_markas', null, 'markas_lista_hianyzik');
      return kampanyok.some((k) => markasLista.includes(k)) ? ki('google_markas') : ki('google_nem_markas');
    }
    // fbclid utm nelkul: organikus megosztasbol is johet (a Facebook minden kimeno linkre teszi) - megjegyzes, a cimke marad
    if (p === 'meta' && e.kp === 'fbclid' && !FIZETETT_MEDIUM.includes(kis(e.um))) return ki('meta', null, 'fbclid_utm_nelkul');
    return ki(p);
  }
  if (e.us) {
    const src = kis(e.us);
    // platformnev medium nelkul: hianyos hirdetesi utm lehet - nem soroljuk organikusba
    if (!e.um && [...META_FORRAS, ...TIKTOK_FORRAS, ...GOOGLE_FORRAS].includes(src)) return ki('ismeretlen', 'hianyos_utm');
    return ki('organikus_direkt', null, 'organikus_utm');
  }
  if (e.rk === 'search') return ki('organikus_direkt', null, 'organikus_kereso');
  if (e.rk === 'social') return ki('organikus_direkt', null, 'organikus_social');
  if (e.rk === 'egyeb') return ki('organikus_direkt', null, 'hivatkozo');
  return ki('organikus_direkt', null, 'direkt');
}

// ---------- a koszonooldali jelzes -> a meres_forras sor (tiszta fuggveny) ----------
const potlasLista = (...listak) => [...new Set(listak.flat().filter((k) => KATT_PARAMOK.includes(k)))].sort();
/**
 * be: a POST /api/meres-erkezes torzse ({ source_id, uzletag, tipus, forras?, forras_tarolo?, lpt_potlas?, hozz? ... }); cookieFejlec: a keres Cookie fejlece; most: unix mp;
 * markasLista: tomb | null; szerverPotlas: a szerver (a shadow-lanc attr-jaba) altal a sutibol potolt kattintasi parameterek tipusai.
 * -> { sor (a meres_forras oszlopai), valasz: { cimke, bizonyitek_forras, klikk_potolt, kesei_fizetett } }
 */
export function forrasSor({ be, cookieFejlec = '', most, markasLista = null, szerverPotlas = [] }) {
  const adv = advEngedett(be); // kifejezett elutasitas = tilos (a Mosaic alapertelmezese: megadva, DECISION #170); a hatalyos allapotot a kliens forras_adv mezoje adja
  const m = erintesTisztit(be && be.forras, most);
  const munkamenet = m && m.rk ? m : null; // hivatkozo-kategoria nelkul nem bizonyitek
  const suti = adv ? lptOlvas(cookieFejlec, most) : null;
  const v = bizonyitekValaszt({ munkamenet, tarolo: be && be.forras_tarolo === 'latogatas' ? 'latogatas' : 'munkamenet', suti });
  const e = v.bizonyitek;
  const c = cimkez(e, markasLista);
  const kesei = v.kesei && v.bizonyitek_forras !== 'suti' ? v.kesei : null;
  // melyik platform(ok) kattintasazonositojat potolta a suti: a kliens jelzese (foglalo-atadas) CSAK akkor, ha a suti ugyanilyen azonositot hordoz; + a szerver sajat potlasa
  const kliensJelzes = Array.isArray(be && be.lpt_potlas) && suti && suti.kv && potlasAblakban(suti) ? be.lpt_potlas.filter((k) => k === suti.kp) : [];
  const potolt = adv ? potlasLista(kliensJelzes, szerverPotlas) : [];
  const sutis = v.bizonyitek_forras === 'suti';
  const sor = {
    source_id: be.source_id, uzletag: be.uzletag, tipus: be.tipus === 'ajandekkartya' ? 'ajandekkartya' : 'foglalas', ido: most,
    forras_cimke: c.forras_cimke, ismeretlen_ok: c.ismeretlen_ok, cimke_megjegyzes: c.cimke_megjegyzes, bizonyitek_forras: v.bizonyitek_forras,
    platform: e ? fizetettPlatform(e) : null,
    utm_source: e ? e.us ?? null : null, utm_medium: e ? e.um ?? null : null, utm_campaign: e ? e.uc ?? null : null, utm_term: e ? e.ut ?? null : null, utm_content: e ? e.uco ?? null : null,
    gad_campaignid: e ? e.gc ?? null : null, adgroupid: e ? e.ag ?? null : null, adid: e ? e.ad ?? null : null,
    kattintas_param: e ? e.kp ?? null : null, kattintas_ido: e ? e.t ?? null : null, kattintas_kor_nap: sutis ? suti.kor_nap : null,
    kesei_fizetett: kesei ? 1 : 0, kesei_fizetett_platform: kesei ? kesei.platform ?? null : null, kesei_kor_nap: kesei ? kesei.kor_nap : null,
    klikk_potolt: potolt.length ? potolt.join(',') : null, referrer_kat: e ? e.rk ?? null : null,
  };
  return { sor, valasz: valaszAlak(sor) };
}
/** A JSON-valasz additiv "forras" mezoje (szemelyes adat nelkul). */
export const valaszAlak = (s) => ({ cimke: s.forras_cimke, bizonyitek_forras: s.bizonyitek_forras ?? null, klikk_potolt: s.klikk_potolt ?? null, kesei_fizetett: Number(s.kesei_fizetett) === 1 });

// ---------- D1 ----------
const OSZLOPOK = ['source_id', 'uzletag', 'tipus', 'ido', 'forras_cimke', 'ismeretlen_ok', 'cimke_megjegyzes', 'bizonyitek_forras', 'platform', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'gad_campaignid', 'adgroupid', 'adid', 'kattintas_param', 'kattintas_ido', 'kattintas_kor_nap', 'kesei_fizetett', 'kesei_fizetett_platform', 'klikk_potolt', 'referrer_kat', 'kesei_kor_nap'];
const SEMA = [
  `CREATE TABLE IF NOT EXISTS meres_forras (source_id TEXT PRIMARY KEY, uzletag TEXT NOT NULL, tipus TEXT, ido INTEGER NOT NULL, forras_cimke TEXT NOT NULL, ismeretlen_ok TEXT, cimke_megjegyzes TEXT, bizonyitek_forras TEXT,
    platform TEXT, utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, utm_term TEXT, utm_content TEXT, gad_campaignid TEXT, adgroupid TEXT, adid TEXT, kattintas_param TEXT, kattintas_ido INTEGER, kattintas_kor_nap INTEGER,
    kesei_fizetett INTEGER DEFAULT 0, kesei_fizetett_platform TEXT, klikk_potolt TEXT, referrer_kat TEXT)`,
  'CREATE INDEX IF NOT EXISTS meres_forras_ido ON meres_forras (uzletag, ido)',
  'CREATE INDEX IF NOT EXISTS meres_forras_bizonyitek ON meres_forras (bizonyitek_forras, ido)',
  'CREATE TABLE IF NOT EXISTS meres_beallitas (kulcs TEXT PRIMARY KEY, ertek TEXT, ido INTEGER)',
];
// ADDITIV oszlopok (sema-seged.js): a mar letrehozott tablak is megkapjak
const BOVITES = [['kesei_kor_nap', 'INTEGER']];
const kesz = new WeakSet();
export async function forrasSema(db) {
  if (kesz.has(db)) return;
  await db.batch(SEMA.map((s) => db.prepare(s)));
  await oszlopokBiztosit(db, 'meres_forras', BOVITES);
  kesz.add(db);
}
export async function markasListaOlvas(db) {
  try {
    const r = await db.prepare("SELECT ertek FROM meres_beallitas WHERE kulcs = 'google_markas_kampanyok'").first();
    return markasListaErtelmez(r ? r.ertek : null);
  } catch (e) { return null; }
}
const megorzes = (env) => { const n = Number(env && env.MOSAIC_LPT_MEGORZES_NAP); return Number.isInteger(n) && n >= 7 && n <= 3650 ? n : MEGORZES_NAP; };
/**
 * A sor mentese: egy source_id-hoz egy sor, az ELSO iras nyer; kiveve, ha az elso cimke 'ismeretlen' volt es az ujabb mar nem az (egy kesobbi, jobb bizonyitekkal erkezo ismetles javithat). A regi sorok torlese: MEGORZES_NAP.
 * -> a tarolt sor valasz-alakja ({ cimke, bizonyitek_forras, klikk_potolt, kesei_fizetett }).
 */
export async function forrasMent(db, sor, { env = {} } = {}) {
  await forrasSema(db);
  await db.prepare('DELETE FROM meres_forras WHERE ido < ?1').bind(sor.ido - megorzes(env) * 86400).run();
  const frissit = OSZLOPOK.filter((k) => k !== 'source_id').map((k) => `${k} = excluded.${k}`).join(', ');
  await db.prepare(`INSERT INTO meres_forras (${OSZLOPOK.join(', ')}) VALUES (${OSZLOPOK.map((_, i) => '?' + (i + 1)).join(', ')}) ON CONFLICT(source_id) DO UPDATE SET ${frissit} WHERE meres_forras.forras_cimke = 'ismeretlen' AND excluded.forras_cimke <> 'ismeretlen'`)
    .bind(...OSZLOPOK.map((k) => (sor[k] === undefined ? null : sor[k]))).run();
  const t = await db.prepare('SELECT forras_cimke, bizonyitek_forras, klikk_potolt, kesei_fizetett FROM meres_forras WHERE source_id = ?1').bind(sor.source_id).first();
  return t ? valaszAlak(t) : valaszAlak(sor);
}

// ---------- HTTP ----------
const json = (o, status = 200, extra = {}) => {
  const h = new Headers({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  for (const [k, v] of Object.entries(extra)) { if (Array.isArray(v)) v.forEach((x) => h.append(k, x)); else h.set(k, v); } // tobb Set-Cookie (mh_lpt + mh_vid) fejlec is lehet
  return new Response(JSON.stringify(o), { status, headers: h });
};
export const ELES_HOST = /^(www\.)?mosaicheadspa\.hu$/;
/** Eles domain, *.pages.dev elonezet, helyi fejlesztes; minden mas host 404. */
export const hostEngedett = (host) => ELES_HOST.test(host) || /\.pages\.dev$/.test(host) || host === 'localhost' || host === '127.0.0.1';
export const lptKi = (env) => !!env && String(env.MOSAIC_LPT_KI) === '1';

/**
 * #495 (UJ-80) ERINTESNAPLO: a fizetett erkezes (vagy a napi 1 organikus / direkt visszateres: b.organikus === true) eseten az mh_vid suti (30 nap, gordulo) es az erintes-sor (meres_erintes).
 * A hozzajarulas-dontest a hivo mar meghozta (ugyanaz, mint az mh_lpt-nel: hozz.adv === false -> ide nem jutunk). FAIL-CLOSED: MERES_VID_BE != 1 vagy nincs kulcs -> null (nincs suti, nincs sor).
 * e: az erintesTisztit eredmenye (kv-vel, ha van). -> { fejlec: 'mh_vid=...' } | null. A D1-hiba NEM akadalyozza a sutit (de a sor elmarad), es az mh_lpt-t semmi nem erinti.
 */
async function vidKezel({ env, b, e, cookie, most }) {
  if (!vidMukodik(env) || !e) return null;
  if (hozzajarulasTisztit(b && b.hozz).adv !== true) return null; // az mh_vid-hez kifejezett marketing-hozzajarulas kell (a nem megadott sem eleg)
  const kulcs = vidKulcs(env);
  const vid = vidOlvas(cookie) || vidUj();
  if (env.KULCS_DB) {
    try {
      const vh = await vidHash(kulcs, vid);
      const markas = await markasListaOlvas(env.KULCS_DB);
      const { forras_cimke: cimke } = cimkez(e, markas);
      const kh = e.kp && e.kv ? await klikkHash(kulcs, e.kp, e.kv) : null;
      const sor = erintesSor({ e, cimke, vidHashErtek: vh, klikkHashErtek: kh, lap: b && b.lap, most });
      if (sor) await erintesIr(env.KULCS_DB, sor, { most });
    } catch (err) { console.error('erintesnaplo: hiba (a suti es az mh_lpt nem erintett)', String(err && err.message || err).slice(0, 200)); }
  }
  return { fejlec: vidSuti(vid) };
}

/**
 * /api/mosaic-forras
 *   POST { forras: {..tisztitott erintes + kv..}, hozz } -> Set-Cookie mh_lpt (fizetett erintes, marketing-hozzajarulassal) | torles (hozz.adv === false) | nincs teendo (nem fizetett erintes: NEM ir, NEM torol)
 *   GET  -> { ok, suti, platform, kor_nap, klikk: { gclid?|gbraid?|wbraid?|fbclid?|ttclid? } }: a sutibol (30 napon belul) visszanyerheto kattintasazonosito; ?adv=0 (a kliens tiltast jelez) -> ures
 * Csak azonos eredetrol (Origin / Sec-Fetch-Site), csak a Mosaic hostokrol; Cache-Control: no-store; MOSAIC_LPT_KI=1 -> 503.
 */
export async function forrasVegpont({ request, env = {} }, { most = sec(Date.now()) } = {}) {
  const metodus = request.method;
  if (metodus !== 'POST' && metodus !== 'GET') return json({ ok: false }, 405, { allow: 'GET, POST' });
  if (lptKi(env)) return json({ ok: false, ki: true }, 503);
  const url = new URL(request.url);
  if (!hostEngedett(url.hostname)) return json({ ok: false }, 404);
  if (!azonosEredet(request)) return json({ ok: false, miert: 'csak azonos eredetrol' }, 403);
  const cookie = request.headers.get('cookie') || '';
  if (metodus === 'GET') {
    if (url.searchParams.get('adv') === '0') return json({ ok: true, suti: false, klikk: {} });
    const s = lptOlvas(cookie, most);
    if (!s) return json({ ok: true, suti: false, klikk: {} });
    const klikk = {}; if (s.kv && s.kp && potlasAblakban(s)) klikk[s.kp] = s.kv; // csak a 7 napon beluli kattintas azonositoja (8-30 nap: kor_nap marad, azonosito nincs)
    return json({ ok: true, suti: true, platform: s.p, kor_nap: s.kor_nap, t: s.t, klikk });
  }
  if (Number(request.headers.get('content-length') || 0) > MAX_TORZS) return json({ ok: false, miert: 'tul nagy' }, 413);
  const szoveg = await request.text();
  if (szoveg.length > MAX_TORZS) return json({ ok: false, miert: 'tul nagy' }, 413);
  let b; try { b = JSON.parse(szoveg); } catch (e) { return json({ ok: false, miert: 'nem JSON' }, 400); }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return json({ ok: false, miert: 'nem objektum' }, 400);
  const hozz = hozzajarulasTisztit(b.hozz);
  if (hozz.adv === false) { // kifejezett elutasitas / visszavonas: sutit nem irunk, a meglevot toroljuk (az mh_vid-et is: #495)
    const torol = []; if (LPT_SUTI in sutik(cookie)) torol.push(lptSuti(null, true)); if (vidSutiVan(cookie)) torol.push(vidSuti(null, true));
    return json({ ok: true, suti: false }, 200, torol.length ? { 'set-cookie': torol.length === 1 ? torol[0] : torol } : {});
  }
  const e = erintesTisztit(b.forras, most, { kv: true });
  if (!e || !fizetett(e)) { // nem fizetett erkezes: az mh_lpt-t nem irja, nem torli; #495: a napi 1 organikus / direkt visszateres az erintesnaplo-ba (MERES_VID_BE=1 mellett)
    if (e && b.organikus === true) {
      if (!vidMukodik(env)) return json({ ok: true, suti: false, vid: false }); // kikapcsolt / kulcs nelkuli allapot: a kliens 7 napig nem probalkozik ujra
      try { const v = await vidKezel({ env, b, e, cookie, most }); if (v) return json({ ok: true, suti: false }, 200, { 'set-cookie': v.fejlec }); } catch (err) { /* az mh_vid hibaja nem akadalyoz */ }
    }
    return json({ ok: true, suti: false });
  }
  const eVid = { ...e }; // az erintesnaplo a tisztitott erintest kapja (rk-val, t-vel), az mh_lpt logika alatta valtozatlan
  delete e.rk;
  // ugyanaz a kattintas (azonos azonosito) ujratoltese / masik lapon valo ujranyitasa NEM frissiti az idot; minden mas (uj kattintas) a mostani szerver-idot kapja
  const regi = lptOlvas(cookie, most);
  e.t = regi && e.kv && regi.kv === e.kv && regi.kp === e.kp ? regi.t : most;
  const sutik2 = [lptSuti(e)];
  if (vidMukodik(env)) { try { const v = await vidKezel({ env, b, e: eVid, cookie, most }); if (v) sutik2.push(v.fejlec); } catch (err) { /* az mh_vid hibaja nem akadalyoz */ } }
  return json({ ok: true, suti: true }, 200, { 'set-cookie': sutik2.length === 1 ? sutik2[0] : sutik2 });
}

/**
 * A koszonooldali jelzes (POST /api/meres-erkezes) burka: a VALTOZATLAN kezelErkezes-t hivja, utana a meres_forras sort szamolja es irja, es a JSON-valaszhoz additiv "forras" mezot ad.
 * A hiba SOSEM torheti el a meglevo meres_erkezes mentest / a foglalast: minden itteni lepes try / catch-ben fut, hibaban a kezelErkezes valasza valtozatlanul megy vissza.
 * A shadow-lanc (meres_erkezes.attr): ha a bongeszobol NEM jott adott platform kattintasazonositoja, a sutibol potoljuk (MOSAIC_LPT_ATTR_POTLAS=0 kikapcsolja; hozzajarulas nelkul nem).
 */
export async function erkezesForrassal(request, env, kezel, deps = {}) {
  if (!env || lptKi(env) || request.method !== 'POST') return kezel(request, env, deps);
  const most = sec(deps.now ? deps.now() : Date.now());
  const cookie = request.headers.get('cookie') || '';
  let be = null, ujKeres = null, szerverPotlas = [];
  try {
    const szoveg = await request.clone().text();
    if (szoveg.length <= MAX_ERKEZES_TORZS) {
      const o = JSON.parse(szoveg);
      if (o && typeof o === 'object' && !Array.isArray(o)) {
        be = o;
        if (String(env.MOSAIC_LPT_ATTR_POTLAS) !== '0') {
          const p = attrPotlas(o, cookie, most);
          if (p.potolt.length) {
            const szoveg2 = JSON.stringify(p.be);
            if (szoveg2.length <= MAX_ERKEZES_TORZS) {
              const h = new Headers(request.headers); h.delete('content-length');
              ujKeres = new Request(request.url, { method: 'POST', headers: h, body: szoveg2 });
              szerverPotlas = p.potolt;
            }
          }
        }
      }
    }
  } catch (e) { be = null; ujKeres = null; szerverPotlas = []; }
  let valasz;
  try { valasz = await kezel(ujKeres || request, env, deps); }
  catch (e) { if (!ujKeres) throw e; valasz = await kezel(request, env, deps); szerverPotlas = []; } // a potlas hibaja nem torheti el a mentest
  if (!be || valasz.status !== 200 || !env.KULCS_DB) return valasz;
  try {
    const j = await valasz.clone().json();
    if (!j || j.ok !== true || !UZLETAGAK.includes(be.uzletag) || !SOURCE_ID_MINTA.test(String(be.source_id || ''))) return valasz;
    await forrasSema(env.KULCS_DB);
    const markas = await markasListaOlvas(env.KULCS_DB);
    // klikk_potolt csak akkor, ha a potlas TENYLEG mentodott: ha az esemeny mar kiment (frissitve:false), a meres_erkezes sor (attr) nem frissult - sem a szerver, sem a kliens jelzese nem szamit
    const mentve = j.frissitve !== false;
    const { sor } = forrasSor({ be: mentve ? be : { ...be, lpt_potlas: undefined }, cookieFejlec: cookie, most, markasLista: markas, szerverPotlas: mentve && ujKeres ? szerverPotlas : [] });
    const forras = await forrasMent(env.KULCS_DB, sor, { env });
    if (vidMukodik(env) && advEngedett(be)) { // #495: source_id -> vid_hash (az utvonal-zarashoz) + a fuggo utvonalak zarasa; hiba nem torheti el a valaszt
      try {
        const vid = vidOlvas(cookie);
        if (vid) await vidErkezesIr(env.KULCS_DB, { source_id: be.source_id, vid_hash: await vidHash(vidKulcs(env), vid), most });
        await utvonalLezar(env.KULCS_DB, { most, limit: 25 }); // a koszonooldali valasz elott fut: kis tetel; a maradekot a riport zarja
      } catch (err) { console.error('erintesnaplo: utvonal-hiba (a foglalas / a meres_erkezes mentese nem erintett)', String(err && err.message || err).slice(0, 200)); }
    }
    return new Response(JSON.stringify({ ...j, forras }), { status: valasz.status, headers: valasz.headers });
  } catch (e) {
    console.error('meres_forras: hiba (a foglalas / a meres_erkezes mentese nem erintett)', String(e && e.message || e).slice(0, 200));
    return valasz;
  }
}

/** A shadow-lanc attr-jaba a sutibol potolt kattintasazonosito (csak ha a bongeszobol az adott platformhoz nem jott; hozzajarulas nelkul nem; csak <= 7 napos kattintasnal). -> { be (masolat), potolt: [kattintasi parameter tipusok] } */
export function attrPotlas(be, cookieFejlec, most) {
  const nincs = { be, potolt: [] };
  if (!advEngedett(be)) return nincs;
  const s = lptOlvas(cookieFejlec, most);
  if (!s || !s.kv || !s.kp || !potlasAblakban(s)) return nincs; // csak a 7 napon beluli kattintas azonositoja potlodik
  const { adat } = erkezesTisztit(be.attr, most * 1000);
  const attr = be.attr && typeof be.attr === 'object' && !Array.isArray(be.attr) ? { ...be.attr } : {};
  let potolt = false;
  if (['gclid', 'gbraid', 'wbraid'].includes(s.kp) && !adat.google) { attr.google = { ...(attr.google && typeof attr.google === 'object' ? attr.google : {}), [s.kp]: { ertek: s.kv, ts: s.t } }; potolt = true; }
  else if (s.kp === 'fbclid' && !(adat.meta && (adat.meta.fbc || adat.meta.fbclid))) { attr.meta = { ...(attr.meta && typeof attr.meta === 'object' ? attr.meta : {}), fbclid: s.kv, ts: s.t }; potolt = true; }
  else if (s.kp === 'ttclid' && !adat.tiktok) { attr.tiktok = { ...(attr.tiktok && typeof attr.tiktok === 'object' ? attr.tiktok : {}), ttclid: { ertek: s.kv, ts: s.t } }; potolt = true; }
  return potolt ? { be: { ...be, attr }, potolt: [s.kp] } : nincs;
}
