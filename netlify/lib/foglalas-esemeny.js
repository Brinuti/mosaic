// MOSAIC Booking Engine - a "jegyzettomb": valodi foglalasi esemenyek szerver-oldali tarolasa (Cloudflare KV).
//
// Mire kell: az "Elo foglaltsag" sav harmadik allapota ("N perce foglaltak utoljara erre a kezelesre") CSAK valodi foglalasbol szuletik.
// A Salonic nyilvanos felulete nem ad foglalasi esemenyt, ezert amikor a foglalas sikeresen lezarult (a Salonic atiranyitasa a
// koszonooldalra), a motor egy kis jelzest kuld ide; a sav ebbol olvassa, mikor foglaltak utoljara az adott kezelesre.
//
// Amit tarolunk (SZEMELYES ADAT NELKUL):
//   u:<uzletag>:<szolgaltatas-id>   {"t": <ms>}      az utolso foglalas ideje (a SZERVER ideje, nem a bongeszoe); 2 napig el
//   d:<hash>                        "1"              a foglalas "ujjlenyomata" (a vendeg-azonosito + szolgaltatas + kezdes SHA-256 hash-e): ugyanaz a
//                                                    foglalas (a koszonooldal ujratoltese) nem szamit ketszer; 2 napig el
// A vendeg-azonosito (a Salonic "g" parametere) soha nem kerul a tarolora, csak a hash-ben.
//
// Hatarok (ezeket a dokumentacio is kimondja): a jelzest a bongeszo kuldi, ezert egy ugyes szandekos hivo hamisithatna. Vedelem: szigoru
// ellenorzes (ismert uzletag, szam-azonositok, ertelmes kezdesi ido), azonos eredetu keres (Origin), duplikacio-szuro, az ido a szerveren
// szuletik (nem lehet "regi" vagy "jovobeli" eseményt beirni), a sav csak 24 oran belulit mutat, es az iras kapcsoloval (ESEMENY_IRAS) ki-be
// kapcsolhato. Szerver-szerver forras (pl. a Salonic sajat ertesito e-mailje) ennel erosebb lenne: lasd docs/booking-engine/DECISIONS.md.

export const UZLETAGAK = Object.freeze(['headspa', 'hair', 'oxygen', 'laser']); // ahol van elo sav (a PMU-nak sajat foglaloja van)
export const ELET_MP = 2 * 24 * 3600; // a bejegyzesek elettartama (a KV-bol maguktol kikerulnek); a sav 24 oraig mutatja
export const MAX_SZOLGALTATAS = 6; // egy olvasasban legfeljebb ennyi szolgaltatas-valtozat
export const MAX_TEST = 1000; // bajt: a beirt JSON legfeljebb ennyi lehet
const MULT_MAX_MS = 60 * 60 * 1000; // a foglalas kezdete legfeljebb ennyivel lehet a multban (a Salonic nem enged mult idopontot)
const JOVO_MAX_MS = 400 * 24 * 3600 * 1000; // ... es legfeljebb ennyivel a jovoben

const SZAM = /^\d{1,12}$/;
// A Salonic atiranyitasa a vendeg-azonositot "g:2038420" alakban adja (az elo proba mutatta meg): az elotag nem szamit, a szam az azonosito.
const VENDEG = /^(?:g:)?(\d{1,12})$/;
export const kulcs = (uzletag, szolgaltatas) => `u:${uzletag}:${szolgaltatas}`;

/** A beirt jelzes ellenorzese. Vissza: { ok: true, adat } vagy { ok: false, hiba }. */
export function irasEllenorzes(test, nowMs) {
  let b;
  try { b = typeof test === 'string' ? JSON.parse(test) : test; } catch (e) { return { ok: false, hiba: 'rossz_json' }; }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return { ok: false, hiba: 'rossz_alak' };
  const uzletag = String(b.uzletag ?? '');
  const szolgaltatas = String(b.szolgaltatas ?? '');
  const vendegM = VENDEG.exec(String(b.vendeg ?? ''));
  const vendeg = vendegM ? vendegM[1] : '';
  const kezdes = Number(b.kezdes);
  if (!UZLETAGAK.includes(uzletag)) return { ok: false, hiba: 'ismeretlen_uzletag' };
  if (!SZAM.test(szolgaltatas)) return { ok: false, hiba: 'rossz_szolgaltatas' };
  if (!SZAM.test(vendeg)) return { ok: false, hiba: 'rossz_vendeg' };
  if (!Number.isInteger(kezdes)) return { ok: false, hiba: 'rossz_kezdes' };
  const kMs = kezdes * 1000;
  if (kMs < nowMs - MULT_MAX_MS || kMs > nowMs + JOVO_MAX_MS) return { ok: false, hiba: 'kezdes_tartomanyon_kivul' };
  return { ok: true, adat: { uzletag, szolgaltatas, vendeg, kezdes } };
}

/** A foglalas ujjlenyomata (hash): ugyanaz a foglalas ketszer nem szamit. A vendeg-azonosito igy nem kerul a tarolora. */
export async function ujjlenyomat(adat) {
  const bajtok = new TextEncoder().encode(`${adat.vendeg}|${adat.uzletag}|${adat.szolgaltatas}|${adat.kezdes}`);
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', bajtok));
  return 'd:' + [...h.slice(0, 16)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** Iras. kihagy: a kihagyott (pl. teszt-) vendeg-azonositok listaja. Vissza: 'irva' | 'duplikalt' | 'kihagyva'. */
export async function ir(kv, adat, nowMs, { kihagy = [] } = {}) {
  if (kihagy.includes(adat.vendeg)) return 'kihagyva';
  const dk = await ujjlenyomat(adat);
  if (await kv.get(dk)) return 'duplikalt';
  await kv.put(kulcs(adat.uzletag, adat.szolgaltatas), JSON.stringify({ t: nowMs }), { expirationTtl: ELET_MP });
  await kv.put(dk, '1', { expirationTtl: ELET_MP });
  return 'irva';
}

/**
 * Olvasas: az adott kezelesre (a szolgaltatas-valtozatok kozul) a legutobbi foglalas kora ms-ban (a SZERVER idejehez kepest), vagy null.
 * A kor szerver-oldalon szamolodik: a bongeszo orajara nem kell hagyatkozni.
 */
export async function olvas(kv, uzletag, szolgaltatasok, nowMs) {
  let legujabb = null;
  for (const id of szolgaltatasok) {
    let t = null;
    try { const j = JSON.parse(await kv.get(kulcs(uzletag, id))); t = j && Number.isFinite(j.t) ? j.t : null; } catch (e) { t = null; }
    if (t !== null && t <= nowMs && (legujabb === null || t > legujabb)) legujabb = t;
  }
  return legujabb === null ? null : nowMs - legujabb;
}

/** Az olvaso vegpont lekerdezese: ?uzletag=hair&szolgaltatas=1,2. Vissza: { uzletag, szolgaltatasok } vagy null. */
export function olvasLekerdezes(searchParams) {
  const uzletag = searchParams.get('uzletag') || '';
  const lista = [...new Set(String(searchParams.get('szolgaltatas') || '').split(',').map((x) => x.trim()).filter(Boolean))];
  if (!UZLETAGAK.includes(uzletag) || !lista.length || lista.length > MAX_SZOLGALTATAS || !lista.every((x) => SZAM.test(x))) return null;
  return { uzletag, szolgaltatasok: lista };
}

const JSON_FEJ = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const valasz = (statusz, test) => new Response(JSON.stringify(test), { status: statusz, headers: JSON_FEJ });

/**
 * A vegpont (Cloudflare Pages Function): GET = olvasas, POST = iras.
 * env.ESEMENYEK: a KV-kotes; env.ESEMENY_IRAS: "1" = az iras be van kapcsolva (az eles domainen alapbol KI van kapcsolva, lasd alul);
 * env.ESEMENY_KIHAGY: vesszovel elvalasztott vendeg-azonositok (teszt-vendegek), amelyek foglalasat nem jegyezzuk.
 */
export async function kezel(request, env, nowMs = Date.now()) {
  const kv = env && env.ESEMENYEK;
  const url = new URL(request.url);
  if (request.method === 'GET') {
    const l = olvasLekerdezes(url.searchParams);
    if (!l) return valasz(400, { hiba: 'rossz_lekerdezes' });
    if (!kv) return valasz(200, { kor_ms: null }); // nincs tarolo (pl. helyi fejlesztes): nincs adat, a sav nem mond semmit
    try { return valasz(200, { kor_ms: await olvas(kv, l.uzletag, l.szolgaltatasok, nowMs) }); } catch (e) { return valasz(200, { kor_ms: null }); }
  }
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'GET, POST' } });

  // iras: csak azonos eredetrol (a motor a sajat oldalarol hivja), a megengedett kapcsolo mogott
  const origin = request.headers.get('origin');
  if (origin) { let oHost = null; try { oHost = new URL(origin).host; } catch (e) { /* hibas Origin */ } if (oHost !== url.host) return valasz(403, { hiba: 'idegen_eredet' }); }
  // Az eles domainen az iras csak az ESEMENY_IRAS="1" valtozoval kapcsolhato be (a tulajdonos jovahagyasa utan); az elonezeti (*.pages.dev) domainek
  // sajat, kulon KV-nevteret hasznalnak, ott az iras mindig be van kapcsolva (a tesztekhez).
  const eles = /^(www\.)?mosaicheadspa\.hu$/.test(url.hostname);
  if (eles && env.ESEMENY_IRAS !== '1') return valasz(200, { irva: false, ok: 'kikapcsolva' });
  if (!kv) return valasz(200, { irva: false, ok: 'nincs_tarolo' });
  const test = await request.text();
  if (test.length > MAX_TEST) return valasz(413, { hiba: 'tul_nagy' });
  const e = irasEllenorzes(test, nowMs);
  if (!e.ok) return valasz(400, { hiba: e.hiba });
  const kihagy = String(env.ESEMENY_KIHAGY || '').split(',').map((x) => x.trim().replace(/^g:/, '')).filter(Boolean);
  try {
    const allapot = await ir(kv, e.adat, nowMs, { kihagy });
    return valasz(200, { irva: allapot === 'irva', ok: allapot });
  } catch (err) { return valasz(500, { hiba: 'tarolasi_hiba' }); }
}
