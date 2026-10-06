// QA-2 vegpontok: /api/meres-erkezes (a bongeszo irja: kattintasazonositok, UTM, sutik, hozzajarulas) es /api/meres-admin (kulcsos: naplo, vészkapcsolo, kulso szallito visszaigazolasa)
import { azonosEredet, foglalasAllapot, HOSTOK, kulcsEllenorzes, sema as kulcsSema, UUID_MINTA, valasz } from '../foglalas-kulcs.js';
import { erkezesMent, fuggoKuldesek, kapcsoloBeallit, kapcsolokOlvas, kuldesMegerosit, naploLeker } from './elosztas.js';
import { eletutFeldolgoz, eletutOlvas, eletutRiasztasok, fuggoFeldolgoz } from './eletut.js';
import { kezdesAKulcsbol } from './eletut-modell.js';

/** POST /api/meres-erkezes (azonos eredet; a bongeszo nem ker valaszt a foglalas folyamataban: a hiba nem akaszthat meg semmit). A "ip" / "ua" a keresbol jon, nem a torzsbol. */
export async function kezelErkezes(request, env, deps = {}) {
  if (!env || !env.KULCS_DB) return valasz(503, { ok: false, miert: 'nincs adatbazis-kotes' });
  if (request.method !== 'POST') return valasz(405, { ok: false });
  if (!azonosEredet(request)) return valasz(403, { ok: false, miert: 'csak azonos eredetrol' });
  const szoveg = await request.text();
  if (szoveg.length > 8000) return valasz(413, { ok: false, miert: 'tul nagy' });
  let o; try { o = JSON.parse(szoveg); } catch (e) { return valasz(400, { ok: false, miert: 'nem JSON' }); }
  if (!o || typeof o !== 'object') return valasz(400, { ok: false, miert: 'nem objektum' });
  const ip = request.headers.get('cf-connecting-ip') || '';
  const r = await erkezesMent(env.KULCS_DB, { ...o, ua: request.headers.get('user-agent') || '', ip }, deps.now ? deps.now() : Date.now());
  return valasz(r.ok ? 200 : 422, r);
}

/** /api/meres-admin (kulcsos, mint a /api/foglalas-egyeztetes): GET ?source_id=.. (naplo) | ?fuggo=1 (kuldesre varo kerelmek) | ?kapcsolok=1;  POST {muvelet:'kapcsolo'|'megerosit', ...} */
export async function kezelAdmin(request, env, deps = {}) {
  if (!env || !env.KULCS_DB) return valasz(503, { ok: false, miert: 'nincs adatbazis-kotes' });
  if (!(await kulcsEllenorzes(request, env))) return valasz(404, { ok: false });
  const url = new URL(request.url);
  if (request.method === 'GET') {
    if (url.searchParams.get('kapcsolok') === '1') return valasz(200, { ok: true, kapcsolok: await kapcsolokOlvas(env.KULCS_DB) });
    if (url.searchParams.get('fuggo') === '1') return valasz(200, { ok: true, fuggo: await fuggoKuldesek(env.KULCS_DB) });
    const sid = url.searchParams.get('source_id') || '';
    if (!sid) return valasz(400, { ok: false, miert: 'source_id / fuggo / kapcsolok kell' });
    return valasz(200, { ok: true, ...(await naploLeker(env.KULCS_DB, sid)) });
  }
  if (request.method === 'POST') {
    const szoveg = await request.text(); if (szoveg.length > 20000) return valasz(413, { ok: false });
    let o; try { o = JSON.parse(szoveg); } catch (e) { return valasz(400, { ok: false, miert: 'nem JSON' }); }
    const most = deps.now ? deps.now() : Date.now();
    if (o.muvelet === 'kapcsolo') return valasz(200, await kapcsoloBeallit(env.KULCS_DB, { uzletag: o.uzletag || null, platform: o.platform || null, be: o.be === true, ok: typeof o.ok === 'string' ? o.ok.slice(0, 200) : null }, most));
    // ajandekkartya: a webhook-ut MANUALIS ujrajatszasa (pl. elonezeten, ahol a Stripe nem erte el a webhookot): ugyanaz a kod fut (arnyekMeres), a PaymentIntentet a Stripe-tol kerdezi; kulcsos, csak MERES_ELOSZTO=1 mellett kuld
    if (o.muvelet === 'ajandek_ujra') {
      if (!deps.ajandekUjra) return valasz(501, { ok: false, miert: 'nincs ajandek-ujrajatszas' });
      if (!/^pi_[A-Za-z0-9]{8,80}$/.test(String(o.pi || ''))) return valasz(400, { ok: false, miert: 'ervenytelen pi' });
      return valasz(200, { ok: true, allapot: await deps.ajandekUjra(env, o.pi, o.mod === 'atutalas' ? 'atutalas' : 'kartya', new Date(most)) });
    }
    // ajandekkartya VISSZATERITES-korrekcio (DECISION #102): a Stripe charge.refunded webhook-agat manualisan ujrajatsza (ugyanaz a kod: arnyekVisszateres), a PaymentIntentet a Stripe-tol kerdezi
    if (o.muvelet === 'ajandek_visszaterites_ujra') {
      if (!deps.ajandekVisszateritesUjra) return valasz(501, { ok: false, miert: 'nincs visszaterites-ujrajatszas' });
      if (!/^pi_[A-Za-z0-9]{8,80}$/.test(String(o.pi || ''))) return valasz(400, { ok: false, miert: 'ervenytelen pi' });
      return valasz(200, { ok: true, allapot: await deps.ajandekVisszateritesUjra(env, o.pi, new Date(most)) });
    }
    // CSAK teszt-modu Stripe-kulccsal (sk_test / rk_test): egy TESZT-visszaterites letrehozasa a megadott PaymentIntentre (osszeg: HUF, elhagyva = teljes); utana a fenti ujrajatszassal
    if (o.muvelet === 'ajandek_teszt_visszateritese') {
      if (!deps.ajandekTesztVisszateritese) return valasz(501, { ok: false, miert: 'nincs teszt-visszaterites' });
      if (!/^pi_[A-Za-z0-9]{8,80}$/.test(String(o.pi || ''))) return valasz(400, { ok: false, miert: 'ervenytelen pi' });
      const osszeg = o.osszeg === undefined || o.osszeg === null ? null : Number(o.osszeg);
      if (osszeg !== null && !(Number.isInteger(osszeg) && osszeg > 0)) return valasz(400, { ok: false, miert: 'ervenytelen osszeg (pozitiv egesz HUF)' });
      return valasz(200, { ok: true, ...(await deps.ajandekTesztVisszateritese(env, o.pi, osszeg)) });
    }
    if (o.muvelet === 'megerosit') return valasz(200, await kuldesMegerosit(env.KULCS_DB, { id: Number(o.id), allapot: o.allapot, http_status: o.http_status, valasz: o.valasz, kuldo: o.kuldo }, most));
    return valasz(400, { ok: false, miert: 'ismeretlen muvelet' });
  }
  return valasz(405, { ok: false });
}

// --- ELETUT (DECISION-LOG #102): /api/foglalas-eletut --------------------------------------------------------------------------------------------
/** A foglalas Salonic-azonositoi (uuid, host, kezdes) a kulcs-tablabol; booking_id vagy uuid alapjan. */
async function foglalasFeloldas(db, { uuid, bookingId }) {
  await kulcsSema(db);
  const sor = uuid ? await db.prepare('SELECT uuid, booking_id, kulcs FROM foglalas_egyeztetes WHERE uuid = ?1 AND booking_id IS NOT NULL').bind(uuid).first()
    : await db.prepare('SELECT uuid, booking_id, kulcs FROM foglalas_egyeztetes WHERE booking_id = ?1 AND kuldve IS NOT NULL').bind(bookingId).first();
  if (!sor) return { bookingId: bookingId || null, uuid: uuid || null, host: null, start: null };
  const k = await db.prepare('SELECT uzletag FROM meres_kuldes WHERE source_id = ?1 LIMIT 1').bind(sor.booking_id).first();
  const host = k ? (Object.entries(HOSTOK).find(([, c]) => c.uzletag === k.uzletag) || [])[0] || null : null;
  return { bookingId: sor.booking_id, uuid: sor.uuid, host, start: kezdesAKulcsbol(sor.kulcs) };
}
const feloldo = (db, fetchImpl) => async (sid) => {
  const f = await foglalasFeloldas(db, { bookingId: sid });
  return { start: f.start, eloEllenorzes: async () => (f.uuid && f.host ? (await foglalasAllapot({ host: f.host, uuid: f.uuid, fetchImpl })).allapot : 'ismeretlen') };
};

/**
 * /api/foglalas-eletut (kulcsos, mint a /api/foglalas-egyeztetes): a foglalas LETREHOZASA UTANI allapotok (lemondva / nem_jelent_meg / megjelent).
 *   POST { uuid | booking_id, allapot: 'lemondva' | 'nem_jelent_meg' | 'megjelent', ido?: ISO-8601 (mikor tortent), forras?: string, vendeg?: { email, telefon } }
 *        -> { allapot: kesz | mar_kuldve | halasztva | ellentmondas | korai | nem_torolve | torolt_foglalas | ismeretlen_foglalas | ki | ervenytelen, eletut_allapot, cellak: [..] }
 *   POST { muvelet: 'fuggo' }  -> a halasztott / eles-re varo cellak ujrafeldolgozasa (idozitett hivo)
 *   GET  ?source_id=mb_.. -> az eletut-allapot + naplo + cellak;  GET ?riasztas=1 -> az ellentmondo / elutasitott bejegyzesek
 */
export async function kezelEletut(request, env, deps = {}) {
  if (!env || !env.KULCS_DB) return valasz(503, { ok: false, miert: 'nincs adatbazis-kotes' });
  if (!(await kulcsEllenorzes(request, env))) return valasz(404, { ok: false });
  const db = env.KULCS_DB, fetchImpl = deps.fetchImpl || fetch, now = deps.now;
  if (request.method === 'GET') {
    const url = new URL(request.url);
    if (url.searchParams.get('riasztas') === '1') { const l = await eletutRiasztasok(db); return valasz(200, { ok: true, db: l.length, riasztas: l.length > 0, lista: l }); }
    const sid = url.searchParams.get('source_id') || '';
    if (!/^mb_[a-z0-9]{12,40}$/.test(sid)) return valasz(400, { ok: false, miert: 'source_id (mb_...) / riasztas kell' });
    return valasz(200, { ok: true, source_id: sid, ...(await eletutOlvas(db, sid)) });
  }
  if (request.method !== 'POST') return valasz(405, { ok: false });
  const szoveg = await request.text();
  if (szoveg.length > 4000) return valasz(413, { ok: false, miert: 'tul nagy' });
  let o; try { o = JSON.parse(szoveg); } catch (e) { return valasz(400, { ok: false, miert: 'nem JSON' }); }
  if (!o || typeof o !== 'object') return valasz(400, { ok: false, miert: 'nem objektum' });
  const mehet = { env, fetchImpl, now };
  if (o.muvelet === 'fuggo') return valasz(200, { ok: true, ...(await fuggoFeldolgoz(db, { ...mehet, feloldo: feloldo(db, fetchImpl) })) });
  if (o.uuid && !UUID_MINTA.test(String(o.uuid))) return valasz(400, { ok: false, miert: 'ervenytelen uuid' });
  if (o.booking_id && !/^mb_[a-z0-9]{12,40}$/.test(String(o.booking_id))) return valasz(400, { ok: false, miert: 'ervenytelen booking_id' });
  if (!o.uuid && !o.booking_id) return valasz(400, { ok: false, miert: 'uuid vagy booking_id kell' });
  const f = await foglalasFeloldas(db, { uuid: o.uuid, bookingId: o.booking_id });
  if (!f.bookingId) return valasz(200, { ok: true, allapot: 'ismeretlen_foglalas', miert: 'ehhez az azonositohoz nincs parositott foglalas' });
  const ido = o.ido ? Math.floor(Date.parse(String(o.ido)) / 1000) : null;
  if (o.ido && !Number.isFinite(ido)) return valasz(400, { ok: false, miert: 'ervenytelen ido (ISO-8601 kell)' });
  const vendeg = o.vendeg && typeof o.vendeg === 'object' ? { email: String(o.vendeg.email || '').slice(0, 200), telefon: String(o.vendeg.telefon || '').slice(0, 40) } : undefined;
  const r = await eletutFeldolgoz(db, { source_id: f.bookingId, allapot: o.allapot, ido, forras: o.forras, vendeg }, { ...mehet, start: f.start, eloEllenorzes: (await feloldo(db, fetchImpl)(f.bookingId)).eloEllenorzes });
  return valasz(200, { ok: true, ...r });
}
