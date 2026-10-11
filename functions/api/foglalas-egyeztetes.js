// Cloudflare Pages-fuggveny: az e-mail-oldali parositas (lasd netlify/lib/foglalas-kulcs.js, docs/booking-engine/BOOKING_ID.md).
//   POST /api/foglalas-egyeztetes   {"uuid","host","felado","szolgaltatas","idopont_szoveg","munkatarsak":[..],"ld":{startDate},"level_datuma"}  VAGY  {"email_html": "..."}  (kulcsos)
//        -> {allapot: parositott | fuggoben | parositatlan | ellentmondas, kuldheto, booking_id, esemeny_id, kulcs, ujraprobal_mp, riasztas, nyom}
//   POST {"nevtabla":"frissit"[,"uzletag":"headspa"]}   -> a nevtabla frissitese a Salonic-fiokokbol (a tabla max. 24 oras; ismeretlen nevre a fiok celzottan maga is frissul)
//   POST {"tipus":"lemondas", "felado","szolgaltatas","idopont_szoveg","munkatarsak","level_datuma"}  VAGY  {"email_html": <lemondasi ertesito>}   -> a kulcs felszabadulasa, ha a birtokos foglalas a Salonic-oldalan ELO ellenorzessel torolve
//   QA-2: a parositott foglalasra (MERES_ELOSZTO=1) az alap- es ernyoesemenyek arnyek-kuldese: bemenet vendeg {email, telefon}, uj_vendeg (Salonic-jelzes), ar (tartalek); valasz: esemeny_kuldes
//   GET  ?uuid=..  -> a parositas allapota;  GET ?riasztas=1[&formatum=html]  -> a parositatlan / ellentmondo foglalasok;  GET ?nevtabla=1  -> a nevtabla meretei
//   Salonic-direct safety net (DECISION #127 (b); alapbol KI: MERES_SALONIC_DIRECT=1 + D1-kapcsolo): POST {"muvelet":"sd_atvetel", uuid, host, vendeg{email,telefon}, nev, uj_vendeg, szolgaltatas, munkatarsak, level_datuma, megjegyzes, ar?, szaraz?}
//        (a Zap 5. lepese, >= 20 perccel a letrehozo level utan; szaraz:true = irasmentes terv), {"muvelet":"sd_feloldas", ...ugyanaz, dontes:"confirmed"|"uj_konverzio", ok}, {"muvelet":"vendeg_index", elemek:[..]} (hash-index backfill, kuldes nelkul);
//        GET ?sd_riasztas=1 -> halasztva / tartva / lejart / old_booking_still_active / sd_hianyzik
// Minden hivas kulcsos (x-egyeztetes-kulcs fejlec vagy ?kulcs=): kulcs nelkul / rossz kulccsal 404. Beallitas: KULCS_DB, EGYEZTETES_KULCS_HASH (wrangler.toml).
import { kezelEgyeztetes, nevtablaSalonicbol } from '../../netlify/lib/foglalas-kulcs.js';
import { createSalonicAdapter } from '../../assets/js/booking-engine/salonic-adapter.js';
import { foglalasEsemenyKuldes } from '../../netlify/lib/meres/foglalas-esemeny.js';
import { sdKezel, vendegIndexIr, sdRiasztasok } from '../../netlify/lib/meres/salonic-direct.js';

export const onRequest = (context) => kezelEgyeztetes(context.request, context.env, {
  esemenyKuldo: foglalasEsemenyKuldes, // QA-2 ARNYEK: csak MERES_ELOSZTO=1 mellett fut (alapbol ki)
  // Salonic-direct safety net (DECISION #127 (b)): sd_atvetel / sd_feloldas / vendeg_index muveletek + hash-index horog + riasztasok; MINDEN MERES_SALONIC_DIRECT=1 + D1-kapcsolo moge zarva (alapbol ki)
  sdKezelo: sdKezel, vendegIndexIr, sdRiasztasok,
  // uzletag nelkul az osszes fiok, uzletaggal csak az (celzott ujraepites ismeretlen nev miatt)
  nevtablaFrissito: (uzletag) => nevtablaSalonicbol({ fetchImpl: fetch, adapterGyar: createSalonicAdapter, uzletagok: uzletag ? [uzletag] : undefined }),
});
