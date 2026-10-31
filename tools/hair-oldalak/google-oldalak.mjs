// Google Ads celoldalak (fodraszat): a meglevo fodraszat-oldalak MASOLATA uj cimen, a hirdetescsoport kulcsszavaira irt cimmel, focimmel, alcimekkel.
//
// Forras: „MOSAIC Google Ads – céloldal-terv (Feri + fejlesztő) 2026-10-31” (Google-dokumentum, Feri jovahagyta 2026-10-31 11:01), 3.1–3.3 pont.
// A tablazatok „Új oldalon (ezt kell beírni)” oszlopanak szovegei BETU SZERINT (a terv 2. pont 4. szabalya) - csak az arak jonnek az adatbol
// (a Salonic-pillanatkep, ugyanaz az ar, mint az oldal arlistajaban es a foglaloban; 2026-10-31-en betu szerint egyezik a terv szovegevel).
//
// A masolat minden mas tekintetben a forrasoldal (fejlec, lablec, kepek, arlista, velemenyek, foglalo-gombok, merokodok): ugyanaz a sablon
// (tools/hair-oldalak/sablon.mjs) rajzolja ki, csak a valtozat (v) szovegei kerulnek bele. A regi oldal valtozatlan marad (a Meta arra visz),
// a regi oldalrol nincs atiranyitas. Indexelheto, sajat magara mutato canonical, a sitemapben szerepel (tools/wix-sitemap/pages-sitemap.xml), a menuben nem.
//
// Generalas: node tools/hair-oldalak.mjs (a foglalas/<fajl>.html-t irja, a tobbi fodraszat-oldallal egyutt).
import { FODRASZOK, katAdat, szandekAdat, ft } from './adat.mjs';

const tol = (n) => `${ft(n)}-tól`;

export const GOOGLE_LAPOK = {
  // 3.1 (7. sor) FOD-1 Helyi fodrasz -> /fodrasz-obuda, a /noi-fodraszat-budapest masolata
  fodraszObuda: {
    forras: 'kozpont',
    fajl: 'fodrasz-obuda',
    csoport: 'FOD-1 Helyi fodrász',
    title: 'Fodrász Óbuda – fodrászat a Kolosy térnél – MOSAIC Hair',
    leiras: 'Fodrászat Óbudán, a Kolosy térnél (Bécsi út 2.), a 2. és 3. kerület határán: hajfestés, tőfestés, balayage, ingyenes 30 perces konzultáció, online foglalás.',
    valtozat: () => ({
      h1: 'Fodrász Óbudán, a Kolosy térnél',
      bevezeto: 'Fodrászat Óbuda szívében, a Kolosy tér mellett, a Bécsi út 2. alatt – a 2. és a 3. kerület határán. Hajfestés, tőfestés, őszfedés és balayage Bettinél, Noelnél és Evelinnél, előtte ingyenes 30 perces konzultációval.',
      kulcsszavak: {
        cimke: 'Fodrász Óbudán, a 2. és a 3. kerület határán',
        kartyak: [
          ['pin', 'Fodrászat a 3. kerület közelében', 'Ha fodrászt keresel a 3. kerületben, a Kolosy térnél, Óbuda kapujában találsz minket.'],
          ['pin', 'Fodrász a 2. kerület határán', 'A 2. kerületből pár perc: a Bécsi út 2. a Margit híd budai hídfőjétől is gyorsan elérhető.'],
          ['ollo', 'Női fodrász Budán', `Női fodrász Buda és Óbuda határán: hajfestés ${tol(szandekAdat('color').tol)}, tőfestés ${tol(katAdat('Tőfestés + szárítás').tol)}, balayage ${tol(katAdat('Balayage').tol)}.`],
        ],
      },
    }),
  },
  // 3.2 (8. sor) FOD-2 Balayage -> /balayage-budapest, a /balayage-haj-festes-budapest (Noel oldala) masolata
  balayageBudapest: {
    forras: 'noel',
    fajl: 'balayage-budapest',
    csoport: 'FOD-2 Balayage',
    title: 'Balayage Budapest – balayage festés és árak Óbudán – MOSAIC Hair',
    leiras: 'Balayage festés Budapesten, a Kolosy térnél: balayage, babylights, airtouch, melír és ombre Noelnél. Az ár vágással és szárítással együtt értendő, előtte ingyenes 30 perces konzultáció.',
    valtozat: () => ({
      h1: 'Balayage festés Budapesten',
      bevezeto: 'Balayage Budapesten, a Kolosy térnél (Bécsi út 2.): természetes hatású balayage hajfestés Noelnél. A balayage ár vágással és szárítással együtt értendő; a 30 perces ingyenes konzultáción átbeszéljük a várható árat.',
      kulcsszavak: {
        cimke: 'Babylights, airtouch, melír és ombre',
        kartyak: [
          ['level', 'Babylights festés', 'A babylights finom, vékony tincsekkel ad természetes, napszítta hatást.'],
          ['gyemant', 'Airtouch hajfestés', 'Airtouch technikával a világosítás átmenete még lágyabb.'],
          ['chat', 'Melír és ombre', 'Melír és ombre festés is kérhető, a konzultáción választjuk ki, melyik illik a hajadhoz.'],
        ],
      },
      // „H2: Balayage árak (alatta a meglévő árlista marad; a −20%-os ár csak 11-30-ig, utána a teljes ár)”
      arCim: 'Balayage árak',
      arMegj: FODRASZOK.noel.kedvezmeny ? `A −${FODRASZOK.noel.kedvezmeny}%-os ár november 30-ig érvényes, utána a teljes ár.` : '',
      // „H2: Balayage fodrász: Noel (a mostani »Miért válaszd Noelt?« blokk ide kerül alá)”
      miertCim: 'Balayage fodrász: Noel',
    }),
  },
  // 3.3 (9. sor) FOD-3 Hajfestes -> /hajfestes-budapest, a /noi-hajfestes-budapest (Evelin oldala) masolata
  hajfestesBudapest: {
    forras: 'evelin',
    fajl: 'hajfestes-budapest',
    csoport: 'FOD-3 Hajfestés',
    title: 'Hajfestés Budapest – tőfestés, őszfedés, szőkítés – MOSAIC Hair',
    leiras: `Női hajfestés Budapesten, Óbudán, a Kolosy térnél: hajfestés, tőfestés ${tol(katAdat('Tőfestés + szárítás', 'evelin').tol).replace(/ /g, ' ')}, őszfedés, szőkítés és hajszín korrekció Evelinnél, ingyenes konzultációval.`,
    valtozat: () => ({
      h1: 'Női hajfestés Budapesten',
      bevezeto: 'Hajfestés Budapesten, Óbudán, a Kolosy tér mellett (Bécsi út 2.). Tőfestés, őszfedés, szőkítés és hajszín korrekció Evelinnél – a 2. és 3. kerület határán, előtte ingyenes konzultációval.',
      kulcsszavak: {
        cimke: 'Tőfestés, őszfedés, szőkítés és hajszín korrekció',
        kartyak: [
          ['ora', 'Tőfestés', `Tőfestés ${tol(katAdat('Tőfestés + szárítás', 'evelin').tol)}, festékkel és szárítással.`],
          ['level', 'Őszfedés', 'Egyenletes őszfedés, a saját színedhez igazítva.'],
          ['gyemant', 'Szőkítés', 'Szőkítés és világosítás a hajad állapotához igazítva, előzetes konzultációval.'],
          ['chat', 'Hajszín korrekció', 'Ha nem lett jó a szín, előbb felmérjük, aztán javítjuk.'],
        ],
      },
      // „Hajhosszabbítás blokk: kimarad a másolatból (nem hajfestés – hígítja a témát)”: a póthaj-kártya, -kiemelés, -érv és -GYIK nélkül
      fodrasz: {
        szakteruletek: FODRASZOK.evelin.szakteruletek.filter((s) => s !== 'pothaj'),
        kiemelesek: FODRASZOK.evelin.kiemelesek.filter((s) => !/hosszabbítás|póthaj/i.test(s)),
        miert: FODRASZOK.evelin.miert.map((m) => (/hosszabbítás|póthaj/i.test(m.join(' '))
          ? ['Előbb beszélünk, aztán festünk', 'Az ingyenes konzultáción megnézzük a hajad állapotát, és megbeszéljük, mi a reális.'] : m)),
        gyik: FODRASZOK.evelin.gyik.filter((q) => !/hosszabbítás|póthaj/i.test(q.join(' '))),
      },
    }),
  },
};
