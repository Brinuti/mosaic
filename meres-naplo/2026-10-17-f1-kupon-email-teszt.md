# 2026-10-17 – F1: kuponos HeadSpa-levél e-mailje (DECISION #192): teszt-napló

**MÉRÉST ÉRINT (a vendég-hash és az esemény `em` / `external_id`); VÉDETT `netlify/lib/meres/hash.js` és `elosztas.js` módosul.** Forrás: #167 6236464576 (a mérési oldal igazolta az okot: a kuponos levél „E-mail cím:” mezőjében az e-mail után közvetlenül a „Kupon kód: <KÓD>” sor áll, elválasztó nélkül is összeérhet) és a DECISION #192 1. pont (az első e-mail-szerű token, a „Kupon kód:” előtt vágva; a kód ne kerüljön hash-be / kérelembe). **Draft PR; merge csak a Drive-os DECISION-LOG rögzítés + független review PASS a végső SHA-ra + a hash-változás dokumentálása után.** Élő konverziót nem érint, Zap / külső fiók nem változik, vendégadat sehol nem szerepel.

## 1. Mi változik
- `netlify/lib/meres/hash.js`: `emailNormal` – egyetlen e-mail token esetén **változatlan**; egyébként a kuponkód-címke („Kupon kód:”, „Coupon code:”, kis/nagybetű, ékezet nélkül is, szóközzel / újsorral / **összeérve**) ELŐTTI rész, ennek hiányában a szöveg első e-mail-szerű tokenje; nincs ilyen: `null`. Új export: `kuponNelkul`.
- `netlify/lib/meres/elosztas.js` (1 sor): `ext: hashAzonosito(v.g || emailNormal(v.email) || kuponNelkul(v.email))` – a motoros útnál (`g` van, vagy tiszta e-mail) bájtra azonos; a kuponkód szövege az `external_id` tartalék ágában sem hash-elődik.
- Fogyasztók, amelyek ettől maguktól javulnak: az esemény `em`-je (`hashEmail`), a vendég-index `email_h` HMAC-je (`vendegHash`), az attribúciós jelzés, az `external_id`.

## 2. Tesztek (helyben, Node, hamis hálózat, nincs titok)

| parancs | eredmény |
|---|---|
| `node --test tools/test-hash-email.mjs` | **5/5 PASS** (visszafelé kompatibilitás + 3000 véletlen egy-tokenes bemenet; 4 kód × 7 címke × 6 elválasztó × 3 utótag; nincs token → `null`; `kuponNelkul`; `hashEmail` = a tiszta e-mail SHA-256-ja) |
| `node --test tools/test-sd-headspa.mjs` | **12/12 PASS** (HS-06 átírva: 6 e-mail-alak, az `em` / `external_id` / index-HMAC azonos a normál levélével, a kuponkód sehol; nincs e-mail → csak `ph`) |
| `node --test tools/test-sd-smoke.mjs` | **14/14 PASS** (SM13: F1 után C2 PASS, az F1 előtti index nélküli sor C2 WARN) |
| `node --test tools/test-*.mjs` | 453 teszt: **451 PASS, 1 FAIL, 1 SKIP**; az egyetlen hiba a korábbi, ismert `test-foglalo-atkotes` 19. eset (`oxigen-uj.js:134`, a `main`-en is), a SKIP az `LIVE=1` élő smoke; a golden-paritás (`test-salonic-direct`, motoros kérés-törzsek) bájtra azonos |

## 3. Rollback
Egy commit (`git revert`). D1-séma, kapcsoló, Zap nem változik. Következmény a revertnél: a revert utáni kuponos levelek ismét `em` / index nélkül mennek (a jelenlegi élő állapot). A javítás alatt beírt `foglalas_vendeg` index-sorok és az `email_h` HMAC-ek érvényesek maradnak (ugyanaz a normalizált e-mail), törlésük nem szükséges.

## 4. Védett elemek (alap: `main` `ff420cc`; a #382 ágra épül, a #382 változásai csak `tools/`, `docs/`, `meres-naplo/`)

| elem | `main` | a változásban | |
|---|---|---|---|
| `netlify/lib/meres/hash.js` | 203394664e | bbe6f21241 | **VÁLTOZIK** (`emailNormal` tolerancia + `kuponNelkul`; az egy-tokenes e-mailekre azonos) |
| `netlify/lib/meres/elosztas.js` | d8a4ca020e | b8a48dc737 | **VÁLTOZIK** (1 sor: az `external_id` tartalék ága) |
| fa `netlify` | 2c837cd121 | 4a2ebc565b | VÁLTOZIK (szándékos, a fenti 2 fájl) |
| `netlify/lib/meres/salonic-direct.js` | 2ef428132f | 2ef428132f | változatlan |
| `netlify/lib/foglalo-szamlalo.js` | 04fdf3a3fb | 04fdf3a3fb | változatlan |
| `assets/js/suti.js` | ea41ffd20d | ea41ffd20d | változatlan |
| `assets/js/booking-engine/koszono.js` | 547d0e05fc | 547d0e05fc | változatlan |
| `assets/js/booking-engine/engine.js` | 422d612e44 | 422d612e44 | változatlan |
| `assets/js/booking-engine/lepes-meres.js` | 545b95b944 | 545b95b944 | változatlan |
| `assets/js/booking-engine/salonic-adapter.js` | 61a6eb83a8 | 61a6eb83a8 | változatlan |
| fa `assets/js/booking-engine` | a5a793f9ab | a5a793f9ab | változatlan |
| fa `functions` | f8eaf39c51 | f8eaf39c51 | változatlan |
| `klon/oxigenterapia-ok.html` `157c141e5d`, `klon/fodrasz-ok.html` `1ef408bcbb`, `klon/m/oxigenterapia-ok.html` `88c2d866ae`, `klon/m/fodrasz-ok.html` `ae96e4ae97`, `wrangler.toml` `01f30c1018` | – | – | változatlan |

**Átfedés a #381-gyel:** az fájllisták nem fedik egymást (a #381 a `salonic-direct.js`-t és a `test-salonic-direct.mjs`-t módosítja, ez a `hash.js`-t, `elosztas.js`-t); a `docs/booking-engine/SALONIC_DIRECT.md` 94. sorát egyik sem érinti ebben a változásban.
