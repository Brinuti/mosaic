// A harom regi (Wixes) hirdetesi ajandekkartya-oldal ujrastilusozasa, a TARTALOM valtoztatasa nelkul:
//   headspa-ajandakkartya-fiataloknak, headspa-ajandekkartya-ezo (ekezetes fajlnev: headspa-ajándékkártya-ezo), headspa-self-care
// A harom oldal ugyanazt a sablont koveti (hero, bemutatkozas, akcio, vendegvideok, bemutato video, hogyan mukodik, bankkartyas megrendeles, atutalasos
// megrendeles + urlap, GYIK, galeria, vasarlas, helyszin), kicsit eltero szoveggel / kepekkel / sorrenddel.
//
//   node tools/ajandek-variansok/gen.mjs        ->  tools/ajandek-variansok/archiv/<nev>.html (x3)
//
// 2026-10-09: a harom oldal ELO cime mar az uj formatumot adja (foglalas/ajandek.html + a persona-variansok, lasd docs/AJANDEK_PERSONA_OLDALAK.md); ez a regi, ujrastilusozott
// valtozat ARCHIVUM (nincs az elo utvonalon, a build nem hasznalja). A rejtett "-regi" cimen a Wixes eredeti (klon/) oldal marad meg.
//
// Forras: tools/ajandek-variansok/forras/<kulcs>.folyam.txt = a regi oldal kinyert tartalma dokumentum-sorrendben (tools/ujrastilus/folyam.mjs kimenete,
// az eles oldalrol, a csere ELOTT). A szovegek ebbol kerulnek az oldalra valtozatlanul; a GYIK valaszai az assets/js/gyik.js-bol (a regi oldal harmonikaja).
// A kezi szerkesztes megengedett, de az ujrafuttatas felulirja a kimeneti fajlokat.
import fs from 'node:fs';
import path from 'node:path';

const GYOKER = path.resolve(import.meta.dirname, '..', '..');
const FORRAS = path.join(import.meta.dirname, 'forras');
const BAZIS = 'https://www.mosaicheadspa.hu';
const GYIK_KULCS = 'c2eb0f_97df67cb524ad4ad76e22fddea2496e5';   // a regi oldalak Common Ninja GYIK-ja (assets/js/gyik.js)

// az ekezetes fajlnev NFC-ben (mint a klon/ mappaban): headspa-ajándékkártya-ezo
const OLDALAK = [
  { kulcs: 'fiataloknak', nev: 'headspa-ajandakkartya-fiataloknak' },
  { kulcs: 'ezo', nev: 'headspa-ajándékkártya-ezo' },
  { kulcs: 'self-care', nev: 'headspa-self-care' },
];

// a regi oldalak szakasz-sorrendje (az elso sor mindig a hero); [kulcs, sor-tipus, minta] = az a sor, ahol a szakasz kezdodik
const FELOSZTAS = {
  fiataloknak: [['pitch', 'KEP', /36b443_d5fd/], ['promo', 'KEP', /welovebudapest/], ['vendeg', 'KEP', /DSC05687/], ['demo', 'H2', /bemutat[oó] vide/i],
    ['hogy', 'KEP', /mosaic-headspa-ajandekkartya/], ['kartya', 'KEP', /kezeloszoba/], ['utalas', 'H2', /Előreutalásos/], ['gyik', 'H2', /Gyakran/],
    ['galeria', 'H2', /Ilyen gyönyörűen/], ['vedd', 'KEP', /headspa_mockup/], ['hely', 'KEP', /Spa Salts/]],
  ezo: [['pitch', 'H1', /autentikus HeadSpa élményt/], ['promo', 'KEP', /4-kezes-headspa2/], ['demo', 'H2', /Holisztikus élmény a sablonos/],
    ['hogy', 'KEP', /mosaic-headspa-ajandekkartya/], ['kartya', 'KEP', /kezeloszoba/], ['utalas', 'H2', /Előreutalásos/], ['vendeg', 'KEP', /DSC05687/],
    ['gyik', 'H2', /Gyakran/], ['galeria', 'H2', /Ilyen gyönyörűen/], ['vedd', 'KEP', /headspa_mockup/], ['hely', 'KEP', /Spa Salts/]],
  'self-care': [['pitch', 'KEP', /36b443_86f1/], ['promo', 'KEP', /4-kezes-headspa2/], ['demo', 'H2', /Távol-keleti varázslat/],
    ['hogy', 'KEP', /mosaic-headspa-ajandekkartya/], ['kartya', 'KEP', /kezeloszoba/], ['utalas', 'H2', /Előreutalásos/], ['vendeg', 'KEP', /DSC05687/],
    ['gyik', 'H2', /Gyakran/], ['galeria', 'H2', /Ilyen gyönyörűen/], ['vedd', 'KEP', /headspa_mockup/], ['hely', 'KEP', /Spa Salts/]],
};

// a galeria kepeinek alt-szovege (a regi oldalon nem volt; ugyanezek a kepek a /headspa-ferfiaknak oldalon is szerepelnek ezekkel az alt-szovegekkel)
const GALERIA_ALT = {
  ac85eea74409484091e12f8d72fbee98: 'A MOSAIC váró- és recepciós tere',
  aa3b2f8ec7564c87bf16836d7d3b29d6: 'A váró zöld bársonyfotelekkel',
  '00a2f4bd0e9b4325b2d02e77edb874e9': 'A bejárat a MOSAIC emblémával és a macska-szoborral',
  e9339a3f8c784c08839518f96a6cf19d: 'Hajmosó a kezelőhelyiségben',
};
const GOOGLE_SVG = '<svg viewBox="0 0 48 48" class="g-ikon" aria-hidden="true"><path fill="#4285F4" d="M45 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8a10 10 0 01-4.4 6.6v5.5h7.1c4.1-3.8 6.5-9.4 6.5-16.1z"/><path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7A22 22 0 0024 46z"/><path fill="#FBBC05" d="M11.8 28.2a13 13 0 010-8.4v-5.7H4.5a22 22 0 000 19.8z"/><path fill="#EA4335" d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3A22 22 0 004.5 14.1l7.3 5.7c1.7-5.2 6.5-9 12.2-9z"/></svg>';
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

// folyam.txt sor -> { t: tipus, x, w, h, html | src+alt | szoveg+href }
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
      let s = m[6].replace(/^[\d.]+px\s+(?:(?:center|left|right)\s+)?/, '');
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
// a fejlec-sorok kulso <b>...</b> burkolata folosleges (a fejlec stilusa eleve vastagabb)
const fejSzoveg = (html) => { const m = /^<b>([\s\S]*)<\/b>$/.exec(html.trim()); return m && !/<b>/.test(m[1]) ? m[1].trim() : html.trim(); };
const kepId = (src) => /\/([^/]+?)\.(?:jpe?g|png|webp)$/.exec(src)[1];

// a szakaszok kezdo indexeibol szeletek
function szeletek(rs, kulcs) {
  const kezd = [['hero', 0]];
  let from = 1;
  for (const [nev, tipus, minta] of FELOSZTAS[kulcs]) {
    let i = -1;
    for (let k = from; k < rs.length; k++) if (rs[k].t === tipus && minta.test(rs[k].html || rs[k].raw || '')) { i = k; break; }
    if (i < 0) throw new Error(`${kulcs}: nincs "${nev}" szakasz-kezdet (${tipus} ${minta})`);
    kezd.push([nev, i]); from = i + 1;
  }
  const ki = {};
  kezd.forEach(([nev, i], n) => { ki[nev] = rs.slice(i, n + 1 < kezd.length ? kezd[n + 1][1] : rs.length); });
  return ki;
}

// a folyam.mjs kinyeroje a szomszedos Wix-szovegelemek koze szokozt tesz, ahol a regi oldalon NINCS (az eles oldal szovege: "49.900", "ajandekot"): ezeket visszaallitjuk
const FOLYAM_SZOKOZ = [['49 .900', '49.900'], ['ajándék ot adja', 'ajándékot adja']];
const szokozJavit = (h) => FOLYAM_SZOKOZ.reduce((x, [a, b]) => x.split(a).join(b), h);

const rendez = (rs, t) => rs.filter((r) => r.t === t);
const videoAzon = (poster) => { const a = kepId(poster).replace(/f00\d$/, ''); return a; };
function videoFajl(poster) {
  const azon = videoAzon(poster);
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
const cim = (html) => fejSzoveg(html);
const hosszu = (html) => szoveg(html).length > 90;

function videoKartya(posterSrc, felirat, egyedul = false) {
  const f = videoFajl(posterSrc);
  const [pw, ph] = kepMeret(posterSrc);
  return `<button type="button" class="video-kartya" data-video="${f}" data-poster="${attr(posterSrc)}" aria-label="Videó lejátszása: ${attr(felirat)}"${egyedul ? ` style="aspect-ratio: ${pw} / ${ph}"` : ''}>
  ${img(posterSrc, '', ' loading="lazy"')}<span class="video-play">${IKON.lejatszas}</span>
</button>`;
}
function gomb(r, osztaly) {
  const kulso = /^https?:/.test(r.href);
  return `<a class="gomb ${osztaly}" href="${attr(r.href)}"${kulso ? ' target="_blank" rel="noopener"' : ''}>${r.html} <span class="nyil" aria-hidden="true">→</span></a>`;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------
function heroHtml(rs) {
  const kepek = rendez(rs, 'KEP');
  const h = rs.find((r) => r.t === 'H1' || r.t === 'H2');
  const elsoGomb = rs.findIndex((r) => r.t === 'GOMB');
  const sorokElotte = rs.slice(rs.indexOf(h) + 1, elsoGomb).filter((r) => r.t === 'SZ');
  const gombok = rs.filter((r) => r.t === 'GOMB');
  const utana = rs.slice(elsoGomb + gombok.length).filter((r) => r.t === 'SZ');
  const ertekeles = utana.find((r) => /^Google/.test(r.html));
  const akcioCim = utana.find((r) => /AKCI/.test(r.html));
  const arak = utana.filter((r) => r !== ertekeles && r !== akcioCim);
  return `<section class="hero ajv-hero">
  <div class="tartalom hero-racs">
    <div class="hero-szoveg">
      <h1>${cim(h.html)}</h1>
${sorokElotte.map((r) => `      <p class="hero-al">${r.html}</p>`).join('\n')}
      <div class="cta-sor">
        ${gomb(gombok[0], 'gomb-arany')}
        ${gomb(gombok[1], 'gomb-korvonal')}
      </div>
${ertekeles ? `      <p class="ajv-ertekeles">${GOOGLE_SVG}<span>${ertekeles.html}</span></p>` : ''}
${akcioCim ? `      <div class="ajv-akcio">
        <p class="ajv-akcio-cim">${akcioCim.html}</p>
        <ul>
${arak.map((r) => `          <li>${r.html}</li>`).join('\n')}
        </ul>
      </div>` : ''}
    </div>
    <div class="ajv-hero-kepek">
      <figure class="hero-kep">${img(kepek[0].src, 'Head Spa ajándékkártya és kezelés a MOSAIC-ban', ' fetchpriority="high"')}</figure>
      <div class="ajv-kicsik">
${kepek.slice(1).map((k) => `        ${img(k.src, 'Head Spa kezelés a MOSAIC-ban', ' loading="lazy"')}`).join('\n')}
      </div>
    </div>
  </div>
</section>`;
}

function pitchHtml(rs) {
  const h = rs.find((r) => r.t === 'H1' || r.t === 'H2');
  const poster = rs.find((r) => r.t === 'KEP');
  const sz = rs.filter((r) => r.t === 'SZ');
  return `<section class="szekcio feher" id="bemutatkozas" aria-labelledby="bemutatkozas-cim">
  <div class="tartalom">
    <div class="fel-racs cikk">
      <div>
        <h2 id="bemutatkozas-cim">${cim(h.html)}</h2>
${sz.map((r) => `        <p>${r.html}</p>`).join('\n')}
      </div>
      <div class="video-egy">
        ${videoKartya(poster.src, szoveg(h.html), true)}
      </div>
    </div>
  </div>
</section>`;
}

function promoHtml(rs) {
  const k = rs.find((r) => r.t === 'KEP');
  const h = rs.find((r) => r.t === 'H1' || r.t === 'H2');
  const sz = rs.filter((r) => r.t === 'SZ');
  const g = rs.find((r) => r.t === 'GOMB');
  return `<section class="szekcio bezs" id="akcio" aria-labelledby="akcio-cim">
  <div class="tartalom">
    <div class="fel-racs fordit">
      <div class="cikk">
        <h2 id="akcio-cim">${cim(h.html)}</h2>
${sz.map((r) => `        <p>${r.html}</p>`).join('\n')}
${g ? `        <div class="cta-sor">${gomb(g, 'gomb-arany')}</div>` : ''}
      </div>
      <figure class="kep-fig">${img(k.src, k.alt && !/^[\w-]+\.(jpe?g|png)$/i.test(k.alt) ? k.alt : 'Head Spa ajándékkártya', ' loading="lazy"')}</figure>
    </div>
  </div>
</section>`;
}

function vendegHtml(rs) {
  const bg = rs.find((r) => r.t === 'KEP');
  const h = rs.find((r) => r.t === 'H2');
  const sz = rs.find((r) => r.t === 'SZ');
  const posterek = rs.filter((r) => r.t === 'KEP').slice(1);
  return `<section class="szekcio zsalya ajv-hatterkepes" id="vendegvideok" aria-labelledby="vendeg-cim">
  ${img(bg.src, '', ' class="ajv-hatterkep" loading="lazy" decoding="async"')}
  <div class="tartalom">
    <div class="szekcio-fej">
      <h2 id="vendeg-cim">${cim(h.html)}</h2>
      <span class="rombusz" aria-hidden="true"></span>
      <p class="lead">${sz.html}</p>
    </div>
    <div class="video-racs allo harom">
${posterek.map((p, i) => `      ${videoKartya(p.src, 'Vendégvideó ' + (i + 1))}`).join('\n')}
    </div>
  </div>
</section>`;
}

function demoHtml(rs) {
  const poster = rs.find((r) => r.t === 'KEP');
  const pi = rs.indexOf(poster);
  const elotte = rs.slice(0, pi).filter((r) => r.t === 'H2');
  const utana = rs.slice(pi + 1);
  const bevezeto = elotte.map((r) => `        <p class="ajv-hangos">${cim(r.html)}</p>`).join('\n');
  const reszek = [];
  let lista = [];
  const vegLista = () => { if (lista.length) { reszek.push(`        <ul class="ajv-lista">\n${lista.map((l) => `          <li>${l}</li>`).join('\n')}\n        </ul>`); lista = []; } };
  for (const r of utana) {
    if (r.t === 'SZ' && /^✅/.test(r.html)) { lista.push(r.html); continue; }
    vegLista();
    if (r.t === 'H2') reszek.push(hosszu(r.html) ? `        <p class="ajv-hangos">${cim(r.html)}</p>` : `        <p class="ajv-kiemel">${cim(r.html)}</p>`);
    else if (r.t === 'SZ' && /^<b>Mit tartalmaz/.test(r.html)) reszek.push(`        <h3 class="ajv-al-cim">${cim(r.html)}</h3>`);
    else if (r.t === 'SZ') reszek.push(`        <p>${r.html}</p>`);
  }
  vegLista();
  return `<section class="szekcio feher" id="bemutato" aria-label="Bemutató videó és a kezelés menete">
  <div class="tartalom">
    <div class="fel-racs felul cikk">
      <div class="video-egy">
        ${videoKartya(poster.src, 'A Head Spa kezelés bemutatója', true)}
      </div>
      <div>
${bevezeto}
${reszek.join('\n')}
      </div>
    </div>
  </div>
</section>`;
}

function hogyHtml(rs) {
  const k = rs.find((r) => r.t === 'KEP');
  const h = rs.find((r) => r.t === 'H2');
  const lepesek = rs.filter((r) => r.t === 'H2').slice(1);
  const gombok = rs.filter((r) => r.t === 'GOMB');
  return `<section class="szekcio zsalya" id="hogyan" aria-labelledby="hogyan-cim">
  <div class="tartalom">
    <div class="fel-racs">
      <figure class="kep-fig">${img(k.src, k.alt && !/^[\w-]+\.(jpe?g|png)$/i.test(k.alt) ? k.alt : 'A MOSAIC Head Spa ajándékkártya', ' loading="lazy"')}</figure>
      <div class="cikk">
        <h2 id="hogyan-cim">${cim(h.html)}</h2>
        <ol class="ajv-lepesek">
${lepesek.map((r) => `          <li>${r.html}</li>`).join('\n')}
        </ol>
        <div class="cta-sor">
          ${gomb(gombok[0], 'gomb-arany')}
          ${gomb(gombok[1], 'gomb-korvonal')}
        </div>
      </div>
    </div>
  </div>
</section>`;
}

function kartyaHtml(rs) {
  const bg = rs.find((r) => r.t === 'KEP');
  const h = rs.find((r) => r.t === 'H2');
  const kepek = rs.filter((r) => r.t === 'KEP').slice(1);
  const elsoKep = rs.indexOf(kepek[0]);
  const bevezeto = rs.slice(rs.indexOf(h) + 1, elsoKep).filter((r) => r.t === 'SZ');
  const h1ek = rs.filter((r) => r.t === 'H1');
  const utan = rs.slice(elsoKep);
  const leirasok = [];
  for (const hh of h1ek) { const n = utan[utan.indexOf(hh) + 1]; if (n && n.t === 'SZ') leirasok.push(n); }
  const arak = utan.filter((r) => r.t === 'SZ' && /helyett/.test(r.html));
  const gombok = utan.filter((r) => r.t === 'GOMB');
  const kedv = utan.filter((r) => r.t === 'SZ' && /kedvezménnyel/.test(r.html));
  if (kepek.length !== 3 || h1ek.length !== 3 || leirasok.length !== 3 || arak.length !== 3 || gombok.length !== 3 || kedv.length !== 3) throw new Error('a bankkartyas szakasz nem 3 termek: ' + [kepek.length, h1ek.length, leirasok.length, arak.length, gombok.length, kedv.length]);
  const alt = ['Egyéni Head Spa kezelés a MOSAIC-ban: arcmasszázs eszközökkel', 'Páros Head Spa kezelés a MOSAIC-ban: két vendég egymás mellett', k4alt(kepek[2])];
  const termek = (i) => `        <article class="ajv-termek${i === 2 ? ' kiemelt' : ''}">
          <figure class="ajv-termek-kep">${img(kepek[i].src, alt[i], ' loading="lazy"')}</figure>
          <h3>${cim(h1ek[i].html)}</h3>
          <p class="ajv-termek-leiras">${leirasok[i].html}</p>
          <p class="ajv-termek-ar">${arak[i].html}</p>
          ${gomb(gombok[i], 'gomb-arany')}
          <p class="ajv-termek-kedv">${kedv[i].html}</p>
        </article>`;
  return `<section class="szekcio feher" id="bankkartyas" aria-labelledby="bankkartyas-cim">
  <div class="tartalom">
    <div class="szekcio-fej">
      <h2 id="bankkartyas-cim">${cim(h.html)}</h2>
      <span class="rombusz" aria-hidden="true"></span>
${bevezeto.map((r) => `      <p class="lead">${r.html}</p>`).join('\n')}
    </div>
    <figure class="kep-fig sav">${img(bg.src, 'A MOSAIC Head Spa kezelőszobája', ' loading="lazy"')}</figure>
    <div class="ajv-termekek">
${[0, 1, 2].map(termek).join('\n')}
    </div>
  </div>
</section>`;
}
function k4alt() { return '4 kezes Head Spa kezelés: két gyógymasszőr egyszerre kényezteti a vendéget'; }

// az atutalasos urlap mezoi (a regi Wix-urlap szerint; a sorrend es a feliratok szo szerint)
const URLAP_SZOVEG = 'Ajándékozott Teljes Neve* Fizető fél Vezetékneve* Fizető fél Keresztneve* E-mail cím (Ahova a pdf-et kéred)* Telefonszámod amin elérünk* Számlázási cím (magán vagy céges)* Cégnév (Ha céges számlát kérsz) Cég adószám (Ha céges számlát kérsz) Milyen kártyát kérsz?* LIMITÁLT - 50 perces 4 Kezes Headspa ajándékkártya - 39.900 Ft (20% kedvezmény) Egyéni 50 perces Headspa kezelés - 26.900 Ft (20% kedvezmény) Páros 50 perces Headspa kezelés - 53.800 Ft (20% kedvezmény) A Mosaic Headspa ÁSZF-jét elolvastam és elfogadom.* Megveszem! Átutalási kötelezettség mellett.';
function utalasHtml(rs, oldalNev) {
  const h = rs.find((r) => r.t === 'H2');
  const sz = rs.filter((r) => r.t === 'SZ');
  const urlapSor = sz[sz.length - 1];
  if (szoveg(urlapSor.html) !== URLAP_SZOVEG) throw new Error('az urlap szovege eltert a vartol: ' + szoveg(urlapSor.html).slice(0, 100));
  const menet = sz.slice(0, -1);
  const lepesek = menet.slice(1);
  // az urlapot a MEGLEVO assets/js/klon.js (7d. szakasz) kezeli: ugyanaz az ellenorzes, ugyanaz a POST (form-name=ajandekkartya, oldal = az oldal neve),
  // ugyanaz a /success-ajandekkartya atiranyitas es UGYANAZ a lead-meres (lead -> ecommerce:null -> generate_lead), mint a regi Wix-urlapnal. Ehhez az urlap
  // azonositoja a regi urlap-azonosito elejevel kezdodik, a mezok aria-label-je a regi felirat, a gomb pedig data-hook="submit-button".
  const mezo = (nev, felirat, extra = '') => `          <label class="ajv-mezo"><span>${felirat}</span><input type="text" name="${nev}" aria-label="${attr(felirat)}" ${extra}><em class="hiba">Kérjük, töltsd ki ezt a mezőt.</em></label>`;
  return `<section class="szekcio bezs" id="utalas" aria-labelledby="utalas-cim">
  <div class="tartalom ajv-szuk">
    <div class="szekcio-fej">
      <h2 id="utalas-cim">${cim(h.html)}</h2>
      <span class="rombusz" aria-hidden="true"></span>
      <p class="lead">${menet[0].html}</p>
    </div>
    <ol class="ajv-lepesek ajv-lepesek-kozep">
${lepesek.map((r) => `      <li>${r.html}</li>`).join('\n')}
    </ol>
    <form class="ajv-urlap" id="form-7715ab48-ajandek" method="post" action="/" novalidate aria-label="Ajándékkártya megrendelése előreutalással">
      <div class="ajv-mezok">
${mezo('ajandekozott', 'Ajándékozott Teljes Neve*', 'autocomplete="off" required maxlength="120"')}
${mezo('vezeteknev', 'Fizető fél Vezetékneve*', 'autocomplete="family-name" required maxlength="80"')}
${mezo('keresztnev', 'Fizető fél Keresztneve*', 'autocomplete="given-name" required maxlength="80"')}
          <label class="ajv-mezo"><span>E-mail cím (Ahova a pdf-et kéred)*</span><input type="email" name="email" aria-label="E-mail cím (Ahova a pdf-et kéred)*" autocomplete="email" inputmode="email" required maxlength="160"><em class="hiba">Kérjük, adj meg egy érvényes e-mail-címet.</em></label>
          <label class="ajv-mezo"><span>Telefonszámod amin elérünk*</span><input type="tel" name="telefon" aria-label="Telefonszámod amin elérünk*" autocomplete="tel" inputmode="tel" required maxlength="40"><em class="hiba">Kérjük, add meg a telefonszámod.</em></label>
${mezo('szamlazasi_cim', 'Számlázási cím (magán vagy céges)*', 'autocomplete="street-address" required maxlength="200"')}
          <label class="ajv-mezo"><span>Cégnév (Ha céges számlát kérsz)</span><input type="text" name="cegnev" aria-label="Cégnév (Ha céges számlát kérsz)" autocomplete="organization" maxlength="120"></label>
          <label class="ajv-mezo"><span>Cég adószám (Ha céges számlát kérsz)</span><input type="text" name="adoszam" aria-label="Cég adószám (Ha céges számlát kérsz)" autocomplete="off" maxlength="40"></label>
      </div>
      <fieldset class="ajv-kartyak">
        <legend>Milyen kártyát kérsz?*</legend>
        <label class="ajv-valasz"><input type="radio" name="kartya_valasztas" value="LIMITÁLT - 50 perces 4 Kezes Headspa ajándékkártya - 39.900 Ft (20% kedvezmény)" aria-label="LIMITÁLT - 50 perces 4 Kezes Headspa ajándékkártya - 39.900 Ft (20% kedvezmény)"><span>LIMITÁLT - 50 perces 4 Kezes Headspa ajándékkártya - 39.900 Ft (20% kedvezmény)</span></label>
        <label class="ajv-valasz"><input type="radio" name="kartya_valasztas" value="Egyéni 50 perces Headspa kezelés - 26.900 Ft (20% kedvezmény)" aria-label="Egyéni 50 perces Headspa kezelés - 26.900 Ft (20% kedvezmény)"><span>Egyéni 50 perces Headspa kezelés - 26.900 Ft (20% kedvezmény)</span></label>
        <label class="ajv-valasz"><input type="radio" name="kartya_valasztas" value="Páros 50 perces Headspa kezelés - 53.800 Ft (20% kedvezmény)" aria-label="Páros 50 perces Headspa kezelés - 53.800 Ft (20% kedvezmény)"><span>Páros 50 perces Headspa kezelés - 53.800 Ft (20% kedvezmény)</span></label>
      </fieldset>
      <label class="ajv-hozzajarul"><input type="checkbox" name="aszf" value="elfogadva" required><span>A Mosaic Headspa ÁSZF-jét elolvastam és elfogadom.*</span></label>
      <button type="button" class="gomb gomb-arany gomb-nagy" id="ajandek-kuldes" data-hook="submit-button">Megveszem! Átutalási kötelezettség mellett.</button>
    </form>
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
  const h = rs.find((r) => r.t === 'H2');
  const kerdesek = rs.filter((r) => r.t === 'GOMB');
  const v = gyikValaszok();
  if (v.length !== kerdesek.length) throw new Error(`GYIK: ${kerdesek.length} kerdes a regi oldalon, ${v.length} a gyik.js-ben`);
  kerdesek.forEach((k, i) => { if (szoveg(k.html) !== v[i][0]) throw new Error('GYIK-kerdes elter: ' + k.html + ' / ' + v[i][0]); });
  return `<section class="szekcio zsalya" id="gyik" aria-labelledby="gyik-cim">
  <div class="tartalom ajv-szuk">
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

function galeriaHtml(rs) {
  const h = rs.find((r) => r.t === 'H2');
  const kepek = rendez(rs, 'KEP');
  return `<section class="szekcio feher" id="galeria" aria-labelledby="galeria-cim">
  <div class="tartalom">
    <div class="szekcio-fej">
      <h2 id="galeria-cim">${cim(h.html)}</h2>
      <span class="rombusz" aria-hidden="true"></span>
    </div>
    <div class="korhinta nagy-elem">
      <button type="button" class="korhinta-gomb elozo" aria-label="Előző kép" disabled>${IKON.elozo}</button>
      <div class="korhinta-sav">
${kepek.map((k) => `        <figure>${img(k.src, GALERIA_ALT[kepId(k.src)] || 'A MOSAIC Head Spa szalonja', ' loading="lazy"')}</figure>`).join('\n')}
      </div>
      <button type="button" class="korhinta-gomb kovetkezo" aria-label="Következő kép">${IKON.kovetkezo}</button>
    </div>
  </div>
</section>`;
}

function veddHtml(rs) {
  const k = rs.find((r) => r.t === 'KEP');
  const h = rs.find((r) => r.t === 'H2');
  const sz = rs.filter((r) => r.t === 'SZ');
  const gombok = rs.filter((r) => r.t === 'GOMB');
  return `<section class="szekcio bezs" id="vasarlas" aria-labelledby="vasarlas-cim">
  <div class="tartalom">
    <div class="fel-racs fordit">
      <div class="cikk">
        <h2 id="vasarlas-cim">${cim(h.html)}</h2>
${sz.map((r) => `        <p>${r.html}</p>`).join('\n')}
        <div class="cta-sor">
          ${gomb(gombok[0], 'gomb-arany')}
          ${gomb(gombok[1], 'gomb-korvonal')}
        </div>
      </div>
      <figure class="kep-fig">${img(k.src, k.alt && !/^[\w-]+\.(jpe?g|png|webp)$/i.test(k.alt) ? k.alt : 'A MOSAIC Head Spa ajándékkártya', ' loading="lazy"')}</figure>
    </div>
  </div>
</section>`;
}

function helyHtml(rs) {
  const bg = rs.find((r) => r.t === 'KEP');
  const h = rs.find((r) => r.t === 'H2');
  const sz = rs.filter((r) => r.t === 'SZ');
  const telefon = sz.find((r) => /^06 20/.test(r.html));
  const cimSor = sz.find((r) => /Bécsi út/.test(r.html));
  const email = sz.find((r) => /@/.test(r.html));
  const idx = (re) => sz.findIndex((r) => re.test(r.html));
  const nyit = (nap) => { const i = idx(new RegExp('^' + nap)); return `${sz[i].html}: ${sz[i + 1].html}`; };
  const gombok = rs.filter((r) => r.t === 'GOMB');
  const h3k = rs.filter((r) => r.t === 'H3');
  return `<section class="helyszin" id="helyszin" aria-labelledby="hely-cim">
  <div class="tartalom helyszin-racs">
    <div class="hely-szoveg">
      <h2 id="hely-cim">${cim(h.html)}</h2>
      <div class="hely-sor"><span class="ikon-kor">${IKON.hely}</span><p><b>${h3k[0].html}</b><br>${cimSor.html}</p></div>
      <div class="hely-sor"><span class="ikon-kor">${IKON.tel}</span><p><b>${h3k[1].html}</b><br><a href="tel:+36202474444">${telefon.html}</a><br><a href="mailto:${szoveg(email.html)}">${email.html}</a></p></div>
      <div class="hely-sor"><span class="ikon-kor">${IKON.ora}</span><p><b>${h3k[2].html}</b><br>${nyit('Hétfő')}<br>${nyit('Szombat')}<br>${nyit('Vasárnap')}</p></div>
      <div class="hely-gombok">
        ${gomb(gombok[0], 'gomb-arany')}
        ${gomb(gombok[1], 'gomb-korvonal')}
      </div>
    </div>
    <div class="hely-kepek">
      <div class="terkep" id="terkep">
        <!-- a Google-terkep a funkcionalis sutik engedelyezese utan (vagy a gombra kattintva) toltodik be -->
        <div class="terkep-hely" id="terkep-hely">
          <span class="ikon-kor">${IKON.hely}</span>
          <p><b>MOSAIC</b><br>1023 Budapest, Bécsi út 2.</p>
          <button type="button" class="gomb gomb-korvonal gomb-kicsi" id="terkep-gomb">Google térkép megjelenítése</button>
        </div>
      </div>
      ${img(bg.src, 'MOSAIC Head Spa', ' loading="lazy"')}
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
  const heroKep = sz.hero.find((r) => r.t === 'KEP').src;
  const sorrend = FELOSZTAS[o.kulcs].map(([n]) => n);
  const html = { pitch: pitchHtml, promo: promoHtml, vendeg: vendegHtml, demo: demoHtml, hogy: hogyHtml, kartya: kartyaHtml, utalas: (r) => utalasHtml(r, o.nev), gyik: gyikHtml, galeria: galeriaHtml, vedd: veddHtml, hely: helyHtml };
  const torzs = [heroHtml(sz.hero), ...sorrend.map((n) => html[n](sz[n]))].join('\n\n');
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
<link rel="preload" href="${heroKep}" as="image" fetchpriority="high">
<link rel="preload" href="/assets/fonts/playfair-display-500-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/css/wix-google-fonts.css">
<link rel="stylesheet" href="/assets/css/wix-fonts.css">
<link rel="stylesheet" href="/assets/css/headspa-oldal.css">
<link rel="stylesheet" href="/assets/css/ajandek-variansok.css">
<script src="/assets/js/suti.js"></script>
</head>
<body>
<!--
  MOSAIC hirdetesi ajandekkartya-oldal (${o.nev}) - UJ szerkezet (a Head Spa oldalak stilusaban). A tartalom a regi (Wixes) oldal tartalma: a szovegek, arak (a regi
  20% juliusi akcio is), kepek, videok, linkek, az urlap mezoi es a GYIK valtozatlanok; a regi oldal hibait / elavult adatait NEM javitottuk (lasd a PR "Eszrevetelek").
  NOINDEX marad (mint a regi). A regi, Wixes valtozat rejtett cimen: /${o.nev}-regi. A fajl a tools/ajandek-variansok/gen.mjs kimenete (a forras: forras/${o.kulcs}.folyam.txt);
  kezi szerkesztes megengedett, de az ujrafuttatas felulirja. Egyetlen H1: a regi H2 hero-cim lett H1, a regi H1-ek H2-k.
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

for (const o of OLDALAK) {
  const ki = path.join(import.meta.dirname, 'archiv', o.nev + '.html');
  fs.writeFileSync(ki, szokozJavit(oldal(o)));
  console.log('kesz:', path.relative(GYOKER, ki), fs.statSync(ki).size, 'bajt');
}
