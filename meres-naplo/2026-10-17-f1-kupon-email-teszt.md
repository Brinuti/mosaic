# 2026-10-17 – F1: kuponos HeadSpa-levél e-mailje (DECISION #192): teszt-napló

**MÉRÉST ÉRINT (a vendég-hash és az esemény `em` / `external_id`); VÉDETT `netlify/lib/meres/hash.js` és `elosztas.js` módosul.** Forrás: #167 6236464576 (a mérési oldal igazolta az okot: a kuponos levél „E-mail cím:” mezőjében az e-mail után közvetlenül a „Kupon kód: <KÓD>” sor áll, elválasztó nélkül is összeérhet) és a DECISION #192 1. pont (az első e-mail-szerű token, a „Kupon kód:” előtt vágva; a kód ne kerüljön hash-be / kérelembe). **Draft PR; merge csak a Drive-os DECISION-LOG rögzítés + független review PASS a végső SHA-ra + a hash-változás dokumentálása után.** Élő konverziót nem érint, Zap / külső fiók nem változik, vendégadat sehol nem szerepel.

## 1. Mi változik
- `netlify/lib/meres/hash.js`: `emailNormal` – egyetlen e-mail token esetén **változatlan**; ha **felismert kuponkód-címke** is a mezőben van („Kupon kód:”, „Kuponkód:”, „Kupon:”, „Coupon code:”, „Coupon:”; kis/nagybetű, ékezet nélkül is, kettőspont kötelező; szóközzel / újsorral / **összeérve**), a címke ELŐTTI rész első e-mail-szerű tokenje; **címke nélkül továbbra is fail-closed** (többtokenes szöveg → `null`), a címkével kezdődő mező → `null`, a 320 karakternél hosszabb mező → `null` (ReDoS-védelem). Új export: `kuponNelkul`.
- `netlify/lib/meres/elosztas.js` (1 sor): `ext: hashAzonosito(v.g || emailNormal(v.email) || kuponNelkul(v.email))` – a motoros útnál (`g` van, vagy tiszta e-mail) bájtra azonos; ha nincs e-mail, a kuponkód szövege (címkével vagy anélkül) és a „csak `E-mail cím:` címke” maradék sem hash-elődik.
- Fogyasztók, amelyek ettől maguktól javulnak: az esemény `em`-je (`hashEmail`), a vendég-index `email_h` HMAC-je (`vendegHash`), az attribúciós jelzés, az `external_id`.
- **Független review (első kör, `b45664ae`): PASS with notes**, blokkoló nincs. Kezelve: (1) a véletlen-teszt üres volt (a generátor 50 különböző, `@`-mentes sztringet adott) → seedelt PRNG-vel újraírva, 40 000 bemenet, a teszt maga követeli, hogy ≥ 200 elfogadott és ≥ 10 000 elutasított eset fusson; (2) a „sosem” túl erős volt → a felismert címkékre szűkítve (dokumentáció + kódkomment), a „Kupon:” / „Coupon:” rövid címkék is felismertek, a címke nélküli, e-mail nélküli „kupon” / „coupon” szöveg sem hash-elődik; (3) az `external_id` konstans lehetett (vezető szóköz / „csak E-mail cím:” maradék) → `kuponNelkul` trim + üres eredmény; (4) ReDoS → 320 karakteres hosszkorlát + teszt; (5) a tolerancia tágabb volt a DECISION-nél → a „bármely többtokenes szövegből az első token” csak felismert címke mellett él, a címkével kezdődő mező `null`; (6) mutációs lyukak → `x.kuponkod:y@b.hu`, `a@kuponkod:.hu`, `kupon@kupon.hu`, `a:b@c.hu` kompatibilitási esetek, a TikTok-payload ellenőrzése a HS-06-ban; (7) apróságok → tesztadat `example.com`, elavult doksi-mondatok, lifecycle-parser megjegyzés (nem érintett).

## 2. Tesztek (helyben, Node, hamis hálózat, nincs titok)

| parancs | eredmény |
|---|---|
| `node --test tools/test-hash-email.mjs` | **7/7 PASS** (kézzel írt kompatibilitási esetek + 40 000 seedelt véletlen bemenet; 4 kód × 9 címke × 6 elválasztó × 3 utótag; fail-closed esetek + 320 karakteres hosszkorlát; ReDoS-vedelem; `kuponNelkul`; `hashEmail` = a tiszta e-mail SHA-256-ja) |
| `node --test tools/test-sd-headspa.mjs` | **12/12 PASS** (HS-06 átírva: 6 e-mail-alak, az `em` / `external_id` / index-HMAC azonos a normál levélével, a kuponkód sehol; nincs e-mail → csak `ph`) |
| `node --test tools/test-sd-smoke.mjs` | **14/14 PASS** (SM13: F1 után C2 PASS, az F1 előtti index nélküli sor C2 WARN) |
| `node --test tools/test-*.mjs` | 455 teszt: **453 PASS, 1 FAIL, 1 SKIP**; az egyetlen hiba a korábbi, ismert `test-foglalo-atkotes` 19. eset (`oxigen-uj.js:134`, a `main`-en is), a SKIP az `LIVE=1` élő smoke; a golden-paritás (`test-salonic-direct`, motoros kérés-törzsek) bájtra azonos |

## 3. Rollback
Egy commit (`git revert`). D1-séma, kapcsoló, Zap nem változik. Következmény a revertnél: a revert utáni kuponos levelek ismét `em` / index nélkül mennek (a jelenlegi élő állapot). A javítás alatt beírt `foglalas_vendeg` index-sorok és az `email_h` HMAC-ek érvényesek maradnak (ugyanaz a normalizált e-mail), törlésük nem szükséges.

## 4. Védett elemek (alap: `main` `ff420cc`; a #382 ágra épül, a #382 változásai csak `tools/`, `docs/`, `meres-naplo/`)

| elem | `main` | a változásban | |
|---|---|---|---|
| `netlify/lib/meres/hash.js` | 203394664e | 41cfe4f599 | **VÁLTOZIK** (`emailNormal` címke-vezérelt tolerancia + hosszkorlát + `kuponNelkul`; az egy-tokenes e-mailekre azonos) |
| `netlify/lib/meres/elosztas.js` | d8a4ca020e | b8a48dc737 | **VÁLTOZIK** (1 sor: az `external_id` tartalék ága) |
| fa `netlify` | 2c837cd121 | a210305d92 | VÁLTOZIK (szándékos, a fenti 2 fájl) |
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

## 5. Delta-review (`d7f33ed4`) és a további javítások

Független delta-review a `d7f33ed4`-re: **PASS with notes**, blokkoló nincs (saját differenciális fuzz: 2 000 000 + 1 500 000 bemenet, címke nélkül 0 eltérés; ReDoS lezárva; a 8 mutáns közül 1 élt: a `kuponNelkul` „kupon-szó a címke előtt” szabálya). Kezelve a következő SHA-ban: (1) a doksi hibás állítása a lifecycle-ról javítva — a HeadSpa **a lifecycle éles (`elo`) üzemmódjában van** (`wrangler.toml`), az F1 azt nem érinti; count-szintű D1-olvasás (`mosaic-lifecycle`, személyes adat nélkül): HeadSpa 92 nem-teszt foglalás, 37 kuponos szolgáltatás, 0 hiányzó / hibás alakú e-mail, 0 „kupon” szó az e-mail mezőben; (2) „változatlan” állítás pontosítva (felismert címke / 320 karakter kivételével); (3) a hosszkorlát a vizsgált (címke előtti) részre vonatkozik, a címke utáni szöveg hossza nem számít (+ teszt); (4) új tesztek a `kuponNelkul` „kupon-szó a címke előtt” szabályára; a teszt a modul exportált `KUPON_CIMKE` regexét használja (nincs drift); (5) a fail-closed ára és az első kuponos HeadSpa sd-foglalás utáni élő ellenőrzés (`em` megjelent-e, C2 PASS-e) a dokumentációban.
