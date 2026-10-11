// SEO-osszevetes: a Wix-oldal es a klon minden keresooptimalizalasi jele oldalankent.
//
//   node tools/seo-osszevetes.mjs --forras        klon/ (a Wixbol keszult forras) <-> dist/ (a build kimenete), minden oldal
//   node tools/seo-osszevetes.mjs --wix           tools/raw*/ (a Wix szerveroldali mentese) <-> az eles klon (CIM), ahol van mentes
//   node tools/seo-osszevetes.mjs --archiv [n]    a Web Archive utolso Wix-kori peldanya <-> az eles klon (CIM), n oldal
//
// Osszevetett jelek: <html lang>, <title>, meta description / robots / keywords, canonical, hreflang, og:* es twitter:*
// (a kepcim csak fajlnevre: a Wix-CDN helyett a sajat /assets/ cim szandekos), JSON-LD (kepcimek normalizalva; a Wix
// belso keresojere mutato SearchAction szandekosan kimarad, tools/takaritas.mjs), H1-H3 szovegek, a belso linkek celjai
// (utvonalra normalizalva), a kepek alt-szovegei. A HTTP-valasz: allapotkod, X-Robots-Tag.
import fs from 'node:fs';
import path from 'node:path';
import { mindenOldal, oldalak } from './oldalak.mjs';
import { fajlnev } from '../lib/utvonal.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const CIM = (process.env.CIM || 'https://www.medicalpiercing.hu').replace(/\/+$/, '');
const mod = process.argv[2] || '--forras';
const UA = { asztali: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36', mobil: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' };

// a Wix szerveroldali HTML-je az ekezeteket nevvel kodolja (&ouml;), a klon UTF-8-at hasznal: visszafejtve vetjuk ossze
const NEV = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', bdquo: '„', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', laquo: '«', raquo: '»', copy: '©', reg: '®', bull: '•', middot: '·', times: '×', deg: '°', euro: '€', shy: '' };
for (const [b, k] of [['a', 'acute'], ['e', 'acute'], ['i', 'acute'], ['o', 'acute'], ['u', 'acute'], ['o', 'uml'], ['u', 'uml'], ['a', 'uml'], ['e', 'uml']]) {
  const c = { acute: '\u0301', uml: '\u0308' }[k];
  NEV[b + k] = (b + c).normalize('NFC');
  NEV[b.toUpperCase() + k] = (b.toUpperCase() + c).normalize('NFC');
}
const dec = (s) => String(s ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n))
  .replace(/&([a-z]+);/gi, (m, n) => (n in NEV ? NEV[n] : m))
  .replace(/\s+/g, ' ').trim();
const attr = (tag, n) => { const m = new RegExp(`\\s${n}="([^"]*)"`, 'i').exec(tag); return m ? dec(m[1]) : null; };
const kepNev = (u) => String(u || '').split('?')[0].split('/').filter(Boolean).find((x) => /^[a-z0-9]+_[0-9a-f]{20,}/i.test(x))?.replace(/~mv2/, '').replace(/\.(jpe?g|png|gif|webp)$/i, '') || String(u || '');
const ut = (href) => {
  try {
    const u = new URL(dec(href), 'https://www.medicalpiercing.hu/');
    if (!/^(www\.)?medicalpiercing\.hu$/.test(u.hostname)) return null;
    if (u.pathname.startsWith('/cdn-cgi/l/email-protection')) return 'mailto:(Cloudflare-elrejtes)';
    return decodeURIComponent(u.pathname).replace(/\/+$/, '') || '/';
  } catch (e) { return null; }
};
const jsonldNorm = (s) => {
  try {
    const o = JSON.parse(s);
    const ki = JSON.stringify(o, (k, v) => (typeof v === 'string' && /wixstatic\.com\/media|\/assets\/img\//.test(v) ? 'KEP:' + kepNev(v) : v));
    return /"SearchAction"/.test(ki) ? null : ki;
  } catch (e) { return 'HIBAS:' + s.slice(0, 60); }
};

export function seoJelek(html) {
  const fej = (html.match(/<head[\s\S]*?<\/head>/i) || [''])[0];
  const metak = [...fej.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
  const meta = (n) => { const t = metak.find((x) => attr(x, 'name')?.toLowerCase() === n || attr(x, 'property')?.toLowerCase() === n); return t ? attr(t, 'content') : null; };
  const o = {};
  o.lang = attr((html.match(/<html\b[^>]*>/i) || [''])[0], 'lang');
  o.title = dec((fej.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]);
  for (const n of ['description', 'robots', 'keywords', 'google-site-verification']) o[n] = meta(n);
  for (const t of metak) {
    const n = (attr(t, 'property') || attr(t, 'name') || '').toLowerCase();
    if (/^(og|twitter):/.test(n)) o[n] = /image/.test(n) ? kepNev(attr(t, 'content')) : attr(t, 'content');
  }
  const linkek = [...fej.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
  o.canonical = (linkek.find((l) => /rel="canonical"/i.test(l)) && attr(linkek.find((l) => /rel="canonical"/i.test(l)), 'href')) || null;
  o.hreflang = linkek.filter((l) => /hreflang=/i.test(l)).map((l) => attr(l, 'hreflang') + '=' + attr(l, 'href')).sort().join(' ') || null;
  o.jsonld = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => jsonldNorm(m[1])).filter(Boolean).sort();
  const torzs = html.replace(/<head[\s\S]*?<\/head>/i, '').replace(/<template\b[\s\S]*?<\/template>/gi, '').replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '');
  for (const h of ['h1', 'h2', 'h3']) o[h] = [...torzs.matchAll(new RegExp(`<${h}\\b[^>]*>([\\s\\S]*?)<\\/${h}>`, 'gi'))].map((m) => dec(m[1].replace(/<[^>]+>/g, ' '))).filter(Boolean);
  o.linkek = [...new Set([...torzs.matchAll(/<a\b[^>]*\shref="([^"]*)"/gi)].map((m) => (/^mailto:/i.test(m[1]) ? 'mailto:(Cloudflare-elrejtes)' : ut(m[1]))).filter(Boolean))].sort();
  o.alt = [...torzs.matchAll(/<img\b[^>]*>/gi)].map((m) => attr(m[0], 'alt')).filter((x) => x !== null && x !== '').sort();
  return o;
}

function osszevet(a, b) {
  const elter = [];
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = JSON.stringify(a[k] ?? null), y = JSON.stringify(b[k] ?? null);
    if (x === y) continue;
    if (Array.isArray(a[k]) || Array.isArray(b[k])) {
      const A = new Set(a[k] || []), B = new Set(b[k] || []);
      const hiany = [...A].filter((v) => !B.has(v)), tobb = [...B].filter((v) => !A.has(v));
      if (!hiany.length && !tobb.length) continue; // csak a sorrend / ismetles mas
      elter.push(`${k}: hianyzik ${JSON.stringify(hiany).slice(0, 300)} | uj ${JSON.stringify(tobb).slice(0, 300)}`);
    } else elter.push(`${k}: ${x.slice(0, 200)} -> ${y.slice(0, 200)}`);
  }
  return elter;
}

async function lekeres(u, nezet) {
  const r = await fetch(u, { headers: { 'user-agent': UA[nezet] }, redirect: 'manual' });
  return { status: r.status, xrobots: r.headers.get('x-robots-tag'), html: await r.text() };
}

let hibasLap = 0, lapDb = 0;
const jelent = (nev, elter) => { lapDb++; if (elter.length) { hibasLap++; console.log(`ELTER ${nev}\n   ` + elter.join('\n   ')); } };

if (mod === '--forras') {
  for (const o of mindenOldal()) for (const [be, ki] of [['klon', '_a'], ['klon/m', '_m']]) {
    const f1 = path.join(ROOT, be, o.kulcs + '.html'), f2 = path.join(ROOT, 'dist', ki, fajlnev(o.kulcs) + '.html');
    if (!fs.existsSync(f1) || !fs.existsSync(f2)) continue;
    jelent(`${ki} ${o.ut}`, osszevet(seoJelek(fs.readFileSync(f1, 'utf8')), seoJelek(fs.readFileSync(f2, 'utf8'))));
  }
} else if (mod === '--wix') {
  for (const o of mindenOldal()) for (const [mappa, nezet] of [['tools/raw', 'asztali'], ['tools/raw-mobil', 'mobil']]) {
    const f = path.join(ROOT, mappa, o.kulcs + '.html');
    if (!fs.existsSync(f)) continue;
    const v = await lekeres(CIM + encodeURI(o.ut), nezet);
    const e = osszevet(seoJelek(fs.readFileSync(f, 'utf8')), seoJelek(v.html));
    if (o.kulcs !== '404' && v.status !== 200) e.unshift('HTTP ' + v.status);
    if (v.xrobots) e.unshift('X-Robots-Tag: ' + v.xrobots);
    jelent(`${nezet} ${o.ut}`, e);
  }
} else if (mod === '--archiv') {
  // csak ahol nincs helyi Wix-mentes (tools/raw/); a Web Archive a legkozelebbi (okt. 10. elotti) peldanyra iranyit at
  const n = +process.argv[3] || 1000;
  const probal = async (u, ms) => { for (let i = 0; i < 4; i++) { try { const r = await fetch(u, { signal: AbortSignal.timeout(ms) }); if (r.ok) return r; } catch (e) { /* ujra */ } await new Promise((k) => setTimeout(k, 3000 * (i + 1))); } return null; };
  for (const o of oldalak().filter((x) => !fs.existsSync(path.join(ROOT, 'tools/raw', x.kulcs + '.html'))).slice(0, n)) {
    const r = await probal(`https://web.archive.org/web/20261010000000id_/https://www.medicalpiercing.hu${encodeURI(o.ut)}`, 60000);
    const wix = r ? await r.text().catch(() => '') : '';
    const ido = r ? (/\/web\/(\d{14})/.exec(r.url) || [])[1] : null;
    if (!wix || !/static\.wixstatic\.com|wix-/.test(wix)) { console.log(`nincs Wix-kori archiv: ${o.ut}${ido ? ' (' + ido + ')' : ''}`); continue; }
    const v = await lekeres(CIM + encodeURI(o.ut), 'asztali');
    jelent(`archiv ${ido} ${o.ut}`, osszevet(seoJelek(wix), seoJelek(v.html)));
  }
}
console.log(`\n${lapDb} lap, ${hibasLap} elteressel`);
