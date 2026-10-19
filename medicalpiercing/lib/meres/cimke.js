// MEDICAL PIERCING – forras v2: munkameneten beluli UTOLSO FIZETETT KATTINTAS (last paid click), bizonyitek-mezok es a
// vegso forras-cimke (tiszta fuggvenyek + a /api/mp-forras suti-vegpont). Leiras: docs/MERES_GOOGLE_ARNYEK.md "Forras v2".
//
// Kozos szabaly (FORRASMERES-KOZOS-SZABALY-4-PROJEKT-2026-10-13.md, Feri dontese 2026-10-13, GPT-vel atnezve):
//   - havonta platformonkent a valos (Salonic-igazolt) foglalasok szama; platformok kozotti LAST PAID CLICK, 1 foglalas = 1 cimke;
//   - a forrast a foglalashoz ugyanabban a latogatasban HOZZAJARULAS NELKUL is hozza kell kotni (Feri kifejezett kerese, a jogi
//     kockazatot vallalja; platformkockazat nincs: semmi nem megy hirdetesi platformnak), extra urlapmezo nelkul.
// Hozzajarulas nelkul CSAK minimalis, tisztitott bizonyitek: utm_* (max 100 karakter, [A-Za-z0-9._~:+-]), a kattintasi
// parameter TIPUSA (gclid/gbraid/wbraid/fbclid/ttclid - az erteke SOHA), a hivatkozo KATEGORIAJA (a tartomanybol; URL nincs),
// az erintes ideje. Kattintasazonosito-ERTEK tovabbra is csak hirdetesi hozzajarulassal (forras.js, google-ads.js).
// Hirdetesi hozzajarulassal az utolso fizetett erintes 30 napig egy szerver altal irt, HttpOnly elso feles sutiben (mp_lpt) is el,
// a nyers kattintasazonositoval egyutt; cimket csak a 7 napon beluli ad (LPT_CIMKE_NAP), a 8-30 napos 'kesoi' jelzes.
import { hozzajarulas, sutik, ELES_HOST } from './google-ads.js';

export const FORRAS_VERZIO = 'mp_v2';
export const CIMKEK = Object.freeze(['meta', 'tiktok', 'google_nem_markas', 'google_markas', 'organikus_direkt', 'ismeretlen']);
export const KATT_PARAMOK = Object.freeze(['gclid', 'gbraid', 'wbraid', 'fbclid', 'ttclid']);
export const REFERRER_KAT = Object.freeze(['search', 'social', 'egyeb', 'nincs']);
export const UTM_MEZOK = Object.freeze(['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']);
export const FIZETETT_MEDIUM = Object.freeze(['cpc', 'ppc', 'paid', 'paid_social', 'paidsocial', 'paid_search', 'cpm']);
const META_FORRAS = ['meta', 'facebook', 'fb', 'instagram', 'ig'];
const TIKTOK_FORRAS = ['tiktok'];
const GOOGLE_FORRAS = ['google', 'adwords', 'googleads'];
export const LPT_SUTI = 'mp_lpt';
export const LPT_NAP = 30; // a suti elettartama (a 8-30 napos "kesoi" fizetett kattintas is olvashato, de cimket NEM ad)
// Feri dontese 2026-10-14 (FORRASMERES-KOZOS-SZABALY, mind a 4 projekt): a cimkét csak a 7 napon beluli fizetett kattintas adja
export const LPT_CIMKE_NAP = 7;
// A sutiben tarolt nyers kattintasazonosito (Feri 2026-10-19 21:51 "mehet"): csak hirdetesi hozzajarulassal, csak
// [A-Za-z0-9._-], 8-300 karakter; a 7 napos ablakon belul a foglalasi sor HIANYZO gclid/fbc/ttclid-jet potolja.
export const KATT_ID_MINTA = /^[A-Za-z0-9._-]{8,300}$/;
const UTM_MINTA = /^[A-Za-z0-9._~:+-]{1,100}$/;

/** Egy utm-ertek tisztitasa: trim, legfeljebb 100 karakter, csak [A-Za-z0-9._~:+-]; kulonben null (eldobjuk, nem javitjuk). */
export function utmTisztit(v) {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const s = String(v).trim();
  return UTM_MINTA.test(s) ? s : null;
}

const kis = (v) => (v == null ? '' : String(v).toLowerCase());

/** Fizetett-e a bizonyitek: barmely kattintasi parameter VAGY fizetett utm_medium. */
export function fizetett(b) {
  return !!b && (KATT_PARAMOK.includes(b.kattintas_param) || FIZETETT_MEDIUM.includes(kis(b.utm_medium)));
}

/** A fizetett erintes platformja (google|meta|tiktok) vagy null. Elobb a platform altal tett kattintasi parameter, utana az utm_source. */
export function fizetettPlatform(b) {
  if (!fizetett(b)) return null;
  const kp = b.kattintas_param;
  if (kp === 'gclid' || kp === 'gbraid' || kp === 'wbraid') return 'google';
  if (kp === 'fbclid') return 'meta';
  if (kp === 'ttclid') return 'tiktok';
  const s = kis(b.utm_source);
  if (META_FORRAS.includes(s)) return 'meta';
  if (TIKTOK_FORRAS.includes(s)) return 'tiktok';
  if (GOOGLE_FORRAS.includes(s)) return 'google';
  return null;
}

/** Visszafele kompatibilis forras_platform (google|meta|tiktok|egyeb|null) a bizonyitekbol. */
export function platformBizonyitekbol(b) {
  if (!b) return null;
  const p = fizetettPlatform(b);
  if (p) return p;
  return b.utm_source ? 'egyeb' : null;
}

/**
 * A bongeszo (assets/js/mp-meres.js) altal kuldott erintes ({ v, us, um, uc, ut, uco, kp, rk, t }) vagy a mp_lpt suti tartalma ->
 * tisztitott bizonyitek, vagy null. Ismeretlen mezo nem marad meg; a kattintasi parameterbol csak a TIPUS (feher lista).
 */
export function bizonyitekBemenet(e, most) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return null;
  const rk = REFERRER_KAT.includes(e.rk) ? e.rk : null;
  if (!rk) return null; // az erintes kotelezo resze: enelkul nem bizonyitek
  const t = Number(e.t);
  const b = {
    utm_source: utmTisztit(e.us), utm_medium: utmTisztit(e.um), utm_campaign: utmTisztit(e.uc), utm_term: utmTisztit(e.ut), utm_content: utmTisztit(e.uco),
    kattintas_param: KATT_PARAMOK.includes(e.kp) ? e.kp : null,
    referrer_kat: rk,
    forras_ido: Number.isInteger(t) && t > 1600000000 && (most == null || t <= most + 300) ? t : null,
  };
  return b;
}

/** A bizonyitek tomor alakja (suti / sessionStorage mezonevek). */
export function tomor(b) {
  const o = { v: FORRAS_VERZIO, us: b.utm_source, um: b.utm_medium, uc: b.utm_campaign, ut: b.utm_term, uco: b.utm_content, kp: b.kattintas_param, rk: b.referrer_kat, t: b.forras_ido,
    ki: b.kattintas_azonosito && b.kattintas_param && KATT_ID_MINTA.test(String(b.kattintas_azonosito)) ? String(b.kattintas_azonosito) : null };
  for (const k of Object.keys(o)) if (o[k] == null) delete o[k];
  return o;
}

const b64urlKi = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlBe = (s) => decodeURIComponent(escape(atob(String(s).replace(/-/g, '+').replace(/_/g, '/'))));

export function lptErtek(b) { return b64urlKi(JSON.stringify(tomor(b))); }

/**
 * A mp_lpt suti -> bizonyitek (csak fizetett, LPT_NAP napon beluli), kulonben null. A bizonyitekon:
 *   kesoi: true, ha a kattintas LPT_CIMKE_NAP-nal (7 nap) regebbi (cimket nem ad, csak jelzes);
 *   kor_nap: a kattintas kora egesz napban; kattintas_azonosito: a tarolt nyers azonosito (ha van es ervenyes).
 */
export function lptOlvas(cookieFejlec, most) {
  const v = sutik(cookieFejlec)[LPT_SUTI];
  if (!v || v.length > 2000) return null;
  let o; try { o = JSON.parse(b64urlBe(v)); } catch (e) { return null; }
  const b = bizonyitekBemenet(o, most);
  if (!b || !fizetett(b) || !b.forras_ido || most - b.forras_ido > LPT_NAP * 86400) return null;
  b.kor_nap = Math.max(0, Math.floor((most - b.forras_ido) / 86400));
  b.kesoi = most - b.forras_ido > LPT_CIMKE_NAP * 86400;
  b.kattintas_azonosito = b.kattintas_param && KATT_ID_MINTA.test(String(o.ki || '')) ? String(o.ki) : null;
  return b;
}

/** Kesoi (8-30 napos) fizetett kattintas jelzese a foglalasi sorhoz: 'kesoi:<platform>:<nap>' vagy null. */
export function kesoiJelzes(lpt) {
  if (!lpt || !lpt.kesoi) return null;
  return `kesoi:${fizetettPlatform(lpt) || 'egyeb'}:${lpt.kor_nap}`;
}

/**
 * A sutiben tarolt, 7 napon beluli nyers kattintasazonosito a foglalasi sor HIANYZO mezoihez (soha nem ir felul):
 * -> { google: {tipus, ertek, ido}|null, meta_fbc: string|null, meta_kattintas_ido, tiktok_ttclid: string|null, tiktok_kattintas_ido }
 */
export function lptAzonositok(lpt) {
  const o = { google: null, meta_fbc: null, meta_kattintas_ido: null, tiktok_ttclid: null, tiktok_kattintas_ido: null };
  if (!lpt || lpt.kesoi || !lpt.kattintas_azonosito || !lpt.forras_ido) return o;
  const e = lpt.kattintas_azonosito, t = lpt.forras_ido, kp = lpt.kattintas_param;
  if (kp === 'gclid' || kp === 'gbraid' || kp === 'wbraid') { if (/^[A-Za-z0-9_-]{8,300}$/.test(e)) o.google = { tipus: kp, ertek: e, ido: t }; }
  else if (kp === 'fbclid') { o.meta_fbc = `fb.1.${t * 1000}.${e}`; o.meta_kattintas_ido = t; }
  else if (kp === 'ttclid') { o.tiktok_ttclid = e; o.tiktok_kattintas_ido = t; }
  return o;
}

export function lptSuti(b, torol = false) {
  const ertek = torol ? '' : lptErtek(b);
  return `${LPT_SUTI}=${ertek}; Max-Age=${torol ? 0 : LPT_NAP * 86400}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

/**
 * A foglalas forras-bizonyiteke a koszonooldali jelzesbol:
 *   1) a munkamenet erintese (sessionStorage) - hozzajarulastol fuggetlen;
 *   2) ha a munkamenetben NINCS fizetett erintes ES van hirdetesi hozzajarulas: a 30 napos mp_lpt suti (utolso fizetett erintes).
 * -> { bizonyitek, bizonyitek_forras: 'munkamenet'|'suti'|null }
 */
export function bizonyitekValaszt(munkamenet, cookieFejlec, hirdetesiHozzajarulas, most) {
  if (munkamenet && fizetett(munkamenet)) return { bizonyitek: munkamenet, bizonyitek_forras: 'munkamenet' };
  const suti = hirdetesiHozzajarulas ? lptOlvas(cookieFejlec, most) : null;
  // csak a 7 napon beluli fizetett kattintas ad cimket; a 8-30 napos csak jelzes (kesoiJelzes), a cimke nem valtozik
  if (suti && !suti.kesoi) return { bizonyitek: suti, bizonyitek_forras: 'suti' };
  return { bizonyitek: munkamenet || null, bizonyitek_forras: munkamenet ? 'munkamenet' : null, kesoi: kesoiJelzes(suti) };
}

/**
 * A bongeszo jelzese szerint a munkamenet-erintes a 2 oras latogatas-tarolobol (localStorage "mp_forras_l") jott-e
 * (Feri dontese 2026-10-13): ilyenkor a 'munkamenet' bizonyitek-forras 'latogatas' lesz; a 'suti' (mp_lpt) marad.
 */
export function bizonyitekForrasTarolo(bizonyitekForras, tarolo) {
  return bizonyitekForras === 'munkamenet' && tarolo === 'latogatas' ? 'latogatas' : bizonyitekForras;
}

/** A "nincs_jel" diagnosztika (szemelyes adat / URL nelkul) feher listas ellenorzese; minden mas eldobva. */
export const DIAG_NAV = Object.freeze(['navigate', 'reload', 'back_forward', 'prerender']);
export const DIAG_ELSO_REF = Object.freeze(['belso', 'salonic', 'kereso', 'social', 'egyeb', 'nincs']);
export function diagBemenet(d) {
  const ki = { diag_oldalak: null, diag_nav: null, diag_opener: null, diag_elso_ref: null };
  if (!d || typeof d !== 'object' || Array.isArray(d)) return ki;
  if (Number.isInteger(d.oldalak) && d.oldalak >= 1) ki.diag_oldalak = Math.min(d.oldalak, 999);
  if (DIAG_NAV.includes(d.nav)) ki.diag_nav = d.nav;
  if (d.opener === 0 || d.opener === 1) ki.diag_opener = d.opener;
  if (DIAG_ELSO_REF.includes(d.elso_ref)) ki.diag_elso_ref = d.elso_ref;
  return ki;
}

/** mp_beallitas.google_markas_kampanyok -> kampany-ID tomb, vagy null (nincs beallitva). */
export function markasListaErtelmez(ertek) {
  if (ertek == null) return null;
  const l = String(ertek).split(',').map((s) => s.trim()).filter((s) => /^\d{1,20}$/.test(s));
  return l;
}

export async function markasListaOlvas(db) {
  try {
    const r = await db.prepare("SELECT ertek FROM mp_beallitas WHERE kulcs = 'google_markas_kampanyok'").first();
    return markasListaErtelmez(r ? r.ertek : null);
  } catch (e) { return null; }
}

/**
 * A vegso cimke - DETERMINISZTIKUS a tarolt bizonyitekbol (a beszuraskor es a riportban is ez fut, igy a markas lista
 * valtozasakor utolag ujraszamolhato). sor: mp_foglalas-sor (utm_*, kattintas_param, referrer_kat, forras_verzio,
 * forras_platform, forras_keret). markasLista: kampany-ID tomb vagy null.
 * -> { forras_cimke, ismeretlen_ok, cimke_megjegyzes }
 */
/**
 * Tartalek-bizonyitek a HOZZAJARULASSAL tarolt kattintasazonositokbol (gclid/gbraid/wbraid, fbc, ttclid + kattintasi ido):
 * a foglalas elotti 30 napon beluli legfrissebb fizetett kattintas platformja, kulonben null. (Last paid click: ha a
 * munkamenetben nincs fizetett erintes, de a hozzajarulo vendegnek van friss hirdetesi kattintasa, az nyer.)
 */
export function kattintasAzonositoPlatform(s) {
  if (!s || Number(s.hozzajarulas_hirdetes) !== 1) return null;
  const t = Number(s.foglalas_ido || s.letrehozva);
  const jo = (ido) => Number.isFinite(Number(ido)) && Number(ido) <= t + 300 && t - Number(ido) <= LPT_CIMKE_NAP * 86400; // 7 nap (Feri 2026-10-14)
  const j = [];
  if (s.kattintas_tipus && ['gclid', 'gbraid', 'wbraid'].includes(s.kattintas_tipus) && jo(s.kattintas_ido)) j.push(['google', Number(s.kattintas_ido)]);
  if (s.meta_fbc && jo(s.meta_kattintas_ido)) j.push(['meta', Number(s.meta_kattintas_ido)]);
  if (s.tiktok_ttclid && jo(s.tiktok_kattintas_ido)) j.push(['tiktok', Number(s.tiktok_kattintas_ido)]);
  j.sort((a, b) => b[1] - a[1]);
  return j.length ? j[0][0] : null;
}

export function cimkez(sor, markasLista) {
  const s = sor || {};
  const ki = (forras_cimke, ismeretlen_ok = null, cimke_megjegyzes = null) => ({ forras_cimke, ismeretlen_ok, cimke_megjegyzes });
  const vanBizonyitek = s.forras_verzio === FORRAS_VERZIO && REFERRER_KAT.includes(s.referrer_kat);
  const kap = kattintasAzonositoPlatform(s);
  const kapCimke = () => ki(kap === 'google' ? 'google_nem_markas' : kap, null, 'kattintas_azonosito');
  if (kap && (!vanBizonyitek || !fizetett(s))) return kapCimke();
  if (!vanBizonyitek) {
    // regi kliens (csak forras_platform) vagy nincs erintes a munkamenetben
    if (s.forras_verzio !== FORRAS_VERZIO && s.forras_platform) {
      if (s.forras_platform === 'google') return ki('google_nem_markas', null, 'regi_kliens');
      if (s.forras_platform === 'meta' || s.forras_platform === 'tiktok') return ki(s.forras_platform, null, 'regi_kliens');
      return ki('ismeretlen', 'regi_kliens');
    }
    if (s.forras_keret === 1) return ki('ismeretlen', 'iframe_munkamenet');
    // a munkamenet elso oldala a Salonicrol jott (kozvetlen Salonic-link: a hirdetesi kattintas a Salonicnal maradt)
    if (s.diag_elso_ref === 'salonic') return ki('ismeretlen', 'salonic_kozvetlen');
    return ki('ismeretlen', 'nincs_jel');
  }
  if (fizetett(s)) {
    const p = fizetettPlatform(s);
    if (!p) return ki('ismeretlen', 'hianyos_utm'); // fizetett medium, de ismeretlen utm_source
    if (p === 'google') {
      if (!s.utm_campaign) return ki('google_nem_markas', null, 'nincs_kampany_id');
      if (markasLista == null) return ki('google_nem_markas', null, 'markas_lista_hianyzik');
      return markasLista.includes(String(s.utm_campaign)) ? ki('google_markas') : ki('google_nem_markas');
    }
    // fbclid utm nelkul: organikus megosztasbol is jöhet (a Facebook minden kimeno linkre teszi) - megjegyzes, cimke marad
    if (p === 'meta' && s.kattintas_param === 'fbclid' && !FIZETETT_MEDIUM.includes(kis(s.utm_medium))) return ki('meta', null, 'fbclid_utm_nelkul');
    return ki(p);
  }
  if (s.utm_source) {
    const src = kis(s.utm_source);
    // platformnev medium nelkul: hianyos hirdetesi utm lehet - nem soroljuk organikusba
    if (!s.utm_medium && [...META_FORRAS, ...TIKTOK_FORRAS, ...GOOGLE_FORRAS].includes(src)) return ki('ismeretlen', 'hianyos_utm');
    return ki('organikus_direkt', null, 'organikus_utm');
  }
  if (s.referrer_kat === 'search') return ki('organikus_direkt', null, 'organikus_kereso');
  if (s.referrer_kat === 'social') return ki('organikus_direkt', null, 'organikus_social');
  if (s.referrer_kat === 'egyeb') return ki('organikus_direkt', null, 'hivatkozo');
  return ki('organikus_direkt', null, 'direkt');
}

const json = (o, status = 200, extra = {}) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra } });

/**
 * POST /api/mp-forras: a bongeszo a fizetett erkezeskor (es a hozzajarulas megadasa utan) kuldi a munkamenet erinteset.
 * Hirdetesi hozzajarulassal (mp_suti m1) ES fizetett erintessel: Set-Cookie mp_lpt (30 nap, HttpOnly, Secure, SameSite=Lax).
 * Hozzajarulas nelkul: suti NINCS; ha volt, toroljuk (visszavonas). Hozzajarulassal a nyers kattintasazonosito is a
 * HttpOnly sutibe kerul (b.kattintas = { t: tipus, e: ertek }; Feri 2026-10-19), hogy a kesobb visszatero foglalonal is meglegyen.
 */
export async function forrasVegpont({ request, env = {} }, { most = Math.floor(Date.now() / 1000) } = {}) {
  if (request.method !== 'POST') return json({ ok: false }, 405);
  if (String(env.MP_MERES_KI || '') === '1') return json({ ok: false, ki: true }, 503);
  const host = new URL(request.url).hostname;
  if (!(host === ELES_HOST || /\.pages\.dev$/.test(host) || host === 'localhost' || host === '127.0.0.1')) return json({ ok: false }, 404);
  const cookie = request.headers.get('cookie') || '';
  const hozz = hozzajarulas(cookie);
  if (!hozz.hirdetes) {
    const vanSuti = LPT_SUTI in sutik(cookie);
    return json({ ok: true, suti: false }, 200, vanSuti ? { 'set-cookie': lptSuti(null, true) } : {});
  }
  let b; try { b = await request.json(); } catch (e) { return json({ ok: false, hiba: 'rossz_keres' }, 400); }
  const biz = bizonyitekBemenet(b && b.forras, most);
  if (!biz || !fizetett(biz) || !biz.forras_ido || most - biz.forras_ido > LPT_NAP * 86400) return json({ ok: true, suti: false });
  // a nyers kattintasazonosito (csak ha a tipusa egyezik a bizonyitek kattintasi parameterevel es formailag ervenyes)
  const ki = b && b.kattintas && typeof b.kattintas === 'object' ? b.kattintas : null;
  if (ki && biz.kattintas_param && ki.t === biz.kattintas_param && KATT_ID_MINTA.test(String(ki.e || ''))) biz.kattintas_azonosito = String(ki.e);
  return json({ ok: true, suti: true }, 200, { 'set-cookie': lptSuti(biz) });
}
