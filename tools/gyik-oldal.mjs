// A /gyik oldal (foglalas/gyik.html) generatora: az OSSZES uzletag gyakori kerdesei egy helyen. A kerdes-valaszok a meglevo oldalak GYIK-szekciojabol
// jonnek (igy egy helyen szerkesztendok, es a generalas ujrafuttatasa szinkronba hozza ezt az oldalt):
//   node tools/gyik-oldal.mjs
// Forrasok: lasd FORRASOK (oldalfajl + a GYIK-szekcio kezdete). A kimenet kezzel is szerkesztheto, de a kovetkezo generalas felulirja.
import fs from 'node:fs';
import path from 'node:path';

const GYOKER = path.resolve(import.meta.dirname, '..');
const olvas = (f) => fs.readFileSync(path.join(GYOKER, f), 'utf8').replace(/\r\n/g, '\n');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const szoveg = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const norm = (s) => szoveg(s).toLowerCase();

// uzletag: id (horgony), cim, oldal (a reszletes oldal), foglalas (a foglalo linkje), forrasok: [[fajl, a GYIK-szekcio kezdo-mintaja, a varhato kerdesszam]]
export const FORRASOK = [
  { id: 'headspa', cim: 'Head Spa', oldal: '/', foglalas: '/foglalo-motor?business=headspa', forrasok: [
    ['foglalas/fooldal-uj.html', '<section class="szekcio gyik" id="gyik"', 18], ['foglalas/egyeni-headspa-budapest-uj.html', '<section class="szekcio gyik bezs" id="gyik"', 8]] },
  { id: 'paros', cim: 'Páros Head Spa', oldal: '/paros-headspa-budapest', foglalas: '/foglalo-motor?business=headspa&service=paros', forrasok: [
    ['foglalas/paros-headspa-budapest-uj.html', '<section class="szekcio gyik" id="gyik"', 12]] },
  { id: 'szortelenites', cim: 'Szőrtelenítés', oldal: '/lezeres-szortelenites-budapest', foglalas: '/foglalo-motor?business=laser', forrasok: [
    ['foglalas/lezeres-szortelenites-budapest.html', '<section class="gyik" id="gyik"', 12]] },
  { id: 'fodraszat', cim: 'Fodrászat', oldal: '/noi-fodraszat-budapest', foglalas: '/foglalo-motor?business=hair', forrasok: [
    ['foglalas/noi-fodraszat-budapest-uj.html', '<section class="szekcio" id="gyik"', 8]] },
  { id: 'oxigenterapia', cim: 'Oxigénterápia', oldal: '/oxigenterapia-budapest', foglalas: '/foglalo-motor?business=oxygen', forrasok: [
    ['foglalas/oxigenterapia-budapest.html', '<section class="gyik-szekcio"', 13]] },
  { id: 'sminktetovalas', cim: 'Sminktetoválás', oldal: '/sminktetovalas-budapest', foglalas: '/sminktetovalas-budapest#foglalas', forrasok: [
    ['foglalas/sminktetovalas-budapest.html', '<section class="gyik" id="gyik"', 13]] },
  { id: 'ajandekkartya', cim: 'Ajándékkártya', oldal: '/ajandekkartya', foglalas: '/ajandekkartya', forrasok: [
    ['foglalas/ajandek.html', '<div class="ah-gyik">', 10]] },
];

/** a GYIK-szekcio <details> elemei: [{ q, a (html) }] */
function kivag(fajl, kezdo, vart) {
  const s = olvas(fajl);
  const i = s.indexOf(kezdo);
  if (i < 0) throw new Error(`${fajl}: nincs GYIK-szekcio (${kezdo})`);
  let j = s.indexOf('</section>', i);
  if (kezdo.startsWith('<div class="ah-gyik"')) { const k = s.indexOf('</section>', i); j = k > -1 ? k : i + 20000; }
  const resz = s.slice(i, j);
  const tetelek = [...resz.matchAll(/<details[^>]*>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)].map((m) => ({ q: szoveg(m[1]), a: m[2].trim() }));
  if (process.env.GYIK_SZAMOL) console.log(fajl, tetelek.length, vart); else if (tetelek.length !== vart) throw new Error(`${fajl}: ${tetelek.length} kerdes, ${vart} volt a varhato`);
  return tetelek;
}

export function osszegyujt() {
  return FORRASOK.map((u) => {
    const lattak = new Set(); const lista = [];
    for (const [fajl, kezdo, vart] of u.forrasok) for (const t of kivag(fajl, kezdo, vart)) {
      const k = norm(t.q);
      if (lattak.has(k)) continue;
      lattak.add(k); lista.push(t);
    }
    return { ...u, lista };
  });
}

const CIM = 'Gyakori kérdések – MOSAIC Head Spa, szőrtelenítés, fodrászat, oxigénterápia, sminktetoválás';
const LEIRAS = 'A MOSAIC összes szolgáltatásának gyakori kérdései és válaszai egy helyen: Head Spa, páros Head Spa, lézeres szőrtelenítés, fodrászat, oxigénterápia, sminktetoválás és ajándékkártya.';

export function oldal(adat) {
  const osszes = adat.reduce((n, u) => n + u.lista.length, 0);
  const chips = adat.map((u) => `<a href="#${u.id}">${esc(u.cim)} <span>${u.lista.length}</span></a>`).join('\n      ');
  const szekciok = adat.map((u) => `<section class="szekcio gy-szekcio" id="${u.id}" aria-labelledby="${u.id}-cim" data-gy-szekcio>
  <div class="tartalom keskeny">
    <div class="gy-fej">
      <h2 id="${u.id}-cim">${esc(u.cim)}</h2><span class="gy-db">${u.lista.length} kérdés</span>
      <a class="gomb gomb-arany" href="${u.foglalas}">Időpontfoglalás <span class="nyil">→</span></a>
    </div>
    <div class="gy-lista">
${u.lista.map((t) => `      <details><summary>${esc(t.q)}</summary>${t.a}</details>`).join('\n')}
    </div>
    <p class="gy-tovabb"><a href="${u.oldal}">${esc(u.cim)}: minden részlet az oldalán →</a></p>
  </div>
</section>`).join('\n\n');
  return `<!DOCTYPE html>
<html lang="hu">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(CIM)}</title>
<meta name="description" content="${esc(LEIRAS)}">
<link rel="canonical" href="https://www.mosaicheadspa.hu/gyik">
<meta property="og:title" content="${esc(CIM)}">
<meta property="og:description" content="${esc(LEIRAS)}">
<meta property="og:image" content="https://www.mosaicheadspa.hu/assets/img/c2eb0f_0df44a446cba4ed087342e76f3eb1a77.png">
<meta property="og:url" content="https://www.mosaicheadspa.hu/gyik">
<meta property="og:site_name" content="MOSAIC Headspa">
<meta property="og:type" content="website">
<link rel="icon" href="/assets/img/c2eb0f_b001e2c55098446da3e38ff055e20354.png" type="image/png">
<link rel="preload" href="/assets/fonts/playfair-display-500-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/css/wix-google-fonts.css">
<link rel="stylesheet" href="/assets/css/wix-fonts.css">
<link rel="stylesheet" href="/assets/css/headspa-oldal.css">
<link rel="stylesheet" href="/assets/css/kapcsolat-gyik.css">
<script src="/assets/js/suti.js"></script>
</head>
<body>
<!--
  MOSAIC - Gyakori kerdesek (/gyik): az OSSZES uzletag kerdes-valaszai egy helyen (a tulajdonos kerese, 2026-10-07; a menu "GYIK" pontja ide visz).
  A kerdesek a meglevo oldalak GYIK-szekciojabol valok; GENERALT: node tools/gyik-oldal.mjs (docs/KAPCSOLAT_GYIK.md). A kereso a assets/js/gyik-oldal.js-ben van.
-->

<!--mh-fejlec-->
<!--mh-menu-aktiv:/gyik-->

<main id="top">
<section class="oldal-fej">
  <div class="tartalom">
    <h1>Gyakori kérdések</h1>
    <span class="rombusz" aria-hidden="true"></span>
    <p class="lead">Minden szolgáltatásunk kérdései és válaszai egy helyen. Keress rá, vagy válaszd ki, mi érdekel.</p>
    <div class="gy-kereso">
      <label class="szem-latszik" for="gy-q">Keress a kérdések között</label>
      <input type="search" id="gy-q" placeholder="Keress a ${osszes} kérdés között" autocomplete="off" enterkeyhint="search">
      <span class="gy-talalat" id="gy-talalat" aria-live="polite"></span>
    </div>
    <nav class="gy-chips" aria-label="Szolgáltatások">
      ${chips}
    </nav>
  </div>
</section>

${szekciok}

<section class="szekcio gy-nincs" id="gy-nincs" aria-live="polite">
  <div class="tartalom keskeny">
    <p>Erre a keresésre nem találtunk kérdést. Próbálj másik szót, vagy írj nekünk!</p>
  </div>
</section>

<section class="gy-vege" aria-labelledby="gy-vege-cim">
  <div class="tartalom">
    <h2 id="gy-vege-cim">Nem találtad a választ?</h2>
    <p>Írj nekünk, vagy hívj minket: a 06 20 247 4444-es számon és a mosaicheadspa@gmail.com címen is elérsz.</p>
    <div class="cta-sor">
      <a class="gomb gomb-arany" href="/kapcsolat">Üzenetet küldök <span class="nyil">→</span></a>
      <a class="gomb gomb-korvonal" href="tel:+36202474444">Hívás: 06 20 247 4444</a>
    </div>
  </div>
</section>
</main>

<!--mh-lablec-->

<script src="/assets/js/klon.js" defer></script>
<script src="/assets/js/gyik-oldal.js" defer></script>
</body>
</html>
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const adat = osszegyujt();
  const ki = path.join(GYOKER, 'foglalas', 'gyik.html');
  fs.writeFileSync(ki, oldal(adat), 'utf8');
  console.log('irva:', ki, '|', adat.map((u) => `${u.cim}: ${u.lista.length}`).join(', '), '| osszesen', adat.reduce((n, u) => n + u.lista.length, 0));
}
