// Az uj stilusu oldalak elesitese (a tulajdonos kerese, 2026-10-16: "tedd elesbe ezt az oldalt, csereld le az eredeti oldallal").
//
//   UJ_ELES = true:  az uj oldalak az eredeti cimeken (/, /migren-piercing ...), a keresok indexelik (a regi oldal SEO-fejlecevel: cim, leiras,
//                    canonical, og/twitter, ld+json, ellenorzo cimkek, robots); a regi Wix-klon rejtve a /regi/<eredeti utvonal> cimen (noindex);
//                    a korabbi /uj/... es /uj-fooldal cimek 301-gyel az eredeti cimre visznek.
//   UJ_ELES = false: a regi Wix-klon az eredeti cimeken, az uj oldalak rejtve a /uj/... es /uj-fooldal cimen (noindex) - a 2026-10-16 elotti allapot.
//
// Visszaallitas: UJ_ELES = false, push (egy build). Hasznalja: lib/utvonal.js, functions/[[path]].js, tools/build.mjs, tools/uj-fooldal.mjs, a tesztek.
export const UJ_ELES = true;
export const REGI_ELO = '/regi';
