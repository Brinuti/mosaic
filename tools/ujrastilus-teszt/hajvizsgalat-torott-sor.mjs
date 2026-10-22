// "Megtört sor" ellenőrző a /hajvizsgalat-budapest oldalhoz (Feri alapszabálya, 2026-10-20):
//   ahol egy vagy két szó csúszik át egy új sorba, az legyen egy sor (legalábbis mobilon).
//
// Működés: a böngészőben minden szöveges blokkot (címsor, gombfelirat, jelvény, kártyacím, lista-elem, bekezdés ...) megmér: a szavakat külön-külön Range-be
// teszi, a Range.getClientRects() vertikális helyzete szerint sorokba rendezi, és megnézi, hány szó maradt az UTOLSÓ sorban. A szóközökkel elválasztott jelsorokat számolja, a nbsp-vel összekötött részek is
// külön szónak számítanak (az ezres tagolás nem: a "4 990" egy szó, a "4 990 Ft-ért" kettő).
//   - "rövid" blokk (címsor, gomb, jelvény, kártyacím, felirat, lista-elem ≤ 12 szóval ...): hiba, ha ≥ 2 soros és az utolsó sorban ≤ 2 szó van;
//   - "törzs" blokk (> 12 szó, bekezdés): hiba, ha PONTOSAN 2 soros és az utolsó sorban ≤ 2 szó van (a többsoros törzsszöveg természetes tördelése rendben van:
//     ott a `text-wrap: pretty` dolga a rövid utolsó sor; a 3+ soros eseteket csak "info"-ként listázzuk).
// A fejléc / lábléc (a közös MOSAIC-fejléc, nem ennek az oldalnak a fájlja) nincs benne: csak a <main> és a mobil sticky sáv.
//
// Használat önállóan:  PLAYWRIGHT_UTVONAL=/opt/node-tools/node_modules CHROME_UTVONAL=/opt/pw-browsers/chromium node tools/ujrastilus-teszt/hajvizsgalat-torott-sor.mjs [szélességek=360,390,412] [oldal=hajvizsgalat-budapest]
// A teszt (oxigen-hajvizsgalat.test.mjs) a `torottSorok(page)` függvényt használja.
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

// A böngészőben futó rész (page.evaluate): { talalatok: [...], info: [...], szamlalo: n }
function meres() {
  const REJT = new Set(['SCRIPT', 'STYLE', 'SVG', 'NOSCRIPT', 'TEMPLATE', 'IFRAME', 'VIDEO']);
  const lathato = (e) => {
    const r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const st = getComputedStyle(e);
    return st.visibility !== 'hidden' && st.display !== 'none';
  };
  const beagyazott = (st) => st.display === 'inline' || st.display === 'contents';
  // egy "szó" (szóközzel határolt jelsor) valódi szószáma: a nbsp-vel összekötött részek is számítanak, kivéve az ezres tagolást ("4 990" = 1 szó, "4 990 Ft-ért" = 2 szó)
  const szoSzam = (tok) => {
    const reszek = tok.split(/\u00a0/).filter(Boolean);
    let n = 0;
    for (let i = 0; i < reszek.length; i++) { n++; if (/^\d{1,3}$/.test(reszek[i]) && i + 1 < reszek.length && /^\d{3}$/.test(reszek[i + 1])) i++; }
    return Math.max(1, n);
  };
  // egy blokk saját szövegcsomópontjai (a beágyazott soron belüli elemekkel együtt, de a saját blokk-gyerekek nélkül)
  function sajatSzovegek(blokk) {
    const ki = [];
    const bejar = (n) => {
      for (const c of n.childNodes) {
        if (c.nodeType === 3) { if (/\S/.test(c.nodeValue)) ki.push(c); }
        else if (c.nodeType === 1) {
          if (REJT.has(c.nodeName.toUpperCase()) || c.hasAttribute('hidden')) continue;
          const st = getComputedStyle(c);
          if (st.display === 'none') continue;
          if (beagyazott(st)) bejar(c);   // soron belüli elem (b, span, u ...): a szövege ennek a blokknak a sorába tartozik
        }
      }
    };
    bejar(blokk);
    return ki;
  }
  function sorok(csomopontok) {
    const szavak = [];
    for (const cs of csomopontok) {
      const t = cs.nodeValue;
      const re = /[^ \t\r\n]+/g;
      let m;
      while ((m = re.exec(t))) {
        const r = document.createRange();
        r.setStart(cs, m.index); r.setEnd(cs, m.index + m[0].length);
        const rs = [...r.getClientRects()].filter((x) => x.width > 0.5 && x.height > 0.5);
        if (!rs.length) continue;
        // egy szó több sorba törhet (kötőjelnél): az első és az utolsó rect is számít
        szavak.push({ szo: m[0], elso: rs[0], utolso: rs[rs.length - 1] });
      }
    }
    // sorokba rendezés: az azonos sorban lévő szavak vertikális közepe közel van egymáshoz
    const lista = [];
    for (const sz of szavak) {
      const kozep = (sz.utolso.top + sz.utolso.bottom) / 2;
      let sor = lista.find((s) => Math.abs(s.kozep - kozep) < Math.min(s.mag, sz.utolso.height) * 0.45);
      if (!sor) { sor = { kozep, mag: sz.utolso.height, szavak: [], db: 0 }; lista.push(sor); }
      sor.szavak.push(sz.szo);
      sor.db += szoSzam(sz.szo);
    }
    lista.sort((a, b) => a.kozep - b.kozep);
    return lista;
  }
  const RACS = 'h1,h2,h3,h4,h5,h6,summary,figcaption,button,label,legend,dt,th,td,a.gomb,.cimke,.gomb,.masodlagos,.ar-badge,[class*="badge"],[class*="cimke"]';
  const gyokerek = [document.querySelector('main'), document.getElementById('sticky-cta')].filter(Boolean);
  const talalatok = [], info = [];
  let szamlalo = 0;
  const leiras = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : '');
  const szuloUt = (e) => { const ut = []; let x = e; for (let i = 0; i < 3 && x && x.tagName !== 'MAIN'; i++, x = x.parentElement) ut.push(leiras(x)); return ut.join(' < '); };
  for (const gyoker of gyokerek) {
    const mind = [gyoker, ...gyoker.querySelectorAll('*')];
    for (const e of mind) {
      if (REJT.has(e.nodeName.toUpperCase()) || e.closest('svg,script,style,template,noscript')) continue;
      const st = getComputedStyle(e);
      if (beagyazott(st)) continue;            // a soron belüli elem a szülő blokkjához tartozik
      if (!lathato(e)) continue;
      const cs = sajatSzovegek(e);
      if (!cs.length) continue;
      const sor = sorok(cs);
      if (!sor.length) continue;
      szamlalo++;
      const osszesSzo = sor.reduce((n, s) => n + s.db, 0);
      const utolso = sor[sor.length - 1];
      const rovid = osszesSzo <= 12 || e.matches(RACS) || /^H[1-6]$/.test(e.tagName);
      const rekord = { elem: leiras(e), hely: szuloUt(e), szoveg: cs.map((c) => c.nodeValue).join(' ').replace(/\s+/g, ' ').trim().slice(0, 90), sorok: sor.length, utolsoSor: utolso.szavak.join(' '), utolsoSzo: utolso.db, rovid };
      if (sor.length >= 2 && utolso.db <= 2) {
        if (rovid || sor.length === 2) talalatok.push(rekord);
        else info.push(rekord);
      }
    }
  }
  return { talalatok, info, szamlalo };
}

export async function torottSorok(page) {
  // minden betű és kép töltődjön be, a GYIK-válaszok (details) legyenek nyitva (a nyitott állapotot a végén visszaállítjuk)
  await page.evaluate(async () => {
    document.querySelectorAll('img[loading=lazy]').forEach((i) => { i.loading = 'eager'; });
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  });
  const nyitottak = await page.evaluate(() => [...document.querySelectorAll('details')].map((d) => { const o = d.open; d.open = true; return o; }));
  await page.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))));
  const eredmeny = await page.evaluate(meres);
  await page.evaluate((o) => [...document.querySelectorAll('details')].forEach((d, i) => { d.open = o[i]; }), nyitottak);
  return eredmeny;
}

// --- önálló futtatás ---------------------------------------------------------------------------------------------------------------------------
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const GYOKER = path.resolve(import.meta.dirname, '..', '..');
  const { szerverInditas } = await import(pathToFileURL(path.join(GYOKER, 'tools/headspa-teszt/szerver.mjs')).href);
  const keres = [process.env.PLAYWRIGHT_UTVONAL, path.join(GYOKER, 'node_modules')].filter(Boolean);
  let chromium;
  for (const k of keres) { try { ({ chromium } = createRequire(path.join(k, 'x.js'))('playwright-core')); break; } catch { /* következő */ } }
  if (!chromium) throw new Error('playwright-core nem található (PLAYWRIGHT_UTVONAL)');
  const szelessegek = (process.argv[2] || '360,390,412').split(',').map(Number);
  const oldal = process.argv[3] || 'hajvizsgalat-budapest';
  const UA = 'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';
  const { szerver, bazis } = await szerverInditas();
  const b = await chromium.launch({ executablePath: process.env.CHROME_UTVONAL, headless: true });
  let osszes = 0;
  for (const w of szelessegek) {
    const ctx = await b.newContext({ viewport: { width: w, height: 844 }, userAgent: UA, isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    await p.route((u) => !u.href.startsWith(bazis), (r) => r.abort());
    await p.goto(`${bazis}/${oldal}`, { waitUntil: 'domcontentloaded' });
    await p.waitForLoadState('networkidle').catch(() => {});
    const { talalatok, info, szamlalo } = await torottSorok(p);
    console.log(`\n=== ${w} px: ${szamlalo} szöveges blokk, MEGTÖRT SOR: ${talalatok.length} (rövid: ${talalatok.filter((t) => t.rovid).length}, 2 soros törzs: ${talalatok.filter((t) => !t.rovid).length}), info (3+ soros törzs, utolsó sor ≤ 2 szó): ${info.length}`);
    for (const t of talalatok) console.log(`  [${t.rovid ? 'rövid' : 'törzs'}] ${t.sorok} sor, utolsó sor: "${t.utolsoSor}" | ${t.elem} | "${t.szoveg}"`);
    for (const t of info) console.log(`  (info) ${t.sorok} sor, utolsó sor: "${t.utolsoSor}" | ${t.elem} | "${t.szoveg}"`);
    osszes += talalatok.length;
    await ctx.close();
  }
  console.log(`\nÖSSZESEN: ${osszes}`);
  await b.close(); szerver.close();
}
