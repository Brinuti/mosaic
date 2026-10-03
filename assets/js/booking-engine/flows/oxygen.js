// Oxigenterapia uzletagi beallitas (wireframe: MOSAIC_Oxigenterapia_Booking_Engine_V1_Wireframe.md; dontesek: DECISIONS.md)
//
// A legrovidebb folyamat, nincs felesleges kvalifikalo kerdes: OX1 (mit szeretnel foglalni) -> C1 (legkozelebbi idopontok).
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
  voucherState: null, // nincs ajandekkartya-ag
  giftCardUrl: null,
  showStaffFilter: true, // a szakember nem kotelezo: alapbol "barmely megfelelo", a naptarban valaszthato
  intents: Object.freeze([
    { key: 'camera', title: 'Hajkamerás vizsgálat', sub: 'Ha először szeretnéd megtudni, mire lehet szüksége a fejbőrödnek.', test: (s) => s.bookingType === 'consultation' },
    { key: 'first', title: 'Első oxigénterápiás kezelés', test: (s) => s.bookingType === 'first_treatment' },
    { key: 'returning', title: 'Már jártam nálatok', sub: 'Következő kezelés', test: (s) => s.bookingType === 'returning_treatment' },
  ]),
  copy: Object.freeze({
    introTitle: 'Mit szeretnél foglalni?',
    variantTitle: 'Melyiket választod?',
  }),
});
