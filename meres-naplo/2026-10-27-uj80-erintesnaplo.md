# 2026-10-27 – UJ-80 Érintésnapló (#495), DRAFT

MÉRÉST ÉRINTŐ, alapból KI. Részletek: [docs/booking-engine/ERINTESNAPLO.md](../docs/booking-engine/ERINTESNAPLO.md).

* Új: `netlify/lib/meres/erintesnaplo.js`, `functions/api/mosaic-erintes-riport.js`, `tools/test-erintesnaplo.mjs`.
* Módosítva: `netlify/lib/meres/forras-lpt.js` (mh_vid a `/api/mosaic-forras`-ban, útvonal-zárás az `erkezesForrassal`-ban; az mh_lpt logika változatlan), `assets/js/attribucio.js` (landing útvonal a fizetett POST-ban; napi 1 organikus jelzés), `foglalas/suti-tajekoztato.html`, `wrangler.toml` (csak megjegyzés).
* Védett fájlok (platformok / elosztás / meta-bongeszo-kulcs / esemeny-modell / qa-nap / vegpontok, gyogytorna, medicalpiercing): érintetlenek.
* Tesztek: test-erintesnaplo 26/26, test-lpt-forras 58/58.
* Nincs vendégadat; nyers vid / kattintásazonosító a D1-ben nincs.

* Mérési spec-ellenőrzés (#498, 6435430910) két kiegészítése: hirdetéscsoport-szint (`g`, riport `hirdetescsoport`) és a hirdetés forrása (`af`, `szint_bizonytalan`). Tesztek: test-erintesnaplo 27/27.
