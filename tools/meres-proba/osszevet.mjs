// Tobb naplo egymas melletti osszevetese: platformonkenti konverzio-"alairas" (darabszammal) es a kattintas-azonositok.
//   node osszevet.mjs <cimke=naplo.json> [<cimke=naplo.json> ...]
import fs from 'node:fs';

const p1 = (r, k) => (r.params[k] || [])[0];
const jb = (r) => { try { return JSON.parse(r.body); } catch (e) { return null; } };
const NEM_GA = /^(page_view|user_engagement|scroll|visit|session_start|first_visit|gtm\.[a-z]+|consent_update)$/i;
const NEM_META = /^(PageView|SubscribedButtonClick|Microdata|ViewContent)$/i;
const NEM_TT = /^(Pageview|LandingPageView|EngagedSession|EnrichIpv6)$/i;
const szamol = (lista) => { const m = new Map(); for (const x of lista) m.set(x, (m.get(x) || 0) + 1); return [...m].map(([k, n]) => (n > 1 ? `${k} x${n}` : k)).sort().join(' + ') || '-'; };

function osszegez(j) {
  const L = j.naplo;
  const gAds = [...new Set(L.filter((r) => r.plat === 'google-ads' && p1(r, 'en') === 'conversion' && p1(r, 'label')).map((r) => `${p1(r, 'label').slice(0, 6)}(${p1(r, 'value')})`))];
  const gaEv = L.filter((r) => r.plat === 'stape' && /g\/collect/.test(r.ut) || (r.plat === 'ga4' && /g\/collect/.test(r.ut))).map((r) => p1(r, 'en')).filter((e) => e && !NEM_GA.test(e));
  const metaEv = (r) => p1(r, 'ev') || (r.body ? new URLSearchParams(r.body).get('ev') : null); // a pixel a GET-keres mellett POST-tal (a sajat keretebol) is kuldhet
  const metaB = L.filter((r) => r.plat === 'meta' && metaEv(r) && !NEM_META.test(metaEv(r))).map(metaEv);
  const capi = L.filter((r) => /capig/.test(r.host)).map(jb).filter(Boolean).map((b) => b.event_name).filter((e) => !NEM_META.test(e));
  const tt = L.filter((r) => r.plat === 'tiktok').map(jb).filter(Boolean).map((b) => b.event).filter((e) => e && !NEM_TT.test(e));
  const keretben = L.filter((r) => !r.keret.fo && /mosaicheadspa\.hu/.test(r.keret.url)).length;
  const gaPv = L.filter((r) => ['ga4', 'stape'].includes(r.plat) && p1(r, 'en') === 'page_view').map((r) => `${p1(r, 'sid')}`);
  return {
    'Google Ads (egyedi konverzio)': gAds.sort().join(' + ') || '-', 'GA4/stape esemeny': szamol(gaEv), 'Meta bongeszo': szamol(metaB), 'Meta CAPI': szamol(capi), 'TikTok': szamol(tt),
    'keretben (sajat oldal) inditott': String(keretben), 'zapier': String(L.filter((r) => r.plat === 'zapier').length),
    'gclid (gclaw)': L.some((r) => r.plat === 'google-ads' && (r.params.gclaw || []).some((v) => /TESZT123/.test(v))) ? 'IGEN' : 'nem',
    'fbc (tr/CAPI)': L.some((r) => (r.plat === 'meta' && ((r.params.fbc || []).some((v) => /TESZT456/.test(v)) || (r.body && /TESZT456/.test(r.body)))) || (/capig/.test(r.host) && /TESZT456/.test(r.body || ''))) ? 'IGEN' : 'nem',
    'ttclid': L.some((r) => r.plat === 'tiktok' && /TESZT789/.test(r.body || '')) ? 'IGEN' : 'nem',
    'GA4 utm (cs/cm/dl)': L.some((r) => ['ga4', 'stape'].includes(r.plat) && (p1(r, 'cs') === 'teszt' || p1(r, 'cm') === 'cpc' || /utm_source=teszt/.test(p1(r, 'dl') || ''))) ? 'IGEN' : 'nem',
    'GA4 munkamenet (sid)': [...new Set(L.filter((r) => ['ga4', 'stape'].includes(r.plat)).map((r) => p1(r, 'sid')).filter(Boolean))].join(','),
    'GA4 page_view-k (sid)': gaPv.join(','),
  };
}
const args = process.argv.slice(2).map((a) => { const i = a.indexOf('='); return [a.slice(0, i), a.slice(i + 1)]; });
const adatok = args.map(([c, f]) => [c, osszegez(JSON.parse(fs.readFileSync(f, 'utf8')))]);
const sorok = Object.keys(adatok[0][1]);
for (const s of sorok) { console.log(`\n${s}:`); for (const [c, o] of adatok) console.log(`   ${c.padEnd(34)} ${o[s]}`); }
