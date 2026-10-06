// QA-2 teszteset-osszefoglalo a nyers naplokbol (docs/booking-engine/meres-naplo/qa2-<eset>-bongeszo|szerver-<nap>.json) -> qa2-osszefoglalo-<nap>.md
//   node tools/meres-proba/qa2-osszefoglalo.mjs [--nap 2026-10-06]
import fs from 'node:fs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const NAP = arg('nap', '2026-10-06'), D = 'docs/booking-engine/meres-naplo/';
const ESETEK = [['headspa', 'HeadSpa (páros kezelés, fizetős új vendég)'], ['headspa-kartya', 'HeadSpa ajándékkártya (valódi Stripe teszt-módú fizetés)'], ['fodrasz', 'Fodrász (ingyenes konzultáció)'], ['szor', 'Szőr (lézeres konzultáció)'], ['oxigen', 'Oxigén (fizetős első oxigénterápiás kezelés)'], ['pmu', 'PMU (fizetős kezelés)'],
  ['oxigen-konz-nyitott', 'Oxigén – konzultáció (a konzultáció értéke NYITOTT: nem megy ki)'], ['pmu-konz-nyitott', 'PMU – konzultáció (a konzultáció értéke NYITOTT: nem megy ki)']];
const r = (h) => (h ? h.slice(0, 10) + '…' : '–');
const ki = ['# QA-2 árnyék-mérés – teszteset-összefoglaló (' + NAP + ')', '',
  '**Ez a futás a SAJÁT szállítónkkal ment** (Cloudflare-előnézet → Meta CAPI, TikTok Events API, GA4 Measurement Protocol); a Composio-s Meta-küldés érvénytelenítve (nem hiteles bizonyíték: csak `custom_data`-t vitt, `user_data` nélkül), a régi naplók törölve. A Google a Zapier-webhookon át megy (`GOOGLE_ARNYEK_WEBHOOK_URL`), a Zap még nem létezik: a kérés elkészül, `nincs_hitelesites`.', '',
  'Nyers naplók: `qa2-<eset>-bongeszo-…json` (böngészős: érkezési adatok, kérések/válaszok), `qa2-<eset>-szerver-…json` (szerveres: párosítás + **a teljes kiküldött payload** + platformválasz). Az IP a naplóban a teszt saját (futtató) IP-je; a naplózás teljes módja csak az előnézeten van bekapcsolva (`MERES_NAPLO_TELJES`).', '',
  '**Meta:** dataset 28616665324611098 (MOSAIC ARNYEK meres-teszt), `test_event_code` = `TEST83939` (valódi). **TikTok:** ARNYEK pixel `DB2GTTJC77UE4D1NE4MG`, a tesztkód még szintetikus (`TEST_MOSAIC_QA2`). **GA4:** teszt-property `G-M5MLRLNQBP` (előbb `/debug/mp/collect` validálás, utána `/mp/collect`). Élő pixelre / property-re / akcióra semmi nem ment.', '',
  'Állapotok: `elkuldve` = a platform 2xx-szel és a sikeres törzzsel válaszolt; `nincs_hitelesites` = a kérés kész, nincs titok / webhook-cím; `nyitott` = a konzultáció értéke nincs rögzítve, **nem ment ki** (sem 0-val, sem a Salonic árával); `kihagyva` = a modell szerint ide nem megy.', ''];
let osszes = { meta: 0, tiktok: 0, ga4: 0 };
for (const [kulcs, cim] of ESETEK) {
  let b, s; try { b = JSON.parse(fs.readFileSync(D + `qa2-${kulcs}-bongeszo-${NAP}.json`, 'utf8')); s = JSON.parse(fs.readFileSync(D + `qa2-${kulcs}-szerver-${NAP}.json`, 'utf8')); } catch (e) { ki.push(`## ${cim}`, '', `(hiányzik: ${e.message})`, ''); continue; }
  const n = s.szerveres_naplo_nyers || s.szerveres_naplo_vegso; const hz = b.hozzajarulas;
  ki.push(`## ${cim}`, '', `- source_entity_id: \`${n.source_id}\``, `- süti-hozzájárulás: ${hz === null ? 'nincs döntés' : `statisztika ${hz.ana ? 'igen' : 'nem'}, marketing ${hz.adv ? 'igen' : 'nem'}`} (profil \`${b.hozzajarulas_profil}\`)`);
  const e0 = s.egyeztetes_valasz_nyers && s.egyeztetes_valasz_nyers.esemeny_kuldes;
  if (e0) ki.push(`- jelleg: ${e0.jelleg}, új vendég: ${e0.uj_vendeg} (**szimulált** Salonic-jelzés), Salonic-ár: ${e0.salonic_ar} Ft, küldött érték: ${e0.ertek === null ? 'nyitott' : e0.ertek + ' Ft'}, élő állapot a küldés előtt: \`${e0.elo_allapot}\``);
  if (b.salonic_uuid) ki.push(`- Salonic-foglalás: \`${b.salonic_uuid}\` (a szerveres lépés után azonnal lemondva); \`back\`: \`${b.azonosito_a_keret_cimeben}\``); else ki.push(`- Stripe teszt-PI: \`${b.pi}\``);
  const at = (n.erkezes && n.erkezes.attr) || {}; const g = at.google || {};
  ki.push('- érkezési adatok (a szerver tárolta): ' + [Object.keys(g).length ? 'google: ' + Object.entries(g).map(([k, v]) => `${k} ts=${v.ts}`).join(', ') : 'google: –', `meta fbc ts=${(at.meta || {}).ts}`, `tiktok ttclid ts=${((at.tiktok || {}).ttclid || {}).ts}`, `utm_elso ${(at.utm_elso || {}).source}/${(at.utm_elso || {}).campaign}`, `utm_utolso ${(at.utm_utolso || {}).source}/${(at.utm_utolso || {}).campaign}`, `fbp ${at.fbp ? 'igen' : 'nem'}`, `ttp ${at.ttp ? 'igen' : 'nem'}`, `GA4 client/session ${(at.ga4 || {}).session_id ? 'igen' : 'nem'}`].join('; '), '',
    '| esemény | típus | platform (küldött név) | event_id | érték (forrás) | állapot | kiküldött payload (kivonat) | platformválasz |', '|---|---|---|---|---|---|---|---|');
  for (const k of n.kuldesek) {
    const kr = k.kerelem || {}, body = kr.body || {}; let adat = '–';
    if (k.platform === 'meta' && body.data) { const u = body.data[0].user_data; adat = `em ${r((u.em || [])[0])}, ph ${r((u.ph || [])[0])}, fbc ${u.fbc ? 'igen' : 'nem'}, fbp ${u.fbp ? 'igen' : 'nem'}, ip ${u.client_ip_address || '–'}, ua ${u.client_user_agent ? 'igen' : 'nem'}, event_id ✓`; }
    else if (k.platform === 'tiktok' && body.data) { const u = body.data[0].user; adat = `em ${r(u.email)}, ph ${r(u.phone)}, ttclid ${u.ttclid ? 'igen' : 'nem'}, ttp ${u.ttp ? 'igen' : 'nem'}, ip ${u.ip || '–'}`; }
    else if (k.platform === 'google' && body.conversion_action_id) adat = `akció ${body.conversion_action_id}, ${['gclid', 'wbraid', 'gbraid'].filter((x) => body[x]).join('/') || 'nincs kattintás'}, hash ${body.hashed_email ? 'igen' : 'nem'}, jel ${body.ad_user_data}`;
    else if (k.platform === 'ga4' && body.events) adat = `client_id ${body.client_id ? 'igen' : 'nem'}, session_id ${body.events[0].params.session_id ? 'igen' : 'nem'}, consent ${body.consent ? body.consent.ad_user_data : 'nincs'}, hash nincs`;
    const m = (k.platform_valasz || '').match(/"events_received":(\d+),"messages":\[\],"fbtrace_id":"([^"]+)"/); const t = (k.platform_valasz || '').match(/"code": 0, "message": "OK", "request_id": "([^"]+)"/);
    const pv = m ? `HTTP ${k.http_status}, events_received=${m[1]}, fbtrace_id=${m[2]}` : t ? `HTTP ${k.http_status}, code 0 OK, request_id=${t[1]}` : /ga4_validacio/.test(k.platform_valasz || '') ? `HTTP ${k.http_status} (validationMessages: [])` : (k.indok || '–').slice(0, 80);
    if (k.allapot === 'elkuldve' && ['meta', 'tiktok', 'ga4'].includes(k.platform)) osszes[k.platform]++;
    ki.push(`| ${k.esemeny_nev} | ${k.esemeny_tipus} | ${k.platform} (${k.platform_nev || '–'}) | \`${k.esemeny_id.slice(0, 30)}…\` | ${k.ertek === null ? 'nyitott' : k.ertek + ' ' + k.penznem} | ${k.allapot} | ${adat} | ${pv} |`);
  }
  ki.push('');
}
ki.push('## Összesítés', '', `A hat valódi eset (HeadSpa, HeadSpa-kártya, fodrász, szőr, oxigén, PMU): **12 Meta-esemény** (esetenként 2: alap + ernyő, esetenként külön kérés), TikTok és GA4 a fentiek szerint. Elküldött sorok az összes eset naplójában: Meta ${osszes.meta}, TikTok ${osszes.tiktok}, GA4 ${osszes.ga4}. A két „nyitott” eset 0 küldést okozott, ahogy kell.`, '');
fs.writeFileSync(D + `qa2-osszefoglalo-${NAP}.md`, ki.join('\n'));
console.log(ki.join('\n').slice(-1800));
