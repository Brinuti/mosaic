#!/usr/bin/env node
// GY-25 hid: a Worker-oldali Google Ads titkok (GOOGLE_ADS_*) hianyaban a feltoltest egy Google Ads API-hozzaferessel rendelkezo kliens (pl. Composio proxy) vegzi.
// A DONTESEKET (kuldheto-e, validateOnly -> partialFailure, hibabesorolas, ujraproba) a Worker ugyanazon kodja (lib/gfeltoltes.js) hozza; ez a CLI csak SQL-t es keres-torzset epit.
// A click-ID a kimeneti fajlokban (keres-torzs) VAN, a SQL-ben es a konzolon NINCS. A fajlokat a futas utan torolni kell.
//   node tools/gfeltoltes-hid.mjs sql-kivalaszt <most_unix>                       -> a kuldheto sorok lekerdezese (SELECT)
//   node tools/gfeltoltes-hid.mjs sql-felvesz <most_unix>                         -> a `dry` naplo tiszta soraibol `eles` / `varakozik` sorok (egyszeri, idempotens)
//   node tools/gfeltoltes-hid.mjs terv <sorok.json> <mappa> <most_unix>           -> <mappa>/lefoglal.sql, kihagyva.sql, validate.json (keres-torzs), kuldendo.json
//   node tools/gfeltoltes-hid.mjs validalt <mappa> <valasz.json> <http> <most_unix> -> a validateOnly valasz ertekelese: <mappa>/validalt.sql, eles.json (a tiszta sorok keres-torzse)
//   node tools/gfeltoltes-hid.mjs vegleges <mappa> <valasz.json> <http> <most_unix> [request_id] -> az eles valasz ertekelese: <mappa>/vegleges.sql + osszesites (maszkolt)
import fs from 'node:fs';
import path from 'node:path';
import { GFELT, kuldesElotti, kuldesKerelem, valaszErtekel, maszk } from '../lib/gfeltoltes.js';

const [, , parancs, ...arg] = process.argv;
const olvas = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const irj = (f, t) => fs.writeFileSync(f, typeof t === 'string' ? t : JSON.stringify(t));
const szam = (v) => { const n = Number(v); if (!Number.isInteger(n)) throw new Error('nem egesz szam: ' + v); return n; };
const szoveg = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/[^A-Za-z0-9_.:+ -]/g, '')}'`);
const frissSql = (f) => `UPDATE gy_feltoltes SET allapot = ${szoveg(f.allapot)}, hiba = ${szoveg(f.hiba)}, google_hibakod = ${szoveg(f.google_hibakod)}, ujraprobalas = ${szam(f.ujraprobalas ?? 0)}, utolso_hiba_ido = ${f.utolso_hiba_ido == null ? 'NULL' : szam(f.utolso_hiba_ido)}, kovetkezo_proba = ${f.kovetkezo_proba == null ? 'NULL' : szam(f.kovetkezo_proba)}, request_id = COALESCE(${szoveg(f.request_id ?? null)}, request_id) WHERE id = ${szam(f.id)};`;

if (parancs === 'sql-kivalaszt') {
  const most = szam(arg[0]);
  console.log(`SELECT g.id, g.katt_tipus, g.order_id, g.konverzio_ido, g.ujraprobalas, f.gads_katt_ertek AS katt_ertek, f.allapot AS foglalas_allapot, f.teszt AS teszt FROM gy_feltoltes g JOIN gy_foglalas f ON f.uuid = g.uuid WHERE g.mod = 'eles' AND (g.allapot = 'varakozik' OR (g.allapot = 'hiba' AND g.kovetkezo_proba IS NOT NULL AND g.kovetkezo_proba <= ${most}) OR (g.allapot = 'kuldes_alatt' AND COALESCE(g.utolso_hiba_ido, 0) <= ${most - GFELT.lezaras})) ORDER BY g.id LIMIT ${GFELT.adag}`);
} else if (parancs === 'sql-felvesz') {
  const most = szam(arg[0]);
  console.log(`INSERT OR IGNORE INTO gy_feltoltes (uuid, mod, letrehozva, allapot, katt_tipus, katt_maszk, order_id, konverzio_ido, ertek, consent, hozzajarulas, payload_hash, hiba, katt_ido) SELECT d.uuid, 'eles', ${most}, 'varakozik', d.katt_tipus, d.katt_maszk, d.order_id, d.konverzio_ido, d.ertek, d.consent, d.hozzajarulas, d.payload_hash, NULL, d.katt_ido FROM gy_feltoltes d JOIN gy_foglalas f ON f.uuid = d.uuid WHERE d.mod = 'dry' AND d.allapot = 'dry' AND f.teszt = 0 AND f.letrehozva <= ${most - GFELT.kesleltetes};`);
} else if (parancs === 'terv') {
  const [sorokF, mappa, mostS] = arg; const most = szam(mostS);
  fs.mkdirSync(mappa, { recursive: true });
  const sorok = olvas(sorokF);
  const kuldendo = [], kihagy = [];
  for (const s of sorok) { const k = kuldesElotti(s); if (k) kihagy.push(frissSql({ id: s.id, allapot: k.allapot, hiba: k.hiba, ujraprobalas: s.ujraprobalas || 0 })); else kuldendo.push(s); }
  irj(path.join(mappa, 'lefoglal.sql'), kuldendo.map((s) => `UPDATE gy_feltoltes SET allapot = 'kuldes_alatt', utolso_hiba_ido = ${most} WHERE id = ${szam(s.id)};`).join('\n'));
  irj(path.join(mappa, 'kihagyva.sql'), kihagy.join('\n'));
  irj(path.join(mappa, 'kuldendo.json'), kuldendo);
  irj(path.join(mappa, 'validate.json'), kuldesKerelem(kuldendo, { validateOnly: true }));
  console.log(JSON.stringify({ kuldendo: kuldendo.length, kihagyva: kihagy.length, maszkolt: kuldendo.map((s) => maszk(s.katt_ertek)) }));
} else if (parancs === 'validalt' || parancs === 'vegleges') {
  const [mappa, valaszF, httpS, mostS, reqId] = arg; const most = szam(mostS); const http = szam(httpS);
  const kuldendo = olvas(path.join(mappa, parancs === 'validalt' ? 'kuldendo.json' : 'eles-sorok.json'));
  const e = valaszErtekel({ sorok: kuldendo, http, json: olvas(valaszF), requestId: reqId || null, most, vegleges: parancs === 'vegleges' });
  const sql = e.frissites.map(frissSql);
  if (e.keresHiba && !e.frissites.length) { // hozzaferesi / konfiguracios hiba: a sorok visszaallnak (varakozik / hiba, esedekes proba)
    for (const s of kuldendo) sql.push(`UPDATE gy_feltoltes SET allapot = ${s.ujraprobalas ? "'hiba'" : "'varakozik'"}, kovetkezo_proba = ${s.ujraprobalas ? most : 'NULL'} WHERE id = ${szam(s.id)};`);
  }
  irj(path.join(mappa, parancs + '.sql'), sql.join('\n'));
  if (parancs === 'validalt') { const tiszta = e.tiszta.map((i) => kuldendo[i]); irj(path.join(mappa, 'eles-sorok.json'), tiszta); irj(path.join(mappa, 'eles.json'), kuldesKerelem(tiszta, { validateOnly: false })); }
  console.log(JSON.stringify({ tiszta: e.tiszta.length, frissites: e.frissites.map((f) => [f.id, f.allapot, f.google_hibakod, f.hiba]), keresHiba: e.keresHiba }));
} else {
  console.error('ismeretlen parancs'); process.exit(2);
}
