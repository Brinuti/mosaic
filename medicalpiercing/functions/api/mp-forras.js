// POST /api/mp-forras: forras v2 - hirdetesi hozzajarulassal az utolso fizetett erintes 30 napos, szerver altal irt, HttpOnly
// elso feles sutije (mp_lpt). Hozzajarulas nelkul suti nincs (a meglevot torli). Leiras: lib/meres/cimke.js, docs/MERES_GOOGLE_ARNYEK.md.
import { forrasVegpont } from '../../lib/meres/cimke.js';

export async function onRequest(context) {
  try {
    return await forrasVegpont({ request: context.request, env: context.env });
  } catch (e) {
    console.error('mp-forras: belso hiba', String(e && e.message || e).slice(0, 200));
    return new Response(JSON.stringify({ ok: false, hiba: 'belso_hiba' }), { status: 500, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }
}
