# UJ-75b: ismeretlen foglalás lemondása – 200 + ok_kod, rövid kulcs a riasztásban (2026-10-27)

**Kérés:** #167 6448870978 (01-MERES, 1. pont): a `lemondas_ismeretlen` riasztás 3 egyedi eseményt jelent (a Zap 3-szor próbálja a 404-et, utána `StepExhaustedError`), a sorok `uuid`/`adat` mezője üres, ezért nem párosíthatók.

## Változás (`gyogytorna/lib/motor-szerver.js`, `igazolasVegpont`, `esemeny = lemondas`, ismeretlen `salonic_id`)
- **Válasz:** 404 helyett **200** `{ ok: false, ok_kod: 'ismeretlen_foglalas', hiba: 'ismeretlen_foglalas' }` – a Zap nem próbálkozik 3-szor és nem lesz `failed`; a Zap maga nem változik.
- **Riasztás (`gy_riasztas.adat`):** `<HMAC-előtag 8 hex>|<az időpont napja, Budapest>|h<helyszín>` (pl. `a1b2c3d4|2026-10-30|h8439`). A HMAC kulcsa `GY_HMAC_KULCS` (nem visszafejthető); nyers Salonic-azonosító, név, e-mail, telefon, szolgáltatásnév nincs. Ha a kérésben nincs `start_unix` / `place_id`: `-` jelek.
- **A kért „szolgáltatás-kategória" nincs benne:** a Zap csak azonosítót, kezdési időt és helyszínt küld (nincs szolgáltatás-mező), így a végpont nem ismeri; ha kell, a Zap-oldali mezőbővítés külön kérés.
- Nem változik: a többi ág (409 `nincs_torolve`, `lemondott`, ismétlés), az `igazolas` ág, `lemondasBookingIdNelkul`.

## Védett elemek
`gfeltoltes.js` 6f5deb2070 és `gkiigazitas.js` 016ad1c4cc változatlan.

## Tesztek
`test-gy-szerver.mjs`: a lemondás-teszt bővítve (200 + `ok_kod`, a riasztás formátuma, nyers azonosító nincs benne, start/hely nélküli eset): 78/78 zöld; az 1 bukó („bizonytalan esetek", 17.) a `main`-en is bukik, a #510 javítja.

## Rollback
Merge-commit revert (a régi 404 és az üres riasztás visszaáll).
