// MEDICAL PIERCING - forras-cimke, onbevallas es Meta / TikTok kattintasazonositok (tiszta fuggvenyek, nincs I/O).
//
// 1) forras_platform: a bongeszo (assets/js/mp-meres.js) a munkamenet elso erkezesebol kepzett DURVA csatornanevet kuldi
//    (google / meta / tiktok / egyeb). Hozzajarulastol fuggetlen - Feri kifejezett kerese (2026-10-13 07:36: "Kifejezetten
//    azt kerem, hogy hozzajarulas nelkul is menjen el."), a jogi kockazatot o vallalja. Azonosito nincs benne, semmilyen
//    hirdetesi platformnak nem megy, csak a sajat D1-be. Ismeretlen ertek -> null (= kozvetlen / ismeretlen).
// 2) onbevallas: a koszonooldali "Honnan hallottal rolunk?" kartya egy kattintasa.
// 3) Meta (fbclid -> fbc, _fbc, _fbp) es TikTok (ttclid, _ttp) azonositok: CSAK hirdetesi hozzajarulassal (a hivo dont
//    a sutibol), konzervativ formatum-ellenorzessel. Most SEHOVA nem mennek, csak a D1-ben vannak (90 napig).
import { sutik } from './google-ads.js';

export const PLATFORMOK = Object.freeze(['google', 'meta', 'tiktok', 'egyeb']);
export const ONBEVALLASOK = Object.freeze(['tiktok', 'meta', 'google', 'ismeros', 'egyeb']);

/** A bongeszo altal kuldott csatornanev ellenorzese: csak a feher lista, kulonben null. */
export function forrasPlatform(v) {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return PLATFORMOK.includes(s) ? s : null;
}

/** A koszonooldali kerdes valasza: csak a feher lista, kulonben null. */
export function onbevallasErtek(v) {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return ONBEVALLASOK.includes(s) ? s : null;
}

const ID = /^[A-Za-z0-9._-]{8,512}$/;
const FBC = /^fb\.[0-2]\.(\d{10,13})\.([A-Za-z0-9._-]{8,512})$/;
const FBP = /^fb\.[0-2]\.(\d{10,13})\.(\d{5,25})$/;
const TTP = /^[A-Za-z0-9._-]{8,128}$/;
const NAP90 = 90 * 86400;
const mpbe = (n) => (String(n).length >= 13 ? Math.floor(Number(n) / 1000) : Number(n));

export const URES_PLATFORM_ID = Object.freeze({ meta_fbc: null, meta_fbp: null, meta_kattintas_ido: null, tiktok_ttclid: null, tiktok_ttp: null, tiktok_kattintas_ido: null });

/**
 * Meta / TikTok azonositok a bongeszo (hozzajarulassal tarolt mp_gk: { fbclid|ttclid: { ertek, ido } }) es a sajat tartomany
 * sutijei (_fbc, _fbp, _ttp - a pixelek csak hozzajarulassal hozzak letre) alapjan. A HIVO felelossege, hogy csak hirdetesi
 * hozzajarulassal hivja. -> { meta_fbc, meta_fbp, meta_kattintas_ido, tiktok_ttclid, tiktok_ttp, tiktok_kattintas_ido }
 */
export function platformAzonositok(bongeszo, cookieFejlec, most) {
  const o = { ...URES_PLATFORM_ID };
  const b = bongeszo && typeof bongeszo === 'object' ? bongeszo : {};
  const s = sutik(cookieFejlec);
  const friss = (ido) => Number.isFinite(ido) && ido <= most + 300 && most - ido <= NAP90;
  // fbc: a legfrissebb a _fbc suti es a tarolt fbclid-bol kepzett "fb.1.<ms>.<fbclid>" kozul
  const fbc = [];
  const m = FBC.exec(String(s._fbc || ''));
  if (m) fbc.push({ ertek: m[0], ido: mpbe(m[1]) });
  if (b.fbclid && ID.test(String(b.fbclid.ertek || '')) && Number.isFinite(+b.fbclid.ido)) {
    const ido = Math.floor(+b.fbclid.ido);
    fbc.push({ ertek: `fb.1.${ido * 1000}.${b.fbclid.ertek}`, ido });
  }
  const jo = fbc.filter((x) => friss(x.ido)).sort((x, y) => y.ido - x.ido)[0];
  if (jo && FBC.test(jo.ertek)) { o.meta_fbc = jo.ertek; o.meta_kattintas_ido = jo.ido; }
  if (FBP.test(String(s._fbp || ''))) o.meta_fbp = String(s._fbp);
  if (b.ttclid && ID.test(String(b.ttclid.ertek || '')) && friss(Math.floor(+b.ttclid.ido))) {
    o.tiktok_ttclid = String(b.ttclid.ertek); o.tiktok_kattintas_ido = Math.floor(+b.ttclid.ido);
  }
  if (TTP.test(String(s._ttp || ''))) o.tiktok_ttp = String(s._ttp);
  return o;
}

export const vanPlatformId = (o) => !!(o && (o.meta_fbc || o.meta_fbp || o.tiktok_ttclid || o.tiktok_ttp));
