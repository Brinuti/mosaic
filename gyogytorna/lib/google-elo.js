// UJ-72 (GYT, Feri DECISION #234, #167 6395410560): CSERE NELKULI Google-javitas az ELO „Allapot-ok” akcion (7362127659).
//   A GYT-motor a sikeres foglalas utan a bongeszonek mar most is kiad egy HMAC-alapu tranzakcio-azonositot (dataLayer `foglalas_kesz.tranzakcio_id` = tranzakcioId(uuid)); a bongeszos Google-cimke
//   (GTM, kulso fiok: a meresi oldal lepese) ezt viszi order_id-kent. Itt a SZERVER a hianyzo, IGAZOLT allapotfelmereseket UGYANERRE az akciora, AZONOS order_id-vel tolti vissza (a Google az azonos akcio +
//   azonos order_id part egy konverziokent szamolja). Minden letrejott online allapotfelmeres egyszer, AKKOR IS, HA a feltoltes elott lemondjak (levonas / RETRACTION nincs: a GY_GADS_KIIGAZITAS marad ki).
// KULON MODUL, a vedett gfeltoltes.js / gkiigazitas.js valtozatlan (csak importaljuk a googleAdsKuldo-t, a GFELT-et, a click-ID ellenorzest); a meglevo ARNYEK-feltoltes (7858300772) erintetlen.
// Adat: click-ID, konverzios ido (Europe/Budapest), ertek, order_id, penznem; NINCS nev / e-mail / telefon / panasz / egeszsegugyi adat / user_identifiers.
// ALAPBOL KI: GY_GADS_ELO = ki (alap) | dry (csak naplo, halozati hivas nincs) | validate (validateOnly=true) | eles (valodi feltoltes: kulon DECISION / Feri mondata). GY_GADS_ELO_TOL = a bongeszos order_id-s cimke elesitesenek unix-ideje (nelkule nem fut).
import { GFELT, googleAdsKuldo, clickIdHiba, maszk, gbraidBe } from './gfeltoltes.js';
import { tranzakcioId } from './titkos.js';

export const ELO_AKCIO = '7362127659';
export const ELO_KESLELTETES = 3600; // mp: legkorabban 1 oraval a foglalas utan (a cimke elobb rogzitse a sajat konverziojat; friss kattintasnal CLICK_NOT_FOUND)
export const ELO_MAX_PROBA = 3;
export const ELES_HOST = 'gyogytornaszom.hu'; // a validate / eles feltoltes CSAK az eles hoston fut (elonezet / mas host: probauzem = dry, halozati hivas nincs)
const KATT_MEZO = Object.freeze({ gclid: 'gclid', gbraid: 'gbraid', wbraid: 'wbraid' });
const MAR_BENT = new Set(['CLICK_CONVERSION_ALREADY_EXISTS', 'ORDER_ID_ALREADY_IN_USE', 'DUPLICATE_ORDER_ID']); // ugyanaz a konverzio mar bent van: sikernek vesszuk (nincs dupla)
const MODOK = Object.freeze(['ki', 'dry', 'validate', 'eles']);

export const eloMod = (env) => { const m = String((env && env.GY_GADS_ELO) || 'ki').trim().toLowerCase(); return MODOK.includes(m) ? m : 'ki'; };
export const eloKuldesE = (env, host) => eloMod(env) !== 'dry' && eloMod(env) !== 'ki' && String(host || '').toLowerCase().replace(/^www\./, '') === ELES_HOST;
/** Az ELO akcio (7362127659) ONE_PER_CLICK: a gbraid / wbraid kattintas ONE_PER_CLICK_CONVERSION_ACTION_NOT_PERMITTED_WITH_BRAID hibat adna (mint a 7858300772 a DECISION #242 elott). Ezert a braid CSAK akkor megy, ha a meglevo feltolto kapuja (GY_GADS_BRAID = be) ES az elo-kapu (GY_GADS_ELO_BRAID = be, a Google-oldali szamlalasi mod ellenorzese utan) is nyitva van. */
export const eloBraidBe = (env) => gbraidBe(env) && String((env && env.GY_GADS_ELO_BRAID) || 'ki').toLowerCase() === 'be';
export const eloTol = (env) => { const t = Number(env && env.GY_GADS_ELO_TOL); return Number.isFinite(t) && t > 1700000000 ? Math.floor(t) : null; };

const SEMA = [
  `CREATE TABLE IF NOT EXISTS gy_feltoltes_elo (uuid TEXT PRIMARY KEY, mod TEXT NOT NULL, allapot TEXT NOT NULL, katt_tipus TEXT, katt_maszk TEXT, order_id TEXT, konverzio_ido TEXT, foglalas_allapot TEXT,
    hiba TEXT, http INTEGER, probalkozas INTEGER NOT NULL DEFAULT 0, letrehozva INTEGER NOT NULL, frissitve INTEGER NOT NULL)`,
];
const kesz = new WeakSet();
const NAPLO_SEMA = `CREATE TABLE IF NOT EXISTS gy_elo_naplo (nap TEXT NOT NULL, allapot TEXT NOT NULL, host_kat TEXT NOT NULL, db INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (nap, allapot, host_kat))`; // UJ-94 / DECISION #264 (a): napi darabszam a sweep kimeneterol (korai kilepesek is) - vendegadat es host-ertek NELKUL (host_kat: eles / pages_dev / egyeb); nap = UTC datum
const naploKesz = new WeakSet();
async function sema(db) { if (kesz.has(db)) return; await db.batch(SEMA.map((s) => db.prepare(s))); kesz.add(db); }
export const eloSema = sema; // UJ-94 (#264 b): a Zapier-validate modul is ugyanezt a tablat hasznalja

/** A feltoltendo konverzio (tiszta fuggveny). consent: DECISION #220 szerint (GY_GADS_CONSENT=granted es nincs kifejezett elutasitas) GRANTED, egyebkent nincs consent mezo. */
export function eloKonverzio({ kattTipus, kattErtek, konverzioIdo, orderId, consent = false }) {
  const mezo = KATT_MEZO[kattTipus];
  if (!mezo || !kattErtek || !orderId || !konverzioIdo) return null;
  return {
    [mezo]: kattErtek, conversionAction: `customers/${GFELT.ugyfel}/conversionActions/${ELO_AKCIO}`, conversionDateTime: konverzioIdo, conversionValue: GFELT.ertek, currencyCode: GFELT.penznem, orderId,
    ...(consent ? { consent: { adUserData: 'GRANTED', adPersonalization: 'GRANTED' } } : {}),
  };
}

/** A Google valasza -> { allapot: 'elfogadva'|'elkuldve'|'mar_bent'|'hiba', hiba }. Az "mar bent van" kodok sikernek szamitanak. */
export function eloValasz(http, json, { validate }) {
  const kodok = []; const pf = json && json.partialFailureError;
  if (pf) for (const d of pf.details || []) for (const er of d.errors || []) { const c = er.errorCode || {}; kodok.push(String(c.conversionUploadError || Object.values(c)[0] || 'ISMERETLEN')); }
  if (http >= 200 && http < 300 && !pf) return { allapot: validate ? 'elfogadva' : 'elkuldve', hiba: null };
  if (kodok.length && kodok.every((c) => MAR_BENT.has(c))) return { allapot: 'mar_bent', hiba: kodok[0] };
  return { allapot: 'hiba', hiba: String(kodok[0] || (json && json.error && json.error.status) || 'HTTP_' + http).slice(0, 80) };
}

/**
 * A sweep: a jogosult, meg fel nem toltott sorok potlasa. Hivasi pont: a Pages Function (waitUntil); a hiba elnyelt.
 * Jogosult: tipus = allapotfelmeres, nem teszt, Salonic-igazolt (igazolt = 1), aktiv / modositott / LEMONDOTT, van click-ID (jo formaju, a foglalas ELOTTI kattintas), nincs kifejezett hozzajarulas-elutasitas,
 * letrehozva >= TOL es legalabb ELO_KESLELTETES-sel regebbi.
 * -> { allapot: 'ki' | 'nincs_tol' | 'nincs_titkos_kulcs' | 'nincs_kuldo' | 'kesz', feldolgozva, eredmenyek }
 */
async function eloPotlasBelso({ db, env = {}, most = Math.floor(Date.now() / 1000), budapestIdo, kuldo, limit = 10, host = '' }) {
  try {
    const mod = eloMod(env) === 'ki' ? 'ki' : (eloMod(env) !== 'dry' && !eloKuldesE(env, host) ? 'dry' : eloMod(env)); // nem eles host: validate / eles helyett probauzem
    if (mod === 'ki') return { allapot: 'ki' };
    const tol = eloTol(env);
    if (!tol) return { allapot: 'nincs_tol', megjegyzes: 'GY_GADS_ELO_TOL nincs beallitva' };
    if (!env.GY_HMAC_KULCS) return { allapot: 'nincs_titkos_kulcs' };
    const k = mod === 'dry' ? null : (kuldo || googleAdsKuldo(env));
    if (mod !== 'dry' && !k) return { allapot: 'nincs_kuldo' };
    await sema(db);
    const sorok = (await db.prepare(
      `SELECT f.uuid, f.letrehozva, f.allapot, f.hozzajarulas, f.gads_katt_tipus, f.gads_katt_ertek, f.gads_katt_ido FROM gy_foglalas f
       WHERE f.tipus = 'allapotfelmeres' AND f.teszt = 0 AND f.igazolt = 1 AND f.allapot IN ('aktiv', 'modositott', 'lemondott') AND f.gads_katt_ertek IS NOT NULL AND COALESCE(f.hozzajarulas, '') <> 'nem'
         AND f.letrehozva >= ?1 AND f.letrehozva <= ?2
         AND NOT EXISTS (SELECT 1 FROM gy_feltoltes_elo e WHERE e.uuid = f.uuid AND (e.allapot IN ('elkuldve', 'mar_bent') OR (e.probalkozas >= ?3 AND e.mod = ?4 AND e.allapot <> 'kihagyva_braid') OR (e.allapot = 'kihagyva_braid' AND ?6 = 0) OR e.allapot IN ('kihagyva_click_id', 'kihagyva_ido_sorrend') OR (e.mod = ?4 AND e.allapot IN ('elfogadva', 'dry'))))
       ORDER BY f.letrehozva LIMIT ?5`,
    ).bind(tol, most - ELO_KESLELTETES, ELO_MAX_PROBA, mod, limit, eloBraidBe(env) ? 1 : 0).all()).results || [];
    const eredmenyek = {};
    const naploz = (uuid, v) => db.prepare(
      `INSERT INTO gy_feltoltes_elo (uuid, mod, allapot, katt_tipus, katt_maszk, order_id, konverzio_ido, foglalas_allapot, hiba, http, probalkozas, letrehozva, frissitve) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 1, ?11, ?11)
       ON CONFLICT (uuid) DO UPDATE SET mod = excluded.mod, allapot = excluded.allapot, katt_tipus = excluded.katt_tipus, katt_maszk = excluded.katt_maszk, order_id = excluded.order_id, konverzio_ido = excluded.konverzio_ido,
         foglalas_allapot = excluded.foglalas_allapot, hiba = excluded.hiba, http = excluded.http, probalkozas = CASE WHEN gy_feltoltes_elo.mod = excluded.mod THEN gy_feltoltes_elo.probalkozas + 1 ELSE 1 END, frissitve = excluded.frissitve`,
    ).bind(uuid, mod, v.allapot, v.kattTipus, v.maszk, v.orderId, v.ido, v.foglalasAllapot, v.hiba ?? null, v.http ?? null, most).run();
    for (const r of sorok) {
      const orderId = await tranzakcioId(r.uuid, env.GY_HMAC_KULCS);
      const ido = budapestIdo ? budapestIdo(r.letrehozva) : null;
      const alap = { kattTipus: r.gads_katt_tipus || null, maszk: maszk(r.gads_katt_ertek), orderId, ido, foglalasAllapot: r.allapot };
      const clickHiba = clickIdHiba(r.gads_katt_tipus, r.gads_katt_ertek);
      const kattIdo = Number.isInteger(r.gads_katt_ido) ? r.gads_katt_ido : null;
      const consent = String(env.GY_GADS_CONSENT || '') === 'granted' && r.hozzajarulas !== 'nem';
      const p = eloKonverzio({ kattTipus: r.gads_katt_tipus, kattErtek: r.gads_katt_ertek, konverzioIdo: ido, orderId, consent });
      let v;
      if ((r.gads_katt_tipus === 'gbraid' || r.gads_katt_tipus === 'wbraid') && !eloBraidBe(env)) v = { ...alap, allapot: 'kihagyva_braid', hiba: 'braid_kapu_zarva' };
      else if (clickHiba || !p) v = { ...alap, allapot: 'kihagyva_click_id', hiba: clickHiba || 'hibas_kerelem' };
      else if (kattIdo !== null && kattIdo > r.letrehozva) v = { ...alap, allapot: 'kihagyva_ido_sorrend', hiba: 'kattintas_a_foglalas_utan' };
      else if (mod === 'dry') v = { ...alap, allapot: 'dry', hiba: null };
      else {
        try {
          const kerelem = { conversions: [p], partialFailure: true, validateOnly: mod !== 'eles' };
          const res = await k(kerelem);
          const e = eloValasz(res.http, res.json, { validate: mod !== 'eles' });
          v = { ...alap, allapot: e.allapot, hiba: e.hiba, http: res.http };
        } catch (err) { v = { ...alap, allapot: 'hiba', hiba: String(err && err.message || err).slice(0, 80) }; }
      }
      await naploz(r.uuid, v);
      eredmenyek[v.allapot] = (eredmenyek[v.allapot] || 0) + 1;
    }
    return { allapot: 'kesz', feldolgozva: sorok.length, eredmenyek };
  } catch (err) {
    console.error('gyt google-elo: hiba', String(err && err.message || err).slice(0, 200));
    return { allapot: 'hiba' };
  }
}

/** A host kategoriaja a naplohoz (a host erteke NEM kerul tarolasra). */
export const hostKat = (host) => { const h = String(host || '').toLowerCase().replace(/^www\./, ''); return h === ELES_HOST ? 'eles' : (h.endsWith('.pages.dev') ? 'pages_dev' : 'egyeb'); };

/** UJ-94 / DECISION #264 (a): a sweep + napi darabszam-naplo (allapot x host_kat). A naplo hibaja elnyelt, az eredmenyt nem valtoztatja; 'ki' modban nem ir. */
export async function eloPotlas(args) {
  const v = await eloPotlasBelso(args);
  try {
    if (v && v.allapot !== 'ki' && args && args.db) {
      if (!naploKesz.has(args.db)) { await args.db.prepare(NAPLO_SEMA).run(); naploKesz.add(args.db); }
      const most = Number.isFinite(args.most) ? args.most : Math.floor(Date.now() / 1000);
      const nap = new Date(most * 1000).toISOString().slice(0, 10);
      await args.db.prepare('INSERT INTO gy_elo_naplo (nap, allapot, host_kat, db) VALUES (?1, ?2, ?3, 1) ON CONFLICT (nap, allapot, host_kat) DO UPDATE SET db = db + 1').bind(nap, String(v.allapot), hostKat(args.host)).run();
    }
  } catch (e) { /* a naplo hibaja nem erintheti a sweep-et */ }
  return v;
}
