// NAPI T2 QA-VEGPONT (a meresi oldal SPEC-je, #167 131. komment, GPT atnezte): GET /api/meres-admin?qa=nap&datum=YYYY-MM-DD
// CSAK OLVAS, AGGREGALT, PII-MENTES. Az eles D1-et a meresi oldal nem olvashatja; ezzel a vegponttal a Zapier admin-draft naponta lekeri a T2-osszevetest (arnyek vs. valos).
// Nincs nev, e-mail, telefon, hash, teljes UUID; egyetlen kivetel a pre288 mintalista (legfeljebb 8 karakteres uuid-elotag). Nem ir semmit, nem hoz letre tablat.
import { ARNYEK, ELO_CELOK, PLATFORMOK } from './platformok.js';
import { cellaOsztaly } from './egyeztetes-sor.js';

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
const FRISS_MP = 20 * 60; // a 20 percnel frissebb parositott levelhez az esemeny-sorok meg keszulhetnek: nem szamit technikai kimaradasnak (friss_kizarva)
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
const TILTOTT_KULCS = new Set(['__proto__', 'constructor', 'prototype', 'hasOwnProperty', 'toString', 'valueOf']);
const kulcsBiztos = (k) => (TILTOTT_KULCS.has(String(k)) ? 'ismeretlen' : String(k == null ? 'ismeretlen' : k).slice(0, 40)); // az adatbazisbol jovo szoveg (forras, sd_allapot ...) objektum-kulcsnak: az Object.prototype nevei nem hasznalhatok
const novel = (o, k, n = 1) => { const kk = kulcsBiztos(k); o[kk] = (Object.hasOwn(o, kk) ? o[kk] : 0) + n; };
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
    case 'tiktok': return cel.pixel_code === ARNYEK.tiktok.pixelCode && (!!cel.test_event_code || cel.arnyek_eles === true); // arnyek_eles: Feri 10-20, tesztkod nelkul, de csak az ARNYEK pixelre
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
  arnyek: Object.fromEntries(PLATFORMOK.map((p) => [p, { ...Object.fromEntries(ALLAPOTOK.map((a) => [a, 0])), mas: 0, alap_elkuldve: 0, proba_cella_kizarva: 0, forras: {}, lampa: 'n/a' }])),
  biztonsag: { elo_id_talalat: 0, dupla: 0, nem_arnyek_cel: 0 },
  sd: { sd_allapot: {}, csere: {} },
  pre288_missing_hmac_index: { db: 0, mintak: [] },
  post288_missing_hmac_index: { db: 0, parositatlan_db: 0, mintak: [] },
  post288_nincs_email: { db: 0, parositatlan_db: 0, mintak: [] },
  // BOOKING COVERAGE (a meresi oldal / GPT DECISION #166): latta-e a rendszer a valos foglalast. latott = a rendszer altal latott valos letrehozo levelek; elvart = a hivo FUGGETLEN forrasbol (pl. Salonic) megadott darabszam (?elvart=headspa:12,...), egyebkent null (a nevezo ekkor a latott: a lathatatlan kimaradas nem merheto)
  lefedettseg: { latott: 0, elvart: null, nevezo_forras: 'latott', lefedettseg: null, hiany: null, parositott_esemeny_nelkul: 0, szabalyos_esemeny_nelkul: 0, friss_kizarva: 0 },
  // PLATFORM ELIGIBILITY: lehetett-e szabalyosan esemenyt kuldeni. Platformonkent a foglalasonkenti alap-esemeny cellak: kuldve (ok) | szabalyos_nulla (jogos_0: pl. nincs hozzajarulas / kattintasazonosito) | technikai_hiany (hiba, tiltva, veszkapcsolo, halasztva ...) | nincs_sor (parositott level esemeny-sor nelkul).
  // A TECHNIKAI KIMARADAS (technikai_hiany + nincs_sor) BENNE MARAD a nevezoben: jogosult = kuldve + technikai_hiany + nincs_sor; a szabalyos nulla kimarad belole.
  jogosultsag: Object.fromEntries(PLATFORMOK.map((p) => [p, { cellak: 0, kuldve: 0, szabalyos_nulla: 0, technikai_hiany: 0, technikai_hiany_okok: {}, nincs_sor: 0, jogosult: 0, arany: null }])),
  foglalas_vendeg: {},
});

/**
 * Az egy napra szolo QA-jelentes. Csak olvas (SELECT), semmit nem hoz letre. -> a JSON-torzs
 * @param {{ datum: string, from_ms: number, to_ms: number }} nap
 * @param {{ proba?: string[], env?: object }} opciok  proba = a hivo altal megadott 8 karakteres uuid-elotagok (a D1-ben NINCS proba-jelolo; lasd PROBA_SZABALY)
 */
export async function qaNap(db, nap, { proba = [], env = {}, mostMs = Date.now(), elvart = null } = {}) {
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

  // a ?proba= levelek esemeny-celljai (booking_id / sd_id): a kuldott-arany szamlaloktol (alap_elkuldve, jogosultsag) KI vannak zarva - a nevezobol (valos / lefedettseg) is kimaradnak -, a biztonsagi ellenorzesek (elo ID, dupla, nem-arnyek cel) viszont MINDEN kuldesre futnak
  const probaForrasok = new Set();
  if (probaSet.size && eOszl.size) {
    await vedett('proba_forrasok', async () => {
      const lista = [...probaSet];
      for (const r of await mind(db, `SELECT booking_id${eOszl.has('sd_id') ? ', sd_id' : ''} FROM foglalas_egyeztetes WHERE lower(substr(uuid, 1, 8)) IN (${lista.map((_, i) => '?' + (i + 1)).join(', ')})`, ...lista)) { if (r.booking_id) probaForrasok.add(r.booking_id); if (r.sd_id) probaForrasok.add(r.sd_id); }
    }, hibak);
  }

  // 2) arnyek + 3) biztonsag: a meres_kuldes napi sorai
  await vedett('arnyek', async () => {
    if (!kOszl.size) return;
    const forrasOszlop = kOszl.has('forras') ? "COALESCE(k.forras, 'motor')" : "'motor'";
    const indokOszlop = kOszl.has('indok') ? 'k.indok' : 'NULL AS indok';
    const erkVan = (await oszlopok(db, 'meres_erkezes')).has('hozz'); // a foglalaskori hozzajarulas-PILLANATKEP (meres_erkezes.hozz, lapos { ana, adv, fun, dontes }): a GA4-kimaradas besorolasahoz ugyanaz a forras, mint az egyeztetosornal (egyeztetes-sor.js); a meres_kuldes.hozzajarulas hianyzo pillanatkepnel is kitoltott ("nincs dontes"), ezert nem alkalmas
    const sorok = await mind(db, `SELECT k.esemeny_id, k.esemeny_tipus, k.platform, k.platform_nev, k.uzletag, k.source_id, k.allapot, ${forrasOszlop} AS forras, ${indokOszlop}, ${erkVan ? 'er.hozz' : 'NULL'} AS erk_hozz, k.kerelem FROM meres_kuldes k ${erkVan ? 'LEFT JOIN meres_erkezes er ON er.source_id = k.source_id' : ''} WHERE k.letrehozva >= ?1 AND k.letrehozva < ?2 LIMIT 50000`, from, to);
    const dupla = new Map();
    for (const s of sorok) {
      const u = bizt(s.uzletag);
      const p = Object.hasOwn(u.arnyek, s.platform) ? u.arnyek[s.platform] : null; // az adatbazisbol jovo platform-nev nem kerulhet prototipus-keresesre
      // DECISION #196 (google-proba.js): a backend proba-feltoltes / -visszavonas sorai (forras = 'google_proba') a T2 szamlalokbol, a lampabol, a lefedettsegbol KI vannak zarva; a biztonsagi ellenorzesek (elo ID, dupla, nem-arnyek cel) RAJUK IS futnak
      const probaSor = s.forras === 'google_proba';
      if (p && probaSor) p.proba_sor_kizarva = (p.proba_sor_kizarva || 0) + 1;
      if (p && !probaSor) {
        if (ALLAPOTOK.includes(s.allapot)) p[s.allapot]++; else p.mas++;
        const fk = kulcsBiztos(s.forras);
        const f = (p.forras[fk] = Object.hasOwn(p.forras, fk) ? p.forras[fk] : Object.fromEntries([...ALLAPOTOK, 'mas'].map((a) => [a, 0])));
        f[ALLAPOTOK.includes(s.allapot) ? s.allapot : 'mas']++;
        const probaCella = probaForrasok.has(s.source_id); // a proba-level cellaja: nem szamit bele a kuldott-aranyba
        if (probaCella) p.proba_cella_kizarva++;
        if (!probaCella && s.allapot === 'elkuldve' && s.esemeny_tipus === 'alap' && (s.forras === 'motor' || s.forras === 'salonic_direct') && !/Ajandekkartya$/.test(String(s.platform_nev || ''))) p.alap_elkuldve++; // a foglalasonkenti alap-esemeny (FoglalasElso / Konzultacio / Visszajaro); az ajandekkartya nem foglalas-level
        if (!probaCella && s.esemeny_tipus === 'alap' && (s.forras === 'motor' || s.forras === 'salonic_direct') && !/Ajandekkartya$/.test(String(s.platform_nev || ''))) { // platform eligibility: ugyanaz a cella-halmaz, mint az alap_elkuldve, de MINDEN allapotban
          const j = u.jogosultsag[s.platform]; j.cellak++;
          const c = cellaOsztaly({ allapot: s.allapot, indok: s.indok }, { hozz: jsonVagyNull(s.erk_hozz) }); // nincs erkezesi pillanatkep (vagy nem objektum) -> a cellaOsztaly 'ga4_nincs_pillanatkep' (technikai)
          if (c.osztaly === 'ok') j.kuldve++;
          else if (c.osztaly === 'jogos_0') j.szabalyos_nulla++;
          else { j.technikai_hiany++; novel(j.technikai_hiany_okok, c.kod || (s.allapot === 'kihagyva' ? 'veszkapcsolo' : String(s.allapot || 'ismeretlen').slice(0, 24))); } // az ok csak kod / allapot (a szabad indok-szoveg nem kerul ki)
        }
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

  // 5b) post288_missing_hmac_index (a meresi oldal jovahagyta, #167 137. komment): a #288 (PRE288_EPOCH) UTAN letrehozott letrehozo level, amelyhez NINCS foglalas_vendeg sor.
  //     A parositott sor nem maradhat index nelkul (az sd csere-felismerese az index-soron mulik); a kimaradas oka (pl. nincs ervenyes e-mail) a Zap-futas valaszaban latszik (vendeg_index.kod), a D1-bol nem.
  await vedett('post288', async () => {
    if (!eOszl.size) return;
    const vanVendeg = (await oszlopok(db, 'foglalas_vendeg')).size > 0;
    const sorok = await mind(db, `SELECT substr(e.uuid, 1, 8) AS u8, e.kulcs AS kulcs, e.allapot AS allapot, e.letrehozva AS ido FROM foglalas_egyeztetes e WHERE e.letrehozva >= ?1 AND e.letrehozva < ?2 AND e.letrehozva >= ?3${vanVendeg ? ' AND NOT EXISTS (SELECT 1 FROM foglalas_vendeg v WHERE v.uuid = e.uuid)' : ''} ORDER BY e.letrehozva, e.uuid`, from, to, PRE288_EPOCH);
    for (const r of sorok) {
      if (probaSet.has(r.u8)) continue;
      const nev = placeUzletag(r.kulcs);
      const b = bizt(nev).post288_missing_hmac_index;
      if (r.allapot !== 'parositott') { b.parositatlan_db++; continue; } // a nem parositott levelnel a hiany tajekoztato (kulon szamlalo), a parositott a kritikus
      b.db++;
      if (b.mintak.length < MINTA_MAX) b.mintak.push({ uuid_prefix: r.u8, uzletag: nev || 'ismeretlen', ido: isoUtc(r.ido * 1000) });
    }
  }, hibak);

  // 5c) post288_nincs_email (a meresi oldal jovahagyta, #167 143. komment (b)): a #288 UTAN letrehozott letrehozo level, amelyhez az e-mail hianya miatt JELOLO sor van (foglalas_vendeg.forras '%_nincs_email', email_h NULL; hash-index sor nincs).
  //     A post288_missing_hmac_index igy csak a VALODI kimaradast mutatja (nincs sor, nincs jelolo); a "nincs e-mail" kulon szamlalo. Tajekoztato; a jelolo-ag (hmac-jelolo-sor) elott a szamlalo 0.
  await vedett('post288_nincs_email', async () => {
    if (!eOszl.size) return;
    const vo = await oszlopok(db, 'foglalas_vendeg');
    if (!vo.has('forras')) return;
    const sorok = await mind(db, `SELECT substr(e.uuid, 1, 8) AS u8, e.kulcs AS kulcs, e.allapot AS allapot, e.letrehozva AS ido FROM foglalas_egyeztetes e WHERE e.letrehozva >= ?1 AND e.letrehozva < ?2 AND e.letrehozva >= ?3 AND EXISTS (SELECT 1 FROM foglalas_vendeg v WHERE v.uuid = e.uuid AND v.forras LIKE '%\\_nincs\\_email' ESCAPE '\\') ORDER BY e.letrehozva, e.uuid`, from, to, PRE288_EPOCH);
    for (const r of sorok) {
      if (probaSet.has(r.u8)) continue;
      const nev = placeUzletag(r.kulcs);
      const b = bizt(nev).post288_nincs_email;
      if (r.allapot !== 'parositott') { b.parositatlan_db++; continue; }
      b.db++;
      if (b.mintak.length < MINTA_MAX) b.mintak.push({ uuid_prefix: r.u8, uzletag: nev || 'ismeretlen', ido: isoUtc(r.ido * 1000) });
    }
  }, hibak);

  // 5d) lefedettseg: a parositott (motor: booking_id) vagy kesz sd (sd_id) levelek, amelyekhez NINCS alap esemeny-sor a meres_kuldes-ben = technikai kimaradas (a nevezoben marad: nincs_sor)
  const kuponParositott = new Map(); // uzletag -> a PAROSITOTT (motoros), kuponos, esemeny nelkuli foglalasok szama: a lampa nevezojebol kivonjuk (DECISION #194)
  await vedett('lefedettseg', async () => {
    if (!eOszl.size || !kOszl.size || !eOszl.has('booking_id')) return;
    const sdVan = eOszl.has('sd_id') && eOszl.has('sd_allapot');
    const jellegVan = (await oszlopok(db, 'meres_jelleg')).size > 0; // a rogzitett foglalas-jelleg: a HeadSpa KONZULTACIOHOZ (#101) es a KUPONOS foglalashoz (#194: nem konverzio) a modell szandekosan nem keszit esemenyt -> szabalyos, nem technikai kimaradas (szabalyos_esemeny_nelkul)
    const jellegKulcs = sdVan ? "COALESCE(CASE WHEN e.allapot = 'parositott' THEN e.booking_id END, e.sd_id)" : "CASE WHEN e.allapot = 'parositott' THEN e.booking_id END"; // regi semaban nincs sd_id
    const jellegOszlop = jellegVan ? ', (SELECT j.jelleg FROM meres_jelleg j WHERE j.source_id = ' + jellegKulcs + ') AS jelleg, (SELECT j.kupon FROM meres_jelleg j WHERE j.source_id = ' + jellegKulcs + ') AS kupon' : ', NULL AS jelleg, NULL AS kupon';
    const sql = `SELECT substr(e.uuid, 1, 8) AS u8, e.kulcs AS kulcs, e.allapot AS allapot, e.letrehozva AS ido${jellegOszlop} FROM foglalas_egyeztetes e WHERE e.letrehozva >= ?1 AND e.letrehozva < ?2 AND ((e.allapot = 'parositott' AND e.booking_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM meres_kuldes k WHERE k.source_id = e.booking_id AND k.esemeny_tipus = 'alap'))${sdVan ? " OR (e.sd_id IS NOT NULL AND e.sd_allapot = 'kesz' AND NOT EXISTS (SELECT 1 FROM meres_kuldes k WHERE k.source_id = e.sd_id AND k.esemeny_tipus = 'alap'))" : ''}) ORDER BY e.letrehozva, e.uuid`;
    const frissHatar = Math.floor(mostMs / 1000) - FRISS_MP;
    for (const r of await mind(db, sql, from, to)) {
      if (probaSet.has(r.u8)) continue;
      const nev = placeUzletag(r.kulcs);
      const b = bizt(nev).lefedettseg;
      if (r.kupon && r.allapot === 'parositott') kuponParositott.set(nev, (kuponParositott.get(nev) || 0) + 1); // a frissesseg itt nem szamit: a kuponos foglalas SOHA nem kap esemenyt, a lampa nevezojeben sem szerepelhet
      if (r.ido > frissHatar) b.friss_kizarva++;
      else if (nev === 'headspa' && r.jelleg === 'konzultacio') b.szabalyos_esemeny_nelkul++;
      else if (r.kupon) b.szabalyos_esemeny_nelkul++; // DECISION #194: a kuponos (ajandekkartyas) foglalas nem konverzio -> szandekosan nincs esemenye (nem technikai kimaradas)
      else b.parositott_esemeny_nelkul++;
    }
  }, hibak);

  // 6) foglalas_vendeg: a nap uj sorai forras szerint
  await vedett('foglalas_vendeg', async () => {
    if (!(await oszlopok(db, 'foglalas_vendeg')).size) return;
    for (const s of await mind(db, 'SELECT uzletag, forras, COUNT(*) AS db FROM foglalas_vendeg WHERE ido >= ?1 AND ido < ?2 GROUP BY uzletag, forras', from, to)) {
      novel(bizt(s.uzletag).foglalas_vendeg, s.forras || 'ismeretlen', s.db);
    }
  }, hibak);

  // ---------- lampa ----------
  let osszLampa = 'zold';
  const osszes = { valos: { letrehozo_level: 0, parositott: 0, parositatlan: 0, lemondas: 0 }, biztonsag: { elo_id_talalat: 0, dupla: 0, nem_arnyek_cel: 0 }, pre288_missing_hmac_index: 0, post288_missing_hmac_index: 0, post288_nincs_email: 0, foglalas_vendeg: 0, lefedettseg: { latott: 0, elvart: elvart ? 0 : null, latott_az_elvart_uzletagakban: elvart ? 0 : null, lefedett: elvart ? 0 : null, elvart_hianyos: elvart ? !UZLETAGAK.every((x) => x in elvart) : null, hiany: elvart ? 0 : null, parositott_esemeny_nelkul: 0, szabalyos_esemeny_nelkul: 0, friss_kizarva: 0 }, jogosultsag: Object.fromEntries(PLATFORMOK.map((p) => [p, { kuldve: 0, szabalyos_nulla: 0, technikai_hiany: 0, nincs_sor: 0, jogosult: 0, arany: null }])) };
  for (const [nev, u] of Object.entries(uz)) {
    let lampa = 'zold';
    const b = u.biztonsag;
    const nevezo = Math.max(0, u.valos.parositott - (kuponParositott.get(nev) || 0)); // a kuponos foglalas szandekosan esemeny nelkuli: nem tehet sargava (DECISION #194)
    if (b.elo_id_talalat > 0 || b.dupla > 0 || b.nem_arnyek_cel > 0) lampa = 'piros';
    for (const p of ['meta', 'tiktok']) { // csak a Meta es a TikTok jelez sargat; a GA4 es a Google tajekoztato (hozzajarulas / kattintasazonosito miatt)
      const a = u.arnyek[p];
      if (nev === 'ismeretlen') { a.lampa = 'n/a'; a.arany = null; a.arany_parositott = null; continue; } // a besorolatlan level (pl. meg kulcs nelkuli) nem rothato egyik uzletag arnyek-esemenyeire
      a.arany = hanyados(a.alap_elkuldve, u.valos.letrehozo_level); // tajekoztato: az elkuldott alap-esemenyek / valos
      a.nevezo_parositott = nevezo; // = valos.parositott - a kuponos (nem konverzio, esemeny nelkuli) parositott foglalasok (DECISION #194)
      a.arany_parositott = hanyados(a.alap_elkuldve, nevezo); // a lampa alapja: az elkuldott alap-esemenyek / (valos.parositott - kuponos)
      a.lampa = nevezo === 0 ? 'n/a' : (a.alap_elkuldve < KUSZOB * nevezo ? 'sarga' : 'zold');
      if (a.lampa === 'sarga' && LAMPA_RANG[lampa] < LAMPA_RANG.sarga) lampa = 'sarga';
    }
    for (const p of ['google', 'ga4']) { const g = u.arnyek[p]; g.lampa = 'tajekoztato'; g.arany = hanyados(g.alap_elkuldve, u.valos.letrehozo_level); g.arany_parositott = hanyados(g.alap_elkuldve, nevezo); }
    u.lampa = lampa;
    if (LAMPA_RANG[lampa] > LAMPA_RANG[osszLampa]) osszLampa = lampa;
    // booking coverage + platform eligibility (tajekoztato szamlalok: nem valtoztatjak a lampat)
    const lf = u.lefedettseg; lf.latott = u.valos.letrehozo_level;
    const e = elvart && nev in elvart ? elvart[nev] : null;
    if (e != null) { lf.elvart = e; lf.nevezo_forras = 'elvart'; lf.lefedettseg = hanyados(lf.latott, e); lf.hiany = Math.max(0, e - lf.latott); }
    osszes.lefedettseg.latott += lf.latott; osszes.lefedettseg.parositott_esemeny_nelkul += lf.parositott_esemeny_nelkul; osszes.lefedettseg.szabalyos_esemeny_nelkul += lf.szabalyos_esemeny_nelkul; osszes.lefedettseg.friss_kizarva += lf.friss_kizarva;
    if (elvart && e != null) { osszes.lefedettseg.elvart += e; osszes.lefedettseg.latott_az_elvart_uzletagakban += lf.latott; osszes.lefedettseg.lefedett += Math.min(lf.latott, e); osszes.lefedettseg.hiany += lf.hiany; }
    for (const pl of PLATFORMOK) {
      const j = u.jogosultsag[pl]; j.nincs_sor = lf.parositott_esemeny_nelkul; j.jogosult = j.kuldve + j.technikai_hiany + j.nincs_sor; j.arany = hanyados(j.kuldve, j.jogosult);
      const o = osszes.jogosultsag[pl]; for (const k of ['kuldve', 'szabalyos_nulla', 'technikai_hiany', 'nincs_sor', 'jogosult']) o[k] += j[k];
    }
    osszes.valos.letrehozo_level += u.valos.letrehozo_level; osszes.valos.parositott += u.valos.parositott; osszes.valos.parositatlan += u.valos.parositatlan; osszes.valos.lemondas += u.valos.lemondas.db;
    for (const k of Object.keys(osszes.biztonsag)) osszes.biztonsag[k] += b[k];
    osszes.pre288_missing_hmac_index += u.pre288_missing_hmac_index.db;
    osszes.post288_missing_hmac_index += u.post288_missing_hmac_index.db;
    osszes.post288_nincs_email += u.post288_nincs_email.db;
    osszes.foglalas_vendeg += Object.values(u.foglalas_vendeg).reduce((x, y) => x + y, 0);
  }
  for (const pl of PLATFORMOK) osszes.jogosultsag[pl].arany = hanyados(osszes.jogosultsag[pl].kuldve, osszes.jogosultsag[pl].jogosult);
  if (osszes.lefedettseg.elvart != null) osszes.lefedettseg.lefedettseg = hanyados(osszes.lefedettseg.lefedett, osszes.lefedettseg.elvart); // like-for-like ES uzletagonkent plafonozott: csak az elvart-tal rendelkezo uzletagak, es az egyik uzletag tulteljesitese nem fedi el a masik hianyat (lefedett = Σ min(latott, elvart))
  else { delete osszes.lefedettseg.elvart_hianyos; delete osszes.lefedettseg.latott_az_elvart_uzletagakban; delete osszes.lefedettseg.lefedett; }
  // T2-szamlalo (DECISION #213): jogosult foglalas = Salonic-PAROSITOTT, konzultacio ES kupon nelkuli letrehozo level (t2_jogosult_parositott; ezt hasonlitjuk a T2_ACCEPTANCE kuszobhoz).
  // A letrehozo-alapu szam (letrehozo level - konzultacio - kupon) csak tajekoztato (t2_jogosult_letrehozo). A jelleg a meres_jelleg tablabol (source_id = booking_id / sd_id);
  // jelleg-sor nelkuli level jogosultnak szamit (konzervativ). A ?proba= levelek kimaradnak. Napi ertek: a T2 osszege a napi ertekek osszege.
  const t2 = await vedett('t2', async () => {
    if (!eOszl.size || !eOszl.has('booking_id') || !eOszl.has('sd_id')) return null;
    const jOszl = await oszlopok(db, 'meres_jelleg');
    const jvan = jOszl.has('source_id') && jOszl.has('jelleg') && jOszl.has('kupon');
    const sorok = jvan
      ? await mind(db, 'SELECT substr(e.uuid, 1, 8) AS u8, e.allapot AS allapot, j.jelleg AS jelleg, j.kupon AS kupon, (j.source_id IS NULL) AS nincs FROM foglalas_egyeztetes e LEFT JOIN meres_jelleg j ON j.source_id = COALESCE(e.booking_id, e.sd_id) WHERE e.letrehozva >= ?1 AND e.letrehozva < ?2', from, to)
      : await mind(db, 'SELECT substr(uuid, 1, 8) AS u8, allapot, NULL AS jelleg, NULL AS kupon, 1 AS nincs FROM foglalas_egyeztetes WHERE letrehozva >= ?1 AND letrehozva < ?2', from, to);
    const t = { alap: 'jogosult_parositott', kuszob: T2_ACCEPTANCE.min_valos_jogosult_foglalas, t2_jogosult_parositott: 0, t2_jogosult_letrehozo: 0, letrehozo_level: 0, konzultacio: 0, kupon: 0, jelleg_nelkul: 0, jelleg_tabla: jvan, proba_kizarva: 0 };
    for (const s of sorok) {
      if (probaSet.has(s.u8)) { t.proba_kizarva++; continue; }
      t.letrehozo_level++;
      const konz = s.jelleg === 'konzultacio', kup = Number(s.kupon) === 1;
      if (s.nincs) t.jelleg_nelkul++;
      if (konz) t.konzultacio++;
      if (kup) t.kupon++;
      if (!konz && !kup) { t.t2_jogosult_letrehozo++; if (s.allapot === 'parositott') t.t2_jogosult_parositott++; }
    }
    return t;
  }, hibak);
  if (!ismeretlenHasznalt) delete uz.ismeretlen;
  if (hibak.length && LAMPA_RANG[osszLampa] < LAMPA_RANG.sarga) osszLampa = 'sarga'; // hiányos szekcio nem lehet "zold"
  return {
    ok: true,
    datum: nap.datum, timezone: QA_TIMEZONE, from_utc: isoUtc(nap.from_ms), to_utc: isoUtc(nap.to_ms),
    generalva_utc: isoUtc(mostMs),
    lampa: osszLampa,
    szekcio_hibak: hibak,
    proba_szabaly: PROBA_SZABALY, proba_megadva: [...probaSet],
    t2, // DECISION #213: a T2-szamlalo napi erteke (null: hianyzo sema / szekcio-hiba)
    osszes,
    uzletagak: uz,
  };
}

/** A "proba" definicioja: a D1 foglalas_egyeztetes sorainak NINCS proba-jelolo oszlopa / allapota (a Zap tesztFoglalas-szabalya a Zapben dol el, es nem kerul a D1-be). Ezert: alapbol MINDEN letrehozo level valos; a hivo a ?proba=<8 karakteres uuid-elotagok vesszovel> parameterrel zarhatja ki az ismert probakat (pl. a napi ellenorzes determinisztikus listaja). */
export const PROBA_SZABALY = 'alapbol minden foglalas_egyeztetes sor valos; kizaras csak a ?proba=<uuid 8 karakteres elotagok> parameterrel';

// ---------- T2_START rogzito (a meresi oldal / GPT DECISION #166 3.) ----------
/** A T2 kezdetekor rogzitendo allapot EGY hivasban: idopont + kod-ujjlenyomat (+ a hivo altal megadott production SHA) + D1 sema-ujjlenyomat + Zap revizio (a hivo adja) + kapcsolok + arnyekcel-ID-k. CSAK OLVAS, titok / PII nelkul (a titkokrol csak jelenlet-bit). */
// DECISION #212 (Feri, 2026-10-20 16:31): a mintaszam-kuszob 200 -> 140; DECISION #213 (Feri, 17:4x): a T2-szamlalo a PAROSITOTT jogosult foglalas (t2.t2_jogosult_parositott), a legkesobbi zaras 10-29 vege (max_nap 14 -> 15).
// CSAK riport-konstans / -mezo, kuldest nem erint. ROLLBACK: kuszob 200, max_nap 14, es a t2 blokk szamlaloja a letrehozo-alapu szam (#212 elotti allapot).
export const T2_ACCEPTANCE = Object.freeze({ min_nap: 7, max_nap: 15, min_valos_jogosult_foglalas: 140 });
const KAPCSOLO_ENV = Object.freeze(['MERES_ELOSZTO', 'MERES_SALONIC_DIRECT', 'MERES_SD_INDEX', 'MERES_SD_NS', 'MERES_IRAS_KI', 'META_API_VERSION']);
const TITOK_JELENLET = Object.freeze(['META_CAPI_TOKEN', 'TIKTOK_EVENTS_TOKEN', 'GA4_TESZT_API_SECRET', 'GOOGLE_ARNYEK_WEBHOOK_URL', 'SD_HMAC_KEY_V1', 'GUEST_HMAC_KEY_V1', 'EGYEZTETES_KULCS_HASH']);
const T2_TABLAK = Object.freeze(['meres_kuldes', 'foglalas_egyeztetes', 'foglalas_vendeg', 'foglalas_reschedule', 'foglalas_lemondas', 'meres_erkezes', 'foglalas_kulcs']);
/** Rendezett, kanonikus JSON (a kulcsok sorrendje nem szamit) -> a sha256-hez. */
const kanon = (v) => (Array.isArray(v) ? v.map(kanon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, kanon(v[k])])) : v);
export async function t2Start(db, env, mostMs, { sha = null, zapRev = null } = {}) {
  const hibak = [];
  const kodUjjlenyomat = await sha256hex(JSON.stringify(kanon({ ARNYEK, ELO_CELOK, PLATFORMOK, QA_TIMEZONE, PRE288_EPOCH, UZLETAGAK, PLACE_UZLETAG })));
  const semaSorok = await vedett('sema', async () => mind(db, "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite\\_%' ESCAPE '\\' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\' ORDER BY type, name"), hibak);
  const semaUjjlenyomat = semaSorok ? await sha256hex(semaSorok.map((r) => [r.type, r.name, r.tbl_name, String(r.sql || '').replace(/\s+/g, ' ').trim()].join('|')).join('\n')) : null;
  const tablak = new Set((semaSorok || []).filter((r) => r.type === 'table').map((r) => r.name));
  const sorok = {};
  for (const t of T2_TABLAK) {
    if (!tablak.has(t)) { sorok[t] = null; continue; }
    await vedett(`sorok_${t}`, async () => {
      const r = (await mind(db, `SELECT COUNT(*) AS db${t === 'meres_kuldes' ? ', MAX(id) AS max_id' : ''} FROM ${t}`))[0] || {};
      sorok[t] = t === 'meres_kuldes' ? { db: r.db, max_id: r.max_id } : { db: r.db };
      if (t === 'meres_kuldes' && (await oszlopok(db, 'meres_kuldes')).has('forras')) { // DECISION #196: a backend proba-sorok (forras = 'google_proba') kulon szamlalo, csak ha vannak (a T2-osszevetesbol levonando)
        const pr = (await mind(db, "SELECT COUNT(*) AS db FROM meres_kuldes WHERE forras = 'google_proba'"))[0] || {};
        if (pr.db > 0) sorok[t].google_proba_db = pr.db;
      }
    }, hibak);
  }
  let kapcsolok = null;
  if (tablak.has('meres_kapcsolo')) kapcsolok = await vedett('kapcsolok', async () => (await mind(db, 'SELECT kulcs, be, ido, ok FROM meres_kapcsolo ORDER BY kulcs')).map((r) => ({ kulcs: r.kulcs, be: r.be === 1, ido: r.ido, ok: r.ok == null ? null : String(r.ok).slice(0, 80) })), hibak);
  const e = env || {};
  return {
    ok: true, qa: 't2start',
    t2_start_utc: isoUtc(mostMs), t2_start_budapest: `${budapestiNap(mostMs)} ${helyi(mostMs).hour}:${helyi(mostMs).minute}`, timezone: QA_TIMEZONE,
    allapot_neve: 'T2_START (a PRE-T2 / QA-5 arnyek-validacio utan)',
    acceptance: T2_ACCEPTANCE,
    kod: {
      production_sha: sha, production_sha_forras: sha ? 'hivo' : (e.CF_PAGES_COMMIT_SHA ? 'env' : 'nincs'), // a Cloudflare Pages a CF_PAGES_COMMIT_SHA-t csak BUILD-kor adja; futasidoben nincs: a rogzito a deploy SHA-t a hivasban adja (&sha=)
      env_sha: e.CF_PAGES_COMMIT_SHA ? String(e.CF_PAGES_COMMIT_SHA).slice(0, 40) : null,
      kod_ujjlenyomat: kodUjjlenyomat, // az ARNYEK-celok + az elo tiltolista + a QA-konstansok sha256-ja: ha valtozik, a celok / a tiltolista valtozott
      elo_tiltolista_db: { meta: ELO_CELOK.meta.length, tiktok: ELO_CELOK.tiktok.length, ga4: ELO_CELOK.ga4.length, google_primary: ELO_CELOK.google_primary.length },
    },
    d1: { sema_ujjlenyomat: semaUjjlenyomat, tablak_db: tablak.size, sorok },
    zap: { revizio: zapRev, forras: zapRev ? 'hivo' : 'nincs' }, // a Zap revizioja nem lathato a szerveroldalrol: a rogzito a hivasban adja (&zap_rev=)
    kapcsolok: {
      env: Object.fromEntries(KAPCSOLO_ENV.map((k) => [k, e[k] == null ? null : String(e[k]).slice(0, 40)])),
      d1: kapcsolok,
      titkok_jelen: Object.fromEntries(TITOK_JELENLET.map((k) => [k, !!e[k]])), // csak jelenlet-bit, az ertek soha
    },
    arnyekcelok: {
      meta: { dataset: ARNYEK.meta.datasetId, nev: ARNYEK.meta.nev, api_verzio: e.META_API_VERSION ? String(e.META_API_VERSION).slice(0, 40) : ARNYEK.meta.apiVerzio, test_event_code: e.META_TESZT_KOD ? String(e.META_TESZT_KOD).slice(0, 40) : null },
      tiktok: { pixel_code: ARNYEK.tiktok.pixelCode, pixel_id: ARNYEK.tiktok.pixelId, test_event_code: e.TIKTOK_TESZT_KOD ? String(e.TIKTOK_TESZT_KOD).slice(0, 40) : null },
      ga4: e.GA4_TESZT_MEASUREMENT_ID && ELO_CELOK.ga4.includes(String(e.GA4_TESZT_MEASUREMENT_ID)) ? { measurement_id: null, hiba: 'a konfiguralt GA4 teszt measurement ID az ELO tiltolistan van (nem irjuk ki)' } : { measurement_id: e.GA4_TESZT_MEASUREMENT_ID ? String(e.GA4_TESZT_MEASUREMENT_ID).slice(0, 40) : null },
      google: { customer_id: ARNYEK.google.customerId, akciok: ARNYEK.google.akciok },
    },
    szekcio_hibak: hibak,
  };
}

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

/** GET /api/meres-admin?qa=nap&datum=YYYY-MM-DD[&proba=<uuid8,uuid8>][&elvart=headspa:12,...] | ?qa=t2start[&sha=..][&zap_rev=..] - kulcs CSAK az x-egyeztetes-kulcs fejlecben (URL-ben soha). 401 = nincs kulcs, 403 = rossz kulcs, 405 = nem GET, 429 = rate-limit, 400 = hibas datum. */
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
  if (url.searchParams.get('qa') === 't2start') { // T2_START rogzito (csak olvas): ?qa=t2start[&sha=<hex 7-40>][&zap_rev=<azonosito>]
    const sha = (url.searchParams.get('sha') || '').trim().toLowerCase() || null, zapRev = (url.searchParams.get('zap_rev') || '').trim() || null;
    if (sha && !/^[0-9a-f]{7,40}$/.test(sha)) return valasz(400, { ok: false, miert: 'sha: 7-40 hexa karakter' });
    if (zapRev && !/^[A-Za-z0-9._:-]{1,40}$/.test(zapRev)) return valasz(400, { ok: false, miert: 'zap_rev: legfeljebb 40 karakter (betu, szam, . _ : -)' });
    try { return valasz(200, await t2Start(env.KULCS_DB, env, ms, { sha, zapRev })); }
    catch (e) { console.error('qa-t2start:', String(e && e.message || e).slice(0, 200)); return valasz(500, { ok: false, miert: 'adatbazis-hiba' }); }
  }
  const nap = napIntervallum(url.searchParams.get('datum'), ms);
  if (!nap) return valasz(400, { ok: false, miert: 'datum: YYYY-MM-DD (2026-01-01 .. holnap)' });
  const nyers = (url.searchParams.get('proba') || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (nyers.length > 100 || nyers.some((x) => !/^[0-9a-f]{8}$/.test(x))) return valasz(400, { ok: false, miert: 'proba: legfeljebb 100 db 8 karakteres hex uuid-elotag, vesszovel' });
  // elvart: a FUGGETLEN forrasbol (pl. Salonic) szamolt valos foglalasok uzletagonkent: ?elvart=headspa:12,fodrasz:3 (a booking coverage nevezoje)
  let elvart = null;
  const elvartNyers = (url.searchParams.get('elvart') || '').trim();
  if (elvartNyers) {
    elvart = {};
    for (const par of elvartNyers.split(',')) {
      const m = /^([a-z]+):(\d{1,6})$/.exec(par.trim());
      if (!m || !UZLETAGAK.includes(m[1]) || m[1] in elvart) return valasz(400, { ok: false, miert: 'elvart: uzletag:darab,... (headspa|fodrasz|oxigen|szor|pmu; 0-999999; uzletagonkent egyszer)' });
      elvart[m[1]] = Number(m[2]);
    }
  }
  try { return valasz(200, await qaNap(env.KULCS_DB, nap, { proba: nyers, env, mostMs: ms, elvart })); }
  catch (e) { console.error('qa-nap:', String(e && e.message || e).slice(0, 200)); return valasz(500, { ok: false, miert: 'adatbazis-hiba' }); }
}
