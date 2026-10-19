// Cloudflare Pages-fuggveny: 7 napos utolso fizetett kattintas (forrasmeres, mind az 5 uzletag): a szerver altal irt, HttpOnly mh_lpt suti (POST) es a kattintasazonosito visszanyerese (GET).
// A logika: netlify/lib/meres/forras-lpt.js; leiras: docs/booking-engine/FORRAS_LPT.md. Veszkapcsolo: MOSAIC_LPT_KI=1 (503).
import { forrasVegpont } from '../../netlify/lib/meres/forras-lpt.js';

export async function onRequest(context) {
  try {
    return await forrasVegpont({ request: context.request, env: context.env });
  } catch (e) {
    console.error('mosaic-forras: belso hiba', String(e && e.message || e).slice(0, 200));
    return new Response(JSON.stringify({ ok: false, hiba: 'belso_hiba' }), { status: 500, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  }
}
