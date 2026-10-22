// Az Evelin-oldal UJ, hirdetesi valtozatanak "megtort sor" ellenorzoje (a tulajdonos alapszabalya, 2026-10-20): mobilon ahol egy vagy ket szo csuszik at uj sorba, az legyen egy sor.
//
//   node tools/hair-teszt/evelin-uj-torott-sor.mjs                  tablazat 360 / 390 / 412 px-en (kilepesi kod 1, ha a rovid szovegek kozott van arva sor)
//   node tools/hair-teszt/evelin-uj-torott-sor.mjs --reszletes      + minden talalat felsorolva (elem, sorok szama, az utolso sor szavai)
//   node tools/hair-teszt/evelin-uj-torott-sor.mjs --json           gepi kimenet
//   node tools/hair-teszt/evelin-uj-torott-sor.mjs --ut=/masik-oldal  mas oldal (alapbol: /noi-hajfestes-evelin-uj)
//
// Hogyan merunk: minden szot (nem torheto szokozzel / nbsp-vel osszekotott szavak egy szonak szamitanak) a sajat Range-evel merunk (Range.getClientRects), a szavakat a fuggoleges
// helyzetuk szerint sorokba rendezzuk, es megnezzuk, hany szo maradt az UTOLSO sorban. Ket mutato:
//   - szigoru: tobbsoros elem, az utolso sorban <= 2 szo;
//   - vizualis ("arva"): szigoru, ES az utolso sor keskenyebb, mint a legszelesebb sor 60%-a (azaz tenyleg "atcsuszott" a sor vegen, nem kiegyensulyozott 2 + 2 szavas tordeles).
// Ket kategoria: ROVID (cimek, gombfeliratok, jelvenyek, kartyacimek, rovid listaelemek: celertek 0 arva) es SZOVEG (bekezdesek: a hosszu torzsszovegnel a termeszetes tordeles rendben van;
// itt csak azt szamoljuk, ahol 2-3 soros rovid bekezdes utolso sora 1-2 szo - `text-wrap: pretty`-vel csokkentjuk, informacio).
//
// Kornyezeti valtozok: CHROME_UTVONAL, PLAYWRIGHT_UTVONAL (mint a hair.test.mjs-nel).
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const GYOKER = path.resolve(import.meta.dirname, '..', '..');
export const SZELESSEGEK = [360, 390, 412];
export const UA_MOBIL = 'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

// GOMB: gombfeliratok / fulek / szurok: itt MINDEN tordeles hiba (a felirat legyen egy sor). ROVID: cimek, jelvenyek, kartyacimek, rovid listaelemek: celertek 0 arva sor.
// SZOVEG: bekezdesek (a hosszu torzsszovegnel a termeszetes tordeles rendben van: informacio).
export const GOMB = ['main .gomb', 'main .ar-ful', 'main .szuro', '.sticky-cta a'];
export const ROVID = [
  ...GOMB, 'main h1', 'main h2', 'main h3', 'main .felcim', 'main summary', 'main .ar-sav li b', 'main .ar-sav li span',
  'main .hely-sor > span', 'main .hely-sor > button', 'main .hely-sor > a', 'main .ert-sor > button', 'main .ert-sor > a', 'main .kovetkezo span', 'main .szolg-adat span', 'main .ar-tabla th', 'main .ar-tabla td .ar',
  'main .ar-tabla td .perc', 'main .ar-tabla th small', 'main .hely-lista li > span', 'main .hely-lista li a', 'main .alairas', 'main .terkep-hely p', 'main .kep-cimke', 'main figcaption',
  'main .szekcio-fej .lead',
];
export const SZOVEG = [
  'main .hero .lead', 'main .szolg-torzs p', 'main .mini-kartya p', 'main .ar-megj li > span', 'main .gyik-lista details p', 'main .ar-kedvezmeny span', 'main .szolg-tovabbi',
  'main .bemutat p:not(.alairas):not(.cta-sor)', 'main .festek p:not(.felcim)', 'main .foglalo-doboz .lead', 'main .kovetkezo span',
];

/** A bongeszoben fut (page.evaluate): { rovid: [...talalatok], szoveg: [...talalatok] } a megadott szelektorokra. */
export function meres({ rovid, szoveg, gomb }) {
  const SZO = /[^\s\u00a0\u202f]+(?:[\u00a0\u202f][^\s\u00a0\u202f]+)*/g;
  const lathato = (n) => {
    const p = n.parentElement;
    if (!p || p.closest('script,style,noscript,template,[hidden],svg')) return false;
    for (let e = p; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return false; }
    return true;
  };
  // a szoveg-csomopont "tulajdonosa": a legkozelebbi NEM inline ose (a blokk-gyerekek sajat sorai - pl. a th > small - kulon elemkent merendok)
  const tulajdonos = (n) => { let e = n.parentElement; while (e && e !== document.body) { const d = getComputedStyle(e).display; if (d !== 'inline' && d !== 'contents') return e; e = e.parentElement; } return e; };
  const szavak = (el) => {
    const ki = [];
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      if (!lathato(n) || tulajdonos(n) !== el) continue;
      const t = n.nodeValue; let m;
      SZO.lastIndex = 0;
      while ((m = SZO.exec(t))) {
        const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
        const rs = [...r.getClientRects()].filter((x) => x.width > 0.5 && x.height > 0.5);
        if (!rs.length) continue;
        const u = rs[rs.length - 1]; // a szo VEGE hol van (egy hosszu szo is tordelodhet)
        ki.push({ szo: m[0], top: u.top, h: u.height, left: rs[0].left, right: u.right });
      }
    }
    return ki;
  };
  const sorok = (sz) => {
    const s = [];
    for (const x of sz) {
      const sor = s[s.length - 1];
      if (sor && x.top < sor.top + 0.6 * sor.h) { sor.szavak.push(x); sor.top = Math.min(sor.top, x.top); } else s.push({ top: x.top, h: x.h, szavak: [x] });
    }
    return s.map((l) => ({ szavak: l.szavak, szel: Math.max(...l.szavak.map((x) => x.right)) - Math.min(...l.szavak.map((x) => x.left)) }));
  };
  const elemSor = (el, gombE) => {
    const s = sorok(szavak(el));
    if (s.length < 2) return null;
    const utolso = s[s.length - 1], legszelesebb = Math.max(...s.slice(0, -1).map((x) => x.szel));
    const db = utolso.szavak.length;
    return { sorok: s.length, utolsoSzavak: db, utolso: utolso.szavak.map((x) => x.szo).join(' '), arany: legszelesebb ? +(utolso.szel / legszelesebb).toFixed(2) : 1, strict: db <= 2 || gombE, arva: gombE || (db <= 2 && utolso.szel < 0.6 * legszelesebb) };
  };
  const jel = (el) => (el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : '')) + ' "' + (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60) + '"';
  const futtat = (lista) => {
    const ki = []; let db = 0; const lattuk = new Set(); const gombEl = new Set(gomb.flatMap((q) => [...document.querySelectorAll(q)]));
    for (const sel of lista) {
      for (const el of document.querySelectorAll(sel)) {
        if (lattuk.has(el)) continue; lattuk.add(el);
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue; // rejtett
        db++;
        const x = elemSor(el, gombEl.has(el));
        if (x && x.strict) ki.push({ sel, elem: jel(el), ...x });
      }
    }
    return { vizsgalt: db, talalat: ki };
  };
  // a zart GYIK-szovegeket is megmerjuk (kinyitjuk, majd visszazarjuk)
  const zartak = [...document.querySelectorAll('main .gyik-lista details:not([open])')];
  zartak.forEach((d) => d.setAttribute('open', ''));
  const eredmeny = { rovid: futtat(rovid), szoveg: futtat(szoveg) };
  zartak.forEach((d) => d.removeAttribute('open'));
  return eredmeny;
}

/** Egy oldalra (Playwright page) lefuttatja a merest a szolgaltatas-fulek mindegyik panelen. Visszaad: { rovid: {vizsgalt, talalat[]}, szoveg: {...} } */
export async function oldalMeres(page) {
  await page.waitForSelector('.hero [data-kovetkezo]:not([hidden])', { timeout: 4000 }).catch(() => { /* nincs hamis naptar-valasz: a sor rejtve marad, nem merjuk */ });
  await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); } window.scrollTo(0, 0); });
  await page.waitForTimeout(400);
  const fulek = await page.$$('main .ar-ful');
  const mind = { rovid: { vizsgalt: 0, talalat: [] }, szoveg: { vizsgalt: 0, talalat: [] } };
  const lattuk = new Set();
  const egyesit = (r) => {
    for (const k of ['rovid', 'szoveg']) {
      mind[k].vizsgalt += r[k].vizsgalt;
      for (const t of r[k].talalat) { const kulcs = k + t.elem; if (!lattuk.has(kulcs)) { lattuk.add(kulcs); mind[k].talalat.push(t); } }
    }
  };
  if (!fulek.length) egyesit(await page.evaluate(meres, { rovid: ROVID, szoveg: SZOVEG, gomb: GOMB }));
  for (let i = 0; i < fulek.length; i++) {
    await fulek[i].click();
    egyesit(await page.evaluate(meres, { rovid: ROVID, szoveg: SZOVEG, gomb: GOMB }));
  }
  return mind;
}

/** A Salonic-naptar API hamis valasza a hero "Legkozelebbi szabad konzultacio" soranak kitoltesehez: a legrosszabb (leghosszabb) felirat, a kovetkezo csutortok 14:30 (2-6 nap mulva). */
export function hamisSzabadIdo() {
  const ora = (d) => new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Budapest', weekday: 'long' }).format(d);
  let d = new Date(Date.now() + 2 * 86400 * 1000);
  for (let i = 0; i < 7 && ora(d) !== 'Thursday'; i++) d = new Date(d.getTime() + 86400 * 1000);
  const ts = Math.floor(d.getTime() / 1000);
  return JSON.stringify({ status: 'success', data: { blocks: { x: { y: { slots: { a: { timestamp: ts } } } } } } });
}

export function playwright() {
  const keres = [process.env.PLAYWRIGHT_UTVONAL, path.join(GYOKER, 'node_modules'), path.join(GYOKER, '..', 'mosaic', 'node_modules')].filter(Boolean);
  for (const k of keres) { try { return createRequire(path.join(k, 'x.js'))('playwright-core'); } catch { /* kovetkezo */ } }
  throw new Error('playwright-core nem talalhato (PLAYWRIGHT_UTVONAL)');
}

// ---- parancssor ---------------------------------------------------------------------------------------------------------------------------
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const arg = (n) => (process.argv.find((x) => x.startsWith('--' + n + '=')) || '').split('=')[1];
  const UT = arg('ut') || '/noi-hajfestes-evelin-uj';
  const { szerverInditas } = await import(pathToFileURL(path.join(GYOKER, 'tools/headspa-teszt/szerver.mjs')).href);
  const { szerver, bazis } = await szerverInditas();
  const b = await playwright().chromium.launch({ executablePath: process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const jelentes = {};
  for (const szel of SZELESSEGEK) {
    const ctx = await b.newContext({ viewport: { width: szel, height: 844 }, isMobile: true, hasTouch: true, userAgent: UA_MOBIL });
    await ctx.route('**/*', (r) => {
      const u = r.request().url();
      if (u.startsWith(bazis)) return r.continue();
      if (u.includes('api.salonic.hu/calendar/getAvailableTimes')) return r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: hamisSzabadIdo() });
      return r.abort();
    });
    const p = await ctx.newPage();
    await p.goto(bazis + UT, { waitUntil: 'load' });
    jelentes[szel] = await oldalMeres(p);
    await ctx.close();
  }
  await b.close(); szerver.close();
  if (process.argv.includes('--json')) console.log(JSON.stringify(jelentes, null, 1));
  else {
    console.log('szelesseg | ROVID: vizsgalt / szigoru / arva | SZOVEG: vizsgalt / szigoru / arva');
    for (const szel of SZELESSEGEK) {
      const r = jelentes[szel], arva = (k) => r[k].talalat.filter((t) => t.arva).length;
      console.log(`${String(szel).padStart(5)} px |   ${String(r.rovid.vizsgalt).padStart(4)} / ${String(r.rovid.talalat.length).padStart(3)} / ${String(arva('rovid')).padStart(3)}            |   ${String(r.szoveg.vizsgalt).padStart(4)} / ${String(r.szoveg.talalat.length).padStart(3)} / ${String(arva('szoveg')).padStart(3)}`);
    }
    if (process.argv.includes('--reszletes')) {
      for (const szel of SZELESSEGEK) for (const k of ['rovid', 'szoveg']) for (const t of jelentes[szel][k].talalat) console.log(`[${szel}] ${k.toUpperCase()} ${t.arva ? 'ARVA ' : 'szig. '} ${t.sorok} sor, utolso (${t.utolsoSzavak} szo, ${t.arany}): "${t.utolso}"  <- ${t.elem}`);
    }
  }
  process.exit(Object.values(jelentes).some((r) => r.rovid.talalat.some((t) => t.arva)) ? 1 : 0);
}
