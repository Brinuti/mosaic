// A76 Stape Store szamlalo (01-MERES, A76-3 / #474) – CSAK OLVAS, CSAK DARABSZAMOT IR KI.
// A Stape Data Store „Filter documents” utvonala (Feri a Playgroundbol, #167 6425534783):
//   POST {kontener}/stape-api/{api_key}/v2/store/collections/{collection_name}/documents
//   body: { filter?: { operator, conditions: [{ field, operator, value }] }, time_range?: { created_at: { from, to }, updated_at: { from, to } }, pagination: { limit } }
//   valasz: { success, data: { pagination: { limit, next_cursor }, items: [{ data, key, collection_name, created_at, updated_at }] } }
//
// Bemenet (kornyezeti valtozok):
//   STAPE_KEY   – az A76 sGTM kontener „Container API Key”-e (GitHub secret, soha nem irjuk ki)
//   STAPE_BASE  – a kontener domainje, alap: https://stape.a76.hu
//   KOLLEKCIOK  – vesszovel elvalasztva, alap: a76_schedule_log,a76_foglalas_forras
//   NAPOK       – hany napra visszamenoleg szamoljunk, alap: 7 (ha a TOL meg van adva, az ervenyes)
//   TOL         – ISO idopont (UTC), pl. 2026-10-26T10:40:00Z: ettol szamolunk
//   MEZO_JELZO  – egy 0/1 jelzo mezo neve a dokumentum data-jaban, aminek eloszlasat kerjuk oranként (alap: fbc_suti_van)
//
// Kimenet: HTTP-statusz, kollekcionkent dokumentumszam, a dokumentumok MEZONEVEI (ertek nelkul), ORANKENTI (budapesti) darabszam es a jelzo-mezo eloszlasa (0 / 1 / nincs).
// Vendegadat, azonosito, kulcs, nyers ertek NEM kerul a naploba.
import { pathToFileURL } from 'node:url';

const bpOra = (ms) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).format(new Date(ms));
const jelzoErtek = (v) => (v === 1 || v === '1' || v === true || v === 'true' ? '1' : v === 0 || v === '0' || v === false || v === 'false' ? '0' : 'nincs');

/** Egy kollekcio osszes dokumentuma a time_range-ben, lapozva. -> { docs, valtozat, hiba } (a lapozas kurzor-mezo nevet kiprobalja). */
export async function dokumentumokLeker({ api, kol, tolIso, hiv, limit = 100, maxLap = 200 }) {
  const e = encodeURIComponent(kol);
  const alap = { time_range: { created_at: { from: tolIso } } };
  const docs = []; let kurzor = null; let valtozat = null; let elozoElso = null;
  for (let lap = 0; lap < maxLap; lap++) {
    let r = null; let ok = null;
    const probak = lap === 0 ? [{ pagination: { limit } }] : [{ pagination: { limit, cursor: kurzor } }, { pagination: { limit, next_cursor: kurzor } }, { pagination: { limit, after: kurzor } }];
    if (lap > 0 && valtozat) probak.splice(0, probak.length, { pagination: { limit, [valtozat]: kurzor } });
    for (const p of probak) {
      r = await hiv('POST', `${api}/collections/${e}/documents`, { ...alap, ...p });
      const j = r.json && r.json.data; const items = j && Array.isArray(j.items) ? j.items : null;
      if (r.status >= 200 && r.status < 300 && items) {
        const elso = items[0] && items[0].key;
        if (lap > 0 && elso && elso === elozoElso) continue; // a kurzor-mezo nev nem ervenyes (ugyanazt a lapot adta vissza): kovetkezo valtozat
        ok = { items, kovetkezo: j.pagination && j.pagination.next_cursor, kulcs: Object.keys(p.pagination).find((k) => k !== 'limit') };
        break;
      }
    }
    if (!ok) return { docs, valtozat, hiba: r ? `HTTP ${r.status}${r.hiba ? ' ' + r.hiba : ''}` : 'nincs valasz', lap };
    if (ok.kulcs) valtozat = ok.kulcs;
    docs.push(...ok.items); elozoElso = ok.items[0] && ok.items[0].key;
    if (!ok.kovetkezo || !ok.items.length) return { docs, valtozat, hiba: null, lap: lap + 1 };
    kurzor = ok.kovetkezo;
  }
  return { docs, valtozat, hiba: 'maxLap', lap: maxLap };
}

/** A page_location query-jenek JELLEMZESE ERTEK NELKUL (A76-2): van-e `price`, ures-e, csak szamjegy-e, van-e first_booking=true. Mas paramerter erteke sehol nem kerul ki. */
export function priceJellemzes(pageLocation) {
  let q; try { q = new URL(String(pageLocation || '')).searchParams; } catch { return { price: 'nincs_url', ures: '-', csak_szamjegy: '-', first_booking: '-' }; }
  const van = q.has('price'); const v = van ? q.get('price') : null;
  return { price: van ? 'van' : 'nincs', ures: van ? (v.trim() === '' ? 'igen' : 'nem') : '-', csak_szamjegy: van ? (/^\d+$/.test(v) ? 'igen' : 'nem') : '-', first_booking: q.get('first_booking') === 'true' ? 'igen' : 'nem' };
}

export function osszegez(docs, { tolMs, mezo }) {
  const oraSzam = {}; const jelzo = {}; const nevek = new Set(); let idoNelkul = 0;
  for (const d of docs) {
    for (const k of Object.keys((d && d.data) || {})) nevek.add(k);
    const ms = Date.parse(d && d.created_at);
    if (!Number.isFinite(ms)) { idoNelkul++; continue; }
    if (ms < tolMs) continue;
    const ora = bpOra(ms); oraSzam[ora] = (oraSzam[ora] || 0) + 1;
    const j = (jelzo[ora] = jelzo[ora] || { 0: 0, 1: 0, nincs: 0 }); j[jelzoErtek(d && d.data && d.data[mezo])]++;
  }
  return { mezonevek: [...nevek].sort(), oraSzam, jelzo, idoNelkul };
}


// UJ-93 0. lepes (DECISION #263): a first_booking_raw KATEGORIKUS mezo napi (budapesti) bontasa esemenynev szerint.
// Zart halmaz: hianyzik | ures | true | false | 1 | 0 | egyeb | hiba | nincs; minden mas ertek "egyeb"-be kerul (nyers ertek, azonosito, URL SOHA nem kerul a naploba).
export const KATEGORIAK = Object.freeze(['hianyzik', 'ures', 'true', 'false', '1', '0', 'egyeb', 'hiba', 'nincs']);
const kategoria = (v) => (v === undefined || v === null ? 'nincs' : KATEGORIAK.includes(String(v)) ? String(v) : 'egyeb');
const bpNap = (ms) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Budapest' }).format(new Date(ms));
export function kategoriakNaponta(docs, { tolMs, mezo }) {
  const nap = {};
  for (const d of docs || []) {
    const ms = Date.parse(d && d.created_at);
    if (!Number.isFinite(ms) || ms < tolMs) continue;
    const dd = (d && d.data) || {};
    const ev = String(dd.event_name || '-').replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 40) || '-';
    const n = (nap[bpNap(ms)] = nap[bpNap(ms)] || {});
    const e = (n[ev] = n[ev] || {});
    const k = kategoria(dd[mezo]);
    e[k] = (e[k] || 0) + 1;
  }
  return nap;
}

// UJ-93 0. lepes: a mezo nelkuli ("nincs") sorok SZERKEZETE - csak kulcsnevek (ertek nelkul): melyik masik mezok vannak meg (pl. a76_nav), ora (UTC) es oldal-utvonal (query nelkul) szerint.
// Cel: eldonteni, hogy a hianyzo sorok a Data Tag 35 regi valtozatabol (van a76_nav, nincs first_booking_raw) vagy mas kuldotol jonnek (mas kulcskeszlet).
export function hianyzoSzerkezet(docs, { tolMs, mezo, megjelenit = ['a76_nav', 'a76_nav_diag', 'a76_sched_ok'] }) {
  const ki = {};
  for (const d of docs || []) {
    const ms = Date.parse(d && d.created_at);
    if (!Number.isFinite(ms) || ms < tolMs) continue;
    const dd = (d && d.data) || {};
    const van = dd[mezo] !== undefined && dd[mezo] !== null;
    const csop = van ? 'van' : 'nincs';
    const jel = megjelenit.map((k) => (dd[k] !== undefined && dd[k] !== null ? k : '-' + k)).join(',');
    let ut = '-'; try { ut = new URL(String(dd.page_location || '')).pathname.replace(/[^A-Za-z0-9/_-]/g, '').slice(0, 40) || '-'; } catch { /* nincs */ }
    const ora = new Date(ms).toISOString().slice(0, 13) + 'Z';
    const kulcs = `${csop} | ${jel} | kulcsszam=${Object.keys(dd).length} | ${ut} | ${ora}`;
    ki[kulcs] = (ki[kulcs] || 0) + 1;
  }
  return ki;
}

export async function futtat({ key, base = 'https://stape.a76.hu', kollekciok, napok = 7, tol = '', mezo = 'fbc_suti_van', sorok = false, kategoria: kategoriaMod = false, fetchImpl = fetch, naplo = (s) => console.log(s), most = Date.now() }) {
  if (!key) { naplo('HIBA: a STAPE_KEY (secret STAPE_A76_CONTAINER_KEY) nincs beallitva.'); return { ok: false }; }
  const rejt = (s) => String(s).split(key).join('***');
  const api = `${String(base).replace(/\/+$/, '')}/stape-api/${key}/v2/store`;
  const hiv = async (method, url, body) => {
    try {
      const r = await fetchImpl(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
      const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* nem JSON */ }
      return { status: r.status, json };
    } catch (e) { return { status: 0, json: null, hiba: rejt(e && e.message ? e.message : e) }; }
  };
  const tolMs = tol && Number.isFinite(Date.parse(tol)) ? Date.parse(tol) : most - Math.max(1, Math.min(60, Number(napok) || 7)) * 86400000;
  const tolIso = new Date(tolMs).toISOString();
  naplo(`A76 Stape Store szamlalo – ${new Date(most).toISOString()} – tol ${tolIso} – jelzo-mezo: ${mezo}`);
  const gy = await hiv('GET', `${api}/collections`);
  const lista = gy.json && (gy.json.data && Array.isArray(gy.json.data.items) ? gy.json.data.items : Array.isArray(gy.json.data) ? gy.json.data : Array.isArray(gy.json) ? gy.json : null);
  naplo(`GET /collections -> ${gy.status}${lista ? `, ${lista.length} kollekcio` : ''}${gy.hiba ? ' ' + gy.hiba : ''}`);
  const eredmeny = {};
  for (const kol of kollekciok) {
    const k = await dokumentumokLeker({ api, kol, tolIso, hiv });
    naplo(`${kol}: POST /collections/<kol>/documents (Filter documents) -> ${k.hiba ? 'HIBA ' + k.hiba : 'ok'}, ${k.docs.length} dokumentum, ${k.lap} lap, lapozo-mezo: ${k.valtozat || '-'}`);
    if (!k.docs.length) continue;
    const o = osszegez(k.docs, { tolMs, mezo });
    eredmeny[kol] = o;
    naplo(`${kol}: mezonevek (ertek nelkul): ${o.mezonevek.join(', ') || '-'}; created_at nelkuli: ${o.idoNelkul}`);
    if (process.env.SOROK === '1' || process.env.SOROK === '2' || sorok) for (const d of k.docs) { // sorszintu nezet: Budapest-ido, esemenynev, hozzajarulas-allapot, jelzo, az oldal CSAK utvonala (query / azonosito nelkul)
      const ms = Date.parse(d.created_at); if (!Number.isFinite(ms) || ms < tolMs) continue; const dd = d.data || {};
      let ut = '-'; try { ut = new URL(String(dd.page_location || '')).pathname; } catch { /* nincs */ }
      naplo(`  sor ${new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Budapest', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(ms))} | ${String(dd.event_name || '-').slice(0, 40)} | consent=${String(dd.consent_state || '-').slice(0, 40)} | ${mezo}=${jelzoErtek(dd[mezo])} | ${ut.slice(0, 60)}${process.env.SOROK === '2' ? ' | ' + Object.entries(priceJellemzes(dd.page_location)).map(([k, x]) => k + '=' + x).join(' ') : ''}`);
    }
    if (kategoriaMod) {
      const hs = hianyzoSzerkezet(k.docs, { tolMs, mezo });
      for (const kk of Object.keys(hs).sort()) naplo(`  szerkezet | ${kk} | db=${hs[kk]}`);
      const kn = kategoriakNaponta(k.docs, { tolMs, mezo });
      for (const nap of Object.keys(kn).sort()) for (const ev of Object.keys(kn[nap]).sort()) naplo(`  ${nap} | ${ev} | ${mezo}: ` + KATEGORIAK.filter((x) => kn[nap][ev][x]).map((x) => `${x}=${kn[nap][ev][x]}`).join(' '));
    }
    for (const ora of Object.keys(o.oraSzam).sort()) naplo(`  ${ora}h (Budapest): ${o.oraSzam[ora]} sor; ${mezo}: 1=${o.jelzo[ora][1]} 0=${o.jelzo[ora][0]} nincs=${o.jelzo[ora].nincs}`);
  }
  return { ok: true, eredmeny };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = await futtat({
    key: process.env.STAPE_KEY || '', base: process.env.STAPE_BASE || 'https://stape.a76.hu',
    kollekciok: (process.env.KOLLEKCIOK || 'a76_schedule_log,a76_foglalas_forras').split(',').map((s) => s.trim()).filter(Boolean),
    napok: process.env.NAPOK || 7, tol: process.env.TOL || '', mezo: process.env.MEZO_JELZO || 'fbc_suti_van', sorok: process.env.SOROK === '1' || process.env.SOROK === '2', kategoria: process.env.KATEGORIA === '1',
  });
  if (!r.ok) process.exit(1);
}
