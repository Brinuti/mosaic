# Lifecycle: valódi (élő Salonic) próba-szkriptek

Futtatás a repo gyökeréből (`node tools/lifecycle-teszt/proba/<fájl>`); a kimenetek (képek, HTML, JSON) a `_tmp/` mappába kerülnek (hozd létre: `mkdir _tmp`, nincs a gitben). Chrome: `C:/Program Files/Google/Chrome/Application/chrome.exe` (vagy `CHROME_UTVONAL`). A kimenő mérési kéréseket a szkriptek blokkolják (csak a Salonic és a betűtípusok mennek ki).

| fájl | mire jó |
|---|---|
| `pmu-foglalas.mjs` | valódi PMU-próbafoglalás közvetlenül a Salonic PMU-fiókban (`--elkuld`), "TESZT – Claude" vendég |
| `athelyez.mjs`, `athelyez-dom.mjs` | próbafoglalás áthelyezése a Salonicban (a vendég "Foglalás módosítása" folyamata) |
| `modosit-kattint.mjs` | a "Foglalás módosítása" gomb kattintása után megmarad-e a foglalás |
| `oldal-html.mjs` | az „A foglalásod” oldal HTML-je egy konkrét foglaláshoz (helyi próba) |
| `foglalasom-proba.mjs` | az „A foglalásod” oldal + a beágyazott VALÓDI Salonic-oldal + a HELYI `salonic/mosaic.css` (vagy `pmu` argumentummal `pmu.css`); `ELO_URL=<előnézeti /f/ link>`, `VEGREHAJT=14:00` (valódi módosítás) |
| `modosit-kepek.mjs`, `dom-kiir.mjs` | képernyőképek / DOM-kivonat a Salonic vendég-oldalairól |
| `sms-adat.mjs` + `sms-oldal-keszit.mjs` | az összes SMS táblázata (tulajdonosi átnézés): `node .../sms-adat.mjs && node .../sms-oldal-keszit.mjs <ki.html>` (a két képernyőképet a szkript elején állítsd be) |
| `noshow-level.mjs` | a no-show e-mail kirajzolása (szöveg + HTML) |

Lemondás: `tools/meres-proba/lemond.mjs <cancelBooking-URL>` (az ok: `LEMONDAS_OK`, alap: "Próbafoglalás (TESZT), lemondva"). Foglalás a rétegen át: `tools/meres-proba/reteg-foglalas.mjs --bazis <előnézet> --utvonal h0-headspa|hair-konzult|oxigen-1|oxigen-2|lezer-konzult`.
