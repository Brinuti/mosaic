// A meres-proba.mjs naplojanak kiertekelese: platformonkenti konverziok (keretenkent), dedup, kattintas-azonositok.
//   node elemzes.mjs <naplo.json> [--reszletes 1]
import fs from 'node:fs';

const fajl = process.argv[2];
const RESZLETES = process.argv.includes('--reszletes');
const j = JSON.parse(fs.readFileSync(fajl, 'utf8'));
const L = j.naplo;
const p1 = (r, k) => (r.params[k] || [])[0];
const kt = (r) => (r.keret.fo ? 'FO' : /mosaicheadspa\.hu/.test(r.keret.url) ? 'KERET(sajat oldal)' : `KERET(${(r.keret.url || '?').replace(/^https?:\/\//, '').split('/')[0] || 'about:blank'})`);
const kiir = (s) => console.log(s);
const jsonBody = (r) => { try { return JSON.parse(r.body); } catch (e) { return null; } };

kiir(`=== ${j.szenario} / ${j.mod}${j.overlay ? ' / helyi dist az eles tartomanyon' : ' / eles, valtozatlan'} / kattintas-azonositok: ${j.clickids ? 'igen' : 'nem'}`);
kiir('vege URL: ' + j.vegeUrl.slice(0, 170));
const hibak = j.idovonal.filter((e) => e.esemeny === 'HIBA'); if (hibak.length) kiir('HIBA: ' + hibak.map((h) => h.uzenet.split('\n')[0]).join(' | '));
kiir(`naplozott es LETILTOTT kimeno kereses: ${L.length}`);
const sajatKeret = L.filter((r) => !r.keret.fo && /mosaicheadspa\.hu/.test(r.keret.url));
kiir(`  a sajat oldal KERETBEN (a Salonic-iframe-ben betoltott koszonooldal) inditott meresi keres: ${sajatKeret.length}${sajatKeret.length ? '  <-- ' + sajatKeret.map((r) => r.plat + ' ' + (p1(r, 'en') || p1(r, 'ev') || r.ut)).join(', ') : '  (a keretben a koszonooldal semmit nem kuld)'}`);
const egyebKeret = L.filter((r) => !r.keret.fo && !/mosaicheadspa\.hu/.test(r.keret.url));
if (egyebKeret.length) kiir(`  harmadik fel sajat keretebol (pl. Meta pixel-iframe): ${egyebKeret.length} (${[...new Set(egyebKeret.map((r) => r.plat + ' ' + kt(r)))].join(', ')})`);
const tilt = L.filter((r) => r.plat === 'ismeretlen-tiltott'); if (tilt.length) kiir(`  nem besorolt, de tiltott: ${tilt.map((r) => `${r.metodus} ${r.host}${r.ut.slice(0, 30)}`).join(' | ')}`);

const NEM_KONV_GA = /^(page_view|user_engagement|scroll|visit|session_start|first_visit|gtm\.[a-z]+|consent_update)$/i;
const NEM_KONV_META = /^(PageView|SubscribedButtonClick|Microdata|ViewContent)$/i;

// --- GOOGLE ADS ---
const gAds = L.filter((r) => r.plat === 'google-ads' && p1(r, 'en') === 'conversion' && p1(r, 'label'));
const gEgyedi = new Map(); for (const r of gAds) { const k = `${p1(r, 'label')} | oid=${p1(r, 'oid') || '-'} | ertek=${p1(r, 'value') ?? '-'} ${p1(r, 'currency_code') || ''}`; (gEgyedi.get(k) || gEgyedi.set(k, []).get(k)).push(r); }
kiir('\n--- GOOGLE ADS konverzio (en=conversion): egyedi konverziok (cimke | azonosito | ertek)');
for (const [k, rs] of gEgyedi) kiir(`  ${k}\n      -> ${rs.length} keres: ${rs.map((r) => `${r.host.replace('www.', '').replace('.com', '')}${r.ut.split('/').slice(0, 3).join('/')} [${kt(r)}]`).join(', ')}`);
kiir(`  EGYEDI Google Ads konverziok: ${gEgyedi.size}   (egy konverzio tobb csatornan megy: pagead/conversion, ccm/conversion, viewthroughconversion: ez NEM dupla)`);

// --- GA4 / stape ---
const ga = L.filter((r) => (r.plat === 'ga4' && /g\/collect/.test(r.ut)) || (r.plat === 'stape' && /g\/collect/.test(r.ut)));
// a GA4 / stape esemenynev a lekerdezesben (GET) VAGY a torzsben (POST: tobb esemeny egy kereseben, soronkent) van
const enLista = (r) => { const q = p1(r, 'en'); if (q) return [q]; return r.body ? String(r.body).split(/\r?\n/).map((l) => new URLSearchParams(l).get('en')).filter(Boolean) : []; };
const gaEv = new Map(); for (const r of ga) for (const e of enLista(r)) { if (NEM_KONV_GA.test(e)) continue; (gaEv.get(e) || gaEv.set(e, []).get(e)).push(r); }
kiir('\n--- GA4 (es stape g/collect): nem-oldalbetoltes esemenyek');
for (const [e, rs] of gaEv) kiir(`  ${e}: ${rs.length} keres (${rs.map((r) => `${r.host.split('.')[0]}${r.ut.split('/').slice(-2).join('/')} [${kt(r)}]`).join(', ')})`);
const adsConv = L.filter((r) => r.plat === 'ga4' && /measurement\/conversion/.test(r.ut) && enLista(r).some((e) => !NEM_KONV_GA.test(e)));
kiir(`  GA4 -> Google Ads konverzio-importok (region1/measurement/conversion): ${adsConv.flatMap((r) => enLista(r)).join(', ') || '-'}`);

// --- META ---
// a Meta-pixel a GET-keres mellett POST-tal (a sajat keretebol) is kuldhet: az esemeny / event_id a torzsben van
const fbBody = (r, k) => (r.body ? new URLSearchParams(r.body).get(k) : null);
const metaEvNev = (r) => p1(r, 'ev') || fbBody(r, 'ev');
const metaEid = (r) => p1(r, 'eid') || fbBody(r, 'eid');
const meta = L.filter((r) => r.plat === 'meta' && metaEvNev(r));
const metaEv = new Map(); for (const r of meta) { const e = metaEvNev(r); (metaEv.get(e) || metaEv.set(e, []).get(e)).push(r); }
const capi = L.filter((r) => /capig\.stape/.test(r.host));
const capiEv = capi.map((r) => jsonBody(r)).filter(Boolean).map((b) => ({ nev: b.event_name, id: b.event_id, ertek: b.conversion_value ? `${b.conversion_value.value} ${b.conversion_value.currency}` : '' }));
kiir('\n--- META');
for (const [e, rs] of metaEv) kiir(`  bongeszo (facebook.com/tr) ${e}: ${rs.length} keres [${rs.map(kt).join(',')}]${NEM_KONV_META.test(e) ? '' : '  <- konverzio'}  event_id=${[...new Set(rs.map(metaEid))].join('|').slice(0, 24)}...`);
for (const c of capiEv) { const brow = meta.find((r) => metaEid(r) === c.id); kiir(`  szerveroldali CAPI (capig.stape) ${c.nev}${c.ertek ? ' ' + c.ertek : ''}: event_id=${String(c.id).slice(0, 30)}...  ${brow ? '== a bongeszo-esemennyel AZONOS event_id: a Meta deduplikalja (1 esemeny)' : 'nincs bongeszo-parja (csak szerveroldali)'}`); }
const metaKonvNevek = new Set([...metaEv.keys()].filter((e) => !NEM_KONV_META.test(e)).concat(capiEv.map((c) => c.nev).filter((n) => !NEM_KONV_META.test(n))));
kiir(`  Meta konverzios esemeny-nevek (bongeszo + CAPI egyutt, deduplikalas utan): ${[...metaKonvNevek].map((n) => { const b = metaEv.has(n) ? (metaEv.get(n).length) : 0; const c = capiEv.filter((x) => x.nev === n).length; const dedup = b && c && capiEv.filter((x) => x.nev === n).every((x) => meta.some((r) => metaEid(r) === x.id)); return `${n} [bongeszo ${b}, CAPI ${c}${dedup ? ', azonos event_id' : ''}]`; }).join('; ')}`);

// --- TIKTOK ---
const tt = L.filter((r) => r.plat === 'tiktok');
kiir('\n--- TIKTOK');
for (const r of tt) {
  const b = jsonBody(r); let ev = '?';
  if (b) { const lista = Array.isArray(b) ? b : (b.batch || b.events || [b]); ev = lista.map((x) => x.event || (x.properties && x.properties.event) || '?').join(','); } else ev = r.ut.endsWith('/act') ? '(esemeny-kotegek, nem JSON-torzs)' : '?';
  kiir(`  ${r.metodus} ${r.ut} [${kt(r)}] esemeny: ${ev}`);
}
const ttKonv = tt.map((r) => jsonBody(r)).filter(Boolean).map((b) => (Array.isArray(b) ? b : [b])).flat().map((x) => x.event).filter((e) => e && !/^(Pageview|LandingPageView|EngagedSession|EnrichIpv6)$/i.test(e));
kiir(`  TikTok konverzios esemenyek: ${ttKonv.length ? ttKonv.join(', ') : '-'}`);

const zap = L.filter((r) => r.plat === 'zapier'); kiir(`\nZAPIER webhook: ${zap.length} keres [${zap.map(kt).join(',')}]`);

// --- OSSZEGZES: platformonkent hany konverzio ---
kiir('\n=== OSSZEGZES: konverzio platformonkent (keretben + fo ablakban egyutt)');
kiir(`  Google Ads : ${gEgyedi.size} egyedi konverzio (${[...gEgyedi.keys()].map((k) => k.split(' | ')[0]).join(', ')})`);
kiir(`  GA4/stape  : ${gaEv.size} fajta nem-oldalbetoltes esemeny, mindegyik ${[...gaEv.values()].map((rs) => rs.filter((r) => /g\/collect/.test(r.ut)).length).join('/')}x a gyujto vegponton`);
kiir(`  Meta       : ${[...metaKonvNevek].join(', ') || '-'}`);
kiir(`  TikTok     : ${ttKonv.length ? ttKonv.join(', ') : '(az esemeny neve csak a /pixel/act kotegben van)'}; /api/v2/pixel keresek: ${tt.length}`);
kiir(`  KERETBEN inditott: ${sajatKeret.length}`);

// --- kattintas-azonositok ---
if (j.clickids) {
  kiir('\n=== KATTINTAS-AZONOSITOK (gclid=TESZT123, fbclid=TESZT456, ttclid=TESZT789, utm_source=teszt, utm_medium=cpc)');
  const mezoben = (rs, kulcsok) => rs.filter((r) => kulcsok.some((k) => (r.params[k] || []).some((v) => /TESZT123|TESZT456|TESZT789/.test(v))));
  const g1 = mezoben(L.filter((r) => r.plat === 'google-ads'), ['gclaw', 'gclid', 'gcl_aw', 'gac']);
  kiir(`  Google Ads-kereses: gclid a "gclaw/gclid" mezoben: ${g1.length ? 'MEGVAN (' + g1.length + ' keres; pl. ' + (p1(g1[0], 'gclaw') || p1(g1[0], 'gclid')) + ')' : 'NINCS'}`);
  const g2 = mezoben(L.filter((r) => ['ga4', 'stape'].includes(r.plat)), ['gclaw', 'gclid', 'gcl_aw']);
  kiir(`  GA4/Ads-import:     gclid a "gclaw/gclid" mezoben: ${g2.length ? 'MEGVAN (' + g2.length + ' keres)' : 'NINCS'}`);
  const m1 = L.filter((r) => r.plat === 'meta' && ((r.params.fbc || []).some((v) => /TESZT456/.test(v)) || /TESZT456/.test(r.body || '')));
  kiir(`  Meta (facebook.com/tr): fbc mezo: ${m1.length ? 'MEGVAN (' + m1.length + ' keres; ' + (p1(m1[0], 'fbc') || 'POST-torzs') + ')' : 'NINCS'}`);
  const m2 = capi.filter((r) => /TESZT456/.test(r.body || ''));
  kiir(`  Meta CAPI (capig.stape): fb.clickID/fbc a torzsben: ${capi.length ? (m2.length ? 'MEGVAN (' + m2.length + '/' + capi.length + ' keres)' : 'NINCS (' + capi.length + ' keresbol egyben sem)') : '(nem volt CAPI-keres)'}`);
  const t1 = tt.filter((r) => /"callback"\s*:\s*"TESZT789/.test(r.body || '') || /"ttclid"\s*:\s*"TESZT789/.test(r.body || ''));
  kiir(`  TikTok: ttclid (context.ad.callback / ttclid) a torzsben: ${t1.length ? 'MEGVAN (' + t1.length + '/' + tt.length + ' keres)' : 'NINCS'}`);
  const utm = ga.filter((r) => p1(r, 'cs') || p1(r, 'cm') || /utm_source=teszt/.test(p1(r, 'dl') || ''));
  kiir(`  GA4 kampany-forras (cs/cm mezo, vagy utm a dl=page_location-ben): ${utm.length ? 'MEGVAN: ' + [...new Set(utm.map((r) => `cs=${p1(r, 'cs')} cm=${p1(r, 'cm')}`))].join(' | ') : 'NINCS'}`);
  const pv = ga.filter((r) => ['page_view', 'visit'].includes(p1(r, 'en'))).map((r) => `en=${p1(r, 'en')} sid=${p1(r, 'sid')} dl=${(p1(r, 'dl') || '').slice(0, 60)} dr=${(p1(r, 'dr') || '').slice(0, 80)}`);
  kiir('  GA4 page_view / visit hitek (munkamenet-kezdet): ' + (pv.length ? '\n    ' + pv.join('\n    ') : '-'));
  kiir('  referrer (dr/ref) a koszonooldalon: ' + [...new Set(L.filter((r) => r.plat === 'google-ads' || r.plat === 'ga4').map((r) => p1(r, 'dr') || p1(r, 'ref')).filter(Boolean))].map((x) => x.slice(0, 110)).join(' | '));
  kiir('  sutik a vegen: ' + j.sutik.map((c) => `${c.nev}=${c.ertek.slice(0, 36)}`).join(' | '));
}
kiir('\nengedett harmadik fel (csak szkript-betoltes): ' + Object.entries(j.harmadikFelHostok).map(([h, n]) => `${h}:${n}`).join(', '));
if (RESZLETES) { kiir('\n=== NYERS NAPLO'); for (const r of L) kiir(`#${r.n} t=${r.t} ${r.plat} ${r.metodus} [${kt(r)}] ${r.host}${r.ut} ${JSON.stringify(Object.fromEntries(Object.entries(r.params).filter(([k]) => /^(en|ev|label|value|currency_code|oid|eid|gclid|gclaw|fbc|fbp|ttclid|cs|cm|sid|dl|tid)$/.test(k)).map(([k, v]) => [k, v[0]])))}${r.body ? ' BODY=' + r.body.slice(0, 200) : ''}`); }

