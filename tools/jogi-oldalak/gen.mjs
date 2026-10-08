// A regi (Wixes) info-oldalak ujrastilusa, a TARTALOM valtoztatasa nelkul: aszf, impresszum, suti-tajekoztato, blog.
// Forras: a regi oldal HTML-je (klon/<nev>.html: az eredeti klon-fajl a csere utan is megmarad): a szovegblokk(ok) a regi HTML-bol
// kerulnek ki, a kinyero (tools/ujrastilus/folyam.mjs) helyett: a hosszu jogi szovegeknel a Wix-szoveg inline linkjei (pl. az ASZF 6.2 pontja) a folyam-kinyeronel
// kiesnek, a HTML-ben viszont minden megvan.
//
//   node tools/jogi-oldalak/gen.mjs        ->  foglalas/{aszf,impresszum,suti-tajekoztato,blog}.html
//
// A kezi szerkesztes megengedett, de az ujrafuttatas felulirja a kimeneti fajlokat.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const GYOKER = path.resolve(import.meta.dirname, '..', '..');
const BAZIS = 'https://www.mosaicheadspa.hu';
// a regi (Wixes) oldal: az eredeti klon-fajl a csere utan is megmarad (a foglalas/<nev>.html csak a buildben irja felul)
const regiFajl = (nev) => path.join(GYOKER, 'klon', nev + '.html');

// --- minimalis HTML-elemzo ---------------------------------------------------------------------------------------------------------------------------------
const ENT = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", ndash: '–', mdash: '—', hellip: '…', bull: '•', middot: '·', laquo: '«', raquo: '»', euro: '€',
  aacute: 'á', Aacute: 'Á', eacute: 'é', Eacute: 'É', iacute: 'í', Iacute: 'Í', oacute: 'ó', Oacute: 'Ó', ouml: 'ö', Ouml: 'Ö', odblac: 'ő', Odblac: 'Ő', uacute: 'ú', Uacute: 'Ú',
  uuml: 'ü', Uuml: 'Ü', udblac: 'ű', Udblac: 'Ű', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', bdquo: '„', copy: '©', shy: '' };
export const dekod = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, e) => {
  if (e[0] === '#') { try { return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)); } catch { return m; } }
  return Object.prototype.hasOwnProperty.call(ENT, e) ? ENT[e] : m;
});
const VOID = new Set(['br', 'img', 'input', 'hr', 'meta', 'link', 'wbr', 'source', 'path', 'circle', 'rect', 'use', 'line', 'polyline', 'polygon', 'area', 'col', 'embed', 'param', 'track']);
export function elemez(html) {
  html = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>|<!--[\s\S]*?-->/gi, '');
  const gyoker = { t: 'el', tag: '#', attrs: {}, kids: [] };
  const verem = [gyoker];
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>|([^<]+|<)/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[5] !== undefined) { verem[verem.length - 1].kids.push({ t: 'tx', s: dekod(m[5]) }); continue; }
    const zaro = m[1] === '/'; const tag = m[2].toLowerCase();
    if (zaro) {
      for (let i = verem.length - 1; i > 0; i--) if (verem[i].tag === tag) { verem.length = i; break; }
      continue;
    }
    const attrs = {};
    for (const a of m[3].matchAll(/([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) attrs[a[1].toLowerCase()] = dekod(a[2] ?? a[3] ?? a[4] ?? '');
    const el = { t: 'el', tag, attrs, kids: [] };
    verem[verem.length - 1].kids.push(el);
    if (!VOID.has(tag) && m[4] !== '/') verem.push(el);
  }
  return gyoker;
}
export const keres = (n, f, ki = []) => { if (n.t === 'el') { if (f(n)) ki.push(n); for (const k of n.kids) keres(k, f, ki); } return ki; };
export const szoveg = (n) => (n.t === 'tx' ? n.s : n.kids.map(szoveg).join(''));
export const tisztSzoveg = (s) => s.replace(/[​﻿]/g, '').replace(/\s+/g, ' ').trim();

// --- Wix rich-text -> egyszeru HTML ------------------------------------------------------------------------------------------------------------------------
export const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const attr = (s) => esc(s).replace(/"/g, '&quot;');
export function stilus(n) { const s = n.attrs.style || ''; return { felkover: /font-weight:\s*(bold|[6-9]00)/i.test(s), dolt: /font-style:\s*italic/i.test(s), alahuzott: /text-decoration:[^;]*underline/i.test(s), rejtett: /display:\s*none/i.test(s) }; }
export function belso(n) { return n.kids.map(inline).join(''); }
export function inline(n) {
  if (n.t === 'tx') return esc(n.s.replace(/[​﻿]/g, ''));
  const g = n.tag;
  if (g === 'br') return '<br>';
  if (g === 'img' || g === 'svg' || g === 'input' || g === 'button') return '';
  const st = stilus(n);
  if (st.rejtett) return '';
  let h = belso(n);
  if (!tisztSzoveg(szoveg(n)) && !/<br>/.test(h)) return h.trim() ? h : '';
  if (g === 'a' && n.attrs.href) { const kulso = /^https?:\/\/(?!(?:www\.)?mosaicheadspa\.hu)/i.test(n.attrs.href); h = `<a href="${attr(n.attrs.href)}"${kulso ? ' target="_blank" rel="noopener"' : ''}>${h}</a>`; }
  if (g === 'strong' || g === 'b' || st.felkover) h = `<b>${h}</b>`;
  if (g === 'em' || g === 'i' || st.dolt) h = `<i>${h}</i>`;
  if (g === 'u' || st.alahuzott) h = `<u>${h}</u>`;
  return h;
}
// blokkok: [{ t: 'h2'|'h3'|'h4'|'p'|'ul'|'ol', html, szoveg }]
export function blokkok(n, ki = []) {
  for (const k of n.kids) {
    if (k.t !== 'el') continue;
    const g = k.tag;
    if (/^h[1-6]$/.test(g) || g === 'p') {
      const h = belso(k).replace(/^(?:\s|&nbsp;|<br>)+|(?:\s|&nbsp;|<br>)+$/g, '').trim();
      const sz = tisztSzoveg(szoveg(k));
      if (sz) ki.push({ t: g, html: h, szoveg: sz });
    } else if (g === 'ul' || g === 'ol') {
      const li = k.kids.filter((x) => x.t === 'el' && x.tag === 'li').map((x) => ({ html: belso(x).trim(), szoveg: tisztSzoveg(szoveg(x)) })).filter((x) => x.szoveg);
      if (li.length) ki.push({ t: g, li });
    } else blokkok(k, ki);
  }
  return ki;
}

// a jogi szovegek ("1. Szolgaltatas", "3.9. Ajandekutalvany hasznalat") szamozott cimsorai, a "- ..." felsorolasok
export function szerkeszt(bl) {
  const ki = [];
  for (let i = 0; i < bl.length; i++) {
    const b = bl[i];
    if (b.t === 'p' && /^-\s+/.test(b.szoveg)) {
      const li = [];
      while (i < bl.length && bl[i].t === 'p' && /^-\s+/.test(bl[i].szoveg)) { li.push({ html: bl[i].html.replace(/^-\s+/, ''), szoveg: bl[i].szoveg }); i++; }
      i--; ki.push({ t: 'ul', li }); continue;
    }
    if (b.t === 'p' && /^\d+\.\s+\S/.test(b.szoveg) && b.szoveg.length <= 48 && !/[.!?]$/.test(b.szoveg)) { ki.push({ ...b, t: 'h2' }); continue; }
    if (b.t === 'p' && /^\d+\.\d+\.?\s+\S/.test(b.szoveg) && b.szoveg.length <= 48 && !/[.!?]$/.test(b.szoveg)) { ki.push({ ...b, t: 'h3' }); continue; }
    ki.push(b);
  }
  return ki;
}
export const blokkHtml = (bl, beh = '      ') => bl.map((b) => {
  if (b.t === 'ul' || b.t === 'ol') return `${beh}<${b.t} class="jo-lista">\n${b.li.map((l) => `${beh}  <li>${l.html}</li>`).join('\n')}\n${beh}</${b.t}>`;
  const t = b.t === 'h1' ? 'h2' : b.t;   // a regi oldal cime lesz az egyetlen H1
  return `${beh}<${t}>${b.html}</${t}>`;
}).join('\n');

// --- oldal-vaz ---------------------------------------------------------------------------------------------------------------------------------------------
function meta(nev) {
  const regi = fs.readFileSync(regiFajl(nev), 'utf8');
  const g = (re) => { const m = re.exec(regi); if (!m) throw new Error(nev + ': nincs meta: ' + re); return m[1]; };
  const robots = /<meta name="robots" content="([^"]*)"/.exec(regi);
  return { title: g(/<title>([^<]*)<\/title>/), desc: (/<meta name="description" content="([^"]*)"/.exec(regi) || [, ''])[1], canonical: g(/<link rel="canonical" href="([^"]*)"/), ogkep: (/<meta property="og:image" content="([^"]*)"/.exec(regi) || [, ''])[1], robots: robots ? robots[1] : '' };
}
function oldal(nev, torzs, forras) {
  const m = meta(nev);
  const ut = '/' + decodeURIComponent(m.canonical.replace(BAZIS + '/', ''));
  return `<!DOCTYPE html>
<html lang="hu">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${m.title}</title>
${m.desc ? `<meta name="description" content="${m.desc}">\n` : ''}${m.robots ? `<meta name="robots" content="${m.robots}">\n` : ''}<link rel="canonical" href="${m.canonical}">
<meta property="og:title" content="${m.title}">
${m.desc ? `<meta property="og:description" content="${m.desc}">\n` : ''}${m.ogkep ? `<meta property="og:image" content="${m.ogkep}">\n` : ''}<meta property="og:url" content="${m.canonical}">
<meta property="og:site_name" content="MOSAIC Headspa">
<meta property="og:type" content="website">
<link rel="icon" href="/assets/img/c2eb0f_b001e2c55098446da3e38ff055e20354.png" type="image/png">
<link rel="preload" href="/assets/fonts/playfair-display-500-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/css/wix-google-fonts.css">
<link rel="stylesheet" href="/assets/css/wix-fonts.css">
<link rel="stylesheet" href="/assets/css/headspa-oldal.css">
<link rel="stylesheet" href="/assets/css/jogi-oldalak.css">
<script src="/assets/js/suti.js"></script>
</head>
<body>
<!--
  MOSAIC info-oldal (${nev}) - UJ szerkezet (a Head Spa oldalak stilusaban). A tartalom a regi (Wixes) oldal tartalma: a szovegek, linkek, adatok valtozatlanok; a regi oldal
  hibait / ellentmondasait NEM javitottuk (lasd a PR "Eszrevetelek"). A regi, Wixes valtozat rejtett cimen: /${nev}-regi (noindex). A fajl a tools/jogi-oldalak/gen.mjs kimenete
  (forras: ${forras}); kezi szerkesztes megengedett, de az ujrafuttatas felulirja. Egyetlen H1: a regi oldal cime.
-->

<!--mh-fejlec-->
<!--mh-menu-aktiv:${ut}-->

<main id="top">
${torzs}
</main>

<!--mh-lablec-->

<script src="/assets/js/klon.js" defer></script>
</body>
</html>
`;
}
const szakasz = (cim, tartalom, extra = '') => `<section class="oldal-fej jo-fej">
  <div class="tartalom">
${extra}    <h1>${cim}</h1>
  </div>
</section>

<section class="szekcio feher jo-torzs">
  <div class="tartalom jo-szoveg">
${tartalom}
  </div>
</section>`;

// --- aszf / impresszum: egyetlen rich-text blokk, a cim a blokk elso fejlecsora ------------------------------------------------------------------------------
function richOldal(nev, indito) {
  const fa = elemez(fs.readFileSync(regiFajl(nev), 'utf8'));
  const blokk = keres(fa, (n) => n.attrs['data-testid'] === 'richTextElement' && indito.test(tisztSzoveg(szoveg(n)).slice(0, 80)))[0];
  if (!blokk) throw new Error(nev + ': nincs szovegblokk');
  const bl = szerkeszt(blokkok(blokk));
  const [fej, ...tobbi] = bl;
  if (!/^h[1-6]$/.test(fej.t)) throw new Error(nev + ': a blokk nem cimmel kezdodik');
  return oldal(nev, szakasz(fej.html, blokkHtml(tobbi)), `klon/${nev}.html (a "${fej.szoveg}" rich-text blokk)`);
}

// --- suti-tajekoztato: a Wix Blog poszt (cim, szerzo, ido, szoveg) ---------------------------------------------------------------------------------------------
function postOldal(nev) {
  const fa = elemez(fs.readFileSync(regiFajl(nev), 'utf8'));
  const cim = keres(fa, (n) => n.tag === 'h1' && n.attrs['data-hook'] === 'post-title')[0];
  const szerzo = keres(fa, (n) => n.attrs['data-hook'] === 'user-name')[0];
  const profil = keres(fa, (n) => n.attrs['data-hook'] === 'profile-link' && n.attrs.href)[0];
  const ido = keres(fa, (n) => n.attrs['data-hook'] === 'time-ago')[0];
  const olvas = keres(fa, (n) => n.attrs['data-hook'] === 'time-to-read')[0];
  const leiras = keres(fa, (n) => n.tag === 'section' && n.attrs['data-hook'] === 'post-description')[0];
  const kep = keres(fa, (n) => n.tag === 'img' && /Szerző képe/.test(n.attrs.alt || ''))[0];
  if (!cim || !szerzo || !ido || !olvas || !leiras) throw new Error(nev + ': hianyzik a poszt egyik resze');
  const meta_ = `    <p class="jo-meta">${kep ? `<img src="${attr(kep.attrs.src)}" alt="${attr(kep.attrs.alt)}" width="32" height="32" loading="eager">` : ''}<a href="${attr(profil.attrs.href)}">${esc(tisztSzoveg(szoveg(szerzo)))}</a><span>${esc(tisztSzoveg(szoveg(ido)))}</span><span>${esc(tisztSzoveg(szoveg(olvas)))}</span></p>\n`;
  return oldal(nev, szakasz(esc(tisztSzoveg(szoveg(cim))), blokkHtml(blokkok(leiras)), meta_), `klon/${nev}.html (a Wix Blog poszt: cim, szerzo, ido, szoveg)`);
}

// --- blog: a bejegyzes-lista (kategoria, cim, a poszt kartyaja) ---------------------------------------------------------------------------------------------------
function blogOldal(nev) {
  const fa = elemez(fs.readFileSync(regiFajl(nev), 'utf8'));
  const h1 = keres(fa, (n) => n.tag === 'h1')[0];
  const kategoria = keres(fa, (n) => n.tag === 'a' && n.attrs.href === '/blog')[0];
  const lista = keres(fa, (n) => n.attrs['data-hook'] === 'post-list-item');
  if (!h1 || !lista.length) throw new Error(nev + ': hianyzik a blog-lista');
  const kartyak = lista.map((p) => {
    const cimA = keres(p, (n) => n.tag === 'a' && n.attrs.href && /^\/[a-z0-9-]+$/.test(n.attrs.href))[0];
    const cim = keres(p, (n) => n.tag === 'h2')[0];
    const leiras = keres(p, (n) => n.attrs['data-hook'] === 'post-description')[0];
    const szerzo = keres(p, (n) => n.attrs['data-hook'] === 'user-name')[0] || keres(p, (n) => /avatar|profile-link/.test(n.attrs['data-hook'] || ''))[0];
    const profil = keres(p, (n) => n.attrs['data-hook'] === 'profile-link' && n.attrs.href)[0];
    const ido = keres(p, (n) => n.attrs['data-hook'] === 'time-ago')[0];
    const olvas = keres(p, (n) => n.attrs['data-hook'] === 'time-to-read')[0];
    const kep = keres(p, (n) => n.tag === 'img' && /Szerző képe/.test(n.attrs.alt || ''))[0];
    return { href: cimA.attrs.href, cim: tisztSzoveg(szoveg(cim)), leiras: tisztSzoveg(szoveg(leiras)), profil, szerzoSzoveg: szerzo ? tisztSzoveg(szoveg(szerzo)) : '', ido: ido ? tisztSzoveg(szoveg(ido)) : '', olvas: olvas ? tisztSzoveg(szoveg(olvas)) : '', kep };
  });
  const torzs = `<section class="oldal-fej jo-fej">
  <div class="tartalom">
${kategoria ? `    <p class="jo-morzsa"><a href="/blog">${esc(tisztSzoveg(szoveg(kategoria)))}</a></p>\n` : ''}    <h1>${esc(tisztSzoveg(szoveg(h1)))}</h1>
  </div>
</section>

<section class="szekcio feher jo-torzs">
  <div class="tartalom jo-szoveg">
${kartyak.map((k) => `    <article class="jo-poszt">
      <p class="jo-meta">${k.kep ? `<img src="${attr(k.kep.attrs.src)}" alt="${attr(k.kep.attrs.alt)}" width="32" height="32" loading="eager">` : ''}${k.profil ? `<a href="${attr(k.profil.attrs.href)}">${esc(k.szerzoSzoveg)}</a>` : esc(k.szerzoSzoveg)}${k.ido ? `<span>${esc(k.ido)}</span>` : ''}${k.olvas ? `<span>${esc(k.olvas)}</span>` : ''}</p>
      <h2><a href="${attr(k.href)}">${esc(k.cim)}</a></h2>
      <p>${esc(k.leiras)}</p>
    </article>`).join('\n')}
  </div>
</section>`;
  return oldal(nev, torzs, `klon/${nev}.html (a Wix Blog bejegyzes-lista)`);
}

const OLDALAK = {
  aszf: () => richOldal('aszf', /^Általános Szerződési Feltételek/),
  impresszum: () => richOldal('impresszum', /^Impresszum/),
  'suti-tajekoztato': () => postOldal('suti-tajekoztato'),
  blog: () => blogOldal('blog'),
};
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const [nev, f] of Object.entries(OLDALAK)) {
    const ki = path.join(GYOKER, 'foglalas', nev + '.html');
    fs.writeFileSync(ki, f());
    console.log('kesz:', path.relative(GYOKER, ki), fs.statSync(ki).size, 'bajt');
  }
}
