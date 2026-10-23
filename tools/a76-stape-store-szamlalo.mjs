// A76 Stape Store szamlalo: CSAK OLVAS, es CSAK napi darabszamokat ir ki.
//
// Cel: a server-GTM (stape.a76.hu, live v35) Store Writer tagjei altal irt
// gyujtemenyek (a76_foglalas_forras, a76_schedule_log) napi darabszama es
// zart listas bontasa, hogy kozvetlenul lathato legyen, mennyi esemeny erkezik.
//
// Szabalyok (CLAUDE.md): vendegadat soha nem kerul a kimenetre. Kimenet:
//   - napi darabszam (budapesti nap),
//   - bontas KIZAROLAG zart listas mezokre (event_name, consent_state,
//     a76_sched_ok, a76_nav): csak rovid, szamjegy-szegeny token mehet ki,
//     minden mas "(egyeb)",
//   - a76_src: csak "van"/"nincs".
// A client_id, e-mail, telefon, booking_id, page_location, a76_lpc stb. ertekei
// SOHA nem jelennek meg. A kulcs (STAPE_A76_CONTAINER_KEY) nem kerul a kimenetre.
//
// Hasznalat:
//   STAPE_A76_CONTAINER_KEY=... node tools/a76-stape-store-szamlalo.mjs [--nap 7] [--probe]
// Kornyezet: STAPE_A76_DOMAIN (alap https://stape.a76.hu),
//   STORE_LIST_METHOD + STORE_LIST_PATH (a lista-vegpont, ha mar ismert; {c} = gyujtemeny).

import { pathToFileURL } from 'node:url';

export const GYUJTEMENYEK = ['a76_foglalas_forras', 'a76_schedule_log'];
export const ZART_MEZOK = ['event_name', 'consent_state', 'a76_sched_ok', 'a76_nav'];
const OLDALMERET = 100;
const MAX_OLDAL = 100;

// A Stape Store v2 "Filter documents" vegpont pontos utvonala a nyilvanos
// dokumentaciobol nem olvashato ki; ezeket probalja a --probe es az automatikus mod.
export const JELOLTEK = [
  { method: 'POST', path: '/collections/{c}/documents/filter' },
  { method: 'POST', path: '/collections/{c}/documents/search' },
  { method: 'GET', path: '/collections/{c}/documents' },
  { method: 'POST', path: '/collections/{c}/documents' },
];

export function biztonsagosToken(v) {
  if (v === null || v === undefined) return '(nincs)';
  const s = String(v);
  if (s === '') return '(nincs)';
  if (!/^[A-Za-z0-9_.:-]{1,32}$/.test(s)) return '(egyeb)';
  if (/\d{4,}/.test(s)) return '(egyeb)';
  return s;
}

export function idoMasodperc(doc) {
  const d = doc && typeof doc === 'object' ? doc : {};
  const adat = d.data && typeof d.data === 'object' ? d.data : d;
  const nyers = adat.timestamp ?? d.timestamp ?? d.created_at ?? d.createdAt ?? adat.created_at;
  if (nyers === null || nyers === undefined) return null;
  if (typeof nyers === 'number') return nyers > 1e11 ? Math.floor(nyers / 1000) : Math.floor(nyers);
  const s = String(nyers);
  if (/^\d+$/.test(s)) return idoMasodperc({ timestamp: Number(s) });
  const t = Date.parse(s);
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
}

export function budapestiNap(masodperc) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(masodperc * 1000));
}

export function dokumentumok(body) {
  const d = body && typeof body === 'object' ? body.data ?? body : null;
  if (Array.isArray(d)) return d;
  if (d && typeof d === 'object') {
    for (const k of ['documents', 'items', 'results', 'docs', 'data', 'rows']) if (Array.isArray(d[k])) return d[k];
  }
  return [];
}

export function kovetkezo(body) {
  const d = body && typeof body === 'object' ? body.data ?? body : {};
  const p = (d && d.pagination) || (body && body.pagination) || {};
  for (const o of [p, d, body || {}]) {
    for (const k of ['next_cursor', 'nextCursor', 'next', 'cursor', 'next_page', 'nextPage']) {
      if (o && o[k] !== undefined && o[k] !== null && o[k] !== '' && o[k] !== false) return { kulcs: k, ertek: o[k] };
    }
  }
  return null;
}

// Tiszta aggregalas: bemenet dokumentumok, kimenet csak darabszamok.
export function osszesit(docs, tolMasodperc) {
  const nap = {};
  let idoNelkul = 0;
  for (const doc of docs) {
    const t = idoMasodperc(doc);
    if (t === null) { idoNelkul++; continue; }
    if (t < tolMasodperc) continue;
    const kulcs = budapestiNap(t);
    const adat = doc.data && typeof doc.data === 'object' ? doc.data : doc;
    const n = nap[kulcs] || (nap[kulcs] = { db: 0, bontas: {}, a76_src: { van: 0, nincs: 0 } });
    n.db++;
    for (const mezo of ZART_MEZOK) {
      if (!(mezo in adat)) continue;
      const b = n.bontas[mezo] || (n.bontas[mezo] = {});
      const tok = biztonsagosToken(adat[mezo]);
      b[tok] = (b[tok] || 0) + 1;
    }
    const src = adat.a76_src;
    if (src === undefined || src === null || src === '') n.a76_src.nincs++; else n.a76_src.van++;
  }
  return { nap, idoNelkul };
}

function url(domain, kulcs, ut) {
  return `${domain.replace(/\/+$/, '')}/stape-api/${kulcs}/v2/store${ut}`;
}

async function keres(f, domain, kulcs, jelolt, gyujtemeny, oldal) {
  const ut = jelolt.path.replace('{c}', encodeURIComponent(gyujtemeny));
  const opts = { method: jelolt.method, headers: { accept: 'application/json' } };
  let u = url(domain, kulcs, ut);
  const lapozo = oldal ? { cursor: oldal.ertek, [oldal.kulcs]: oldal.ertek } : {};
  if (jelolt.method === 'GET') {
    const q = new URLSearchParams({ limit: String(OLDALMERET), ...lapozo });
    u += `?${q}`;
  } else {
    opts.headers['content-type'] = 'application/json';
    opts.body = JSON.stringify({ limit: OLDALMERET, pagination: { limit: OLDALMERET, ...lapozo }, filter: {}, ...lapozo });
  }
  const r = await f(u, opts);
  let body = null;
  try { body = await r.json(); } catch { body = null; }
  return { status: r.status, body };
}

function mezoNevek(docs) {
  // csak mezonevek es tipusok, ertek soha
  const m = {};
  for (const d of docs.slice(0, 20)) {
    const adat = d && d.data && typeof d.data === 'object' ? d.data : d;
    if (adat && typeof adat === 'object') for (const [k, v] of Object.entries(adat)) m[k] = typeof v;
  }
  return m;
}

export async function futtat({ f = fetch, domain, kulcs, nap = 7, probe = false, ma = Date.now(), log = console.log, jeloltek = JELOLTEK, gyujtemenyek = GYUJTEMENYEK }) {
  if (!kulcs) throw new Error('hianyzik a STAPE_A76_CONTAINER_KEY');
  const tol = Math.floor(ma / 1000) - nap * 86400;
  let kimenet = { domain: domain.replace(/^https?:\/\//, ''), ablak_nap: nap, gyujtemenyek: {} };
  for (const gy of gyujtemenyek) {
    let talalat = null;
    const proba = [];
    for (const j of jeloltek) {
      let r;
      try { r = await keres(f, domain, kulcs, j, gy, null); } catch { r = { status: 0, body: null }; }
      const docs = dokumentumok(r.body);
      proba.push({ method: j.method, path: j.path, status: r.status, success: r.body && r.body.success === true, van_lista: Array.isArray(docs) && docs.length > 0 });
      if (!talalat && r.status === 200 && r.body && r.body.success !== false && (docs.length > 0 || r.body.success === true)) {
        talalat = { j, elso: r.body, docs };
        if (!probe) break;
      }
    }
    if (probe) {
      kimenet.gyujtemenyek[gy] = {
        proba,
        valasz_felso_kulcsok: talalat ? Object.keys(talalat.elso || {}) : null,
        mezok: talalat ? mezoNevek(talalat.docs) : null,
        lapozo: talalat ? kovetkezo(talalat.elso) && kovetkezo(talalat.elso).kulcs : null,
      };
      continue;
    }
    if (!talalat) { kimenet.gyujtemenyek[gy] = { hiba: 'nincs mukodo lista-vegpont', proba }; continue; }
    let osszes = talalat.docs.slice();
    let body = talalat.elso;
    let elozo = null;
    for (let i = 1; i < MAX_OLDAL; i++) {
      const k = kovetkezo(body);
      if (!k || dokumentumok(body).length === 0) break;
      if (JSON.stringify(k.ertek) === elozo) break; // ugyanaz a lapozo ertek: nincs tovabblepes
      elozo = JSON.stringify(k.ertek);
      const r = await keres(f, domain, kulcs, talalat.j, gy, k);
      if (r.status !== 200) break;
      const uj = dokumentumok(r.body);
      if (!uj.length) break;
      osszes = osszes.concat(uj);
      body = r.body;
    }
    const o = osszesit(osszes, tol);
    kimenet.gyujtemenyek[gy] = { vegpont: `${talalat.j.method} ${talalat.j.path}`, beolvasott_dokumentum: osszes.length, ido_nelkuli: o.idoNelkul, napok: o.nap };
  }
  log(JSON.stringify(kimenet, null, 2));
  return kimenet;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d; };
  const kulcs = process.env.STAPE_A76_CONTAINER_KEY;
  if (kulcs) console.log(`::add-mask::${kulcs}`);
  const jeloltek = process.env.STORE_LIST_PATH
    ? [{ method: (process.env.STORE_LIST_METHOD || 'POST').toUpperCase(), path: process.env.STORE_LIST_PATH }]
    : JELOLTEK;
  futtat({
    domain: process.env.STAPE_A76_DOMAIN || 'https://stape.a76.hu',
    kulcs, nap: Number(arg('--nap', '7')), probe: process.argv.includes('--probe'), jeloltek,
  }).catch((e) => { console.error('Hiba:', String(e && e.message || e).replace(kulcs || '\u0000', '***')); process.exit(1); });
}
