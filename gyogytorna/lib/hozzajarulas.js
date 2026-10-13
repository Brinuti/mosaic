// GYOGYTORNASZOM.HU foglalomotor - a SAJAT sutisav hozzajarulas-allapota a Cookie fejlecbol (szerveroldali olvasas). CookieYes nincs (Feri, 2026-10-13).
// Suti: gy_suti=v1-s<0|1>-m<0|1>-t<unix mp>  (s = statisztika, m = marketing; a sav (public/assets/js/suti.js) allitja, 365 nap, feles suti, domain=gyogytornaszom.hu).
// Allapotok: 'igen' (marketing elfogadva), 'nem' (a vendeg dontott, de nincs marketing-hozzajarulas), 'nincs_dontes' (nincs / hianyzo / ervenytelen suti = NINCS hozzajarulas).
// A foglalas mukodese nem fugg a hozzajarulastol; hozzajarulas nelkul is megy a (24 oras) munkamenet-forras, ha a GY_ATTR_NELKUL kapcsolo = "1" (Feri dontese, 2026-10-13); a 30 napos suti csak "igen"-nel.

export function sutik(fejlec) {
  const o = {};
  for (const resz of String(fejlec || '').split(';')) {
    const i = resz.indexOf('=');
    if (i < 1) continue;
    const k = resz.slice(0, i).trim();
    if (!(k in o)) o[k] = resz.slice(i + 1).trim();
  }
  return o;
}

export const SUTI_HOZZAJARULAS = 'gy_suti';
const SUTI_MINTA = /^v1-s([01])-m([01])-t(\d{9,11})$/;

/** @returns {{allapot:'igen'|'nem'|'nincs_dontes', marketing:boolean, analitika:boolean}} */
export function hozzajarulas(cookieFejlec) {
  const nincs = { allapot: 'nincs_dontes', marketing: false, analitika: false };
  const nyers = sutik(cookieFejlec)[SUTI_HOZZAJARULAS];
  const m = nyers && SUTI_MINTA.exec(nyers);
  if (!m) return nincs;
  const t = +m[3];
  if (t > Date.now() / 1000 + 86400 || t < Date.now() / 1000 - 400 * 86400) return nincs; // jovobeli / 13 honapnal regebbi dontes ervenytelen (a sav 365 nap utan ujra kerdez)
  const marketing = m[2] === '1';
  return { allapot: marketing ? 'igen' : 'nem', marketing, analitika: m[1] === '1' };
}
