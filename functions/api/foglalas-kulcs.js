// Cloudflare Pages-fuggveny: a foglalas-kulcs tabla (lasd netlify/lib/foglalas-kulcs.js, docs/booking-engine/BOOKING_ID.md).
//   POST /api/foglalas-kulcs   {"booking_id","booking_url"}   -> a koszonooldal irja (csak azonos eredetrol): kulcs (placeId|employeeId|startUnix) -> booking_id, felulirast nem enged
//   GET  /api/foglalas-kulcs?kulcs=<olvaso kulcs>&k=<kulcs>   -> a rekord (kulcsos)
// Beallitas (wrangler.toml): KULCS_DB = a D1 adatbazis (eles / elonezet kulon; az elesben a kotes csak az elesites donteseig hianyzik: 503, a koszonooldal ezt elnyeli);
// EGYEZTETES_KULCS_HASH = az olvaso kulcs SHA-256-ja.
import { kezelKulcs } from '../../netlify/lib/foglalas-kulcs.js';

export const onRequest = (context) => kezelKulcs(context.request, context.env);
