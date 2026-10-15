# 2026-10-15 – Hiba-részlet a belső foglaló-számlálóban (DECISION #188, #178) – teszt-napló

MÉRÉS ÉRINTŐ. Draft PR #334, merge / élesítés nincs: csak független review PASS + a védett `assets/js/booking-engine` fa hash-változásának dokumentálása + rollback-terv **és Feri külön mondata** után.

## Mi változott
- `assets/js/booking-engine/lepes-meres.js`: `hibaReszlet()` (zárt listák; a kimenet mindig a szerver által elfogadott alak, vagy `null`), `HIBA_KODOK`, `RESZLET_LEPES`; `meter.error(type, step, reszlet?)` a hibatípus egyszer-kapuján belül, saját `try`-ban egy további beacont küld (`error_reszlet`) a belső számlálónak (GA4-be nem), próbából / robotból nem.
- `assets/js/booking-engine/engine.js`: egyetlen sor: a nézet-betöltési `catch` átadja a `{ code, status }`-t a `meter.error`-nak.
- `netlify/lib/foglalo-szamlalo.js`: `ervenyesit` elfogadja a zárt alakú `error_reszlet` lépést (kanonikus HTTP, zárt nézet-kód, hibatípus–hibakód párok, HTTP-státusz csak `HTTP` / `API_STATUS` mellett); `ir` napi (nap, üzletág) kulcsszám-plafon (100 különböző részlet-kulcs, egy atomikus `INSERT … SELECT`); `osszeallit` / `csvbe` / `htmlbe` additív `hiba_reszlet` kimenet.
- Nincs változás: D1-séma, `LEPESEK`, GA4-eseménylista, foglalási logika, Salonic-hívások, konverziók, kiküldés, `wrangler.toml`.

## Független review (kód-olvasás, `7ce7c0d`): PASS with notes – a jegyzetek kezelése
| jegyzet | kezelés |
|---|---|
| R1 – a rollback-terv „ártalmatlan” állítása téves (a régi kód `lepesek.error_reszlet` kulcsot mutatna) | javítva: a rollback-terv a `DELETE FROM lepes_szamlalo WHERE lepes='error_reszlet'` lépést tartalmazza (éles + előnézeti D1); a doksi 5b szakasza leírja a hatást |
| B – a `HTTP.000` / `.00` elfogadva; a nézet-kód szabad alfanumerikus szöveg lehetett; lehetetlen hibatípus–kód párok | javítva: kanonikus HTTP (`0` vagy `100`–`599`), nézet-kód `[A-Z][A-Z0-9_]{0,11}` vagy `ismeretlen`, zárt hibatípus–hibakód párok, HTTP-státusz csak `HTTP` / `API_STATUS` mellett; a kliens kimenete ugyanezt tartja (teszt: kliens ⊆ szerver, 3000+ kombináció) |
| C – a kulcsok száma nem korlátos (D1-sor-felfúvódás közvetlen POST-tal) | javítva: (nap, üzletág) szerint legfeljebb 100 különböző részlet-kulcs, atomikus feltétellel; a meglévő kulcs tovább nő; teszt |
| A (nem blokkoló) – a részlet-ág legyen saját `try`-ban | javítva |
| E – hiányzó tesztek (engine-integráció, `HTTP.000`, tulajdonság-teszt, furcsa `reszlet`, nem sztring `tipus`) | pótolva; az engine-integrációt a Playwright-próba 4b esete fedi (valódi böngésző, dist build) |
| F – dist build + Playwright nem futott | lefutott (lásd lent) |
| F – a `HTTP.0` jelentése | dokumentálva (nincs HTTP-státusz; `API_STATUS.<szám>` az API saját státusza) |
| régi, nem ehhez tartozó: a `close` ágon a `tipus` = `constructor` / `toString` szemét kulcsot hoz létre | nem része ennek a PR-nek; külön megjegyzés a #167-ben |

## Védett blob-hash-ek (assets/js/booking-engine fa)
| fájl | előtte (main `ba53bed`) | utána |
|---|---|---|
| `assets/js/booking-engine/engine.js` | `14f2fde2e9` | `422d612e44` |
| `assets/js/booking-engine/lepes-meres.js` | `952d8f0eea` | `545b95b944` |
| `netlify/lib/foglalo-szamlalo.js` | `dc5e227d1f` | `04fdf3a3fb` |
| a többi védett elem (`koszono.js` `547d0e05fc`, `suti.js` `ea41ffd20d`, `klon/*-ok.html` `157c141e5d` / `1ef408bcbb` / `88c2d866ae` / `ae96e4ae97`, `wrangler.toml` `151c6c9b8f`) | változatlan | változatlan |

## Tesztek (helyi, Linux)
- `node --test tools/test-lepes-meres.mjs`: **29/29** (20 régi + 9 új).
- Teljes `tools/test-*.mjs` csomag: lásd a PR-leírást (a `main` és az ág eredménye azonos, kivéve a `test-lepes-meres` új esetei; ismert korábbi hiba: `test-foglalo-atkotes` 19. eset).
- **Böngészős próba, dist build** (`CF_PAGES=1 CF_PAGES_BRANCH=main node tools/netlify-build.mjs`, majd `node tools/meres-proba/lepes-proba.mjs --overlay dist`, tiltott kimenő méréssel): **asztali 25/25, mobil 25/25**. A bővített 4b eset: a mockolt Salonic-API HTTP 500 hibájánál a számláló pontosan egy `error_reszlet`-et kap: `salonic_api.C1.HTTP.500`; a GA4 `booking_error` (error_type=salonic_api, close step=A3) és a dataLayer változatlan; a hiba-nézet (A3) megjelenik.
- PR-előnézet (Cloudflare Pages): `POST error_reszlet` érvényes alakkal 204 és az előnézeti D1-be kerül, érvénytelennel 400.

## Rollback
Egy commit: `git revert <commit>` a `main`-re (vagy a Cloudflare Pages korábbi deploymentjének visszaállítása). Séma nem változott. **A revert után törölni kell a beírt részlet-sorokat**, különben a régi kód a `lepesek` objektumban egy `error_reszlet` kulcsot és a CSV-ben `error_reszlet` sorokat mutatna (a 10 tölcsér-lépés száma nem torzul): `DELETE FROM lepes_szamlalo WHERE lepes = 'error_reszlet';` az éles (`mosaic-foglalo-szamlalo`) és az előnézeti (`mosaic-foglalo-szamlalo-elonezet`) D1-en.
