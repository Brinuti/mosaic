// GA4 VALIDATION_REPLAY (GPT-dontes #123, 2026-10-10): EGYETLEN, korabban ki nem kuldott (pl. a veszkapcsolo miatt "kihagyva") GA4-alapesemeny ujrajatszasa, KIZAROLAG a GA4 arnyek-agon,
// a titokcsere utani kuldes-bizonyitekhoz. NEM megy at az elosztason (netlify/lib/meres/elosztas.js): az ugyanazt a foglalast MINDEN platformra ujrakuldene (Meta / TikTok / Google is), ez viszont
// csak a GA4 kerelmet epiti (ga4Kerelem) es kuldi (kuldes) - a tobbi platform erintetlen.
//   - jeloles: az esemeny `validation_replay: "true"` parametert kap; a naplo kulon tablaban van (meres_validation_replay), NEM a meres_kuldes-ben, igy a QA-5 egyezteto lefedettsegi szamaiba nem kerul bele
//     (az egyezteto osszegzese kulon, kizart tetelkent listazza: osszegzes.validation_replay);
//   - feltetelek: mb_ foglalas, MERES_ELOSZTO=1, a GA4 alapesemeny meg nem 'elkuldve', a foglaláskori pillanatkepben analytics-hozzajarulas (ana = true) ES GA4 client_id van, nem konzultacio-ertek;
//   - egy foglalasra legfeljebb egy sikeres ujrajatszas (ujra: true nelkul);
//   - az api_secret csak a kimeno kereshez kerul az URL-be (platformok.js kuldes), a naploba nem.
import { meresSema, erkezesOlvas } from './elosztas.js';
import { platformSzabaly } from './hozzajarulas.js';
import { ga4Kerelem, kuldes } from './platformok.js';

export const REPLAY_JEL = 'validation_replay';
const sec = (now) => Math.floor(now / 1000);
const FOGLALAS_ID = /^mb_[a-z0-9]{12,40}$/;
const SEMA = [
  'CREATE TABLE IF NOT EXISTS meres_validation_replay (id INTEGER PRIMARY KEY AUTOINCREMENT, source_id TEXT NOT NULL, esemeny_id TEXT NOT NULL, platform TEXT NOT NULL, jel TEXT NOT NULL, allapot TEXT NOT NULL, http_status INTEGER, valasz TEXT, kerelem TEXT, kuldve INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS meres_validation_replay_source ON meres_validation_replay (source_id)',
];
const kesz = new WeakSet();
async function sema(db) { if (kesz.has(db)) return; await db.batch(SEMA.map((s) => db.prepare(s))); kesz.add(db); }

/** Az ujrajatszasok listaja (az egyezteto osszegzesehez): a tabla hianya = ures lista. Csak olvas. */
export async function replayLista(db) {
  try {
    const { results } = await db.prepare('SELECT id, source_id, esemeny_id, platform, jel, allapot, http_status, kuldve FROM meres_validation_replay ORDER BY id').all();
    return (results || []).map((r) => ({ ...r, kuldve_utc: new Date(r.kuldve * 1000).toISOString(), kizarva_a_mintabol: true }));
  } catch (e) { return []; }
}

/**
 * -> { ok: true, allapot, http_status, ... } | { ok: false, miert }
 * deps.fetchImpl: tesztelheto kuldes (alapbol a globalis fetch).
 */
export async function ga4ValidationReplay(db, env, { source_id, ujra = false } = {}, now = Date.now(), fetchImpl = fetch) {
  if (!env || String(env.MERES_ELOSZTO) !== '1') return { ok: false, miert: 'MERES_ELOSZTO nincs bekapcsolva' };
  if (!FOGLALAS_ID.test(String(source_id || ''))) return { ok: false, miert: 'source_id: mb_ foglalas-azonosito kell' };
  await meresSema(db); await sema(db);
  const { results: ga4 } = await db.prepare("SELECT esemeny_id, esemeny_nev, esemeny_tipus, uzletag, ertek, penznem, allapot, letrehozva FROM meres_kuldes WHERE source_id = ?1 AND platform = 'ga4' AND esemeny_tipus = 'alap'").bind(source_id).all();
  if (!ga4 || ga4.length !== 1) return { ok: false, miert: 'a foglalashoz pontosan egy GA4 alapesemeny-sor kell (van: ' + (ga4 ? ga4.length : 0) + ')' };
  const sor = ga4[0];
  if (sor.allapot === 'elkuldve') return { ok: false, miert: 'a GA4 alapesemeny mar elkuldve (nincs mit ujrajatszani)' };
  const erk = await erkezesOlvas(db, source_id);
  if (!erk) return { ok: false, miert: 'nincs erkezesi pillanatkep' };
  if (!(erk.hozz && erk.hozz.ana === true)) return { ok: false, miert: 'nincs analytics-hozzajarulas a foglaláskori pillanatkepben' };
  if (!(erk.attr && erk.attr.ga4 && erk.attr.ga4.client_id)) return { ok: false, miert: 'nincs GA4 client_id a pillanatkepben' };
  if (!ujra) {
    const elozo = await db.prepare("SELECT COUNT(*) AS n FROM meres_validation_replay WHERE source_id = ?1 AND platform = 'ga4' AND allapot = 'elkuldve'").bind(source_id).first();
    if (elozo && elozo.n > 0) return { ok: false, miert: 'ehhez a foglalashoz mar volt sikeres validation_replay (ujra: true-val ismetelheto)' };
  }
  if (/^Konzultacio$/.test(sor.esemeny_nev)) return { ok: false, miert: 'konzultacio-ertek esemeny nem jatszhato vissza (az erteke tablabol jon)' };
  // az eredeti kerelem ujraepitese UGYANAZZAL a kodutvonallal (ga4Kerelem), a tarolt adatokbol; a kuldes ideje az eredeti esemeny letrehozasa
  const e = { nev: sor.esemeny_nev, tipus: 'alap', esemeny_id: sor.esemeny_id, ertek: sor.ertek, penznem: sor.penznem, ertek_forras: 'tenyleges_ar', salonic_ar: sor.ertek };
  const ctx = { fk: { source_entity_id: source_id, uzletag: sor.uzletag, ido: sor.letrehozva, szolgaltatas: (erk.bongeszo && erk.bongeszo.szolgaltatas) || null }, erk: erk.attr, hozz: { ga4: platformSzabaly('ga4', erk.hozz) } };
  const k = ga4Kerelem(e, ctx, env);
  if (!k || !k.body) return { ok: false, miert: (k && (k.tiltva || k.kihagyva)) || 'a GA4 kerelem nem epitheto' };
  k.body.events[0].params = { ...k.body.events[0].params, validation_replay: 'true' };
  const eredmeny = await kuldes(k, env, fetchImpl);
  const t = sec(now);
  await db.prepare('INSERT INTO meres_validation_replay (source_id, esemeny_id, platform, jel, allapot, http_status, valasz, kerelem, kuldve) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)')
    .bind(source_id, sor.esemeny_id, 'ga4', REPLAY_JEL, eredmeny.allapot, eredmeny.http_status ?? null, String(eredmeny.valasz || '').slice(0, 1500), JSON.stringify(k), t).run();
  return { ok: true, jel: REPLAY_JEL, source_id, esemeny_id: sor.esemeny_id, platform: 'ga4', allapot: eredmeny.allapot, http_status: eredmeny.http_status ?? null, kuldve: t, kuldve_utc: new Date(t * 1000).toISOString(), kizarva_a_mintabol: true };
}
