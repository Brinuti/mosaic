// GYOGYTORNASZOM.HU foglalomotor - a Worker (Cloudflare Pages Functions) vegpontjainak logikaja. A functions/api/*.js csak vekony burok.
// Szabaly: GY-FOGLALOMOTOR-FELADAT.md (GY-15) + GY-FOGLALOMOTOR-FEJLESZTESI-SPEC.md 4-5., 9. pont. Adatvedelem: docs/ADATTERKEP.md.
//
//   POST /api/gy-forras      forras-megtartas: munkamenet-suti (gy_s; 30 perc inaktivitas / max 24 ora), hozzajarulassal 30 napos gy_lpt
//   POST /api/gy-foglalas    a Salonic-atiranyitas szerveroldali ellenorzese + idempotens D1-rekord + egyszeri, 15 perces koszono-token
//   POST /api/gy-koszono     a koszonooldal a tokennel kapja a foglalas_kesz esemeny adatait (egyszer)
//   POST /api/gy-kampanyok   (kulcsos) a Google Ads kampanylista napi szinkronja
//   GET/POST /api/gy-admin   (kulcsos) riport, riasztasok, egyeztetes
// Hibaban a vendeg foglalasa NEM akad el: ezek a vegpontok csak a merest szolgaljak, a foglalast a Salonic rogziti.
import { belepes, osszevon, cimkez, fizetett } from './forras.js';
import { sutik, hozzajarulas } from './hozzajarulas.js';
import { sha256Hex, ujToken, tranzakcioId, egyenlo, hmacHex } from './titkos.js';
import { igazolasJeloltek, foglalasSalonicIdAlapjan } from './db.js';
import { sema, munkamenetOlvas, munkamenetIr, munkamenetTorol, foglalasOlvas, foglalasLetrehoz, foglalasAllapot, esemenyJelol, tokenKiad, tokenFelhasznal, kampanyLista, kampanyFrissit, riaszt, takarit, IDOK } from './db.js';
import { szerverAdapter, katalogusSzolgaltatas, szabadMeg, eloAllapot, UUID_RE } from './salonic-szerver.js';
import { foglalasTipus, HELYSZINEK, HOST } from '../public/assets/js/motor/salonic-adapter.js';

export const SUTI_MUNKAMENET = 'gy_s';
export const SUTI_LPT = 'gy_lpt';
export const BOOKING_ID = /^mb_[a-z0-9]{12,40}$/;
const BRAND_ALAP = '1655523772'; // 259-612-0588 / "04 BRAND gyogytornaszom.hu" (GY-15 2/A)
const KOSZONO = Object.freeze({ allapotfelmeres: '/allapot-ok/', egyeb: '/foglalas-ok/' });

const ALAP_FEJLEC = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' };
export const valasz = (status, body, extra = {}) => {
  const h = new Headers({ ...ALAP_FEJLEC });
  const cookies = extra.cookies || [];
  for (const [k, v] of Object.entries(extra)) if (k !== 'cookies') h.set(k, v);
  for (const c of cookies) h.append('set-cookie', c);
  return new Response(JSON.stringify(body), { status, headers: h });
};

const nincsKerelem = (kod) => valasz(400, { ok: false, hiba: kod });

/** A kerelem eredete: csak a sajat tartomany (vagy a GY_ORIGINS lista) kuldhet POST-ot. A kotelezo "Origin" fejlec hianya = nem bongeszo, elutasitjuk. */
export function eredetEngedett(request, env) {
  const o = request.headers.get('origin');
  if (!o) return false;
  let sajat;
  try { sajat = new URL(request.url).origin; } catch (e) { return false; }
  if (o === sajat) return true;
  return String(env.GY_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean).includes(o);
}

async function jsonTest(request, maxBajt = 8192) {
  const t = await request.text();
  if (t.length > maxBajt) return null;
  try { const j = JSON.parse(t); return j && typeof j === 'object' ? j : null; } catch (e) { return null; }
}

const mostUnix = (deps) => Math.floor((deps && deps.most ? deps.most() : Date.now()) / 1000);
const suti = (nev, ertek, { maxAge = null, torol = false } = {}) => `${nev}=${torol ? '' : ertek}; Path=/; Secure; HttpOnly; SameSite=Lax${torol ? '; Max-Age=0' : maxAge ? `; Max-Age=${maxAge}` : ''}`;
const attrNelkul = (env) => String(env.GY_ATTR_NELKUL ?? '1') !== '0'; // Feri dontese 2026-10-13: hozzajarulas nelkul is menjen a (24 oras) munkamenet-forras; vesz-kikapcsolas: "0"

// --- /api/gy-forras -----------------------------------------------------------------------------------------------------------
export async function forrasVegpont({ request, env, deps = {} }) {
  if (request.method !== 'POST') return valasz(405, { ok: false });
  if (!eredetEngedett(request, env)) return valasz(403, { ok: false, hiba: 'eredet' });
  const db = env.GY_DB;
  if (!db) return valasz(503, { ok: false, hiba: 'nincs_adatbazis' });
  const be = await jsonTest(request);
  if (!be) return nincsKerelem('ervenytelen_torzs');
  await sema(db);
  const most = mostUnix(deps);
  const s = sutik(request.headers.get('cookie'));
  const hj = hozzajarulas(request.headers.get('cookie'));
  const extra = { cookies: [] };
  const sajatHostok = ['gyogytornaszom.hu', new URL(request.url).hostname.replace(/^www\./, '')];
  const uj = belepes({ search: typeof be.search === 'string' ? be.search.slice(0, 1500) : '', referrer: typeof be.referrer === 'string' ? be.referrer.slice(0, 500) : '', path: typeof be.path === 'string' ? be.path : '/', sajatHostok });

  // 24 oras munkamenet (hozzajarulas nelkul is, ha a kapcsolo be van)
  if (attrNelkul(env) || hj.marketing) {
    let idHash = null, rec = null;
    if (s[SUTI_MUNKAMENET] && /^[A-Za-z0-9_-]{43}$/.test(s[SUTI_MUNKAMENET])) { idHash = await sha256Hex(s[SUTI_MUNKAMENET]); rec = await munkamenetOlvas(db, idHash, most); }
    const egyesitett = osszevon(rec && rec.belepes ? { belepes: rec.belepes, fizetett: rec.fizetett } : null, uj);
    if (!rec) {
      const token = ujToken();
      idHash = await sha256Hex(token);
      extra.cookies.push(suti(SUTI_MUNKAMENET, token)); // munkamenet-suti: Max-Age nelkul; a szerveroldali TTL dont (inaktivitas / max 24 ora)
      await munkamenetIr(db, { idHash, fajta: 'm', letrehozva: most, utolso: most, lejar: most + IDOK.munkamenetMax, hozzajarulas: hj.allapot, fizetett: egyesitett.fizetett, belepes: egyesitett.belepes });
    } else {
      await munkamenetIr(db, { idHash, fajta: 'm', letrehozva: rec.letrehozva, utolso: most, lejar: rec.lejar, hozzajarulas: hj.allapot, fizetett: egyesitett.fizetett, belepes: egyesitett.belepes });
    }
  }

  // 30 napos "utolso fizetett erintes" CSAK hirdetesi hozzajarulassal; visszavonaskor (nincs marketing-hozzajarulas) a rekord es a suti torlodik
  if (hj.marketing) {
    let lHash = null, lRec = null;
    if (s[SUTI_LPT] && /^[A-Za-z0-9_-]{43}$/.test(s[SUTI_LPT])) { lHash = await sha256Hex(s[SUTI_LPT]); lRec = await munkamenetOlvas(db, lHash, most); }
    if (fizetett(uj) || lRec) {
      const egy = osszevon(lRec && lRec.belepes ? { belepes: lRec.belepes, fizetett: lRec.fizetett } : null, uj);
      if (egy.fizetett) {
        if (!lRec) { const t = ujToken(); lHash = await sha256Hex(t); extra.cookies.push(suti(SUTI_LPT, t, { maxAge: IDOK.hozzajarulasMax })); }
        await munkamenetIr(db, { idHash: lHash, fajta: 'l', letrehozva: lRec ? lRec.letrehozva : most, utolso: most, lejar: lRec ? lRec.lejar : most + IDOK.hozzajarulasMax, hozzajarulas: 'igen', fizetett: true, belepes: egy.belepes });
      }
    }
  } else if (s[SUTI_LPT]) {
    if (/^[A-Za-z0-9_-]{43}$/.test(s[SUTI_LPT])) await munkamenetTorol(db, await sha256Hex(s[SUTI_LPT]));
    extra.cookies.push(suti(SUTI_LPT, '', { torol: true }));
  }
  return valasz(200, { ok: true }, extra);
}

// --- az atiranyitas ellenorzese (a Worker a SAJAT elo Salonic-adataibol kepez varhato erteket) ----------------------------------------------------------
const egesz = (v, min, max) => (/^\d{1,12}$/.test(String(v ?? '')) && +v >= min && +v <= max ? +v : null);

/** A Salonic-atiranyitas URL-jenek felbontasa: a thank-you cimen a Salonic parameterei (price, first_booking, g, bookingUrl). */
export function atiranyitasElemzes(url) {
  let u;
  try { u = new URL(String(url), 'https://redirect.invalid'); } catch (e) { return null; }
  const q = u.searchParams;
  let bu = null;
  try { if (q.get('bookingUrl')) bu = new URL(q.get('bookingUrl'), HOST); } catch (e) { return null; }
  if (!bu || bu.hostname !== new URL(HOST).hostname) return null;
  const emp = bu.searchParams.get('employeeId');
  return {
    ar: egesz((q.get('price') || '').replace(/[^\d]/g, ''), 0, 10000000),
    ujVendeg: q.get('first_booking') === 'true' ? 'uj' : q.get('first_booking') === 'false' ? 'visszatero' : 'ismeretlen',
    g: (q.get('g') || '').slice(0, 40),
    placeId: egesz(bu.searchParams.get('placeId'), 1, 999999),
    serviceId: (bu.searchParams.get('serviceId') || '').replace(/[^\d]/g, '') || null,
    startUnix: egesz(bu.searchParams.get('startDate'), 1e9, 4e9),
    employeeId: emp !== null && /^\d+$/.test(emp) ? emp : null,
    bookingBack: bu.searchParams.get('back') || null,
  };
}

// --- /api/gy-foglalas ------------------------------------------------------------------------------------------------------------
export async function foglalasVegpont({ request, env, deps = {} }) {
  if (request.method !== 'POST') return valasz(405, { ok: false });
  if (!eredetEngedett(request, env)) return valasz(403, { ok: false, hiba: 'eredet' });
  const db = env.GY_DB;
  if (!db) return valasz(503, { ok: false, hiba: 'nincs_adatbazis' });
  if (!env.GY_HMAC_KULCS || String(env.GY_HMAC_KULCS).length < 16) return valasz(503, { ok: false, hiba: 'nincs_titkos_kulcs' });
  const be = await jsonTest(request);
  if (!be || !BOOKING_ID.test(String(be.uuid || ''))) return nincsKerelem('ervenytelen_kerelem');
  await sema(db);
  const most = mostUnix(deps);
  const uuid = String(be.uuid);
  const hj = hozzajarulas(request.headers.get('cookie'));
  const ad = szerverAdapter(env, deps.fetch || globalThis.fetch);

  const e = atiranyitasElemzes(be.redirect_url);
  const kert = { placeId: egesz(be.place_id, 1, 999999), serviceId: String(be.service_id || '').replace(/[^\d]/g, ''), startUnix: egesz(be.start_unix, 1e9, 4e9) };
  if (!e || !HELYSZINEK[kert.placeId] || !kert.serviceId || kert.startUnix === null) return nincsKerelem('ervenytelen_atiranyitas');
  // 2) a szolgaltatas ELO adata a Salonicbol (ar, nev nem kerul tarolasra): a konverzio ertekenek forrasa
  const szolg = await katalogusSzolgaltatas(ad, kert.placeId, kert.serviceId);
  const arJo = !!(szolg && Number.isInteger(szolg.activePrice) && szolg.activePrice > 0 && e.ar !== null && e.ar > 0 && e.ar <= szolg.activePrice);
  const ertek = arJo ? e.ar : null; // a kedvezmenyes (tenylegesen fizetett) ar a Salonic atiranyitasabol, a katalogus-arral korlatozva

  // idempotencia: ugyanarra a motor-UUID-ra nincs masodik rekord / masodik esemeny; az esemeny meg nem kiadott (a token elveszett / lejart) -> uj token
  const regi = await foglalasOlvas(db, uuid);
  if (regi) {
    const token = regi.allapot === 'aktiv' && !regi.esemeny_kiadva && !regi.teszt && ertek !== null ? await tokenKiadas(db, uuid, regi.tipus, ertek, most) : null;
    return valasz(200, { ok: true, ismetles: true, allapot: regi.allapot, koszono: KOSZONO[regi.tipus] || KOSZONO.egyeb, ...(token ? { token } : {}) });
  }

  // 1) a Salonic atiranyitasa egyezik-e a kert valasztassal (hely, szolgaltatas, idopont)?
  const egyezik = e.placeId === kert.placeId && e.serviceId === kert.serviceId && e.startUnix === kert.startUnix;
  // 3) az idopont mar nem szabad? (a foglalt idopont a szabadok kozul eltunik) - a Salonic "barmelyik" (employeeId=-1) foglalasanal a kiosztott munkatars a bookingUrl-ben van
  const dolgozo = e.employeeId && +e.employeeId > 0 ? e.employeeId : (+be.staff_id > 0 ? String(be.staff_id) : null);
  const meg = dolgozo ? await szabadMeg(ad, { placeId: kert.placeId, serviceId: kert.serviceId, staffId: dolgozo, startUnix: kert.startUnix }) : null;
  const tesztG = String(env.GY_TESZT_G || '').split(',').map((x) => x.trim()).filter(Boolean);
  const teszt = !!(e.g && tesztG.includes(e.g));
  const tipus = foglalasTipus(kert.serviceId);
  let allapot = 'aktiv';
  let miert = null;
  if (!egyezik) { allapot = 'bizonytalan'; miert = 'atiranyitas_nem_egyezik'; }
  else if (!szolg) { allapot = 'bizonytalan'; miert = 'katalogus_nem_elerheto'; }
  else if (meg === null) { allapot = 'bizonytalan'; miert = dolgozo ? 'idopont_nem_ellenorizheto' : 'nincs_munkatars'; }
  else if (meg === true) { allapot = 'bizonytalan'; miert = 'idopont_meg_szabad'; }
  else if (!arJo) { allapot = 'bizonytalan'; miert = 'ar_nem_egyezik'; }

  // forras-cimke a foglalas pillanataban (munkamenet es / vagy 30 napos rekord; "utolso fizetett"-et vesszuk)
  const s = sutik(request.headers.get('cookie'));
  const rekordok = [];
  for (const nev of [SUTI_MUNKAMENET, SUTI_LPT]) {
    if (s[nev] && /^[A-Za-z0-9_-]{43}$/.test(s[nev])) { const r = await munkamenetOlvas(db, await sha256Hex(s[nev]), most); if (r && r.belepes) rekordok.push(r); }
  }
  const valasztott = rekordok.find((r) => r.fizetett) || rekordok[0] || null;
  const t = await kampanyLista(db, most);
  const c = cimkez(valasztott ? valasztott.belepes : null, { lista: t.lista, friss: t.friss });
  const parosito = e.employeeId ? await hmacHex(env.GY_HMAC_KULCS, `gy-parosito|${kert.startUnix}|${e.employeeId}`) : null;
  const parositoHely = await hmacHex(env.GY_HMAC_KULCS, `gy-hely|${kert.startUnix}|${kert.placeId}`); // a Salonic-igazolas parositasahoz (hely + idopont)

  const letrejott = await foglalasLetrehoz(db, { uuid, tipus, uj_vendeg: e.ujVendeg, cimke: c.cimke, bizonyitek: c.bizonyitek + (c.elavult ? '+elavult_lista' : ''), hozzajarulas: hj.allapot, allapot, teszt, parosito, parosito_hely: parositoHely }, most);
  if (!letrejott) return valasz(200, { ok: true, ismetles: true }); // versenyhelyzet: egy masik kerelem mar letrehozta
  if (allapot !== 'aktiv') await riaszt(db, 'bizonytalan_foglalas', { uuid, adat: miert, most });
  let token = null;
  if (allapot === 'aktiv' && !teszt && ertek !== null) token = await tokenKiadas(db, uuid, tipus, ertek, most);
  if (Math.random() < 0.02) takarit(db, most).catch(() => {}); // a megorzesi idok szerinti torles; nem blokkol
  return valasz(200, { ok: true, allapot, koszono: KOSZONO[tipus], ...(token ? { token } : {}) });
}

async function tokenKiadas(db, uuid, tipus, ertek, most) {
  if (!Number.isInteger(ertek) || ertek <= 0) return null;
  const token = ujToken();
  await tokenKiad(db, { hash: await sha256Hex(token), uuid, tipus, ertek, most });
  return token;
}

// --- /api/gy-koszono ---------------------------------------------------------------------------------------------------------------
export async function koszonoVegpont({ request, env, deps = {} }) {
  if (request.method !== 'POST') return valasz(405, { ok: false });
  if (!eredetEngedett(request, env)) return valasz(403, { ok: false, hiba: 'eredet' });
  const db = env.GY_DB;
  if (!db) return valasz(503, { ok: false, hiba: 'nincs_adatbazis' });
  const be = await jsonTest(request, 2048);
  const semleges = valasz(200, {}); // ervenytelen / hasznalt / lejart token vagy token nelkuli megnyitas: semleges valasz, esemeny nelkul
  if (!be || !/^[A-Za-z0-9_-]{43}$/.test(String(be.token || ''))) return semleges;
  if (!env.GY_HMAC_KULCS) return semleges;
  await sema(db);
  const most = mostUnix(deps);
  const sor = await tokenFelhasznal(db, await sha256Hex(String(be.token)), most);
  if (!sor) return semleges;
  const f = await foglalasOlvas(db, sor.uuid);
  // esemeny csak aktiv, nem teszt foglalasra, es csak egyszer (tartos deduplikacio: esemeny_kiadva)
  if (!f || f.allapot !== 'aktiv' || f.teszt || !(await esemenyJelol(db, sor.uuid, most))) return semleges;
  return valasz(200, { tipus: sor.tipus, ertek: sor.ertek, tranzakcio_id: await tranzakcioId(sor.uuid, env.GY_HMAC_KULCS) });
}

// --- kulcsos vegpontok ------------------------------------------------------------------------------------------------------------------
async function kulcsOk(request, env, fejlec, hashVar) {
  const k = request.headers.get(fejlec);
  if (!k || !env[hashVar]) return false;
  return egyenlo(await sha256Hex(k), String(env[hashVar]));
}

/** POST /api/gy-kampanyok {kampanyok:[{id, nev, allapot}], brand_ids?:[..]} - a Google Ads (259-612-0588) kampanylistaja (napi GAQL-szinkron kulcsos hivasa). */
export async function kampanyokVegpont({ request, env, deps = {} }) {
  if (request.method !== 'POST') return valasz(405, { ok: false });
  if (!(await kulcsOk(request, env, 'x-gy-kulcs', 'GY_ADMIN_KULCS_HASH'))) return valasz(401, { ok: false });
  const db = env.GY_DB;
  if (!db) return valasz(503, { ok: false, hiba: 'nincs_adatbazis' });
  const be = await jsonTest(request, 262144);
  if (!be || !Array.isArray(be.kampanyok) || !be.kampanyok.length || be.kampanyok.length > 2000) return nincsKerelem('ervenytelen_lista');
  const brand = new Set((Array.isArray(be.brand_ids) && be.brand_ids.length ? be.brand_ids : [env.GY_BRAND_ID || BRAND_ALAP]).map(String));
  const lista = [];
  for (const k of be.kampanyok) {
    const id = String(k && k.id || '');
    if (!/^\d{6,15}$/.test(id)) return nincsKerelem('ervenytelen_kampany_id');
    lista.push({ id, nev: k.nev, allapot: k.allapot, brand: brand.has(id) });
  }
  await sema(db);
  await kampanyFrissit(db, lista, mostUnix(deps));
  return valasz(200, { ok: true, db: lista.length, brand: lista.filter((x) => x.brand).length });
}

// --- /api/gy-salonic-igazolas (Zapier: a Salonic ertesito e-mail alapjan) ---------------------------------------------------------------
// A Zap CSAK minimalis egyeztetomezoket kuld: {esemeny:'igazolas'|'lemondas', salonic_id (UUID), start_unix, place_id}. Nev, e-mail, telefon, szolgaltatasnev NEM.
// Hitelesites: x-gy-zap-kulcs fejlec (a kulcs SHA-256 hash-e: GY_ZAP_KULCS_HASH). A szerver a Salonic ELO bookingDetails oldalat is ellenorzi (a Zap allitasat
// onmagaban nem fogadjuk el). Idempotens: ugyanarra a salonic_id-ra az ujrakuldes nem hoz letre / nem modosit tobbet.
export async function igazolasVegpont({ request, env, deps = {} }) {
  if (request.method !== 'POST') return valasz(405, { ok: false });
  if (!(await kulcsOk(request, env, 'x-gy-zap-kulcs', 'GY_ZAP_KULCS_HASH'))) return valasz(401, { ok: false });
  const db = env.GY_DB;
  if (!db) return valasz(503, { ok: false, hiba: 'nincs_adatbazis' });
  if (!env.GY_HMAC_KULCS) return valasz(503, { ok: false, hiba: 'nincs_titkos_kulcs' });
  const be = await jsonTest(request, 2048);
  if (!be || !['igazolas', 'lemondas'].includes(be.esemeny) || !UUID_RE.test(String(be.salonic_id || '').toLowerCase())) return nincsKerelem('ervenytelen_kerelem');
  const salonicId = String(be.salonic_id).toLowerCase();
  await sema(db);
  const most = mostUnix(deps);
  const tudott = await foglalasSalonicIdAlapjan(db, salonicId);
  const elo = await eloAllapot(salonicId, { fetchFn: deps.fetch || globalThis.fetch });

  if (be.esemeny === 'lemondas') {
    if (!tudott) { await riaszt(db, 'lemondas_ismeretlen', { most }); return valasz(404, { ok: false, hiba: 'ismeretlen_foglalas' }); }
    if (elo.allapot !== 'torolve') return valasz(409, { ok: false, hiba: 'nincs_torolve' });
    if (tudott.allapot !== 'lemondott') await foglalasAllapot(db, tudott.uuid, 'lemondott', most);
    return valasz(200, { ok: true, allapot: 'lemondott', ismetles: tudott.allapot === 'lemondott' });
  }

  if (tudott) return valasz(200, { ok: true, ismetles: true, allapot: tudott.allapot, igazolt: !!tudott.igazolt }); // Zap-ujrakuldes: nincs duplikacio
  const start = egesz(be.start_unix, 1e9, 4e9), hely = egesz(be.place_id, 1, 999999);
  if (start === null || !HELYSZINEK[hely]) return nincsKerelem('ervenytelen_idopont_vagy_hely');
  if (elo.allapot !== 'aktiv' || (elo.startUnix && elo.startUnix !== start)) { await riaszt(db, 'igazolas_nem_aktiv', { adat: elo.miert || elo.allapot, most }); return valasz(409, { ok: false, hiba: 'nem_aktiv_vagy_idopont_nem_egyezik' }); }
  const jeloltek = await igazolasJeloltek(db, await hmacHex(env.GY_HMAC_KULCS, `gy-hely|${start}|${hely}`));
  if (jeloltek.length === 0) { await riaszt(db, 'igazolas_nincs_par', { most }); return valasz(404, { ok: false, hiba: 'nincs_par' }); }
  if (jeloltek.length > 1) { await riaszt(db, 'igazolas_tobb_par', { adat: `db=${jeloltek.length}`, most }); return valasz(409, { ok: false, hiba: 'tobb_par' }); }
  await foglalasAllapot(db, jeloltek[0].uuid, 'aktiv', most, { salonic_id: salonicId, igazolt: true });
  return valasz(200, { ok: true, allapot: 'aktiv', igazolt: true });
}

/** GET /api/gy-admin?riport=YYYY-MM | ?riasztasok=1 | ?foglalas=<uuid>   (x-gy-kulcs). A riport CSAK aggregalt szamokat ad, vendegadat nincs. */
export async function adminVegpont({ request, env, deps = {} }) {
  if (!(await kulcsOk(request, env, 'x-gy-kulcs', 'GY_ADMIN_KULCS_HASH'))) return valasz(401, { ok: false });
  const db = env.GY_DB;
  if (!db) return valasz(503, { ok: false, hiba: 'nincs_adatbazis' });
  await sema(db);
  const u = new URL(request.url);
  const most = mostUnix(deps);
  if (u.searchParams.get('riasztasok')) {
    const r = (await db.prepare('SELECT id, ido, tipus, uuid, adat FROM gy_riasztas ORDER BY id DESC LIMIT 200').all()).results || [];
    return valasz(200, { ok: true, riasztasok: r });
  }
  const f = u.searchParams.get('foglalas');
  if (f && BOOKING_ID.test(f)) {
    const r = await foglalasOlvas(db, f);
    return valasz(200, { ok: true, foglalas: r ? { ...r, parosito: undefined } : null });
  }
  const ho = u.searchParams.get('riport');
  if (ho && /^\d{4}-\d{2}$/.test(ho)) {
    const [ev, m] = ho.split('-').map(Number);
    const tol = Date.UTC(ev, m - 1, 1) / 1000, ig = Date.UTC(ev, m, 1) / 1000;
    const sorok = (await db.prepare(
      `SELECT tipus, uj_vendeg, cimke, hozzajarulas, allapot, igazolt, COUNT(*) AS db FROM gy_foglalas WHERE letrehozva >= ?1 AND letrehozva < ?2 AND teszt = 0 GROUP BY tipus, uj_vendeg, cimke, hozzajarulas, allapot, igazolt`,
    ).bind(tol, ig).all()).results || [];
    // 90%-os cel (GY-15 3. pont): nevezo = nem lemondott, UJ vendeges allapotfelmeres; erdemben azonositott: google_brand | google_nem_brand | organikus | direkt
    const nevezo = sorok.filter((s) => s.tipus === 'allapotfelmeres' && s.uj_vendeg === 'uj' && s.allapot !== 'lemondott' && s.allapot !== 'bizonytalan');
    const osszeg = (l) => l.reduce((a, s) => a + s.db, 0);
    const azonositott = nevezo.filter((s) => ['google_brand', 'google_nem_brand', 'organikus', 'direkt'].includes(s.cimke));
    const bontas = (hj) => { const l = nevezo.filter((s) => (hj ? s.hozzajarulas === 'igen' : s.hozzajarulas !== 'igen')); const a = l.filter((s) => azonositott.includes(s)); return { nevezo: osszeg(l), azonositott: osszeg(a), hiany_google_bizonytalan: osszeg(l.filter((s) => s.cimke === 'google_bizonytalan')), hiany_ismeretlen: osszeg(l.filter((s) => s.cimke === 'ismeretlen')) }; };
    return valasz(200, { ok: true, honap: ho, osszes: osszeg(sorok), nevezo: osszeg(nevezo), azonositott: osszeg(azonositott), hozzajarulo: bontas(true), nem_hozzajarulo: bontas(false), sorok });
  }
  void most;
  return nincsKerelem('ismeretlen_muvelet');
}

export { eloAllapot };
