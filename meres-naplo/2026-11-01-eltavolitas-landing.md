# 2026-11-01 – /sminktetovalas-eltavolitas-budapest (új oldal) – teszt-napló

Változás: csak új fájlok (oldal, CSS, JS, képek, videó, teszt, doksi). Mérést érintő változás: **nincs** (suti.js, GTM, pixel, foglalo-pmu.js változatlan).
Új, semmihez nem kötött dataLayer-esemény: `eltavolitas_foto_lead` (lásd docs/ELTAVOLITAS_LANDING.md).

- `tools/eltavolitas-teszt/eltavolitas.test.mjs`: 17/17 zöld (statikus 7: noindex, nincs sitemap/#-link/mérőkód, tiltott kifejezések, hivatkozott fájlok, üzletág=pmu, EXIF-mentes képek;
  böngészős 10: mobil 390 px + asztali 1366 px – nincs JS-hiba, nincs vízszintes kilógás, H1 ≤ 2 sor mobilon, a fő gomb az első képernyőn, nincs árva szó; űrlap-ellenőrzés,
  a beküldött mezők eltávolítás-jelöléssel + 2 fotó, a dataLayer-esemény csak hozzájárulással és PII nélkül, ragadós sáv, görgetés URL-változás nélkül).
- Meglévő tesztek alapvonala (origin/main a51de11a) és az ággal: azonos eredmény (tools/ajandek-teszt/menu 19/20, tools/headspa-teszt/akciossav 3/4, tools/hero-teszt 19/28, tools/headspa-teszt/fejlec 42/44;
  google-szam 12/12) – a hibák a hónapváltás szövegeihez kötődnek, nem ehhez a változáshoz.
- Védett hash-ek: változatlanok (nincs módosított meglévő fájl).
- Rollback: a PR revertje (csak új fájlok).
