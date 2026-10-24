// GY-27: Google Ads konverzio-KIIGAZITAS (RETRACTION) a lemondott foglalasokra - a szerveres feltoltes (gfeltoltes.js, masodlagos 7858300772 akcio) PARJA.
// Mikor kell: a foglalas a Google-nek MAR elfogadott feltoltese UTAN mondodik le (a feltoltes elott lemondottat a gfeltoltes.js eleve kihagyja: kihagyva_lemondva).
// Kapcsolo: GY_GADS_KIIGAZITAS = ki | dry | eles. ALAPERTEKE: ki (a valtozo hianyaban semmi nem tortenik). dry: a jeloltek naplozodnak (gy_kiigazitas), a Google-nek semmi nem megy ki;
// eles: a Zapier-vegpont (/api/gy-gads-kiigazitas) adja ki a kerest, a Zap hivja a Google Ads uploadConversionAdjustments-t, es visszakuldi a valaszt. Elesre kapcsolni CSAK Feri kulon mondataval.
// Kuldott mezok: conversionAction (a rogzitett 7858300772), adjustmentType = RETRACTION, orderId (a feltoltes order_id-ja, 64 hex), adjustmentDateTime. NINCS click-ID, nev, e-mail,
// telefon, ertek, consent, user_identifiers. Egy foglalasra (uuid, RETRACTION, mod) legfeljebb egy naplosor (UNIQUE) -> idempotens.
// Idozites: a naplozott feltoltes utan legalabb 48 ora (GKIIG.varakozas), legfeljebb 50 nap (a Google 54 napig fogad kiigazitast); CONVERSION_NOT_FOUND / TOO_RECENT_CONVERSION a feltoltes
// naplozasa utan 72 oraig atmeneti (ujraproba), utana `nincs_konverzio` (vegleges). Az ELES feltoltes (gy_feltoltes.mod = 'eles', allapot = 'elfogadva') az egyetlen jelolt-forras.
import { GFELT, valaszNormalizal } from './gfeltoltes.js';
import { riaszt } from './db.js';

export const GKIIG = Object.freeze({
  tipus: 'RETRACTION',
  varakozas: 48 * 3600, // mp: a feltoltes naplozasa (gy_feltoltes.letrehozva) utan legalabb ennyi ido (a Google: a kiigazitas a konverzio feltoltese utan legkorabban ~24 oraval)
  vegleges: 72 * 3600, // mp: a feltoltes naplozasa utan ennyi ideig a CONVERSION_NOT_FOUND / TOO_RECENT_CONVERSION atmeneti
  maxKor: 50 * 86400, // mp: ennel regebbi feltoltesre nem kuldunk (a Google 54 napig fogad)
  adag: 10,
  lezaras: 900, // mp: a `kuldes_alatt` allapot ennyi ido utan elavult (megszakadt futas)
  felvetelAdag: 100,
  ujraproba: Object.freeze({ max: 5, varakozas: Object.freeze([3600, 10800, 21600, 43200, 86400]) }),
});

export const gkiigazitasMod = (env) => { const m = String((env && env.GY_GADS_KIIGAZITAS) || 'ki').toLowerCase(); return ['ki', 'dry', 'eles'].includes(m) ? m : 'ki'; };

const IDO_MINTA = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;
const AKCIO = `customers/${GFELT.ugyfel}/conversionActions/${GFELT.akcio}`;

/** Egy kiigazitas elem. Nincs click-ID, ertek, consent: csak a 4 mezo. @returns null, ha az order_id vagy az ido hibas */
export function kiigazitasPayload({ orderId, ido }) {
  if (!/^[0-9a-f]{64}$/.test(String(orderId || '')) || !IDO_MINTA.test(String(ido || ''))) return null;
  return { conversionAction: AKCIO, adjustmentType: GKIIG.tipus, orderId, adjustmentDateTime: ido };
}

/** A Google uploadConversionAdjustments kerestorzse (partialFailure=true). `ido` = a kiigazitas ideje (Budapest, offsettel). */
export function kiigazitasKeres(sorok, ido, { validateOnly = false } = {}) {
  return { conversionAdjustments: sorok.map((s) => kiigazitasPayload({ orderId: s.order_id, ido })), partialFailure: true, validateOnly };
}

const ENGEDETT = new Set(['conversionAction', 'adjustmentType', 'orderId', 'adjustmentDateTime']);
/** Vedohalo a kimeno kerestorzsre: csak a 4 engedett mezo, a rogzitett akcio, RETRACTION, 64 hex order_id, partialFailure=true. @returns {null|string} a hiba oka */
export function vedohaloKiigazitas(keres) {
  if (!keres || typeof keres !== 'object') return 'nincs_keres';
  if (Object.keys(keres).some((k) => !['conversionAdjustments', 'partialFailure', 'validateOnly'].includes(k))) return 'ismeretlen_fomezo';
  if (keres.partialFailure !== true || typeof keres.validateOnly !== 'boolean') return 'partial_failure';
  const l = keres.conversionAdjustments;
  if (!Array.isArray(l) || !l.length || l.length > GKIIG.adag) return 'adag';
  for (const c of l) {
    if (!c || typeof c !== 'object' || Object.keys(c).some((k) => !ENGEDETT.has(k))) return 'ismeretlen_mezo';
    if (c.conversionAction !== AKCIO) return 'akcio';
    if (c.adjustmentType !== GKIIG.tipus) return 'tipus';
    if (!/^[0-9a-f]{64}$/.test(String(c.orderId || ''))) return 'order_id';
    if (!IDO_MINTA.test(String(c.adjustmentDateTime || ''))) return 'ido';
  }
  return null;
}

// --- felvetel (naplozas) ----------------------------------------------------------------------------------------------------------------------------------------------
/**
 * A meg nem naplozott jeloltek felvetele az aktualis modban. Jelolt: ELES feltoltes `elfogadva`, a foglalas nem teszt, a feltoltes naplozasa utan LEMONDOTT (frissitve > feltoltes ideje),
 * a feltoltes naplozasa >= 48 ora es <= 50 nap. Allapot: dry (csak naplo) | varakozik (eles mod: a Zap-vegpontra var). Idempotens (UNIQUE uuid + tipus + mod). Vissza: { mod, uj }.
 */
export async function gkiigazitasFut({ db, env, most }) {
  const mod = gkiigazitasMod(env);
  if (mod === 'ki') return { mod, uj: 0 };
  const sorok = (await db.prepare(
    `SELECT g.uuid, g.order_id FROM gy_feltoltes g JOIN gy_foglalas f ON f.uuid = g.uuid
     WHERE g.mod = 'eles' AND g.allapot = 'elfogadva' AND g.order_id IS NOT NULL AND f.teszt = 0 AND f.allapot = 'lemondott' AND f.frissitve > g.letrehozva
       AND g.letrehozva <= ?1 AND g.letrehozva >= ?2
       AND NOT EXISTS (SELECT 1 FROM gy_kiigazitas k WHERE k.uuid = g.uuid AND k.tipus = 'RETRACTION' AND k.mod = ?3)
     ORDER BY g.letrehozva LIMIT ?4`,
  ).bind(most - GKIIG.varakozas, most - GKIIG.maxKor, mod, GKIIG.felvetelAdag).all()).results || [];
  let uj = 0;
  for (const s of sorok) {
    const hiba = /^[0-9a-f]{64}$/.test(String(s.order_id)) ? null : 'order_id';
    const res = await db.prepare(
      `INSERT OR IGNORE INTO gy_kiigazitas (uuid, tipus, mod, letrehozva, allapot, order_id, hiba) VALUES (?1, 'RETRACTION', ?2, ?3, ?4, ?5, ?6)`,
    ).bind(s.uuid, mod, most, hiba ? 'kihagyva_hibas' : mod === 'eles' ? 'varakozik' : 'dry', hiba ? null : s.order_id, hiba).run();
    if (res && res.meta && res.meta.changes) uj += 1;
  }
  return { mod, uj };
}

// --- Zapier-vegpont (eles mod): GET = kivalasztas + kerestorzs, POST = valasz ertekelese -----------------------------------------------------------------------------
const SOR_OSZLOP = `k.id, k.uuid, k.order_id, k.ujraprobalas, g.letrehozva AS feltoltes_ido, f.allapot AS foglalas_allapot, f.teszt AS teszt FROM gy_kiigazitas k JOIN gy_feltoltes g ON g.uuid = k.uuid AND g.mod = 'eles' JOIN gy_foglalas f ON f.uuid = k.uuid`;

/** A kuldheto sorok (eles mod): `varakozik`, esedekes ujraproba, vagy elavult `kuldes_alatt`. */
export async function kuldhetoSorok(db, { most, limit = GKIIG.adag }) {
  return (await db.prepare(
    `SELECT ${SOR_OSZLOP} WHERE k.mod = 'eles' AND k.tipus = 'RETRACTION' AND g.letrehozva <= ?1 AND g.letrehozva >= ?2
       AND (k.allapot = 'varakozik' OR (k.allapot = 'hiba' AND k.kovetkezo_proba IS NOT NULL AND k.kovetkezo_proba <= ?3) OR (k.allapot = 'kuldes_alatt' AND COALESCE(k.utolso_hiba_ido, 0) <= ?3 - ?4))
     ORDER BY k.id LIMIT ?5`,
  ).bind(most - GKIIG.varakozas, most - GKIIG.maxKor, most, GKIIG.lezaras, limit).all()).results || [];
}

async function lefoglal(db, sorok, zar) {
  const ki = [];
  for (const s of sorok) {
    const r = await db.prepare(
      `UPDATE gy_kiigazitas SET allapot = 'kuldes_alatt', utolso_hiba_ido = ?2 WHERE id = ?1 AND mod = 'eles'
         AND (allapot = 'varakozik' OR (allapot = 'hiba' AND kovetkezo_proba IS NOT NULL AND kovetkezo_proba <= ?2) OR (allapot = 'kuldes_alatt' AND COALESCE(utolso_hiba_ido, 0) <= ?2 - ?3))`,
    ).bind(s.id, zar, GKIIG.lezaras).run();
    if (r && r.meta && r.meta.changes) ki.push(s);
  }
  return ki;
}
/** Az adott futas (zar) altal lefoglalt sorok, id szerint (a GET-ben kiadott sorrend). */
export async function sorokZarral(db, zar) {
  return (await db.prepare(`SELECT ${SOR_OSZLOP} WHERE k.mod = 'eles' AND k.allapot = 'kuldes_alatt' AND k.utolso_hiba_ido = ?1 ORDER BY k.id`).bind(zar).all()).results || [];
}
/** Az eredmeny rogzitese CSAK a `zar` idovel lefoglalt soron (ha kozben mas futas atvette, nem ir felul). */
async function frissitMent(db, frissitesek, zar) {
  for (const f of frissitesek) {
    await db.prepare(
      "UPDATE gy_kiigazitas SET allapot = ?2, hiba = ?3, google_hibakod = ?4, ujraprobalas = ?5, utolso_hiba_ido = ?6, kovetkezo_proba = ?7, request_id = COALESCE(?8, request_id) WHERE id = ?1 AND allapot = 'kuldes_alatt' AND utolso_hiba_ido = ?9",
    ).bind(f.id, f.allapot, f.hiba ?? null, f.google_hibakod ?? null, f.ujraprobalas ?? 0, f.utolso_hiba_ido ?? null, f.kovetkezo_proba ?? null, f.request_id ?? null, zar).run();
  }
}
const markerKulcs = (zar) => `gads_kiig_${zar}`;

/** A kuldes elotti vegso ellenorzes: null = kuldheto, kulonben a kihagyas allapota + oka (a foglalas kozben ujra aktiv lett / teszt). */
export function kuldesElotti(s) {
  if (s.teszt) return { allapot: 'kihagyva_teszt', hiba: 'teszt_foglalas' };
  if (s.foglalas_allapot !== 'lemondott') return { allapot: 'kihagyva_aktiv', hiba: 'foglalas_nem_lemondott' };
  return null;
}

/** GET: felvetel, lefoglalas, kerestorzs. @returns {Promise<{status:number, body:object}>} */
export async function kiigazitasKivalaszt({ db, env, most, budapestIdo }) {
  const mod = gkiigazitasMod(env);
  if (mod !== 'eles') return { status: 200, body: { ok: true, mod, nincs: true } };
  await gkiigazitasFut({ db, env, most });
  await db.prepare("DELETE FROM gy_meta WHERE kulcs LIKE 'gads_kiig_%' AND CAST(json_extract(ertek, '$.ido') AS INTEGER) < ?1").bind(most - 86400).run();
  const mk = await db.prepare('INSERT OR IGNORE INTO gy_meta (kulcs, ertek) VALUES (?1, ?2)').bind(markerKulcs(most), JSON.stringify({ fazis: 'foglal', ido: most, idk: [] })).run();
  if (!(mk && mk.meta && mk.meta.changes)) return { status: 200, body: { ok: true, mod, nincs: true } }; // egyidejű GET: ez a hivas nem foglal le semmit
  const jeloltek = await kuldhetoSorok(db, { most });
  const lefoglalt = jeloltek.length ? await lefoglal(db, jeloltek, most) : [];
  const sorok = await sorokZarral(db, most);
  const kuldendo = [];
  for (const s of sorok) {
    const k = kuldesElotti(s);
    if (k) await frissitMent(db, [{ id: s.id, allapot: k.allapot, hiba: k.hiba, ujraprobalas: s.ujraprobalas || 0 }], most); else kuldendo.push(s);
  }
  const kesz = async (idk) => db.prepare('INSERT INTO gy_meta (kulcs, ertek) VALUES (?1, ?2) ON CONFLICT(kulcs) DO UPDATE SET ertek = excluded.ertek').bind(markerKulcs(most), JSON.stringify({ fazis: idk.length ? 'lefoglalva' : 'kesz', ido: most, idk })).run();
  if (!lefoglalt.length || !kuldendo.length) { await kesz([]); return { status: 200, body: { ok: true, mod, nincs: true } }; }
  const keres = kiigazitasKeres(kuldendo, budapestIdo(most));
  const v = vedohaloKiigazitas(keres);
  if (v) {
    await frissitMent(db, kuldendo.map((s) => ({ id: s.id, allapot: 'kihagyva_vedohalo', hiba: v, ujraprobalas: s.ujraprobalas || 0 })), most);
    await riaszt(db, 'gkiigazitas_vedohalo', { adat: v, most });
    await kesz([]);
    return { status: 500, body: { ok: false, hiba: 'vedohalo', ok_kod: v } };
  }
  const idk = kuldendo.map((s) => s.id);
  await kesz(idk);
  return { status: 200, body: { ok: true, mod, zar: most, sorIdk: idk, cel: { ugyfel: GFELT.ugyfel, api_verzio: env.GY_GADS_API_VERZIO || GFELT.apiVerzio, vegpont: `customers/${GFELT.ugyfel}:uploadConversionAdjustments` }, keres } };
}

// Google ConversionAdjustmentUploadError / HTTP-hibak besorolasa
const MAR_MEGVAN = new Set(['CONVERSION_ALREADY_RETRACTED']); // mar visszavonva (pl. elveszett valasz utan ujrakuldve): a kiigazitas kesz
const ATMENETI = new Set(['CONVERSION_NOT_FOUND', 'TOO_RECENT_CONVERSION', 'TOO_RECENT_EVENT', 'INTERNAL_ERROR', 'TRANSIENT_ERROR', 'RESOURCE_EXHAUSTED', 'UNAVAILABLE', 'DEADLINE_EXCEEDED', 'VALASZ_ERTELMEZHETETLEN', 'VALASZ_URES_ELEM']);
const KOD_MINTA = /^[A-Z0-9_]{1,64}$/;
const joKod = (v) => (typeof v === 'string' && KOD_MINTA.test(v) ? v : null);
const elsoKod = (ec) => { if (!ec || typeof ec !== 'object') return null; return joKod(Object.values(ec)[0]); };

/** Mi legyen egy kiserlet utan? @returns {{allapot:'elkuldve'|'nincs_konverzio'|'hiba', kovetkezo:number|null, ok:string}} */
export function ujraprobaDontes({ http = null, kod = null, proba = 0, most, feltoltesIdo }) {
  if (kod && MAR_MEGVAN.has(kod)) return { allapot: 'elkuldve', kovetkezo: null, ok: 'mar_visszavonva' };
  const atmeneti = (kod && ATMENETI.has(kod)) || http === 429 || (http !== null && http >= 500) || (http === null && !kod);
  if (!atmeneti) return { allapot: 'hiba', kovetkezo: null, ok: 'vegleges' };
  if (kod === 'CONVERSION_NOT_FOUND' || kod === 'TOO_RECENT_CONVERSION') {
    if (most - feltoltesIdo > GKIIG.vegleges) return { allapot: 'nincs_konverzio', kovetkezo: null, ok: 'nincs_konverzio_72h' };
  }
  if (proba >= GKIIG.ujraproba.max) return { allapot: 'hiba', kovetkezo: null, ok: 'ujraproba_kimerult' };
  return { allapot: 'hiba', kovetkezo: most + GKIIG.ujraproba.varakozas[proba], ok: 'ujraproba' };
}

function hibaFrissites(s, { http, kod, most, requestId }) {
  const d = ujraprobaDontes({ http, kod, proba: s.ujraprobalas || 0, most, feltoltesIdo: s.feltoltes_ido });
  const vegleges = d.allapot !== 'hiba' || !d.kovetkezo;
  return { id: s.id, allapot: d.allapot, hiba: d.ok, google_hibakod: kod || (http ? `HTTP_${http}` : null), ujraprobalas: (s.ujraprobalas || 0) + (d.kovetkezo ? 1 : 0), utolso_hiba_ido: vegleges && d.allapot === 'elkuldve' ? null : most, kovetkezo_proba: d.kovetkezo, request_id: requestId };
}

/** A Google valaszabol soronkenti hibakodok: Map<index, kod>; keres-szintu hiba: { keresHiba }. Hibauzenet SOHA nem kerul tarolasra. */
export function valaszElemzes(http, json) {
  const j = json && typeof json === 'object' ? json : {};
  const sorHibak = new Map();
  const gyujt = (details) => {
    for (const d of details || []) for (const e of (d && d.errors) || []) {
      const fp = (e.location && e.location.fieldPathElements) || [];
      const idx = fp.find((x) => x && (x.fieldName === 'conversion_adjustments' || x.fieldName === 'conversionAdjustments'));
      if (idx && Number.isInteger(idx.index) && !sorHibak.has(idx.index)) sorHibak.set(idx.index, elsoKod(e.errorCode) || 'ISMERETLEN');
    }
  };
  gyujt(j.partialFailureError && j.partialFailureError.details);
  if (j.partialFailureError && !sorHibak.size) return { keresHiba: { http, kod: 'PARTIAL_FAILURE_ISMERETLEN_SOR' }, sorHibak };
  if (http !== 200 || j.error) {
    let kod = joKod(j.error && j.error.status);
    for (const d of (j.error && j.error.details) || []) for (const e of (d && d.errors) || []) { kod = elsoKod(e.errorCode) || kod; }
    gyujt(j.error && j.error.details);
    return { keresHiba: { http, kod: kod || null }, sorHibak };
  }
  return { sorHibak };
}

/** Egy hivas eredmenye soronkent -> { frissites, keresHiba }. Keres-szintu (hozzaferesi / konfiguracios) hiba: a sorok NEM valtoznak (kiveve a nevesitett sor). */
export function valaszErtekel({ sorok, http, json, requestId = null, most }) {
  const e = valaszElemzes(http, json);
  if (e.keresHiba) {
    const k = e.keresHiba;
    const atmeneti = k.http === 429 || (k.http !== null && k.http >= 500) || k.http === null;
    if (atmeneti) return { frissites: sorok.map((s) => hibaFrissites(s, { http: k.http, kod: k.kod, most, requestId })), keresHiba: k };
    return { frissites: sorok.flatMap((s, i) => (e.sorHibak.has(i) ? [hibaFrissites(s, { http: null, kod: e.sorHibak.get(i), most, requestId })] : [])), keresHiba: k };
  }
  const r = json && Array.isArray(json.results) ? json.results : null;
  if (!r || r.length !== sorok.length) return { frissites: sorok.map((s) => hibaFrissites(s, { http: null, kod: 'VALASZ_ERTELMEZHETETLEN', most, requestId })), keresHiba: { http, kod: 'VALASZ_ERTELMEZHETETLEN' } };
  const frissites = sorok.map((s, i) => {
    const kod = e.sorHibak.get(i);
    if (kod) return hibaFrissites(s, { http: null, kod, most, requestId });
    const elem = r[i];
    if (!(elem && typeof elem === 'object' && Object.keys(elem).length)) return hibaFrissites(s, { http: null, kod: 'VALASZ_URES_ELEM', most, requestId });
    return { id: s.id, allapot: 'elkuldve', hiba: null, google_hibakod: null, ujraprobalas: s.ujraprobalas || 0, utolso_hiba_ido: null, kovetkezo_proba: null, request_id: requestId };
  });
  return { frissites, keresHiba: null };
}

const egeszSzam = (v) => (Number.isInteger(v) ? v : typeof v === 'string' && /^\d{1,12}$/.test(v) ? Number(v) : NaN);

/** POST: be = { zar, http, valasz, request_id? }. @returns {Promise<{status:number, body:object}>} - maszkolt eredmeny (azonosito nincs) */
export async function kiigazitasFazis({ db, env, most, be }) {
  if (gkiigazitasMod(env) !== 'eles') return { status: 200, body: { ok: true, nincs: true } };
  const zar = egeszSzam(be && be.zar);
  const http = egeszSzam(be && be.http);
  if (!Number.isInteger(zar) || !Number.isInteger(http) || http < 100 || http > 599) return { status: 400, body: { ok: false, hiba: 'ervenytelen_kerelem' } };
  const valasz = valaszNormalizal(be.valasz);
  if (!valasz) return { status: 400, body: { ok: false, hiba: 'ervenytelen_valasz' } };
  const mr = await db.prepare('SELECT ertek FROM gy_meta WHERE kulcs = ?1').bind(markerKulcs(zar)).first();
  let m = null; try { m = mr ? JSON.parse(mr.ertek) : null; } catch (e) { m = null; }
  if (!m || m.fazis !== 'lefoglalva') return { status: 409, body: { ok: false, hiba: 'fazis', jelenlegi: m ? m.fazis : null } };
  const sorok = await sorokZarral(db, zar);
  if (!Array.isArray(m.idk) || m.idk.length !== sorok.length || m.idk.some((id, i) => id !== sorok[i].id)) { // a valasz indexei a GET sorrendjere vonatkoznak: mas halmazt nem ertekelunk
    await frissitMent(db, sorok.map((s) => ({ id: s.id, allapot: s.ujraprobalas ? 'hiba' : 'varakozik', hiba: null, ujraprobalas: s.ujraprobalas || 0, kovetkezo_proba: s.ujraprobalas ? most : null })), zar);
    await db.prepare('UPDATE gy_meta SET ertek = ?2 WHERE kulcs = ?1').bind(markerKulcs(zar), JSON.stringify({ ...m, fazis: 'kesz' })).run();
    await riaszt(db, 'gkiigazitas_fazis_elteres', { adat: `${m.idk ? m.idk.length : 'x'}:${sorok.length}`, most });
    return { status: 409, body: { ok: false, hiba: 'sorhalmaz_elter' } };
  }
  const jobId = /^\d{1,20}$/.test(String(valasz.jobId ?? be.request_id ?? '')) ? String(valasz.jobId ?? be.request_id) : null;
  const e = valaszErtekel({ sorok, http, json: valasz, requestId: jobId, most });
  await frissitMent(db, e.frissites, zar);
  if (e.keresHiba) {
    const kesz = new Set(e.frissites.map((f) => f.id));
    await frissitMent(db, sorok.filter((s) => !kesz.has(s.id)).map((s) => ({ id: s.id, allapot: s.ujraprobalas ? 'hiba' : 'varakozik', hiba: null, ujraprobalas: s.ujraprobalas || 0, kovetkezo_proba: s.ujraprobalas ? most : null })), zar);
    await riaszt(db, 'gkiigazitas_keres_hiba', { adat: `${e.keresHiba.http}:${e.keresHiba.kod}`, most });
  }
  await db.prepare('UPDATE gy_meta SET ertek = ?2 WHERE kulcs = ?1').bind(markerKulcs(zar), JSON.stringify({ ...m, fazis: 'kesz' })).run();
  return { status: 200, body: { ok: true, elkuldve: e.frissites.filter((f) => f.allapot === 'elkuldve').length, hiba: e.frissites.filter((f) => f.allapot === 'hiba').length, nincs_konverzio: e.frissites.filter((f) => f.allapot === 'nincs_konverzio').length, jobId, ...(e.keresHiba ? { keres_hiba: e.keresHiba } : {}) } };
}

/** Riport (admin): allapot-szamlalok modonkent, azonosito nelkul. */
export async function gkiigazitasRiport(db) {
  const sorok = (await db.prepare('SELECT mod, allapot, COUNT(*) AS db FROM gy_kiigazitas GROUP BY mod, allapot ORDER BY mod, allapot').all()).results || [];
  return { sorok };
}
