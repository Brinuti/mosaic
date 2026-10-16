# Medical Piercing /uj oldalak és foglaló, 3. kör – teszt-napló (2026-10-16)

Helyben, a végleges buildre (`node tools/build.mjs`, `node tools/serve.mjs`). A Salonic felé csak olvasó GET megy, a `/api/urlap` kéréseket a tesztek elfogják, foglalás nem indult.

## Mérést / foglalást érintő változások (a tulajdonos kifejezett kérései)
- A „Kiesett ékszer újraszúrása” belsős Salonic-szolgáltatás: a foglaló piercing-listájából kimarad (nem foglalható); az „Ékszercsere / visszarakás” visszahívó űrlap
  legördülőjében kérhető (2 új lehetőség). Az űrlap mezőnevei, sorrendje, végpontja változatlan; a típus kódja (`ekszercsere`) is (a mérés ezt használja), csak a kártya felirata új.
- A szűrősor („2 személynek”, „Legjobban megéri” a 2–3 piercingen), a pontos értékelésszám (`/api/ertekeles`), a „Hogy néz ki egy szúrás?” új videója (saját TikTok-videó, helyben),
  a térkép infoboxa és a fejlécben a választott város: csak megjelenés, a foglalási út, a `[data-szolg]` gombok és a mérési események nem változtak.
- A mérőkód fájljai (`mp-meres.js`, `suti.js`, `motor-indito.js`, `salonic-adapter.js`, `booking-id.js`) nem változtak.

## Eredmények
| Teszt | Eredmény |
|---|---|
| `tools/uj-oldalak-teszt.mjs` (mind) | 174 oldal, 5552 ellenőrzés; 9 hiba: a piercing-oldalak galériája 540 px volt a főoldali 582 helyett → javítva, újrafuttatva: 13 oldal, 551 ellenőrzés, 0 hiba |
| `tools/uj-fooldal-teszt.mjs` | minden rendben |
| `tools/motor-tipus-teszt.mjs` / `--mobil` | minden rendben (nincs „Kiesett” a listában; az Ékszercsere / visszarakás űrlapon 4 lehetőség) |
| `tools/motor-formazas-teszt.mjs` | minden rendben |
| `tools/motor-teszt.mjs` / `--mobil` | az első futáson 1-1 hiba (az adatlap „Sopron · Adatok” fejléce felülíródott) → javítva, újrafuttatva: minden rendben |
| `tools/funkcio-teszt.mjs` (régi oldalak, a nyitvatartás-javítás miatt) | minden rendben |
| `tools/elteres.mjs blog` / `--mobil` | 0 eltérő elem |

## Kiegészítés (ugyanaz a PR): mobil hős rendezése és mobil videók
A tulajdonos további kérései: a mobil hős linksora ne legyen sorkizárt (kevés linknél középre), a csillagok és a „Kiváló…” egymás mellett, egy középvonal a hősben; a főoldalon
a linksor és a badge-ek egy szélességben; a Vélemények kategóriagombjai két sorban; mobilon a videók teljes képernyőre ugorjanak, a YouTube-ablak ne legyen tele ikonokkal.

**Mérés:** nem érinti. A videókezelés csak megjelenés (teljes képernyő, YouTube `playsinline=0&iv_load_policy=3&fs=1`), új külső kérés nincs; a mérőkód fájljai nem változtak.
A foglaló `szurasNyit` (információs videó) mobilon teljes képernyőt kér; a foglalási út nem változott.

| Teszt | Eredmény |
|---|---|
| `tools/uj-oldalak-teszt.mjs` (mind) | 174 oldal, 5552 ellenőrzés, 0 hiba |
| `tools/uj-fooldal-teszt.mjs` | minden rendben |
| `tools/motor-tipus-teszt.mjs` / `--mobil`, `tools/motor-formazas-teszt.mjs`, `tools/motor-teszt.mjs` / `--mobil` | minden rendben |
| Érintős mobil emuláció (Playwright, 390×844, eseti szkript) | YouTube-ablak: teljes képernyő (`.videoablak-keret`), a beágyazás paraméterei rendben, bezárás után nincs teljes képernyő; vendégvideó: `playsInline=false`, teljes képernyő; statikus `video[controls]`: a `playsinline` lekerül, a lejátszás teljes képernyőt kér, a végén kilép; asztalon (1440) változatlan |
| Kategóriagombok (Vélemények) 320 / 360 / 375 / 390 / 430 px | mindenhol 2 sor |

Megjegyzés: a tesztböngészőben (Playwright Chromium) nincs H.264, és a YouTube a helyi címről „Error 153”-at ad – ez a környezet korlátja, a régi paraméterekkel is így van.
