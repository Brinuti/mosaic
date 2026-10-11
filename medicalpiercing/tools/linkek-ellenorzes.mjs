// A weboldal OSSZES foglalasi linkjenek atnezese: melyik link mit nyit meg a foglalomotorban (a motor-indito.js sajat osztalyozasaval).
//   node tools/linkek-ellenorzes.mjs [--reszletes]
// Foglalasi link: medicalpiercing.salonic.hu foglalo-oldalai, /idopontfoglalas, /kontroll (asztali + mobil lapok, klon/ + klon/m/).
// Kimenet: osztalyonkent (tipus-valaszto / urlap: Kontroll, Ekszercsere, Garancia / a Salonicra megy) a linkek szama es a leggyakoribb szovegek;
// gyanus: a "kontroll / garancia / ekszer" szavas link, amely a tipus-valasztot nyitja, vagy az urlap-tipus, amelynek szovege nem emliti (a /kontroll cim dont).
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(import.meta.dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'assets/js/motor-indito.js'), 'utf8');
// a motor-indito.js sajat fuggvenyeit futtatjuk (nem masolat): szoveg(), urlapTipus(), NEM_FOGLALAS, FOGLALO, KIZART, BELSO
const reszlet = (a, b) => src.slice(src.indexOf(a), src.indexOf(b));
const kod = [reszlet('  var FOGLALO =', '  var foglalasiLink'), reszlet('  var BELSO =', '  var belsoLink'), reszlet('  var szoveg =', '  var regiOldal')].join('\n');
const motor = new Function('return (function(){ var location = { origin: "https://www.medicalpiercing.hu", pathname: "/" };\n' + kod + '\n return { FOGLALO: FOGLALO, KIZART: KIZART, BELSO: BELSO, szoveg: szoveg, urlapTipus: urlapTipus, NEM_FOGLALAS: NEM_FOGLALAS }; })();')();
const ORIGIN = 'https://www.medicalpiercing.hu';
const bontas = (html) => [...html.matchAll(/<a\b([^>]*?)href="([^"]*)"([^>]*)>([\s\S]*?)<\/a>/g)].map((m) => ({ href: m[2].replace(/&amp;/g, '&'), szoveg: m[4].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').replace(/​/g, '').trim(), attr: m[1] + ' ' + m[3] }));
const fakeA = (l) => ({ textContent: l.szoveg, getAttribute: (k) => (k === 'aria-label' ? (/aria-label="([^"]*)"/.exec(l.attr) || [])[1] || '' : k === 'title' ? (/title="([^"]*)"/.exec(l.attr) || [])[1] || '' : null) });
const osztaly = (l) => {
  let u; try { u = new URL(l.href, ORIGIN + '/'); } catch (e) { return null; }
  const belso = u.origin === ORIGIN && motor.BELSO.test(u.pathname);
  const salonic = u.hostname === 'medicalpiercing.salonic.hu' && !motor.KIZART.test(u.pathname) && motor.FOGLALO.test(u.pathname);
  if (!belso && !salonic) return null;
  const a = fakeA(l);
  if (salonic && motor.NEM_FOGLALAS.test(motor.szoveg(a))) return { kulcs: 'a Salonicra megy (modositas / lemondas)', cel: u.pathname };
  const t = motor.urlapTipus(a, u);
  return { kulcs: t ? 'urlap: ' + t : 'tipus-valaszto', cel: belso ? u.pathname : 'salonic' + u.pathname.replace(/\/$/, ''), tipus: t };
};
const oszt = new Map(), gyanus = [];
let osszes = 0, lapok = 0;
for (const mappa of ['klon', 'klon/m']) for (const f of fs.readdirSync(path.join(ROOT, mappa)).filter((x) => x.endsWith('.html'))) {
  if (/^regi-|-regi\b/.test(f)) continue;
  lapok++;
  for (const l of bontas(fs.readFileSync(path.join(ROOT, mappa, f), 'utf8'))) {
    const o = osztaly(l); if (!o) continue;
    osszes++;
    const e = oszt.get(o.kulcs) || { db: 0, szovegek: new Map() }; e.db++; e.szovegek.set(l.szoveg || '(ures)', (e.szovegek.get(l.szoveg || '(ures)') || 0) + 1); oszt.set(o.kulcs, e);
    const t = motor.szoveg(fakeA(l));
    if (o.kulcs === 'tipus-valaszto' && /kontrol|garanci|ekszer\s*cser/.test(t)) gyanus.push(`${mappa}/${f}: "${l.szoveg}" -> ${l.href} (kontroll/garancia/ekszercsere szo, de a tipus-valasztot nyitja)`);
    if (o.tipus && !/kontrol|garanci|ekszer\s*cser/.test(t)) gyanus.push(`${mappa}/${f}: "${l.szoveg || '(ures)'}" -> ${l.href} (az urlapot nyitja (${o.tipus}) csak a cime miatt, a szovege nem emliti)`);
  }
}
console.log(`${lapok} lap, ${osszes} foglalasi link\n`);
for (const [k, e] of [...oszt.entries()].sort((a, b) => b[1].db - a[1].db)) {
  console.log(`${String(e.db).padStart(5)}  ${k}`);
  const top = [...e.szovegek.entries()].sort((a, b) => b[1] - a[1]).slice(0, process.argv.includes('--reszletes') ? 40 : 6);
  for (const [sz, n] of top) console.log(`         ${String(n).padStart(4)}x  ${sz.slice(0, 80)}`);
}
const egyedi = [...new Set(gyanus.map((x) => x.replace(/^[^:]+: /, '')))];
console.log(`\ngyanus: ${egyedi.length ? egyedi.length + ' egyedi link' : 'nincs'}`);
for (const g of egyedi.slice(0, 40)) console.log('  - ' + g);
