# 2026-10-15 – Hiba-részlet a belső foglaló-számlálóban (DECISION #188, #178) – teszt-napló

MÉRÉS ÉRINTŐ. Draft PR, merge / élesítés nincs: csak független review PASS + a védett `assets/js/booking-engine` fa hash-változásának dokumentálása + rollback-terv **és Feri külön mondata** után (a PR-leírás tartalmazza).

## Mi változott
- `assets/js/booking-engine/lepes-meres.js`: `hibaReszlet()`, `HIBA_KODOK`, `RESZLET_LEPES`; `meter.error(type, step, reszlet?)` a hibatípus egyszer-kapuján belül egy további beacont küld (`error_reszlet`) a belső számlálónak (GA4-be nem), próbából / robotból nem.
- `assets/js/booking-engine/engine.js`: egyetlen sor: a nézet-betöltési `catch` átadja a `{ code, status }`-t a `meter.error`-nak.
- `netlify/lib/foglalo-szamlalo.js`: `ervenyesit` elfogadja a zárt alakú `error_reszlet` lépést; `osszeallit` / `csvbe` / `htmlbe` additív `hiba_reszlet` kimenet.
- Nincs változás: D1-séma, `LEPESEK`, GA4-eseménylista, foglalási logika, Salonic-hívások, konverziók, kiküldés, `wrangler.toml`.

## Védett blob-hash-ek (assets/js/booking-engine fa)
| fájl | előtte (main `ba53bed`) | utána |
|---|---|---|
| `assets/js/booking-engine/engine.js` | `14f2fde2e9` | `422d612e44` |
| `assets/js/booking-engine/lepes-meres.js` | `952d8f0eea` | `8673591c8f` |
| `netlify/lib/foglalo-szamlalo.js` | `dc5e227d1f` | `8383b4f48a` |
| a többi védett elem (`koszono.js` `547d0e05fc`, `suti.js` `ea41ffd20d`, `klon/*-ok.html` `157c141e5d` / `1ef408bcbb` / `88c2d866ae` / `ae96e4ae97`, `wrangler.toml` `151c6c9b8f`) | változatlan | változatlan |

## Tesztek (helyi, Linux)
- `node --test tools/test-lepes-meres.mjs`: **25/25** (20 régi + 5 új: hibakód-lista kliens = szerver és a LEPESEK / ESEMENYEK szerződés változatlan; `hibaReszlet` zárt listák; `meter.error` részlettel: egy plusz beacon, hibánként egyszer, GA4 / dataLayer változatlan, részlet nélkül / robotnál / próbánál nincs; `ervenyesit` zárt alak, 16 elutasított eset; POST + GET D1 körút: atomikus növekedés, additív `hiba_reszlet`, a lépések nem torzulnak, CSV / HTML).
- Teljes `tools/test-*.mjs` csomag: a `main` (`ba53bed`) és az ág eredménye **azonos**, kivéve a `test-lepes-meres` (+5 új eset); az egyetlen ismert, korábbi hiba a `test-foglalo-atkotes` 19. esete (oxigen-uj.js:134), a `main`-en is ugyanígy.
- `test-booking-flow` 41/41, `test-booking-layer` 10/10, `test-booking-id` 11/11, `test-qa-nap` 40/40, `test-sd-smoke` 11/11.

## Rollback
Egy commit: `git revert <commit>` a `main`-re (vagy a Cloudflare Pages korábbi deploymentjének visszaállítása). Séma nem változott, ezért adatvisszaállítás nem kell; a már beírt `error_reszlet` sorok ártalmatlanok (a régi kód nem olvassa őket, a JSON kimenet régi fogyasztói egy további kulcsot kapnak).
