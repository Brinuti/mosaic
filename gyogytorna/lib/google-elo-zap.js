// UJ-94 / #536 (DECISION #264 (b), 01-MERES + ChatGPT): az ELO „Allapot-ok” (7362127659) akcio validateOnly-probaja a GY-26 Zapier-mintan.
//   A Worker NEM hiv Google Ads-et (nincs GOOGLE_ADS_* titok, GY-26 szandek): GET = a jogosult sorok kivalasztasa + a validateOnly=TRUE keres torzse (a Zapier a sajat kapcsolataval hivja a Google Ads-et),
//   POST {zar, http, valasz} = a Google valaszanak ertekelese (soronkent: elfogadva / mar_bent / hiba + Google hibakod). Kizarolag validateOnly: a vedohalo minden kimeno keresre kikenyszeriti
//   (validateOnly === true, csak az ELO akcio, gclid, 19000 HUF, 64 hex order_id, partialFailure); az ELES (validateOnly=false) potlas KULON DECISION + Feri kulon mondata.
// ALAPBOL KI: GY_GADS_ELO_ZAP = ki (alap) | validate. A kimenet (valasz) a GET keres-torzset kiveve nem tartalmaz click-ID-t; a tarolt allapot maszkolt (katt_maszk), hibakod csak [A-Z0-9_]{1,64}.
// KULON MODUL: a vedett gfeltoltes.js / gkiigazitas.js valtozatlan (csak importaljuk a valaszElemzes-t, valaszNormalizal-t, GFELT-et, click-ID ellenorzest); a meglevo ARNYEK-feltoltes (7858300772) erintetlen.
import { GFELT, clickIdHiba, maszk, valaszElemzes, valaszNormalizal } from './gfeltoltes.js';
import { ELO_AKCIO, ELO_KESLELTETES, ELO_MAX_PROBA, eloBraidBe, eloKonverzio, eloSema, eloTol } from './google-elo.js';
import { budapestIdo } from './motor-szerver.js';
import { egyenlo, sha256Hex, tranzakcioId, ujToken } from './titkos.js';

export const ZAP_MOD = 'zap_validate';
export const ZAR_LEJARAT = 900; // mp: a lefoglalt (de nem lezart) sorok ennyi ido utan ujra kivalaszthatok
export const ZAP_ADAG = 10;
const MAR_BENT = new Set(['CLICK_CONVERSION_ALREADY_EXISTS', 'ORDER_ID_ALREADY_IN_USE', 'DUPLICATE_ORDER_ID']);
const KOD_MINTA = /^[A-Z0-9_]{1,64}$/;

export const zapMod = (env) => (String((env && env.GY_GADS_ELO_ZAP) || 'ki').trim().toLowerCase() === 'validate' ? 'validate' : 'ki');

const ZAR_SEMA = 'CREATE TABLE IF NOT EXISTS gy_elo_zap_zar (zar TEXT PRIMARY KEY, idk TEXT NOT NULL, letrehozva INTEGER NOT NULL, lezarva INTEGER)';
const zarKesz = new WeakSet();
async function zarSema(db) { if (zarKesz.has(db)) return; await eloSema(db); await db.prepare(ZAR_SEMA).run(); zarKesz.add(db); }

const ALAP_FEJLEC = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' };
const valasz = (status, body) => new Response(JSON.stringify(body), { status, headers: ALAP_FEJLEC });
const mostUnix = (deps) => Math.floor((deps && deps.most ? deps.most() : Date.now()) / 1000);

async function kulcsOk(request, env) {
  const k = request.headers.get('x-gy-zap-kulcs');
  const regiIs = !env.GY_ZAP_KULCS_HASH_2 || String(env.GY_ZAP_REGI_KULCS ?? '0') === '1'; // mint a gadsZapVegpont: csakMasodik
  const hashek = [regiIs ? env.GY_ZAP_KULCS_HASH : null, env.GY_ZAP_KULCS_HASH_2].filter(Boolean);
  if (!k || !hashek.length) return false;
  const h = await sha256Hex(k);
  let ok = false;
  for (const x of hashek) ok = egyenlo(h, String(x)) || ok;
  return ok;
}

/** A kimeno keres vedohalo: csak a validateOnly=true, csak az ELO akcio. -> null (rendben) | a hiba kodja. */
export function vedohaloElo(keres, { braid = false } = {}) {
  if (!keres || typeof keres !== 'object') return 'nincs_keres';
  if (Object.keys(keres).some((k) => !['conversions', 'partialFailure', 'validateOnly'].includes(k))) return 'ismeretlen_fomezo';
  if (keres.validateOnly !== true) return 'nem_validate_only';
  if (keres.partialFailure !== true) return 'partial_failure';
  if (!Array.isArray(keres.conversions) || !keres.conversions.length || keres.conversions.length > ZAP_ADAG) return 'adag';
  const akcio = `customers/${GFELT.ugyfel}/conversionActions/${ELO_AKCIO}`;
  const ENGEDETT = new Set(['gclid', 'gbraid', 'wbraid', 'conversionAction', 'conversionDateTime', 'conversionValue', 'currencyCode', 'orderId', 'consent']);
  for (const c of keres.conversions) {
    if (!c || Object.keys(c).some((k) => !ENGEDETT.has(k))) return 'ismeretlen_mezo';
    if (c.conversionAction !== akcio) return 'akcio';
    if ('consent' in c && !(c.consent && typeof c.consent === 'object' && Object.keys(c.consent).sort().join() === 'adPersonalization,adUserData' && c.consent.adUserData === 'GRANTED' && c.consent.adPersonalization === 'GRANTED')) return 'consent';
    const kat = ['gclid', 'gbraid', 'wbraid'].filter((k) => k in c);
    if (kat.length !== 1 || (kat[0] !== 'gclid' && !braid) || typeof c[kat[0]] !== 'string' || clickIdHiba(kat[0], c[kat[0]])) return 'click_id';
    if (c.conversionValue !== GFELT.ertek || c.currencyCode !== GFELT.penznem) return 'ertek';
    if (!/^[0-9a-f]{64}$/.test(String(c.orderId || ''))) return 'order_id';
  }
  return null;
}

const upsert = (db, mezok) => db.prepare(
  `INSERT INTO gy_feltoltes_elo (uuid, mod, allapot, katt_tipus, katt_maszk, order_id, konverzio_ido, foglalas_allapot, hiba, http, probalkozas, letrehozva, frissitve) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 1, ?11, ?11)
   ON CONFLICT (uuid) DO UPDATE SET mod = excluded.mod, allapot = excluded.allapot, katt_tipus = excluded.katt_tipus, katt_maszk = excluded.katt_maszk, order_id = excluded.order_id, konverzio_ido = excluded.konverzio_ido,
     foglalas_allapot = excluded.foglalas_allapot, hiba = excluded.hiba, http = excluded.http, probalkozas = CASE WHEN gy_feltoltes_elo.mod = excluded.mod THEN gy_feltoltes_elo.probalkozas + ?12 ELSE 1 END, frissitve = excluded.frissitve`,
).bind(mezok.uuid, ZAP_MOD, mezok.allapot, mezok.kattTipus ?? null, mezok.maszk ?? null, mezok.orderId ?? null, mezok.ido ?? null, mezok.foglalasAllapot ?? null, mezok.hiba ?? null, mezok.http ?? null, mezok.most, mezok.novel ? 1 : 0);

/** GET: jogosult sorok kivalasztasa + a validateOnly=true keres. -> { status, body } */
export async function eloZapKivalaszt({ db, env, most }) {
  if (zapMod(env) !== 'validate') return { status: 200, body: { ok: true, mod: 'ki', nincs: true } };
  const tol = eloTol(env);
  if (!tol) return { status: 200, body: { ok: true, mod: 'validate', nincs: true, miert: 'nincs_tol' } };
  if (!env.GY_HMAC_KULCS) return { status: 200, body: { ok: true, mod: 'validate', nincs: true, miert: 'nincs_titkos_kulcs' } };
  await zarSema(db);
  const sorok = (await db.prepare(
    `SELECT f.uuid, f.letrehozva, f.allapot, f.hozzajarulas, f.gads_katt_tipus, f.gads_katt_ertek, f.gads_katt_ido FROM gy_foglalas f
     WHERE f.tipus = 'allapotfelmeres' AND f.teszt = 0 AND f.igazolt = 1 AND f.allapot IN ('aktiv', 'modositott', 'lemondott') AND f.gads_katt_ertek IS NOT NULL AND COALESCE(f.hozzajarulas, '') <> 'nem'
       AND f.letrehozva >= ?1 AND f.letrehozva <= ?2
       AND NOT EXISTS (SELECT 1 FROM gy_feltoltes_elo e WHERE e.uuid = f.uuid AND (e.allapot IN ('elkuldve', 'mar_bent') OR (e.probalkozas >= ?3 AND e.mod = ?4 AND e.allapot <> 'kihagyva_braid') OR (e.allapot = 'kihagyva_braid' AND ?6 = 0)
         OR e.allapot IN ('kihagyva_click_id', 'kihagyva_ido_sorrend') OR (e.mod = ?4 AND e.allapot IN ('elfogadva', 'mar_bent')) OR (e.mod = ?4 AND e.allapot = 'lefoglalva' AND e.frissitve > ?7)))
     ORDER BY f.letrehozva LIMIT ?5`,
  ).bind(tol, most - ELO_KESLELTETES, ELO_MAX_PROBA, ZAP_MOD, ZAP_ADAG, eloBraidBe(env) ? 1 : 0, most - ZAR_LEJARAT).all()).results || [];
  const idk = []; const conversions = []; const kihagyva = {};
  for (const r of sorok) {
    const orderId = await tranzakcioId(r.uuid, env.GY_HMAC_KULCS);
    const ido = budapestIdo(r.letrehozva);
    const alap = { uuid: r.uuid, kattTipus: r.gads_katt_tipus || null, maszk: maszk(r.gads_katt_ertek), orderId, ido, foglalasAllapot: r.allapot, most };
    const clickHiba = clickIdHiba(r.gads_katt_tipus, r.gads_katt_ertek);
    const kattIdo = Number.isInteger(r.gads_katt_ido) ? r.gads_katt_ido : null;
    const consent = String(env.GY_GADS_CONSENT || '') === 'granted' && r.hozzajarulas !== 'nem';
    const p = eloKonverzio({ kattTipus: r.gads_katt_tipus, kattErtek: r.gads_katt_ertek, konverzioIdo: ido, orderId, consent });
    let ki = null;
    if ((r.gads_katt_tipus === 'gbraid' || r.gads_katt_tipus === 'wbraid') && !eloBraidBe(env)) ki = ['kihagyva_braid', 'braid_kapu_zarva'];
    else if (clickHiba || !p) ki = ['kihagyva_click_id', clickHiba || 'hibas_kerelem'];
    else if (kattIdo !== null && kattIdo > r.letrehozva) ki = ['kihagyva_ido_sorrend', 'kattintas_a_foglalas_utan'];
    if (ki) { await upsert(db, { ...alap, allapot: ki[0], hiba: ki[1], novel: true }).run(); kihagyva[ki[0]] = (kihagyva[ki[0]] || 0) + 1; continue; }
    idk.push({ ...alap }); conversions.push(p);
  }
  if (!conversions.length) return { status: 200, body: { ok: true, mod: 'validate', nincs: true, miert: 'nincs_jelolt', kihagyva } };
  const keres = { conversions, partialFailure: true, validateOnly: true };
  const hiba = vedohaloElo(keres, { braid: eloBraidBe(env) });
  if (hiba) { console.error('gyt elo-zap: vedohalo', hiba); return { status: 500, body: { ok: false, hiba: 'vedohalo', kod: hiba } }; }
  const zar = ujToken();
  await db.batch([
    ...idk.map((x) => upsert(db, { ...x, allapot: 'lefoglalva', novel: true })),
    db.prepare('INSERT INTO gy_elo_zap_zar (zar, idk, letrehozva) VALUES (?1, ?2, ?3)').bind(zar, JSON.stringify(idk.map((x) => x.uuid)), most),
  ]);
  return { status: 200, body: { ok: true, mod: 'validate', zar, db: conversions.length, kihagyva, cel: { ugyfel: GFELT.ugyfel, akcio: ELO_AKCIO, api_verzio: 'v23', vegpont: `customers/${GFELT.ugyfel}:uploadClickConversions` }, keres } };
}

const egeszSzam = (v) => (Number.isInteger(v) ? v : typeof v === 'string' && /^\d{1,12}$/.test(v) ? Number(v) : NaN);
const joKod = (v) => (typeof v === 'string' && KOD_MINTA.test(v) ? v : null);

/** POST {zar, http, valasz}: a Google validateOnly valaszanak ertekelese. -> { status, body } (darabszam + hibakod, click-ID nincs) */
export async function eloZapFazis({ db, env, most, be }) {
  if (zapMod(env) !== 'validate') return { status: 200, body: { ok: true, mod: 'ki', nincs: true } };
  await zarSema(db);
  const zar = typeof be.zar === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(be.zar) ? be.zar : null;
  const http = egeszSzam(be.http);
  const json = valaszNormalizal(be.valasz);
  if (!zar || Number.isNaN(http) || json === null) return { status: 400, body: { ok: false, hiba: 'ervenytelen_torzs' } };
  const z = await db.prepare('SELECT zar, idk, lezarva FROM gy_elo_zap_zar WHERE zar = ?1').bind(zar).first();
  if (!z) return { status: 409, body: { ok: false, hiba: 'ismeretlen_zar' } };
  if (z.lezarva) return { status: 409, body: { ok: false, hiba: 'mar_lezarva' } };
  let uuidok; try { uuidok = JSON.parse(z.idk); } catch (e) { uuidok = []; }
  const sorok = (await db.prepare(`SELECT uuid, katt_tipus, katt_maszk, order_id, konverzio_ido, foglalas_allapot FROM gy_feltoltes_elo WHERE mod = ?1 AND allapot = 'lefoglalva' AND uuid IN (${uuidok.map(() => '?').join(',') || "''"})`).bind(ZAP_MOD, ...uuidok).all()).results || [];
  const rend = uuidok.map((u) => sorok.find((s) => s.uuid === u)).filter(Boolean); // a GET-ben kiadott sorrend
  if (rend.length !== uuidok.length) return { status: 409, body: { ok: false, hiba: 'sorhalmaz_elter' } };
  const e = valaszElemzes(http, json);
  const kodok = {}; const db_ = { elfogadva: 0, mar_bent: 0, hiba: 0 }; const frissit = [];
  const ir = (s, allapot, hiba, h) => { frissit.push(upsert(db, { uuid: s.uuid, kattTipus: s.katt_tipus, maszk: s.katt_maszk, orderId: s.order_id, ido: s.konverzio_ido, foglalasAllapot: s.foglalas_allapot, allapot, hiba, http: h, most })); if (hiba) kodok[hiba] = (kodok[hiba] || 0) + 1; db_[allapot] = (db_[allapot] || 0) + 1; };
  if (e.keresHiba) { // keres-szintu hiba (hozzaferes / konfiguracio / atmeneti): minden sor hiba a keres-szintu kodkal; a Google hibauzenete nem kerul tarolasra
    const kod = joKod(e.keresHiba.kod) || (e.keresHiba.http ? `HTTP_${e.keresHiba.http}` : 'KERES_HIBA');
    rend.forEach((s, i) => ir(s, 'hiba', joKod(e.sorHibak.get(i)) || kod, e.keresHiba.http ?? null));
  } else {
    rend.forEach((s, i) => {
      const kod = e.sorHibak.get(i);
      if (!kod) ir(s, 'elfogadva', null, http);
      else if (MAR_BENT.has(kod)) ir(s, 'mar_bent', kod, http);
      else ir(s, 'hiba', joKod(kod) || 'ISMERETLEN', http);
    });
  }
  frissit.push(db.prepare('UPDATE gy_elo_zap_zar SET lezarva = ?2 WHERE zar = ?1').bind(zar, most));
  await db.batch(frissit);
  return { status: 200, body: { ok: true, mod: 'validate', feldolgozva: rend.length, elfogadva: db_.elfogadva, mar_bent: db_.mar_bent, hiba: db_.hiba, kodok, ...(e.keresHiba ? { keres_hiba: { http: e.keresHiba.http ?? null, kod: joKod(e.keresHiba.kod) } } : {}) } };
}

async function jsonTest(request, maxBajt = 65536) {
  const t = await request.text();
  if (t.length > maxBajt) return null;
  try { const j = JSON.parse(t); return j && typeof j === 'object' ? j : null; } catch (e) { return null; }
}

/** /api/gy-gads-elo-zap (GET / POST), hitelesites: x-gy-zap-kulcs (mint a GY-26). */
export async function eloZapVegpont({ request, env, deps = {} }) {
  if (!['GET', 'POST'].includes(request.method)) return valasz(405, { ok: false });
  if (!(await kulcsOk(request, env))) return valasz(401, { ok: false });
  const db = env.GY_DB;
  if (!db) return valasz(503, { ok: false, hiba: 'nincs_adatbazis' });
  const most = mostUnix(deps);
  let r;
  if (request.method === 'GET') r = await eloZapKivalaszt({ db, env, most });
  else {
    const be = await jsonTest(request);
    if (!be) return valasz(400, { ok: false, hiba: 'ervenytelen_torzs' });
    r = await eloZapFazis({ db, env, most, be });
  }
  return valasz(r.status, r.body);
}
