// MOSAIC Booking Engine - a koszono kepernyok szovegei (a "Mi tortenik most?" lista uzletagankent).
//
// A szovegek a meglevo koszonooldalak (foglalas-ok, fodrasz-ok, oxigenterapia-ok, szortelenites-ok, elysion-ok) tartalmabol valok, nem uj igeretek:
// erkezes 15-20 perccel elobb, a kezeles elotti tudnivalok (lezer: borotvalas, kozmetikum, napozas; oxigen: hajmosas, hajfestes), a Zsofi alairas.

const MAIL = 'Visszaigazolást küldünk e-mailben: benne az időpont módosításának és lemondásának linkje.';
const ERKEZES = 'Kérünk, érkezz 15–20 perccel előbb, hogy legyen időd parkolni, begyalogolni és kényelmesen átöltözni.';
const CSUSZAS = 'Nagyon sok vendégünk van, ezért nem tudunk csúszni a kezelésekkel. Köszönjük a megértésed!';

const LEPESEK = {
  headspa: [MAIL, ERKEZES, CSUSZAS],
  hair: [MAIL, ERKEZES, CSUSZAS],
  oxygen: [MAIL, ERKEZES, 'Kezelés előtt: 48 órával ne moss hajat; hajfestés, szőkítés, hajegyenesítés előtt és után legalább 10 nap szünetet tarts.'],
  laser: [MAIL,
    'A kezelés előtt legalább 24 órával borotváld le az érintett területet, és a kezelés napján ne használj testápolót, olajat, dezodort vagy egyéb kozmetikumot a kezelt felületen.',
    'Kerüld a napozást és a szolárium használatát a kezelés előtti 2 hétben. Ha a kezelt területen irritáció, sérülés vagy gyulladás jelentkezik, jelezd időben.'],
  // lezer: ingyenes konzultacio (nincs kezeles elotti teendo)
  laserConsult: [MAIL, ERKEZES, 'Ha bármilyen kérdésed merül fel, írj nekünk vagy hívj a 06 20 247 4444-es számon.'],
};

/** A "Mi tortenik most?" lista: 3 pont. bookingType: a szolgaltatas fajtaja ('consultation' = ingyenes konzultacio). */
export function koszonoLepesek(business, bookingType) {
  if (business === 'laser' && bookingType === 'consultation') return LEPESEK.laserConsult;
  return LEPESEK[business] || LEPESEK.headspa;
}

/** A visszahivas-keres utan: mi fog tortenni (idopont nelkul: nem tudjuk, mikor hivjuk). */
export const VISSZAHIVAS_LEPESEK = [
  'Megkaptuk a kérésedet.',
  'Kollégánk hamarosan felhív a megadott számon.',
  'Ha szeretnéd, a hívás közben együtt kiválasztjátok az időpontot is.',
];

/** A lezer kezeloje (Elysion Pro szakerto): a meglevo koszonooldalak is az o nevevel zarulnak ("Varlak szeretettel: Zsofi"); fotoja egyelore nincs (monogram). */
export const LEZER_KEZELO = Object.freeze({ name: 'Zsófi', foto: null });
