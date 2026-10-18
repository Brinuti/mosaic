// GOOGLE ARNYEK BACKEND PROBA-FELTOLTES + VISSZAVONAS (a meresi oldal DECISION #196, #167 6246096267 / 6246123744; a hetfoi 2026-10-19 12:00-s Google E2E-kapu).
// Kulcsos admin-muveletek a /api/meres-admin vegponton (POST {muvelet:'google_proba' | 'google_proba_visszavon', ...}; kulcs: x-egyeztetes-kulcs, a kulcs a meresi oldale, NEM a repoban):
//   google_proba            : egy MEGLEVO valodi HeadSpa-feltoltes gclid-jevel (a D1-bol, szerveroldalon valasztva) probafeltoltes a relay-Zapon a 8 nem-EXCELLENT ARNYEK akciora.
//                             ALAPBOL SZARAZ (csak a terv, halozat es iras nelkul); kuldeshez kuld:true + megerosit + a GOOGLE_ARNYEK_WEBHOOK_URL + MERES_ELOSZTO=1 kell.
//   google_proba_visszavon  : ugyanazon futas feltoltesenek RETRACTION-je (Zapier-korrekcio, a 01a0e569 elokeszitett minta / az eletut-ag googleKorrekcioKerelem formaja).
//                             ALAPBOL SZARAZ (a terv: order_id + akcio + idopont, a meresi oldal a Google Ads API-n at is vegrehajthatja); a Zap hivasa kuld:true + megerosit + GOOGLE_KORREKCIO_WEBHOOK_URL,
//                             az eles korrekcio (dryRun:false) ezen felul GOOGLE_KORREKCIO_ELES=1 + eles:true.
// VEDELMEK (fail-closed, a kodban): csak a Google ARNYEK fiok (6088874770) es a 8 felsorolt ARNYEK akcio (HeadSpa kimarad: mar EXCELLENT; elo akcio SOHA); a torzs mezoi egy zart lista (nincs vendegadat, nincs hash-elt azonosito);
// a gclid CSAK a kuldendo torzsben van, SEHOL mashol (valasz, naplo, D1-kerelem): ott "gclid#1"; ad_user_data MINDIG DENIED (a probanak nincs vendegi hozzajarulasa: GRANTED-et nem allitunk);
// minden proba-sor forras = 'google_proba', source_id = 'gp_<futas>' (a QA-nap / T2 / lampa / egyeztetosor szamlalok kizarjak), order_id = 'Proba:<futas>:<akcio>' (egyedi).
import { ARNYEK, ELO_CELOK, googleIdo, kuldes } from './platformok.js';
import { kapcsolokOlvas, kikapcsolva, meresSema } from './elosztas.js';
import { irasKi } from './iras-kapcsolo.js';

export const PROBA_FORRAS = 'google_proba';
export const MEGEROSITES = 'ARNYEK-6088874770-PROBA';   // kuldeshez a kerelemnek ezt a szoveget kell tartalmaznia (megerosit): vletlen / hibas hivas nem kuldhet
export const PROBA_ERTEK = 1;                          // HUF: jelkepes ertek (a valodi ertekek az ARNYEK fiok szamait ne torzitsak); a feltoltes ELFOGADASA a cel, nem az osszeg
export const PROBA_MAX_24H = 40;                       // legfeljebb ennyi proba-sor (feltoltes + visszavonas) 24 oran belul: egy hibas hurok nem sokszorozhatja
const GCLID_MAX_KOR_MP = 80 * 86400;                   // a Google kattintas-konverzio 90 napos ablaka: 80 napnal regebbi kattintas nem valaszthato
const GCLID_MINTA = /^[A-Za-z0-9_-]{20,200}$/;
const ORDER_MINTA = /^Proba:[0-9a-f]{8}:\d{10}$/;
const FUTAS_MINTA = /^[0-9a-f]{8}$/;
const IDO_MINTA = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;
const ENGEDETT_MEZOK = Object.freeze(['conversion_action_id', 'gclid', 'conversion_date_time', 'value', 'currency', 'order_id', 'ad_user_data']);
// a Zapier-webhook cim-formatuma (platformok.js ZAPIER_HOOK_RE; a loopback csak a tesztekhez)
const ZAPIER_HOOK_RE = /^(https:\/\/hooks\.zapier\.com\/hooks\/catch\/\d+\/[A-Za-z0-9_-]+\/?|http:\/\/127\.0\.0\.1:\d+\/.*)$/;

const NEV = Object.freeze({ fodrasz: 'Fodrasz', oxigen: 'Oxigen', szor: 'Szor', pmu: 'PMU' });
/** A 8 probalhato ARNYEK akcio: az ARNYEK.google.akciok-bol (platformok.js), a HeadSpa (EXCELLENT) nelkul. [{ uzletag, esemeny, id, cimke }] */
export const PROBA_AKCIOK = Object.freeze(Object.entries(ARNYEK.google.akciok).filter(([u]) => u !== 'headspa')
  .flatMap(([uzletag, o]) => Object.entries(o).map(([esemeny, id]) => Object.freeze({ uzletag, esemeny, id, cimke: `ARNYEK ${NEV[uzletag]} ${esemeny === 'Konzultacio' ? 'Konz' : uzletag === 'pmu' ? 'Foglalas' : 'Elso'}` }))));
const PROBA_AKCIO_ID = new Set(PROBA_AKCIOK.map((a) => a.id));

const valasz = (status, body) => ({ status, body });
const sec = (ms) => Math.floor(ms / 1000);
const sha8 = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s))))].slice(0, 4).map((b) => b.toString(16).padStart(2, '0')).join('');
const veletlenFutas = () => [...crypto.getRandomValues(new Uint8Array(4))].map((b) => b.toString(16).padStart(2, '0')).join('');
const titkotKi = (szoveg, gclid) => (gclid ? String(szoveg ?? '').split(gclid).join('gclid#1') : String(szoveg ?? ''));

/** A felhasznalo altal kert akcio-lista ellenorzese: csak a 8 probalhato ID. -> { akciok } | { hiba } */
export function akciokValasztas(kert) {
  if (kert == null) return { akciok: PROBA_AKCIOK };
  if (!Array.isArray(kert) || !kert.length || kert.length > PROBA_AKCIOK.length) return { hiba: 'akciok: 1-8 elemu lista' };
  const ids = kert.map(String);
  if (new Set(ids).size !== ids.length) return { hiba: 'akciok: ismetlodo elem' };
  if (ids.some((i) => !PROBA_AKCIO_ID.has(i) || ELO_CELOK.google_primary.includes(i))) return { hiba: 'akciok: csak a 8 probalhato ARNYEK akcio (a HeadSpa es az elo akciok nem)' };
  return { akciok: PROBA_AKCIOK.filter((a) => ids.includes(a.id)) };
}

/** Egy megfelelo, valodi HeadSpa-feltoltes gclid-je a D1-bol (CSAK OLVAS). sorszam: 1 = a legfrissebb FoglalasElso, utana az Ajandekkartya sorok. -> { gclid, sor_id, esemeny_nev, kor_nap } | null. A gclid a hivon kivul SEHOVA nem kerul. */
export async function probaGclid(db, { sorszam = 1, nowSec }) {
  const { results } = await db.prepare("SELECT id, esemeny_nev, letrehozva, kerelem FROM meres_kuldes WHERE platform = 'google' AND allapot = 'elkuldve' AND uzletag = 'headspa' AND forras IN ('motor', 'kartya') AND letrehozva >= ?1 ORDER BY id DESC").bind(nowSec - GCLID_MAX_KOR_MP).all();
  const jeloltek = [];
  for (const r of results || []) {
    let k; try { k = JSON.parse(r.kerelem); } catch (e) { continue; }
    const g = k && k.body && k.body.gclid;
    if (typeof g === 'string' && GCLID_MINTA.test(g)) jeloltek.push({ gclid: g, sor_id: r.id, esemeny_nev: r.esemeny_nev, kor_nap: Math.floor((nowSec - r.letrehozva) / 86400), elso: r.esemeny_nev === 'FoglalasElso' ? 0 : 1 });
  }
  jeloltek.sort((a, b) => a.elso - b.elso || b.sor_id - a.sor_id);
  return jeloltek[Math.max(1, Math.floor(Number(sorszam)) || 1) - 1] || null;
}

/**
 * Egy probafeltoltes kerese (a Zap mezoi: platformok.js googleKerelem torzse). -> { platform, platform_nev, url, method, fejlec_nevek, cel, body (KULDENDO, a gclid-del), naplo_body (gclid#1) }
 * ad_user_data MINDIG 'DENIED' (nincs vendegi hozzajarulas; a valos feltoltesek is DENIED-del mentek: dontes nelkul).
 */
export function probaKerelem(akcio, { gclid, futasId, nowSec }) {
  const body = { conversion_action_id: akcio.id, gclid, conversion_date_time: googleIdo(nowSec - 120), value: PROBA_ERTEK, currency: 'HUF', order_id: `Proba:${futasId}:${akcio.id}`, ad_user_data: 'DENIED' };
  return { platform: 'google', platform_nev: `ARNYEK-${akcio.id}`, url: 'zapier-webhook: GOOGLE_ARNYEK_WEBHOOK_URL (titok, nem naplozott)', method: 'POST', fejlec_nevek: ['content-type'],
    cel: { customer_id: ARNYEK.google.customerId, conversion_action_id: akcio.id, athidalas: 'zapier-webhook', proba: true }, body, naplo_body: { ...body, gclid: 'gclid#1' }, akcio };
}

/** A kuldes ELOTTI utolso, fuggetlen ellenorzes (vedelmi reteg a keres-epito mellett). -> null (rendben) | a tiltas oka */
export function probaEllenorzes(k) {
  if (!k || !k.cel || !k.body) return 'hianyos kerelem';
  if (String(k.cel.customer_id) !== ARNYEK.google.customerId) return 'a celpont nem az ARNYEK Google Ads fiok';
  const id = String(k.cel.conversion_action_id);
  if (ELO_CELOK.google_primary.includes(id)) return 'elo konverzios akcio: nem kuldhetunk';
  if (!PROBA_AKCIO_ID.has(id)) return 'nem a 8 probalhato ARNYEK akcio egyike';
  const b = k.body;
  const kulcsok = Object.keys(b);
  if (kulcsok.length !== ENGEDETT_MEZOK.length || kulcsok.some((m) => !ENGEDETT_MEZOK.includes(m))) return 'a torzs mezoi nem a zart lista (vendegadat / idegen mezo nem mehet)';
  if (String(b.conversion_action_id) !== id) return 'conversion_action_id eltero a celtol';
  if (!GCLID_MINTA.test(String(b.gclid))) return 'ervenytelen gclid';
  if (!IDO_MINTA.test(String(b.conversion_date_time))) return 'ervenytelen conversion_date_time';
  if (b.value !== PROBA_ERTEK || b.currency !== 'HUF') return 'ertek / penznem nem a proba-ertek';
  if (!ORDER_MINTA.test(String(b.order_id)) || !String(b.order_id).endsWith(`:${id}`)) return 'order_id nem proba-azonosito';
  if (b.ad_user_data !== 'DENIED') return 'ad_user_data csak DENIED lehet (a probanak nincs vendegi hozzajarulasa)';
  return null;
}

const SOR_BESZUR = "INSERT INTO meres_kuldes (esemeny_id, esemeny_nev, esemeny_tipus, platform, platform_nev, uzletag, source_id, allapot, indok, ertek, penznem, hozzajarulas, kerelem, http_status, platform_valasz, kuldo, probalkozas, letrehozva, frissitve, forras, attr_minoseg, attr_jelek, salonic_uuid, ertek_minoseg) VALUES (?1, ?2, ?3, 'google', ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?17, 'google_proba', NULL, NULL, NULL, NULL) ON CONFLICT DO NOTHING";
const HOZZAJARULAS_JSON = JSON.stringify({ proba: true, ad_user_data: 'DENIED', megjegyzes: 'proba: nincs vendegi hozzajarulas' });

async function huszonnegyOra(db, nowSec) {
  const r = await db.prepare("SELECT COUNT(*) AS n FROM meres_kuldes WHERE forras = 'google_proba' AND letrehozva >= ?1").bind(nowSec - 86400).first();
  return r ? r.n : 0;
}

/** Kozos kapuk a KULDESHEZ. -> null | { status, body } */
async function kuldesKapu(db, env, o, nowSec, tervDb) {
  if (o.megerosit !== MEGEROSITES) return valasz(400, { ok: false, miert: `kuldeshez megerosit: "${MEGEROSITES}" kell` });
  if (String(env.MERES_ELOSZTO) !== '1') return valasz(409, { ok: false, miert: 'MERES_ELOSZTO nincs bekapcsolva' });
  if (await irasKi(db, env)) return valasz(503, { ok: false, miert: 'veszkapcsolo: az uj irasok ki vannak kapcsolva' });
  if ((await huszonnegyOra(db, nowSec)) + tervDb > PROBA_MAX_24H) return valasz(429, { ok: false, miert: `legfeljebb ${PROBA_MAX_24H} proba-sor 24 oran belul` });
  return null;
}

/**
 * google_proba. o: { kuld?: bool, megerosit?: string, futas_id?: 8 hex, akciok?: [id..], gclid_sorszam?: n }
 * -> { status, body }. SZARAZ (kuld != true): csak OLVAS (a gclid kiolvasasa), semmit nem ir, halozatot nem hiv.
 */
export async function googleProba(db, env, o, { now = Date.now(), fetchImpl = fetch, kuldo = kuldes } = {}) {
  const nowSec = sec(now);
  const v = akciokValasztas(o.akciok);
  if (v.hiba) return valasz(400, { ok: false, miert: v.hiba });
  if (o.futas_id != null && !FUTAS_MINTA.test(String(o.futas_id))) return valasz(400, { ok: false, miert: 'futas_id: 8 kisbetus hexa karakter' });
  const futasId = o.futas_id ? String(o.futas_id) : veletlenFutas();
  await meresSema(db);
  const g = await probaGclid(db, { sorszam: o.gclid_sorszam, nowSec });
  if (!g) return valasz(409, { ok: false, miert: 'nincs hasznalhato valodi HeadSpa gclid a D1-ben (elkuldott Google-sor, 80 napon belul)' });
  const gclidHash8 = await sha8(g.gclid);
  const kerelmek = v.akciok.map((a) => probaKerelem(a, { gclid: g.gclid, futasId, nowSec }));
  const terv = kerelmek.map((k, i) => ({ sorszam: i + 1, uzletag: k.akcio.uzletag, esemeny: k.akcio.esemeny, cimke: k.akcio.cimke, conversion_action_id: k.akcio.id, order_id: k.body.order_id, conversion_date_time: k.body.conversion_date_time, value: k.body.value, currency: k.body.currency, ad_user_data: k.body.ad_user_data, body_mezok: Object.keys(k.body) }));
  const alap = { ok: true, futas_id: futasId, source_id: `gp_${futasId}`, ugyfel: ARNYEK.google.customerId, gclid: 'gclid#1', gclid_hash8: gclidHash8, gclid_hossz: g.gclid.length, gclid_forras: { meres_kuldes_id: g.sor_id, esemeny: g.esemeny_nev, kor_nap: g.kor_nap }, kuldes_feltetelei: { meres_elosztas_be: String(env.MERES_ELOSZTO) === '1', webhook_beallitva: !!env.GOOGLE_ARNYEK_WEBHOOK_URL && ZAPIER_HOOK_RE.test(String(env.GOOGLE_ARNYEK_WEBHOOK_URL).trim()) }, terv };
  if (o.kuld !== true) return valasz(200, { ...alap, mod: 'szaraz', kuldes: 'nem tortent (kuld:true + megerosit kell)', visszavonas: `google_proba_visszavon {futas_id:"${futasId}"}` });

  const kapu = await kuldesKapu(db, env, o, nowSec, kerelmek.length);
  if (kapu) return kapu;
  if (!env.GOOGLE_ARNYEK_WEBHOOK_URL || !ZAPIER_HOOK_RE.test(String(env.GOOGLE_ARNYEK_WEBHOOK_URL).trim())) return valasz(409, { ok: false, miert: 'GOOGLE_ARNYEK_WEBHOOK_URL hianyzik / ervenytelen' });
  const kapcsolok = await kapcsolokOlvas(db);
  const eredmenyek = [];
  for (const k of kerelmek) {
    const sorBase = { sorszam: eredmenyek.length + 1, conversion_action_id: k.akcio.id, order_id: k.body.order_id };
    const ki = kikapcsolva(kapcsolok, k.akcio.uzletag, 'google');
    if (ki) { eredmenyek.push({ ...sorBase, allapot: 'kihagyva', indok: `veszkapcsolo: ${ki}` }); continue; }
    const tiltas = probaEllenorzes(k);
    if (tiltas) { eredmenyek.push({ ...sorBase, allapot: 'tiltva', indok: tiltas }); continue; }
    const meglevo = await db.prepare("SELECT id, allapot, probalkozas, frissitve FROM meres_kuldes WHERE esemeny_id = ?1 AND platform = 'google'").bind(k.body.order_id).first();
    if (meglevo && (meglevo.allapot === 'elkuldve' || (meglevo.allapot === 'folyamatban' && nowSec - meglevo.frissitve < 120) || meglevo.probalkozas >= 3)) { eredmenyek.push({ ...sorBase, allapot: meglevo.allapot, duplikalt: true }); continue; }
    const kerelemNaplo = JSON.stringify({ url: k.url, method: k.method, fejlec_nevek: k.fejlec_nevek, cel: k.cel, body: { ...k.naplo_body, gclid_hash8: gclidHash8 } });
    let id;
    if (meglevo) { id = meglevo.id; await db.prepare("UPDATE meres_kuldes SET allapot = 'folyamatban', probalkozas = probalkozas + 1, frissitve = ?2 WHERE id = ?1").bind(id, nowSec).run(); }
    else {
      const r = await db.prepare(SOR_BESZUR).bind(k.body.order_id, k.akcio.esemeny, 'alap', k.platform_nev, k.akcio.uzletag, `gp_${futasId}`, 'folyamatban', 'google_proba', PROBA_ERTEK, 'HUF', HOZZAJARULAS_JSON, kerelemNaplo, null, null, null, 1, nowSec).run();
      if (!(r.meta && r.meta.changes > 0)) { eredmenyek.push({ ...sorBase, allapot: 'folyamatban', duplikalt: true }); continue; }
      id = (await db.prepare("SELECT id FROM meres_kuldes WHERE esemeny_id = ?1 AND platform = 'google'").bind(k.body.order_id).first()).id;
    }
    const e = await kuldo(k, env, fetchImpl);
    const valaszSzoveg = titkotKi(e.valasz, g.gclid).slice(0, 2000);
    await db.prepare('UPDATE meres_kuldes SET allapot = ?2, http_status = ?3, platform_valasz = ?4, kuldo = ?5, kerelem = ?6, frissitve = ?7 WHERE id = ?1').bind(id, e.allapot, e.http_status ?? null, valaszSzoveg, e.kuldo || null, kerelemNaplo, nowSec).run();
    eredmenyek.push({ ...sorBase, id, allapot: e.allapot, http_status: e.http_status ?? null, valasz_roviden: valaszSzoveg.slice(0, 200) });
  }
  return valasz(200, { ...alap, mod: 'kuldes', eredmenyek, kuldve: eredmenyek.filter((e) => e.allapot === 'elkuldve' && !e.duplikalt).length, kovetkezo: `ellenorzes: Google Ads API offline_conversion_upload_conversion_action_summary; visszavonas: google_proba_visszavon {futas_id:"${futasId}"}` });
}

/**
 * Egy Google-korrekcio (RETRACTION) kerese a Zapier-webhookra (az eletut-ag googleKorrekcioKerelem torzsenek formaja):
 *   POST GOOGLE_KORREKCIO_WEBHOOK_URL { adjustments: [{ type: 'RETRACTION', orderId, conversionActionId, adjustmentDateTime ('yyyy-mm-dd hh:mm:ss+02:00', nem a jovoben), note }], dryRun }
 * dryRun = true, kiveve ha eles === true ES GOOGLE_KORREKCIO_ELES=1 (a Zap dryRun mellett validateOnly-t hiv: semmit nem ir).
 */
export function visszavonasKerelem({ orderId, akcioId, nowSec, eles }, env = {}) {
  if (!PROBA_AKCIO_ID.has(String(akcioId)) || ELO_CELOK.google_primary.includes(String(akcioId))) return { tiltva: 'a visszavonas csak a 8 probalhato ARNYEK akciora mehet' };
  if (!ORDER_MINTA.test(String(orderId)) || !String(orderId).endsWith(`:${akcioId}`)) return { tiltva: 'a visszavonas csak proba-feltoltes order_id-jara mehet' };
  const dryRun = !(eles === true && String(env.GOOGLE_KORREKCIO_ELES) === '1');
  const adj = { type: 'RETRACTION', orderId: String(orderId), conversionActionId: String(akcioId), adjustmentDateTime: googleIdo(nowSec), note: 'proba-visszavonas (google_proba)' };
  return { platform: 'google', platform_nev: `ARNYEK-RETRACTION-${akcioId}`, cel: { customer_id: ARNYEK.google.customerId, conversion_action_id: String(akcioId), athidalas: 'zapier-webhook', muvelet: 'RETRACTION', dry_run: dryRun, proba: true }, body: { adjustments: [adj], dryRun }, dryRun };
}

async function korrekcioKuldes(kerelem, env, fetchImpl, ms = 8000) {
  const url = String(env.GOOGLE_KORREKCIO_WEBHOOK_URL || '').trim();
  if (!ZAPIER_HOOK_RE.test(url)) return { allapot: 'hiba', http_status: null, valasz: 'GOOGLE_KORREKCIO_WEBHOOK_URL hianyzik / ervenytelen', kuldo: 'zapier' };
  const ab = new AbortController(); const t = setTimeout(() => ab.abort(), ms);
  try {
    const r = await fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(kerelem.body), signal: ab.signal });
    const szoveg = (await r.text()).slice(0, 2000);
    return { allapot: r.status >= 200 && r.status < 300 ? 'elkuldve' : 'hiba', http_status: r.status, valasz: szoveg, kuldo: 'zapier-webhook' };
  } catch (e) { return { allapot: 'hiba', http_status: null, valasz: 'halozati hiba: ' + String(e && e.message || e).slice(0, 200), kuldo: 'zapier-webhook' }; } finally { clearTimeout(t); }
}

/**
 * google_proba_visszavon. o: { futas_id (kotelezo), kuld?, megerosit?, eles? }
 * A terv a futas ELKULDOTT proba-soraibol epul (a tukorkep: ugyanazok az order_id-k es akciok); SZARAZ allapotban csak olvas.
 */
export async function googleProbaVisszavon(db, env, o, { now = Date.now(), fetchImpl = fetch } = {}) {
  const nowSec = sec(now);
  if (!FUTAS_MINTA.test(String(o.futas_id || ''))) return valasz(400, { ok: false, miert: 'futas_id: 8 kisbetus hexa karakter (kotelezo)' });
  const futasId = String(o.futas_id);
  await meresSema(db);
  const { results } = await db.prepare("SELECT id, esemeny_id, uzletag, allapot, kerelem FROM meres_kuldes WHERE forras = 'google_proba' AND esemeny_tipus = 'alap' AND platform = 'google' AND source_id = ?1 ORDER BY id").bind(`gp_${futasId}`).all();
  const feltoltesek = (results || []).filter((r) => r.allapot === 'elkuldve');
  if (!feltoltesek.length) return valasz(404, { ok: false, miert: 'ehhez a futashoz nincs elkuldott proba-feltoltes', futas_id: futasId, osszes_sor: (results || []).length });
  const kerelmek = [];
  for (const r of feltoltesek) {
    let k; try { k = JSON.parse(r.kerelem); } catch (e) { k = null; }
    const akcioId = k && k.cel && k.cel.conversion_action_id;
    const kr = visszavonasKerelem({ orderId: r.esemeny_id, akcioId, nowSec, eles: o.eles }, env);
    if (kr.tiltva) return valasz(409, { ok: false, miert: kr.tiltva, order_id: r.esemeny_id });
    kerelmek.push({ ...kr, feltoltes_id: r.id, uzletag: r.uzletag, eredeti_idopont: k.body && k.body.conversion_date_time });
  }
  const dryRun = kerelmek[0].dryRun;
  const terv = kerelmek.map((k, i) => ({ sorszam: i + 1, conversion_action_id: k.cel.conversion_action_id, order_id: k.body.adjustments[0].orderId, eredeti_conversion_date_time: k.eredeti_idopont, adjustment_date_time: k.body.adjustments[0].adjustmentDateTime, type: 'RETRACTION' }));
  const alap = { ok: true, futas_id: futasId, ugyfel: ARNYEK.google.customerId, retraction_db: terv.length, dry_run: dryRun, webhook_beallitva: !!env.GOOGLE_KORREKCIO_WEBHOOK_URL, eles_engedelyezve: String(env.GOOGLE_KORREKCIO_ELES) === '1', terv };
  if (o.kuld !== true) return valasz(200, { ...alap, mod: 'szaraz', kuldes: 'nem tortent', megjegyzes: 'a terv a Google Ads API uploadConversionAdjustments hivasaval is vegrehajthato (order_id + conversion_action + adjustment_date_time)' });

  const kapu = await kuldesKapu(db, env, o, nowSec, kerelmek.length);
  if (kapu) return kapu;
  if (!ZAPIER_HOOK_RE.test(String(env.GOOGLE_KORREKCIO_WEBHOOK_URL || '').trim())) return valasz(409, { ok: false, miert: 'GOOGLE_KORREKCIO_WEBHOOK_URL hianyzik / ervenytelen (a korrekcio-Zap a meresi oldal dolga)' });
  const eredmenyek = [];
  for (const k of kerelmek) {
    const orderId = k.body.adjustments[0].orderId;
    const eid = `Visszavon:${orderId}`;
    const sorBase = { conversion_action_id: k.cel.conversion_action_id, order_id: orderId };
    const meglevo = await db.prepare("SELECT id, allapot, probalkozas, frissitve, indok FROM meres_kuldes WHERE esemeny_id = ?1 AND platform = 'google'").bind(eid).first();
    if (meglevo && ((meglevo.allapot === 'elkuldve') || (meglevo.allapot === 'kihagyva' && dryRunSor(meglevo) && k.dryRun) || (meglevo.allapot === 'folyamatban' && nowSec - meglevo.frissitve < 120) || meglevo.probalkozas >= 3)) { eredmenyek.push({ ...sorBase, allapot: meglevo.allapot, duplikalt: true }); continue; }
    const kerelemNaplo = JSON.stringify({ url: 'zapier-webhook: GOOGLE_KORREKCIO_WEBHOOK_URL (titok, nem naplozott)', method: 'POST', fejlec_nevek: ['content-type'], cel: k.cel, body: k.body });
    let id;
    if (meglevo) { id = meglevo.id; await db.prepare("UPDATE meres_kuldes SET allapot = 'folyamatban', probalkozas = probalkozas + 1, frissitve = ?2, kerelem = ?3 WHERE id = ?1").bind(id, nowSec, kerelemNaplo).run(); }
    else {
      const r = await db.prepare(SOR_BESZUR).bind(eid, 'Visszavonas', 'korrekcio', k.platform_nev, k.uzletag, `gp_${futasId}`, 'folyamatban', 'google_proba', null, null, HOZZAJARULAS_JSON, kerelemNaplo, null, null, null, 1, nowSec).run();
      if (!(r.meta && r.meta.changes > 0)) { eredmenyek.push({ ...sorBase, allapot: 'folyamatban', duplikalt: true }); continue; }
      id = (await db.prepare("SELECT id FROM meres_kuldes WHERE esemeny_id = ?1 AND platform = 'google'").bind(eid).first()).id;
    }
    const e = await korrekcioKuldes(k, env, fetchImpl);
    // dryRun korrekcio: a Zap validateOnly-t hiv, a konverzio MARAD -> a sor allapota kihagyva (dry_run), nem elkuldve
    const allapot = e.allapot === 'elkuldve' && k.dryRun ? 'kihagyva' : e.allapot;
    const indok = allapot === 'kihagyva' ? 'dry_run: a Zap validateOnly-t hiv, a feltoltes marad' : null;
    await db.prepare('UPDATE meres_kuldes SET allapot = ?2, indok = ?3, http_status = ?4, platform_valasz = ?5, kuldo = ?6, frissitve = ?7 WHERE id = ?1').bind(id, allapot, indok, e.http_status ?? null, String(e.valasz ?? '').slice(0, 2000), e.kuldo || null, nowSec).run();
    eredmenyek.push({ ...sorBase, id, allapot, dry_run: k.dryRun, http_status: e.http_status ?? null, valasz_roviden: String(e.valasz ?? '').slice(0, 200) });
  }
  return valasz(200, { ...alap, mod: 'kuldes', eredmenyek, visszavonva: dryRun ? 0 : eredmenyek.filter((e) => e.allapot === 'elkuldve' && !e.duplikalt).length });
}
const dryRunSor = (sor) => /^dry_run/.test(String(sor.indok || ''));

/** Az admin-vegpont belepesi pontja. o.muvelet: 'google_proba' | 'google_proba_visszavon'. A hiba JSON-valasz (soha nem kivetel). */
export async function googleProbaMuvelet(db, env, o, deps = {}) {
  try {
    if (!db) return valasz(503, { ok: false, miert: 'nincs adatbazis-kotes' });
    if (o.muvelet === 'google_proba') return await googleProba(db, env || {}, o, deps);
    if (o.muvelet === 'google_proba_visszavon') return await googleProbaVisszavon(db, env || {}, o, deps);
    return valasz(400, { ok: false, miert: 'ismeretlen muvelet' });
  } catch (e) { return valasz(500, { ok: false, miert: 'adatbazis- / halozati hiba: ' + String(e && e.message || e).slice(0, 120) }); }
}
