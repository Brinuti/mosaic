// MEDICAL PIERCING – Google Ads konverzio-kiigazitas (RETRACT) a Salonic-igazolas alapjan.
//
// A bongeszo a koszonooldalon a masodlagos "Időpontfoglalás - igazolt" konverziot (7839410357) kuldi, orderId =
// foglalasi kulcs (placeId|employeeId|startUnix, assets/js/suti.js). Ha egy foglalast a Salonic BIZTOSAN nem igazolt,
// azt itt visszavonasra jeloljuk. A Google-hivast egy utemezett Zapier durable workflow vegzi (a Workernek nincs sajat
// Google Ads API-hitelesitese, a Pages-ben nincs cron):
//   GET  /api/mp-kiigazitas            -> { mod, keres: <uploadConversionAdjustments torzs>, orderIdk, bizonytalan }
//   POST /api/mp-kiigazitas  { mod, orderIdk, valasz }  -> a Google-valasz soronkenti feldolgozasa a D1-be
// Fejlec: x-mp-kiigazitas = titok (MP_KIIGAZITAS_TITOK, vagy a D1 mp_beallitas.kiigazitas_titok_sha256 lenyomata, csak eles hoszton).
// Mod: mp_beallitas.kiigazitas_mod = 'eles' | 'ki' | (barmi mas / ures) 'validate'. Elesre kapcsolas: Feri jovahagyasaval.
// RESTATE (ertekmodositas) NINCS: az ertekszabaly meg nincs eldontve (GPT 2026-10-12: most ne).
// Kifele csak: akcio, tipus, orderId (szamok), ido. Nev, e-mail, telefon, szolgaltatas SOHA.
import { semaBiztos } from './lanc.js';
import { googleIdo, ELES_HOST, MP_GADS } from './google-ads.js';
import { riport, adsSorok, adsMentes } from './riport.js';

export const IGAZOLT_AKCIO = '7839410357';
/** A bongeszo-cimke elesitese (GTM v16, 2026-10-12 09:45 UTC): ennel korabbi foglalashoz nincs orderId-s konverzio. */
export const CIMKE_TOL = 1791798300;
export const RETRACT_UTAN = 48 * 3600; // ennyi ido utan "nem igazolt" a sor
export const VEGLEGES_NINCS = 72 * 3600; // CONVERSION_NOT_FOUND ennyi utan (vagy 2. probara) vegleges
export const MAX_KOR = 50 * 86400; // a Google 54 napig fogad kiigazitast
export const MAX_TETEL = 100;
const MAX_PROBA = 5;
const KESZ = { validate: ['elfogadva', 'nincs_konverzio', 'bizonytalan'], eles: ['elkuldve', 'nincs_konverzio', 'bizonytalan'] };

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const sha256hex = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s))))].map((x) => x.toString(16).padStart(2, '0')).join('');
const egyenlo = (a, b) => {
  a = String(a || ''); b = String(b || '');
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0 && a.length > 0;
};
const beallitas = async (db, kulcs) => { try { const r = await db.prepare('SELECT ertek FROM mp_beallitas WHERE kulcs = ?').bind(kulcs).first(); return r ? r.ertek : null; } catch (e) { return null; } };

async function titok(db, env, kapott, eles) {
  if (env.MP_KIIGAZITAS_TITOK) return { van: true, jo: !!kapott && egyenlo(kapott, env.MP_KIIGAZITAS_TITOK) };
  if (!eles) return { van: false, jo: false };
  const h = await beallitas(db, 'kiigazitas_titok_sha256');
  if (!h) return { van: false, jo: false };
  return { van: true, jo: !!kapott && egyenlo(await sha256hex(kapott), h) };
}

/** Mod: 'eles' csak az eles hoszton; 'ki' = semmi; minden mas 'validate'. */
export async function modOlvas(db, eles) {
  const m = String((await beallitas(db, 'kiigazitas_mod')) || '').trim().toLowerCase();
  if (m === 'ki' || m === 'off') return 'ki';
  return m === 'eles' && eles ? 'eles' : 'validate';
}

const kulcsResz = (k) => { const [p, e, s] = String(k).split('|'); return { place: p, emp: e, start: Number(s) }; };

/**
 * Az esedekes RETRACT-jeloltek. "Biztosan nem igazolt" (GPT 2026-10-12): eles sor, a cimke elesitese utan jott letre,
 * 48 oranal regebbi, 50 napnal fiatalabb, nincs igazolva; a Salonic-level-csatorna a foglalas utan is mukodott
 * (van >= 1 ora mulva rogzitett igazolas); es NINCS azonos kezdesi percu Salonic-igazolas (barmely munkatars) –
 * ha van, 'bizonytalan', nem nyulunk hozza.
 */
export async function jeloltek(db, mod, most) {
  const r = await db.prepare(`SELECT f.kulcs, f.letrehozva, k.allapot, k.probalkozas FROM mp_foglalas f
    LEFT JOIN mp_kiigazitas k ON k.kulcs = f.kulcs AND k.tipus = 'RETRACTION' AND k.mod = ?
    WHERE f.kornyezet = 'eles' AND f.letrehozva >= ? AND f.letrehozva <= ? AND f.letrehozva >= ?
      AND (f.igazolas IS NULL OR f.igazolas = 'nem_igazolt')
    ORDER BY f.letrehozva LIMIT 500`).bind(mod, CIMKE_TOL, most - RETRACT_UTAN, most - MAX_KOR).all();
  const kuld = [], bizonytalan = [];
  for (const s of r.results || []) {
    if (s.allapot && KESZ[mod].includes(s.allapot)) continue;
    if ((s.probalkozas || 0) >= MAX_PROBA) continue;
    const csatorna = await db.prepare('SELECT 1 AS x FROM mp_salonic_igazolas WHERE rogzitve >= ? LIMIT 1').bind(s.letrehozva + 3600).first();
    if (!csatorna) continue; // a level-csatorna akkor nem bizonyitottan mukodott: varunk
    const k = kulcsResz(s.kulcs);
    const azonosPerc = await db.prepare('SELECT 1 AS x FROM mp_salonic_igazolas WHERE start_unix BETWEEN ? AND ? LIMIT 1').bind(k.start - 59, k.start).first();
    if (azonosPerc) { bizonytalan.push(s.kulcs); continue; }
    kuld.push(s);
    if (kuld.length >= MAX_TETEL) break;
  }
  return { kuld, bizonytalan };
}

async function rogzit(db, kulcs, mod, allapot, ok, valasz, most, plusz = 0) {
  await db.prepare(`INSERT INTO mp_kiigazitas (kulcs, tipus, mod, allapot, ok, valasz, probalkozas, ido) VALUES (?, 'RETRACTION', ?, ?, ?, ?, ?, ?)
    ON CONFLICT (kulcs, tipus, mod) DO UPDATE SET allapot = excluded.allapot, ok = excluded.ok, valasz = excluded.valasz,
    probalkozas = mp_kiigazitas.probalkozas + excluded.probalkozas, ido = excluded.ido`).bind(kulcs, mod, allapot, ok, valasz == null ? null : String(valasz).slice(0, 600), plusz, most).run();
}

/** A Google uploadConversionAdjustments torzse. */
export function keresTorzs(kulcsok, mod, most) {
  const ido = googleIdo(most - 600); // a Google nem fogad jovobeli idot (orakeses ellen 10 perc tartalek)
  return {
    conversionAdjustments: kulcsok.map((k) => ({ conversionAction: `customers/${MP_GADS.customerId}/conversionActions/${IGAZOLT_AKCIO}`, adjustmentType: 'RETRACTION', orderId: k, adjustmentDateTime: ido })),
    partialFailure: true,
    validateOnly: mod !== 'eles',
  };
}

/** A Google-valasz soronkent: index -> hibakodok. */
export function valaszFeldolgozas(valasz, n) {
  const hibak = Array.from({ length: n }, () => []);
  const pf = valasz && valasz.partialFailureError;
  let altalanos = null;
  if (valasz && valasz.error) altalanos = String(valasz.error.message || 'hiba').slice(0, 200);
  if (pf) {
    let volt = false;
    for (const d of pf.details || []) for (const er of d.errors || []) {
      const fp = (er.location && er.location.fieldPathElements) || [];
      const ix = fp.find((x) => x.fieldName === 'conversion_adjustments');
      const kod = Object.values(er.errorCode || {})[0] || 'ISMERETLEN';
      if (ix && Number.isFinite(ix.index) && ix.index < n) { hibak[ix.index].push(kod); volt = true; }
    }
    if (!volt) altalanos = String(pf.message || 'partial_failure').slice(0, 200);
  }
  return { hibak, altalanos };
}

export async function kiigazitasVegpont({ request, env = {} }, { most = Math.floor(Date.now() / 1000) } = {}) {
  const db = env.MP_MERES_DB;
  const eles = new URL(request.url).hostname === ELES_HOST;
  if (!db) return json({ ok: false }, 404);
  await semaBiztos(db);
  const t = await titok(db, env, request.headers.get('x-mp-kiigazitas'), eles);
  if (!t.van) return json({ ok: false }, 404);
  if (!t.jo) return json({ ok: false }, 403);
  const mod = await modOlvas(db, eles);
  const url = new URL(request.url);

  // napi meres-egeszseg riport (riport.js) es a Google Ads napi konverziok betoltese (a Zapier napi workflow)
  if (request.method === 'GET' && url.searchParams.get('riport')) {
    return json(await riport(db, most, Math.min(60, Math.max(1, Number(url.searchParams.get('nap')) || 14))));
  }

  if (request.method === 'GET') {
    if (mod === 'ki') return json({ ok: true, mod, orderIdk: [], keres: null });
    const { kuld, bizonytalan } = await jeloltek(db, mod, most);
    for (const k of bizonytalan) await rogzit(db, k, mod, 'bizonytalan', 'azonos_kezdesi_percu_salonic_igazolas', null, most);
    const orderIdk = kuld.map((s) => s.kulcs);
    return json({ ok: true, mod, orderIdk, bizonytalan: bizonytalan.length, keres: orderIdk.length ? keresTorzs(orderIdk, mod, most) : null });
  }

  if (request.method === 'POST') {
    let b; try { b = await request.json(); } catch (e) { return json({ ok: false, hiba: 'rossz_keres' }, 400); }
    if (b.muvelet === 'ads_napi') {
      let v = b.valasz; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } }
      const sorok = adsSorok(v);
      await adsMentes(db, sorok, most);
      const r = await riport(db, most, 14);
      return json({ ok: true, mentve: sorok.length, figyelmeztetesek: r.figyelmeztetesek });
    }
    const orderIdk = Array.isArray(b.orderIdk) ? b.orderIdk.map(String).filter((k) => /^\d+\|\d+\|\d+$/.test(k)).slice(0, MAX_TETEL) : [];
    if (b.mod !== mod) return json({ ok: false, hiba: 'mod_elteres', mod }, 409); // menet kozbeni atkapcsolas: a kovetkezo kor ujra lekeri
    let valasz = b.valasz;
    if (typeof valasz === 'string') { try { valasz = JSON.parse(valasz); } catch (e) { valasz = { error: { message: valasz } }; } }
    const { hibak, altalanos } = valaszFeldolgozas(valasz || {}, orderIdk.length);
    const ki = {};
    for (let i = 0; i < orderIdk.length; i++) {
      const k = orderIdk[i];
      const sor = await db.prepare("SELECT f.letrehozva, k.probalkozas FROM mp_foglalas f LEFT JOIN mp_kiigazitas k ON k.kulcs = f.kulcs AND k.tipus = 'RETRACTION' AND k.mod = ? WHERE f.kulcs = ?").bind(mod, k).first();
      if (!sor) continue;
      let allapot, ok;
      if (altalanos) { allapot = 'hiba'; ok = 'altalanos: ' + altalanos; }
      else if (!hibak[i].length) { allapot = mod === 'eles' ? 'elkuldve' : 'elfogadva'; ok = 'nem_igazolt_48h|csatorna_mukodott|nincs_azonos_perc'; }
      else if (hibak[i].every((h) => h === 'CONVERSION_NOT_FOUND')) {
        const vegleges = sor.letrehozva <= most - VEGLEGES_NINCS || (sor.probalkozas || 0) >= 1;
        allapot = vegleges ? 'nincs_konverzio' : 'varakozik'; ok = 'CONVERSION_NOT_FOUND';
      } else { allapot = 'hiba'; ok = hibak[i].join(','); }
      await rogzit(db, k, mod, allapot, ok, allapot === 'hiba' ? JSON.stringify(valasz).slice(0, 600) : null, most, 1);
      ki[allapot] = (ki[allapot] || 0) + 1;
    }
    return json({ ok: true, mod, feldolgozva: orderIdk.length, ki });
  }
  return json({ ok: false }, 405);
}
