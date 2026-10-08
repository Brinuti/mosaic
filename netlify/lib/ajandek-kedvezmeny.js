// Kedvezmenykodok az ajandekkartya-vasarlasnal (a tulajdonos kerese, 2026-10-08): a vevo a kodot beirja, es a kartya arabol 10%-ot enged a motor.
// A kartya ERTEKE nem valtozik (a Salonic-kupon a teljes ertekre szol), csak a fizetendo osszeg es a szamla tetelei.
// A kodok a SZERVEREN vannak (nem az ajandek-adat*.js-ben: az a bongeszobe is eljut, a lista nem latszhat). Mindharom kereskedonel (Head Spa, lezer,
// oxigen) ugyanez a lista ervenyes; a kod egy kereskedon belul tobbszor, korlatlanul hasznalhato (a Salonicban 1000-szeres), a hasznalat a
// PaymentIntent metadataban (kedv_kod) latszik. Az octoberi -20% akciota osszevonhato: a kedvezmeny az MAR akcios arbol szamolodik.
// Kikapcsolas: AJANDEK_KEDVEZMENY="0" (kornyezeti valtozo) vagy az adat KEDVEZMENY: false mezoje.

export const KEDVEZMENY_SZAZALEK = 10;
export const KEDVEZMENYKODOK = Object.freeze([
  'BETTI10', 'BRIGI10', 'DORI10', 'ENIKO10', 'FANNI10', 'GINA10',
  'JANKA10', 'JUDIT10', 'MELI10', 'MONI10', 'NIKI10', 'NOEL10',
  'TUNDI10', 'VIKI10', 'VIVISZ10', 'VIVIV10', 'WIKI10', 'ZSOFI10',
]);
const KODOK = new Set(KEDVEZMENYKODOK);

// "betti10", " Betti 10 ", "BETTI-10" -> "BETTI10"; ervenytelen / ures bemenetre ''
export function kedvezmenyKodEgysegesit(nyers) {
  if (typeof nyers !== 'string') return '';
  return nyers.normalize('NFC').toUpperCase().replace(/[\s\-_.]/g, '').slice(0, 24);
}

// -> { kod, szazalek } | null
export function kedvezmenyKeres(nyers, { bekapcsolva = true } = {}) {
  if (!bekapcsolva) return null;
  const kod = kedvezmenyKodEgysegesit(nyers);
  return KODOK.has(kod) ? { kod, szazalek: KEDVEZMENY_SZAZALEK } : null;
}

// A fizetendo osszeg egesz forintra kerekitve (a Stripe HUF-nal csak egesz forintot fogad el).
export function kedvezmenyesAr(ar, szazalek) {
  return Math.round(Number(ar) * (100 - Number(szazalek)) / 100);
}

// A szamla tetelei a kedvezmeny utan: minden tetel aranyosan, a kerekitesi maradek a legnagyobb tetelre kerul, hogy az osszeg PONTOSAN a fizetendo
// osszeg legyen. A tetelek neve / ado-jellege valtozatlan.
export function kedvezmenyesTetelek(tetelek, szazalek) {
  if (!Array.isArray(tetelek) || !tetelek.length) return tetelek;
  const ossz = tetelek.reduce((o, t) => o + t.ft, 0);
  const cel = kedvezmenyesAr(ossz, szazalek);
  const uj = tetelek.map((t) => ({ ...t, ft: kedvezmenyesAr(t.ft, szazalek) }));
  const elteres = cel - uj.reduce((o, t) => o + t.ft, 0);
  if (elteres) {
    let nagy = 0;
    uj.forEach((t, i) => { if (t.ft > uj[nagy].ft) nagy = i; });
    uj[nagy].ft += elteres;
  }
  return uj;
}
