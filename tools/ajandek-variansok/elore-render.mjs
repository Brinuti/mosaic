// A persona-oldalak (ajandekkartya-variansok) ELORE kitoltese a build-ben: a foglalas/ajandek.html sablonjaba beirja a varians hero-szovegeit, a hero-kepet
// es a magyarazo-szekciot, igy a persona cime / szovege / kepe mar a HTML-ben ott van (nem az altalanos oldal villan fel, amig a JS le nem fut; a kereso is
// a persona szoveget latja). A JS (assets/js/ajandek.js heroRender / magyarazoRender) ugyanezt a tartalmat ugyanabbol az adatbol (ajandek-adat.js) irja be,
// ezert a ketto nem kuszik szet. Tiszta fuggveny: a build (tools/netlify-build.mjs) es a teszt is ezt hasznalja.
//
//   personaOldal(html, nev, A)   html: a foglalas/ajandek.html szovege, nev: az oldal neve (pl. 'headspa-self-care'), A: az AJANDEK_ADAT
//   -> az atirt html (ha a nev nem persona-oldal, vagy a varians a general: valtozatlan)

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function egyszer(html, regi, uj, mit) {
  const db = html.split(regi).length - 1;
  if (db !== 1) throw new Error('elore-render: a sablonban a(z) "' + mit + '" nem pontosan egyszer szerepel (' + db + ')');
  return html.replace(regi, () => uj);
}

// a magyarazo-szekcio kitoltott markupja (ugyanaz a szerkezet, mint az ajandek.js magyarazoRender-e)
export function magyarazoMarkup(m) {
  const md = m.media || {};
  const arany = md.w && md.h ? Math.min(1.6, Math.max(0.8, md.w / md.h)) : 1.333;
  return '<section class="ah-szekcio ah-magyarazo" id="ah-magyarazo" aria-labelledby="ah-magyarazo-cim">\n' +
    '    <div class="ah-tartalom ah-magyarazo-racs">\n' +
    '      <div class="ah-magyarazo-szoveg">\n' +
    '        <p class="ah-felcim" id="ah-magyarazo-felcim"' + (m.felcim ? '' : ' hidden') + '>' + esc(m.felcim) + '</p>\n' +
    '        <h2 id="ah-magyarazo-cim">' + esc(m.cim) + '</h2>\n' +
    '        <div class="ah-magyarazo-torzs" id="ah-magyarazo-torzs">' + (m.szovegek || []).map((t) => '<p>' + esc(t) + '</p>').join('') + '</div>\n' +
    '        <ul class="ah-pipalista" id="ah-magyarazo-pontok">' + (m.pontok || []).slice(0, 3).map((t) => '<li>' + esc(t) + '</li>').join('') + '</ul>\n' +
    '      </div>\n' +
    (md.src
      ? '      <figure class="ah-magyarazo-media" id="ah-magyarazo-media" style="--ah-magyarazo-arany:' + arany.toFixed(3) + '"><img id="ah-magyarazo-kep" src="' + esc(md.src) + '" alt="' + esc(md.alt) + '"' +
        (md.w && md.h ? ' width="' + md.w + '" height="' + md.h + '"' : '') + (md.poz ? ' style="object-position:' + esc(md.poz) + '"' : '') + ' loading="lazy" decoding="async"></figure>\n'
      : '      <figure class="ah-magyarazo-media" id="ah-magyarazo-media" hidden><img id="ah-magyarazo-kep" alt="" width="4" height="3" loading="lazy" decoding="async"></figure>\n') +
    '    </div>\n' +
    '  </section>';
}

export function personaOldal(html, nev, A) {
  const alap = A.oldalAlapertek('/' + nev);
  if (!alap.variant) return html;
  const v = A.variantFeloldas(alap.variant);
  if (v.variant_id === 'general') return html;
  const hm = v.hero_media || {};
  // hero: felcim, cim, alcim, gomb, megnyugtato sor, kep
  html = egyszer(html, '<p class="ah-felcim" id="ah-hero-eyebrow" hidden></p>', '<p class="ah-felcim" id="ah-hero-eyebrow" hidden>' + esc(v.hero_eyebrow) + '</p>', 'hero-felcim');   // a felcim a mostani dizajnban rejtett (mint a JS-ben is): csak a szoveg kerul bele
  html = egyszer(html, /<h1 id="ah-hero-cim">[^<]*<\/h1>/.exec(html)[0], '<h1 id="ah-hero-cim">' + esc(v.hero_title) + '</h1>', 'hero-h1');
  html = egyszer(html, /<p class="ah-lead" id="ah-hero-alcim">[^<]*<\/p>/.exec(html)[0], '<p class="ah-lead" id="ah-hero-alcim">' + esc(v.hero_subtitle) + '</p>', 'hero-alcim');
  html = egyszer(html, /<span id="ah-hero-cta-szoveg">[^<]*<\/span>/.exec(html)[0], '<span id="ah-hero-cta-szoveg">' + esc(v.hero_cta) + '</span>', 'hero-gomb');
  if (v.reassurance) html = egyszer(html, '<p class="ah-hero-biztositas" id="ah-hero-biztositas"></p>', '<p class="ah-hero-biztositas" id="ah-hero-biztositas">' + esc(v.reassurance) + '</p>', 'hero-biztositas');
  else html = egyszer(html, '<p class="ah-hero-biztositas" id="ah-hero-biztositas"></p>', '<p class="ah-hero-biztositas" id="ah-hero-biztositas" hidden></p>', 'hero-biztositas');
  if (hm.src) {
    const kep = /<img class="ah-hero-kep" id="ah-hero-kep" src="[^"]*" width="720" height="720" alt="[^"]*" fetchpriority="high">/.exec(html);
    if (!kep) throw new Error('elore-render: a hero-kep a sablonban nem talalhato');
    html = egyszer(html, kep[0], '<img class="ah-hero-kep" id="ah-hero-kep" src="' + esc(hm.src) + '" width="720" height="720" alt="' + esc(hm.alt) + '" fetchpriority="high">', 'hero-kep');
  }
  // magyarazo-szekcio: a sablonban rejtett, ures; a varians adataval kitoltve
  if (v.magyarazo) {
    const sz = /<section class="ah-szekcio ah-magyarazo" id="ah-magyarazo"[\s\S]*?<\/section>/.exec(html);
    if (!sz) throw new Error('elore-render: a magyarazo-szekcio a sablonban nem talalhato');
    html = egyszer(html, sz[0], magyarazoMarkup(v.magyarazo), 'magyarazo');
  }
  return html;
}
