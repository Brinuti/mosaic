# 2026-10-17 – PARSE-bontás (#178, a #334 első adata): teszt-napló

**MÉRÉST ÉRINT · VÉDETT `assets/js/booking-engine` fa módosul (3 fájl) + 1 szerver-fájl.** Dokumentáció: `docs/booking-engine/LEPES_MERES.md` 5c. Forrás: #167 6235475561 3. pont („naplózás-bővítés draft PR-ként javasold”), elemzés: 6235850174. **Draft PR; merge / élesítés csak független review PASS + a védett fa hash-változásának dokumentálása + rollback-terv ÉS Feri külön mondata után (DECISION #188 szerint).**

## 1. Tesztek (helyben, Node + Chromium; a Salonic-oldal a böngészős próbában mockolt, nincs foglalás, nincs kimenő mérés)

| parancs | eredmény |
|---|---|
| `node --test tools/test-salonic-adapter.mjs` | **40 PASS, 1 SKIP** (a SKIP a meglévő, hálózatot igénylő `ELO smoke`); 6 új eset: `parseKind`, oxigén kategória-oldal 7 eset + nem-PARSE hibák kind nélkül, lézer `specIds`, naptár-API `kind=JSON`, argumentum-PARSE / hibás fejléc: kind nélkül (a mező sincs jelen) és nem dob, **párhuzamos lekérések kindje független** |
| `node --test tools/test-lepes-meres.mjs` | **34/34 PASS** (5 új eset; a „kliens ⊆ szerver” tulajdonság a PARSE-kindekre is: > 3000 kombináció; **a rollback-SQL-t a teszt a `LEPES_MERES.md`-ből olvassa ki és valódi SQLite-on futtatja**) |
| `node --test tools/test-*.mjs` (22 fájl) | 444 teszt: **442 PASS, 1 FAIL, 1 SKIP**; az egyetlen hiba a korábbi, ismert `test-foglalo-atkotes` 19. eset (`oxigen-uj.js:134`, a `main`-en is fennáll), a SKIP az `LIVE=1` élő smoke |
| `node tools/meres-proba/lepes-proba.mjs --overlay dist` (dist build: `CF_PAGES=1 CF_PAGES_BRANCH=main node tools/netlify-build.mjs`) | asztali **33/33**, mobil **33/33** (8 új: 4c, négy `OX1.PARSE_*.0` eset) |

## 2. Védett elemek (alap: `main` `d6e235a`; a táblázat az `ff420cc` (#383) `main`-nel is azonos, a közbeni változás csak `medicalpiercing/`)

| elem | `main` | a változásban | |
|---|---|---|---|
| `assets/js/booking-engine/engine.js` | 422d612e44 | 3f66b883e5 | **VÁLTOZIK** (1 sor: a `kind` átadása) |
| `assets/js/booking-engine/lepes-meres.js` | 545b95b944 | 7055df2edf | **VÁLTOZIK** (`HIBA_KODOK` + `hibaReszlet`) |
| `assets/js/booking-engine/salonic-adapter.js` | 61a6eb83a8 | 1fef877e8b | **VÁLTOZIK** (csak olvasó, hívó-lokális metaadat + `parseKind`; a kérés / elemzés / vezérlés nem) |
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

Egy commit: `git revert` a `main`-re, vagy a Cloudflare Pages korábbi deploymentjének visszaállítása. A D1-séma nem változott. A revert után a már beírt `PARSE_*` sorokat a régi szerver nem fogad el újra (`400`), de a D1-ben megmaradnak: ha zavar, `DELETE FROM lepes_szamlalo WHERE lepes = 'error_reszlet' AND tipus GLOB '*.*.PARSE_*';` az éles (`mosaic-foglalo-szamlalo`) és az előnézeti (`mosaic-foglalo-szamlalo-elonezet`) D1-en.

## 4. Független review

Első kör (`code-reviewer`): **PASS with notes**, blokkoló nincs. A jegyzetek kezelése:

| jegyzet | kezelés |
|---|---|
| pontatlan adatvédelmi állítás (`LEPES_MERES.md` 5c) | átírva: a metaadat a hívó lokális objektumában él, URL nem kerül bele, kimenetbe csak a zárt `kind` |
| versenyhelyzet a közös, URL-kulcsú `Map`-ben | **megszüntetve**: nincs közös állapot, a `getText` a hívó (`page()`) saját objektumába ír; új teszt a párhuzamos lekérésekre |
| nincs teszt a 40-es korlátra | tárgytalan (a `Map` megszűnt) |
| rollback-SQL-hez nincs teszt, shell-escape kockázat | `GLOB '*.*.PARSE_*'`-ra cserélve; a teszt a dokumentumból olvassa ki és SQLite-on futtatja |
| `e.kind === undefined` nincs állítva | hozzáadva (a `kind` mező sincs jelen, `!('kind' in e)`) |
| diagnosztikai korlátok nincsenek leírva | `LEPES_MERES.md` 5c: üres `content-type` + < 5000 → `PARSE_SHORT`; `PARSE_NOLIST` három esetet von össze; a küszöb felülvizsgálata az első valós adatok után |
| `kind: undefined` mint saját mező | feltételes spread (`...(kind ? { kind } : {})`) |
| hiányzó kereszthivatkozások | `LEPES_MERES.md` 5b kódlista, `SalonicError` osztálykomment, `SALONIC_ADAPTER_CONTRACT.md` („Hibák”), 5c visszagörgetés pontosítva (a régi szerver az *újonnan érkező* `PARSE_*` beaconöket utasítja el) |
| LA1 / `PARSE_JSON` csak unit-szinten | változatlan, elfogadott (a böngészős 4c az OX1 utat fedi; a lézer `specIds` ág és a JSON-ág unit-tesztelt) |

A javítások után újrafuttatva: a fenti táblázat értékei (adapter 40 PASS, lepes-meres 34/34, teljes csomag 442 PASS + az ismert 1 FAIL, böngészős próba asztali 33/33 és mobil 33/33).
