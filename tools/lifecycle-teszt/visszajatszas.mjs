// Offline visszajatszas: a Salonic MUNKATARSI ertesitoinek (valodi, kitakart) csomagja a lifecycle feldolgozon at (DECISION #117 elfogadasi kapu, issue #167).
// Hasznalat: node tools/lifecycle-teszt/visszajatszas.mjs <csomag.json> [--reszletek]
//   A csomag: { leiras, esetek: [{ gmail_id, kuldve_utc, targy, felado, tipus, nev_hash_sha256_16, html_redaktalt, ... }] }; a vendegnev helyen a normalizalt nev
//   sha256-janak elso 16 hexa karaktere all. A "Beeső" (a Salonic helykitolto vendege, nem szemely) hash-e visszakap nevet; a tobbi hash marad (nem parosithato).
// Mit csinal: (1) a parser az osszes levelet ertelmezi, (2) a teljes feldolgozo UTES D1-en fut figyel es be modban: kimenetek + allapotvaltas / SMS szamlalo.
// A vendegadatot nem ir ki; D1-hez / halozathoz nem nyul (in-memory D1, nincs Salonic-lekerdezes).
import fs from 'node:fs';
import { d1 } from './seged.mjs';
import { ingest } from '../../netlify/lib/lifecycle/engine.js';
import { ertelmezMunkatars, belsoBlokk } from '../../netlify/lib/lifecycle/munkatars.js';

const BEESO_HASH = 'e48ff85456a2c076'; // sha256("beeső") elso 16 hexa karaktere (kisbetu, NFC, osszevont szokozok)
const ut = process.argv[2];
if (!ut) { console.error('Hasznalat: node tools/lifecycle-teszt/visszajatszas.mjs <csomag.json> [--reszletek]'); process.exit(2); }
let nyers = fs.readFileSync(ut, 'utf8').trim();
if (!nyers.startsWith('{')) nyers = Buffer.from(nyers, 'base64').toString('utf8'); // a Drive-letoltes base64-be csomagolhatja
const esetek = JSON.parse(nyers).esetek;
const html = (e) => e.html_redaktalt.replaceAll(`[NEV-HASH:${e.nev_hash_sha256_16}]`, e.nev_hash_sha256_16 === BEESO_HASH ? 'Beeső' : `[NEV-HASH:${e.nev_hash_sha256_16}]`);
const szamol = (m, k) => { m[k] = (m[k] || 0) + 1; };
const rendez = (m) => Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]));

// 1) parser
const parser = { ossz: esetek.length, ertelmezve: 0, hibak: {}, tipus: {}, uzletag: {}, belso_szabaly: {}, nev_beeso: 0 };
for (const e of esetek) {
  const r = ertelmezMunkatars({ targy: e.targy, kuldo: e.felado, html: html(e) }, Math.floor(Date.parse(e.kuldve_utc) / 1000));
  if (!r.ok) { szamol(parser.hibak, r.miert); continue; }
  parser.ertelmezve += 1; szamol(parser.tipus, r.tipus); szamol(parser.uzletag, r.uzletag);
  const b = belsoBlokk(r); if (b) szamol(parser.belso_szabaly, b);
  if (e.nev_hash_sha256_16 === BEESO_HASH) parser.nev_beeso += 1;
}
console.log('== PARSER'); console.log(JSON.stringify({ ...parser, hibak: rendez(parser.hibak), tipus: rendez(parser.tipus), uzletag: rendez(parser.uzletag), belso_szabaly: rendez(parser.belso_szabaly) }, null, 1));

// 2) teljes feldolgozo, ures D1: nincs online foglalas, igy minden level "nincs jelolt" ag; mod szerint az allapot / kuldes nem valtozhat
for (const mod of ['figyel', 'be']) {
  const db = d1();
  const env = { LIFECYCLE_MOD: 'elo', LIFECYCLE_UZLETAGOK: 'headspa,hair,oxygen,laser,pmu', LIFECYCLE_MUNKATARS_MOD: mod, LIFECYCLE_NAPI_PLAFON: String(esetek.length + 100) };
  const kimenet = {}; const bizonytalan = {};
  for (const e of esetek) {
    const most = Math.floor(Date.parse(e.kuldve_utc) / 1000) + 5;
    const r = await ingest(db, env, { uzenetId: e.gmail_id, targy: e.targy, kuldo: e.felado, html: html(e), kuldve: most - 5 }, most);
    szamol(kimenet, r.tipus || (r.duplikalt ? 'duplikalt' : r.miert) || '?');
    if (r.tipus === 'riasztas:ignored_uncertain' && process.argv.includes('--reszletek')) {
      const p = ertelmezMunkatars({ targy: e.targy, kuldo: e.felado, html: html(e) }, most);
      szamol(bizonytalan, `${p.uzletag} | ${p.szolgaltatas} | ${p.munkatars} | ${e.nev_hash_sha256_16 === BEESO_HASH ? 'Beeső' : 'vendég'}`);
    }
  }
  const sq = db.sqlite;
  console.log(`== FELDOLGOZO (munkatars mod: ${mod}, ures D1)`);
  console.log(JSON.stringify({ kimenetek: rendez(kimenet), foglalasok: sq.prepare('SELECT COUNT(*) n FROM foglalasok').get().n, kuldesek: sq.prepare('SELECT COUNT(*) n FROM kuldesek').get().n, esemeny_tipusok: rendez(Object.fromEntries(sq.prepare('SELECT tipus, COUNT(*) n FROM esemenyek GROUP BY tipus').all().map((x) => [x.tipus, x.n]))) }, null, 1));
  if (Object.keys(bizonytalan).length) console.log('bizonytalan (kezi ellenorzes):', JSON.stringify(rendez(bizonytalan), null, 1));
}
