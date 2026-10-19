// GYOGYTORNASZOM.HU foglalomotor - a Worker (Cloudflare Pages Functions) vegpontjainak logikaja. A functions/api/*.js csak vekony burok.
// Szabaly: GY-FOGLALOMOTOR-FELADAT.md (GY-15) + GY-FOGLALOMOTOR-FEJLESZTESI-SPEC.md 4-5., 9. pont. Adatvedelem: docs/ADATTERKEP.md.
//
//   POST /api/gy-forras      forras-megtartas: munkamenet-suti (gy_s; 30 perc inaktivitas / max 24 ora), hozzajarulassal 30 napos gy_lpt
//   POST /api/gy-foglalas    a Salonic-atiranyitas szerveroldali ellenorzese + idempotens D1-rekord + egyszeri, 15 perces koszono-token
//   POST /api/gy-koszono     a koszonooldal a tokennel kapja a foglalas_kesz esemeny adatait (egyszer)
//   POST /api/gy-kampanyok   (kulcsos) a Google Ads kampanylista napi szinkronja
//   POST /api/gy-visszahivas a "telefonon egyeztetek idopontot" visszahivas-kerelem (nev + telefon), D1 + ertesito webhook
//   GET/POST /api/gy-suti-config  a sav-teszt konfigja (GET: nyilvanos, rovid cache; POST: kulcsos csere, deploy nelkul)
//   GET/POST /api/gy-admin   (kulcsos) riport, riasztasok, egyeztetes, visszahivasok
// Hibaban a vendeg foglalasa NEM akad el: ezek a vegpontok csak a merest szolgaljak, a foglalast a Salonic rogziti.
import { belepes, osszevon, cimkez, fizetett, hirdetesAzonositok, GOOGLE_KATT, lpcFizetett, lpcCimke, lpcHozzarendel, erintesAdatok, nemFizetettCimke, LPC_VERZIO } from './forras.js';
import { sutik, hozzajarulas } from './hozzajarulas.js';
import { sha256Hex, ujToken, tranzakcioId, egyenlo, hmacHex } from './titkos.js';
import { igazolasJeloltek, foglalasSalonicIdAlapjan } from './db.js';
import { sema, munkamenetOlvas, munkamenetIr, munkamenetTorol, foglalasOlvas, foglalasLetrehoz, foglalasAllapot, esemenyJelol, tokenKiad, tokenFelhasznal, kampanyLista, kampanyFrissit, riaszt, takarit, IDOK, erintesUtolso, erintesIr, erintesek, erintesTorol, lpcHiba, motorStatNo } from './db.js';
import { szerverAdapter, katalogusSzolgaltatas, szabadMeg, eloAllapot, UUID_RE } from './salonic-szerver.js';
/** Unix -> Budapest helyi ido, Google Ads import formatum: "yyyy-mm-dd hh:mm:ss+hh:mm" (a nyari / teli ido szerinti eltolassal). */
export function budapestIdo(unix) {
  if (!Number.isInteger(unix)) return null;
  const d = new Date(unix * 1000);
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Budapest', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(d).map((x) => [x.type, x.value]));
  const off = Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - d.getTime()) / 60000);
  const a = Math.abs(off);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}${off >= 0 ? '+' : '-'}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}
const nevNorm = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
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
const savKi = (env) => String(env.GY_SAV_KI ?? '0') === '1'; // sutisav kikapcsolva: dontes nelkul az alapertelmezes "megadott" (Feri dontese 2026-10-14); vesz-kikapcsolas: "0"
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
  const hj = hozzajarulas(request.headers.get('cookie'), { alap: savKi(env) });
  const extra = { cookies: [] };
  const sajatHostok = ['gyogytornaszom.hu', new URL(request.url).hostname.replace(/^www\./, '')];
  const uj = belepes({ search: typeof be.search === 'string' ? be.search.slice(0, 1500) : '', referrer: typeof be.referrer === 'string' ? be.referrer.slice(0, 500) : '', path: typeof be.path === 'string' ? be.path : '/', sajatHostok });

  // 24 oras munkamenet (hozzajarulas nelkul is, ha a kapcsolo be van)
  if (attrNelkul(env) || hj.marketing) {
    let idHash = null, rec = null;
    if (s[SUTI_MUNKAMENET] && /^[A-Za-z0-9_-]{43}$/.test(s[SUTI_MUNKAMENET])) { idHash = await sha256Hex(s[SUTI_MUNKAMENET]); rec = await munkamenetOlvas(db, idHash, most); }
    const egyesitett = osszevon(rec && rec.belepes ? { belepes: rec.belepes, fizetett: rec.fizetett } : null, uj);
    if (!hj.marketing && egyesitett.belepes) egyesitett.belepes = { ...egyesitett.belepes, kattintas_ertek: null }; // hirdetesi hozzajarulas nelkul nyers click-ID nem tarolodik
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
    // GY-22 (ARNYEK): a fizetett erintes a naploba is (csak D1; a foglalasi folyamatot nem valtoztatja). Fail-open: hibaban a vendeg semmit nem erez.
    if (lpcFizetett(uj) && !(lRec && lRec.belepes && uj.kattintas_ertek && lRec.belepes.kattintas_ertek === uj.kattintas_ertek)) { // ugyanaz a kattintas (belso navigacio gclid-del): nem uj erintes
      try {
        let lh = lHash;
        if (!lh) { const t = ujToken(); lh = await sha256Hex(t); extra.cookies.push(suti(SUTI_LPT, t, { maxAge: IDOK.hozzajarulasMax })); await munkamenetIr(db, { idHash: lh, fajta: 'l', letrehozva: most, utolso: most, lejar: most + IDOK.hozzajarulasMax, hozzajarulas: 'igen', fizetett: true, belepes: uj }); }
        const azon = hirdetesAzonositok(uj);
        const oldal = uj.landing || '/';
        const elozo = await erintesUtolso(db, lh);
        const ugyanaz = elozo && most - elozo.ido < 1800 && (elozo.kampany || null) === azon.kampany && (elozo.hirdetescsoport || null) === azon.hirdetescsoport && (elozo.hirdetes || null) === azon.hirdetes && elozo.oldal === oldal;
        if (!ugyanaz) { // ujratoltes / ismetelt ping: nem uj erintes
          const t2 = await kampanyLista(db, most);
          const ea = erintesAdatok(uj, { lista: t2.lista, friss: t2.friss });
          await erintesIr(db, { latogato: lh, ido: most, cimke: ea.cimke, bizonyitek: ea.bizonyitek, platform: ea.platform, katt_tipus: ea.katt_tipus, katt_ertek: ea.katt_ertek, kampany: azon.kampany, hirdetescsoport: azon.hirdetescsoport, hirdetes: azon.hirdetes, oldal, hozzajarulas: hj.allapot, szabaly_verzio: LPC_VERZIO });
        }
      } catch (e) { await lpcHiba(db, most, 'iras'); }
    }
  } else if (s[SUTI_LPT]) {
    if (/^[A-Za-z0-9_-]{43}$/.test(s[SUTI_LPT])) {
      const lh = await sha256Hex(s[SUTI_LPT]);
      await munkamenetTorol(db, lh);
      try { await erintesTorol(db, lh); } catch (e) { await lpcHiba(db, most, 'torles'); } // visszavont hozzajarulas: a naplo is torlodik
    }
    extra.cookies.push(suti(SUTI_LPT, '', { torol: true }));
  }
  if (Math.random() < 0.01) takarit(db, most).catch(() => {}); // a megorzesi idok szerinti torles (erintesi naplo: 37 nap); nem blokkol
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
  const hj = hozzajarulas(request.headers.get('cookie'), { alap: savKi(env) });
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

  // FORRAS-CIMKE a foglalas pillanataban (GY-25, ELES - Feri 2026-10-19, mint az MP-n): a 7 napon belul UTOLSO FIZETETT kattintas (erintes-naplo, hirdetesi hozzajarulassal, a szerver altal irt
  // HttpOnly gy_lpt sutihez kotve) adja; az organikus / direkt visszateres nem ir felul, az ujabb fizetett igen; 8-30 nap csak `kesoi_fizetett` jelzes. Nincs fizetett -> organikus_direkt
  // (van azonosito-suti) / ismeretlen. Hozzajarulas nelkul / naplo nelkul a 24 oras munkamenet-rekord a tartalek (bizonyitek_forras = munkamenet). A REGI (munkamenet-alapu) cimke a `cimke_regi`-ben.
  const s = sutik(request.headers.get('cookie'));
  const ervenyesSuti = (v) => !!v && /^[A-Za-z0-9_-]{43}$/.test(v);
  const rekordok = [];
  for (const nev of [SUTI_MUNKAMENET, SUTI_LPT]) {
    if (ervenyesSuti(s[nev])) { const r = await munkamenetOlvas(db, await sha256Hex(s[nev]), most); if (r && r.belepes) rekordok.push(r); }
  }
  const valasztott = rekordok.find((r) => r.fizetett) || rekordok[0] || null;
  const t = await kampanyLista(db, most);
  const c = cimkez(valasztott ? valasztott.belepes : null, { lista: t.lista, friss: t.friss }); // REGI (cimke_regi)
  let forras = { cimke: 'ismeretlen', bizonyitek: 'nincs_adat', forras: null, platform: null, katt_tipus: null, katt_ertek: null, katt_ido: null, kampany: null, hirdetescsoport: null, hirdetes: null, kora_nap: null, kesoi_fizetett: null };
  let lpc = {};
  try {
    const lpt = ervenyesSuti(s[SUTI_LPT]) ? s[SUTI_LPT] : null;
    const mSuti = ervenyesSuti(s[SUTI_MUNKAMENET]) ? s[SUTI_MUNKAMENET] : null;
    const azonositoVan = !!(lpt || mSuti);
    const mRec = mSuti ? await munkamenetOlvas(db, await sha256Hex(mSuti), most) : null;
    const mb = mRec && mRec.belepes;
    const lptHash = lpt ? await sha256Hex(lpt) : null;
    let w = null;
    if (hj.marketing) {
      const lista = await erintesek(db, lptHash || '-', most - 30 * 86400);
      w = lpcHozzarendel({ erintesek: lista, most, lista: t.lista, azonositoVan });
      lpc = w;
    } else lpc = { cimke: 'ismeretlen', bizonyitek: 'nincs_hozzajarulas', verzio: LPC_VERZIO };
    if (w && w.ido) {
      forras = { munkamenet: lptHash.slice(0, 16), cimke: w.cimke, bizonyitek: w.bizonyitek, forras: 'suti', platform: w.platform, katt_tipus: w.katt_tipus, katt_ertek: w.katt_ertek, katt_ido: w.ido, kampany: w.kampany, hirdetescsoport: w.hirdetescsoport, hirdetes: w.hirdetes, kora_nap: w.kora_nap, kesoi_fizetett: w.kesoi_fizetett };
    } else if (mb && fizetett(mb)) { // tartalek: a 24 oras munkamenet fizetett erintese (hozzajarulas nelkul, vagy ha a naplo hianyzik)
      const ea = erintesAdatok(mb, { lista: t.lista, friss: t.friss });
      const az = hirdetesAzonositok(mb);
      forras = { munkamenet: (await sha256Hex(mSuti)).slice(0, 16), cimke: ea.cimke, bizonyitek: ea.bizonyitek, forras: 'munkamenet', platform: ea.platform, katt_tipus: ea.katt_tipus, katt_ertek: ea.katt_ertek, katt_ido: mRec.letrehozva, kampany: az.kampany, hirdetescsoport: az.hirdetescsoport, hirdetes: az.hirdetes, kora_nap: 0, kesoi_fizetett: w ? w.kesoi_fizetett : null };
    } else if (mb) { // nem fizetett munkamenet: organikus / direkt / ismeretlen a regi, finom bizonyitekkal
      const cm = cimkez(mb, { lista: t.lista, friss: t.friss });
      forras = { ...forras, cimke: nemFizetettCimke(cm.cimke), bizonyitek: cm.bizonyitek, forras: 'munkamenet', kesoi_fizetett: w ? w.kesoi_fizetett : null };
    } else if (w) {
      forras = { ...forras, cimke: w.cimke, bizonyitek: w.bizonyitek, forras: azonositoVan ? 'suti' : null, kesoi_fizetett: w.kesoi_fizetett };
    } else forras = { ...forras, cimke: 'ismeretlen', bizonyitek: azonositoVan ? 'nincs_adat' : 'nincs_azonosito' };
  } catch (err) { await lpcHiba(db, most, 'hozzarendeles'); lpc = {}; forras = { ...forras, cimke: nemFizetettCimke(c.cimke) === 'ismeretlen' ? lpcCimke(c.cimke) : nemFizetettCimke(c.cimke), bizonyitek: c.bizonyitek, forras: 'munkamenet' }; }
  const hirdetes = { kampany: forras.kampany || null, hirdetescsoport: forras.hirdetescsoport || null, hirdetes: forras.hirdetes || null }; // szam-azonositok, nem szemelyes adat
  // GY-23 / GY-25: a nyertes erintes nyers click-ID-ja a foglalashoz (szerveres platform-feltoltes), CSAK hirdetesi hozzajarulassal; 60 nap utan torlodik
  const katt = hj.marketing && forras.katt_ertek ? { lpc_platform: forras.platform, lpc_katt_tipus: forras.katt_tipus, lpc_katt_ertek: forras.katt_ertek, lpc_katt_ido: forras.katt_ido } : {};
  const gads = hj.marketing && forras.platform === 'google' && GOOGLE_KATT.includes(forras.katt_tipus) && forras.katt_ertek
    ? { gads_katt_tipus: forras.katt_tipus, gads_katt_ertek: forras.katt_ertek, gads_katt_ido: forras.katt_ido, gads_munkamenet: forras.munkamenet || null, gads_szabaly: 'gads1+' + LPC_VERZIO } : {};
  const parosito = e.employeeId ? await hmacHex(env.GY_HMAC_KULCS, `gy-parosito|${kert.startUnix}|${e.employeeId}`) : null;
  const parositoHely = await hmacHex(env.GY_HMAC_KULCS, `gy-hely|${kert.startUnix}|${kert.placeId}`); // a Salonic-igazolas parositasahoz (hely + idopont)

  const letrejott = await foglalasLetrehoz(db, { uuid, tipus, uj_vendeg: e.ujVendeg, cimke: forras.cimke, bizonyitek: forras.bizonyitek + (c.elavult && forras.platform === 'google' ? '+elavult_lista' : ''), bizonyitek_forras: forras.forras, cimke_regi: c.cimke, bizonyitek_regi: c.bizonyitek + (c.elavult ? '+elavult_lista' : ''), hozzajarulas: hj.allapot, allapot, teszt, parosito, parosito_hely: parositoHely, ...hirdetes,
    lpc_cimke: lpc.cimke, lpc_bizonyitek: lpc.bizonyitek, ...katt, lpc_kampany: lpc.kampany, lpc_hirdetescsoport: lpc.hirdetescsoport, lpc_hirdetes: lpc.hirdetes, lpc_kora_nap: forras.kora_nap, kesoi_fizetett: forras.kesoi_fizetett, lpc_verzio: lpc.verzio, ...gads, ertek }, most);
  if (!letrejott) return valasz(200, { ok: true, ismetles: true }); // versenyhelyzet: egy masik kerelem mar letrehozta
  // GY-24: `kesz` CSAK tenyleges, ELSO mentes utan (ismetelt kerelem / dupla kuldes fent mar visszater, nem szamol ketszer); teszt foglalas kulon kornyezet-ertek
  await motorStatNo(db, { most, kornyezet: teszt ? 'teszt' : statKornyezet(request), esemeny: 'kesz', lepes: 'adatlap', eszkoz: statEszkoz(be.m) });
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
async function kulcsOk(request, env, fejlec, hashVar, { csakMasodik = false } = {}) {
  const k = request.headers.get(fejlec);
  // csakMasodik: ha a `_2` hash be van allitva, a REGI hash-t nem olvassuk (veglegesitett kulcscsere); vesz-visszaallitas: GY_ZAP_REGI_KULCS = "1" a regi hash-t is ervenyesiti
  const regiIs = !csakMasodik || !env[hashVar + '_2'] || String(env.GY_ZAP_REGI_KULCS ?? '0') === '1';
  const hashek = [regiIs ? env[hashVar] : null, env[hashVar + '_2']].filter(Boolean); // kulcsrotacio: a `_2` valtozo a masodik, egyszerre ervenyes hash (csere utan a regit toroljuk)
  if (!k || !hashek.length) return false;
  const h = await sha256Hex(k);
  let ok = false;
  for (const x of hashek) ok = egyenlo(h, String(x)) || ok; // nincs rovidzar: mindegyik osszehasonlitas lefut
  return ok;
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
  if (!(await kulcsOk(request, env, 'x-gy-zap-kulcs', 'GY_ZAP_KULCS_HASH', { csakMasodik: true }))) return valasz(401, { ok: false });
  const db = env.GY_DB;
  if (!db) return valasz(503, { ok: false, hiba: 'nincs_adatbazis' });
  if (!env.GY_HMAC_KULCS) return valasz(503, { ok: false, hiba: 'nincs_titkos_kulcs' });
  const be = await jsonTest(request, 2048);
  if (!be || !['igazolas', 'lemondas'].includes(be.esemeny)) return nincsKerelem('ervenytelen_kerelem');
  const vanId = UUID_RE.test(String(be.salonic_id || '').toLowerCase());
  const lemStart = egesz(be.start_unix, 1e9, 4e9), lemHely = egesz(be.place_id, 1, 999999);
  // lemondas-level bookingId nelkul: csak hely + idopont alapjan, szigoru bizonyitekkal (lemondasBookingIdNelkul)
  if (!vanId && !(be.esemeny === 'lemondas' && lemStart !== null && HELYSZINEK[lemHely])) return nincsKerelem('ervenytelen_kerelem');
  await sema(db);
  const most = mostUnix(deps);
  if (!vanId) return lemondasBookingIdNelkul({ db, env, deps, most, start: lemStart, hely: lemHely });
  const salonicId = String(be.salonic_id).toLowerCase();
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
  if (elo.allapot !== 'aktiv' || (elo.startUnix && elo.startUnix !== start)) { await riaszt(db, 'igazolas_nem_aktiv', { adat: elo.miert || elo.allapot, most }); return valasz(409, { ok: false, hiba: 'nem_aktiv_vagy_idopont_nem_egyezik', okkod: elo.allapot !== 'aktiv' ? 'salonic_nem_aktiv' : 'idopont_elteres' }); }
  let jeloltek = await igazolasJeloltek(db, await hmacHex(env.GY_HMAC_KULCS, `gy-hely|${start}|${hely}`));
  // tobb jelolt (ugyanaz a hely + idopont, kulonbozo munkatars): a Zap opcionalis `munkatars_nev` mezoje CSAK szukit (nincs fuzzy egyezes). Pontosan egy employeeId a helyszinen, utana pontosan egy HMAC-egyezo jelolt kell.
  let tobbOkkod = 'tobb_azonos_idopont_es_hely';
  // elsodleges: ha az ELO bookingDetails oldal egyertelmuen hordozza a munkatars azonositojat, azzal szukitunk (megbizhatobb a nevnel)
  if (jeloltek.length > 1 && elo.employeeId) {
    const par = await hmacHex(env.GY_HMAC_KULCS, `gy-parosito|${start}|${elo.employeeId}`);
    const talalt = jeloltek.filter((j) => j.parosito && j.parosito === par);
    if (talalt.length === 1) jeloltek = talalt; else tobbOkkod = talalt.length === 0 ? 'oldal_munkatars_nincs_jelolt' : 'oldal_munkatars_tobb_jelolt';
  }
  const oldalDiag = elo.employeeId ? 'oldal_emp=1' : `oldal_emp=${elo.oldalEmp || 0}`; // diagnosztika (riasztas): hany munkatars-azonosito latszik az elo oldalon
  if (jeloltek.length > 1 && typeof be.munkatars_nev === 'string' && be.munkatars_nev.trim()) {
    const szuk = await munkatarsSzukites({ env, deps, jeloltek, nev: be.munkatars_nev, start, hely });
    if (szuk.jeloltek) jeloltek = szuk.jeloltek; else tobbOkkod = szuk.okkod;
  }
  if (jeloltek.length === 0) {
    // VEGLEGES, uzletileg elfogadott kimenet (nem motoros foglalas VAGY illesztesi hiba): 2xx + nincs_par, a Zap NE probalja ujra. Az okkod szetvalasztja a ketto: ha MASIK helyszinen van
    // jelolt ugyanarra az idopontra -> hely_elteres (illesztesi hiba gyanu), kulonben nincs_motoros_jelolt (valoszinuleg a Salonicban kozvetlenul letrejott foglalas).
    let okkod = 'nincs_motoros_jelolt';
    for (const masik of Object.keys(HELYSZINEK).map(Number).filter((h) => h !== hely)) {
      if ((await igazolasJeloltek(db, await hmacHex(env.GY_HMAC_KULCS, `gy-hely|${start}|${masik}`))).length) { okkod = 'hely_elteres'; break; }
    }
    await riaszt(db, 'igazolas_nincs_par', { adat: okkod, most });
    return valasz(200, { ok: true, nincs_par: true, okkod });
  }
  if (jeloltek.length > 1) { await riaszt(db, 'igazolas_tobb_par', { adat: `db=${jeloltek.length};${tobbOkkod};${oldalDiag}`.slice(0, 190), most }); return valasz(409, { ok: false, hiba: 'tobb_par', okkod: tobbOkkod }); }
  await foglalasAllapot(db, jeloltek[0].uuid, 'aktiv', most, { salonic_id: salonicId, igazolt: true });
  return valasz(200, { ok: true, allapot: 'aktiv', igazolt: true });
}

/** A munkatars neve alapjan szukiti a jelolteket. @returns {{jeloltek: Array}|{okkod: string}} - pontosan egy egyezo jeloltnel jeloltek, kulonben okkod (a hivo 409-et ad). */
async function munkatarsSzukites({ env, deps, jeloltek, nev, start, hely }) {
  try {
    const staff = await szerverAdapter(env, deps.fetch || globalThis.fetch).getStaff();
    const egyezo = Object.values(staff).filter((e) => e.nev && nevNorm(e.nev) === nevNorm(nev) && Array.isArray(e.helyszinek) && e.helyszinek.includes(hely));
    if (egyezo.length === 0) return { okkod: 'munkatars_nev_nincs_egyezes' };
    if (egyezo.length > 1) return { okkod: 'munkatars_nev_tobbertelmu' };
    const par = await hmacHex(env.GY_HMAC_KULCS, `gy-parosito|${start}|${egyezo[0].id}`);
    const talalt = jeloltek.filter((j) => j.parosito && j.parosito === par);
    return talalt.length === 1 ? { jeloltek: talalt } : { okkod: talalt.length === 0 ? 'munkatars_nincs_jelolt' : 'munkatars_tobb_jelolt' };
  } catch (e) { return { okkod: 'munkatars_lista_nem_elerheto' }; }
}

/**
 * Lemondas-level bookingId NELKUL (a Zap nem talal azonositot): hely + idopont alapjan igazolt, aktiv foglalasok; mindegyik ELO bookingDetails oldala ellenorizve.
 * Csak akkor lemondott, ha a jeloltek TELJES halmaza sikeresen ellenorizheto es PONTOSAN EGY bizonyitottan torolt (deleteSuccess ugyanarra az UUID-ra). Kulonben nem valtoztat.
 */
async function lemondasBookingIdNelkul({ db, env, deps, most, start, hely }) {
  const sorok = (await db.prepare("SELECT uuid, salonic_id FROM gy_foglalas WHERE parosito_hely = ?1 AND salonic_id IS NOT NULL AND allapot = 'aktiv' AND teszt = 0 LIMIT 6").bind(await hmacHex(env.GY_HMAC_KULCS, `gy-hely|${start}|${hely}`)).all()).results || [];
  const nemValt = async (okkod) => { await riaszt(db, 'lemondas_bizonytalan', { adat: okkod, most }); return valasz(200, { ok: true, valtozas: false, okkod }); };
  if (sorok.length === 0) return nemValt('nincs_aktiv_jelolt');
  if (sorok.length > 5) return nemValt('tul_sok_jelolt');
  const allapotok = [];
  for (const sor of sorok) allapotok.push(await eloAllapot(sor.salonic_id, { fetchFn: deps.fetch || globalThis.fetch }));
  if (allapotok.some((a) => a.allapot === 'ismeretlen')) return nemValt('ellenorzes_hiba');
  const torolt = sorok.filter((_, i) => allapotok[i].allapot === 'torolve' && allapotok[i].forras === 'atiranyitas');
  if (torolt.length !== 1) return nemValt(torolt.length === 0 ? 'nincs_torolt_jelolt' : 'tobb_torolt_jelolt');
  const r = await db.prepare("UPDATE gy_foglalas SET allapot = 'lemondott', frissitve = ?2 WHERE uuid = ?1 AND allapot = 'aktiv'").bind(torolt[0].uuid, most).run(); // feltetelesen: idempotens
  return valasz(200, { ok: true, valtozas: !!(r.meta && r.meta.changes), allapot: 'lemondott' });
}

/** GET /api/gy-admin?riport=YYYY-MM | ?riasztasok=1 | ?foglalas=<uuid>   (x-gy-kulcs). A riport CSAK aggregalt szamokat ad, vendegadat nincs. */
export async function adminVegpont({ request, env, deps = {} }) {
  if (!(await kulcsOk(request, env, 'x-gy-kulcs', 'GY_ADMIN_KULCS_HASH'))) return valasz(401, { ok: false });
  const db = env.GY_DB;
  if (!db) return valasz(503, { ok: false, hiba: 'nincs_adatbazis' });
  await sema(db);
  const u = new URL(request.url);
  const most = mostUnix(deps);
  if (u.searchParams.get('visszahivasok')) {
    const r = (await db.prepare('SELECT id, letrehozva, nev, email, tel, rendelo, surgosseg, hivhato, oldal, ertesitve, allapot FROM gy_visszahivas ORDER BY id DESC LIMIT 200').all()).results || [];
    return valasz(200, { ok: true, visszahivasok: r });
  }
  if (u.searchParams.get('suti_teszt')) {
    let t = [];
    try { t = (await db.prepare('SELECT nap, verzio, oldal, eszkoz, esemeny, db FROM gy_suti_teszt ORDER BY nap DESC, verzio').all()).results || []; } catch (e) { /* meg nincs adat */ }
    const ossz = {};
    for (const x of t) { const k = `${x.verzio}|${x.oldal}|${x.eszkoz}`; const o = ossz[k] || (ossz[k] = { verzio: x.verzio, oldal: x.oldal, eszkoz: x.eszkoz, megjelent: 0, elfogad: 0, elutasit: 0, reszleges: 0, beall: 0, dontes_nelkul: 0 }); if (x.esemeny in o) o[x.esemeny] += x.db; }
    // elfogadasi arany = elfogad / (elfogad + elutasit + reszleges + dontes_nelkul)
    const sorok = Object.values(ossz).map((o) => { const nev = o.elfogad + o.elutasit + o.reszleges + o.dontes_nelkul; return { ...o, elfogadasi_arany: nev ? Math.round((1000 * o.elfogad) / nev) / 10 : null }; });
    return valasz(200, { ok: true, definicio: 'elfogadasi_arany (%) = elfogad / (elfogad + elutasit + reszleges + dontes_nelkul)', osszesitett: sorok, napi: t });
  }
  if (u.searchParams.get('riasztasok')) {
    const r = (await db.prepare('SELECT id, ido, tipus, uuid, adat FROM gy_riasztas ORDER BY id DESC LIMIT 200').all()).results || [];
    return valasz(200, { ok: true, riasztasok: r });
  }
  const f = u.searchParams.get('foglalas');
  if (f && BOOKING_ID.test(f)) {
    const r = await foglalasOlvas(db, f);
    return valasz(200, { ok: true, foglalas: r ? { ...r, parosito: undefined } : null });
  }
  if (u.searchParams.get('gads')) { // GY-23: a szerveres Google Ads import listaja (kulcsos). CSAK Salonic-igazolt, nem teszt, Google click-ID-s allapotfelmeresek; nev / e-mail / telefon / kezeles NINCS benne.
    const tolNap = /^\d{4}-\d{2}-\d{2}$/.test(u.searchParams.get('tol') || '') ? Date.parse(u.searchParams.get('tol') + 'T00:00:00Z') / 1000 : most - 70 * 86400;
    const sorok = (await db.prepare(
      `SELECT uuid, letrehozva, frissitve, allapot, hozzajarulas, gads_katt_tipus, gads_katt_ertek, gads_katt_ido, gads_munkamenet, gads_szabaly, ertek, cimke FROM gy_foglalas
       WHERE tipus = 'allapotfelmeres' AND teszt = 0 AND igazolt = 1 AND gads_katt_ertek IS NOT NULL AND letrehozva >= ?1 AND allapot IN ('aktiv','modositott','lemondott') ORDER BY letrehozva LIMIT 1000`,
    ).bind(tolNap).all()).results || [];
    const kimenet = [];
    for (const r of sorok) {
      kimenet.push({
        click_id: r.gads_katt_ertek, click_tipus: r.gads_katt_tipus, click_ido: budapestIdo(r.gads_katt_ido), click_ido_unix: r.gads_katt_ido,
        konverzio_ido: budapestIdo(r.letrehozva), konverzio_ido_unix: r.letrehozva, order_id: await tranzakcioId(r.uuid, env.GY_HMAC_KULCS),
        ertek: r.ertek, penznem: 'HUF', allapot: r.allapot === 'lemondott' ? 'lemondott' : 'aktiv', lemondva_ido: r.allapot === 'lemondott' ? budapestIdo(r.frissitve) : null,
        forras: { cimke: r.cimke, munkamenet: r.gads_munkamenet, szabaly: r.gads_szabaly, hozzajarulas: r.hozzajarulas },
      });
    }
    return valasz(200, { ok: true, db: kimenet.length, aktiv: kimenet.filter((x) => x.allapot === 'aktiv'), lemondott: kimenet.filter((x) => x.allapot === 'lemondott') });
  }
  const tho = u.searchParams.get('tolcser');
  if (tho && /^\d{4}-\d{2}$/.test(tho)) { // GY-24: lepesenkenti tolcser (csak napi aggregalt szamok)
    const kornyezet = ['eles', 'elonezet', 'teszt'].includes(u.searchParams.get('kornyezet')) ? u.searchParams.get('kornyezet') : 'eles';
    const sorok = (await db.prepare(
      `SELECT nap, esemeny, lepes, kategoria, eszkoz, db FROM gy_motor_stat WHERE kornyezet = ?1 AND nap >= ?2 AND nap < ?3 ORDER BY nap, esemeny, lepes, kategoria, eszkoz`,
    ).bind(kornyezet, tho + '-01', (() => { const [y, m] = tho.split('-').map(Number); return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`; })()).all()).results || [];
    const osszegez = (szuro) => sorok.filter(szuro).reduce((a, x) => a + x.db, 0);
    const lepesSorrend = ['szolg', 'valt', 'hely', 'szakember', 'ido', 'adatlap', 'hivas'];
    const eszkozok = ['mobil', 'asztali', 'ismeretlen'];
    const lepesek = lepesSorrend.map((l) => ({
      lepes: l, megjelent: osszegez((x) => x.esemeny === 'lepes' && x.lepes === l), elakad: osszegez((x) => x.esemeny === 'elakad' && x.lepes === l),
      bezar_gomb: osszegez((x) => x.esemeny === 'bezar_gomb' && x.lepes === l), elhagy_jelzes_becsles: osszegez((x) => x.esemeny === 'elhagy_jelzes' && x.lepes === l),
      eszkozonkent: Object.fromEntries(eszkozok.map((e) => [e, { megjelent: osszegez((x) => x.esemeny === 'lepes' && x.lepes === l && x.eszkoz === e), elakad: osszegez((x) => x.esemeny === 'elakad' && x.lepes === l && x.eszkoz === e), bezar_gomb: osszegez((x) => x.esemeny === 'bezar_gomb' && x.lepes === l && x.eszkoz === e), elhagy_jelzes_becsles: osszegez((x) => x.esemeny === 'elhagy_jelzes' && x.lepes === l && x.eszkoz === e) }])),
    }));
    const nyit = osszegez((x) => x.esemeny === 'nyit');
    const kesz = osszegez((x) => x.esemeny === 'kesz' && x.lepes === 'adatlap'), keszHivas = osszegez((x) => x.esemeny === 'kesz' && x.lepes === 'hivas');
    const arany = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : null);
    return valasz(200, {
      ok: true, honap: tho, kornyezet, nyit, kesz_foglalas: kesz, kesz_visszahivas: keszHivas, lepesek,
      elakadasok: sorok.filter((x) => x.esemeny === 'elakad').reduce((a, x) => { const k = `${x.lepes}|${x.kategoria}`; a[k] = (a[k] || 0) + x.db; return a; }, {}),
      kozelito_arany: { kesz_foglalas_per_nyit_szazalek: arany(kesz, nyit), kesz_visszahivas_per_nyit_szazalek: arany(keszHivas, nyit), lepes_per_nyit_szazalek: Object.fromEntries(lepesek.map((l) => [l.lepes, arany(l.megjelent, nyit)])) },
      megjegyzes: 'KOZELITO: azonosito nelkuli esemenytolcser, nem pacienskovetes. Visszalepes / ujratoltes / tobbszori megnyitas torzithat; a lepes-megjelenes megnyitasonkent legfeljebb egyszer szamol. Az elhagy_jelzes (pagehide / visibilitychange) csak BECSLES, nem azonos az elhagyassal.',
      napi: sorok,
    });
  }
  const lho = u.searchParams.get('lpc');
  if (lho && /^\d{4}-\d{2}$/.test(lho)) { // GY-22 ellenorzes: csak aggregalt szamok
    const [ev, m] = lho.split('-').map(Number);
    const tol = Date.UTC(ev, m - 1, 1) / 1000, ig = Date.UTC(ev, m, 1) / 1000;
    const sorok = (await db.prepare(
      `SELECT tipus, uj_vendeg, COALESCE(cimke_regi, cimke) AS cimke, lpc_cimke, kesoi_fizetett IS NOT NULL AS kesoi, hozzajarulas, COUNT(*) AS db FROM gy_foglalas
       WHERE letrehozva >= ?1 AND letrehozva < ?2 AND teszt = 0 AND allapot NOT IN ('lemondott','bizonytalan') GROUP BY tipus, uj_vendeg, COALESCE(cimke_regi, cimke), lpc_cimke, kesoi, hozzajarulas`,
    ).bind(tol, ig).all()).results || [];
    const nevezo = sorok.filter((x) => x.tipus === 'allapotfelmeres' && x.uj_vendeg === 'uj');
    const osszeg = (l) => l.reduce((a, x) => a + x.db, 0);
    const lpcAz = ['google_markas', 'google_nem_markas', 'meta', 'tiktok', 'organikus_direkt'];
    const regiAz = ['google_brand', 'google_nem_brand', 'organikus', 'direkt'];
    const hib = await db.prepare("SELECT ertek FROM gy_meta WHERE kulcs = 'lpc_hiba'").first();
    // fizetett erkezes kampany-ID NELKUL: csak a parameterek NEVEI (ertek nelkul) es a referrer-kategoria szerint, aggregalva (a munkamenet-rekordok lejaratig elnek)
    const kampanyNelkuli = (await db.prepare(
      `SELECT json_extract(belepes,'$.param_nevek') AS param_nevek, json_extract(belepes,'$.ref_kat') AS ref, COUNT(*) AS db FROM gy_munkamenet WHERE fajta = 'l' AND fizetett = 1 AND json_extract(belepes,'$.utm_campaign') IS NULL GROUP BY param_nevek, ref ORDER BY db DESC LIMIT 20`,
    ).all()).results || [];
    const erintesDb = await db.prepare('SELECT COUNT(*) AS n FROM gy_erintes').first();
    return valasz(200, { ok: true, honap: lho, szabaly_verzio: LPC_VERZIO, nevezo: osszeg(nevezo), lpc_azonositott: osszeg(nevezo.filter((x) => lpcAz.includes(x.lpc_cimke))), munkamenet_azonositott: osszeg(nevezo.filter((x) => regiAz.includes(x.cimke))),
      mindketto_azonositott: osszeg(nevezo.filter((x) => lpcAz.includes(x.lpc_cimke) && regiAz.includes(x.cimke))), csak_lpc_adott: osszeg(nevezo.filter((x) => lpcAz.includes(x.lpc_cimke) && !regiAz.includes(x.cimke))),
      kesoi_fizetett: osszeg(nevezo.filter((x) => x.kesoi)), lpc_hiba_szamlalo: hib ? Number(hib.ertek) : 0, erintesi_naplo_sorok: erintesDb ? erintesDb.n : 0, kampany_nelkuli_fizetett: kampanyNelkuli, keresztezes: nevezo.map((x) => ({ cimke: x.cimke, lpc_cimke: x.lpc_cimke, db: x.db })) });
  }
  const ho = u.searchParams.get('riport');
  if (ho && /^\d{4}-\d{2}$/.test(ho)) {
    const [ev, m] = ho.split('-').map(Number);
    const tol = Date.UTC(ev, m - 1, 1) / 1000, ig = Date.UTC(ev, m, 1) / 1000;
    const sorok = (await db.prepare(
      `SELECT tipus, uj_vendeg, cimke, hozzajarulas, allapot, igazolt, COUNT(*) AS db FROM gy_foglalas WHERE letrehozva >= ?1 AND letrehozva < ?2 AND teszt = 0 GROUP BY tipus, uj_vendeg, cimke, hozzajarulas, allapot, igazolt`,
    ).bind(tol, ig).all()).results || [];
    // 90%-os cel (GY-15 3. pont): nevezo = nem lemondott, UJ vendeges allapotfelmeres; erdemben azonositott: google_markas | google_nem_markas | meta | tiktok | organikus_direkt (+ a GY-25 elotti regi cimkek)
    const nevezo = sorok.filter((s) => s.tipus === 'allapotfelmeres' && s.uj_vendeg === 'uj' && s.allapot !== 'lemondott' && s.allapot !== 'bizonytalan');
    const osszeg = (l) => l.reduce((a, s) => a + s.db, 0);
    const azonositott = nevezo.filter((s) => ['google_markas', 'google_nem_markas', 'meta', 'tiktok', 'organikus_direkt', 'google_brand', 'google_nem_brand', 'organikus', 'direkt'].includes(s.cimke));
    const bontas = (hj) => { const l = nevezo.filter((s) => (hj ? s.hozzajarulas === 'igen' : s.hozzajarulas !== 'igen')); const a = l.filter((s) => azonositott.includes(s)); return { nevezo: osszeg(l), azonositott: osszeg(a), hiany_google_bizonytalan: osszeg(l.filter((s) => s.cimke === 'google_bizonytalan')), hiany_ismeretlen: osszeg(l.filter((s) => s.cimke === 'ismeretlen')) }; };
    const kampanyBontas = (await db.prepare(
      `SELECT kampany, hirdetescsoport, cimke, COUNT(*) AS db FROM gy_foglalas WHERE letrehozva >= ?1 AND letrehozva < ?2 AND teszt = 0 AND kampany IS NOT NULL GROUP BY kampany, hirdetescsoport, cimke ORDER BY db DESC LIMIT 200`,
    ).bind(tol, ig).all()).results || [];
    return valasz(200, { ok: true, honap: ho, osszes: osszeg(sorok), nevezo: osszeg(nevezo), azonositott: osszeg(azonositott), hozzajarulo: bontas(true), nem_hozzajarulo: bontas(false), sorok, kampany_bontas: kampanyBontas });
  }
  void most;
  return nincsKerelem('ismeretlen_muvelet');
}

// --- /api/gy-motor-stat (GY-24: lepesenkenti tolcsermeres) -------------------------------------------------------------------------------------
// NEVTELEN napi szamlalo: esemeny + lepes + (elakadasnal) FIX kategoria + eszkoz. Suti / azonosito / IP / user-agent / URL / mezoertek / szabad szoveg NINCS. A `kesz` esemenyt CSAK a szerver
// irja (a foglalas / visszahivas mentese utan), a kliens nem hamisithatja. A statisztika hibaja soha nem akadalyozza a foglalast.
export const STAT_ESEMENYEK = Object.freeze(['nyit', 'lepes', 'elakad', 'bezar_gomb', 'elhagy_jelzes']);
export const STAT_LEPESEK = Object.freeze(['szolg', 'valt', 'hely', 'szakember', 'ido', 'adatlap', 'hivas']);
export const STAT_KATEGORIAK = Object.freeze(['kotelezo_hianyzik', 'formatum', 'nincs_szabad_ido', 'szerverhiba']);
/** A kornyezet az Origin (tartalekul a Referer) alapjan: eles | elonezet | teszt (a proxy a pages.dev hostot mutatja, ezert nem a request.url). */
export function statKornyezet(request) {
  const eredet = request.headers.get('origin') || request.headers.get('referer') || '';
  if (/^https:\/\/(www\.)?gyogytornaszom\.hu(\/|$)/.test(eredet)) return 'eles';
  if (/^https:\/\/([a-z0-9-]+\.)?gyogytorna\.pages\.dev(\/|$)/.test(eredet)) return 'elonezet';
  return 'teszt';
}
const statEszkoz = (m) => (m === 1 || m === '1' ? 'mobil' : m === 0 || m === '0' ? 'asztali' : 'ismeretlen');

export async function motorStatVegpont({ request, env, deps = {} }) {
  if (request.method !== 'POST') return new Response(null, { status: 405 });
  let b = {};
  try { b = JSON.parse((await request.text()).slice(0, 200)) || {}; } catch (e) { return new Response(null, { status: 400 }); }
  if (!STAT_ESEMENYEK.includes(b.e)) return new Response(null, { status: 400 });
  const lepes = STAT_LEPESEK.includes(b.l) ? b.l : (b.l ? 'egyeb' : '');
  const kategoria = b.e === 'elakad' ? (STAT_KATEGORIAK.includes(b.k) ? b.k : 'egyeb') : '';
  try {
    if (env.GY_DB) { await sema(env.GY_DB); await motorStatNo(env.GY_DB, { most: mostUnix(deps), kornyezet: statKornyezet(request), esemeny: b.e, lepes, kategoria, eszkoz: statEszkoz(b.m) }); }
  } catch (e) { /* a statisztika hibaja nem hiba a latogatonak */ }
  return new Response(null, { status: 204 });
}

// --- /api/gy-visszahivas ------------------------------------------------------------------------------------------------------
// Az ELO "Telefonos Idopont" urlap (gyogytornaszom.hu/online-gyogytorna/, 123FormBuilder) mezoi, szo szerint: a valasztolistak ertekei az elo urlap szovegei.
export const SURGOSSEG = Object.freeze(['A lehető leggyorsabban!', '1-2 héten belül!', '1 hónapon belül.']);
export const HIVHATO = Object.freeze(['Bármikor', 'Inkább reggel / de', 'Délután']);
export const RENDELOK = Object.freeze(['Oktogon', 'Nyugati', 'Batthyány']);
const HONNAN = /^\/[A-Za-z0-9\-_/.%]{0,120}$/;
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;
const tisztit = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
/**
 * A vendeg KIFEJEZETT kerese: "hivjatok vissza, elobb beszelnek egy gyogytornasszal". A panasz rovid leirasa (egeszsegugyi adat) a D1-be SOHA nem kerul, naplozasra sem;
 * csak az ertesito webhookon (e-mail a klinikanak) halad at. Ha az ertesites nem megy, a kerelem a panasz nelkul megmarad, es riasztas keszul (a klinika visszahivaskor megkerdezi).
 */
export async function visszahivasVegpont({ request, env, deps = {} }) {
  if (request.method !== 'POST') return valasz(405, { ok: false });
  if (!eredetEngedett(request, env)) return valasz(403, { ok: false, hiba: 'eredet' });
  const db = env.GY_DB;
  if (!db) return valasz(503, { ok: false, hiba: 'nincs_adatbazis' });
  const be = await jsonTest(request, 4096);
  if (!be) return nincsKerelem('ervenytelen_torzs');
  if (be.bot) return valasz(200, { ok: true }); // csapda-mezo: a robot "sikert" kap, nem mentunk semmit
  const nev = tisztit(be.nev, 80);
  const email = tisztit(be.email, 120);
  const tel = tisztit(be.tel, 30).replace(/[^+0-9 ()\-/]/g, '');
  if (nev.length < 2 || !/\p{L}/u.test(nev)) return nincsKerelem('nev');
  if (!EMAIL.test(email)) return nincsKerelem('email');
  if ((tel.match(/\d/g) || []).length < 6 || (tel.match(/\d/g) || []).length > 15) return nincsKerelem('telefon');
  if (!SURGOSSEG.includes(be.surgosseg)) return nincsKerelem('surgosseg');
  if (!HIVHATO.includes(be.hivhato)) return nincsKerelem('hivhato');
  if (!RENDELOK.includes(be.rendelo)) return nincsKerelem('rendelo');
  if (be.elfogad_info !== true || be.elfogad_adatv !== true) return nincsKerelem('elfogadas');
  const panasz = tisztit(be.panasz, 1000); // NEM tarolodik
  const oldal = typeof be.oldal === 'string' && HONNAN.test(be.oldal) ? be.oldal : null;
  await sema(db);
  const most = mostUnix(deps);
  // visszaeles ellen (IP-t nem tarolunk): oraban legfeljebb 30 kerelem osszesen; ugyanaz a telefonszam 10 percen belul egyszer szamit
  const ora = (await db.prepare('SELECT COUNT(*) AS n FROM gy_visszahivas WHERE letrehozva > ?').bind(most - 3600).first()) || { n: 0 };
  if (ora.n >= 30) { await riaszt(db, 'visszahivas_limit', { most }); return valasz(429, { ok: false, hiba: 'sok_kerelem' }); }
  const mar = await db.prepare('SELECT id FROM gy_visszahivas WHERE tel = ? AND letrehozva > ?').bind(tel, most - 600).first();
  if (mar) return valasz(200, { ok: true });
  const r = await db.prepare('INSERT INTO gy_visszahivas (letrehozva, nev, email, tel, rendelo, surgosseg, hivhato, oldal) VALUES (?,?,?,?,?,?,?,?)').bind(most, nev, email, tel, be.rendelo, be.surgosseg, be.hivhato, oldal).run();
  await motorStatNo(db, { most, kornyezet: statKornyezet(request), esemeny: 'kesz', lepes: 'hivas', eszkoz: statEszkoz(be.m) }); // GY-24
  const id = r && r.meta ? r.meta.last_row_id : null;
  if (Math.random() < 0.05) takarit(db, most).catch(() => {}); // 60 napos torles
  // ertesites: a klinikanak szolo webhook (pl. Zapier -> e-mail). A vendeg valasza ettol fuggetlen.
  let ertesitve = 0;
  const hook = String(env.GY_VISSZAHIVAS_WEBHOOK || '');
  if (/^https:\/\//.test(hook)) {
    try {
      const f = deps.fetch || fetch;
      const v = await f(hook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        nev, email, tel, mikor_szeretne_idopontot: be.surgosseg, mikor_hivhatjuk: be.hivhato, melyik_rendelo: be.rendelo, panasz_roviden: panasz || '-', oldal,
        ido: new Date((most + 2 * 3600) * 1000).toISOString().replace('T', ' ').slice(0, 16),
      }) });
      ertesitve = v.ok ? 1 : 0;
    } catch (e) { /* alabb riasztas */ }
  }
  if (ertesitve && id) await db.prepare('UPDATE gy_visszahivas SET ertesitve = 1 WHERE id = ?').bind(id).run();
  else await riaszt(db, 'visszahivas_nincs_ertesites', { adat: { id }, most });
  return valasz(200, { ok: true });
}

// --- /api/gy-suti-config ------------------------------------------------------------------------------------------------------
// A sav-teszt (A/B) konfigja: melyik oldal(ak)on latszik a sav, milyen valtozatokkal. A D1 gy_meta 'suti_teszt' kulcsa; alapertek: lent. Deploy nelkul csereli a kulcsos POST.
export const SUTI_TESZT_ALAP = Object.freeze({
  aktiv: true,
  oldalak: ['/az-izuleti-fajdalom-okai-tunetei-es-gyogytornaja'],
  valtozatok: [
    { id: 'v1', suly: 50, cim: 'Segítesz nekünk egy kattintással?', szoveg: 'A sütikkel azt mérjük, melyik hirdetésünkből érkeznek a foglalások, így kevesebb felesleges hirdetést mutatunk.', kesleltetes: 0, gorgetes: 0, pozicio: 'also', gombsorrend: 'elfogad_elol', halvany: true },
    { id: 'v2', suly: 50, cim: 'Segítesz nekünk?', szoveg: 'A sütikkel mérjük, melyik hirdetésünk hoz pácienst – így kevesebb felesleges hirdetést látsz.', kesleltetes: 3, gorgetes: 30, pozicio: 'also', gombsorrend: 'elfogad_elol', halvany: true },
  ],
});
const UT_MINTA = /^\/[A-Za-z0-9\-_/.%]{0,150}$/;
/** A konfig ellenorzese: ismeretlen mezo eldobva, hatarok kozott; hiba eseten null. Megtevesztes ellen: az Elutasitom mindig latszik (a gombsorrend / halvany csak a megjelenes, a gomb nem rejtheto). */
export function sutiTesztEllenorzes(c) {
  if (!c || typeof c !== 'object' || !Array.isArray(c.oldalak) || !Array.isArray(c.valtozatok)) return null;
  if (c.oldalak.length > 10 || !c.oldalak.every((o) => typeof o === 'string' && UT_MINTA.test(o))) return null;
  if (c.valtozatok.length < 1 || c.valtozatok.length > 4) return null;
  const ids = new Set();
  const vs = [];
  for (const v of c.valtozatok) {
    if (!v || typeof v.id !== 'string' || !/^v[0-9]{1,2}$/.test(v.id) || ids.has(v.id)) return null;
    ids.add(v.id);
    const sz = (x, max) => (typeof x === 'string' && x.trim().length >= 1 && x.length <= max ? x.trim() : null);
    const cim = sz(v.cim, 80), szoveg = sz(v.szoveg, 240);
    if (!cim || !szoveg) return null;
    const n = (x, lo, hi, alap) => (x === undefined ? alap : Number.isFinite(+x) && +x >= lo && +x <= hi ? +x : NaN);
    const suly = n(v.suly, 0, 100, 50), kes = n(v.kesleltetes, 0, 60, 0), gor = n(v.gorgetes, 0, 100, 0);
    if ([suly, kes, gor].some(Number.isNaN)) return null;
    vs.push({ id: v.id, suly, cim, szoveg, kesleltetes: kes, gorgetes: gor, pozicio: v.pozicio === 'felso' ? 'felso' : 'also', gombsorrend: v.gombsorrend === 'elutasit_elol' ? 'elutasit_elol' : 'elfogad_elol', halvany: v.halvany !== false });
  }
  return { aktiv: c.aktiv !== false, oldalak: c.oldalak, valtozatok: vs };
}
export async function sutiConfigVegpont({ request, env }) {
  const db = env.GY_DB;
  if (request.method === 'GET') {
    let cfg = SUTI_TESZT_ALAP;
    if (db) { try { await sema(db); const r = await db.prepare("SELECT ertek FROM gy_meta WHERE kulcs = 'suti_teszt'").first(); const j = r && JSON.parse(r.ertek); const ok = j && sutiTesztEllenorzes(j); if (ok) cfg = ok; } catch (e) { /* alapertek */ } }
    return new Response(JSON.stringify(cfg), { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=60', 'x-content-type-options': 'nosniff', 'access-control-allow-origin': '*' } });
  }
  if (request.method === 'POST') {
    if (!(await kulcsOk(request, env, 'x-gy-kulcs', 'GY_ADMIN_KULCS_HASH'))) return valasz(401, { ok: false });
    if (!db) return valasz(503, { ok: false, hiba: 'nincs_adatbazis' });
    const be = await jsonTest(request, 16384);
    const cfg = sutiTesztEllenorzes(be);
    if (!cfg) return nincsKerelem('ervenytelen_konfig');
    await sema(db);
    await db.prepare("INSERT INTO gy_meta (kulcs, ertek) VALUES ('suti_teszt', ?1) ON CONFLICT(kulcs) DO UPDATE SET ertek = ?1").bind(JSON.stringify(cfg)).run();
    return valasz(200, { ok: true, konfig: cfg });
  }
  return valasz(405, { ok: false });
}

export { eloAllapot };
