// DECISION #240 (Feri 10-27: „Igen, hogyha javítja a mérést, és nincs újratanulás, rákötjük, mehet.”): a HeadSpa Meta szerveres foglalási esemény az ÉLŐ pixelre (dataset 3473839859576758).
//   UGYANAZ az eseménynév (Schedule) és ugyanaz a pixel, amire a futó csoportok optimalizálnak; KÖZÖS event_id a böngészős példánnyal (tag 213 kulcsa: a 10/10 egyezés igazolt) → a Meta egy eseménynek veszi, a csoportok célja nem változik.
//   ÚJ eseménynév / új custom conversion TILOS (újratanulást okozna): ez a modul semmi mást nem küld, csak a HeadSpa `Schedule`-t. ALAPBÓL KI: META_ELO_BE=headspa ÉS a META_ELO_TOKEN titok (≥ 16 karakter) együtt kapcsolja be. Rollback = a kapcsoló.
// Nem az ÁRNYÉK-lánc: külön fájl, külön tábla (meres_meta_elo); a vedett platformok.js / elosztas.js / esemeny-modell.js / meta-bongeszo-kulcs.js valtozatlan (csak importaljuk). A qa-nap „nem ÁRNYÉK cél = 0” ellenőrzése érintetlen.
// Csak HeadSpa FOGLALÁS új vendégnél (az ARNYEK-lánc ernyőeseményének feltétele: visszajáró és kupon soha; az ajándékkártya nem: annak nincs böngészős Schedule-párja). Páros event_id nélkül (a böngészős kulcs nem képezhető) NEM küldünk:
// a böngészőben véletlen kulcs van, a szerver külön ID-val duplán számolna. Adat: hash-elt e-mail / telefon / név / external_id + fbc, fbp, IP, user agent (DECISION #202); explicit marketing-elutasításnál (adv === false) semmi; érték / szolgáltatásnév nem megy.
import { esemenyek, konzultacioTabla } from './esemeny-modell.js';
import { ARNYEK, ELO_CELOK } from './platformok.js';
import { erkezesOlvas } from './elosztas.js';
import { felhasznaloHash } from './felhasznalo-hash.js';
import { hozzajarulasTisztit } from './hozzajarulas.js';
import { bongeszoMetaKulcs } from './meta-bongeszo-kulcs.js';
import { metaFbc } from './erkezes.js';

export const ELO_DATASET = ELO_CELOK.meta[0]; // 3473839859576758 (HeadSpa pixel)
export const ELO_META_ESEMENY = 'Schedule';
export const ELO_META_UZLETAGOK = Object.freeze(['headspa']);
const MAX_PROBA = 3, ELAKADAS_MP = 120;
const titokOk = (v) => typeof v === 'string' && v.length >= 16;
export const metaEloUzletagok = (env) => (env && titokOk(env.META_ELO_TOKEN) ? String(env.META_ELO_BE || '').split(',').map((s) => s.trim()).filter((u) => ELO_META_UZLETAGOK.includes(u)) : []);
export const metaEloBe = (env, uzletag) => metaEloUzletagok(env).includes(uzletag);

const tisztit = (o) => { const k = {}; for (const [a, b] of Object.entries(o)) if (b !== null && b !== undefined && b !== '' && !(Array.isArray(b) && !b.length)) k[a] = b; return k; };
/** A Conversions API kerelem (tiszta fuggveny). ctx: { event_id, ido, hash, erk (attr), ip, ua, oldal, teszt, apiVerzio } */
export function metaEloKerelem(ctx) {
  const ud = tisztit({
    em: ctx.hash && ctx.hash.em ? [ctx.hash.em] : null, ph: ctx.hash && ctx.hash.ph_meta ? [ctx.hash.ph_meta] : null, fn: ctx.hash && ctx.hash.fn ? [ctx.hash.fn] : null, ln: ctx.hash && ctx.hash.ln ? [ctx.hash.ln] : null,
    country: ctx.hash && ctx.hash.country ? [ctx.hash.country] : null, external_id: ctx.hash && ctx.hash.ext ? [ctx.hash.ext] : null,
    client_ip_address: ctx.ip, client_user_agent: ctx.ua, fbc: ctx.erk ? metaFbc(ctx.erk, ctx.ido * 1000) : null, fbp: ctx.erk ? ctx.erk.fbp : null,
  });
  const adat = tisztit({ event_name: ELO_META_ESEMENY, event_time: ctx.ido, event_id: ctx.event_id, action_source: 'website', event_source_url: ctx.oldal, user_data: ud });
  return { url: `https://graph.facebook.com/${ctx.apiVerzio || ARNYEK.meta.apiVerzio}/${ELO_DATASET}/events`, method: 'POST', body: { data: [adat], ...(ctx.teszt ? { test_event_code: String(ctx.teszt).slice(0, 40) } : {}), partner_agent: 'mosaic-elo-schedule' } };
}

const SEMA = [
  'CREATE TABLE IF NOT EXISTS meres_meta_elo (esemeny_id TEXT PRIMARY KEY, uzletag TEXT NOT NULL, source_id TEXT NOT NULL, event_id TEXT NOT NULL, allapot TEXT NOT NULL, indok TEXT, http_status INTEGER, valasz TEXT, probalkozas INTEGER NOT NULL DEFAULT 0, salonic_uuid TEXT, letrehozva INTEGER NOT NULL, frissitve INTEGER NOT NULL) WITHOUT ROWID',
  'CREATE INDEX IF NOT EXISTS meres_meta_elo_source ON meres_meta_elo (source_id)',
];
const kesz = new WeakSet();
async function sema(db) {
  if (kesz.has(db)) return;
  await db.batch(SEMA.map((s) => db.prepare(s)));
  await db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS meres_meta_elo_uuid ON meres_meta_elo (salonic_uuid) WHERE salonic_uuid IS NOT NULL').run();
  kesz.add(db);
}
const ujraProbalhato = (s, t) => (s.allapot === 'hiba' && s.probalkozas < MAX_PROBA) || (s.allapot === 'folyamatban' && t - s.frissitve > ELAKADAS_MP) || s.allapot === 'halasztva';
const szuk = (x, n = 300) => String(x == null ? '' : x).replace(/[A-Za-z0-9+/_-]{40,}/g, '[x]').slice(0, n);

/** Az elosztas() UTAN hivva (mint a tiktokEloKuld). fk: ugyanaz; deps: { env, fetchImpl, now, eloEllenorzes }. Hiba SOHA nem dobodik. */
export async function metaEloKuld(db, fk, deps = {}) {
  try {
    const env = deps.env || {};
    if (!fk || fk.tipus !== 'foglalas' || !metaEloBe(env, fk.uzletag)) return { allapot: 'ki' };
    if (fk.fixAllapot) return { allapot: 'kihagyva', indok: 'reschedule: nincs uj konverzio' };
    const e = esemenyek({ ...fk, ertek: Number.isFinite(Number(fk.ertek)) ? fk.ertek : 0 }, konzultacioTabla(env)).find((x) => x.tipus === 'ernyo');
    if (!e) return { allapot: 'nincs_ernyo' };
    await sema(db);
    const now = deps.now ? deps.now() : Date.now(); const t = Math.floor(now / 1000);
    const meglevo = await db.prepare('SELECT esemeny_id, allapot, probalkozas, frissitve FROM meres_meta_elo WHERE esemeny_id = ?1').bind(e.esemeny_id).first();
    if (meglevo && !ujraProbalhato(meglevo, t)) return { allapot: 'mar_kuldve', elozo: meglevo.allapot };
    const erk = await erkezesOlvas(db, fk.source_entity_id);
    const eventId = erk ? bongeszoMetaKulcs(erk.bongeszo) : null;
    if (!eventId) return { allapot: 'kihagyva', indok: 'nincs kozos (bongeszos) event_id: a szerveres peldany duplan szamolna' };
    if (hozzajarulasTisztit(erk.hozz).adv === false) return { allapot: 'kihagyva', indok: 'explicit marketing-elutasitas' };
    if (deps.eloEllenorzes) {
      let elo; try { elo = await deps.eloEllenorzes(); } catch (err) { elo = 'ismeretlen'; }
      if (elo === 'torolve') return { allapot: 'kihagyva', indok: 'a foglalas lemondva (elo allapot-ellenorzes)' };
      if (elo !== 'aktiv') return { allapot: 'halasztva', indok: 'a foglalas elo allapota nem ellenorizheto', ujraprobal_mp: 180 };
    }
    const hash = await felhasznaloHash(env, fk.vendeg || {});
    const kerelem = metaEloKerelem({ event_id: eventId, ido: fk.ido || erk.ido || t, hash, erk: erk.attr || {}, ip: erk.ip, ua: erk.ua, oldal: fk.oldal || erk.oldal, teszt: env.META_ELO_TESZT_KOD || null, apiVerzio: env.META_API_VERSION });
    const uuid = fk.uuid ? String(fk.uuid).toLowerCase() : null;
    if (!meglevo) {
      const r = await db.prepare("INSERT INTO meres_meta_elo (esemeny_id, uzletag, source_id, event_id, allapot, probalkozas, salonic_uuid, letrehozva, frissitve) VALUES (?1, ?2, ?3, ?4, 'folyamatban', 1, ?5, ?6, ?6) ON CONFLICT DO NOTHING").bind(e.esemeny_id, fk.uzletag, fk.source_entity_id, eventId, uuid, t).run();
      if (!(r.meta && r.meta.changes > 0)) return { allapot: 'mar_kuldve', elozo: 'parhuzamos' };
    } else {
      const r = await db.prepare("UPDATE meres_meta_elo SET allapot = 'folyamatban', probalkozas = probalkozas + 1, event_id = ?2, frissitve = ?3 WHERE esemeny_id = ?1 AND probalkozas = ?4").bind(e.esemeny_id, eventId, t, meglevo.probalkozas).run();
      if (!(r.meta && r.meta.changes > 0)) return { allapot: 'mar_kuldve', elozo: 'parhuzamos' };
    }
    let allapot = 'hiba', http = null, valasz = null;
    try {
      const f = deps.fetchImpl || fetch;
      const r = await f(`${kerelem.url}?access_token=${encodeURIComponent(env.META_ELO_TOKEN)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(kerelem.body) });
      http = r.status; let j = null; try { j = await r.json(); } catch (err) { j = null; }
      valasz = szuk(j ? JSON.stringify(j.error ? { error: { code: j.error.code, type: j.error.type } } : { events_received: j.events_received }) : '');
      allapot = r.status >= 200 && r.status < 300 && j && j.events_received >= 1 ? 'elkuldve' : 'hiba';
    } catch (err) { valasz = szuk(err && err.message); }
    await db.prepare('UPDATE meres_meta_elo SET allapot = ?2, http_status = ?3, valasz = ?4, frissitve = ?5 WHERE esemeny_id = ?1').bind(e.esemeny_id, allapot, http, valasz, Math.floor((deps.now ? deps.now() : Date.now()) / 1000)).run();
    return { allapot, esemeny: ELO_META_ESEMENY, http_status: http, teszt: !!kerelem.body.test_event_code };
  } catch (err) {
    return { allapot: 'hiba', indok: szuk(err && err.message, 120) };
  }
}
