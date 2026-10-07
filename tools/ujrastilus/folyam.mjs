// A regi (Wixes) oldal tartalmanak kinyerese az ujrastilusozashoz (tartalom valtoztatasa nelkul).
//
//   PLAYWRIGHT_UTVONAL=<node_modules> node tools/ujrastilus/folyam.mjs <url> <ki-mappa> <nev>
//   pl.: node tools/ujrastilus/folyam.mjs https://www.mosaicheadspa.hu/paros-headspa-budapest ./ki paros
//
// Kimenet (<ki-mappa>/):
//   <nev>.json        - { cim, szoveg (a teljes lathato szoveg), kep[], linkek[], video[] }  (az ellenor.mjs ezzel veti ossze az uj oldalt)
//   <nev>.folyam.txt  - a tartalom dokumentum-sorrendben, y-pozicioval: KEP / SZ (szoveg, gazdag: <b>, <i>, <a href>, <br>) / H1-H4 / GOMB / IFRAME sorok
//
// A regi oldalt MINDIG a csere ELOTT kell kinyerni (az eles cimrol), vagy a csere utan a rejtett /<nev>-regi cimrol.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
function playwright() {
  const keres = [process.env.PLAYWRIGHT_UTVONAL, path.join(import.meta.dirname, '..', '..', 'node_modules')].filter(Boolean);
  for (const k of keres) { try { return createRequire(path.join(k, 'x.js'))('playwright-core'); } catch { /* kovetkezo */ } }
  throw new Error('playwright-core nem talalhato (PLAYWRIGHT_UTVONAL=<a playwright-core node_modules mappaja>)');
}
const [, , URL_, KI, NEV] = process.argv;
if (!URL_ || !KI || !NEV) { console.error('hasznalat: node tools/ujrastilus/folyam.mjs <url> <ki-mappa> <nev>'); process.exit(2); }
fs.mkdirSync(KI, { recursive: true });
const { chromium } = playwright();
const b = await chromium.launch({ executablePath: CHROME, headless: true });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto(URL_, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
await p.getByRole('button', { name: 'Elfogadom' }).click().catch(() => {});
await p.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 110)); } window.scrollTo(0, 0); });
await p.waitForTimeout(800);

const adat = await p.evaluate(() => ({
  cim: document.title,
  magassag: document.documentElement.scrollHeight,
  szoveg: document.body.innerText,
  kep: [...document.images].filter((i) => i.naturalWidth > 150).map((i) => ({ src: i.currentSrc || i.src, w: i.naturalWidth, h: i.naturalHeight, alt: i.alt })).slice(0, 120),
  linkek: [...document.querySelectorAll('a[href]')].map((a) => [a.textContent.trim().replace(/\s+/g, ' ').slice(0, 60), a.getAttribute('href')]).filter((x) => x[0]),
  video: [...document.querySelectorAll('video,iframe')].map((v) => v.tagName + ' ' + (v.currentSrc || v.src || '').slice(0, 140)),
}));
fs.writeFileSync(path.join(KI, NEV + '.json'), JSON.stringify(adat, null, 1));

const sorok = await p.evaluate(() => {
  const ki = []; const latott = new Set();
  const main = document.querySelector('main') || document.body;
  const tisztit = (n) => {
    let o = '';
    for (const c of n.childNodes) {
      if (c.nodeType === 3) { o += c.textContent.replace(/\u200b/g, ''); continue; }
      if (c.nodeType !== 1) continue;
      const g = c.tagName.toLowerCase();
      const inner = tisztit(c);
      const cs = getComputedStyle(c);
      const vast = +cs.fontWeight >= 600;
      const dolt = cs.fontStyle === 'italic';
      const szulo = c.parentElement ? getComputedStyle(c.parentElement) : null;
      if (g === 'br') o += '<br>';
      else if (g === 'a' && c.getAttribute('href')) o += '<a href="' + c.getAttribute('href') + '">' + inner + '</a>';
      else if (inner.trim() && (vast || dolt)) {
        let t = inner;
        if (vast && !(szulo && +szulo.fontWeight >= 600)) t = '<b>' + t + '</b>';
        if (dolt && !(szulo && szulo.fontStyle === 'italic')) t = '<i>' + t + '</i>';
        o += t;
      } else o += inner;
    }
    return o;
  };
  const jarj = (e) => {
    if (!(e instanceof Element)) return;
    const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const r = e.getBoundingClientRect(); const y = Math.round(r.top + scrollY); const x = Math.round(r.left); const w = Math.round(r.width);
    const tag = e.tagName.toLowerCase();
    if (tag === 'img') { if (r.width > 120 && r.height > 80) ki.push({ y, x, w, h: Math.round(r.height), t: 'KEP', s: (e.currentSrc || e.src).replace(/^.*\/assets\//, '/assets/'), alt: e.alt }); return; }
    if (tag === 'iframe') { ki.push({ y, x, w, h: Math.round(r.height), t: 'IFRAME', s: (e.src || '').slice(0, 140) }); return; }
    if (tag === 'video') { ki.push({ y, x, w, h: Math.round(r.height), t: 'VIDEO', s: (e.currentSrc || e.src || '').replace(/^.*\/assets\//, '/assets/') }); return; }
    if (['a', 'button', 'h1', 'h2', 'h3', 'h4', 'p', 'li', 'span', 'div'].includes(tag)) {
      const gyerekBlokk = [...e.children].some((c) => /^(DIV|P|H1|H2|H3|H4|UL|OL|LI|A|BUTTON|IMG|SECTION|IFRAME|VIDEO|FIGURE)$/.test(c.tagName));
      const sz = (e.innerText || '').replace(/\u200b/g, '').replace(/\s+/g, ' ').trim();
      if (!gyerekBlokk && sz && !latott.has(e)) {
        let fent = e.parentElement; while (fent && fent !== main) { if (latott.has(fent)) return; fent = fent.parentElement; }
        latott.add(e);
        const rich = tisztit(e).replace(/\s+/g, ' ').replace(/<\/b>\s*<b>/g, ' ').replace(/<\/i>\s*<i>/g, ' ').trim();
        ki.push({ y, x, w, t: tag === 'a' || tag === 'button' ? 'GOMB' : /^h\d$/.test(tag) ? tag.toUpperCase() : 'SZ', s: sz, rich, href: tag === 'a' ? e.getAttribute('href') : undefined, f: cs.fontSize, al: cs.textAlign });
        return;
      }
    }
    for (const c of e.children) jarj(c);
  };
  jarj(main);
  return ki;
});
sorok.sort((a, c) => a.y - c.y || a.x - c.x);
const sor = sorok.map((r) => `${String(r.y).padStart(5)} ${r.t.padEnd(6)} x${r.x} w${r.w}${r.h ? ' h' + r.h : ''}${r.f ? ' ' + r.f : ''}${r.al && r.al !== 'start' ? ' ' + r.al : ''} ${r.t === 'SZ' || r.t === 'GOMB' || /^H/.test(r.t) ? (r.rich || r.s) : (r.s || '') + (r.alt ? '  [alt: ' + r.alt + ']' : '')}${r.href ? '  -> ' + r.href : ''}`);
fs.writeFileSync(path.join(KI, NEV + '.folyam.txt'), sor.join('\n'));
console.log(NEV + ':', sorok.length, 'elem a folyamban,', adat.kep.length, 'kep,', adat.video.length, 'video/iframe,', adat.linkek.length, 'link ->', KI);
await b.close();
