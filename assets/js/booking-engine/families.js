// MOSAIC Booking Engine - a szolgaltatas-elso kezdo allapot (H0): minden szolgaltatas-csalad egy helyen.
//
// Ide kerul az, aki NEM egy konkret szolgaltatas-oldalrol erkezik (fomenu "Foglalas", a /foglalas cim, kereso): eloszor a szolgaltatast
// valasztja, utana megy tovabb az adott agon (HS1 / HA1 / OX1 / LA1). A csaladok nevei szolgaltatas-nevek, nem uzletag-nevek.
// A szovegek javaslatok (a tulajdonos hagyja jova); az egyes agak tartalma tovabbra is a Salonicbol es a flows/*.js-bol jon.

export const CHOOSER = Object.freeze({
  title: 'Mit szeretnél foglalni?',
  families: Object.freeze([
    { key: 'headspa', business: 'headspa', title: 'Head Spa', sub: 'Egyéni, páros és 4 kezes élmény', kep: 'h0-headspa' },
    { key: 'hair', business: 'hair', title: 'Fodrászat', sub: 'Balayage, hajfestés, hajvágás', kep: 'h0-hair' },
    { key: 'oxygen', business: 'oxygen', title: 'Oxigénterápia', sub: 'Hajkamera-vizsgálat és kezelés', kep: 'h0-oxygen' },
    { key: 'laser', business: 'laser', title: 'Lézeres szőrtelenítés', sub: 'Ingyenes konzultáció, kezelések', kep: 'h0-laser' },
    // a PMU a sajat, kesz foglalojaval nyilik (assets/js/foglalo-pmu.js, /foglalo-pmu): nem ennek a motornak a folyamata
    { key: 'pmu', business: 'pmu', title: 'Sminktetoválás', sub: 'Szemöldök, ajak, szemhéj', kep: 'h0-pmu', external: true },
  ]),
});

// A PMU foglalo cime: onallo oldalon /foglalo-pmu, retegben ugyanez beagyazva (?beagyazva=1: a szulo meretezi, a vegen a teljes ablakban nyilik a koszonooldal)
export const PMU_PATH = '/foglalo-pmu';
