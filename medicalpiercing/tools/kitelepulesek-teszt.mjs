// A kitelepulesek tablazat-olvasojanak probaja (lib/kitelepulesek.js), halozat nelkul.
//
//   node tools/kitelepulesek-teszt.mjs
import { cellaNapjai, fejlecHonapjai, tablazatbol, honapSorok, osszesSor, htmlFrissites, varosKulcs, NINCS_IDOPONT } from '../lib/kitelepulesek.js';

let hiba = 0;
const ok = (nev, felt, info = '') => { console.log(`${felt ? 'OK  ' : 'HIBA'} ${nev}${info ? '  ' + info : ''}`); if (!felt) hiba++; };
const egyezik = (nev, kapott, vart) => ok(nev, JSON.stringify(kapott) === JSON.stringify(vart), `${JSON.stringify(kapott)}${JSON.stringify(kapott) === JSON.stringify(vart) ? '' : ' (vart: ' + JSON.stringify(vart) + ')'}`);

// cellak: a tablazatban eddig elofordult alakok
const napok = (c, ev = 2026, ho = 12) => cellaNapjai(c, ev, ho);
egyezik('egyszeru', napok('4,11,18'), { napok: [4, 11, 18], hiba: null });
egyezik('szokozok, zaro vesszo', napok('7, 14, 21, 28,'), { napok: [7, 14, 21, 28], hiba: null });
egyezik('vezeto nullak', napok('03,06,13'), { napok: [3, 6, 13], hiba: null });
egyezik('betuvel: Négy', napok('Négy,11,18'), { napok: [4, 11, 18], hiba: null });
egyezik('betuvel: húsz', napok('6,húsz'), { napok: [6, 20], hiba: null });
egyezik('betuvel: harminc', napok('2,16,harminc'), { napok: [2, 16, 30], hiba: null });
egyezik('betuvel, vesszo nelkul', napok('négy11,18'), { napok: [4, 11, 18], hiba: null });
egyezik('honap-elotag', napok('Szept.3,10,17,'), { napok: [3, 10, 17], hiba: null });
egyezik('dupla vesszo', napok('5,7,14,,28'), { napok: [5, 7, 14, 28], hiba: null });
egyezik('kotojel', napok('-'), { napok: [], hiba: null });
egyezik('ures', napok(''), { napok: [], hiba: null });
ok('ervenytelen nap -> hiba', !!napok('2003,9,17').hiba);
ok('szoveg -> hiba', !!napok('11 nap').hiba);
ok('februar 30 -> hiba', !!cellaNapjai('28,30', 2027, 2).hiba);

// fejlec: evszammal es regi (csak honapnev) alakban
egyezik('evszamos fejlec', fejlecHonapjai(['Város', 'Cím', '2026. december', '2027. január'], { ev: 2026, ho: 10 }).map((o) => [o.ev, o.ho]), [[2026, 12], [2027, 1]]);
egyezik('regi fejlec, horgony a mai honap', fejlecHonapjai(['Város', 'Október', 'November', 'December', 'Január', 'szeptember', 'október'], { ev: 2026, ho: 10 }).map((o) => [o.ev, o.ho]),
  [[2025, 10], [2025, 11], [2025, 12], [2026, 1], [2026, 9], [2026, 10]]);

// teljes tablazat + megjelenes
const csv = 'Város,Piercer,Cím,2026. október,2026. november,2026. december,2027. január\n'
  + 'Debrecen,X,"4031 Debrecen, Derék utca 100/B","5,19","2,16,30","14,21",\n'
  + 'Kaposvár,Y,"7400 Kaposvár","8,22","6,húsz",-,"9"\n'
  + 'Pécs,Z,"7624 Pécs","3,4",-,-,\n';
const ma = { ev: 2026, ho: 10, nap: 10 };
const t = tablazatbol(csv, ma);
egyezik('helyszinek', Object.keys(t.helyszinek), ['debrecen', 'kaposvar', 'pecs']);
egyezik('debreceni sorok (elmult okt. 5 nelkul)', honapSorok(t.helyszinek.debrecen, ma), ['Október 19', 'November 2,16,30', 'December 14,21']);
egyezik('kaposvari sorok (ures december kimarad)', honapSorok(t.helyszinek.kaposvar, ma), ['Október 22', 'November 6,20']);
egyezik('honapvaltas utan', honapSorok(t.helyszinek.kaposvar, { ev: 2026, ho: 11, nap: 30 }), ['Január 9']);
egyezik('nincs kozeli idopont', osszesSor(csv, ma).sorok.pecs, [NINCS_IDOPONT]);
egyezik('Msikolc elgepeles', varosKulcs('3525 Msikolc, Széchenyi'), 'miskolc');

// HTML-csere: ismetlo-elemben a cim, varosoldalon a lapcim alapjan
const lap = '<title>Kapcsolat</title><div role="listitem"><h2><span>4031 Debrecen, Derék utca 100/B</span></h2>'
  + '<p><span class="x">Szeptember 25<br>Október 5,19</span></p></div>';
const r = htmlFrissites(lap, { debrecen: ['Október 19', 'November 2'] }, '/elerhetosegek');
ok('ismetlo-elem csereje', r.db === 1 && r.html.includes('<span data-mp-kitelepules="debrecen" class="x">Október 19<br>November 2</span>'), r.html.slice(-90));
const varosLap = '<title>8000 Székesfehérvár, Tobak u 10. | Medical Piercing</title><p><span>Október 2,9</span></p>';
const r2 = htmlFrissites(varosLap, { szekesfehervar: ['Október 16,30'] }, '/varosok/8800-nagykanizsa-fo-ut-23');
ok('varosoldal: a lapcim szamit, nem a cim', r2.html.includes('data-mp-kitelepules="szekesfehervar">Október 16,30<'));
const akcio = '<div role="listitem"><h2>Debrecen</h2><p><span>Október 31-ig 20% kedvezmény</span></p></div>';
ok('nem datum-szoveg erintetlen', htmlFrissites(akcio, { debrecen: ['x'] }).db === 0);

console.log(hiba ? `\n${hiba} HIBA` : '\nMinden rendben');
process.exit(hiba ? 1 : 0);
