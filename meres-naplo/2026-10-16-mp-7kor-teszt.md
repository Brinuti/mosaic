# Medical Piercing – 7. kör: álló videók borítója, behelyezés-dobozok, árlista-kártyák, foglaló (alapból 2–3 piercing, garancia-szöveg) – teszt-napló (2026-10-16)

Helyben, a végleges buildre (`node tools/build.mjs`, `node tools/serve.mjs`). A Salonic felé csak olvasó GET megy, foglalás nem indult.

## A tulajdonos kérései
1. „Az állóvideókkal fuss még egy kört … ezt is kiadtad (utóápolás), és biztos van más is … erre is generálj szépen thumbnailt.”
2. A foglalóban a garancia szövege: „ha 6–7 hét után nem tapasztalsz javulást, megerősítő piercinget szúrunk” (a „6 hónapon belül … csak az új ékszer áráért” helyett), rövidebben.
3. Árlista-kártyák: minden középre (ikon, cím, áthúzott ár), az áthúzott ár és a keret ne szürke legyen.
4. Foglaló: alapból a „2–3 piercing” (Legjobban megéri) legyen kiválasztva; a „Magamnak / 2 személynek” kicsit feljebb, a „Legjobban megéri” nyíllal a 2–3 piercinghez.
5. A végén a TikTok-landoló linkje.

## Mérés
**Mérőkódot nem érint.** A mérőkód fájljai (`suti.js`, `mp-meres.js`, `motor-indito.js`, `salonic-adapter.js`, `booking-id.js`) nem változtak. A foglalóban (`motor.js`) csak
a Piercing-lépés alapértelmezett szűrője (2–3 piercing), a jelölés stílusa és a garancia-mondat változott – a foglalási út (`[data-szolg]`), a foglalásindítás mérése
(GA4 `foglalas_inditasa`, TikTok InitiateCheckout) és a köszönőoldali mérés ugyanaz. A foglalási folyamat látható alapértéke a tulajdonos saját, kifejezett kérésére változott.

## Vendégadat
Az álló videók közül 12 landolóoldali vendégvideó ugyanaz, mint a Drive-ról jött 37 közül egy (képkocka-egyezés), ezek a meglévő borítót kapták. Az egy új vendég-borítón
a keresztnév a videó saját címkártyájáról való, a mondat a videóban elhangzott; az adatfájl és a kivágott kocka a repóba nem került. A fájlnevekben nincs név.
A piercereink (Ricsi, Fanni, Brigi) kockái a repóban (`tools/kep-forras/allo/`), felirat nélküli valódi kockák; arcot nem módosítottunk.

## Eredmények
| Teszt | Eredmény |
|---|---|
| `tools/uj-oldalak-teszt.mjs --forras` | 1224 ellenőrzés, 0 hiba (a dupla-link ellenőrzés már a `<strong>`-os eredeti linket is látja; a javítás előtt 8 oldalon kétszer állt) |
| `tools/uj-oldalak-teszt.mjs` (mind) | 174 oldal, 5727 ellenőrzés, 0 hiba |
| `tools/uj-fooldal-teszt.mjs` | minden rendben (102 ellenőrzés) |
| `tools/motor-tipus-teszt.mjs` / `--mobil` | minden rendben (új: alapérték Magamnak + 2–3 piercing; a „Legjobban megéri” jelölés nyíllal a 2–3 piercing gomb fölött; 1 piercing kattintásra) |
| `tools/motor-teszt.mjs` / `--mobil`, `tools/motor-formazas-teszt.mjs` | minden rendben |
| Álló videók (Playwright, 16 oldal, 1440 / 1100 / 820 / 390) | a videódoboz és a borító aránya mindenhol egyezik (0 eltérés > 3%); mind a 64 lejátszás-gomb a videó látható helyén |
| Szemrevételezés | utóápolás és Brigitta-oldal hőse: a videó mellett nincs fehér sáv; „Így néz ki egy … behelyezés” dobozok: a 4 lépés a videó mellett (asztali, mobil); árlista-kártyák középen, rózsás áthúzott ár és keret; foglaló: iPhone 13, 360 px, asztali |

Az első tesztfutás alatt újraépítettem az oldalt, ettől 3 foglaló-teszt egyszer elbukott (üres lap a build közben); az újrafuttatás (build nélkül) hibátlan.
