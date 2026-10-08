// A regi (Wixes) "Vegleges lezeres szortelenites ferfiaknak" oldal (vegleges-szortelenites-ferfiaknak) ujrastilusa, a TARTALOM valtoztatasa nelkul.
// Ugyanaz a sablon, mint a 7 noi hirdetesi oldale (gen.mjs): hero, ingyenes konzultacio, valtozo szakasz, garancia, Zsofi, elso alkalom, 3 kerdes, kontroll, elott / utan,
// berlet helyett alkalmankent, csomagarak, testreszarak, velemenyek, szalon, nyari ajanlat, SZEP-kartya, GYIK, helyszin - a sorrend es a szovegek a regi oldalrol.
// A ferfi oldal elterei: a konzultacio-szakaszban foto van (nem video), nincs Elysion-osszehasonlitas, az arlista ferfi csomagokat / testreszeket mutat, a galeria 9 kepes.
//
//   node tools/lezer-variansok/gen-ferfi.mjs      ->  foglalas/vegleges-szortelenites-ferfiaknak.html
//
// Forras: tools/lezer-variansok/forras/ferfi.folyam.txt (a regi oldal kinyert tartalma, tools/ujrastilus/folyam.mjs; az eles oldalrol, a csere ELOTT). A kozos kepek allando
// listabol jonnek (a kinyero a Wix lusta kepeit nem mindig latja), a szovegek a forrasbol valtozatlanul; a GYIK valaszai az assets/js/gyik.js-bol.
// A kezi szerkesztes megengedett, de az ujrafuttatas felulirja a kimeneti fajlt.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  GYOKER, BAZIS, IKON, attr, sorok, szoveg, cim, kep, img, gomb, gombSor, aranyok, linkek, paragrafusok, rendez, promoHtml, nemPromo, promoSorok, PROMO, CSILLAG_KEP,
  garanciaHtml, zsofiHtml, elsoHtml, elotteHtml, kepSzovegHtml, szalonHtml, nyarHtml, szepHtml, velemenyHtml, gyikHtml, meta,
} from './gen.mjs';

const NEV = 'vegleges-szortelenites-ferfiaknak';
const FORRAS = path.join(import.meta.dirname, 'forras', 'ferfi.folyam.txt');

const SZAKASZOK = [
  ['konz', 'H1', /Ingyenes konzultációval/],
  ['valt', 'VEGE', /IDŐPONTOK >>/],
  ['garancia', 'H2', /Rögzített ár/],
  ['zsofi', 'H1', /Zsófi vagyok a MOSAIC/],
  ['elso', 'H1', /Mi történik az első alkalommal/],
  ['harom', 'H2', /A 3 legfontosabb kérdés/],
  ['kontroll', 'H2', /CSAK NÁLUNK/],
  ['elotte', 'H2', /Kezelés előtt/],
  ['berlet', 'H2', /BÉRLET ÁRAINK/],
  ['csomagok', 'H2', /CSOMAGÁRAINK/],
  ['testresz', 'H2', /ÁRAINK csak testrészekre/],
  ['velemeny', 'H1', /imádják vendégeink/],
  ['szalon', 'H2', /gyönyörűen felújított/],
  ['nyar', 'H2', /Ha most belevágsz nyárra/],
  ['szep', 'H1', /SZÉP Kártyát/],
  ['gyik', 'H2', /leggyakoribb szőrtelenítés kérdések/],
  ['hely', 'H2', /Itt találsz meg minket/],
];
function szeletek(rs) {
  const kezd = [['hero', 0]];
  let from = 1;
  for (const [nev, tipus, minta] of SZAKASZOK) {
    let i = -1;
    for (let k = from; k < rs.length; k++) {
      if (tipus === 'VEGE') { if (rs[k].t === 'GOMB' && minta.test(szoveg(rs[k].html))) { i = k + 1; break; } }
      else if (rs[k].t === tipus && minta.test(szoveg(rs[k].html || ''))) { i = k; break; }
    }
    if (i < 0) throw new Error(`nincs "${nev}" szakasz-kezdet (${tipus} ${minta})`);
    kezd.push([nev, i]); from = i + 1;
  }
  const ki = {};
  kezd.forEach(([nev, i], n) => { ki[nev] = rs.slice(i, n + 1 < kezd.length ? kezd[n + 1][1] : rs.length); });
  return ki;
}

// a folyam.mjs kinyeroje a szomszedos Wix-szovegelemek koze szokozt tesz ("Ar: 68" + ".000 Ft"): a regi oldalon nincs szokoz
const szokozJavit = (h) => h.replace(/(\d) \.(\d{3})/g, '$1.$2');

// ---------------------------------------------------------------------------------------------------------------------------------------------
function heroHtml(rs) {
  const h = rs.find((r) => r.t === 'H1' || r.t === 'H2');
  const sz = rs.filter((r) => r.t === 'SZ');
  const gombok = rs.filter((r) => r.t === 'GOMB');
  const lead = sz[0];
  const cimSor = sz.find((r) => /Bécsi út 2/.test(r.html));
  const ertekeles = sz.find((r) => /^<b>Google/.test(r.html));
  const tobbi = sz.filter((r) => r !== lead && r !== cimSor && r !== ertekeles);
  return `<section class="hero lv-hero">
  <div class="tartalom hero-racs">
    <div class="hero-szoveg">
      <h1>${cim(h.html)}</h1>
      <p class="hero-al">${lead.html}</p>
      <p class="lv-sor">${cimSor.html}</p>
      <div class="cta-sor">
        ${gombok.map((g) => gomb(g, 'gomb gomb-arany')).join('\n        ')}
      </div>
${tobbi.map((r) => `      <p class="lv-sor">${r.html}</p>`).join('\n')}
      <p class="lv-ertekeles">${img(CSILLAG_KEP, '5 csillag', ' loading="eager"')}<span>${ertekeles.html}</span></p>
    </div>
    <figure class="hero-kep lv-hero-kep">${img(kep('c2eb0f_ed3e3ce78506'), 'Lézeres szőrtelenítés férfiaknak Elysion Pro géppel a MOSAIC-ban', ' fetchpriority="high"')}</figure>
  </div>
</section>`;
}

// ingyenes konzultacio: foto (nem video) + szoveg
function konzHtml(rs) {
  const h = rs.find((r) => r.t === 'H1');
  const sz = rs.filter((r) => r.t === 'SZ');
  const g = rs.find((r) => r.t === 'GOMB');
  return `<section class="szekcio lv-sotet" id="konzultacio" aria-labelledby="konzultacio-cim">
  <div class="tartalom">
    <div class="szekcio-fej">
      <h2 id="konzultacio-cim">${cim(h.html)}</h2>
      <span class="rombusz" aria-hidden="true"></span>
      <p class="lead">${sz[0].html}</p>
    </div>
    <div class="fel-racs felul cikk lv-konz">
      <div>
${paragrafusok(sz.slice(1))}
      </div>
      <figure class="kep-fig lv-kicsi lv-konz-kep">${img(kep('c2eb0f_1aa35b8ff0f4'), 'Zsófi, a MOSAIC Elysion Pro szakértője', ' loading="lazy"')}</figure>
    </div>
    <div class="kozepre-sor">
      ${gomb(g)}
    </div>
  </div>
</section>`;
}

// "Felejtsd el a pengét / gyantát egy életre!": elotte-utana kep + cim + alcim + 3 pont + jelvenyek
function valtHtml(rs) {
  const h = rs.find((r) => r.t === 'H1');
  const sz = rs.filter((r) => r.t === 'SZ');
  const alcim = sz.find((r) => r.w < 450);
  const tobbi = sz.filter((r) => r !== alcim);
  const jelvenyek = [['c2eb0f_524a72a0105e', 'Fájdalommentes'], ['c2eb0f_93549c4ac92e', 'Biztonságos'], ['c2eb0f_a37ff0190db1', 'Gyors és tartós']];
  return `<section class="szekcio zsalya" id="szempontok" aria-labelledby="szempontok-cim">
  <div class="tartalom">
    <div class="fel-racs felul lv-valt">
      <figure class="kep-fig lv-valt-kep magas">${img(kep('c2eb0f_c3f7766324e4'), 'Lézeres szőrtelenítés eredménye mellkason: előtte és utána', ' loading="lazy"')}</figure>
      <div class="cikk">
        <h2 id="szempontok-cim">${cim(h.html)}</h2>
${alcim ? `        <p class="lv-alcim">${alcim.html}</p>\n` : ''}${paragrafusok(tobbi)}
        <div class="lv-jelvenyek">
${jelvenyek.map(([e, a]) => `          ${img(kep(e), a, ' loading="lazy"')}`).join('\n')}
        </div>
      </div>
    </div>
  </div>
</section>`;
}

// berlet helyett alkalmankent: hatterkep + cim + kep + szoveg + osszefoglalo-abra + gomb
function berletHtml(rs) {
  const h = rs.find((r) => r.t === 'H2');
  const sz = nemPromo(rs.filter((r) => r.t === 'SZ'));
  const gombok = rs.filter((r) => r.t === 'GOMB');
  return `<section class="szekcio lv-hatterkepes" id="alkalmankent" aria-labelledby="alkalmankent-cim">
  ${img(kep('c2eb0f_8c347f764efd'), '', ' class="lv-hatterkep" loading="lazy" decoding="async"')}
  <div class="tartalom">
    <div class="szekcio-fej">
      <h2 id="alkalmankent-cim">${cim(h.html)}</h2>
      <span class="rombusz" aria-hidden="true"></span>
    </div>
    <div class="lv-berlet-ferfi">
      <figure class="kep-fig lv-berlet-kep">${img(kep('c2eb0f_4afa5a45a0b5'), 'A lézeres szőrtelenítés 3 kedvezménye', ' loading="lazy"')}</figure>
      <div class="lv-kartya cikk">
${paragrafusok(sz)}
      </div>
      <figure class="kep-fig lv-berlet-kep">${img(kep('c2eb0f_77ff06afd6e2'), 'MOSAIC – Fix ár, 2 alkalom ingyen, 12 hó + örök garancia: a hűségprogram lépései', ' loading="lazy"')}</figure>
    </div>
    <div class="kozepre-sor">
      ${gombok.map((g) => gomb(g)).join('\n      ')}
    </div>
${promoSorok(rs.filter((r) => r.t === 'SZ')).map((r) => `    <p class="lv-promo kozepre">${r.html}</p>`).join('\n')}
  </div>
</section>`;
}

// az arlista-szovegblokkok (1 hatalmas szovegsor, Wix-ismetlo): kartyakra bontva. A kartyak utan allo "20% majusi kedvezmennyel!" sor az ELOZO kartyahoz tartozik
// (a kinyero a kovetkezo kartya cimevel egy <b>-be vonta).
const GOMB_RE = /<a href="([^"]+)">\s*(FOGLALOK!)\s*<\/a>/;
function kartyaDarabok(html) {
  const sz = html.replace(/<br>\s*/g, ' ').split(new RegExp(GOMB_RE.source, 'g'));   // [kartya0, href, felirat, promo1+kartya1, href, felirat, ..., promoN]
  const ki = [];
  let elozoPromo = null;
  for (let i = 0; i < sz.length; i += 3) {
    let test = sz[i].trim();
    let promo = null;
    if (i > 0) {
      const m = /^<b>\s*(20% májusi kedvezménnyel!(?: PLUSZ a 8 alkalomból csak 6-ot fizetsz mert 2 ajándék!)?)\s*(.*?)<\/b>(.*)$/s.exec(test);
      if (!m) throw new Error('arlista: a kartya elotti promo-sor ismeretlen szerkezet: ' + test.slice(0, 140));
      promo = m[1];
      test = m[2] ? `<b>${m[2]}</b>${m[3]}` : '';
      if (ki.length) ki[ki.length - 1].promo = promo;
    }
    if (!test) continue;
    ki.push({ test, href: sz[i + 1], felirat: sz[i + 2], promo: null });
  }
  return ki;
}

const CSOMAG_KEPEK = ['c2eb0f_fc90fb2827e5', 'c2eb0f_d8797666a7ed'];                                                   // EGYEDI CSOMAG, MAN TOTAL
const TESTRESZ_KEPEK = ['c2eb0f_7a2508573456', 'c2eb0f_f03934e87aef', 'c2eb0f_4514728a83b9', 'c2eb0f_0c5d45fbb4a7'];   // FERFI (hat / mell / has), ARC, TEST, LABAK
function csomagokHtml(rs) {
  const h = rs.find((r) => r.t === 'H2');
  const sz = rs.filter((r) => r.t === 'SZ');
  const alcim = sz.find((r) => r.w < 700);
  const tabla = sz.find((r) => r.w > 1000);
  const kk = kartyaDarabok(tabla.html).map((k, i) => {
    const m = /^<b>(.+?)<\/b>(.*?)\s*<b>(.*?)<\/b>\s*$/s.exec(k.test);
    if (!m) throw new Error('csomagkartya: ismeretlen szerkezet: ' + k.test.slice(0, 140));
    const szavak = szoveg(m[1]).split(' ');
    const nevHossz = /^MAN TOTAL/.test(szoveg(m[1])) ? 2 : 1;
    return { ...k, kep: CSOMAG_KEPEK[i], nev: szavak.slice(0, nevHossz).join(' '), cim: szavak.slice(nevHossz).join(' '), leiras: m[2].trim(), info: m[3].trim() };
  });
  if (kk.length !== 2) throw new Error('csomagarak: 2 kartya kellene, ' + kk.length + ' van');
  return `<section class="szekcio feher" id="csomagarak" aria-labelledby="csomagarak-cim">
  <div class="tartalom">
    <div class="szekcio-fej">
      <h2 id="csomagarak-cim">${cim(h.html)}</h2>
      <span class="rombusz" aria-hidden="true"></span>
      <p class="lead lv-dolt">${alcim.html}</p>
    </div>
    <div class="lv-csomagok ketto">
${kk.map((k) => `      <article class="lv-csomag">
        <figure class="lv-kartya-kep">${img(kep(k.kep), k.nev + ' csomag', ' loading="lazy"')}</figure>
        <h3><span class="lv-csomag-nev">${k.nev}</span> ${k.cim}</h3>
        <p class="lv-csomag-leiras">${k.leiras}</p>
        <p class="lv-csomag-info"><b>${k.info.replace(/ (Ár:)/, '<br>$1')}</b></p>
        <a class="gomb gomb-arany" href="${attr(k.href)}">${k.felirat} <span class="nyil" aria-hidden="true">→</span></a>
${k.promo ? `        <p class="lv-promo">${k.promo}</p>\n` : ''}      </article>`).join('\n')}
    </div>
  </div>
</section>`;
}

function testreszHtml(rs) {
  const h = rs.find((r) => r.t === 'H2');
  const sz = rs.filter((r) => r.t === 'SZ');
  const alcim = sz.find((r) => r.w < 700);
  const tabla = sz.find((r) => r.w > 1000);
  const cs = kartyaDarabok(tabla.html).map((k, i) => {
    const c = /^<b>(.+?)<\/b>(.*)$/s.exec(k.test);
    if (!c) throw new Error('testreszar: nincs csoportcim: ' + k.test.slice(0, 100));
    const tetelek = [];
    const re = /\s*(.+?) alkalmi:\s*([\d.]+ Ft)\s+\1 8 alkalom:\s*([\d.]+ Ft)\s*<b>\s*(Kedvezmény[^:<]*?):\s*([\d.]+ Ft)\s*<\/b>/g;
    let m; let vege = 0;
    while ((m = re.exec(c[2]))) { tetelek.push({ nev: m[1].trim(), alkalmi: m[2], nyolc: m[3], kedv: m[4].trim(), kedvAr: m[5] }); vege = re.lastIndex; }
    if (!tetelek.length || c[2].slice(vege).trim()) throw new Error('testreszar: ismeretlen szerkezet: ' + c[2].slice(vege).slice(0, 100));
    return { ...k, kep: TESTRESZ_KEPEK[i], cim: c[1].trim(), tetelek };
  });
  if (cs.length !== 4) throw new Error('testreszarak: 4 csoport kellene, ' + cs.length + ' van');
  return `<section class="szekcio zsalya" id="testresz-arak" aria-labelledby="testresz-cim">
  <div class="tartalom">
    <div class="szekcio-fej">
      <h2 id="testresz-cim">${cim(h.html)}</h2>
      <span class="rombusz" aria-hidden="true"></span>
      <p class="lead lv-dolt">${alcim.html}</p>
    </div>
    <div class="lv-testresz">
${cs.map((c) => `      <article class="lv-tr-csoport">
        <figure class="lv-kartya-kep">${img(kep(c.kep), c.cim, ' loading="lazy"')}</figure>
        <h3>${c.cim}</h3>
        <dl>
${c.tetelek.map((t) => `          <div class="lv-tr-tetel">
            <dt>${t.nev}</dt>
            <dd class="lv-tr-alkalmi">${t.nev} alkalmi: <b>${t.alkalmi}</b></dd>
            <dd class="lv-tr-nyolc">${t.nev} 8 alkalom: <b>${t.nyolc}</b></dd>
            <dd class="lv-tr-kedv"><b>${t.kedv}: ${t.kedvAr}</b></dd>
          </div>`).join('\n')}
        </dl>
        <a class="gomb gomb-arany" href="${attr(c.href)}">${c.felirat} <span class="nyil" aria-hidden="true">→</span></a>
${c.promo ? `        <p class="lv-promo">${c.promo}</p>\n` : ''}      </article>`).join('\n')}
    </div>
  </div>
</section>`;
}

const SZALON_KEPEK_FERFI = [
  ['c2eb0f_ac85eea74409', 'A MOSAIC váró- és recepciós tere'],
  ['c2eb0f_aa3b2f8ec756', 'A váró zöld bársonyfotelekkel'],
  ['c2eb0f_00a2f4bd0e9b', 'A bejárat a MOSAIC emblémával és a macska-szoborral'],
  ['c2eb0f_de82baa48487', 'A szalon bejárata'],
  ['c2eb0f_0afd6583c982', 'A kezelőhelyiség növényekkel'],
  ['c2eb0f_7b41e9e53cc2', 'A kezelőhelyiség esti fényekben'],
  ['c2eb0f_2117f850ffa2', 'Folyosó a szalonban'],
  ['c2eb0f_954c13b62f8c', 'A váró fekete bútorokkal'],
  ['c2eb0f_df20aa423fff', 'A váró és a recepció'],
];

// helyszin: a regi oldalon a terkep helyen a klon.js hozzajarulas-kapus Google-terkepe all (a szovegei a regi oldal szovegei)
function helyHtml(rs) {
  const h = rs.find((r) => r.t === 'H2');
  const sz = rs.filter((r) => r.t === 'SZ');
  const telefon = sz.find((r) => /^06 20/.test(r.html));
  const cimSor = sz.find((r) => /Bécsi út/.test(r.html) && r.w < 300);
  const email = sz.find((r) => /@/.test(r.html));
  const terkepSzoveg = sz.find((r) => /^Térkép:/.test(r.html));
  const idx = (re) => sz.findIndex((r) => re.test(r.html));
  const nyit = (nap) => { const i = idx(new RegExp('^' + nap)); return `${sz[i].html}: ${sz[i + 1].html}`; };
  const gombok = rs.filter((r) => r.t === 'GOMB');
  const h3k = rs.filter((r) => r.t === 'H3');
  const terkepGomb = gombok.find((g) => /^Térkép megjelenítése/.test(g.html));
  const terkepLink = gombok.find((g) => /maps/.test(g.href || ''));
  const foglal = gombok.filter((g) => g !== terkepGomb && g !== terkepLink);
  return `<section class="helyszin" id="helyszin" aria-labelledby="hely-cim">
  <div class="lv-hely-kep">${img(kep('11062b_c676302884b3'), 'MOSAIC Head Spa – a szalon', ' loading="lazy"')}</div>
  <div class="tartalom helyszin-racs">
    <div class="hely-szoveg">
      <h2 id="hely-cim">${cim(h.html)}</h2>
      <div class="hely-sor"><span class="ikon-kor">${IKON.hely}</span><p><b>${h3k[0].html}</b><br>${cimSor.html}</p></div>
      <div class="hely-sor"><span class="ikon-kor">${IKON.tel}</span><p><b>${h3k[1].html}</b><br><a href="tel:+36202474444">${telefon.html}</a><br><a href="mailto:${szoveg(email.html)}">${email.html}</a></p></div>
      <div class="hely-sor"><span class="ikon-kor">${IKON.ora}</span><p><b>${h3k[2].html}</b><br>${nyit('Hétfő')}<br>${nyit('Szombat')}<br>${nyit('Vasárnap')}</p></div>
      <div class="hely-gombok">
        ${foglal.map((g) => gomb(g)).join('\n        ')}
      </div>${promoHtml(sz, '      ')}
    </div>
    <div class="lv-hely-jobb">
      <div class="terkep" id="terkep">
        <!-- a Google-terkep a funkcionalis sutik engedelyezese utan (vagy a gombra kattintva) toltodik be -->
        <div class="terkep-hely" id="terkep-hely">
          <span class="ikon-kor">${IKON.hely}</span>
          <p>${terkepSzoveg.html}</p>
          <button type="button" class="gomb gomb-korvonal gomb-kicsi" id="terkep-gomb">${terkepGomb.html}</button>
        </div>
      </div>
      <p>${gomb(terkepLink, 'link-gomb lv-link')}</p>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
function oldal() {
  const rs = sorok(FORRAS);
  const sz = szeletek(rs);
  const m = meta(NEV);
  const html = {
    konz: konzHtml, valt: valtHtml, garancia: garanciaHtml, zsofi: (r) => zsofiHtml(r, 'c2eb0f_c17bd26dfee2'), elso: (r) => elsoHtml(r, 'c2eb0f_460501b259d8'),
    harom: (r) => kepSzovegHtml(r, { id: 'harom-kerdes', osztaly: 'feher', kepAlt: 'Zsófi válaszol a 3 legfontosabb kérdésre', fordit: true, kepEleje: 'c2eb0f_4cb15e060d1b' }),
    kontroll: (r) => kepSzovegHtml(r, { id: 'kontroll', osztaly: 'bezs', kepAlt: 'Ingyenes kontroll a MOSAIC-ban', fordit: false, kepEleje: 'c2eb0f_c44d6debeaae' }),
    elotte: (r) => elotteHtml(r, '11062b_ddae90f0cd0c'), berlet: berletHtml, csomagok: csomagokHtml, testresz: testreszHtml, velemeny: velemenyHtml,
    szalon: (r) => szalonHtml(r, SZALON_KEPEK_FERFI), nyar: (r) => nyarHtml(r, ['46d9635a1b5a', '11062b_ef638a1bfa2f']), szep: szepHtml, gyik: gyikHtml, hely: helyHtml,
  };
  const torzs = [heroHtml(sz.hero), ...SZAKASZOK.map(([n]) => html[n](sz[n]))].join('\n\n');
  const ut = '/' + decodeURIComponent(m.canonical.replace(BAZIS + '/', ''));
  const heroKep = kep('c2eb0f_ed3e3ce78506');
  return `<!DOCTYPE html>
<html lang="hu">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${m.title}</title>
<meta name="description" content="${m.desc}">
${m.robots ? `<meta name="robots" content="${m.robots}">\n` : ''}<link rel="canonical" href="${m.canonical}">
<meta property="og:title" content="${m.title}">
<meta property="og:description" content="${m.desc}">
<meta property="og:image" content="${m.ogkep}">
<meta property="og:url" content="${m.canonical}">
<meta property="og:site_name" content="MOSAIC Headspa">
<meta property="og:type" content="website">
<link rel="icon" href="/assets/img/c2eb0f_b001e2c55098446da3e38ff055e20354.png" type="image/png">
<link rel="preload" href="${heroKep}" as="image" fetchpriority="high">
<link rel="preload" href="/assets/fonts/playfair-display-500-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/css/wix-google-fonts.css">
<link rel="stylesheet" href="/assets/css/wix-fonts.css">
<link rel="stylesheet" href="/assets/css/headspa-oldal.css">
<link rel="stylesheet" href="/assets/css/lezer-variansok.css">
<script src="/assets/js/suti.js"></script>
</head>
<body>
<!--
  MOSAIC lezeres szortelenites ferfiaknak (${NEV}) - UJ szerkezet (a Head Spa / lezeres oldalak stilusaban). A tartalom a regi (Wixes) oldal tartalma: a szovegek, arak
  (a regi "majusi" 20% kedvezmeny es a "nyarra" ajanlat is), kepek, linkek es a GYIK valtozatlanok; a regi oldal hibait / elavult adatait NEM javitottuk (lasd a PR "Eszrevetelek").
  A regi, Wixes valtozat rejtett cimen: /${NEV}-regi (noindex). A fajl a tools/lezer-variansok/gen-ferfi.mjs kimenete (a forras: forras/ferfi.folyam.txt); kezi szerkesztes
  megengedett, de az ujrafuttatas felulirja. Egyetlen H1: a regi H2 hero-cim lett H1, a regi H1-ek H2-k.
-->

<!--mh-fejlec-->
<!--mh-menu-aktiv:${ut}-->

<main id="top">
${torzs}
</main>

<!--mh-lablec-->

<script src="/assets/js/klon.js" defer></script>
<script src="/assets/js/headspa-oldal.js" defer></script>
</body>
</html>
`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ki = path.join(GYOKER, 'foglalas', NEV + '.html');
  fs.writeFileSync(ki, szokozJavit(oldal()));
  console.log('kesz:', path.relative(GYOKER, ki), fs.statSync(ki).size, 'bajt');
}
