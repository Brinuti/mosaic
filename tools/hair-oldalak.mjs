// A fodraszat-oldalak generatora: a kozponti oldal + Betti + Noel + Evelin oldala (foglalas/<eredeti cim>.html), egyetlen adatbol (tools/hair-oldalak/adat.mjs).
//
//   node tools/hair-oldalak.mjs             legyartja / frissiti az oldalakat (foglalas/noi-fodraszat-budapest.html ...)
//   node tools/hair-oldalak.mjs --ellenoriz   csak osszeveti a fajlokat a generator kimenetevel (eltereskor: kilepesi kod 1) - a teszt ezt hasznalja
//
// Arvaltozasnal: node tools/hair-oldalak/salonic-pillanatkep.mjs (frissiti a Salonic-pillanatkepet), majd ez a szkript.
// Az oldalak 2026-10-09 ota ELESEK az eredeti cimeken (a tulajdonos kifejezett kerese), indexelhetok; a regi Wixes oldal rejtett -regi cimen megvan (klon/*-regi.html),
// az ideiglenes -uj cimek 301-gyel az eredetire iranyitanak (netlify/lib/utvonal.js).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { LAPOK, FODRASZOK, SZALON, PILLANATKEP, GYOKER, KEPEK, konzultacio } from './hair-oldalak/adat.mjs';
import { kozpontOldal, fodraszOldal, SPRITE, LIGHTBOX, sablonSegedek } from './hair-oldalak/sablon.mjs';

const ORIGIN = 'https://www.mosaicheadspa.hu';
const SALONIC = { place: 10823, naptar: 'f2bf7672-fa03-f092-e14b-fc23577e5ab2', konzultacio: konzultacio().id, fodraszok: Object.fromEntries(Object.values(FODRASZOK).map((f) => [f.kulcs, f.id])) };

const META = {
  kozpont: {
    title: 'Női fodrászat Budapesten: balayage, hajfestés, tőfestés | MOSAIC Hair',
    leiras: 'Női fodrászat Budán, a Bécsi út 2-ben: balayage, hajfestés, tőfestés és őszfedés ingyenes konzultációval. Nézd meg a valódi munkáinkat, az árakat és a szabad időpontokat.',
    kep: () => KEPEK.kozpontHero(),
  },
  betti: {
    title: 'Betti – női fodrász Budapesten: festés, balayage | MOSAIC Hair',
    leiras: 'Ismerd meg Bettit, a MOSAIC Hair fodrászát a Bécsi úton: balayage, melír és hajfestés ingyenes konzultációval. Nézd meg a munkáit és az árait, és foglalj időpontot.',
    kep: () => KEPEK.portre.betti(),
  },
  noel: {
    title: 'Noel – balayage és hajfestés Budapesten | MOSAIC Hair',
    leiras: 'Ismerd meg Noelt, a MOSAIC Hair fodrászát a Bécsi úton: balayage, precíz hajfestés és tőfestés ingyenes konzultációval. Nézd meg a munkáit és az árait, és foglalj időpontot.',
    kep: () => KEPEK.portre.noel(),
  },
  evelin: {
    title: 'Evelin – női hajfestés és hajhosszabbítás Budapesten | MOSAIC Hair',
    leiras: 'Ismerd meg Evelint, a MOSAIC Hair fodrászát a Bécsi úton: hajfestés és hajhosszabbítás ingyenes konzultációval. Nézd meg a munkáit és az árait, és foglalj időpontot.',
    kep: () => KEPEK.portre.evelin(),
  },
};

const jsonLd = (kulcs) => {
  const szalon = {
    '@context': 'https://schema.org', '@type': 'HairSalon', name: SZALON.nev, url: ORIGIN + '/' + LAPOK.kozpont.eredeti, telephone: '+36202474444',
    address: { '@type': 'PostalAddress', streetAddress: 'Bécsi út 2.', addressLocality: 'Budapest', postalCode: '1023', addressCountry: 'HU' },
    openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '08:00', closes: '20:00' }],
  };
  if (kulcs === 'kozpont') return [szalon];
  const f = FODRASZOK[kulcs];
  return [szalon, { '@context': 'https://schema.org', '@type': 'Person', name: f.teljesNev, jobTitle: 'Fodrász', worksFor: { '@type': 'HairSalon', name: SZALON.nev }, image: ORIGIN + KEPEK.portre[kulcs]().src }];
};

export function oldal(kulcs) {
  const lap = LAPOK[kulcs], m = META[kulcs], kep = m.kep();
  const torzs = kulcs === 'kozpont' ? kozpontOldal() : fodraszOldal(kulcs);
  const url = `${ORIGIN}/${lap.fajl}`;
  const adat = JSON.stringify(SALONIC).replace(/"/g, '&quot;');
  return `<!DOCTYPE html>
<html lang="hu">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${m.title}</title>
<meta name="description" content="${m.leiras}">
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
<noscript><style>main.hl .ar-csop[hidden]{display:block!important}main.hl .ar-fulek{display:none}</style></noscript>
<script src="/assets/js/suti.js"></script>
<script type="application/ld+json">${JSON.stringify(jsonLd(kulcs))}</script>
</head>
<body data-hair="${adat}">
<!--
  MOSAIC Hair - ${kulcs === 'kozpont' ? 'KOZPONTI fodraszat-oldal' : 'fodrasz-oldal: ' + FODRASZOK[kulcs].nev} - uj terv (MOSAIC_Hair_implementation_v2). GENERALT FAJL: ne szerkeszd kezzel.
  Forras: tools/hair-oldalak/adat.mjs (tartalom, arak a Salonic-pillanatkepbol), tools/hair-oldalak/sablon.mjs (szekciok); generalas: node tools/hair-oldalak.mjs
  ELES cim: /${lap.fajl} (indexelheto; 2026-10-09 ota ez az eredeti cim). A regi (Wixes) oldal: /${lap.fajl}-regi (noindex, klon/${lap.fajl}-regi.html); az ideiglenes /${lap.ujCim} cim 301-gyel ide iranyit. Visszaallitas: a foglalas/${lap.fajl}.html torlese.
  Az oldalon belul NINCS #horgony-link (a GTM History Change minden hash-valtozasra merest inditana): a gorgetest a hair-landing.js vegzi.
  Foglalas: a gombok a /foglalo-motor?business=hair... linkek (a launcher a retegben nyitja meg; a fodrasz / szolgaltatas ismeretet a motor nem kerdezi ujra).
-->

<!--mh-fejlec-->
<!--mh-menu-aktiv:${lap.menu}-->

${SPRITE}

${torzs}

${sablonSegedek.sticky(kulcs === 'kozpont' ? null : kulcs)}

<!--mh-lablec-->

${LIGHTBOX}

<script src="/assets/js/klon.js" defer></script>
<script src="/assets/js/hair-landing.js" defer></script>
</body>
</html>
`;
}

const fajl = (kulcs) => path.join(GYOKER, 'foglalas', LAPOK[kulcs].fajl + '.html');
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) { // Windowson es Linuxon is
  const ellenoriz = process.argv.includes('--ellenoriz');
  let elteres = 0;
  for (const kulcs of Object.keys(LAPOK)) {
    const uj = oldal(kulcs);
    if (ellenoriz) {
      const regi = fs.existsSync(fajl(kulcs)) ? fs.readFileSync(fajl(kulcs), 'utf8').replace(/\r\n/g, '\n') : null; // Windowson az autocrlf CRLF-et ir a munkamappaba
      if (regi !== uj) { console.log('ELTER: ' + path.relative(GYOKER, fajl(kulcs))); elteres++; }
    } else { fs.writeFileSync(fajl(kulcs), uj); console.log(`kiirva: foglalas/${LAPOK[kulcs].fajl}.html (${Math.round(uj.length / 1024)} KB)`); }
  }
  if (ellenoriz) { if (elteres) { console.log('Futtasd: node tools/hair-oldalak.mjs'); process.exit(1); } console.log(`rendben: a(z) ${Object.keys(LAPOK).length} oldal egyezik a generator kimenetevel (Salonic-pillanatkep: ${PILLANATKEP.lekerve})`); }
}
