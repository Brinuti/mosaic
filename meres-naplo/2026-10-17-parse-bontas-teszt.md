# 2026-10-17 – PARSE-bontás (#178, a #334 első adata): teszt-napló

**MÉRÉST ÉRINT · VÉDETT `assets/js/booking-engine` fa módosul (3 fájl) + 1 szerver-fájl.** Dokumentáció: `docs/booking-engine/LEPES_MERES.md` 5c. Forrás: #167 6235475561 3. pont („naplózás-bővítés draft PR-ként javasold”), elemzés: 6235850174. **Draft PR; merge / élesítés csak független review PASS + a védett fa hash-változásának dokumentálása + rollback-terv ÉS Feri külön mondata után (DECISION #188 szerint).**

## 1. Tesztek (helyben, Node + Chromium; a Salonic-oldal a böngészős próbában mockolt, nincs foglalás, nincs kimenő mérés)

| parancs | eredmény |
|---|---|
| `node --test tools/test-salonic-adapter.mjs` | PASS (5 új eset: `parseKind`, oxigén kategória-oldal 7 eset + nem-PARSE hibák kind nélkül, lézer `specIds`, naptár-API `kind=JSON`, argumentum-PARSE kind nélkül / hibás fejléc nem dob) |
| `node --test tools/test-lepes-meres.mjs` | PASS (4 új eset; a „kliens ⊆ szerver” tulajdonság a PARSE-kindekre is: > 3000 kombináció) |
| `node --test tools/test-*.mjs` (22 fájl) | 442 teszt: **440 PASS, 1 FAIL, 1 SKIP**; az egyetlen hiba a korábbi, ismert `test-foglalo-atkotes` (`oxigen-uj.js:134`, a `main`-en is), a SKIP az `LIVE=1` élő smoke |
| `node tools/meres-proba/lepes-proba.mjs --overlay dist` (dist build: `CF_PAGES=1 CF_PAGES_BRANCH=main node tools/netlify-build.mjs`) | asztali **33/33**, mobil **33/33** (8 új: 4c, négy `OX1.PARSE_*.0` eset) |

## 2. Védett elemek (alap: `main` `d6e235a`)

| elem | `main` | a változásban | |
|---|---|---|---|
| `assets/js/booking-engine/engine.js` | 422d612e44 | 3f66b883e5 | **VÁLTOZIK** (1 sor: a `kind` átadása) |
| `assets/js/booking-engine/lepes-meres.js` | 545b95b944 | 7055df2edf | **VÁLTOZIK** (`HIBA_KODOK` + `hibaReszlet`) |
| `assets/js/booking-engine/salonic-adapter.js` | 61a6eb83a8 | d88a07f03e | **VÁLTOZIK** (csak olvasó metaadat + `parseKind`; a kérés / elemzés / vezérlés nem) |
| `netlify/lib/foglalo-szamlalo.js` | 04fdf3a3fb | e2e22fe11a | **VÁLTOZIK** (zárt hibakód-lista) |
| fa `assets/js/booking-engine` | a5a793f9ab | VÁLTOZIK (szándékos, a fenti 3 fájl) | |
| `assets/js/suti.js` | ea41ffd20d | ea41ffd20d | változatlan |
| `assets/js/booking-engine/koszono.js` | 547d0e05fc | 547d0e05fc | változatlan |
| `klon/oxigenterapia-ok.html` | 157c141e5d | 157c141e5d | változatlan |
| `klon/fodrasz-ok.html` | 1ef408bcbb | 1ef408bcbb | változatlan |
| `klon/m/oxigenterapia-ok.html` | 88c2d866ae | 88c2d866ae | változatlan |
| `klon/m/fodrasz-ok.html` | ae96e4ae97 | ae96e4ae97 | változatlan |
| `wrangler.toml` | 01f30c1018 | 01f30c1018 | változatlan |

## 3. Rollback

Egy commit: `git revert` a `main`-re, vagy a Cloudflare Pages korábbi deploymentjének visszaállítása. A D1-séma nem változott. A revert után a már beírt `PARSE_*` sorokat a régi szerver nem fogad el újra (`400`), de a D1-ben megmaradnak: ha zavar, `DELETE FROM lepes_szamlalo WHERE lepes = 'error_reszlet' AND tipus LIKE '%.PARSE\_%' ESCAPE '\';` az éles (`mosaic-foglalo-szamlalo`) és az előnézeti (`mosaic-foglalo-szamlalo-elonezet`) D1-en.

## 4. Független review

Folyamatban / lásd a PR-t.
