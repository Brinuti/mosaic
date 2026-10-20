// A lifecycle HTTP-vegpontjai (Cloudflare Pages-fuggvenyek: functions/api/lifecycle/[[kind]].js, functions/f/[[kod]].js, functions/m/[[kod]].js).
//
//   POST /api/lifecycle/bejovo   (kulcsos)  egy Salonic-ertesito befogadasa + az azonnali (T0) uzenetek kikuldese. Torzs: {uzenetId, targy, kuldo, szoveg, html}
//   POST /api/lifecycle/tick     (kulcsos)  az esedekes uzenetek kikuldese + napi karbantartas (az utemezo hivja: ~15 percenkent)
//   GET  /api/lifecycle/allapot  (kulcsos)  az uzemallapot (szemelyes adat nelkul)
//   POST /api/lifecycle/teszt-torol (kulcsos, csak teszt-vendegek)  a teszt-foglalasok torlese
//   GET  /f/<kod>   a vendeg foglalasi oldalara (Salonic) iranyit      GET /m/<kod>   az idopont megerositese (egykattintasos)
//   GET  /u/<kod>   leiratkozas az automatikus e-mailekrol (megerosito oldal)      POST /u/<kod>   a leiratkozas (RFC 8058 egykattintasos is)
//
// Beallitas (wrangler.toml / Cloudflare): LIFECYCLE_DB (D1), LIFECYCLE_KULCS_HASH (a kulcs SHA-256-ja; a kulcs maga az utemezoben / Zapier-ben van),
// LIFECYCLE_MOD, LIFECYCLE_UZLETAGOK, LIFECYCLE_MUNKATARS_MOD (ki | figyel | be), LIFECYCLE_ELO_ELLENORZES (ki), LIFECYCLE_NOSHOW_AUTO (1), SIMPLESMS_FELHASZNALO / SIMPLESMS_DOMAIN (nem titkos), SIMPLESMS_JELSZO (Secret), SMTP_* (mint az urlap-leveleknel).
import { ingest, tick, napi, megerosit, reszletekUrl, foglalasNezet, allapot, beallitas, mpImport } from './engine.js';
import { foglalasOldal, nemTalalhato, megerositesOldal, leiratkozasOldal } from './oldal.js';
import { leiratkozasNezet, leiratkoztat, LEIRATKOZAS_KOD } from './leiratkozas.js';
import { kuldokKeszit, smsKesz, emailKesz, smsEgyenleg, smsConnectProba } from './kuldok.js';
import { eloEllenorzoKeszit } from './elo.js';
import { UZLETAGAK, SZALON, tisztaNev } from './uzletag.js';
import { datumSzoveg, idopontSzoveg } from './ido.js';
import { ertelmez as ertelmezCrm } from './parser.js';
import { kapocs as crmKapocs } from '../../../crm/lib/lifecycle-kapocs.js';

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha256 = async (s) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const ma = () => Math.floor(Date.now() / 1000);

/** A LIFECYCLE_KULCS_HASH egy vagy tobb (vesszovel / szokozzel elvalasztott) SHA-256 hash: kulcscserekor atmenetileg mindketto ervenyes (leallas nelkuli csere). */
/** MP: a Google-velemenyek szama a medicalpiercing.hu /api/ertekeles vegpontjabol (ott 1 oraig gyorsitotarazva); hiba / idotullepes: null (a level a kerek szamot irja). */
export function mpErtekelesKeszit(env = {}, fetchFn = fetch) {
  return async () => {
    const ab = new AbortController(); const idozito = setTimeout(() => ab.abort(), 3000);
    try {
      const r = await fetchFn(env.MP_ERTEKELES_URL || 'https://www.medicalpiercing.hu/api/ertekeles', { signal: ab.signal });
      const j = r.ok ? await r.json() : null;
      return j && Number(j.db) > 0 ? Number(j.db) : null;
    } catch { return null; } finally { clearTimeout(idozito); }
  };
}

async function kulcsos(request, env) {
  const k = request.headers.get('x-lifecycle-kulcs') || '';
  const hashek = String(env.LIFECYCLE_KULCS_HASH || '').toLowerCase().split(/[\s,;]+/).filter((h) => /^[0-9a-f]{64}$/.test(h));
  if (!hashek.length || !k) return false;
  return hashek.includes(await sha256(k));
}

/** A "most": elesben mindig a valodi ido; teszt / ki modban a kerelem felulirhatja (a T-72/T-24 sor tesztelesehez). */
function mostBol(cfg, ertek) {
  const n = Number(ertek);
  return cfg.mod !== 'elo' && Number.isFinite(n) && n > 1.6e9 ? Math.floor(n) : ma();
}

function bazis(request, env) {
  if (env.LIFECYCLE_BASE_URL) return env.LIFECYCLE_BASE_URL;
  const u = new URL(request.url);
  return /(^|\.)mosaicheadspa\.hu$/.test(u.hostname) ? 'https://www.mosaicheadspa.hu' : u.origin;
}

/**
 * POST /api/lifecycle/mp-import: az MP elesites elotti foglalasainak egyszeri atemelese, kozvetlenul a Salonic admin-oldalarol (a bongeszobol, CORS).
 * Kulcs: a torzs `kulcs` mezoje; a SHA-256-ja az MP_IMPORT_HASH (wrangler.toml). Az atemeles utan a hash torlendo (a vegpont ekkor 404).
 * Torzs (text/plain, JSON): { kulcs, rekordok: [...] } - lasd engine.js mpImport.
 */
const IMPORT_ORIGIN = 'https://app.salonic.hu';
async function mpImportVegpont(request, env, url) {
  const cors = { 'access-control-allow-origin': IMPORT_ORIGIN, 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'content-type', vary: 'origin' };
  if (!/^[0-9a-f]{64}$/.test(String(env.MP_IMPORT_HASH || ''))) return new Response('nincs', { status: 404 });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return new Response('nincs', { status: 404 });
  let t = {};
  try { t = JSON.parse(await request.text()); } catch { return json({ hiba: 'json' }, 400); }
  if (!t.kulcs || (await sha256(String(t.kulcs))) !== env.MP_IMPORT_HASH) return new Response('nincs', { status: 404, headers: cors });
  const cfg = beallitas(env);
  const e = await mpImport(env.LIFECYCLE_DB, cfg, t.rekordok, ma());
  return new Response(JSON.stringify(e), { status: 200, headers: { ...cors, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

export async function api(request, env, ctx) {
  const url = new URL(request.url);
  const resz = url.pathname.replace(/^\/api\/lifecycle\/?/, '').replace(/\/$/, '');
  if (!env.LIFECYCLE_DB) return json({ hiba: 'nincs_db' }, 503);
  if (resz === 'mp-import') return mpImportVegpont(request, env, url);
  if (!(await kulcsos(request, env))) return new Response('nincs', { status: 404 });
  const cfg = beallitas(env);
  const db = env.LIFECYCLE_DB;
  const base = bazis(request, env);

  if (resz === 'allapot' && request.method === 'GET') {
    const a = await allapot(db, env, ma());
    return json({ ...a, smsBeallitva: smsKesz(env), emailBeallitva: emailKesz(env), bazis: base });
  }
  if (request.method !== 'POST') return json({ hiba: 'POST kell' }, 405);
  let torzs = {};
  try { torzs = await request.json(); } catch { /* ures torzs is jo a tick-hez */ }
  const most = mostBol(cfg, torzs.most);

  const waitUntil = ctx && typeof ctx.waitUntil === 'function' ? ctx.waitUntil.bind(ctx) : null;
  if (resz === 'bejovo') {
    const k = kuldokKeszit(env, { waitUntil });
    try {
      const elo = eloEllenorzoKeszit(env); // a foglalas nyilvanos Salonic-oldalanak elo ellenorzese (munkatarsi ertesitok bizonyitasa; LIFECYCLE_ELO_ELLENORZES=ki kikapcsolja)
      const e = await ingest(db, env, { uzenetId: torzs.uzenetId, targy: torzs.targy, kuldo: torzs.kuldo, szoveg: torzs.szoveg, html: torzs.html, kuldve: torzs.kuldve }, most, { eloEllenorzes: elo });
      // Oxigen CRM (docs/oxigen-crm): a parser elemzett esemenyenek MASOLATA a CRM-be. Nem dobhat kivetelt, nem lassithatja a lifecycle-t (idokorlat), CRM_DB nelkul nem csinal semmit.
      try {
        const p = ertelmezCrm({ uzenetId: torzs.uzenetId, targy: torzs.targy, kuldo: torzs.kuldo, szoveg: torzs.szoveg, html: torzs.html, kuldve: torzs.kuldve }, most);
        if (p && p.ok && p.uzletag !== 'mp') await crmKapocs(env, { ...p, kuldve: Number(torzs.kuldve) || undefined }, { most });
      } catch { /* a CRM hibaja nem erintheti a lifecycle-t */ }
      let kuldes = null;
      // A munkatarsi ertesito (figyel mod, riasztas, bizonytalan eset: valtozas === false) SOHA nem inditja el a kuldest; az esedekes uzenetek a koveto oraponkenti tickkel mennek, mint eddig.
      if (e.ok && e.foglalasId && !e.duplikalt && e.valtozas !== false) kuldes = await tick(db, env, k, most, { foglalasId: e.foglalasId, base, eloEllenorzes: elo, mpErtekeles: mpErtekelesKeszit(env) });
      if (k.mpSorban > 0) await k.mpPing(); // MP-level kerult a sorba: az MP-projekt kuldje ki (best-effort)
      return json({ ...e, kuldes });
    } finally { await k.lezar(); }
  }
  if (resz === 'tick') {
    const k = kuldokKeszit(env, { waitUntil });
    const kk = { ...k, egyenleg: () => smsEgyenleg(env) };
    try {
      const t = await tick(db, env, kk, most, { limit: 40, base, eloEllenorzes: eloEllenorzoKeszit(env), mpErtekeles: mpErtekelesKeszit(env) });
      const n = await napi(db, env, kk, most);
      await k.mpPing(); // minden tick utan: a bennragadt / hibas MP-sorok ujraprobalasa (best-effort)
      return json({ tick: t, napi: n });
    } finally { await k.lezar(); }
  }
  if (resz === 'sms-proba') { // diagnosztika: melyik felhasznalonevvel megy a SimpleSMS connect (jelszo nem latszik)
    const jeloltek = Array.isArray(torzs.felhasznalok) && torzs.felhasznalok.length ? torzs.felhasznalok.slice(0, 5) : [env.SIMPLESMS_FELHASZNALO || 'mosaic'];
    const eredmeny = [];
    for (const nev of jeloltek) eredmeny.push(await smsConnectProba(env, String(nev).slice(0, 80)));
    let egyenleg = null; try { egyenleg = await smsEgyenleg(env); } catch (e) { egyenleg = `hiba: ${String(e && e.message).slice(0, 80)}`; }
    return json({ domain: env.SIMPLESMS_DOMAIN || 'mosaicheadspa.hu', eredmeny, egyenleg });
  }
  if (resz === 'teszt-torol') {
    if (cfg.mod === 'elo' && !torzs.biztos) return json({ hiba: 'elo modban csak biztos:true-val' }, 409);
    const idk = (await db.prepare('SELECT id FROM foglalasok WHERE teszt = 1').all()).results.map((r) => r.id);
    for (const id of idk) { await db.prepare('DELETE FROM kuldesek WHERE foglalas_id = ?1').bind(id).run(); await db.prepare('DELETE FROM foglalasok WHERE id = ?1').bind(id).run(); }
    await db.prepare("DELETE FROM esemenyek WHERE foglalas_id IN (SELECT id FROM foglalasok WHERE teszt = 1) OR tipus = 'ingest:kihagyva'").run();
    return json({ torolt: idk.length });
  }
  return json({ hiba: 'ismeretlen vegpont' }, 404);
}

// ---- vendeg-oldalak ----------------------------------------------------------------------------------------------------------------------------
const OLDAL = (cim, torzs) => `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(cim)} | MOSAIC</title>
<style>body{margin:0;background:#f6f1e7;font:17px/1.6 Georgia,'Times New Roman',serif;color:#26302f}header{background:#0f3a3c;text-align:center;padding:22px 12px}header b{font:500 24px Georgia,serif;letter-spacing:.32em;color:#e9dcc0}
main{max-width:560px;margin:28px auto;background:#fff;border-radius:8px;padding:30px 28px;box-shadow:0 8px 30px rgba(60,40,15,.1)}h1{font:500 26px/1.25 Georgia,serif;color:#0f3a3c;margin:0 0 14px}
.doboz{background:#f8f4ec;border-left:3px solid #c6a346;padding:14px 18px;margin:18px 0}a.gomb{display:inline-block;background:#c6a346;color:#fff;text-decoration:none;font:600 15px Arial,sans-serif;padding:13px 28px;border-radius:999px;margin:6px 8px 6px 0}a.halk{color:#6b7776}
footer{text-align:center;font:13px Arial,sans-serif;color:#6b7776;padding:0 12px 28px}</style></head><body><header><b>MOSAIC</b></header><main>${torzs}</main><footer>${esc(SZALON.cim)} · ${esc(SZALON.telefon)}</footer></body></html>`;
const html = (cim, torzs, status = 200) => new Response(OLDAL(cim, torzs), { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
const BOT = /bot|crawl|spider|preview|facebookexternal|whatsapp|telegram|slackbot|inspectiontool|skypeuripreview/i;

const mpAtiranyit = (ut, kod) => new Response(null, { status: 302, headers: { location: `${UZLETAGAK.mp.oldal}/${ut}/${kod}`, 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });

export async function reszletek(request, env) {
  if (!env.LIFECYCLE_DB) return new Response('nincs', { status: 404 });
  const kod = new URL(request.url).pathname.split('/').filter(Boolean)[1] || '';
  const f = /^[0-9a-f]{10}$/.test(kod) ? await foglalasNezet(env.LIFECYCLE_DB, kod) : null;
  if (!f) return nemTalalhato();
  if (f.uzletag === 'mp') return mpAtiranyit('f', kod); // a Medical Piercing foglalasa a sajat oldalan (medicalpiercing/lib/foglalasom.js)
  return foglalasOldal(f); // a Salonic vendeg-oldala a SAJAT oldalunkba agyazva (iframe), nem a Salonicra visszuk a vendeget
}

export async function megerosites(request, env) {
  if (!env.LIFECYCLE_DB) return new Response('nincs', { status: 404 });
  const kod = new URL(request.url).pathname.split('/').filter(Boolean)[1] || '';
  if (!/^[0-9a-f]{10}$/.test(kod)) return nemTalalhato();
  const nezet = await foglalasNezet(env.LIFECYCLE_DB, kod);
  if (nezet && nezet.uzletag === 'mp') return mpAtiranyit('m', kod); // a megerosites is az MP oldalan tortenik (itt nem irunk)
  if (BOT.test(request.headers.get('user-agent') || '')) return megerositesOldal(null, 'bot');
  const r = await megerosit(env.LIFECYCLE_DB, kod, ma());
  if (!r.ok) return nemTalalhato();
  // lemondott / meg nem jelent foglalas: ugyanaz az oldal, mint a /f/<kod> (fejlec, doboz, "Uj idopontot foglalok" -> foglalo-motor)
  if (r.f.allapot !== 'aktiv') return foglalasOldal({ ...r.f, salonicUrl: null });
  return megerositesOldal(r.f, 'megerositve');
}

/** /u/<kod>: leiratkozas az automatikus e-mailekrol. GET = megerosito oldal (nem valtoztat), POST = leiratkozas (a gomb es a levelezok egykattintasos List-Unsubscribe-Post-ja). */
export async function leiratkozas(request, env) {
  if (!env.LIFECYCLE_DB) return new Response('nincs', { status: 404 });
  const kod = new URL(request.url).pathname.split('/').filter(Boolean)[1] || '';
  if (!LEIRATKOZAS_KOD.test(kod)) return nemTalalhato();
  const db = env.LIFECYCLE_DB;
  const nezet = await leiratkozasNezet(db, kod);
  if (!nezet || !nezet.vanEmail) return nemTalalhato();
  if (request.method === 'POST') {
    const r = await leiratkoztat(db, kod, ma());
    if (!r.ok) return nemTalalhato();
    return leiratkozasOldal('kesz', { kod, uzletag: nezet.uzletag });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('nem engedett', { status: 405, headers: { allow: 'GET, HEAD, POST' } });
  return leiratkozasOldal(nezet.mar ? 'mar' : 'megerosites', { kod, uzletag: nezet.uzletag });
}
