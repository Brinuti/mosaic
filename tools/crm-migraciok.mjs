// A crm/migrations/*.sql tartalmat a Worker szamara JS-modulba (crm/lib/migraciok.generalt.js) irja:  node tools/crm-migraciok.mjs
// Ellenorzes (teszt / CI): node tools/crm-migraciok.mjs --ellenoriz
import fs from 'node:fs';
import path from 'node:path';
const gyoker = path.resolve(import.meta.dirname, '..');
const mappa = path.join(gyoker, 'crm/migrations');
const migraciok = fs.readdirSync(mappa).filter((f) => f.endsWith('.sql')).sort().map((f) => ({ nev: f.replace(/\.sql$/, ''), sql: fs.readFileSync(path.join(mappa, f), 'utf8').replace(/\r\n/g, '\n') }));
const tartalom = `// GENERALT: node tools/crm-migraciok.mjs (a crm/migrations/*.sql tartalma). Kezzel ne szerkeszd.\nexport default ${JSON.stringify(migraciok, null, 1)};\n`;
const cel = path.join(gyoker, 'crm/lib/migraciok.generalt.js');
if (process.argv.includes('--ellenoriz')) {
  const van = fs.existsSync(cel) ? fs.readFileSync(cel, 'utf8') : '';
  if (van !== tartalom) { console.error('A crm/lib/migraciok.generalt.js elavult: futtasd a node tools/crm-migraciok.mjs parancsot.'); process.exit(1); }
  console.log('rendben');
} else { fs.writeFileSync(cel, tartalom); console.log(`${migraciok.length} migracio -> crm/lib/migraciok.generalt.js`); }
