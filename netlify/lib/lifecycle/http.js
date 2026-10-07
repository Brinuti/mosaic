// A lifecycle HTTP-vegpontjai (Cloudflare Pages-fuggvenyek: functions/api/lifecycle/[[kind]].js, functions/f/[[kod]].js, functions/m/[[kod]].js).
//
//   POST /api/lifecycle/bejovo   (kulcsos)  egy Salonic-ertesito befogadasa + az azonnali (T0) uzenetek kikuldese. Torzs: {uzenetId, targy, kuldo, szoveg, html}
//   POST /api/lifecycle/tick     (kulcsos)  az esedekes uzenetek kikuldese + napi karbantartas (az utemezo hivja: ~15 percenkent)
//   GET  /api/lifecycle/allapot  (kulcsos)  az uzemallapot (szemelyes adat nelkul)
//   POST /api/lifecycle/teszt-torol (kulcsos, csak teszt-vendegek)  a teszt-foglalasok torlese
//   GET  /f/<kod>   a vendeg foglalasi oldalara (Salonic) iranyit      GET /m/<kod>   az idopont megerositese (egykattintasos)
//
// Beallitas (wrangler.toml / Cloudflare): LIFECYCLE_DB (D1), LIFECYCLE_KULCS_HASH (a kulcs SHA-256-ja; a kulcs maga az utemezoben / Zapier-ben van),
// LIFECYCLE_MOD, LIFECYCLE_UZLETAGOK, SIMPLESMS_FELHASZNALO / SIMPLESMS_DOMAIN (nem titkos), SIMPLESMS_JELSZO (Secret), SMTP_* (mint az urlap-leveleknel).
import { ingest, tick, napi, megerosit, reszletekUrl, allapot, beallitas } from './engine.js';
import { kuldokKeszit, smsKesz, emailKesz, smsEgyenleg } from './kuldok.js';
import { UZLETAGAK, SZALON, tisztaNev } from './uzletag.js';
import { datumSzoveg, idopontSzoveg } from './ido.js';

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha256 = async (s) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const ma = () => Math.floor(Date.now() / 1000);

async function kulcsos(request, env) {
  const k = request.headers.get('x-lifecycle-kulcs') || '';
  if (!env.LIFECYCLE_KULCS_HASH || !k) return false;
  return (await sha256(k)) === String(env.LIFECYCLE_KULCS_HASH).toLowerCase();
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

export async function api(request, env, ctx) {
  const url = new URL(request.url);
  const resz = url.pathname.replace(/^\/api\/lifecycle\/?/, '').replace(/\/$/, '');
  if (!env.LIFECYCLE_DB) return json({ hiba: 'nincs_db' }, 503);
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

  if (resz === 'bejovo') {
    const k = kuldokKeszit(env);
    try {
      const e = await ingest(db, env, { uzenetId: torzs.uzenetId, targy: torzs.targy, kuldo: torzs.kuldo, szoveg: torzs.szoveg, html: torzs.html }, most);
      let kuldes = null;
      if (e.ok && e.foglalasId && !e.duplikalt) kuldes = await tick(db, env, k, most, { foglalasId: e.foglalasId, base });
      return json({ ...e, kuldes });
    } finally { await k.lezar(); }
  }
  if (resz === 'tick') {
    const k = kuldokKeszit(env);
    const kk = { ...k, egyenleg: () => smsEgyenleg(env) };
    try {
      const t = await tick(db, env, kk, most, { limit: 40, base });
      const n = await napi(db, env, kk, most);
      return json({ tick: t, napi: n });
    } finally { await k.lezar(); }
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

export async function reszletek(request, env) {
  if (!env.LIFECYCLE_DB) return new Response('nincs', { status: 404 });
  const kod = new URL(request.url).pathname.split('/').filter(Boolean)[1] || '';
  const u = /^[0-9a-f]{10}$/.test(kod) ? await reszletekUrl(env.LIFECYCLE_DB, kod) : null;
  if (!u) return html('Nem találom a foglalást', '<h1>Nem találom ezt a foglalást</h1><p>Ha módosítani szeretnél, hívj minket: ' + esc(SZALON.telefon) + '.</p>', 404);
  return new Response(null, { status: 302, headers: { location: u, 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
}

export async function megerosites(request, env) {
  if (!env.LIFECYCLE_DB) return new Response('nincs', { status: 404 });
  const kod = new URL(request.url).pathname.split('/').filter(Boolean)[1] || '';
  if (!/^[0-9a-f]{10}$/.test(kod)) return html('Nem találom a foglalást', '<h1>Nem találom ezt a foglalást</h1><p>Hívj minket: ' + esc(SZALON.telefon) + '.</p>', 404);
  const bot = BOT.test(request.headers.get('user-agent') || '');
  const r = bot ? { ok: false } : await megerosit(env.LIFECYCLE_DB, kod, ma());
  if (bot) return html('Megerősítés', '<h1>Időpont megerősítése</h1><p>A megerősítéshez nyisd meg a linket a telefonodon.</p>');
  if (!r.ok) return html('Nem találom a foglalást', '<h1>Nem találom ezt a foglalást</h1><p>Hívj minket: ' + esc(SZALON.telefon) + '.</p>', 404);
  const f = r.f; const uz = UZLETAGAK[f.uzletag];
  if (f.allapot !== 'aktiv') return html('Lemondott időpont', `<h1>Ez az időpont már le lett mondva</h1><p>Ha szeretnél újat, itt választhatsz:</p><p><a class="gomb" href="${esc(uz.foglalasUrl)}">Új időpontot választok</a></p>`);
  const reszl = await reszletekUrl(env.LIFECYCLE_DB, kod);
  return html('Időpont megerősítve', `<h1>Köszönjük, megerősítettük az időpontodat!</h1>
<div class="doboz"><b>${esc(tisztaNev(f.szolgaltatas))}</b><br>${esc(datumSzoveg(f.kezdet))}, ${esc(idopontSzoveg(f.kezdet))}<br>${esc(SZALON.cim)}</div>
<p>Várunk! Ha mégis változna valami, itt tudod módosítani:</p>
<p><a class="gomb" href="${esc(reszl)}">Foglalás megtekintése / módosítása</a><a class="gomb" href="${esc(SZALON.navigacioUrl)}" style="background:#0f3a3c">Navigáció</a></p>`);
}
