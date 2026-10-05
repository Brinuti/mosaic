// Wix-felugro (lightbox) gombok, amelyekhez a klonban NINCS felugro sablon (<template id="mh-popup-ID">): ezek a gombok semmit sem csinalnak.
// A Wix-es oldalon a gomb egy Wix-urlapot nyitott (kupon-kerés, visszahivas-kérés); az urlap tartalma nem kerult at, es a Wix hattere sincs mar.
// A gomb helyette a megfelelo uzletag foglalo-retegere mutat (ugyanaz a link, mint az oldal tobbi foglalas-gombja).
//   - 30szazalek: "KEREM A 30%-OS KUPONT!" (tn2x8)  -> fodraszat foglalo
//   - pmu-melitta: "TELEFONOS KONZULTACIO!" (s2q06) -> sminktetovalas foglalo (abban a telefonos konzultacio kerese is benne van)
// A tools/test-halott-gombok.mjs ellenorzi, hogy a kesz oldalakon nem marad sablon nelkuli felugro-gomb.
export const POPUP_CELOK = Object.freeze({
  '30szazalek': { tn2x8: 'hair' },
  'pmu-melitta': { s2q06: 'pmu' },
});

/** HTML-oldal: a sablon nelkuli popup-gombok -> /foglalo-motor?business=<uzletag>. Ami mas oldal / van sablon, valtozatlan. */
export function popupAtkot(html, fajlnev) {
  const nev = String(fajlnev).replace(/\.html$/, '').replace(/^.*\//, '');
  const celok = POPUP_CELOK[nev];
  let db = 0;
  if (!celok) return { html, db };
  const uj = html.replace(/<a\b([^>]*\bdata-popupid="([^"]+)"[^>]*)>/g, (egesz, attr, id) => {
    const uzletag = celok[id];
    if (!uzletag || html.includes('id="mh-popup-' + id + '"') || /\bhref="/.test(attr)) return egesz;
    db++;
    const tiszta = attr.replace(/\s*data-popupid="[^"]*"/, '').replace(/\s*aria-haspopup="[^"]*"/, '').replace(/\s*role="button"/, '');
    return `<a${tiszta} href="/foglalo-motor?business=${uzletag}">`;
  });
  return { html: uj, db };
}
