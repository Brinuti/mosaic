// A foglalo fejlece ("Időpontfoglalás · Fodrászat · Noel"): az uzletag es a munkatars neve EGY sorban, a telefon es az X gombbal egyutt, minden kepernyoszelessegen.
//
//   node tools/meres-proba/fejlec-proba.mjs [--overlay dist] [--bazis https://...] [--kep mappa]
//
// Szelessegek: 320, 360, 375, 390, 430 (telefon, erintes), 768, 1280 (asztali). Minden uzletagra es minden munkatarsra (a Salonic JELENLEGI adataibol, csak olvasas):
// a cim egy sor, nem vagodik le ("..."), nem er a telefon/X gombhoz, a gombok a kepen belul vannak. A kepeket a --kep mappaba menti (szemmel ellenorzeshez).
// Kimeno meres (GA4, Meta, TikTok, Ads, Stape, Zapier) tiltva (tilt.mjs); a Salonic adatlapot (guestData) a proba elfogja.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { UA, UA_MOBIL, platformOf, engedett, dnsArg, ures } from './tilt.mjs';
import { createSalonicAdapter } from '../../assets/js/booking-engine/salonic-adapter.js';
import { staffCoverServices, staffLinkKey, staffShortName } from '../../assets/js/booking-engine/flow.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const OVERLAY = arg('overlay', ''), OLDAL = arg('oldal', '/booking-test'), BAZIS = arg('bazis', 'https://www.mosaicheadspa.hu'), KEP = arg('kep', '');
const CHROME = process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let fajlUtvonal = null;
if (OVERLAY) ({ fajlUtvonal } = await import('../serve-dist.mjs'));
if (KEP) fs.mkdirSync(KEP, { recursive: true });
const TIPUS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
const eredmeny = [];
const ok = (cimke, rendben, reszlet = '') => { eredmeny.push({ cimke, rendben }); console.log(`${rendben ? 'OK  ' : 'HIBA'} ${cimke}${reszlet ? ' | ' + reszlet : ''}`); };
const ekezetlen = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// --- a Salonic jelenlegi adatai: kik a szakemberek (fodraszat, oxigen) ------------------------------------------------------------------------------------
const adapter = createSalonicAdapter({ fetchImpl: (u, o) => fetch(u, o) });
const SZAKEMBER = {};
for (const business of ['hair', 'oxygen']) {
  const services = (await adapter.getServices(business)).filter((s) => s.bookingType !== 'voucher_redemption' && !/ajándékkártya|ajandekkartya|kupon/i.test(s.name));
  const nevek = new Map();
  for (const s of staffCoverServices(services)) for (const x of await adapter.getStaff(business, s.serviceId, { days: 60 })) if (x.staff_label && !nevek.has(String(x.staff_id))) nevek.set(String(x.staff_id), x.staff_label);
  const lista = [...nevek].map(([id, label]) => ({ id, label }));
  SZAKEMBER[business] = { services, lista };
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--disable-blink-features=AutomationControlled', dnsArg()] });
async function ujLap(szelesseg) {
  const mobil = szelesseg < 768;
  const ctx = await browser.newContext({ userAgent: mobil ? UA_MOBIL : UA, viewport: { width: szelesseg, height: mobil ? 800 : 900 }, locale: 'hu-HU', timezoneId: 'Europe/Budapest', serviceWorkers: 'block', isMobile: mobil, hasTouch: mobil });
  const naplo = { mer: 0 };
  await ctx.route('**/*', async (route) => {
    const req = route.request(), url = req.url(); let u; try { u = new URL(url); } catch (e) { return route.continue(); }
    if (/salonic\.hu$/.test(u.hostname) && /\/guestData\//.test(u.pathname)) return route.fulfill({ status: 200, headers: { 'content-type': 'text/html' }, body: '<!doctype html><title>proba</title><p>proba</p>' });
    if (/\/api\/foglalo-szamlalo$/.test(u.pathname)) return route.fulfill({ status: 204 });
    if (/\/api\/foglalas-esemeny(\?|$)/.test(u.pathname + u.search)) return route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: req.method() === 'GET' ? '{"kor_ms":null}' : '{"irva":false,"ok":"proba"}' });
    if (OVERLAY && u.origin === BAZIS && req.method() === 'GET') {
      const e = fajlUtvonal(decodeURIComponent(u.pathname), req.headers()['user-agent'] || UA);
      if (e.atiranyit) return route.fulfill({ status: 301, headers: { location: encodeURI(e.atiranyit) + u.search } });
      if (fs.existsSync(e.fajl) && fs.statSync(e.fajl).isFile()) {
        let body = fs.readFileSync(e.fajl);
        if (body.length < 80 && /^[\w./-]+\.html$/.test(body.toString('utf8').trim())) { const cel = path.join(path.dirname(e.fajl), body.toString('utf8').trim()); if (fs.existsSync(cel)) body = fs.readFileSync(cel); }
        return route.fulfill({ status: 200, headers: { 'content-type': TIPUS[path.extname(e.fajl)] || 'application/octet-stream', 'cache-control': 'no-store' }, body });
      }
    }
    const plat = platformOf(url) || (engedett(url, req.method()) || u.origin === BAZIS ? null : 'tiltott');
    if (plat) { naplo.mer++; return route.fulfill(ures(req)); }
    return route.continue();
  });
  const page = await ctx.newPage();
  const hibak = []; page.on('pageerror', (e) => hibak.push(String(e.message).slice(0, 160)));
  await page.goto(BAZIS + OLDAL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openBooking === 'function', null, { timeout: 15000 });
  return { ctx, page, naplo, hibak };
}
const L = (p) => p.locator('#mosaic-booking-layer');

// a fejlec meresei a retegben: a cim egy sor, nem vagodik le, nem er a gombokhoz
const meres = (p) => p.evaluate(() => {
  const r = document.querySelector('#mosaic-booking-layer')?.shadowRoot; if (!r) return null;
  const h1 = r.querySelector('#be-h1'), tel = r.querySelector('.be-head-right a'), x = r.querySelector('#be-close'), vissza = r.querySelector('#be-back'), panel = r.querySelector('.be-panel');
  const rc = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { l: Math.round(b.left * 10) / 10, r: Math.round(b.right * 10) / 10, t: b.top, b: b.bottom, w: b.width, h: b.height }; };
  const lathato = [...h1.children].filter((c) => !(c.classList.contains('be-h1-a') && h1.classList.contains('be-h1-rovid'))).map((c) => c.textContent).join(' ');
  return { szoveg: h1.textContent.replace(/\s+/g, ' ').trim(), lathato: lathato.replace(/\s+/g, ' ').trim(), rovid: h1.classList.contains('be-h1-rovid'), kicsi: h1.classList.contains('be-h1-kicsi'),
    levagva: h1.scrollWidth > h1.clientWidth + 1, h1: rc(h1), tel: rc(tel), x: rc(x), vissza: rc(vissza), panel: rc(panel), vw: window.innerWidth, font: getComputedStyle(h1).fontSize,
    sorok: Math.round(h1.getBoundingClientRect().height / parseFloat(getComputedStyle(h1).lineHeight || 20)) };
});
const SZELESSEGEK = [320, 360, 375, 390, 430, 768, 1280];
let kepSzam = 0;
async function ellenoriz(u, cimke, vart, szelesseg, kepNev) {
  await u.page.waitForTimeout(700);
  const m = await meres(u.page);
  if (!m) { ok(`${cimke} [${szelesseg}px]: a reteg nyitva van`, false, 'nincs reteg'); return; }
  const info = `"${m.lathato}"${m.rovid ? ' (rovid)' : ''}${m.kicsi ? ' (kicsi)' : ''} ${m.font}`;
  ok(`${cimke} [${szelesseg}px]: a cim tartalmazza: ${vart.join(' + ') || '(csak Időpontfoglalás)'}`, vart.every((v) => ekezetlen(m.lathato).includes(ekezetlen(v))), info);
  ok(`${cimke} [${szelesseg}px]: egy sor, nem vagodik le`, !m.levagva && m.sorok <= 1, `levagva=${m.levagva} sorok=${m.sorok} h1=${m.h1.l}..${m.h1.r}`);
  const telBal = m.tel ? m.tel.l : m.vw;
  ok(`${cimke} [${szelesseg}px]: a cim nem er a telefon gombhoz${m.vissza ? ' / a vissza gombhoz' : ''}`, m.h1.r <= telBal + 1 && m.h1.l >= (m.vissza ? m.vissza.r : 0) - 1, `h1=${m.h1.l}..${m.h1.r} tel=${m.tel && m.tel.l}..${m.tel && m.tel.r} vissza=${m.vissza && m.vissza.r}`);
  const gombokBent = m.tel && m.tel.r <= m.panel.r + 0.5 && (!m.x || (m.x.r <= m.panel.r + 0.5 && m.x.l >= m.tel.r - 1)) && m.tel.l >= m.panel.l;
  ok(`${cimke} [${szelesseg}px]: a telefon es az X gomb latszik, a keren belul van`, !!gombokBent, `tel=${m.tel && m.tel.l}..${m.tel && m.tel.r} x=${m.x && m.x.l}..${m.x && m.x.r} panel=${m.panel.l}..${m.panel.r}`);
  if (KEP && kepNev) { kepSzam++; await u.page.screenshot({ path: path.join(KEP, `${String(kepSzam).padStart(2, '0')}-${kepNev}-${szelesseg}.png`), clip: { x: Math.max(0, m.panel.l), y: Math.max(0, m.panel.t), width: Math.min(m.panel.w, m.vw), height: 220 } }); }
}

// --- 1) kezdokepernyo (nincs uzletag): csak "Időpontfoglalás" -------------------------------------------------------------------------------------------
for (const w of SZELESSEGEK) {
  const u = await ujLap(w);
  await u.page.evaluate(() => window.openBooking({}));
  await L(u.page).locator('.be-choice').first().waitFor({ timeout: 20000 }).catch(() => {});
  await ellenoriz(u, 'kezdokepernyo (uzletag nelkul)', [], w, 'h0');
  const m = await meres(u.page);
  ok(`kezdokepernyo [${w}px]: nincs uzletag a cimben`, m && m.szoveg === 'Időpontfoglalás', m && m.szoveg);
  u.hibak.length && ok(`kezdokepernyo [${w}px]: nincs JS-hiba`, false, u.hibak.join(' | '));
  await u.ctx.close();
}

// --- 2) minden uzletag: a neve a cimben -------------------------------------------------------------------------------------------------------------------
const NEVEK = { headspa: 'Head Spa', hair: 'Fodrászat', oxygen: 'Oxigénterápia', laser: 'Lézeres szőrtelenítés' };
for (const [business, nev] of Object.entries(NEVEK)) {
  for (const w of SZELESSEGEK) {
    const u = await ujLap(w);
    await u.page.evaluate((b) => window.openBooking({ business: b }), business);
    await L(u.page).locator('.be-choice, .be-title').first().waitFor({ timeout: 25000 }).catch(() => {});
    await ellenoriz(u, `${business}`, [nev], w, business);
    ok(`${business} [${w}px]: nincs JS-hiba, nincs kimeno meres`, u.hibak.length === 0 && u.naplo.mer === 0, u.hibak.join(' | ') + (u.naplo.mer ? ' mer=' + u.naplo.mer : ''));
    await u.ctx.close();
  }
}

// --- 3) minden munkatars (fodraszat, oxigen): a neve is a cimben, a Salonic jelenlegi adataival ------------------------------------------------------------
for (const [business, { services, lista }] of Object.entries(SZAKEMBER)) {
  for (const x of lista) {
    const kulcs = staffLinkKey(x.label, lista); const nev = staffShortName(x.label); // a fejlecben a keresztnev (vagy a teljes nev, ha elfer)
    const svc = services.find((s) => s.durationMin && s.bookingType !== 'consultation' && (s.staffIds || []).map(String).includes(String(x.id)));
    for (const w of SZELESSEGEK) {
      const u = await ujLap(w);
      await u.page.evaluate((o) => window.openBooking(o), { business, staff: kulcs, ...(svc ? { service: svc.serviceId } : {}) });
      await L(u.page).locator('.be-nnap.szabad, .be-choice').first().waitFor({ timeout: 40000 }).catch(() => {});
      await ellenoriz(u, `${business} / ${nev}`, [NEVEK[business], nev], w, `${business}-${kulcs}`);
      ok(`${business} / ${nev} [${w}px]: nincs JS-hiba, nincs kimeno meres`, u.hibak.length === 0 && u.naplo.mer === 0, u.hibak.join(' | ') + (u.naplo.mer ? ' mer=' + u.naplo.mer : ''));
      await u.ctx.close();
    }
  }
}

// --- 4) a nev a munkatars-valasztas UTAN is megjelenik (a vendeg koppint a fodraszra, nem link) ----------------------------------------------------------------
{
  const w = 375; const { lista } = SZAKEMBER.hair;
  const u = await ujLap(w);
  await u.page.evaluate(() => window.openBooking({ business: 'hair' }));
  const elso = L(u.page).locator('.be-choice').first(); await elso.waitFor({ timeout: 25000 }).catch(() => {});
  const m0 = await meres(u.page);
  ok(`hair, a fodrasz-valaszto kepernyon: meg nincs munkatars a cimben (marad: Fodrászat)`, !!m0 && lista.every((x) => !ekezetlen(m0.szoveg).includes(ekezetlen(staffShortName(x.label)))), m0 && m0.szoveg);
  await u.ctx.close();
}

// --- osszegzes -----------------------------------------------------------------------------------------------------------------------------------------------
await browser.close();
const hibas = eredmeny.filter((e) => !e.rendben);
console.log(`\nOSSZESEN: ${eredmeny.length} ellenorzes, ${hibas.length} hiba`);
if (hibas.length) { for (const e of hibas) console.log('  HIBA:', e.cimke); process.exit(1); }
