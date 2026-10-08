// Munkatars-foglalo linkek mindenkihez, ahol van munkatars (?staff=<kulcs>): a Salonic jelenlegi adataibol (csak olvasas, nincs foglalas).
//
//   node tools/munkatars-linkek.mjs [--md docs/booking-engine/MUNKATARS_LINKEK.md] [--bazis https://www.mosaicheadspa.hu] [--nap 60]
//
// Uzletagankent, ahol a vendeg szakembert valaszthat (a motor szakember-valasztoja: fodraszat, oxigenterapia), kilistazza a szakembereket, a hozzajuk
// ajanlott ?staff= kulcsot es a kesz linket. A kulcs a nev egy szava (ekezet- es kisbetu-fuggetlen) vagy a Salonic azonosito: uj munkatarsnal NEM kell
// kodot modositani, ez a szkript mindig a Salonic aktualis listajat mutatja (az uj szakember megjelenik, es kap kulcsot).
// A lista csak azt tartalmazza, akinek a megadott napokon belul van szabad idopontja (a Salonic csak ekkor adja ki a nevet); aki nem foglalhato, azt kulon jelzi (azonositoval).
import fs from 'node:fs';
import { createSalonicAdapter, BUSINESSES } from '../assets/js/booking-engine/salonic-adapter.js';
import { staffCoverServices, staffLinkKey, staffDisplayName, findStaff, staffDiscountPercent } from '../assets/js/booking-engine/flow.js';
import { HAIR } from '../assets/js/booking-engine/flows/hair.js';
import { OXYGEN } from '../assets/js/booking-engine/flows/oxygen.js';
import { HEADSPA } from '../assets/js/booking-engine/flows/headspa.js';
import { LASER } from '../assets/js/booking-engine/flows/laser.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const BAZIS = arg('bazis', 'https://www.mosaicheadspa.hu'), NAP = +arg('nap', '60'), MD = arg('md', '');
const FLOWS = { headspa: HEADSPA, hair: HAIR, oxygen: OXYGEN, laser: LASER };
const CIM = { hair: 'Fodrászat', oxygen: 'Oxigénterápia', headspa: 'Head Spa', laser: 'Lézeres szőrtelenítés', pmu: 'Sminktetoválás' };
const adapter = createSalonicAdapter({ fetchImpl: (u, o) => fetch(u, o) });

const eredmeny = {};
for (const business of Object.keys(BUSINESSES)) {
  const flow = FLOWS[business];
  if (!flow || !flow.showStaffFilter) { eredmeny[business] = { valaszto: false }; continue; }
  const services = await adapter.getServices(business);
  const picks = staffCoverServices(services);
  const nevek = new Map(); const osszes = new Set(services.flatMap((s) => s.staffIds || []).map(String));
  for (const s of picks) for (const x of await adapter.getStaff(business, s.serviceId, { days: NAP })) if (x.staff_label && !nevek.has(String(x.staff_id))) nevek.set(String(x.staff_id), x.staff_label);
  const lista = [...nevek].map(([id, label]) => ({ id, label }));
  const sorok = lista.map((x) => ({ id: x.id, nev: staffDisplayName(x.label), kedvezmeny: staffDiscountPercent(x.label), kulcs: staffLinkKey(x.label, lista) }));
  for (const x of sorok) { const m = findStaff(lista, x.kulcs); if (!m || m.id !== x.id) throw new Error(`a kulcs nem visszakeresheto: ${business} ${x.nev} ${x.kulcs}`); x.link = `/foglalo-motor?business=${business}&staff=${encodeURIComponent(x.kulcs)}`; }
  eredmeny[business] = { valaszto: true, sorok, nincsNev: [...osszes].filter((id) => !nevek.has(id)) };
}

const sor = [];
for (const [business, e] of Object.entries(eredmeny)) {
  if (!e.valaszto) continue;
  sor.push(`### ${CIM[business]} (\`business=${business}\`)`, '', '| Munkatárs | Kulcs | Link |', '|---|---|---|');
  for (const x of e.sorok) sor.push(`| ${x.nev}${x.kedvezmeny ? ` (${x.kedvezmeny}% kedvezmény)` : ''} | \`${x.kulcs}\` | \`${BAZIS}${x.link}\` |`);
  if (e.nincsNev.length) sor.push('', `Foglalható munkatárs, akinek a megadott időszakban nincs szabad időpontja (a Salonic ilyenkor nem adja ki a nevét), ezért nincs link: ${e.nincsNev.map((id) => '`' + id + '`').join(', ')}. A Salonic-azonosítóval (\`staff=<azonosító>\`) így is linkelhető.`);
  sor.push('');
}
const szoveg = sor.join('\n');
console.log(szoveg);
for (const [business, e] of Object.entries(eredmeny)) if (!e.valaszto) console.error(`(${CIM[business]}: nincs szakember-valaszto; a ?staff= nem valtoztat semmit)`);
if (MD) {
  const fej = fs.readFileSync(MD, 'utf8').split('<!-- LISTA -->')[0];
  fs.writeFileSync(MD, fej + '<!-- LISTA -->\n' + `_Előállítva: ${new Date().toISOString().slice(0, 10)}, a Salonic aktuális adataiból (\`node tools/munkatars-linkek.mjs --md …\`)._\n\n` + szoveg + '\n');
  console.error('kiirva: ' + MD);
}
