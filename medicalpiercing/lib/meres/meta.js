// MEDICAL PIERCING - Meta Conversions API (szerveroldali) - 1. lepes: CSAK TESZTUZEM.
// Feri dontese (2026-10-13 17:53, 18:10): a Salonic altal kuldott Schedule marad (ahhoz nem nyulunk); mellette sajat,
// semleges nevu "IgazoltFoglalas" esemeny vinne a kattintasazonositot (fbc/fbp). Elobb Meta-tesztuzemben (test_event_code)
// megnezzuk, hogy a Meta elfogadja-e, es a korlatozott (egeszsegugyi) domain miatt jelol-e valamit. Eles kuldes NINCS.
//
// Adatvedelem: kifele csak esemenynev, ido, esemeny_id, fbc/fbp, user agent, IP (az ARNYEK-esemenyben, Feri 2026-10-19), semleges URL.
// NINCS e-mail, telefon, nev, szolgaltatasnev, kategoria, helyszin (egeszsegugyi adat soha).
import { SEMLEGES_URL, esemenyId, vanErzekeny } from './meres.js';
import { kitakar, ELES_HOST } from './google-ads.js';

export const META_DATASET = '2177829632420786';
export const META_ESEMENY = 'IgazoltFoglalas';
export const TESZT_ESEMENYEK = Object.freeze(['IgazoltFoglalas', 'Schedule', 'SubmitApplication', 'Contact', 'CompleteRegistration', 'FindLocation', 'CustomizeProduct']);
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
  // 2026-10-14: adathalmaz:'arnyek' -> a kulon ARNYEK adathalmaz (hozzaferes-ellenorzes, csak TEST-koddal)
  const vegpont = body.adathalmaz === 'arnyek' ? `https://graph.facebook.com/v21.0/1650176753358464/events` : META_VEGPONT();
  const r = await fetchFn(`${vegpont}?access_token=${encodeURIComponent(env.META_CAPI_TOKEN)}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(torzs),
  });
  let valasz = null;
  try { valasz = await r.json(); } catch (e) { valasz = { nem_json: true }; }
  return json({ ok: r.ok, http: r.status, meta: valasz, kuldott_esemeny: torzs.data[0].event_name, url: torzs.data[0].event_source_url });
}

// ---------------------------------------------------------------------------------------------------------------------
// ARNYEKMERES (Feri, 2026-10-14 08:57 "mehet a meta teszt", 10:22: a GPT-javaslat szerinti 1. valtozat).
// A foglalas ROGZITESEKOR (a koszonooldali bongeszo-keresbol) sajat szerveres Schedule megy a kampanyban NEM hasznalt
// "ARNYEK - MP meres teszt" adathalmazba (1650176753358464), forraskent a Salonic-aldomainnel (a foglalas ott tortenik),
// fbc/fbp-vel (2026-10-20-tol fbc/fbp nelkul is, ha van IP + UA vagy external_id). A bongeszo user agentjet (a Meta website-esemenyhez keri) CSAK ebben a hivasban hasznaljuk, SEHOL NEM TAROLJUK.
// Csak hirdetesi hozzajarulassal. A Salonic-igazolast csak a sajat osszevetesunkhoz hasznaljuk. Az eles adathalmazt nem erinti.
// Kifele NINCS e-mail, telefon, nev, szolgaltatasnev, helyszin (az IP 2026-10-19 ota megy, Feri dontese).
// Mod: mp_beallitas.meta_arnyek_mod = 'ki' | 'naplo' (alapertelmezes) | 'eles'; eles kuldes csak eles hoszton + tokennel.
export const ARNYEK_DATASET = '1650176753358464';
export const ARNYEK_ESEMENY = 'Schedule';
export const SALONIC_FORRAS_URL = TESZT_FORRASOK.salonic;
export const ARNYEK_VEGPONT = (v = 'v21.0') => `https://graph.facebook.com/${v}/${ARNYEK_DATASET}/events`;
export const ARNYEK_SEMA = `CREATE TABLE IF NOT EXISTS mp_meta_arnyek (
  kulcs TEXT PRIMARY KEY, mod TEXT NOT NULL, allapot TEXT NOT NULL, van_fbc INTEGER, van_fbp INTEGER, valasz TEXT, ido INTEGER NOT NULL)`;

export async function arnyekMod(db) {
  let m = '';
  try { const r = await db.prepare("SELECT ertek FROM mp_beallitas WHERE kulcs = 'meta_arnyek_mod'").first(); m = String((r && r.ertek) || '').trim().toLowerCase(); } catch (e) { /* nincs */ }
  if (m === 'ki' || m === 'eles') return m;
  return 'naplo';
}
export function arnyekHatalyos(mod, env = {}, host = '') {
  if (mod === 'ki') return 'ki';
  if (mod === 'eles' && env.META_CAPI_TOKEN && host === ELES_HOST) return 'eles';
  return 'naplo';
}

/**
 * Jogosultsag (tiszta): eles, hirdetesi hozzajarulas, van user agent, es van legalabb egy azonosito: fbc / fbp, vagy
 * (2026-10-20, a TikTok-ag mintajara) ervenyes IP + user agent, vagy external_id. Azonosito nelkul: 'nincs_azonosito'.
 */
export function arnyekJogosult(sor, ua, ip = null, ext = null) {
  if (!sor) return { ok: false, miert: 'nincs_sor' };
  if (sor.kornyezet !== 'eles') return { ok: false, miert: 'nem_eles' };
  if (Number(sor.hozzajarulas_hirdetes) !== 1) return { ok: false, miert: 'nincs_hozzajarulas' };
  if (!ua) return { ok: false, miert: 'nincs_ua' };
  if (!sor.meta_fbc && !sor.meta_fbp && !ipJo(ip) && !extJo(ext)) return { ok: false, miert: 'nincs_azonosito' };
  return { ok: true };
}

/** A veletlen latogato-azonosito SHA-256 lenyomata (64 hex), kulonben null. */
export const extJo = (ext) => (ext && /^[0-9a-f]{64}$/.test(String(ext)) ? String(ext) : null);

/**
 * Kihagyas-naplo (2026-10-20): a kimaradt kuldes oka 'kihagyva:<ok>' allapottal, payload / valasz NELKUL kerul a tablaba,
 * hogy a napi riport okot mutasson. Csak a meg nem rogzitett vagy korabban szinten kihagyott kulcsot irja (felul).
 * Nem naplozzuk: nincs kulcs, nem eles kornyezet, szandekosan kikapcsolt mod, mar rogzitett kulcs, varatlan hiba.
 */
export const NAPLOZATLAN_KIHAGYAS = Object.freeze(['nincs_sor', 'nem_eles', 'ki', 'mar_rogzitve', 'hiba']);
export const kihagyvaAllapot = (ok) => `kihagyva:${ok}`;
export const kihagyottE = (allapot) => String(allapot || '').startsWith('kihagyva:');

/** IP-cim ellenorzese (IPv4 / IPv6), kulonben null. */
export const ipJo = (ip) => { const s = String(ip || '').trim(); return /^(\d{1,3}\.){3}\d{1,3}$/.test(s) || (/^[0-9a-f:]+$/i.test(s) && s.includes(':') && s.length <= 45) ? s : null; };

/** Torzs (tiszta). Dob, ha a nem-azonosito mezokben erzekeny adat lenne. IP: Feri dontese 2026-10-19 (max. adat, egeszsegugyi adat nelkul). */
export function arnyekTorzs(sor, ua, ip = null, ext = null) {
  const user = { client_user_agent: String(ua).slice(0, 400) };
  if (ipJo(ip)) user.client_ip_address = ipJo(ip);
  if (extJo(ext)) user.external_id = extJo(ext); // a veletlen latogato-azonosito SHA-256-ja
  if (sor.meta_fbc) user.fbc = String(sor.meta_fbc);
  if (sor.meta_fbp) user.fbp = String(sor.meta_fbp);
  const e = { event_name: ARNYEK_ESEMENY, event_time: Number(sor.letrehozva), event_id: esemenyId(sor.kulcs), action_source: 'website', event_source_url: SALONIC_FORRAS_URL };
  const ertek = Number(sor.ertek);
  if (sor.ertek != null && Number.isFinite(ertek) && ertek > 0) e.custom_data = { currency: 'HUF', value: Math.round(ertek) };
  if (vanErzekeny({ data: [e] })) throw new Error('mp_meta_erzekeny_adat');
  return { data: [{ ...e, user_data: user }] };
}

/** Az uj foglalas arnyek-lepese. Soha nem dob; kulcsonkent egyszer. A user agent / IP nem kerul a naplóba. */
export async function metaArnyekLepes(db, sor, ua, env = {}, host = '', { fetchImpl = fetch, most = Math.floor(Date.now() / 1000), ip = null, ext = null } = {}) {
  try {
    const j = arnyekJogosult(sor, ua, ip, ext);
    if (!j.ok && (j.miert === 'nincs_sor' || j.miert === 'nem_eles' || !sor.kulcs)) return { kihagyva: j.miert };
    await db.prepare(ARNYEK_SEMA).run();
    const mod = arnyekHatalyos(await arnyekMod(db), env, host);
    const kihagy = async (ok) => {
      if (!NAPLOZATLAN_KIHAGYAS.includes(ok)) {
        try {
          await db.prepare(`INSERT INTO mp_meta_arnyek (kulcs, mod, allapot, van_fbc, van_fbp, valasz, ido) VALUES (?,?,?,?,?,NULL,?)
            ON CONFLICT (kulcs) DO UPDATE SET mod = excluded.mod, allapot = excluded.allapot, van_fbc = excluded.van_fbc, van_fbp = excluded.van_fbp, valasz = NULL, ido = excluded.ido
            WHERE mp_meta_arnyek.allapot LIKE 'kihagyva:%'`).bind(sor.kulcs, mod, kihagyvaAllapot(ok), sor.meta_fbc ? 1 : 0, sor.meta_fbp ? 1 : 0, most).run();
        } catch (e) { /* a naplo nem allithatja meg */ }
      }
      return { kihagyva: ok };
    };
    if (mod === 'ki') return { kihagyva: 'ki' };
    const van = await db.prepare('SELECT allapot FROM mp_meta_arnyek WHERE kulcs = ?').bind(sor.kulcs).first();
    if (van && !kihagyottE(van.allapot)) return { kihagyva: 'mar_rogzitve' };
    if (!j.ok) return kihagy(j.miert);
    let torzs;
    try { torzs = arnyekTorzs(sor, ua, ip, ext); } catch (e) { return kihagy('erzekeny_adat'); }
    let allapot = 'naplozva';
    let valasz = null;
    if (mod === 'eles') {
      const nyersek = [sor.meta_fbc, sor.meta_fbp, env.META_CAPI_TOKEN, ua, ip, ext].filter(Boolean);
      try {
        const r = await fetchImpl(`${ARNYEK_VEGPONT()}?access_token=${encodeURIComponent(env.META_CAPI_TOKEN)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(torzs) });
        const sz = await r.text();
        let jj = null; try { jj = JSON.parse(sz); } catch (e) { /* nem JSON */ }
        allapot = r.ok && jj && Number(jj.events_received) === 1 ? 'elkuldve' : 'hiba';
        valasz = kitakar(sz, nyersek).slice(0, 400);
      } catch (e) { allapot = 'hiba'; valasz = kitakar(String(e && e.message || e), nyersek).slice(0, 200); }
    }
    // a korabbi kihagyva-sort a sikeres (vagy naplozott) kuldes felulirja; mas allapotu sor nem irodik felul
    await db.prepare(`INSERT INTO mp_meta_arnyek (kulcs, mod, allapot, van_fbc, van_fbp, valasz, ido) VALUES (?,?,?,?,?,?,?)
      ON CONFLICT (kulcs) DO UPDATE SET mod = excluded.mod, allapot = excluded.allapot, van_fbc = excluded.van_fbc, van_fbp = excluded.van_fbp, valasz = excluded.valasz, ido = excluded.ido
      WHERE mp_meta_arnyek.allapot LIKE 'kihagyva:%'`)
      .bind(sor.kulcs, mod, allapot, sor.meta_fbc ? 1 : 0, sor.meta_fbp ? 1 : 0, valasz, most).run();
    return { allapot, mod };
  } catch (e) {
    console.error('mp-meres: meta arnyek hiba', String(e && e.message || e).slice(0, 200));
    return { kihagyva: 'hiba' };
  }
}
