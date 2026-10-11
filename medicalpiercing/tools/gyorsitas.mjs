// Betoltesi sorrend a lapokon (a build hivja, tools/build.mjs). A Wix a kepek harmadat
// azonnal es elsobbseggel kerte (a fooldalon 34 "fetchpriority=high" kep), a beagyazasokat
// (YouTube, terkep, Facebook, Trustindex) pedig mind a lap megnyitasakor - ettol volt lassu.
//
// - <iframe>: loading="lazy" - csak akkor toltodik, amikor a kepernyo kozelebe gorgetnek
//   (az elso kepernyon levo azonnal, mint eddig);
// - <img> a tools/hajtas.json alapjan (tools/hajtas-meres.mjs): az elso kepernyo kepei azonnal,
//   a legnagyobbak elsobbseggel (fetchpriority="high"); a tobbi lustan (loading="lazy",
//   decoding="async"), a kepernyo kozelebe gorgetve;
// - az elso kepernyo szovegenek betui elore kerve (<link rel="preload">), igy a szoveg nem a
//   tartalekbetuvel jelenik meg eloszor, es nem ugrik at (ettol randult a fejlec 8 px-et);
// - a kepek WebP-valtozata, ahol van (tools/webp.py): az <img> cimkekben es a hatterkepekben;
//   a megosztasi kep (og:image) es az ikonok az eredetiek maradnak;
// - a sajat, magatol indulo videok (Wix videodoboz) nem toltodnek le a lap megnyitasakor
//   (preload="none", autoplay nelkul): a klon.js inditja, amikor a kepernyo kozelebe ernek;
// - a harom kis sajat stiluslap (betuk, klon.css; egyutt ~5 kB tomoritve) a lapba agyazva, ugyanazon
//   a helyen: igy nem kell rajuk varni a megjelenites elott (PageSpeed: "renderelest letilto kerelmek").
// A meg fel nem mert lapokon a kepek betoltesi jeleihez es a betukhoz nem nyulunk.
import fs from 'node:fs';
import path from 'node:path';

const LEGFELJEBB_BETU = 6;
const KEPEK = path.resolve(import.meta.dirname, '../assets/img');
const WEBP = new Set(fs.existsSync(KEPEK) ? fs.readdirSync(KEPEK).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5)) : []);
const BEAGYAZOTT = ['wix-google-fonts', 'wix-fonts', 'klon'];
const stilus = new Map(BEAGYAZOTT.map((n) => {
  const f = path.resolve(import.meta.dirname, `../assets/css/${n}.css`);
  // a betuk cime a stiluslaphoz kepest relativ (../fonts/): a lapban gyokerhez kepest kell
  return [n, fs.existsSync(f) ? fs.readFileSync(f, 'utf8').replace(/url\((['"]?)\.\.\/fonts\//g, 'url($1/assets/fonts/') : null];
}));
const webpre = (s) => s.replace(/\/assets\/img\/([\w.-]+)\.(?:jpe?g|png)(?=[\s"'),?#]|$)/gi, (m, nev) => (WEBP.has(nev) ? `/assets/img/${nev}.webp` : m));

const attr = (cimke, nev) => {
  const m = new RegExp(`\\s${nev}="([^"]*)"`).exec(cimke);
  return m ? m[1] : null;
};
const nelkul = (cimke, nev) => cimke.replace(new RegExp(`\\s${nev}(?:="[^"]*")?(?=[\\s/>])`, 'g'), '');
const hozza = (cimke, szoveg) => cimke.replace(/^<([a-z]+)/i, `<$1 ${szoveg}`);
const utvonal = (src) => {
  if (!src || !src.startsWith('/')) return null;
  return src.split(/[?#]/)[0];
};

/** @param {string} html  @param {{img: string[], kiemelt: string[], betu: string[]} | undefined} adat */
export function gyorsit(html, adat) {
  let h = html.replace(/<iframe\b[^>]*>/gi, (c) => (attr(c, 'loading') ? c : hozza(c, 'loading="lazy"')));
  h = h.replace(/<link rel="stylesheet" href="\/assets\/css\/([\w-]+)\.css">/g, (c, n) => (stilus.get(n) ? `<style data-mp-css="${n}">${stilus.get(n)}</style>` : c));
  h = h.replace(/background-image:\s*url\([^)]*\)/gi, webpre);
  h = h.replace(/<video\b[^>]*>/gi, (c) => (/\sautoplay\b/.test(c) && /\ssrc="\/assets\/video\//.test(c)
    ? hozza(nelkul(nelkul(c, 'autoplay'), 'preload'), 'preload="none"') : c));
  if (!adat) return h.replace(/<img\b[^>]*>/gi, webpre);
  const lathato = new Set(adat.img), kiemelt = new Set(adat.kiemelt);
  h = h.replace(/<img\b[^>]*>/gi, (c) => {
    const u = utvonal(attr(c, 'src'));
    if (!u) return webpre(c);
    const k = webpre(nelkul(nelkul(nelkul(c, 'loading'), 'fetchpriority'), 'decoding'));
    if (kiemelt.has(u)) return hozza(k, 'fetchpriority="high"');
    if (lathato.has(u)) return k;
    return hozza(k, 'loading="lazy" decoding="async"');
  });
  const betuk = adat.betu.slice(0, LEGFELJEBB_BETU).filter((u) => /^\/assets\/fonts\/[\w.-]+\.woff2$/.test(u));
  if (betuk.length) {
    const linkek = betuk.map((u) => `<link rel="preload" href="${u}" as="font" type="font/woff2" crossorigin>`).join('\n');
    // a <head> elejere (a viewport utan): a Wix fejreszeben fel MB beagyazott stilus all, a
    // betuk stiluslapja csak utana jonne - igy a bongeszo mar az elso kilobajtoknal keri oket
    const m = /<meta name="viewport"[^>]*>/i.exec(h) || /<meta charset[^>]*>/i.exec(h) || /<head\b[^>]*>/i.exec(h);
    if (m) h = h.slice(0, m.index + m[0].length) + '\n' + linkek + h.slice(m.index + m[0].length);
  }
  return h;
}
