// A kategoria-oldalak (migren / shenmen / klimax / slim piercing) uj, a fooldal stilusaban epulo sablonja.
//
// Az eredeti (Wix) oldalak ugyanazokbol a blokkokbol allnak: hos, "igy mukodik" (video), Google-velemenyek, "miert mukodnek", Facebook-kommentek,
// "nem hozzaerto kezekben", 93%, media, ekszerek, arlista + akcio, csapat, helyszinek, hosszu szoveg. A kinyert tartalom (uj-oldalak/tartalom/*.json)
// faja ebbol blokkokat ismer fel; a hos a fooldal hosevel azonos meretu es felepitesu, az ekszer / akcio / ar / media / csapat / helyszin blokk
// PONTOSAN a fooldal dobozaval (uj-oldalak/reszek/*.html, a fooldal is ezeket hasznalja) jelenik meg, a tobbi egyedi, a fooldal stilusu doboz.
// Ami nem ismerheto fel, valtozatlanul, az altalanos tukor-sablonnal jelenik meg (nincs elveszett tartalom).
// Tiszta fuggveny (nincs benne bongeszo): a Cloudflare-build is futtatja (tools/uj-fooldal.mjs -> sablon.mjs).

// a fejlec "Piercingek" menujenek oldalai. A "Divat fulpiercing" kimarad: kulon arlistaja van (12.000 Ft), a fooldal arai nem igazak ra.
import fs from 'node:fs';
import path from 'node:path';

export const KATEGORIA_UTAK = new Set(['/migren-piercing', '/shenmen-piercing', '/klimax-piercing', '/slim-etvagycsokkento-piercing',
  '/allergia-piercing', '/maj-piercing', '/pajzsmirigy-piercing', '/lep-piercing', '/vastagbel-piercing']);

// A hosszu szoveg fo-cimeinek helye (csomopont-indexek): h (1-2. szint), a szamozott cimek ("10. ...": a Wixen neha csak bekezdes, vagy 3. szintu cim) akkor,
// ha a szamuk folytatja a sort (az "a) ..." / "1. 2. 3." alpontok nem fo-cimek)
const foCimIndexek = (nodes, T) => {
  const fo = new Set();
  let utolso = 0;
  nodes.forEach((x, i) => {
    const t = T.szovegTiszta(x.html || '');
    const m = /^(\d{1,2})\.\s\S/.exec(t);
    const szam = m ? +m[1] : 0;
    if (x.t === 'h' && x.n <= 2) { fo.add(i); if (szam) utolso = szam; return; }
    const folytatja = szam > utolso && szam <= utolso + 3;
    if (x.t === 'h' && folytatja) { fo.add(i); utolso = szam; return; }
    if (x.t === 'p' && folytatja && t.length <= 90 && !/[.!?:]$/.test(t)) { fo.add(i); utolso = szam; }
  });
  return fo;
};

const laposit = (n, ki = []) => { if (n.k) n.k.forEach((x) => laposit(x, ki)); else ki.push(n); return ki; };
const gyerekek = (fa) => (fa.t === 'verem' ? fa.k : [fa]);

// ---------------------------------------------------------------------------------------------------------------------------------------
// a blokkok felismerese
export function kategoriaBlokkok(adat, T) {
  const tisztit = (n) => T.szovegTiszta(n.html || '');
  const szekciok = adat.szekciok;
  if (!szekciok.length) return null;
  const hero = heroElemzes(szekciok[0], T);
  if (!hero) return null;

  const videoIfr = (n) => n.t === 'iframe' && (n.fajta === 'yt' || n.fajta === 'egyeb');
  const velemenyIfr = (n) => n && n.t === 'iframe' && n.fajta === 'beagyazas' && (n.h || 0) >= 500;
  const vanVideo = (n) => laposit(n).some(videoIfr);
  const hCim = (n, re) => n && n.t === 'h' && re.test(tisztit(n));
  const sorKepVerem = (n) => n && n.t === 'sor' && n.k.length === 2 && n.k[0].t === 'kep' && n.k[1].t === 'verem' ? n.k[1] : null;
  const elsoP = (v) => (v && v.k[0] && v.k[0].t === 'p' ? tisztit(v.k[0]) : '');

  function felismer(k, i) {
    const n = k[i], kov = k[i + 1], kov2 = k[i + 2];
    const vege = k.length - i;   // "a szekcio vegeig"

    // Google-velemenyek: cim + (alcim) + a nagy beagyazott widget + "Tovabb az osszes velemenyhez"
    if (n.t === 'h' && (velemenyIfr(kov) || (kov && kov.t === 'p' && velemenyIfr(kov2)))) {
      const alcim = kov.t === 'p' ? kov : null;
      const utan = k[i + (alcim ? 3 : 2)];
      const link = utan && utan.t === 'p' && /Tovább az összes/i.test(tisztit(utan)) ? utan : null;
      return { tip: 'velemeny', cim: n, alcim, link, ifr: alcim ? kov2 : kov, hossz: (alcim ? 3 : 2) + (link ? 1 : 0) };
    }
    // "Igy mukodik": video + szoveg
    if (n.t === 'sor' && n.k.length === 2 && vanVideo(n)) {
      const szoveges = n.k.find((x) => !vanVideo(x));
      const lv = szoveges ? laposit(szoveges) : [];
      const h = lv.find((x) => x.t === 'h');
      if (h && /műk[öo]dik/i.test(tisztit(h))) return { tip: 'video', cim: h, video: laposit(n).find(videoIfr), szovegek: lv.filter((x) => x !== h), hossz: 1 };
    }
    if (n.t === 'sor' && n.k.length >= 2) {
      // a "hatter-*.png" dekoracios hatterkep, nem a tartalom kepe
      const kepN = n.k.filter((x) => x.t === 'kep' && (x.nw || 0) >= 300 && !/hatter/i.test(x.alt || '')).sort((a, b) => (b.nw * b.nh) - (a.nw * a.nh))[0];
      const szoveges = n.k.find((x) => x.t === 'verem');
      const lv = szoveges ? laposit(szoveges) : [];
      const h = lv.find((x) => x.t === 'h');
      if (kepN && h && /műk[öo]dik/i.test(tisztit(h))) return { tip: 'video', cim: h, kep: kepN, szovegek: lv.filter((x) => x !== h), hossz: 1 };
    }
    if (n.t === 'h' && /műk[öo]dik/i.test(tisztit(n)) && kov && videoIfr(kov)) return { tip: 'video', cim: n, video: kov, szovegek: [], hossz: 2 };
    if (n.t === 'h' && /műk[öo]dik/i.test(tisztit(n)) && kov && kov.t === 'sor' && vanVideo(kov)) {
      const lv = laposit(kov);
      const video = lv.find(videoIfr);
      return { tip: 'video', cim: n, video, szovegek: lv.filter((x) => x !== video && x.t !== 'gomb'), hossz: kov2 && kov2.t === 'gomb' ? 3 : 2 };
    }
    // "Miert mukodnek a piercingjeink?"
    const v = sorKepVerem(n);
    if (v && /^Miért működnek/i.test(elsoP(v))) return { tip: 'miert', kep: n.k[0], cim: v.k[0], lista: v.k.find((x) => x.t === 'ul'), hossz: 1 };
    // "Nem hozzaerto kezekben..."
    if (v && /^Nem hozzáértő/i.test(elsoP(v))) return { tip: 'figyelem', kep: n.k[0], cim: v.k[0], lista: v.k.find((x) => x.t === 'ul'), szovegek: v.k.filter((x) => x.t === 'p').slice(1), hossz: 1 };
    // 93% statisztika
    if (v && /^\d{2,3}\s*%$/.test(elsoP(v))) return { tip: 'stat', kep: n.k[0], szovegek: v.k.filter((x) => x.t === 'p'), hossz: 1 };
    // panaszok listaja (a vendegek javulasa)
    if (v && v.k.some((x) => x.t === 'h' && /panasz/i.test(tisztit(x)))) return { tip: 'panasz', kep: n.k[0], cim: v.k.find((x) => x.t === 'h'), szovegek: v.k.filter((x) => x.t !== 'h'), hossz: 1 };
    // Facebook-kommentek: cim + bevezeto + kepek (galeria vagy egy kep) + (kattints a nagyitashoz)
    if (hCim(n, /facebook vélemények/i)) {
      let j = i + 1;
      const bev = k[j] && k[j].t === 'p' ? k[j++] : null;
      const kepek = k[j] && (k[j].t === 'galeria' || k[j].t === 'kep') ? k[j++] : null;
      const tipp = k[j] && k[j].t === 'p' && /Kattints/i.test(tisztit(k[j])) ? k[j++] : null;
      if (kepek) return { tip: 'fb', cim: n, bev, kepek, tipp, hossz: j - i };
    }
    // a hosszu szoveges resz ("... tudastar" / osszefoglalo / informaciok): cim + egy nagy szoveg-verem, sok szamozott / fo-cimmel -> harmonika
    if (n.t === 'h' && kov && kov.t === 'verem' && foCimIndexek(kov.k, T).size >= 4) return { tip: 'tudastar', cim: n, torzs: kov.k, tobbi: k.slice(i + 2), hossz: vege };
    // a fooldal dobozaval megjeleno blokkok
    if (hCim(n, /legmagasabb minőségű ékszerek/i)) {
      let j = i + 1;
      while (j < k.length && !hCim(k[j], /^(Árlista|AKCIÓ)/i)) j++;
      return { tip: 'ekszer', hossz: j - i, nodes: k.slice(i, j) };
    }
    if (hCim(n, /^Árlista/i)) {
      const szoveg = JSON.stringify(k.slice(i));
      // a fooldal arai: 1 piercing 24.900, 2 piercing 39.900, 3 piercing 44.900 Ft; mas arlistat nem cserelunk le
      return ['24.900 Ft', '39.900 Ft', '44.900 Ft'].every((a) => szoveg.includes(a)) ? { tip: 'ar', hossz: vege, nodes: k.slice(i) } : null;
    }
    if (hCim(n, /médiában/i)) return { tip: 'media', hossz: vege, nodes: k.slice(i) };
    if (hCim(n, /Ismerd meg csapatunkat/i)) return { tip: 'csapat', hossz: vege, nodes: k.slice(i) };
    if (hCim(n, /^Már \d+ városban/i)) return { tip: 'helyszin', hossz: vege, nodes: k.slice(i) };
    return null;
  }

  const blokkok = [];
  for (let si = 1; si < szekciok.length; si++) {
    const k = gyerekek(szekciok[si].fa);
    let egyeb = [];
    const urit = () => { if (egyeb.length) { blokkok.push({ tip: 'egyeb', nodes: egyeb }); egyeb = []; } };
    for (let i = 0; i < k.length;) {
      const b = felismer(k, i);
      if (b) { urit(); blokkok.push(b); i += b.hossz; } else { egyeb.push(k[i]); i++; }
    }
    urit();
  }
  return { hero, blokkok };
}

// Az eredeti blokkok szovegei, amiket a fooldal dobozai valtottak fel (ekszer, akcio / arlista, media, csapat, helyszin): a tukor-teszt szoveg-lefedettsegi
// ellenorzese ezeket nem varja el az uj oldalon (a fooldal szovege jelenik meg helyettuk).
export function kategoriaCserelt(adat, T) {
  const p = kategoriaBlokkok(adat, T);
  if (!p) return null;
  const szovegek = [];
  for (const b of p.blokkok) {
    if (!['ekszer', 'ar', 'media', 'csapat', 'helyszin'].includes(b.tip)) continue;
    for (const l of b.nodes.flatMap((n) => laposit(n))) {
      if (l.t === 'h' || l.t === 'p') szovegek.push(T.szovegTiszta(l.html || ''));
      else if (l.t === 'ul') szovegek.push(...l.elemek.map((e) => T.szovegTiszta(e)));
      else if (l.t === 'gomb') szovegek.push(l.szoveg);
    }
  }
  return szovegek.filter(Boolean);
}

// a hos tartalma: cim, bevezeto, gomb, ertekeles, kep, idezet
function heroElemzes(szekcio, T) {
  const tisztit = (n) => T.szovegTiszta(n.html || '');
  const lv = laposit(szekcio.fa);
  const h1 = lv.find((x) => x.t === 'h' && x.n === 1) || lv.find((x) => x.t === 'h');
  const kep = lv.filter((x) => x.t === 'kep').sort((a, b) => (b.nw || 0) - (a.nw || 0)).find((x) => (x.nw || 0) >= 500);
  if (!h1 || !kep) return null;
  const ps = lv.filter((x) => x.t === 'p' && tisztit(x));
  const ert = ps.find((p) => /^Kiváló/i.test(tisztit(p)) || (/\d[.,]\d/.test(tisztit(p)) && /vélemény|értékelés/i.test(tisztit(p))));
  const tag = ps.find((p) => /csak\s+e[üu]\s+szakember/i.test(tisztit(p)));
  const hIdezet = lv.find((x) => x.t === 'h' && x !== h1);
  const idezetP = hIdezet ? lv.slice(lv.indexOf(hIdezet) + 1).find((x) => x.t === 'p') : null;
  const extra = ps.filter((p) => p !== ert && p !== tag && p !== idezetP && T.csakLink(p.html) && !/^Kiváló/i.test(tisztit(p)));
  const bev = ps.find((p) => lv.indexOf(p) > lv.indexOf(h1) && p !== ert && p !== tag && p !== idezetP && !extra.includes(p));
  return { h1, kep, gomb: lv.find((x) => x.t === 'gomb'), ert, tag, bev, extra, idezetH: hIdezet, idezetP };
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// megjelenites
export function kategoriaFo(ROOT, adat, c, T) {
  if (!KATEGORIA_UTAK.has(adat.ut)) return null;
  const p = kategoriaBlokkok(adat, T);
  if (!p) return null;
  const { esc, IK, szovegLink, szovegTiszta, belso } = T;
  const van = new Set(p.blokkok.map((b) => b.tip));
  c.h1 = true;       // a hos h1-e mar megvan
  c.kepSzam = 1;     // a hos kepe az elso (a tobbi lusta toltesu)

  // az eredeti fooldal szalon-fotogaleriaja (a tartalom-JSON-ban: a cim nelkuli, 10-nel tobb kepes galeria)
  let fooldaliGaleria = null;
  try {
    const fo = JSON.parse(fs.readFileSync(path.join(ROOT, 'uj-oldalak/tartalom/index.json'), 'utf8'));
    const keres = (n) => (n.t === 'galeria' ? [n] : (n.k || []).flatMap(keres));
    const cimes = (n) => n.t === 'h' || (n.k || []).some(cimes);
    for (const sz of fo.szekciok) { if (cimes(sz.fa)) continue; const g = keres(sz.fa).find((x) => x.kepek.length >= 10); if (g) { fooldaliGaleria = g; break; } }
  } catch { /* marad az eredeti galeria */ }

  const lista = (n, osztaly = 'pipak') => `<ul class="${osztaly}">${n.elemek.map((e) => `<li>${osztaly === 'pipak' ? IK('check') : ''}${szovegLink(e)}</li>`).join('')}</ul>`;
  const bekezd = (n) => `<p>${szovegLink(n.html)}</p>`;
  const gombHtml = (szoveg, href, kicsi = true) => `<a class="gomb ${kicsi ? 'gomb-kicsi' : 'gomb-tomor'}" href="${esc(href)}">${esc(szoveg)}${IK('chev', 'ik-nyil')}</a>`;
  const reszlet = (nev) => T.partial(ROOT, nev);
  const keparany = (n) => (n.nw && n.nh ? ` width="${n.nw}" height="${n.nh}"` : '');

  // --- hos: ugyanaz a felepites, mint az uj fooldalon ---
  const hos = () => {
    const h = p.hero;
    let cim = szovegLink(h.h1.html);
    if (!/</.test(cim)) cim = cim.replace(/(garanci.*|egészségügyi tapasztalattal\.?)$/i, '<em>$1</em>');
    const gomb = h.gomb ? h.gomb : { szoveg: 'Időpontot foglalok', href: '/idopontfoglalas' };
    const linkek = [`<li><a href="/migren-es-shenmen-piercing-garancia">Garancia »</a></li>`];
    if (van.has('helyszin')) linkek.push('<li><a href="#helyszinek">Helyszíneink »</a></li>');
    for (const e of h.extra) linkek.push(`<li>${szovegLink(e.html)}</li>`);
    const csill = Array.from({ length: 5 }, () => IK('star')).join('');
    // a pontszam es a vélemenyek szama a Trustindex-widget fejlecebol jon (assets/js/uj-fooldal.js 4c.: /api/ertekeles); a szoveg itt csak tartalek
    const ert = `<p class="kat-ertekeles"><span class="csillagok" role="img" aria-label="5 csillagból 4,8">${csill}</span><a href="/migren-shenmen-piercing-velemenyek" data-ti-ertekeles>Kiváló – 4,8 – 5\u00a0000+ vélemény »</a></p>`;
    return `<section class="hos kat-hos">
    <div class="tarto hos-racs">
      <h1 class="hos-cim">${cim}</h1>
      <div class="hos-szoveg">
        ${h.bev ? `<p class="hos-bevezeto">${szovegLink(h.bev.html)}</p>` : ''}
        ${h.idezetP ? `<p class="hos-alcim">${szovegLink(h.idezetP.html)}</p>` : ''}
        <div class="gombsor">
          <a class="gomb gomb-tomor" href="${esc(belso(gomb.href))}">${IK('calendar')}${esc(gomb.szoveg.replace(/!$/, ''))}${IK('chev', 'ik-nyil')}</a>
          ${van.has('ar') ? `<a class="gomb gomb-ures" href="#arak">Árak és akciók${IK('chev', 'ik-nyil')}</a>` : ''}
        </div>
        ${ert}
        <ul class="hos-linkek">${linkek.join('')}</ul>
        <ul class="bizalom">
          <li>${IK('shield')}<span><b>EÜ</b> szakemberek</span></li>
          <li>${IK('users')}<span><b>Alapítói</b> EÜ tapasztalat</span></li>
          <li>${IK('pin')}<span><b>Budapesten</b> állandó szalon</span></li>
          <li>${IK('map')}<span><b>Több mint 11</b> vidéki városban</span></li>
        </ul>
      </div>
      <figure class="hos-kep">
        <img src="${esc(h.kep.src)}"${keparany(h.kep)} alt="${esc(h.kep.alt || adat.cim)}"${h.kep.nh > h.kep.nw ? ' style="object-position:50% 40%"' : ''} fetchpriority="high">
        ${h.idezetH ? `<figcaption class="hos-idezet"><span class="hos-idezet-cim">${szovegLink(h.idezetH.html)}</span>${h.idezetP ? `<small>${szovegLink(h.idezetP.html)}</small>` : ''}</figcaption>` : ''}
        <div class="hos-pecset" aria-hidden="true">${IK('shield')}<span>20 év<br>alapítói<br>egészségügyi<br>tapasztalat</span></div>
      </figure>
    </div>
  </section>`;
  };

  // --- "Igy mukodik": video + szoveg doboz ---
  const video = (b) => {
    const szovegek = [];
    const sorok = b.szovegek.filter((n) => (n.t === 'p' && szovegTiszta(n.html)) || n.t === 'ul');
    const gondolatjel = (x) => x.t === 'p' && /^\s*-\s/.test(szovegTiszta(x.html));
    for (let i = 0; i < sorok.length; i++) {
      const n = sorok[i];
      if (n.t === 'ul') { szovegek.push(lista(n)); continue; }
      if (gondolatjel(n)) {   // a "- Hohullamok," sorokbol lista lesz
        const elemek = [];
        let j = i;
        while (j < sorok.length && gondolatjel(sorok[j])) elemek.push(esc(szovegTiszta(sorok[j++].html).replace(/^\s*-\s*/, '')));
        szovegek.push(lista({ elemek }));
        i = j - 1;
        continue;
      }
      szovegek.push(bekezd(n));
    }
    const egyedul = !szovegek.length;
    const bal = b.video ? T.iframe(b.video) : `<img class="kat-video-img" src="${esc(b.kep.src)}"${keparany(b.kep)} alt="${esc(b.kep.alt || '')}" loading="lazy" decoding="async" data-nagyit>`;
    return `<section class="tarto"><article class="kat-doboz kat-video${egyedul ? ' kat-video-egy' : ''}${b.video ? '' : ' kat-video-kepes'}">
    <div class="kat-video-kep">${bal}</div>
    <div class="kat-doboz-szoveg">
      <p class="felirat">${IK(b.video ? 'play' : 'sparkles')}${b.video ? 'Videó' : 'Röviden'}</p>
      <h2>${szovegLink(b.cim.html)}</h2>
      ${szovegek.join('\n      ')}
      <a class="gomb gomb-kicsi" href="/idopontfoglalas">Időpontot foglalok${IK('chev', 'ik-nyil')}</a>
    </div>
  </article></section>`;
  };

  // --- Google-velemenyek: cim + a fooldal Trustindex-doboza + tovabb link ---
  const velemeny = (b) => {
    // az eredeti oldal beagyazasa (assets/embed/*.html) az oldal sajat Trustindex-widgetjet toltotte (pl. a migren-oldalon elol a migrenes velemenyek): ugyanazt a kulcsot hasznaljuk
    let kulcs = null;
    try { kulcs = /loader\.js\?([a-z0-9]+)/.exec(fs.readFileSync(path.join(ROOT, b.ifr.src.replace(/^\//, '')), 'utf8'))?.[1] || null; } catch { /* a fooldali widget marad */ }
    const widget = kulcs ? reszlet('velemenyek').replace(/loader\.js\?[a-z0-9]+/, 'loader.js?' + kulcs) : reszlet('velemenyek');
    const l = b.link && T.csakLink(b.link.html) ? szovegLink(b.link.html).trim().replace(/^<a /, '<a class="szoveg-link" ') : '';
    return `<section class="kat-blokk">
    <div class="tarto kat-fej"><h2>${szovegLink(b.cim.html)}</h2>${b.alcim ? `<p class="kat-alcim">${szovegLink(b.alcim.html)}</p>` : ''}</div>
${widget}
    ${l ? `<div class="tarto kat-tovabb">${l}</div>` : ''}
  </section>`;
  };

  const miert = (b) => `<section class="tarto"><article class="kat-doboz kat-miert">
    <img class="kat-miert-kep" src="${esc(b.kep.src)}"${keparany(b.kep)} alt="${esc(b.kep.alt || '')}" loading="lazy" decoding="async">
    <div class="kat-doboz-szoveg">
      <h2>${szovegLink(b.cim.html)}</h2>
      ${b.lista ? lista(b.lista) : ''}
    </div>
  </article></section>`;

  // --- Facebook-kommentek: kartyas, lapozhato, kattintasra nagyit ---
  const fb = (b) => {
    const kepek = b.kepek.t === 'galeria' ? b.kepek.kepek : [b.kepek];
    const id = ++c.galeriaSzam;
    const dia = (k) => `<figure class="kar-dia"><img src="${esc(k.src)}" alt="${esc(k.alt || 'Vendég Facebook-kommentje')}" loading="lazy" decoding="async" data-nagyit data-grp="g${id}"></figure>`;
    const db = kepek.length;
    const sav = `<div class="kar kat-fb-kar" data-kar="${id}"><div class="kar-sav" tabindex="0" aria-label="Facebook-kommentek">${kepek.map(dia).join('')}</div>`
      + (db > 1 ? `<button type="button" class="kar-gomb kar-elozo" aria-label="Előző képek" disabled>${IK('chev')}</button><button type="button" class="kar-gomb kar-kov" aria-label="Következő képek">${IK('chev')}</button><p class="kar-szam"><span data-kar-akt>1</span> / ${db}</p>` : '') + '</div>';
    return `<section class="tarto"><div class="kat-doboz kat-fb">
    <p class="felirat">${IK('fb')}Facebook</p>
    <h2>${szovegLink(b.cim.html)}</h2>
    ${b.bev ? `<p class="kat-fb-bev">${szovegLink(b.bev.html)}</p>` : ''}
    ${sav}
    ${b.tipp ? `<p class="kat-tipp">${szovegLink(b.tipp.html)}</p>` : ''}
  </div></section>`;
  };

  const figyelem = (b) => `<section class="tarto"><article class="kat-doboz kat-figyelem">
    <img class="kat-figyelem-kep" src="${esc(b.kep.src)}"${keparany(b.kep)} alt="" loading="lazy" decoding="async">
    <div class="kat-doboz-szoveg">
      <h2>${szovegLink(b.cim.html)}</h2>
      ${b.lista ? lista(b.lista, 'kat-hiba') : ''}
      ${b.szovegek.map(bekezd).join('\n      ')}
    </div>
  </article></section>`;

  const stat = (b) => {
    const [szam, szoveg, ...lab] = b.szovegek;
    return `<section class="tarto"><article class="kat-doboz kat-stat">
    <img class="kat-stat-kep" src="${esc(b.kep.src)}"${keparany(b.kep)} alt="${esc(b.kep.alt || '')}" loading="lazy" decoding="async">
    <div class="kat-doboz-szoveg">
      <p class="kat-szam">${szovegLink(szam.html)}</p>
      ${szoveg ? `<p class="kat-szam-szoveg">${szovegLink(szoveg.html)}</p>` : ''}
      ${lab.map((x) => `<p class="kat-lab">${szovegLink(x.html)}</p>`).join('')}
    </div>
  </article></section>`;
  };

  // a vendegek panaszai: a fooldal "panel" stilusa (szoveg + elhalvanyodo kep)
  const panasz = (b) => `<section class="tarto"><article class="panel kat-panasz">
    <div class="panel-szoveg">
      <p class="felirat">${IK('userc')}Vendégeink tapasztalata</p>
      <h2>${szovegLink(b.cim.html)}</h2>
      ${b.szovegek.map((x) => (x.t === 'ul' ? lista(x) : x.t === 'p' ? bekezd(x) : '')).join('\n      ')}
      <a class="gomb gomb-kicsi" href="/idopontfoglalas">Időpontot foglalok${IK('chev', 'ik-nyil')}</a>
    </div>
    <img src="${esc(b.kep.src)}"${keparany(b.kep)} alt="${esc(b.kep.alt || '')}" loading="lazy" decoding="async">
  </article></section>`;

  // a hosszu szoveges resz harmonikaban: csak a fo-cimek latszanak, a tartalom csukva (nativ <details>, nincs hozza szkript)
  const tudastar = (b) => {
    const elemek = [];
    const bevezeto = [];
    let akt = null;
    const fo = foCimIndexek(b.torzs, T);
    for (const [i, n] of b.torzs.entries()) {
      if (fo.has(i)) { akt = { cim: n.html, nodes: [] }; elemek.push(akt); } else if (akt) akt.nodes.push(n); else bevezeto.push(n);
    }
    if (bevezeto.length) elemek.unshift({ cim: 'Bevezető', nodes: bevezeto });
    // az eredeti oldalon a "pont helye" abra a szoveg vegere csuszott: oda tesszuk, ahova tartozik (a "helye / hova szurjak" resz, ennek hianyaban a "mukodese")
    const lent = [];
    for (const kep of b.tobbi.filter((x) => x.t === 'kep')) {
      const hova = (re) => elemek.findIndex((e) => !e.kep && re.test(szovegTiszta(e.cim)));
      const i = [hova(/helye|hova |hol /i), hova(/műk[öo]d[ée]s/i)].find((x) => x >= 0);
      if (i === undefined) lent.push(kep); else elemek[i].kep = kep;
    }
    const kepHtml = (kep) => `<figure class="kat-elem-kep"><img src="${esc(kep.src)}"${keparany(kep)} alt="${esc(kep.alt || '')}" loading="lazy" decoding="async" data-nagyit></figure>`;
    const torzs = (e) => {
      const r = [];
      let kepBent = !e.kep;
      for (const n of e.nodes) {
        r.push(T.csomopont(n, c));
        if (!kepBent && n.t === 'p') { r.push(kepHtml(e.kep)); kepBent = true; }   // a "lasd a kepen" bekezdes utan
      }
      if (!kepBent) r.push(kepHtml(e.kep));
      return r.join('\n');
    };
    const gomb = b.tobbi.find((x) => x.t === 'gomb');
    return `<section class="tarto kat-tudastar">
    <h2 class="kat-tudastar-cim">${szovegLink(b.cim.html)}</h2>
    <div class="kat-harmonika">
      ${elemek.map((e) => `<details class="kat-elem"><summary><span class="kat-elem-cim">${String(e.cim).replace(/<[^>]+>/g, '')}</span><span class="kat-elem-nyil" aria-hidden="true">${IK('chev')}</span></summary><div class="sz kat-elem-torzs">${torzs(e)}</div></details>`).join('\n      ')}
    </div>
    ${lent.map((k) => kepHtml(k)).join('')}
    <div class="kat-tudastar-gomb"><a class="gomb gomb-tomor" href="${esc(gomb ? belso(gomb.href) : '/idopontfoglalas')}">${esc((gomb ? gomb.szoveg : 'Időpontot foglalok').replace(/!$/, ''))}${IK('chev', 'ik-nyil')}</a></div>
  </section>`;
  };

  // minden mas: az altalanos tukor-sablon, a fooldal stilusu keretben (a hosszu szoveg keret nelkul)
  const egyeb = (b) => {
    const lathato = [];
    const lattak = new Set();
    // a szalon-fotogaleria (csak egy nagy galeria, nincs mellette cim): az eredeti FOOLDAL mostani kepei jelennek meg (a regi kepeken mar nem dolgozo kolleganok is vannak)
    if (b.nodes.length === 1 && b.nodes[0].t === 'galeria' && b.nodes[0].kepek.length >= 10 && fooldaliGaleria) return `<section class="tarto"><div class="sz kat-doboz kat-egyeb">${T.csomopont(fooldaliGaleria, c)}</div></section>`;
    for (const n of b.nodes) {   // az ismetlodo, azonos gombokbol (a Wix-oldalon egymas alatt halmozva) egy marad
      if (n.t === 'gomb') { const kulcs = n.szoveg + '|' + n.href; if (lattak.has(kulcs)) continue; lattak.add(kulcs); }
      lathato.push(n);
    }
    const tartalom = lathato.map((n) => T.csomopont(n, c)).join('\n');
    if (!tartalom.replace(/<[^>]+>/g, '').trim() && !/<(img|iframe|video|a )/.test(tartalom)) return '';
    const hossz = tartalom.replace(/<[^>]+>/g, '').length;   // a lathato szoveg hossza
    return hossz > 2500
      ? `<section class="sz kat-cikk"><div class="tarto">${tartalom}</div></section>`
      : `<section class="tarto"><div class="sz kat-doboz kat-egyeb">${tartalom}</div></section>`;
  };

  const resz = [hos()];
  // a vendegek panaszai ("az alabbi panaszokon ertek el javulast") rogton a Google-velemenyek alatt
  const sorrend = [...p.blokkok];
  const pi = sorrend.findIndex((b) => b.tip === 'panasz'), vi = sorrend.findIndex((b) => b.tip === 'velemeny');
  if (pi >= 0 && vi >= 0) sorrend.splice(vi + 1, 0, ...sorrend.splice(pi, 1));
  for (const b of sorrend) {
    switch (b.tip) {
      case 'video': resz.push(video(b)); break;
      case 'velemeny': resz.push(velemeny(b)); break;
      case 'miert': resz.push(miert(b)); break;
      case 'fb': resz.push(fb(b)); break;
      case 'figyelem': resz.push(figyelem(b)); break;
      case 'stat': resz.push(stat(b)); break;
      case 'panasz': resz.push(panasz(b)); break;
      case 'ekszer': resz.push(reszlet('ekszerek')); break;
      case 'ar': resz.push(reszlet('akcio'), reszlet('arak')); break;
      case 'tudastar': resz.push(tudastar(b)); break;
      case 'media': resz.push(`<section class="tarto kat-egy">\n${reszlet('media')}\n  </section>`); break;
      case 'csapat': resz.push(`<section class="tarto kat-egy">\n${reszlet('csapat')}\n  </section>`); break;
      case 'helyszin': resz.push(reszlet('helyszinek')); break;
      default: resz.push(egyeb(b));
    }
  }
  const html = resz.filter(Boolean).join('\n\n');
  return { html, nagyito: van.has('ekszer'), helyiIdk: new Set([...html.matchAll(/\sid="([A-Za-z0-9_-]+)"/g)].map((m) => m[1])) };
}
