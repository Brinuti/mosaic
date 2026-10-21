// GY-25: szerveres Google Ads click-konverzio feltoltes (ARNYEK). Jelenleg CSAK DRY-RUN: a payload elkeszul es naplozodik (gy_feltoltes, maszkolt click-ID-val),
// a Google-nek SEMMI nem megy ki (validate_only sem). Kapcsolo: GY_GADS_FELTOLTES = ki | dry | eles (alapertelmezett: dry). Az `eles` meg NINCS bekotve (nincs OAuth / kuldo):
// ilyenkor a sor allapota `kihagyva_nincs_kuldo`, halozati hivas nincs. A feltoltes hibaja SOHA nem erintheti a foglalast (hivo try/catch).
// Kuldott mezok (a leendo eles kuldesben is): click-ID, conversion_date_time (Europe/Budapest, offsettel), conversion_value, order_id, currency. NINCS nev / e-mail / telefon /
// panasz / enhanced conversion; a consent mezo UNSPECIFIED (nem toltjuk ki; GRANTED-et soha) - Feri dontese 2026-10-20.
// Kiegeszites (2026-10-21 11:40): gbraid / wbraid csak naplozva (kihagyva_braid), legkorabban 1 oraval a foglalas utan, ujraprobalas-szabaly, bovitett naplo, lefedettseg-riport.
import { tranzakcioId, sha256Hex } from './titkos.js';

export const GFELT = Object.freeze({
  ugyfel: '2596120588',
  akcio: '7858300772', // "GYT szerveres allapotfelmeres (gclid, ARNYEK)": masodlagos UPLOAD_CLICKS, include_in_conversions_metric=false
  ertek: 19000,
  penznem: 'HUF',
  kesleltetes: 3600, // mp: a feltoltes legkorabban 1 oraval a foglalas LETREHOZASA utan (friss kattintasnal CLICK_NOT_FOUND / feldolgozasi keses lehet)
  // ujraprobalas (CSAK atmeneti hibara, ugyanazzal az order_id-val): legfeljebb 5x; az n. ujraprobaig (0-tol) ennyi masodpercet kell varni az elozo kiserlet utan: 1 ora, 3, 6, 12, 24 ora
  ujraproba: Object.freeze({ max: 5, varakozas: Object.freeze([3600, 10800, 21600, 43200, 86400]) }),
});
const KATT_MEZO = Object.freeze({ gclid: 'gclid', gbraid: 'gbraid', wbraid: 'wbraid' });
const BRAID = Object.freeze(['gbraid', 'wbraid']);

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
 * naplozasa az aktualis modban. Idempotens (UNIQUE uuid+mod); a visszameno (GY-23 ota gyult) foglalasokat is felveszi. Allapotok: dry | kihagyva_braid (csak gbraid/wbraid: nincs eles kuldes,
 * amig kulon nem dontunk) | kihagyva_ido_sorrend (a kattintas KESOBBI, mint a foglalas) | kihagyva_click_id (ismeretlen tipus) | kihagyva_nincs_kuldo (eles mod, nincs bekotve).
 * Vissza: { mod, uj }.
 */
export async function gfeltoltesFut({ db, env, most, budapestIdo }) {
  const mod = gfeltoltesMod(env);
  if (mod === 'ki') return { mod, uj: 0 };
  if (!env.GY_HMAC_KULCS) return { mod, uj: 0, hiba: 'nincs_titkos_kulcs' };
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
    const allapot = !p ? 'kihagyva_click_id'
      : BRAID.includes(r.gads_katt_tipus) ? 'kihagyva_braid'
        : kattIdo !== null && kattIdo > r.letrehozva ? 'kihagyva_ido_sorrend'
          : mod === 'eles' ? 'kihagyva_nincs_kuldo' : 'dry';
    const res = await db.prepare(
      `INSERT OR IGNORE INTO gy_feltoltes (uuid, mod, letrehozva, allapot, katt_tipus, katt_maszk, order_id, konverzio_ido, ertek, consent, hozzajarulas, payload_hash, hiba, katt_ido)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'nem_ismert', ?10, ?11, ?12, ?13)`,
    ).bind(r.uuid, mod, most, allapot, r.gads_katt_tipus || null, maszk(r.gads_katt_ertek), orderId, ido, GFELT.ertek, r.hozzajarulas || null, p ? await sha256Hex(JSON.stringify(p)) : null, allapot === 'kihagyva_click_id' ? 'hibas_click_id' : null, kattIdo).run();
    if (res && res.meta && res.meta.changes) uj += 1;
  }
  return { mod, uj };
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
    const x = napok.get(n) || { nap: n, google_igazolt_allapotfelmeres: 0, gclid: 0, csak_braid: 0, nincs_click_id: 0 };
    x.google_igazolt_allapotfelmeres += 1;
    if (!r.gads_katt_ertek) x.nincs_click_id += 1;
    else if (BRAID.includes(r.gads_katt_tipus)) x.csak_braid += 1;
    else x.gclid += 1;
    napok.set(n, x);
  }
  const naponta = [...napok.values()];
  const osszes = naponta.reduce((a, x) => ({ google_igazolt_allapotfelmeres: a.google_igazolt_allapotfelmeres + x.google_igazolt_allapotfelmeres, gclid: a.gclid + x.gclid, csak_braid: a.csak_braid + x.csak_braid, nincs_click_id: a.nincs_click_id + x.nincs_click_id }), { google_igazolt_allapotfelmeres: 0, gclid: 0, csak_braid: 0, nincs_click_id: 0 });
  return { naponta, osszes };
}

/** Admin riport: darabszam mod / allapot szerint, maszkolt click-ID-k, hibakodok, lefedettseg. Teljes click-ID / uuid nincs benne. */
export async function gfeltoltesRiport(db, { budapestIdo, most } = {}) {
  const darab = (await db.prepare('SELECT mod, allapot, katt_tipus, COUNT(*) AS db FROM gy_feltoltes GROUP BY mod, allapot, katt_tipus ORDER BY mod, allapot, katt_tipus').all()).results || [];
  const hibak = (await db.prepare("SELECT hiba, google_hibakod, COUNT(*) AS db FROM gy_feltoltes WHERE hiba IS NOT NULL OR google_hibakod IS NOT NULL GROUP BY hiba, google_hibakod").all()).results || [];
  const sorok = (await db.prepare('SELECT mod, allapot, katt_tipus, katt_maszk, order_id, konverzio_ido, ertek, consent, hozzajarulas, letrehozva, katt_ido, hiba, google_hibakod, request_id, ujraprobalas, utolso_hiba_ido, kovetkezo_proba FROM gy_feltoltes ORDER BY id DESC LIMIT 100').all()).results || [];
  const hj = (await db.prepare("SELECT hozzajarulas, COUNT(*) AS db FROM gy_foglalas WHERE tipus = 'allapotfelmeres' AND teszt = 0 AND igazolt = 1 AND allapot IN ('aktiv','modositott') AND gads_katt_ertek IS NOT NULL GROUP BY hozzajarulas").all()).results || [];
  const lefedettseg = budapestIdo && most ? await gfeltoltesLefedettseg(db, { budapestIdo, most }) : null;
  return { darab, hibak, hozzajarulas_a_jogosult_foglalasokon: hj, lefedettseg, sorok };
}
