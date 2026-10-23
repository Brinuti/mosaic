# HS-2: `price_irany` – a bukott ár-ellenőrzés iránya (2026-10-23)

MÉRÉST ÉRINT (belső számláló, védett fájlok). **Csak mérés: a foglalási folyamat, a köszönőoldal, a platformokra menő események és értékek nem változnak.** Draft, ág: `claude/hs2-price-irany`; merge / deploy csak független review PASS után.

**Engedély:** Feri „ok” (a mérési oldal #167 6360986158, 2. pont: HS-2 `price_irany` kulcs, jóváhagyva). Kérés szövege: névtelen `price_irany` kulcs a foglalómotor számlálójába; érték `lt` / `gt` / `eq` / `unknown`, csak a `verify_check.price` eltérésnél; szolgáltatás, összeg, név, e-mail, telefon NEM kerül bele; draft PR a mainre, „MÉRÉST ÉRINTŐ”, rollback-terv, védett blob-hash változása dokumentálva, unit + Playwright; független review PASS után mergelhető.

## Mi változik
- `assets/js/booking-engine/lepes-meres.js` (VÉDETT): `IRANY_LEPES`, `IRANYOK`, `priceIrany(c)`; az `unverified()` a `verify_check:price` után egy `price_irany:<irány>` beaconnal. Hibatűrő (minden `try/catch`), probából / robotból nem megy, foglalásonként egyszer.
- `netlify/lib/foglalo-szamlalo.js` (VÉDETT): `IRANYOK`, `BELSO_205.price_irany` (zárt ellenőrző), riport-oszlop. Séma-változás nincs (a `lepes_szamlalo` tábla).
- Tesztek: `tools/test-lepes-meres.mjs` (+1 teszt, a zárt-lista és a kimerítő érvényesítő teszt bővítve), `tools/meres-proba/lepes-proba.mjs` (7. forgatókönyv: `price_irany` = `lt`; 1. forgatókönyv: sikeres útnál nincs). Doksi: `docs/booking-engine/LEPES_MERES.md` 5d.

## Védett blob-hash-ek (`git hash-object`, 10 karakter; kiindulás: `origin/main` `43ef9bd1`)
| fájl | kiindulás | most |
|---|---|---|
| `assets/js/booking-engine/lepes-meres.js` | `cd064f4db6` | **`73861ecefa`** (szándékos) |
| `netlify/lib/foglalo-szamlalo.js` | `692b9d4257` | **`3c609133d2`** (szándékos) |
| `assets/js/booking-engine/engine.js` | `ef41b61e51` | változatlan |
| minden más védett fájl (`netlify/lib/meres/*`, `foglalas-kulcs.js`, `koszono.js`, `suti.js`, `klon/*-ok.html`, `wrangler.toml`, `functions/api/foglalo-szamlalo.js`) | – | változatlan (a `git diff --stat origin/main` pontosan a fenti 2 védett + 2 teszt + 2 doksi fájlt mutatja) |

## Bizonyíték
- **Piros → zöld:** a `main` kódján az új teszt (#40) és a két bővített teszt (#30 zárt lista, #47 kimerítő érvényesítő) elbukik (48 pass / 3 fail); az új kódon `tools/test-lepes-meres.mjs`: **51 / 51 zöld**.
- **Teljes csomag:** `node --test tools/test-*.mjs`: 661 teszt, 3 FAIL, a PASS/SKIP megoszlas kornyezetfuggo (itt 655 PASS + 3 SKIP, a fuggetlen review-nal 657 PASS + 1 SKIP); a 3 FAIL pontosan ugyanaz, mint a `main`-en (660 teszt, 654 PASS, 3 FAIL: kliens-kód „nincs közvetlen Salonic-link”, „nincs közös adatbázis”, `test-hair-hajhossz`): új hiba nincs.
- **Böngészős próba:** `node tools/netlify-build.mjs` + `lepes-proba.mjs --overlay dist`: **asztali 46 ellenőrzés, 0 hiba; mobil (`--mobil 1`) 46 ellenőrzés, 0 hiba** (korábban 45). A 7. forgatókönyv (a jelentett ár 7 Ft): `price_irany` = `["lt"]`, az összeg nem kerül a beaconba, nincs JS-hiba. Lokális, kimenő mérés tiltva; élő oldalon nem futott.
- Az irány a bukott `checks.price`-ból (`expected` = „26900 / 39900”, `actual` = jelentett ár) számolódik; a `null` / nem szám / két érték közti ár `unknown`.

## Rollback
PR revertje; vagy csak a `lepes-meres.js` `unverified()` `belso(IRANY_LEPES, …)` sora törlése (a szerver az ismeretlen kulcsot nem kapja meg). Adat: `DELETE FROM lepes_szamlalo WHERE lepes = 'price_irany';` a `mosaic-foglalo-szamlalo` és a `-elonezet` (`08eb6f2f-180a-4352-a7f9-27333d5d6b5d`) D1-en (opcionális).

## Vendégadat
Nincs: a kérés csak `{ lepes, uzletag, tipus }` zárt értékekkel megy; az összeg a böngészőben marad. A tesztek kitalált adatot használnak.

## Élesedés
Merge csak független review PASS után (a védett fájlok miatt: friss review-ügynök a végső SHA-n); a deploy budapesti idejét a #167-be kell írni. Nem aktiválja a Zapier-draftot, nem nyúl GTM-hez, hirdetési fiókhoz.
