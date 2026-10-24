# GYT gbraid / wbraid feltoltes - `GY_GADS_BRAID` (2026-10-24, draft)

**Kerdes (01-MERES, #167 6382033130, 2. kerres):** miert hagyjuk ki a gbraid / wbraid kattintast? **Valasz:** tervezesi ovatossag volt (GY-25, 2026-10-21); technikai korlat nincs.

**Mit csinal a PR:** uj kapcsolo `GY_GADS_BRAID` = `ki` (alap) | `be`. Alapbol a viselkedes BAJTRA valtozatlan (kihagyva_braid, a vedohalo a braid-mezot elutasitja). `be` eseten:
- a csak gbraid / wbraid kattintasu foglalasok is `varakozik` allapotba kerulnek (ugyanazok az ellenorzesek: click-ID hossz >= 20 / karakter / TESZT-karanten, idosorrend, consent-szabaly);
- a kimeno kerestorzs egy click-ID-t hordoz soronkent (`gclid` VAGY `gbraid` VAGY `wbraid`); a `vedohalo` ezt engedi (pontosan egy, ervenyes hosszu), minden mas mezo tiltva marad;
- a legutobbi 7 nap `kihagyva_braid` sorai (eles mod) torlodnek, es a felvetel a teljes ellenorzesekkel ujra letrehozza oket (a 10-24-i 1 sor igy utolag is kimehet).

**Aktiv meres:** a masodlagos `7858300772` (ARNYEK, `include_in_conversions_metric=false`) akcio kap TOBB adatot; a gclid-es folyamat, a foglalasi folyamat, a hirdetes nem valtozik. A kapcsolo `ki`-re allitasa a regi viselkedes (a mar feltoltott konverziokat nem vonja vissza).

**Ami NEM ennek a PR-nek a resze (kulso fiok):** az elo GYT Zap (`01a15e4d`) sajat vedohaloja jelenleg csak `gclid`-et enged - a kapcsolo bekapcsolasa elott a Zap-draftnak is engednie kell a `gbraid` / `wbraid` mezot (Zapier-draft; publikalas kulon engedellyel). Amig ez nincs, a kapcsolo `ki` marad.

**Nem erintett (VEDETT):** `gfeltoltes.js` (modositott, dokumentalt: `d94560f394` -> `6f5deb2070`), `tools/gfeltoltes-hid.mjs` (a hid a `kuldesElotti`-t braid nelkul hivja, ezert a hid-uton a braid tovabbra is kihagyva; az elo ut a Zap).
