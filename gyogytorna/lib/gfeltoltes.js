// GY-25: szerveres Google Ads click-konverzio feltoltes (ARNYEK). Jelenleg CSAK DRY-RUN: a payload elkeszul es naplozodik (gy_feltoltes, maszkolt click-ID-val),
// a Google-nek SEMMI nem megy ki (validate_only sem). Kapcsolo: GY_GADS_FELTOLTES = ki | dry | eles (alapertelmezett: dry). Az `eles` meg NINCS bekotve (nincs OAuth / kuldo):
// ilyenkor a sor allapota `eles_nincs_bekotve`, halozati hivas nincs. A feltoltes hibaja SOHA nem erintheti a foglalast (hivo try/catch).
// Kuldott mezok (a leendo eles kuldesben is): click-ID, conversion_date_time (Europe/Budapest), conversion_value, order_id, currency. NINCS nev / e-mail / telefon / panasz /
// enhanced conversion; a consent mezo UNSPECIFIED (nem toltjuk ki; GRANTED-et soha) - Feri dontese 2026-10-20.
import { tranzakcioId, sha256Hex } from './titkos.js';

export const GFELT = Object.freeze({
  ugyfel: '2596120588',
  akcio: '7858300772', // "GYT szerveres allapotfelmeres (gclid, ARNYEK)": masodlagos UPLOAD_CLICKS, include_in_conversions_metric=false
  ertek: 19000,
  penznem: 'HUF',
});
const KATT_MEZO = Object.freeze({ gclid: 'gclid', gbraid: 'gbraid', wbraid: 'wbraid' });

export const gfeltoltesMod = (env) => { const m = String((env && env.GY_GADS_FELTOLTES) || 'dry').toLowerCase(); return ['ki', 'dry', 'eles'].includes(m) ? m : 'dry'; };
export const maszk = (id) => { const s = String(id || ''); return s.length < 20 ? `*** (${s.length})` : `${s.slice(0, 4)}…${s.slice(-3)} (${s.length})`; };

/** A feltoltendo payload (a Google Ads uploadClickConversions egy eleme). Consent: szandekosan nincs. */
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

/**
 * A meg nem naplozott, jogosult foglalasok (igazolt=1, allapotfelmeres, nem teszt, nem lemondott, van Google click-ID) payloadjanak epitese es naplozasa az aktualis modban.
 * Idempotens (UNIQUE uuid+mod); a visszameno (GY-23 ota gyult) foglalasokat is felveszi. Vissza: { mod, uj, kihagyott }.
 */
export async function gfeltoltesFut({ db, env, most, budapestIdo, uuid = null }) {
  const mod = gfeltoltesMod(env);
  if (mod === 'ki') return { mod, uj: 0 };
  if (!env.GY_HMAC_KULCS) return { mod, uj: 0, hiba: 'nincs_titkos_kulcs' };
  const sorok = (await db.prepare(
    `SELECT f.uuid, f.letrehozva, f.hozzajarulas, f.gads_katt_tipus, f.gads_katt_ertek FROM gy_foglalas f
     WHERE f.tipus = 'allapotfelmeres' AND f.teszt = 0 AND f.igazolt = 1 AND f.allapot IN ('aktiv','modositott') AND f.gads_katt_ertek IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM gy_feltoltes g WHERE g.uuid = f.uuid AND g.mod = ?1) AND (?2 IS NULL OR f.uuid = ?2) ORDER BY f.letrehozva LIMIT 500`,
  ).bind(mod, uuid).all()).results || [];
  let uj = 0;
  for (const r of sorok) {
    const orderId = await tranzakcioId(r.uuid, env.GY_HMAC_KULCS);
    const ido = budapestIdo(r.letrehozva);
    const p = gfeltoltesPayload({ kattTipus: r.gads_katt_tipus, kattErtek: r.gads_katt_ertek, konverzioIdo: ido, orderId });
    const allapot = !p ? 'hibas_click_id' : mod === 'eles' ? 'eles_nincs_bekotve' : 'kesz';
    const res = await db.prepare(
      `INSERT OR IGNORE INTO gy_feltoltes (uuid, mod, letrehozva, allapot, katt_tipus, katt_maszk, order_id, konverzio_ido, ertek, consent, hozzajarulas, payload_hash, hiba)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'nem_ismert', ?10, ?11, ?12)`,
    ).bind(r.uuid, mod, most, allapot, r.gads_katt_tipus || null, maszk(r.gads_katt_ertek), orderId, ido, GFELT.ertek, r.hozzajarulas || null, p ? await sha256Hex(JSON.stringify(p)) : null, p ? (mod === 'eles' ? 'nincs_kuldo' : null) : 'hibas_click_id').run();
    if (res && res.meta && res.meta.changes) uj += 1;
  }
  return { mod, uj };
}

/** Admin riport: darabszam mod / allapot szerint, maszkolt click-ID-k, hibakodok. Teljes click-ID / uuid nincs benne. */
export async function gfeltoltesRiport(db) {
  const darab = (await db.prepare('SELECT mod, allapot, COUNT(*) AS db FROM gy_feltoltes GROUP BY mod, allapot ORDER BY mod, allapot').all()).results || [];
  const hibak = (await db.prepare("SELECT hiba, COUNT(*) AS db FROM gy_feltoltes WHERE hiba IS NOT NULL GROUP BY hiba").all()).results || [];
  const sorok = (await db.prepare('SELECT mod, allapot, katt_tipus, katt_maszk, order_id, konverzio_ido, ertek, consent, hozzajarulas, letrehozva, hiba FROM gy_feltoltes ORDER BY id DESC LIMIT 100').all()).results || [];
  const hj = (await db.prepare("SELECT hozzajarulas, COUNT(*) AS db FROM gy_foglalas WHERE tipus = 'allapotfelmeres' AND teszt = 0 AND igazolt = 1 AND allapot IN ('aktiv','modositott') AND gads_katt_ertek IS NOT NULL GROUP BY hozzajarulas").all()).results || [];
  return { darab, hibak, hozzajarulas_a_jogosult_foglalasokon: hj, sorok };
}
