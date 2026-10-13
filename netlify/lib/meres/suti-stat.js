// Mosaic NEVTELEN sutisav-statisztika (a meresi oldal SPEC-je, #167 125. komment, GPT atnezte; az MP /api/mp-suti-stat mintajara).
// Cel: tudjuk, hany latogato dont a savban es hogyan. A sav szovegehez / kinezetehez, a Meta-pixelhez, a GTM-hez es a Consent Mode jelekhez NEM nyul.
// Adat: napi DARABSZAM esemeny x fun/ana/adv x oldaltipus x eszkoz szerint. Suti, azonosito, idobelyeg a kliensbol NINCS; a "nap"-ot a SZERVER szamolja budapesti ido szerint;
// az IP-t es az UA-t nem taroljuk (a rate-limit az IP-t csak a futo pelda memoriajaban, 60 mp-es ablakra tartja, D1-be / naploba soha nem kerul).
// Tabla: suti_stat a KULCS_DB-ben (a kod hozza letre, mint a tobbi tablat; az elonezet KULON adatbazis, igy nem szennyezi az elest).
import { azonosEredet, valasz } from '../foglalas-kulcs.js';

export const ESEMENYEK = ['megjelent', 'elfogad_minden', 'elutasit', 'reszleges'];
export const OLDALTIPUSOK = ['fooldal', 'landing', 'foglalo', 'koszono', 'egyeb'];
export const ESZKOZOK = ['mobil', 'desktop'];
const MEZOK = ['esemeny', 'fun', 'ana', 'adv', 'oldaltipus', 'eszkoz'];
const MAX_TORZS = 300; // bajt: a kliens kb. 90 bajtot kuld
const KORLAT = { ablakMs: 60000, max: 20, ismeretlenMax: 200, maxBejegyzes: 5000 }; // IP-nkent 20 esemeny / perc (egy latogato oldalankent 1-2-t kuld); IP nelkul kozos, nagyobb vodor

const DDL = 'CREATE TABLE IF NOT EXISTS suti_stat (nap TEXT NOT NULL, esemeny TEXT NOT NULL, fun INTEGER NOT NULL, ana INTEGER NOT NULL, adv INTEGER NOT NULL, oldaltipus TEXT NOT NULL, eszkoz TEXT NOT NULL, db INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (nap, esemeny, fun, ana, adv, oldaltipus, eszkoz)) WITHOUT ROWID';
const INSERT = 'INSERT INTO suti_stat (nap, esemeny, fun, ana, adv, oldaltipus, eszkoz, db) VALUES (?,?,?,?,?,?,?,1) ON CONFLICT(nap, esemeny, fun, ana, adv, oldaltipus, eszkoz) DO UPDATE SET db = db + 1';
const kesz = new WeakSet(); // melyik D1-kotesen futott mar a DDL (peldanyonkent egyszer)
async function sema(db) { if (kesz.has(db)) return; await db.prepare(DDL).run(); kesz.add(db); }

const NAP_FORMAZO = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit', day: '2-digit' });
/** Budapesti naptari nap (YYYY-MM-DD) - a szerver szamolja, a kliens idejet nem hasznaljuk. */
export function budapestiNap(ms) {
  const r = {}; for (const p of NAP_FORMAZO.formatToParts(new Date(ms))) r[p.type] = p.value;
  return `${r.year}-${r.month}-${r.day}`;
}

/** A kliens torzsenek szigoru ellenorzese. Ismeretlen kulcs / ertek -> elutasitas (nem javitunk, nem talalgatunk). -> {ok:true, adat} | {ok:false, miert} */
export function sutiStatTisztit(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return { ok: false, miert: 'nem objektum' };
  for (const k of Object.keys(o)) if (!MEZOK.includes(k)) return { ok: false, miert: 'ismeretlen mezo' };
  if (!ESEMENYEK.includes(o.esemeny)) return { ok: false, miert: 'ismeretlen esemeny' };
  if (!OLDALTIPUSOK.includes(o.oldaltipus)) return { ok: false, miert: 'ismeretlen oldaltipus' };
  if (!ESZKOZOK.includes(o.eszkoz)) return { ok: false, miert: 'ismeretlen eszkoz' };
  const adat = { esemeny: o.esemeny, fun: 0, ana: 0, adv: 0, oldaltipus: o.oldaltipus, eszkoz: o.eszkoz };
  if (o.esemeny === 'megjelent') { // megjeleneskor nincs dontes: a jelzok nem lehetnek jelen
    if (o.fun !== undefined || o.ana !== undefined || o.adv !== undefined) return { ok: false, miert: 'megjelenesnek nincs dontese' };
    return { ok: true, adat };
  }
  for (const k of ['fun', 'ana', 'adv']) {
    if (o[k] !== 0 && o[k] !== 1) return { ok: false, miert: 'a dontes-jelzo 0 vagy 1' };
    adat[k] = o[k];
  }
  const ossz = adat.fun + adat.ana + adat.adv;
  if (o.esemeny === 'elfogad_minden' && ossz !== 3) return { ok: false, miert: 'elfogad_minden = 1,1,1' };
  if (o.esemeny === 'elutasit' && ossz !== 0) return { ok: false, miert: 'elutasit = 0,0,0' };
  if (o.esemeny === 'reszleges' && (ossz === 0 || ossz === 3)) return { ok: false, miert: 'reszleges = vegyes' };
  return { ok: true, adat };
}

// --- rate-limit: a futo pelda memoriajaban, IP-nkent csuszo ablak; semmi nem kerul tartos tarolora ---
const ablakok = new Map();
/** true = enged. A hiba / telitettseg mindig engedes (fail-open): a statisztika soha nem akadalyozhat semmit. */
export function sutiStatKorlat(ip, ms, korlat = KORLAT) {
  const kulcs = ip || '';
  const max = ip ? korlat.max : korlat.ismeretlenMax;
  if (ablakok.size > korlat.maxBejegyzes) {
    for (const [k, v] of ablakok) if (ms - v.kezdet >= korlat.ablakMs) ablakok.delete(k);
    if (ablakok.size > korlat.maxBejegyzes) ablakok.clear();
  }
  const v = ablakok.get(kulcs);
  if (!v || ms - v.kezdet >= korlat.ablakMs) { ablakok.set(kulcs, { kezdet: ms, db: 1 }); return true; }
  v.db++;
  return v.db <= max;
}
export const sutiStatKorlatNullaz = () => ablakok.clear(); // csak a tesztekhez

/** POST /api/suti-stat: azonos eredet, max. 300 bajt, szigoru ellenorzes, rate-limit, UPSERT szamlalo. 204 = rogzitve (a beacon a valaszt nem olvassa). */
export async function kezelSutiStat(request, env, deps = {}) {
  if (request.method !== 'POST') return new Response(null, { status: 405 });
  if (!env || !env.KULCS_DB) return new Response(null, { status: 503 });
  if (!azonosEredet(request)) return new Response(null, { status: 403 });
  const ms = deps.now ? deps.now() : Date.now();
  if (Number(request.headers.get('content-length') || 0) > MAX_TORZS) return new Response(null, { status: 413 }); // a torzset sem olvassuk be
  let szoveg = '';
  try { szoveg = await request.text(); } catch (e) { return new Response(null, { status: 400 }); }
  if (szoveg.length > MAX_TORZS) return new Response(null, { status: 413 });
  let o; try { o = JSON.parse(szoveg); } catch (e) { return new Response(null, { status: 400 }); }
  const t = sutiStatTisztit(o);
  if (!t.ok) return new Response(null, { status: 400 });
  if (!sutiStatKorlat(request.headers.get('cf-connecting-ip') || '', ms)) return new Response(null, { status: 429 });
  const a = t.adat;
  try {
    await sema(env.KULCS_DB);
    await env.KULCS_DB.prepare(INSERT).bind(budapestiNap(ms), a.esemeny, a.fun, a.ana, a.adv, a.oldaltipus, a.eszkoz).run();
  } catch (e) {
    console.error('suti-stat:', String(e && e.message || e).slice(0, 200));
    return new Response(null, { status: 500 });
  }
  return new Response(null, { status: 204 });
}

const NAP_MINTA = /^\d{4}-\d{2}-\d{2}$/;
/** GET /api/meres-admin?suti_stat=1[&tol=YYYY-MM-DD][&ig=YYYY-MM-DD]: CSAK aggregalt szamok (alapbol az utolso 31 nap). */
export async function sutiStatOlvas(db, { tol, ig, ms } = {}) {
  const most = ms || Date.now();
  const igNap = ig || budapestiNap(most);
  const tolNap = tol || budapestiNap(most - 30 * 86400000);
  if (!NAP_MINTA.test(tolNap) || !NAP_MINTA.test(igNap) || tolNap > igNap) return { ok: false, miert: 'tol / ig: YYYY-MM-DD, tol <= ig' };
  await sema(db);
  const { results } = await db.prepare('SELECT nap, esemeny, fun, ana, adv, oldaltipus, eszkoz, db FROM suti_stat WHERE nap >= ? AND nap <= ? ORDER BY nap, esemeny, oldaltipus, eszkoz, fun, ana, adv LIMIT 5000').bind(tolNap, igNap).all();
  const osszes = Object.fromEntries(ESEMENYEK.map((e) => [e, 0]));
  for (const r of results) osszes[r.esemeny] = (osszes[r.esemeny] || 0) + r.db;
  return { ok: true, tol: tolNap, ig: igNap, osszes, sorok: results };
}

export const sutiStatOlvasValasz = async (db, q) => { const r = await sutiStatOlvas(db, q); return valasz(r.ok ? 200 : 400, r); };
