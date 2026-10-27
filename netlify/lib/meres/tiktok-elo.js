// UJ-67 / 69 / 71 / 73 (TikTok-csalad): az ELO Mosaic TikTok-pixelre (CTDGK5BC77U0PIODKP30) a foglalas KODBOL megy, URL-szabaly helyett, csere nelkul: ugyanaz a pixel, ugyanaz az esemeny, kozos event_id a bongeszos peldannyal.
//   headspa -> Schedule (UJ-67, DECISION #232) | szor -> CompleteRegistration (UJ-69) | oxigen -> SubmitForm (UJ-71, DECISION #234) | fodrasz -> Contact, pmu -> Consult (UJ-73, javaslat: Feri jovahagyta 10-25)
//   Esemeny-feltetel = az ARNYEK-lanc ernyoeseme (esemeny-modell.js esemenyek()): HeadSpa uj vendeg foglalasa + ajandekkartya; szor / oxigen / fodrasz / PMU elso foglalas + konzultacio; visszajaro es kupon SOHA.
// EZ NEM AZ ARNYEK-LANC: kulon fajl, kulon tabla (meres_tiktok_elo), a vedett platformok.js / elosztas.js / esemeny-modell.js valtozatlan (csak importaljuk). Az ARNYEK-lanc tiltolistaja (ELO_CELOK) erintetlen: a qa-nap tovabbra is
//   azt ellenorzi, hogy az ARNYEK-sorok (meres_kuldes) egyike sem megy elo celra; az elo kuldesek a sajat tablajukban latszanak.
// ALAPBOL KI: uzletagonkent a TIKTOK_ELO_BE (pl. "headspa,szor") ES a TIKTOK_ELO_TOKEN titok (az elo pixel Events API tokenje; legalabb 16 karakter) egyutt kapcsolja BE egyszerre a szerveres kuldest ES a bongeszos esemenyt
//   (a koszonooldali valasz csak bekapcsolt uzletagnal ad "tiktok_elo" jelzest a kliensnek) -> "egy lepes", atfedes nelkul; a mereso oldal a TikTok Events Managerben az URL-szabalyt ugyanebben a lepesben kapcsolja ki. Rollback: a kapcsolo torlese.
// Adatminimalizalas: a szolgaltatas neve / ara nem megy; user: hash-elt e-mail / telefon / external_id + ttclid, ttp, IP, user agent (mint az ARNYEK-lancban, DECISION #202); explicit marketing-elutasitasnal (adv === false) NEM megy semmi.
import { esemenyek, konzultacioTabla, foglalasJelleg, UZLETAGAK } from './esemeny-modell.js';
import { ELO_CELOK } from './platformok.js';
import { erkezesOlvas } from './elosztas.js';
import { felhasznaloHash } from './felhasznalo-hash.js';
import { hozzajarulasTisztit } from './hozzajarulas.js';
import { bongeszoMetaKulcs } from './meta-bongeszo-kulcs.js';
import { jellegSzabaly } from './jelleg-oldal.js';

export const ELO_PIXEL = ELO_CELOK.tiktok[0];
export const ELO_ESEMENY = Object.freeze({ headspa: 'Schedule', szor: 'CompleteRegistration', oxigen: 'SubmitForm', fodrasz: 'Contact', pmu: 'Consult' });
const URL_ESEMENY = 'https://business-api.tiktok.com/open_api/v1.3/event/track/';
const MAX_PROBA = 3, ELAKADAS_MP = 120;

const titokOk = (v) => typeof v === 'string' && v.length >= 16;
/** Az uzletagak, amelyekre a kodos elo kuldes BE van kapcsolva (TIKTOK_ELO_BE: vesszovel elvalasztott uzletag-lista). A token nelkuli kapcsolo nem kapcsol be semmit (fail-closed). */
export function tiktokEloUzletagok(env) {
  if (!env || !titokOk(env.TIKTOK_ELO_TOKEN)) return [];
  return String(env.TIKTOK_ELO_BE || '').split(',').map((s) => s.trim()).filter((u) => UZLETAGAK.includes(u));
}
export const tiktokEloBe = (env, uzletag) => tiktokEloUzletagok(env).includes(uzletag);

/** A bongeszos peldany event_id-ja (a Meta ARNYEK bongeszos kulcsa: koszonooldal-utvonal + g + serviceId + startDate); ha nem kepezheto: null. */
export const bongeszoEloEventId = (b) => bongeszoMetaKulcs(b);

const ernyoEsemeny = (fk, env) => esemenyek({ ...fk, ertek: Number.isFinite(Number(fk.ertek)) ? fk.ertek : 0 }, konzultacioTabla(env)).find((e) => e.tipus === 'ernyo') || null;

/**
 * A koszonooldali erkezes (POST /api/meres-erkezes torzse) alapjan: kell-e a BONGESZOBOL ttq esemeny? -> { esemeny, event_id, pixel } | null. Csak foglalas (az ajandekkartya bongeszos TikTok-esemenyet az ajandek.js kuldi),
 * csak bekapcsolt uzletag, csak ha nincs explicit marketing-elutasitas, csak ha az ernyo-feltetel teljesul (a szerveres Salonic-jelzes kesobb pontosit: ket forras eltereseket a riport mutatja), es csak kepezheto kozos event_id-val.
 */
export function eloBongeszoJelzes(env, be) {
  try {
    if (!be || be.tipus === 'ajandekkartya' || !tiktokEloBe(env, be.uzletag)) return null;
    if (hozzajarulasTisztit(be.hozz).adv === false) return null;
    const szolg = String(be.szolgaltatas || '');
    const kapott0 = foglalasJelleg({ szolgaltatasNev: szolg, ujVendeg: typeof be.first_booking === 'boolean' ? be.first_booking : null, kategoria: String(be.kategoria || '') });
    const kapott = jellegSzabaly({ uzletag: be.uzletag, oldal: be.oldal || '', szolgaltatasNev: szolg, kapott: kapott0, env });
    const id = bongeszoEloEventId({ oldal: be.oldal, g: be.g, bookingUrl: be.bookingUrl });
    if (!id) return null;
    const e = ernyoEsemeny({ tipus: 'foglalas', uzletag: be.uzletag, source_entity_id: String(be.source_id || ''), jelleg: kapott.jelleg, kupon: kapott.kupon }, env);
    return e ? { esemeny: ELO_ESEMENY[be.uzletag], event_id: id, pixel: ELO_PIXEL } : null;
  } catch (err) { return null; }
}

const tisztit = (o) => { const k = {}; for (const [a, b] of Object.entries(o)) if (b !== null && b !== undefined && b !== '') k[a] = b; return k; };
/** Az Events API kerelem (tiszta fuggveny). ctx: { esemeny_id, event_id, uzletag, ido, hash: { em, ph_e164, ext }, erk: { ttclid, ttp }, ip, ua, oldal } */
export function tiktokEloKerelem(ctx) {
  const nev = ELO_ESEMENY[ctx.uzletag];
  if (!nev) return { tiltva: 'ismeretlen uzletag' };
  const user = tisztit({ email: ctx.hash && ctx.hash.em, phone: ctx.hash && ctx.hash.ph_e164, external_id: ctx.hash && ctx.hash.ext, ttclid: ctx.erk && ctx.erk.ttclid, ttp: ctx.erk && ctx.erk.ttp, ip: ctx.ip, user_agent: ctx.ua });
  const adat = tisztit({ event: nev, event_time: ctx.ido, event_id: ctx.event_id, user, page: ctx.oldal ? { url: ctx.oldal } : null });
  // teszt (TIKTOK_ELO_TESZT_KOD): a TikTok Test Events fulre kuld, az esemeny nem szamit bele a konverziokba - az atallas elotti igazolashoz (3 valos minta); kod nelkul eles
  return { nev, url: URL_ESEMENY, method: 'POST', body: { event_source: 'web', event_source_id: ELO_PIXEL, ...(ctx.teszt ? { test_event_code: String(ctx.teszt).slice(0, 40) } : {}), data: [adat] } };
}

const SEMA = [
  'CREATE TABLE IF NOT EXISTS meres_tiktok_elo (esemeny_id TEXT PRIMARY KEY, uzletag TEXT NOT NULL, source_id TEXT NOT NULL, tiktok_nev TEXT NOT NULL, event_id TEXT NOT NULL, event_id_forras TEXT NOT NULL, allapot TEXT NOT NULL, indok TEXT, http_status INTEGER, valasz TEXT, probalkozas INTEGER NOT NULL DEFAULT 0, salonic_uuid TEXT, letrehozva INTEGER NOT NULL, frissitve INTEGER NOT NULL) WITHOUT ROWID',
  'CREATE INDEX IF NOT EXISTS meres_tiktok_elo_source ON meres_tiktok_elo (source_id)',
];
const kesz = new WeakSet();
async function sema(db) {
  if (kesz.has(db)) return;
  await db.batch(SEMA.map((s) => db.prepare(s)));
  await db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS meres_tiktok_elo_uuid ON meres_tiktok_elo (salonic_uuid, tiktok_nev) WHERE salonic_uuid IS NOT NULL').run(); // egy Salonic-foglalas (motor + sd) = egy elo esemeny
  kesz.add(db);
}
const ujraProbalhato = (s, t) => (s.allapot === 'hiba' && s.probalkozas < MAX_PROBA) || (s.allapot === 'folyamatban' && t - s.frissitve > ELAKADAS_MP) || s.allapot === 'halasztva';
const szuk = (x, n = 300) => String(x == null ? '' : x).replace(/[A-Za-z0-9+/_-]{40,}/g, '[x]').slice(0, n);

/**
 * Az elosztas() UTAN hivva (foglalas-esemeny.js, salonic-direct.js, ajandek-esemeny.js). fk = ugyanaz, mint az elosztasnal; deps: { env, fetchImpl, now, eloEllenorzes }.
 * -> { allapot: 'ki' | 'nincs_ernyo' | 'kihagyva' | 'halasztva' | 'mar_kuldve' | 'elkuldve' | 'hiba' | 'nincs_hitelesites', ... }. Hiba SOHA nem dobodik (a hivo try / catch nelkul is biztonsagos).
 */
export async function tiktokEloKuld(db, fk, deps = {}) {
  try {
    const env = deps.env || {};
    if (!tiktokEloBe(env, fk && fk.uzletag)) return { allapot: 'ki' };
    if (fk.fixAllapot) return { allapot: 'kihagyva', indok: 'reschedule: nincs uj konverzio' };
    const e = ernyoEsemeny(fk, env);
    if (!e) return { allapot: 'nincs_ernyo' };
    await sema(db);
    const now = deps.now ? deps.now() : Date.now(); const t = Math.floor(now / 1000);
    const meglevo = await db.prepare('SELECT esemeny_id, allapot, probalkozas, frissitve FROM meres_tiktok_elo WHERE esemeny_id = ?1').bind(e.esemeny_id).first();
    if (meglevo && !ujraProbalhato(meglevo, t)) return { allapot: 'mar_kuldve', elozo: meglevo.allapot };
    const erk = await erkezesOlvas(db, fk.source_entity_id); // lehet null (sd: nincs bongeszo)
    const hozz = hozzajarulasTisztit(erk ? erk.hozz : null);
    if (hozz.adv === false) return { allapot: 'kihagyva', indok: 'explicit marketing-elutasitas' };
    // elo allapot-ellenorzes (torolt / lemondott foglalasra nincs pozitiv konverzio); nem ellenorizheto -> halasztva
    if (deps.eloEllenorzes) {
      let elo; try { elo = await deps.eloEllenorzes(); } catch (err) { elo = 'ismeretlen'; }
      if (elo === 'torolve') return { allapot: 'kihagyva', indok: 'a foglalas lemondva (elo allapot-ellenorzes)' };
      if (elo !== 'aktiv') return { allapot: 'halasztva', indok: 'a foglalas elo allapota nem ellenorizheto', ujraprobal_mp: 180 };
    }
    const bongeszoId = erk ? bongeszoEloEventId(erk.bongeszo) : null;
    const eventId = bongeszoId || e.esemeny_id;
    const hash = await felhasznaloHash(env, fk.vendeg || {});
    const kerelem = tiktokEloKerelem({ esemeny_id: e.esemeny_id, event_id: eventId, uzletag: fk.uzletag, ido: fk.ido || (erk ? erk.ido : t), hash, erk: erk && erk.attr && erk.attr.tiktok ? { ttclid: erk.attr.tiktok.ttclid && erk.attr.tiktok.ttclid.ertek, ttp: erk.attr.ttp } : { ttp: erk && erk.attr ? erk.attr.ttp : null }, teszt: env.TIKTOK_ELO_TESZT_KOD || null, ip: erk ? erk.ip : null, ua: erk ? erk.ua : null, oldal: fk.oldal || (erk ? erk.oldal : null) });
    if (kerelem.tiltva) return { allapot: 'kihagyva', indok: kerelem.tiltva };
    const uuid = fk.uuid ? String(fk.uuid).toLowerCase() : null;
    // foglalas (compare-and-swap): INSERT OR IGNORE az elso hivasnak, UPDATE a megszakadt / hibas sor ujraprobalasahoz
    if (!meglevo) {
      const r = await db.prepare("INSERT INTO meres_tiktok_elo (esemeny_id, uzletag, source_id, tiktok_nev, event_id, event_id_forras, allapot, probalkozas, salonic_uuid, letrehozva, frissitve) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'folyamatban', 1, ?7, ?8, ?8) ON CONFLICT DO NOTHING")
        .bind(e.esemeny_id, fk.uzletag, fk.source_entity_id, kerelem.nev, eventId, bongeszoId ? 'bongeszo_kulcs' : 'esemeny_id', uuid, t).run();
      if (!(r.meta && r.meta.changes > 0)) return { allapot: 'mar_kuldve', elozo: 'parhuzamos' };
    } else {
      const r = await db.prepare("UPDATE meres_tiktok_elo SET allapot = 'folyamatban', probalkozas = probalkozas + 1, event_id = ?2, event_id_forras = ?3, frissitve = ?4 WHERE esemeny_id = ?1 AND probalkozas = ?5").bind(e.esemeny_id, eventId, bongeszoId ? 'bongeszo_kulcs' : 'esemeny_id', t, meglevo.probalkozas).run();
      if (!(r.meta && r.meta.changes > 0)) return { allapot: 'mar_kuldve', elozo: 'parhuzamos' };
    }
    let allapot = 'hiba', http = null, valasz = null;
    try {
      const f = deps.fetchImpl || fetch;
      const r = await f(kerelem.url, { method: 'POST', headers: { 'content-type': 'application/json', 'access-token': env.TIKTOK_ELO_TOKEN }, body: JSON.stringify(kerelem.body) });
      http = r.status; let j = null; try { j = await r.json(); } catch (err) { j = null; }
      valasz = szuk(j ? JSON.stringify({ code: j.code, message: j.message }) : '');
      allapot = r.status >= 200 && r.status < 300 && j && j.code === 0 ? 'elkuldve' : 'hiba';
    } catch (err) { valasz = szuk(err && err.message); }
    await db.prepare('UPDATE meres_tiktok_elo SET allapot = ?2, http_status = ?3, valasz = ?4, frissitve = ?5 WHERE esemeny_id = ?1').bind(e.esemeny_id, allapot, http, valasz, Math.floor((deps.now ? deps.now() : Date.now()) / 1000)).run();
    return { allapot, esemeny: kerelem.nev, event_id_forras: bongeszoId ? 'bongeszo_kulcs' : 'esemeny_id', http_status: http };
  } catch (err) {
    return { allapot: 'hiba', indok: szuk(err && err.message, 120) };
  }
}
