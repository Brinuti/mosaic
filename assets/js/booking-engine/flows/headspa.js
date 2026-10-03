// HeadSpa uzletagi beallitas (a tulajdonos dontesei: docs/booking-engine/DECISIONS.md, 5-12. pont)
//
// A kartyak szoveges kulcsai csak azt mondjak meg, melyik Salonic-szolgaltatas melyik kartyara kerul; az ar, az idotartam
// es az azonosito mindig a Salonicbol jon (nincs beleegetve). Ami nem talalhato a Salonicban, nem jelenik meg.

export const HEADSPA = Object.freeze({
  business: 'headspa',
  title: 'Időpontfoglalás',
  brand: 'MOSAIC Head Spa',
  enginePath: '/foglalo-motor',
  giftCardUrl: '/headspa-ajandekkartya', // az ajandekkartya-vasarlas kilep a foglalasbol (Gift Card funnel)
  showStaffFilter: false, // 11. dontes: a HeadSpa "munkatarsai" kezelo-helyek, a vendeg nem valaszt
  // HS2/HS3 kartyak. 8. dontes: az Egyeni = csak a "Relax" valtozat (a "Hair" nem foglalhato ebbol a foglalobol).
  cards: Object.freeze([
    { key: 'egyeni', title: 'Egyéni HeadSpa', test: (n) => /EGYÉNI/i.test(n) && /Relax/i.test(n) },
    { key: 'paros', title: 'Páros HeadSpa', test: (n) => /PÁROS/i.test(n) },
    { key: 'negykezes', title: '4 kezes HeadSpa', test: (n) => /NÉGYKEZES|4[ -]?KEZES/i.test(n) },
  ]),
  copy: Object.freeze({
    hs1Title: 'Hogyan folytatnád?',
    hs1: [
      { key: 'book', title: 'Időpontot foglalok' },
      { key: 'voucher', title: 'Ajándékkártyám van – beváltom' },
      { key: 'giftcard', title: 'Ajándékkártyát vásárolok' },
    ],
    hs2Title: 'Melyik HeadSpa élményt választod?',
    hs3Title: 'Milyen ajándékkártyád van?',
    hs3Note: 'Az ajándékkártyás foglalást a Salonic adatlapján kuponkóddal tudod rendezni.',
    voucherSettled: 'Ajándékkártyával rendezve',
  }),
});
