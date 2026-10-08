// Az elhagyott fizetesek emlekeztetoinek HATTERINDITASA: nincs kulso idozito (cron / GitHub Actions), hanem az ajandekkartya-oldal minden betoltese
// (GET /api/ajandek/beallitas) elinditja a hatterben, legfeljebb 20 percenkent (isolate-memoria + a KV-ban egy rovid eletu "zar"). A tenyleges munka
// idempotens (a PaymentIntent metadataban van az allapot, a bejegyzes a kuldes elott tortenik), ezert a kisebb tulfutas nem okoz duplikatumot.
// A kereskedo-motor: netlify/lib/ajandek.js (emlekeztetoFuttat). Tesztelheto: minden fuggoseg kivulrol jon.
export const KOZ_MS = 20 * 60 * 1000;
const ELES_HOST = /^(www\.)?mosaicheadspa\.hu$/;
const ZAR_KULCS = 'emlekezteto_zar';
const ZAR_TTL_MP = 15 * 60;
let utolso = 0;
export function _alaphelyzet() { utolso = 0; }

// -> true, ha a hatterfeladat elindult (egyebkent: nem eles host / nincs mit inditani / meg nem telt el az ido)
export function emlekeztetoIndit({ waitUntil, env, url, futtat, postasKeszit, ma = () => Date.now() } = {}) {
  if (typeof waitUntil !== 'function' || typeof futtat !== 'function' || typeof postasKeszit !== 'function') return false;
  const e = env || {};
  let host = '';
  try { host = new URL(url).hostname; } catch { return false; }
  // csak az eles oldalon (az elonezetek sandbox-Stripe-ja nem kuld vevoknek levelet), kiveve ha az elonezeten kifejezetten be van kapcsolva
  if (!ELES_HOST.test(host) && String(e.AJANDEK_EMLEKEZTETO || '') !== '1') return false;
  if (String(e.AJANDEK_EMLEKEZTETO || '') === '0') return false;     // kikapcsolo
  const most = ma();
  if (most - utolso < KOZ_MS) return false;
  utolso = most;
  waitUntil((async () => {
    try {
      const kv = e.AJANDEK_FOTOK;
      if (kv && typeof kv.get === 'function' && typeof kv.put === 'function') {
        if (await kv.get(ZAR_KULCS)) return;            // egy masik isolate mar fut / nemrég futott
        await kv.put(ZAR_KULCS, String(most), { expirationTtl: ZAR_TTL_MP });
      }
      const p = postasKeszit(e);
      try {
        const v = await futtat({ env: e, kuld: (l) => p.kuld(l), most: new Date(most), url });
        if (v && v.kuldve) console.log('ajandek: emlekeztetok elkuldve:', v.kuldve);
      } finally {
        try { await p.zar(); } catch { /* mar lezarult */ }
      }
    } catch (err) {
      console.error('ajandek: emlekezteto hatterfeladat hiba:', err && err.message);
    }
  })());
  return true;
}
