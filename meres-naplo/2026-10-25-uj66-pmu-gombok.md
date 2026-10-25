# UJ-66: a PMU-oldalak lablec / Info-ablak gombja a PMU foglalora mutat (2026-10-25)

**Kerdes (01-MERES, #167 6393917153 / 6394435311):** a `pmu-foglalas` oldalon a lablec `mhl-gomb` es az Info-ablak `mhp-gomb mhp-arany` gombja `business=headspa`-t nyitott, a lezer / fodrasz / oxigen oldalakon viszont a sajat uzletagat. Kockazat: a PMU-oldalrol inditott foglalas rossz motorba / uzletagba kerul.

**Ok:** a gombok celjat az oldal fajlneve adja (`oldalUzletag`, tools/foglalo-atkotes.mjs); csak a `sminktetovalas*` / `szajtetovalas*` neveket ismerte PMU-nak, a `pmu-foglalas` (es a `pmu-ok`, `pmu-vh`, `pmu-melitta`, `pmu-sminktetovalas`, `foglalo-pmu`) besorolatlan, ezert HeadSpa maradt.

**Valtozas:** egyetlen regex: `^(sminktetovalas|szajtetovalas|pmu-|foglalo-pmu$)` -> `pmu`. Kovetkezmeny (mind a build-lancban): a lablec / Info-ablak gombja `business=pmu`; a fejlec FOGLALAS gombja a PMU-oldalon `business=pmu` (UJ-54 szabaly); az `/idpontfoglalas` tartalmi gombjai pmu. A HeadSpa / besorolatlan oldalak (blog, GYIK, arlista, kapcsolat ...) valtozatlanok.

**Teszt:** `test-foglalo-atkotes` 19/19 (a 19. teszt: az oxigen-uj.js tartalek-link szandekos kivetel, a mérési oldal engedelyevel - #167 6388556648), `test-foglalas-cel` 13/13 a dist-en (asztali + mobil, 290 oldal). Dist-build: a `pmu-foglalas`, `szajtetovalas-budapest`, `sminktetovalas-budapest` lablec + Info-ablak gombja `business=pmu` (2-2 asztali es mobil); a PMU-oldalak kozul egyiken sem maradt `business=headspa` gomb (`arlista`, `gyik` vegyes oldal, valtozatlan).

**Mereset erinti:** csak a belepesi pont celja (a foglalo-motor `business` parametere); foglalomotor-kod, meroko'd, GTM, hirdetes nem valtozik. Vedett fajl nincs a diffben. Rollback: a merge-commit revertje.
