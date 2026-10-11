// SALONIC-DIRECT SAFETY NET (DECISION #127 (b), #130 / #131; GPT-jovahagyas: terv v2 + D1-D7 + a 2026-10-11-i 5 pont).
// Cel: ha a motoros (sajat booking_id-s) parositas egy Salonic-foglalasra NEM hoz esemenyt (parositatlan / nincs kulcs-iras), az esemeny a Salonic-levelbol
// (a szalon-ertesito) akkor is kimenjen az ARNYEK-celpontokra - de SOHA ne menjen ki ketszer, es csere (reschedule) ne szamitson uj konverzionak.
//
// Mukodes (a Zap 5. lepese, legalabb 20 perccel a letrehozo level erkezese UTAN):
//   POST /api/foglalas-egyeztetes {muvelet:'sd_atvetel', uuid, host, vendeg{email,telefon}, nev, uj_vendeg, szolgaltatas, felado, idopont_szoveg, munkatarsak, level_datuma, megjegyzes, ar?, szaraz?}
//   1. kapuk: MERES_SALONIC_DIRECT=1 (kornyezet) ES a D1-kapcsolo (meres_kapcsolo: salonic_direct / salonic_direct:<uzletag>; alapbol KI) ES MERES_ELOSZTO=1 + a kulcsok
//   2. kor (T0 = a letrehozo level erkezese): < 20 perc: koran (nincs teendo); > 48 ora: lejart (naplo + riasztas, 0 automatikus kuldes)
//   3. a motor megelozte? (kuldve) -> semmi; ellentmondas -> semmi (ember dont)
//   4. VEGSO PAROSITAS (DECISION #108 szuk kivetele): a motoros identity az sd atomi atvetelenek pillanataig meg nyerhet (egyeztet vegsoProba)
//   5. ATOMI ATVETEL (egyetlen UPSERT a foglalas_egyeztetes soron): onnantol a UUID-ra a motoros parositas nem kuld (kesei mb_ kulcs = csak alias, late_motor_key=1)
//   6. CSERE-DONTES (#131): azonos vendeg-hash + azonos uzletag / kanonikus szolgaltatas + a megjegyzesben szereplo korabbi idopont PONTOSAN EGY letezo foglalasra mutat
//      -> reschedule_confirmed (0 uj esemeny; ha a regi foglalas meg el: riasztas); csere-gyanu, de nem igazolhato -> reschedule_suspected (HOLD: a cellak halasztva + riasztas, 0 kuldes)
//   7. kuldes: ugyanaz az elosztas() mint a motornal, de forras=salonic_direct, attr_minoseg=C_salonic_direct, sajat determinisztikus identity (sd_<24 hex>, HMAC)
// A tarolt adat: HMAC-hash-ek (vendeg), a Salonic-UUID es a determinisztikus sd azonosito; nyers e-mail / telefon / nev / megjegyzes SOHA nincs a D1-ben vagy a valaszban.
import { SALONIC_UZLETAG, foglalasJelleg, esemenyek, konzultacioTabla } from './esemeny-modell.js';
import { emailNormal, telefonSzamjegy } from './hash.js';
import { elosztas, meresSema, kapcsolokOlvas } from './elosztas.js';
import { jellegRogzit } from './jelleg-rogzites.js';
import { BUSINESSES } from '../../../assets/js/booking-engine/salonic-adapter.js';
import { UUID_MINTA, HOSTOK, MEGORZES_NAP, foglalasAllapot, idopontSzovegElemzes, evKovetkeztet, isoUnix, nevtablaBetolt, norm, sema as parositasSema } from '../foglalas-kulcs.js';

export const SD_MIN_KOR_MP = 20 * 60;          // legalabb ennyi ido a letrehozo level erkezese utan (a motoros 4 proba ~14-15 perc alatt lezarul)
export const SD_MAX_KOR_MP = 48 * 3600;        // ennel regebbi foglalasra nincs automatikus kuldes (naplo + riasztas)
export const SD_ATVETEL_ELAKADAS_MP = 300;      // egy 'atveve' allapotu sor ennyi masodperc utan (Worker-halal) ujra atveheto
const sec = (now) => Math.floor(now / 1000);
const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// --- titkok / HMAC ---------------------------------------------------------------------------------------------------------------------------
async function hmacHex(titok, szoveg) {
  const kulcs = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(titok)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const jel = await crypto.subtle.sign('HMAC', kulcs, new TextEncoder().encode(String(szoveg)));
  return [...new Uint8Array(jel)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const titokOk = (v) => typeof v === 'string' && v.length >= 16;
/** Az sd azonosito nevtere: ugyanazt a Salonic-UUID-t a prod es a smoke (elonezeti teszt) kulonbozo azonositora kepezi. */
export const sdNevter = (env) => (/^[a-z0-9_-]{1,16}$/.test(String((env && env.MERES_SD_NS) || '')) ? env.MERES_SD_NS : 'prod');
/** Determinisztikus identity: sd_<24 hex> = HMAC-SHA256(SD_HMAC_KEY_V1, "v1|<nevter>|<uuid kisbetuvel>"). Titok nelkul / ervenytelen UUID-ra null. */
export async function sdIdentitas(env, uuid) {
  const u = String(uuid || '').toLowerCase();
  if (!titokOk(env && env.SD_HMAC_KEY_V1) || !UUID_MINTA.test(u)) return null;
  return 'sd_' + (await hmacHex(env.SD_HMAC_KEY_V1, `v1|${sdNevter(env)}|${u}`)).slice(0, 24);
}

// --- vendeg-hash (csak HMAC; a nyers adat nem tarolodik) ------------------------------------------------------------------------------------
/** Nev-normalizalas: ekezet nelkul, kisbetu, szavak rendezve ("Kovacs Anna" = "anna kovacs"); 3 karakternel rovidebb = nincs nev. */
export const nevNorm = (s) => { const t = fold(s).replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean).sort().join(' '); return t.length >= 3 ? t : null; };
/** -> { email_h, tel_h, nev_h } (32 hex) | null, ha nincs GUEST_HMAC_KEY_V1. A hianyzo / ervenytelen adat null. */
export async function vendegHash(env, v = {}, nev = '') {
  if (!titokOk(env && env.GUEST_HMAC_KEY_V1)) return null;
  const h = async (jel, x) => (x ? (await hmacHex(env.GUEST_HMAC_KEY_V1, `v1|${jel}|${x}`)).slice(0, 32) : null);
  return { email_h: await h('e', emailNormal(v.email)), tel_h: await h('t', telefonSzamjegy(v.telefon)), nev_h: await h('n', nevNorm(nev)) };
}
/** "Ugyanaz a vendeg" (#131): azonos e-mail-hash ES (azonos telefon-hash VAGY azonos nev-hash). */
export const azonosVendeg = (a, b) => !!(a && b && a.email_h && a.email_h === b.email_h && ((a.tel_h && a.tel_h === b.tel_h) || (a.nev_h && a.nev_h === b.nev_h)));

// --- szolgaltatas kanonikus kulcsa (a lifecycle-kodtol FUGGETLEN: a meres es az eletciklus kodja nem importalja egymast) ------------------
/** Ket Salonic-szolgaltatasnev ugyanaz-e: emoji, akcio- / kupon-elotag, zarojeles ar-megjegyzes, "X Ft helyett most Y Ft" nelkul, ekezet- es jel-fuggetlenul. */
export function szolgKanon(s) {
  let t = String(s || '').normalize('NFC').replace(/[\p{Extended_Pictographic}‍️]+/gu, ' ').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 2; i++) t = t.replace(/^(KUPONK[ÓO]DDAL|AKCI[ÓO])\s*-\s*/i, '');
  t = t.replace(/\s*\([^)]*\bFt\b[^)]*\)/gi, '').replace(/\s*-\s*[\d.\s]+Ft helyett most.*$/i, '');
  const k = norm(t);
  return k || null;
}

// --- megjegyzes (CSAK a Salonic "Megjegyzes" mezoje; a vendeg szabad szovege) -----------------------------------------------------------
/** Csere- / athelyezes-gyanu a megjegyzesben (ekezet-fuggetlen). A gyanu nem dont: csak a csere-agat nyitja meg (igazolas vagy HOLD). */
export const CSERE_GYANU = /\b(\w*cser\w*|athelyez\w*|atfoglal\w*|atutemez\w*|atrak\w*|atteszem|atvinn\w*|modosit\w*|elhalaszt\w*|elorebb\w*|hatrebb\w*|korabbi\s+(?:foglalas|idopont)\w*|regi\s+(?:foglalas|idopont)\w*|elozo\s+(?:foglalas|idopont)\w*|helyett|lemond\w*)/;
export const csereGyanu = (megjegyzes) => CSERE_GYANU.test(fold(megjegyzes));
const HONAP = { jan: 1, feb: 2, mar: 3, apr: 4, maj: 5, jun: 6, jul: 7, aug: 8, sze: 9, okt: 10, nov: 11, dec: 12 };
const DATUM_MINTAK = [
  { re: /(?<!\d)(20\d{2})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})(?!\d)/g, ki: (m) => ({ ev: +m[1], ho: +m[2], nap: +m[3] }) },
  { re: /\b(januar|februar|marcius|aprilis|majus|junius|julius|augusztus|szeptember|oktober|november|december|jan\.|febr\.|marc\.|apr\.|maj\.|jun\.|jul\.|aug\.|szept\.|okt\.|nov\.|dec\.)\s*(\d{1,2})(?![\d:])/g, ki: (m) => ({ ev: null, ho: HONAP[m[1].slice(0, 3)], nap: +m[2] }) },
  { re: /(?<![\d:.])(\d{1,2})\.\s?(\d{1,2})\.(?!\d)/g, ki: (m) => ({ ev: null, ho: +m[1], nap: +m[2] }) }, // "10.16." (ho. nap.)
];
/** A megjegyzesben emlitett idopontok: { idok: [{ora, perc|null}], datumok: [{ev|null, ho, nap}] }. A datum-mintak kiveve a szovegbol, hogy ne ertelmezodjenek idonek. */
export function megjegyzesIdopontok(megjegyzes) {
  let t = fold(megjegyzes);
  const datumok = [];
  for (const { re, ki } of DATUM_MINTAK) {
    t = t.replace(re, (...a) => { const d = ki(a); if (d.ho >= 1 && d.ho <= 12 && d.nap >= 1 && d.nap <= 31) datumok.push(d); return ' '; });
  }
  const idok = [];
  for (const m of t.matchAll(/(?<!\d)([01]?\d|2[0-3])\s*:\s*([0-5]\d)(?!\d)/g)) idok.push({ ora: +m[1], perc: +m[2] });
  for (const m of t.matchAll(/(?<![\d:])([01]?\d|2[0-3])\s*(?:ora\w*|h\b|-?kor\b|-?os\b)/g)) idok.push({ ora: +m[1], perc: null });
  return { idok, datumok };
}
const BUDAPEST = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Budapest', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
/** Egy unix idopont Budapest szerinti resze. */
export function budapestResz(unix) {
  const r = Object.fromEntries(BUDAPEST.formatToParts(new Date(unix * 1000)).map((p) => [p.type, p.value]));
  return { ev: +r.year, ho: +r.month, nap: +r.day, ora: +r.hour, perc: +r.minute };
}
/** A megjegyzes emlitett idopontja ra a foglalasra mutat-e: minden megadott tipus (ido / datum) legalabb egy eleme egyezik; semmi sem megadva = nem mutat. */
export function mutatEgyre(em, kezdetUnix) {
  if (!em || (!em.idok.length && !em.datumok.length) || !Number.isFinite(kezdetUnix)) return false;
  const b = budapestResz(kezdetUnix);
  const idoOk = !em.idok.length || em.idok.some((i) => i.ora === b.ora && (i.perc === null || i.perc === b.perc));
  const datumOk = !em.datumok.length || em.datumok.some((d) => d.ho === b.ho && d.nap === b.nap && (d.ev === null || d.ev === b.ev));
  return idoOk && datumOk;
}
const kezdetSzamol = (mezok, leveluUnix) => isoUnix(mezok.ld && mezok.ld.startDate) || evKovetkeztet(idopontSzovegElemzes(mezok.idopontSzoveg), leveluUnix);
const isoUtc = (unix) => (Number.isFinite(unix) ? new Date(unix * 1000).toISOString() : null);

// --- kapcsolo (alapbol KI - a meglevo veszkapcsolokkal ellentetben) -----------------------------------------------------------------------
/** A D1-kapcsolo kulcsa: salonic_direct (osszes) / salonic_direct:<uzletag>; az uzletag-sor, ha van, felulirja az osszesit. Hianyzo sor = KI. */
export async function sdKapcsolo(db, env, uzletag) {
  if (String((env && env.MERES_SALONIC_DIRECT) || '') !== '1') return { be: false, miert: 'MERES_SALONIC_DIRECT nincs bekapcsolva (kornyezet)' };
  const k = await kapcsolokOlvas(db);
  const u = k.find((x) => x.kulcs === `salonic_direct:${uzletag}`), g = k.find((x) => x.kulcs === 'salonic_direct');
  const dont = u || g;
  if (!dont) return { be: false, miert: 'a salonic_direct kapcsolo nincs bekapcsolva (alap: ki)' };
  return dont.be === 1 ? { be: true } : { be: false, miert: 'a salonic_direct kapcsolo ki: ' + (u ? `salonic_direct:${uzletag}` : 'salonic_direct') };
}
export async function sdKapcsoloBeallit(db, { uzletag = null, be, ok = null }, now = Date.now()) {
  await meresSema(db);
  if (uzletag && !Object.values(SALONIC_UZLETAG).includes(uzletag)) return { ok: false, miert: 'ismeretlen uzletag' };
  const kulcs = uzletag ? `salonic_direct:${uzletag}` : 'salonic_direct';
  await db.prepare('INSERT INTO meres_kapcsolo (kulcs, be, ok, ido) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(kulcs) DO UPDATE SET be = excluded.be, ok = excluded.ok, ido = excluded.ido').bind(kulcs, be ? 1 : 0, ok, sec(now)).run();
  return { ok: true, kulcs, be: !!be };
}
/** A vendeg-hash index iras- / backfill-kapuja: a teljes kapu VAGY a kulon index-kapu (a backfill a kapcsolo bekapcsolasa ELOTT fut, kuldes nelkul). */
export const sdIndexBe = (env) => String((env && env.MERES_SALONIC_DIRECT) || '') === '1' || String((env && env.MERES_SD_INDEX) || '') === '1';

// --- vendeg-hash index (reschedule-felismeres; kuldes NELKUL, idempotens, 180 nap) -------------------------------------------------------------
/** Egy letrehozo level hash-elt vendegadata az indexbe (ON CONFLICT DO NOTHING). -> { ok, uj } | { ok:false, miert } */
export async function vendegIndexSor(db, env, { mezok, vendeg, nev, now, allapot = 'aktiv', forras = 'level', szaraz = false }) {
  const uzletag = SALONIC_UZLETAG[mezok.host];
  const uuid = String(mezok.uuid || '').toLowerCase();
  if (!uzletag) return { ok: false, miert: 'ismeretlen host' };
  if (!UUID_MINTA.test(uuid)) return { ok: false, miert: 'ervenytelen uuid' };
  const h = await vendegHash(env, vendeg || {}, nev);
  if (!h) return { ok: false, miert: 'nincs GUEST_HMAC_KEY_V1' };
  if (!h.email_h) return { ok: false, miert: 'nincs ervenyes e-mail' };
  const t = sec(now || Date.now());
  const level = Date.parse(mezok.leveldatum || '');
  const ido = Number.isFinite(level) ? Math.round(level / 1000) : t;
  const kezdet = kezdetSzamol(mezok, ido);
  if (szaraz) return { ok: true, uj: null, kezdet: !!kezdet };
  await parositasSema(db);
  const r = await db.prepare("INSERT INTO foglalas_vendeg (uuid, uzletag, szolg_kulcs, kezdet, nev_h, tel_h, email_h, allapot, forras, ido, lejar) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11) ON CONFLICT(uuid) DO NOTHING")
    .bind(uuid, uzletag, szolgKanon(mezok.szolgaltatas), kezdet, h.nev_h, h.tel_h, h.email_h, allapot === 'torolve' ? 'torolve' : 'aktiv', forras, ido, ido + MEGORZES_NAP * 86400).run();
  return { ok: true, uj: !!(r.meta && r.meta.changes > 0), kezdet: !!kezdet };
}
/** A foglalas-kulcs.js horga (minden letrehozo level, MERES_SALONIC_DIRECT=1 / MERES_SD_INDEX=1 mellett). */
export async function vendegIndexIr({ db, env, mezok, bejovo = {}, now }) {
  if (!sdIndexBe(env)) return { ok: false, miert: 'az index nincs bekapcsolva' };
  const t = now ? now() : Date.now();
  const r = await vendegIndexSor(db, env, { mezok, vendeg: bejovo.vendeg, nev: bejovo.nev, now: t });
  if (r.uj) await db.prepare('DELETE FROM foglalas_vendeg WHERE lejar < ?1').bind(sec(t)).run(); // a 180 napnal regebbi sorok torlese: csak uj sor beszurasakor (egy levelre 4 proba van)
  return r;
}
/** Egyszeri backfill: {muvelet:'vendeg_index', elemek:[{uuid, host, szolgaltatas, idopont_szoveg, ld?, level_datuma, vendeg{email,telefon}, nev?, allapot?}] (max 50), szaraz?}. KULDES NINCS. */
async function vendegIndexMuvelet({ db, env, bejovo, fuggosegek }) {
  if (!sdIndexBe(env)) return { allapot: 'ki', miert: 'MERES_SALONIC_DIRECT / MERES_SD_INDEX nincs bekapcsolva' };
  const elemek = Array.isArray(bejovo.elemek) ? bejovo.elemek.slice(0, 50) : [];
  if (!elemek.length) return { allapot: 'ures', miert: 'elemek[] kell (max. 50)' };
  const most = fuggosegek && fuggosegek.now ? fuggosegek.now() : Date.now();
  if (bejovo.szaraz !== true) { await parositasSema(db); await db.prepare('DELETE FROM foglalas_vendeg WHERE lejar < ?1').bind(sec(most)).run(); }
  const o = { allapot: 'kesz', szaraz: bejovo.szaraz === true, feldolgozva: elemek.length, uj: 0, meglevo: 0, hibas: [], kuldes: 0 };
  for (const [i, e] of elemek.entries()) {
    if (!e || typeof e !== 'object') { o.hibas.push({ i, miert: 'nem objektum' }); continue; }
    const r = await vendegIndexSor(db, env, { mezok: { uuid: e.uuid, host: e.host, szolgaltatas: e.szolgaltatas, idopontSzoveg: e.idopont_szoveg, ld: e.ld || null, leveldatum: e.level_datuma }, vendeg: e.vendeg, nev: e.nev, now: most, allapot: e.allapot, forras: 'backfill', szaraz: bejovo.szaraz === true });
    if (!r.ok) o.hibas.push({ i, miert: r.miert }); else if (r.uj === true) o.uj++; else if (r.uj === false) o.meglevo++;
    else o.uj++; // szaraz: ervenyes elem
  }
  return o;
}

// --- ertek (D5) ----------------------------------------------------------------------------------------------------------------------------
/**
 * A tenyleges ar feloldasa; a Salonic szalon-ertesitoje NEM tartalmaz arat. Sorrend: (1) a Zap "ar" mezoje (ha van), (2) a nevtabla szolgaltatas-lista ara (data-price),
 * KEDVEZMENY-gyanu (kupon a szolgaltatas nevben / "kedvezmeny" a munkatars cimkejeben) -> unknown_discount (a lista-ar nem tenyleges ar), (3) nincs ar -> unknown_price.
 * -> { ertek, minoseg: 'exact' | 'unknown_discount' | 'unknown_price', forras }. A konzultacio a rogzitett tabla-erteket kapja (exact).
 */
export async function arFeloldas(db, { jelleg, uzletag, mezok, bejovo = {} }) {
  if (jelleg === 'konzultacio') return { ertek: 0, minoseg: 'exact', forras: 'konzultacio_tabla' };
  const zap = bejovo.ar === null || bejovo.ar === undefined || bejovo.ar === '' ? NaN : Number(bejovo.ar);
  if (Number.isFinite(zap) && zap >= 0) return { ertek: Math.round(zap), minoseg: 'exact', forras: 'zap_ar' };
  const kedvezmeny = (mezok.munkatarsak || []).some((m) => /kedvezm/i.test(String(m))) || /kupon/i.test(fold(mezok.szolgaltatas));
  const business = BUSINESSES[uzletag];
  let lista = null;
  if (business) {
    const tabla = await nevtablaBetolt(db);
    const sid = [...new Set(tabla.szolgaltatasok.filter((x) => x.placeId === business.placeId && norm(x.nev) === norm(mezok.szolgaltatas)).map((x) => x.serviceId))];
    const arak = sid.length === 1 ? tabla.arak.filter((a) => a.placeId === business.placeId && a.serviceId === sid[0] && Number.isFinite(a.ar) && a.ar >= 0) : [];
    if (arak.length === 1) lista = Math.round(arak[0].ar);
  }
  if (kedvezmeny) return { ertek: 0, minoseg: 'unknown_discount', forras: 'kedvezmeny_gyanu' + (lista !== null ? ' (lista-ar ismert, nem tenyleges)' : '') };
  if (lista !== null) return { ertek: lista, minoseg: 'exact', forras: 'szolgaltatas_lista' };
  return { ertek: 0, minoseg: 'unknown_price', forras: 'nincs_ar' };
}

// --- csere-dontes (#131) ----------------------------------------------------------------------------------------------------------------------
async function csereDontes(db, env, { uzletag, uuid, kezdet, szolgKulcs, h, megjegyzes, t0, host, fetchImpl }) {
  if (!csereGyanu(megjegyzes)) return { allapot: 'nincs_gyanu' };
  const em = megjegyzesIdopontok(megjegyzes);
  const alap = { gyanu: true, emlitett_idopont: { idok: em.idok.length, datumok: em.datumok.length } };
  const gyanus = (ok, extra = {}) => ({ ...alap, allapot: 'suspected', ok, ...extra });
  if (!h || !h.email_h) return gyanus('nincs vendeg-hash (kulcs / e-mail hianyzik): a csere nem igazolhato');
  if (!em.idok.length && !em.datumok.length) return gyanus('a megjegyzesben nincs azonosithato korabbi idopont');
  await parositasSema(db);
  const { results } = await db.prepare('SELECT uuid, szolg_kulcs, kezdet, nev_h, tel_h, email_h, allapot, ido FROM foglalas_vendeg WHERE email_h = ?1 AND uzletag = ?2 AND uuid <> ?3 AND lejar >= ?4 ORDER BY ido DESC LIMIT 50').bind(h.email_h, uzletag, uuid, t0).all();
  const lista = results || [];
  // jelolt: azonos vendeg, azonos kanonikus szolgaltatas, ELSO (a letrehozasi ideje a mostani ele esik), es meg nem kezdodott el a mostani level erkezesekor (1 oras turessel)
  const azonos = lista.filter((c) => azonosVendeg(h, c) && c.szolg_kulcs && c.szolg_kulcs === szolgKulcs && Number.isFinite(c.kezdet) && c.kezdet >= t0 - 3600 && c.ido <= t0 + 60);
  const mutatott = azonos.filter((c) => mutatEgyre(em, c.kezdet));
  const jeloltek = { indexben: lista.length, azonos_vendeg_szolgaltatas: azonos.length, mutatott: mutatott.length };
  if (mutatott.length === 0) return gyanus(azonos.length ? 'a megjegyzesben szereplo idopont az index egyetlen jeloltjere sem mutat' : 'nincs azonos vendeg / szolgaltatas jelolt az indexben (vendeg-hash eltero, vagy a korabbi foglalas nincs az indexben)', { jeloltek });
  if (mutatott.length > 1) return gyanus('a megjegyzesben szereplo idopont tobb jeloltre is mutat', { jeloltek });
  const regi = mutatott[0];
  const elo = await foglalasAllapot({ host, uuid: regi.uuid, fetchImpl });
  const regiAktiv = elo.allapot === 'aktiv' ? true : elo.allapot === 'torolve' ? false : null; // null = nem ellenorizheto (riasztas jar)
  return { ...alap, allapot: 'confirmed', jeloltek, regi_uuid: regi.uuid, reschedule_from: isoUtc(regi.kezdet), reschedule_to: isoUtc(kezdet), regi_aktiv: regiAktiv, regi_elo_allapot: elo.allapot };
}
async function rescheduleIr(db, { uuid, sdId, allapot, d, t }) {
  await db.prepare('INSERT INTO foglalas_reschedule (uuid, sd_id, allapot, reschedule_from, reschedule_to, regi_uuid, regi_aktiv, ok, ido, frissitve) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9) ON CONFLICT(uuid) DO UPDATE SET allapot = excluded.allapot, reschedule_from = excluded.reschedule_from, reschedule_to = excluded.reschedule_to, regi_uuid = excluded.regi_uuid, regi_aktiv = excluded.regi_aktiv, ok = excluded.ok, frissitve = excluded.frissitve')
    .bind(uuid, sdId, allapot, d.reschedule_from || null, d.reschedule_to || null, d.regi_uuid || null, d.regi_aktiv === true ? 1 : d.regi_aktiv === false ? 0 : null, String(d.ok || '').slice(0, 300) || null, t).run();
}

// --- atvetel / allapot ---------------------------------------------------------------------------------------------------------------------
/** ATOMI atvetel: egyetlen UPSERT. Csak a mar nem parositott, nem kuldott, nem atvett sorra (vagy ha nincs sor) sikerul; versenyben a motoros parositas es az sd kozul pontosan egy nyer. */
async function atvesz(db, uuid, sdId, sdAllapot, t, riasztas = 0) {
  const r = await db.prepare("INSERT INTO foglalas_egyeztetes (uuid, allapot, probalkozas, riasztas, letrehozva, frissitve, sd_id, sd_allapot, sd_ido) VALUES (?1, 'parositatlan', 0, ?5, ?2, ?2, ?3, ?4, ?2) ON CONFLICT(uuid) DO UPDATE SET allapot = 'parositatlan', sd_id = excluded.sd_id, sd_allapot = excluded.sd_allapot, sd_ido = excluded.sd_ido, kovetkezo = NULL, riasztas = MAX(foglalas_egyeztetes.riasztas, excluded.riasztas), frissitve = excluded.frissitve WHERE foglalas_egyeztetes.sd_id IS NULL AND foglalas_egyeztetes.kuldve IS NULL AND foglalas_egyeztetes.allapot IN ('parositatlan', 'fuggoben')")
    .bind(uuid, t, sdId, sdAllapot, riasztas).run();
  return !!(r.meta && r.meta.changes > 0);
}
const allapotIr = (db, uuid, sdAllapot, t, riasztas) => db.prepare('UPDATE foglalas_egyeztetes SET sd_allapot = ?2, riasztas = ?4, frissitve = ?3 WHERE uuid = ?1 AND sd_id IS NOT NULL').bind(uuid, sdAllapot, t, riasztas ? 1 : 0).run();

const attrJelek = (v) => ({ forras: 'salonic_level', email_hash: !!emailNormal((v || {}).email), telefon_hash: !!telefonSzamjegy((v || {}).telefon), click_id: false, fbp: false, ttp: false, ga4_client_id: false, ip_ua: false });

/** A kuldesi lepes (idempotens: az elosztas a mar vegleges cellara nem kuld ujra). mod: 'normal' | 'confirmed' | 'suspected' | 'feloldva_confirmed' */
async function kuldesFuttat({ db, env, uuid, sdId, uzletag, mezok, bejovo, fuggosegek, t0, mod, csere, szaraz }) {
  const v = (bejovo.vendeg && typeof bejovo.vendeg === 'object') ? bejovo.vendeg : {};
  const most = fuggosegek.now ? fuggosegek.now() : Date.now();
  const ujVendeg = typeof bejovo.uj_vendeg === 'boolean' ? bejovo.uj_vendeg : null;
  const kapott = foglalasJelleg({ szolgaltatasNev: mezok.szolgaltatas || '', ujVendeg, kategoria: '' });
  const zar = szaraz ? { ...kapott, forras: 'szaraz' } : await jellegRogzit(db, sdId, kapott, most); // az elso kiertekeles jellege rogzul (mint a motornal, X1)
  const ar = await arFeloldas(db, { jelleg: zar.jelleg, uzletag, mezok, bejovo });
  const fk = { tipus: 'foglalas', uzletag, source_entity_id: sdId, jelleg: zar.jelleg, kupon: zar.kupon, ertek: ar.ertek, ido: t0, szolgaltatas: mezok.szolgaltatas || null, vendeg: { email: v.email, telefon: v.telefon, g: null }, oldal: null, uuid,
    forras: 'salonic_direct', attr_minoseg: 'C_salonic_direct', attr_jelek: attrJelek(v), ertek_minoseg: ar.minoseg, ertek_forras_jel: ar.forras };
  if (mod === 'confirmed' || mod === 'feloldva_confirmed') fk.fixAllapot = { allapot: 'kihagyva', indok: `reschedule_confirmed${mod === 'feloldva_confirmed' ? ' (feloldva)' : ''}: nincs uj konverzio (korabbi foglalas: ${String((csere && csere.regi_uuid) || '?').slice(0, 8)})` };
  else if (mod === 'suspected') fk.fixAllapot = { allapot: 'halasztva', indok: 'reschedule_suspected: HOLD, nincs automatikus kuldes (' + String((csere && csere.ok) || 'csere-gyanu').slice(0, 120) + ')' };
  const eredmeny = { jelleg: zar.jelleg, kupon: zar.kupon, uj_vendeg: ujVendeg, ertek_minoseg: ar.minoseg, ertek_forras: ar.forras };
  if (szaraz) {
    const lista = esemenyek({ ...fk, ertek: ar.ertek }, konzultacioTabla(env));
    return { ...eredmeny, terv_esemenyek: lista.map((e) => ({ esemeny_id: e.esemeny_id, nev: e.nev, tipus: e.tipus, ertek: ar.minoseg === 'exact' || e.ertek_forras !== 'tenyleges_ar' ? e.ertek : null, nyitott: !!e.nyitott })), fix_allapot: fk.fixAllapot || null };
  }
  const r = await elosztas(db, fk, { env, fetchImpl: fuggosegek.fetchImpl, now: fuggosegek.now, kuldo: fuggosegek.kuldo, eloEllenorzes: async () => (await foglalasAllapot({ host: mezok.host, uuid, fetchImpl: fuggosegek.fetchImpl })).allapot });
  return { ...eredmeny, esemeny_kuldes: r };
}

/** A csere-dontes sor allapota -> az sd_allapot, a riasztas es a kimeneti cimke. */
const vegAllapot = (mod, csere, kuldes) => {
  if (mod === 'confirmed') return { sd_allapot: 'reschedule_confirmed', riasztas: !!(csere && csere.regi_aktiv !== false) };
  if (mod === 'suspected') return { sd_allapot: 'halasztva', riasztas: true };
  if (mod === 'feloldva_confirmed') return { sd_allapot: 'feloldva_confirmed', riasztas: false };
  if (mod === 'feloldva_uj') return { sd_allapot: 'feloldva_uj', riasztas: false };
  return kuldes && kuldes.esemeny_kuldes && kuldes.esemeny_kuldes.allapot === 'halasztva' ? { sd_allapot: 'tartva', riasztas: true } : { sd_allapot: 'kesz', riasztas: false };
};
const csereKimenet = (csere) => (csere && csere.allapot !== 'nincs_gyanu' ? { allapot: csere.allapot, ok: csere.ok || null, reschedule_from: csere.reschedule_from || null, reschedule_to: csere.reschedule_to || null, regi_uuid_elo8: csere.regi_uuid ? String(csere.regi_uuid).slice(0, 8) : null, old_booking_still_active: csere.allapot === 'confirmed' ? csere.regi_aktiv !== false : null, jeloltek: csere.jeloltek || null } : null);

/**
 * sd_atvetel / sd_feloldas. bejovo.szaraz === true: IRASMENTES terv (semmi nem valtozik a D1-ben, nem kuld, a motoros vegso probat sem futtatja).
 * bejovo.feloldas = { dontes: 'confirmed' | 'uj_konverzio', ok } (csak 'halasztva' sorra): az ember dontese a csere-gyanu felett.
 */
export async function sdAtvetel({ db, env, bejovo = {}, mezok, fuggosegek = {}, egyeztet, esemenyKuldo }) {
  const szaraz = bejovo.szaraz === true;
  const feloldas = bejovo.feloldas && typeof bejovo.feloldas === 'object' ? bejovo.feloldas : null;
  const most = fuggosegek.now ? fuggosegek.now() : Date.now();
  const t = sec(most);
  const uuid = String(mezok.uuid || '').toLowerCase();
  if (!UUID_MINTA.test(uuid)) return { allapot: 'ervenytelen', miert: 'ervenytelen uuid' };
  const uzletag = SALONIC_UZLETAG[mezok.host];
  if (!uzletag || !HOSTOK[mezok.host]) return { allapot: 'nincs_uzletag', miert: 'ismeretlen Salonic-host' };
  const kapcs = await sdKapcsolo(db, env, uzletag);
  if (!kapcs.be) return { allapot: 'ki', miert: kapcs.miert };
  if (String(env.MERES_ELOSZTO) !== '1') return { allapot: 'ki', miert: 'MERES_ELOSZTO nincs bekapcsolva' }; // az atvetel a motoros parositast LEZARJA: kuldes nelkul nem vesszuk at
  const sdId = await sdIdentitas(env, uuid);
  if (!sdId) return { allapot: 'ki', miert: 'hianyzik az SD_HMAC_KEY_V1' };
  const level = Date.parse(mezok.leveldatum || '');
  if (!Number.isFinite(level)) return { allapot: 'nincs_level_datuma', miert: 'a level datuma (T0) kell' };
  // a Megjegyzes mezo NELKUL a csere-felismeres vak (egy elfelejtett Zap-mezo csendben ketszer szamolna a cserelt foglalast): hianyzo mezo = nincs atvetel, nincs kuldes (az ures szoveg rendben van)
  if (typeof bejovo.megjegyzes !== 'string') return { allapot: 'hianyzo_mezo', miert: 'megjegyzes (a Salonic Megjegyzes mezoje; ures szoveg is lehet) kell a csere-felismeresehez', kuldes: 0 };
  const t0 = Math.round(level / 1000), kor = t - t0;
  await parositasSema(db); await meresSema(db);
  const alap = { sd_id: sdId, uzletag, kor_mp: kor };
  const olvas = () => db.prepare('SELECT * FROM foglalas_egyeztetes WHERE uuid = ?1').bind(uuid).first();
  let sor = await olvas();
  const h = await vendegHash(env, bejovo.vendeg || {}, bejovo.nev);
  const szolgKulcs = szolgKanon(mezok.szolgaltatas);
  const kezdet = kezdetSzamol(mezok, t0);
  const futas = { db, env, uuid, sdId, uzletag, mezok, bejovo, fuggosegek, t0, szaraz };

  // --- mar az sd-e (idempotens ujrahivas / feloldas) ---
  if (sor && sor.sd_id) {
    if (sor.sd_id !== sdId) return { ...alap, allapot: 'sd_azonosito_elter', miert: 'a sorhoz mas nevter / kulcs tartozik', riasztas: true };
    const resz = await db.prepare('SELECT * FROM foglalas_reschedule WHERE uuid = ?1').bind(uuid).first();
    const csereRow = resz ? { allapot: resz.allapot, ok: resz.ok, reschedule_from: resz.reschedule_from, reschedule_to: resz.reschedule_to, regi_uuid: resz.regi_uuid, regi_aktiv: resz.regi_aktiv === 1 ? true : resz.regi_aktiv === 0 ? false : null } : null;
    const allapot = sor.sd_allapot;
    if (feloldas) {
      if (allapot !== 'halasztva') return { ...alap, allapot: 'feloldas_nem_lehetseges', sd_allapot: allapot, miert: 'a feloldas csak halasztva (reschedule_suspected) sorra lehetseges' };
      const dontes = feloldas.dontes === 'confirmed' ? 'confirmed' : feloldas.dontes === 'uj_konverzio' ? 'uj_konverzio' : null;
      const ok = typeof feloldas.ok === 'string' ? feloldas.ok.trim().slice(0, 200) : '';
      if (!dontes || !ok) return { ...alap, allapot: 'ervenytelen_feloldas', miert: 'dontes: confirmed | uj_konverzio, ok: kotelezo szoveg' };
      if (szaraz) return { ...alap, allapot: 'szaraz_terv', sd_allapot: allapot, terv: { feloldas: dontes } };
      const mod = dontes === 'confirmed' ? 'feloldva_confirmed' : 'feloldva_uj';
      const csere = { ...(csereRow || {}), ok: 'feloldva: ' + ok };
      const k = await kuldesFuttat({ ...futas, mod: mod === 'feloldva_uj' ? 'normal' : mod, csere });
      const veg = vegAllapot(mod, csere, k);
      await rescheduleIr(db, { uuid, sdId, allapot: mod === 'feloldva_uj' ? 'feloldva_uj' : 'feloldva_confirmed', d: { ...(csereRow || {}), ok: csere.ok }, t });
      await allapotIr(db, uuid, veg.sd_allapot, t, veg.riasztas);
      return { ...alap, allapot: veg.sd_allapot, sd_allapot: veg.sd_allapot, feloldas: dontes, ...k, riasztas: veg.riasztas };
    }
    if (['halasztva', 'reschedule_confirmed', 'lejart', 'feloldva_uj', 'feloldva_confirmed'].includes(allapot)) return { ...alap, allapot, sd_allapot: allapot, idempotens: true, csere: csereKimenet(csereRow), riasztas: sor.riasztas === 1, kuldes: 0 };
    if (szaraz) return { ...alap, allapot: 'szaraz_terv', sd_allapot: allapot, terv: { ujrafuttatas: 'az elosztas idempotens ujrahivasa' } };
    // 'atveve': egy masik hivas epp dolgozik rajta (SD_ATVETEL_ELAKADAS_MP-ig); utana (Worker-halal) ujra atveheto - a cellak idempotensek
    if (allapot === 'atveve' && t - (sor.sd_ido || 0) < SD_ATVETEL_ELAKADAS_MP) return { ...alap, allapot: 'atveve', idempotens: true, miert: 'egy masik hivas feldolgozza (elakadas utan ujra atveheto)', kuldes: 0 };
    // 'atveve' (megszakadt), 'kesz', 'tartva': a kuldesi lepes idempotens ujrafuttatasa (mar vegleges cellara nem kuld ujra; a halasztott cella potlodik)
    let mod = 'normal', csere = null;
    if (csereRow && (csereRow.allapot === 'confirmed' || csereRow.allapot === 'suspected')) { mod = csereRow.allapot; csere = csereRow; }
    else if (allapot === 'atveve') { csere = await csereDontes(db, env, { uzletag, uuid, kezdet, szolgKulcs, h, megjegyzes: mezok.megjegyzes, t0, host: mezok.host, fetchImpl: fuggosegek.fetchImpl }); mod = csere.allapot === 'confirmed' ? 'confirmed' : csere.allapot === 'suspected' ? 'suspected' : 'normal'; if (mod !== 'normal') await rescheduleIr(db, { uuid, sdId, allapot: csere.allapot, d: csere, t }); }
    const k = await kuldesFuttat({ ...futas, mod, csere });
    const veg = vegAllapot(mod, csere, k);
    await allapotIr(db, uuid, veg.sd_allapot, t, veg.riasztas);
    return { ...alap, allapot: veg.sd_allapot, sd_allapot: veg.sd_allapot, ujrafuttatva: true, csere: csereKimenet(csere), ...k, riasztas: veg.riasztas };
  }
  if (feloldas) return { ...alap, allapot: 'feloldas_nem_lehetseges', miert: 'ehhez az UUID-hoz nincs sd-atvetel' };

  // --- a motor megelozte / nem dontheto el ---
  if (sor && sor.kuldve) return { ...alap, allapot: 'motor_kuldte', booking_id: sor.booking_id, kuldes: 0 };
  if (sor && sor.allapot === 'ellentmondas') return { ...alap, allapot: 'motor_ellentmondas', miert: 'a motoros parositas ellentmondast jelzett: ember dont', riasztas: true, kuldes: 0 };
  if (kor < SD_MIN_KOR_MP) return { ...alap, allapot: 'koran', miert: `a letrehozo levelnek legalabb ${SD_MIN_KOR_MP / 60} perces kell`, ujra_mp: SD_MIN_KOR_MP - kor, kuldes: 0 };
  if (kor > SD_MAX_KOR_MP) {
    if (szaraz) return { ...alap, allapot: 'szaraz_terv', terv: { lenne: 'lejart', miert: '48 oranal regebbi: nincs automatikus kuldes (naplo + riasztas)' } };
    const atvett = await atvesz(db, uuid, sdId, 'lejart', t, 1);
    return { ...alap, allapot: 'lejart', miert: '48 oranal regebbi foglalas: nincs automatikus kuldes (naplo + riasztas)', riasztas: true, naplozva: atvett, kuldes: 0 };
  }
  if (sor && sor.allapot === 'fuggoben' && sor.kovetkezo && t < sor.kovetkezo + 300) return { ...alap, allapot: 'varakozas', miert: 'a motoros parositas meg nincs lezarva (fuggoben)', kuldes: 0 };

  if (szaraz) { // IRASMENTES terv: a vegso probat nem futtatjuk (az irna), a tobbi lepest kiszamoljuk
    const csere = await csereDontes(db, env, { uzletag, uuid, kezdet, szolgKulcs, h, megjegyzes: mezok.megjegyzes, t0, host: mezok.host, fetchImpl: fuggosegek.fetchImpl });
    const mod = csere.allapot === 'confirmed' ? 'confirmed' : csere.allapot === 'suspected' ? 'suspected' : 'normal';
    const k = await kuldesFuttat({ ...futas, mod, csere });
    return { ...alap, allapot: 'szaraz_terv', terv: { motor_allapot: sor ? sor.allapot : 'nincs sor', vegso_proba: 'lenne (szarazon nem fut: irna)', atvetel: 'atomi UPSERT lenne', mod, csere: csereKimenet(csere), ...k }, kuldes: 0 };
  }

  // --- VEGSO PAROSITAS: a motoros identity az sd atomi atvetelenek pillanataig meg nyerhet (DECISION #108 szuk kivetele) ---
  if (egyeztet) {
    const v = await egyeztet(db, mezok, { ...fuggosegek, vegsoProba: true });
    if (v.allapot === 'parositott' && v.kuldheto) {
      let ek = null;
      if (esemenyKuldo && v.booking_id) { try { ek = await esemenyKuldo({ db, env, mezok, bejovo, eredmeny: v, fetchImpl: fuggosegek.fetchImpl, now: fuggosegek.now }); } catch (e) { ek = { allapot: 'hiba', miert: String((e && e.message) || e).slice(0, 200) }; } }
      return { ...alap, allapot: 'motor_nyert', late_pairing: true, miert: 'a vegso parositas sikerult: a motoros identity kuldi az esemenyt', booking_id: v.booking_id, esemeny_kuldes: ek };
    }
    if (v.allapot === 'parositott') return { ...alap, allapot: 'motor_kuldte', booking_id: v.booking_id, kuldes: 0 };
    if (v.allapot === 'ellentmondas') return { ...alap, allapot: 'motor_ellentmondas', miert: v.miert || 'ellentmondas', riasztas: true, kuldes: 0 };
    if (v.allapot === 'ervenytelen') return { ...alap, allapot: 'ervenytelen', miert: v.miert };
  }

  // --- ATOMI ATVETEL ---
  const atvett = await atvesz(db, uuid, sdId, 'atveve', t);
  if (!atvett) {
    sor = await olvas();
    if (sor && sor.sd_id === sdId) return { ...alap, allapot: sor.sd_allapot || 'atveve', idempotens: true, miert: 'egy masik hivas mar atvette', kuldes: 0 };
    if (sor && sor.kuldve) return { ...alap, allapot: 'motor_kuldte', booking_id: sor.booking_id, kuldes: 0 };
    return { ...alap, allapot: 'nem_atveheto', miert: 'a sor allapota nem engedi az atvetelt: ' + (sor ? sor.allapot : '?'), kuldes: 0 };
  }
  try { await vendegIndexSor(db, env, { mezok, vendeg: bejovo.vendeg, nev: bejovo.nev, now: most, forras: 'sd_atvetel' }); } catch (e) { /* az index sosem akadalyozhatja a kuldest */ }

  // --- CSERE-DONTES ---
  const csere = await csereDontes(db, env, { uzletag, uuid, kezdet, szolgKulcs, h, megjegyzes: mezok.megjegyzes, t0, host: mezok.host, fetchImpl: fuggosegek.fetchImpl });
  const mod = csere.allapot === 'confirmed' ? 'confirmed' : csere.allapot === 'suspected' ? 'suspected' : 'normal';
  if (mod !== 'normal') await rescheduleIr(db, { uuid, sdId, allapot: csere.allapot, d: csere, t });
  const k = await kuldesFuttat({ ...futas, mod, csere });
  const veg = vegAllapot(mod, csere, k);
  await allapotIr(db, uuid, veg.sd_allapot, t, veg.riasztas);
  return { ...alap, allapot: veg.sd_allapot, sd_allapot: veg.sd_allapot, csere: csereKimenet(csere), ...k, riasztas: veg.riasztas };
}

/**
 * sd-riasztasok (csak olvas; a regi foglalas elo allapotat ujraellenorzi): halasztva (reschedule_suspected) / tartva (az elo allapot nem ellenorizheto) / lejart / sd_atveve_serult;
 * old_booking_still_active (reschedule_confirmed, a regi foglalas meg el - az elo ujraellenorzes a riasztast megszunteti, ha kozben torolve lett); sd_hianyzik (a motoros parositas lezart, de a Zap 5. lepese nem jott).
 */
export async function sdRiasztasok(db, env, { fetchImpl, now } = {}) {
  await parositasSema(db);
  const t = sec(now ? now() : Date.now());
  const lista = [];
  const { results: sorok } = await db.prepare("SELECT e.uuid, e.sd_id, e.sd_allapot, e.sd_ido, e.frissitve, r.allapot AS csere_allapot, r.regi_uuid, r.regi_aktiv, r.reschedule_from, r.reschedule_to, r.ok AS csere_ok FROM foglalas_egyeztetes e LEFT JOIN foglalas_reschedule r ON r.uuid = e.uuid WHERE e.sd_id IS NOT NULL AND (e.sd_allapot IN ('halasztva', 'tartva', 'lejart', 'atveve') OR (e.sd_allapot = 'reschedule_confirmed' AND r.regi_aktiv IS NOT 0)) ORDER BY e.sd_ido DESC LIMIT 200").all();
  let ellenorzes = 0;
  for (const s of sorok || []) {
    let tipus = s.sd_allapot === 'reschedule_confirmed' ? 'old_booking_still_active' : s.sd_allapot === 'halasztva' ? 'reschedule_suspected' : s.sd_allapot === 'tartva' ? 'elo_allapot_nem_ellenorizheto' : s.sd_allapot === 'lejart' ? 'lejart_48_ora' : 'atvetel_megszakadt';
    if (tipus === 'old_booking_still_active' && s.regi_uuid && fetchImpl && ellenorzes < 20) { // elo ujraellenorzes: a regi foglalas kozben torolve lett?
      const uz = await db.prepare('SELECT uzletag FROM foglalas_vendeg WHERE uuid = ?1').bind(s.regi_uuid).first();
      const hostnev = uz ? Object.keys(HOSTOK).find((x) => HOSTOK[x].uzletag === uz.uzletag) : null;
      if (hostnev) {
        ellenorzes++;
        const elo = await foglalasAllapot({ host: hostnev, uuid: s.regi_uuid, fetchImpl });
        if (elo.allapot === 'torolve') { await db.prepare('UPDATE foglalas_reschedule SET regi_aktiv = 0, frissitve = ?2 WHERE uuid = ?1').bind(s.uuid, t).run(); await db.prepare('UPDATE foglalas_egyeztetes SET riasztas = 0, frissitve = ?2 WHERE uuid = ?1').bind(s.uuid, t).run(); continue; }
      }
    }
    lista.push({ tipus, uuid: s.uuid, sd_id: s.sd_id, sd_allapot: s.sd_allapot, regi_uuid_elo8: s.regi_uuid ? String(s.regi_uuid).slice(0, 8) : null, reschedule_from: s.reschedule_from, reschedule_to: s.reschedule_to, ok: s.csere_ok, ido: s.sd_ido });
  }
  // sd_hianyzik: a motoros parositas LEZART (parositatlan), nincs kuldes, nincs sd-atvetel, a letrehozo level 20 perc es 48 ora kozott van
  if (String((env && env.MERES_SALONIC_DIRECT) || '') === '1') {
    const { results: hi } = await db.prepare("SELECT uuid, letrehozva FROM foglalas_egyeztetes WHERE sd_id IS NULL AND kuldve IS NULL AND allapot = 'parositatlan' AND letrehozva <= ?1 AND letrehozva >= ?2 ORDER BY letrehozva DESC LIMIT 200").bind(t - SD_MIN_KOR_MP, t - SD_MAX_KOR_MP).all();
    for (const s of hi || []) lista.push({ tipus: 'sd_hianyzik', uuid: s.uuid, ido: s.letrehozva });
  }
  return { db: lista.length, riasztas: lista.length > 0, lista };
}

/** A foglalas-kulcs.js dispatchere (deps.sdKezelo). */
export async function sdKezel(be) {
  if (be.muvelet === 'vendeg_index') return vendegIndexMuvelet(be);
  if (be.muvelet === 'sd_atvetel' || be.muvelet === 'sd_feloldas') {
    const bejovo = be.muvelet === 'sd_feloldas' ? { ...be.bejovo, feloldas: { dontes: be.bejovo.dontes, ok: be.bejovo.ok } } : be.bejovo;
    return sdAtvetel({ ...be, bejovo });
  }
  return { allapot: 'ismeretlen_muvelet' };
}
