// MEDICAL PIERCING - Meta Conversions API (szerveroldali) - 1. lepes: CSAK TESZTUZEM.
// Feri dontese (2026-10-13 17:53, 18:10): a Salonic altal kuldott Schedule marad (ahhoz nem nyulunk); mellette sajat,
// semleges nevu "IgazoltFoglalas" esemeny vinne a kattintasazonositot (fbc/fbp). Elobb Meta-tesztuzemben (test_event_code)
// megnezzuk, hogy a Meta elfogadja-e, es a korlatozott (egeszsegugyi) domain miatt jelol-e valamit. Eles kuldes NINCS.
//
// Adatvedelem: kifele csak esemenynev, ido, esemeny_id, fbc/fbp, semleges URL. NINCS e-mail, telefon, nev, IP, user agent,
// szolgaltatasnev, kategoria, helyszin.
import { SEMLEGES_URL } from './meres.js';

export const META_DATASET = '2177829632420786';
export const META_ESEMENY = 'IgazoltFoglalas';
export const TESZT_ESEMENYEK = Object.freeze(['IgazoltFoglalas', 'Schedule']);
export const TESZT_FORRASOK = Object.freeze({ fo: SEMLEGES_URL, salonic: 'https://medicalpiercing.salonic.hu/' });
export const META_VEGPONT = (v = 'v21.0') => `https://graph.facebook.com/${v}/${META_DATASET}/events`;

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const sha256hex = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s))))].map((x) => x.toString(16).padStart(2, '0')).join('');
const egyenlo = (a, b) => {
  a = String(a || ''); b = String(b || '');
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0 && a.length > 0;
};

/** Tesztesemeny-torzs (tiszta). Csak TEST-kod mellett hasznalhato. */
export function tesztTorzs({ most, kod, fbc, fbp, esemenyId, ua, esemeny = META_ESEMENY, url = SEMLEGES_URL }) {
  const user = {};
  if (ua) user.client_user_agent = ua; // website action_source mellett a Meta keri
  if (fbc) user.fbc = fbc;
  if (fbp) user.fbp = fbp;
  return {
    data: [{
      event_name: esemeny,
      event_time: most,
      event_id: esemenyId,
      action_source: 'website',
      event_source_url: url,
      user_data: user,
      custom_data: { currency: 'HUF', value: 1 },
    }],
    test_event_code: kod,
  };
}

/**
 * POST /api/mp-meta-teszt  fejlec: x-mp-meta-teszt = egyszeri kod (D1 mp_beallitas.meta_teszt_sha256 lenyomata)
 * torzs: { test_event_code: "TEST12345" }. Kizarolag tesztuzem: test_event_code nelkul nem kuld.
 */
export async function metaTesztVegpont({ request, env, fetchFn = fetch }) {
  if (request.method !== 'POST') return json({ ok: false, hiba: 'csak_post' }, 405);
  const db = env.MP_MERES_DB;
  let h = null;
  try { const r = await db.prepare("SELECT ertek FROM mp_beallitas WHERE kulcs = 'meta_teszt_sha256'").first(); h = r && r.ertek; } catch (e) { /* nincs */ }
  const kapott = request.headers.get('x-mp-meta-teszt');
  if (!h || !kapott || !egyenlo(await sha256hex(kapott), h)) return json({ ok: false, hiba: 'jogosulatlan' }, 401);
  let body = {};
  try { body = await request.json(); } catch (e) { /* ures */ }
  const kod = String(body.test_event_code || '');
  if (!/^TEST\d{3,10}$/.test(kod)) return json({ ok: false, hiba: 'csak_tesztkoddal' }, 400);
  if (!env.META_CAPI_TOKEN) return json({ ok: false, hiba: 'nincs_token' }, 500);
  // 2026-10-14 (Feri): forras-teszt - standard Schedule es/vagy a Salonic-aldomain mint valos esemenyforras (csak TEST-kod mellett)
  const esemeny = TESZT_ESEMENYEK.includes(body.esemeny) ? body.esemeny : META_ESEMENY;
  const url = TESZT_FORRASOK[body.forras] || SEMLEGES_URL;
  const most = Math.floor(Date.now() / 1000);
  const torzs = tesztTorzs({ most, kod, esemeny, url, fbc: `fb.1.${most * 1000}.TESZTclaude`, fbp: `fb.1.${most * 1000}.1234567890`, esemenyId: `Teszt:${most}`, ua: request.headers.get('user-agent') || '' });
  const r = await fetchFn(`${META_VEGPONT()}?access_token=${encodeURIComponent(env.META_CAPI_TOKEN)}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(torzs),
  });
  let valasz = null;
  try { valasz = await r.json(); } catch (e) { valasz = { nem_json: true }; }
  return json({ ok: r.ok, http: r.status, meta: valasz, kuldott_esemeny: torzs.data[0].event_name, url: torzs.data[0].event_source_url });
}
