// QA-3 kontrollalt tesztek osszefoglaloja a nyers eset-naplokbol:
//   docs/booking-engine/meres-naplo/qa3-<eset>-<nap>.json  ->  qa3-osszefoglalo-<nap>.md
//   node tools/meres-proba/qa3-osszefoglalo.mjs [--nap 2026-10-07]
// Esetenkent: booking_id / PI, platformonkenti kiment esemeny_id-k, ELVART es TENYLEGES eredmeny, PASS / FAIL. A kulcs es a nyers token nincs a naplokban.
import fs from 'node:fs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const NAP = arg('nap', new Date().toISOString().slice(0, 10)), D = 'docs/booking-engine/meres-naplo/';
const ESETEK = [
  ['ujratoltes', '1. A köszönőoldal újratöltése (F5) és a vissza gomb'], ['dupla-level', '2. Ugyanaz a Salonic-levél kétszer a /api/foglalas-egyeztetes végpontra'],
  ['lemondas-elotte', '3a. Lemondás a levél feldolgozása ELŐTT'], ['lemondas-utana', '3b. Lemondás a konverzió kiküldése UTÁN + lemondási értesítő'],
  ['visszajaro', '4. Visszajáró vendég'], ['kupon', '5. Kuponos foglalás'],
  ['konz-szor', '6a. Konzultáció – szőr'], ['konz-fodrasz', '6b. Konzultáció – fodrász'], ['konz-pmu', '6c. Konzultáció – PMU'], ['konz-oxigen', '6d. Konzultáció – oxigén (akciós hajkamerás vizsgálat)'],
  ['suti-elutasitas', '7. Süti-elutasítás: Meta + TikTok küld, Google + GA4 elutasított jelzést kap'], ['kattintas-tiktok-meta', '8a. Kattintás TikTokról, foglalás Metáról'], ['kattintas-meta-google', '8b. Kattintás Metáról, foglalás Google-ről'],
  ['ajandek-visszaterites', '9. Ajándékkártya-visszatérítés: semmilyen hamis esemény nem megy ki'],
];
const EXTRA = [['dupla-level-eltero-jelzes', 'X1. EXTRA (nem a 9 eset): két levél ugyanarra a foglalásra, ELTÉRŐ „új vendég” jelzéssel (új → nem új)'], ['dupla-level-eltero-jelzes-forditva', 'X1b. EXTRA: ugyanaz FORDÍTOTT sorrendben (nem új → új)']];
const ft = (n) => (n === null || n === undefined ? '–' : new Intl.NumberFormat('hu-HU').format(n).replace(/ /g, ' '));
const ki = [`# QA-3 kontrollált tesztek (${NAP})`, '',
  '**Célok** (csak árnyék): Meta dataset 28616665324611098 (`test_event_code` TEST83939) · TikTok ARNYEK pixel DB2GTTJC77UE4D1NE4MG (`test_event_code` TEST83543) · GA4 teszt-property G-M5MLRLNQBP · Google Ads ARNYEK másodlagos akciók (Zapier-webhookon át). Minden foglalás „TESZT – Claude” néven (a valódi 24 órás listából kiszűrhető). A vizsgált előnézet kódja és ága nem változott.', '',
  '| eset | booking_id / PI | eredmény |', '|---|---|---|'];
const reszletek = []; let pass = 0, ossz = 0; const eredm = {};
const CSAK_EXTRA = arg('extra-csak', '0') === '1'; // --extra-csak 1: csak az X1-javitas utani ujrateszt (R1-R6), kulon --nap neven
const UJRA = [['dupla-level-eltero-jelzes', 'R1a. X1: két levél, ELTÉRŐ „új vendég” jelzéssel (új → nem új)'], ['dupla-level-eltero-jelzes-forditva', 'R1b. X1 fordított sorrendben (nem új → új)'], ['paros-headspa', 'R2. Páros HeadSpa – a valódi minta: két levél, azonos booking_id és azonos jelzés, a 2. levél semmit nem küld'], ['elso-foglalas', 'R3. Normál (fizetős) első foglalás – oxigénterápiás első kezelés'], ['valodi-visszajaro', 'R4. VALÓDI visszajáró: nincs szimulált levél, a Zap valódi Salonic-levele'], ['dupla-level', 'R5. Ugyanaz a levél kétszer (páros HeadSpa)'], ['darabszam-ellenorzes', 'R6. Platformonkénti darabszám és esemény_id duplázás-ellenőrzés (R1–R5 együtt)'], ['fuggoben-lezaras', 'R7. A `fuggoben` nem végállapot: automatikus `parositatlan` + egyszeri riasztás + 0 küldés; a későbbi próba sem küld (DÖNTÉS #108)']];
for (const [k, cim, extra] of (CSAK_EXTRA ? UJRA.map((x) => [...x, false]) : [...ESETEK, ...EXTRA.map((x) => [...x, true])])) {
  let o; try { o = JSON.parse(fs.readFileSync(`${D}qa3-${k}-${NAP}.json`, 'utf8')); } catch { ki.push(`| ${cim} | – | (nem futott) |`); continue; }
  eredm[k] = o.eredmeny;
  if (!extra) { ossz++; if (o.eredmeny === 'PASS') pass++; }
  ki.push(`| ${cim} | \`${o.booking_id || o.pi || '–'}\` | **${o.eredmeny}** |`);
  const r = [`## ${cim}`, '', `- előnézet: \`${o.bazis}\`; azonosító: \`${o.booking_id || o.pi || '–'}\`${o.salonic_uuid ? `; Salonic-foglalás: \`${o.salonic_uuid}\`` : ''}`];
  if (o.kattintas) r.push(`- kattintás: 1. látogatás ${o.kattintas.elso}, 2. látogatás ${o.kattintas.utolso}`);
  if (o.szimulalt && o.szimulalt.length) r.push(`- **szimulált elem:** ${o.szimulalt.join(' · ')}`);
  if (o.takaritas) r.push(`- ${o.takaritas}`);
  if (o.hiba) r.push(`- **HIBA:** ${o.hiba}`);
  const e = o.esemeny_idk;
  if (e) {
    r.push('', '**Kiment események (esemény_id platformonként):**', '', '| platform | esemény_id | küldött név | érték |', '|---|---|---|---|');
    for (const p of ['meta', 'tiktok', 'ga4', 'google']) for (const x of e.elkuldve[p]) r.push(`| ${p} | \`${x.esemeny_id}\` | ${x.nev || '–'} | ${ft(x.ertek)} |`);
    if (!['meta', 'tiktok', 'ga4', 'google'].some((p) => e.elkuldve[p].length)) r.push('| – | (nem ment ki semmi) | | |');
    if (e.nem_ment_ki.length) r.push('', 'Nem ment ki: ' + e.nem_ment_ki.map((x) => `${x.platform} \`${String(x.esemeny_id).slice(0, 28)}\` (${x.allapot}${x.indok ? ': ' + String(x.indok).slice(0, 70) : ''})`).join('; '));
  }
  r.push('', '| ellenőrzés | elvárt | tényleges | |', '|---|---|---|---|');
  for (const c of o.ellenorzesek || []) { const s = (v) => String(typeof v === 'string' ? v : JSON.stringify(v)).replace(/\|/g, '/').slice(0, 110); r.push(`| ${c.leiras.replace(/\|/g, '/')} | ${s(c.elvart)} | ${s(c.tenyleges)} | ${c.ok ? 'PASS' : '**FAIL**'} |`); }
  reszletek.push(r.join('\n'), '');
}
const R1 = eredm['dupla-level-eltero-jelzes'] === 'PASS' && eredm['dupla-level-eltero-jelzes-forditva'] === 'PASS'; // az R1 csak akkor PASS, ha MINDKET sorrend PASS
const hat = [R1, ...['paros-headspa', 'elso-foglalas', 'valodi-visszajaro', 'dupla-level', 'darabszam-ellenorzes', 'fuggoben-lezaras'].map((k) => eredm[k] === 'PASS')]; const pass6 = hat.filter(Boolean).length;
ki.push('', CSAK_EXTRA ? `**Újrateszt (R1–R7): ${pass6} / 7 eset PASS** (R1 csak akkor PASS, ha mindkét sorrend PASS: R1a ${eredm['dupla-level-eltero-jelzes'] || 'nem futott'}, R1b ${eredm['dupla-level-eltero-jelzes-forditva'] || 'nem futott'}; R2 ${eredm['paros-headspa'] || 'nem futott'}, R3 ${eredm['elso-foglalas'] || 'nem futott'}, R4 ${eredm['valodi-visszajaro'] || 'nem futott'}, R5 ${eredm['dupla-level'] || 'nem futott'}, R6 ${eredm['darabszam-ellenorzes'] || 'nem futott'}, R7 ${eredm['fuggoben-lezaras'] || 'nem futott'}). Az új, tiszta 24 órás QA-3 ablak feltétele (DÖNTÉS #108): R1–R7 mind PASS – ${pass6 === 7 ? 'teljesül' : 'NEM teljesül'}.` : `**Összesítés (a 9 eset, 14 futás):** ${pass} / ${ossz} PASS. Az EXTRA (X1) eset külön, nem számít bele.`, '', ...reszletek);
fs.writeFileSync(`${D}qa3-osszefoglalo-${NAP}.md`, ki.join('\n'));
console.log(JSON.stringify({ nap: NAP, esetek: ossz, pass }));
