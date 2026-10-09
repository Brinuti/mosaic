// A foglalas -> megjelenes (booking-to-show) motor magja: a Salonic-ertesitokbol foglalas-allapotot es kuldesi sort epit (D1), majd az esedekes
// SMS-eket / e-maileket kikuldi. A kuldok (SMS, e-mail) parameterek, igy a motor a tesztekben hamis kuldokkel fut.
//
// Allapotok (foglalasok.allapot): aktiv | lemondva | megjelent | nem_jelent_meg
// Kuldesek (kuldesek.allapot): fuggoben | kuldes | elkuldve | kihagyva | torolve | hiba
// Uzemmod (env.LIFECYCLE_MOD): ki (semmi nem megy) | teszt (CSAK a teszt-vendegeknek) | elo (az env.LIFECYCLE_UZLETAGOK-ban felsorolt uzletagak vendegeinek is)
// Munkatarsi ertesitok (DECISION #117): env.LIFECYCLE_MUNKATARS_MOD = ki | figyel (alap: csak naplo + riasztas, allapotvaltas NINCS) | be.
//   Elo oldal-ellenorzes kuldes elott: env.LIFECYCLE_ELO_ELLENORZES = ki (egyebkent be). Automatikus no-show: env.LIFECYCLE_NOSHOW_AUTO = 1 (alap: ki).
import { ertelmez, szintetikusId } from './parser.js';
import { normalizal } from './telefon.js';
import { keresztnev } from './nevek.js';
import { szegmensek as szegmensCimkek, UZLETAGAK, tisztaNev, ismertSzolgaltatas } from './uzletag.js';
import { munkatarsTipus, ertelmezMunkatars, belsoBlokk, nevNorm, munkatarsKulcs, szolgKulcs, beesoNev } from './munkatars.js';
import { UUID_RE } from './elo.js';
import { tervez, keres, KESES_PLAFON, surgos } from './terv.js';
import { ertekek, smsKirajzol, emailKirajzol, feladatKirajzol, ALAP_URL } from './render.js';
import { helyi, helyiEpoch } from './ido.js';

const NAP = 86400;

export function beallitas(env = {}) {
  const lista = (s, alap = '') => String(s ?? alap).split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  return {
    mod: ['ki', 'teszt', 'elo'].includes(env.LIFECYCLE_MOD) ? env.LIFECYCLE_MOD : 'teszt',
    elo: new Set(lista(env.LIFECYCLE_UZLETAGOK)),
    tesztEmail: new Set(lista(env.LIFECYCLE_TESZT_EMAIL, 'deakfi@grantis.hu,ferencistvandeak@gmail.com,ferraj@gmail.com')),
    tesztTelefon: new Set(lista(env.LIFECYCLE_TESZT_TELEFON, '+36709420090')),
    szalonEmail: env.LIFECYCLE_SZALON_EMAIL || 'mosaicheadspa@gmail.com',
    tesztFeladatEmail: env.LIFECYCLE_TESZT_FELADAT_EMAIL || 'deakfi@grantis.hu',
    napiPlafon: Number(env.LIFECYCLE_NAPI_PLAFON || 300),
    smsKuszob: Number(env.LIFECYCLE_SMS_KUSZOB || 3000),
    base: env.LIFECYCLE_BASE_URL || ALAP_URL,
    munkatarsMod: ['ki', 'figyel', 'be'].includes(env.LIFECYCLE_MUNKATARS_MOD) ? env.LIFECYCLE_MUNKATARS_MOD : 'figyel',
    noShowAuto: String(env.LIFECYCLE_NOSHOW_AUTO || '') === '1',
  };
}
export const tesztVendeg = (cfg, { email, nev, telefon }) => cfg.tesztEmail.has(String(email || '').toLowerCase()) || cfg.tesztTelefon.has(String(telefon || '')) || /^TESZT\b/i.test(nev || '');
export function engedelyezett(cfg, f) {
  if (cfg.mod === 'ki') return false;
  if (f.teszt) return true;
  return cfg.mod === 'elo' && cfg.elo.has(f.uzletag);
}

// ---- D1 segedek --------------------------------------------------------------------------------------------------------------------------------
const elso = (db, sql, ...p) => db.prepare(sql).bind(...p).first();
const futtat = (db, sql, ...p) => db.prepare(sql).bind(...p).run();
const mind = async (db, sql, ...p) => (await db.prepare(sql).bind(...p).all()).results || [];
const keszit = (db, sql, ...p) => db.prepare(sql).bind(...p);
const veletlen = (n = 10) => { const b = new Uint8Array(Math.ceil(n / 2)); crypto.getRandomValues(b); return [...b].map((x) => x.toString(16).padStart(2, '0')).join('').slice(0, n); };
const alapId = (uzenetId) => String(uzenetId).split('#')[0];

async function naplo(db, ido, tipus, foglalasId, forras, reszlet) {
  await futtat(db, 'INSERT OR IGNORE INTO esemenyek (ido, tipus, foglalas_id, forras_id, reszlet) VALUES (?1, ?2, ?3, ?4, ?5)', ido, tipus, foglalasId, forras || null, reszlet ? JSON.stringify(reszlet) : null);
}

// ---- terv mentese ------------------------------------------------------------------------------------------------------------------------------
const ujraIndithato = new Set(['fuggoben', 'torolve', 'kihagyva', 'hiba']);
/** A kiszamolt terv beirasa a kuldesek-be. reset: azok az uzenet-tipusok, amelyek mar elkuldve is ujra mennek (athelyezes: t72, t24). */
export async function tervMent(db, foglalasId, terv, { reset = [] } = {}) {
  const letezo = new Map((await mind(db, 'SELECT uzenet_id, allapot FROM kuldesek WHERE foglalas_id = ?1', foglalasId)).map((r) => [r.uzenet_id, r.allapot]));
  const tervezett = new Set(terv.terv.map((p) => p.uzenet_id));
  const stmts = [];
  for (const p of terv.terv) {
    const a = letezo.get(p.uzenet_id);
    if (a === undefined) stmts.push(keszit(db, "INSERT INTO kuldesek (foglalas_id, uzenet_id, csatorna, esedekes, allapot) VALUES (?1, ?2, ?3, ?4, 'fuggoben')", foglalasId, p.uzenet_id, p.csatorna, p.esedekes));
    else if (ujraIndithato.has(a) || reset.includes(p.tipus)) stmts.push(keszit(db, "UPDATE kuldesek SET esedekes = ?3, allapot = 'fuggoben', ok = NULL, probalkozas = 0, elkuldve = NULL, hiba = NULL WHERE foglalas_id = ?1 AND uzenet_id = ?2", foglalasId, p.uzenet_id, p.esedekes));
  }
  for (const [id, a] of letezo) if (a === 'fuggoben' && !tervezett.has(id) && !id.startsWith('COMMON-')) stmts.push(keszit(db, "UPDATE kuldesek SET allapot = 'torolve', ok = 'ujratervezes' WHERE foglalas_id = ?1 AND uzenet_id = ?2", foglalasId, id));
  for (const k of terv.kihagyva) if (!letezo.has(k.uzenet_id)) stmts.push(keszit(db, "INSERT OR IGNORE INTO kuldesek (foglalas_id, uzenet_id, csatorna, esedekes, allapot, ok) VALUES (?1, ?2, ?3, 0, 'kihagyva', ?4)", foglalasId, k.uzenet_id, k.csatorna || 'sms', k.ok));
  if (stmts.length) await db.batch(stmts);
}

/** A no-show SMS / e-mail kuldesi ideje: ha a jelzes az idopont napjan jott, masnap 10:00 (dokumentum); kesobb: nappal fel oraval kesobb, reggel 10:00, este masnap 10:00. */
export function nemJelentIdo(alap, kezdet) {
  const lk = helyi(kezdet); const la = helyi(alap);
  const ora = la.h + la.mi / 60;
  const masnap10 = () => { const k = helyi(alap + NAP); return helyiEpoch(k.y, k.m, k.d, 10, 0); };
  if (lk.y === la.y && lk.m === la.m && lk.d === la.d) return masnap10();
  if (ora < 9.5) return helyiEpoch(la.y, la.m, la.d, 10, 0);
  if (ora <= 19.5) return alap + 1800;
  return masnap10();
}
const NEM_JELENT_MEG_JELZES = /nem\s*jelent\s*meg|nem\s*j[öo]tt\s*el|nem\s*[ée]rkezett\s*meg|no[\s-]*show/i;

async function azonnaliUzenetek(db, foglalasId, uzenetIdk, most) {
  const stmts = uzenetIdk.map((id) => keszit(db, "INSERT OR IGNORE INTO kuldesek (foglalas_id, uzenet_id, csatorna, esedekes, allapot) VALUES (?1, ?2, ?3, ?4, 'fuggoben')", foglalasId, id, /-EMAIL(-|$)/.test(id) ? 'email' : 'sms', most));
  if (stmts.length) await db.batch(stmts);
}

/** A vendeg (telefon vagy e-mail) adott allapotu foglalasa az uzletagban, adott idopontra. lemondvaOta: lemondott foglalasnal ennyi ideje (epoch) modosult legkorabban. */
async function vendegFoglalasa(db, uzletag, email, telefon, kezdet, allapot, lemondvaOta = 0) {
  if (!kezdet) return null;
  const sorok = await mind(db, 'SELECT * FROM foglalasok WHERE uzletag = ?1 AND kezdet = ?2 AND allapot = ?3 AND COALESCE(modositva, 0) >= ?4 ORDER BY letrehozva DESC', uzletag, kezdet, allapot, lemondvaOta);
  const mail = String(email || '').trim().toLowerCase();
  return sorok.find((r) => (telefon && r.telefon === telefon) || (mail && String(r.email || '').toLowerCase() === mail)) || null;
}

// ---- befogadas (ingest) ------------------------------------------------------------------------------------------------------------------------
/**
 * Egy Salonic-ertesito feldolgozasa.
 * @param {{uzenetId:string, targy:string, kuldo?:string, szoveg?:string, html?:string}} level
 * @returns {Promise<{ok:boolean, tipus?:string, foglalasId?:string, duplikalt?:boolean, miert?:string}>}
 */
export async function ingest(db, env, level, most, opc = {}) {
  const cfg = beallitas(env);
  const mt = munkatarsTipus(level.targy);
  if (mt) return munkatarsIngest(db, env, cfg, level, mt, most, opc);
  const forras = String(level.uzenetId || '') || null;
  const e = ertelmez(level, most);
  // a level kuldesenek ideje (Zapier: a Gmail "date" mezoje): a regi, kesve erkezo levelnel az azonnali uzenetek esedekessege a level ideje -> a kesesi szabaly kihagyja oket
  const kuldve = Number(level.kuldve);
  const alapIdo = Number.isFinite(kuldve) && kuldve > 1.6e9 && kuldve <= most ? Math.floor(kuldve) : most;
  if (!e.ok) {
    await naplo(db, most, 'ingest:kihagyva', null, forras, { miert: e.miert, targy: String(level.targy || '').replace(/-\s.*$/, '').slice(0, 60) });
    return { ok: false, miert: e.miert };
  }
  // ismetlodes-szuro: ugyanaz a level ketszer (Zapier ujrafuttatas) nem hoz letre semmit
  if (forras) {
    const r = await futtat(db, 'INSERT OR IGNORE INTO esemenyek (ido, tipus, foglalas_id, forras_id) VALUES (?1, ?2, NULL, ?3)', most, 'ingest:feldolgozas', forras);
    if (r.meta && r.meta.changes === 0) {
      // ugyanaz a level mar feldolgozva = ismetlodes; de ha egy korabbi feldolgozas megszakadt (2+ perce "feldolgozas" allapotban ragadt), ujrainditjuk
      const volt = await elso(db, 'SELECT tipus, ido FROM esemenyek WHERE forras_id = ?1', forras);
      if (!(volt && volt.tipus === 'ingest:feldolgozas' && most - volt.ido > 120)) return { ok: true, duplikalt: true };
      await futtat(db, 'UPDATE esemenyek SET ido = ?2 WHERE forras_id = ?1', forras, most);
    }
  }
  try {
    return await feldolgoz(db, cfg, e, forras, most, alapIdo);
  } catch (hiba) {
    // hiba eseten a "feldolgozas" sor torlodik, hogy a Zapier ujraprobalkozasa tenylegesen feldolgozza a levelet
    if (forras) await futtat(db, "DELETE FROM esemenyek WHERE forras_id = ?1 AND tipus = 'ingest:feldolgozas'", forras);
    throw hiba;
  }
}

async function feldolgoz(db, cfg, e, forras, most, alapIdo = most) {
  const mai = await elso(db, "SELECT COUNT(*) AS n FROM esemenyek WHERE tipus LIKE 'ingest:%' AND ido > ?1", most - NAP);
  if (mai && mai.n > cfg.napiPlafon) {
    if (forras) await futtat(db, "UPDATE esemenyek SET tipus = 'ingest:plafon' WHERE forras_id = ?1", forras);
    return { ok: false, miert: 'napi_plafon' };
  }

  const telefon = normalizal(e.telefonNyers);
  const id = e.foglalasId || szintetikusId(e.uzletag, e.email, telefon, e.kezdet);
  const teszt = tesztVendeg(cfg, { email: e.email, nev: e.nev, telefon }) ? 1 : 0;
  const szeg = szegmensCimkek(e.uzletag, e.szolgaltatas);
  const nevek = { nev: e.nev || null, keresztnev: keresztnev(e.nev), telefon, email: e.email || null };
  const fiok = e.fiok || UZLETAGAK[e.uzletag].fiok;
  const tervAlap = { uzletag: e.uzletag, szegmensek: szeg, kezdet: e.kezdet };
  let eredmeny;

  // a Salonic MINDEN foglalasrol ket levelet kuld (ket cimzett-lista), egyidejuleg is megerkezhetnek: az azonosito egyedi (ON CONFLICT), a masodik "duplikalt"
  const beszur = async (allapot) => futtat(db,
    `INSERT INTO foglalasok (id, uzletag, fiok, nev, keresztnev, telefon, email, szolgaltatas, szegmens, munkatars, kezdet, letrehozva, allapot, token, teszt)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
     ON CONFLICT(id) DO NOTHING`,
    id, e.uzletag, fiok, nevek.nev, nevek.keresztnev, nevek.telefon, nevek.email, e.szolgaltatas, szeg.join(','), e.munkatars || null, e.kezdet, most, allapot, veletlen(10), teszt);

  if (e.tipus === 'foglalt') {
    const volt = await elso(db, 'SELECT * FROM foglalasok WHERE id = ?1', id);
    const vanTerv = volt ? !!(await elso(db, 'SELECT 1 AS x FROM kuldesek WHERE foglalas_id = ?1 LIMIT 1', id)) : false;
    if (volt && volt.allapot === 'aktiv' && volt.kezdet === e.kezdet && vanTerv) eredmeny = { ok: true, tipus: 'foglalt', foglalasId: id, duplikalt: true };
    else {
      let ujSor = false;
      if (!volt) { const b = await beszur('aktiv'); ujSor = !(b.meta && b.meta.changes === 0); }
      else await futtat(db, "UPDATE foglalasok SET allapot = 'aktiv', kezdet = ?2, letrehozva = ?3, szolgaltatas = ?4, szegmens = ?5, munkatars = ?6, megerositve = NULL WHERE id = ?1", id, e.kezdet, most, e.szolgaltatas, szeg.join(','), e.munkatars || null);
      if (!volt && !ujSor) eredmeny = { ok: true, tipus: 'foglalt', foglalasId: id, duplikalt: true }; // egy egyideju masik level mar felvette
      else { await tervMent(db, id, tervez(tervAlap, alapIdo)); eredmeny = { ok: true, tipus: 'foglalt', foglalasId: id }; }
    }
  } else if (e.tipus === 'athelyezve') {
    let volt = await elso(db, 'SELECT * FROM foglalasok WHERE id = ?1', id);
    if (!volt && e.regiKezdet) volt = await elso(db, 'SELECT * FROM foglalasok WHERE id = ?1', szintetikusId(e.uzletag, e.email, telefon, e.regiKezdet));
    if (!volt && e.regiKezdet) volt = await vendegFoglalasa(db, e.uzletag, e.email, telefon, e.regiKezdet, 'aktiv');
    const fid = volt ? volt.id : id;
    const voltAtfoglalas = volt ? !!(await elso(db, "SELECT 1 AS x FROM kuldesek WHERE foglalas_id = ?1 AND uzenet_id LIKE 'COMMON-RESCHEDULE-%' LIMIT 1", fid)) : false;
    if (volt && volt.allapot === 'aktiv' && volt.kezdet === e.kezdet && voltAtfoglalas) eredmeny = { ok: true, tipus: 'athelyezve', foglalasId: fid, duplikalt: true }; // a masodik (ketszer erkezo) level
    else {
      if (volt) await futtat(db, "UPDATE foglalasok SET allapot = 'aktiv', kezdet = ?2, szolgaltatas = ?3, szegmens = ?4, munkatars = ?5, modositva = ?6, megerositve = NULL WHERE id = ?1", fid, e.kezdet, e.szolgaltatas, szeg.join(','), e.munkatars || null, most);
      else await beszur('aktiv');
      await tervMent(db, fid, tervez(tervAlap, alapIdo, { athelyezes: true }), { reset: ['t72', 't24'] });
      const n = (await elso(db, "SELECT COUNT(*) AS n FROM kuldesek WHERE foglalas_id = ?1 AND uzenet_id LIKE 'COMMON-RESCHEDULE-%'", fid)).n;
      await azonnaliUzenetek(db, fid, [`COMMON-RESCHEDULE-SMS#${n + 1}`], alapIdo);
      eredmeny = { ok: true, tipus: 'athelyezve', foglalasId: fid, ismeretlenVolt: !volt };
    }
  } else if (e.tipus === 'lemondva' && !cfg.noShowAuto && ((NEM_JELENT_MEG_JELZES.test(e.lemondasOka || '') || e.kezdet <= alapIdo) && alapIdo - e.kezdet <= 3 * NAP)) {
    // DECISION #117 (D3/D5): torlesbol NEM lesz automatikus no-show (sem uzenet, sem allapotvaltas): csak naplo + riasztas (a napi osszesitoben).
    // Bekapcsolhato: LIFECYCLE_NOSHOW_AUTO=1.
    eredmeny = { ok: true, tipus: NEM_JELENT_MEG_JELZES.test(e.lemondasOka || '') && e.kezdet > alapIdo ? 'riasztas:nem_jelent_meg_jelzes' : 'riasztas:utolagos_torles', valtozas: false };
  } else if (e.tipus === 'lemondva' && ((NEM_JELENT_MEG_JELZES.test(e.lemondasOka || '') || e.kezdet <= alapIdo) && alapIdo - e.kezdet <= 3 * NAP)) {
    // NO-SHOW: a szalon torolte az idopontot (a vendeg a lemondasi hatarido utan mar nem mondhatja le; vagy az ok megjeloli: "nem jelent meg").
    // A lemondas-visszaigazolas helyett "nem talalkoztunk" SMS + e-mail megy, uj foglalasi linkkel.
    let volt = await elso(db, 'SELECT * FROM foglalasok WHERE id = ?1', id);
    if (!volt) volt = await elso(db, 'SELECT * FROM foglalasok WHERE id = ?1', szintetikusId(e.uzletag, e.email, telefon, e.kezdet));
    if (!volt) volt = await vendegFoglalasa(db, e.uzletag, e.email, telefon, e.kezdet, 'aktiv') || await vendegFoglalasa(db, e.uzletag, e.email, telefon, e.kezdet, 'nem_jelent_meg', most - 900);
    const fid = volt ? volt.id : id;
    const voltJelzes = volt ? !!(await elso(db, "SELECT 1 AS x FROM kuldesek WHERE foglalas_id = ?1 AND uzenet_id = 'COMMON-NOSHOW-SMS' LIMIT 1", fid)) : false;
    if (volt && volt.allapot === 'nem_jelent_meg' && voltJelzes) eredmeny = { ok: true, tipus: 'nem_jelent_meg', foglalasId: fid, duplikalt: true };
    else {
      if (volt) {
        await futtat(db, "UPDATE foglalasok SET allapot = 'nem_jelent_meg', modositva = ?2 WHERE id = ?1", fid, most);
        await futtat(db, "UPDATE kuldesek SET allapot = 'torolve', ok = 'nem_jelent_meg' WHERE foglalas_id = ?1 AND allapot IN ('fuggoben', 'kuldes')", fid);
      } else await beszur('nem_jelent_meg');
      await azonnaliUzenetek(db, fid, ['COMMON-NOSHOW-SMS', 'COMMON-NOSHOW-EMAIL'], nemJelentIdo(alapIdo, e.kezdet));
      eredmeny = { ok: true, tipus: 'nem_jelent_meg', foglalasId: fid, ismeretlenVolt: !volt };
    }
  } else { // lemondva
    let volt = await elso(db, 'SELECT * FROM foglalasok WHERE id = ?1', id);
    if (!volt) volt = await elso(db, 'SELECT * FROM foglalasok WHERE id = ?1', szintetikusId(e.uzletag, e.email, telefon, e.kezdet));
    // a Salonic lemondas-ertesitoje nem tartalmazza a foglalas azonositojat: a vendeg (telefon / e-mail) + uzletag + idopont alapjan keressuk meg
    if (!volt) volt = await vendegFoglalasa(db, e.uzletag, e.email, telefon, e.kezdet, 'aktiv') || await vendegFoglalasa(db, e.uzletag, e.email, telefon, e.kezdet, 'lemondva', most - 900);
    const fid = volt ? volt.id : id;
    const voltLemondas = volt ? !!(await elso(db, "SELECT 1 AS x FROM kuldesek WHERE foglalas_id = ?1 AND uzenet_id = 'COMMON-CANCEL-SMS' LIMIT 1", fid)) : false;
    if (volt && volt.allapot === 'lemondva' && voltLemondas) eredmeny = { ok: true, tipus: 'lemondva', foglalasId: fid, duplikalt: true };
    else {
      if (volt) {
        await futtat(db, "UPDATE foglalasok SET allapot = 'lemondva', modositva = ?2 WHERE id = ?1", fid, most);
        await futtat(db, "UPDATE kuldesek SET allapot = 'torolve', ok = 'lemondva' WHERE foglalas_id = ?1 AND allapot IN ('fuggoben', 'kuldes')", fid);
      } else await beszur('lemondva');
      if (e.kezdet > alapIdo) await azonnaliUzenetek(db, fid, ['COMMON-CANCEL-SMS', 'COMMON-CANCEL-EMAIL'], alapIdo); // a regen elmult idopontra nincs lemondas-visszaigazolas
      eredmeny = { ok: true, tipus: 'lemondva', foglalasId: fid, ismeretlenVolt: !volt };
    }
  }
  if (forras) await futtat(db, 'UPDATE esemenyek SET tipus = ?2, foglalas_id = ?3, reszlet = ?4 WHERE forras_id = ?1', forras, `ingest:${eredmeny.tipus || e.tipus}`, eredmeny.foglalasId || null, JSON.stringify({ uzletag: e.uzletag, teszt: !!teszt, duplikalt: !!eredmeny.duplikalt, kezdet: e.kezdet, szolgaltatas: tisztaNev(e.szolgaltatas).slice(0, 80), munkatars: String(e.munkatars || '').slice(0, 60) }));
  return eredmeny;
}

// ---- munkatarsi ertesitok (DECISION #117: APPROVE_WITH_GUARDRAILS) --------------------------------------------------------------------------------
// A level csak JELZES (nincs foglalas-azonosito). Allapotot CSAK akkor valtoztatunk, ha (1) a foglalas az uzletag + kezdes + munkatars + szolgaltatas
// alapjan EGYERTELMUEN megtalalhato, (2) a normalizalt vendegnev egyezik (megerosito jel, nem onallo kulcs; nincs kozelito egyeztetes) es (3) az elo Salonic-oldal
// is megerositi. Minden mas: 0 allapotvaltas, 0 SMS, riasztas. Torles az idopont ELOTT: fuggo uzenetek torlese, vendeguzenet NINCS (allapot: lemondva = "cancelled");
// utana: csak naplo + riasztas. Modositas: bizonyitott kezdes-valtozas, SMS csak 72 oran belul. Belso blokk (ebedszunet, szunet, munkatars-nev): csak egyertelmu szaballyal.
async function elsoFeldolgozas(db, forras, most) {
  if (!forras) return true;
  const r = await futtat(db, 'INSERT OR IGNORE INTO esemenyek (ido, tipus, foglalas_id, forras_id) VALUES (?1, ?2, NULL, ?3)', most, 'ingest:feldolgozas', forras);
  if (r.meta && r.meta.changes === 0) {
    const volt = await elso(db, 'SELECT tipus, ido FROM esemenyek WHERE forras_id = ?1', forras);
    if (!(volt && volt.tipus === 'ingest:feldolgozas' && most - volt.ido > 120)) return false;
    await futtat(db, 'UPDATE esemenyek SET ido = ?2 WHERE forras_id = ?1', forras, most);
  }
  return true;
}

/** A szalon torolte a foglalast: allapot lemondva, a fuggo uzenetek torolve - vendeguzenet NEM keletkezik. */
async function szalonTorolte(db, foglalasId, most) {
  await futtat(db, "UPDATE foglalasok SET allapot = 'lemondva', modositva = ?2 WHERE id = ?1 AND allapot = 'aktiv'", foglalasId, most);
  const r = await futtat(db, "UPDATE kuldesek SET allapot = 'torolve', ok = 'szalon_torolte' WHERE foglalas_id = ?1 AND allapot IN ('fuggoben', 'kuldes')", foglalasId);
  return { torolt: r.meta?.changes ?? 0 };
}

async function munkatarsIngest(db, env, cfg, level, tipus, most, opc) {
  if (cfg.munkatarsMod === 'ki') return { ok: false, miert: 'munkatars_mod_ki' }; // nem regisztralodik: a mod bekapcsolasa utan a level ujrakuldheto
  const forras = String(level.uzenetId || '') || null;
  const kuldve = Number(level.kuldve);
  const alapIdo = Number.isFinite(kuldve) && kuldve > 1.6e9 && kuldve <= most ? Math.floor(kuldve) : most;
  if (tipus === 'szalon_letrehozva') { // az uj (munkatarsi) idopont-letrehozas nem tartozik ide
    await naplo(db, most, 'ingest:kihagyva', null, forras, { miert: 'szalon_letrehozva' });
    return { ok: false, miert: 'letrehozas nem feldolgozott' };
  }
  if (!(await elsoFeldolgozas(db, forras, most))) return { ok: true, duplikalt: true };
  const mai = await elso(db, "SELECT COUNT(*) AS n FROM esemenyek WHERE tipus LIKE 'ingest:%' AND ido > ?1", most - NAP);
  if (mai && mai.n > cfg.napiPlafon) {
    if (forras) await futtat(db, "UPDATE esemenyek SET tipus = 'ingest:plafon' WHERE forras_id = ?1", forras);
    return { ok: false, miert: 'napi_plafon' };
  }
  try {
    return await munkatarsFeldolgoz(db, cfg, level, tipus, forras, most, alapIdo, opc);
  } catch (hiba) {
    if (forras) await futtat(db, "DELETE FROM esemenyek WHERE forras_id = ?1 AND tipus = 'ingest:feldolgozas'", forras);
    throw hiba;
  }
}

async function munkatarsFeldolgoz(db, cfg, level, tipus, forras, most, alapIdo, opc) {
  const veg = async (tipusNev, foglalasId, reszlet) => {
    if (forras) await futtat(db, 'UPDATE esemenyek SET tipus = ?2, foglalas_id = ?3, reszlet = ?4 WHERE forras_id = ?1', forras, tipusNev, foglalasId || null, JSON.stringify(reszlet || {}));
    else await naplo(db, most, tipusNev, foglalasId || null, null, reszlet);
  };
  const e = ertelmezMunkatars(level, alapIdo);
  if (!e.ok) {
    await veg('ingest:riasztas:ertelmezhetetlen', null, { miert: e.miert, targy: String(level.targy || '').replace(/:.*$/s, '').slice(0, 40) });
    return { ok: false, miert: e.miert, tipus: 'riasztas:ertelmezhetetlen' };
  }
  // szemelyes adat nelkul: uzletag, idopont, szolgaltatas, munkatars (a vendegnev nem kerul a naplora / a riasztasra)
  const resz = { esemeny: tipus, uzletag: e.uzletag, kezdet: e.kezdet, szolgaltatas: tisztaNev(e.szolgaltatas).slice(0, 80), munkatars: e.munkatars.slice(0, 60), mod: cfg.munkatarsMod };
  const figyel = cfg.munkatarsMod !== 'be';
  const riaszt = async (kod, extra = {}) => { await veg(`ingest:riasztas:${kod}`, extra.foglalasId, { ...resz, ...extra }); return { ok: true, tipus: `riasztas:${kod}`, kod, valtozas: false }; };
  const eloVizsgal = async (f) => {
    if (!opc.eloEllenorzes || !UUID_RE.test(f.id)) return { allapot: 'ismeretlen', miert: 'nincs_ellenorzes' };
    try { return await opc.eloEllenorzes({ fiok: f.fiok, id: f.id }); } catch { return { allapot: 'ismeretlen', miert: 'hiba' }; }
  };

  // 1) belso blokk - csak egyertelmu szabalyok
  const belso = belsoBlokk(e);
  if (belso) { await veg('ingest:ignored_internal', null, { ...resz, szabaly: belso }); return { ok: true, tipus: 'ignored_internal', szabaly: belso, valtozas: false }; }

  // 2) jeloltek: uzletag + kezdes + munkatars + szolgaltatas (modositasnal a regi kezdes ismeretlen: a vendegnev is szukit, az elo oldal bizonyit)
  const szK = szolgKulcs(e.szolgaltatas), mK = munkatarsKulcs(e.munkatars), nK = nevNorm(e.nev);
  let jeloltek;
  if (tipus === 'szalon_torolte') {
    const sorok = await mind(db, 'SELECT * FROM foglalasok WHERE uzletag = ?1 AND kezdet = ?2', e.uzletag, e.kezdet);
    const negy = sorok.filter((r) => szolgKulcs(r.szolgaltatas) === szK && munkatarsKulcs(r.munkatars) === mK);
    // csak az ELO (aktiv) foglalasok szamitanak jelöltnek: egy korabban lemondott foglalas (a slotot azota masnak adtak ki) nem teszi tobbertelmuve
    jeloltek = negy.filter((r) => r.allapot === 'aktiv');
    if (jeloltek.length === 0 && negy.some((r) => nK && nevNorm(r.nev) === nK)) { // a nevre mar nem aktiv foglalas: korabban feldolgozott torles / lemondas
      await veg('ingest:mar_feldolgozva', negy[0].id, { ...resz, allapot: negy[0].allapot });
      return { ok: true, tipus: 'mar_feldolgozva', duplikalt: true, valtozas: false };
    }
  } else {
    const sorok = await mind(db, "SELECT * FROM foglalasok WHERE uzletag = ?1 AND allapot = 'aktiv' AND kezdet > ?2", e.uzletag, alapIdo - 6 * 3600);
    jeloltek = sorok.filter((r) => szolgKulcs(r.szolgaltatas) === szK && munkatarsKulcs(r.munkatars) === mK && nK && nevNorm(r.nev) === nK);
    if (jeloltek.some((r) => r.kezdet === e.kezdet)) { await veg('ingest:mar_alkalmazva', jeloltek[0].id, resz); return { ok: true, tipus: 'mar_alkalmazva', duplikalt: true, valtozas: false }; }
  }
  if (jeloltek.length === 0) {
    // A Salonic "Beeső" helykitöltő vendég (DECISION #119: PONTOSAN ez a név) a belső blokkok (megbeszélés, szolgáltatási szünet, workshop...) és a bejáró vendégek neve: online foglalásunk
    // sosem lehet rá. Csak ha NINCS jelölt (egy "Beeső" nevű valódi online foglalás a rendes úton menne); állapotot nem változtat, SMS-t nem küld.
    if (beesoNev(e.nev)) {
      await veg('ingest:ignored_internal', null, { ...resz, szabaly: 'beeso_nev' });
      return { ok: true, tipus: 'ignored_internal', szabaly: 'beeso_nev', valtozas: false };
    }
    if (ismertSzolgaltatas(e.uzletag, e.szolgaltatas)) { // telefonon / kezzel felvett vendegidopont: nincs online foglalasunk, nem hiba
      await veg('ingest:nincs_online_foglalas', null, resz);
      return { ok: true, tipus: 'nincs_online_foglalas', valtozas: false };
    }
    return riaszt('ignored_uncertain'); // nem egyertelmuen belso es nem ismert vendeg-szolgaltatas
  }
  if (jeloltek.length > 1) return riaszt('tobbertelmu', { jeloltek: jeloltek.length });
  const f = jeloltek[0];
  if (!nK || nevNorm(f.nev) !== nK) return riaszt('nev_elteres', { foglalasId: f.id });

  if (tipus === 'szalon_torolte') {
    if (f.allapot !== 'aktiv') { await veg('ingest:mar_feldolgozva', f.id, { ...resz, allapot: f.allapot }); return { ok: true, tipus: 'mar_feldolgozva', duplikalt: true, valtozas: false }; }
    if (f.kezdet <= alapIdo) return riaszt('utolagos_torles', { foglalasId: f.id }); // D3 / D5: nincs automatikus no-show, csak naplo + riasztas
    const elo = await eloVizsgal(f);
    if (elo.allapot === 'aktiv') return riaszt('oldal_ellentmond', { foglalasId: f.id, oldal: 'aktiv' });
    if (elo.allapot !== 'torolve') return riaszt('nem_ellenorizheto', { foglalasId: f.id, miert: elo.miert });
    if (figyel) { await veg('ingest:figyel:szalon_torolte', f.id, resz); return { ok: true, tipus: 'figyel', volna: 'szalon_torolte', foglalasId: f.id, valtozas: false }; }
    const t = await szalonTorolte(db, f.id, most);
    await veg('ingest:szalon_torolte', f.id, { ...resz, torolt_uzenet: t.torolt });
    return { ok: true, tipus: 'szalon_torolte', foglalasId: f.id, valtozas: true, torolt: t.torolt };
  }

  // modositas
  if (e.kezdet <= alapIdo) return riaszt('multbeli_modositas', { foglalasId: f.id });
  const elo = await eloVizsgal(f);
  if (elo.allapot === 'torolve') return riaszt('oldal_ellentmond', { foglalasId: f.id, oldal: 'torolve' });
  if (elo.allapot !== 'aktiv') return riaszt('nem_ellenorizheto', { foglalasId: f.id, miert: elo.miert });
  if (!elo.startUnix) return riaszt('nem_bizonyithato', { foglalasId: f.id });
  if (elo.startUnix !== e.kezdet) return riaszt('oldal_ellentmond', { foglalasId: f.id, oldal_kezdet: elo.startUnix });
  const sms = e.kezdet - alapIdo <= 72 * 3600; // D4: "az uj idopontod" SMS csak bizonyitott modositasnal es 72 oran belul
  if (figyel) { await veg('ingest:figyel:szalon_athelyezte', f.id, { ...resz, sms }); return { ok: true, tipus: 'figyel', volna: 'szalon_athelyezte', foglalasId: f.id, valtozas: false }; }
  await futtat(db, "UPDATE foglalasok SET kezdet = ?2, modositva = ?3, megerositve = NULL WHERE id = ?1 AND allapot = 'aktiv'", f.id, e.kezdet, most);
  await tervMent(db, f.id, tervez({ uzletag: f.uzletag, szegmensek: String(f.szegmens || '').split(',').filter(Boolean), kezdet: e.kezdet }, alapIdo, { athelyezes: true }), { reset: ['t72', 't24'] });
  if (sms) {
    const n = (await elso(db, "SELECT COUNT(*) AS n FROM kuldesek WHERE foglalas_id = ?1 AND uzenet_id LIKE 'COMMON-RESCHEDULE-%'", f.id)).n;
    await azonnaliUzenetek(db, f.id, [`COMMON-RESCHEDULE-SMS#${n + 1}`], alapIdo);
  }
  await veg('ingest:szalon_athelyezte', f.id, { ...resz, regi_kezdet: f.kezdet, sms });
  return { ok: true, tipus: 'szalon_athelyezte', foglalasId: f.id, valtozas: true, sms };
}

// ---- kuldes (tick) -----------------------------------------------------------------------------------------------------------------------------
/**
 * Az esedekes uzenetek kikuldese. kuldok: { sms(adat), email(adat), egyenleg?() }. Visszaad egy osszegzest.
 * @param {{foglalasId?:string, limit?:number, base?:string}} [opc]  foglalasId: csak az o uzenetei (a befogadas utan azonnal)
 */
const ELO_TIPUSOK = new Set(['t72', 't24', 'tartalom']); // a T0 / lemondas / athelyezes uzenetek egy allapotvaltast koveto azonnali uzenetek: nincs ertelme elo ellenorzesnek
const ELO_PLAFON = 10; // tickenkent legfeljebb ennyi Salonic-oldal lekeres (parhuzamosan; a tobbi a mostani modon megy)
export async function tick(db, env, kuldok, most, opc = {}) {
  const cfg = beallitas(env);
  const base = opc.base || cfg.base;
  const ossz = { elkuldve: 0, kihagyva: 0, torolve: 0, hiba: 0, varakozik: 0 };
  const eloGyorsitotar = new Map(); const eloTorolt = new Set();
  const sorok = await mind(db,
    `SELECT k.id AS kid, k.foglalas_id, k.uzenet_id, k.csatorna, k.esedekes, k.probalkozas,
            f.uzletag, f.fiok, f.nev, f.keresztnev, f.telefon, f.email, f.szolgaltatas, f.szegmens, f.munkatars, f.kezdet, f.letrehozva, f.allapot, f.megerositve, f.token, f.teszt
       FROM kuldesek k JOIN foglalasok f ON f.id = k.foglalas_id
      WHERE k.allapot = 'fuggoben' AND k.esedekes <= ?1 ${opc.foglalasId ? 'AND k.foglalas_id = ?3' : ''}
      ORDER BY k.esedekes LIMIT ?2`, ...(opc.foglalasId ? [most, opc.limit || 25, opc.foglalasId] : [most, opc.limit || 25]));

  // elo ellenorzes (DECISION #117, D6) elokeszites: a kuldendo T-72 / T-24 / tartalmi uzenetek foglalasai (tickenkent legfeljebb ELO_PLAFON), parhuzamosan - a ciklus csak a gyorsitotarbol olvas
  if (opc.eloEllenorzes) {
    const jeloltek = [];
    for (const r of sorok) {
      if (jeloltek.length >= ELO_PLAFON) break;
      const uz0 = keres(r.uzletag, alapId(r.uzenet_id));
      if (!uz0 || !ELO_TIPUSOK.has(uz0.mikor.tipus) || r.allapot !== 'aktiv' || r.kezdet <= most || !UUID_RE.test(r.foglalas_id)) continue;
      if (!engedelyezett(cfg, { teszt: r.teszt, uzletag: r.uzletag }) || jeloltek.some((x) => x.id === r.foglalas_id)) continue;
      jeloltek.push({ id: r.foglalas_id, fiok: r.fiok });
    }
    await Promise.all(jeloltek.map(async (x) => {
      try { eloGyorsitotar.set(x.id, await opc.eloEllenorzes(x)); } catch { eloGyorsitotar.set(x.id, { allapot: 'ismeretlen' }); }
    }));
  }

  for (const r of sorok) {
    const lezar = async (allapot, ok, extra = {}) => {
      await futtat(db, 'UPDATE kuldesek SET allapot = ?2, ok = ?3, elkuldve = ?4, szolgaltato_id = ?5, szegmens_db = ?6, hiba = ?7 WHERE id = ?1', r.kid, allapot, ok || null, extra.elkuldve ?? null, extra.szolgaltato ?? null, extra.szegmens ?? null, extra.hiba ?? null);
      ossz[allapot === 'elkuldve' ? 'elkuldve' : allapot === 'kihagyva' ? 'kihagyva' : allapot === 'torolve' ? 'torolve' : 'hiba'] += 1;
    };
    const uz = keres(r.uzletag, alapId(r.uzenet_id));
    if (!uz) { await lezar('hiba', 'ismeretlen_uzenet'); continue; }
    const tipus = uz.mikor.tipus;
    const f = { ...r, id: r.foglalas_id, szegmens: String(r.szegmens || '').split(',').filter(Boolean) };

    if (tipus === 'lemondva') { /* a lemondott foglalasra is megy */ }
    else if (tipus === 'nem_jelent_meg') { /* ugyanez */ }
    else if (r.allapot !== 'aktiv') { await lezar('torolve', `allapot:${r.allapot}`); continue; }
    else if (r.kezdet <= most) { await lezar('torolve', 'az_idopont_elmult'); continue; }

    const t0szeru = ['t0', 'feladat_t0', 'lemondva', 'athelyezve', 'nem_jelent_meg'].includes(tipus);
    const plafon = t0szeru ? KESES_PLAFON.t0 : uz.csatorna === 'feladat' ? 6 * 3600 : KESES_PLAFON.egyeb;
    if (!engedelyezett(cfg, { teszt: r.teszt, uzletag: r.uzletag })) {
      if (most - r.esedekes > plafon) await lezar('kihagyva', 'nem_elo_mod:keso'); else ossz.varakozik += 1;
      continue;
    }
    if (most - r.esedekes > plafon) { await lezar('kihagyva', 'keso'); continue; }
    if (tipus === 't72' && r.megerositve && uz.csatorna === 'sms') { await lezar('kihagyva', 'mar_megerositve'); continue; }

    // elo ellenorzes (DECISION #117, D6): a foglalas nyilvanos Salonic-oldala. Torolt -> NEM megy ki semmi, a fuggo uzenetek torlodnek (azonnal eles);
    // a kezdes eltereset egyelore csak naplozzuk; nem ellenorizheto -> a mostani mukodes.
    if (opc.eloEllenorzes && ELO_TIPUSOK.has(tipus) && r.allapot === 'aktiv' && UUID_RE.test(r.foglalas_id)) {
      if (eloTorolt.has(r.foglalas_id)) continue;
      const v = eloGyorsitotar.get(r.foglalas_id);
      if (v && v.allapot === 'torolve') {
        eloTorolt.add(r.foglalas_id);
        const t = await szalonTorolte(db, r.foglalas_id, most);
        await naplo(db, most, 'elo:torolve', r.foglalas_id, `elo-torolve:${r.foglalas_id}`, { torolt_uzenet: t.torolt, uzletag: r.uzletag });
        ossz.torolve += t.torolt; ossz.eloTorolt = (ossz.eloTorolt || 0) + 1;
        continue;
      }
      if (v && v.allapot === 'aktiv' && v.startUnix && v.startUnix !== r.kezdet) {
        await naplo(db, most, 'elo:kezdes_eltero', r.foglalas_id, `elo-kezdes:${r.foglalas_id}:${v.startUnix}`, { db_kezdet: r.kezdet, oldal_kezdet: v.startUnix, uzletag: r.uzletag });
      }
    }

    // foglalas (claim): ket tick nem kuldheti ki ketszer
    const claim = await futtat(db, "UPDATE kuldesek SET allapot = 'kuldes', probalkozas = probalkozas + 1 WHERE id = ?1 AND allapot = 'fuggoben'", r.kid);
    if (claim.meta && claim.meta.changes === 0) continue;

    try {
      const ert = ertekek(f, uz.csatorna === 'sms' ? 'sms' : 'email', { base, most });
      let azon;
      if (uz.csatorna === 'sms') {
        if (!r.telefon) { await lezar('kihagyva', 'nincs_telefon'); continue; }
        if (!/^\+36(20|30|31|50|70)\d{7}$/.test(r.telefon)) { await lezar('kihagyva', 'nem_magyar_mobil'); continue; }
        const ki = smsKirajzol(uz, ert);
        const v = await kuldok.sms({ telefon: r.telefon, szoveg: ki.szoveg });
        await lezar('elkuldve', null, { elkuldve: most, szolgaltato: v?.id, szegmens: ki.szegmens });
      } else if (uz.csatorna === 'email') {
        if (!r.email) { await lezar('kihagyva', 'nincs_email'); continue; }
        const ki = emailKirajzol(uz, ert, { surgos: tipus === 't0' && surgos(r.kezdet, r.letrehozva) });
        const v = await kuldok.email({ to: r.email, targy: ki.targy, html: ki.html, szoveg: ki.szoveg, felado: UZLETAGAK[r.uzletag].nev, valasz: cfg.szalonEmail });
        await lezar('elkuldve', null, { elkuldve: most, szolgaltato: v?.id });
      } else { // feladat: belso level a szalonnak
        const ki = feladatKirajzol(uz, ert, f);
        const cimzett = r.teszt ? cfg.tesztFeladatEmail : cfg.szalonEmail;
        const v = await kuldok.email({ to: cimzett, targy: ki.targy, html: ki.html, szoveg: ki.szoveg, felado: 'MOSAIC emlékeztető', valasz: cfg.szalonEmail });
        await lezar('elkuldve', null, { elkuldve: most, szolgaltato: v?.id });
      }
    } catch (hiba) {
      const uzenet = String(hiba && hiba.message || hiba).slice(0, 240);
      if ((hiba && hiba.vegleges) || r.probalkozas + 1 >= 3) await lezar('hiba', 'kuldesi_hiba', { hiba: uzenet });
      else await futtat(db, "UPDATE kuldesek SET allapot = 'fuggoben', esedekes = ?2, hiba = ?3 WHERE id = ?1", r.kid, most + 300, uzenet);
    }
  }
  return { ...ossz, feldolgozott: sorok.length };
}

// ---- napi karbantartas -------------------------------------------------------------------------------------------------------------------------
/** Naponta egyszer: a megragadt kuldesek lezarasa, szemelyes adatok torlese 60 nappal az idopont utan, SMS-egyenleg figyelese. */
export async function napi(db, env, kuldok, most) {
  const cfg = beallitas(env);
  const ma = helyi(most).kulcs.slice(0, 10);
  const utolso = await elso(db, "SELECT ertek FROM beallitasok WHERE kulcs = 'napi_utolso'");
  if (utolso && utolso.ertek === ma) return { kihagyva: true };
  await futtat(db, "INSERT INTO beallitasok (kulcs, ertek, frissitve) VALUES ('napi_utolso', ?1, ?2) ON CONFLICT(kulcs) DO UPDATE SET ertek = ?1, frissitve = ?2", ma, most);
  const kimenet = {};
  // 15 percnel regebben "kuldes" allapotban ragadt: nem kuldjuk ujra (dupla uzenet veszelye), hibara tesszuk
  kimenet.megragadt = (await futtat(db, "UPDATE kuldesek SET allapot = 'hiba', ok = 'megszakadt' WHERE allapot = 'kuldes' AND esedekes < ?1", most - 900)).meta?.changes ?? 0;
  kimenet.anonimizalt = (await futtat(db, 'UPDATE foglalasok SET nev = NULL, keresztnev = NULL, telefon = NULL, email = NULL WHERE kezdet < ?1 AND (nev IS NOT NULL OR telefon IS NOT NULL OR email IS NOT NULL)', most - 60 * NAP)).meta?.changes ?? 0;
  await futtat(db, 'DELETE FROM esemenyek WHERE ido < ?1', most - 90 * NAP);
  if (kuldok && kuldok.egyenleg) {
    try {
      const e = await kuldok.egyenleg();
      kimenet.smsEgyenleg = e;
      if (Number.isFinite(e) && e < cfg.smsKuszob && kuldok.email) {
        await kuldok.email({ to: cfg.mod === 'teszt' ? cfg.tesztFeladatEmail : cfg.szalonEmail, felado: 'MOSAIC emlékeztető', targy: 'Alacsony SMS-egyenleg (SimpleSMS)', szoveg: `A SimpleSMS egyenleg: ${e}. Töltsd fel, mert az emlékeztető SMS-ek nélküle nem mennek ki.`, html: `<p>A SimpleSMS egyenleg: <b>${e}</b>. Töltsd fel, mert az emlékeztető SMS-ek nélküle nem mennek ki.</p>` });
        kimenet.egyenlegFigyelmeztetes = true;
      }
    } catch (hiba) { kimenet.egyenlegHiba = String(hiba && hiba.message || hiba).slice(0, 120); }
  }
  // a munkatarsi / utolagos-torlesi riasztasok napi osszesitoje (szemelyes adat nelkul): uzletag, idopont, szolgaltatas, munkatars
  try {
    const utolsoId = Number((await elso(db, "SELECT ertek FROM beallitasok WHERE kulcs = 'riasztas_digest_id'"))?.ertek || 0);
    const sorok = await mind(db, "SELECT id, ido, tipus, reszlet FROM esemenyek WHERE tipus LIKE 'ingest:riasztas:%' AND id > ?1 ORDER BY id LIMIT 60", utolsoId);
    if (sorok.length && kuldok && kuldok.email) {
      const sor = (x) => {
        let r = {}; try { r = JSON.parse(x.reszlet || '{}'); } catch { /* sertett reszlet */ }
        const ugyfel = r.kezdet ? `${helyi(r.kezdet).kulcs} · ${r.uzletag || '?'} · ${r.szolgaltatas || '?'} · ${r.munkatars || '?'}` : `${r.uzletag || '?'}`;
        return `- ${x.tipus.replace('ingest:riasztas:', '')}: ${ugyfel}${r.miert ? ` (${r.miert})` : ''}`;
      };
      const szoveg = `A Salonic-változások feldolgozásánál ${sorok.length} esetben nem változtattunk semmit, és kézi ellenőrzés kell (a vendég nem kapott üzenetet, az időpont állapota nem módosult):\n\n${sorok.map(sor).join('\n')}\n\nMagyarázat: ignored_uncertain = nem egyértelműen belső blokk és nem ismert szolgáltatás; tobbertelmu = több foglalás illik rá; nev_elteres = a név nem egyezik; oldal_ellentmond / nem_ellenorizheto / nem_bizonyithato = a Salonic-oldal nem erősíti meg; utolagos_torles = az időpont után törölt foglalás (nincs automatikus no-show); multbeli_modositas = múltbeli időpont módosítása; ertelmezhetetlen = a levél formája eltér a megszokottól.`;
      await kuldok.email({ to: cfg.mod === 'teszt' ? cfg.tesztFeladatEmail : cfg.szalonEmail, felado: 'MOSAIC emlékeztető', targy: `Salonic-változások: ${sorok.length} kézi ellenőrzést igénylő eset`, szoveg });
      await futtat(db, "INSERT INTO beallitasok (kulcs, ertek, frissitve) VALUES ('riasztas_digest_id', ?1, ?2) ON CONFLICT(kulcs) DO UPDATE SET ertek = ?1, frissitve = ?2", String(sorok[sorok.length - 1].id), most);
      kimenet.riasztasOsszesito = sorok.length;
    }
  } catch (hiba) { kimenet.riasztasHiba = String(hiba && hiba.message || hiba).slice(0, 120); }
  return kimenet;
}

// ---- vendeg-linkek -----------------------------------------------------------------------------------------------------------------------------
/** /m/<token>: a vendeg megerositi az idopontjat. */
export async function megerosit(db, token, most) {
  const f = await elso(db, 'SELECT * FROM foglalasok WHERE token = ?1', String(token || ''));
  if (!f) return { ok: false };
  if (f.allapot === 'aktiv' && !f.megerositve) await futtat(db, 'UPDATE foglalasok SET megerositve = ?2 WHERE id = ?1', f.id, most);
  return { ok: true, f };
}

/** /f/<token>: a foglalas adatai az "A foglalasod" oldalhoz (a Salonic-oldal URL-je csak a mi oldalunkba agyazva jelenik meg; szintetikus azonositonal nincs). */
export async function foglalasNezet(db, token) {
  const f = await elso(db, 'SELECT id, uzletag, fiok, allapot, kezdet, szolgaltatas, token FROM foglalasok WHERE token = ?1', String(token || ''));
  if (!f) return null;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(f.id);
  return { ...f, salonicUrl: uuid ? `https://${f.fiok}.salonic.hu/booking/bookingDetails/${f.id}` : null };
}

/** /f/<token>: a Salonic vendeg-oldalara visz (reszletek / modositas / lemondas); szintetikus azonositonal az uzletag oldalara. */
export async function reszletekUrl(db, token) {
  const f = await elso(db, 'SELECT id, uzletag, fiok FROM foglalasok WHERE token = ?1', String(token || ''));
  if (!f) return null;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(f.id)) return `https://${f.fiok}.salonic.hu/booking/bookingDetails/${f.id}`;
  return UZLETAGAK[f.uzletag].foglalasUrl;
}

// ---- allapot (szemelyes adat nelkul) -----------------------------------------------------------------------------------------------------------
export async function allapot(db, env, most) {
  const cfg = beallitas(env);
  const foglalasok = await mind(db, 'SELECT allapot, COUNT(*) AS db FROM foglalasok GROUP BY allapot');
  const kuldesek = await mind(db, 'SELECT allapot, COUNT(*) AS db FROM kuldesek GROUP BY allapot');
  const kovetkezo = await mind(db, "SELECT uzenet_id, esedekes FROM kuldesek WHERE allapot = 'fuggoben' ORDER BY esedekes LIMIT 10");
  const hibak = await mind(db, "SELECT uzenet_id, ok, hiba FROM kuldesek WHERE allapot = 'hiba' ORDER BY id DESC LIMIT 5");
  const esemenyek = await mind(db, 'SELECT ido, tipus FROM esemenyek ORDER BY id DESC LIMIT 8');
  const munkatarsEsemenyek = await mind(db, "SELECT tipus, COUNT(*) AS db FROM esemenyek WHERE tipus LIKE 'ingest:riasztas:%' OR tipus LIKE 'ingest:figyel:%' OR tipus LIKE 'ingest:szalon_%' OR tipus IN ('ingest:ignored_internal', 'ingest:nincs_online_foglalas', 'ingest:mar_alkalmazva', 'ingest:mar_feldolgozva') OR tipus LIKE 'elo:%' GROUP BY tipus ORDER BY tipus");
  return {
    mod: cfg.mod, eloUzletagok: [...cfg.elo], most,
    munkatarsMod: cfg.munkatarsMod, noShowAuto: cfg.noShowAuto, eloEllenorzes: String(env.LIFECYCLE_ELO_ELLENORZES || '').toLowerCase() !== 'ki',
    munkatarsEsemenyek: Object.fromEntries(munkatarsEsemenyek.map((x) => [x.tipus, x.db])),
    foglalasok: Object.fromEntries(foglalasok.map((x) => [x.allapot, x.db])), kuldesek: Object.fromEntries(kuldesek.map((x) => [x.allapot, x.db])),
    kovetkezo, hibak, esemenyek,
  };
}
