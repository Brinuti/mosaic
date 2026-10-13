// GYOGYTORNASZOM.HU foglalomotor - a sutisav (CookieYes) hozzajarulas-allapota a Cookie fejlecbol (szerveroldali olvasas).
// A CookieYes sutije: "cookieyes-consent=consentid:<..>,consent:yes,action:yes,necessary:yes,functional:no,analytics:yes,performance:no,advertisement:yes,other:no".
// Allapotok: 'igen' (a hirdetesi / marketing kategoria elfogadva), 'nem' (a vendeg dontott, de nincs hirdetesi hozzajarulas), 'nincs_dontes' (nincs suti / ertelmezhetetlen).
// A foglalas alapjan hozzajarulas nelkul is megy a (24 oras) munkamenet-forras, ha a GY_ATTR_NELKUL kapcsolo = "1" (Feri dontese, 2026-10-13); a 30 napos suti csak "igen"-nel.

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

/** @returns {{allapot:'igen'|'nem'|'nincs_dontes', marketing:boolean, analitika:boolean}} */
export function hozzajarulas(cookieFejlec) {
  const s = sutik(cookieFejlec);
  const nyers = s['cookieyes-consent'];
  if (!nyers) return { allapot: 'nincs_dontes', marketing: false, analitika: false };
  let t = nyers;
  try { t = decodeURIComponent(nyers); } catch (e) { /* marad */ }
  const m = Object.fromEntries(t.split(',').map((p) => { const i = p.indexOf(':'); return i > 0 ? [p.slice(0, i).trim(), p.slice(i + 1).trim()] : [p, '']; }));
  if (m.action !== 'yes' && m.consent !== 'yes') return { allapot: 'nincs_dontes', marketing: false, analitika: false };
  const marketing = m.advertisement === 'yes';
  return { allapot: marketing ? 'igen' : 'nem', marketing, analitika: m.analytics === 'yes' };
}
