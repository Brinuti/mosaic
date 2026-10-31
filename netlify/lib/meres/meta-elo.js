// DECISION #240 (Feri 10-27: „Igen, hogyha javítja a mérést, és nincs újratanulás, rákötjük, mehet.”): a HeadSpa Meta szerveres foglalási esemény az ÉLŐ pixelre (dataset 3473839859576758).
//   UGYANAZ az eseménynév (Schedule) és ugyanaz a pixel, amire a futó csoportok optimalizálnak; KÖZÖS event_id a böngészős példánnyal (tag 213 kulcsa: a 10/10 egyezés igazolt) → a Meta egy eseménynek veszi, a csoportok célja nem változik.
//   ÚJ eseménynév / új custom conversion TILOS (újratanulást okozna): ez a modul semmi mást nem küld, csak a `Schedule`-t (HeadSpa: DECISION #240; Mosaic PMU: DECISION #244, a saját PMU pixelre). ALAPBÓL KI: META_ELO_BE=headspa és / vagy pmu ÉS a META_ELO_TOKEN titok (≥ 16 karakter) együtt kapcsolja be. Rollback = a kapcsoló.
// Nem az ÁRNYÉK-lánc: külön fájl, külön tábla (meres_meta_elo); a vedett platformok.js / elosztas.js / esemeny-modell.js / meta-bongeszo-kulcs.js valtozatlan (csak importaljuk). A qa-nap „nem ÁRNYÉK cél = 0” ellenőrzése érintetlen.
// Csak HeadSpa FOGLALÁS új vendégnél (az ARNYEK-lánc ernyőeseményének feltétele: visszajáró és kupon soha; az ajándékkártya nem: annak nincs böngészős Schedule-párja). Páros event_id nélkül (a böngészős kulcs nem képezhető) NEM küldünk (KIVÉVE PMU: Feri 2026-10-31 14:25 - ott a Salonic-foglalás uuid-ja az event_id, lásd lent; a PMU-n nincs eventID-s böngészős Schedule):
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
// PMU + Szor (Feri 2026-10-31): kizarolag szerveres Schedule (nincs eventID-s bongeszos Schedule); a koszonooldal (a pmu-ok / elysion-ok URL-szabaly oldala): sd_ agon nincs oldal, a CAPI website-esemenyhez event_source_url kell
const SZERVERES_OLDAL = Object.freeze({ pmu: 'https://www.mosaicheadspa.hu/pmu-ok', szor: 'https://www.mosaicheadspa.hu/elysion-ok' });
const szervesUzletag = (u) => Object.prototype.hasOwnProperty.call(SZERVERES_OLDAL, u);
// DECISION #244 (Feri 10-27 08:33, UJ-79): a Mosaic PMU is megkapja ugyanezt a szerveres Schedule-t a SAJAT elo pixelere (1019878750660854 = ELO_CELOK.meta[3]; ott van az `pmu-ok` URL-szabalyos Schedule is: Meta eseményszabály, "Manual Event Setup Tool", 2026-07-25). 1 hetig parhuzamosan az URL-szabaly mellett; kapu: szerveres Schedule >= Salonic valos online PMU-foglalas -> URL-szabaly KI (mereso oldal). Uj esemenynev / custom conversion nincs.
// DECISION (Feri 2026-10-31 16:51, #167 6545661338): a Szortelenites (Elysion-pixel 643342342027957 = ELO_CELOK.meta[2]) ugyanugy, mint a PMU. Az eles bekapcsolas (META_ELO_BE-be a 'szor') KULON lepes, a HeadSpa 24H visszameres (11-01 09:43) utan.
export const ELO_DATASETEK = Object.freeze({ headspa: ELO_CELOK.meta[0], pmu: ELO_CELOK.meta[3], szor: ELO_CELOK.meta[2] });
export const ELO_META_UZLETAGOK = Object.freeze(Object.keys(ELO_DATASETEK));
const MAX_PROBA = 3, ELAKADAS_MP = 120;
export const ELO_FETCH_TIMEOUT_MS = 4000; // DECISION #250 / 01-MERES 6462419230: a foglalasi valasz utjan van - a lassu platform nem tarthatja fel (megszakitas -> hiba, ujraprobalhato)
const titokOk = (v) => typeof v === 'string' && v.length >= 16;
export const metaEloUzletagok = (env) => (env && titokOk(env.META_ELO_TOKEN) ? String(env.META_ELO_BE || '').split(',').map((s) => s.trim()).filter((u) => ELO_META_UZLETAGOK.includes(u)) : []);
/** A Test Events kod DATASETENKENT kulonbozik (Meta): HeadSpa = META_ELO_TESZT_KOD, PMU = META_ELO_TESZT_KOD_PMU. Hianyzo kod -> null (a vedohalo ELO_CSAK_TESZT=1 mellett ekkor nem kuldunk). */
export const metaEloTesztKod = (env, uzletag) => (uzletag === 'pmu' ? env && env.META_ELO_TESZT_KOD_PMU : uzletag === 'szor' ? env && env.META_ELO_TESZT_KOD_SZOR : env && env.META_ELO_TESZT_KOD) || null;
export const metaEloBe = (env, uzletag) => metaEloUzletagok(env).includes(uzletag);

const tisztit = (o) => { const k = {}; for (const [a, b] of Object.entries(o)) if (b !== null && b !== undefined && b !== '' && !(Array.isArray(b) && !b.length)) k[a] = b; return k; };
/** A Conversions API kerelem (tiszta fuggveny). ctx: { event_id, ido, hash, erk (attr), ip, ua, oldal, teszt, apiVerzio, dataset (alap: HeadSpa) } */
export function metaEloKerelem(ctx) {
  const ud = tisztit({
    em: ctx.hash && ctx.hash.em ? [ctx.hash.em] : null, ph: ctx.hash && ctx.hash.ph_meta ? [ctx.hash.ph_meta] : null, fn: ctx.hash && ctx.hash.fn ? [ctx.hash.fn] : null, ln: ctx.hash && ctx.hash.ln ? [ctx.hash.ln] : null,
    country: ctx.hash && ctx.hash.country ? [ctx.hash.country] : null, external_id: ctx.hash && ctx.hash.ext ? [ctx.hash.ext] : null,
    client_ip_address: ctx.ip, client_user_agent: ctx.ua, fbc: ctx.erk ? metaFbc(ctx.erk, ctx.ido * 1000) : null, fbp: ctx.erk ? ctx.erk.fbp : null,
  });
  const adat = tisztit({ event_name: ELO_META_ESEMENY, event_time: ctx.ido, event_id: ctx.event_id, action_source: 'website', event_source_url: ctx.oldal, user_data: ud });
  return { url: `https://graph.facebook.com/${ctx.apiVerzio || ARNYEK.meta.apiVerzio}/${ctx.dataset || ELO_DATASET}/events`, method: 'POST', body: { data: [adat], ...(ctx.teszt ? { test_event_code: String(ctx.teszt).slice(0, 40) } : {}), partner_agent: 'mosaic-elo-schedule' } };
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
const ujraProbalhato = (s, t) => (s.allapot === 'hiba' && s.probalkozas < MAX_PROBA) || (s.allapot === 'folyamatban' && s.probalkozas < MAX_PROBA && t - s.frissitve > ELAKADAS_MP) || s.allapot === 'halasztva';
const szuk = (x, n = 300) => String(x == null ? '' : x).replace(/[A-Za-z0-9+/_-]{40,}/g, '[x]').slice(0, n);

// 01-MERES #167 6541884407 4.(iii) (ma 18:00): a metaEloKuld eredmenye ne maradjon csendben. Ami NEM hagy sort a meres_meta_elo-ban (nincs_ernyo / kihagyva / halasztva / a hiba-agon keletkezett kivetel), arrol 1 naplosor keszul
// (esemeny_id = 'naplo:<source_id>:<allapot>', INSERT OR IGNORE: ugyanarra a foglalasra/allapotra egyszer). A 'ki' allapotrol NINCS naplo (alapbol KI: nincs tabla). A naplozas hibaja SOHA nem dobodik, a visszateres valtozatlan.
const NAPLOZANDO = new Set(['nincs_ernyo', 'kihagyva', 'halasztva', 'hiba']);
async function eredmenyNaplo(db, fk, r, deps) {
  try {
    if (!r || !NAPLOZANDO.has(r.allapot) || (r.allapot === 'hiba' && 'esemeny' in r)) return; // a kuldesi 'hiba' sora mar a tablaban van
    await sema(db);
    const t = Math.floor((deps.now ? deps.now() : Date.now()) / 1000);
    await db.prepare("INSERT OR IGNORE INTO meres_meta_elo (esemeny_id, uzletag, source_id, event_id, allapot, indok, probalkozas, letrehozva, frissitve) VALUES (?1, ?2, ?3, '-', ?4, ?5, 0, ?6, ?6)").bind(`naplo:${fk.source_entity_id}:${r.allapot}`, String(fk.uzletag || ''), String(fk.source_entity_id || ''), r.allapot, szuk(r.indok || '', 200) || null, t).run();
  } catch (err) { /* a naplo nem akadalyozhatja a foglalast */ }
}

/** Az elosztas() UTAN hivva (mint a tiktokEloKuld). fk: ugyanaz; deps: { env, fetchImpl, now, eloEllenorzes }. Hiba SOHA nem dobodik. */
export async function metaEloKuld(db, fk, deps = {}) {
  const r = await metaEloKuldBelso(db, fk, deps);
  await eredmenyNaplo(db, fk, r, deps);
  return r;
}

async function metaEloKuldBelso(db, fk, deps = {}) {
  try {
    const env = deps.env || {};
    if (!fk || fk.tipus !== 'foglalas' || !metaEloBe(env, fk.uzletag)) return { allapot: 'ki' };
    if (fk.fixAllapot) return { allapot: 'kihagyva', indok: 'reschedule: nincs uj konverzio' };
    // elonezeti kornyezet vedohalo (ELO_CSAK_TESZT=1 a [env.preview.vars]-ban): teszt-kod nelkul NEM kuldunk (kulonben az elonezet az ELO datasetre kuldene)
    if (String(env.ELO_CSAK_TESZT || '') === '1' && !metaEloTesztKod(env, fk.uzletag)) return { allapot: 'kihagyva', indok: `elonezet: csak teszt-kodos kuldes (nincs ${fk.uzletag === 'pmu' ? 'META_ELO_TESZT_KOD_PMU' : fk.uzletag === 'szor' ? 'META_ELO_TESZT_KOD_SZOR' : 'META_ELO_TESZT_KOD'})` };
    // PMU biztonsagi halo (Feri 10-31 14:25): a „korrekcio” (0 Ft-os javitas) SOHA nem szamit, akkor sem, ha a Salonic uj vendegnek jelolne
    if (szervesUzletag(fk.uzletag) && /korrekci/i.test(String(fk.szolgaltatas || ''))) return { allapot: 'nincs_ernyo', indok: 'korrekcio: nem szamit' };
    const e = esemenyek({ ...fk, ertek: Number.isFinite(Number(fk.ertek)) ? fk.ertek : 0 }, konzultacioTabla(env)).find((x) => x.tipus === 'ernyo');
    if (!e) return { allapot: 'nincs_ernyo' };
    await sema(db);
    const now = deps.now ? deps.now() : Date.now(); const t = Math.floor(now / 1000);
    const meglevo = await db.prepare('SELECT esemeny_id, allapot, probalkozas, frissitve FROM meres_meta_elo WHERE esemeny_id = ?1').bind(e.esemeny_id).first();
    if (meglevo && !ujraProbalhato(meglevo, t)) {
      // DECISION #250 (b): a MAX_PROBA-szor megkezdett, de be nem fejezett sor ELAKADAS_MP utan 'megszakadt'; (c) friss folyamatban sornal ujraprobal_mp a hivonak
      if (meglevo.allapot === 'folyamatban' && meglevo.probalkozas >= MAX_PROBA && t - meglevo.frissitve > ELAKADAS_MP) {
        await db.prepare("UPDATE meres_meta_elo SET allapot = 'megszakadt', indok = ?2, frissitve = ?3 WHERE esemeny_id = ?1 AND allapot = 'folyamatban' AND probalkozas >= ?4").bind(e.esemeny_id, `megszakadt: a kuldes ${MAX_PROBA} probalkozas utan sem fejezodott be`, t, MAX_PROBA).run();
        return { allapot: 'megszakadt', elozo: 'folyamatban' };
      }
      return { allapot: 'mar_kuldve', elozo: meglevo.allapot, ...(meglevo.allapot === 'folyamatban' && t - meglevo.frissitve <= ELAKADAS_MP ? { ujraprobal_mp: ELAKADAS_MP - (t - meglevo.frissitve) + 5 } : {}) };
    }
    const erk0 = await erkezesOlvas(db, fk.source_entity_id);
    // PMU (Feri 2026-10-31 14:25, #167 6543952570): a PMU-n NINCS eventID-s bongeszos Schedule (csak a pmu-ok URL-szabaly, ami a merge-dzel egyidoben KIKAPCSOL), ezert a szerveres esemeny az egyetlen: event_id = a Salonic-foglalas uuid-ja
    // (mindket ut - mb_ es sd_ - ugyanazt kepezi, igy a Meta es a salonic_uuid egyedi index is duplan nem szamol); uuid nelkul a bongeszos kulcs, vegso soron a foglalas azonositoja. A bongeszos kulcs hianya PMU-nal NEM blokkol.
    const pmu = szervesUzletag(fk.uzletag); // PMU + Szor: kizarolag szerveres Schedule, uuid-alapu event_id (<uzletag>-<uuid>)
    const elotag = `${fk.uzletag}-`;
    const uuidKulcs = pmu && fk.uuid && /^[0-9a-f-]{8,64}$/i.test(String(fk.uuid)) ? `${elotag}${String(fk.uuid).toLowerCase()}` : null;
    const eventId = pmu ? (uuidKulcs || (erk0 ? bongeszoMetaKulcs(erk0.bongeszo) : null) || `${elotag}${String(fk.source_entity_id || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 60)}`) : (erk0 ? bongeszoMetaKulcs(erk0.bongeszo) : null);
    if (!eventId || (pmu && eventId === elotag)) return { allapot: 'kihagyva', indok: 'nincs kozos (bongeszos) event_id: a szerveres peldany duplan szamolna' };
    // sd_ agon (nincs bongeszo-ero) PMU-nal is menjen: ures erkezes-modell, csak a hash-elt azonositok + a foglalas ideje; a hozzajarulas ott ismeretlen (nincs bongeszo-munkamenet), explicit elutasitas nem lehetseges
    const erk = erk0 || (pmu ? { attr: {}, bongeszo: {}, hozz: undefined } : null);
    if (!erk) return { allapot: 'kihagyva', indok: 'nincs kozos (bongeszos) event_id: a szerveres peldany duplan szamolna' };
    if (hozzajarulasTisztit(erk.hozz).adv === false) return { allapot: 'kihagyva', indok: 'explicit marketing-elutasitas' };
    if (deps.eloEllenorzes) {
      let elo; try { elo = await deps.eloEllenorzes(); } catch (err) { elo = 'ismeretlen'; }
      if (elo === 'torolve') return { allapot: 'kihagyva', indok: 'a foglalas lemondva (elo allapot-ellenorzes)' };
      if (elo !== 'aktiv') return { allapot: 'halasztva', indok: 'a foglalas elo allapota nem ellenorizheto', ujraprobal_mp: 180 };
    }
    const hash = await felhasznaloHash(env, fk.vendeg || {});
    const kerelem = metaEloKerelem({ dataset: ELO_DATASETEK[fk.uzletag], event_id: eventId, ido: fk.ido || erk.ido || t, hash, erk: erk.attr || {}, ip: erk.ip, ua: erk.ua, oldal: fk.oldal || erk.oldal || (pmu ? SZERVERES_OLDAL[fk.uzletag] : undefined), teszt: metaEloTesztKod(env, fk.uzletag), apiVerzio: env.META_API_VERSION });
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
      const r = await f(`${kerelem.url}?access_token=${encodeURIComponent(env.META_ELO_TOKEN)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(kerelem.body), signal: AbortSignal.timeout(ELO_FETCH_TIMEOUT_MS) });
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
