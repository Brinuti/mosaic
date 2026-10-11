// MEDICAL PIERCING foglalas-meres lanca: koszonooldal -> /api/mp-foglalas (Pages Function) -> sajat D1-rekord
// (MP_MERES_DB, "mp-meres") -> deduplikacio a foglalasi kulcson -> Google Ads ARNYEK-feltoltes (google-ads.js).
//
// Mindket foglalasi utra ugyanaz: a mai Salonic-ut (a Salonic a /foglalas-ok*-ra iranyit a bookingUrl / price /
// first_booking parameterekkel) es kesobb a beagyazott motor (ugyanarra a koszonooldalra, ugyanazokkal a
// parameterekkel, plusz booking_id). A kulcs mindket uton placeId|employeeId|startUnix (meres.js foglalasKulcs).
//
// Adatvedelem (MP-16): a bongeszo a szolgaltatas nevet / kategoriat / vendegazonositot NEM kuldi ide; a rekordban
// sincs nev, e-mail, telefon, szolgaltatasszoveg vagy piercing-tipus. Kattintasazonosito csak hirdetesi
// hozzajarulassal kerul a rekordba (es megy a Google-nek); naploba / riportba csak maszkolva (h:xxxxxxxx).
import { koszonoOldal, foglalasKulcs, ertekFeloldas, HELYSZINEK, MP_SALONIC_HOST } from './meres.js';
import { akciokFoglalashoz, hozzajarulas, kattintasValaszt, konverzio, kuldes, elesKuldesE, maszk, ELES_HOST } from './google-ads.js';

export const SEMA = [
  `CREATE TABLE IF NOT EXISTS mp_foglalas (
    kulcs TEXT PRIMARY KEY, salonic_id TEXT, forras TEXT NOT NULL, kornyezet TEXT NOT NULL, letrehozva INTEGER NOT NULL,
    ertek INTEGER, ertek_forras TEXT, uj_vendeg INTEGER, helyszin TEXT,
    hozzajarulas_dontott INTEGER NOT NULL, hozzajarulas_hirdetes INTEGER NOT NULL, hozzajarulas_analitika INTEGER NOT NULL,
    kattintas_tipus TEXT, kattintas_ertek TEXT, kattintas_ido INTEGER)`,
  `CREATE TABLE IF NOT EXISTS mp_feltoltes (
    kulcs TEXT NOT NULL, akcio_id TEXT NOT NULL, mod TEXT NOT NULL, kuldo TEXT, allapot TEXT NOT NULL, http_status INTEGER,
    valasz TEXT, kattintas_maszk TEXT, probalkozas INTEGER NOT NULL DEFAULT 1, ido INTEGER NOT NULL,
    PRIMARY KEY (kulcs, akcio_id, mod))`,
  'CREATE INDEX IF NOT EXISTS mp_foglalas_ido ON mp_foglalas (letrehozva)',
];
const MEGORZES_NAP = 120; // a rekord ennyi nap utan torlodik; a kattintasazonosito 90 nap utan (a Google ennyit fogad)

let semaKesz = false;
export function _semaTorles() { semaKesz = false; }
async function sema(db) {
  if (semaKesz) return;
  await db.batch(SEMA.map((s) => db.prepare(s)));
  semaKesz = true;
}

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

/**
 * A bongeszo csak ezeket kuldi (assets/js/mp-meres.js): { ut, p: { bookingUrl, price, first_booking, booking_id, placeId,
 * employeeId, startDate, serviceId }, kattintas: { gclid|gbraid|wbraid: { ertek, ido } } }. Minden mas mezot eldobunk.
 */
const ENGEDETT_P = ['bookingUrl', 'price', 'first_booking', 'booking_id', 'placeId', 'employeeId', 'startDate', 'serviceId'];
export function bemenet(b) {
  if (!b || typeof b !== 'object') return null;
  const ut = /^\/foglalas-ok[a-z0-9-]*\/?$/i.test(String(b.ut || '')) ? String(b.ut) : '/foglalas-ok';
  const q = new URLSearchParams();
  for (const k of ENGEDETT_P) if (b.p && b.p[k] != null && String(b.p[k]).length <= 600) q.set(k, String(b.p[k]));
  // a bookingUrl csak a Salonic MP-aldomainje lehet
  if (q.has('bookingUrl')) {
    try { if (new URL(q.get('bookingUrl'), `https://${MP_SALONIC_HOST}/`).hostname !== MP_SALONIC_HOST) q.delete('bookingUrl'); } catch (e) { q.delete('bookingUrl'); }
  }
  return { url: `https://${ELES_HOST}${ut}?${q}`, bookingId: q.get('booking_id'), kattintas: b.kattintas && typeof b.kattintas === 'object' ? b.kattintas : null };
}

/**
 * POST /api/mp-foglalas. ctx: { request, env, waitUntil? }, opciok: { fetchImpl, most } (tesztekhez).
 * Valasz: { ok, uj: bool (elso rogzites), kulcs? } - a bongeszo semmire nem var, hiba eseten is 2xx/4xx JSON.
 */
export async function foglalasErkezes({ request, env = {}, waitUntil }, { fetchImpl = fetch, most = Math.floor(Date.now() / 1000), arlista = {} } = {}) {
  if (String(env.MP_MERES_KI || '') === '1') return json({ ok: false, ki: true }, 503);
  const db = env.MP_MERES_DB;
  if (!db) return json({ ok: false, hiba: 'nincs_adatbazis' }, 503);
  let b; try { b = await request.json(); } catch (e) { return json({ ok: false, hiba: 'rossz_keres' }, 400); }
  const be = bemenet(b);
  if (!be) return json({ ok: false, hiba: 'rossz_keres' }, 400);
  const k = koszonoOldal(be.url);
  if (!k.ok) return json({ ok: false, hiba: k.hiba }, 422);
  const a = k.adat;
  const host = new URL(request.url).hostname;
  const cookie = request.headers.get('cookie') || '';
  const hozz = hozzajarulas(cookie);
  const katt = hozz.hirdetes ? kattintasValaszt(be.kattintas, cookie, most) : null;
  const ert = ertekFeloldas(a, arlista);
  const kulcs = foglalasKulcs(a);
  const sor = {
    kulcs, salonic_id: be.bookingId || null, forras: be.bookingId ? 'motor' : 'salonic', kornyezet: host === ELES_HOST ? 'eles' : 'elonezet', letrehozva: most,
    ertek: ert.ertek, ertek_forras: ert.ertek_forras, uj_vendeg: a.ujVendeg === true ? 1 : a.ujVendeg === false ? 0 : null, helyszin: HELYSZINEK[a.placeId] || null,
    hozzajarulas_dontott: hozz.dontott ? 1 : 0, hozzajarulas_hirdetes: hozz.hirdetes ? 1 : 0, hozzajarulas_analitika: hozz.analitika ? 1 : 0,
    kattintas_tipus: katt ? katt.tipus : null, kattintas_ertek: katt ? katt.ertek : null, kattintas_ido: katt ? katt.ido : null,
  };
  try {
    await sema(db);
    const oszl = Object.keys(sor);
    const r = await db.prepare(`INSERT OR IGNORE INTO mp_foglalas (${oszl.join(',')}) VALUES (${oszl.map(() => '?').join(',')})`).bind(...oszl.map((o) => sor[o])).run();
    const uj = !!(r && r.meta && r.meta.changes);
    if (!uj) return json({ ok: true, uj: false });
    const feltolt = feltoltes(db, sor, env, host, { fetchImpl, most }).catch((e) => console.error('mp-meres: feltoltes hiba', String(e && e.message || e).slice(0, 200)));
    if (typeof waitUntil === 'function') waitUntil(feltolt); else await feltolt;
    // karbantartas: regi rekordok es a 90 napnal regebbi kattintasazonositok torlese
    const karb = db.batch([
      db.prepare('DELETE FROM mp_foglalas WHERE letrehozva < ?').bind(most - MEGORZES_NAP * 86400),
      db.prepare('DELETE FROM mp_feltoltes WHERE ido < ?').bind(most - MEGORZES_NAP * 86400),
      db.prepare('UPDATE mp_foglalas SET kattintas_ertek = NULL WHERE kattintas_ertek IS NOT NULL AND letrehozva < ?').bind(most - 90 * 86400),
    ]).catch(() => {});
    if (typeof waitUntil === 'function') waitUntil(karb); else await karb;
    return json({ ok: true, uj: true });
  } catch (e) {
    console.error('mp-meres: adatbazis-hiba', String(e && e.message || e).slice(0, 200));
    return json({ ok: false, hiba: 'adatbazis_hiba' }, 500);
  }
}

/** A foglalas ARNYEK-konverzioinak feltoltese es naplozasa (mp_feltoltes). Eles modban a mar elkuldott akciot nem kuldi ujra. */
export async function feltoltes(db, sor, env, host, { fetchImpl = fetch, most = Math.floor(Date.now() / 1000) } = {}) {
  const eles = sor.kornyezet === 'eles' && elesKuldesE(env, host);
  const f = { kulcs: sor.kulcs, letrehozva: sor.letrehozva, ertek: sor.ertek, kattintas: sor.kattintas_ertek ? { tipus: sor.kattintas_tipus, ertek: sor.kattintas_ertek } : null };
  const km = await maszk(sor.kattintas_ertek);
  const kuldendo = [], naplo = [];
  for (const akcio of akciokFoglalashoz(sor.uj_vendeg === 1 ? true : sor.uj_vendeg === 0 ? false : null)) {
    const kv = konverzio(f, akcio, { hozzajarulasHirdetes: sor.hozzajarulas_hirdetes === 1 });
    if (kv.konverzio) {
      if (eles) {
        const m = await db.prepare("SELECT 1 FROM mp_feltoltes WHERE kulcs = ? AND akcio_id = ? AND mod = 'eles' AND allapot = 'elkuldve'").bind(sor.kulcs, akcio).first();
        if (m) continue;
      }
      kuldendo.push(kv.konverzio);
    } else naplo.push({ akcioId: akcio, allapot: kv.tiltva ? 'tiltva' : 'kihagyva', mod: eles ? 'eles' : 'validate', kuldo: null, http_status: null, valasz: kv.tiltva || kv.kihagyva });
  }
  if (kuldendo.length) naplo.push(...await kuldes(kuldendo, env, { elesKuldes: eles, fetchImpl, most }));
  if (!naplo.length) return [];
  await db.batch(naplo.map((n) => db.prepare(
    `INSERT INTO mp_feltoltes (kulcs, akcio_id, mod, kuldo, allapot, http_status, valasz, kattintas_maszk, probalkozas, ido) VALUES (?,?,?,?,?,?,?,?,1,?)
     ON CONFLICT (kulcs, akcio_id, mod) DO UPDATE SET kuldo = excluded.kuldo, allapot = excluded.allapot, http_status = excluded.http_status,
       valasz = excluded.valasz, kattintas_maszk = excluded.kattintas_maszk, probalkozas = mp_feltoltes.probalkozas + 1, ido = excluded.ido`,
  ).bind(sor.kulcs, n.akcioId, n.mod, n.kuldo, n.allapot, n.http_status, n.valasz, km, most)));
  return naplo;
}

/**
 * Admin (kulcsos: x-mp-kulcs = MP_MERES_ADMIN_KULCS). GET ?riport=1[&nap=7][&kornyezet=eles]: napi osszesites, nyers azonosito nelkul;
 * GET ?kulcs=<foglalasi kulcs>: egy foglalas allapota (a kattintasazonosito maszkolva).
 * POST {"muvelet":"ujra"}: a nem sikerult (hiba / nincs_hitelesites) feltoltesek ujraprobalasa (max 50).
 */
export async function admin({ request, env = {} }, { fetchImpl = fetch, most = Math.floor(Date.now() / 1000) } = {}) {
  if (!env.MP_MERES_ADMIN_KULCS) return json({ ok: false }, 404);
  if (request.headers.get('x-mp-kulcs') !== env.MP_MERES_ADMIN_KULCS) return json({ ok: false }, 403);
  const db = env.MP_MERES_DB;
  if (!db) return json({ ok: false, hiba: 'nincs_adatbazis' }, 503);
  await sema(db);
  const url = new URL(request.url);
  if (request.method === 'GET' && url.searchParams.get('kulcs')) {
    const f = await db.prepare('SELECT * FROM mp_foglalas WHERE kulcs = ?').bind(url.searchParams.get('kulcs')).first();
    if (!f) return json({ ok: true, foglalas: null });
    const kattintas_maszk = await maszk(f.kattintas_ertek);
    delete f.kattintas_ertek;
    const t = await db.prepare('SELECT akcio_id, mod, kuldo, allapot, http_status, valasz, kattintas_maszk, probalkozas, ido FROM mp_feltoltes WHERE kulcs = ? ORDER BY akcio_id, mod').bind(f.kulcs).all();
    return json({ ok: true, foglalas: { ...f, kattintas_maszk }, feltoltesek: t.results || [] });
  }
  if (request.method === 'GET' && url.searchParams.get('riport')) {
    const nap = Math.min(120, Math.max(1, Number(url.searchParams.get('nap')) || 7));
    const korny = url.searchParams.get('kornyezet') === 'elonezet' ? 'elonezet' : 'eles';
    const tol = most - nap * 86400;
    const f = await db.prepare(`SELECT date(letrehozva, 'unixepoch') AS nap, COUNT(*) AS foglalas, SUM(uj_vendeg = 1) AS uj, SUM(uj_vendeg = 0) AS visszatero,
      SUM(ertek IS NOT NULL) AS ertekkel, SUM(hozzajarulas_hirdetes) AS hirdetesi_hozzajarulas, SUM(kattintas_tipus IS NOT NULL) AS google_kattintassal,
      SUM(forras = 'motor') AS motorbol FROM mp_foglalas WHERE kornyezet = ? AND letrehozva >= ? GROUP BY 1 ORDER BY 1`).bind(korny, tol).all();
    const t = await db.prepare(`SELECT t.akcio_id, t.mod, t.allapot, COUNT(*) AS db FROM mp_feltoltes t JOIN mp_foglalas f ON f.kulcs = t.kulcs
      WHERE f.kornyezet = ? AND t.ido >= ? GROUP BY 1, 2, 3 ORDER BY 1, 2, 3`).bind(korny, tol).all();
    return json({ ok: true, kornyezet: korny, nap, foglalasok: f.results || [], feltoltesek: t.results || [] });
  }
  if (request.method === 'POST') {
    let b = {}; try { b = await request.json(); } catch (e) { /* ures */ }
    if (b.muvelet !== 'ujra') return json({ ok: false, hiba: 'ismeretlen_muvelet' }, 400);
    const host = new URL(request.url).hostname;
    const sorok = await db.prepare(`SELECT DISTINCT f.* FROM mp_foglalas f JOIN mp_feltoltes t ON t.kulcs = f.kulcs
      WHERE t.allapot IN ('hiba', 'nincs_hitelesites') AND f.letrehozva >= ? ORDER BY f.letrehozva LIMIT 50`).bind(most - 90 * 86400).all();
    const ki = [];
    for (const s of sorok.results || []) ki.push({ kulcs: s.kulcs, eredmeny: (await feltoltes(db, s, env, host, { fetchImpl, most })).map((n) => ({ akcio: n.akcioId, allapot: n.allapot, mod: n.mod })) });
    return json({ ok: true, ujraprobalva: ki.length, ki });
  }
  return json({ ok: false }, 405);
}
