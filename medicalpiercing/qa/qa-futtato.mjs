// MP foglalomotor QA - osszesito futtato: QA-1, QA-4, QA-5, QA-6 asztali es mobil nezetben, PASS/FAIL tabla.
//   node medicalpiercing/qa/qa-futtato.mjs --url https://<ag>.medicalpiercing.pages.dev [--tesztek qa1,qa4,qa5,qa6]
//        [--nezet asztali|mobil] [--ki eredmeny.json] [tovabbi kapcsolok: README.md]
// Eredmenyek: PASS | FAIL | NINCS (a funkcio meg nincs az oldalon) | MOTORFUGGO (csak a motorral / >0%-nal merheto) | N/A.
// Kilepesi kod: 1, ha barmelyik sor FAIL.
import fs from 'node:fs';
import { bongeszo, argumentumok, beallitas, playwright } from './kozos.mjs';
import { qa1 } from './qa1-kapcsolo.mjs';
import { qa4 } from './qa4-konverzio.mjs';
import { qa5 } from './qa5-azonositok.mjs';
import { qa6 } from './qa6-esemenyek.mjs';

const a = argumentumok();
const cfg = beallitas(a);
const tesztek = String(a.tesztek || 'qa1,qa4,qa5,qa6').split(',');
const FUTOK = { qa1, qa4, qa5, qa6 };
const b = await bongeszo();
const sorok = [];
const kezd = Date.now();
try {
  for (const t of tesztek) {
    if (!FUTOK[t]) { console.error('ismeretlen teszt: ' + t); continue; }
    process.stderr.write(`${t} fut...\n`);
    try { sorok.push(...(await FUTOK[t](b, cfg))); } catch (e) { sorok.push({ teszt: t.toUpperCase(), nezet: '-', eset: '-', eredmeny: 'FAIL', info: 'futasi hiba: ' + e.message.split('\n')[0] }); }
  }
} finally { await b.close(); }

const w = (s, n) => { s = String(s); return s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n); };
console.log(`\nMP foglalomotor QA - ${cfg.url}${cfg.alias ? ' (eles cimkent kiszolgalva)' : ''} - ${new Date().toISOString()} - ${Math.round((Date.now() - kezd) / 1000)} s`);
console.log(`kapcsolo: ${cfg.kapcsolo.mod} ${cfg.kapcsolo.nev}=${cfg.kapcsolo.ertek}; kiosztas-kulcs: ${cfg.kiosztas.kulcs}; /api/mp-foglalas: ${cfg.api}\n`);
console.log(`${w('Teszt', 7)} ${w('Nezet', 8)} ${w('Eset', 44)} ${w('Eredmeny', 11)} Megjegyzes`);
console.log('-'.repeat(140));
for (const s of sorok) console.log(`${w(s.teszt, 7)} ${w(s.nezet, 8)} ${w(s.eset, 44)} ${w(s.eredmeny, 11)} ${a.reszletes ? s.info : w(s.info, 160)}`);
const db = sorok.reduce((o, s) => ((o[s.eredmeny] = (o[s.eredmeny] || 0) + 1), o), {});
console.log('\nOsszesen: ' + Object.entries(db).map(([k, v]) => `${k} ${v}`).join(', '));
if (a.ki) fs.writeFileSync(a.ki, JSON.stringify({ url: cfg.url, ido: new Date().toISOString(), beallitas: { kapcsolo: cfg.kapcsolo, kiosztas: cfg.kiosztas, api: cfg.api, awCimke: cfg.awCimke }, sorok }, null, 1));
process.exit(db.FAIL ? 1 : 0);
