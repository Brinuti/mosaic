// MOSAIC Booking Engine - a valasztokartyak kis ikonjai (24x24, vonalas; a szin a szovegszin). Statikus SVG-belsok: nem a Salonic adatai.
//
// Hajhossz-, kezeles- es testresz-ikonok: ott hasznaljuk, ahol nincs jo foto, de a kartyakat meg kell kulonboztetni (hajhosszak, kezelesek,
// lezer-csomagok testreszei). A testreszek egy kozos alakon vannak, a kiemelt resz arany (class "hl": a booking-engine.css szinezi).

const FIGURA = '<circle cx="12" cy="3.7" r="2.4"/><path d="M8 7.6h8l-1 8H9z"/><path d="M8 8.2L4.8 15M16 8.2l3.2 6.8"/><path d="M9.6 15.6L8.8 22M14.4 15.6L15.2 22"/>';
const KI = (resz) => FIGURA + resz;
// egy hajhossz-ikon: fej, a vallak / torzs vonala, a haj ket oldalszala (arany, vastag) a megadott magassagig: rovid = az allig, extra = a derekig
const HAJ = (vege) => `<circle cx="12" cy="5.3" r="2.2"/><path d="M5 22v-4.6c0-2.6 1.6-4.4 4-5.2M19 22v-4.6c0-2.6-1.6-4.4-4-5.2M9 12.2c.9.5 1.9.7 3 .7s2.1-.2 3-.7"/><path class="hl" d="M8.5 5.3V${vege}M15.5 5.3V${vege}" stroke-width="2.6"/>`;

export const IKONOK = Object.freeze({
  // --- altalanos ---
  ajandek: '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M12 9v11M4 13.5h16"/><path d="M12 9c-1.2-3.2-5-3.4-5-1.2 0 1.6 3 1.2 5 1.2zM12 9c1.2-3.2 5-3.4 5-1.2 0 1.6-3 1.2-5 1.2z"/>',
  naptar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  ora: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  csomag: '<path d="M12 3l1.9 5.4L19.5 10l-5.6 1.7L12 17l-1.9-5.3L4.5 10l5.6-1.6z"/><path d="M18.5 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
  // --- hajhossz (fej + egyre hosszabb haj; a vallvonalhoz kepest latszik a hossz) ---
  'haj-rovid': HAJ(8.6),
  'haj-felhosszu': HAJ(12.2),
  'haj-kozepes': HAJ(15.6),
  'haj-hosszu': HAJ(19),
  'haj-extra': HAJ(22.4),
  // --- fodraszati kezelesek ---
  vagas: '<circle cx="6.5" cy="6.5" r="2.5"/><circle cx="6.5" cy="17.5" r="2.5"/><path d="M8.7 7.8L20 16M8.7 16.2L20 8"/>',
  festes: '<path d="M12 3.5c3.2 4.2 5.6 6.8 5.6 10a5.6 5.6 0 0 1-11.2 0c0-3.2 2.4-5.8 5.6-10z"/><path d="M9.2 14.2a3 3 0 0 0 2.4 2.6"/>',
  tofestes: '<path d="M14.8 3.8l5.4 5.4-8.4 8.4-5.4-5.4z"/><path d="M6.4 12.2L4 20l7.8-2.4"/>',
  balayage: '<path d="M7 3.5c-1.6 4.2 1.6 6.4 0 10.5s1.6 5.4 0 6.5M12 3.5c-1.6 4.2 1.6 6.4 0 10.5s1.6 5.4 0 6.5M17 3.5c-1.6 4.2 1.6 6.4 0 10.5s1.6 5.4 0 6.5"/>',
  melir: '<path d="M5.5 3.5h5.2L9.2 20.5H4zM13.3 3.5h5.2L17 20.5h-5.2z"/><path d="M6.2 8.5h3.4M14 8.5h3.4"/>',
  szokites: '<path d="M12 3l1.9 5.4L19.5 10l-5.6 1.7L12 17l-1.9-5.3L4.5 10l5.6-1.6z"/><path d="M18.5 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
  szaritas: '<rect x="3" y="6.5" width="13" height="7" rx="3.5"/><path d="M16 8.2l4.5-1.6v6.8L16 11.8M8.3 13.5L7 20h3.6l1-6.5"/>',
  ujraepites: '<path d="M6.5 3.5c-1.6 4.2 1.6 6.4 0 10.5s1.6 5.4 0 6.5M12 3.5c-1.6 4.2 1.6 6.4 0 10.5s1.6 5.4 0 6.5"/><path d="M18.5 7.5v7M15 11h7"/>',
  haj: '<path d="M8 3.5c-2 4.3 2 6.6 0 11s2 4.2 1.5 6M13 3.5c-2 4.3 2 6.6 0 11s2 4.2 1.5 6M18 3.5c-2 4.3 2 6.6 0 11s2 4.2 1.5 6"/>',
  // --- testreszek (lezer): a kiemelt resz arany ---
  arc: KI('<circle class="hl hf" cx="12" cy="3.7" r="2.4"/>'),
  honalj: KI('<circle class="hl hf" cx="7.9" cy="9.2" r="1.7"/><circle class="hl hf" cx="16.1" cy="9.2" r="1.7"/>'),
  kar: KI('<path class="hl" d="M8 8.4L5.2 14.4M16 8.4l2.8 6" stroke-width="3.8"/>'),
  vall: KI('<path class="hl" d="M7.4 8.3h9.2" stroke-width="3.6"/>'),
  mellkas: KI('<path class="hl hf" d="M8.4 8h7.2l-.4 3.3H8.8z"/>'),
  has: KI('<path class="hl hf" d="M8.9 11.4h6.2l-.3 3.8H9.2z"/>'),
  hat: KI('<path class="hl hf" d="M8 7.6h8l-1 8H9z"/>'),
  intim: KI('<path class="hl hf" d="M9.2 14.3h5.6l-.5 2.4H9.7z"/>'),
  lab: KI('<path class="hl" d="M9.8 16L8.9 22M14.2 16L15.1 22" stroke-width="3.8"/>'),
});

/** A hajhossz-cimkebol (flow.js parseLength: "Rovid haj", "Kozepes haj", ...) az ikon neve. */
export function hajhosszIkon(length) {
  const l = String(length || '').toLowerCase();
  if (/extra/.test(l)) return 'haj-extra';
  if (/fél|fel/.test(l)) return 'haj-felhosszu';
  if (/rövid|rovid/.test(l)) return 'haj-rovid';
  if (/közepes|kozepes/.test(l)) return 'haj-kozepes';
  if (/hosszú|hosszu/.test(l)) return 'haj-hosszu';
  return 'haj';
}

/** A fodraszati kezeles nevebol (Salonic-kezelescsoport) az ikon neve. Az elso talalat nyer; ami nem ismert, az altalanos haj-ikon. */
const KEZELES_IKONOK = [
  [/szőkít|korrekci/i, 'szokites'],
  [/melír|airtouch/i, 'melir'],
  [/balayage|ombre|babylight/i, 'balayage'],
  [/tőfest/i, 'tofestes'],
  [/fest/i, 'festes'],
  [/vágás|vágas/i, 'vagas'],
];
export function kezelesIkon(title) {
  const t = String(title || '');
  const hit = KEZELES_IKONOK.find(([re]) => re.test(t));
  return hit ? hit[1] : 'haj';
}
