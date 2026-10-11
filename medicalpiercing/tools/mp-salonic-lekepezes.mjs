// A 15 MP-helyszin Salonic-leképezése (csak olvasas: a nyilvanos foglalooldalak es a naptar-API, foglalas nelkul).
//
//   node tools/mp-salonic-lekepezes.mjs        -> tools/mp-salonic-lekepezes.json + osszefoglalo
//
// Helyszinenkent: szolgaltatasok (azonosito, nev, ar, idotartam, kategoria, munkatarsak), a munkatarsak neve (a naptar-API-bol,
// ha van szabad idopontjuk a kovetkezo 60 napban), a szabad idopontok szama es az elso szabad idopont, valamint a tipuskod
// (mint a koszonooldalak: mi, sh, kl, sl, al, mj, lp, vb, pm, 2p/3p/... piercing-csomag, divat). A motor futas kozben a
// Salonicbol olvas; ez a fajl az ellenorzeshez (QA-3) es a hianyok jelzesehez kell.
import fs from 'node:fs';
import path from 'node:path';
import { createSalonicAdapter, HELYSZINEK, HELYSZIN_SORREND } from '../assets/js/motor/salonic-adapter.js';
import { tipusKod } from '../assets/js/motor/tipus.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const a = createSalonicAdapter({ headers: { 'user-agent': UA, 'accept-language': 'hu-HU,hu;q=0.9' } });
const NAPOK = 60;

const eredmeny = { keszult: new Date().toISOString(), modszer: 'csak olvaso GET: medicalpiercing.salonic.hu + api.salonic.hu/calendar', helyszinek: [] };
const problemak = [];
for (const placeId of HELYSZIN_SORREND) {
  const h = HELYSZINEK[placeId];
  const hely = { place_id: placeId, varoskod: h.kod, varos: h.varos, kitelepules: h.kitelepules, szolgaltatasok: [], munkatarsak: {}, hely: null };
  try {
    const szolg = await a.getServices(placeId);
    for (const s of szolg) {
      let szabad = [];
      try { szabad = await a.getAvailability(placeId, s.serviceId, { days: NAPOK }); } catch (e) { problemak.push(`${h.varos}: ${s.serviceId} idopontjai nem olvashatok (${e.code || e.message})`); }
      for (const x of szabad) if (x.staff_label && !hely.munkatarsak[x.staff_id]) hely.munkatarsak[x.staff_id] = x.staff_label;
      hely.szolgaltatasok.push({
        service_id: s.serviceId, nev: s.name, tipus: tipusKod(s.name), ar: s.activePrice, lista_ar: s.listPrice, perc: s.durationMin,
        kategoria: s.category, spec_id: s.specId, munkatars_idk: s.staffIds,
        szabad_60_nap: szabad.length, elso_szabad: szabad.length ? new Date(szabad[0].start_unix * 1000).toISOString() : null,
      });
      if (!s.staffIds.length) problemak.push(`${h.varos}: "${s.name}" (${s.serviceId}) szolgaltatashoz nincs munkatars rendelve`);
    }
    hely.hely = a.getPlace(placeId);
    if (!szolg.length) problemak.push(`${h.varos}: nincs szolgaltatas`);
    if (!hely.szolgaltatasok.some((s) => s.szabad_60_nap)) problemak.push(`${h.varos}: a kovetkezo ${NAPOK} napban egyik szolgaltatasra sincs szabad idopont`);
  } catch (e) {
    problemak.push(`${h.varos} (${placeId}): ${e.code || ''} ${e.message}`);
  }
  eredmeny.helyszinek.push(hely);
  const sz = hely.szolgaltatasok;
  console.log(`${h.varos.padEnd(15)} ${String(placeId).padEnd(6)} ${String(sz.length).padStart(2)} szolg., ${Object.keys(hely.munkatarsak).length} munkatars nevvel, ${sz.filter((s) => s.szabad_60_nap).length} szolg.-nak van szabad idopontja (${sz.reduce((t, s) => t + s.szabad_60_nap, 0)} idopont)`);
}
// a budapesti kinalathoz kepest hianyzo tipusok (a kitelepulesek szukebb kinalata lehet szandekos: jelzes, nem hiba)
const bp = new Set(eredmeny.helyszinek[0].szolgaltatasok.map((s) => s.tipus));
for (const hely of eredmeny.helyszinek.slice(1)) {
  const itt = new Set(hely.szolgaltatasok.map((s) => s.tipus));
  const hiany = [...bp].filter((t) => !itt.has(t));
  if (hiany.length) eredmeny.helyszinek.find((x) => x === hely).hianyzo_tipusok_bp_hoz_kepest = hiany;
}
eredmeny.problemak = problemak;
fs.writeFileSync(path.join(ROOT, 'tools/mp-salonic-lekepezes.json'), JSON.stringify(eredmeny, null, 1) + '\n');
console.log(`\nproblemak (${problemak.length}):\n  ` + problemak.join('\n  '));
