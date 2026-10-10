// QA-2 ARNYEK-ELOSZTO: egy foglalas / ajandekkartya forras-entitasbol az alap- es ernyoesemenyek eloallitasa, es kuldese a platformok ARNYEK-celpontjaira.
//   - hozzajarulas az SZ-38 szerint (hozzajarulas.js), hash-elt e-mail / telefon (GA4-be nem), ertek = tenyleges ar, penznem HUF
//   - duplikacioszures: (esemeny_id, platform) egyedi -> egy esemeny egy platformra legfeljebb egyszer megy ki, ujrahivasra sem
//   - veszkapcsolo uzletagankent ES platformonkent (meres_kapcsolo): "mind", "uzletag:<u>", "platform:<p>", "cella:<u>:<p>"
//   - MINDEN kuldes naplozva (meres_kuldes): a kerelem (titok nelkul, IP maszkolva), a platform valasza, a hozzajarulas, az allapot
//   - esemeny kuldese ELOTT elo allapot-ellenorzes (deps.eloEllenorzes): torolt foglalasra nem megy pozitiv konverzio; nem ellenorizheto -> halasztva
// Csak ARNYEKMODBAN fut (MERES_ELOSZTO=1 es a platformok.js vedelmei); elo pixelre / property-re / akciora nem kuldhet.
import { esemenyek, konzultacioTabla, SOURCE_ID_MINTA, UZLETAGAK } from './esemeny-modell.js';
import { hashEmail, hashTelefon, hashAzonosito } from './hash.js';
import { erkezesTisztit } from './erkezes.js';
import { hozzajarulasTisztit, platformSzabaly } from './hozzajarulas.js';
import { KEREM_EPITO, kuldes, PLATFORMOK } from './platformok.js';

const SEMA = [
  'CREATE TABLE IF NOT EXISTS meres_erkezes (source_id TEXT PRIMARY KEY, uzletag TEXT NOT NULL, tipus TEXT NOT NULL, attr TEXT NOT NULL, hozz TEXT NOT NULL, ua TEXT, ip TEXT, oldal TEXT, bongeszo TEXT, ido INTEGER NOT NULL, frissitve INTEGER NOT NULL) WITHOUT ROWID',
  'CREATE TABLE IF NOT EXISTS meres_kapcsolo (kulcs TEXT PRIMARY KEY, be INTEGER NOT NULL, ok TEXT, ido INTEGER NOT NULL) WITHOUT ROWID',
  'CREATE TABLE IF NOT EXISTS meres_kuldes (id INTEGER PRIMARY KEY AUTOINCREMENT, esemeny_id TEXT NOT NULL, esemeny_nev TEXT NOT NULL, esemeny_tipus TEXT NOT NULL, platform TEXT NOT NULL, platform_nev TEXT, uzletag TEXT NOT NULL, source_id TEXT NOT NULL, allapot TEXT NOT NULL, indok TEXT, ertek INTEGER, penznem TEXT, hozzajarulas TEXT, kerelem TEXT, http_status INTEGER, platform_valasz TEXT, kuldo TEXT, probalkozas INTEGER NOT NULL DEFAULT 0, letrehozva INTEGER NOT NULL, frissitve INTEGER NOT NULL)',
  'CREATE UNIQUE INDEX IF NOT EXISTS meres_kuldes_egyedi ON meres_kuldes (esemeny_id, platform)',
  'CREATE INDEX IF NOT EXISTS meres_kuldes_source ON meres_kuldes (source_id)',
];
const kesz = new WeakSet();
export async function meresSema(db) { if (kesz.has(db)) return; await db.batch(SEMA.map((s) => db.prepare(s))); kesz.add(db); }
const sec = (now) => Math.floor(now / 1000);
// Ujraprobalhato sor: hiba, tiltas (a beallitas kozben valtozhat), halasztas, a veszkapcsolo miatt kihagyott; a modell szerint kihagyott / lemondott / elkuldott sor VEGLEGES.
const ujraprobalhato = (sor, t) => ['hiba', 'tiltva', 'halasztva', 'nyitott'].includes(sor.allapot) || (sor.allapot === 'kihagyva' && /^veszkapcsolo/.test(sor.indok || '')) || (sor.allapot === 'folyamatban' && t - sor.frissitve > ELAKADAS_MP);
const MAX_PROBA = 3;
const ELAKADAS_MP = 120;
const MEGORZES_NAP = 30; // az erkezesi sor (IP, user agent) 30 nap utan torlodik
export const maszkIp = (ip) => { const s = String(ip || ''); if (/^\d+\.\d+\.\d+\.\d+$/.test(s)) return s.replace(/\d+$/, 'xxx'); return s.includes(':') ? s.split(':').slice(0, 3).join(':') + ':xxxx' : null; };

/** A bongeszo erkezesi adatainak mentese (POST /api/meres-erkezes). Egy source_id-hoz egy sor; ujra-kuldes frissit, DE kiment esemeny utan mar nem. */
export async function erkezesMent(db, be, now = Date.now()) {
  await meresSema(db);
  if (!SOURCE_ID_MINTA.test(String(be.source_id || ''))) return { ok: false, miert: 'ervenytelen source_id' };
  if (!UZLETAGAK.includes(be.uzletag)) return { ok: false, miert: 'ervenytelen uzletag' };
  const tipus = be.tipus === 'ajandekkartya' ? 'ajandekkartya' : 'foglalas';
  const { adat, hibak } = erkezesTisztit(be.attr, now);
  const hozz = hozzajarulasTisztit(be.hozz);
  const t = sec(now);
  await db.prepare('DELETE FROM meres_erkezes WHERE ido < ?1').bind(t - MEGORZES_NAP * 86400).run();
  const kiment = await db.prepare("SELECT COUNT(*) AS n FROM meres_kuldes WHERE source_id = ?1 AND allapot IN ('elkuldve','nincs_hitelesites')").bind(be.source_id).first();
  const bongeszo = { oldal: String(be.oldal || '').slice(0, 300), first_booking: be.first_booking ?? null, szolgaltatas: String(be.szolgaltatas || '').slice(0, 200), kategoria: String(be.kategoria || '').slice(0, 120), ar: Number.isFinite(Number(be.ar)) ? Number(be.ar) : null, g: String(be.g || '').slice(0, 40), munkatars: String(be.munkatars || '').slice(0, 120), bookingUrl: String(be.bookingUrl || '').slice(0, 400) };
  if (kiment && kiment.n > 0) return { ok: true, frissitve: false, miert: 'az esemeny mar kiment', hibak };
  await db.prepare('INSERT INTO meres_erkezes (source_id, uzletag, tipus, attr, hozz, ua, ip, oldal, bongeszo, ido, frissitve) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10) ON CONFLICT(source_id) DO UPDATE SET attr = excluded.attr, hozz = excluded.hozz, ua = excluded.ua, ip = excluded.ip, oldal = excluded.oldal, bongeszo = excluded.bongeszo, frissitve = excluded.frissitve')
    .bind(be.source_id, be.uzletag, tipus, JSON.stringify(adat), JSON.stringify(hozz), String(be.ua || '').slice(0, 300) || null, String(be.ip || '').slice(0, 64) || null, bongeszo.oldal || null, JSON.stringify(bongeszo), t).run();
  return { ok: true, frissitve: true, hibak, mezok: Object.keys(adat) };
}
export async function erkezesOlvas(db, sourceId) {
  await meresSema(db);
  const r = await db.prepare('SELECT * FROM meres_erkezes WHERE source_id = ?1').bind(sourceId).first();
  if (!r) return null;
  return { ...r, attr: JSON.parse(r.attr), hozz: JSON.parse(r.hozz), bongeszo: r.bongeszo ? JSON.parse(r.bongeszo) : {} };
}

// --- veszkapcsolo ----------------------------------------------------------------------------------------------------------------------------
export async function kapcsoloBeallit(db, { uzletag = null, platform = null, be, ok = null }, now = Date.now()) {
  await meresSema(db);
  const kulcs = uzletag && platform ? `cella:${uzletag}:${platform}` : uzletag ? `uzletag:${uzletag}` : platform ? `platform:${platform}` : 'mind';
  if (uzletag && !UZLETAGAK.includes(uzletag)) return { ok: false, miert: 'ismeretlen uzletag' };
  if (platform && !PLATFORMOK.includes(platform)) return { ok: false, miert: 'ismeretlen platform' };
  await db.prepare('INSERT INTO meres_kapcsolo (kulcs, be, ok, ido) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(kulcs) DO UPDATE SET be = excluded.be, ok = excluded.ok, ido = excluded.ido').bind(kulcs, be ? 1 : 0, ok, sec(now)).run();
  return { ok: true, kulcs, be: !!be };
}
export async function kapcsolokOlvas(db) { await meresSema(db); const { results } = await db.prepare('SELECT kulcs, be, ok, ido FROM meres_kapcsolo ORDER BY kulcs').all(); return results || []; }
/** Kikapcsolt-e (uzletag, platform)? -> a kikapcsolo kulcs vagy null. Alapbol minden be van. */
export function kikapcsolva(kapcsolok, uzletag, platform) {
  const ki = new Set((kapcsolok || []).filter((k) => k.be === 0).map((k) => k.kulcs));
  return ['mind', `uzletag:${uzletag}`, `platform:${platform}`, `cella:${uzletag}:${platform}`].find((k) => ki.has(k)) || null;
}

// --- naplo / kulso szallito visszaigazolasa ------------------------------------------------------------------------------------------------------
export async function naploLeker(db, sourceId) {
  await meresSema(db);
  const { results } = await db.prepare('SELECT * FROM meres_kuldes WHERE source_id = ?1 ORDER BY id').bind(sourceId).all();
  const erk = await erkezesOlvas(db, sourceId);
  if (erk) erk.ip = maszkIp(erk.ip);
  return { source_id: sourceId, erkezes: erk, kuldesek: (results || []).map((r) => ({ ...r, kerelem: r.kerelem ? JSON.parse(r.kerelem) : null, hozzajarulas: r.hozzajarulas ? JSON.parse(r.hozzajarulas) : null })) };
}
/** Kulso szallito (pl. a QA-futtato a Composion at) visszaigazolasa egy "nincs_hitelesites" / "hiba" sorra: a platform valaszaval. */
export async function kuldesMegerosit(db, { id, allapot, http_status, valasz, kuldo }, now = Date.now()) {
  await meresSema(db);
  if (!['elkuldve', 'hiba'].includes(allapot)) return { ok: false, miert: 'allapot: elkuldve | hiba' };
  const r = await db.prepare("UPDATE meres_kuldes SET allapot = ?2, http_status = ?3, platform_valasz = ?4, kuldo = ?5, frissitve = ?6, probalkozas = probalkozas + 1 WHERE id = ?1 AND allapot IN ('nincs_hitelesites','hiba')").bind(id, allapot, http_status ?? null, String(valasz ?? '').slice(0, 2000), String(kuldo || 'kulso').slice(0, 60), sec(now)).run();
  return { ok: !!(r.meta && r.meta.changes > 0) };
}
export async function fuggoKuldesek(db) {
  await meresSema(db);
  const { results } = await db.prepare("SELECT id, esemeny_id, platform, platform_nev, source_id, kerelem FROM meres_kuldes WHERE allapot = 'nincs_hitelesites' ORDER BY id").all();
  return (results || []).map((r) => ({ ...r, kerelem: JSON.parse(r.kerelem) }));
}

// --- elosztas ----------------------------------------------------------------------------------------------------------------------------------------
/**
 * fk: { tipus, uzletag, source_entity_id, jelleg, kupon, ertek, ido (unix mp), szolgaltatas, vendeg: { email, telefon, g }, oldal }
 * deps: { env, fetchImpl, now, kuldo, eloEllenorzes: async () => 'aktiv' | 'torolve' | 'ismeretlen' }
 */
export async function elosztas(db, fk, deps = {}) {
  const env = deps.env || {};
  const now = deps.now ? deps.now() : Date.now();
  if (String(env.MERES_ELOSZTO) !== '1') return { allapot: 'ki', miert: 'MERES_ELOSZTO nincs bekapcsolva' };
  await meresSema(db);
  const t = sec(now);
  const lista = esemenyek(fk, konzultacioTabla(env));
  if (!lista.length) return { allapot: 'nincs_esemeny', miert: 'a forras-entitasbol nem kepezheto esemeny' };
  const erkRow = await erkezesOlvas(db, fk.source_entity_id);
  const erk = erkRow ? erkRow.attr : {};
  const hozz = hozzajarulasTisztit(erkRow ? erkRow.hozz : null);
  const kapcsolok = await kapcsolokOlvas(db);
  const ctxAlap = { fk: { ...fk, ido: fk.ido || (erkRow ? erkRow.ido : t) }, erk, ua: erkRow ? erkRow.ua : null, ip: erkRow ? erkRow.ip : null, oldal: fk.oldal || (erkRow ? erkRow.oldal : null), hozz: { meta: platformSzabaly('meta', hozz), tiktok: platformSzabaly('tiktok', hozz), google: platformSzabaly('google', hozz), ga4: platformSzabaly('ga4', hozz) } };
  const v = fk.vendeg || {};
  ctxAlap.hash = { em: await hashEmail(v.email), ph_meta: await hashTelefon(v.telefon), ph_e164: await hashTelefon(v.telefon, { plusz: true }), ext: await hashAzonosito(v.g || v.email) };
  const osszefoglalo = { allapot: 'kesz', source_id: fk.source_entity_id, erkezesi_adat: !!erkRow, esemenyek: [] };

  // minden (esemeny, platform) cella mar VEGLEGES (elkuldve / modell szerint kihagyva / lemondva): nincs teendo, elo lekeres sem kell (az ismetelt hivas olcso es nem kuld)
  const { results: meglevok } = await db.prepare('SELECT esemeny_id, platform, allapot, indok, frissitve FROM meres_kuldes WHERE source_id = ?1').bind(fk.source_entity_id).all();
  const teendo = lista.some((e) => PLATFORMOK.some((p) => { const m = (meglevok || []).find((x) => x.esemeny_id === e.esemeny_id && x.platform === p); if (e.nyitott && m && m.allapot === 'nyitott') return false; /* tovabbra is nyitott: nincs teendo */ return !m || ujraprobalhato(m, t); }));
  if (!teendo) return { ...osszefoglalo, allapot: 'mar_kuldve', miert: 'minden esemeny / platform cella mar vegleges allapotu' };

  // esemeny kuldese ELOTT elo allapot-ellenorzes (a levelek sorrendjetol fuggetlen: mindig az aktualis allapot)
  let elo = 'nincs_ellenorzes';
  if (deps.eloEllenorzes) {
    try { elo = await deps.eloEllenorzes(); } catch (e) { elo = 'ismeretlen'; }
    osszefoglalo.elo_allapot = elo;
    if (elo === 'ismeretlen') { osszefoglalo.allapot = 'halasztva'; osszefoglalo.miert = 'a foglalas elo allapota nem ellenorizheto az esemeny kuldese elott'; osszefoglalo.ujraprobal_mp = 180; }
  }
  const naploz = async (e, platform, mezok) => {
    const sor = { esemeny_id: e.esemeny_id, esemeny_nev: e.nev, esemeny_tipus: e.tipus, platform, platform_nev: null, uzletag: fk.uzletag, source_id: fk.source_entity_id, ertek: e.ertek, penznem: e.penznem, hozzajarulas: JSON.stringify({ allapot: hozz, szabaly: ctxAlap.hozz[platform] }), allapot: 'tiltva', indok: null, kerelem: null, http_status: null, platform_valasz: null, kuldo: null, ...mezok };
    const meglevo = await db.prepare('SELECT id, allapot, probalkozas, frissitve FROM meres_kuldes WHERE esemeny_id = ?1 AND platform = ?2').bind(e.esemeny_id, platform).first();
    if (meglevo && !ujraprobalhato(meglevo, t)) return { id: meglevo.id, allapot: meglevo.allapot, duplikalt: true }; // egy megszakadt hivas sora (folyamatban) ELAKADAS_MP utan ujraprobalhato
    if (meglevo && meglevo.probalkozas >= MAX_PROBA && meglevo.allapot === 'hiba') return { id: meglevo.id, allapot: 'hiba', duplikalt: true, indok: 'tul sok sikertelen probalkozas' };
    if (meglevo) { await db.prepare('UPDATE meres_kuldes SET allapot = ?2, indok = ?3, platform_nev = ?4, kerelem = ?5, http_status = ?6, platform_valasz = ?7, kuldo = ?8, hozzajarulas = ?9, ertek = ?10, probalkozas = probalkozas + 1, frissitve = ?11 WHERE id = ?1').bind(meglevo.id, sor.allapot, sor.indok, sor.platform_nev, sor.kerelem, sor.http_status, sor.platform_valasz, sor.kuldo, sor.hozzajarulas, sor.ertek, t).run(); return { id: meglevo.id, allapot: sor.allapot }; }
    const r = await db.prepare('INSERT INTO meres_kuldes (esemeny_id, esemeny_nev, esemeny_tipus, platform, platform_nev, uzletag, source_id, allapot, indok, ertek, penznem, hozzajarulas, kerelem, http_status, platform_valasz, kuldo, probalkozas, letrehozva, frissitve) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,1,?17,?17) ON CONFLICT(esemeny_id, platform) DO NOTHING')
      .bind(sor.esemeny_id, sor.esemeny_nev, sor.esemeny_tipus, sor.platform, sor.platform_nev, sor.uzletag, sor.source_id, sor.allapot, sor.indok, sor.ertek, sor.penznem, sor.hozzajarulas, sor.kerelem, sor.http_status, sor.platform_valasz, sor.kuldo, t).run();
    if (!(r.meta && r.meta.changes > 0)) return { allapot: 'folyamatban', duplikalt: true }; // egy masik hivas mar beszurta
    const uj = await db.prepare('SELECT id FROM meres_kuldes WHERE esemeny_id = ?1 AND platform = ?2').bind(e.esemeny_id, platform).first();
    return { id: uj.id, allapot: sor.allapot };
  };
  const ir = (id, mezok) => db.prepare('UPDATE meres_kuldes SET allapot = ?2, indok = ?3, platform_nev = ?4, kerelem = ?5, http_status = ?6, platform_valasz = ?7, kuldo = ?8, frissitve = ?9 WHERE id = ?1').bind(id, mezok.allapot, mezok.indok ?? null, mezok.platform_nev ?? null, mezok.kerelem ?? null, mezok.http_status ?? null, mezok.platform_valasz ?? null, mezok.kuldo ?? null, t).run();

  for (const e of lista) {
    const sor = { esemeny_id: e.esemeny_id, nev: e.nev, tipus: e.tipus, ertek: e.ertek, ertek_forras: e.ertek_forras, salonic_ar: e.salonic_ar, nyitott: e.nyitott, platformok: {} };
    for (const platform of PLATFORMOK) {
      let mezok;
      if (kikapcsolva(kapcsolok, fk.uzletag, platform)) mezok = { allapot: 'kihagyva', indok: 'veszkapcsolo: ' + kikapcsolva(kapcsolok, fk.uzletag, platform) };
      else if (elo === 'torolve') mezok = { allapot: 'kihagyva', indok: 'a foglalas az esemeny elkuldese elott lemondva (elo allapot-ellenorzes)' };
      else if (elo === 'ismeretlen') mezok = { allapot: 'halasztva', indok: 'a foglalas elo allapota nem ellenorizheto: az esemeny nem megy ki, amig nem tudjuk, hogy a foglalas el' };
      else {
        const kerelem = KEREM_EPITO[platform](e, ctxAlap, env);
        if (kerelem.kihagyva) mezok = { allapot: 'kihagyva', indok: kerelem.kihagyva };
        else if (e.nyitott) mezok = { allapot: 'nyitott', indok: e.nyitott_ok };
        else if (kerelem.tiltva) mezok = { allapot: 'tiltva', indok: kerelem.tiltva };
        else {
          const naplo = { platform_nev: kerelem.platform_nev, kerelem: JSON.stringify({ url: kerelem.url, method: kerelem.method, fejlec_nevek: kerelem.fejlec_nevek, cel: kerelem.cel, body: env.MERES_NAPLO_TELJES === '1' ? kerelem.body : maszkolt(kerelem.body) }) }; // MERES_NAPLO_TELJES=1 (CSAK elonezet, sajat teszt-IP): a TELJES kikuldott payload a naploban; egyebkent a nyers IP maszkolt
          const foglal = await naploz(e, platform, { allapot: 'folyamatban', ...naplo });
          if (foglal.duplikalt) { sor.platformok[platform] = { allapot: foglal.allapot, duplikalt: true }; continue; }
          const eredmeny = await (deps.kuldo || kuldes)(kerelem, env, deps.fetchImpl || fetch);
          await ir(foglal.id, { ...naplo, allapot: eredmeny.allapot, http_status: eredmeny.http_status, platform_valasz: eredmeny.valasz, kuldo: eredmeny.kuldo, indok: eredmeny.allapot === 'nincs_hitelesites' ? 'a kerelem kesz, a kuldeshez hitelesites kell (kulso szallito)' : null });
          sor.platformok[platform] = { id: foglal.id, allapot: eredmeny.allapot, http_status: eredmeny.http_status };
          continue;
        }
      }
      const r = await naploz(e, platform, mezok);
      sor.platformok[platform] = { id: r.id, allapot: r.duplikalt ? r.allapot : mezok.allapot, indok: mezok.indok, ...(r.duplikalt ? { duplikalt: true } : {}) };
    }
    osszefoglalo.esemenyek.push(sor);
  }
  return osszefoglalo;
}
function maszkolt(body) { // a naplozott kerelemben a nyers IP maszkolt (a kuldott kerelemben valodi)
  const s = JSON.stringify(body, (k, v) => (k === 'client_ip_address' || k === 'ip' ? maszkIp(v) : v));
  return JSON.parse(s);
}
