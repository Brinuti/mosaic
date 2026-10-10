// MEDICAL PIERCING (MP) meresi reteg - tiszta fuggvenyek (nincs I/O). Elkulonitve a Mosaictol (MP-2b):
// sajat konyvtar, sajat konstansok, nincs kozos pixel-/konverzio-azonosito.
// Dontesek: MP-DECISION-LOG MP-4 (ertek = tenyleges ar), MP-5 (egy fo esemeny + uj/visszatero jeloles),
// MP-6 (tipus parameter), MP-13..MP-16 (Meta: Salonic Schedule marad; kifele csak minimalis, nem egeszsegugyi adat).

export const MP_HOST = 'www.medicalpiercing.hu';
export const MP_SALONIC_HOST = 'medicalpiercing.salonic.hu';

/** A 15 helyszin: Salonic placeId -> semleges varoskod (kifele csak ez mehet). */
export const HELYSZINEK = Object.freeze({
  6029: 'bp', 13422: 'bekescsaba', 10330: 'kecskemet', 10329: 'keszthely', 10357: 'miskolc', 9067: 'sopron',
  12169: 'szeged', 14229: 'szombathely', 11424: 'debrecen', 14144: 'kaposvar', 12348: 'nagykanizsa',
  12353: 'nyiregyhaza', 14145: 'szekesfehervar', 12237: 'zalaegerszeg', 12236: 'pecs',
});

// A koszonooldal-utvonalak utotagja -> normalizalt tipus (BELSO adat, kifele SOHA).
const UTOTAG_TIPUS = Object.freeze({
  mi: 'migren', shenmen: 'shenmen', klimax: 'klimax', slim: 'slim', allergia: 'allergia', maj: 'maj', lep: 'lep',
  vastagbel: 'vastagbel', '2piercing': '2piercing', '3piercing': '3piercing', '4piercing': '4piercing', '6piercing': '6piercing',
});
export const TIPUSOK = Object.freeze([...new Set([...Object.values(UTOTAG_TIPUS), 'pajzsmirigy', 'ful', 'paros', 'egyeb'])]);

/** Tipus a koszonooldal utvonalabol, tartalekkent a szolgaltatas nevebol. */
export function tipusNormal(utvonal = '', szolgaltatas = '') {
  const m = /\/foglalas-ok-([a-z0-9]+)\/?$/i.exec(String(utvonal));
  if (m && UTOTAG_TIPUS[m[1].toLowerCase()]) return UTOTAG_TIPUS[m[1].toLowerCase()];
  const s = String(szolgaltatas).toLowerCase();
  const db = /(\d)\s*(db|piercing)/.exec(s);
  if (db && ['2', '3', '4', '6'].includes(db[1])) return `${db[1]}piercing`;
  for (const [kulcs, nev] of [['migr', 'migren'], ['shen', 'shenmen'], ['klimax', 'klimax'], ['slim', 'slim'], ['allerg', 'allergia'],
    ['máj', 'maj'], ['maj', 'maj'], ['lép', 'lep'], ['vastagb', 'vastagbel'], ['pajzs', 'pajzsmirigy'], ['páros', 'paros'], ['paros', 'paros'], ['fül', 'ful']]) {
    if (s.includes(kulcs)) return nev;
  }
  return 'egyeb';
}

const egesz = (v) => { const n = Number(String(v ?? '').replace(/[^\d.-]/g, '')); return Number.isFinite(n) && String(v ?? '').trim() !== '' ? Math.round(n) : null; };

/**
 * A Salonic -> koszonooldal atiranyitas parameterei (first_booking, location, employee, bookingUrl, price, service, g, category).
 * -> { ok, hiba?, adat: { placeId, employeeId, startUnix, serviceId, ar, ujVendeg, tipus, kategoria, szolgaltatas, vendeg } }
 * A bookingUrl a Salonic foglalasi linkje (placeId, serviceId, employeeId, startDate unix).
 */
export function koszonoOldal(url) {
  let u; try { u = new URL(url); } catch (e) { return { ok: false, hiba: 'rossz_url' }; }
  const p = u.searchParams;
  let b = null; try { b = new URL(p.get('bookingUrl') || '', `https://${MP_SALONIC_HOST}/`); } catch (e) { b = null; }
  const bp = b ? b.searchParams : new URLSearchParams();
  const placeId = egesz(bp.get('placeId') ?? p.get('placeId'));
  const employeeId = egesz(bp.get('employeeId') ?? p.get('employeeId'));
  const startUnix = egesz(bp.get('startDate') ?? p.get('startDate'));
  if (!placeId || !HELYSZINEK[placeId]) return { ok: false, hiba: 'ismeretlen_helyszin' };
  if (!employeeId || !startUnix) return { ok: false, hiba: 'hianyos_kulcs' };
  const fb = String(p.get('first_booking') ?? '').toLowerCase();
  const szolgaltatas = p.get('service') || '';
  return {
    ok: true,
    adat: {
      placeId, employeeId, startUnix, serviceId: egesz(bp.get('serviceId') ?? p.get('serviceId')),
      ar: egesz(p.get('price')),
      ujVendeg: fb === 'true' ? true : fb === 'false' ? false : null,
      tipus: tipusNormal(u.pathname, szolgaltatas),
      kategoria: p.get('category') || '', szolgaltatas, vendeg: p.get('g') || null,
    },
  };
}

/** Determinisztikus kulcs es esemenyazonosito: a bongeszo es a szerver ugyanazt kepzi (Salonic UUID nelkul is). */
export const foglalasKulcs = ({ placeId, employeeId, startUnix }) => `${placeId}|${employeeId}|${startUnix}`;
export const esemenyId = (k) => `Foglalas:${typeof k === 'string' ? k : foglalasKulcs(k)}`;

/**
 * Ertek (MP-4 + GPT): 1) koszonooldali ar; 2) egyertelmu arlista-ar; 3) kulonben ertek nelkul (NEM 0 Ft, nem atlagar).
 * -> { ertek: number|null, ertek_forras: 'koszonooldal'|'arlista'|null, ertek_hianyzik: bool }
 */
export function ertekFeloldas({ ar = null, serviceId = null } = {}, arlista = {}) {
  if (Number.isFinite(ar) && ar > 0) return { ertek: ar, ertek_forras: 'koszonooldal', ertek_hianyzik: false };
  const l = serviceId != null ? arlista[serviceId] : undefined;
  if (Number.isFinite(l) && l > 0) return { ertek: Math.round(l), ertek_forras: 'arlista', ertek_hianyzik: false };
  return { ertek: null, ertek_forras: null, ertek_hianyzik: true };
}

// KIFELE MENO ADAT (MP-16 + adatminimalizalas): CSAK ezek a mezok. Tipus / kategoria / szolgaltatas / vendeg / nyers URL SOHA.
export const KIFELE_MEZOK = Object.freeze(['esemeny', 'esemeny_id', 'ido', 'ertek', 'penznem', 'uj_vendeg', 'helyszin', 'forras_url',
  'em', 'ph', 'fbc', 'fbp', 'ttclid', 'ttp', 'gclid', 'gbraid', 'wbraid']);
const AZONOSITO_MEZOK = Object.freeze(['em', 'ph', 'fbc', 'fbp', 'ttclid', 'ttp', 'gclid', 'gbraid', 'wbraid']);
export const SEMLEGES_URL =`https://${MP_HOST}/foglalas-ok`;
const ERZEKENY = /(migr|klimax|allerg|shenmen|slim|vastagb|pajzs|\bmaj\b|\blep\b|máj|lép|bookingurl|[?&]g=|service=|category=|foglalas-ok-)/i;

/** Igaz, ha az objektum barmely erteke vagy kulcsa erzekeny (egeszsegugyi tipus, vendegazonosito, nyers parameter). */
export function vanErzekeny(obj) {
  return JSON.stringify(obj ?? null).split(/[{},]/).some((d) => ERZEKENY.test(d));
}

/**
 * A kifele (Meta / TikTok / Google / GA4) kuldheto minimalis esemeny. Hozzajarulas nelkul: nincs hash-elt elerhetoseg es kattintasazonosito.
 * Dob, ha a kimenet erzekeny adatot tartalmazna (vedohalo: inkabb nem megy ki semmi).
 */
export function kifeleEsemeny(f, { hozzajarulas = false, hash = {}, kattintas = {} } = {}) {
  const ki = {
    esemeny: 'Foglalas', esemeny_id: esemenyId(f), ido: f.ido ?? null,
    ...(f.ertek != null ? { ertek: f.ertek, penznem: 'HUF' } : {}),
    uj_vendeg: f.ujVendeg === true ? 'igen' : f.ujVendeg === false ? 'nem' : 'ismeretlen',
    helyszin: HELYSZINEK[f.placeId] ?? 'ismeretlen', forras_url: SEMLEGES_URL,
  };
  if (hozzajarulas) {
    for (const k of ['em', 'ph']) if (hash[k]) ki[k] = hash[k];
    for (const k of ['fbc', 'fbp', 'ttclid', 'ttp', 'gclid', 'gbraid', 'wbraid']) if (kattintas[k]) ki[k] = String(kattintas[k]);
  }
  for (const k of Object.keys(ki)) if (!KIFELE_MEZOK.includes(k)) delete ki[k];
  // az azonositok (hash, kattintas-ID) veletlen karaktersorok: a tartalmi ellenorzes a tobbi mezore vonatkozik
  const tartalom = Object.fromEntries(Object.entries(ki).filter(([k]) => !AZONOSITO_MEZOK.includes(k)));
  if (vanErzekeny(tartalom)) throw new Error('mp_kifele_erzekeny_adat');
  return ki;
}

/**
 * A 7. napi riport 5 mutatoja (GPT 14:40) + forras szerinti bontas. sorok: a D1 foglalas-sorai
 * { salonic_id, d1: bool, forras: 'oldal'|'salonic', hozzajarulas: bool, fbclid: bool, fbc: bool, fbp: bool }.
 * salonicOsszes: a Salonic-levelek szama ugyanarra az idoszakra (igazsag).
 */
export function otMutato(sorok = [], salonicOsszes = 0) {
  const d1 = sorok.filter((s) => s.d1);
  const arany = (n, m) => ({ db: n, osszes: m, szazalek: m ? Math.round((n / m) * 1000) / 10 : null });
  const bont = (szuro) => {
    const r = d1.filter(szuro);
    return {
      meta_kattintas: arany(r.filter((s) => s.fbclid).length, r.length),
      hozzajarulas: arany(r.filter((s) => s.hozzajarulas).length, r.length),
      fbc: arany(r.filter((s) => s.hozzajarulas && s.fbc).length, r.length),
      fbp: arany(r.filter((s) => s.hozzajarulas && s.fbp).length, r.length),
      plusz_azonosito: arany(r.filter((s) => s.hozzajarulas && (s.fbc || s.fbp)).length, r.length),
    };
  };
  const ids = d1.map((s) => s.salonic_id).filter(Boolean);
  return {
    lefedettseg: arany(new Set(ids).size, salonicOsszes),
    duplikacio: ids.length - new Set(ids).size,
    osszes: bont(() => true), oldalrol: bont((s) => s.forras === 'oldal'), salonicbol: bont((s) => s.forras === 'salonic'),
  };
}
