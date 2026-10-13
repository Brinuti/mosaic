// NAPI T2 QA-VEGPONT (a meresi oldal SPEC-je, #167 131. komment, GPT atnezte): GET /api/meres-admin?qa=nap&datum=YYYY-MM-DD
// CSAK OLVAS, AGGREGALT, PII-MENTES. Az eles D1-et a meresi oldal nem olvashatja; ezzel a vegponttal a Zapier admin-draft naponta lekeri a T2-osszevetest (arnyek vs. valos).
// Nincs nev, e-mail, telefon, hash, teljes UUID; egyetlen kivetel a pre288 mintalista (legfeljebb 8 karakteres uuid-elotag). Nem ir semmit, nem hoz letre tablat.
import { ARNYEK, ELO_CELOK, PLATFORMOK } from './platformok.js';

export const QA_TIMEZONE = 'Europe/Budapest';
/** 2026-10-13 09:53:07 UTC: a #288 (sd kornyezeti kapu) eles merge-enek pillanata; ez elott letrehozott foglalasokhoz nem keszult foglalas_vendeg hash-index sor. */
export const PRE288_EPOCH = 1791885187;
export const UZLETAGAK = Object.freeze(['headspa', 'fodrasz', 'oxigen', 'szor', 'pmu']);
// Salonic place_id -> uzletag (assets/js/booking-engine/salonic-adapter.js SALONIC_ACCOUNTS: headspa 10427, hair 10823, oxygen 14409, laser 14586, pmu 14585). A foglalas_egyeztetes.kulcs = "placeId|employeeId|startUnix".
const PLACE_UZLETAG = Object.freeze({ 10427: 'headspa', 10823: 'fodrasz', 14409: 'oxigen', 14586: 'szor', 14585: 'pmu' });
const ALLAPOTOK = Object.freeze(['elkuldve', 'kihagyva', 'tiltva', 'hiba']);
const ELO_ID_LISTA = Object.freeze([...ELO_CELOK.meta, ...ELO_CELOK.tiktok, ...ELO_CELOK.ga4, ...ELO_CELOK.google_primary]);
const ELO_ID_MINTA = new RegExp(ELO_ID_LISTA.map((id) => `(?<![0-9A-Za-z])${id}(?![0-9A-Za-z])`).join('|'));
const LAMPA_RANG = Object.freeze({ zold: 0, sarga: 1, piros: 2 });
const KUSZOB = 0.9; // Meta / TikTok: az elkuldott alap-esemenyek szama < KUSZOB x valos.parositott -> sarga (a viszonyitasi alap a meresi oldal/GPT dontese, #167 134. komment: a parositatlan levelhez nem keszul arnyek-esemeny)
const MINTA_MAX = 20;
const KORLAT = { ablakMs: 60000, max: 30, hibaMax: 5, maxBejegyzes: 2000 };

// ---------- ido: a budapesti naptari nap es az UTC-intervalluma ----------
const RESZ = new Intl.DateTimeFormat('en-US', { timeZone: QA_TIMEZONE, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
function helyi(ms) { const r = {}; for (const p of RESZ.formatToParts(new Date(ms))) r[p.type] = p.value; return r; }
export const budapestiNap = (ms) => { const r = helyi(ms); return `${r.year}-${r.month}-${r.day}`; };
/** A budapesti naptari nap 00:00-janak pillanata (ms) - a nyari (UTC+2) es a teli (UTC+1) idoszamitast a Intl kezeli; az atallas 02:00-03:00 kozott van, az ejfel egyertelmu. */
export function budapestEjfel(nap) {
  const [y, m, d] = nap.split('-').map(Number);
  const t0 = Date.UTC(y, m - 1, d);
  for (const ora of [2, 1, 3, 0]) { const c = t0 - ora * 3600000; const r = helyi(c); if (`${r.year}-${r.month}-${r.day}` === nap && r.hour === '00' && r.minute === '00') return c; }
  return null;
}
const kovetkezoNap = (nap) => { const [y, m, d] = nap.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10); };
/** -> { datum, from_ms, to_ms } | null (ervenytelen / tul regi / tul jovobeli datum) */
export function napIntervallum(datum, mostMs = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(datum || ''))) return null;
  const [y, m, d] = datum.split('-').map(Number);
  const k = new Date(Date.UTC(y, m - 1, d));
  if (k.getUTCFullYear() !== y || k.getUTCMonth() !== m - 1 || k.getUTCDate() !== d) return null;
  if (datum < '2026-01-01' || datum > kovetkezoNap(budapestiNap(mostMs))) return null;
  const from = budapestEjfel(datum), to = budapestEjfel(kovetkezoNap(datum));
  return from == null || to == null ? null : { datum, from_ms: from, to_ms: to };
}
const isoUtc = (ms) => new Date(ms).toISOString().replace('.000Z', 'Z');

// ---------- segedek ----------
const placeUzletag = (kulcs) => { const p = Number(String(kulcs || '').split('|')[0]); return PLACE_UZLETAG[p] || null; };
const jsonVagyNull = (s) => { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } };
const novel = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };
const hanyados = (x, y) => (y > 0 ? Math.round((x / y) * 100) / 100 : null);
/** A tabla oszlopai (hianyzo tabla = ures halmaz). Az adatbazis-HIBA nem nyelodik el: a hivo szekcio hibakent jelzi (sarga lampa), soha nem "zold ures nap". */
async function oszlopok(db, tabla) {
  const { results } = await db.prepare(`SELECT name FROM pragma_table_info('${tabla}')`).all();
  return new Set((results || []).map((r) => r.name));
}
async function mind(db, sql, ...args) { const { results } = await db.prepare(sql).bind(...args).all(); return results || []; }
/** Egy szekcio hibaja nem viszi el a tobbit: { hiba } marad a helyen (a lampa ilyenkor sarga). */
async function vedett(nev, fn, hibak) { try { return await fn(); } catch (e) { hibak.push(nev); return null; } }

/** A kerelem szandekolt (ARNYEK) celpontja-e? Csak 'elkuldve' sorra hivjuk. Ismeretlen / olvashatatlan = NEM arnyek (konzervativ). */
export function arnyekCel(sor, env = {}) {
  const k = jsonVagyNull(sor.kerelem);
  if (!k || typeof k !== 'object') return false;
  const cel = typeof k.cel === 'string' ? jsonVagyNull(k.cel) : k.cel;
  if (!cel || typeof cel !== 'object') return false;
  switch (sor.platform) {
    case 'meta': return cel.dataset === ARNYEK.meta.datasetId && !!cel.test_event_code && String(k.url || '').includes(`/${ARNYEK.meta.datasetId}/events`);
    case 'tiktok': return cel.pixel_code === ARNYEK.tiktok.pixelCode && !!cel.test_event_code;
    case 'ga4': { const mid = String(cel.measurement_id || ''); if (!mid || ELO_CELOK.ga4.includes(mid)) return false; return env.GA4_TESZT_MEASUREMENT_ID ? mid === env.GA4_TESZT_MEASUREMENT_ID : /^G-/.test(mid); }
    case 'google': { const akciok = Object.values(ARNYEK.google.akciok).flatMap((o) => Object.values(o)); const akcio = String(cel.conversion_action_id || ''); return String(cel.customer_id || '') === ARNYEK.google.customerId && akciok.includes(akcio) && !ELO_CELOK.google_primary.includes(akcio); } // a Zapier-webhook torzse: customer_id + conversion_action_id (az ARNYEK masodlagos akciok)
    default: return false;
  }
}

/** A foglalas_lemondas.eredmeny szabad szoveg (foglalas-kulcs.js naplo()): az ELOTAG dont. */
export function lemondasOsztaly(eredmeny) {
  const e = String(eredmeny || '');
  if (e.startsWith('felszabadult')) return 'felszabadult';
  if (e.startsWith('nincs bejegyzes')) return 'nincs_bejegyzes';
  if (e.startsWith('nem ellenorizheto')) return 'nem_ellenorizheto';
  if (e.startsWith('a birtokos foglalas EL')) return 'birtokos_el';
  return 'egyeb';
}

const ures = () => ({
  valos: { letrehozo_level: 0, parositott: 0, parositatlan: 0, egyeb_allapot: 0, proba_kizarva: 0, lemondas: { db: 0, felszabadult: 0, nincs_bejegyzes: 0, nem_ellenorizheto: 0, birtokos_el: 0, egyeb: 0 } },
  arnyek: Object.fromEntries(PLATFORMOK.map((p) => [p, { ...Object.fromEntries(ALLAPOTOK.map((a) => [a, 0])), mas: 0, alap_elkuldve: 0, forras: {}, lampa: 'n/a' }])),
  biztonsag: { elo_id_talalat: 0, dupla: 0, nem_arnyek_cel: 0 },
  sd: { sd_allapot: {}, csere: {} },
  pre288_missing_hmac_index: { db: 0, mintak: [] },
  foglalas_vendeg: {},
});

/**
 * Az egy napra szolo QA-jelentes. Csak olvas (SELECT), semmit nem hoz letre. -> a JSON-torzs
 * @param {{ datum: string, from_ms: number, to_ms: number }} nap
 * @param {{ proba?: string[], env?: object }} opciok  proba = a hivo altal megadott 8 karakteres uuid-elotagok (a D1-ben NINCS proba-jelolo; lasd PROBA_SZABALY)
 */
export async function qaNap(db, nap, { proba = [], env = {}, mostMs = Date.now() } = {}) {
  const from = Math.floor(nap.from_ms / 1000), to = Math.floor(nap.to_ms / 1000);
  const hibak = [];
  const uz = Object.fromEntries([...UZLETAGAK, 'ismeretlen'].map((u) => [u, ures()]));
  const probaSet = new Set(proba);
  const eOszl = (await vedett('sema_egyeztetes', () => oszlopok(db, 'foglalas_egyeztetes'), hibak)) || new Set();
  const kOszl = (await vedett('sema_kuldes', () => oszlopok(db, 'meres_kuldes'), hibak)) || new Set();
  let ismeretlenHasznalt = false; // az "ismeretlen" uzletag csak akkor jelenik meg, ha valami oda esett (kulcs nelkuli level, ismeretlen uzletagu kuldes ...)
  const bizt = (u) => { if (UZLETAGAK.includes(u)) return uz[u]; ismeretlenHasznalt = true; return uz.ismeretlen; };

  // 1) valos: a nap letrehozo levelei (foglalas_egyeztetes), a hivo altal megadott probak nelkul
  await vedett('valos', async () => {
    if (!eOszl.size) return;
    const sorok = await mind(db, 'SELECT substr(uuid, 1, 8) AS u8, allapot, kulcs FROM foglalas_egyeztetes WHERE letrehozva >= ?1 AND letrehozva < ?2', from, to);
    for (const s of sorok) {
      const b = bizt(placeUzletag(s.kulcs)).valos;
      if (probaSet.has(s.u8)) { b.proba_kizarva++; continue; }
      b.letrehozo_level++;
      if (s.allapot === 'parositott') b.parositott++; else if (s.allapot === 'parositatlan') b.parositatlan++; else b.egyeb_allapot++;
    }
    if ((await oszlopok(db, 'foglalas_lemondas')).size) {
      for (const l of await mind(db, 'SELECT kulcs, eredmeny FROM foglalas_lemondas WHERE ido >= ?1 AND ido < ?2', from, to)) {
        const b = bizt(placeUzletag(l.kulcs)).valos.lemondas;
        b.db++;
        b[lemondasOsztaly(l.eredmeny)]++;
      }
    }
  }, hibak);

  // 2) arnyek + 3) biztonsag: a meres_kuldes napi sorai
  await vedett('arnyek', async () => {
    if (!kOszl.size) return;
    const forrasOszlop = kOszl.has('forras') ? "COALESCE(forras, 'motor')" : "'motor'";
    const sorok = await mind(db, `SELECT esemeny_id, esemeny_tipus, platform, platform_nev, uzletag, allapot, ${forrasOszlop} AS forras, kerelem FROM meres_kuldes WHERE letrehozva >= ?1 AND letrehozva < ?2 LIMIT 50000`, from, to);
    const dupla = new Map();
    for (const s of sorok) {
      const u = bizt(s.uzletag);
      const p = u.arnyek[s.platform];
      if (p) {
        if (ALLAPOTOK.includes(s.allapot)) p[s.allapot]++; else p.mas++;
        const f = (p.forras[s.forras] = p.forras[s.forras] || Object.fromEntries([...ALLAPOTOK, 'mas'].map((a) => [a, 0])));
        f[ALLAPOTOK.includes(s.allapot) ? s.allapot : 'mas']++;
        if (s.allapot === 'elkuldve' && s.esemeny_tipus === 'alap' && (s.forras === 'motor' || s.forras === 'salonic_direct') && !/Ajandekkartya$/.test(String(s.platform_nev || ''))) p.alap_elkuldve++; // a foglalasonkenti alap-esemeny (FoglalasElso / Konzultacio / Visszajaro); az ajandekkartya nem foglalas-level
      }
      if (s.kerelem && ELO_ID_MINTA.test(String(s.kerelem))) u.biztonsag.elo_id_talalat++;
      if (s.allapot === 'elkuldve') {
        const kulcs = `${s.esemeny_id}|${s.platform}`;
        dupla.set(kulcs, (dupla.get(kulcs) || { db: 0, u }));
        dupla.get(kulcs).db++;
      }
      if ((s.allapot === 'elkuldve' || s.allapot === 'hiba') && !arnyekCel(s, env)) u.biztonsag.nem_arnyek_cel++; // a kiment (vagy kiment, de hibazott) kerelem celpontja is csak ARNYEK lehet
    }
    for (const v of dupla.values()) if (v.db > 1) v.u.biztonsag.dupla++;
    if (sorok.length >= 50000) hibak.push('arnyek_csonkolt');
  }, hibak);

  // 4) sd: sd_allapot es a csere-felismeres (foglalas_reschedule.allapot)
  await vedett('sd', async () => {
    if (eOszl.has('sd_allapot')) {
      const van = (await oszlopok(db, 'foglalas_vendeg')).size > 0;
      const sql = `SELECT e.sd_allapot AS allapot, e.kulcs AS kulcs${van ? ', v.uzletag AS uzletag' : ''} FROM foglalas_egyeztetes e ${van ? 'LEFT JOIN foglalas_vendeg v ON v.uuid = e.uuid' : ''} WHERE e.sd_allapot IS NOT NULL AND COALESCE(${eOszl.has('sd_ido') ? 'e.sd_ido' : 'e.letrehozva'}, e.letrehozva) >= ?1 AND COALESCE(${eOszl.has('sd_ido') ? 'e.sd_ido' : 'e.letrehozva'}, e.letrehozva) < ?2`;
      for (const s of await mind(db, sql, from, to)) novel(bizt(s.uzletag || placeUzletag(s.kulcs)).sd.sd_allapot, s.allapot);
    }
    if ((await oszlopok(db, 'foglalas_reschedule')).size) {
      const van = (await oszlopok(db, 'foglalas_vendeg')).size > 0;
      const sql = `SELECT r.allapot AS allapot, e.kulcs AS kulcs${van ? ', v.uzletag AS uzletag' : ''} FROM foglalas_reschedule r LEFT JOIN foglalas_egyeztetes e ON e.uuid = r.uuid ${van ? 'LEFT JOIN foglalas_vendeg v ON v.uuid = r.uuid' : ''} WHERE r.ido >= ?1 AND r.ido < ?2`;
      for (const s of await mind(db, sql, from, to)) novel(bizt(s.uzletag || placeUzletag(s.kulcs)).sd.csere, s.allapot);
    }
  }, hibak);

  // 5) pre288_missing_hmac_index: a #288 (PRE288_EPOCH) elott letrehozott foglalas, amelynek nincs foglalas_vendeg sora, es a lemondasa +-60 percen belul erkezett egy aznapi uj / sd foglalas mellett, ugyanabban az uzletagban
  await vedett('pre288', async () => {
    if (!eOszl.size || !(await oszlopok(db, 'foglalas_lemondas')).size) return;
    const vanVendeg = (await oszlopok(db, 'foglalas_vendeg')).size > 0;
    const sql = `SELECT substr(uj.uuid, 1, 8) AS uj8, uj.kulcs AS uj_kulcs, uj.letrehozva AS uj_ido, substr(regi.uuid, 1, 8) AS regi8, regi.kulcs AS regi_kulcs, l.kulcs AS l_kulcs${vanVendeg ? ', uv.uzletag AS uj_uzletag' : ''}
      FROM foglalas_egyeztetes uj
      JOIN foglalas_lemondas l ON l.ido BETWEEN uj.letrehozva - 3600 AND uj.letrehozva + 3600
      JOIN foglalas_egyeztetes regi ON regi.uuid = l.tulajdonos_uuid
      ${vanVendeg ? 'LEFT JOIN foglalas_vendeg uv ON uv.uuid = uj.uuid' : ''}
      WHERE uj.letrehozva >= ?1 AND uj.letrehozva < ?2 AND regi.letrehozva < ?3 AND regi.uuid <> uj.uuid
        ${vanVendeg ? 'AND NOT EXISTS (SELECT 1 FROM foglalas_vendeg v WHERE v.uuid = regi.uuid)' : ''}
      ORDER BY uj.letrehozva, uj.uuid`;
    const latott = new Set();
    for (const s of await mind(db, sql, from, to, PRE288_EPOCH)) {
      const ujU = (UZLETAGAK.includes(s.uj_uzletag) ? s.uj_uzletag : null) || placeUzletag(s.uj_kulcs); // az uj foglalas uzletaga: a hash-index sora, ennek hianyaban a kulcsa
      const regiU = placeUzletag(s.regi_kulcs) || placeUzletag(s.l_kulcs); // a lemondott (regi) foglalas uzletaga: a sajat kulcsa, ennek hianyaban a lemondas kulcsa
      if (!ujU || ujU !== regiU || probaSet.has(s.uj8)) continue; // csak azonos, ismert uzletag (ismeretlen = nem tudjuk igazolni -> nem szamoljuk)
      const jel = `${s.uj8}|${s.uj_ido}`;
      if (latott.has(jel)) continue; latott.add(jel);
      const b = uz[ujU].pre288_missing_hmac_index;
      b.db++;
      if (b.mintak.length < MINTA_MAX) b.mintak.push({ uuid_prefix: s.uj8, uzletag: ujU, ido: isoUtc(s.uj_ido * 1000) });
    }
  }, hibak);

  // 6) foglalas_vendeg: a nap uj sorai forras szerint
  await vedett('foglalas_vendeg', async () => {
    if (!(await oszlopok(db, 'foglalas_vendeg')).size) return;
    for (const s of await mind(db, 'SELECT uzletag, forras, COUNT(*) AS db FROM foglalas_vendeg WHERE ido >= ?1 AND ido < ?2 GROUP BY uzletag, forras', from, to)) {
      const b = bizt(s.uzletag).foglalas_vendeg; b[s.forras || 'ismeretlen'] = (b[s.forras || 'ismeretlen'] || 0) + s.db;
    }
  }, hibak);

  // ---------- lampa ----------
  let osszLampa = 'zold';
  const osszes = { valos: { letrehozo_level: 0, parositott: 0, parositatlan: 0, lemondas: 0 }, biztonsag: { elo_id_talalat: 0, dupla: 0, nem_arnyek_cel: 0 }, pre288_missing_hmac_index: 0, foglalas_vendeg: 0 };
  for (const [nev, u] of Object.entries(uz)) {
    let lampa = 'zold';
    const b = u.biztonsag;
    if (b.elo_id_talalat > 0 || b.dupla > 0 || b.nem_arnyek_cel > 0) lampa = 'piros';
    for (const p of ['meta', 'tiktok']) { // csak a Meta es a TikTok jelez sargat; a GA4 es a Google tajekoztato (hozzajarulas / kattintasazonosito miatt)
      const a = u.arnyek[p];
      if (nev === 'ismeretlen') { a.lampa = 'n/a'; a.arany = null; a.arany_parositott = null; continue; } // a besorolatlan level (pl. meg kulcs nelkuli) nem rothato egyik uzletag arnyek-esemenyeire
      a.arany = hanyados(a.alap_elkuldve, u.valos.letrehozo_level); // tajekoztato: az elkuldott alap-esemenyek / valos
      a.arany_parositott = hanyados(a.alap_elkuldve, u.valos.parositott); // a lampa alapja: az elkuldott alap-esemenyek / valos.parositott
      a.lampa = u.valos.parositott === 0 ? 'n/a' : (a.alap_elkuldve < KUSZOB * u.valos.parositott ? 'sarga' : 'zold');
      if (a.lampa === 'sarga' && LAMPA_RANG[lampa] < LAMPA_RANG.sarga) lampa = 'sarga';
    }
    for (const p of ['google', 'ga4']) { const g = u.arnyek[p]; g.lampa = 'tajekoztato'; g.arany = hanyados(g.alap_elkuldve, u.valos.letrehozo_level); g.arany_parositott = hanyados(g.alap_elkuldve, u.valos.parositott); }
    u.lampa = lampa;
    if (LAMPA_RANG[lampa] > LAMPA_RANG[osszLampa]) osszLampa = lampa;
    osszes.valos.letrehozo_level += u.valos.letrehozo_level; osszes.valos.parositott += u.valos.parositott; osszes.valos.parositatlan += u.valos.parositatlan; osszes.valos.lemondas += u.valos.lemondas.db;
    for (const k of Object.keys(osszes.biztonsag)) osszes.biztonsag[k] += b[k];
    osszes.pre288_missing_hmac_index += u.pre288_missing_hmac_index.db;
    osszes.foglalas_vendeg += Object.values(u.foglalas_vendeg).reduce((x, y) => x + y, 0);
  }
  if (!ismeretlenHasznalt) delete uz.ismeretlen;
  if (hibak.length && LAMPA_RANG[osszLampa] < LAMPA_RANG.sarga) osszLampa = 'sarga'; // hiányos szekcio nem lehet "zold"
  return {
    ok: true,
    datum: nap.datum, timezone: QA_TIMEZONE, from_utc: isoUtc(nap.from_ms), to_utc: isoUtc(nap.to_ms),
    generalva_utc: isoUtc(mostMs),
    lampa: osszLampa,
    szekcio_hibak: hibak,
    proba_szabaly: PROBA_SZABALY, proba_megadva: [...probaSet],
    osszes,
    uzletagak: uz,
  };
}

/** A "proba" definicioja: a D1 foglalas_egyeztetes sorainak NINCS proba-jelolo oszlopa / allapota (a Zap tesztFoglalas-szabalya a Zapben dol el, es nem kerul a D1-be). Ezert: alapbol MINDEN letrehozo level valos; a hivo a ?proba=<8 karakteres uuid-elotagok vesszovel> parameterrel zarhatja ki az ismert probakat (pl. a napi ellenorzes determinisztikus listaja). */
export const PROBA_SZABALY = 'alapbol minden foglalas_egyeztetes sor valos; kizaras csak a ?proba=<uuid 8 karakteres elotagok> parameterrel';

// ---------- vegpont ----------
const FEJ = Object.freeze({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' });
const valasz = (status, o) => new Response(JSON.stringify(o), { status, headers: FEJ });
const ablakok = new Map();
/** csuszo ablak a futo pelda memoriajaban (IP-nkent); semmi nem kerul tartos tarolora. true = enged. */
export function qaKorlat(kulcs, ms, max, korlat = KORLAT) {
  if (ablakok.size > korlat.maxBejegyzes) { for (const [k, v] of ablakok) if (ms - v.kezdet >= korlat.ablakMs) ablakok.delete(k); if (ablakok.size > korlat.maxBejegyzes) ablakok.clear(); }
  const v = ablakok.get(kulcs);
  if (!v || ms - v.kezdet >= korlat.ablakMs) { ablakok.set(kulcs, { kezdet: ms, db: 1 }); return true; }
  v.db++;
  return v.db <= max;
}
export const qaKorlatNullaz = () => ablakok.clear();
const sha256hex = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');
async function kulcsEgyezik(request, env) {
  const hash = env && env.EGYEZTETES_KULCS_HASH, adott = request.headers.get('x-egyeztetes-kulcs') || '';
  if (!hash || !adott) return false;
  const a = await sha256hex(adott); let d = a.length ^ hash.length;
  for (let i = 0; i < Math.max(a.length, hash.length); i++) d |= (a.charCodeAt(i) || 0) ^ (hash.charCodeAt(i) || 0); // konstans ideju osszevetes
  return d === 0;
}

/** GET /api/meres-admin?qa=nap&datum=YYYY-MM-DD[&proba=<uuid8,uuid8>] - kulcs CSAK az x-egyeztetes-kulcs fejlecben (URL-ben soha). 401 = nincs kulcs, 403 = rossz kulcs, 405 = nem GET, 429 = rate-limit, 400 = hibas datum. */
export async function kezelQaNap(request, env, deps = {}) {
  const ms = deps.now ? deps.now() : Date.now();
  if (request.method !== 'GET') return valasz(405, { ok: false });
  const ip = request.headers.get('cf-connecting-ip') || '';
  if (!qaKorlat(`k|${ip}`, ms, KORLAT.max)) return valasz(429, { ok: false, miert: 'rate-limit' });
  if (!(request.headers.get('x-egyeztetes-kulcs') || '')) return valasz(401, { ok: false });
  if (!(await kulcsEgyezik(request, env))) {
    if (!qaKorlat(`h|${ip}`, ms, KORLAT.hibaMax)) return valasz(429, { ok: false, miert: 'rate-limit' });
    return valasz(403, { ok: false });
  }
  if (!env || !env.KULCS_DB) return valasz(503, { ok: false, miert: 'nincs adatbazis-kotes' });
  const url = new URL(request.url);
  const nap = napIntervallum(url.searchParams.get('datum'), ms);
  if (!nap) return valasz(400, { ok: false, miert: 'datum: YYYY-MM-DD (2026-01-01 .. holnap)' });
  const nyers = (url.searchParams.get('proba') || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (nyers.length > 100 || nyers.some((x) => !/^[0-9a-f]{8}$/.test(x))) return valasz(400, { ok: false, miert: 'proba: legfeljebb 100 db 8 karakteres hex uuid-elotag, vesszovel' });
  try { return valasz(200, await qaNap(env.KULCS_DB, nap, { proba: nyers, env, mostMs: ms })); }
  catch (e) { console.error('qa-nap:', String(e && e.message || e).slice(0, 200)); return valasz(500, { ok: false, miert: 'adatbazis-hiba' }); }
}
