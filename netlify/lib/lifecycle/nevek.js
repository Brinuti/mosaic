// Megszolitas: a Salonic "Név" mezojebol a keresztnev. A magyar sorrend vezeteknev-elol ("Fűrész Ágnes"), de sokan forditva irjak
// ("Katalin Szathmáry"), ezert a keresztnev-lista dönt; ha nem biztos, NINCS nev (a megszolitas "Szia!" lesz) - rossz nevet nem mondunk.
import { KERESZTNEVEK_LISTA } from './keresztnevek.js';

/** kisbetu, ekezet nelkul */
const hajtogat = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const KERESZTNEVEK = new Set(KERESZTNEVEK_LISTA.map(hajtogat));
const CIM = /^(dr|prof|ifj|id|özv|ozv|né|ne)\.?$/i;

// ekezet nelkul begepelt nev ("reka") -> a lista ekezetes alakja ("Réka")
const ekezetNelkul = (w) => w.normalize('NFD').replace(/[̀-ͯ]/g, '');
const KANONIKUS = new Map();
for (const n of KERESZTNEVEK_LISTA) { const k = hajtogat(n); const van = KANONIKUS.get(k); if (!van || (ekezetNelkul(van) === van && ekezetNelkul(n) !== n)) KANONIKUS.set(k, n); }
const ekezetes = (w) => { const k = KANONIKUS.get(hajtogat(w)); return k && ekezetNelkul(w) === w ? k : w; };
const nagy = (s) => s.charAt(0).toLocaleUpperCase('hu') + s.slice(1).toLocaleLowerCase('hu');
const jelolt = (w) => w.split('-').map((x) => nagy(ekezetes(x))).join('-');

/** Keresztnev vagy null (ha nem allapithato meg biztosan). */
export function keresztnev(nev) {
  const szavak = String(nev || '').trim().split(/\s+/).filter((w) => w && !CIM.test(w));
  if (!szavak.length) return null;
  const adott = szavak.map((w) => KERESZTNEVEK.has(hajtogat(w.split('-')[0])));
  if (szavak.length === 1) return adott[0] ? jelolt(szavak[0]) : null;
  const elso = adott.indexOf(true);
  if (elso === -1) return null;
  // vezeteknev-elol: az elso szo nem keresztnev, a masodik igen -> masodik; ha az elso is keresztnev (pl. Márton Szilvia): a magyar sorrend szerint a masodik
  if (!adott[0]) return jelolt(szavak[elso]);
  if (adott[1]) return jelolt(szavak[1]);
  return jelolt(szavak[0]);
}
