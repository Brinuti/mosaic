// Minta-levelek a lifecycle e-mail-katalogushoz: minden e-mail (es belso hivasi feladat-level) egy peldanyat a MINTA-* foglalasokkal
// a lifecycle D1 ELONEZETI adatbazisba lehet tenni, a kovetkezo (Zapier "lifecycle-tick") kuldes kiviszi a TESZT-cimre (alap: deakfi@grantis.hu).
// A level a valodi uton megy (SMTP, uzletag-nev a felado): ugyanaz a HTML, mint a vendegeknek. NE a Gmail-eszkozzel kuldd: az a hatterszineket kiszedi.
//
//   node tools/lifecycle-teszt/minta-levelek.mjs [AZONOSITO,AZONOSITO,...] > minta.sql     (nincs lista = mind a 22)
//   1. a kimenet ket SQL-utasitas (a "-- ketto" sor valasztja el): futtasd az elonezeti D1-en (bd58da1d-a9f0-4b76-ad0b-13aedfc67192)
//   2. inditsd el a Zapier "lifecycle-tick" folyamatot (01a1169c-7353-708d-8801-912e783e8424) - vagy varj az oras futasra
//   3. takaritas: DELETE FROM kuldesek WHERE foglalas_id LIKE 'MINTA-%'; DELETE FROM foglalasok WHERE id LIKE 'MINTA-%';
// Megjegyzes: a tick az ELONEZETI adatbazis MINDEN esedekes teszt-vendeg uzenetet kikuldi (nem csak a mintakat).
import { KATALOG, KOZOS } from '../../netlify/lib/lifecycle/katalog/index.js';
import snapshot from '../../netlify/lib/lifecycle/szolgaltatasok.js';
import { szegmensek, UZLETAGAK } from '../../netlify/lib/lifecycle/uzletag.js';
import { szegmensEgyezik } from '../../netlify/lib/lifecycle/terv.js';

const CIM = process.env.MINTA_EMAIL || 'deakfi@grantis.hu';
const MOST = Math.floor(Date.now() / 1000);
const KEZDET = Math.floor(Date.UTC(2026, 9, 28, 15, 0) / 1000); // 2026-10-28 16:00 (helyi ido)
const TEGNAP = MOST - 86400 + 3600; // a no-show levelhez: az idopont "tegnap" volt
const MUNKATARS = { laser: 'Zsófi', pmu: 'Melitta', hair: 'Betti', headspa: null, oxygen: null };
const SZURO = process.argv[2] ? new Set(process.argv[2].split(',')) : null;

const q = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
// az uzenet szegmens-szurojenek megfelelo, valodi (nem akcios) szolgaltatasnev a Salonic-pillanatkepbol
function szolgaltatas(uzletag, uz) {
  const lista = snapshot.szolgaltatasok.filter((s) => s.uzletag === uzletag).map((s) => s.nev);
  const jo = lista.filter((n) => szegmensEgyezik(uz, szegmensek(uzletag, n)));
  return jo.find((n) => !/kupon|akci/i.test(n)) || jo[0] || lista[0];
}

const foglalasok = [];
const kuldesek = [];
function hozzaad(uzletag, uz, allapot, kezdet, csatorna) {
  if (SZURO && !SZURO.has(uz.id)) return;
  const nev = szolgaltatas(uzletag, uz);
  const id = `MINTA-${uz.id}`;
  foglalasok.push(`(${[q(id), q(uzletag), q(UZLETAGAK[uzletag].fiok), q('Deák Ferenc'), q('Ferenc'), q('+36709420090'), q(CIM), q(nev), q(szegmensek(uzletag, nev).join(',')),
    q(MUNKATARS[uzletag]), kezdet, MOST - 3 * 86400, 'NULL', q(allapot), 'NULL', q('minta' + uz.id.toLowerCase().replace(/[^a-z0-9]/g, '')), 1, 0].join(',')})`);
  kuldesek.push(`(${[q(id), q(uz.id), q(csatorna), MOST - 60, q('fuggoben')].join(',')})`);
}
for (const [uzletag, kat] of Object.entries(KATALOG)) for (const uz of kat.uzenetek) if (uz.csatorna !== 'sms') hozzaad(uzletag, uz, 'aktiv', KEZDET, uz.csatorna);
for (const uz of KOZOS.uzenetek) {
  if (uz.csatorna !== 'email') continue;
  const lemondva = uz.mikor.tipus === 'lemondva';
  hozzaad('headspa', uz, lemondva ? 'lemondva' : 'nem_jelent_meg', lemondva ? KEZDET : TEGNAP, 'email');
}
if (!foglalasok.length) { console.error('nincs ilyen azonosito'); process.exit(1); }
console.log(`INSERT OR REPLACE INTO foglalasok (id,uzletag,fiok,nev,keresztnev,telefon,email,szolgaltatas,szegmens,munkatars,kezdet,letrehozva,modositva,allapot,megerositve,token,teszt,elo) VALUES ${foglalasok.join(',')}`);
console.log('-- ketto');
console.log(`INSERT OR REPLACE INTO kuldesek (foglalas_id,uzenet_id,csatorna,esedekes,allapot) VALUES ${kuldesek.join(',')}`);
