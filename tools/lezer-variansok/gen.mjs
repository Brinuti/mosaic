// A 7 regi (Wixes) lezeres szortelenites hirdetesi oldal ujrastilusozasa, a TARTALOM valtoztatasa nelkul:
//   szortelenites-5-dolog, szortelenites-zsofi-rovid, szortelenites-zsofi-vendeg, szortelenites-zsofi-bemutatkozo,
//   szortelenites-lezeres-kezeles-folyamata, szőrtelenítés-zsófi-3 (ekezetes fajlnev, NFC), szőrtelenítés-zsófi-csomagok
// A harom hetes oldal ugyanazt a sablont koveti (hero, "ingyenes konzultacioval varlak" + Zsofi-videó, egy valtozo szakasz [5 ok / 4 szempont / vendeg-torteneten at /
// a kezeles folyamata / 3 hiba ...], Elysion Pro osszehasonlitas, garancia, berlet helyett alkalmankent, egyedi csomag, csomagarak, testreszarak, Zsofi, elso alkalom,
// 3 kerdes, ingyenes kontroll, kezeles elott / utan, velemenyek, szalon, nyari ajanlat, SZEP-kartya, GYIK, helyszin) - a sorrend es a szovegek a regi oldalrol.
//
//   node tools/lezer-variansok/gen.mjs        ->  foglalas/<nev>.html (x7)
//
// Forras: tools/lezer-variansok/forras/<kulcs>.folyam.txt = a regi oldal kinyert tartalma dokumentum-sorrendben (tools/ujrastilus/folyam.mjs kimenete,
// az eles oldalrol, a csere ELOTT). A szovegek ebbol kerulnek az oldalra valtozatlanul; a GYIK valaszai az assets/js/gyik.js-bol (a regi oldal harmonikaja).
// A kezi szerkesztes megengedett, de az ujrafuttatas felulirja a kimeneti fajlokat.
import fs from 'node:fs';
import path from 'node:path';

const GYOKER = path.resolve(import.meta.dirname, '..', '..');
const FORRAS = path.join(import.meta.dirname, 'forras');
const BAZIS = 'https://www.mosaicheadspa.hu';
const GYIK_KULCS = 'c2eb0f_7101a51e50aef2435d5ed679e90074d4';   // a regi lezeres oldalak Common Ninja GYIK-ja (assets/js/gyik.js)
const TI_EMBED = '/assets/embed/c2eb0f_614b09d160b9382c4cffcde6d7828dcb.html';   // a regi oldalak Trustindex-widgetje (loader 8a7562c4...)
// A kozos (mind a 7 oldalon azonos) kepek allando listabol jonnek: a folyam.mjs kinyero a Wix lusta / megjelenes-animacios kepeit nem mindig latja (oldalankent mas
// keszlet jon ki), a regi oldalak HTML-jeben viszont mind a 7 oldalon ugyanaz a 43 kep van ugyanabban a sorrendben.
const IMG_MAPPA = path.join(GYOKER, 'assets', 'img');
const IMG_FAJLOK = fs.readdirSync(IMG_MAPPA);
const kep = (elo) => {
  const f = IMG_FAJLOK.filter((n) => n.startsWith(elo));
  if (f.length !== 1) throw new Error('kep: nem egyertelmu / hianyzik: ' + elo + ' (' + f.length + ')');
  return '/assets/img/' + f[0];
};
const HERO_KEP = kep('c2eb0f_095b37f37006');       // "zsifi-ingyen.jpg": a regi hero hatterkepe
const CSILLAG_KEP = kep('c2eb0f_81f16bfc67fb');     // "5stars.png" a Google-ertekeles mellett

// az ekezetes fajlnev NFC-ben (mint a klon/ mappaban)
const OLDALAK = [
  { kulcs: '5-dolog', nev: 'szortelenites-5-dolog' },
  { kulcs: 'zsofi-rovid', nev: 'szortelenites-zsofi-rovid' },
  { kulcs: 'zsofi-vendeg', nev: 'szortelenites-zsofi-vendeg' },
  { kulcs: 'zsofi-bemutatkozo', nev: 'szortelenites-zsofi-bemutatkozo' },
  { kulcs: 'kezeles-folyamata', nev: 'szortelenites-lezeres-kezeles-folyamata' },
  { kulcs: 'zsofi-3', nev: 'szőrtelenítés-zsófi-3' },
  { kulcs: 'zsofi-csomagok', nev: 'szőrtelenítés-zsófi-csomagok' },
];

// a szakaszok kezdo sorai (sorrendben): [kulcs, sor-tipus, minta, (opcionalis) a keresest ettol a szakasztol kezdi]
const SZAKASZOK = [
  ['konz', 'H1', /Ingyenes konzultációval/],
  ['valt', 'VEGE', /INGYENES KONZ\. IDŐPONTOK/],       // a "valtozo" szakasz az ingyenes konzultacio gomb UTAN kezdodik
  ['osszeh', 'H1', /^Elysion Pro: A legn/],
  ['garancia', 'H2', /Rögzített ár/],
  ['berlet', 'H2', /BÉRLET HELYETT/],
  ['sajat', 'H1', /Állítsd össze/],
  ['csomagok', 'H2', /CSOMAGÁRAINK/],
  ['testresz', 'H2', /ÁRAINK csak testrészekre/],
  ['zsofi', 'H1', /Zsófi vagyok a MOSAIC/],
  ['elso', 'H1', /Mi történik az első alkalommal/],
  ['harom', 'H2', /A 3 legfontosabb kérdés/],
  ['kontroll', 'H2', /CSAK NÁLUNK/],
  ['elotte', 'H2', /Kezelés előtt/],
  ['velemeny', 'H1', /imádják vendégeink/],
  ['szalon', 'H2', /gyönyörűen felújított/],
  ['nyar', 'H2', /Nyárig a legmagabiztosabb/],
  ['szep', 'H1', /SZÉP Kártyát/],
  ['gyik', 'H2', /leggyakoribb szőrtelenítés kérdések/],
  ['hely', 'H2', /Itt találsz meg minket/],
];

const IKON = {
  hely: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.2 7-12a7 7 0 00-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
  tel: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A15 15 0 013 6a2 2 0 012-2z"/></svg>',
  ora: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  lejatszas: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>',
  elozo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 6l-6 6 6 6"/></svg>',
  kovetkezo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 6l6 6-6 6"/></svg>',
};

// ---------------------------------------------------------------------------------------------------------------------------------------------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const attr = esc;

// folyam.txt sor -> { t: tipus, x, w, h, px, html | src+alt | szoveg+href }
function sorok(fajl) {
  const ki = [];
  for (const l of fs.readFileSync(fajl, 'utf8').split('\n')) {
    if (!l.trim()) continue;
    const m = /^\s*(\d+)\s+(KEP|VIDEO|IFRAME|SZ|H1|H2|H3|H4|GOMB)\s+x(-?\d+)\s+w(\d+)\s*(?:h(\d+))?\s*(.*)$/.exec(l);
    if (!m) throw new Error('ismeretlen sor: ' + l.slice(0, 80));
    const r = { y: +m[1], t: m[2], x: +m[3], w: +m[4], h: m[5] ? +m[5] : 0, raw: m[6] };
    if (r.t === 'KEP') {
      const k = /^(\S+)(?:\s+\[alt: (.*)\])?\s*$/.exec(m[6]);
      r.src = k[1]; r.alt = k[2] || '';
    } else if (r.t === 'VIDEO' || r.t === 'IFRAME') {
      r.src = m[6].trim();
    } else {
      const p = /^([\d.]+)px\s+(?:(?:center|left|right)\s+)?/.exec(m[6]);
      r.px = p ? parseFloat(p[1]) : 0;
      const s = m[6].replace(/^[\d.]+px\s+(?:(?:center|left|right)\s+)?/, '');
      if (r.t === 'GOMB') {
        const g = /^(.*?)\s+->\s+(\S+)\s*$/.exec(s);
        if (g) { r.html = g[1].trim(); r.href = g[2]; } else r.html = s.trim();
      } else r.html = s.trim();
    }
    ki.push(r);
  }
  return ki;
}
const szoveg = (html) => html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
// a fejlec-sorok kulso <b>...</b> burkolata folosleges (a fejlec stilusa eleve vastagabb); a vegi <br> is
const fejSzoveg = (html) => {
  let h = html.trim().replace(/(?:<br\s*\/?>\s*)+$/, '');
  const m = /^<b>([\s\S]*)<\/b>$/.exec(h);
  return m && !/<b>/.test(m[1]) ? m[1].trim() : h;
};
const cim = fejSzoveg;
const kepId = (src) => /\/([^/]+?)\.(?:jpe?g|png|webp)$/.exec(src)[1];

// a szakaszok szeletei
function szeletek(rs, kulcs) {
  const kezd = [['hero', 0]];
  let from = 1;
  for (const [nev, tipus, minta] of SZAKASZOK) {
    let i = -1;
    if (tipus === 'VEGE') {
      for (let k = from; k < rs.length; k++) if (rs[k].t === 'GOMB' && minta.test(szoveg(rs[k].html))) { i = k + 1; break; }
    } else {
      for (let k = from; k < rs.length; k++) if (rs[k].t === tipus && minta.test(rs[k].src ? rs[k].src : szoveg(rs[k].html || ''))) { i = k; break; }
    }
    if (i < 0) throw new Error(`${kulcs}: nincs "${nev}" szakasz-kezdet (${tipus} ${minta})`);
    kezd.push([nev, i]); from = i + 1;
  }
  const ki = {};
  kezd.forEach(([nev, i], n) => { ki[nev] = rs.slice(i, n + 1 < kezd.length ? kezd[n + 1][1] : rs.length); });
  // a konzultacio-szakasz a VEGE-gombig tart: a "konz" szeletbe a gomb is bekerul
  return ki;
}

// a folyam.mjs kinyeroje a szomszedos Wix-szovegelemek koze szokozt tesz, ahol a regi oldalon NINCS: ezeket visszaallitjuk (ha kell)
const FOLYAM_SZOKOZ = [];
const szokozJavit = (h) => FOLYAM_SZOKOZ.reduce((x, [a, b]) => x.split(a).join(b), h);

const rendez = (rs, t) => rs.filter((r) => r.t === t);
// Az arlista-szovegblokkokat (csomagarak / testreszarak: Wix-ismetlo, 1 hatalmas szovegsor) a kinyero 2 / 7 oldalon nem latta; mivel a regi oldalak HTML-jeben mind a 7-ben
// ugyanaz a szoveg all, az ARRA az oldalra a tobbi oldalbol potoljuk - de CSAK ha minden oldal, ahol latszik, pontosan ugyanazt a szoveget adta (kulonben hiba).
const TABLAK = {};
function tablakBetolt() {
  for (const o of OLDALAK) {
    const rs = sorok(path.join(FORRAS, o.kulcs + '.folyam.txt'));
    const sl = szeletek(rs, o.kulcs);
    for (const k of ['csomagok', 'testresz']) {
      const t = sl[k].find((r) => r.t === 'SZ' && r.w > 1000);
      if (!t) continue;
      if (TABLAK[k] && TABLAK[k].html !== t.html) throw new Error(`a ${k} arlista szovege oldalankent elter (${o.kulcs})`);
      TABLAK[k] = t;
    }
  }
}
const tablaSor = (rs, kulcs) => rs.find((r) => r.t === 'SZ' && r.w > 1000) || TABLAK[kulcs];
function videoFajl(poster) {
  const azon = kepId(poster).replace(/f00\d$/, '');
  const f = `/assets/video/${azon}.mp4`;
  if (!fs.existsSync(path.join(GYOKER, f.slice(1)))) throw new Error('hianyzik a videofajl: ' + f);
  return f;
}
const meretek = new Map();
function kepMeret(src) {
  if (meretek.has(src)) return meretek.get(src);
  const f = path.join(GYOKER, src.slice(1));
  if (!fs.existsSync(f)) throw new Error('hianyzik a kep: ' + src);
  const b = fs.readFileSync(f); let w = 0, h = 0;
  if (/\.jpe?g$/i.test(f)) {
    let i = 2;
    while (i < b.length) { if (b[i] !== 0xff) { i++; continue; } const m = b[i + 1]; if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) { h = b.readUInt16BE(i + 5); w = b.readUInt16BE(i + 7); break; } i += 2 + b.readUInt16BE(i + 2); }
  } else if (/\.png$/i.test(f)) { w = b.readUInt32BE(16); h = b.readUInt32BE(20); }
  else if (/\.webp$/i.test(f)) { if (b.toString('ascii', 12, 16) === 'VP8X') { w = 1 + b.readUIntLE(24, 3); h = 1 + b.readUIntLE(27, 3); } else if (b.toString('ascii', 12, 16) === 'VP8 ') { w = b.readUInt16LE(26) & 0x3fff; h = b.readUInt16LE(28) & 0x3fff; } }
  if (!w || !h) throw new Error('nem olvashato a kep merete: ' + src);
  meretek.set(src, [w, h]);
  return [w, h];
}
function img(src, alt, extra = '') {
  const [w, h] = kepMeret(src);
  return `<img src="${attr(src)}" alt="${attr(alt)}" width="${w}" height="${h}"${extra}>`;
}
// a regi oldalon a kepek alt-szovege sokszor a fajlnev ("zsofi.jpg"): ezt nem hasznaljuk, helyette leiro szoveg
const jaltAlt = (k, tartalek) => (k.alt && !/^[\w. -]+\.(jpe?g|png|webp)$/i.test(k.alt) && !/^(Image by|Woman Near|Head Massage|Stylish|Spa Salts)/i.test(k.alt) ? k.alt : tartalek);

function videoKartya(posterSrc, felirat) {
  const f = videoFajl(posterSrc);
  const [pw, ph] = kepMeret(posterSrc);
  return `<button type="button" class="video-kartya" data-video="${f}" data-poster="${attr(posterSrc)}" aria-label="Videó lejátszása: ${attr(felirat)}" style="aspect-ratio: ${pw} / ${ph}">
  ${img(posterSrc, '', ' loading="lazy"')}<span class="video-play">${IKON.lejatszas}</span>
</button>`;
}
// a regi oldal gombjai: a 10 px-es (nagybetus, kiritkitott) gomb "tomor" arany gomb, a nagyobb betus egy szoveges link-gomb
function gomb(r, osztaly, extra = '') {
  const kulso = /^https?:/.test(r.href);
  const arany = r.px && r.px <= 12;
  const o = osztaly || (arany ? 'gomb gomb-arany' : 'link-gomb lv-link');
  return `<a class="${o}" href="${attr(r.href)}"${extra}${kulso ? ' target="_blank" rel="noopener"' : ''}>${r.html}${arany || osztaly ? ' <span class="nyil" aria-hidden="true">→</span>' : ''}</a>`;
}
// a link-gombok ("vagy Ingyenes Konzultacio Idopontok >>") a regi oldalon egy sorban allnak
const gombSor = (gombok, osztaly = 'cta-sor') => (gombok.length ? `<div class="${osztaly}">\n${gombok.map((g) => `          ${gomb(g)}`).join('\n')}\n        </div>` : '');
const aranyok = (rs) => rs.filter((r) => r.t === 'GOMB' && r.px <= 12);
const linkek = (rs) => rs.filter((r) => r.t === 'GOMB' && r.px > 12);
const paragrafusok = (sz) => sz.map((r) => `        <p>${r.html}</p>`).join('\n');

// ---------------------------------------------------------------------------------------------------------------------------------------------
function heroHtml(rs, nev) {
  const h = rs.find((r) => r.t === 'H1' || r.t === 'H2');
  const elsoGomb = rs.findIndex((r) => r.t === 'GOMB');
  const lead = rs.slice(rs.indexOf(h) + 1, elsoGomb).filter((r) => r.t === 'SZ');
  const gombok = rs.filter((r) => r.t === 'GOMB');
  const utana = rs.slice(elsoGomb + gombok.length).filter((r) => r.t === 'SZ');
  const ertekeles = utana.find((r) => /^<b>Google/.test(r.html) || /^Google/.test(r.html));
  const sorok_ = utana.filter((r) => r !== ertekeles);
  const kulcs = nev.replace(/^sz\S+?telen\S+?s-/, '');
  const horgony = gombok[0].href.includes('#') ? ` id="${attr(gombok[0].href.split('#')[1])}"` : '';
  return `<section class="hero lv-hero">
  <div class="tartalom hero-racs">
    <div class="hero-szoveg">
      <h1>${cim(h.html)}</h1>
${lead.map((r) => `      <p class="hero-al">${r.html}</p>`).join('\n')}
      <div class="cta-sor">
        ${gomb(gombok[0], 'gomb gomb-korvonal', horgony)}
        ${gomb(gombok[1], 'gomb gomb-arany')}
      </div>
${sorok_.map((r, i) => `      <p class="lv-sor">${r.html}</p>`).join('\n')}
${ertekeles ? `      <p class="lv-ertekeles">${img(CSILLAG_KEP, '5 csillag', ' loading="eager"')}<span>${ertekeles.html}</span></p>` : ''}
    </div>
    <figure class="hero-kep lv-hero-kep">${img(HERO_KEP, 'Lézeres szőrtelenítés Elysion Pro géppel a MOSAIC-ban', ' fetchpriority="high"')}</figure>
  </div>
</section>`;
}

// az ingyenes konzultacio + Zsofi bemutatkozo videoja
function konzHtml(rs) {
  const h = rs.find((r) => r.t === 'H1');
  const poster = { src: kep('c2eb0f_ba9a927739a6') };    // Zsofi bemutatkozo videojanak nyito kepe
  const sz = rs.filter((r) => r.t === 'SZ');
  const alcim = sz[0];                                  // "kockazatmentes / kotelezettsegmentes / 0 ft - Nezd meg a videot!"
  const szoveg_ = sz.slice(1);
  const g = rs.find((r) => r.t === 'GOMB');
  return `<section class="szekcio lv-sotet" id="konzultacio" aria-labelledby="konzultacio-cim">
  <div class="tartalom">
    <div class="szekcio-fej">
      <h2 id="konzultacio-cim">${cim(h.html)}</h2>
      <span class="rombusz" aria-hidden="true"></span>
      <p class="lead">${alcim.html}</p>
    </div>
    <div class="fel-racs felul cikk lv-konz">
      <div>
${paragrafusok(szoveg_)}
      </div>
      <div class="video-egy">
        ${videoKartya(poster.src, 'Zsófi bemutatkozik')}
      </div>
    </div>
    <div class="kozepre-sor">
      ${gomb(g)}
    </div>
  </div>
</section>`;
}

// a valtozo szakasz (5 ok / 4 szempont / vendeg-tortenet / a kezeles folyamata / 3 hiba / csomagok): opcionalis kep + cim + alcim + bekezdesek
function valtHtml(rs, nev) {
  const h = rs.find((r) => r.t === 'H1');
  const sz = rs.filter((r) => r.t === 'SZ');
  const alcim = sz.find((r) => r.w < 450);
  const tobbi = sz.filter((r) => r !== alcim);
  const figura = `<figure class="kep-fig lv-valt-kep">${img(kep('c2eb0f_d25d1e56510f'), 'Lézeres szőrtelenítés eredménye: előtte és utána', ' loading="lazy"')}</figure>`;
  const jelvenyek = [['c2eb0f_524a72a0105e', 'Fájdalommentes'], ['c2eb0f_93549c4ac92e', 'Biztonságos'], ['c2eb0f_a37ff0190db1', 'Gyors és tartós']];
  return `<section class="szekcio zsalya" id="szempontok" aria-labelledby="szempontok-cim">
  <div class="tartalom">
    <div class="fel-racs felul lv-valt">
      ${figura}
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

// Elysion Pro osszehasonlitas: 3 oszlop (kep + cimke + elonyok / hatranyok)
function osszehHtml(rs) {
  const h = rs.find((r) => r.t === 'H1');
  const kepek = [{ src: kep('c2eb0f_6a8bd2b7007d') }, { src: kep('c2eb0f_3082081d2e58') }, { src: kep('c2eb0f_07b1f4457d06') }];
  const sz = rs.filter((r) => r.t === 'SZ');
  const alcim = sz[0];
  const oszlop = (x) => (x < 500 ? 0 : x < 850 ? 1 : 2);
  const cimkek = [[], [], []]; const tetelek = [[], [], []];
  const felirat = sz.slice(1).filter((r) => r.w < 160 && /^(Gyanta|Más|Elysion|Diódalézer)/.test(szoveg(r.html)));
  for (const r of felirat) cimkek[oszlop(r.x)].push(r.html);
  for (const r of sz.slice(1)) { if (felirat.includes(r)) continue; tetelek[oszlop(r.x)].push(r); }
  if (cimkek.some((c) => !c.length)) throw new Error('osszehasonlitas: varatlan szerkezet');
  const ALTOK = ['Gyantázás és borotválás', 'Más típusú lézerek', 'Elysion Pro diódalézer'];
  return `<section class="szekcio feher" id="elysion-pro" aria-labelledby="elysion-cim">
  <div class="tartalom">
    <div class="szekcio-fej">
      <h2 id="elysion-cim">${cim(h.html)}</h2>
      <span class="rombusz" aria-hidden="true"></span>
      <p class="lead">${alcim.html}</p>
    </div>
    <div class="lv-vs">
${[0, 1, 2].map((i) => `      <article class="lv-vs-oszlop${i === 2 ? ' kiemelt' : ''}">
        <figure>${img(kepek[i].src, ALTOK[i], ' loading="lazy"')}</figure>
        <h3>${cimkek[i].join('<br>')}</h3>
        <ul>
${tetelek[i].sort((a, b) => a.y - b.y).map((r) => `          <li>${r.html}</li>`).join('\n')}
        </ul>
      </article>`).join('\n')}
    </div>
  </div>
</section>`;
}

function garanciaHtml(rs) {
  const h = rs.find((r) => r.t === 'H2');
  const k = { src: kep('c2eb0f_bfd0d43979b2') };
  const sz = rs.filter((r) => r.t === 'SZ');
  const gombok = rs.filter((r) => r.t === 'GOMB');
  return `<section class="szekcio bezs" id="garancia" aria-labelledby="garancia-cim">
  <div class="tartalom">
    <div class="fel-racs lv-garancia">
      <figure class="kep-fig lv-kicsi">${img(k.src, 'Árgarancia és 12 hónap garancia', ' loading="lazy"')}</figure>
      <div class="cikk">
        <h2 id="garancia-cim">${cim(h.html)}</h2>
${paragrafusok(sz)}
        <div class="cta-sor">
          ${gombok.map((g) => gomb(g)).join('\n          ')}
        </div>
      </div>
    </div>
  </div>
</section>`;
}

// bérlet helyett alkalmankent: hatterkep + cim + kep + 3 pont + gombok
function berletHtml(rs) {
  const bg = { src: kep('c2eb0f_8c347f764efd') };
  const k = { src: kep('c2eb0f_4afa5a45a0b5') };
  const h = rs.find((r) => r.t === 'H2');
  const sz = rs.filter((r) => r.t === 'SZ');
  const gombok = rs.filter((r) => r.t === 'GOMB');
  return `<section class="szekcio lv-hatterkepes" id="alkalmankent" aria-labelledby="alkalmankent-cim">
  ${img(bg.src, '', ' class="lv-hatterkep" loading="lazy" decoding="async"')}
  <div class="tartalom">
    <div class="szekcio-fej">
      <h2 id="alkalmankent-cim">${cim(h.html)}</h2>
      <span class="rombusz" aria-hidden="true"></span>
    </div>
    <div class="lv-berlet">
      <figure class="kep-fig">${img(k.src, 'A lézeres szőrtelenítés 3 kedvezménye', ' loading="lazy"')}</figure>
      <ol class="lv-pontok">
${sz.map((r) => `        <li>${r.html.replace(/^\d\.\s*/, '')}</li>`).join('\n')}
      </ol>
    </div>
    <div class="kozepre-sor">
      ${gombok.map((g) => gomb(g)).join('\n      ')}
    </div>
  </div>
</section>`;
}

// egyedi csomag: kep + cim + alcim + bekezdesek + link
function sajatHtml(rs) {
  const k = { src: kep('c2eb0f_d25d1e56510f') };
  const h = rs.find((r) => r.t === 'H1');
  const sz = rs.filter((r) => r.t === 'SZ');
  const alcim = sz.find((r) => r.w < 450);
  const tobbi = sz.filter((r) => r !== alcim);
  const g = rs.filter((r) => r.t === 'GOMB');
  // a "- Lab + kar ... => X Ft helyett Y Ft" sorok listaja
  const pelda = tobbi.filter((r) => /^-\s/.test(szoveg(r.html)));
  const elso = tobbi.indexOf(pelda[0]);
  const eleje = tobbi.slice(0, elso);
  const vege = tobbi.slice(elso + pelda.length);
  return `<section class="szekcio zsalya" id="egyedi-csomag" aria-labelledby="egyedi-cim">
  <div class="tartalom">
    <div class="fel-racs felul lv-valt">
      <figure class="kep-fig lv-valt-kep">${img(k.src, 'Egyedi lézeres szőrtelenítési csomag', ' loading="lazy"')}</figure>
      <div class="cikk">
        <h2 id="egyedi-cim">${cim(h.html)}</h2>
${alcim ? `        <p class="lv-alcim">${alcim.html}</p>\n` : ''}${paragrafusok(eleje)}
        <ul class="lv-peldak">
${pelda.map((r) => `          <li>${r.html}</li>`).join('\n')}
        </ul>
${paragrafusok(vege)}
${gombSor(g)}
      </div>
    </div>
  </div>
</section>`;
}

// csomagarak: a regi oldal egy lapos szovegblokkja -> kartyak
const CSOMAG_KEPEK = ['c2eb0f_0023523b7649', 'c2eb0f_0723e1ff39a4', 'c2eb0f_64bff2b34999', 'c2eb0f_785760416d73', 'c2eb0f_6fec10dbd1b6'];   // EGYEDI, BASIC, MEDIUM, SUMMER, TOTAL
const TESTRESZ_KEPEK = ['c2eb0f_fe2ae1a8676f', 'c2eb0f_b3a5aa5289a9', 'c2eb0f_9c43d7be8ec8', 'c2eb0f_5ff7732abc6c'];                        // ARC, TEST, INTIM, LABAK
const KARTYA_MEZOK = /^<b>(.+?)<\/b>(.*?)\s*<b>8 alkalmas program:\s*<\/b>\s*([^<]*?)\s*<b>\s*(.*?)\s*✅\s*12 hó garancia:\s*<\/b>(.*?)\s*<b>✅\s*Ágarancia:\s*(.*?)<\/b>\s*Csak 6 alkalmat fizetsz\s*(?:<b>(.*?)\s*\/\s*alkalom<\/b>)?\s*\(A 4\. és 8\. ajándék!\)\s*(?:Spórolsz\s*:?\s*<b>\s*:?\s*(.*?)\s*<\/b>)?\s*$/;
function csomagKartyak(html) {
  const darabok = html.split(/<a href="([^"]+)">\s*(IDŐPONTFOGLALÁS!)\s*<\/a>/);
  const ki = [];
  for (let i = 0; i + 2 < darabok.length + 1; i += 3) {
    const test = darabok[i]; const href = darabok[i + 1]; const felirat = darabok[i + 2];
    if (!test || !test.trim()) continue;
    const m = KARTYA_MEZOK.exec(test.trim());
    if (!m) throw new Error('csomagkartya: ismeretlen szerkezet: ' + test.slice(0, 140));
    const [, cimsor, leiras, athuzott, uj, g1, g2, per, megtakaritas] = m;
    const szavak = szoveg(cimsor).split(' ');
    ki.push({ kep: CSOMAG_KEPEK[ki.length], nev: szavak[0], cim: szavak.slice(1).join(' '), leiras: szoveg(leiras), regi: athuzott.replace(/̶/g, '').trim(), uj: uj.trim(), g1: g1.trim(), g2: g2.trim(), per: per ? per.trim() : '', megtakaritas: megtakaritas ? megtakaritas.trim() : '', href, felirat });
  }
  return ki;
}
function csomagokHtml(rs) {
  const h = rs.find((r) => r.t === 'H2');
  const sz = rs.filter((r) => r.t === 'SZ');
  const alcim = sz.find((r) => r.w < 700);
  const tabla = tablaSor(rs, 'csomagok');
  const g = rs.filter((r) => r.t === 'GOMB');
  const kk = csomagKartyak(tabla.html);
  if (kk.length !== 5) throw new Error('csomagarak: 5 kartya kellene, ' + kk.length + ' van');
  return `<section class="szekcio feher" id="csomagarak" aria-labelledby="csomagarak-cim">
  <div class="tartalom">
    <div class="szekcio-fej">
      <h2 id="csomagarak-cim">${cim(h.html)}</h2>
      <span class="rombusz" aria-hidden="true"></span>
      <p class="lead lv-dolt">${alcim.html}</p>
    </div>
    <div class="lv-csomagok">
${kk.map((k) => `      <article class="lv-csomag">
        <figure class="lv-kartya-kep">${img(kep(k.kep), k.nev + ' csomag', ' loading="lazy"')}</figure>
        <h3><span class="lv-csomag-nev">${k.nev}</span> ${k.cim}</h3>
        <p class="lv-csomag-leiras">${k.leiras}</p>
        <p class="lv-csomag-prog"><b>8 alkalmas program:</b></p>
        <p class="lv-csomag-ar${/\d/.test(k.uj) ? '' : ' szoveges'}">${k.regi ? `<s>${k.regi}</s> ` : ''}<b>${k.uj}</b></p>
        <ul class="lv-csomag-garancia">
          <li><b>12 hó garancia:</b> ${k.g1}</li>
          <li><b>Ágarancia:</b> ${k.g2}</li>
        </ul>
        <p class="lv-csomag-per">Csak 6 alkalmat fizetsz${k.per ? ` <b>${k.per} / alkalom</b>` : ''} (A 4. és 8. ajándék!)</p>
${k.megtakaritas ? `        <p class="lv-csomag-sporolsz">Spórolsz: <b>${k.megtakaritas}</b></p>\n` : ''}        <a class="gomb gomb-arany" href="${attr(k.href)}">${k.felirat} <span class="nyil" aria-hidden="true">→</span></a>
      </article>`).join('\n')}
    </div>
    ${gombSor(g, 'kozepre-sor')}
  </div>
</section>`;
}

// testreszarak: csoportok (ARC / TEST / INTIM / 2 LAB) -> kartyak, soronkent alkalmi es 8 alkalmas ar
function testreszCsoportok(html) {
  const darabok = html.split(/<a href="([^"]+)">\s*(FOGLALOK!)\s*<\/a>/);
  const ki = [];
  for (let i = 0; i + 2 < darabok.length + 1; i += 3) {
    const test = darabok[i]; const href = darabok[i + 1]; const felirat = darabok[i + 2];
    if (!test || !test.trim()) continue;
    const c = /^<b>(.+?)<\/b>(.*)$/.exec(test.trim());
    if (!c) throw new Error('testreszar: nincs csoportcim: ' + test.slice(0, 100));
    const tetelek = [];
    const re = /\s*(.+?) alkalmi:\s*([\d.]+ Ft)\s+\1 8 alkalom:\s*([\d.]+ Ft)\s*<b>\s*(Kedvezmény[^:<]*?):\s*([\d.]+ Ft)\s*<\/b>/g;
    let m; let vege = 0;
    while ((m = re.exec(c[2]))) { tetelek.push({ nev: m[1].trim(), alkalmi: m[2], nyolc: m[3], kedv: m[4].trim(), kedvAr: m[5] }); vege = re.lastIndex; }
    if (!tetelek.length || c[2].slice(vege).trim()) throw new Error('testreszar: ismeretlen szerkezet: ' + c[2].slice(vege).slice(0, 100));
    ki.push({ kep: TESTRESZ_KEPEK[ki.length], cim: c[1].trim(), tetelek, href, felirat });
  }
  return ki;
}
function testreszHtml(rs) {
  const h = rs.find((r) => r.t === 'H2');
  const sz = rs.filter((r) => r.t === 'SZ');
  const alcim = sz.find((r) => r.w < 700);
  const tabla = tablaSor(rs, 'testresz');
  const g = rs.filter((r) => r.t === 'GOMB');
  const cs = testreszCsoportok(tabla.html);
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
      </article>`).join('\n')}
    </div>
    ${gombSor(g, 'kozepre-sor')}
  </div>
</section>`;
}

// Zsofi bemutatkozik: kep + cim + bekezdesek + gombok
function zsofiHtml(rs) {
  const h = rs.find((r) => r.t === 'H1');
  const k = { src: kep('c2eb0f_b93a709a951c') };
  const sz = rs.filter((r) => r.t === 'SZ');
  const gombok = rs.filter((r) => r.t === 'GOMB');
  return `<section class="szekcio feher" id="zsofi" aria-labelledby="zsofi-cim">
  <div class="tartalom">
    <div class="fel-racs">
      <figure class="kep-fig lv-kicsi">${img(k.src, 'Zsófi, a MOSAIC Elysion Pro szakértője', ' loading="lazy"')}</figure>
      <div class="cikk">
        <h2 id="zsofi-cim">${cim(h.html)}</h2>
${paragrafusok(sz)}
        <div class="cta-sor">
          ${aranyok(gombok).map((g) => gomb(g)).join('\n          ')}
          ${linkek(gombok).map((g) => gomb(g)).join('\n          ')}
        </div>
      </div>
    </div>
  </div>
</section>`;
}

// mi tortenik az elso alkalommal: kep + cim + bevezeto + 2 felsorolas (H4)
function elsoHtml(rs) {
  const k = { src: kep('c2eb0f_1b8e14163369') };
  const h = rs.find((r) => r.t === 'H1');
  const hi = rs.indexOf(h);
  const utan = rs.slice(hi + 1);
  const reszek = [];
  let lista = [];
  const vegLista = () => { if (lista.length) { reszek.push(`        <ul class="lv-lista">\n${lista.map((l) => `          <li>${l}</li>`).join('\n')}\n        </ul>`); lista = []; } };
  let bevezeto = true;
  for (const r of utan) {
    if (r.t === 'H4') { vegLista(); bevezeto = false; reszek.push(`        <h3>${cim(r.html)}</h3>`); continue; }
    if (r.t !== 'SZ') continue;
    if (bevezeto) reszek.push(`        <p>${r.html}</p>`); else lista.push(r.html);
  }
  vegLista();
  return `<section class="szekcio zsalya" id="elso-alkalom" aria-labelledby="elso-cim">
  <div class="tartalom">
    <div class="fel-racs felul fordit">
      <div class="cikk">
        <h2 id="elso-cim">${cim(h.html)}</h2>
${reszek.join('\n')}
      </div>
      <figure class="kep-fig lv-valt-kep">${img(k.src, 'Ingyenes konzultáció a MOSAIC-ban', ' loading="lazy"')}</figure>
    </div>
  </div>
</section>`;
}

// kep + cim (+ alcim) + bekezdesek (3 kerdes, ingyenes kontroll): ugyanaz a szerkezet
function kepSzovegHtml(rs, { id, osztaly, kepAlt, fordit, kepEleje }) {
  const k = { src: kep(kepEleje) };
  const h = rs.find((r) => r.t === 'H2');
  const sz = rs.filter((r) => r.t === 'SZ');
  const alcim = sz.find((r) => r.px >= 19 && r.px <= 21);
  const tobbi = sz.filter((r) => r !== alcim);
  const gombok = rs.filter((r) => r.t === 'GOMB');
  return `<section class="szekcio ${osztaly}" id="${id}" aria-labelledby="${id}-cim">
  <div class="tartalom">
    <div class="fel-racs${fordit ? ' fordit' : ''}">
      <div class="cikk">
        <h2 id="${id}-cim">${cim(h.html)}</h2>
${alcim ? `        <p class="lv-alcim">${alcim.html}</p>\n` : ''}${paragrafusok(tobbi)}
${gombSor(gombok)}
      </div>
      <figure class="kep-fig lv-kicsi">${img(k.src, kepAlt, ' loading="lazy"')}</figure>
    </div>
  </div>
</section>`;
}
const haromHtml = (rs) => kepSzovegHtml(rs, { id: 'harom-kerdes', osztaly: 'feher', kepAlt: 'Zsófi válaszol a 3 legfontosabb kérdésre', fordit: true, kepEleje: 'c2eb0f_f5b87c4c4fd6' });
const kontrollHtml = (rs) => kepSzovegHtml(rs, { id: 'kontroll', osztaly: 'bezs', kepAlt: 'Ingyenes kontroll a MOSAIC-ban', fordit: false, kepEleje: 'c2eb0f_465534672531' });

// kezeles elott / utan
function elotteHtml(rs) {
  const k = { src: kep('11062b_b1d8a570d7e7') };
  const fejek = rs.filter((r) => r.t === 'H2');
  const reszek = fejek.map((f, i) => {
    const kov = fejek[i + 1];
    const sz = rs.slice(rs.indexOf(f) + 1, kov ? rs.indexOf(kov) : rs.length).filter((r) => r.t === 'SZ');
    return `        <h3>${cim(f.html)}</h3>\n        <ul class="lv-lista">\n${sz.map((r) => `          <li>${r.html}</li>`).join('\n')}\n        </ul>`;
  });
  return `<section class="szekcio zsalya" id="kezeles-elott-utan" aria-label="Kezelés előtt és után">
  <div class="tartalom">
    <div class="fel-racs felul">
      <div class="cikk">
${reszek.join('\n')}
      </div>
      <figure class="kep-fig lv-valt-kep">${img(k.src, 'Hogyan készülj a lézeres szőrtelenítésre és mire figyelj utána', ' loading="lazy"')}</figure>
    </div>
  </div>
</section>`;
}

function velemenyHtml(rs) {
  const h = rs.find((r) => r.t === 'H1');
  return `<section class="szekcio feher" id="velemenyek" aria-labelledby="velemenyek-cim">
  <div class="tartalom">
    <div class="szekcio-fej">
      <h2 id="velemenyek-cim">${cim(h.html)}</h2>
      <span class="rombusz" aria-hidden="true"></span>
    </div>
    <!-- a Trustindex-velemenyek MINDIG azonnal megjelennek (lasd headspa-oldal.js): a helykitolto csak a keret megjeleneseig all a helyen -->
    <div class="ti-doboz" id="trustindex" data-embed="${TI_EMBED}">
      <div class="ti-hely" id="ti-hely">
        <p>Vélemények betöltése…</p>
        <a class="link-gomb" href="https://www.google.com/maps/search/?api=1&amp;query=MOSAIC%20Head%20Spa%2C%201023%20Budapest%2C%20B%C3%A9csi%20%C3%BAt%202." target="_blank" rel="noopener">Megnyitás a Google Térképen</a>
      </div>
    </div>
  </div>
</section>`;
}

const SZALON_KEPEK = [
  ['c2eb0f_ac85eea74409', 'A MOSAIC váró- és recepciós tere'],
  ['c2eb0f_aa3b2f8ec756', 'A váró zöld bársonyfotelekkel'],
  ['c2eb0f_00a2f4bd0e9b', 'A bejárat a MOSAIC emblémával és a macska-szoborral'],
  ['c2eb0f_1e869857461', 'A kezelőhelyiség mosdója és tárolója virágokkal'],
  ['c2eb0f_a63c0e640ebb', 'A kezelőhelyiség kezelőággyal'],
  ['c2eb0f_ad609656f774', 'Az Elysion Pro lézer és a kezelőágy'],
];
function szalonHtml(rs) {
  const h = rs.find((r) => r.t === 'H2');
  return `<section class="szekcio zsalya" id="szalon" aria-labelledby="szalon-cim">
  <div class="tartalom">
    <div class="szekcio-fej">
      <h2 id="szalon-cim">${cim(h.html)}</h2>
      <span class="rombusz" aria-hidden="true"></span>
    </div>
    <div class="korhinta nagy-elem">
      <button type="button" class="korhinta-gomb elozo" aria-label="Előző kép" disabled>${IKON.elozo}</button>
      <div class="korhinta-sav">
${SZALON_KEPEK.map(([e, a]) => `        <figure>${img(kep(e), a, ' loading="lazy"')}</figure>`).join('\n')}
      </div>
      <button type="button" class="korhinta-gomb kovetkezo" aria-label="Következő kép">${IKON.kovetkezo}</button>
    </div>
  </div>
</section>`;
}

// nyari ajanlat: 2 kep + cim + bekezdesek + gombok
function nyarHtml(rs) {
  const kepek = [{ src: kep('11062b_da7d7151d059') }, { src: kep('11062b_ef638a1bfa2f') }];
  const h = rs.find((r) => r.t === 'H2');
  const sz = rs.filter((r) => r.t === 'SZ');
  const gombok = rs.filter((r) => r.t === 'GOMB');
  const [alcim, ...tobbi] = sz;
  return `<section class="szekcio lv-hatterkepes lv-vilagos" id="ajanlat" aria-labelledby="ajanlat-cim">
  ${img(kepek[1].src, '', ' class="lv-hatterkep" loading="lazy" decoding="async"')}
  <div class="tartalom">
    <div class="fel-racs">
      <figure class="kep-fig lv-kicsi">${img(kepek[0].src, 'Nyár, napfény, sima bőr', ' loading="lazy"')}</figure>
      <div class="cikk lv-kartya">
        <h2 id="ajanlat-cim">${cim(h.html)}</h2>
        <p class="lv-alcim">${alcim.html}</p>
${paragrafusok(tobbi)}
        <div class="cta-sor">
          ${aranyok(gombok).map((g) => gomb(g)).join('\n          ')}
          ${linkek(gombok).map((g) => gomb(g)).join('\n          ')}
        </div>
      </div>
    </div>
  </div>
</section>`;
}

function szepHtml(rs) {
  const k = { src: kep('c2eb0f_3603018cb350') };
  const h = rs.find((r) => r.t === 'H1');
  const g = rs.filter((r) => r.t === 'GOMB');
  return `<section class="szekcio feher" id="szep-kartya" aria-labelledby="szep-cim">
  <div class="tartalom">
    <div class="fel-racs">
      <figure class="kep-fig">${img(k.src, 'SZÉP Kártya elfogadóhely', ' loading="lazy"')}</figure>
      <div class="cikk">
        <h2 id="szep-cim">${cim(h.html)}</h2>
        ${g.map((x) => gomb(x)).join('\n        ')}
      </div>
    </div>
  </div>
</section>`;
}

let gyikAdat = null;
function gyikValaszok() {
  if (gyikAdat) return gyikAdat;
  const s = fs.readFileSync(path.join(GYOKER, 'assets/js/gyik.js'), 'utf8');
  const m = /window\.MH_GYIK = (\{[\s\S]*\});?\s*$/.exec(s);
  gyikAdat = JSON.parse(m[1])[GYIK_KULCS];
  if (!gyikAdat) throw new Error('nincs a GYIK a gyik.js-ben: ' + GYIK_KULCS);
  return gyikAdat;
}
function gyikHtml(rs) {
  const bg = { src: kep('nsplsh_38734f5a4a384a46305338-1280') };
  const h = rs.find((r) => r.t === 'H2');
  const kerdesek = rs.filter((r) => r.t === 'GOMB');
  const v = gyikValaszok();
  // a kinyero a harmonika zart kerdeseit nem mindig latja (5 / 7 oldalon 0 kerdes jon ki): ha latja, ellenorizzuk a gyik.js-sel
  if (kerdesek.length) {
    if (v.length !== kerdesek.length) throw new Error(`GYIK: ${kerdesek.length} kerdes a regi oldalon, ${v.length} a gyik.js-ben`);
    kerdesek.forEach((k, i) => { if (szoveg(k.html) !== v[i][0]) throw new Error('GYIK-kerdes elter: ' + k.html + ' / ' + v[i][0]); });
  }
  return `<section class="szekcio lv-hatterkepes" id="gyik" aria-labelledby="gyik-cim">
  ${img(bg.src, '', ' class="lv-hatterkep" loading="lazy" decoding="async"')}
  <div class="tartalom lv-szuk">
    <div class="szekcio-fej">
      <h2 id="gyik-cim">${cim(h.html)}</h2>
      <span class="rombusz" aria-hidden="true"></span>
    </div>
    <div class="gyik">
${v.map(([k, a]) => `      <details><summary>${k}</summary><div class="gy-valasz">${a}</div></details>`).join('\n')}
    </div>
  </div>
</section>`;
}

function helyHtml(rs) {
  const bg = { src: kep('11062b_c676302884b3') };
  const k2 = { src: kep('c2eb0f_3d447a4483a5') };
  const h = rs.find((r) => r.t === 'H2');
  const sz = rs.filter((r) => r.t === 'SZ');
  const telefon = sz.find((r) => /^06 20/.test(r.html));
  const cimSor = sz.find((r) => /Bécsi út/.test(r.html) && r.w < 300);
  const email = sz.find((r) => /@/.test(r.html));
  const idx = (re) => sz.findIndex((r) => re.test(r.html));
  const nyit = (nap) => { const i = idx(new RegExp('^' + nap)); return `${sz[i].html}: ${sz[i + 1].html}`; };
  const gombok = rs.filter((r) => r.t === 'GOMB');
  const h3k = rs.filter((r) => r.t === 'H3');
  const leiras = sz.filter((r) => r.x > 700 && r.w > 400);
  const terkep = gombok.find((g) => /maps/.test(g.href));
  const foglal = gombok.filter((g) => g !== terkep);
  return `<section class="helyszin" id="helyszin" aria-labelledby="hely-cim">
  <div class="lv-hely-kep">${img(bg.src, 'MOSAIC Head Spa – a szalon', ' loading="lazy"')}</div>
  <div class="tartalom helyszin-racs">
    <div class="hely-szoveg">
      <h2 id="hely-cim">${cim(h.html)}</h2>
      <div class="hely-sor"><span class="ikon-kor">${IKON.hely}</span><p><b>${h3k[0].html}</b><br>${cimSor.html}</p></div>
      <div class="hely-sor"><span class="ikon-kor">${IKON.tel}</span><p><b>${h3k[1].html}</b><br><a href="tel:+36202474444">${telefon.html}</a><br><a href="mailto:${szoveg(email.html)}">${email.html}</a></p></div>
      <div class="hely-sor"><span class="ikon-kor">${IKON.ora}</span><p><b>${h3k[2].html}</b><br>${nyit('Hétfő')}<br>${nyit('Szombat')}<br>${nyit('Vasárnap')}</p></div>
      <div class="hely-gombok">
        ${aranyok(foglal).map((g) => gomb(g)).join('\n        ')}
        ${linkek(foglal).map((g) => gomb(g)).join('\n        ')}
      </div>
    </div>
    <div class="lv-hely-jobb cikk">
      <figure class="kep-fig lv-kicsi">${img(k2.src, 'A MOSAIC bejárata a Bécsi úton', ' loading="lazy"')}</figure>
${paragrafusok(leiras)}
      ${terkep ? gomb(terkep, 'gomb gomb-korvonal') : ''}
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
function meta(nev) {
  const regi = fs.readFileSync(path.join(GYOKER, 'klon', nev + '.html'), 'utf8');
  const g = (re) => { const m = re.exec(regi); if (!m) throw new Error('nincs meta: ' + re); return m[1]; };
  return {
    title: g(/<title>([^<]*)<\/title>/),
    desc: g(/<meta name="description" content="([^"]*)"/),
    canonical: g(/<link rel="canonical" href="([^"]*)"/),
    ogkep: g(/<meta property="og:image" content="([^"]*)"/),
  };
}

function oldal(o) {
  const rs = sorok(path.join(FORRAS, o.kulcs + '.folyam.txt'));
  const sz = szeletek(rs, o.kulcs);
  const m = meta(o.nev);
  const html = {
    konz: konzHtml, valt: (r) => valtHtml(r, o.nev), osszeh: osszehHtml, garancia: garanciaHtml, berlet: berletHtml, sajat: sajatHtml, csomagok: csomagokHtml,
    testresz: testreszHtml, zsofi: zsofiHtml, elso: elsoHtml, harom: haromHtml, kontroll: kontrollHtml, elotte: elotteHtml, velemeny: velemenyHtml,
    szalon: szalonHtml, nyar: nyarHtml, szep: szepHtml, gyik: gyikHtml, hely: helyHtml,
  };
  const torzs = [heroHtml(sz.hero, o.nev), ...SZAKASZOK.map(([n]) => html[n](sz[n]))].join('\n\n');
  const ut = '/' + decodeURIComponent(m.canonical.replace(BAZIS + '/', ''));
  return `<!DOCTYPE html>
<html lang="hu">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${m.title}</title>
<meta name="description" content="${m.desc}">
<meta name="robots" content="noindex, nofollow">
<link rel="canonical" href="${m.canonical}">
<meta property="og:title" content="${m.title}">
<meta property="og:description" content="${m.desc}">
<meta property="og:image" content="${m.ogkep}">
<meta property="og:url" content="${m.canonical}">
<meta property="og:site_name" content="MOSAIC Headspa">
<meta property="og:type" content="website">
<link rel="icon" href="/assets/img/c2eb0f_b001e2c55098446da3e38ff055e20354.png" type="image/png">
<link rel="preload" href="${HERO_KEP}" as="image" fetchpriority="high">
<link rel="preload" href="/assets/fonts/playfair-display-500-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/css/wix-google-fonts.css">
<link rel="stylesheet" href="/assets/css/wix-fonts.css">
<link rel="stylesheet" href="/assets/css/headspa-oldal.css">
<link rel="stylesheet" href="/assets/css/lezer-variansok.css">
<script src="/assets/js/suti.js"></script>
</head>
<body>
<!--
  MOSAIC lezeres szortelenites hirdetesi oldal (${o.nev}) - UJ szerkezet (a Head Spa / lezeres oldalak stilusaban). A tartalom a regi (Wixes) oldal tartalma:
  a szovegek, arak (a regi "majusi" 20% kedvezmeny es a "nyarig" ajanlat is), kepek, videok, linkek es a GYIK valtozatlanok; a regi oldal hibait / elavult adatait NEM
  javitottuk (lasd a PR "Eszrevetelek"). NOINDEX marad (mint a regi). A regi, Wixes valtozat rejtett cimen: /${o.nev}-regi. A fajl a tools/lezer-variansok/gen.mjs
  kimenete (a forras: forras/${o.kulcs}.folyam.txt); kezi szerkesztes megengedett, de az ujrafuttatas felulirja. Egyetlen H1: a regi H2 hero-cim lett H1, a regi H1-ek H2-k.
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

tablakBetolt();
for (const o of OLDALAK) {
  const ki = path.join(GYOKER, 'foglalas', o.nev + '.html');
  fs.writeFileSync(ki, szokozJavit(oldal(o)));
  console.log('kesz:', path.relative(GYOKER, ki), fs.statSync(ki).size, 'bajt');
}
