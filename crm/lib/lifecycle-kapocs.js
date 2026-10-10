// A meglevo lifecycle (functions/api/lifecycle/bejovo) KESOBBI kapcsa az uj CRM-hez: a parser elemzett esemenyenek masolata a CRM_DB-be.
//
//   kapocs(env, esemeny, opc?) -> Promise<{ ok, ... }>   SOHA nem dob kivetelt, SOHA nem utasit el (mindig teljesul), idokorlattal.
//
// - Ha nincs env.CRM_DB binding (vagy env.CRM_KAPOCS === 'ki'): semmit nem csinal ({ ok: true, kihagyva: 'nincs_CRM_DB' }).
// - Hiba eseten ({ ok: false, hiba }) a lifecycle folytatodik; a hibat a hivo naplozhatja. Idokorlat: opc.idokorlatMs (alap 2500 ms) - lassu CRM nem lassithatja a lifecycle-t.
// - Hasznalat: ctx.waitUntil(kapocs(env, esemeny)) vagy `await kapocs(env, esemeny)` (mindkettő biztonsagos).
import { ingestLifecycleEsemeny } from './ingest.js';

export const KAPOCS_IDOKORLAT_MS = 2500;

export async function kapocs(env, esemeny, opc = {}) {
  let idozito = null;
  try {
    if (!env || !env.CRM_DB || env.CRM_KAPOCS === 'ki') return { ok: true, kihagyva: 'nincs_CRM_DB' };
    if (!esemeny || typeof esemeny !== 'object') return { ok: true, kihagyva: 'nincs_esemeny' };
    const idokorlat = Number.isFinite(opc.idokorlatMs) ? opc.idokorlatMs : KAPOCS_IDOKORLAT_MS;
    const munka = Promise.resolve().then(async () => {
      const r = await ingestLifecycleEsemeny(env.CRM_DB, esemeny, { most: opc.most });
      // a landingen (e-mail / telefon alapjan) elore rogzitett marketing-hozzajarulas hozzakapcsolasa a frissen beerkezett foglalas vendegehez (hiba nem ront a foglalas atvetelen)
      try { const { fuggoHozzajarulasSweep } = await import('./api-public.js'); await fuggoHozzajarulasSweep(env.CRM_DB, { now: opc.most ?? Math.floor(Date.now() / 1000) }); } catch { /* a hozzajarulas-kapcsolas ujraprobalhato (/tick) */ }
      return r;
    }).then(
      (r) => ({ ok: r?.ok !== false, eredmeny: r?.valtozas ?? (r?.figyelmen_kivul ? 'figyelmen_kivul' : null), ok_kod: r?.ok_kod ?? null }),
      (e) => ({ ok: false, hiba: String(e?.message || e).slice(0, 200) }),
    );
    const lejar = new Promise((resolve) => { idozito = setTimeout(() => resolve({ ok: false, hiba: 'idotullepes' }), idokorlat); });
    return await Promise.race([munka, lejar]);
  } catch (e) {
    return { ok: false, hiba: String(e?.message || e).slice(0, 200) };
  } finally {
    if (idozito) clearTimeout(idozito);
  }
}
