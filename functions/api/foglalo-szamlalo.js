// Cloudflare Pages-fuggveny: a nevtelen foglalo-lepes szamlalo (lasd netlify/lib/foglalo-szamlalo.js, docs/booking-engine/LEPES_MERES.md).
//   POST /api/foglalo-szamlalo   {"lepes","uzletag","tipus"?,"load_ms"?}   -> 204 (csak azonos eredetrol)
//   GET  /api/foglalo-szamlalo?kulcs=...&nap=2026-10-05[&formatum=json|csv|html]   -> a napi osszesitett szamok (kulcsos)
// Beallitas (wrangler.toml): SZAMLALO_DB = a D1 adatbazis (eles / elonezet kulon); SZAMLALO_OLVASO_HASH = az olvaso kulcs SHA-256-ja.
import { kezel } from '../../netlify/lib/foglalo-szamlalo.js';

export const onRequest = (context) => kezel(context.request, context.env);
