// ELETUT-esemenyek I/O-retege (DECISION-LOG #97 / #102): lemondva / nem_jelent_meg / megjelent (foglalas) es a visszaterites-korrekcio (ajandekkartya).
// A modell tiszta (eletut-modell.js), a kerelmek tiszta (eletut-kerelem.js); ez a reteg: allapotgep (meres_eletut), elo allapot-ellenorzes, vészkapcsolo, dedup, naplo, kuldes.
//   - MINDEN cella a meres_kuldes tablaba kerul (esemeny_tipus = eletut | korrekcio), ugyanazzal az egyedi (esemeny_id, platform) kulccsal: ugyanaz a dedup, mint a letrehozasnal
//   - Google-korrekcio: Zapier-webhook (GOOGLE_KORREKCIO_WEBHOOK_URL), dryRun ALAPBOL (allapot: "dryrun" = a Zap validalta, de nem irt); eles csak GOOGLE_KORREKCIO_ELES=1 mellett
//   - Meta / TikTok: diagnosztikai esemeny (nem konverzio), a felhasznaloi adat az ERESETI, mar kikuldott alapesemeny hash-eibol (a vendeg szemelyes adata nem tarolodik; nem kell ujra kuldeni)
//   - csak MERES_ELOSZTO=1 es MERES_ELETUT=1 mellett fut; a hiba soha nem akaszthatja meg a hivo (lemondasi ertesito / Stripe-webhook) folyamatat
import { SOURCE_ID_MINTA } from './esemeny-modell.js';
import { hashEmail, hashTelefon } from './hash.js';
import { meresSema, kapcsolokOlvas, kikapcsolva, maszkolt } from './elosztas.js';
import { kuldes } from './platformok.js';
import { ELETUT_ALLAPOTOK, ELETUT_AKCIOK, atmenet, diagNev, eletutEsemenyId, idoRendben, korrekcioId, visszavonasId, visszateritesId } from './eletut-modell.js';
import { ga4RefundKerelem, googleKorrekcioKerelem, metaDiagKerelem, tiktokDiagKerelem } from './eletut-kerelem.js';

const SEMA = [
  'CREATE TABLE IF NOT EXISTS meres_eletut (source_id TEXT PRIMARY KEY, uzletag TEXT NOT NULL, allapot TEXT NOT NULL, elozo TEXT, ido INTEGER NOT NULL, forras TEXT, osszeg_filler INTEGER, visszateritett_filler INTEGER NOT NULL DEFAULT 0, frissitve INTEGER NOT NULL) WITHOUT ROWID',
  'CREATE TABLE IF NOT EXISTS meres_eletut_naplo (id INTEGER PRIMARY KEY AUTOINCREMENT, source_id TEXT NOT NULL, bejovo TEXT, eredmeny TEXT NOT NULL, allapot_elotte TEXT, allapot_utana TEXT, ido INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS meres_eletut_naplo_source ON meres_eletut_naplo (source_id)',
];
const kesz = new WeakSet();
export async function eletutSema(db) { if (kesz.has(db)) return; await meresSema(db); await db.batch(SEMA.map((s) => db.prepare(s))); kesz.add(db); }

const MAX_PROBA = 3;
const ELAKADAS_MP = 120;
const FOGLALAS_ID = /^mb_[a-z0-9]{12,40}$/;
const PI_ID = /^pi_[A-Za-z0-9]{8,80}$/;
const jsonBiztos = (s) => { try { return JSON.parse(s); } catch (e) { return null; } };
const bekapcsolva = (env) => String(env && env.MERES_ELOSZTO) === '1' && String(env && env.MERES_ELETUT) === '1';

// Ujraprobalhato sor: hiba (MAX_PROBA-ig), tiltas, halasztas, hitelesites hianya, a veszkapcsolo miatt kihagyott, elakadt "folyamatban"; a "dryrun" sor CSAK akkor, ha mar eles a korrekcio.
const ujraprobalhato = (m, t, eles) => ['hiba', 'tiltva', 'halasztva', 'nincs_hitelesites'].includes(m.allapot) || (m.allapot === 'dryrun' && eles) || (m.allapot === 'kihagyva' && /^veszkapcsolo/.test(m.indok || '')) || (m.allapot === 'folyamatban' && t - m.frissitve > ELAKADAS_MP);

const UPSERT = 'INSERT INTO meres_kuldes (esemeny_id, esemeny_nev, esemeny_tipus, platform, platform_nev, uzletag, source_id, allapot, indok, ertek, penznem, hozzajarulas, kerelem, http_status, platform_valasz, kuldo, probalkozas, letrehozva, frissitve) '
  + 'VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,NULL,?12,?13,?14,?15,?16,?17,?17) ON CONFLICT(esemeny_id, platform) DO UPDATE SET allapot = excluded.allapot, indok = excluded.indok, platform_nev = excluded.platform_nev, '
  + 'kerelem = excluded.kerelem, http_status = excluded.http_status, platform_valasz = excluded.platform_valasz, kuldo = excluded.kuldo, ertek = excluded.ertek, probalkozas = meres_kuldes.probalkozas + ?16, frissitve = excluded.frissitve';

/**
 * Egy (esemeny, platform) cella: veszkapcsolo -> kerelem epitese -> naplozas -> kuldes -> allapot. def: { esemeny_id, esemeny_nev, tipus, platform, uzletag, source_id, ertek, epit: () => kerelem | {kihagyva|halasztva|tiltva}, kapcsolok }.
 * -> { platform, esemeny_id, platform_nev, allapot, indok, http_status, duplikalt? }
 */
async function cella(db, env, def, deps, t) {
  const eles = def.platform === 'google' && String(env.GOOGLE_KORREKCIO_ELES) === '1';
  const m = await db.prepare('SELECT id, allapot, indok, probalkozas, frissitve, platform_nev, http_status FROM meres_kuldes WHERE esemeny_id = ?1 AND platform = ?2').bind(def.esemeny_id, def.platform).first();
  const alap = { platform: def.platform, esemeny_id: def.esemeny_id };
  if (m && !ujraprobalhato(m, t, eles)) return { ...alap, platform_nev: m.platform_nev, allapot: m.allapot, indok: m.indok, http_status: m.http_status, duplikalt: true };
  if (m && m.allapot === 'hiba' && m.probalkozas >= MAX_PROBA) return { ...alap, allapot: 'hiba', indok: 'tul sok sikertelen probalkozas', duplikalt: true };
  const ir = (mezok, kuld) => db.prepare(UPSERT).bind(def.esemeny_id, def.esemeny_nev, def.tipus, def.platform, mezok.platform_nev ?? null, def.uzletag, def.source_id, mezok.allapot, mezok.indok ?? null, def.ertek ?? null,
    def.ertek === null || def.ertek === undefined ? null : 'HUF', mezok.kerelem ?? null, mezok.http_status ?? null, mezok.platform_valasz ?? null, mezok.kuldo ?? null, kuld ? 1 : 0, t).run();
  const kk = kikapcsolva(def.kapcsolok, def.uzletag, def.platform);
  let k = null, d = null;
  if (kk) d = { allapot: 'kihagyva', indok: 'veszkapcsolo: ' + kk };
  else {
    k = def.epit();
    if (k.kihagyva) d = { allapot: 'kihagyva', indok: k.kihagyva };
    else if (k.halasztva) d = { allapot: 'halasztva', indok: k.halasztva };
    else if (k.tiltva) d = { allapot: 'tiltva', indok: k.tiltva };
  }
  if (d) { await ir(d, false); return { ...alap, ...d }; }
  const naplo = { platform_nev: k.platform_nev, kerelem: JSON.stringify({ url: k.url, method: k.method, fejlec_nevek: k.fejlec_nevek, cel: k.cel, body: env.MERES_NAPLO_TELJES === '1' ? k.body : maszkolt(k.body) }) };
  await ir({ ...naplo, allapot: 'folyamatban' }, false);
  const er = await (deps.kuldo || kuldes)(k, env, deps.fetchImpl || fetch);
  let allapot = er.allapot;
  if (allapot === 'elkuldve' && k.body && k.body.dryRun === true) allapot = 'dryrun'; // a Zap validateOnly-t futtatott: nem irt, ezert nem veglegesitjuk
  await db.prepare('UPDATE meres_kuldes SET allapot = ?3, indok = ?4, http_status = ?5, platform_valasz = ?6, kuldo = ?7, probalkozas = probalkozas + 1, frissitve = ?8 WHERE esemeny_id = ?1 AND platform = ?2')
    .bind(def.esemeny_id, def.platform, allapot, allapot === 'nincs_hitelesites' ? 'a kerelem kesz, a kuldeshez hitelesites kell (' + (k.webhook_env || 'token') + ')' : (allapot === 'dryrun' ? 'dryRun: a Zap validalta, de nem irt (eles: GOOGLE_KORREKCIO_ELES=1)' : null), er.http_status ?? null, er.valasz ?? null, er.kuldo ?? null, t).run();
  return { ...alap, platform_nev: k.platform_nev, allapot, http_status: er.http_status ?? null, kuldo: er.kuldo };
}

/** Az eredeti, mar kikuldott alapesemeny hash-elt felhasznaloi adata (a naplozott kerelembol); IP / user agent kimarad; a hivo friss vendeg-adata (hash-elve) felulirja. */
async function felhasznalo(sor, platform, vendeg) {
  const jk = sor && jsonBiztos(sor.kerelem);
  const d = jk && jk.body && jk.body.data && jk.body.data[0];
  let u = d ? { ...(platform === 'meta' ? d.user_data : d.user) } : {};
  // a letrehozaskori IP / user agent a megjelenes idejen nem ervenyes (az esemeny offline tortenik): kimarad; marad: em / ph / external_id / fbc / fbp (Meta), email / phone / external_id / ttclid / ttp (TikTok)
  for (const k of ['client_ip_address', 'client_user_agent', 'ip', 'user_agent']) delete u[k];
  if (vendeg && (vendeg.email || vendeg.telefon)) {
    const em = await hashEmail(vendeg.email), ph = await hashTelefon(vendeg.telefon, platform === 'tiktok' ? { plusz: true } : undefined);
    if (platform === 'meta') { if (em) u.em = [em]; if (ph) u.ph = [ph]; } else { if (em) u.email = em; if (ph) u.phone = ph; }
  }
  return u;
}

/**
 * Egy foglalas eletut-allapotanak feldolgozasa. be: { source_id (mb_...), allapot (lemondva | nem_jelent_meg | megjelent), ido (unix mp, alapbol most), forras, vendeg? { email, telefon } }
 * deps: { env, fetchImpl, now, kuldo, eloEllenorzes: async () => 'aktiv' | 'torolve' | 'ismeretlen', start (a foglalas kezdete, unix mp, a kulcsbol) }
 * -> { allapot: 'kesz' | 'mar_kuldve' | 'halasztva' | 'ki' | 'ervenytelen' | 'ismeretlen_foglalas' | 'ellentmondas' | 'korai' | 'nem_torolve' | 'torolt_foglalas', eletut_allapot, cellak: [..], riasztas?, miert? }
 */
export async function eletutFeldolgoz(db, be, deps = {}) {
  const env = deps.env || {};
  const now = deps.now ? deps.now() : Date.now();
  const t = Math.floor(now / 1000);
  if (!bekapcsolva(env)) return { allapot: 'ki', miert: 'MERES_ELOSZTO / MERES_ELETUT nincs bekapcsolva' };
  await eletutSema(db);
  const sid = String((be && be.source_id) || ''), allapot = be && be.allapot;
  if (!FOGLALAS_ID.test(sid) || !SOURCE_ID_MINTA.test(sid)) return { allapot: 'ervenytelen', miert: 'ervenytelen source_id (foglalas: mb_...)' };
  if (!ELETUT_ALLAPOTOK.includes(allapot)) return { allapot: 'ervenytelen', miert: 'ismeretlen allapot (lemondva | nem_jelent_meg | megjelent)' };
  const naplo = (eredmeny, elotte, utana) => db.prepare('INSERT INTO meres_eletut_naplo (source_id, bejovo, eredmeny, allapot_elotte, allapot_utana, ido) VALUES (?1,?2,?3,?4,?5,?6)')
    .bind(sid, JSON.stringify({ allapot, ido: be.ido ?? null, forras: be.forras ?? null, vendeg: be.vendeg ? '<megadva>' : null }), eredmeny, elotte || null, utana || null, t).run();
  const { results: sorok } = await db.prepare("SELECT * FROM meres_kuldes WHERE source_id = ?1 AND esemeny_tipus IN ('alap','ernyo') ORDER BY id").bind(sid).all();
  const alapSor = (sorok || []).find((r) => r.esemeny_tipus === 'alap');
  if (!alapSor) { await naplo('ismeretlen_foglalas'); return { allapot: 'ismeretlen_foglalas', miert: 'ehhez a foglalashoz nincs alapesemeny-sor (a letrehozasi level meg nem ment at az egyeztetesen)' }; }
  const uzletag = alapSor.uzletag;
  const jelenlegi = await db.prepare('SELECT * FROM meres_eletut WHERE source_id = ?1').bind(sid).first();
  const elotte = jelenlegi ? jelenlegi.allapot : null;
  const at = atmenet(elotte, allapot);
  if (!at.ok) { await naplo(at.miert, elotte, elotte); return { allapot: 'ellentmondas', riasztas: true, miert: at.miert, eletut_allapot: elotte }; }
  const idr = idoRendben(allapot, deps.start ?? null, t);
  if (!idr.ok) { await naplo(idr.miert, elotte, elotte); return { allapot: 'korai', miert: idr.miert, eletut_allapot: elotte }; }
  // elo allapot-ellenorzes (a Salonic-oldal): lemondashoz torolve kell; megjelent / nem_jelent_meg csak el (nem torolt) foglalasra; nem ellenorizheto -> halasztva
  let elo = 'nincs_ellenorzes';
  if (deps.eloEllenorzes) { try { elo = await deps.eloEllenorzes(); } catch (e) { elo = 'ismeretlen'; } }
  if (elo === 'ismeretlen') { await naplo('halasztva: a foglalas elo allapota nem ellenorizheto', elotte, elotte); return { allapot: 'halasztva', miert: 'a foglalas elo allapota nem ellenorizheto', ujraprobal_mp: 180, eletut_allapot: elotte }; }
  if (allapot === 'lemondva' && elo === 'aktiv') { await naplo('nem_torolve', elotte, elotte); return { allapot: 'nem_torolve', miert: 'a foglalas a Salonicban meg el: nem vonjuk vissza', eletut_allapot: elotte }; }
  if (allapot !== 'lemondva' && elo === 'torolve') { await naplo('torolt_foglalas', elotte, elotte); return { allapot: 'torolt_foglalas', miert: 'a foglalas torolve: nem lehet megjelent / nem_jelent_meg', eletut_allapot: elotte }; }

  const ido = Number.isFinite(Number(be.ido)) && Number(be.ido) > 0 ? Math.min(Math.floor(Number(be.ido)), t) : t;
  const kapcsolok = await kapcsolokOlvas(db);
  const akcio = ELETUT_AKCIOK[allapot];
  const alapDef = { uzletag, source_id: sid, kapcsolok, ertek: null };
  const cellak = [];
  if (akcio.google) {
    const g = (sorok || []).find((r) => r.platform === 'google' && r.esemeny_id === alapSor.esemeny_id);
    cellak.push(await cella(db, env, { ...alapDef, esemeny_id: visszavonasId(alapSor.esemeny_id), esemeny_nev: 'Visszavonas', tipus: 'eletut', platform: 'google', epit: () => {
      if (!g || g.allapot !== 'elkuldve') return { kihagyva: `az eredeti Google-konverzio nem ment ki (${g ? g.allapot : 'nincs sor'}): nincs mit visszavonni` };
      const jk = jsonBiztos(g.kerelem) || {};
      const varOra = Number(env.GOOGLE_KORREKCIO_VARAKOZAS_ORA) || 0; // ha a Google a frissen feltoltott konverzio korrekciojat elutasitja (CONVERSION_NOT_FOUND), itt allithato a varakozas
      if (varOra > 0 && t < g.frissitve + varOra * 3600) return { halasztva: `google: az eredeti konverzio ${varOra} ora mulva korrigalhato (GOOGLE_KORREKCIO_VARAKOZAS_ORA)` };
      return googleKorrekcioKerelem({ tipus: 'RETRACTION', orderId: (jk.body && jk.body.order_id) || alapSor.esemeny_id, akcioId: jk.cel && jk.cel.conversion_action_id, idoUnix: ido, megjegyzes: `${allapot}: ${sid}` }, env, t);
    } }, deps, t));
  }
  if (akcio.diag) {
    const esemenyId = eletutEsemenyId(allapot, sid), nev = diagNev(allapot, uzletag);
    for (const platform of ['meta', 'tiktok']) {
      const eredeti = (sorok || []).find((r) => r.platform === platform && r.esemeny_id === alapSor.esemeny_id && r.kerelem);
      const user = await felhasznalo(eredeti, platform, be.vendeg);
      const epit = platform === 'meta' ? metaDiagKerelem : tiktokDiagKerelem;
      cellak.push(await cella(db, env, { ...alapDef, esemeny_id: esemenyId, esemeny_nev: nev, tipus: 'eletut', platform, epit: () => epit({ nev, esemenyId, idoUnix: ido, allapot, user, sourceId: sid, uzletag }, env, t) }, deps, t));
    }
  }
  if (elotte !== allapot) {
    await db.prepare('INSERT INTO meres_eletut (source_id, uzletag, allapot, elozo, ido, forras, frissitve) VALUES (?1,?2,?3,?4,?5,?6,?7) ON CONFLICT(source_id) DO UPDATE SET elozo = meres_eletut.allapot, allapot = excluded.allapot, ido = excluded.ido, forras = excluded.forras, frissitve = excluded.frissitve')
      .bind(sid, uzletag, allapot, elotte, ido, be.forras ? String(be.forras).slice(0, 60) : null, t).run();
  }
  const halasztott = cellak.some((c) => c.allapot === 'halasztva');
  const ujKuldes = cellak.some((c) => !c.duplikalt);
  const osszeg = halasztott ? 'halasztva' : (ujKuldes || elotte !== allapot ? 'kesz' : 'mar_kuldve');
  await naplo(osszeg + ': ' + cellak.map((c) => `${c.platform}=${c.allapot}`).join(', '), elotte, allapot);
  return { allapot: osszeg, source_id: sid, uzletag, eletut_allapot: allapot, elozo: elotte, elo_allapot: elo, cellak, ...(halasztott ? { ujraprobal_mp: 3600 } : {}) };
}

/**
 * Ajandekkartya VISSZATERITES-korrekcio. be: { source_id (pi_...), osszeg_filler (az eredeti vasarlas), visszateritett_filler (a KUMULALT visszateritett osszeg), ido (unix mp, alapbol most), forras }
 * Teljes visszaterites: Google RETRACTION; reszleges: Google RESTATEMENT (az uj ertek = osszeg - visszateritett); mindket esetben GA4 "refund" (a mostani visszaterites = a kumulalt valtozas).
 * Idempotens: ugyanaz a kumulalt osszeg ismet = nincs uj kuldes; kisebb osszeg nem allitja vissza a korabbit. Meta / TikTok: nincs korrekcio (azok a konverziot nem vonjak vissza).
 */
export async function visszateritesFeldolgoz(db, be, deps = {}) {
  const env = deps.env || {};
  const now = deps.now ? deps.now() : Date.now();
  const t = Math.floor(now / 1000);
  if (!bekapcsolva(env)) return { allapot: 'ki', miert: 'MERES_ELOSZTO / MERES_ELETUT nincs bekapcsolva' };
  await eletutSema(db);
  const sid = String((be && be.source_id) || '');
  const osszeg = Math.round(Number(be && be.osszeg_filler)), vissza = Math.round(Number(be && be.visszateritett_filler));
  if (!PI_ID.test(sid)) return { allapot: 'ervenytelen', miert: 'ervenytelen source_id (ajandekkartya: pi_...)' };
  if (!(osszeg > 0) || !(vissza >= 0) || vissza > osszeg) return { allapot: 'ervenytelen', miert: 'ervenytelen osszeg (osszeg_filler > 0, 0 <= visszateritett_filler <= osszeg_filler)' };
  const naplo = (eredmeny, elotte, utana) => db.prepare('INSERT INTO meres_eletut_naplo (source_id, bejovo, eredmeny, allapot_elotte, allapot_utana, ido) VALUES (?1,?2,?3,?4,?5,?6)')
    .bind(sid, JSON.stringify({ osszeg_filler: osszeg, visszateritett_filler: vissza, ido: be.ido ?? null, forras: be.forras ?? null }), eredmeny, elotte || null, utana || null, t).run();
  const { results: sorok } = await db.prepare("SELECT * FROM meres_kuldes WHERE source_id = ?1 AND esemeny_tipus IN ('alap','ernyo') ORDER BY id").bind(sid).all();
  const alapSor = (sorok || []).find((r) => r.esemeny_tipus === 'alap');
  if (!alapSor) { await naplo('ismeretlen_vasarlas'); return { allapot: 'ismeretlen_vasarlas', miert: 'ehhez a vasarlashoz nincs alapesemeny-sor (a vasarlas arnyek-esemenye nem ment ki)' }; }
  const jelenlegi = await db.prepare('SELECT * FROM meres_eletut WHERE source_id = ?1').bind(sid).first();
  const elozo = jelenlegi ? Number(jelenlegi.visszateritett_filler) || 0 : 0;
  if (vissza <= elozo) { await naplo('mar_kuldve: a kumulalt osszeg nem nott', jelenlegi && jelenlegi.allapot, jelenlegi && jelenlegi.allapot); return { allapot: 'mar_kuldve', miert: 'a kumulalt visszateritett osszeg nem nott', visszateritett_filler: elozo }; }
  const ido = Number.isFinite(Number(be.ido)) && Number(be.ido) > 0 ? Math.min(Math.floor(Number(be.ido)), t) : t;
  const teljes = vissza >= osszeg;
  const uzletag = alapSor.uzletag;
  const kapcsolok = await kapcsolokOlvas(db);
  const alapDef = { uzletag, source_id: sid, kapcsolok };
  const g = (sorok || []).find((r) => r.platform === 'google' && r.esemeny_id === alapSor.esemeny_id);
  const ga = (sorok || []).find((r) => r.platform === 'ga4' && r.esemeny_id === alapSor.esemeny_id);
  const cellak = [];
  cellak.push(await cella(db, env, { ...alapDef, ertek: teljes ? null : Math.round((osszeg - vissza) / 100), esemeny_id: teljes ? visszavonasId(alapSor.esemeny_id) : korrekcioId(alapSor.esemeny_id, vissza), esemeny_nev: teljes ? 'Visszavonas' : 'Korrekcio', tipus: 'korrekcio', platform: 'google', epit: () => {
    if (!g || g.allapot !== 'elkuldve') return { kihagyva: `az eredeti Google-konverzio nem ment ki (${g ? g.allapot : 'nincs sor'}): nincs mit korrigalni` };
    const jk = jsonBiztos(g.kerelem) || {};
    const varOra = Number(env.GOOGLE_KORREKCIO_VARAKOZAS_ORA) || 0;
    if (varOra > 0 && t < g.frissitve + varOra * 3600) return { halasztva: `google: az eredeti konverzio ${varOra} ora mulva korrigalhato (GOOGLE_KORREKCIO_VARAKOZAS_ORA)` };
    return googleKorrekcioKerelem({ tipus: teljes ? 'RETRACTION' : 'RESTATEMENT', orderId: (jk.body && jk.body.order_id) || alapSor.esemeny_id, akcioId: jk.cel && jk.cel.conversion_action_id, idoUnix: ido, ertek: (osszeg - vissza) / 100, megjegyzes: `ajandekkartya ${teljes ? 'teljes' : 'reszleges'} visszaterites: ${sid}` }, env, t);
  } }, deps, t));
  cellak.push(await cella(db, env, { ...alapDef, ertek: Math.round((vissza - elozo) / 100), esemeny_id: visszateritesId(sid, vissza), esemeny_nev: 'Visszaterites', tipus: 'korrekcio', platform: 'ga4', epit: () => {
    if (!ga || ga.allapot !== 'elkuldve') return { kihagyva: `az eredeti GA4 purchase nem ment ki (${ga ? ga.allapot : 'nincs sor'}): nincs mit korrigalni` };
    const body = (jsonBiztos(ga.kerelem) || {}).body || {};
    const p = body.events && body.events[0] && body.events[0].params;
    return ga4RefundKerelem({ transactionId: sid, ertek: (vissza - elozo) / 100, idoUnix: ido, client: { client_id: body.client_id, session_id: p && p.session_id }, consent: body.consent, esemenyId: visszateritesId(sid, vissza) }, env, t);
  } }, deps, t));
  const uj = teljes ? 'visszateritve' : 'reszben_visszateritve';
  await db.prepare('INSERT INTO meres_eletut (source_id, uzletag, allapot, elozo, ido, forras, osszeg_filler, visszateritett_filler, frissitve) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9) ON CONFLICT(source_id) DO UPDATE SET elozo = meres_eletut.allapot, allapot = excluded.allapot, ido = excluded.ido, forras = excluded.forras, osszeg_filler = excluded.osszeg_filler, visszateritett_filler = excluded.visszateritett_filler, frissitve = excluded.frissitve')
    .bind(sid, uzletag, uj, jelenlegi ? jelenlegi.allapot : null, ido, be.forras ? String(be.forras).slice(0, 60) : null, osszeg, vissza, t).run();
  const halasztott = cellak.some((c) => c.allapot === 'halasztva');
  await naplo((halasztott ? 'halasztva' : 'kesz') + ': ' + cellak.map((c) => `${c.platform}=${c.allapot}`).join(', '), jelenlegi && jelenlegi.allapot, uj);
  return { allapot: halasztott ? 'halasztva' : 'kesz', source_id: sid, eletut_allapot: uj, visszateritett_filler: vissza, osszeg_filler: osszeg, cellak };
}

/** A halasztott / eles-re varo eletut-cellak ujrafeldolgozasa (idozitett hivo: pl. oranaink egy Zap). deps.feloldo(sid) -> { eloEllenorzes, start } (a Salonic-oldali ellenorzeshez). */
export async function fuggoFeldolgoz(db, deps = {}) {
  const env = deps.env || {};
  if (!bekapcsolva(env)) return { allapot: 'ki', miert: 'MERES_ELOSZTO / MERES_ELETUT nincs bekapcsolva' };
  await eletutSema(db);
  const eles = String(env.GOOGLE_KORREKCIO_ELES) === '1';
  const { results } = await db.prepare("SELECT DISTINCT e.source_id, e.allapot, e.ido FROM meres_eletut e JOIN meres_kuldes k ON k.source_id = e.source_id WHERE k.esemeny_tipus = 'eletut' AND (k.allapot IN ('halasztva','tiltva','nincs_hitelesites','hiba','folyamatban') OR (k.allapot = 'dryrun' AND ?1 = 1))").bind(eles ? 1 : 0).all();
  const eredmenyek = [];
  for (const r of results || []) {
    const f = deps.feloldo ? await deps.feloldo(r.source_id) : {};
    eredmenyek.push({ source_id: r.source_id, ...(await eletutFeldolgoz(db, { source_id: r.source_id, allapot: r.allapot, ido: r.ido, forras: 'fuggo' }, { ...deps, ...f })) });
  }
  return { allapot: 'kesz', feldolgozott: eredmenyek.length, eredmenyek: eredmenyek.map((x) => ({ source_id: x.source_id, allapot: x.allapot, cellak: (x.cellak || []).map((c) => `${c.platform}=${c.allapot}`) })) };
}

/** Egy forras eletut-allapota + naplo + a hozza tartozo eletut / korrekcio cellak (admin / hivo). */
export async function eletutOlvas(db, sourceId) {
  await eletutSema(db);
  const allapot = await db.prepare('SELECT * FROM meres_eletut WHERE source_id = ?1').bind(sourceId).first();
  const { results: naplo } = await db.prepare('SELECT * FROM meres_eletut_naplo WHERE source_id = ?1 ORDER BY id').bind(sourceId).all();
  const { results: kuldesek } = await db.prepare("SELECT * FROM meres_kuldes WHERE source_id = ?1 AND esemeny_tipus IN ('eletut','korrekcio') ORDER BY id").bind(sourceId).all();
  return { allapot: allapot || null, naplo: naplo || [], kuldesek: (kuldesek || []).map((k) => ({ ...k, kerelem: jsonBiztos(k.kerelem) })) };
}

/** Az ellentmondo / elakadt eletut-bejegyzesek (riasztas). */
export async function eletutRiasztasok(db) {
  await eletutSema(db);
  const { results } = await db.prepare("SELECT id, source_id, eredmeny, allapot_elotte, allapot_utana, ido FROM meres_eletut_naplo WHERE eredmeny LIKE 'ellentmondas%' OR eredmeny LIKE 'nem_torolve%' ORDER BY id DESC LIMIT 100").all();
  return results || [];
}
