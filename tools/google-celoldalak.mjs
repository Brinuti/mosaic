// Google Ads celoldalak: egy meglevo (kezzel irt) foglalas/<forras>.html MASOLATA uj cimen, a hirdetescsoport kulcsszavaira irt cimmel, focimmel, alcimekkel.
//
// Forras: „MOSAIC Google Ads – céloldal-terv (Feri + fejlesztő) 2026-10-31” (Google-dokumentum, Feri jovahagyta 2026-10-31 11:01).
//   3.4 (10. sor) PMU-1a Szemöldök tetoválás -> /szemoldok-tetovalas-budapest  (a /sminktetovalas-budapest masolata)
//   3.5 (6. sor)  OX-4 Hajhullás kezelés     -> /hajhullas-kezeles-budapest     (a /oxigenterapia-budapest masolata)
// (A harom fodraszat-celoldalt a tools/hair-oldalak.mjs generalja: tools/hair-oldalak/google-oldalak.mjs.)
//
// A masolat minden mas tekintetben a forrasoldal: fejlec, lablec, kepek, arlista, velemenyek, foglalo, merokodok (a build ugyanugy kezeli). Csak az alabbi
// cserek tortennek; MINDEN csere pontosan annyiszor kell, hogy illeszkedjen, ahanyszor elo van irva (alapbol 1) - ha a forrasoldal megvaltozik es egy csere
// nem illeszkedik, a generator HIBAVAL leall (nem keszul felrevezeto masolat). A terv szovegei („Új oldalon (ezt kell beírni)”) BETU SZERINT.
// A regi oldal valtozatlan marad (a Meta arra visz), a regi oldalrol nincs atiranyitas. Indexelheto, sajat magara mutato canonical, a sitemapben szerepel
// (tools/wix-sitemap/pages-sitemap.xml), a menuben nem.
//
//   node tools/google-celoldalak.mjs              legyartja / frissiti a masolatokat (a forrasoldal modositasa utan is futtasd)
//   node tools/google-celoldalak.mjs --ellenoriz  csak osszeveti a fajlokat a generator kimenetevel (eltereskor: kilepesi kod 1) - a teszt ezt hasznalja
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const GYOKER = path.resolve(import.meta.dirname, '..');
const ORIGIN = 'https://www.mosaicheadspa.hu';

/** [regi, uj, darab=1] cserek; a regi szovegnek pontosan `darab`-szor kell szerepelnie. */
export const CELOLDALAK = {
  'szemoldok-tetovalas-budapest': {
    forras: 'sminktetovalas-budapest',
    csoport: 'PMU-1a Szemöldök tetoválás',
    title: 'Szemöldök tetoválás Budapest – púderes és hibrid szemöldök – Töreki Melitta, MOSAIC',
    leiras: 'Szemöldök tetoválás Budapesten, a Kolosy térnél: púderes (powder brows) és hibrid szemöldök Töreki Melittánál. 79 000 Ft, a 4–7 hét utáni korrekció az árban, nincs előleg.',
    cserek: [
      // H1 + a H1 alatti bekezdes (a forras „…ami illik az arcformádhoz” alcime helyett)
      ['        <h1>Természetes sminktetoválás Budapesten</h1>\n        <p class="hero-al hero-alcim">…ami illik az arcformádhoz.</p>',
        '        <h1>Természetes szemöldök tetoválás Budapesten</h1>\n        <p class="hero-al hero-bevezeto">Szemöldök tetoválás Budapesten Töreki Melittánál, a Kolosy térnél (Bécsi út 2.). Púderes vagy hibrid szemöldök – a szemöldök tetoválás ára 79&nbsp;000&nbsp;Ft, a korrekció az árban van. Szombaton is van időpont.</p>'],
      // Ajak- / szemhej-blokkok: kimaradnak a masolatbol (mas tema - az ajaknak sajat oldala van)
      ['<span>Szemöldök 79 000 Ft-tól<small class="tenyek-al">Ajak 99 000 Ft-tól</small></span>', '<span>Szemöldök 79 000 Ft-tól</span>'],
      ['    <h2 class="kozepre helyzet-felso">Szemöldök- és ajaktetoválás</h2>\n', ''],
      ['    <div class="helyzet-racs">', '    <div class="helyzet-racs ketto-szemoldok">'],
      [/\n      <article class="helyzet">\n        <img src="\/assets\/img\/pmu\/ajak-03\.jpg"[\s\S]*?<\/article>/, ''],
      ['\n      <button type="button" role="tab" aria-selected="false" data-szuro="ajak">Ajak</button>', ''],
      [/\n      <figure class="ref" data-kategoria="ajak">[^\n]*<\/figure>/g, '', 8],
      [/\n      <article class="ar-kartya" data-salonic="(?:ajak-aquarell|ajak-ruzs|szemhej)">[\s\S]*?<\/article>/g, '', 3],
      // Irasmod: a cimekben „szemöldök tetoválás” (kulon), a szovegben egyszer „szemöldöktetoválás” (egybe)
      ['<h3>Ez lenne az első szemöldök&shy;tetoválásom</h3>', '<h3>Ez lenne az első szemöldök tetoválásom</h3>'],
      ['természetes, gyógyult sminktetoválások – a saját munkáim.', 'természetes, gyógyult szemöldöktetoválások – a saját munkáim.'],
      ['<p class="szakember-hely">Sminktetováló Budapesten, a Kolosy térnél: Töreki Melitta.</p>', '<p class="szakember-hely">Szemöldöktetoválás Budapesten, a Kolosy térnél: Töreki Melitta.</p>'],
      // Arak: „Szemöldök tetoválás árak” + mondat; a ket szemoldok-kartya (fekvo elrendezes), alattuk a puderes / hibrid alcim
      ['<h2 id="ar-cim" class="nagy">Sminktetoválás árak</h2>', '<h2 id="ar-cim" class="nagy">Szemöldök tetoválás árak</h2>'],
      ['<p class="lead ar-mondat">Szemöldök tetoválás 79&nbsp;000&nbsp;Ft, ajaktetoválás 99&nbsp;000&nbsp;Ft-tól, a korrekció mindkettőben benne van.</p>',
        '<p class="lead ar-mondat">Szemöldök tetoválás: 79&nbsp;000&nbsp;Ft, a 4–7 hét utáni korrekcióval együtt, előleg nélkül.</p>'],
      ['    <div class="ar-racs">', '    <div class="ar-racs ketto-szemoldok">'],
      [/(data-cta="ar-szemoldok-hibrid">Időpontot nézek<\/a><\/div>\n      <\/article>\n    <\/div>\n)/, '$1    <div class="technikak">\n'
        + '      <div class="technika"><h2>Púderes szemöldök tetoválás (powder brows)</h2><p>A púderes szemöldök puha, sminkszerű árnyékolás.</p></div>\n'
        + '      <div class="technika"><h2>Hibrid szemöldök tetoválás</h2><p>A hibrid szemöldök az árnyékolást finom szálas rajzolattal kombinálja.</p></div>\n'
        + '    </div>\n'],
    ],
  },
  'hajhullas-kezeles-budapest': {
    forras: 'oxigenterapia-budapest',
    csoport: 'OX-4 Hajhullás kezelés',
    title: 'Hajhullás kezelés Budapest – hajkamerás vizsgálat és oxigénes hajkezelés – MOSAIC',
    leiras: null, // a terv nem ad uj meta leirast: a forrase marad (hajhullas ellen, hajkamera, nincs kotelezo berlet)
    cserek: [
      // H1 + a H1 alatti bekezdes (a forras OX-1-es alcime helyett)
      ['<h1>Működő oxigénterápia hajhullás és gyulladás ellen</h1>', '<h1>Hajhullás kezelés Budapesten</h1>'],
      ['      <h2 class="hero-alcim">Oxigénes hajkezelés Budapesten</h2>\n',
        '      <p class="hero-lead hero-bevezeto">Hajhullás kezelés Budapesten, a Kolosy térnél (Bécsi út 2.): hajkamerás vizsgálattal kezdünk (4&nbsp;990&nbsp;Ft), utána 80 perces oxigénes hajkezelés (első kezelés felméréssel 29&nbsp;900&nbsp;Ft, 2. alkalomtól 26&nbsp;000&nbsp;Ft). Kötelező bérlet nincs.</p>\n'],
      // a forras OX-1-es kulcsszo-szekcioja helyett a hajhullas-kifejezesek (4 alcim + mondat)
      [/<!-- ============ 1b\. KERESETT KIFEJEZESEK \(Google Ads celoldal-terv, OX-1, 2026-10-31\) ============ -->[\s\S]*?<\/section>/,
        '<!-- ============ 1b. KERESETT KIFEJEZESEK (Google Ads celoldal-terv, OX-4, 2026-10-31) ============ -->\n'
        + '<section class="kulcsszo-szekcio">\n  <div class="tartalom">\n    <ul class="kulcsszo-racs">\n'
        + '      <li class="kulcsszo-kartya"><h2>Hajhullás vizsgálat Budapest</h2><p>Hajkamerával közelről megnézzük a fejbőr és a hajszálak állapotát.</p></li>\n'
        + '      <li class="kulcsszo-kartya"><h2>Erős hajhullás kezelése</h2><p>Erős hajhullásnál is a felméréssel kezdünk, és ez alapján javasolunk kezelést.</p></li>\n'
        + '      <li class="kulcsszo-kartya"><h2>Női hajhullás kezelése</h2><p>Női vendégeinknél is ugyanígy: felmérés, majd személyre szabott kezelési terv.</p></li>\n'
        + '      <li class="kulcsszo-kartya"><h2>Hajritkulás kezelés</h2><p>Ritkuló hajnál a fejbőr állapotát nézzük meg először.</p></li>\n'
        + '    </ul>\n  </div>\n</section>'],
    ],
  },
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const helyettesit = (h, regi, uj, db, hol) => {
  const talalat = typeof regi === 'string' ? h.split(regi).length - 1 : (h.match(regi.global ? regi : new RegExp(regi.source, regi.flags + 'g')) || []).length;
  if (talalat !== db) throw new Error(`${hol}: a csere ${db}x kellene illeszkedjen, de ${talalat}x illeszkedik: ${String(regi).slice(0, 120)}`);
  return typeof regi === 'string' ? h.split(regi).join(uj) : h.replace(regi, uj);
};

/** A masolat HTML-je (a forrasoldal aktualis tartalmabol). */
export function masolat(fajl) {
  const c = CELOLDALAK[fajl];
  let h = fs.readFileSync(path.join(GYOKER, 'foglalas', c.forras + '.html'), 'utf8').replace(/\r\n/g, '\n');
  const regiTitle = (h.match(/<title>([^<]*)<\/title>/) || [])[1];
  const regiLeiras = (h.match(/<meta name="description" content="([^"]*)">/) || [])[1];
  if (!regiTitle || !regiLeiras) throw new Error(`${c.forras}: nincs <title> / meta description`);
  h = helyettesit(h, `<title>${regiTitle}</title>`, `<title>${esc(c.title)}</title>`, 1, fajl);
  h = helyettesit(h, `<meta property="og:title" content="${regiTitle}">`, `<meta property="og:title" content="${esc(c.title)}">`, 1, fajl);
  if (c.leiras) {
    h = helyettesit(h, `<meta name="description" content="${regiLeiras}">`, `<meta name="description" content="${esc(c.leiras)}">`, 1, fajl);
    h = helyettesit(h, `<meta property="og:description" content="${regiLeiras}">`, `<meta property="og:description" content="${esc(c.leiras)}">`, 1, fajl);
  }
  h = helyettesit(h, `<link rel="canonical" href="${ORIGIN}/${c.forras}">`, `<link rel="canonical" href="${ORIGIN}/${fajl}">`, 1, fajl);
  h = helyettesit(h, `<meta property="og:url" content="${ORIGIN}/${c.forras}">`, `<meta property="og:url" content="${ORIGIN}/${fajl}">`, 1, fajl);
  for (const [regi, uj, db = 1] of c.cserek) h = helyettesit(h, regi, uj, db, fajl);
  const jel = `<!--\n  GOOGLE ADS CELOLDAL (${c.csoport}): a /${c.forras} MASOLATA, a hirdetescsoport kulcsszavaira irt cimmel, focimmel, alcimekkel (celoldal-terv, Feri jovahagyta 2026-10-31).\n`
    + `  GENERALT FAJL - NE SZERKESZD KEZZEL: a forras a foglalas/${c.forras}.html + a cserek a tools/google-celoldalak.mjs-ben; generalas: node tools/google-celoldalak.mjs\n`
    + `  ELES cim: /${fajl} (indexelheto, sajat canonical, sitemapben; menuben nincs). A forrasoldal valtozatlan, onnan nincs atiranyitas. Visszaallitas: a foglalas/${fajl}.html torlese (+ a CELOLDALAK sora).\n-->\n`;
  h = helyettesit(h, '<body>\n', '<body>\n' + jel, 1, fajl);
  return h;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const ellenoriz = process.argv.includes('--ellenoriz');
  let elteres = 0;
  for (const fajl of Object.keys(CELOLDALAK)) {
    const cel = path.join(GYOKER, 'foglalas', fajl + '.html');
    const uj = masolat(fajl);
    if (ellenoriz) {
      const regi = fs.existsSync(cel) ? fs.readFileSync(cel, 'utf8').replace(/\r\n/g, '\n') : null;
      if (regi !== uj) { console.log('ELTER: foglalas/' + fajl + '.html'); elteres++; }
    } else { fs.writeFileSync(cel, uj); console.log(`kiirva: foglalas/${fajl}.html (${Math.round(uj.length / 1024)} KB, forras: foglalas/${CELOLDALAK[fajl].forras}.html)`); }
  }
  if (ellenoriz) { if (elteres) { console.log('Futtasd: node tools/google-celoldalak.mjs'); process.exit(1); } console.log(`rendben: a(z) ${Object.keys(CELOLDALAK).length} celoldal egyezik a generator kimenetevel`); }
}
