// Az Evelin-oldal UJ, hirdetesi valtozatanak generatora (Google Ads FOD-3 landing, brief 4. szakasz): foglalas/noi-hajfestes-evelin-uj.html
//
//   node tools/hair-oldalak-evelin-uj.mjs             legyartja / frissiti az oldalt
//   node tools/hair-oldalak-evelin-uj.mjs --ellenoriz   csak osszeveti a fajlt a generator kimenetevel (eltereskor: kilepesi kod 1) - a teszt ezt hasznalja
//
// NINCS ELESBEN: noindex + onmagara mutato canonical, nincs ra link sehonnan, nincs a sitemapben, a meglevo /noi-hajfestes-budapest (es a tobbi fodraszat-oldal) valtozatlan.
// A cim: /noi-hajfestes-evelin-uj (a /noi-hajfestes-budapest-uj cim foglalt: netlify/lib/utvonal.js 301-gyel a meglevo oldalra iranyit).
// A meglevo 4 oldal generatora a tools/hair-oldalak.mjs (ahhoz ez nem nyul; az --ellenoriz csak azt veti ossze).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { FODRASZOK, SZALON, KEPEK, GYOKER, konzultacio } from './hair-oldalak/adat.mjs';
import { SPRITE, LIGHTBOX } from './hair-oldalak/sablon.mjs';
import { evelinUjTorzs, stickyEvelinUj, META_EVELIN_UJ } from './hair-oldalak/sablon-evelin-uj.mjs';

export const ORIGIN = 'https://www.mosaicheadspa.hu';
export const FAJL_NEV = 'noi-hajfestes-evelin-uj';
const SALONIC = { place: 10823, naptar: 'f2bf7672-fa03-f092-e14b-fc23577e5ab2', konzultacio: konzultacio().id, fodraszok: Object.fromEntries(Object.values(FODRASZOK).map((x) => [x.kulcs, x.id])) };

export function oldal() {
  const m = META_EVELIN_UJ(), kep = KEPEK.portre.evelin(), url = `${ORIGIN}/${FAJL_NEV}`, f = FODRASZOK.evelin;
  const adat = JSON.stringify(SALONIC).replace(/"/g, '&quot;');
  const jsonLd = [
    {
      '@context': 'https://schema.org', '@type': 'HairSalon', name: SZALON.nev, url: ORIGIN + '/noi-fodraszat-budapest', telephone: '+36202474444',
      address: { '@type': 'PostalAddress', streetAddress: 'Bécsi út 2.', addressLocality: 'Budapest', postalCode: '1023', addressCountry: 'HU' },
      openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '08:00', closes: '20:00' }],
    },
    { '@context': 'https://schema.org', '@type': 'Person', name: f.teljesNev, jobTitle: 'Fodrász', worksFor: { '@type': 'HairSalon', name: SZALON.nev }, image: ORIGIN + kep.src },
  ];
  return `<!DOCTYPE html>
<html lang="hu">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${m.title}</title>
<meta name="description" content="${m.leiras}">
<meta name="robots" content="noindex, nofollow">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${m.title}">
<meta property="og:description" content="${m.leiras}">
<meta property="og:image" content="${ORIGIN}${kep.src}">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="MOSAIC Hair">
<meta property="og:type" content="website">
<link rel="icon" href="/assets/img/c2eb0f_b001e2c55098446da3e38ff055e20354.png" type="image/png">
<link rel="preload" href="${kep.src}" as="image" fetchpriority="high">
<link rel="preload" href="/assets/fonts/playfair-display-500-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/css/wix-google-fonts.css">
<link rel="stylesheet" href="/assets/css/wix-fonts.css">
<link rel="stylesheet" href="/assets/css/hair-landing.css">
<link rel="stylesheet" href="/assets/css/hair-evelin-uj.css">
<noscript><style>main.hl .ar-csop[hidden]{display:block!important}main.hl .ar-fulek{display:none}</style></noscript>
<script src="/assets/js/suti.js"></script>
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body data-hair="${adat}">
<!--
  MOSAIC Hair - Evelin-oldal UJ, hirdetesi valtozata (Google Ads FOD-3, brief 4. szakasz). GENERALT FAJL: ne szerkeszd kezzel.
  Forras: tools/hair-oldalak/sablon-evelin-uj.mjs (szekciok), tools/hair-oldalak/adat.mjs + salonic-hair.json (arak: a Salonic-pillanatkep); generalas: node tools/hair-oldalak-evelin-uj.mjs
  NINCS ELESBEN: /${FAJL_NEV} (noindex, onmagara mutato canonical, nincs ra link, nincs a sitemapben). A meglevo oldal valtozatlan: /noi-hajfestes-budapest.
  Az oldalon belul NINCS #horgony-link (a GTM History Change minden hash-valtozasra merest inditana): a gorgetest a hair-landing.js, a Terkep / ertekeles-sor ([data-gorget]) gombjaiet a hair-evelin-uj.js vegzi.
  Foglalas: a gombok a /foglalo-motor?business=hair&staff=evelin... linkek (a launcher a retegben nyitja meg); a fejlec / Info-ablak / lablec gombjai a business=hair foglalora mutatnak.
-->

<!--mh-fejlec-->
<!--mh-menu-aktiv:/noi-hajfestes-budapest-->
<!--mh-foglalas:business=hair-->
<!--mh-nyitvatartas:hetkoznap-->

${SPRITE}

${evelinUjTorzs()}

${stickyEvelinUj()}

<!--mh-lablec-->

${LIGHTBOX}

<script src="/assets/js/klon.js" defer></script>
<script src="/assets/js/hair-landing.js" defer></script>
<script src="/assets/js/hair-evelin-uj.js" defer></script>
</body>
</html>
`;
}

const fajl = path.join(GYOKER, 'foglalas', FAJL_NEV + '.html');
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const uj = oldal();
  if (process.argv.includes('--ellenoriz')) {
    const regi = fs.existsSync(fajl) ? fs.readFileSync(fajl, 'utf8').replace(/\r\n/g, '\n') : null; // Windowson az autocrlf CRLF-et ir
    if (regi !== uj) { console.log('ELTER: foglalas/' + FAJL_NEV + '.html'); console.log('Futtasd: node tools/hair-oldalak-evelin-uj.mjs'); process.exit(1); }
    console.log('rendben: foglalas/' + FAJL_NEV + '.html egyezik a generator kimenetevel');
  } else { fs.writeFileSync(fajl, uj); console.log(`kiirva: foglalas/${FAJL_NEV}.html (${Math.round(uj.length / 1024)} KB)`); }
}
