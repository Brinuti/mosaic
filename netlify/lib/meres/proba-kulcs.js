// CELHOZ KOTOTT, LEJARATOS PROBA-KULCS a Google ARNYEK proba-feltoltes es visszavonas muveleteihez (DECISION #199 / #200, 2026-10-19).
// A fo EGYEZTETES_KULCS a Zapier Storage-ban van, a fejleszto nem kaphatja meg; ezert a fejleszto SAJAT, veletlen kulcsot general, amelynek CSAK a SHA-256-ja kerul a kodba
// (wrangler.toml [vars]: GOOGLE_PROBA_KULCS_HASH - a hash nem titok), es amely:
//  - KIZAROLAG a ket muveletre jo: POST /api/meres-admin { muvelet: 'google_proba' | 'google_proba_visszavon' } (minden mas muvelet, minden GET, minden mas vegpont: 404, mint kulcs nelkul);
//  - a kulcs CSAK az x-egyeztetes-kulcs fejlecben fogadhato el (query-ben nem: a naplokba / elozmenyekbe kerulhet);
//  - LEJAR: GOOGLE_PROBA_KULCS_LEJAR (ISO-ido) utan, de legfeljebb a PROBA_KULCS_PLAFON_MS kemeny plafonig (a kodban rogzitett: egy elteveszto / meghosszabbitott valtozo sem
//    teheti tartossa; a plafon <= 48 ora a kiadastol), az ellenorzes false;
//  - minden hasznalata NAPLOZVA (proba_kulcs_naplo: ido, muvelet, kuld, eles; kulcs, gclid, vendegadat nincs benne), a naplozas elobb fut, mint a muvelet (ha nem naplozhato: 404-szeru elutasitas).
// A kuldesi kapuk (kuld:true + megerosit + webhook-env + MERES_ELOSZTO=1 + iras-kapcsolo; RETRACTION elesben csak eles:true + GOOGLE_KORREKCIO_ELES=1) a google-proba.js-ben valtozatlanok.

export const PROBA_KULCS_MUVELETEK = Object.freeze(['google_proba', 'google_proba_visszavon']);
export const PROBA_KULCS_PLAFON_MS = Date.UTC(2026, 9, 21, 0, 0, 0); // 2026-10-21 00:00Z: ennel kesobb semmilyen valtozo-ertek mellett nem er semmit a proba-kulcs

const sha256hex = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');

/** A proba-kulcs ervenyes-e (csak fejlecbol, allando ideju osszehasonlitas, lejarattal). nowMs: a hivo ideje. */
export async function probaKulcsEllenorzes(request, env, nowMs = Date.now()) {
  const hash = String((env && env.GOOGLE_PROBA_KULCS_HASH) || '').toLowerCase();
  const adott = request.headers.get('x-egyeztetes-kulcs') || '';
  const lejar = Date.parse(String((env && env.GOOGLE_PROBA_KULCS_LEJAR) || ''));
  if (!/^[0-9a-f]{64}$/.test(hash) || !adott || !Number.isFinite(lejar)) return false;
  if (nowMs >= Math.min(lejar, PROBA_KULCS_PLAFON_MS)) return false; // lejart (a valtozo szerint vagy a kemeny plafon szerint)
  const a = await sha256hex(adott); let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ hash.charCodeAt(i);
  return d === 0 && a.length === hash.length;
}

/** A proba-kulcs hasznalatanak naplozasa (D1). Hiba eseten false (a hivo elutasit): naplo nelkul nincs muvelet. */
export async function probaKulcsNaplo(db, { muvelet, kuld, eles }, nowMs = Date.now()) {
  try {
    await db.prepare('CREATE TABLE IF NOT EXISTS proba_kulcs_naplo (id INTEGER PRIMARY KEY AUTOINCREMENT, ido INTEGER NOT NULL, muvelet TEXT NOT NULL, kuld INTEGER NOT NULL, eles INTEGER NOT NULL)').run();
    await db.prepare('INSERT INTO proba_kulcs_naplo (ido, muvelet, kuld, eles) VALUES (?1, ?2, ?3, ?4)').bind(Math.floor(nowMs / 1000), String(muvelet).slice(0, 40), kuld ? 1 : 0, eles ? 1 : 0).run();
    return true;
  } catch (e) { return false; }
}
