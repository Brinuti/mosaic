// Noi fodraszat uzletagi beallitas (wireframe: MOSAIC_Noi_Fodraszat_Booking_Engine_V1_Wireframe.md; dontesek: DECISIONS.md 17-19.)
//
// A belepo pont a fodrasz-valaszto (HA0: kepes kartyak + "mindegy"), csak utana a szolgaltatas. Nem mutatunk 40+ nyers Salonic-szolgaltatast: HA1 (mit szeretnel)
// -> HA2 (kezeles) -> HA2B (hajhossz) -> C1; a valasztott fodrasz kezeleseit mutatjuk. Az ingyenes konzultacio egyenesen C1-re megy.
// Konkret szolgaltatas landing: a fodrasz-valasztoval kezdodik (csak a szolgaltatas fodraszai), a kezelest nem kerdezzuk ujra.
// A szandekek a Salonic kategoria-nevei szerint jovahagyott csoportok (2026-10-03); amit egyik szandek sem igenyel, az az "Egyeb"-be kerul.

// A kartyak illusztracioi (a tulajdonos mintakepei: tools/booking-kepek-forras/fodrasz-minta-*.jpg -> assets/img/booking/h?-*.jpg):
// hi-* = szandekok, hk-* = kezelesek (a Salonic-kezelescsoport neve alapjan), hh-* = hajhosszok.
const KEZELES_KEPEK = [
  [/szőkít|korrekci/i, 'hk-szokites'],
  [/melír|airtouch/i, 'hk-melir'],
  [/balayage.*tőfest/i, 'hk-balayage-tofestes'],
  [/balayage|ombre|babylight/i, 'hk-balayage'],
  [/teljes festés|supernatural/i, 'hk-teljes-festes'],
  [/tőfest.*vágás/i, 'hk-tofestes-vagas-szaritas'],
  [/tőfest/i, 'hk-tofestes-szaritas'],
  [/férfi/i, 'hk-ferfi-vagas'],
  [/hajvágás/i, 'hk-noi-vagas'],
  [/joico|újraépít/i, 'hi-ujraepites'],
  [/póthaj/i, 'hi-pothaj'],
  [/szárít/i, 'hi-szaritas'],
];
/** A kezelescsoport (pl. "Tofestes + Szaritas") illusztraciojanak kulcsa; ismeretlen kezelesnel null (ikon a tartalek). */
export const kezelesKep = (title) => (KEZELES_KEPEK.find(([re]) => re.test(String(title))) || [])[1] || null;
const HOSSZ_KEPEK = { 'rövid haj': 'hh-rovid', 'félhosszú haj': 'hh-kozepes', 'közepes haj': 'hh-kozepes', 'hosszú haj': 'hh-hosszu', 'extra hosszú haj': 'hh-extra' };
const JOICO_HOSSZ_KEPEK = { 'félhosszú haj': 'hh-joico-felhosszu', 'hosszú haj': 'hh-joico-hosszu', 'extra hosszú haj': 'hh-joico-extra' };
/** A hajhossz ("Kozepes haj") illusztraciojanak kulcsa; a hajszerkezet-ujraepitesnek (JOICO) sajat, termekes kepei vannak. */
export const hajhosszKep = (intentKey, length) => { const k = String(length || '').toLowerCase(); return (intentKey === 'ujraepites' ? JOICO_HOSSZ_KEPEK[k] : null) || HOSSZ_KEPEK[k] || null; };

export const HAIR = Object.freeze({
  kezelesKep,
  hajhosszKep,
  business: 'hair',
  title: 'Időpontfoglalás',
  brand: 'MOSAIC Hair',
  enginePath: '/foglalo-motor',
  firstState: 'HA0',
  exactState: 'HA0', // konkret szolgaltatas landing: a kezelest nem kerdezzuk ujra, a fodrasz-valaszto jon
  voucherState: null,
  showStaffFilter: true, // a szakember nem kotelezo ("mindegy"); a vegen a Salonic-kartonon es a sikerkepernyon is latszik
  staffFirst: true, // a fodrasz-valasztas a legelejen van: a kezeles-valasztas nem torli
  // az alap (egyeni CSS nelkuli) Salonic-kinezethez: az "elkuldes" gomb alja 1532 px, a Salonic suti-savja ~197 px, a lablec 1679 px-nel kezdodik
  // (ugyanaz, mint az Oxigennel); a kozos CSS-sel a motor a tomor meretet hasznalja
  frame: Object.freeze({ crop: 100, visible: 1653 }),
  intents: Object.freeze([
    { key: 'balayage', title: 'Balayage / szőkítés', kep: 'hi-balayage', categories: Object.freeze(['Balayage', 'Teljes szőkítés', 'Teljes melír / airtouch + vágás']) },
    { key: 'color', title: 'Hajfestés', kep: 'hi-festes', categories: Object.freeze(['Tőfestés + szárítás', 'Tőfestés + vágás + szárítás', 'Elrontott festés korrekció / Teljes festés']) },
    { key: 'cut', title: 'Hajvágás', kep: 'hi-vagas', categories: Object.freeze(['Női hajvágás + szárítás', 'Férfi hajvágás']) },
    // az "Egyeb fodraszati szolgaltatas" elemei kulon kartyak (nem kell kulon "egyeb" lepes)
    { key: 'szaritas', title: 'Női szárítás', kep: 'hi-szaritas', categories: Object.freeze(['Női szárítás']) },
    { key: 'ujraepites', title: 'Hajszerkezet újraépítés', kep: 'hi-ujraepites', categories: Object.freeze(['Hajszerkezet újraépítés']) },
    { key: 'pothaj', title: 'Póthaj', kep: 'hi-pothaj', categories: Object.freeze(['Póthaj']) },
    // az ismeretlen (uj) Salonic-kategoriak ide kerulnek, hogy ne vesszenek el; amig nincs ilyen, a kartya nem jelenik meg
    { key: 'other', title: 'Egyéb fodrászati szolgáltatás', ikon: 'haj', categories: Object.freeze([]), catchAll: true },
    { key: 'unsure', title: 'Nem tudom pontosan', sub: 'Ingyenes konzultáció', kep: 'hi-konzultacio', consult: true },
  ]),
  // a fodraszok fotoi (a site sajat kepei, tools/booking-kepek.json); akinek nincs, annak monogram jelenik meg
  staffPhotos: Object.freeze([[/betti/i, 'staff-betti'], [/noel/i, 'staff-noel'], [/evelin/i, 'staff-evelin']]),
  copy: Object.freeze({
    introTitle: 'Mit szeretnél?',
    groupTitle: 'Melyik kezelés?',
    lengthTitle: 'Milyen hosszú a hajad?',
    staffListTitle: 'Melyik fodrászt választod?',
    staffAny: 'Mindegy – a legkorábbi időpont érdekel',
  }),
});
