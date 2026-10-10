// QA-2 3. kor (8 eset, MIND A NEGY arnyekcel) osszefoglaloja a nyers naplokbol:
//   docs/booking-engine/meres-naplo/qa2-kor3-<eset>-bongeszo|szerver|eletut-<nap>.json  [+ a Google-hoz a Zapier futasok: --zap <futasok.json>]  ->  qa2-kor3-osszefoglalo-<nap>.md
//   node tools/meres-proba/qa2-kor3-osszefoglalo.mjs [--nap 2026-10-06] [--zap /utvonal/zap-futasok-kor3.json]
import fs from 'node:fs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const NAP = arg('nap', '2026-10-06'), D = 'docs/booking-engine/meres-naplo/';
const zap = arg('zap', '') ? JSON.parse(fs.readFileSync(arg('zap', ''), 'utf8')) : [];
const ESETEK = [
  ['headspa', 'HeadSpa (páros kezelés, fizetős új vendég)'], ['kartya', 'HeadSpa ajándékkártya (valódi Stripe teszt-módú fizetés)'], ['fodrasz', 'Fodrász – ingyenes konzultáció'], ['szor', 'Szőr – lézeres konzultáció'],
  ['oxigen', 'Oxigén – fizetős első oxigénterápiás kezelés'], ['pmu', 'PMU – fizetős kezelés'], ['pmu-konz', 'PMU – ingyenes konzultáció'], ['oxigen-konz', 'Oxigén – AKCIÓS hajkamerás vizsgálat és konzultáció'],
];
const r = (h) => (h ? h.slice(0, 10) + '…' : '–');
const ft = (n) => new Intl.NumberFormat('hu-HU').format(n).replace(/ /g, ' ');
const ki = [`# QA-2 3. kör – 8 eset, mind a négy árnyékcél (${NAP})`, '',
  '**Célok** (kódban rögzítve, csak árnyék): Meta dataset 28616665324611098 (`test_event_code` TEST83939) · TikTok ARNYEK pixel DB2GTTJC77UE4D1NE4MG (`test_event_code` TEST83543) · GA4 teszt-property G-M5MLRLNQBP (előbb `/debug/mp/collect`) · Google Ads ARNYEK másodlagos akciók (Zapier-webhookon át, `GOOGLE_ARNYEK_WEBHOOK_URL`). Élő pixelre / property-re / akcióra nem ment semmi. A vészkapcsolók mind be voltak kapcsolva (semmi nem volt kikapcsolva).', '',
  'Esetenként: a küldött események (név, `event_id`, érték), a platformválasz, és az **életút-napló** (létrehozva → elküldve → lemondva → a Salonic-oldal állapota → a levél ismétlése lemondás után). A foglalások „TESZT – Claude” néven, a szerveres lépés után azonnal lemondva. Az „új vendég” jelzés szimulált (a TESZT-levélben nincs).', ''];
const osszes = { meta: 0, tiktok: 0, ga4: 0, google: 0 };
const sourceIdk = [];
for (const [kulcs, cim] of ESETEK) {
  let b, s, e; try { b = JSON.parse(fs.readFileSync(D + `qa2-kor3-${kulcs}-bongeszo-${NAP}.json`, 'utf8')); s = JSON.parse(fs.readFileSync(D + `qa2-kor3-${kulcs}-szerver-${NAP}.json`, 'utf8')); } catch (x) { ki.push(`## ${cim}`, '', `(hiányzik: ${x.message})`, ''); continue; }
  try { e = JSON.parse(fs.readFileSync(D + `qa2-kor3-${kulcs}-eletut-${NAP}.json`, 'utf8')); } catch (x) { e = null; }
  const n = s.szerveres_naplo_nyers || s.szerveres_naplo_vegso; const hz = b.hozzajarulas; sourceIdk.push(n.source_id);
  ki.push(`## ${cim}`, '', `- **source_entity_id:** \`${n.source_id}\` (az alap- és az ernyőesemény ugyanazon forrás-entitásból, **külön event_id-val**)`, `- süti-hozzájárulás: ${hz === null ? 'nincs döntés' : `statisztika ${hz.ana ? 'igen' : 'nem'}, marketing ${hz.adv ? 'igen' : 'nem'}`} (profil \`${b.hozzajarulas_profil}\`)`);
  const e0 = s.egyeztetes_valasz_nyers && s.egyeztetes_valasz_nyers.esemeny_kuldes;
  if (e0 && e0.jelleg) ki.push(`- jelleg: ${e0.jelleg}, Salonic-ár: ${ft(e0.salonic_ar)} Ft, küldött érték: ${e0.ertek === null ? 'nyitott' : ft(e0.ertek) + ' HUF'}, élő állapot a küldés előtt: \`${e0.elo_allapot}\``);
  if (b.salonic_uuid) ki.push(`- Salonic-foglalás: \`${b.salonic_uuid}\``); else if (b.pi) ki.push(`- Stripe teszt-PI: \`${b.pi}\``);
  const sorok = n.kuldesek || [];
  const meta = sorok.filter((k) => k.platform === 'meta' && k.allapot === 'elkuldve');
  if (meta.length) ki.push('- **Küldött események (Meta):** ' + meta.map((k) => `\`${k.platform_nev}\` (event_id \`${k.esemeny_id}\`) ${ft(k.ertek)} ${k.penznem}`).join(' + '));
  ki.push('', '| esemény (event_id) | platform → küldött név | érték | állapot | platformválasz |', '|---|---|---|---|---|');
  for (const k of sorok) {
    const body = (k.kerelem || {}).body || {}; let pv = (k.indok || '–').slice(0, 90);
    const m = (k.platform_valasz || '').match(/"events_received":(\d+),"messages":\[\],"fbtrace_id":"([^"]+)"/); const t = (k.platform_valasz || '').match(/"code": 0, "message": "OK", "request_id": "([^"]+)"/);
    if (m) pv = `HTTP ${k.http_status}, events_received=${m[1]}, fbtrace_id=${m[2]}`;
    else if (t) pv = `HTTP ${k.http_status}, code 0 OK, request_id=${t[1]}`;
    else if (/ga4_validacio/.test(k.platform_valasz || '')) pv = `validáció üres (\`/debug/mp/collect\`), HTTP ${k.http_status}`;
    else if (k.platform === 'google' && k.allapot === 'elkuldve') {
      const z = zap.find((x) => x.input && x.input.order_id === body.order_id && x.input.conversion_action_id === body.conversion_action_id);
      pv = `Zapier HTTP ${k.http_status} (\`${(JSON.parse(k.platform_valasz || '{}').status) || '–'}\`)` + (z ? `; Zap-futás: \`${z.status}\`, sent=${z.output && z.output.sent}, \`${z.output && z.output.valasz && z.output.valasz.conversionName}\`, requestId \`${z.output && z.output.valasz && z.output.valasz.requestId}\`` : ' (Zap-futás: nincs párosítva)');
      pv += `; akció ${body.conversion_action_id}, ${['gclid', 'wbraid', 'gbraid'].filter((x) => body[x]).join('/')}, ad_user_data ${body.ad_user_data}`;
    }
    if (k.allapot === 'elkuldve') osszes[k.platform]++;
    ki.push(`| ${k.esemeny_nev} (\`${k.esemeny_id.slice(0, 44)}${k.esemeny_id.length > 44 ? '…' : ''}\`) | ${k.platform}${k.platform_nev ? ' → ' + k.platform_nev : ''} | ${k.ertek === null ? 'nyitott' : ft(k.ertek) + ' ' + k.penznem} | ${k.allapot} | ${pv} |`);
  }
  if (e) {
    ki.push('', '**Életút-napló:**', '', '| lépés | részlet |', '|---|---|');
    for (const l of e.lepesek) { const { lepes, ...rest } = l; ki.push(`| ${lepes} | ${Object.entries(rest).filter(([, v]) => v !== undefined && v !== null).map(([k2, v]) => `${k2}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join('; ').replace(/\|/g, '/')} |`); }
  } else if (b.pi) {
    const u1 = (s.ajandek_ujra_valasz || {}), u2 = (s.ajandek_ujra_ismetles_valasz || {});
    ki.push('', '**Életút-napló:** a vásárlás Stripe teszt-módú fizetés (lemondás nincs); a webhook-ág kulcsos újrajátszása: 1. hívás `' + JSON.stringify(u1) + '`, **2. hívás (ismétlés)** `' + JSON.stringify(u2) + '` → nincs új küldés.');
  }
  ki.push('');
}
ki.push('## Összesítés', '', `Elküldött (\`elkuldve\`) sorok a nyolc eset naplójában: **Meta ${osszes.meta}, TikTok ${osszes.tiktok}, GA4 ${osszes.ga4}, Google ${osszes.google}** (esetenként: Meta 2 + TikTok 2 + GA4 1 + Google 1 = 6, a nyolc esetre 48). A GA4-be és a Google-be csak az alapesemény megy (az ernyő nem). Egyeztetés (D1, soronként): \`qa2-kor3-egyeztetes-${NAP}.json\`.`);
fs.writeFileSync(D + `qa2-kor3-osszefoglalo-${NAP}.md`, ki.join('\n'));
console.log(JSON.stringify({ osszes, esetek: sourceIdk.length }));
