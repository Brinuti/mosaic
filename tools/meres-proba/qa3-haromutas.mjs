// QA-3 haromutas egyeztetes + negyosztalyos besorolas (DONTES #108, a Zap tesztFoglalas-szabalyaval):  Salonic online foglalas = Gmail UUID = #128 sor.
//   node tools/meres-proba/qa3-haromutas.mjs --d1 d1.json --gmail gmail.json --salonic salonic.json --szabaly szabaly.json \
//        --controlled docs/booking-engine/meres-naplo/qa3-teszt-uuid-lista-2026-10-08-ablak.txt --other <lista>[,<lista2>] [--probasavok probasavok.json] \
//        --nap 2026-10-08 [--felszabadult N] [--tol 2026-10-07T20:20:00Z --ig 2026-10-08T20:20:00Z]
// Bemenetek (a vendegadatot tartalmazo fajlok - gmail.json, szabaly.json - a repon KIVUL vannak, pl. a scratchpadben):
//   d1.json       a #128 D1 sorai (QA3_KONTROLLALT_TESZTEK.md "Az en szamlalom" SQL-je): uuid, allapot, letrehozva (UTC), kuldesi_sorok ...; a Cloudflare MCP kimenete is jo
//   gmail.json    [{uuid, nev, email, telefon}] vagy [{uuid, szoveg}] (a Salonic-level torzse) - a merasi munkamenet csomagjabol
//   salonic.json  [{uuid, allapot: "aktiv"|"torolt"}] - a Salonic aktiv + torolt export
//   szabaly.json  {tesztEmailek: [...], telefonVegzodesek: [...], gyanusEmailReszek?: [...]} - a Zap 01a0e724 kodjabol (TESZT_EMAILEK, telefon-vegzodesek)
//   probasavok.json  [{tol, ig, megjegyzes}] - opcionalis: Feri altal jelzett probaidosavok (csak REAL -> UNKNOWN iranyba hat)
// Kimenet (vendegadat nelkul): docs/booking-engine/meres-naplo/qa3-haromutas-<nap>.json + .md
import fs from 'node:fs';
import { haromutas, LABAK, OSZTALYOK, sorokBetolt, uuidLista } from './qa3-osztaly-lib.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const olvasJson = (f, kotelezo) => { if (!f) { if (kotelezo) throw new Error('hianyzo kapcsolo'); return null; } return JSON.parse(fs.readFileSync(f, 'utf8')); };
const NAP = arg('nap', new Date().toISOString().slice(0, 10)), KI = arg('ki-mappa', 'docs/booking-engine/meres-naplo/');
const controlled = new Set(), other = new Set();
for (const f of String(arg('controlled', '')).split(',').filter(Boolean)) uuidLista(fs.readFileSync(f, 'utf8')).forEach((u) => controlled.add(u));
for (const f of String(arg('other', '')).split(',').filter(Boolean)) uuidLista(fs.readFileSync(f, 'utf8')).forEach((u) => other.add(u));
const szabaly = olvasJson(arg('szabaly'), true), probasavok = olvasJson(arg('probasavok')) || [];
const forrasok = { d1: sorokBetolt(olvasJson(arg('d1'), true)), gmail: olvasJson(arg('gmail')) || [], salonic: olvasJson(arg('salonic')) || [] };
const f = forrasok, gmailMezo = f.gmail;
const r = haromutas(forrasok, { controlled, other, szabaly, probasavok });

const felsz = arg('felszabadult', null);
const tol = arg('tol', null), ig = arg('ig', null);
const kimenet = { nap: NAP, ablak: { tol, ig }, bemenet: { d1_sor: f.d1.length, gmail_uuid: new Set(gmailMezo.map((x) => String(x.uuid).toLowerCase())).size, salonic_uuid: new Set(f.salonic.map((x) => String(x.uuid).toLowerCase())).size, controlled_lista: controlled.size, other_lista: other.size, probasav: probasavok.length },
  osszesito: r.osszesito, real_szam: r.real_szam, other_test_bontas: r.other_test_bontas, matrix: r.matrix, felszabadult_kulcsok: felsz === null ? null : Number(felsz), sorok: r.sorok };
fs.mkdirSync(KI, { recursive: true });
fs.writeFileSync(`${KI}qa3-haromutas-${NAP}.json`, JSON.stringify(kimenet, null, 1) + '\n');

const L = [`# QA-3 háromutas egyeztetés és besorolás (${NAP})`, '',
  `Ablak: ${tol || '–'} → ${ig || '–'} (UTC). Bemenet: #128 sor ${kimenet.bemenet.d1_sor}, Gmail UUID ${kimenet.bemenet.gmail_uuid}, Salonic UUID ${kimenet.bemenet.salonic_uuid}; CONTROLLED_TEST lista ${controlled.size}, OTHER_TEST lista ${other.size}, Feri-féle próbasáv ${probasavok.length}.`,
  'Vendégadat nincs a kimenetben. A besorolás szabálya: `QA3_KONTROLLALT_TESZTEK.md` „A tesztszűrés pontos szabálya”. **Nyers számok, ítélet nélkül.**', '',
  '## Osztályonként (a REAL szám csak a REAL sor; az OTHER_TEST külön sor, nem része a REAL-nek)', '', '| osztály | UUID | ebből mindhárom helyen |', '|---|---|---|'];
for (const o of OSZTALYOK) L.push(`| \`${o}\`${o === 'OTHER_TEST' ? ' (külön sor)' : ''} | ${r.osszesito[o]} | ${r.matrix[o].SGD} |`);
L.push(`| **összesen** | ${OSZTALYOK.reduce((a, o) => a + r.osszesito[o], 0)} | ${OSZTALYOK.reduce((a, o) => a + r.matrix[o].SGD, 0)} |`);
L.push(`| felszabadult kulcsok (\`foglalas_lemondas\`, külön sor, tájékoztató) | ${felsz === null ? '–' : felsz} | |`, '');
L.push(`OTHER_TEST bontásban: ${Object.keys(r.other_test_bontas).length ? Object.entries(r.other_test_bontas).map(([k, v]) => `${k} ${v}`).join(', ') : '–'}.`, '');
L.push('## Háromutas mátrix (osztályonként; S = Salonic, G = Gmail, D = #128 sor)', '', `| osztály | ${LABAK.map(([k]) => k).join(' | ')} |`, `|---|${LABAK.map(() => '---').join('|')}|`);
for (const o of OSZTALYOK) L.push(`| \`${o}\` | ${LABAK.map(([k]) => r.matrix[o][k]).join(' | ')} |`);
L.push('', LABAK.map(([k, t]) => `${k}: ${t}`).join(' · '), '');
const real = r.sorok.filter((s) => s.osztaly === 'REAL' && s.labak);
L.push('## REAL – Salonic állapot szerint', '', `aktív ${real.filter((s) => s.salonic === 'aktiv').length} · törölt ${real.filter((s) => s.salonic === 'torolt').length} · nincs a Salonic-exportban ${real.filter((s) => !s.salonic).length}`, '');
const hiany = r.sorok.filter((s) => s.labak && s.labak !== 'SGD');
L.push(`## Hiányzó lábak (${hiany.length} UUID)`, '', hiany.length ? '| uuid | osztály | lábak | okkód |\n|---|---|---|---|' : '(nincs)');
for (const s of hiany) L.push(`| ${s.uuid} | ${s.osztaly}${s.alosztaly ? '/' + s.alosztaly : ''} | ${s.labak} | ${s.okok.join(', ')} |`);
const ukn = r.sorok.filter((s) => s.osztaly === 'UNKNOWN' && s.labak);
L.push('', `## UNKNOWN (${ukn.length}) – nem találgatjuk, a csomagban külön sor`, '', ukn.length ? '| uuid | lábak | okkód |\n|---|---|---|' : '(nincs)');
for (const s of ukn) L.push(`| ${s.uuid} | ${s.labak} | ${s.okok.join(', ')} |`);
const listaIsmeretlen = r.sorok.filter((s) => !s.labak);
if (listaIsmeretlen.length) L.push('', `## Listán szereplő, de egyik forrásban sem lévő UUID: ${listaIsmeretlen.length} (CONTROLLED_TEST ${listaIsmeretlen.filter((s) => s.osztaly === 'CONTROLLED_TEST').length}, OTHER_TEST ${listaIsmeretlen.filter((s) => s.osztaly === 'OTHER_TEST').length}) – nem számít sornak`);
fs.writeFileSync(`${KI}qa3-haromutas-${NAP}.md`, L.join('\n') + '\n');
console.log(L.join('\n'));
