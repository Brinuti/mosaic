// DECISION #253 (Feri "mehet", 10-29; 01-MERES 6492062796 3. pont): EGYSZERI, kulcs-listas potlas az ELO "All - Idopontfoglalas" (7468541217) akcion azokra az igazolatlanul maradt
// foglalasokra, amelyek Salonic-levele a Zapier compute-limit kiesese miatt keson ert be (a sor mar 'nem_igazolt', ezert az igazolasErkezes (lanc.js) nem keresi). KULON MODUL: a vedett lanc.js / igazolas.js /
// google-ads.js valtozatlan; a google-elo.js-bol csak a meglevo oauth / konverzio-epito fuggvenyeket hasznalja. Ez NEM a sweep (eloPotlas) es nem kapcsolja be az UJ-63-at (MP_GADS_ELO ettol fuggetlen).
// POST /api/mp-potlas, fejlec x-mp-kiigazitas (ugyanaz a titok, mint a mp-kiigazitas). Torzs: { kulcsok: [max 3 foglalasi kulcs], mod: "dry" (alap, validateOnly) | "eles" }.
//   - dry : semmit nem ir az mp_foglalas / mp_salonic_igazolas tablakba; a Google csak ELLENORZI a feltoltest (validateOnly).
//   - eles: csak ha elesKuldesE (MP_GADS_MOD=eles + eles host) ES a kozvetlen Google API hitelesitese megvan ES nincs vesz-kikapcsolo: igazoltra allitja a sort (mint lanc.js igazoltJeloles) es valodi feltoltest kuld.
// Soronkent vedelmek: eles kornyezet, nem divat-ful, van Google-kattintas, hirdetesi hozzajarulas, a kattintas a Google ablakan belul, pontosan EGY Salonic-level (kezdes +0..59 s, munkatars egyezik, meg nincs hozzarendelve),
// meg nincs sikeres feltoltes az akcion (mp_feltoltes_elo). A valasz nem tartalmaz kattintasazonositot / vendegadatot.
import { MP_GADS, googleIdo, kitakar, maszk, elesKuldesE, kikapcsolvaE, ELES_HOST } from './google-ads.js';
import { ELO_AKCIO, eloKonverzio, eloAblakNap, valaszErtekel, accessToken, apiVan } from './google-elo.js';
import { semaBiztos } from './lanc.js';

const MAX_KULCS = 3;
const KULCS_RE = /^\d+\|\d+\|\d+$/;
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const sha256hex = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s))))].map((x) => x.toString(16).padStart(2, '0')).join('');
const egyenlo = (a, b) => {
  a = String(a || ''); b = String(b || '');
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0 && a.length > 0;
};
async function titok(db, env, kapott, eles) {
  if (env.MP_KIIGAZITAS_TITOK) return { van: true, jo: !!kapott && egyenlo(kapott, env.MP_KIIGAZITAS_TITOK) };
  if (!eles) return { van: false, jo: false };
  let h = null; try { const r = await db.prepare('SELECT ertek FROM mp_beallitas WHERE kulcs = ?').bind('kiigazitas_titok_sha256').first(); h = r ? r.ertek : null; } catch (e) { h = null; }
  if (!h) return { van: false, jo: false };
  return { van: true, jo: !!kapott && egyenlo(await sha256hex(kapott), h) };
}

const SEMA_ELO = `CREATE TABLE IF NOT EXISTS mp_feltoltes_elo (
    kulcs TEXT PRIMARY KEY, mod TEXT NOT NULL, allapot TEXT NOT NULL, http_status INTEGER, kod TEXT, kattintas_maszk TEXT, probalkozas INTEGER NOT NULL DEFAULT 0, ido INTEGER NOT NULL)`;

/** Egy kulcs vizsgalata (csak olvasas). -> { ok: true, sor, level } | { ok: false, ok_kod } */
export async function ellenorzes(db, kulcs, env, most) {
  const sor = await db.prepare('SELECT * FROM mp_foglalas WHERE kulcs = ?').bind(kulcs).first();
  if (!sor) return { ok: false, ok_kod: 'nincs_sor' };
  if (sor.kornyezet !== 'eles') return { ok: false, ok_kod: 'nem_eles' };
  if (String(sor.tipus || '') === 'ful') return { ok: false, ok_kod: 'divat_ful' };
  if (!sor.kattintas_ertek || !['gclid', 'gbraid', 'wbraid'].includes(sor.kattintas_tipus)) return { ok: false, ok_kod: 'nincs_google_kattintas' };
  if (Number(sor.hozzajarulas_hirdetes) !== 1) return { ok: false, ok_kod: 'nincs_hirdetesi_hozzajarulas' };
  if (!(sor.igazolas == null || sor.igazolas === 'nem_igazolt' || sor.igazolas === 'igazolt')) return { ok: false, ok_kod: 'ismeretlen_igazolas_allapot' };
  const [, emp, startS] = kulcs.split('|'); const start = Number(startS);
  const lev = (await db.prepare('SELECT * FROM mp_salonic_igazolas WHERE start_unix >= ?1 AND start_unix <= ?2 AND (kulcs IS NULL OR kulcs = ?3)').bind(start, start + 59, kulcs).all()).results || [];
  const jo = lev.filter((l) => { const ids = String(l.employee_ids || '').split(',').filter(Boolean); return !ids.length || ids.includes(emp); });
  if (jo.length === 0) return { ok: false, ok_kod: 'nincs_salonic_level' };
  if (jo.length > 1) return { ok: false, ok_kod: 'tobb_salonic_level' };
  const level = jo[0];
  const foglalasIdo = Number(sor.igazolas === 'igazolt' && sor.foglalas_ido ? sor.foglalas_ido : level.erkezett);
  const kattIdo = Number(sor.kattintas_ido);
  if (Number.isFinite(kattIdo) && kattIdo > 0 && foglalasIdo - kattIdo > eloAblakNap(env) * 86400) return { ok: false, ok_kod: 'kattintas_ablakon_kivul' };
  const volt = await db.prepare("SELECT allapot FROM mp_feltoltes_elo WHERE kulcs = ? AND allapot IN ('elkuldve', 'mar_bent')").bind(kulcs).first();
  if (volt) return { ok: false, ok_kod: 'mar_felt_oltve' };
  return { ok: true, sor, level, foglalasIdo };
}

async function feltoltEgy({ db, env, sor, foglalasIdo, eles, fetchImpl, most, token }) {
  const f = { kulcs: sor.kulcs, letrehozva: foglalasIdo, ertek: sor.ertek, kattintas: { tipus: sor.kattintas_tipus, ertek: sor.kattintas_ertek } };
  const k = eloKonverzio(f); if (!k) return { allapot: 'hiba', kod: 'nincs_konverzio' };
  let allapot = 'hiba', http = null, kod = null;
  try {
    const fejlec = { 'content-type': 'application/json', authorization: 'Bearer ' + token, 'developer-token': env.GOOGLE_ADS_DEVELOPER_TOKEN };
    if (env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) fejlec['login-customer-id'] = String(env.GOOGLE_ADS_LOGIN_CUSTOMER_ID).replace(/\D/g, '');
    const r = await fetchImpl(`https://googleads.googleapis.com/${env.MP_GADS_API_VERZIO || MP_GADS.apiVerzio}/customers/${MP_GADS.customerId}:uploadClickConversions`, { method: 'POST', headers: fejlec, body: JSON.stringify({ conversions: [k], partialFailure: true, validateOnly: !eles }) });
    http = r.status; const e = valaszErtekel(r.status, kitakar(await r.text(), [sor.kattintas_ertek]), { validate: !eles }); allapot = e.allapot; kod = e.kod;
  } catch (err) { kod = String(err && err.message || err).slice(0, 80); }
  await db.prepare(`INSERT INTO mp_feltoltes_elo (kulcs, mod, allapot, http_status, kod, kattintas_maszk, probalkozas, ido) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7)
    ON CONFLICT (kulcs) DO UPDATE SET mod = excluded.mod, allapot = excluded.allapot, http_status = excluded.http_status, kod = excluded.kod, kattintas_maszk = excluded.kattintas_maszk, probalkozas = mp_feltoltes_elo.probalkozas + 1, ido = excluded.ido`)
    .bind(sor.kulcs, eles ? 'eles' : 'dry', allapot, http, kod, await maszk(sor.kattintas_ertek), most).run();
  return { allapot, kod, http_status: http };
}

export async function potlasVegpont({ request, env = {} }, { fetchImpl = fetch, most = Math.floor(Date.now() / 1000) } = {}) {
  const db = env.MP_MERES_DB;
  const host = new URL(request.url).hostname;
  if (!db) return json({ ok: false }, 404);
  await semaBiztos(db);
  const t = await titok(db, env, request.headers.get('x-mp-kiigazitas'), host === ELES_HOST);
  if (!t.van) return json({ ok: false }, 404);
  if (!t.jo) return json({ ok: false }, 403);
  if (request.method !== 'POST') return json({ ok: false, hiba: 'csak_post' }, 405);
  let b; try { b = await request.json(); } catch (e) { return json({ ok: false, hiba: 'rossz_keres' }, 400); }
  const kulcsok = Array.isArray(b && b.kulcsok) ? [...new Set(b.kulcsok.map(String))] : [];
  if (!kulcsok.length || kulcsok.length > MAX_KULCS || kulcsok.some((k) => !KULCS_RE.test(k))) return json({ ok: false, hiba: 'rossz_kulcsok' }, 400);
  const kert = String(b.mod || 'dry').toLowerCase();
  if (kert !== 'dry' && kert !== 'eles') return json({ ok: false, hiba: 'rossz_mod' }, 400);
  if (kikapcsolvaE(env)) return json({ ok: false, hiba: 'vesz_kikapcsolva' }, 409);
  if (!apiVan(env)) return json({ ok: false, hiba: 'nincs_google_hitelesites' }, 409);
  const eles = kert === 'eles';
  if (eles && !elesKuldesE(env, host)) return json({ ok: false, hiba: 'eles_nem_engedelyezett', megjegyzes: 'MP_GADS_MOD=eles es az eles host kell' }, 409);
  await db.prepare(SEMA_ELO).run();
  const eredmenyek = {}; let token = null;
  for (const kulcs of kulcsok) {
    const e = await ellenorzes(db, kulcs, env, most);
    if (!e.ok) { eredmenyek[kulcs] = { allapot: 'kihagyva', ok: e.ok_kod }; continue; }
    try { token = token || await accessToken(env, fetchImpl); } catch (err) { eredmenyek[kulcs] = { allapot: 'hiba', kod: 'oauth' }; continue; }
    if (eles && e.sor.igazolas !== 'igazolt') { // mint lanc.js igazoltJeloles: a sor igazolt + a level hozzarendelese
      await db.batch([
        db.prepare('UPDATE mp_foglalas SET igazolas = ?, igazolas_id = ?, foglalas_ido = ?, uj_vendeg_igazolt = ? WHERE kulcs = ?').bind('igazolt', e.level.booking_id, e.level.erkezett, e.level.uj_paciens === 1 ? 1 : null, kulcs),
        db.prepare('UPDATE mp_salonic_igazolas SET kulcs = ? WHERE booking_id = ?').bind(kulcs, e.level.booking_id),
      ]);
    }
    const r = await feltoltEgy({ db, env, sor: e.sor, foglalasIdo: e.foglalasIdo, eles, fetchImpl, most, token });
    eredmenyek[kulcs] = { ...r, igazolt_jelolve: eles && e.sor.igazolas !== 'igazolt' };
  }
  return json({ ok: true, mod: kert, akcio: ELO_AKCIO, eredmenyek });
}
