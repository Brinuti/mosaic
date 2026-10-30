// A vegleges szortelenites landing (foglalas/vegleges-szortelenites-budapest.html, magyar) angol es ukran valtozata.
//   node tools/lezer-nyelvi/gen.mjs            -> foglalas/permanent-hair-removal-budapest.html (en), foglalas/ostatochne-vydalennya-volossya-budapesht.html (uk)
//   node tools/lezer-nyelvi/gen.mjs --ellenoriz -> csak ellenoriz (nem ir): a kimenet egyezik-e a fajlokkal, es nincs-e forditatlan szoveg
// A fordito-tabla (en.json / uk.json): a MAGYAR szoveg (szovegcsomopont vagy alt / aria-label / title / data-nev / data-cim / label / placeholder ertek) -> fordítas.
// Ha a magyar oldalon uj / megvaltozott szoveg van, es nincs a tablaban, a generator HIBAVAL leall (nem marad magyar szoveg az idegen nyelvu oldalon).
// Az ar-ertekek ("19 000 Ft") a generator formazza: en: 19,000 HUF; uk: 19 000 HUF. A szamolo / naptar felirati: assets/js/lezer-szoveg-<nyelv>.js.
// Az oldalak ZART landingek (csak hirdetesekhez, noindex): nincs menu-fejlec (csak a logo, nem link) es nincs a kozos lablec: minimalis lablec (cim, telefon, e-mail,
// nyitvatartas, suti-beallitasok), hogy a latogato ne tudjon elnavigalni a (magyar) oldalra - a tulajdonos kerese, 2026-10-30. A stilus: assets/css/lezer-zart.css.
import fs from 'node:fs';
import path from 'node:path';

const GYOKER = path.resolve(import.meta.dirname, '..', '..');
const FORRAS = path.join(GYOKER, 'foglalas', 'vegleges-szortelenites-budapest.html');
const ALAP_URL = 'https://www.mosaicheadspa.hu/';
const NYELVEK = {
  en: {
    fajl: 'permanent-hair-removal-budapest', ezres: ',', penz: '&nbsp;HUF', cimke: 'angol',
    logoAlt: 'MOSAIC Head Spa and Hair',
    lablec: { cim: '1023 Budapest, Bécsi út 2. (between Kolosy tér and Zsigmond tér)', ora: 'Monday–Saturday 8:00–20:00 · Sunday closed', suti: 'Cookie settings' },
  },
  uk: {
    fajl: 'ostatochne-vydalennya-volossya-budapesht', ezres: '&nbsp;', penz: '&nbsp;HUF', cimke: 'ukran',
    logoAlt: 'MOSAIC Head Spa and Hair',
    lablec: { cim: '1023 Budapest, Bécsi út 2. (між Kolosy tér і Zsigmond tér)', ora: 'Пн–Сб 8:00–20:00 · Нд — вихідний', suti: 'Налаштування cookie' },
  },
};
const ATTR = ['alt', 'aria-label', 'title', 'data-cim', 'data-nev', 'label', 'placeholder'];
const CSAK_JEL = /^[\d\s,.\/+★→%–·:()&;-]*$/;           // szamok / jelek: nem kell fordítani
const AR_MINTA = /^(\d+(?:&nbsp;\d{3})*)(?:&nbsp;| )Ft$/;  // 19&nbsp;000 Ft
const SZAM_MINTA = /^\d+(?:&nbsp;\d{3})+$/;               // 1&nbsp;266

function szamForma(s, nyelv) {
  return s.replace(/&nbsp;/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, nyelv.ezres);
}
function fordit(kulcs, tabla, nyelv, hianyzo, mod) {
  if (Object.hasOwn(tabla, kulcs)) {
    const v = tabla[kulcs];
    if (v === 'P') { const m = AR_MINTA.exec(kulcs); if (m) return szamForma(m[1], nyelv) + nyelv.penz; }
    if (v === 'N' && SZAM_MINTA.test(kulcs)) return szamForma(kulcs, nyelv);
    if (v !== 'P' && v !== 'N') return v;
  }
  const m = AR_MINTA.exec(kulcs);
  if (m) return szamForma(m[1], nyelv) + nyelv.penz;
  if (SZAM_MINTA.test(kulcs)) return szamForma(kulcs, nyelv);
  if (mod === 'szoveg' && CSAK_JEL.test(kulcs)) return kulcs;
  hianyzo.add(kulcs);
  return kulcs;
}

function fordítOldal(forras, kod) {
  const nyelv = NYELVEK[kod];
  const j = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, kod + '.json'), 'utf8'));
  const tabla = j.szoveg, meta = j._meta;
  const hianyzo = new Set();
  const url = ALAP_URL + nyelv.fajl;
  let h = forras;
  const csere = (a, b) => { if (h.split(a).length !== 2) throw new Error('nem egyedi / hianyzo a forrasban: ' + a.slice(0, 80)); h = h.replace(a, () => b); };

  // --- fej ---
  csere('<html lang="hu">', `<html lang="${kod}">`);
  const cim = /<title>([^<]*)<\/title>/.exec(h)[1];
  csere(`<title>${cim}</title>`, `<title>${meta.title}</title>`);
  csere(`<meta property="og:title" content="${cim}">`, `<meta property="og:title" content="${meta.title}">`);
  const leiras = /<meta name="description" content="([^"]*)">/.exec(h)[1];
  csere(`<meta name="description" content="${leiras}">`, `<meta name="description" content="${meta.description}">`);
  csere(`<meta property="og:description" content="${leiras}">`, `<meta property="og:description" content="${meta.description}">`);
  const huUrl = /<link rel="canonical" href="([^"]*)">/.exec(h)[1];
  csere(`<link rel="canonical" href="${huUrl}">`, `<link rel="canonical" href="${url}">`);
  csere(`<meta property="og:url" content="${huUrl}">`, `<meta property="og:url" content="${url}">`);
  csere('<script src="/assets/js/lezer-landing.js" defer></script>', `<script src="/assets/js/lezer-szoveg-${kod}.js" defer></script>\n<script src="/assets/js/lezer-landing.js" defer></script>`);
  // --- torzs: szovegcsomopontok + attributumok ---
  const b0 = h.indexOf('<body>') + '<body>'.length;
  const fej = h.slice(0, b0);
  let torzs = h.slice(b0);
  let elsoKomment = true;
  torzs = torzs.replace(/(<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>|<!--[\s\S]*?-->)|(<[^>]+>)|([^<]+)/g, (mind, kihagy, tag, szoveg) => {
    if (kihagy) {
      if (elsoKomment && kihagy.startsWith('<!--')) {
        elsoKomment = false;
        return `\n<!--\n  ${nyelv.cimke.toUpperCase()} VALTOZAT (2026-10-30, a tulajdonos kerese): a foglalas/vegleges-szortelenites-budapest.html fordítása - NE KEZZEL SZERKESZD, hanem: node tools/lezer-nyelvi/gen.mjs\n  (fordito-tabla: tools/lezer-nyelvi/${kod}.json; szamolo / naptar feliratok: assets/js/lezer-szoveg-${kod}.js). noindex, csak hirdetesekhez, nincs a menuben / sitemapben.\n-->`;
      }
      return kihagy;
    }
    if (tag) {
      return tag.replace(new RegExp(`(\\s(?:${ATTR.join('|')})=")([^"]*)(")`, 'g'), (m, a, v, z) => (v.trim() ? a + fordit(v, tabla, nyelv, hianyzo, 'attr') + z : m));
    }
    const kulcs = szoveg.trim();
    if (!kulcs) return szoveg;
    const elol = szoveg.slice(0, szoveg.indexOf(kulcs)), utan = szoveg.slice(szoveg.indexOf(kulcs) + kulcs.length);
    return elol + fordit(kulcs, tabla, nyelv, hianyzo, 'szoveg') + utan;
  });
  h = fej + torzs;
  // zart landing: a kozos (menus) fejlec es lablec helyett minimalis; semmi nem linkel a magyar oldalra (a suti-beallitasok gomb a suti.js-ben kotodik: id="mh-cc-lablec")
  h = h.replace(/<!-- A MOSAIC oldal fejlece:[\s\S]*?-->\n/, '');
  csere('<!--mh-fejlec-->\n<!--mh-menu-aktiv:/lezeres-szortelenites-budapest-->\n',
    `<header class="zart-fej"><img src="/assets/img/logo-143x54@2x.png" width="143" height="54" alt="${nyelv.logoAlt}"></header>\n`);
  csere('<!--mh-lablec-->',
    `<footer class="zart-lab"><b>MOSAIC Head Spa and Hair</b><p>${nyelv.lablec.cim}</p><p>${nyelv.lablec.ora}</p>` +
    '<p><a href="tel:+36202474444">+36 20 247 4444</a> · <a href="mailto:mosaicheadspa@gmail.com">mosaicheadspa@gmail.com</a></p>' +
    `<p class="zart-jog">© Big in Japan Kft. · <a id="mh-cc-lablec" href="#">${nyelv.lablec.suti}</a></p></footer>`);
  csere('<link rel="stylesheet" href="/assets/css/lezer-landing.css">', '<link rel="stylesheet" href="/assets/css/lezer-landing.css">\n<link rel="stylesheet" href="/assets/css/lezer-zart.css">');
  // minosegkapu: nem maradhat magyar-specifikus betu a szovegben / attributumokban (azonosan hagyott cimek: ld. tabla), ukranon van cirill
  const latszik = h.slice(h.indexOf('<body>')).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>|<!--[\s\S]*?-->/g, '');
  const huBetu = [...latszik.matchAll(/[^<>]*[őűŐŰ][^<>]*/g)].map((m) => m[0].trim().slice(0, 100));
  if (huBetu.length) for (const x of huBetu) hianyzo.add(x);
  return { html: h, hianyzo: [...hianyzo] };
}

const ellenoriz = process.argv.includes('--ellenoriz');
const forras = fs.readFileSync(FORRAS, 'utf8');
let hiba = false;
for (const kod of Object.keys(NYELVEK)) {
  const { html, hianyzo } = fordítOldal(forras, kod);
  if (hianyzo.length) {
    hiba = true;
    console.error(`[${kod}] FORDITATLAN szoveg (${hianyzo.length}):`);
    for (const x of hianyzo) console.error('  - ' + x.slice(0, 120));
    continue;
  }
  const ut = path.join(GYOKER, 'foglalas', NYELVEK[kod].fajl + '.html');
  if (ellenoriz) {
    const van = fs.existsSync(ut) ? fs.readFileSync(ut, 'utf8') : '';
    if (van !== html) { hiba = true; console.error(`[${kod}] ${path.relative(GYOKER, ut)} NEM egyezik a generalt kimenettel`); }
    else console.log(`[${kod}] rendben: ${path.relative(GYOKER, ut)}`);
  } else {
    fs.writeFileSync(ut, html);
    console.log(`[${kod}] kesz: ${path.relative(GYOKER, ut)} (${html.length} karakter)`);
  }
}
process.exit(hiba ? 1 : 0);
