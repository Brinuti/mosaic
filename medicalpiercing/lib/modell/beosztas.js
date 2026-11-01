// A modellkereso napok (ingyenes piercing, oktatasi gyakorlonap / workshop) beosztasa: napok, piercingtipusok, idosavok. Tiszta fuggvenyek (nincs benne adatbazis / ido).
// A tulajdonos dontesei (2026-11-01): 2026. nov. 25. (szerda) es nov. 30. (hetfo); a gyakorlas 10:00-kor kezdodik, a modellek 30 perccel korabban erkeznek;
// 5 tipus (szemoldok, orr, ajak, koldok, rook); egy piercer 120 perc alatt 5 szurast vegez (mind az 5 tipusbol egyet) = 24 perc / szuras;
// nov. 25.: 2 piercer (5 x 2 = 10 modell), nov. 30.: 3 piercer (5 x 3 = 15 modell). Minden szurashoz ket foglalas tartozik: egy elsodleges (a szuras kezdete)
// es egy tartalek (+12 perc), hogy egy meg nem jelenes ne maradjon ures hellyel; a tartalek csak akkor foglalhato, ha az elsodleges mar foglalt.
export const NAPOK = [
  { datum: '2026-11-25', cim: 'Szerda, november 25.', rovid: 'Szerda, nov. 25.', piercerek: 2 },
  { datum: '2026-11-30', cim: 'Hétfő, november 30.', rovid: 'Hétfő, nov. 30.', piercerek: 3 },
];
export const TIPUSOK = [
  { kulcs: 'szemoldok', nev: 'Szemöldök' },
  { kulcs: 'orr', nev: 'Orr' },
  { kulcs: 'ajak', nev: 'Ajak' },
  { kulcs: 'koldok', nev: 'Köldök' },
  { kulcs: 'rook', nev: 'Rook' },
];
export const KEZDES_PERC = 10 * 60;        // 10:00
export const SZURAS_PERC = 24;             // egy szuras (a piercer egy modellre szant ideje)
export const TARTALEK_PERC = 12;           // a tartalek foglalas az elsodleges utan ennyivel
export const ERKEZES_ELOTT_PERC = 30;      // a modell ennyivel a szuras kezdete elott erkezik (papirok, megbeszeles)
export const HELYSZIN = { cim: '1137 Budapest, Újpesti rakpart 7., 5. emelet 25.', rovid: 'Újpesti rakpart 7.', megjegyzes: 'a Jászai Mari térnél', telefon: '+36 1 901 7444', email: 'medicalpiercing.hu@gmail.com' };
// a ket nap kozep-europai idoben (a nyari ido oktoberben veget ert): UTC+1
const UTC_ELTOLAS_ORA = 1;

export const hhmm = (perc) => `${String(Math.floor(perc / 60)).padStart(2, '0')}:${String(perc % 60).padStart(2, '0')}`;
export const percbol = (s) => { const m = /^(\d{2}):(\d{2})$/.exec(s); return m ? +m[1] * 60 + +m[2] : NaN; };
export const nap = (datum) => NAPOK.find((n) => n.datum === datum) || null;
export const tipus = (kulcs) => TIPUSOK.find((t) => t.kulcs === kulcs) || null;
export const savKulcs = (datum, tip, ido) => `${datum}|${tip}|${ido}`;

/** Egy nap osszes idosavja. Piercer k (0-tol) az i. szurasnal a (i + k) % 5. tipust szurja (eltolt sorrend: ugyanabban az idoben mas-mas tipus). */
export function savok(datum) {
  const n = nap(datum);
  if (!n) return [];
  const ki = [];
  for (let k = 0; k < n.piercerek; k++) {
    for (let i = 0; i < TIPUSOK.length; i++) {
      const tip = TIPUSOK[(i + k) % TIPUSOK.length].kulcs;
      const elso = KEZDES_PERC + SZURAS_PERC * i;
      const par = `${datum}|P${k + 1}|${i + 1}`;
      ki.push({ datum, tipus: tip, ido: hhmm(elso), szerep: 'elsodleges', par, piercer: k + 1, elsodlegesIdo: hhmm(elso) });
      ki.push({ datum, tipus: tip, ido: hhmm(elso + TARTALEK_PERC), szerep: 'tartalek', par, piercer: k + 1, elsodlegesIdo: hhmm(elso) });
    }
  }
  return ki.sort((a, b) => (a.tipus === b.tipus ? percbol(a.ido) - percbol(b.ido) : 0));
}

/** Egy konkret idosav (datum + tipus + ido), vagy null, ha nincs ilyen. */
export function sav(datum, tip, ido) {
  return savok(datum).find((s) => s.tipus === tip && s.ido === ido) || null;
}

/** A tartalek sav elsodleges parja (ugyanannak a szurasnak az elsodleges foglalasa). */
export function elsodlegesPar(s) {
  return s.szerep === 'tartalek' ? sav(s.datum, s.tipus, s.elsodlegesIdo) : null;
}

/** Az erkezes ideje (a szuras kezdete elott ERKEZES_ELOTT_PERC perccel). */
export const erkezesIdo = (ido) => hhmm(percbol(ido) - ERKEZES_ELOTT_PERC);

/** Egy idosav kezdete unix masodpercben (a ket nap UTC+1). */
export function kezdesEpoch(datum, ido) {
  const [y, m, d] = datum.split('-').map(Number);
  const p = percbol(ido);
  return Math.floor(Date.UTC(y, m - 1, d, Math.floor(p / 60) - UTC_ELTOLAS_ORA, p % 60) / 1000);
}

/** Valos helyek szama (elsodleges savok): nap szerint es osszesen. */
export const valosHelyek = () => NAPOK.map((n) => ({ datum: n.datum, db: n.piercerek * TIPUSOK.length }));

/**
 * A szabad / foglalt savok allapota a lefoglalt savok (aktiv vagy tartott) alapjan.
 * @param {Array<{nap:string,tipus:string,ido:string}>} foglaltak
 * @returns {Array} napok: [{ datum, cim, rovid, tipusok: { <kulcs>: [{ ido, szerep, szabad, erkezes }] }, szabadFo, fo }]
 */
export function elerhetoseg(foglaltak) {
  const foglalt = new Set(foglaltak.map((f) => savKulcs(f.nap, f.tipus, f.ido)));
  return NAPOK.map((n) => {
    const tipusok = {};
    let szabadFo = 0, fo = 0, szabadTartalek = 0;
    for (const t of TIPUSOK) tipusok[t.kulcs] = [];
    for (const s of savok(n.datum)) {
      const sajat = foglalt.has(savKulcs(s.datum, s.tipus, s.ido));
      if (s.szerep === 'elsodleges') { fo += 1; if (!sajat) szabadFo += 1; tipusok[s.tipus].push({ ido: s.ido, szerep: s.szerep, szabad: !sajat, erkezes: erkezesIdo(s.ido) }); continue; }
      // a tartalek csak akkor latszik / foglalhato, ha az elsodleges mar foglalt (a tartalek mindig egy valos foglalas mellett all)
      const par = foglalt.has(savKulcs(s.datum, s.tipus, s.elsodlegesIdo));
      if (!par) continue;
      if (!sajat) szabadTartalek += 1;
      tipusok[s.tipus].push({ ido: s.ido, szerep: s.szerep, szabad: !sajat, erkezes: erkezesIdo(s.ido) });
    }
    for (const t of TIPUSOK) tipusok[t.kulcs].sort((a, b) => percbol(a.ido) - percbol(b.ido));
    return { datum: n.datum, cim: n.cim, rovid: n.rovid, tipusok, fo, szabadFo, szabadTartalek };
  });
}
