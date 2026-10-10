// A Wixtol orokolt, a klonban semmire nem hasznalt kod kiszedese a kesz lapokbol (tools/build.mjs).
// A klon/ forras valtozatlan marad; a lapok kinezete es mukodese nem valtozik
// (ellenorzes: tools/klon-regresszio.mjs, a takaritas elotti es utani build kepkockankent).
//
// Mit veszunk ki:
//  - a Wix-szerkeszto meta-cimkeit (generator, X-Wix-*, etag "bug", skype_toolbar,
//    fb_admins_meta_tag, X-UA-Compatible); a kereso-igazolo es Facebook-cimkek maradnak;
//  - a Wix belso keresojere mutato strukturalt adatot (SearchAction: a klonban nincs /search);
//  - a Wix futtatokornyezetenek adat-attributumait, amelyekre se a lapok CSS-e, se a klon.js /
//    suti.js nem hivatkozik (kepadatok, Ricos-szerkeszto jelolesek, Pinterest-cimkek stb.);
//  - az oldalon belul ketszer szereplo, azonos stilusblokkok korabbi peldanyat (a kesobbi
//    marad, igy a kaszkad sorrendje nem valtozik).
// Ami marad: minden merokod (suti.js), a Convertize A/B-teszt, a JSON-LD (a SearchAction
// kivetelevel), a format-detection (iOS: ne legyen a telefonszambol link).

const META = [
  /<meta name="generator" content="Wix\.com Website Builder">\s*/g,
  /<meta http-equiv="X-UA-Compatible" content="IE=edge">\s*/g,
  /<meta name="skype_toolbar" content="[^"]*">\s*/g,
  /<meta http-equiv="X-Wix-[^"]*" content="[^"]*">\s*/g,
  /<meta http-equiv="etag" content="bug">\s*/g,
  /<meta name="fb_admins_meta_tag" content="[^"]*">\s*/g,
];

// a dist/ osszes lapjanak CSS-et es a sajat szkripteket atnezve egyikre sincs hivatkozas
// (2026-10-10; uj attributum csak ugyanilyen ellenorzes utan kerulhet ide)
export const FELESLEGES_ATTR = [
  'data-image-info', 'data-href', 'data-ricos-paragraph', 'data-bg-effect-name', 'data-has-ssr-src',
  'data-hash', 'data-block-level-container', 'data-ssr-src-done', 'data-url', 'data-bbox',
  'data-ricos-style-hash', 'data-ricos-heading', 'data-pin-url', 'data-pin-nopin', 'data-pin-media',
  'data-media-position-override', 'data-media-height-override-type', 'data-main-content',
  'data-content-hook', 'data-player-name', 'data-dom-store', 'data-video-info', 'data-is-responsive',
  'data-rce-version', 'data-render', 'data-animate-blur', 'data-load-done', 'data-transitioned',
];
const ATTR = new RegExp(`\\s(?:${FELESLEGES_ATTR.join('|')})(?:="[^"]*")?(?=[\\s/>])`, 'g');

export function takarit(html) {
  let h = html;
  for (const m of META) h = h.replace(m, '');
  h = h.replace(/<script type="application\/ld\+json">((?:(?!<\/script>)[\s\S])*?"SearchAction"[\s\S]*?)<\/script>\s*/g, '');
  // csak a cimkeken belul (a szovegben nem): <tag ...> reszek
  h = h.replace(/<[a-zA-Z][^<>]*>/g, (cimke) => (cimke.includes(' data-') ? cimke.replace(ATTR, '') : cimke));
  // oldalon beluli duplikalt stilusblokkok: a korabbi peldany megy ki
  const blokkok = [...h.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)];
  const utolso = new Map();
  for (const b of blokkok) utolso.set(b[1], b.index);
  const torlendo = blokkok.filter((b) => b[1].length > 200 && utolso.get(b[1]) !== b.index);
  for (const b of torlendo.reverse()) h = h.slice(0, b.index) + h.slice(b.index + b[0].length);
  return h;
}
