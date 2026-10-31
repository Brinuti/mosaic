// A foglalas oldal ("A foglalasod") varhato idotartama: a Salonic szolgaltatas-idotartamabol (perc), +10 percig: "kb. 10–20 perc" (egy piercing),
// "kb. 15–25 perc" (3 piercing), "kb. 30–40 perc" (2 szemelynek 6 db). UGYANAZ a szabaly, mint a leveleknel (../netlify/lib/lifecycle/uzletag.js mpLatogatas,
// a Salonic-pillanatkepbol: ../netlify/lib/lifecycle/szolgaltatasok-mp.js). A tulajdonos jelezte (2026-10-19, 2026-10-29): egy piercing beszurasa nem
// 40–50 perc; az elozo, kitalalt "30–40 / 40–50 perc" hibas volt. Ismeretlen szolgaltatasnal null: az idotartam-sor kimarad (nem talalunk ki szamot).
// A projekt gyokere a medicalpiercing/ mappa, ezert a lista ide van masolva; a tools/test-mp-idotartam.mjs a tukrozest ellenorzi.
export const MP_PERC = Object.freeze([
  ['🔥 3 PIERCING - A HARMADIK 5.000 Ft!🔥', 15],
  ['🔥 2 PIERCING A 2.FÉLÁRON! 🔥', 10],
  ['👭 2 személynek - 2 db piercing', 15],
  ['👭 2 személynek - 4 db piercing', 25],
  ['👭 2 személynek - 6 db piercing', 30],
  ['1 db Fejfájás / Migrén Piercing', 10],
  ['1 db Shenmen / Stressz Piercing', 10],
  ['1 db Klimax- / Változókor piercing', 10],
  ['1 db Slim- / Étvágycsökkentő piercing', 10],
  ['1+1 db Allergia piercing', 10],
  ['1 db Máj Piercing', 10],
  ['1 db Vastagbél Piercing', 10],
  ['1 db Lép Piercing', 10],
  ['1 db Allergia Piercing', 10],
  ['1 db Pajzsmirigy Piercing', 10],
  ['1 db Fülbevaló- / Divat fülpiercing szúrás', 10],
  ['2 db Fülbevaló- / Divat fülpiercing szúrás', 10],
  ['3 db Fülbevaló- / Divat fülpiercing szúrás', 15],
]);
const norm = (s) => String(s || '').normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const PERC = new Map(MP_PERC.map(([nev, perc]) => [norm(nev), perc]));
/** "kb. 10–20 perc" vagy null (ismeretlen szolgaltatas). */
export function latogatasHossza(szolgaltatas) {
  const perc = PERC.get(norm(szolgaltatas));
  return Number.isFinite(perc) && perc > 0 ? `kb. ${perc}–${perc + 10} perc` : null;
}
