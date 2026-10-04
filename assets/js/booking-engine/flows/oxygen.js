// Oxigenterapia uzletagi beallitas (wireframe: MOSAIC_Oxigenterapia_Booking_Engine_V1_Wireframe.md; dontesek: DECISIONS.md)
//
// A legrovidebb folyamat, nincs felesleges kvalifikalo kerdes: OX1 (mit szeretnel foglalni) -> OXS (szakember, kepes kartyak) -> C1 (idopont-naptar).
// A szandekeket a business-config besorolasa (bookingType) valasztja szet, nem azonositolista: igy az uj Salonic-szolgaltatas
// (pl. a hajkamera-vizsgalat) magatol bekerul. Ha egy szandekhoz tobb szolgaltatas tartozik, az engine rovid valasztast kinal (OX2).

export const OXYGEN = Object.freeze({
  business: 'oxygen',
  title: 'Időpontfoglalás',
  brand: 'MOSAIC Oxigénterápia',
  enginePath: '/foglalo-motor',
  // A Salonic adatlap (iframe) latszo magassaga mobil elrendezesben: az "elkuldes" gomb alja 1532 px (a fiokban Facebook-belepes is van);
  // a Salonic sajat suti-savja (~197 px) az iframe aljara fekszik, ezert gomb + 24 px + a sav magassaga kell (a lablec 1679 px-nel kezdodik).
  frame: Object.freeze({ crop: 100, visible: 1653 }), // az alap (egyeni CSS nelkuli) Salonic-kinezethez; a MOSAIC kozos CSS-sel a motor a tomor meretet hasznalja
  firstState: 'OX1',
  exactState: 'OXS', // konkret szolgaltatas landing: a szakember-valaszto jon (az idopont elott)
  afterService: 'OXS', // a szolgaltatas utan a szakember-valaszto, csak utana az idopont
  voucherState: null, // nincs ajandekkartya-ag
  showStaffFilter: true, // a szakember nem kotelezo: alapbol "barmely megfelelo", az idopont-naptar fole kerul egy szakember-valaszto
  // az oxigen-szakemberek fotoi a Salonic fiok szakember-oldalarol (tools/booking-kepek-forras/); ujabb szakember fotoja nelkul monogram jelenik meg
  staffPhotos: Object.freeze([[/tündi|tundi/i, 'staff-oxigen-tundi'], [/vivien/i, 'staff-oxigen-vivien'], [/móni|moni/i, 'staff-oxigen-moni']]),
  intents: Object.freeze([
    { key: 'camera', title: 'Hajkamerás vizsgálat', sub: 'Megnézzük a fejbőröd állapotát + átbeszéljük milyen eredményt várhatsz', kep: 'ox-camera', test: (s) => s.bookingType === 'consultation' },
    { key: 'first', title: 'Első oxigénterápiás kezelés', kep: 'ox-first', test: (s) => s.bookingType === 'first_treatment' },
    { key: 'returning', title: 'Már jártam nálatok', sub: 'Következő kezelés', kep: 'ox-returning', test: (s) => s.bookingType === 'returning_treatment' },
  ]),
  copy: Object.freeze({
    introTitle: 'Mit szeretnél foglalni?',
    variantTitle: 'Melyiket választod?',
    staffListTitle: 'Melyik szakembert választod?',
    staffAny: 'Mindegy – a legkorábbi időpont érdekel',
  }),
});
