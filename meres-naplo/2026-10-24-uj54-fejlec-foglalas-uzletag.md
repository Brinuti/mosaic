# UJ-54 - a fejlec "Foglalas" link hordozza az oldal uzletagat (2026-10-24)

**Mit valtoztat:** `tools/foglalo-atkotes.mjs` `belsoCel()`: a fomenu (asztali + mobil) "FOGLALAS" gombja az uzletag-specifikus oldalakon
`/foglalo-motor?business=<uzletag>`-re mutat (lezer: `laser`, fodraszat: `hair`, oxigen: `oxygen`, pmu: `pmu`) a korabbi uzletag nelkuli `/foglalo-motor` helyett.
A HeadSpa-oldalak, a besorolatlan oldalak (blog, kapcsolat, aszf ...) es a launcher nelkuli oldalak (koszonooldalak) valtozatlanok.
Ugyanaz a `fejlec` kapcsolo vezerli (`FOGLALO_ATKOTES`), tehat kikapcsolhato.

**Miert:** uj lapon / hosszu erintes / JS nelkul a `/foglalo-motor` uzletag nelkul HeadSpa-ra esik (`flow.js`, `engine.js`) -> tevesen HeadSpa-foglalas, torz forras.
JS-sel a reteg eddig az uzletag-valasztot nyitotta (H0); most a megfelelo uzletag kezdo nezetet.

**Mit NEM:** foglalo-motor kod, mero kod, GTM, hirdetes: nem valtozik. Kevesebb adat nincs: csak a helyes uzletagba kerul a foglalas.

## Meres (dist build, ELES=1, helyi kiszolgalas, kulso keresek tiltva)
- A `/_a` es `/_m` oldalakon a fejlec "Foglalas" linkek eloszlasa (oldalankent, csak amelyiken launcher van): `business=laser` 21, `business=hair` 15, `business=oxygen` 3 + 2 (`&service=466147` mar korabban), `business=pmu` 3, altalanos `/foglalo-motor` 71 (HeadSpa + besorolatlan); 23 koszono/kihagyott oldal valtozatlanul `/idpontfoglalas` (nincs launcher).
- Nevesitett oldalak: `lezeres-szortelenites-budapest` -> `business=laser`, `noi-fodraszat-budapest` es `noi-fodrasz-budapest-balayage-hajfestes` -> `business=hair`, `oxigenterapia-budapest` -> `oxygen`; `headspa-budapest` -> `/foglalo-motor` (valtozatlan). Asztali (1280) es mobil (390, iPhone UA) is; a mobil menuben a rejtett masodik link is azonos.
- JS-sel a fejlec-linkre kattintva a foglalo-reteg (`#mosaic-booking-layer`) az oldal uzletagat nyitja ("Lezeres szortelenites", "Fodraszat", "Oxigenterapia"); HeadSpa-n az altalanos valaszto ("Mit szeretnel foglalni?") - 10/10 (5 oldal x asztali + mobil).
- Uj lapon a `href` kozvetlen megnyitva: `/foglalo-motor?business=laser` -> Lezeres szortelenites (#LA1), `hair` -> Fodraszat (#HA0), `oxygen` -> Oxigenterapia (#OX1); uzletag nelkul HeadSpa (#HS1) - 10/10.
- A Salonic-hivasok a probaban tiltva voltak (a retegben "nem sikerult betolteni az idopontokat" latszik) - a nem-valodi Salonic miatt a szabad idopontok nem ellenorizhetok; valodi iPhone Safari itt nincs.
- Tesztek: `tools/test-foglalo-atkotes.mjs` (belsoCel: 10 fajl x 2 felirat), `tools/test-foglalas-cel.mjs` zold; teljes csomag 657/661, a 3 hiba ugyanaz, mint a tiszta `main`-en.

Merge: csak Feri "mehet"-jevel (webes belepesi pont). Rollback: merge-commit revert.
