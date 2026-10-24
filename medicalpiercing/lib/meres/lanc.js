// MEDICAL PIERCING foglalas-meres lanca: koszonooldal -> /api/mp-foglalas (Pages Function) -> sajat D1-rekord
// (MP_MERES_DB, "mp-meres") -> deduplikacio a foglalasi kulcson -> Google Ads ARNYEK-feltoltes (google-ads.js).
//
// Mindket foglalasi utra ugyanaz: a mai Salonic-ut (a Salonic a /foglalas-ok*-ra, a divat fulpiercingnel a /fulbevalo-ok*-ra iranyit a bookingUrl / price /
// first_booking parameterekkel) es kesobb a beagyazott motor (ugyanarra a koszonooldalra, ugyanazokkal a
// parameterekkel, plusz booking_id). A kulcs mindket uton placeId|employeeId|startUnix (meres.js foglalasKulcs).
//
// Adatvedelem (MP-16): a bongeszo a szolgaltatas nevet / kategoriat / vendegazonositot NEM kuldi ide; a rekordban
// sincs nev, e-mail, telefon, szolgaltatasszoveg vagy egeszsegugyi piercing-tipus (csak a 'ful' = divat fulpiercing jeloles, meres.js
// TAROLHATO_TIPUSOK; kifele az sem megy). Kattintasazonosito csak hirdetesi
// hozzajarulassal kerul a rekordba (es megy a Google-nek); naploba / riportba csak maszkolva (h:xxxxxxxx).
import { koszonoOldal, foglalasKulcs, ertekFeloldas, tarolhatoTipus, HELYSZINEK, MP_SALONIC_HOST, FUL_UT } from './meres.js';
import { levelErtelmezes } from './igazolas.js';
import { akciokFoglalashoz, hozzajarulas, kattintasValaszt, konverzio, kuldes, elesKuldesE, maszk, ELES_HOST } from './google-ads.js';
import { forrasPlatform, onbevallasErtek, platformAzonositok, vanPlatformId, URES_PLATFORM_ID } from './forras.js';
import { tiktokLepes, tiktokMod, hatalyosMod, TIKTOK_SEMA } from './tiktok.js';
import { metaArnyekLepes, ARNYEK_SEMA } from './meta.js';
/** IP + user agent a foglalas pillanatabol, legfeljebb 48 oraig (TikTok-kuldeshez). Vendegnev / e-mail / telefon NINCS. */
export const KONTEXTUS_SEMA = 'CREATE TABLE IF NOT EXISTS mp_kontextus (kulcs TEXT PRIMARY KEY, ip TEXT, ua TEXT, ido INTEGER NOT NULL, ext TEXT)';
import { tipusSzamlal } from './tipus-stat.js';
import { lemondasErtelmezes, lemondasRogzites } from './lemondas.js';
import { bizonyitekBemenet, bizonyitekValaszt, bizonyitekForrasTarolo, diagBemenet, platformBizonyitekbol, cimkez, markasListaOlvas, FORRAS_VERZIO, lptOlvas, lptAzonositok } from './cimke.js';

export const SEMA = [
  `CREATE TABLE IF NOT EXISTS mp_foglalas (
    kulcs TEXT PRIMARY KEY, salonic_id TEXT, forras TEXT NOT NULL, kornyezet TEXT NOT NULL, letrehozva INTEGER NOT NULL,
    ertek INTEGER, ertek_forras TEXT, uj_vendeg INTEGER, helyszin TEXT,
    hozzajarulas_dontott INTEGER NOT NULL, hozzajarulas_hirdetes INTEGER NOT NULL, hozzajarulas_analitika INTEGER NOT NULL,
    kattintas_tipus TEXT, kattintas_ertek TEXT, kattintas_ido INTEGER)`,
  `CREATE TABLE IF NOT EXISTS mp_feltoltes (
    kulcs TEXT NOT NULL, akcio_id TEXT NOT NULL, mod TEXT NOT NULL, kuldo TEXT, allapot TEXT NOT NULL, http_status INTEGER,
    valasz TEXT, kattintas_maszk TEXT, probalkozas INTEGER NOT NULL DEFAULT 1, ido INTEGER NOT NULL,
    PRIMARY KEY (kulcs, akcio_id, mod))`,
  'CREATE INDEX IF NOT EXISTS mp_foglalas_ido ON mp_foglalas (letrehozva)',
  // Salonic-igazolas (igazolas.js): a Salonic "Uj online foglalas" levelebol, nev/telefon/e-mail NELKUL
  `CREATE TABLE IF NOT EXISTS mp_salonic_igazolas (
    booking_id TEXT PRIMARY KEY, employee_ids TEXT, start_unix INTEGER NOT NULL, uj_paciens INTEGER, erkezett INTEGER NOT NULL,
    rogzitve INTEGER NOT NULL, kulcs TEXT)`,
  'CREATE INDEX IF NOT EXISTS mp_salonic_igazolas_start ON mp_salonic_igazolas (start_unix)',
  'CREATE TABLE IF NOT EXISTS mp_beallitas (kulcs TEXT PRIMARY KEY, ertek TEXT)',
  // Google Ads konverzio-kiigazitas (kiigazitas.js): kulcs + tipus + mod egyszer; ok = a dontes oka, valasz = rovidített Google-valasz
  `CREATE TABLE IF NOT EXISTS mp_kiigazitas (
    kulcs TEXT NOT NULL, tipus TEXT NOT NULL, mod TEXT NOT NULL, allapot TEXT NOT NULL, ok TEXT, valasz TEXT,
    probalkozas INTEGER NOT NULL DEFAULT 0, ido INTEGER NOT NULL, PRIMARY KEY (kulcs, tipus, mod))`,
  // TikTok Events API "Schedule" (tiktok.js): kulcsonkent egy sor; alapertelmezes CSAK NAPLO (maszkolt torzs, halozati hivas nincs)
  TIKTOK_SEMA,
];
// a mar letezo mp_foglalas tablat bovito oszlopok: csak a hianyzot adjuk hozza (PRAGMA table_info), a meglevo sorok maradnak
export const BOVITES = [
  ['igazolas', 'TEXT'], // NULL = rogzitett, meg nem igazolt | 'igazolt' | 'nem_igazolt'
  ['igazolas_id', 'TEXT'], // a Salonic foglalasi azonosito
  ['foglalas_ido', 'INTEGER'], // a Salonic-level ideje = a foglalas ideje (konverzios ido)
  ['uj_vendeg_igazolt', 'INTEGER'], // 1 = a Salonic szerint meg sosem foglalt; NULL = ismeretlen
  // forras.js: hozzajarulastol fuggetlen csatornanev (google|meta|tiktok|egyeb, NULL = ismeretlen / kozvetlen) es az onbevallas
  ['forras_platform', 'TEXT'],
  ['onbevallas', 'TEXT'], // tiktok|meta|google|ismeros|egyeb
  // CSAK hirdetesi hozzajarulassal; most sehova nem mennek (90 nap utan torlodnek)
  ['meta_fbc', 'TEXT'], ['meta_fbp', 'TEXT'], ['meta_kattintas_ido', 'INTEGER'],
  ['tiktok_ttclid', 'TEXT'], ['tiktok_ttp', 'TEXT'], ['tiktok_kattintas_ido', 'INTEGER'],
  // forras v2 (cimke.js): hozzajarulas NELKUL is, minimalis, tisztitott bizonyitek (kattintasazonosito-ERTEK nincs benne)
  ['utm_source', 'TEXT'], ['utm_medium', 'TEXT'], ['utm_campaign', 'TEXT'], ['utm_term', 'TEXT'], ['utm_content', 'TEXT'],
  ['kattintas_param', 'TEXT'], // gclid|gbraid|wbraid|fbclid|ttclid: csak a TIPUS
  ['referrer_kat', 'TEXT'], // search|social|egyeb|nincs (a hivatkozo tartomanyabol; URL nincs)
  ['forras_ido', 'INTEGER'], // a nyertes erintes ideje
  ['forras_verzio', 'TEXT'], // 'mp_v2'
  ['forras_keret', 'INTEGER'], // 1 = a jelzes keretbol (regi beagyazott Salonic-naptar) jott
  ['bizonyitek_forras', 'TEXT'], // munkamenet|latogatas (2 oras localStorage-tarolo)|suti (mp_lpt, csak hozzajarulassal)
  ['forras_cimke', 'TEXT'], // meta|tiktok|google_nem_markas|google_markas|organikus_direkt|ismeretlen (cimkez())
  ['ismeretlen_ok', 'TEXT'], // nincs_jel|iframe_munkamenet|hianyos_utm|regi_kliens
  ['lpt_jelzes', 'TEXT'], // mp_lpt suti: 'kesoi:<platform>:<nap>' (8-30 napos fizetett kattintas, cimket nem ad) | 'azonosito:<google,meta,tiktok>' (a suti potolta)
  ['cimke_megjegyzes', 'TEXT'], // organikus_kereso|organikus_social|direkt|... |markas_lista_hianyzik|nincs_kampany_id
  ['tipus', 'TEXT'], // 'ful' = divat fulpiercing (/fulbevalo-ok*); NULL = minden mas. Egeszsegugyi tipus SOHA (meres.js tarolhatoTipus)
  // "nincs_jel" diagnosztika (cimke.js diagBemenet; szemelyes adat / URL nelkul)
  ['diag_oldalak', 'INTEGER'], // a lapon (munkamenetben) latott sajat oldalak szama, a koszonooldallal egyutt
  ['diag_nav', 'TEXT'], // az elozo oldal (ennek hianyaban a koszonooldal) navigacios tipusa: navigate|reload|back_forward|prerender
  ['diag_opener', 'INTEGER'], // 1 = a munkamenet elso oldalan volt window.opener
  ['diag_elso_ref', 'TEXT'], // a munkamenet elso oldalanak hivatkozo-KATEGORIAJA: belso|kereso|social|egyeb|nincs
];
/** A nyers platform-azonosito oszlopok (admin-valaszban maszkolva, 90 nap utan NULL). */
const PLATFORM_ID_OSZLOPOK = ['meta_fbc', 'meta_fbp', 'tiktok_ttclid', 'tiktok_ttp'];
/** Ennyi ido utan a meg nem igazolt sor 'nem_igazolt' lesz (a Salonic-level / Zapier kesese ennel joval rovidebb). */
export const IGAZOLAS_HATARIDO = 48 * 3600;
const MEGORZES_NAP = 120; // a rekord ennyi nap utan torlodik; a kattintasazonosito 90 nap utan (a Google ennyit fogad)

let semaKesz = false;
export function _semaTorles() { semaKesz = false; }
export async function semaBiztos(db) { return sema(db); }
async function sema(db) {
  if (semaKesz) return;
  await db.batch(SEMA.map((s) => db.prepare(s)));
  const ti = await db.prepare('PRAGMA table_info(mp_foglalas)').all();
  const van = new Set(((ti && ti.results) || []).map((o) => o.name));
  for (const [nev, tipus] of BOVITES) {
    if (van.has(nev)) continue;
    try { await db.prepare(`ALTER TABLE mp_foglalas ADD COLUMN ${nev} ${tipus}`).run(); } catch (e) {
      if (!/duplicate column/i.test(String(e && e.message || e))) throw e; // parhuzamos keres mar hozzaadta
    }
  }
  semaKesz = true;
}

/**
 * A TikTok-lepes (tiktok.js) a Google-feltoltestol FUGGETLENUL, sajat hibakezelessel: a Google-lancot nem zavarhatja.
 * Alapertelmezes: csak naplo (mp_tiktok_feltoltes), halozati hivas nincs.
 */
function tiktokInditas(db, sor, env, host, opts, waitUntil) {
  let p;
  try { p = tiktokLepes(db, sor, env, host, opts).catch((e) => console.error('mp-meres: tiktok hiba', String(e && e.message || e).slice(0, 200))); } catch (e) { return Promise.resolve(); }
  if (typeof waitUntil === 'function') { waitUntil(p); return Promise.resolve(); }
  return p;
}

/**
 * Salonic-forrasu (nem motoros) foglalas, amely nem lett Salonic-igazolt: a TikTok-lepes (tiktokInditas) csak igazolaskor indul, ezert eddig NEM maradt nyoma.
 * Itt `kihagyva:nem_igazolt` naplosor keszul a mp_tiktok_feltoltes tablaba (payload nelkul, ugyanazzal a tiktokLepes-szel, mint minden mas kihagyas). KULDES NEM VALTOZIK:
 * csak naplo; a sor kesobbi igazolas eseten felulirhato (tiktokLepes: a kihagyva-sor nem akadaly), ki modban semmi nem tortenik. Idempotens (csak a naplosor nelkuli sorok),
 * a hiba elnyelt. Jelolt: a 48 oras hatarido utan meg igazolatlan (a karbantartas ezt `nem_igazolt`-ra allitja) VAGY mar `nem_igazolt` sor, legfeljebb 14 napos, naplosor nelkul.
 */
export async function nemIgazoltNaplo(db, env, host, { most, fetchImpl } = {}) {
  try {
    if (hatalyosMod(await tiktokMod(db), env, host) === 'ki') return { naplozva: 0 };
    await db.prepare(TIKTOK_SEMA).run();
    const sorok = (await db.prepare(`SELECT * FROM mp_foglalas f WHERE f.kornyezet = 'eles' AND f.forras = 'salonic' AND f.letrehozva >= ?1
      AND ((f.igazolas IS NULL AND f.letrehozva < ?2) OR f.igazolas = 'nem_igazolt')
      AND NOT EXISTS (SELECT 1 FROM mp_tiktok_feltoltes t WHERE t.kulcs = f.kulcs) ORDER BY f.letrehozva LIMIT 200`).bind(most - 14 * 86400, most - IGAZOLAS_HATARIDO).all()).results || [];
    let n = 0;
    for (const sor of sorok) {
      const r = await tiktokLepes(db, { ...sor, igazolas: 'nem_igazolt' }, env, host, { fetchImpl, most });
      if (r && r.kihagyva && r.kihagyva !== 'mar_rogzitve') n += 1;
    }
    return { naplozva: n };
  } catch (e) { console.error('mp-meres: nem_igazolt naplo hiba', String(e && e.message || e).slice(0, 200)); return { naplozva: 0 }; }
}

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

/**
 * A bongeszo csak ezeket kuldi (assets/js/mp-meres.js): { ut, p: { bookingUrl, price, first_booking, booking_id, placeId,
 * employeeId, startDate, serviceId }, kattintas: { gclid|gbraid|wbraid: { ertek, ido } } }. Minden mas mezot eldobunk.
 */
/** A kesoi hozzajarulas potlasanak ablaka: ennyi masodpercen belul letrejott sor egeszitheto ki. */
export const POTLAS_ABLAK = 2 * 3600;
const ENGEDETT_P = ['bookingUrl', 'price', 'first_booking', 'booking_id', 'placeId', 'employeeId', 'startDate', 'serviceId'];
export function bemenet(b) {
  if (!b || typeof b !== 'object') return null;
  // a divat fulpiercing koszonooldala (/fulbevalo-ok, -ok2, -ok3) a semleges /fulbevalo-ok-ra egyszerusodik
  const ut = FUL_UT.test(String(b.ut || '')) ? '/fulbevalo-ok' : /^\/foglalas-ok[a-z0-9-]*\/?$/i.test(String(b.ut || '')) ? String(b.ut) : '/foglalas-ok';
  const q = new URLSearchParams();
  for (const k of ENGEDETT_P) if (b.p && b.p[k] != null && String(b.p[k]).length <= 600) q.set(k, String(b.p[k]));
  // a bookingUrl csak a Salonic MP-aldomainje lehet
  if (q.has('bookingUrl')) {
    try { if (new URL(q.get('bookingUrl'), `https://${MP_SALONIC_HOST}/`).hostname !== MP_SALONIC_HOST) q.delete('bookingUrl'); } catch (e) { q.delete('bookingUrl'); }
  }
  return { url: `https://${ELES_HOST}${ut}?${q}`, bookingId: q.get('booking_id'), kattintas: b.kattintas && typeof b.kattintas === 'object' ? b.kattintas : null, potlas: b.potlas === true,
    forrasPlatform: forrasPlatform(b.forras_platform),
    // forras v2: a munkamenet erintese (tisztitva; a hivo a "most"-tal meg egyszer ellenorzi) es a keret-jelzes
    forras: b.forras && typeof b.forras === 'object' && b.forras.v === FORRAS_VERZIO ? b.forras : null,
    forrasV2: !!(b.forras && typeof b.forras === 'object' && b.forras.v === FORRAS_VERZIO) || b.forras_v === FORRAS_VERZIO,
    keret: b.keret === true,
    // sajat latogato-azonosito (assets/js/suti.js mp_vid): csak ervenyes UUID; a szerver csak a SHA-256 lenyomatat hasznalja
    vid: typeof b.vid === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(b.vid) ? b.vid.toLowerCase() : null,
    // a munkamenet-erintes a 2 oras latogatas-tarolobol jott-e (assets/js/mp-meres.js 6. pont), es a "nincs_jel" diagnosztika
    forrasTarolo: b.forras_tarolo === 'latogatas' ? 'latogatas' : 'munkamenet',
    diag: diagBemenet(b.diag) };
}

/**
 * POST /api/mp-foglalas. ctx: { request, env, waitUntil? }, opciok: { fetchImpl, most } (tesztekhez).
 * Valasz: { ok, uj: bool (elso rogzites), kulcs? } - a bongeszo semmire nem var, hiba eseten is 2xx/4xx JSON.
 */
export async function foglalasErkezes({ request, env = {}, waitUntil }, { fetchImpl = fetch, most = Math.floor(Date.now() / 1000), arlista = {} } = {}) {
  if (String(env.MP_MERES_KI || '') === '1') return json({ ok: false, ki: true }, 503);
  const db = env.MP_MERES_DB;
  if (!db) return json({ ok: false, hiba: 'nincs_adatbazis' }, 503);
  let b; try { b = await request.json(); } catch (e) { return json({ ok: false, hiba: 'rossz_keres' }, 400); }
  const be = bemenet(b);
  if (!be) return json({ ok: false, hiba: 'rossz_keres' }, 400);
  const k = koszonoOldal(be.url);
  if (!k.ok) return json({ ok: false, hiba: k.hiba }, 422);
  const a = k.adat;
  const host = new URL(request.url).hostname;
  const cookie = request.headers.get('cookie') || '';
  const hozz = hozzajarulas(cookie);
  let katt = hozz.hirdetes ? kattintasValaszt(be.kattintas, cookie, most) : null;
  // Meta / TikTok azonositok: CSAK hirdetesi hozzajarulassal (kulonben mind NULL)
  const plat = hozz.hirdetes ? platformAzonositok(be.kattintas, cookie, most) : { ...URES_PLATFORM_ID };
  // mp_lpt suti (Feri 2026-10-19 21:51): a 7 napon beluli fizetett kattintas nyers azonositoja a HIANYZO mezoket potolja
  // (a bongeszobol / platform-sutikbol jott erteket soha nem irja felul), hogy a kesobb visszatero foglalonal is meglegyen.
  const lptPotolt = [];
  try { // fail-open: a suti-potlas hibaja soha nem allithatja meg a foglalas rogziteset
    const lptAz = hozz.hirdetes ? lptAzonositok(lptOlvas(cookie, most)) : lptAzonositok(null);
    if (!katt && lptAz.google) { katt = lptAz.google; lptPotolt.push('google'); }
    if (!plat.meta_fbc && lptAz.meta_fbc) { plat.meta_fbc = lptAz.meta_fbc; plat.meta_kattintas_ido = lptAz.meta_kattintas_ido; lptPotolt.push('meta'); }
    if (!plat.tiktok_ttclid && lptAz.tiktok_ttclid) { plat.tiktok_ttclid = lptAz.tiktok_ttclid; plat.tiktok_kattintas_ido = lptAz.tiktok_kattintas_ido; lptPotolt.push('tiktok'); }
  } catch (e) { console.error('mp-meres: lpt potlas hiba', String(e && e.message || e).slice(0, 120)); }
  const ert = ertekFeloldas(a, arlista);
  const kulcs = foglalasKulcs(a);
  // forras v2: munkamenet-erintes (hozzajarulastol fuggetlen), fizetett erintes hianyaban hozzajarulassal az mp_lpt suti
  const valasztott = bizonyitekValaszt(bizonyitekBemenet(be.forras, most), cookie, hozz.hirdetes, most);
  const biz = valasztott.bizonyitek;
  const bizonyitek_forras = bizonyitekForrasTarolo(valasztott.bizonyitek_forras, be.forrasTarolo);
  const v2 = be.forrasV2 || !!biz;
  const forrasMezok = {
    utm_source: biz ? biz.utm_source : null, utm_medium: biz ? biz.utm_medium : null, utm_campaign: biz ? biz.utm_campaign : null,
    utm_term: biz ? biz.utm_term : null, utm_content: biz ? biz.utm_content : null, kattintas_param: biz ? biz.kattintas_param : null,
    referrer_kat: biz ? biz.referrer_kat : null, forras_ido: biz ? biz.forras_ido : null, forras_verzio: v2 ? FORRAS_VERZIO : null,
    forras_keret: be.keret ? 1 : 0, bizonyitek_forras,
    lpt_jelzes: valasztott.kesoi || (lptPotolt.length ? `azonosito:${lptPotolt.join(',')}` : null),
  };
  const sor = {
    kulcs, salonic_id: be.bookingId || null, forras: be.bookingId ? 'motor' : 'salonic', kornyezet: host === ELES_HOST ? 'eles' : 'elonezet', letrehozva: most,
    ertek: ert.ertek, ertek_forras: ert.ertek_forras, uj_vendeg: a.ujVendeg === true ? 1 : a.ujVendeg === false ? 0 : null, helyszin: HELYSZINEK[a.placeId] || null,
    hozzajarulas_dontott: hozz.dontott ? 1 : 0, hozzajarulas_hirdetes: hozz.hirdetes ? 1 : 0, hozzajarulas_analitika: hozz.analitika ? 1 : 0,
    kattintas_tipus: katt ? katt.tipus : null, kattintas_ertek: katt ? katt.ertek : null, kattintas_ido: katt ? katt.ido : null,
    forras_platform: biz ? platformBizonyitekbol(biz) : be.forrasPlatform, ...plat, ...forrasMezok,
    tipus: tarolhatoTipus(a.tipus), ...be.diag,
  };
  try {
    await sema(db);
    Object.assign(sor, cimkez(sor, await markasListaOlvas(db)));
    const oszl = Object.keys(sor);
    const r = await db.prepare(`INSERT OR IGNORE INTO mp_foglalas (${oszl.join(',')}) VALUES (${oszl.map(() => '?').join(',')})`).bind(...oszl.map((o) => sor[o])).run();
    const uj = !!(r && r.meta && r.meta.changes);
    if (!uj) {
      // Kesoi hozzajarulas potlasa (assets/js/mp-meres.js): CSAK ha a bongeszo potlasnak jelolte, a suti szerint MOST van hirdetesi
      // hozzajarulas es ervenyes azonosito, a sor meg azonosito nelkuli, POTLAS_ABLAK-on belul jott letre, es ugyanaz a booking_id
      // (salonic-uton mindketto ures). Igy mas foglalashoz nem kotheto, meglevo erteket nem ir felul, ismetelt hivas 0 sort modosit.
      if (!be.potlas || !(katt || vanPlatformId(plat))) return json({ ok: true, uj: false });
      // Meta / TikTok: ugyanazok a feltetelek; csak a meg teljesen ures (Meta + TikTok) azonositoju sor egeszitheto ki
      let platPotolva = false;
      if (vanPlatformId(plat)) {
        const up = await db.prepare(`UPDATE mp_foglalas SET meta_fbc = ?, meta_fbp = ?, meta_kattintas_ido = ?, tiktok_ttclid = ?, tiktok_ttp = ?, tiktok_kattintas_ido = ?,
          hozzajarulas_dontott = 1, hozzajarulas_hirdetes = 1, hozzajarulas_analitika = ?
          WHERE kulcs = ? AND meta_fbc IS NULL AND meta_fbp IS NULL AND tiktok_ttclid IS NULL AND tiktok_ttp IS NULL AND letrehozva >= ? AND salonic_id IS ? AND kornyezet = ?`)
          .bind(plat.meta_fbc, plat.meta_fbp, plat.meta_kattintas_ido, plat.tiktok_ttclid, plat.tiktok_ttp, plat.tiktok_kattintas_ido, hozz.analitika ? 1 : 0,
            kulcs, most - POTLAS_ABLAK, be.bookingId || null, sor.kornyezet).run();
        platPotolva = !!(up && up.meta && up.meta.changes);
      }
      if (platPotolva) {
        // kesoi hozzajarulas: ha a sor mar Salonic-igazolt, a TikTok-lepes most indul (kulcsonkent egyszer)
        try {
          const ts = await db.prepare('SELECT * FROM mp_foglalas WHERE kulcs = ?').bind(kulcs).first();
          if (ts && ts.igazolas === 'igazolt') await tiktokInditas(db, ts, env, host, { fetchImpl, most }, waitUntil);
        } catch (e) { console.error('mp-meres: tiktok potlas hiba', String(e && e.message || e).slice(0, 200)); }
      }
      if (!katt) return json({ ok: true, uj: false, potolva: platPotolva });
      const u = await db.prepare(`UPDATE mp_foglalas SET kattintas_tipus = ?, kattintas_ertek = ?, kattintas_ido = ?, hozzajarulas_dontott = 1, hozzajarulas_hirdetes = 1, hozzajarulas_analitika = ?
        WHERE kulcs = ? AND kattintas_ertek IS NULL AND letrehozva >= ? AND salonic_id IS ? AND kornyezet = ?`)
        .bind(katt.tipus, katt.ertek, katt.ido, hozz.analitika ? 1 : 0, kulcs, most - POTLAS_ABLAK, be.bookingId || null, sor.kornyezet).run();
      if (!(u && u.meta && u.meta.changes)) return json({ ok: true, uj: false, potolva: platPotolva });
      const frissSor = await db.prepare('SELECT * FROM mp_foglalas WHERE kulcs = ?').bind(kulcs).first();
      // a kesoi hozzajarulassal erkezett kattintasazonosito a cimket is valtoztathatja (last paid click) -> ujraszamolas
      try {
        const c = cimkez(frissSor, await markasListaOlvas(db));
        if (c.forras_cimke !== frissSor.forras_cimke || c.cimke_megjegyzes !== frissSor.cimke_megjegyzes) {
          await db.prepare('UPDATE mp_foglalas SET forras_cimke = ?, ismeretlen_ok = ?, cimke_megjegyzes = ? WHERE kulcs = ?').bind(c.forras_cimke, c.ismeretlen_ok, c.cimke_megjegyzes, kulcs).run();
          Object.assign(frissSor, c);
        }
      } catch (e) { /* a cimke nem allithatja meg a feltoltest */ }
      const pf = feltoltes(db, frissSor, env, host, { fetchImpl, most }).catch((e) => console.error('mp-meres: potlo feltoltes hiba', String(e && e.message || e).slice(0, 200)));
      if (typeof waitUntil === 'function') waitUntil(pf); else await pf;
      return json({ ok: true, uj: false, potolva: true });
    }
    // Belso tipusstatisztika (tipus-stat.js, Feri 2026-10-14): kulcs nelkuli napi szamlalo, a tipus a sorba NEM kerul
    await tipusSzamlal(db, sor, a.tipus);
    // Meta arnyekmeres (meta.js, Feri 2026-10-14): az uj foglalasrol azonnal, a bongeszo user agentjevel (NEM taroljuk),
    // a kampanyban nem hasznalt ARNYEK adathalmazba. Fuggetlen, sajat hibakezelessel; a lancot nem allithatja meg.
    try {
      const ip = request.headers.get('cf-connecting-ip') || '';
      const vid = be.vid || ((cookie.match(/(?:^|;\s*)mp_vid=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i) || [])[1] || '').toLowerCase() || null;
      const ext = vid ? await sha256hex(vid) : null; // external_id: a veletlen latogato-azonosito lenyomata
      // a TikTok-kuldes az igazolaskor tortenik (a Zapierbol, a vendeg IP-je nelkul): az IP + user agent legfeljebb 48 orara
      // ide kerul, kuldes utan torlodik (Feri dontese 2026-10-19: max. adat, egeszsegugyi adat nelkul)
      try {
        await db.prepare(KONTEXTUS_SEMA).run();
        try { await db.prepare('ALTER TABLE mp_kontextus ADD COLUMN ext TEXT').run(); } catch (e) { /* mar letezik */ }
        await db.prepare('INSERT OR IGNORE INTO mp_kontextus (kulcs, ip, ua, ido, ext) VALUES (?,?,?,?,?)').bind(sor.kulcs, ip.slice(0, 45) || null, (request.headers.get('user-agent') || '').slice(0, 400) || null, most, ext).run();
      } catch (e) { /* nem allithatja meg */ }
      const pa = metaArnyekLepes(db, sor, request.headers.get('user-agent') || '', env, host, { fetchImpl, most, ip, ext })
        .catch((e) => console.error('mp-meres: meta arnyek hiba', String(e && e.message || e).slice(0, 200)));
      if (typeof waitUntil === 'function') waitUntil(pa); else await pa;
    } catch (e) { /* nem allithatja meg */ }
    // Google Ads felé CSAK Salonic által igazolt foglalás mehet: ha a Salonic-level mar megerkezett, most parositunk
    // es feltoltunk; kulonben a feltoltest a level erkezese (igazolasErkezes) inditja.
    const ig = await igazolasKeresSorhoz(db, sor);
    if (ig) {
      Object.assign(sor, await igazoltJeloles(db, sor.kulcs, ig));
      const feltolt = feltoltes(db, sor, env, host, { fetchImpl, most }).catch((e) => console.error('mp-meres: feltoltes hiba', String(e && e.message || e).slice(0, 200)));
      if (typeof waitUntil === 'function') waitUntil(feltolt); else await feltolt;
      await tiktokInditas(db, sor, env, host, { fetchImpl, most }, waitUntil);
    }
    // 2026-10-24 (GY/MP naplo): az igazolatlan Salonic-forrasu foglalasok TikTok-kihagyas naploja (csak naplo; a karbantartas ELOTT, mert az allitja `nem_igazolt`-ra)
    await nemIgazoltNaplo(db, env, host, { most, fetchImpl });
    // karbantartas: regi rekordok es a 90 napnal regebbi kattintasazonositok torlese
    const karb = db.batch([
      db.prepare('DELETE FROM mp_foglalas WHERE letrehozva < ?').bind(most - MEGORZES_NAP * 86400),
      db.prepare('DELETE FROM mp_feltoltes WHERE ido < ?').bind(most - MEGORZES_NAP * 86400),
      db.prepare('DELETE FROM mp_tiktok_feltoltes WHERE ido < ?').bind(most - MEGORZES_NAP * 86400),
      db.prepare(ARNYEK_SEMA),
      db.prepare("DELETE FROM mp_meta_arnyek WHERE ido < ?").bind(most - MEGORZES_NAP * 86400),
      db.prepare(KONTEXTUS_SEMA),
      db.prepare('DELETE FROM mp_kontextus WHERE ido < ?').bind(most - 48 * 3600),
      db.prepare('UPDATE mp_foglalas SET kattintas_ertek = NULL WHERE kattintas_ertek IS NOT NULL AND letrehozva < ?').bind(most - 90 * 86400),
      db.prepare(`UPDATE mp_foglalas SET ${PLATFORM_ID_OSZLOPOK.map((o) => `${o} = NULL`).join(', ')}
        WHERE (${PLATFORM_ID_OSZLOPOK.map((o) => `${o} IS NOT NULL`).join(' OR ')}) AND letrehozva < ?`).bind(most - 90 * 86400),
      db.prepare("UPDATE mp_foglalas SET igazolas = 'nem_igazolt' WHERE igazolas IS NULL AND letrehozva < ?").bind(most - IGAZOLAS_HATARIDO),
      db.prepare('DELETE FROM mp_salonic_igazolas WHERE rogzitve < ?').bind(most - MEGORZES_NAP * 86400),
    ]).catch(() => {});
    if (typeof waitUntil === 'function') waitUntil(karb); else await karb;
    return json({ ok: true, uj: true });
  } catch (e) {
    console.error('mp-meres: adatbazis-hiba', String(e && e.message || e).slice(0, 200));
    return json({ ok: false, hiba: 'adatbazis_hiba' }, 500);
  }
}

/**
 * POST /api/mp-onbevallas: a koszonooldali "Honnan hallottal rolunk?" kartya (assets/js/mp-meres.js) egy kattintasa.
 * Torzs: { ut, p: (ugyanaz, mint a foglalas-jelzesnel), onbevallas: tiktok|meta|google|ismeros|egyeb }.
 * Csak a mar letezo, POTLAS_ABLAK-on belul letrejott, ugyanazon booking_id-ju es kornyezetu sorra ir, es csak ha meg ures:
 * foglalasonkent egyszer, felulirni nem lehet. Semmilyen kulso hivas nincs.
 */
export async function onbevallasErkezes({ request, env = {} }, { most = Math.floor(Date.now() / 1000) } = {}) {
  if (String(env.MP_MERES_KI || '') === '1') return json({ ok: false, ki: true }, 503);
  const db = env.MP_MERES_DB;
  if (!db) return json({ ok: false, hiba: 'nincs_adatbazis' }, 503);
  let b; try { b = await request.json(); } catch (e) { return json({ ok: false, hiba: 'rossz_keres' }, 400); }
  const be = bemenet(b);
  const ob = onbevallasErtek(b && b.onbevallas);
  if (!be || !ob) return json({ ok: false, hiba: 'rossz_keres' }, 400);
  const k = koszonoOldal(be.url);
  if (!k.ok) return json({ ok: false, hiba: k.hiba }, 422);
  const kornyezet = new URL(request.url).hostname === ELES_HOST ? 'eles' : 'elonezet';
  try {
    await sema(db);
    const u = await db.prepare('UPDATE mp_foglalas SET onbevallas = ? WHERE kulcs = ? AND onbevallas IS NULL AND letrehozva >= ? AND salonic_id IS ? AND kornyezet = ?')
      .bind(ob, foglalasKulcs(k.adat), most - POTLAS_ABLAK, be.bookingId || null, kornyezet).run();
    return json({ ok: true, mentve: !!(u && u.meta && u.meta.changes) });
  } catch (e) {
    console.error('mp-meres: onbevallas adatbazis-hiba', String(e && e.message || e).slice(0, 200));
    return json({ ok: false, hiba: 'adatbazis_hiba' }, 500);
  }
}

/** A foglalas ARNYEK-konverzioinak feltoltese es naplozasa (mp_feltoltes). Eles modban a mar elkuldott akciot nem kuldi ujra. */
export async function feltoltes(db, sor, env, host, { fetchImpl = fetch, most = Math.floor(Date.now() / 1000) } = {}) {
  if (sor.igazolas !== 'igazolt') return []; // fail-closed: Salonic-igazolas nelkul semmi nem megy a Google-nek
  // Divat fulpiercing (tipus='ful'): alacsony erteku, Feri dontese (2026-10-13): egyetlen platform se optimalizaljon ra -> nem megy ki
  if (sor.tipus === 'ful') return [];
  const eles = sor.kornyezet === 'eles' && elesKuldesE(env, host);
  // konverzios ido: a foglalas ideje (Salonic-level), nem a koszonooldal (kesobbi) megnyitasa
  const f = { kulcs: sor.kulcs, letrehozva: sor.foglalas_ido || sor.letrehozva, ertek: sor.ertek, kattintas: sor.kattintas_ertek ? { tipus: sor.kattintas_tipus, ertek: sor.kattintas_ertek } : null };
  const km = await maszk(sor.kattintas_ertek);
  const kuldendo = [], naplo = [];
  // uj vendeg CSAK a Salonic "Uj paciens - Meg nem volt foglalasa" jelzesevel; minden mas ismeretlen -> csak "Foglalas"
  // (Feri definicioja: uj = meg nem vett reszt teljesult kezelesen; a first_booking parametert nem tekintjuk bizonyitottnak)
  for (const akcio of akciokFoglalashoz(sor.uj_vendeg_igazolt === 1 ? true : null)) {
    const kv = konverzio(f, akcio, { hozzajarulasHirdetes: sor.hozzajarulas_hirdetes === 1 });
    if (kv.konverzio) {
      if (eles) {
        const m = await db.prepare("SELECT 1 FROM mp_feltoltes WHERE kulcs = ? AND akcio_id = ? AND mod = 'eles' AND allapot = 'elkuldve'").bind(sor.kulcs, akcio).first();
        if (m) continue;
      }
      kuldendo.push(kv.konverzio);
    } else naplo.push({ akcioId: akcio, allapot: kv.tiltva ? 'tiltva' : 'kihagyva', mod: eles ? 'eles' : 'validate', kuldo: null, http_status: null, valasz: kv.tiltva || kv.kihagyva });
  }
  if (kuldendo.length) naplo.push(...await kuldes(kuldendo, env, { elesKuldes: eles, fetchImpl, most }));
  if (!naplo.length) return [];
  await db.batch(naplo.map((n) => db.prepare(
    `INSERT INTO mp_feltoltes (kulcs, akcio_id, mod, kuldo, allapot, http_status, valasz, kattintas_maszk, probalkozas, ido) VALUES (?,?,?,?,?,?,?,?,1,?)
     ON CONFLICT (kulcs, akcio_id, mod) DO UPDATE SET kuldo = excluded.kuldo, allapot = excluded.allapot, http_status = excluded.http_status,
       valasz = excluded.valasz, kattintas_maszk = excluded.kattintas_maszk, probalkozas = mp_feltoltes.probalkozas + 1, ido = excluded.ido`,
  ).bind(sor.kulcs, n.akcioId, n.mod, n.kuldo, n.allapot, n.http_status, n.valasz, km, most)));
  return naplo;
}

/**
 * Admin (kulcsos: x-mp-kulcs = MP_MERES_ADMIN_KULCS). GET ?riport=1[&nap=7][&kornyezet=eles]: napi osszesites, nyers azonosito nelkul;
 * GET ?kulcs=<foglalasi kulcs>: egy foglalas allapota (a kattintasazonosito maszkolva).
 * POST {"muvelet":"ujra"}: a nem sikerult (hiba / nincs_hitelesites / kikapcsolva) feltoltesek ujraprobalasa (max 50).
 */
export async function admin({ request, env = {} }, { fetchImpl = fetch, most = Math.floor(Date.now() / 1000) } = {}) {
  if (!env.MP_MERES_ADMIN_KULCS) return json({ ok: false }, 404);
  if (request.headers.get('x-mp-kulcs') !== env.MP_MERES_ADMIN_KULCS) return json({ ok: false }, 403);
  const db = env.MP_MERES_DB;
  if (!db) return json({ ok: false, hiba: 'nincs_adatbazis' }, 503);
  await sema(db);
  const url = new URL(request.url);
  if (request.method === 'GET' && url.searchParams.get('kulcs')) {
    const f = await db.prepare('SELECT * FROM mp_foglalas WHERE kulcs = ?').bind(url.searchParams.get('kulcs')).first();
    if (!f) return json({ ok: true, foglalas: null });
    const kattintas_maszk = await maszk(f.kattintas_ertek);
    delete f.kattintas_ertek;
    for (const o of PLATFORM_ID_OSZLOPOK) if (o in f) f[o] = await maszk(f[o]); // nyers Meta / TikTok azonosito sem megy ki
    const t = await db.prepare('SELECT akcio_id, mod, kuldo, allapot, http_status, valasz, kattintas_maszk, probalkozas, ido FROM mp_feltoltes WHERE kulcs = ? ORDER BY akcio_id, mod').bind(f.kulcs).all();
    return json({ ok: true, foglalas: { ...f, kattintas_maszk }, feltoltesek: t.results || [] });
  }
  if (request.method === 'GET' && url.searchParams.get('riport')) {
    const nap = Math.min(120, Math.max(1, Number(url.searchParams.get('nap')) || 7));
    const korny = url.searchParams.get('kornyezet') === 'elonezet' ? 'elonezet' : 'eles';
    const tol = most - nap * 86400;
    const f = await db.prepare(`SELECT date(letrehozva, 'unixepoch') AS nap, COUNT(*) AS foglalas, SUM(uj_vendeg = 1) AS uj, SUM(uj_vendeg = 0) AS visszatero,
      SUM(ertek IS NOT NULL) AS ertekkel, SUM(hozzajarulas_hirdetes) AS hirdetesi_hozzajarulas, SUM(kattintas_tipus IS NOT NULL) AS google_kattintassal,
      SUM(forras = 'motor') AS motorbol, SUM(tipus = 'ful') AS fulbevalo, SUM(igazolas = 'igazolt') AS salonic_igazolt, SUM(igazolas = 'nem_igazolt') AS nem_igazolt FROM mp_foglalas WHERE kornyezet = ? AND letrehozva >= ? GROUP BY 1 ORDER BY 1`).bind(korny, tol).all();
    const t = await db.prepare(`SELECT t.akcio_id, t.mod, t.allapot, COUNT(*) AS db FROM mp_feltoltes t JOIN mp_foglalas f ON f.kulcs = t.kulcs
      WHERE f.kornyezet = ? AND t.ido >= ? GROUP BY 1, 2, 3 ORDER BY 1, 2, 3`).bind(korny, tol).all();
    return json({ ok: true, kornyezet: korny, nap, foglalasok: f.results || [], feltoltesek: t.results || [] });
  }
  if (request.method === 'POST') {
    let b = {}; try { b = await request.json(); } catch (e) { /* ures */ }
    if (b.muvelet !== 'ujra') return json({ ok: false, hiba: 'ismeretlen_muvelet' }, 400);
    const host = new URL(request.url).hostname;
    const sorok = await db.prepare(`SELECT DISTINCT f.* FROM mp_foglalas f JOIN mp_feltoltes t ON t.kulcs = f.kulcs
      WHERE t.allapot IN ('hiba', 'nincs_hitelesites', 'kikapcsolva') AND f.letrehozva >= ? ORDER BY f.letrehozva LIMIT 50`).bind(most - 90 * 86400).all();
    const ki = [];
    for (const s of sorok.results || []) ki.push({ kulcs: s.kulcs, eredmeny: (await feltoltes(db, s, env, host, { fetchImpl, most })).map((n) => ({ akcio: n.akcioId, allapot: n.allapot, mod: n.mod })) });
    return json({ ok: true, ujraprobalva: ki.length, ki });
  }
  return json({ ok: false }, 405);
}

// ---------------- Salonic-igazolas (atmeneti, a Salonic API-ig) ----------------

const kulcsResz = (kulcs) => { const [place, emp, start] = String(kulcs).split('|'); return { place, emp, start: Number(start) }; };

/** A D1-sorhoz tartozo, meg fel nem hasznalt igazolas: azonos kezdes ES (ismert munkatarsnal) azonos munkatars-azonosito. */
async function igazolasKeresSorhoz(db, sor) {
  const k = kulcsResz(sor.kulcs);
  // a levelben percre pontos a kezdes: a kulcs kezdese ugyanabba a percbe esik
  const r = await db.prepare('SELECT * FROM mp_salonic_igazolas WHERE start_unix BETWEEN ? AND ? AND (kulcs IS NULL OR kulcs = ?)').bind(k.start - 59, k.start, sor.kulcs).all();
  const jo = (r.results || []).filter((ig) => !ig.employee_ids || ig.employee_ids.split(',').includes(k.emp));
  // ismeretlen munkatars-nevu igazolas csak akkor parosithato, ha egyertelmu
  const biztos = jo.filter((ig) => ig.employee_ids);
  if (biztos.length === 1) return biztos[0];
  if (!biztos.length && jo.length === 1) return jo[0];
  return null;
}

async function igazoltJeloles(db, kulcs, ig) {
  const mezok = { igazolas: 'igazolt', igazolas_id: ig.booking_id, foglalas_ido: ig.erkezett, uj_vendeg_igazolt: ig.uj_paciens === 1 ? 1 : null };
  await db.batch([
    db.prepare('UPDATE mp_foglalas SET igazolas = ?, igazolas_id = ?, foglalas_ido = ?, uj_vendeg_igazolt = ? WHERE kulcs = ?').bind(mezok.igazolas, mezok.igazolas_id, mezok.foglalas_ido, mezok.uj_vendeg_igazolt, kulcs),
    db.prepare('UPDATE mp_salonic_igazolas SET kulcs = ? WHERE booking_id = ?').bind(kulcs, ig.booking_id),
  ]);
  return mezok;
}

const egyenlo = (a, b) => {
  a = String(a || ''); b = String(b || '');
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0 && a.length > 0;
};

/**
 * POST /api/mp-salonic-igazolas (Zapier Gmail-trigger -> webhook). Fejlec: x-mp-igazolas = MP_IGAZOLAS_TITOK.
 * Torzs: { from, subject, body, date }. A levelbol csak a foglalasi azonosito, munkatars-azonosito, kezdes, uj paciens jelzes
 * es a level ideje kerul tarolasra. Ha van hozza D1-sor, igazoltra allitja es elinditja a feltoltest.
 */
const sha256hex = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s))))].map((x) => x.toString(16).padStart(2, '0')).join('');

/** A webhook titka: MP_IGAZOLAS_TITOK (Cloudflare-titok) VAGY a D1-ben tarolt SHA-256 lenyomata (mp_beallitas.igazolas_titok_sha256). */
async function igazolasTitok(db, env, kapott, eles) {
  if (env.MP_IGAZOLAS_TITOK) return { van: true, jo: !!kapott && egyenlo(kapott, env.MP_IGAZOLAS_TITOK) };
  if (!eles) return { van: false, jo: false }; // a D1-lenyomat csak az eles hoszton ervenyes
  let sor = null;
  try { if (db) sor = await db.prepare("SELECT ertek FROM mp_beallitas WHERE kulcs = 'igazolas_titok_sha256'").first(); } catch (e) { /* nincs tabla */ }
  if (!sor || !sor.ertek) return { van: false, jo: false };
  return { van: true, jo: !!kapott && egyenlo(await sha256hex(kapott), sor.ertek) };
}

export async function igazolasErkezes({ request, env = {}, waitUntil }, { fetchImpl = fetch, most = Math.floor(Date.now() / 1000) } = {}) {
  const db = env.MP_MERES_DB;
  const t = await igazolasTitok(db, env, request.headers.get('x-mp-igazolas'), new URL(request.url).hostname === ELES_HOST);
  if (!t.van) return json({ ok: false }, 404);
  if (!t.jo) return json({ ok: false }, 403);
  if (!db) return json({ ok: false, hiba: 'nincs_adatbazis' }, 503);
  let b; try { b = await request.json(); } catch (e) { return json({ ok: false, hiba: 'rossz_keres' }, 400); }
  // Lemondas / modositas (lemondas.js): csak minimalis mezok, a vendegadat es a lemondas oka nem tarolodik
  const lm = lemondasErtelmezes(b);
  if (lm.ok) { await sema(db); const r = await lemondasRogzites(db, lm, most); return json({ ok: true, lemondas: lm.tipus, ...r }); }
  const l = levelErtelmezes(b);
  if (!l.ok) return json({ ok: true, igazolva: false, hiba: l.hiba }); // 2xx: a Zapier ne probalja ujra a nem MP-s leveleket
  await sema(db);
  const uj = await db.prepare(`INSERT OR IGNORE INTO mp_salonic_igazolas (booking_id, employee_ids, start_unix, uj_paciens, erkezett, rogzitve)
    VALUES (?,?,?,?,?,?)`).bind(l.bookingId, l.employeeIds.join(',') || null, l.startUnix, l.ujPaciens ? 1 : null, l.erkezett, most).run();
  const ig = await db.prepare('SELECT * FROM mp_salonic_igazolas WHERE booking_id = ?').bind(l.bookingId).first();
  if (ig.kulcs) return json({ ok: true, igazolva: true, ismetelt: true });
  // a meg nem igazolt, azonos kezdesu D1-sorok kozul a munkatars szerint egyertelmu
  const r = await db.prepare('SELECT * FROM mp_foglalas WHERE igazolas IS NULL AND letrehozva >= ?').bind(most - IGAZOLAS_HATARIDO).all();
  const jelolt = (r.results || []).filter((s) => {
    const k = kulcsResz(s.kulcs);
    return k.start >= l.startUnix && k.start <= l.startUnix + 59 && (!l.employeeIds.length || l.employeeIds.includes(k.emp));
  });
  if (!l.employeeIds.length) console.warn('mp-meres: ismeretlen Salonic-munkatars az igazolasban (MUNKATARSAK frissitendo)');
  if (jelolt.length !== 1) return json({ ok: true, igazolva: false, varakozik: true, tobb_jelolt: jelolt.length > 1, ismeretlen_munkatars: !l.employeeIds.length, uj: !!(uj && uj.meta && uj.meta.changes) });
  const sor = { ...jelolt[0], ...(await igazoltJeloles(db, jelolt[0].kulcs, ig)) };
  const host = new URL(request.url).hostname;
  const pf = feltoltes(db, sor, env, host, { fetchImpl, most }).catch((e) => console.error('mp-meres: igazolt feltoltes hiba', String(e && e.message || e).slice(0, 200)));
  if (typeof waitUntil === 'function') waitUntil(pf); else await pf;
  await tiktokInditas(db, sor, env, host, { fetchImpl, most }, waitUntil);
  return json({ ok: true, igazolva: true });
}
