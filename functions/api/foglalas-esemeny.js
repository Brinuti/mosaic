// Cloudflare Pages-fuggveny: a foglalasi "jegyzettomb" (lasd netlify/lib/foglalas-esemeny.js es docs/booking-engine/DECISIONS.md).
//   GET  /api/foglalas-esemeny?uzletag=hair&szolgaltatas=1,2   -> {"kor_ms": <az utolso foglalas kora ms-ban> | null}
//   POST /api/foglalas-esemeny   {"uzletag","szolgaltatas","kezdes","vendeg"}   -> {"irva": bool, "ok": "..."}
// Beallitas (wrangler.toml): ESEMENYEK = a KV-nevter (eles / elonezet kulon); az eles iras kapcsoloja: ESEMENY_IRAS = "1".
import { kezel } from '../../netlify/lib/foglalas-esemeny.js';

export const onRequest = (context) => kezel(context.request, context.env);
