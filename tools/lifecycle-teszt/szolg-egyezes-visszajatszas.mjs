// Lifecycle B regresszio: a VALODI (kitakart) munkatarsi levelek szolgaltatas-nevei a ketszintu egyezesen at.
// Hasznalat: node tools/lifecycle-teszt/szolg-egyezes-visszajatszas.mjs <csomag.json>     (a csomag formatuma: mint a visszajatszas.mjs-e; a vendegnev helyen hash all, nincs vendegadat)
// Minden levelhez KULON ures D1-be felvesz EGY foglalast (ugyanaz az uzletag / kezdes / munkatars / vendeg-placeholder), majd a levelet a teljes feldolgozon (munkatars mod: be) at futtatja ket valtozatban:
//   PONTOS: a foglalas szolgaltatas-neve a level neve szo szerint  -> a regi es az uj kodnak AZONOSAN kell viselkednie (szolg_egyezes: pontos)
//   TISZTA: a foglalas neve a level neve elotag / ar- / allapotfelmeres-toldalek NELKUL (tisztaNev) -> a regi kod hamis negativ (nincs_online_foglalas / ignored_uncertain), az uj kanonikusan egyezik
// A kimenet csak darabszam + kimenet-tipusok + gmail_id-k (vendegadat nincs). D1-hez / halozathoz nem nyul.
import fs from 'node:fs';
import { d1, foglaltLevel, hamisElo } from './seged.mjs';
import { ingest } from '../../netlify/lib/lifecycle/engine.js';
import { ertelmezMunkatars } from '../../netlify/lib/lifecycle/munkatars.js';
import { tisztaNev, UZLETAGAK } from '../../netlify/lib/lifecycle/uzletag.js';

const BEESO_HASH = 'e48ff85456a2c076';
const ut = process.argv[2];
if (!ut) { console.error('Hasznalat: node tools/lifecycle-teszt/szolg-egyezes-visszajatszas.mjs <csomag.json>'); process.exit(2); }
let nyers = fs.readFileSync(ut, 'utf8').trim();
if (!nyers.startsWith('{')) nyers = Buffer.from(nyers, 'base64').toString('utf8');
const esetek = JSON.parse(nyers).esetek;
const html = (e) => e.html_redaktalt.replaceAll(`[NEV-HASH:${e.nev_hash_sha256_16}]`, e.nev_hash_sha256_16 === BEESO_HASH ? 'Beeső' : `[NEV-HASH:${e.nev_hash_sha256_16}]`);
const ENV = { LIFECYCLE_MOD: 'elo', LIFECYCLE_UZLETAGOK: 'headspa,hair,oxygen,laser,pmu', LIFECYCLE_MUNKATARS_MOD: 'be', LIFECYCLE_NAPI_PLAFON: '100000' };

/** -> { tipus, szolg_egyezes } egy level vegeredmenye, ha a rendszerben pontosan egy foglalas van a megadott szolgaltatas-nevvel. */
async function fut(e, foglalasSzolg) {
  const most = Math.floor(Date.parse(e.kuldve_utc) / 1000) + 5;
  const level = { uzenetId: e.gmail_id, targy: e.targy, kuldo: e.felado, html: html(e), kuldve: most - 5 };
  const p = ertelmezMunkatars({ targy: e.targy, kuldo: e.felado, html: html(e) }, most - 5);
  if (!p.ok || e.nev_hash_sha256_16 === BEESO_HASH) return null; // nem ertelmezheto / Beeso helykitolto: nem foglalas-parositas
  const db = d1();
  const uz = UZLETAGAK[p.uzletag];
  await ingest(db, ENV, foglaltLevel({ uzenetId: 'seed-' + e.gmail_id, nev: p.nev, szolg: foglalasSzolg, munka: p.munkatars, datum: e.datum, fiok: uz.fiok, kuldo: e.felado, uuid: '0b1c2d3e-4f50-4a61-8b72-93a4b5c6d7e8' }), most - 3 * 86400);
  const elo = hamisElo(p.tipus === 'szalon_torolte' ? { allapot: 'torolve' } : { allapot: 'aktiv', startUnix: p.kezdet });
  const r = await ingest(db, ENV, level, most, { eloEllenorzes: elo });
  const rn = db.sqlite.prepare('SELECT reszlet FROM esemenyek WHERE forras_id = ?1').get(e.gmail_id);
  let szolgEgyezes = null; try { szolgEgyezes = JSON.parse(rn.reszlet).szolg_egyezes || null; } catch { /* regi kod: nincs ilyen mezo */ }
  return { tipus: r.tipus || r.miert || 'ismeretlen', szolg_egyezes: szolgEgyezes };
}

const osszes = { ertelmezett: 0 }; const valtozatok = { pontos: {}, tiszta: {} }; const kulonbseg = [];
for (const e of esetek) {
  const szolg = e.szolgaltatas;
  const tiszta = tisztaNev(szolg);
  const a = await fut(e, szolg); if (!a) continue;
  const b = await fut(e, tiszta);
  osszes.ertelmezett++;
  for (const [nev, r] of [['pontos', a], ['tiszta', b]]) { const m = valtozatok[nev]; const k = `${r.tipus}${r.szolg_egyezes ? ' / ' + r.szolg_egyezes : ''}`; m[k] = (m[k] || 0) + 1; }
  if (tiszta !== szolg) kulonbseg.push({ gmail_id: e.gmail_id, dekoralt: true, pontos: a.tipus, tiszta: b.tipus + (b.szolg_egyezes ? ' / ' + b.szolg_egyezes : '') });
}
const rendez = (m) => Object.fromEntries(Object.entries(m).sort((x, y) => y[1] - x[1]));
console.log(JSON.stringify({ osszes_level: esetek.length, ...osszes, dekoralt_szolgaltatasnev: kulonbseg.length, pontos_valtozat: rendez(valtozatok.pontos), tiszta_valtozat: rendez(valtozatok.tiszta), dekoralt_esetek: kulonbseg.map((x) => `${x.gmail_id}: pontos=${x.pontos} | tiszta=${x.tiszta}`) }, null, 1));
