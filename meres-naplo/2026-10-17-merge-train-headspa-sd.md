# 2026-10-17 – Merge-train: HeadSpa salonic_direct előkészítés (#382) + F1 (#385) + F2 (#381) – teszt-napló (DECISION #192)

**MÉRÉST ÉRINT (vendég-hash, esemény `em` / `external_id`, sd kanonikus szolgáltatás-kulcs); VÉDETT `hash.js`, `elosztas.js`, `salonic-direct.js` módosul.** Élő konverziót nem kapcsol be és nem cserél, a foglalási folyamatot, a futó hirdetéseket, a Zapet és a külső fiókokat nem érinti; a `salonic_direct:headspa` D1-kapcsoló sora **nincs** (= KI), ennek bekapcsolása a merge UTÁNI külön lépés (DECISION #192 3. pont).

## 1. Engedély (CLAUDE.md, „Állandó felhatalmazás”)
- **DECISION #192** (mérési oldal + ChatGPT): #167 6236468282 (a döntés), 6239387464 (a mérési oldal megerősítése: a merge a merge-train ágon egyben mehet, a #381 külön ne menjen a #382 előtt) **ÉS** a Drive-os `DECISION-LOG.md` „## #192 – 2026-10-17 18:25 Budapest – HeadSpa salonic_direct sorrend (GPT egyetért)” bejegyzése (a fájl módosítási ideje 2026-10-17 19:17:22Z; a két forrás tartalma egyezik: (1) F1 javítás #385, (2) #381+#382 egyben a merge-train ágon `claude/mosaic-merge-train-rrbwkk` HS-02 igazítással, (3) `salonic_direct:headspa=1` csak árnyékra + 30–60 perc figyelés). A döntés szerint visszaállítható, élő konverziót nem érint, Feri külön mondata nem kell; a B) opció (ajándékkártya-oldal linkje) és a lifecycle-parser Feri döntése marad.
- A napi 1 merge szabály (CLAUDE.md) teljesül: a DECISION a három PR-t **egyetlen** merge-ben kéri.

## 2. Mi van benne (`git diff origin/main..HEAD`, `main` = `40d3d798`)
| forrás | tartalom |
|---|---|
| #382 (`b22578b4`) | `tools/test-sd-headspa.mjs` (12 teszt), `tools/sd-smoke-ellenorzes.mjs` + `test-sd-smoke.mjs` (HeadSpa-képes smoke), `docs/booking-engine/SALONIC_DIRECT_HEADSPA.md`, smoke-ellenőrzőlista, napló |
| #385 (`acbbe076`) | F1: `netlify/lib/meres/hash.js` (`emailNormal` címke-vezérelt tolerancia, 320 karakteres korlát, `kuponNelkul`), `netlify/lib/meres/elosztas.js` (1 sor), `tools/test-hash-email.mjs`, HS-06 / SM13 átírva, napló |
| #381 (`719a16a`) | F2: `netlify/lib/meres/salonic-direct.js` (`szolgKanon` leveszi a záró „(kupon)” jelzést; `szolgKulcsEgyezik` csak a HeadSpa-ra egyirányúan egyezteti a régi „<kulcs> kupon” kulcsot), `tools/test-salonic-direct.mjs` (S0-62..65), docs, napló |
| ez a merge-train | a HS-02 teszt (`tools/test-sd-headspa.mjs`) az F2 javítását ellenőrzi a korábbi „ismert korlát” helyett; az aktuális `main` beolvasztva |

Az összefésülés ütközésmentes (`git merge-tree`), még a `SALONIC_DIRECT.md` 94. sora is. A 71/71 a `meres-naplo/2026-10-17-sd-headspa-felkeszules.md`-ben a #382 önálló állapotára vonatkozik (a #381 után 75/75).

## 3. Tesztek (a train fején, helyben, Node, hamis hálózat, nincs titok)
| parancs | eredmény |
|---|---|
| `node --test tools/test-hash-email.mjs tools/test-sd-headspa.mjs tools/test-sd-smoke.mjs tools/test-salonic-direct.mjs` | zöld (7 + 12 + 14 + 75; a golden-paritás S0-13 bájtra azonos) |
| `node --test tools/test-*.mjs` | **459 teszt: 456 PASS, 2 FAIL, 1 SKIP.** A 2 hiba **a `main`-en is megvan** (`origin/main` `40d3d798` külön worktree-ben mérve): a korábbi `test-foglalo-atkotes` 19. eset (`oxigen-uj.js:134`) és a `test-fuggetlenseg` 3. esete („nincs közös adatbázis: a D1-kötés neve és az adatbázis-azonosító külön”, 10 helyett 9: a `main`-re mostanában bekerült `wrangler.toml`-változás miatt, nem ennek a változásnak a hatása). A SKIP az `LIVE=1` élő smoke. |

## 4. Védett elemek (alap: `main` `40d3d798`)
| elem | `main` | a train | |
|---|---|---|---|
| `netlify/lib/meres/hash.js` | 203394664e | 41cfe4f599 | **VÁLTOZIK** (F1) |
| `netlify/lib/meres/elosztas.js` | d8a4ca020e | b8a48dc737 | **VÁLTOZIK** (F1, 1 sor) |
| `netlify/lib/meres/salonic-direct.js` | 2ef428132f | 18e8d6c971 | **VÁLTOZIK** (F2 / #381) |
| fa `netlify` | 4b8fd696ee | 0435d58de0 | VÁLTOZIK (szándékos, a fenti 3 fájl) |
| `netlify/lib/foglalo-szamlalo.js` | 04fdf3a3fb | 04fdf3a3fb | változatlan |
| `assets/js/suti.js` | ea41ffd20d | ea41ffd20d | változatlan |
| `assets/js/booking-engine/koszono.js` | 547d0e05fc | 547d0e05fc | változatlan |
| `assets/js/booking-engine/engine.js` | 422d612e44 | 422d612e44 | változatlan |
| `assets/js/booking-engine/lepes-meres.js` | 545b95b944 | 545b95b944 | változatlan |
| `assets/js/booking-engine/salonic-adapter.js` | 61a6eb83a8 | 61a6eb83a8 | változatlan |
| fa `assets/js/booking-engine` | a5a793f9ab | a5a793f9ab | változatlan |
| fa `functions` | f858a90459 | f858a90459 | változatlan |
| `klon/oxigenterapia-ok.html` `157c141e5d`, `klon/fodrasz-ok.html` `1ef408bcbb`, `klon/m/oxigenterapia-ok.html` `88c2d866ae`, `klon/m/fodrasz-ok.html` `ae96e4ae97` | – | – | változatlan |
| `wrangler.toml` | ce5e69f063 | ce5e69f063 | változatlan |

## 5. Független review-k
- #385 / F1: három kör (`b45664ae`, `d7f33ed4`, `55a0d1d2`), mind PASS with notes, blokkoló nincs; a `netlify/` fa az `55a0d1d2` óta bájtra azonos, utána csak teszt + dokumentáció.
- #381 / F2: a fejlesztő session külön ágense, két kör, mutációs ellenőrzéssel: PASS WITH NOTES a `27a5960`-ra, a végső `719a16a` kódja bájtra azonos.
- #382 / HeadSpa sd előkészítés: független review PASS with notes, a jegyzetek átvezetve (`b22578b4`).
- **A train végső SHA-ja** (összefésülés + HS-02 igazítás + `main` beolvasztás): lásd a PR-t (review kérve).

## 6. Rollback
- Kód: `git revert -m 1 <merge commit>` a `main`-en (**csak** a „Merge pull request” / merge-commit módszernél; squash merge esetén sima `git revert <sha>`), vagy a Cloudflare Pages `mosaic` projekt korábbi deploymentjének visszaállítása. D1-séma, kapcsolók, Zap, külső fiók nem változik.
- **Mit ír a deploy után a futó rendszer (nem „a merge ír”):** az éles `[vars]`-ban `MERES_SALONIC_DIRECT="1"`, ezért a deploy után az új kuponos HeadSpa levelek a már meglévő hook miatt **vendég-index sort** kapnak (F1 hatása, szándékos, `ON CONFLICT DO NOTHING`), és a motoros árnyék-események kuponosnál `em`-et kapnak. A merge maga sémát, kapcsolósort, D1-sort nem ír.
- A `salonic_direct:headspa` sor a merge-dzsel NEM keletkezik: a merge utáni (még be nem kapcsolt) állapotban a HeadSpa sd KI, a revert élő hatás nélkül visszaállítja az előző állapotot.
- Ha a bekapcsolás (külön lépés) után kell visszalépni: **előbb** `POST /api/meres-admin {muvelet:"sd_kapcsolo", uzletag:"headspa", be:false, ok:…}` (a `be` pontosan boolean), utána a kód-revert.
- A F2 miatt a régi „<kulcs> kupon” index-kulcs (ma 1 HeadSpa-sor) egyirányúan egyezik; D1 adat nem módosul. Az F1 alatt beírt index-sorok és HMAC-ek érvényesek maradnak.

## 7. Merge utáni lépések (DECISION #192) — és a bekapcsolás kapuja
1. Cloudflare Pages deploy ellenőrzése (`https://www.mosaicheadspa.hu/`, `Server: cloudflare`; a `functions/` + `netlify/lib` a Pages-en fut), tesztek / sd smoke zöld.
2. **Bekapcsolási kapu (a train független review-ja, N1):** az F1 × F2 együtt egy ritka esetben **téves, nem feloldható `reschedule_confirmed`**-et ad (új kuponos PÁROS + él egy normál PÁROS foglalása + a megjegyzés csere-szót és óra-említést tartalmaz → a valódi új konverzió elmarad; `sd_feloldas` ezt nem oldja fel; hatás: csak árnyék-mérési hiány). A `SALONIC_DIRECT.md` §16/1 nyitott pontja ezt eddig is a **bekapcsolást** blokkolónak nevezte; a #192 szövege ezt a pontot nem nevesíti. Ezért a bekapcsolás előtt a mérési oldal kifejezett jelzése kell arra, hogy ezt a gyengeséget vállalja (vagy hogy előbb szűkítsük: a kuponos ↔ normál pár kivétele / kötelező dátum-említés).
3. `salonic_direct:headspa=1` (csak árnyék-cél, `uzletag` kötelező; a globális sor TILOS), `meres_kapcsolo` és `GET /api/meres-admin?kapcsolok=1` ellenőrzése.
4. 30–60 perc figyelés: élő-ID 0, dupla 0, az első HeadSpa sd-sor smoke; az első **kuponos** HeadSpa sd-foglalásnál: a Meta `user_data`-ban van-e `em`, a C2 PASS-e.
