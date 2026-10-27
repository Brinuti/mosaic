# GYT: csere nélküli pótlás az élő „Állapot-ok” (7362127659) akción – UJ-72

**MÉRÉST ÉRINTŐ, alapból KI.** Terv: `docs/booking-engine/GOOGLE_CSERE_NELKUL_TERV.md` (PR #502). Kérés: #167 6395410560 (UJ-72, Feri DECISION #234): az „Állapot-ok → ÁRNYÉK csere” terv törölve; az élő konverzió kapjon foglalás-azonosítót, a szerver a hiányzó foglalásokat **ugyanerre** az akcióra töltse fel azonos `order_id`-vel, **nincs dupla**, személyes és egészségügyi adat nélkül; minden létrejött online állapotfelmérés **egyszer, akkor is, ha a feltöltés előtt lemondják** (levonás / RETRACTION nincs).

## Mi már megvan
A motor a sikeres foglalás után a böngészőnek kiadja a HMAC-alapú tranzakció-azonosítót (`/api/gy-koszono` → `dataLayer: foglalas_kesz { tipus, ertek, tranzakcio_id }`; `tranzakcio_id = tranzakcioId(uuid, GY_HMAC_KULCS)`). A szerveres feltöltő ugyanezt használja `order_id`-ként. **Tehát a két oldal azonosítója már egyezik:** a böngészős Google-címke `transaction_id` / `order_id` mezőjét a `tranzakcio_id` dataLayer-változóra kell állítani (külső fiókos lépés: a mérési oldal, GTM-workspace, publikálás nélkül).

## Mit ad ez a PR
* `gyogytorna/lib/google-elo.js` (új): `eloPotlas()` sweep; a védett `gfeltoltes.js` / `gkiigazitas.js` **változatlan** (csak a `GFELT`, `googleAdsKuldo`, `clickIdHiba`, `maszk` függvényeket importálja); a meglévő ÁRNYÉK-feltöltés (7858300772) és a `GY_GADS_KIIGAZITAS = ki` érintetlen.
* `gyogytorna/lib/elo-burok.js` + `functions/api/gy-foglalas.js`, `gy-salonic-igazolas.js`: a sweep `waitUntil`-lel, a válasz nem függ tőle, hiba elnyelt.
* Kapcsoló: `GY_GADS_ELO = ki` (alap) | `dry` (csak napló, hálózat nincs) | `validate` (`validateOnly=true`) | `eles` (valódi feltöltés: külön DECISION / Feri mondata). `GY_GADS_ELO_TOL` = a böngészős `order_id`-s címke élesítésének unix-ideje (nélküle nem fut).
* Jogosult sor: online `allapotfelmeres`, nem teszt, Salonic-igazolt, `aktiv` / `modositott` / **`lemondott`**, jó formájú Google-click-ID a foglalás előtti kattintásról, nincs kifejezett hozzájárulás-elutasítás, `létrehozva ≥ TOL` és legalább 1 órával régebbi. Consent: a `GY_GADS_CONSENT=granted` szabály szerint (DECISION #220).
* Napló: `gy_feltoltes_elo` (uuid, mód, állapot, maszkolt click-ID, order_id [HMAC], konverziós idő, hiba); soronként legfeljebb 3 próbálkozás; a Google „már bent van” válasza (`ORDER_ID_ALREADY_IN_USE`, `CLICK_CONVERSION_ALREADY_EXISTS`) sikernek számít.
* Szállító: a Worker saját OAuth-küldője (`googleAdsKuldo`, `GOOGLE_ADS_*` titkok); a Zap-védőháló az élő akciót nem engedi, ezért ez a PR nem használja.

## Élesítés előtt (külön lépések)
1. Mérési oldal: a címke `order_id` mezője = `tranzakcio_id`; az élő akció (7362127659) fogad-e kattintás-feltöltést azonos `order_id`-vel (GAQL, olvasás).
2. `GY_GADS_ELO=validate` + `GY_GADS_ELO_TOL` az előnézeten, majd az élesen: a `validateOnly` válaszok hibamentesek.
3. 3 valós minta: címke-konverzió + pótló feltöltés azonos `order_id`-vel egy konverzióként jelenik meg.
4. `GY_GADS_ELO=eles` – csak Feri külön mondatával.

## Rollback
`GY_GADS_ELO` törlése / `ki` (kód nélkül); a böngészős `order_id` visszavétele a GTM-ben a mérési oldal lépése.

## Tesztek
`cd gyogytorna && node --test tools/test-gy-google-elo.mjs` (9).
