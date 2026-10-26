// MOSAIC - ERINTESNAPLO (#495, UJ-80; Feri 2026-10-26 17:14 + 20:51): konverzios UTVONAL es SEGITETT konverzio hirdetesenkent, mind az 5 uzletagra.
// Miert: az mh_lpt suti (#436, forras-lpt.js) minden uj fizetett kattintasnal FELULIRJA az elozot, igy foglalaskor csak az utolso erintes ismert; a segito hirdetesek elvesznek.
// Mit ad: (1) anonim latogato-azonosito: SZERVER ALTAL IRT, HttpOnly, sajat domaines suti (mh_vid, 30 nap, gordulo, Secure; SameSite=Lax) - UGYANAZ a hozzajarulas-dontes, mint az mh_lpt-nel;
//   (2) D1 meres_erintes: minden FIZETETT erkezes egy sor (vid_hash, ido, platform, tisztitott UTM, kampany / hirdetescsoport / hirdetes azonosito, a kattintasi parameter TIPUSA, landing utvonal);
//   (3) D1 meres_utvonal: minden igazolt konverziohoz (meres_kuldes "alap" sor) a vid elozo 30 napjanak erintesei idorendben (pillanatkep, vid nelkul); (4) havi riport (utolso / segitett / elso / linearis).
// ADATVEDELEM: a nyers vid CSAK a sutiben van; a D1-be vid_hash = HMAC-SHA256(titkos kulcs, "vid|" + vid) kerul (a kulcs: env.MERES_VID_KULCS, Cloudflare Pages Secret, nincs a repoban). Nyers kattintasazonosito
//   SEHOL nincs a D1-ben (csak a TIPUSA es egy HMAC-hash a 30 perces deduplikaciohoz). Vendegadat nincs. A meres_erintes 90 nap utan torlodik; a meres_utvonal nem tartalmaz vid-et.
// KAPCSOLO: MERES_VID_BE = "1" (alapbol KI). FAIL-CLOSED: kulcs nelkul (vagy tul rovid kulccsal) se suti, se sor. Az mh_lpt mukodese NEM valtozik.
// A modul nem importalja a forras-lpt.js-t (koruli import elkerulese): a hivo adja a tisztitott erintest es a forras-cimkét (cimkez eredmenye).

export const VID_SUTI = 'mh_vid';
export const VID_NAP = 30;
export const MEGORZES_NAP = 90; // a meres_erintes megorzese
export const UTVONAL_ABLAK_NAP = 30; // az utvonalba kerulo erintesek kora a konverziohoz kepest
export const DEDUP_MP = 30 * 60; // ugyanaz a kattintas / hirdetes ennyi idon belul egy sor
export const ORGANIKUS_MP = 24 * 3600; // az organikus / direkt visszateres: legfeljebb napi 1 konnyu sor
export const HETNAPOS_MP = 7 * 86400;
export const MAX_ERINTES_AZ_UTVONALBAN = 100;
export const IRAS_PLAFON = { ablak_mp: 600, max: 3000 }; // visszaeles-vedelem: 10 percenkent legfeljebb ennyi uj sor az egesz tablaban (a valos forgalom nagysagrendekkel kisebb)
const VID_MINTA = /^[A-Za-z0-9_-]{22}$/;
const KULCS_MIN_HOSSZ = 16;
const PLATFORMOK = Object.freeze(['meta', 'google_markas', 'google_nem_markas', 'tiktok', 'ismeretlen', 'organikus_direkt']);
const KATT_TIPUSOK = Object.freeze(['gclid', 'gbraid', 'wbraid', 'fbclid', 'ttclid']);
const KONV_TIPUSOK = Object.freeze(['FoglalasElso', 'Konzultacio', 'Visszajaro', 'Ajandekkartya']);
const UZLETAGOK = Object.freeze(['headspa', 'fodrasz', 'oxigen', 'szor', 'pmu']);

// ---------- kapcsolo, kulcs ----------
/** A funkcio bekapcsolva-e (MERES_VID_BE = "1"); alapbol KI. */
export const vidBe = (env) => !!env && String(env.MERES_VID_BE) === '1';
/** A HMAC-kulcs (Pages Secret) vagy null (hianyzik / tul rovid): ilyenkor a funkcio FAIL-CLOSED. */
export const vidKulcs = (env) => { const k = env && env.MERES_VID_KULCS; return typeof k === 'string' && k.length >= KULCS_MIN_HOSSZ ? k : null; };
/** A funkcio MEHET-e (be van kapcsolva ES van kulcs). */
export const vidMukodik = (env) => vidBe(env) && !!vidKulcs(env);

// ---------- vid, suti ----------
const b64url = (bajtok) => { let s = ''; for (const b of bajtok) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const hex = (bajtok) => Array.from(bajtok, (b) => b.toString(16).padStart(2, '0')).join('');
/** Uj, veletlen vid: 16 bajt, base64url (22 karakter). */
export function vidUj(veletlen = (n) => crypto.getRandomValues(new Uint8Array(n))) { return b64url(veletlen(16)); }
export const vidErvenyes = (v) => typeof v === 'string' && VID_MINTA.test(v);
/** A Cookie fejlecbol az mh_vid ertek (csak ervenyes alak) vagy null. */
export function vidOlvas(cookieFejlec) {
  for (const p of String(cookieFejlec || '').split(';')) {
    const i = p.indexOf('='); if (i < 0) continue;
    if (p.slice(0, i).trim() !== VID_SUTI) continue;
    const v = p.slice(i + 1).trim();
    return vidErvenyes(v) ? v : null; // az elso elofordulas dont
  }
  return null;
}
/** A Cookie fejlecben van-e mh_vid nev (ervenyes alak nelkul is: torleshez). */
export const vidSutiVan = (cookieFejlec) => String(cookieFejlec || '').split(';').some((p) => p.slice(0, Math.max(0, p.indexOf('='))).trim() === VID_SUTI);
/** A Set-Cookie fejlec: HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=30 nap (gordulo: minden fizetett / organikus erkezeskor ujra irva); torol = true: Max-Age=0. */
export const vidSuti = (vid, torol = false) => `${VID_SUTI}=${torol ? '' : vid}; Max-Age=${torol ? 0 : VID_NAP * 86400}; Path=/; HttpOnly; Secure; SameSite=Lax`;

// ---------- HMAC ----------
/** HMAC-SHA256 (hex) a tarolt azonositokhoz: ures / hianyzo kulcs hiba. A tartomany-elvalasztas (domain) kulonbozteti meg a vid / klikk hash-eket. */
export async function hmacHex(kulcs, tartomany, szoveg) {
  if (typeof kulcs !== 'string' || kulcs.length < KULCS_MIN_HOSSZ) throw new Error('hianyzo vid-kulcs');
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey('raw', enc.encode(kulcs), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(`${tartomany}|${szoveg}`))));
}
export const vidHash = (kulcs, vid) => hmacHex(kulcs, 'vid', vid);
export const klikkHash = (kulcs, tipus, ertek) => hmacHex(kulcs, 'klikk', `${tipus}|${ertek}`);

// ---------- erintes-sor (tiszta) ----------
const LAP_KARAKTER = /[^a-z0-9/_.-]+/g;
/** A landing utvonal tisztitasa: csak az utvonal (kisbetus, query / hash nelkul), engedett karakterek, legfeljebb 120; ervenytelen: null. */
export function lapTisztit(lap) {
  if (typeof lap !== 'string') return null;
  let p = lap.trim();
  if (!p) return null;
  try { p = new URL(p, 'https://www.mosaicheadspa.hu').pathname; } catch (e) { return null; }
  p = p.toLowerCase().replace(LAP_KARAKTER, '_').replace(/\/+$/, '').slice(0, 120);
  return p || '/';
}
const UZLETAG_LAP = Object.freeze([
  ['oxigen', /oxigen|hajkamera|hajapolas/], ['szor', /szortelenit|lezer|elysion/], ['pmu', /pmu|sminktetovalas|szemoldok|szajtetovalas|eltavolitas|korrekcio|szempilla/],
  ['fodrasz', /fodrasz|hajfestes|balayage|hajvagas|hajsimitas|frizura/], ['headspa', /headspa|head-spa|ajikartya|ajandek|masszazs/],
]);
/** Az uzletag BECSLESE a landing utvonalbol (tajekoztato; a konverzio uzletaga pontos, a meres_utvonal-ban). Ismeretlen: null. */
export function uzletagBecsles(lap) {
  const p = lapTisztit(lap); if (!p) return null;
  for (const [u, re] of UZLETAG_LAP) if (re.test(p)) return u;
  return null;
}
const szoveg = (v) => (v == null || v === '' ? null : String(v));

/**
 * Egy erintes-sor (a D1 oszlopai) - tiszta fuggveny, hash-eket a hivo szamolja. e: a forras-lpt.js erintesTisztit eredmenye (kv-vel is lehet: azt NEM tarolja), cimke: a cimkez forras_cimke-je,
 * vidHashErtek / klikkHashErtek: hex (klikk: ures, ha nincs nyers azonosito). -> sor | null (nem naplozando: nem fizetett es nem organikus; ismeretlen platform).
 */
export function erintesSor({ e, cimke, vidHashErtek, klikkHashErtek = null, lap = null, most }) {
  if (!e || !vidHashErtek || !PLATFORMOK.includes(cimke)) return null;
  const kp = KATT_TIPUSOK.includes(e.kp) ? e.kp : null;
  const organikus = cimke === 'organikus_direkt';
  const fiz = organikus ? 0 : 1;
  if (!organikus && cimke === 'ismeretlen' && !kp && !e.um) return null; // nincs fizetett jel: nem naplozunk
  const dedup = organikus ? 'organikus_direkt'
    : klikkHashErtek ? `${cimke}|k:${klikkHashErtek}`
    : (e.gc || e.ag || e.ad) ? `${cimke}|a:${e.gc || ''}|${e.ag || ''}|${e.ad || ''}`
    : `${cimke}|u:${e.uc || ''}|${e.uco || ''}`;
  return {
    vid_hash: vidHashErtek, ido: most, platform: cimke, fizetett: fiz, uzletag_becsles: uzletagBecsles(lap),
    utm_source: szoveg(e.us), utm_medium: szoveg(e.um), utm_campaign: szoveg(e.uc), utm_content: szoveg(e.uco), utm_term: szoveg(e.ut),
    gad_campaignid: szoveg(e.gc), adgroupid: szoveg(e.ag), adid: szoveg(e.ad), kattintas_param: kp, katt_hash: klikkHashErtek || null,
    lap: lapTisztit(lap), dedup_kulcs: dedup, dedup_mp: organikus ? ORGANIKUS_MP : DEDUP_MP,
  };
}

// ---------- D1 ----------
const SEMA = [
  `CREATE TABLE IF NOT EXISTS meres_erintes (id INTEGER PRIMARY KEY AUTOINCREMENT, vid_hash TEXT NOT NULL, ido INTEGER NOT NULL, platform TEXT NOT NULL, fizetett INTEGER NOT NULL, uzletag_becsles TEXT,
    utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, utm_content TEXT, utm_term TEXT, gad_campaignid TEXT, adgroupid TEXT, adid TEXT, kattintas_param TEXT, katt_hash TEXT, lap TEXT, dedup_kulcs TEXT NOT NULL)`,
  'CREATE INDEX IF NOT EXISTS meres_erintes_vid ON meres_erintes (vid_hash, ido)',
  'CREATE INDEX IF NOT EXISTS meres_erintes_ido ON meres_erintes (ido)',
  'CREATE TABLE IF NOT EXISTS meres_vid_erkezes (source_id TEXT PRIMARY KEY, vid_hash TEXT NOT NULL, ido INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS meres_vid_erkezes_ido ON meres_vid_erkezes (ido)',
  `CREATE TABLE IF NOT EXISTS meres_utvonal (source_id TEXT PRIMARY KEY, uzletag TEXT NOT NULL, konverzio_tipus TEXT NOT NULL, konverzio_ido INTEGER NOT NULL, erintesek TEXT NOT NULL, erintes_db INTEGER NOT NULL,
    fizetett_db INTEGER NOT NULL, elso_fizetett_ido INTEGER, utolso_fizetett_ido INTEGER, elso_platform TEXT, utolso_platform TEXT, napok_az_elso_ota INTEGER, het_napos INTEGER NOT NULL DEFAULT 0, ido INTEGER NOT NULL)`,
  'CREATE INDEX IF NOT EXISTS meres_utvonal_ido ON meres_utvonal (konverzio_ido)',
];
const kesz = new WeakSet();
export async function erintesSema(db) {
  if (kesz.has(db)) return;
  await db.batch(SEMA.map((s) => db.prepare(s)));
  kesz.add(db);
}
const OSZLOPOK = ['vid_hash', 'ido', 'platform', 'fizetett', 'uzletag_becsles', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gad_campaignid', 'adgroupid', 'adid', 'kattintas_param', 'katt_hash', 'lap', 'dedup_kulcs'];

/**
 * Az erintes-sor mentese: ugyanaz a (vid_hash, dedup_kulcs) a dedup_mp-n (fizetett: 30 perc, organikus: 24 ora) belul NEM ir uj sort. A 90 napnal regebbi sorok torlodnek.
 * -> { irva: true } | { irva: false, miert: 'dedup' | 'plafon' }
 */
export async function erintesIr(db, sor, { most = sor.ido } = {}) {
  await erintesSema(db);
  await db.prepare('DELETE FROM meres_erintes WHERE ido < ?1').bind(most - MEGORZES_NAP * 86400).run();
  const van = await db.prepare('SELECT 1 AS x FROM meres_erintes WHERE vid_hash = ?1 AND dedup_kulcs = ?2 AND ido > ?3 LIMIT 1').bind(sor.vid_hash, sor.dedup_kulcs, sor.ido - sor.dedup_mp).first();
  if (van) return { irva: false, miert: 'dedup' };
  const mennyi = await db.prepare('SELECT COUNT(*) AS n FROM meres_erintes WHERE ido > ?1').bind(sor.ido - IRAS_PLAFON.ablak_mp).first();
  if (mennyi && Number(mennyi.n) >= IRAS_PLAFON.max) return { irva: false, miert: 'plafon' };
  await db.prepare(`INSERT INTO meres_erintes (${OSZLOPOK.join(', ')}) VALUES (${OSZLOPOK.map((_, i) => '?' + (i + 1)).join(', ')})`).bind(...OSZLOPOK.map((k) => (sor[k] === undefined ? null : sor[k]))).run();
  return { irva: true };
}

/** A koszonooldali jelzeskor (meres-erkezes) a source_id -> vid_hash megfeleltetes rogzitese (az utvonal-zarashoz). Az elso iras nyer. */
export async function vidErkezesIr(db, { source_id, vid_hash, most }) {
  await erintesSema(db);
  await db.prepare('DELETE FROM meres_vid_erkezes WHERE ido < ?1').bind(most - MEGORZES_NAP * 86400).run();
  await db.prepare('INSERT INTO meres_vid_erkezes (source_id, vid_hash, ido) VALUES (?1, ?2, ?3) ON CONFLICT(source_id) DO NOTHING').bind(source_id, vid_hash, most).run();
}

// ---------- az utvonal zarasa ----------
const NEM_KONVERZIO_INDOK = "reschedule_confirmed%"; // az athelyezes nem uj konverzio (#417): a regi foglalas kulcsa mar megkapta az utvonalat
/** Az erintes JSON-alakja az utvonalban (vid nelkul): t (ido), p (platform), c (kampany), a (hirdetes), kp (kattintasi tipus), u (uzletag-becsles), l (landing utvonal). */
const utvonalErintes = (r) => {
  const o = { t: r.ido, p: r.platform };
  const c = r.utm_campaign || r.gad_campaignid; if (c) o.c = c;
  const a = r.adid || r.utm_content; if (a) o.a = a;
  if (r.kattintas_param) o.kp = r.kattintas_param;
  if (r.uzletag_becsles) o.u = r.uzletag_becsles;
  if (r.lap) o.l = r.lap;
  return o;
};
/**
 * A fuggo utvonalak zarasa (idempotens): minden source_id, amelyhez van vid-megfeleltetes (meres_vid_erkezes) ES igazolt konverzio (meres_kuldes "alap" sor: FoglalasElso / Konzultacio / Visszajaro / Ajandekkartya;
 * a motor-, az sd- es az athelyezett foglalas egyseges kulccsal), es meg nincs meres_utvonal sora. Pillanatkep: a vid erintesei a konverzio elotti 30 napbol (<= a konverzio ideje). A kuponos foglalas nem konverzio
 * (DECISION #194): nincs "alap" sora, tehat nincs utvonala sem. -> { zarva, hibak }
 */
export async function utvonalLezar(db, { most = Math.floor(Date.now() / 1000), limit = 200 } = {}) {
  await erintesSema(db);
  const { results } = await db.prepare(`SELECT v.source_id AS source_id, v.vid_hash AS vid_hash, k.uzletag AS uzletag, k.esemeny_nev AS nev, MIN(k.letrehozva) AS t
    FROM meres_vid_erkezes v JOIN meres_kuldes k ON k.source_id = v.source_id AND k.esemeny_tipus = 'alap'
    WHERE NOT EXISTS (SELECT 1 FROM meres_utvonal u WHERE u.source_id = v.source_id) AND NOT (k.allapot = 'kihagyva' AND k.indok LIKE '${NEM_KONVERZIO_INDOK}')
    GROUP BY v.source_id, v.vid_hash, k.uzletag, k.esemeny_nev ORDER BY t LIMIT ?1`).bind(limit).all();
  let zarva = 0; const hibak = [];
  const mar = new Set();
  for (const f of results || []) {
    if (mar.has(f.source_id)) continue; mar.add(f.source_id); // egy source_id-hoz egy utvonal (tobb alap-nev eseten az elso)
    try {
      if (!KONV_TIPUSOK.includes(f.nev) || !UZLETAGOK.includes(f.uzletag)) continue;
      const { results: er } = await db.prepare('SELECT ido, platform, fizetett, uzletag_becsles, utm_campaign, utm_content, gad_campaignid, adid, kattintas_param, lap FROM meres_erintes WHERE vid_hash = ?1 AND ido <= ?2 AND ido >= ?3 ORDER BY ido, id LIMIT ?4')
        .bind(f.vid_hash, f.t, f.t - UTVONAL_ABLAK_NAP * 86400, MAX_ERINTES_AZ_UTVONALBAN).all();
      const sorok = er || [];
      const fiz = sorok.filter((r) => Number(r.fizetett) === 1);
      const elso = fiz[0], utolso = fiz[fiz.length - 1];
      await db.prepare(`INSERT OR IGNORE INTO meres_utvonal (source_id, uzletag, konverzio_tipus, konverzio_ido, erintesek, erintes_db, fizetett_db, elso_fizetett_ido, utolso_fizetett_ido, elso_platform, utolso_platform, napok_az_elso_ota, het_napos, ido)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`)
        .bind(f.source_id, f.uzletag, f.nev, f.t, JSON.stringify(sorok.map(utvonalErintes)), sorok.length, fiz.length, elso ? elso.ido : null, utolso ? utolso.ido : null, elso ? elso.platform : null, utolso ? utolso.platform : null,
          sorok.length ? Math.floor((f.t - sorok[0].ido) / 86400) : null, utolso && f.t - utolso.ido <= HETNAPOS_MP ? 1 : 0, most).run();
      zarva++;
    } catch (e) { hibak.push(String(e && e.message || e).slice(0, 120)); }
  }
  return { zarva, hibak };
}

// ---------- riport (tiszta szamitas) ----------
/** A hirdetes-kulcs egy erintesbol: platform | kampany | hirdetes ("-" ha nincs). */
export const hirdetesKulcs = (e) => `${e.p}|${e.c || '-'}|${e.a || '-'}`;
export const kampanyKulcs = (e) => `${e.p}|${e.c || '-'}`;
/**
 * Egy konverzio (utvonal-sor) kreditjei: utolso kattintas (az utvonal utolso FIZETETT erintese), elso erintes (az elso fizetett), segitett (minden mas fizetett erintes kulcsa, kulcsonkent legfeljebb 1,
 * az utolso kattintas kulcsa nem), linearis (1 konverzio egyenlo reszekre a fizetett erintesek kozott). Organikus / direkt sor kreditet NEM kap. fizetett erintes nelkul: nincs kredit.
 * kulcsFv: hirdetesKulcs | kampanyKulcs. -> { utolso: kulcs|null, elso: kulcs|null, segitett: [kulcs], linearis: { kulcs: tort } }
 */
export function kreditek(erintesek, kulcsFv = hirdetesKulcs) {
  const fiz = (erintesek || []).filter((e) => e && e.p && e.p !== 'organikus_direkt');
  if (!fiz.length) return { utolso: null, elso: null, segitett: [], linearis: {} };
  const utolso = kulcsFv(fiz[fiz.length - 1]), elso = kulcsFv(fiz[0]);
  const segitett = [...new Set(fiz.map(kulcsFv))].filter((k) => k !== utolso);
  const linearis = {}; for (const e of fiz) { const k = kulcsFv(e); linearis[k] = (linearis[k] || 0) + 1 / fiz.length; }
  return { utolso, elso, segitett, linearis };
}
const kerekit = (x) => Math.round(x * 1000) / 1000;
const NAP_VEDEK = Object.freeze([['0', 0, 0], ['1', 1, 1], ['2-3', 2, 3], ['4-7', 4, 7], ['8-14', 8, 14], ['15-30', 15, 30]]);
/**
 * A havi riport az utvonal-sorokbol. sorok: meres_utvonal sorok { uzletag, konverzio_tipus, konverzio_ido, erintesek (JSON szoveg), napok_az_elso_ota, ... }.
 * -> { konverziok, hirdetes: [{ uzletag, konverzio_tipus, kulcs: 'platform|kampany|hirdetes', utolso, segitett, elso, linearis }], kampany: [...], utvonalak: [{ utvonal, db }] (top 20, platform+kampany szint),
 *      napok: { '<uzletag>': { '0': db, '1': db, ... } } }
 */
export function riportEpit(sorok, { top = 20 } = {}) {
  const hird = new Map(), kamp = new Map(), utak = new Map(), napok = {};
  const noveles = (m, uz, tipus, kulcs, mezo, ertek) => { const kk = `${uz}|${tipus}|${kulcs}`; const o = m.get(kk) || { uzletag: uz, konverzio_tipus: tipus, kulcs, utolso: 0, segitett: 0, elso: 0, linearis: 0 }; o[mezo] += ertek; m.set(kk, o); };
  let n = 0;
  for (const s of sorok || []) {
    let er; try { er = JSON.parse(s.erintesek); } catch (e) { er = []; }
    if (!Array.isArray(er)) er = [];
    n++;
    for (const [m, fv] of [[hird, hirdetesKulcs], [kamp, kampanyKulcs]]) {
      const k = kreditek(er, fv);
      if (k.utolso) noveles(m, s.uzletag, s.konverzio_tipus, k.utolso, 'utolso', 1);
      if (k.elso) noveles(m, s.uzletag, s.konverzio_tipus, k.elso, 'elso', 1);
      for (const x of k.segitett) noveles(m, s.uzletag, s.konverzio_tipus, x, 'segitett', 1);
      for (const [x, v] of Object.entries(k.linearis)) noveles(m, s.uzletag, s.konverzio_tipus, x, 'linearis', v);
    }
    // gyakori utvonal: egymas melletti azonos platform+kampany osszevonva; organikus / direkt is latszik
    const lanc = []; for (const e of er) { const l = e.p === 'organikus_direkt' ? 'organikus_direkt' : kampanyKulcs(e); if (lanc[lanc.length - 1] !== l) lanc.push(l); }
    const ut = (lanc.length ? lanc.join(' > ') : '(nincs erintes)') + ' > konverzio'; utak.set(ut, (utak.get(ut) || 0) + 1);
    if (s.napok_az_elso_ota != null) { const d = Number(s.napok_az_elso_ota); const v = NAP_VEDEK.find(([, a, b]) => d >= a && d <= b) || ['30+']; const o = napok[s.uzletag] || (napok[s.uzletag] = {}); o[v[0]] = (o[v[0]] || 0) + 1; }
  }
  const lista = (m) => [...m.values()].map((o) => ({ ...o, linearis: kerekit(o.linearis) })).sort((a, b) => b.utolso + b.segitett - (a.utolso + a.segitett) || a.kulcs.localeCompare(b.kulcs));
  return { konverziok: n, hirdetes: lista(hird), kampany: lista(kamp), utvonalak: [...utak].map(([utvonal, db]) => ({ utvonal, db })).sort((a, b) => b.db - a.db || a.utvonal.localeCompare(b.utvonal)).slice(0, top), napok };
}

// ---------- Europe/Budapest naptari honap ----------
const budapestResz = (ms) => { const o = {}; for (const p of new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Budapest', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(ms))) o[p.type] = Number(p.value); return o; };
/** Az (ev, ho 1-12) Budapest szerinti elso napjanak 00:00-ja unix masodpercben. */
function budapestHonapKezdet(ev, ho) {
  for (const oraEltolas of [1, 2]) { // CET = UTC+1, CEST = UTC+2: az, amelyik helyi 00:00:00-t ad
    const ms = Date.UTC(ev, ho - 1, 1, 0 - oraEltolas, 0, 0);
    const r = budapestResz(ms);
    if (r.year === ev && r.month === ho && r.day === 1 && r.hour === 0 && r.minute === 0) return ms / 1000;
  }
  return Date.UTC(ev, ho - 1, 1) / 1000;
}
/** 'EEEE-HH' (pl. '2026-10') -> { tol, ig, honap } (a konverzio idopontja szerint: [tol, ig) unix mp, Europe/Budapest); ervenytelen: null. */
export function honapHatar(honap) {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(honap || '')); if (!m) return null;
  const ev = Number(m[1]), ho = Number(m[2]);
  return { honap: `${m[1]}-${m[2]}`, tol: budapestHonapKezdet(ev, ho), ig: budapestHonapKezdet(ho === 12 ? ev + 1 : ev, ho === 12 ? 1 : ho + 1) };
}
export const aktualisHonap = (ms = Date.now()) => { const r = budapestResz(ms); return `${r.year}-${String(r.month).padStart(2, '0')}`; };

/** A havi riport adatai a D1-bol (az utvonalak elobb lezarodnak). */
export async function riportOlvas(db, { honap, most = Math.floor(Date.now() / 1000) } = {}) {
  const h = honapHatar(honap || aktualisHonap(most * 1000)); if (!h) return { ok: false, miert: 'ervenytelen honap (EEEE-HH)' };
  const lezaras = await utvonalLezar(db, { most });
  const { results } = await db.prepare('SELECT uzletag, konverzio_tipus, konverzio_ido, erintesek, napok_az_elso_ota, het_napos FROM meres_utvonal WHERE konverzio_ido >= ?1 AND konverzio_ido < ?2 ORDER BY konverzio_ido').bind(h.tol, h.ig).all();
  const sorok = results || [];
  return { ok: true, honap: h.honap, idozona: 'Europe/Budapest', lezaras: { zarva: lezaras.zarva, hiba: lezaras.hibak.length }, het_napos: sorok.filter((s) => Number(s.het_napos) === 1).length, ...riportEpit(sorok) };
}
