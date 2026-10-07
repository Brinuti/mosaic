// A fodraszat (business=hair) Salonic-adatainak pillanatkepe a hair-oldalak generatorhoz: a szolgaltatasok, hajhosszak, idotartamok, arak (a foglalo
// pontosan ezeket mutatja) es a fodraszok (nev, kedvezmeny). CSAK OLVAS (nyilvanos Salonic-oldalak + naptar-API), foglalast nem hoz letre.
//
//   node tools/hair-oldalak/salonic-pillanatkep.mjs            kiirja a tools/hair-oldalak/salonic-hair.json-t
//   node tools/hair-oldalak/salonic-pillanatkep.mjs --ellenoriz  osszeveti a fajlt a Salonic mostani adataival (elteres: kilepesi kod 1)
//
// A pillanatkepet a generator (tools/hair-oldalak.mjs) olvassa; arvaltozasnal ezt kell frissiteni, majd ujragyartani az oldalakat.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createSalonicAdapter } from '../../assets/js/booking-engine/salonic-adapter.js';
import { staffDisplayName, staffDiscountPercent, staffLinkKey } from '../../assets/js/booking-engine/flow.js';

export const FAJL = path.join(import.meta.dirname, 'salonic-hair.json');

const HOSSZ = [[/extra\s*hosszú/i, 'extra'], [/félhosszú/i, 'felhosszu'], [/közepes/i, 'kozepes'], [/hosszú/i, 'hosszu'], [/rövid/i, 'rovid']];
const hosszKulcs = (nev) => (HOSSZ.find(([re]) => re.test(nev)) || [])[1] || null;
// a Salonic-nev elejen emoji (☀ 💇‍♂️ ✂ ...) van, a vegen " - Kozepes haj": mindkettot levagjuk
const tisztaNev = (nev) => String(nev).replace(/^[^\p{L}\p{N}(]+/u, '').replace(/\s*[-–]\s*(extra\s*hosszú|félhosszú|közepes|hosszú|rövid)\s*haj\s*$/i, '').replace(/\s+/g, ' ').trim();

export async function pillanatkep() {
  const adapter = createSalonicAdapter({ fetchImpl: (u, o) => fetch(u, o) });
  const szolg = await adapter.getServices('hair');
  const konz = szolg.find((s) => /konzult/i.test(s.name));
  const nevek = new Map();
  for (const x of await adapter.getStaff('hair', konz.serviceId, { days: 60 })) if (x.staff_label) nevek.set(String(x.staff_id), x.staff_label);
  const lista = [...nevek].map(([id, label]) => ({ id, label }));
  return {
    lekerve: new Date().toISOString().slice(0, 10),
    forras: 'mosaic-hair.salonic.hu (nyilvanos szolgaltatas-oldalak), csak olvasas',
    fodraszok: lista.map(({ id, label }) => ({ id, kulcs: staffLinkKey(label, lista), nev: staffDisplayName(label), kedvezmeny: staffDiscountPercent(label) || 0 })),
    szolgaltatasok: szolg.map((s) => ({
      id: s.serviceId, kat: s.category, nev: tisztaNev(s.name), hossz: hosszKulcs(s.name), perc: s.durationMin, ar: s.activePrice, regiAr: s.listPrice ?? null,
      fodraszok: (s.staffIds || []).map(String),
    })),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const uj = await pillanatkep();
  if (process.argv.includes('--ellenoriz')) {
    const regi = JSON.parse(fs.readFileSync(FAJL, 'utf8'));
    const ki = (o) => JSON.stringify({ f: o.fodraszok, s: o.szolgaltatasok });
    if (ki(regi) === ki(uj)) { console.log(`rendben: a pillanatkep (${regi.lekerve}) megegyezik a Salonic mostani adataival`); process.exit(0); }
    const kulcs = (s) => s.id;
    const r = new Map(regi.szolgaltatasok.map((s) => [kulcs(s), s]));
    for (const s of uj.szolgaltatasok) { const o = r.get(kulcs(s)); if (!o) console.log('UJ: ' + s.nev + ' ' + s.id); else if (JSON.stringify(o) !== JSON.stringify(s)) console.log('VALTOZOTT: ' + s.nev + ' ' + s.hossz + ': ' + JSON.stringify(o) + ' -> ' + JSON.stringify(s)); r.delete(kulcs(s)); }
    for (const s of r.values()) console.log('ELTUNT: ' + s.nev + ' ' + s.id);
    process.exit(1);
  }
  fs.writeFileSync(FAJL, JSON.stringify(uj, null, 1) + '\n');
  console.log(`kiirva: ${FAJL} (${uj.szolgaltatasok.length} szolgaltatas, ${uj.fodraszok.length} fodrasz)`);
}
