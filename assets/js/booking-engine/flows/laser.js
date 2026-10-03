// Lezeres szortelenites uzletagi beallitas (wireframe: MOSAIC_Lezeres_Szortelenites_Booking_Engine_V1_Wireframe.md; dontesek: DECISIONS.md 20-22.)
//
// LA1 (Melyik ut illik rad?) -> konzultacio: egyenesen C1 | "Mar tudom" -> LA2 (terulet) -> LA2B (kezeles) -> C1 |
// "Mar jarok kezelesre" -> LA3 (terulet) -> LA2B (kezeles, a 2. alkalomtol arakkal) -> C1. Teljes Salonic-listat nem mutatunk.
// A Salonic nevei elotaggal kezdodnek (ARC -, TEST -, INTIM -, LABAK -, FERFI -, EGYEB -, AKCIO -): ebbol a teruletet olvassuk ki
// (jovahagyott csoportositas, 2026-10-03). Ami egyik teruletbe sem esik (csomagok, egyeb testresz), az a "Tobb terulet".
// A teruletnek nincs azonositolistaja: uj Salonic-szolgaltatas a neve alapjan magatol bekerul.

import { displayName } from '../flow.js';

export const AREAS = Object.freeze([
  { key: 'arc', title: 'Arc', test: (n) => /^ARC\s*-/i.test(n) },
  { key: 'honalj', title: 'Hónalj', test: (n) => /^TEST\s*-.*hónalj/i.test(n) },
  { key: 'kar', title: 'Kar', test: (n) => /^TEST\s*-/i.test(n) }, // a hónalj után: Alkar, Felkar, Teljes kar
  { key: 'intim', title: 'Intim', test: (n) => /^INTIM\s*-/i.test(n) },
  { key: 'lab', title: 'Láb', test: (n) => /^LÁBAK\s*-/i.test(n) },
  { key: 'torzs', title: 'Törzs', test: (n) => /^FÉRFI\s*-/i.test(n) },
  { key: 'tobb', title: 'Több terület', test: () => true }, // akciós csomagok, egyedi csomag, egyéb testrészek
]);

export const areaOf = (service) => AREAS.find((a) => a.test(displayName(service.name)));

const PREFIX = /^(ARC|TEST|INTIM|LÁBAK|FÉRFI|EGYÉB)\s*-\s*/i;
const ASSESS = /\s*\+?\s*állap\w*felmérés/i; // a Salonic neveiben "allapofelmeres" es "allapotfelmeres" is van
const PCT = /\s*-?\s*(\d{1,2})\s*%\s*kedvezménnyel/i;
const FIXED = /\s*-\s*([\d.]+)\s*FT\s*KEDVEZMÉNNYEL/i;

/** A Salonic nevebol tiszta cim + cimkek: "ARC - Teljes arc + allapofelmeres -20% kedvezmennyel" -> { title: "Teljes arc", tags: ["állapotfelméréssel", "20% kedvezménnyel"] }. */
export function labelOf(service) {
  let t = displayName(service.name).replace(PREFIX, '').replace(/^AKCIÓ\s*-\s*/i, '');
  const tags = [];
  if (ASSESS.test(t)) { tags.push('állapotfelméréssel'); t = t.replace(ASSESS, ''); }
  let m = t.match(PCT);
  if (m) { tags.push(`${m[1]}% kedvezménnyel`); t = t.replace(PCT, ''); }
  m = t.match(FIXED);
  if (m) { tags.push(`${m[1].replace(/\./g, ' ')} Ft kedvezménnyel`); t = t.replace(FIXED, ''); }
  t = t.replace(/\s*[-+]\s*$/, '').replace(/\s+/g, ' ').trim();
  return { title: t, tags };
}

export const LASER = Object.freeze({
  business: 'laser',
  title: 'Időpontfoglalás',
  brand: 'MOSAIC Lézeres szőrtelenítés',
  enginePath: '/foglalo-motor',
  firstState: 'LA1',
  voucherState: null,
  giftCardUrl: null,
  showStaffFilter: false, // egyetlen kezelo (Elysion Pro Szortelenites): nincs mit valasztani
  zeroPriceLabel: 'Egyedi ár', // az egyedi csomag Salonic-ara 0 Ft (a vegso arat a helyszinen allitjak): a vendeg ne 0 Ft-ot lasson
  // az alap (egyeni CSS nelkuli) Salonic-kinezethez: az "elkuldes" gomb alja 1468 px + 24 px + a Salonic suti-savja (~197 px); a lablec 1615 px-nel kezdodik
  frame: Object.freeze({ crop: 100, visible: 1589 }),
  areas: AREAS,
  areaOf,
  labelOf,
  copy: Object.freeze({
    introTitle: 'Melyik út illik rád?',
    intro: Object.freeze([
      { key: 'consult', title: 'Ingyenes konzultációt kérek', sub: 'Ha még nem tudod pontosan, melyik terület vagy kezelés megfelelő.' },
      { key: 'known', title: 'Már tudom, mit szeretnék' },
      { key: 'returning', title: 'Már járok kezelésre' },
    ]),
    areaTitle: 'Melyik területet szeretnéd?',
    returningTitle: 'Következő kezelés: melyik terület?',
    treatmentTitle: 'Válaszd ki a pontos kezelést',
  }),
});
