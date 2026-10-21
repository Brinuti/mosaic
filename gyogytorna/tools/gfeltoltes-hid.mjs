#!/usr/bin/env node
// GY-25 hid: a Worker-oldali Google Ads titkok (GOOGLE_ADS_*) hianyaban a feltoltest egy Google Ads API-hozzaferessel rendelkezo kliens (pl. Composio proxy) vegzi.
// A DONTESEKET (kuldheto-e, validateOnly -> partialFailure, hibabesorolas, ujraproba) a Worker ugyanazon kodja (lib/gfeltoltes.js) hozza; ez a CLI csak SQL-t es keres-torzset epit.
// A click-ID a kimeneti fajlokban (keres-torzs) VAN, a SQL-ben es a konzolon NINCS. A fajlokat a futas utan torolni kell.
//   node tools/gfeltoltes-hid.mjs sql-kivalaszt <zar>                  -> a kuldheto sorok lekerdezese (SELECT), `zar` = ennek a futasnak az unix ideje (a lefoglalas azonositoja)
//   node tools/gfeltoltes-hid.mjs sql-felvesz <zar>                    -> a `dry` naplo tiszta soraibol `eles` / `varakozik` sorok (egyszeri, idempotens)
//   node tools/gfeltoltes-hid.mjs zarol <sorok.json> <zar>             -> FELTETELES lefoglalas (UPDATE ... WHERE a kuldheto feltetel); utana sql-zarolt SELECT: CSAK a tenylegesen lefoglalt sorok mennek tovabb
//   node tools/gfeltoltes-hid.mjs sql-zarolt <zar>                     -> a lefoglalt sorok lekerdezese (a `terv` bemenete)
//   node tools/gfeltoltes-hid.mjs terv <sorok.json> <mappa> <zar>      -> <mappa>/kihagyva.sql, kuldendo.json, validate.json (keres-torzs)
//   node tools/gfeltoltes-hid.mjs validalt <mappa> <valasz.json> <http> <zar> <most>        -> a validateOnly valasz ertekelese: <mappa>/validalt.sql, eles-sorok.json, eles.json
//   node tools/gfeltoltes-hid.mjs vegleges <mappa> <valasz.json> <http> <zar> <most> [request_id] -> az eles valasz ertekelese: <mappa>/vegleges.sql + osszesites (maszkolt)
// Minden eredmeny-UPDATE csak `kuldes_alatt` + az adott `zar` idovel lefoglalt soron ir (mas futas / Worker nem irhato felul). Composio-csomagolt valasz (`{successful, data}`) kicsomagolva.
// FIGYELEM: a sql-kivalaszt / sql-zarolt EREDMENYE teljes click-ID-t tartalmaz (a Google-nek kell); az eredmeny-fajlokat a futas utan torolni kell, chatbe / fajlba / repoba nem kerulhet.
import fs from 'node:fs';
import path from 'node:path';
import { GFELT, kuldesElotti, kuldesKerelem, valaszErtekel, maszk } from '../lib/gfeltoltes.js';

const [, , parancs, ...arg] = process.argv;
const olvas = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const irj = (f, t) => fs.writeFileSync(f, typeof t === 'string' ? t : JSON.stringify(t));
const szam = (v) => { const n = Number(v); if (!Number.isInteger(n)) throw new Error('nem egesz szam: ' + v); return n; };
const szoveg = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/[^A-Za-z0-9_.:+ -]/g, '')}'`);
const frissSql = (f, zar) => `UPDATE gy_feltoltes SET allapot = ${szoveg(f.allapot)}, hiba = ${szoveg(f.hiba)}, google_hibakod = ${szoveg(f.google_hibakod)}, ujraprobalas = ${szam(f.ujraprobalas ?? 0)}, utolso_hiba_ido = ${f.utolso_hiba_ido == null ? 'NULL' : szam(f.utolso_hiba_ido)}, kovetkezo_proba = ${f.kovetkezo_proba == null ? 'NULL' : szam(f.kovetkezo_proba)}, request_id = COALESCE(${szoveg(f.request_id ?? null)}, request_id) WHERE id = ${szam(f.id)} AND allapot = 'kuldes_alatt' AND utolso_hiba_ido = ${szam(zar)};`;
const kicsomag = (j) => (j && typeof j === 'object' && 'successful' in j && j.data && typeof j.data === 'object' ? (j.data.response_data && typeof j.data.response_data === 'object' ? j.data.response_data : j.data) : j);
const OSZLOP = "g.id, g.katt_tipus, g.order_id, g.konverzio_ido, g.ujraprobalas, f.gads_katt_ertek AS katt_ertek, f.allapot AS foglalas_allapot, f.teszt AS teszt FROM gy_feltoltes g JOIN gy_foglalas f ON f.uuid = g.uuid";

if (parancs === 'sql-kivalaszt') {
  const zar = szam(arg[0]);
  console.log(`SELECT ${OSZLOP} WHERE g.mod = 'eles' AND (g.allapot = 'varakozik' OR (g.allapot = 'hiba' AND g.kovetkezo_proba IS NOT NULL AND g.kovetkezo_proba <= ${zar}) OR (g.allapot = 'kuldes_alatt' AND COALESCE(g.utolso_hiba_ido, 0) <= ${zar - GFELT.lezaras})) ORDER BY g.id LIMIT ${GFELT.adag}`);
} else if (parancs === 'sql-zarolt') {
  const zar = szam(arg[0]);
  console.log(`SELECT ${OSZLOP} WHERE g.mod = 'eles' AND g.allapot = 'kuldes_alatt' AND g.utolso_hiba_ido = ${zar} ORDER BY g.id`);
} else if (parancs === 'zarol') {
  const zar = szam(arg[1]);
  console.log(olvas(arg[0]).map((s) => `UPDATE gy_feltoltes SET allapot = 'kuldes_alatt', utolso_hiba_ido = ${zar} WHERE id = ${szam(s.id)} AND mod = 'eles' AND (allapot = 'varakozik' OR (allapot = 'hiba' AND kovetkezo_proba IS NOT NULL AND kovetkezo_proba <= ${zar}) OR (allapot = 'kuldes_alatt' AND COALESCE(utolso_hiba_ido, 0) <= ${zar - GFELT.lezaras}));`).join('\n'));
} else if (parancs === 'sql-felvesz') {
  const most = szam(arg[0]);
  console.log(`INSERT OR IGNORE INTO gy_feltoltes (uuid, mod, letrehozva, allapot, katt_tipus, katt_maszk, order_id, konverzio_ido, ertek, consent, hozzajarulas, payload_hash, hiba, katt_ido) SELECT d.uuid, 'eles', ${most}, 'varakozik', d.katt_tipus, d.katt_maszk, d.order_id, d.konverzio_ido, d.ertek, d.consent, d.hozzajarulas, d.payload_hash, NULL, d.katt_ido FROM gy_feltoltes d JOIN gy_foglalas f ON f.uuid = d.uuid WHERE d.mod = 'dry' AND d.allapot = 'dry' AND f.teszt = 0 AND f.letrehozva <= ${most - GFELT.kesleltetes};`);
} else if (parancs === 'terv') {
  const [sorokF, mappa, zarS] = arg; const zar = szam(zarS);
  fs.mkdirSync(mappa, { recursive: true });
  const sorok = olvas(sorokF);
  const kuldendo = [], kihagy = [];
  for (const s of sorok) { const k = kuldesElotti(s); if (k) kihagy.push(frissSql({ id: s.id, allapot: k.allapot, hiba: k.hiba, ujraprobalas: s.ujraprobalas || 0 }, zar)); else kuldendo.push(s); }
  irj(path.join(mappa, 'kihagyva.sql'), kihagy.join('\n'));
  irj(path.join(mappa, 'kuldendo.json'), kuldendo);
  irj(path.join(mappa, 'validate.json'), kuldesKerelem(kuldendo, { validateOnly: true }));
  console.log(JSON.stringify({ kuldendo: kuldendo.length, kihagyva: kihagy.length, maszkolt: kuldendo.map((s) => maszk(s.katt_ertek)) }));
} else if (parancs === 'validalt' || parancs === 'vegleges') {
  const [mappa, valaszF, httpS, zarS, mostS, reqId] = arg; const zar = szam(zarS); const most = szam(mostS); const http = szam(httpS);
  const kuldendo = olvas(path.join(mappa, parancs === 'validalt' ? 'kuldendo.json' : 'eles-sorok.json'));
  const e = valaszErtekel({ sorok: kuldendo, http, json: kicsomag(olvas(valaszF)), requestId: reqId || null, most, vegleges: parancs === 'vegleges' });
  const sql = e.frissites.map((f) => frissSql(f, zar));
  if (e.keresHiba) { // hozzaferesi / konfiguracios / ertelmezhetetlen valasz: a nem nevesitett sorok visszaallnak (varakozik / esedekes ujraproba)
    const kesz = new Set(e.frissites.map((f) => f.id));
    for (const s of kuldendo) if (!kesz.has(s.id)) sql.push(frissSql({ id: s.id, allapot: s.ujraprobalas ? 'hiba' : 'varakozik', hiba: null, ujraprobalas: s.ujraprobalas || 0, kovetkezo_proba: s.ujraprobalas ? most : null }, zar));
  }
  irj(path.join(mappa, parancs + '.sql'), sql.join('\n'));
  if (parancs === 'validalt') { const tiszta = e.keresHiba ? [] : e.tiszta.map((i) => kuldendo[i]); irj(path.join(mappa, 'eles-sorok.json'), tiszta); irj(path.join(mappa, 'eles.json'), kuldesKerelem(tiszta, { validateOnly: false })); }
  console.log(JSON.stringify({ tiszta: e.tiszta.length, frissites: e.frissites.map((f) => [f.id, f.allapot, f.google_hibakod, f.hiba]), keresHiba: e.keresHiba }));
} else {
  console.error('ismeretlen parancs'); process.exit(2);
}
