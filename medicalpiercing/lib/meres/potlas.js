// DECISION #253 / #256 (01-MERES 6505041150): EGYSZERI, kulcs-listas potlas a NORMAL lancba azokra az igazolatlanul maradt foglalasokra, amelyek Salonic-levele a Zapier compute-limit kiesese miatt
// keson ert be (a sor mar 'nem_igazolt', ezert az igazolasErkezes (lanc.js) nem keresi): igazoltra allitja a sort (a lanc.js igazoltJeloles ket UPDATE-jevel azonosan), majd a MEGLEVO ARNYEK-feltoltest futtatja
// (lanc.js feltoltes -> google-ads.js akciokFoglalashoz: 7834926162 Foglalas + 7834926165/…68 uj/visszatero). AZ ELO "All - Idopontfoglalas" (7468541217) AKCIORA NEM TOLT: a bongeszos All-cimke nem visz orderId-t,
// ezert egy szerveres feltoltes nem dedupolna (6504086965). KULON MODUL, a vedett lanc.js / igazolas.js / google-ads.js valtozatlan (csak a mar exportalt fuggvenyeket hivja).
// POST /api/mp-potlas, fejlec x-mp-kiigazitas (ugyanaz a titok, mint a mp-kiigazitas). Torzs: { kulcsok: [max 3 foglalasi kulcs], mod: "dry" (alap) | "eles" }.
//   - dry : SEMMIT nem ir az mp_foglalas / mp_salonic_igazolas tablakba; a normal lanc ellenorzo (validate / dryrun) modjat futtatja (MP_GADS_MOD felulirva: sosem eles), naplo: mp_feltoltes (mod validate / dryrun).
//   - eles: csak ha elesKuldesE (MP_GADS_MOD=eles + eles host) ES van szallito (kozvetlen API vagy Zapier-webhook) ES nincs vesz-kikapcsolo: igazoltra allitja a sort, es eles ARNYEK-feltoltest kuld (az mar elkuldott akciot nem kuldi ujra).
// Soronkent: eles kornyezet, nem divat-ful, van Google-kattintas, hirdetesi hozzajarulas, PONTOSAN EGY hozzarendeletlen Salonic-level (kezdes +0..59 s, munkatars egyezik). A 14 napos kattintas-kaput (DECISION #245) a
// konverzio() maga alkalmazza (kihagyva). A valasz kattintasazonositot / vendegadatot / nyers Google-valaszt NEM tartalmaz.
import { kikapcsolvaE, elesKuldesE, szallitoValaszt, ELES_HOST } from './google-ads.js';
import { semaBiztos, feltoltes } from './lanc.js';

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

/** Egy kulcs vizsgalata (csak olvasas). -> { ok: true, sor, level } | { ok: false, ok_kod } */
export async function ellenorzes(db, kulcs) {
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
  return { ok: true, sor, level: jo[0] };
}

const tisztaNaplo = (naplo) => (naplo || []).map((n) => ({ akcio: n.akcioId, allapot: n.allapot, mod: n.mod, http_status: n.http_status ?? null }));

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
  if (!szallitoValaszt(env)) return json({ ok: false, hiba: 'nincs_szallito' }, 409);
  const eles = kert === 'eles';
  if (eles && !elesKuldesE(env, host)) return json({ ok: false, hiba: 'eles_nem_engedelyezett', megjegyzes: 'MP_GADS_MOD=eles es az eles host kell' }, 409);
  // dry: a normal lanc sosem kuldhet elesben (az MP_GADS_MOD felulirasa); eles: valtozatlan env
  const futtatoEnv = eles ? env : { ...env, MP_GADS_MOD: 'validate' };
  const eredmenyek = {};
  for (const kulcs of kulcsok) {
    const e = await ellenorzes(db, kulcs);
    if (!e.ok) { eredmenyek[kulcs] = { allapot: 'kihagyva', ok: e.ok_kod }; continue; }
    let sor = { ...e.sor };
    const mezok = { igazolas: 'igazolt', igazolas_id: e.level.booking_id, foglalas_ido: e.level.erkezett, uj_vendeg_igazolt: e.level.uj_paciens === 1 ? 1 : null };
    const jelolve = sor.igazolas !== 'igazolt';
    if (jelolve) {
      if (eles) { // mint lanc.js igazoltJeloles: a sor igazolt + a level hozzarendelese
        await db.batch([
          db.prepare('UPDATE mp_foglalas SET igazolas = ?, igazolas_id = ?, foglalas_ido = ?, uj_vendeg_igazolt = ? WHERE kulcs = ?').bind(mezok.igazolas, mezok.igazolas_id, mezok.foglalas_ido, mezok.uj_vendeg_igazolt, kulcs),
          db.prepare('UPDATE mp_salonic_igazolas SET kulcs = ? WHERE booking_id = ?').bind(kulcs, e.level.booking_id),
        ]);
      }
      sor = { ...sor, ...mezok }; // dry: csak a memoriaban
    }
    let naplo;
    try { naplo = await feltoltes(db, sor, futtatoEnv, host, { fetchImpl, most }); } catch (err) { eredmenyek[kulcs] = { allapot: 'hiba', ok: 'feltoltes_kivetel', igazolt_jelolve: eles && jelolve }; continue; }
    eredmenyek[kulcs] = { allapot: naplo.length ? 'feldolgozva' : 'nincs_uj_feltoltes', feltoltesek: tisztaNaplo(naplo), igazolt_jelolve: eles && jelolve };
  }
  return json({ ok: true, mod: kert, lanc: 'arnyek', eredmenyek });
}
