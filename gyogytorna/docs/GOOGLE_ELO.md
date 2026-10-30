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

## Független review utáni kapuk (2026-10-27)

- **Braid-kapu.** Az élő `7362127659` akció ONE_PER_CLICK: a gbraid / wbraid kattintás `ONE_PER_CLICK_CONVERSION_ACTION_NOT_PERMITTED_WITH_BRAID` hibát adna (mint a `7858300772` a DECISION #242 előtt). A braid ezért csak akkor megy, ha a meglévő feltöltő kapuja (`GY_GADS_BRAID = be`) **és** az élő-kapu (`GY_GADS_ELO_BRAID = be`, alapból `ki`: a Google-oldali számlálási mód ellenőrzése után) is nyitva van; különben `kihagyva_braid`, Google-hívás nélkül. A kapu nyitása után a korábbi `kihagyva_braid` sorokat a sweep újra felveszi.
- **Próbálkozás-plafon módonként.** A 3 próbálkozás módonként számol (dry + validate után az első éles hiba nem végleges); módváltáskor a számláló 1-ről indul.
- **Host-védelem.** `validate` / `eles` csak az éles hoston (`gyogytornaszom.hu`, `www.`-val is) fut; előnézet / ismeretlen host: próbaüzem (`dry`), Google-hívás nincs (az MP `elesKuldesE` mintájára).
- Védett `gfeltoltes.js` (6f5deb2070) és `gkiigazitas.js` (016ad1c4cc) változatlan.

## UJ-94 / DECISION #264 (b): validateOnly-proba Zapier-mintan (`/api/gy-gads-elo-zap`)

A Worker-oldali `GY_GADS_ELO=validate` nem tud lefutni, mert a GY-26 szerint nincs `GOOGLE_ADS_*` titok a Pages-projektben (`nincs_kuldo`). Ezert a validateOnly-proba a GY-26 mintan megy:

- **Alapbol KI:** `GY_GADS_ELO_ZAP = ki` (alap) | `validate`. A `wrangler.toml`-ban NINCS beallitva (a bekapcsolas kulon lepes: a Cloudflare-valtozo a 01-MERES dontese szerint).
- **Hitelesites:** `x-gy-zap-kulcs` (mint a `/api/gy-gads-zap`), uj titok nincs.
- **GET** -> `{ok, mod:'validate', zar, db, kihagyva, cel, keres}` vagy `{nincs:true, miert}`. A `keres` = `{conversions:[...], partialFailure:true, validateOnly:true}` (legfeljebb 10 jelolt, csak az ELO `7362127659` akcio, gclid, 19000 HUF, a bongeszonek kiadott HMAC order_id). A vedohalo (`vedohaloElo`) minden kimeno keresre kikenyszeriti a `validateOnly === true`-t; hiba eseten 500 `vedohalo`. A click-ID csak ebben a kulcsos HTTPS-valaszban van.
- **Zapier:** a `keres`-t VALTOZTATAS NELKUL kuldi a Google Ads `customers/2596120588:uploadClickConversions` v23 vegpontra (a sajat kapcsolataval), majd a valaszt POST-olja.
- **POST** `{zar, http, valasz}` -> soronkent `elfogadva` / `mar_bent` / `hiba` (+ Google hibakod `[A-Z0-9_]{1,64}`); a valasz csak darabszam + hibakod. Egy zar egyszer hasznalhato (409 `mar_lezarva`); ismeretlen zar 409.
- **Tarolas:** `gy_feltoltes_elo` (`mod = 'zap_validate'`, a `katt_maszk` maszkolt), + `gy_elo_zap_zar (zar, idk, letrehozva, lezarva)` (uj tabla, vendegadat nelkul). A lefoglalt, lezaratlan sor 15 percig nem kerul ujra a keresbe; legfeljebb 3 proba / sor.
- **Az eles (validateOnly=false) potlas NEM ebben van:** kulon DECISION + Feri kulon mondata (elo konverzio).
- **Rollback:** `GY_GADS_ELO_ZAP` torlese / `ki` (a vegpont `{nincs:true}`-t ad), vagy a PR revertje; a tablak uresen maradhatnak.
