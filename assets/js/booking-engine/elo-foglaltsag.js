// MOSAIC Booking Engine - "Elo foglaltsag" sav (az idopont-naptar alatt): a szolgaltatashoz tartozo VALODI szabad idopontok szama, kitalalt adat nelkul.
//
// A sav szovege csak olyan adatbol szuletik, amit a motor tenylegesen tud:
//  1. (elsodleges) a kovetkezo 7 nap szabad idopontjai: a Salonic naptar-API adatabol, a vendeg altal valaszthato, kulonbozo kezdesi idopontok szama
//     (ugyanarra az idopontra tobb szakember is szabad lehet: az egy idopont);
//  2. (masodik, csak ha kiszamolhato) "Ezen a heten az idopontok X%-a mar foglalt": ehhez a heti KAPACITAS kell (az osszes idopont, a foglaltakkal egyutt);
//     a Salonic nyilvanos naptar-API-ja csak a szabad idopontokat adja, a kapacitast nem: kapacitas nelkul ez az allapot NEM jelenik meg;
//  3. (harmadik, opcionalis, csak valodi foglalasi esemenybol) "N perce foglaltak utoljara erre a kezelesre": ehhez foglalasi esemeny kell (forras nelkul nem jelenik meg).
// A sav nem "ugralhat": oldalbetolteskor az aktualis allapotot mutatja, es csak valodi valtozaskor (a szabad idopontok szama tenylegesen valtozott) frissul.

export const ELO_NAP = 7; // az elsodleges allapot ablaka
export const KEVES = 10; // eddig "mar csak N szabad idopont maradt"; felette semleges megallapitas (nem allitunk szukoseget, ami nincs)
export const SURGOS = 3; // eddig narancs (surgos) jelzes
export const KOZEL_FOGLALT = 50; // a heti foglaltsagot (%) csak ennyi % folott mutatjuk (alatta nem mond semmit)
export const UTOLSO_FOGLALAS_MAX_PERC = 24 * 60; // az ennel regebbi foglalast nem emlegetjuk

/** A [most, most + nap] ablakba eso, KULONBOZO kezdesi idopontok (unix mp, novekvo sorrendben). */
export function ablakIdopontok(slots, nowUnix, nap = ELO_NAP) {
  const hatar = nowUnix + nap * 86400;
  return [...new Set((slots || []).filter((s) => s.start_unix > nowUnix && s.start_unix <= hatar).map((s) => s.start_unix))].sort((a, b) => a - b);
}

/** Ket lekeres osszevetese ugyanarra az ablakra: valtozott-e a szabad idopontok halmaza (elfogyott / uj jelent meg). */
export function frissites(regi, uj) {
  const r = new Set(regi); const u = new Set(uj);
  const eltunt = regi.filter((x) => !u.has(x)).length;
  const ujDb = uj.filter((x) => !r.has(x)).length;
  if (!eltunt && !ujDb) return { valtozas: null, eltunt: 0, uj: 0 };
  return { valtozas: uj.length < regi.length ? 'csokkent' : uj.length > regi.length ? 'nott' : 'csere', eltunt, uj: ujDb };
}

const percSzoveg = (perc) => {
  if (perc < 1) return 'Az imént foglaltak erre a kezelésre.';
  if (perc < 60) return `${perc} perce foglaltak utoljára erre a kezelésre.`;
  return `${Math.floor(perc / 60)} órája foglaltak utoljára erre a kezelésre.`;
};

/**
 * A sav tartalma.
 *  szabad: a kovetkezo 7 nap szabad idopontjainak szama; kovetkezo: a legkozelebbi szabad idopont cimkeje (csak ha nincs szabad a 7 napban);
 *  het: { szabad, kapacitas } vagy null (kapacitas nelkul nincs % allapot); utolsoFoglalasPerc: szam vagy null (valodi esemeny nelkul nincs);
 *  frissult: 'csokkent' | 'nott' | 'csere' | null: az utobbi percekben valodi valtozas tortent (a cim "Most frissult").
 * Vissza: { cim, uzenet, hangulat: 'jo' | 'keves' | 'nincs', extra: [sor, ...], also }
 */
export function eloAllapot({ szabad, kovetkezo = null, het = null, utolsoFoglalasPerc = null, frissult = null }) {
  let uzenet; let hangulat;
  if (szabad <= 0) { hangulat = 'nincs'; uzenet = 'A következő 7 napra nincs szabad időpont.' + (kovetkezo ? ` A legközelebbi: ${String(kovetkezo).replace(/\.$/, '')}.` : ''); }
  else if (szabad <= KEVES) { hangulat = szabad <= SURGOS ? 'keves' : 'jo'; uzenet = `A következő 7 napra már csak ${szabad} szabad időpont maradt.`; }
  else { hangulat = 'jo'; uzenet = `A következő 7 napra ${szabad} szabad időpont van.`; }
  const extra = [];
  if (het && Number.isFinite(het.kapacitas) && het.kapacitas > 0 && Number.isFinite(het.szabad) && het.szabad >= 0 && het.szabad <= het.kapacitas) {
    const szazalek = Math.round((1 - het.szabad / het.kapacitas) * 100);
    if (szazalek >= KOZEL_FOGLALT) extra.push(`Ezen a héten az időpontok ${szazalek}%-a már foglalt.`);
  }
  if (Number.isFinite(utolsoFoglalasPerc) && utolsoFoglalasPerc >= 0 && utolsoFoglalasPerc <= UTOLSO_FOGLALAS_MAX_PERC) extra.push(percSzoveg(Math.floor(utolsoFoglalasPerc)));
  return { cim: frissult ? 'Most frissült' : 'Élő foglaltság', uzenet, hangulat, extra, also: 'Az elérhetőség automatikusan frissül.' };
}
