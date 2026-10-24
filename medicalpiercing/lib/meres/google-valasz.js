// MEDICAL PIERCING - Google ARNYEK feltoltes VALASZ-NAPLO (UJ-61, #167 6384788538). A Google-feltoltest egy Zapier-workflow vegzi
// (MP_GOOGLE_ARNYEK_WEBHOOK_URL); a Worker a webhook 200-ra "elkuldve"-t ir (lanc.js / google-ads.js), a Google valaszat nem latja.
// Ez a modul egy KULON tablaba (mp_google_valasz) naplozza a Zap visszahivasat: a Google requestId-ja, a partialFailure kodja, az elfogadott /
// elutasitott darab. A foglalas-kerelem utjat (lanc.js, google-ads.js) NEM erinti: a tabla csak itt, a sajat kerelmeiben jon letre, a mp_feltoltes.allapot
// jelentese valtozatlan ('elkuldve' = a webhook 200-at adott); a "Google elfogadta" a riportban kulon szamolodik.
//   POST /api/mp-google-valasz   fejlec: x-mp-google-kulcs (SHA-256-ja = MP_GOOGLE_VALASZ_KULCS_HASH; kulcs nelkul / rossz kulccsal / beallitas nelkul 404)
//        torzs: { order_id (= mp_feltoltes.kulcs, a Zap order_id-ja), conversion_action_id, kod, request_id?, uzenet?, elfogadva?, elutasitva? }
//        kod: '' = a Google elfogadta; egyebkent rovid kod (UNPARSEABLE_GCLID, EXPIRED_EVENT, ZAP_HIBA, ZAP_KIHAGYVA ...)
//   GET  /api/mp-google-valasz?riport=1[&nap=7]   fejlec: x-mp-kulcs (MP_MERES_ADMIN_KULCS, mint a tobbi admin-vegpontnal): darabszamok, nyers azonosito nelkul
// Csak a MEGLEVO, eles modban elkuldott (mp_feltoltes: mod='eles', allapot='elkuldve') sorhoz fuz visszajelzest; ujat nem hoz letre; az ELSO visszajelzes marad.
// Kattintasazonosito (gclid / gbraid / wbraid), e-mail, hash, telefon nem kerul a naploba: az uzenet maszkolt, hossza korlatozott.
import { MP_GADS } from './google-ads.js';

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const KOD_MINTA = /^[A-Z][A-Z0-9_]{0,39}$/;
const REQUEST_ID_MINTA = /^[A-Za-z0-9_-]{1,64}$/;
const ENGEDETT_AKCIOK = Object.freeze(Object.values(MP_GADS.akciok));
const MEGORZES_NAP = 120; // mint az mp_feltoltes (lanc.js MEGORZES_NAP)

export const VALASZ_SEMA = `CREATE TABLE IF NOT EXISTS mp_google_valasz (
  kulcs TEXT NOT NULL, akcio_id TEXT NOT NULL, kod TEXT NOT NULL, request_id TEXT, elfogadva INTEGER, elutasitva INTEGER, uzenet TEXT,
  ido INTEGER NOT NULL, PRIMARY KEY (kulcs, akcio_id))`;

const sha256hex = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');
async function kulcsEgyezik(request, env) {
  const hash = String((env && env.MP_GOOGLE_VALASZ_KULCS_HASH) || '').toLowerCase();
  const adott = request.headers.get('x-mp-google-kulcs') || ''; // CSAK fejlecben (a query-kulcs naplokba kerulhet)
  if (!hash || !adott) return false;
  const a = await sha256hex(adott); let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ (hash.charCodeAt(i) || 0);
  return d === 0 && a.length === hash.length;
}

// A Google / Zap uzenetbol kiszedjuk a kattintasazonositot (minden alakban: kulcs + barmilyen elvalaszto + ertek, URL-kodolt is; kulcs nelkuli token is), az e-mailt, a hash-t
const CLICK_KULCS = '(gclid|gbraid|wbraid|googleclickid|google_click_id)';
const ELVALASZTO = '[\\s"\':=,{}\\[\\]]*(?:%3[dD]|%22|%3[aA]|%27)*[\\s"\']*';
const CLICK_RE = new RegExp(CLICK_KULCS + ELVALASZTO + '([A-Za-z0-9_-]{6,})', 'gi');
const idSzeru = (x) => /\d/.test(x) || (/[a-z]/.test(x) && /[A-Z]/.test(x)); // "expired" / "not" nem click ID
const hosszuToken = (x) => x.length >= 20 && ((/[a-z]/.test(x) && /[A-Z]/.test(x)) || (x.length >= 24 && /\d/.test(x) && /[A-Za-z]/.test(x)));
export const uzenetTisztit = (s) => String(s || '')
  .replace(CLICK_RE, (m, kulcs, ertek) => (idSzeru(ertek) ? kulcs + '=[click]' : m))
  .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]')
  .replace(/\b[0-9a-fA-F]{32,}\b/g, '[hash]')
  .replace(/\+?\d[\d\s-]{8,}\d/g, '[szam]')
  .replace(/[A-Za-z0-9_-]{20,}/g, (x) => (hosszuToken(x) ? '[token]' : x))
  .replace(/\s+/g, ' ').trim().slice(0, 300);
const darab = (v) => (Number.isInteger(v) && v >= 0 && v <= 1000 ? v : null);

/** A tiszta muvelet (tesztelheto): -> { status, body }. */
export async function googleValaszRogzit(db, o, most = Math.floor(Date.now() / 1000)) {
  if (!o || typeof o !== 'object') return { status: 400, body: { ok: false, miert: 'nem objektum' } };
  const kod = o.kod == null ? '' : String(o.kod);
  if (kod !== '' && !KOD_MINTA.test(kod)) return { status: 422, body: { ok: false, miert: 'kod: ures (elfogadva) vagy NAGYBETUS_KOD (max 40)' } };
  const kulcs = typeof o.order_id === 'string' ? o.order_id : '';
  if (!kulcs || kulcs.length > 120) return { status: 400, body: { ok: false, miert: 'order_id (a foglalasi kulcs) kell' } };
  const akcio = String(o.conversion_action_id == null ? '' : o.conversion_action_id);
  if (!ENGEDETT_AKCIOK.includes(akcio)) return { status: 422, body: { ok: false, miert: 'conversion_action_id: nem MP ARNYEK akcio' } };
  await db.prepare(VALASZ_SEMA).run();
  const sor = await db.prepare("SELECT 1 AS van FROM mp_feltoltes WHERE kulcs = ? AND akcio_id = ? AND mod = 'eles' AND allapot = 'elkuldve'").bind(kulcs, akcio).first();
  if (!sor) return { status: 404, body: { ok: false, miert: 'nincs ilyen eles, elkuldott feltoltes' } };
  const rid = typeof o.request_id === 'string' && REQUEST_ID_MINTA.test(o.request_id) ? o.request_id : null;
  const r = await db.prepare('INSERT OR IGNORE INTO mp_google_valasz (kulcs, akcio_id, kod, request_id, elfogadva, elutasitva, uzenet, ido) VALUES (?,?,?,?,?,?,?,?)')
    .bind(kulcs, akcio, kod, rid, darab(o.elfogadva), darab(o.elutasitva), uzenetTisztit(o.uzenet) || null, most).run();
  const rogzitve = !!(r.meta && r.meta.changes > 0);
  return { status: 200, body: rogzitve ? { ok: true, rogzitve: true, kod } : { ok: true, rogzitve: false, mar_rogzitve: true } }; // az elso visszajelzes marad
}

/** Napi / akcionkenti darabszamok (nyers azonosito nelkul). A tabla hianyaban { sema_hianyzik: true }. */
export async function googleValaszRiport(db, nap = 7, most = Math.floor(Date.now() / 1000)) {
  const tol = most - Math.min(MEGORZES_NAP, Math.max(1, nap)) * 86400;
  const van = await db.prepare("SELECT 1 AS van FROM sqlite_master WHERE type = 'table' AND name = 'mp_google_valasz'").first();
  if (!van) return { sema_hianyzik: true };
  const t = await db.prepare(`SELECT t.akcio_id AS akcio,
      COUNT(*) AS elkuldve,
      SUM(v.kod = '') AS google_elfogadta,
      SUM(v.kod IS NOT NULL AND v.kod <> '') AS reszleges_hiba,
      SUM(v.kod IS NULL) AS nincs_visszajelzes
    FROM mp_feltoltes t LEFT JOIN mp_google_valasz v ON v.kulcs = t.kulcs AND v.akcio_id = t.akcio_id
    WHERE t.mod = 'eles' AND t.allapot = 'elkuldve' AND t.ido >= ? GROUP BY t.akcio_id ORDER BY t.akcio_id`).bind(tol).all();
  const k = await db.prepare("SELECT kod, COUNT(*) AS db FROM mp_google_valasz WHERE kod <> '' AND ido >= ? GROUP BY kod ORDER BY db DESC LIMIT 20").bind(tol).all();
  const sorok = (t.results || []).map((x) => ({ akcio: x.akcio, elkuldve: x.elkuldve, google_elfogadta: x.google_elfogadta || 0, reszleges_hiba: x.reszleges_hiba || 0, nincs_visszajelzes: x.nincs_visszajelzes || 0 }));
  const osszes = sorok.reduce((a, s) => ({ elkuldve: a.elkuldve + s.elkuldve, google_elfogadta: a.google_elfogadta + s.google_elfogadta, reszleges_hiba: a.reszleges_hiba + s.reszleges_hiba, nincs_visszajelzes: a.nincs_visszajelzes + s.nincs_visszajelzes }), { elkuldve: 0, google_elfogadta: 0, reszleges_hiba: 0, nincs_visszajelzes: 0 });
  return { nap, akciok: sorok, osszes, hibakodok: k.results || [] };
}

/** POST /api/mp-google-valasz (Zap-visszahivas) es GET ?riport=1 (admin). */
export async function googleValaszVegpont({ request, env = {} }, { most = Math.floor(Date.now() / 1000) } = {}) {
  if (request.method === 'GET') {
    const url = new URL(request.url);
    if (!url.searchParams.get('riport')) return json({ ok: false }, 404);
    if (!env.MP_MERES_ADMIN_KULCS) return json({ ok: false }, 404);
    if (request.headers.get('x-mp-kulcs') !== env.MP_MERES_ADMIN_KULCS) return json({ ok: false }, 403);
    if (!env.MP_MERES_DB) return json({ ok: false, hiba: 'nincs_adatbazis' }, 503);
    return json({ ok: true, ...(await googleValaszRiport(env.MP_MERES_DB, Number(url.searchParams.get('nap')) || 7, most)) });
  }
  if (!(await kulcsEgyezik(request, env))) return json({ ok: false }, 404); // a kulcsellenorzes ELOL: kulcs nelkul mindig 404, a beallitasokrol / a D1-rol semmi nem derul ki
  if (!env.MP_MERES_DB) return json({ ok: false, hiba: 'nincs_adatbazis' }, 503);
  if (request.method !== 'POST') return json({ ok: false }, 405);
  const szoveg = await request.text();
  if (szoveg.length > 4000) return json({ ok: false, miert: 'tul nagy' }, 413);
  let o; try { o = JSON.parse(szoveg); } catch (e) { return json({ ok: false, miert: 'nem JSON' }, 400); }
  let r; try { r = await googleValaszRogzit(env.MP_MERES_DB, o, most); } catch (e) { return json({ ok: false, hiba: 'adatbazis_hiba' }, 500); }
  return json(r.body, r.status);
}
