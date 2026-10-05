// Minden foglalas-jellegu gomb / link valodi kattintassal (vagy erintessel): mit csinal, es LATSZIK-E a foglalo? (a helyi dist-en)
//   node tools/meres-proba/gomb-bejaras.mjs [--profil asztali|mobil|webkit] [--oldalak a,b] [--ki naplo.json]
// Besorolas: RETEG (megnyilik ES kep alapjan lathato) | FEHER (megnyilik, de a kepernyon nem a foglalo latszik) | HORGONY (ugyanazon az oldalon gorget)
//            ATVISZ (mas oldalra visz) | MASIK_LAP | TEL (tel: / mailto:) | SEMMI (nem tortenik semmi) | FEDI (valami takarja a gombot)
// A "lathato" ellenorzes a kepernyokep pixeleit nezi: a foglalo panel hatterszine a panel sarkaiban (a "fehér képernyő" hiba: a reteg letrejott, de nem rajzolodott ki).
// A gombokat gorgetve kozelitjuk meg (az oldal mar legorgetett allapotaban kattintunk), nem az oldal tetejen: a hiba eppen a lent levo gomboknal jelentkezett.
import { chromium, webkit, devices } from 'playwright-core';
import http from 'node:http';
import { fajlUtvonal } from '../serve-dist.mjs';
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const PROFIL = arg('profil', 'asztali'); const KI = arg('ki', ''); const SZURO = arg('oldalak', ''); const ELES = arg('bazis', ''); // --bazis https://www.mosaicheadspa.hu: az eles oldalon (a kimeno meres akkor is le van tiltva)
const DIST = path.resolve(import.meta.dirname, '..', '..', 'dist');
const PORT = { asztali: 4192, mobil: 4193, webkit: 4194 }[PROFIL] || 4192; const BASE = ELES || ('http://localhost:' + PORT);
const KIHAGY = /^(success-|.+-ok$|foglalo-|booking-test|foglalas$|oxigenterapia-masodik$|pmu-vh$|404$|fizetesi-hiba|ajandek-|giftcards)/;
const TIPUS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };
const szerver = http.createServer((req, res) => { const u = new URL(req.url, 'http://x'); if (req.method === 'POST') { res.writeHead(200); return res.end('ok'); } const e = fajlUtvonal(decodeURIComponent(u.pathname), req.headers['user-agent']); if (e.atiranyit) { res.writeHead(301, { location: encodeURI(e.atiranyit) + u.search }); return res.end(); } fs.readFile(e.fajl, (h, adat) => { if (h) { res.writeHead(404); return res.end('nincs'); } res.writeHead(200, { 'content-type': TIPUS[path.extname(e.fajl)] || 'application/octet-stream' }); res.end(adat); }); });
if (!ELES) await new Promise((r) => szerver.listen(PORT, r));
const oldalak = fs.readdirSync(path.join(DIST, '_a')).filter((f) => f.endsWith('.html')).map((f) => f.replace(/\.html$/, '')).filter((f) => !KIHAGY.test(f)).filter((f) => !SZURO || SZURO.split(',').includes(f));
const UA_M = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const b = PROFIL === 'webkit' ? await webkit.launch() : await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
const MOBIL = PROFIL !== 'asztali';
const ctxOpt = PROFIL === 'webkit' ? { ...devices['iPhone 13'], locale: 'hu-HU' } : PROFIL === 'mobil' ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: UA_M, locale: 'hu-HU' } : { viewport: { width: 1280, height: 800 }, locale: 'hu-HU' };
const ctx = await b.newContext(ctxOpt);
await ctx.route(/googletagmanager|google-analytics|facebook|tiktok|stape|doubleclick|zapier|googleadservices|trustindex|clarity|hotjar/, (r) => r.fulfill({ status: 200, body: '' }));

// egyetlen pixel szine a kepernyokepbol (minimalis PNG-dekodolo: 8 bites RGB / RGBA, 1x1-es kivagas)
async function pixel(page, x, y) {
  const png = await page.screenshot({ clip: { x: Math.max(0, Math.floor(x)), y: Math.max(0, Math.floor(y)), width: 1, height: 1 }, type: 'png' });
  let o = 8; const idat = []; let tipus = 2;
  while (o < png.length) { const len = png.readUInt32BE(o); const nev = png.toString('ascii', o + 4, o + 8); if (nev === 'IHDR') tipus = png[o + 8 + 9]; if (nev === 'IDAT') idat.push(png.subarray(o + 8, o + 8 + len)); o += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)); const k = tipus === 6 ? 4 : 3; // [szuro, R, G, B, (A)]
  return [raw[1], raw[2], raw[3]].slice(0, 3);
}
const kozel = (a, b2, t = 6) => a.every((v, i) => Math.abs(v - b2[i]) <= t);
const rgbSzoveg = (s) => (s.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
async function lathatoE(page) {
  // a foglalo panel: a varhato hatterszin a panel jobb alsó / bal felső sarkaban (belül) es a kozepen kozel az aljahoz
  const adat = await page.evaluate(() => { const h = document.getElementById('mosaic-booking-layer'); const p = h && h.shadowRoot && h.shadowRoot.querySelector('.be-panel'); if (!p) return null; const r = p.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height, bg: getComputedStyle(p).backgroundColor, vw: innerWidth, vh: innerHeight }; });
  if (!adat || adat.w < 50 || adat.h < 50) return { ok: false, ok_miert: 'nincs panel-meret' };
  const var_ = rgbSzoveg(adat.bg);
  const pontok = [[adat.l + 6, adat.t + adat.h - 6], [adat.l + adat.w - 6, adat.t + adat.h - 6], [adat.l + 6, adat.t + Math.min(adat.h - 6, 8)]].map(([x, y]) => [Math.min(adat.vw - 2, Math.max(1, x)), Math.min(adat.vh - 2, Math.max(1, y))]);
  const szinek = []; for (const [x, y] of pontok) szinek.push(await pixel(page, x, y));
  const jo = szinek.filter((s) => kozel(s, var_)).length;
  return { ok: jo >= 2, varhato: var_.join(','), mert: szinek.map((s) => s.join(',')).join(' | ') };
}
const GYUJT = () => {
  const SZOV = /id[őo]pont|foglal|FOGLAL|szabad|konzult[aá]ci/i; const MINTA = /salonic\.hu|idpontfoglalas|idopontfoglalas|szortelenites-foglalas|pmu-foglalas|smink-foglalas|\/naptar|fodraszat-foglalas|kupon-utan-foglalas|foglalo-motor|\/foglalas\b/i;
  const lat = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 4 && r.height > 4 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const ossz = [...document.querySelectorAll('a[href], button, [role=button], [role=link], [data-testid=linkElement]')];
  const ki = []; const lattuk = new Set();
  ossz.forEach((e) => {
    const t = (e.innerText || e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60); const h = e.getAttribute('href') || '';
    if (e.closest('#mosaic-booking-layer, #mh-cc, #mh-cc-reopen')) return;
    if (!(MINTA.test(h) || (SZOV.test(t) && t.length < 45))) return;
    if (!lat(e)) return;
    const kulcs = e.tagName + '|' + t + '|' + h + '|' + Math.round(e.getBoundingClientRect().top / 400); if (lattuk.has(kulcs)) return; lattuk.add(kulcs);
    ki.push({ idx: ossz.indexOf(e), tag: e.tagName, szoveg: t, href: h, target: e.getAttribute('target') || '' });
  });
  return ki;
};
const eredmeny = [];
for (const oldal of oldalak) {
  const url = BASE + '/' + (oldal === 'fooldal' ? '' : oldal);
  const p = await ctx.newPage();
  const betolt = async () => { await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 }); await p.waitForTimeout(1800); };
  try { await betolt(); } catch (e) { eredmeny.push({ oldal, hiba: 'nem toltodik: ' + e.message.slice(0, 80) }); await p.close(); continue; }
  const cel = await p.evaluate(GYUJT);
  for (const c of cel) {
    let besorol = 'SEMMI', reszlet = '';
    try {
      const el = (await p.$$('a[href], button, [role=button], [role=link], [data-testid=linkElement]'))[c.idx];
      if (!el) { besorol = 'NINCS_ELEM'; throw new Error('x'); }
      await el.scrollIntoViewIfNeeded({ timeout: 2500 }); await p.waitForTimeout(300);
      const doboz = await el.boundingBox();
      if (!doboz) { besorol = 'NINCS_DOBOZ'; throw new Error('x'); }
      const x = doboz.x + doboz.width / 2, y = doboz.y + doboz.height / 2;
      const fedett = await p.evaluate(([x, y, idx]) => { const all = [...document.querySelectorAll('a[href], button, [role=button], [role=link], [data-testid=linkElement]')]; const e = all[idx]; const q = document.elementFromPoint(x, y); return q && !(e === q || e.contains(q) || q.contains(e)) ? (q.tagName + '#' + q.id + '.' + String(q.className).slice(0, 40)) : ''; }, [x, y, c.idx]);
      const url0 = p.url(); const lapok0 = ctx.pages().length; const sy0 = await p.evaluate(() => Math.round(scrollY));
      if (PROFIL === 'mobil') await p.touchscreen.tap(x, y); else await p.mouse.click(x, y);
      await p.waitForTimeout(1700);
      const reteg = await p.evaluate(() => !!document.getElementById('mosaic-booking-layer'));
      const url1 = p.url(); const ujlapok = ctx.pages().slice(lapok0); const sy1 = await p.evaluate(() => Math.round(scrollY)).catch(() => sy0);
      if (reteg) {
        await p.waitForTimeout(700);
        const v = await lathatoE(p);
        besorol = v.ok ? 'RETEG' : 'FEHER'; reszlet = `scrollY=${sy0}` + (v.ok ? '' : ` varhato ${v.varhato} / mert ${v.mert}`);
      } else if (/^(tel|mailto):/i.test(c.href)) besorol = 'TEL';
      else if (ujlapok.length) { besorol = 'MASIK_LAP'; reszlet = ujlapok.map((q) => q.url().replace(BASE, '')).join(' '); }
      else if (url1 !== url0) { const hash = url1.split('#')[0] === url0.split('#')[0]; besorol = hash ? 'HORGONY' : 'ATVISZ'; reszlet = url1.replace(BASE, ''); }
      else if (/^#/.test(c.href) && Math.abs(sy1 - sy0) > 30) { besorol = 'HORGONY'; reszlet = `gorgetett ${sy0} -> ${sy1}`; }
      if (fedett && besorol === 'SEMMI') { besorol = 'FEDI'; reszlet = fedett; } else if (fedett) reszlet += (reszlet ? ' | ' : '') + 'fedte: ' + fedett;
      for (const q of ujlapok) await q.close().catch(() => {});
      if (reteg) { await p.evaluate(() => window.closeBooking && window.closeBooking()); await p.waitForTimeout(500); }
      if (besorol === 'ATVISZ') await betolt();
    } catch (e) { if (besorol === 'SEMMI') { besorol = 'HIBA'; reszlet = String(e.message).split('\n')[0].slice(0, 80); } }
    eredmeny.push({ oldal, szoveg: c.szoveg, tag: c.tag, href: c.href.slice(0, 80), target: c.target, besorol, reszlet });
  }
  await p.close();
  const sor = eredmeny.filter((r) => r.oldal === oldal);
  console.log(`${oldal}: ${sor.length} elem | ` + ['RETEG', 'FEHER', 'HORGONY', 'ATVISZ', 'MASIK_LAP', 'TEL', 'SEMMI', 'FEDI', 'HIBA'].map((k) => k + ':' + sor.filter((r) => r.besorol === k).length).join(' '));
}
await b.close(); if (!ELES) szerver.close();
if (KI) fs.writeFileSync(KI, JSON.stringify(eredmeny, null, 1));
const rossz = eredmeny.filter((r) => ['SEMMI', 'HIBA', 'NINCS_ELEM', 'NINCS_DOBOZ', 'FEHER', 'FEDI'].includes(r.besorol));
console.log(`\n=== OSSZESEN ${eredmeny.length} gomb/link, ebbol RETEG: ${eredmeny.filter((r) => r.besorol === 'RETEG').length}, GYANUS: ${rossz.length}`);
for (const r of rossz) console.log(`${r.oldal} | ${r.tag} "${r.szoveg}" ${r.href} target=${r.target} -> ${r.besorol} ${r.reszlet}`);
process.exit(rossz.some((r) => r.besorol === 'FEHER') ? 2 : 0);
