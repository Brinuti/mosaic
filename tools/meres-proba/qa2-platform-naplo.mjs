// QA-2: egy platform (alapbol TikTok) kuldesi sorainak kigyujtese a szerveres naplokbol egy kulon, ellenorizheto naplofajlba:
// PONTOSAN mit kuldtunk (url, fejlec-nevek, teljes torzs, teszt-kod) es mit valaszolt a platform (HTTP-allapot + a TELJES valasz-torzs).
//   node tools/meres-proba/qa2-platform-naplo.mjs --platform tiktok --be naplo1.json [naplo2.json ...] --out docs/booking-engine/meres-naplo/qa2-tiktok-2026-10-06
// Kimenet: <out>.json (nyers sorok) + <out>.md (olvashato). A hitelesito token egyik fajlban sincs (a fejlecnek csak a NEVE szerepel).
import fs from 'node:fs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const PLATFORM = arg('platform', 'tiktok'), OUT = arg('out', '');
const iBe = process.argv.indexOf('--be');
const BE = [];
if (iBe > 0) for (let i = iBe + 1; i < process.argv.length && !process.argv[i].startsWith('--'); i++) BE.push(process.argv[i]);
if (!BE.length || !OUT) { console.error('hasznalat: --platform tiktok --be <naplo.json> [...] --out <fajl-nev-elotag>'); process.exit(2); }

const sorok = new Map();
const keres = (o, fajl) => {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o)) { o.forEach((x) => keres(x, fajl)); return; }
  if (o.platform === PLATFORM && typeof o.id === 'number' && o.esemeny_id && 'allapot' in o) sorok.set(o.id, { fajl, ...o }); // a meres_kuldes sora (a nyers es a vegso naplo ugyanazt az id-t viszi: egyszer szerepel)
  for (const k of Object.keys(o)) keres(o[k], fajl);
};
for (const f of BE) keres(JSON.parse(fs.readFileSync(f, 'utf8')), f.split('/').pop());
const lista = [...sorok.values()].sort((a, b) => a.id - b.id);

const nyers = lista.map((s) => ({
  sor_id: s.id, naplo: s.fajl, esemeny_id: s.esemeny_id, esemeny: s.esemeny_nev, tipus: s.esemeny_tipus, kuldott_nev: s.platform_nev, allapot: s.allapot, indok: s.indok,
  kerelem: s.kerelem ? { method: s.kerelem.method, url: s.kerelem.url, fejlec_nevek: s.kerelem.fejlec_nevek, cel: s.kerelem.cel, body: s.kerelem.body } : null,
  http_status: s.http_status, platform_valasz_nyers: s.platform_valasz, kuldo: s.kuldo, probalkozas: s.probalkozas, kuldve_utc: s.frissitve ? new Date(s.frissitve * 1000).toISOString() : null,
}));
if (nyers.some((n) => /"(access[-_]?token|authorization|api[-_]?secret)"\s*:/i.test(JSON.stringify(n.kerelem || {})))) throw new Error('a kerelemben token-szeru mezo van: nem irom ki');
fs.writeFileSync(OUT + '.json', JSON.stringify({ platform: PLATFORM, osszes_sor: nyers.length, elkuldve: nyers.filter((n) => n.allapot === 'elkuldve').length, sorok: nyers }, null, 1));

const md = [`# QA-2 – ${PLATFORM.toUpperCase()}: pontosan mit küldtünk, mit válaszolt a platform`, '',
  `Forrás: a szerveres naplók (\`meres_kuldes\` sorai), a teljes kiküldött törzzsel és a platform teljes válaszával. A hitelesítő token (\`Access-Token\` fejléc) nincs naplózva, csak a fejléc **neve**. Sorok: ${nyers.length}, ebből \`elkuldve\`: ${nyers.filter((n) => n.allapot === 'elkuldve').length}.`, ''];
for (const n of nyers) {
  md.push(`## ${n.esemeny} → ${n.kuldott_nev || '–'} (\`${n.allapot}\`) – sor #${n.sor_id}`, '', `- esemény-azonosító: \`${n.esemeny_id}\``, `- naplófájl: \`${n.naplo}\`, küldve (UTC): ${n.kuldve_utc || '–'}, küldő: ${n.kuldo || '–'}, próbálkozás: ${n.probalkozas}`);
  if (n.indok) md.push(`- indok: ${n.indok}`);
  if (n.kerelem) {
    md.push(`- kérés: \`${n.kerelem.method} ${n.kerelem.url}\`, fejlécek (csak nevek): ${(n.kerelem.fejlec_nevek || []).join(', ')}`, `- cél: \`${JSON.stringify(n.kerelem.cel)}\``, '', '**Kiküldött törzs (teljes):**', '', '```json', JSON.stringify(n.kerelem.body, null, 2), '```');
    md.push('', `**A platform válasza:** HTTP ${n.http_status === null ? '–' : n.http_status}`, '', '```json', n.platform_valasz_nyers || '(nincs)', '```', '');
  } else md.push('- (kérés nem készült)', '');
}
fs.writeFileSync(OUT + '.md', md.join('\n'));
console.log(`${PLATFORM}: ${nyers.length} sor, ebbol elkuldve ${nyers.filter((n) => n.allapot === 'elkuldve').length} -> ${OUT}.json / .md`);
