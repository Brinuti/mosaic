# 2026-11-01 – /sminktetovalas-eltavolitas-budapest (új oldal) – teszt-napló

Változás: csak új fájlok (oldal, CSS, JS, képek, videó, teszt, doksi). Mérést érintő változás: **nincs** (suti.js, GTM, pixel, foglalo-pmu.js változatlan).
Új, semmihez nem kötött dataLayer-esemény: `eltavolitas_foto_lead` (lásd docs/ELTAVOLITAS_LANDING.md).

- `tools/eltavolitas-teszt/eltavolitas.test.mjs`: 21/21 zöld (statikus 8: + method="post"; noindex, nincs sitemap/#-link/mérőkód, tiltott kifejezések, hivatkozott fájlok, üzletág=pmu, EXIF-mentes képek;
  böngészős 13: + szerverhiba (HTTP 500) → hibaüzenet, az űrlap és a fotók megmaradnak, újrapróba sikerül; legfeljebb 5 fotó + törlés + aria-invalid + fókuszsorrend; JS nélkül POST a saját címre, az adat nincs az URL-ben; mobil 390 px + asztali 1366 px – nincs JS-hiba, nincs vízszintes kilógás, H1 ≤ 2 sor mobilon, a fő gomb az első képernyőn, nincs árva szó; űrlap-ellenőrzés,
  a beküldött mezők eltávolítás-jelöléssel + 2 fotó, a dataLayer-esemény csak hozzájárulással és PII nélkül, ragadós sáv, görgetés URL-változás nélkül).
- Meglévő tesztek alapvonala (origin/main a51de11a) és az ággal: azonos eredmény (tools/ajandek-teszt/menu 19/20, tools/headspa-teszt/akciossav 3/4, tools/hero-teszt 19/28, tools/headspa-teszt/fejlec 42/44;
  google-szam 12/12) – a hibák a hónapváltás szövegeihez kötődnek, nem ehhez a változáshoz.
- Védett hash-ek: változatlanok (nincs módosított meglévő fájl).
- Rollback: a PR revertje (csak új fájlok).

- Független review (2026-11-01, PR #579): első kör FAIL (B1: hiányzó method="post"; B2: a Zapier-lánc / SMS nincs dokumentálva) – mindkettő javítva; a megjegyzések közül javítva: kockázatos szövegek (alt, „alakul ki”, „kell halványítani”), a ragadós sáv ikonja és rejtett fókusza, aria-invalid / aria-describedby, a fókusz sorrendje, a fotófeldolgozás sorba állítása és zárolása, ImageBitmap.close(), `celoldal` osztály törölve. Nyitva (Feri / Melitta): lásd docs/ELTAVOLITAS_LANDING.md „megerősítendő” 1–9.
- Zapier-lánc (csak olvasás): `weboldal-pmu-visszahivas-to-sheet-oktober` + `melitta-pmu-oktober-sms` engedélyezve; a lead-levelünk a trigger-lekérdezésre illeszkedik és a Zap minden mezőjét értelmezi; módosítás nincs.

- Feri visszajelzése után (2026-11-01, 2. kör): új felépítés (hero egy kártyában ár + cím, Google-értékelés a gombok alatt, a videó alatta; 3 előtte–utána pár egyforma képmérettel; formázott, középre igazított árak; a sminktetoválás-oldalak garancia-, GYIK- és helyszín-blokkja újrahasznosítva; slim ragadós sáv ~55 px). Tesztek: 21/21.
