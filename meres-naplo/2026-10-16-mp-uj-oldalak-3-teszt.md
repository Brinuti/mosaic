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
