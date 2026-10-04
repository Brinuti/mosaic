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
  // Az elso kerdes az ajandekkartya (HS1: kuponkoddal vagy anelkul), utana az elmeny-valasztas (HS2 / HS3).
  firstState: 'HS1',
  // A tulajdonos szerint a HeadSpa-kezelesek 1:30 oraak (a Salonic idotartama 80 perc): a megjelenitett idotartam ez; ha a Salonicban javul, ez elhagyhato.
  durationOverride: 90,
  voucherState: 'HS3',
  showStaffFilter: false, // 11. dontes: a HeadSpa "munkatarsai" kezelo-helyek, a vendeg nem valaszt
  // HS2/HS3 kartyak. 8. dontes: az Egyeni = csak a "Relax" valtozat (a "Hair" nem foglalhato ebbol a foglalobol).
  cards: Object.freeze([
    { key: 'egyeni', title: 'Egyéni HeadSpa', kep: 'hs-egyeni', test: (n) => /EGYÉNI/i.test(n) && /Relax/i.test(n) },
    { key: 'paros', title: 'Páros HeadSpa', kep: 'hs-paros', test: (n) => /PÁROS/i.test(n) },
    { key: 'negykezes', title: '4 kezes HeadSpa', kep: 'hs-negykezes', test: (n) => /NÉGYKEZES|4[ -]?KEZES/i.test(n) },
  ]),
  copy: Object.freeze({
    hs1Title: 'Ajándékkártyával vagy anélkül foglalsz?',
    hs1: [
      { key: 'voucher', title: 'Ajándékkártyával (kuponkóddal) foglalok', ikon: 'ajandek' },
      { key: 'normal', title: 'Normál foglalás kuponkód nélkül', ikon: 'naptar' },
    ],
    hs2Title: 'Melyik HeadSpa élményt választod?',
    hs3Title: 'Milyen ajándékkártyád van?',
    hs3Note: 'Az ajándékkártyás foglalást a Salonic adatlapján kuponkóddal tudod rendezni.',
    voucherSettled: 'Kuponkóddal',
  }),
});
