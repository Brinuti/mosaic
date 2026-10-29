// A "megtalalt foglalasok (kesobb visszatero latogatok)" riport a dashboardhoz: a meres_forras tablabol (D1 KULCS_DB, docs/booking-engine/FORRAS_LPT.md).
// CSAK SQL-eloallito es JSON-formazo: a D1-et NEM eri el (a lekerdezest a tulajdonos / az elemzo futtatja, pl. wrangler d1 execute --json vagy a Cloudflare D1 konzol).
//
//   node tools/lpt-riport-sql.mjs sql --tol 2026-10-01 --ig 2026-11-01 [--uzletag headspa] [--tipus foglalas] [--lekerdezes megtalalt|megoszlas|kesei|potolt|cimkek|mind]
//       -> a D1-ben futtathato SELECT-ek (alapbol mind); az idoszak [tol, ig) a foglalas koszonooldali jelzesenek ideje (UTC, datum vagy unix masodperc)
//   node tools/lpt-riport-sql.mjs formaz --bemenet eredmeny.json [--min 3] [--formatum json|tsv|md]
//       -> a "megtalalt" lekerdezes eredmenyenek (sorok tombje | { results: [...] } | wrangler --json kimenet) formazasa; a kis cellak (darab < --min, alapbol 3) osszevonasa
//
// "Megtalalt foglalas" = bizonyitek_forras = 'suti' (a latogatasban nem volt fizetett erintes, a 7 napon beluli fizetett kattintas a sutibol adta a cimket) es a cimke fizetett (nem organikus / ismeretlen).
// Csoportositas: uzletag -> platform -> kampany (utm_campaign, ennek hianyaban gad_campaignid / Metanal utm_id) -> hirdetes (utm_content, ennek hianyaban adid / ad_id); darab + a kattintas kora napokban (atlag / min / max).
// A kis cellak osszevonasa az egyes foglalasok azonosithatosagat csokkenti (a riportban csak aggregatum jelenik meg).
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const UZLETAGOK = ['headspa', 'fodrasz', 'oxigen', 'szor', 'pmu'];
export const TIPUSOK = ['foglalas', 'ajandekkartya'];
export const LEKERDEZESEK = ['megtalalt', 'megoszlas', 'kesei', 'potolt', 'cimkek'];
export const ALAP_MIN = 3;

/** "2026-10-01" (UTC 00:00) | unix masodperc (szam / szoveg) -> egesz unix masodperc, vagy hiba. */
export function idoErtek(v, nev = 'ido') {
  const s = String(v ?? '').trim();
  let n;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) n = Date.parse(s + 'T00:00:00Z') / 1000;
  else if (/^\d{9,11}$/.test(s)) n = Number(s);
  else throw new Error(`${nev}: "YYYY-MM-DD" datum vagy unix masodperc kell`);
  if (!Number.isInteger(n) || n < 1600000000 || n > 4102444800) throw new Error(`${nev}: ervenytelen ido`);
  return n;
}

/** Az idoszak es a szuro feltetele (kizarolag ellenorzott ertekekbol: nincs injektalhato szoveg). */
export function felteteles({ tol, ig, uzletag = null, tipus = 'foglalas' } = {}) {
  const t0 = idoErtek(tol, 'tol'), t1 = idoErtek(ig, 'ig');
  if (t1 <= t0) throw new Error('ig: a tol utan kell legyen');
  if (uzletag != null && !UZLETAGOK.includes(uzletag)) throw new Error('uzletag: ' + UZLETAGOK.join(' | '));
  if (tipus != null && !TIPUSOK.includes(tipus)) throw new Error('tipus: ' + TIPUSOK.join(' | '));
  return [`ido >= ${t0}`, `ido < ${t1}`, ...(tipus ? [`tipus = '${tipus}'`] : []), ...(uzletag ? [`uzletag = '${uzletag}'`] : [])];
}

const KAMPANY = "COALESCE(utm_campaign, gad_campaignid, '(nincs)')";
const HIRDETES = "COALESCE(utm_content, adid, '(nincs)')";

/** A hat lekerdezes (a megtalalt foglalasok + a segedek). */
export function sqlek(opt) {
  const w = felteteles(opt).join(' AND ');
  return {
    megtalalt: `-- megtalalt foglalasok (kesobb visszatero latogatok): bizonyitek_forras = 'suti', fizetett cimke; uzletag -> platform -> kampany -> hirdetes
SELECT uzletag, platform, ${KAMPANY} AS kampany, ${HIRDETES} AS hirdetes, COUNT(*) AS darab,
       ROUND(AVG(kattintas_kor_nap), 2) AS atlag_kor_nap, MIN(kattintas_kor_nap) AS min_kor_nap, MAX(kattintas_kor_nap) AS max_kor_nap
FROM meres_forras
WHERE ${w} AND bizonyitek_forras = 'suti' AND forras_cimke NOT IN ('organikus_direkt', 'ismeretlen')
GROUP BY uzletag, platform, kampany, hirdetes
ORDER BY uzletag, platform, darab DESC, kampany, hirdetes;`,
    megoszlas: `-- mennyit hoz a suti: bizonyitek-forras szerinti megoszlas uzletagankent (NULL = nincs bizonyitek)
SELECT uzletag, COALESCE(bizonyitek_forras, '(nincs)') AS bizonyitek_forras, COUNT(*) AS darab
FROM meres_forras
WHERE ${w}
GROUP BY uzletag, bizonyitek_forras
ORDER BY uzletag, darab DESC;`,
    kesei: `-- kesei fizetett kattintas (8-30 napos): a cimke nem valtozott, csak jelzes
SELECT uzletag, COALESCE(kesei_fizetett_platform, '(nincs)') AS platform, COUNT(*) AS darab,
       ROUND(AVG(kesei_kor_nap), 2) AS atlag_kor_nap, MIN(kesei_kor_nap) AS min_kor_nap, MAX(kesei_kor_nap) AS max_kor_nap
FROM meres_forras
WHERE ${w} AND kesei_fizetett = 1
GROUP BY uzletag, platform
ORDER BY uzletag, darab DESC;`,
    potolt: `-- a sutibol potolt kattintasazonositok (klikk_potolt: melyik tipus(ok) potlodtak a foglalo-atadasnal / a shadow-lanc attr-jaban)
SELECT uzletag, klikk_potolt, COUNT(*) AS darab
FROM meres_forras
WHERE ${w} AND klikk_potolt IS NOT NULL AND klikk_potolt NOT IN ('0', 'nem_mentve')
GROUP BY uzletag, klikk_potolt
ORDER BY uzletag, darab DESC;`,
    cimkek: `-- a vegso forras-cimkek (zart lista) bizonyitek-forrasonkent
SELECT uzletag, forras_cimke, COALESCE(bizonyitek_forras, '(nincs)') AS bizonyitek_forras, COUNT(*) AS darab
FROM meres_forras
WHERE ${w}
GROUP BY uzletag, forras_cimke, bizonyitek_forras
ORDER BY uzletag, forras_cimke, darab DESC;`,
  };
}

// ---------- a "megtalalt" eredmeny formazasa, kis cellak osszevonasa ----------
/** Sorok tombje | { results } | [{ results }] (wrangler --json) -> sorok tombje. */
export function sorokBol(be) {
  if (Array.isArray(be) && be.length && be[0] && Array.isArray(be[0].results)) return be.flatMap((x) => x.results || []);
  if (Array.isArray(be)) return be;
  if (be && Array.isArray(be.results)) return be.results;
  throw new Error('ismeretlen bemenet: sorok tombje vagy { results: [...] } kell');
}
const szam = (v) => (v == null || v === '' ? null : Number(v));
function osszevon(sorok, uj) { // sulyozott atlag, min / max; a darab osszeadodik
  const db = sorok.reduce((a, s) => a + s.darab, 0);
  const sulyozott = sorok.filter((s) => s.atlag_kor_nap != null);
  const sulyDb = sulyozott.reduce((a, s) => a + s.darab, 0);
  const mins = sorok.map((s) => s.min_kor_nap).filter((x) => x != null), maxs = sorok.map((s) => s.max_kor_nap).filter((x) => x != null);
  return { ...uj, darab: db, atlag_kor_nap: sulyDb ? Math.round(sulyozott.reduce((a, s) => a + s.atlag_kor_nap * s.darab, 0) / sulyDb * 100) / 100 : null,
    min_kor_nap: mins.length ? Math.min(...mins) : null, max_kor_nap: maxs.length ? Math.max(...maxs) : null, osszevont: true };
}
/**
 * Kis cellak (darab < min) osszevonasa ket lepcsoben: (1) azonos uzletag + platform + kampany hirdeteseibol "(egyeb hirdetesek)"; (2) azonos uzletag + platform kampanyaibol "(egyeb kampanyok)".
 * min <= 1: nincs osszevonas. Az osszevont cella is lehet kicsi (kicsi: true): az osszegek igy is megmaradnak.
 */
export function kisCellakOsszevonasa(sorok, min = ALAP_MIN) {
  let l = sorokBol(sorok).map((s) => ({ uzletag: s.uzletag, platform: s.platform ?? null, kampany: s.kampany ?? '(nincs)', hirdetes: s.hirdetes ?? '(nincs)', darab: Number(s.darab), atlag_kor_nap: szam(s.atlag_kor_nap), min_kor_nap: szam(s.min_kor_nap), max_kor_nap: szam(s.max_kor_nap) }));
  if (min > 1) {
    const lepes = (lista, kulcs, uj) => { // a kis cellakat a kulcs szerint csoportositva osszevonja
      const nagy = lista.filter((s) => s.darab >= min), kicsi = lista.filter((s) => s.darab < min), csop = new Map();
      for (const s of kicsi) { const k = kulcs(s); (csop.get(k) || csop.set(k, []).get(k)).push(s); }
      return [...nagy, ...[...csop.values()].map((g) => osszevon(g, uj(g[0])))];
    };
    l = lepes(l, (s) => `${s.uzletag}|${s.platform}|${s.kampany}`, (s) => ({ uzletag: s.uzletag, platform: s.platform, kampany: s.kampany, hirdetes: '(egyeb hirdetesek)' }));
    l = lepes(l, (s) => `${s.uzletag}|${s.platform}`, (s) => ({ uzletag: s.uzletag, platform: s.platform, kampany: '(egyeb kampanyok)', hirdetes: '(osszevont)' }));
  }
  return l.map((s) => ({ ...s, kicsi: s.darab < min && min > 1 })).sort((a, b) => a.uzletag.localeCompare(b.uzletag) || String(a.platform).localeCompare(String(b.platform)) || b.darab - a.darab || a.kampany.localeCompare(b.kampany) || a.hirdetes.localeCompare(b.hirdetes));
}
export function tablaSzoveg(sorok, { formatum = 'tsv' } = {}) {
  const oszlop = ['uzletag', 'platform', 'kampany', 'hirdetes', 'darab', 'atlag_kor_nap', 'min_kor_nap', 'max_kor_nap'];
  const sor = (s) => oszlop.map((k) => (s[k] == null ? '' : String(s[k])));
  if (formatum === 'md') return ['| ' + oszlop.join(' | ') + ' |', '|' + oszlop.map(() => '---').join('|') + '|', ...sorok.map((s) => '| ' + sor(s).join(' | ') + ' |')].join('\n');
  return [oszlop.join('\t'), ...sorok.map((s) => sor(s).join('\t'))].join('\n');
}

// ---------- parancssor ----------
function argok(argv) {
  const o = {}; const poz = [];
  for (let i = 0; i < argv.length; i++) { if (argv[i].startsWith('--')) { o[argv[i].slice(2)] = argv[i + 1]; i++; } else poz.push(argv[i]); }
  return { o, poz };
}
export function fo(argv) {
  const { o, poz } = argok(argv);
  const parancs = poz[0];
  if (parancs === 'sql') {
    const q = sqlek({ tol: o.tol, ig: o.ig, uzletag: o.uzletag || null, tipus: o.tipus === undefined ? 'foglalas' : o.tipus });
    const mit = o.lekerdezes || 'mind';
    if (mit !== 'mind' && !LEKERDEZESEK.includes(mit)) throw new Error('lekerdezes: ' + [...LEKERDEZESEK, 'mind'].join(' | '));
    return (mit === 'mind' ? LEKERDEZESEK : [mit]).map((k) => q[k]).join('\n\n');
  }
  if (parancs === 'formaz') {
    if (!o.bemenet) throw new Error('--bemenet kell');
    const min = o.min === undefined ? ALAP_MIN : Number(o.min);
    if (!Number.isInteger(min) || min < 0) throw new Error('--min: nem negativ egesz');
    const sorok = kisCellakOsszevonasa(JSON.parse(fs.readFileSync(o.bemenet, 'utf8')), min);
    const f = o.formatum || 'json';
    if (!['json', 'tsv', 'md'].includes(f)) throw new Error('--formatum: json | tsv | md');
    return f === 'json' ? JSON.stringify({ min, sorok }, null, 2) : tablaSzoveg(sorok, { formatum: f });
  }
  throw new Error('hasznalat: lpt-riport-sql.mjs sql --tol <datum|unix> --ig <datum|unix> [--uzletag ..] [--tipus ..] [--lekerdezes ..] | formaz --bemenet <fajl> [--min 3] [--formatum json|tsv|md]');
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { console.log(fo(process.argv.slice(2))); } catch (e) { console.error(String(e.message || e)); process.exit(2); }
}
