// A kinyert tartalom (uj-oldalak/tartalom/*.json, tools/uj-oldalak/kinyer.mjs) megjelenitese az uj, kompakt stilusban.
// A tartalom valtozatlan (minden szoveg, kep, link, beagyazas, urlap, hozzaszolas), csak a megjelenes uj: ugyanaz a fejlec / menu / lablec, mint
// az uj fooldalon (/uj-fooldal), az eredeti szinek (#d7aba8 gomb, #454659 szoveg, #f6ebe4 hatter), kis helyen elmondott tartalom.
// Tiszta fuggveny: nincs benne bongeszo, igy a Cloudflare-build is futtatja (tools/uj-fooldal.mjs: ujOldalak).
import fs from 'node:fs';
import path from 'node:path';
import { kategoriaFo } from './kategoria.mjs';
import { statDoboz } from './kozos.mjs';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const SITE_RE = /^https?:\/\/(?:www\.)?medicalpiercing\.hu(?=[/?#]|$)/i;
const FOGLALAS = /^\/(idopontfoglalas|kontroll)(?:[/?#]|$)|^https?:\/\/medicalpiercing\.salonic\.hu(?:[/?#]|$)/i;

// belso hivatkozas: a sajat tartomany teljes cimebol utvonal, a /post/<slug> a Wix masodik cime a blogbejegyzesre
export const belso = (h) => {
  if (!h) return h;
  let x = h.replace(SITE_RE, '');
  if (x === '') x = '/';
  return x.replace(/^\/post\//, '/');
};
// a szovegbe agyazott linkek (a kinyero <a href="...">-ot ad)
// a Wix-szoveg Unicode-athuzasa (betu + U+0336) valodi athuzas (<s>) lesz: a betutipus nem tudja rajzolni, es igy tisztan latszik
const athuzas = (html) => html.replace(/(?:[^\u0336<>]\u0336)+/g, (m) => `<s>${m.replace(/\u0336/g, '')}</s>`);
const szovegLink = (html) => athuzas(html.replace(/href="([^"]*)"/g, (m, h) => `href="${belso(h.replace(/&amp;/g, '&')).replace(/&/g, '&amp;')}"`));
const szovegTiszta = (html) => html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();

const IK = (nev, osztaly = '') => `<svg class="ik${osztaly ? ' ' + osztaly : ''}" aria-hidden="true"><use href="#i-${nev}"/></svg>`;

const ytId = (src) => { const m = String(src).match(/(?:embed\/|v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/); return m ? m[1] : ''; };

// ---------------------------------------------------------------------------------------------------------------------------------------
// a kontextus: egy oldal renderelesenek allapota (az elso cim h1, a kepek betoltese, azonositok)
function ujKontextus(adat, opciok) {
  return { adat, opciok, h1: false, kepSzam: 0, galeriaSzam: 0, urlapSzam: 0, ut: adat.ut, kulcs: adat.kulcs };
}

const ikonMeret = (n) => n.w && n.w <= 150 && n.h && n.h <= 150;
const mediaLevel = (n) => (n.t === 'kep' && !ikonMeret(n)) || n.t === 'iframe' || n.t === 'video' || n.t === 'galeria';

// ---------------------------------------------------------------------------------------------------------------------------------------
// levelek
function kep(n, c, extra = '') {
  c.kepSzam++;
  const elso = c.kepSzam === 1;
  const arany = n.nw && n.nh ? n.nw / n.nh : 0;
  const illesztes = arany && (arany < 0.62 || arany > 2.3) ? ' kep-egesz' : '';
  const meret = n.nw && n.nh ? ` width="${n.nw}" height="${n.nh}"` : '';
  const ikon = ikonMeret(n) ? ' kep-ikon' : '';
  const nagyit = !n.link && n.nw >= 500 && !ikon ? ' data-nagyit' : '';
  const img = `<img class="kep${ikon}${illesztes}${extra}" src="${esc(n.src)}" alt="${esc(n.alt)}"${meret}${elso ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async"${nagyit}>`;
  if (n.link) {
    const h = belso(n.link);
    return `<a class="kep-link" href="${esc(h)}"${/^https?:/.test(h) ? ' target="_blank" rel="noopener"' : ''}>${img}</a>`;
  }
  return img;
}

function gomb(szoveg, href, kulso) {
  const h = belso(href);
  const elso = FOGLALAS.test(h) || /időpont|foglal/i.test(szoveg);
  const kulsoLink = /^https?:/i.test(h) && !FOGLALAS.test(h);
  return `<a class="gomb ${elso ? 'gomb-tomor' : 'gomb-ures'}" href="${esc(h)}"${kulsoLink || kulso && !FOGLALAS.test(h) ? ' target="_blank" rel="noopener"' : ''}>${esc(szoveg)}${elso ? IK('chev', 'ik-nyil') : ''}</a>`;
}

const csakLink = (html) => { const m = html.trim().match(/^<a href="([^"]*)"([^>]*)>([\s\S]*?)<\/a>$/); return m && !/<a /.test(m[3]) ? { href: m[1].replace(/&amp;/g, '&'), szoveg: szovegTiszta(m[3]) } : null; };

function szoveg(n, c) {
  const html = szovegLink(n.html);
  if (n.t === 'h' && c.adat.tipus === 'cikk' && szovegTiszta(html) === 'Hozzászólások') return '';   // a cikk sajat hozzaszolas-blokkja mar tartalmazza
  if (n.t === 'h') {
    let szint = n.n || 2;
    let tag;
    if (!c.h1) { tag = 'h1'; c.h1 = true; } else tag = szint <= 2 ? 'h2' : 'h3';
    const nagy = n.fs >= 34 ? ' c-nagy' : '';
    return `<${tag} class="cim${nagy}${n.kozep ? ' kozep' : ''}">${html}</${tag}>`;
  }
  // a sima link-bekezdes (pl. "Idopont foglalas") gombkent jelenik meg
  const cl = csakLink(html);
  if (cl && n.kozep && FOGLALAS.test(belso(cl.href))) return `<div class="gb${n.kozep ? ' kozep' : ''}">${gomb(cl.szoveg, cl.href, false)}</div>`;
  const plain = szovegTiszta(html);
  let osztaly = '';
  if (n.fs >= 48 && plain.length <= 8) osztaly = 'stat';
  else if (n.fs >= 24 && plain.length <= 90) osztaly = 'p-nagy';
  const kit = n.kit ? ` data-mp-kitelepules="${esc(n.kit)}" data-teljes` : '';
  return `<p${osztaly || n.kozep ? ` class="${[osztaly, n.kozep ? 'kozep' : ''].filter(Boolean).join(' ')}"` : ''}${kit}>${html}</p>`;
}

function lista(n) {
  const tag = n.rendezett ? 'ol' : 'ul';
  return `<${tag} class="lista${n.elemek.length >= 7 ? ' lista-2' : ''}">${n.elemek.map((e) => `<li>${szovegLink(e)}</li>`).join('')}</${tag}>`;
}

// a Google-velemenyek mindenhol a fooldal dobozaval (Trustindex-widget + mentett tartalek, a tulajdonos kerese, 2026-10-16). Az eredeti oldal sajat
// (kategoria szerint szurt) widgetje marad, ha rendes lapozo (sok velemeny); a 2 velemenyes, az ures es az ismeretlen widget helyett a fooldali (35 velemeny).
export const JO_VELEMENY_KULCSOK = new Set(['daf9c4e6731895546126ce4c8b5', '390c50c671fa95517a166e7fb87', '090adf36761195502c463108408', '7212be067de09554c19604f30bb',
  '19ac4b860dbd933cd266477ac5a', '969dcd2671ff955a0436ca9d78d', '60b14346075e933b1a86ccf4af3', '0ae0c90328c717129056ab2ab62']);
export const tiKulcs = (src) => { try { return /loader\.js\?([a-z0-9]+)/.exec(fs.readFileSync(path.join(GYOKER, String(src).replace(/^\//, '')), 'utf8'))?.[1] || null; } catch { return null; } };
export function velemenyDoboz(kulcs, szekcio = false) {
  let h = fs.readFileSync(path.join(GYOKER, 'uj-oldalak/reszek/velemenyek.html'), 'utf8').trimEnd();
  if (kulcs && JO_VELEMENY_KULCSOK.has(kulcs)) h = h.replace(/loader\.js\?[a-z0-9]+/, 'loader.js?' + kulcs);
  return szekcio ? h : h.trim().replace(/^<section class="velemenyek tarto"([^>]*)>/, '<div class="velemenyek"$1>').replace(/<\/section>$/, '</div>');
}
function iframe(n) {
  // a Trustindex-velemenyek beagyazasa (assets/embed/*.html): a fooldal velemeny-doboza
  if (n.fajta === 'beagyazas' && /^\/assets\/embed\//.test(n.src || '')) { const k = tiKulcs(n.src); if (k) return velemenyDoboz(k); }
  if (n.fajta === 'yt') {
    const id = ytId(n.src);
    return `<a class="video video-egy" href="https://www.youtube.com/watch?v=${esc(id)}" target="_blank" rel="noopener" data-embed="https://www.youtube-nocookie.com/embed/${esc(id)}?autoplay=1&amp;rel=0&amp;enablejsapi=1" data-cim="${esc(n.cim || 'Videó')}" aria-label="Videó lejátszása: ${esc(n.cim || '')}"><span class="video-kep"><img src="https://i.ytimg.com/vi/${esc(id)}/hqdefault.jpg" alt="" loading="lazy" decoding="async" width="480" height="360"><span class="lejatszo">${IK('play')}</span></span></a>`;
  }
  if (n.fajta === 'terkep') return `<div class="terkepdoboz"><iframe src="${esc(n.src)}" title="${esc(n.cim || 'Térkép')}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></div>`;
  if (n.fajta === 'beagyazas') return `<div class="beagyaz" style="--mag:${Math.min(Math.max(n.h || 300, 160), 760)}px"><iframe src="${esc(n.src)}" title="${esc(n.cim || 'Beágyazott tartalom')}" loading="lazy"></iframe></div>`;
  return `<div class="beagyaz" style="--mag:${Math.min(Math.max(n.h || 300, 160), 640)}px"><iframe src="${esc(n.src)}" title="${esc(n.cim || 'Beágyazott tartalom')}" loading="lazy" allowfullscreen></iframe></div>`;
}

// a Wix a video boritokepet kulon kepkent (<a video neve>f000.webp) menti: ha van, az a poster (ne fekete doboz latszodjon)
const GYOKER = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const boritoKep = (src) => { const m = String(src).match(/^\/assets\/video\/([A-Za-z0-9_]+)\.mp4$/); const k = m && `/assets/img/${m[1]}f000.webp`; return k && fs.existsSync(path.join(GYOKER, k)) ? k : ''; };
function video(n) {
  if (!n.src) return '';
  const hatter = n.hurok && n.nemakt;
  const poster = n.poster || boritoKep(n.src);
  const allo = n.h && n.w && n.h > n.w * 1.2;   // allo (9:16) video: keskeny, kozepen
  return `<video class="vid${allo ? ' vid-allo' : ''}" src="${esc(n.src)}"${poster ? ` poster="${esc(poster)}"` : ''}${hatter ? ' autoplay muted loop' : poster ? ' controls preload="none"' : ' controls preload="metadata"'} playsinline></video>`;   // (boritoval a video csak inditaskor tolt: gyorsitas, 2026-10-17)
}

// a szalon-fotogaleria mindenhol a migren-piercing-b oldal galeriajanak kepeivel (a tulajdonos kerese, 2026-10-16): a "Budapesten a Jaszainal varunk" szekcio 10-nel tobb kepes galeriaja
let szalonKesz;
export function szalonGaleria() {
  if (szalonKesz !== undefined) return szalonKesz;
  szalonKesz = null;
  try {
    const b = JSON.parse(fs.readFileSync(path.join(GYOKER, 'uj-oldalak/tartalom/migren-piercing-b.json'), 'utf8'));
    const keres = (n) => (n.t === 'galeria' ? [n] : (n.k || []).flatMap(keres));
    const cimek = (n) => (n.t === 'h' ? [szovegTiszta(n.html || '')] : (n.k || []).flatMap(cimek));
    // a "Budapesten a Jaszainal varunk" szekcio galeriaja (a szalon fotoi)
    for (const sz of b.szekciok) { if (!cimek(sz.fa).some((h) => /várunk/i.test(h))) continue; const g = keres(sz.fa).find((x) => x.kepek.length >= 10); if (g) { szalonKesz = g; break; } }
  } catch { /* marad az eredeti galeria */ }
  return szalonKesz;
}
// egy galeria a szalon-galeria egy (regebbi) valtozata, ha a kepei tobbsege benne van
const szalonValtozat = (n) => { const sz = szalonGaleria(); if (!sz || n.kepek.length < 8) return false; const kepek = new Set(sz.kepek.map((k) => k.src)); return n.kepek.filter((k) => kepek.has(k.src)).length >= Math.min(8, n.kepek.length - 2); };
function galeria(n, c) {
  if (szalonValtozat(n)) n = { ...n, kepek: szalonGaleria().kepek };
  const id = ++c.galeriaSzam;
  const db = n.kepek.length;
  return `<div class="kar" data-kar="${id}"><div class="kar-sav" tabindex="0" aria-label="Képgaléria">${n.kepek.map((k, i) => `<figure class="kar-dia">${k.link ? `<a href="${esc(belso(k.link))}"><img src="${esc(k.src)}" alt="${esc(k.alt)}" loading="${c.kepSzam === 0 && i < 2 ? 'eager' : 'lazy'}" decoding="async"></a>` : `<img src="${esc(k.src)}" alt="${esc(k.alt)}" loading="${c.kepSzam === 0 && i < 2 ? 'eager' : 'lazy'}" decoding="async" data-nagyit data-grp="g${id}">`}${k.felirat || k.leiras ? `<figcaption>${k.felirat ? `<strong>${esc(k.felirat)}</strong>` : ''}${k.leiras ? `<span>${esc(k.leiras)}</span>` : ''}</figcaption>` : ''}</figure>`).join('')}</div>`
    + (db > 1 ? `<button type="button" class="kar-gomb kar-elozo" aria-label="Előző képek" disabled>${IK('chev')}</button><button type="button" class="kar-gomb kar-kov" aria-label="Következő képek">${IK('chev')}</button><p class="kar-szam"><span data-kar-akt>1</span> / ${db}</p>` : '') + '</div>';
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// urlap: a mezok a Wix-urlap szerint; a bekuldes a /api/urlap vegpontra megy (uj-oldalak.js), mint az eredeti oldalon
const KONTROLL_LEHETOSEGEK = ['Kontroll - Meglévő vendégeknek - 0 Ft', 'Konzultáció - Új vendégeknek - 5.000 Ft', 'Garanciális szúrás - 5.000 Ft',
  'Ékszer csere - Nálunk vásárolt ékszerrel - 5.000 Ft', 'Ékszer csere - Hozott ékszerrel - 2.000 Ft', 'Sebkezelés / Tisztítás  - 2.000 Ft'];
function urlap(n, c) {
  const id = 'u' + (++c.urlapSzam);
  // a keresooldal keresomezoje (nincs szerveroldali kereses: az oldal tartalma statikus)
  if (n.mezok.length === 1 && n.mezok[0].tipus === 'search') return `<form class="kereso-urlap" role="search" onsubmit="return false"><div class="mezo"><label class="sr" for="${id}-k">${esc(n.mezok[0].cimke)}</label><input id="${id}-k" type="search" placeholder="${esc(n.mezok[0].cimke)}"></div></form>`;
  const allas = /^\/allasajanlat/.test(c.ut);
  const kontroll = /^\/(regi-)?kontroll$/.test(c.ut);
  const mezok = n.mezok.map((m, i) => {
    const nev = esc(m.cimke || `mező ${i + 1}`);
    const kot = m.kotelezo ? ' required' : '';
    const csillag = m.kotelezo ? ' <span aria-hidden="true">*</span>' : '';
    const fid = `${id}-${i}`;
    if (m.tipus === 'file') return `<div class="mezo mezo-fajl"><label for="${fid}">${nev}</label><input id="${fid}" type="file" name="${nev}" accept="image/*,.pdf,.doc,.docx"><small>Maximum 15 megabyte</small></div>`;
    if (m.tag === 'textarea') return `<div class="mezo mezo-teljes"><label for="${fid}">${nev}${csillag}</label><textarea id="${fid}" name="${nev}" rows="4"${kot}></textarea></div>`;
    const tipus = { email: 'email', tel: 'tel', number: 'number', date: 'date', search: 'search' }[m.tipus] || 'text';
    return `<div class="mezo"><label for="${fid}">${nev}${csillag}</label><input id="${fid}" type="${tipus}" name="${nev}"${tipus === 'tel' ? ' inputmode="tel" autocomplete="tel"' : ''}${tipus === 'email' ? ' autocomplete="email"' : ''}${kot}></div>`;
  });
  if (kontroll) {
    // a "Mire kérsz időpontot?" legördülő a Wix-űrlapon (6 lehetőség); a kinyerő a Wix-legördülőt nem látja
    const hely = Math.min(6, mezok.length);
    const sel = `<div class="mezo mezo-teljes"><label for="${id}-sel">Mire kérsz időpontot? <span aria-hidden="true">*</span></label><select id="${id}-sel" name="Mire kérsz időpontot?" required><option value="">Válassz…</option>${KONTROLL_LEHETOSEGEK.map((o) => `<option>${esc(o)}</option>`).join('')}</select></div>`;
    mezok.splice(hely - 1, 0, sel);
  }
  const felirat = n.kuld || (allas ? 'Elküldöm!' : kontroll ? 'Visszahívást kérek!' : 'Küldés');
  return `<form class="urlap" data-urlap="${allas ? 'allasjelentkezes' : 'urlap'}" data-siker="${allas ? '/allas-ok' : kontroll ? '/kontroll-xyz' : ''}" novalidate>`
    + `<div class="urlap-racs">${mezok.join('')}</div><input type="text" name="bot-field" class="mez-csapda" tabindex="-1" autocomplete="off" aria-hidden="true">`
    + `<div class="gb"><button type="submit" class="gomb gomb-tomor">${esc(felirat)}${IK('chev', 'ik-nyil')}</button></div><p class="urlap-uzenet" role="status" aria-live="polite" hidden></p></form>`;
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// blog
const CSILLAG = IK('star');
const csillagok = (db) => `<span class="csillagok kicsi" role="img" aria-label="${db} csillag az 5-ből">${Array.from({ length: db }, () => CSILLAG).join('')}</span>`;

function cikkTorzs(t, c) {
  switch (t.t) {
    case 'h': { const tag = t.n <= 2 ? 'h2' : 'h3'; return `<${tag}>${szovegLink(t.html)}</${tag}>`; }
    case 'p': return `<p>${szovegLink(t.html)}</p>`;
    case 'idezet': return `<blockquote>${szovegLink(t.html)}</blockquote>`;
    case 'ul': return lista(t);
    // a cikk kepei a szoveg szelessegeben, nagyitas nelkul (a tulajdonos kerese, 2026-10-16); a kis (ikon meretu) kep marad kicsi
    case 'kep': return `<figure class="cikk-kep">${kep({ ...t, w: 0, h: 0 }, c).replace(/ data-nagyit/, '')}</figure>`;
    case 'gomb': return `<div class="gb">${gomb(t.szoveg, t.href, t.kulso)}</div>`;
    case 'iframe': return iframe(t);
    case 'video': return video(t);
    default: return '';
  }
}

function cikk(n, c) {
  c.h1 = true;
  const orig = 'https://www.medicalpiercing.hu' + c.ut;
  const ert = n.ertekeles && n.ertekeles.db ? `<span class="cikk-ert">${csillagok(Math.round(+String(n.ertekeles.atlag).replace(',', '.')))} <span>${esc(n.ertekeles.atlag)} (${n.ertekeles.db} értékelés)</span></span>` : '';
  const hsz = n.hozzaszolasok && n.hozzaszolasok.length
    ? `<ul class="hsz-lista">${n.hozzaszolasok.map((h) => `<li class="hsz"><div class="hsz-fej"><span class="hsz-nev"><span class="hsz-kor" aria-hidden="true">${esc((h.szerzo || '?').trim().charAt(0).toUpperCase())}</span>${esc(h.szerzo)}</span><span class="hsz-datum">${esc(h.datum)}</span>${h.ertek ? csillagok(h.ertek) : ''}</div><p>${szovegLink(h.html)}</p></li>`).join('')}</ul>` : '';
  return `<article class="cikk" data-cikk>
    <header class="cikk-fej">
      <p class="cikk-meta">${[n.datum, n.olvasas].filter(Boolean).map(esc).join(' · ')}${n.frissitve ? ` · <span>${esc(n.frissitve)}</span>` : ''}</p>
      <h1 class="cikk-cim">${esc(n.cim)}</h1>
      ${ert}
    </header>
    ${n.hero ? `<figure class="cikk-kep">${kep({ ...n.hero, w: 0, h: 0 }, c)}</figure>` : ''}
    <div class="cikk-torzs">${n.torzs.map((t) => cikkTorzs(t, c)).join('\n')}</div>
    <div class="cikk-eszkoz" data-megoszt="${esc(orig)}">
      <button type="button" class="kedvel" data-kedvel="${esc(c.ut)}" data-db="${esc(n.kedvelesek || '0')}" aria-pressed="false">${IK('heart')}<span data-kedvel-db>${esc(n.kedvelesek || '0')}</span> kedvelés</button>
      <span class="megoszt-sor"><span class="megoszt-felirat">Megosztás:</span>
        <a class="megoszt" data-m="fb" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(orig)}" target="_blank" rel="noopener" aria-label="Megosztás a Facebookon">${IK('fb')}</a>
        <a class="megoszt" data-m="x" href="https://twitter.com/intent/tweet?url=${encodeURIComponent(orig)}" target="_blank" rel="noopener" aria-label="Megosztás az X-en">X</a>
        <a class="megoszt" data-m="in" href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(orig)}" target="_blank" rel="noopener" aria-label="Megosztás a LinkedIn-en">in</a>
        <button type="button" class="megoszt" data-m="link" aria-label="Link másolása">${IK('link')}</button>
        <button type="button" class="megoszt" data-m="nyomtat" aria-label="Nyomtatás">${IK('print')}</button></span>
    </div>
    <section class="hsz-blokk" aria-labelledby="hsz-cim">
      <h2 id="hsz-cim">Hozzászólások</h2>
      ${hsz}
      <details class="hsz-uj"><summary>Hozzászólás írása…</summary>
        <form class="urlap hsz-urlap" data-urlap="blog-hozzaszolas" data-cim="${esc(n.cim)}" novalidate>
          <div class="urlap-racs"><div class="mezo"><label for="hsz-nev">Felhasználónév <span aria-hidden="true">*</span></label><input id="hsz-nev" name="Felhasználónév" type="text" required autocomplete="name"></div>
          <div class="mezo"><label for="hsz-email">E-mail-cím (nem nyilvános) <span aria-hidden="true">*</span></label><input id="hsz-email" name="E-mail-cím" type="email" required autocomplete="email"></div>
          <div class="mezo mezo-teljes"><label for="hsz-ert">Értékelés</label><select id="hsz-ert" name="Értékelés"><option value="-">–</option><option>1 / 5</option><option>2 / 5</option><option>3 / 5</option><option>4 / 5</option><option>5 / 5</option></select></div>
          <div class="mezo mezo-teljes"><label for="hsz-szoveg">Hozzászólás <span aria-hidden="true">*</span></label><textarea id="hsz-szoveg" name="Hozzászólás" rows="4" required></textarea></div></div>
          <input type="text" name="bot-field" class="mez-csapda" tabindex="-1" autocomplete="off" aria-hidden="true">
          <div class="gb"><button type="submit" class="gomb gomb-tomor">Közzététel</button></div><p class="urlap-uzenet" role="status" aria-live="polite" hidden></p>
        </form>
      </details>
    </section>
  </article>`;
}

function friss(n) {
  return `<section class="friss"><div class="friss-fej"><h2>${esc(n.cim || 'Friss bejegyzések')}</h2>${n.mindHref ? `<a class="szoveg-link" href="${esc(belso(n.mindHref))}">${esc(n.mindSzoveg || 'Az összes megtekintése')}</a>` : ''}</div>
    <div class="poszt-racs poszt-racs-3">${n.elemek.map((p) => `<a class="poszt" href="${esc(belso(p.href))}">${p.kep ? `<img src="${esc(p.kep)}" alt="" loading="lazy" decoding="async">` : ''}<h3>${esc(p.cim)}</h3></a>`).join('')}</div></section>`;
}

const metaTisztit = (m) => String(m || '').replace(/(\d+\.)(\d+ perc olvasás)/, '$1 · $2');
function posztok(n, kereso) {
  const kartya = (p) => {
    const stat = [p.stat, p.kedveles ? `${p.kedveles} kedvelés` : '', p.ertekeles].filter(Boolean).join(' · ');
    return `<a class="poszt" href="${esc(belso(p.href))}" data-szoveg="${esc(`${p.cim} ${p.kivonat}`.toLowerCase())}">${p.kep ? `<img src="${esc(p.kep)}" alt="${esc(p.kepAlt || '')}" loading="lazy" decoding="async">` : ''}<h3>${esc(p.cim)}</h3>${p.kivonat ? `<p>${esc(p.kivonat)}</p>` : ''}<span class="poszt-meta">${esc(metaTisztit(p.meta))}${stat ? `<br>${esc(stat)}` : ''}</span></a>`;
  };
  return `${kereso ? `<div class="poszt-kereso"><label class="mezo"><span class="sr">Keresés a bejegyzések között</span><input type="search" placeholder="Keresés a bejegyzések között…" data-poszt-szuro aria-controls="poszt-lista"></label><p class="kereso-db" data-poszt-db>${n.elemek.length} bejegyzés</p></div>` : ''}
    <div class="poszt-racs" ${kereso ? 'id="poszt-lista"' : ''}>${n.elemek.map(kartya).join('')}</div>`;
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// elrendezes: a kinyert fa (sor / verem / racs / levelek) megjelenitese
function level(n, c) {
  switch (n.t) {
    case 'h': case 'p': return szoveg(n, c);
    case 'ul': return lista(n);
    case 'kep': return kep(n, c);
    case 'gomb': return `<div class="gb">${gomb(n.szoveg, n.href, n.kulso)}</div>`;
    case 'iframe': return iframe(n);
    case 'video': return video(n);
    case 'galeria': return galeria(n, c);
    case 'urlap': return urlap(n, c);
    case 'cikk': return cikk(n, c);
    case 'friss': return friss(n);
    case 'posztok': return posztok(n, n.elemek.length > 6);
    case 'cimke': return `<span class="cimke">${esc(n.szoveg)}</span>`;
    default: return '';
  }
}

const szovegesLevelek = (n) => (n.k ? n.k.flatMap(szovegesLevelek) : [n]);
const kozepes = (n) => { const ls = (n.k || [n]).filter((x) => x.t === 'h' || x.t === 'p'); return ls.length > 0 && ls.filter((x) => x.kozep).length * 2 >= ls.length; };

const szovegHossz = (n) => (n.k ? n.k.reduce((a, x) => a + szovegHossz(x), 0) : n.html ? szovegTiszta(n.html).length : n.elemek && Array.isArray(n.elemek) && typeof n.elemek[0] === 'string' ? n.elemek.reduce((a, x) => a + szovegTiszta(x).length, 0) : n.szoveg ? n.szoveg.length : 0);

function media(kepN, masik, kepElol, c, opciok = {}) {
  // a 93%-os statisztika (kep + "93%" + mondat + gomb + jegyzet): a kozos doboz, mint a kategoria-oldalakon (tools/uj-oldalak/kozos.mjs)
  if (kepN.t === 'kep' && masik.t === 'verem') {
    const ps = masik.k.filter((x) => x.t === 'p');
    if (ps[0] && /^\d{2,3}\s*%$/.test(szovegTiszta(ps[0].html))) {
      return statDoboz({ kep: kepN.src, alt: '', szam: szovegTiszta(ps[0].html), mondat: ps[1] ? ps[1].html : '', lab: ps.slice(2).map((x) => x.html) });
    }
  }
  // a masik oszlop cime kiemelhetos: mobilon cim, kep, szoveg sorrend
  let cim = '', szovegN = masik;
  if (!opciok.nincsCim && masik.t === 'verem' && masik.k[0] && masik.k[0].t === 'h' && masik.k.length > 1) {
    cim = level(masik.k[0], c);
    const marad = masik.k.slice(1);
    szovegN = marad.length === 1 ? marad[0] : { t: 'verem', k: marad };
  } else if (!opciok.nincsCim && masik.t === 'h') { cim = level(masik, c); szovegN = null; }
  const kozep = kozepes(masik);
  // rovid szoveg + kep (pl. a 93%-os statisztika): mobilon is egymas mellett marad (kevesebb hely)
  const rovid = !cim && kepN.t === 'kep' && szovegHossz(masik) < 520;
  return `<div class="ksz${kepElol ? '' : ' ksz-jobb'}${cim ? ' van-cim' : ''}${kozep ? ' ksz-kozep' : ''}${kepN.t !== 'kep' ? ' ksz-nagy' : ''}${rovid ? ' ksz-rovid' : ''}">${cim ? `<div class="ksz-cim">${cim}</div>` : ''}<div class="ksz-kep">${csomopont(kepN, c)}</div>${szovegN ? `<div class="ksz-szoveg">${csomopont(szovegN, c)}</div>` : ''}</div>`;
}

function sor(n, c, kartya) {
  const k = n.k;
  const med = k.filter(mediaLevel);
  const nemMed = k.filter((x) => !mediaLevel(x));
  // egy kep / video / galeria + egy szoveges oszlop: "media" elrendezes
  if (k.length === 2 && med.length === 1 && nemMed.length === 1 && nemMed[0].t !== 'kep') {
    return media(med[0], nemMed[0], k[0] === med[0], c, { nincsCim: kartya });
  }
  // kepek sora (logok, ket kep egymas mellett)
  if (k.length >= 2 && k.every((x) => x.t === 'kep' || (x.t === 'verem' && x.k.every((y) => y.t === 'kep')))) {
    return `<div class="kepsor kepsor-${Math.min(k.length, 6)}">${k.map((x) => `<div class="kepsor-elem">${csomopont(x, c)}</div>`).join('')}</div>`;
  }
  // ikon + szoveg
  if (k.length === 2 && k[0].t === 'kep' && ikonMeret(k[0])) {
    return `<div class="ikonos">${kep(k[0], c)}<div>${csomopont(k[1], c)}</div></div>`;
  }
  const kartyas = k.length >= 2 && k.every((x) => x.t === 'verem' && x.k.length >= 2);
  return `<div class="oszlopok o-${Math.min(k.length, 6)}${kartyas ? ' kartyas' : ''}">${k.map((x) => `<div class="oszlop${kozepes(x) ? ' kozepes' : ''}">${csomopont(x, c)}</div>`).join('')}</div>`;
}

// a racs oszlopszama: a kartyak szama szerint egyenletes sorok (5 -> 5, 6 -> 3 x 2, 8 -> 4 x 2, 10 -> 5 x 2 ...)
const oszlopSzam = (k) => `racs-c${k <= 5 ? Math.max(k, 1) : k % 5 === 0 ? 5 : k % 4 === 0 ? 4 : k % 3 === 0 ? 3 : 4}`;

function csomopont(n, c, kartya = false) {
  switch (n.t) {
    case 'verem':
      // borito kep + video ugyanazon a helyen (a Wix igy menti): egy video, a kep a posztere
      if (n.k.length === 2 && n.k[0].t === 'kep' && n.k[1].t === 'video' && (boritoKep(n.k[1].src) === n.k[0].src || (n.k[0].y === n.k[1].y && n.k[0].x === n.k[1].x && n.k[0].y !== undefined))) return video({ ...n.k[1], poster: n.k[0].src, w: n.k[0].nw, h: n.k[0].nh });
      return `<div class="verem${kozepes(n) ? ' kozepes' : ''}">${n.k.map((x) => csomopont(x, c)).join('')}</div>`;
    case 'sor': return sor(n, c, kartya);
    case 'racs': return `<div class="racs ${oszlopSzam(n.k.length)}${n.k[0] && n.k[0].t === 'sor' ? ' racs-sor' : ''}">${n.k.map((x) => `<div class="kt${x.t === 'sor' ? ' kt-sor' : ''}${kozepes(x) ? ' kozepes' : ''}">${csomopont(x, c, true)}</div>`).join('')}</div>`;
    default: return level(n, c);
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------
const szinesHatter = (bg) => {
  const m = String(bg || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!m) return false;
  const a = m[4] === undefined ? 1 : +m[4];
  return a > 0.2 && !(+m[1] > 250 && +m[2] > 250 && +m[3] > 250);
};

// --- a "Legnepszerubb piercingeink" racsok (piercing-tipus kartyak): mindenhol a fooldal doboza (uj-oldalak/reszek/piercingek.html), a tulajdonos kerese 2026-10-16 ---
const PIERCING_NEV = /^(Migrén|Fejfájás|Shenmen|Kl[ií]max|Slim|Allergia|Máj|Lép|Vastagbél|Pajzsmirigy|Divat fül)\s*piercing$/i;
const leveleik = (n) => (n.k ? n.k.flatMap(leveleik) : [n]);
// legalabb 3 kartya, mindegyikben piercing-nev es panasz-lista
export const piercingRacs = (n) => !!n && n.t === 'racs' && n.k.length >= 3 && n.k.filter((x) => { const l = leveleik(x); return l.some((y) => (y.t === 'p' || y.t === 'h') && PIERCING_NEV.test(szovegTiszta(y.html || ''))) && l.some((y) => y.t === 'ul'); }).length >= 3;
// a racs feletti cim / alcim (helyettuk a fooldali doboz cime jelenik meg)
export const piercingCim = (n) => !!n && (n.t === 'h' || n.t === 'p') && /legnépszerűbb piercing|vendégeink többsége az alábbi/i.test(szovegTiszta(n.html || ''));
// a racs helye egy gyereklistaban: [tol, ig) a felette levo cimekkel egyutt
const piercingHely = (k) => { const r = k.findIndex(piercingRacs); if (r < 0) return null; let tol = r; while (tol > 0 && piercingCim(k[tol - 1])) tol--; return [tol, r + 1]; };
// a lecserelt / kihagyott szovegek (piercing-racs, "9 ok" csuszka): a tukor-teszt szoveg-lefedettsegi ellenorzese ezeket nem varja el
export function piercingCserelt(adat) {
  const ki = [];
  const bejar = (n) => {
    if (!n || !n.k) return;
    const h = piercingHely(n.k);
    if (h) for (const l of n.k.slice(h[0], h[1]).flatMap(leveleik)) {
      if (l.t === 'h' || l.t === 'p') ki.push(szovegTiszta(l.html || ''));
      else if (l.t === 'ul') ki.push(...l.elemek.map((e) => szovegTiszta(e)));
      else if (l.t === 'gomb') ki.push(l.szoveg);
    }
    n.k.forEach(bejar);
  };
  (adat.szekciok || []).forEach((s) => {
    if (kilencOk(s)) { for (const l of leveleik(s.fa)) if (l.t === 'h' || l.t === 'p') ki.push(szovegTiszta(l.html || '')); return; }
    bejar(s.fa);
  });
  return ki.filter(Boolean);
}

// a "9 ok, amiert minket valassz" csuszka (a Wixen lapozhato, a tartalomban csak az elso oka van meg): kimarad, mint a B oldalakon (a tulajdonos kerese, 2026-10-16)
const kilencOk = (s) => { const l = leveleik(s.fa); const h = l.find((x) => x.t === 'h'); return !!h && /^\d+ ok, amiért minket válassz/i.test(szovegTiszta(h.html || '')) && l.length <= 6; };

function szekcio(s, i, c) {
  if (kilencOk(s)) return '';
  const horg = (s.horgonyok || []).filter((h) => /^[A-Za-z0-9_-]+$/.test(h) && !/^(bgLayers|pro-gallery|comp-)/.test(h)).map((h) => `<span id="${esc(h)}" class="horgony"></span>`).join('');
  // a piercing-racs a szekcio legfelso (vagy egyetlen beagyazott) verembol: elotte / utana kulon szekcio, kozte a fooldali doboz
  const ver = s.fa.t === 'verem' && s.fa.k.length === 1 && s.fa.k[0].t === 'verem' ? s.fa.k[0] : s.fa;
  const ph = ver.t === 'verem' ? piercingHely(ver.k) : piercingRacs(ver) ? [0, 1] : null;
  if (ph) {
    const k = ver.t === 'verem' ? ver.k : [ver];
    const resz = (kk) => (kk.length ? szekcio({ ...s, horgonyok: [], fa: { ...ver, t: 'verem', k: kk } }, i, c) : '');
    return [horg, resz(k.slice(0, ph[0])), '<!--#piercingek-->', resz(k.slice(ph[1]))].filter(Boolean).join('\n');
  }
  const cikkSz = JSON.stringify(s.fa).includes('"t":"cikk"');
  return `<section class="sz${szinesHatter(s.bgSzin) ? ' sz-szines' : ''}${i === 0 ? ' sz-elso' : ''}${cikkSz ? ' sz-cikk' : ''}">${horg}<div class="tarto">${csomopont(s.fa, c)}</div></section>`;
}

// az egyes oldaltipusok kiegeszitoi: varosoldal lapozo
function lapozo(c, lapozoAdat) {
  if (!/^\/varosok\//.test(c.ut) || !lapozoAdat) return '';
  const enk = (ut) => (ut ? '/varosok/' + encodeURIComponent(ut.slice('/varosok/'.length)) : ut);
  const a = lapozoAdat[c.ut] || {};
  const lk = (ut, szoveg, irany) => (ut ? `<a class="gomb gomb-ures lapozo-${irany}" href="${esc(ut)}" rel="${irany === 'elozo' ? 'prev' : 'next'}">${irany === 'elozo' ? IK('chev', 'ik-vissza') + szoveg : szoveg + IK('chev', 'ik-nyil')}</a>` : '');
  const e = lk(enk(a.elozo), 'Előző helyszín', 'elozo'), k = lk(enk(a.kovetkezo), 'Következő helyszín', 'kov');
  return e || k ? `<nav class="lapozo" aria-label="Helyszínek között">${e}${k}</nav>` : '';
}

const partial = (ROOT, nev, horgony) => {
  let h = fs.readFileSync(path.join(ROOT, 'uj-oldalak/reszek', nev + '.html'), 'utf8').trimEnd();
  // a fooldal horgonyai (#arak, #csapat ...) a belso oldalakon az uj fooldalra mutatnak; ami az oldalon is megvan (a "horgony" halmaz), az helyben marad
  if (horgony) h = h.replace(/href="#([a-z]+)"/g, (m, id) => (horgony instanceof Set && horgony.has(id) ? m : `href="/uj-fooldal#${id}"`));
  return h;
};

// a kategoria-sablon (kategoria.mjs) ezeket a kozos reszeket kapja
const KOZOS = { esc, IK, szovegLink, szovegTiszta, belso, csakLink, iframe, csomopont, partial, piercingRacs, piercingCim, szalonGaleria, JO_VELEMENY_KULCSOK };

// ---------------------------------------------------------------------------------------------------------------------------------------
// a piercing-oldalakrol a regi, mar nem frissitett oldalakra mutato linkek lekerulnek (a szoveg marad), a tulajdonos kerese 2026-10-16;
// a regi "3 piercing 2 araert" akcio helyett a mostani oszi akcio (ugyanaz, mint a menuben es az akcios savban)
const REGI_OLDALAK = /^\/(?:migren|fejfajas)$/;
function regiLinkLe(html) {
  return html
    .replace(/<a\b[^>]*\shref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g, (m, h, t) => (REGI_OLDALAK.test(h.split(/[?#]/)[0]) ? t : m))
    .replace(/<a\b[^>]*\shref="\/3-piercing-2-araert(?:-2)?"[^>]*>3 piercing 2 áráért! - AKCIÓ!<\/a>/g, '<a href="/3-piercing-2-araert-regi">Őszi akció »</a>');
}

// az uj oldalakon nem szereplo regi oldalak (a tulajdonos kerese, 2026-10-16: aranyrol nincs szoveg): nincs /uj valtozatuk, a blogban sincs kartyajuk
export const KIZART_UTAK = new Set(['/szurathatok-arany-shenmen-piercinget-is']);

// --- a blog-oldal (/blog): kepes kartyak, 12-esevel lapozva (uj-oldalak.js), felul csak a cim (a tulajdonos kerese, 2026-10-16) ---
// a kartya kepe: a regi oldal galeriajabol a cikk cime szerint, ha ott nincs, a cikk sajat elso nagy kepe
function blogFo(ROOT, adat) {
  const lv = laposit(adat.szekciok.map((sz) => sz.fa));
  const gal = lv.find((x) => x.t === 'galeria');
  const lista = lv.find((x) => x.t === 'posztok');
  if (!lista) return null;
  const kepek = new Map((gal ? gal.kepek : []).map((k) => [String(k.alt || '').trim(), k.src]));
  const sajatKep = (href) => {
    try {
      const a = JSON.parse(fs.readFileSync(path.join(ROOT, 'uj-oldalak/tartalom', href.replace(/^\//, '').replace(/\//g, '__') + '.json'), 'utf8'));
      const k = laposit(a.szekciok.map((sz) => sz.fa)).find((x) => x.t === 'kep' && (x.nw || 0) >= 400);
      return k ? k.src : '';
    } catch { return ''; }
  };
  const kartya = (p, i) => {
    const kep = p.kep || kepek.get(String(p.cim).trim()) || sajatKep(p.href);
    const meta = metaTisztit(p.meta);
    return `<li class="blog-kartya"><a href="${esc(belso(p.href))}">
      <span class="blog-kep">${kep ? `<img src="${esc(kep)}" alt="" loading="lazy" decoding="async">` : ''}</span>
      <span class="blog-test">${meta ? `<span class="blog-meta">${esc(meta)}</span>` : ''}<b>${esc(p.cim)}</b>${p.kivonat ? `<span class="blog-kivonat">${esc(p.kivonat)}</span>` : ''}<span class="blog-tovabb">Tovább olvasom »</span></span>
    </a></li>`;
  };
  return `<section class="tarto blog-fej"><h1>Blog</h1></section>
  <section class="tarto blog-lista">
    <ul class="blog-racs" data-blog-racs>${lista.elemek.filter((p) => !KIZART_UTAK.has(p.href)).map(kartya).join('')}</ul>
    <nav class="blog-lapozo" data-blog-lapozo aria-label="Blog-oldalak"></nav>
  </section>`;
}
const laposit = (n, ki = []) => { if (Array.isArray(n)) n.forEach((x) => laposit(x, ki)); else if (n && n.k) { ki.push(n); n.k.forEach((x) => laposit(x, ki)); } else if (n) ki.push(n); return ki; };

export function oldalHtml(ROOT, adat, opciok = {}) {
  const c = ujKontextus(adat, opciok);
  // a kategoria-oldalak (migren / shenmen / klimax / slim) a fooldal stilusaban, a fooldal dobozaival (kategoria.mjs)
  const kat = opciok.fo === undefined && adat.tipus === 'oldal' ? kategoriaFo(ROOT, adat, c, KOZOS, { b: !!opciok.b }) : null;
  if (kat) kat.html = regiLinkLe(kat.html);
  const blog = !kat && opciok.fo === undefined && adat.ut === '/blog' ? blogFo(ROOT, adat) : null;
  let szekciok = kat ? kat.html : blog || (opciok.fo !== undefined ? opciok.fo : adat.szekciok.map((s, i) => szekcio(s, i, c)).join('\n'));
  if (!/<h1[\s>]/.test(szekciok)) szekciok = `<h1 class="sr">${esc(adat.cim)}</h1>\n` + szekciok;   // az oldalnak mindig van h1-e (a lathato cim hianyaban rejtett)
  // a rovid hos-cim (legfeljebb 34 betu) mobilon egy sorban (a tulajdonos kerese, 2026-10-16; uj-egyseges.css: .cim-rovid)
  szekciok = szekciok.replace(/<h1 class="hos-cim">([\s\S]*?)<\/h1>/, (m, b) => (b.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').trim().length <= 34 ? `<h1 class="hos-cim cim-rovid">${b}</h1>` : m));
  // a kezzel irt oldalak (uj-oldalak/sajat/*.html: csapatunk, kapcsolat, ekszereink) a kategoria-oldalak szelessegevel es dobozaival
  const sajat = !!opciok.sajat;
  const cimke = adat.tipus === 'cikk' ? 'oldal-cikk' : adat.tipus === 'blog' ? 'oldal-blog' : kat ? 'oldal-altalanos oldal-kategoria' : sajat ? 'oldal-altalanos oldal-kategoria oldal-sajat' : 'oldal-altalanos';
  const horgony = kat ? kat.helyiIdk : opciok.horgony || true;
  // hirdetesi landolo (a TikTok-landolo, a tulajdonos kerese, 2026-10-16: "nem lehet sehol sem ... semmi olyasmi kifejezes, ami orvosi"): sajat, rovid fejlec
  // (logo jelmondat nelkul, Velemenyek, Idopontfoglalas - mint az eredeti landolon), akcios sav a lap arlistajahoz, lablec a panasz- es orvosi szavak nelkul
  const landolo = !!opciok.landolo;
  // a B-valtozatok (/b/<ut>, uj-fooldal.mjs): az elso soruk megadhat sajat akcios savot / lablecet (a PDF szerint: a kozerzetjavito oldalakon az uj savszoveg,
  // a paros oldalon paros sav, a fulpiercing-oldalon nincs sav, sajat lablec), es sajat stiluslapot kapnak (assets/css/uj-b.css, utolsokent)
  const fejlecResz = opciok.fejlec || (landolo ? 'fejlec-landolo' : 'fejlec');
  const savResz = opciok.akciosav === 'nincs' ? null : (opciok.akciosav || (landolo ? 'akcio-sav-landolo' : 'akcio-sav'));
  const lablecResz = opciok.lablec || (landolo ? 'lablec-landolo' : 'lablec');
  return `<!doctype html>
<html lang="hu">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(adat.cim)}</title>
<meta name="description" content="${esc(adat.leiras)}">
<!-- Rejtett próbaoldal (az eredeti oldal új stílusú tükre): nincs a sitemapben, a keresők nem indexelhetik. A canonical szándékosan hiányzik. -->
<meta name="robots" content="noindex,nofollow">
<meta name="format-detection" content="telephone=no">
<link rel="icon" href="/assets/img/f18724_498d7cc07634442b9dd7173669038c57.png" type="image/png">
<link rel="apple-touch-icon" href="/assets/img/f18724_498d7cc07634442b9dd7173669038c57.png">
<link rel="preload" as="font" type="font/woff2" crossorigin href="/assets/fonts/plus-jakarta-sans-latin.woff2">
<link rel="preload" as="font" type="font/woff2" crossorigin href="/assets/fonts/plus-jakarta-sans-latin-ext.woff2">
<script src="/assets/js/suti.js"></script>
<link rel="stylesheet" href="/assets/css/uj-fooldal.css">
<link rel="stylesheet" href="/assets/css/uj-oldalak.css">${kat || sajat ? '\n<link rel="stylesheet" href="/assets/css/uj-kategoria.css">' : ''}${sajat ? '\n<link rel="stylesheet" href="/assets/css/uj-sajat.css">' : ''}
<link rel="stylesheet" href="/assets/css/uj-egyseges.css">${opciok.b2 ? '\n<link rel="stylesheet" href="/assets/css/uj-b.css">' : ''}
</head>
<body class="belso ${cimke}${landolo ? ' oldal-landolo' : ''}${opciok.b2 ? ' oldal-b2' : ''}">
<a class="ugras" href="#fo">Ugrás a tartalomra</a>

<!--#ikonok-->

${partial(ROOT, fejlecResz, horgony)}

${savResz ? partial(ROOT, savResz) : ''}

<main id="fo">
${szekciok}
${lapozo(c, opciok.lapozo)}
</main>

${partial(ROOT, lablecResz, horgony)}

<dialog class="nagyito" id="kepnezo" aria-label="Kép nagyban">
  <button type="button" class="nagyito-zar" aria-label="Bezárás">${IK('close')}</button>
  <button type="button" class="galeria-gomb nagyito-elozo" aria-label="Előző kép">${IK('chev')}</button>
  <img class="nagyito-kep" alt="">
  <button type="button" class="galeria-gomb nagyito-kov" aria-label="Következő kép">${IK('chev')}</button>
  <p class="galeria-szamlalo nagyito-szam"><span data-n>1</span> / <span data-ossz>1</span></p>
</dialog>
<dialog class="videoablak" id="videoablak" aria-label="Videó">
  <button type="button" class="videoablak-zar" aria-label="Bezárás">${IK('close')}</button>
  <div class="videoablak-keret"></div>
</dialog>
${(kat && kat.nagyito) || opciok.nagyito ? '<!--#ekszer-nagyito-->\n' : ''}
<script src="/assets/js/uj-fooldal.js" defer></script>
<script src="/assets/js/uj-oldalak.js" defer></script>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// az oldalak jegyzeke: csoportok (a link-index oldalhoz)
export function csoport(o) {
  const ut = o.ut;
  if (ut === '/' || /^\/(home2?|fooldal-b)$/.test(ut)) return '1. Főoldal és változatai';
  if (/^\/varosok\//.test(ut)) return '4. Helyszínek (városoldalak)';
  if (/^\/piercer-/.test(ut)) return '5. Piercerek';
  if (/^\/allasajanlat/.test(ut)) return '7. Állásajánlatok';
  if (/^\/(foglalas-ok|fulbevalo-ok|kerdoiv-ok)|-ok\d*$|-xyz$|^\/(koszon|koszi|thank)/.test(ut)) return '11. Köszönőoldalak (foglalás / űrlap után)';
  if (o.tipus === 'cikk') return '9. Blogcikkek';
  if (o.tipus === 'blog') return '8. Blog';
  if (/^\/(adatkezeles|aszf|nyeremenyjatek|impresszum)/.test(ut)) return '10. Jogi oldalak és nyereményjáték';
  if (/^\/(event-details-registration|fullscreen-page|schedule-1|search)$/.test(ut)) return '12. Egyéb (Wix-sablon maradványok)';
  if (/piercing|ekszer|szuras|migren|shenmen|klimax|slim|allergia|maj|lep|vastagbel|pajzsmirigy|ful-|akupunktura|kontroll-es|garancia|arlista|araert|fejfajas/.test(ut)) return '3. Piercingek, árak, garancia';
  return '2. Fő oldalak';
}

export function indexHtml(ROOT, lista, meta = {}) {
  const csoportok = new Map();
  for (const o of lista) { const g = csoport(o); if (!csoportok.has(g)) csoportok.set(g, []); csoportok.get(g).push(o); }
  const rendez = [...csoportok.entries()].sort((a, b) => a[0].localeCompare(b[0], 'hu', { numeric: true }));
  const sorok = rendez.map(([g, ls]) => `<section class="idx-csoport"><h2>${esc(g.replace(/^\d+\.\s*/, ''))} <span class="idx-db">${ls.length}</span></h2>
    <ul class="idx-lista">${ls.sort((a, b) => a.ut.localeCompare(b.ut, 'hu')).map((o) => `<li data-szoveg="${esc((o.cim + ' ' + o.ut).toLowerCase())}"><a class="idx-uj" href="${esc(o.uj)}">${esc(o.cim || o.ut)}</a><span class="idx-ut">${esc(o.ut)}</span><a class="idx-regi" href="${esc(o.regi || o.ut)}" aria-label="Az eredeti oldal: ${esc(o.cim || o.ut)}">eredeti</a></li>`).join('')}</ul></section>`).join('\n');
  const adat = { cim: 'Új oldalak – áttekintés', leiras: 'Az összes oldal új stílusú, rejtett változata.', tipus: 'oldal', ut: '/uj-oldalak', kulcs: 'uj-oldalak', szekciok: [] };
  const tartalom = `<section class="sz sz-elso"><div class="tarto idx">
    <h1 class="cim">Új oldalak – áttekintés</h1>
    <p>Az eredeti oldalak új stílusú, rejtett változatai (${lista.length} oldal). A tartalmuk megegyezik az eredetivel; csak a megjelenés új. Egy sorban: az új oldal, az eredeti címe, és az „eredeti" link az élő oldalra. Az új oldalak nem indexelhetők, és nincsenek a sitemapben.${meta.datum ? ` Utolsó összerakás: ${esc(meta.datum)}.` : ''}</p>
    <p><a class="gomb gomb-tomor" href="/uj-fooldal">Új főoldal ${IK('chev', 'ik-nyil')}</a></p>
    <div class="poszt-kereso"><label class="mezo"><span class="sr">Keresés az oldalak között</span><input type="search" placeholder="Keresés az oldalak között…" data-idx-szuro></label><p class="kereso-db" data-idx-db>${lista.length} oldal</p></div>
    ${sorok}
  </div></section>`;
  return oldalHtml(ROOT, adat, { fo: tartalom });
}
