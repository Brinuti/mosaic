// HeadSpa uzletagi beallitas (a tulajdonos dontesei: docs/booking-engine/DECISIONS.md, 5-12. pont)
//
// A kartyak szoveges kulcsai csak azt mondjak meg, melyik Salonic-szolgaltatas melyik kartyara kerul; az ar, az idotartam
// es az azonosito mindig a Salonicbol jon (nincs beleegetve). Ami nem talalhato a Salonicban, nem jelenik meg.

export const HEADSPA = Object.freeze({
  business: 'headspa',
  title: 'Időpontfoglalás',
  brand: 'MOSAIC Head Spa',
  enginePath: '/foglalo-motor',
  // A Salonic adatlap (iframe) latszo magassaga mobil elrendezesben: az "elkuldes" gomb alja 1424 px; a Salonic sajat suti-savja
  // (~197 px) az iframe aljara fekszik, ezert a gomb + 24 px + a sav magassaga kell, hogy ne takarja el (a lablec 1571 px-nel kezdodik,
  // a sav alatt marad). A Salonic-fiok "Egyeni CSS URL" beallitasaval (mint a PMU-nal) ez egyszerusodik.
  frame: Object.freeze({ crop: 100, visible: 1545 }), // az alap (egyeni CSS nelkuli) Salonic-kinezethez; a MOSAIC kozos CSS-sel a motor a tomor meretet hasznalja
  // Legkevesebb lepes: a belepes egyenesen az elmeny-valasztas (HS2); az ajandekkartya-beváltás / -vasarlas a HS2 aljan egy-egy link (a HS1 mar nem lepes).
  firstState: 'HS2',
  voucherState: 'HS3',
  giftCardUrl: '/headspa-ajandekkartya', // az ajandekkartya-vasarlas kilep a foglalasbol (Gift Card funnel)
  showStaffFilter: false, // 11. dontes: a HeadSpa "munkatarsai" kezelo-helyek, a vendeg nem valaszt
  // HS2/HS3 kartyak. 8. dontes: az Egyeni = csak a "Relax" valtozat (a "Hair" nem foglalhato ebbol a foglalobol).
  cards: Object.freeze([
    { key: 'egyeni', title: 'Egyéni HeadSpa', kep: 'hs-egyeni', test: (n) => /EGYÉNI/i.test(n) && /Relax/i.test(n) },
    { key: 'paros', title: 'Páros HeadSpa', kep: 'hs-paros', test: (n) => /PÁROS/i.test(n) },
    { key: 'negykezes', title: '4 kezes HeadSpa', kep: 'hs-negykezes', test: (n) => /NÉGYKEZES|4[ -]?KEZES/i.test(n) },
  ]),
  copy: Object.freeze({
    // a HS2 (elmeny-valasztas) alatti ket link (a korabbi HS1 "Hogyan folytatnad?" lepes helyett)
    voucherLink: 'Ajándékkártyám van – beváltom',
    giftCardLink: 'Ajándékkártyát vásárolok',
    hs2Title: 'Melyik HeadSpa élményt választod?',
    hs3Title: 'Milyen ajándékkártyád van?',
    hs3Note: 'Az ajándékkártyás foglalást a Salonic adatlapján kuponkóddal tudod rendezni.',
    voucherSettled: 'Ajándékkártyával rendezve',
  }),
});
