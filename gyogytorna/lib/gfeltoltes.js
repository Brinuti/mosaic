// GY-25: szerveres Google Ads click-konverzio feltoltes (ARNYEK, CSAK a masodlagos 7858300772 akcioba). Kapcsolo: GY_GADS_FELTOLTES = ki | dry | eles (alapertelmezett: dry).
// dry: a payload elkeszul es naplozodik (gy_feltoltes, maszkolt click-ID-val), a Google-nek semmi nem megy ki. eles: a sorok `varakozik` allapotba kerulnek, es a kuldo (Worker
// GOOGLE_ADS_* titkokkal, vagy a hid: tools/gfeltoltes-hid.mjs) adagonkent kuldi: ELOBB validateOnly=true, utana partialFailure=true. A feltoltes hibaja SOHA nem erintheti a foglalast.
// Kuldott mezok (a leendo eles kuldesben is): click-ID, conversion_date_time (Europe/Budapest, offsettel), conversion_value, order_id, currency. NINCS nev / e-mail / telefon /
// panasz / enhanced conversion; a consent mezo UNSPECIFIED (nem toltjuk ki; GRANTED-et soha) - Feri dontese 2026-10-20.
// Kiegeszites (2026-10-21 11:40): gbraid / wbraid csak naplozva (kihagyva_braid), legkorabban 1 oraval a foglalas utan, ujraprobalas-szabaly, bovitett naplo, lefedettseg-riport.
import { tranzakcioId, sha256Hex } from './titkos.js';

export const GFELT = Object.freeze({
  ugyfel: '2596120588',
  akcio: '7858300772', // "GYT szerveres allapotfelmeres (gclid, ARNYEK)": masodlagos UPLOAD_CLICKS, include_in_conversions_metric=false
  ertek: 19000,
  penznem: 'HUF',
  apiVerzio: 'v23', // mint a Medical Piercing feltolto
  adag: 10, // kis adag: egy futas legfeljebb ennyi konverziot kuld (az ujraprobak is ide szamitanak)
  lezaras: 900, // mp: a `kuldes_alatt` allapot ennyi ido utan elavult (megszakadt futas), ujra kuldheto
  kesleltetes: 3600, // mp: a feltoltes legkorabban 1 oraval a foglalas LETREHOZASA utan (friss kattintasnal CLICK_NOT_FOUND / feldolgozasi keses lehet)
  // ujraprobalas (CSAK atmeneti hibara, ugyanazzal az order_id-val): legfeljebb 5x; az n. ujraprobaig (0-tol) ennyi masodpercet kell varni az elozo kiserlet utan: 1 ora, 3, 6, 12, 24 ora
  ujraproba: Object.freeze({ max: 5, varakozas: Object.freeze([3600, 10800, 21600, 43200, 86400]) }),
});
const KATT_MEZO = Object.freeze({ gclid: 'gclid', gbraid: 'gbraid', wbraid: 'wbraid' });
const BRAID = Object.freeze(['gbraid', 'wbraid']);

/**
 * Click ID epseg-ellenorzes (karanten): gclid >= 30 karakter, csak [A-Za-z0-9_-], nem tartalmazhat TEST / TESZT reszt (kis-nagybetu nelkul). Hibas ertek NEM kuldheto;
 * a sor `kihagyva_click_id`, a `hiba` mezo az ok kodja. gbraid / wbraid: ugyanaz, de a hosszkorlat csak 20 (naplo-sor; kuldes ugyis nincs).
 * @returns {null|string} null = rendben, kulonben az ok kodja
 */
export function clickIdHiba(tipus, ertek) {
  const s = String(ertek ?? '');
  if (!s) return 'click_id_hianyzik';
  if (/tesz?t/i.test(s)) return 'click_id_teszt';
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return 'click_id_karakter';
  if (s.length < (tipus === 'gclid' ? 30 : 20)) return 'click_id_rovid';
  return null;
}

export const gfeltoltesMod = (env) => { const m = String((env && env.GY_GADS_FELTOLTES) || 'dry').toLowerCase(); return ['ki', 'dry', 'eles'].includes(m) ? m : 'dry'; };
export const maszk = (id) => { const s = String(id || ''); return s.length < 20 ? `*** (${s.length})` : `${s.slice(0, 4)}…${s.slice(-3)} (${s.length})`; };

/** A feltoltendo payload (a Google Ads uploadClickConversions egy eleme). conversion_date_time: 'yyyy-mm-dd hh:mm:ss+02:00' (teli idoben +01:00). Consent: szandekosan nincs. */
export function gfeltoltesPayload({ kattTipus, kattErtek, konverzioIdo, orderId }) {
  const mezo = KATT_MEZO[kattTipus];
  if (!mezo || !kattErtek) return null;
  return {
    [mezo]: kattErtek,
    conversionAction: `customers/${GFELT.ugyfel}/conversionActions/${GFELT.akcio}`,
    conversionDateTime: konverzioIdo,
    conversionValue: GFELT.ertek,
    currencyCode: GFELT.penznem,
    orderId,
  };
}

/** A leendo ELES kuldes keresteste (jelenleg sehol nincs hivva): partial_failure=true, validate_only nincs. */
export const gfeltoltesKeres = (payloadok) => ({ conversions: payloadok, partialFailure: true, validateOnly: false });

// Google ConversionUploadError / HTTP-hibak besorolasa. Atmeneti: ujraproba backoff-fal; vegleges: soha nem probaljuk ujra (pl. ervenytelen vagy 90 napnal regebbi click-ID).
const ATMENETI_KODOK = new Set(['TOO_RECENT_EVENT', 'TOO_RECENT_CONVERSION_ACTION', 'CLICK_NOT_FOUND', 'INTERNAL_ERROR', 'TRANSIENT_ERROR', 'RESOURCE_EXHAUSTED', 'UNAVAILABLE', 'DEADLINE_EXCEEDED']);
const MAR_MEGVAN_KODOK = new Set(['ALREADY_IMPORTED', 'DUPLICATE_ORDER_ID']); // ugyanaz az order_id mar bent van: a feltoltes kesz
/**
 * Mi legyen egy sikertelen kiserlet utan? `proba` = hany ujraproba tortent MAR (0 az elso kiserlet utan).
 * @returns {{allapot: 'elfogadva'|'hiba', kovetkezo: number|null, ok: string}} - `kovetkezo` = a kovetkezo kiserlet unix ideje (null: vegleges, nincs tobb proba)
 */
export function ujraprobaDontes({ http = null, kod = null, proba = 0, most }) {
  if (kod && MAR_MEGVAN_KODOK.has(kod)) return { allapot: 'elfogadva', kovetkezo: null, ok: 'mar_importalva' };
  const atmeneti = (kod && ATMENETI_KODOK.has(kod)) || http === 429 || (http !== null && http >= 500) || (http === null && !kod); // halozati hiba = nincs HTTP-valasz
  if (!atmeneti) return { allapot: 'hiba', kovetkezo: null, ok: 'vegleges' };
  if (proba >= GFELT.ujraproba.max) return { allapot: 'hiba', kovetkezo: null, ok: 'ujraproba_kimerult' };
  return { allapot: 'hiba', kovetkezo: most + GFELT.ujraproba.varakozas[proba], ok: 'ujraproba' };
}

/**
 * A meg nem naplozott, jogosult foglalasok (igazolt=1, allapotfelmeres, nem teszt, nem lemondott, van Google click-ID, a foglalas >= 1 oraja letrejott) payloadjanak epitese es
 * naplozasa az aktualis modban. Idempotens (UNIQUE uuid+mod); a visszameno (GY-23 ota gyult) foglalasokat is felveszi. Allapotok: dry (csak naplo) | varakozik (eles mod: a kuldore var) |
 * kihagyva_click_id (karanten: ismeretlen tipus / hibas, rovid, teszt click-ID) | kihagyva_braid (csak gbraid/wbraid: nincs eles kuldes, amig kulon nem dontunk) |
 * kihagyva_ido_sorrend (a kattintas KESOBBI, mint a foglalas) | kihagyva_teszt (teszt foglalas). Vissza: { mod, uj }.
 */
export async function gfeltoltesFut({ db, env, most, budapestIdo }) {
  const mod = gfeltoltesMod(env);
  if (mod === 'ki') return { mod, uj: 0 };
  if (!env.GY_HMAC_KULCS) return { mod, uj: 0, hiba: 'nincs_titkos_kulcs' };
  // teszt foglalas (teszt=1) soha nem feltoltheto: a mar naplozott sorat is kizarjuk
  await db.prepare("UPDATE gy_feltoltes SET allapot = 'kihagyva_teszt', hiba = 'teszt_foglalas' WHERE allapot IN ('dry','varakozik','kihagyva_click_id') AND uuid IN (SELECT uuid FROM gy_foglalas WHERE teszt = 1)").run();
  const sorok = (await db.prepare(
    `SELECT f.uuid, f.letrehozva, f.hozzajarulas, f.gads_katt_tipus, f.gads_katt_ertek, f.gads_katt_ido FROM gy_foglalas f
     WHERE f.tipus = 'allapotfelmeres' AND f.teszt = 0 AND f.igazolt = 1 AND f.allapot IN ('aktiv','modositott') AND f.gads_katt_ertek IS NOT NULL AND f.letrehozva <= ?2
       AND NOT EXISTS (SELECT 1 FROM gy_feltoltes g WHERE g.uuid = f.uuid AND g.mod = ?1) ORDER BY f.letrehozva LIMIT 500`,
  ).bind(mod, most - GFELT.kesleltetes).all()).results || [];
  let uj = 0;
  for (const r of sorok) {
    const orderId = await tranzakcioId(r.uuid, env.GY_HMAC_KULCS);
    const ido = budapestIdo(r.letrehozva);
    const p = gfeltoltesPayload({ kattTipus: r.gads_katt_tipus, kattErtek: r.gads_katt_ertek, konverzioIdo: ido, orderId });
    const kattIdo = Number.isInteger(r.gads_katt_ido) ? r.gads_katt_ido : null;
    const hiba = !p ? 'hibas_click_id' : clickIdHiba(r.gads_katt_tipus, r.gads_katt_ertek);
    const allapot = hiba ? 'kihagyva_click_id'
      : BRAID.includes(r.gads_katt_tipus) ? 'kihagyva_braid'
        : kattIdo !== null && kattIdo > r.letrehozva ? 'kihagyva_ido_sorrend'
          : mod === 'eles' ? 'varakozik' : 'dry';
    const res = await db.prepare(
      `INSERT OR IGNORE INTO gy_feltoltes (uuid, mod, letrehozva, allapot, katt_tipus, katt_maszk, order_id, konverzio_ido, ertek, consent, hozzajarulas, payload_hash, hiba, katt_ido)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'nem_ismert', ?10, ?11, ?12, ?13)`,
    ).bind(r.uuid, mod, most, allapot, r.gads_katt_tipus || null, maszk(r.gads_katt_ertek), orderId, ido, GFELT.ertek, r.hozzajarulas || null, p ? await sha256Hex(JSON.stringify(p)) : null, hiba, kattIdo).run();
    if (res && res.meta && res.meta.changes) uj += 1;
  }
  return { mod, uj };
}

// --- ELES KULDES ------------------------------------------------------------------------------------------------------------------------------------
// Egy futas: (1) a kuldheto sorok kivalasztasa es lefoglalasa (`kuldes_alatt`), (2) validateOnly=true hivas, (3) a tiszta sorok partialFailure=true hivasa, (4) az eredmeny rogzitese.
// A kuldo (`kuldo(kerelem) -> {http, json, requestId}`) kicserelheto: a Worker sajat OAuth-kuldoje (googleAdsKuldo) vagy a hid (tools/gfeltoltes-hid.mjs).

/** Kuldheto sorok (eles mod): `varakozik`, esedekes ujraproba (`hiba` + kovetkezo_proba <= most), vagy elavult `kuldes_alatt`. A nyers click-ID a foglalasrol jon (nem a naplobol). */
export async function kuldhetoSorok(db, { most, limit = GFELT.adag }) {
  return (await db.prepare(
    `SELECT g.id, g.uuid, g.katt_tipus, g.order_id, g.konverzio_ido, g.ujraprobalas, f.gads_katt_ertek AS katt_ertek, f.allapot AS foglalas_allapot, f.teszt AS teszt
     FROM gy_feltoltes g JOIN gy_foglalas f ON f.uuid = g.uuid
     WHERE g.mod = 'eles' AND (g.allapot = 'varakozik' OR (g.allapot = 'hiba' AND g.kovetkezo_proba IS NOT NULL AND g.kovetkezo_proba <= ?1)
       OR (g.allapot = 'kuldes_alatt' AND COALESCE(g.utolso_hiba_ido, 0) <= ?1 - ?3)) ORDER BY g.id LIMIT ?2`,
  ).bind(most, limit, GFELT.lezaras).all()).results || [];
}

/** A kuldes elotti vegso ellenorzes egy soron: null = kuldheto, kulonben a kihagyas allapota + oka. */
export function kuldesElotti(s) {
  if (s.teszt) return { allapot: 'kihagyva_teszt', hiba: 'teszt_foglalas' };
  if (!['aktiv', 'modositott'].includes(s.foglalas_allapot)) return { allapot: 'kihagyva_lemondva', hiba: 'foglalas_nem_aktiv' };
  if (BRAID.includes(s.katt_tipus)) return { allapot: 'kihagyva_braid', hiba: null };
  const h = s.katt_ertek ? clickIdHiba(s.katt_tipus, s.katt_ertek) : 'click_id_torolve';
  return h ? { allapot: 'kihagyva_click_id', hiba: h } : null;
}

/** A feltoltendo kerelem a sorokbol (a click-ID itt kerul a payloadba; naplozni / kiirni tilos). */
export function kuldesKerelem(sorok, { validateOnly }) {
  return {
    conversions: sorok.map((s) => gfeltoltesPayload({ kattTipus: s.katt_tipus, kattErtek: s.katt_ertek, konverzioIdo: s.konverzio_ido, orderId: s.order_id })),
    partialFailure: true,
    validateOnly: !!validateOnly,
  };
}

const elsoKod = (ec) => { if (!ec || typeof ec !== 'object') return null; const v = Object.values(ec)[0]; return typeof v === 'string' ? v : null; };
/** A Google valaszabol soronkenti hibakodok: Map<index, kod>. Keres-szintu hiba (nincs partialFailureError): { keresHiba }. Hibauzenet SOHA nem kerul tarolasra (click-ID-t idezhet). */
export function valaszElemzes(http, json) {
  const j = json && typeof json === 'object' ? json : {};
  const sorHibak = new Map();
  const reszletek = (j.partialFailureError && j.partialFailureError.details) || [];
  for (const d of reszletek) for (const e of (d && d.errors) || []) {
    const fp = (e.location && e.location.fieldPathElements) || [];
    const idx = fp.find((x) => x && x.fieldName === 'conversions');
    const kod = elsoKod(e.errorCode) || 'ISMERETLEN';
    if (idx && Number.isInteger(idx.index)) { if (!sorHibak.has(idx.index)) sorHibak.set(idx.index, kod); }
  }
  if (j.partialFailureError && !sorHibak.size) return { keresHiba: { http, kod: 'PARTIAL_FAILURE_ISMERETLEN_SOR' } };
  if (http !== 200) {
    let kod = (j.error && j.error.status) || null;
    for (const d of (j.error && j.error.details) || []) for (const e of (d && d.errors) || []) { kod = elsoKod(e.errorCode) || kod; }
    return { keresHiba: { http, kod: kod || null } };
  }
  return { sorHibak };
}

/**
 * Egy hivas eredmenye soronkent. @returns {{ frissites: Array<{id, allapot, hiba, google_hibakod, ujraprobalas, utolso_hiba_ido, kovetkezo_proba}>, keresHiba: null|{http, kod}, tiszta: number[] }}
 * `tiszta` = a hiba nelkuli sorok indexei. Keres-szintu hiba (hozzaferes / konfiguracio, 401/403/400): a sorok NEM valtoznak (nem a konverziok hibaja), a hivo riaszt.
 */
export function valaszErtekel({ sorok, http, json, requestId = null, most, vegleges }) {
  const e = valaszElemzes(http, json);
  if (e.keresHiba) {
    const k = e.keresHiba;
    const sorSzintu = k.http === 429 || (k.http !== null && k.http >= 500) || k.http === null; // atmeneti: a sorok ujraprobalhatok
    if (!sorSzintu) return { frissites: [], keresHiba: k, tiszta: [] };
    return { frissites: sorok.map((s) => hibaFrissites(s, { http: k.http, kod: k.kod, most, requestId })), keresHiba: k, tiszta: [] };
  }
  const frissites = [], tiszta = [];
  sorok.forEach((s, i) => {
    const kod = e.sorHibak.get(i);
    if (!kod) { tiszta.push(i); if (vegleges) frissites.push({ id: s.id, allapot: 'elfogadva', hiba: null, google_hibakod: null, ujraprobalas: s.ujraprobalas || 0, utolso_hiba_ido: null, kovetkezo_proba: null, request_id: requestId }); return; }
    frissites.push(hibaFrissites(s, { http: null, kod, most, requestId }));
  });
  return { frissites, keresHiba: null, tiszta };
}

function hibaFrissites(s, { http, kod, most, requestId }) {
  const d = ujraprobaDontes({ http, kod, proba: s.ujraprobalas || 0, most });
  const mar = d.ok === 'mar_importalva';
  return { id: s.id, allapot: d.allapot, hiba: d.ok, google_hibakod: kod || (http ? `HTTP_${http}` : null), ujraprobalas: (s.ujraprobalas || 0) + (d.kovetkezo ? 1 : 0), utolso_hiba_ido: mar ? null : most, kovetkezo_proba: d.kovetkezo, request_id: requestId };
}

/** A sorok lefoglalasa a kuldesre (versenyhelyzet ellen: ket futas nem kuldi ugyanazt). @returns a tenylegesen lefoglalt sorok */
export async function lefoglal(db, sorok, most) {
  const ki = [];
  for (const s of sorok) {
    const r = await db.prepare(
      `UPDATE gy_feltoltes SET allapot = 'kuldes_alatt', utolso_hiba_ido = ?2 WHERE id = ?1 AND (allapot IN ('varakozik','hiba') OR (allapot = 'kuldes_alatt' AND COALESCE(utolso_hiba_ido, 0) <= ?2 - ?3))`,
    ).bind(s.id, most, GFELT.lezaras).run();
    if (r && r.meta && r.meta.changes) ki.push(s);
  }
  return ki;
}

export async function frissitMent(db, frissitesek) {
  for (const f of frissitesek) {
    await db.prepare(
      'UPDATE gy_feltoltes SET allapot = ?2, hiba = ?3, google_hibakod = ?4, ujraprobalas = ?5, utolso_hiba_ido = ?6, kovetkezo_proba = ?7, request_id = COALESCE(?8, request_id) WHERE id = ?1',
    ).bind(f.id, f.allapot, f.hiba ?? null, f.google_hibakod ?? null, f.ujraprobalas ?? 0, f.utolso_hiba_ido ?? null, f.kovetkezo_proba ?? null, f.request_id ?? null).run();
  }
}

/** A Worker sajat Google Ads kuldoje (GOOGLE_ADS_* titkok). Titok hianyaban null (a sorok varnak). Az ugyfel / akcio rogzitett (GFELT), a hozzaferes csak ide korlatozott. */
export function googleAdsKuldo(env, fetchFn = globalThis.fetch) {
  const k = ['GOOGLE_ADS_DEVELOPER_TOKEN', 'GOOGLE_ADS_CLIENT_ID', 'GOOGLE_ADS_CLIENT_SECRET', 'GOOGLE_ADS_REFRESH_TOKEN'];
  if (!env || k.some((n) => !env[n])) return null;
  let token = null;
  return async (kerelem) => {
    if (!token) {
      const t = await fetchFn('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: env.GOOGLE_ADS_CLIENT_ID, client_secret: env.GOOGLE_ADS_CLIENT_SECRET, refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN, grant_type: 'refresh_token' }) });
      const tj = await t.json().catch(() => ({}));
      if (!t.ok || !tj.access_token) return { http: t.status === 400 || t.status === 401 ? 401 : t.status, json: { error: { status: 'UNAUTHENTICATED' } }, requestId: null };
      token = tj.access_token;
    }
    const fej = { authorization: `Bearer ${token}`, 'developer-token': env.GOOGLE_ADS_DEVELOPER_TOKEN, 'content-type': 'application/json' };
    if (env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) fej['login-customer-id'] = String(env.GOOGLE_ADS_LOGIN_CUSTOMER_ID).replace(/\D/g, '');
    const r = await fetchFn(`https://googleads.googleapis.com/${env.GY_GADS_API_VERZIO || GFELT.apiVerzio}/customers/${GFELT.ugyfel}:uploadClickConversions`, { method: 'POST', headers: fej, body: JSON.stringify(kerelem) });
    return { http: r.status, json: await r.json().catch(() => ({})), requestId: r.headers.get('request-id') };
  };
}

/**
 * Egy kuldesi futas (eles mod, van kuldo): lefoglal -> validateOnly -> partialFailure -> mentes. Soha nem dob a foglalas fele (a hivo try/catch-eli).
 * @returns {Promise<{kuldve: number, elfogadva: number, hiba: number, kihagyva: number, keresHiba?: object, nincsKuldo?: boolean}>}
 */
export async function gfeltoltesKuld({ db, env, most, kuldo }) {
  const ki = { kuldve: 0, elfogadva: 0, hiba: 0, kihagyva: 0 };
  if (gfeltoltesMod(env) !== 'eles') return ki;
  if (!kuldo) return { ...ki, nincsKuldo: true };
  const jeloltek = await kuldhetoSorok(db, { most });
  if (!jeloltek.length) return ki;
  const lefoglalt = await lefoglal(db, jeloltek, most);
  const kuldendo = [];
  for (const s of lefoglalt) {
    const k = kuldesElotti(s);
    if (k) { await frissitMent(db, [{ id: s.id, allapot: k.allapot, hiba: k.hiba, ujraprobalas: s.ujraprobalas || 0 }]); ki.kihagyva += 1; } else kuldendo.push(s);
  }
  if (!kuldendo.length) return ki;
  const visszaAd = async (sorok) => frissitMent(db, sorok.map((s) => ({ id: s.id, allapot: s.ujraprobalas ? 'hiba' : 'varakozik', hiba: null, ujraprobalas: s.ujraprobalas || 0, kovetkezo_proba: s.ujraprobalas ? most : null })));
  // 1) validateOnly
  const v = await kuldo(kuldesKerelem(kuldendo, { validateOnly: true }));
  const ve = valaszErtekel({ sorok: kuldendo, http: v.http, json: v.json, requestId: v.requestId, most, vegleges: false });
  if (ve.keresHiba && !ve.frissites.length) { await visszaAd(kuldendo); return { ...ki, keresHiba: ve.keresHiba }; } // hozzaferes / konfiguracio hiba: a sorok varnak
  await frissitMent(db, ve.frissites);
  const tiszta = ve.tiszta.map((i) => kuldendo[i]);
  ki.hiba += ve.frissites.filter((f) => f.allapot === 'hiba').length;
  if (!tiszta.length) return ki;
  // 2) eles hivas (partialFailure=true), csak a validalt sorokkal
  const e = await kuldo(kuldesKerelem(tiszta, { validateOnly: false }));
  const ee = valaszErtekel({ sorok: tiszta, http: e.http, json: e.json, requestId: e.requestId, most, vegleges: true });
  if (ee.keresHiba && !ee.frissites.length) { await visszaAd(tiszta); return { ...ki, keresHiba: ee.keresHiba }; }
  await frissitMent(db, ee.frissites);
  ki.kuldve = tiszta.length;
  ki.elfogadva = ee.frissites.filter((f) => f.allapot === 'elfogadva').length;
  ki.hiba += ee.frissites.filter((f) => f.allapot === 'hiba').length;
  return ki;
}

const nap = (budapestIdo, unix) => String(budapestIdo(unix)).slice(0, 10);
/**
 * Lefedettseg: a Google-forrasu (cimke google*), Salonic-igazolt, nem lemondott, nem teszt allapotfelmeresek NAPONTA (Budapest-nap) - ebbol hanyhoz van gclid / csak gbraid-wbraid / nincs click-ID.
 * A foglalason a nyers click-ID 60 nap utan torlodik, ezert a riport az utolso 60 napot nezi. A foglalashoz egy (a 7 napos nyertes) click-ID tartozik.
 */
export async function gfeltoltesLefedettseg(db, { budapestIdo, most }) {
  const sorok = (await db.prepare(
    `SELECT letrehozva, gads_katt_tipus, gads_katt_ertek FROM gy_foglalas
     WHERE tipus = 'allapotfelmeres' AND teszt = 0 AND igazolt = 1 AND allapot IN ('aktiv','modositott') AND cimke LIKE 'google%' AND letrehozva >= ?1 ORDER BY letrehozva`,
  ).bind(most - 60 * 86400).all()).results || [];
  const napok = new Map();
  for (const r of sorok) {
    const n = nap(budapestIdo, r.letrehozva);
    const x = napok.get(n) || { nap: n, google_igazolt_allapotfelmeres: 0, gclid: 0, gyanus_click_id: 0, csak_braid: 0, nincs_click_id: 0 };
    x.google_igazolt_allapotfelmeres += 1;
    if (!r.gads_katt_ertek) x.nincs_click_id += 1;
    else if (BRAID.includes(r.gads_katt_tipus)) x.csak_braid += 1;
    else if (clickIdHiba(r.gads_katt_tipus, r.gads_katt_ertek)) x.gyanus_click_id += 1; // karanten: hibas / rovid / teszt click-ID (nem kuldheto, nem szamit gclid-nek)
    else x.gclid += 1;
    napok.set(n, x);
  }
  const naponta = [...napok.values()];
  const osszes = naponta.reduce((a, x) => ({ google_igazolt_allapotfelmeres: a.google_igazolt_allapotfelmeres + x.google_igazolt_allapotfelmeres, gclid: a.gclid + x.gclid, gyanus_click_id: a.gyanus_click_id + x.gyanus_click_id, csak_braid: a.csak_braid + x.csak_braid, nincs_click_id: a.nincs_click_id + x.nincs_click_id }), { google_igazolt_allapotfelmeres: 0, gclid: 0, gyanus_click_id: 0, csak_braid: 0, nincs_click_id: 0 });
  return { naponta, osszes };
}

/**
 * Diagnosztika-riport a "UTM igen, click-ID nem" esetekhez (szemelyes adat nelkul): az utolso 60 nap google_* cimkes, igazolt allapotfelmeresei click-ID szerint (van / nincs) es
 * bongeszo-csalad, OS, eszkoz, gad_jel (gad_source/gad_campaignid megvan, a click-ID nincs), ismetelt latogato, privat_gyanu szerint, + referrer-host es elso oldal szerint.
 * A diagnosztika az uj (2026-10-21 utani) foglalasokon van meg; a regieken `nincs_adat`. Cel: eldonteni, hogy Safari/iOS-vedelem, atiranyitas vagy visszatero latogato (regi UTM) okozza.
 */
export async function gfeltoltesDiagnosztika(db, { most }) {
  const tol = most - 60 * 86400;
  const alap = `FROM gy_foglalas WHERE tipus = 'allapotfelmeres' AND teszt = 0 AND igazolt = 1 AND allapot IN ('aktiv','modositott') AND cimke LIKE 'google%' AND letrehozva >= ?1`;
  const click = "CASE WHEN gads_katt_ertek IS NOT NULL THEN COALESCE(gads_katt_tipus,'click_id') ELSE 'nincs_click_id' END";
  const J = (k) => `COALESCE(CAST(json_extract(diag, '$.${k}') AS TEXT), 'nincs_adat')`;
  const q = async (sql) => (await db.prepare(sql).bind(tol).all()).results || [];
  const eszkoz = await q(`SELECT ${click} AS click, ${J('bongeszo')} AS bongeszo, ${J('os')} AS os, ${J('eszkoz')} AS eszkoz, ${J('privat_gyanu')} AS privat_gyanu, ${J('gad_jel')} AS gad_jel, ${J('ismetelt')} AS ismetelt, COUNT(*) AS db ${alap} GROUP BY 1,2,3,4,5,6,7 ORDER BY db DESC LIMIT 60`);
  const forras = await q(`SELECT ${click} AS click, ${J('ref_kat')} AS ref_kat, ${J('ref_host')} AS ref_host, ${J('oldal')} AS elso_oldal, COUNT(*) AS db ${alap} GROUP BY 1,2,3,4 ORDER BY db DESC LIMIT 60`);
  const bizonyitek = await q(`SELECT ${click} AS click, bizonyitek, COUNT(*) AS db ${alap} GROUP BY 1,2 ORDER BY db DESC`);
  return { eszkoz, forras, bizonyitek };
}

/** Admin riport: darabszam mod / allapot szerint, maszkolt click-ID-k, hibakodok, lefedettseg. Teljes click-ID / uuid nincs benne. */
export async function gfeltoltesRiport(db, { budapestIdo, most } = {}) {
  const darab = (await db.prepare('SELECT mod, allapot, katt_tipus, COUNT(*) AS db FROM gy_feltoltes GROUP BY mod, allapot, katt_tipus ORDER BY mod, allapot, katt_tipus').all()).results || [];
  const hibak = (await db.prepare("SELECT hiba, google_hibakod, COUNT(*) AS db FROM gy_feltoltes WHERE hiba IS NOT NULL OR google_hibakod IS NOT NULL GROUP BY hiba, google_hibakod").all()).results || [];
  const sorok = (await db.prepare('SELECT mod, allapot, katt_tipus, katt_maszk, order_id, konverzio_ido, ertek, consent, hozzajarulas, letrehozva, katt_ido, hiba, google_hibakod, request_id, ujraprobalas, utolso_hiba_ido, kovetkezo_proba FROM gy_feltoltes ORDER BY id DESC LIMIT 100').all()).results || [];
  const hj = (await db.prepare("SELECT hozzajarulas, COUNT(*) AS db FROM gy_foglalas WHERE tipus = 'allapotfelmeres' AND teszt = 0 AND igazolt = 1 AND allapot IN ('aktiv','modositott') AND gads_katt_ertek IS NOT NULL GROUP BY hozzajarulas").all()).results || [];
  const lefedettseg = budapestIdo && most ? await gfeltoltesLefedettseg(db, { budapestIdo, most }) : null;
  const diagnosztika = budapestIdo && most ? await gfeltoltesDiagnosztika(db, { most }) : null;
  return { darab, hibak, hozzajarulas_a_jogosult_foglalasokon: hj, lefedettseg, diagnosztika, sorok };
}
