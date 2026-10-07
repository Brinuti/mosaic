// A regi (Common Ninja-s) fodraszat-arlistak (assets/js/arlistak.js: Betti- es Noel-tabla) aranak eloallitasa a Salonic-pillanatkepbol.
// A tools/commonninja.mjs hasznalja (generalas), a tools/hair-teszt/hair.test.mjs pedig ellenorzi, hogy az arlistak.js egyezik a pillanatkeppel.
import { SOROK, PILLANATKEP } from './adat.mjs';

// a regi tablak sorainak cimkeje -> a SOROK kulcsa (adat.mjs)
export const SOR_KULCS = {
  'Férfi hajvágás': 'ferfi-vagas', 'Női szárítás': 'noi-szaritas', 'Női hajvágás': 'noi-vagas', 'Tőfestés': 'tofestes', 'Teljes festés / korrekció': 'teljes-festes',
  'Balayage / Ombre /Babylight': 'balayage', 'Balayage + Tőfestés': 'balayage-tofestes', 'Teljes Melír / Airtouch': 'melir', 'JOCIO 4 lépéses hajújraépítés': 'joico', 'JOICO 4 lépéses hajújraépítés': 'joico',
  'Teljes szőkítés': 'szokites', 'Tőfestés + vágás + szárítás': 'tofestes-vagas',
};
export const noelKedvezmeny = () => (PILLANATKEP.fodraszok.find((f) => f.kulcs === 'noel') || {}).kedvezmeny || 0;
const pont = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** A regi tabla sorai [cimke, rovid, kozepes, hosszu, extra] a Salonic-arakkal. kedv = 0: listaar ("39.950 Ft"); kedv > 0: "39.950 Ft helyett 31.960 Ft". */
export function salonicArak(sorok, kedv) {
  const sz = PILLANATKEP.szolgaltatasok;
  return sorok.map((sor) => {
    const kulcs = SOR_KULCS[sor[0]];
    if (!kulcs) throw new Error(`ismeretlen arlista-sor: "${sor[0]}" (vedd fel a SOR_KULCS-ba)`);
    const r = SOROK.find((x) => x.kulcs === kulcs);
    const talal = (hossz) => sz.find((x) => r.ill(x) && x.hossz === hossz);
    const cella = (s) => (!s ? '-' : kedv ? `${pont(s.ar)} Ft helyett ${pont(Math.round((s.ar * (100 - kedv)) / 100))} Ft` : `${pont(s.ar)} Ft`);
    // hajhossz nelkuli (ferfi hajvagas): az elso oszlopban; a Joico felhosszu hajat a "Kozepes haj" oszlop mutatja
    const [rovid, kozepes, hosszu, extra] = kulcs === 'ferfi-vagas'
      ? [talal(null), undefined, undefined, undefined]
      : [talal('rovid'), kulcs === 'joico' ? talal('felhosszu') : talal('kozepes'), talal('hosszu'), talal('extra')];
    return [sor[0].replace('JOCIO', 'JOICO'), cella(rovid), cella(kozepes), cella(hosszu), cella(extra)];
  });
}
