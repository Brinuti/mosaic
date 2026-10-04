// Noi fodraszat uzletagi beallitas (wireframe: MOSAIC_Noi_Fodraszat_Booking_Engine_V1_Wireframe.md; dontesek: DECISIONS.md 17-19.)
//
// A belepo pont a fodrasz-valaszto (HA0: kepes kartyak + "mindegy"), csak utana a szolgaltatas. Nem mutatunk 40+ nyers Salonic-szolgaltatast: HA1 (mit szeretnel)
// -> HA2 (kezeles) -> HA2B (hajhossz) -> C1; a valasztott fodrasz kezeleseit mutatjuk. Az ingyenes konzultacio egyenesen C1-re megy.
// Konkret szolgaltatas landing: a fodrasz-valasztoval kezdodik (csak a szolgaltatas fodraszai), a kezelest nem kerdezzuk ujra.
// A szandekek a Salonic kategoria-nevei szerint jovahagyott csoportok (2026-10-03); amit egyik szandek sem igenyel, az az "Egyeb"-be kerul.

export const HAIR = Object.freeze({
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
    { key: 'balayage', title: 'Balayage / szőkítés', kep: 'hair-balayage', categories: Object.freeze(['Balayage', 'Teljes szőkítés', 'Teljes melír / airtouch + vágás']) },
    { key: 'color', title: 'Hajfestés', kep: 'hair-color', categories: Object.freeze(['Tőfestés + szárítás', 'Tőfestés + vágás + szárítás', 'Elrontott festés korrekció / Teljes festés']) },
    { key: 'cut', title: 'Hajvágás', kep: 'hair-cut', categories: Object.freeze(['Női hajvágás + szárítás', 'Férfi hajvágás']) },
    { key: 'other', title: 'Egyéb fodrászati szolgáltatás', kep: 'hair-other', categories: Object.freeze(['Női szárítás', 'Hajszerkezet újraépítés', 'Póthaj']), catchAll: true },
    { key: 'unsure', title: 'Nem tudom pontosan', sub: 'Ingyenes konzultáció', kep: 'hair-consult', consult: true },
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
