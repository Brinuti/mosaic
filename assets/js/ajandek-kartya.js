// MOSAIC ajandekkartya - a SZEMELYRE SZABHATO (otthon kinyomtatott) kartya kozos sablonja.
//
// Klasszikus szkript (mint az ajandek-adat.js): a bongeszo (a mini szemelyre szabo elo elonezete) es a szerver (a
// vegleges, nyomtathato kartya-oldal) UGYANEZT a HTML-t es CSS-t hasznalja, igy az elonezet = a kinyomtatott kartya.
//
// FORMATUM (2026-10-04, a tulajdonos kerese): a kartya FEKVO, felbehajtott A4 - mint a MOSAIC Canva-terve. Az A4-es (210 x 297 mm,
// alallo) lapon ket FEKVO lap (egyenkent 210 x 148,5 mm = 794 x 561,5 px) van: felul a HATOLDAL (180 fokkal elforgatva), alul az ELOLAP;
// felbehajtva egy 21 x 14,85 cm-es fekvo kartya lesz, elol a szemelyre szabott lappal, hatul a kartya adataival.
//   ELOLAP (szemelyre szabott): MOSAIC-felirat, "AJANDEKKARTYA", fotohely, idezet, "NEKI: nev"
//   HATOLDAL (automatikus): MOSAIC-felirat, termek, ertek, utalvanykod, ervenyesseg, cim
//
// Egy dizajn (TEMAK elem) = szinvilag + a fotohely / idezet / nev / szoveg-oszlop elhelyezese a 794 x 561,5 px-es lapon
// (a Canva-terv koordinata-rendszere). Minden dizajnon van fotohely es idezet-hely. A jelenlegi 4 dizajn ELOZETES (helyorzo):
// a vegleges dizajnokat a MOSAIC keszitteti; ezek helyere ugyanilyen mezokkel kerulnek:
//   { id, nev, hatter?: '/assets/img/ajandek/<hatter>.jpg' (szovegmentes, FEKVO hatterkep), kep: {x,y,w,h,alak}, oszlop: {x,w},
//     idezet: {x,y,w,h}, nevHely: {x,y,w,h} }
// A fotohelyre kerulo kep a hatter FOLE kerul (a kulcs a keret: alak = iv | teglalap | kor | polaroid).
(function (g) {
  'use strict';

  var IDEZET_MAX = 160;
  var NEV_MAX = 40;
  var LAP_W = 794, LAP_H = 561.5;   // egy fekvo lap (az A4 fele), px

  var TEMAK = [
    { id: 'smaragd', nev: 'Smaragd', kep: { x: 46, y: 44, w: 300, h: 474, alak: 'iv' }, oszlop: { x: 384, w: 364 }, idezet: { x: 392, y: 176, w: 348, h: 206 }, nevHely: { x: 392, y: 398, w: 348, h: 84 } },
    { id: 'krem', nev: 'Krém', kep: { x: 408, y: 44, w: 340, h: 474, alak: 'teglalap' }, oszlop: { x: 46, w: 336 }, idezet: { x: 54, y: 176, w: 320, h: 206 }, nevHely: { x: 54, y: 398, w: 320, h: 84 } },
    { id: 'homok', nev: 'Homok', kep: { x: 48, y: 98, w: 366, h: 366, alak: 'kor' }, oszlop: { x: 430, w: 320 }, idezet: { x: 438, y: 176, w: 304, h: 206 }, nevHely: { x: 438, y: 398, w: 304, h: 84 } },
    { id: 'feher', nev: 'Fehér', kep: { x: 56, y: 50, w: 340, h: 424, alak: 'polaroid' }, oszlop: { x: 424, w: 326 }, idezet: { x: 432, y: 176, w: 310, h: 206 }, nevHely: { x: 432, y: 398, w: 310, h: 84 } }
  ];

  function tema(id) {
    for (var i = 0; i < TEMAK.length; i++) if (TEMAK[i].id === id) return TEMAK[i];
    return null;
  }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // a 794 x 561,5 px-es lap koordinatai -> szazalek (a lap szelessegehez / magassagahoz kepest)
  function KP(r) {
    return 'left:' + (r.x / 7.94).toFixed(3) + '%;top:' + (r.y / 5.615).toFixed(3) + '%;width:' + (r.w / 7.94).toFixed(3) + '%;height:' + (r.h / 5.615).toFixed(3) + '%';
  }
  function TOP(y) { return (y / 5.615).toFixed(3) + '%'; }
  function CQ(px) { return (px / 7.94).toFixed(3) + 'cqw'; }
  function lepcso(szoveg, lepcsok) {
    var n = String(szoveg || '').length;
    for (var i = 0; i < lepcsok.length; i++) if (n <= lepcsok[i][0]) return lepcsok[i][1];
    return lepcsok[lepcsok.length - 1][1];
  }
  function szam(v, min, max, alap) {
    v = Number(v);
    if (!isFinite(v)) return alap;
    return Math.min(max, Math.max(min, v));
  }
  // a fotokivagas: a "x,y,zoom" szoveg (a metadata-ban is igy tarolodik) <-> { x, y, z }
  function pozOlvas(s) {
    var m = /^\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*$/.exec(String(s || ''));
    if (!m) return { x: 50, y: 50, z: 1 };
    return { x: szam(m[1], 0, 100, 50), y: szam(m[2], 0, 100, 50), z: szam(m[3], 1, 3, 1) };
  }
  function pozIr(p) {
    p = p || {};
    return szam(p.x, 0, 100, 50).toFixed(1) + ',' + szam(p.y, 0, 100, 50).toFixed(1) + ',' + szam(p.z, 1, 3, 1).toFixed(2);
  }
  function kepStilus(poz) {
    var p = pozOlvas(pozIr(poz));
    return 'object-position:' + p.x + '% ' + p.y + '%;transform:scale(' + p.z + ');transform-origin:' + p.x + '% ' + p.y + '%';
  }

  // az ELOLAP: a szemelyre szabott resz (a fotohely, az idezet es a nev a dizajn szerinti helyen)
  function elolap(o, t) {
    var idezet = String(o.idezet || '').trim();
    var nev = String(o.nev || '').trim();
    var kep = o.fotoSrc
      ? '<img src="' + esc(o.fotoSrc) + '" alt="" draggable="false" style="' + kepStilus(o.fotoPoz) + '">'
      : (o.minta ? '<span class="ak-hely"><svg viewBox="0 0 24 24" width="30%" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.2-2h6.6l1.2 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.4"/></svg><span>Itt lesz a fotód</span></span>' : '');
    var oszlop = 'left:' + (t.oszlop.x / 7.94).toFixed(3) + '%;width:' + (t.oszlop.w / 7.94).toFixed(3) + '%';
    var idezetMeret = lepcso(idezet, [[40, 26], [80, 22], [120, 19.5], [200, 17.5]]);
    return '<div class="ak ak-elol ak-t-' + esc(t.id) + '" data-tema="' + esc(t.id) + '">'
      + '<span class="ak-keret" aria-hidden="true"></span>'
      + '<p class="ak-brand" style="' + oszlop + '"><b>MOSAIC</b><small>HEADSPA AND HAIR</small></p>'
      + '<p class="ak-cim" style="' + oszlop + '">AJÁNDÉKKÁRTYA</p>'
      + '<div class="ak-foto ak-' + esc(t.kep.alak) + '" style="' + KP(t.kep) + '"><div class="ak-ablak">' + kep + '</div></div>'
      + '<p class="ak-idezet" style="' + KP(t.idezet) + ';font-size:' + CQ(idezetMeret) + '">' + (idezet ? esc(idezet) : (o.minta ? '<span class="ak-halvany">Ide kerül az idézeted vagy az üzeneted.</span>' : '')) + '</p>'
      + (nev || o.minta
        ? '<p class="ak-neki" style="' + KP(t.nevHely) + '"><small>NEKI</small><span style="font-size:' + CQ(lepcso(nev, [[20, 26], [30, 22], [60, 18]])) + '">' + (nev ? esc(nev) : (o.minta ? '<i class="ak-halvany">a megajándékozott neve</i>' : '')) + '</span></p>'
        : '')
      + '</div>';
  }

  // a HATOLDAL: a kartya adatai (automatikus; a szalon / a rendszer tolti ki)
  function hatlap(o, t) {
    var felirat = (o.felirat && o.felirat.length ? o.felirat : ['MOSAIC', 'HEAD SPA KEZELÉS']).map(esc).join('<br>');
    var kod = o.kod || (o.minta ? 'XXXX-XXXX' : '');
    return '<div class="ak ak-hat ak-t-' + esc(t.id) + '" data-tema="' + esc(t.id) + '">'
      + '<span class="ak-keret" aria-hidden="true"></span>'
      + '<p class="ak-brand ak-brand-kozep"><b>MOSAIC</b><small>HEADSPA AND HAIR</small></p>'
      + '<p class="ak-cim ak-cim-kozep">AJÁNDÉKKÁRTYA</p>'
      + '<p class="ak-termek">' + felirat + '</p>'
      + '<p class="ak-ertek"><small>ÉRTÉKE</small> ' + esc(o.ertek || '') + '</p>'
      + '<p class="ak-kod"><small>UTALVÁNYKÓD</small><b' + (kod.length > 14 ? ' style="font-size:' + CQ(lepcso(kod, [[22, 17], [60, 13]])) + '"' : '') + '>' + esc(kod) + '</b></p>'
      + (o.ervenyes ? '<p class="ak-ervenyes">Érvényes: ' + esc(o.ervenyes) + '</p>' : (o.minta ? '<p class="ak-ervenyes">Érvényes: a vásárlástól 6 hónapig</p>' : ''))
      + '<p class="ak-lab">Szeretettel várunk! · 1023 Budapest, Bécsi út 2. · mosaicheadspa.hu</p>'
      + '</div>';
  }

  // o: { tema, idezet, nev, fotoSrc, fotoPoz: {x,y,z}, felirat: [sor1, sor2], ertek, kod, ervenyes, minta, oldal }
  //    minta: true -> elonezet (fotohely-jelzo, mintakod); false -> a vegleges kartya
  //    oldal: 'elol' | 'hat' -> csak az adott fekvo lap; alapbol ('mind') a teljes A4-es lap: felul a hatoldal (180 fokkal elforgatva), alul az elolap
  function html(o) {
    var t = tema(o.tema) || TEMAK[0];
    if (o.oldal === 'elol') return elolap(o, t);
    if (o.oldal === 'hat') return hatlap(o, t);
    return '<div class="ak-lap">' + hatlap(o, t) + elolap(o, t) + '<span class="ak-hajt" aria-hidden="true"></span></div>';
  }

  // A kartya stilusa. A hasznalat: egy kontener szelessege szabja meg a meretet (minden lap container-type: inline-size).
  var CSS = [
    '.ak-lap{position:relative;width:100%;display:grid;grid-template-columns:100%}',
    '.ak-lap>.ak-hat{transform:rotate(180deg)}',
    '.ak-hajt{position:absolute;left:0;right:0;top:50%;border-top:1px dashed rgba(110,110,110,.5);pointer-events:none;z-index:4}',
    '.ak{position:relative;width:100%;aspect-ratio:794/561.5;container-type:inline-size;overflow:hidden;font-family:"Jost","Helvetica Neue",Arial,sans-serif;color:var(--ak-sz);background:var(--ak-h);-webkit-print-color-adjust:exact;print-color-adjust:exact;text-align:center}',
    '.ak p{margin:0}',
    '.ak small{display:block;font-size:' + CQ(9) + ';letter-spacing:.22em;opacity:.85}',
    '.ak-t-smaragd{--ak-h:#0f2624;--ak-sz:#f3e4b6;--ak-a:#d9bd6a;--ak-m:#0a1c1b}',
    '.ak-t-krem{--ak-h:#f8f1e3;--ak-sz:#2c2a22;--ak-a:#b79d68;--ak-m:#efe5d0}',
    '.ak-t-homok{--ak-h:linear-gradient(165deg,#ecdcc5,#dcc3a1);--ak-sz:#41331f;--ak-a:#8a6a36;--ak-m:#d3b88f}',
    '.ak-t-feher{--ak-h:#ffffff;--ak-sz:#243436;--ak-a:#17403f;--ak-m:#ece7dd}',
    '.ak-keret{position:absolute;inset:' + CQ(14) + ';border:1px solid var(--ak-a);opacity:.7;pointer-events:none}',
    '.ak-t-krem .ak-keret,.ak-t-feher .ak-keret{border-width:2px;opacity:.55}',
    '.ak-brand{position:absolute;top:' + TOP(34) + ';display:grid;gap:' + CQ(3) + ';justify-items:center}',
    '.ak-brand b{font-family:"Playfair Display",Georgia,serif;font-weight:500;font-size:' + CQ(27) + ';letter-spacing:.34em;padding-left:.34em;color:var(--ak-a)}',
    '.ak-brand small{font-size:' + CQ(8) + ';letter-spacing:.38em;padding-left:.38em}',
    '.ak-cim{position:absolute;top:' + TOP(100) + ';font-family:"Playfair Display",Georgia,serif;font-size:' + CQ(19) + ';letter-spacing:.3em;padding-left:.3em;color:var(--ak-sz)}',
    '.ak-brand-kozep{left:0;right:0}',
    '.ak-brand-kozep b{font-size:' + CQ(32) + '}',
    '.ak-cim-kozep{left:0;right:0;top:' + TOP(104) + ';font-size:' + CQ(22) + '}',
    '.ak-foto{position:absolute;background:var(--ak-m);overflow:hidden}',
    '.ak-ablak{position:relative;width:100%;height:100%;overflow:hidden}',
    '.ak-ablak img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;max-width:none;user-select:none;-webkit-user-drag:none;touch-action:none}',
    '.ak-hely{position:absolute;inset:0;display:grid;place-content:center;justify-items:center;gap:' + CQ(8) + ';color:var(--ak-a);font-size:' + CQ(14) + ';letter-spacing:.06em}',
    '.ak-iv{border-radius:999px 999px 0 0;border:' + CQ(3) + ' solid var(--ak-a)}',
    '.ak-teglalap{border-radius:' + CQ(12) + ';border:' + CQ(3) + ' solid var(--ak-a)}',
    '.ak-kor{border-radius:50%;border:' + CQ(4) + ' solid var(--ak-a)}',
    '.ak-polaroid{overflow:visible;background:#fff;padding:' + CQ(16) + ' ' + CQ(16) + ' ' + CQ(64) + ';transform:rotate(-2deg);box-shadow:0 ' + CQ(10) + ' ' + CQ(28) + ' rgba(36,52,54,.28);border:1px solid #e4dfd3;box-sizing:border-box}',
    '.ak-polaroid .ak-ablak{background:var(--ak-m)}',
    '.ak-idezet{position:absolute;display:flex;align-items:center;justify-content:center;font-family:"Playfair Display",Georgia,serif;font-style:italic;line-height:1.35;color:var(--ak-sz);white-space:pre-line;overflow-wrap:anywhere;overflow:hidden;padding:0 ' + CQ(8) + '}',
    '.ak-neki{position:absolute;display:grid;align-content:center;justify-items:center;gap:' + CQ(2) + ';font-family:"Playfair Display",Georgia,serif;color:var(--ak-a);overflow:hidden}',
    '.ak-neki small{font-family:"Jost",sans-serif;color:var(--ak-sz)}',
    '.ak-neki span{font-style:italic;line-height:1.15}',
    '.ak-halvany{opacity:.45}',
    // a hatoldal
    '.ak-termek{position:absolute;left:' + (60 / 7.94).toFixed(3) + '%;width:' + (674 / 7.94).toFixed(3) + '%;top:' + TOP(166) + ';font-size:' + CQ(19) + ';letter-spacing:.12em;line-height:1.4;color:var(--ak-sz)}',
    '.ak-ertek{position:absolute;left:0;right:0;top:' + TOP(262) + ';font-family:"Playfair Display",Georgia,serif;font-size:' + CQ(24) + ';color:var(--ak-a)}',
    '.ak-ertek small{display:inline;font-family:"Jost",sans-serif;font-size:' + CQ(10.5) + ';color:var(--ak-sz);margin-right:.6em}',
    '.ak-kod{position:absolute;left:' + (232 / 7.94).toFixed(3) + '%;width:' + (330 / 7.94).toFixed(3) + '%;top:' + TOP(306) + ';height:' + (54 / 5.615).toFixed(3) + '%;display:grid;align-content:center;justify-items:center;border:1px solid var(--ak-a);background:rgba(255,255,255,.1)}',
    '.ak-kod small{font-size:' + CQ(8) + ';color:var(--ak-sz)}',
    '.ak-kod b{font-family:"Courier New",Courier,monospace;font-weight:700;font-size:' + CQ(22) + ';letter-spacing:.1em;color:var(--ak-sz)}',
    '.ak-ervenyes{position:absolute;left:0;right:0;top:' + TOP(382) + ';font-size:' + CQ(13) + ';opacity:.85}',
    '.ak-lab{position:absolute;left:0;right:0;top:' + TOP(498) + ';font-size:' + CQ(10) + ';letter-spacing:.1em;opacity:.7}'
  ].join('\n');

  // az onallo (szerver) oldal betutipusai: a Playfair Display + Jost sajat tarhelyrol (az oldalon az ajandek.css tolti ugyanezeket)
  function betuCss(bazis) {
    var lat = 'unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
    var ext = 'unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';
    var ff = function (csal, stilus, suly, fajl, tartomany) {
      return '@font-face{font-family:"' + csal + '";font-style:' + stilus + ';font-weight:' + suly + ';font-display:swap;src:url(' + bazis + '/assets/fonts/' + fajl + '.woff2) format("woff2");' + tartomany + '}';
    };
    return [
      ff('Playfair Display', 'normal', 500, 'playfair-display-500-latin', lat), ff('Playfair Display', 'normal', 500, 'playfair-display-500-latin-ext', ext),
      ff('Playfair Display', 'normal', 400, 'playfair-display-400-latin', lat), ff('Playfair Display', 'normal', 400, 'playfair-display-400-latin-ext', ext),
      ff('Playfair Display', 'italic', 400, 'playfair-display-400-italic-latin', lat), ff('Playfair Display', 'italic', 400, 'playfair-display-400-italic-latin-ext', ext),
      ff('Jost', 'normal', 400, 'jost-400-latin', lat), ff('Jost', 'normal', 400, 'jost-400-latin-ext', ext)
    ].join('\n');
  }

  g.AJANDEK_KARTYA = {
    TEMAK: TEMAK, IDEZET_MAX: IDEZET_MAX, NEV_MAX: NEV_MAX, CSS: CSS, LAP_W: LAP_W, LAP_H: LAP_H,
    tema: tema, html: html, betuCss: betuCss, pozOlvas: pozOlvas, pozIr: pozIr
  };
})(typeof window !== 'undefined' ? window : globalThis);
