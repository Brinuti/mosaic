// Cloudflare Pages-fuggveny: az e-mail-oldali parositas (lasd netlify/lib/foglalas-kulcs.js, docs/booking-engine/BOOKING_ID.md).
//   POST /api/foglalas-egyeztetes   {"uuid","host","felado","szolgaltatas","idopont_szoveg","munkatarsak":[..],"ld":{startDate},"level_datuma"}  VAGY  {"email_html": "..."}  (kulcsos)
//        -> {allapot: parositott | fuggoben | parositatlan | ellentmondas, kuldheto, booking_id, esemeny_id, kulcs, ujraprobal_mp, riasztas, nyom}
//   POST {"nevtabla":"frissit"}   -> a nevtabla frissitese a Salonic-fiokokbol (a tabla max. 24 oras; keresre maga is frissul)
//   GET  ?uuid=..  -> a parositas allapota;  GET ?riasztas=1[&formatum=html]  -> a parositatlan / ellentmondo foglalasok;  GET ?nevtabla=1  -> a nevtabla meretei
// Minden hivas kulcsos (x-egyeztetes-kulcs fejlec vagy ?kulcs=): kulcs nelkul / rossz kulccsal 404. Beallitas: KULCS_DB, EGYEZTETES_KULCS_HASH (wrangler.toml).
import { kezelEgyeztetes, nevtablaSalonicbol } from '../../netlify/lib/foglalas-kulcs.js';
import { createSalonicAdapter } from '../../assets/js/booking-engine/salonic-adapter.js';

export const onRequest = (context) => kezelEgyeztetes(context.request, context.env, {
  nevtablaFrissito: () => nevtablaSalonicbol({ fetchImpl: fetch, adapterGyar: createSalonicAdapter }),
});
