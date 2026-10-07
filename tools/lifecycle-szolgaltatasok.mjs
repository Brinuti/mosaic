// A Salonic-szolgaltatasok pillanatkepe a lifecycle-motornak (nev -> idotartam). A forras a SALONIC_SERVICE_STAFF_MAPPING_CURRENT.json
// (az adapter olvasta a Salonic nyilvanos oldalairol). ARAT a motor NEM hasznal (a levelekben az ar csak garantaltan aktualis forrasbol mehet).
// Kimenet: JS-modul (nem JSON-import): a Cloudflare Pages build esbuild-je a `with { type: 'json' }` szintaxist nem biztos, hogy ismeri.
// Futtatas: node tools/lifecycle-szolgaltatasok.mjs
import fs from 'node:fs';

const j = JSON.parse(fs.readFileSync('docs/booking-engine/SALONIC_SERVICE_STAFF_MAPPING_CURRENT.json', 'utf8'));
const ki = j.services.filter((s) => s.service_name_raw).map((s) => ({ uzletag: s.business, nev: s.service_name_raw, perc: s.duration_min ?? null }));
const adat = { forras: 'SALONIC_SERVICE_STAFF_MAPPING_CURRENT.json', kelt: j.fetched_at_patch || j.fetched_at, szolgaltatasok: ki };
fs.writeFileSync('netlify/lib/lifecycle/szolgaltatasok.js',
  `// GENERALT: node tools/lifecycle-szolgaltatasok.mjs (a Salonic-szolgaltatasok pillanatkepe: nev, idotartam)\nexport default ${JSON.stringify(adat, null, 1)};\n`);
console.log(ki.length, 'szolgaltatas');
