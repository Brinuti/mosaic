# 2026-10-18 – DECISION #194: kuponos foglalás nem konverzió + N1 szűkítés + PMU `salonic_direct` `Visszajaro` érték – teszt-napló

**MÉRÉST ÉRINT (az ÁRNYÉK-láncot: esemény-képzés, elosztás, jelentések, sd csere-felismerés, sd ár-feloldás, QA-lámpa nevező); VÉDETT `netlify/lib/meres/{esemeny-modell,elosztas,salonic-direct,egyeztetes-sor,qa-nap}.js` módosul.** Élő konverziót nem kapcsol be és nem cserél, a foglalási folyamatot, a futó hirdetéseket, külső fiókot nem érint. **D1-et, kapcsolót (`meres_kapcsolo`) nem módosít; a `salonic_direct:headspa` sor NEM jön létre.** Vendégadat sehova nem kerül (a tesztek példa-adatokkal futnak).

## 1. Engedély (CLAUDE.md, „Állandó felhatalmazás”)
- **DECISION #194** (mérési oldal + ChatGPT): #167 megjegyzései 6240109548, 6240242371, 6240295578, 6240322795, 6240374155, 6240456665 (kuponos foglalás nem konverzió; `/success-ajandekkartya-stripe` foglaló-linkek le [ez külön PR-ban már élő: #397]; HeadSpa sd bekapcsolás feltételei; a PMU `Visszajaro` érték hiánya).
- **Drive-os DECISION-LOG**: az N1 (kuponos ↔ normál pár kivétele a csere-felismerésből) rögzítését a #167-ben (6241343844) kértem; **a merge feltétele, hogy a #167 és a Drive-os DECISION-LOG egyezzen** – a fő munkamenet ellenőrzi merge előtt.
- Napi 1 merge szabály: ez a PR a nap egyetlen `main`-merge-je.

## 2. Mi van benne (`git diff origin/main..HEAD`, `main` = `97999a17`)
| fájl | tartalom |
|---|---|
| `netlify/lib/meres/esemeny-modell.js` | `esemenyek()`: `fk.tipus === 'foglalas' && fk.kupon` → `[]` (minden üzletág / jelleg); az ajándékkártya-vásárlás (`tipus: 'ajandekkartya'`) változatlan; **F-6:** az EGYETLEN kupon-felismerő `kuponJelzes` (kupon / coupon, ékezet-, kisbetű-, zero-width-független), a `foglalasJelleg` ezt használja |
| `netlify/lib/meres/elosztas.js` | üres esemény-lista + kupon → `{ allapot: 'nincs_esemeny', kupon_nem_konverzio: true, miert: 'DECISION #194 …' }`; nincs `meres_kuldes` sor, nincs hálózati hívás |
| `netlify/lib/meres/salonic-direct.js` | `kuponosSzolg`, `szolgIndexKulcs` (kanonikus kulcs + `" kupon"` kuponosnál), szigorú `szolgKulcsEgyezik(tárolt, kulcs)`; az index-beszúrás és a `csereDontes` ezt használja (N1); `arFeloldas`: PMU „Korrekció” = 0 Ft `exact` (`korrekcio_az_arban`; **F-5:** csak a PONTOS név) + a fiók nevtáblájának célzott frissítése (`fuggosegek.nevtablaFrissito`, `NEVTABLA_AR_FRISSIT_MP = 600`, workerenként, fail-closed; **F-1:** a száraz ág nem kap `fuggosegek`-et → nincs frissítés, nincs írás); **F-4:** `csereDontes(…, { kuponos })` – kuponos új foglalásnál a csere-felismerés nem fut; **F-6:** a `kuponosSzolg` duplikáció megszűnt (`kuponJelzes` az `esemeny-modell.js`-ből, az index-kulcs és a kedvezmény-gyanú is ezt használja); `arFrissitesNullaz` (csak teszthez) |
| `netlify/lib/meres/egyeztetes-sor.js` | kuponos, esemény nélküli sor: nincs `nincs_esemeny` / `parositatlan` jelzés, `kupon_nem_konverzio: true` |
| `netlify/lib/meres/qa-nap.js` | `lefedettseg`: `meres_jelleg.kupon = 1` → `szabalyos_esemeny_nelkul` (nem `parositott_esemeny_nelkul` / `nincs_sor`); **F-3:** a Meta / TikTok lámpa nevezője = `valos.parositott` − a kuponos PÁROSÍTOTT foglalások (`arnyek.<platform>.nevezo_parositott`; 0 → `n/a`) |
| `tools/sd-smoke-ellenorzes.mjs` | a `level` lekérdezés `kupon` oszlopa; kuponos sd-foglalásnál C5 / C6 / C7 / C8 = `NA` (és `FAIL`, ha mégis van esemény-sor / kiment kérelem) |
| `tools/fixtures/golden-motor-kerelem.json` | 468 → 300 kérés: a **168 kiesett kulcs mind `…|kupon|…`**, a 300 megmaradt **bájtra azonos** a régi fixture-rel, az `elosztasok` (6) azonos (python-bizonyíték: `origin/main` fixture vs új) |
| tesztek | új `tools/test-sd-194.mjs` (K1–K4, F6, P1–P6 + P1b, F1, F4, F4b); átírva: `test-sd-headspa.mjs` HS-02/04/05/06, `test-sd-smoke.mjs` SM13 (+ `meres_jelleg` biztosítás a nem-sd esetekhez), `test-salonic-direct.mjs` S0-13 / S0-62..65 (S0-63: kuponos új foglalás → nincs csere-felismerés), `test-meres.mjs` X1; új `test-qa-nap.mjs` N33b, N33c |
| docs | `SALONIC_DIRECT_HEADSPA.md` (állapot, HS-táblázat, új 8. fejezet), `SALONIC_DIRECT.md` (§8, §16/1), `QA2_ARNYEK.md`, `QA_NAP.md`, `QA4_ELESITES.md`, `EGYEZTETES_HIVAS.md` |

## 3. Döntések (a megvalósításban)
1. **Nincs `AjandekkartyaBevaltas` információs esemény és nincs `kihagyva` sor** a kuponos foglaláshoz: a tartós nyom a `meres_jelleg.kupon = 1` (az első levél jellege, X1). Indok: a „semmilyen esemény nem megy ki” egyértelmű; minden extra sor (akár `kihagyva`) a `meres_kuldes`-ben a lefedettség / dedup számlálókat zavarná.
2. **N1 séma nélkül:** a kupon-jelzés az index meglévő `szolg_kulcs` oszlopába kerül (`<kanon> kupon`), nincs D1-séma- és adatváltozás. A kuponos ↔ normál pár megjegyzés-alapú csere-gyanúnál HOLD (`halasztva`, 0 küldés, „nincs azonos szolgáltatás jelölt”), nem `reschedule_confirmed`: a normál foglalás konverziója csendben nem vész el.
3. **PMU „Korrekció” = 0 Ft `exact`:** a Salonic PMU-listában ár nélküli tétel (az eredeti kezelés ára tartalmazza). Csak PMU-ra és a pontos `korrekcio` kanonikus névre; minden más ár nélküli tétel `unknown_price` marad (fail-closed). A Meta / TikTok `Visszajaro` ezért `value: 0 HUF`, `ertek_minoseg: exact` (korábban érték nélkül).
4. **PMU-nevtábla frissítés az ár-feloldásból:** a gyökérok (élő D1, csak olvasás): a `salonic_nevtabla` PMU-fiókra (place 14585) csak a `hely` sort tartalmazta (frissítve 2026-10-10), mert a lusta frissítés a párosítás 2. ágához (`nevtablabolKulcs`) kötött, a PMU-nál az 1. ág (Salonic-oldal) mindig sikeres. Az ár-feloldás ezért ha a fiókhoz nincs szolgáltatás / a név hiányzik, egyszer (fiókonként 600 mp, workerenként) célzottan frissít. Operatív alternatíva (a deploy után nem szükséges): `POST /api/foglalas-egyeztetes {nevtabla:"frissit", uzletag:"pmu"}`.
5. **Nem része:** a lámpa (`valos.parositott` viszonyítási alap) átírása – lásd 8. észrevétel.

## 4. Tesztek (helyben, Node, hamis hálózat, nincs titok)
| parancs | eredmény |
|---|---|
| `node --test tools/test-sd-194.mjs` | 16/16 |
| `node --test tools/test-sd-headspa.mjs tools/test-sd-smoke.mjs tools/test-salonic-direct.mjs tools/test-meres.mjs tools/test-qa-nap.mjs tools/test-egyeztetes-sor.mjs` | zöld (a golden-paritás S0-13: 300 kérés, a nem kuponos rész bájtra azonos) |
| `node --test tools/test-*.mjs` (a `main` `97999a17` fölé rebase-elt végső fejen, a review-javítások után) | **491 teszt: 486 PASS, 2 FAIL, 3 SKIP** (az első kör: 485 / 480). A 2 hiba **a `main`-en is megvan**: `test-foglalo-atkotes` 19. eset (`oxigen-uj.js:134`) és `test-fuggetlenseg` 3. eset |

(A sparse worktree-ben a `klon/` és a `gyogytorna/` kihagyva volt; a teljes futáshoz hozzáadva, különben a `test-foglalo-atkotes` / `test-halott-gombok` környezeti okból bukik.)

## 5. Mutációs ellenpróbák (a kód szándékos elrontása → a tesztek bukjanak)
Minden mutációt egyenként alkalmaztam az éles fájlon, lefuttattam a 7 érintett tesztfájlt (`test-sd-194`, `-headspa`, `-smoke`, `test-salonic-direct`, `test-meres`, `test-qa-nap`, `test-egyeztetes-sor`: 208 teszt), majd visszaállítottam:
| mutáció | bukó tesztek |
|---|---|
| M1 a kupon-szűrő kivétele az `esemenyek()`-ből | HS-04, HS-05, HS-06, K1, K2, K3, S0-13, S0-64, S0-65, SM13, X1 (11) |
| M2 `kupon_nem_konverzio` jel kivétele az `elosztas()`-ból | HS-04, HS-05, K3, S0-65, X1 (5) |
| M3 N1: `szolgIndexKulcs` a kupon-jelzés nélkül | HS-02, HS-04, S0-62, S0-63 (4) |
| M4 N1: `szolgKulcsEgyezik` tolerans (régi egyirányú tolerancia) | HS-02, S0-62, S0-63 (3) |
| M5 PMU Korrekció-szabály kivétele | P1, P2, P3 (3) |
| M6 a Korrekció-szabály minden üzletágra (PMU-szűrő kivétele) | P1 |
| M7 a nevtábla célzott frissítés kikapcsolása | P3, P4, P6 |
| M8 a frissítés throttle nélkül | P4 |
| M9 a frissítés kuponosra is (kedvezmény-szűrő kivétele) | P5 |
| M10 qa-nap: a kupon nem szabályos nulla | N33b |
| M11 egyeztető sor: `kupon_nem_konverzio` mindig false | K4 |
| M12 sd smoke: a kuponos ág kivétele | SM13 |
M13–M24: a review-javítások (F-1, F-3, F-4, F-5, F-6) mutánsai – lásd a 9. szakaszt.
(M7: az első változatban a P6 még átment, mert a teszt-világban a motor párosítási 2. ága is frissítette a táblát; a P6 azóta a valós D1-állapotot utánozza – hely + munkatárs sor, szolgáltatás nincs –, így az sd ár-feloldását izolálja.)

## 6. Védett elemek (alap: `origin/main` `97999a17`; blob-hash, 10 karakter; a review-javítások utáni VÉGSŐ állapot – a végső commit a kód mellett csak ezt a naplót és a docs/ fájlokat érinti)
| elem | `main` | ez a PR | |
|---|---|---|---|
| `netlify/lib/meres/hash.js` | 41cfe4f599 | 41cfe4f599 | változatlan |
| `netlify/lib/meres/elosztas.js` | b8a48dc737 | ae57d630a9 | **VÁLTOZIK** (kupon → nincs_esemeny, 5 sor) |
| `netlify/lib/meres/salonic-direct.js` | 18e8d6c971 | 885d5d777b | **VÁLTOZIK** (N1, ár-feloldás, F-1/F-4/F-5/F-6) |
| `netlify/lib/meres/esemeny-modell.js` | e1cf68dec0 | 859ca0b7c4 | **VÁLTOZIK** (kupon-szűrő, `kuponJelzes`) |
| `netlify/lib/meres/egyeztetes-sor.js` | 503a3eddcf | d967f83646 | **VÁLTOZIK** (jelzés) |
| `netlify/lib/meres/qa-nap.js` | e1d8dca808 | 23a73e442d | **VÁLTOZIK** (lefedettség, lámpa-nevező) |
| fa `netlify` | 0435d58de0 | 37788903d8 | VÁLTOZIK (szándékos, a fenti 5 fájl) |
| `netlify/lib/foglalo-szamlalo.js` | 04fdf3a3fb | 04fdf3a3fb | változatlan |
| `assets/js/suti.js` | ea41ffd20d | ea41ffd20d | változatlan |
| `assets/js/attribucio.js` | 79c09c5937 | 79c09c5937 | változatlan |
| `assets/js/booking-launcher.js` | 7cde59bea3 | 7cde59bea3 | változatlan |
| `assets/js/booking-engine/koszono.js` | 547d0e05fc | 547d0e05fc | változatlan |
| `assets/js/booking-engine/engine.js` | 422d612e44 | 422d612e44 | változatlan |
| `assets/js/booking-engine/lepes-meres.js` | 545b95b944 | 545b95b944 | változatlan |
| `assets/js/booking-engine/salonic-adapter.js` | 61a6eb83a8 | 61a6eb83a8 | változatlan |
| fa `assets/js/booking-engine` | a5a793f9ab | a5a793f9ab | változatlan |
| fa `functions` | ef6558e82a | ef6558e82a | változatlan |
| `klon/oxigenterapia-ok.html` `157c141e5d`, `klon/fodrasz-ok.html` `1ef408bcbb`, `klon/m/oxigenterapia-ok.html` `88c2d866ae`, `klon/m/fodrasz-ok.html` `ae96e4ae97` | – | – | változatlan |
| `wrangler.toml` | ce5e69f063 | ce5e69f063 | változatlan |
A `functions/`, az `assets/` és a `wrangler.toml` változatlan: az éles kapcsolók, a titkok és a foglalási folyamat érintetlen. (Az első kör fájl-hash-ei: `salonic-direct.js` `cb4b31c0d0`, `esemeny-modell.js` `e69cf54082`, `qa-nap.js` `2dbb9f12f2`, fa `netlify` `6a47b88c75`; az `elosztas.js`, `egyeztetes-sor.js` nem változott.)

## 7. Rollback
- Kód: `git revert -m 1 <merge commit>` a `main`-en (merge-commit módszernél; squash esetén sima `git revert <sha>`), vagy a Cloudflare Pages `mosaic` projekt korábbi deploymentjének visszaállítása. D1-séma- és adatváltozás nincs, így a revert tiszta.
- A deploy után: a kuponos (ajándékkártyás) HeadSpa / PMU / … foglalások a **motoron is** esemény nélkül maradnak (a motor ugyanazt az `esemenyek()`-et használja) – ez a szándékos viselkedés; revert után újra FoglalasElso / Visszajaro (érték nélkül) menne ki rájuk.
- A `salonic_direct:headspa` sor nem keletkezik; ha a bekapcsolás (külön lépés) után kell visszalépni: előbb `POST /api/meres-admin {muvelet:"sd_kapcsolo", uzletag:"headspa", be:false, ok:…}` (`be` pontosan boolean), utána a kód-revert.
- Az új vendég-index sorok kulcsa (`<kanon> kupon`) revert után a régi kóddal sem okoz hibát: a régi `szolgKulcsEgyezik` a `<kulcs> kupon` alakot a HeadSpa-ra eleve tolerálta.

## 8. Maradék ablak, észrevételek, nyitott pont
- **Maradék ablak (N1):** az F2 élesedése (2026-10-17 19:53:54Z) és e változás élesedése között indexelt kuponos sorok kulcsa kupon-jelzés nélküli (a jelzés nem tárolódott), így azok normálnak látszanak. Hatás: a HeadSpa sd KI (nincs `salonic_direct:headspa` sor), tehát nincs csere-döntés; a sorok legfeljebb 180 napig élnek (`MEGORZES_NAP`). Ha az sd bekapcsolása a deploy előtt történne, ez az ablak megnyílna – ezért a sorrend: merge + deploy → bekapcsolás.
- **Lámpa (review F-3, JAVÍTVA):** a Meta / TikTok lámpa nevezője `valos.parositott` mínusz a kuponos PÁROSÍTOTT foglalások. Csak a kuponos sorokat vonom ki (nem a teljes `szabalyos_esemeny_nelkul`-t): a HeadSpa-konzultáció (#101) nevezője így változatlan, és az sd által átvett (nem párosított) kuponos sorok sem rontják el a nevezőt. Ha a mérési oldal a konzultációt is ki akarja vonni, az egysoros bővítés.
- **A sd smoke-eszköz** kuponos sd-foglalásnál C5–C8 `NA` (nem hiba); a már lefutott, F1 előtti (index nélküli) kuponos sor C2 `WARN`, a verdikt `PASS` marad.
- Az első HeadSpa kuponos sd-foglalásnál (bekapcsolás után) a figyelés: 0 `meres_kuldes` sor, `sd_allapot = kesz`, a C-lista 12 sorából C5–C8 `NA`, a többi `PASS`.
- **F-2 időablak (NEM kódszinten védett, a mérési oldal döntheti el):** az F2 élesedése (2026-10-17T19:53:54Z) és e PR élesedése között indexelt kuponos HeadSpa sorok kulcsa kupon-jelzés nélküli. Méret (D1, csak olvasás): **3 sor** (`meres_jelleg.kupon = 1`, `ido ≥ 1792266834`); a `salonic_direct:headspa` kapcsoló nincs bekapcsolva. Sorrend: merge + deploy → bekapcsolás.
- **„AJÁNDÉKKÁRTYÁVAL – …”** nem jelzés-azonosító szó (a `kuponJelzes` nem ismeri fel); külön DECISION kérdése, ha az ilyen nevű szolgáltatás is kuponos foglalásnak számít.
- **Döntés a mérési oldalnak:** ismeretlen PMU-ár esetén (nem „Korrekció”, nincs lista-ár) az esemény érték nélkül megy (`unknown_price`, D5) – így marad ebben a PR-ban; kell-e ilyenkor érték nélkül küldeni, vagy ne küldjünk.
- A `szolgKanon` a „COUPON –” előtagot nem vágja le (csak a „KUPONKÓDDAL –” előtagot): a „COUPON – …” kanonikus kulcsa más, mint a normál névé – ez a kuponos jelzés mellett nem okoz hibát (a kupon-jelzett kulcs úgysem egyezik normállal), de ha ilyen nevű szolgáltatás valóban létezik, érdemes kérdezni.

## 9. Review (PASS with notes) utáni javítások – F-1, F-3, F-4, F-5, F-6
| # | javítás | teszt | mutáns (a teszt elkapja) |
|---|---|---|---|
| F-1 | a száraz (`szaraz:true`) terv irás- és hálózatmentes: `arFeloldas({ …, fuggosegek: szaraz ? null : fuggosegek })` – nincs frissítő-hívás, nincs `nevtablaMent` | `F1`: PMU száraz `sd_atvetel` + megadott `nevtablaFrissito` → 0 hívás, 0 új hálózati hívás, **minden tábla** azonos előtte / utána; kontroll: az éles út ugyanerre egyszer frissít | M13 (a száraz ág `fuggosegek`-et kap) → F1 |
| F-3 | a lámpa nevezője = `valos.parositott` − kuponos PÁROSÍTOTT foglalások (frissességtől függetlenül); `arnyek.<platform>.nevezo_parositott`; 0 → `n/a` | `N33c`: 18 kuponos + 21 normál (a mért HeadSpa arány) → zöld; a normál hiány (3 hiányzó esemény) továbbra is sárga; `kupon = 0` sor nem von ki; csak kuponos → `n/a` | M16 (nevező kupon nélkül) → N33c; M17 (minden esemény nélküli párosított sor kivonva) → N31, N33c |
| F-4 | `csereDontes(…, { kuponos })`: kuponos új foglalásnál nincs csere-felismerés (`nincs_gyanu`, nincs HOLD / riasztás / audit-sor); a normál új foglalás vizsgálata változatlan | `F4` (6 eset: kuponos↔kuponos, normál→kuponos, kuponos új + csere-szó regi foglalás nélkül, `COUPON –`, + kontroll: kuponos→NORMÁL = HOLD 0 küldés, normál↔normál = `confirmed`), smoke C3 / C11 PASS és verdikt PASS; `F4b` (hiányzó megjegyzés-kulcs: kuponos `kesz`, normál `halasztva`); S0-63 átírva | M14 (a kapu kiveve) → F4, F4b, S0-63; M15 (a kapu a normálra is) → F4, F4b + 37 S0 teszt |
| F-5 | a „Korrekció” szabály a pontos névre: `fold(név).trim() === 'korrekcio'` (a `norm()` a „💉 Korrekció”-t is elfogadta volna) | `P1b`: „Korrekció (15 000 Ft)”, „AKCIÓ – Korrekció”, „💉 Korrekció”, „Korrekció – 5.000 Ft helyett most 0 Ft” és még 6 változat → `unknown_price`; a pontos nevek (ékezet / kisbetű / szélső szóköz) → 0 Ft `exact` | M18 (`norm`) → P1b; M19 (`szolgKanon`, a régi) → P1b |
| F-6 | EGY kupon-felismerő: `kuponJelzes` (`esemeny-modell.js`): „kupon” / „coupon”, NFD-ékezetmentes, kisbetűs, zero-width / soft hyphen / BOM törölve; a `kuponosSzolg` duplikáció és a `fold`-os `/kupon/i` megszűnt | `F6`: `COUPON – …`, `KÚPONKÓDDAL – …` (előre komponált és NFD), `ku\u200Bpon`, `KU\u200DPON`, `ku\u2060pon`, `ku\u00ADpon`, `\uFEFFkupon` → kuponos (`foglalasJelleg`, `esemenyek` = [], index-kulcs `… kupon`, kedvezmény-gyanú `unknown_discount`, sd-úton 0 esemény); „AJÁNDÉKKÁRTYÁVAL – …”, valós nevek, üres / null → nem | M20 (a régi `/kupon/i`) → F4, F6; M21 (zero-width nincs törölve) → F6; M22 (nincs „coupon”) → F4, F6; M23 (az index-kulcs saját regex) → F6; M24 (a kedvezmény-gyanú saját regex) → F6 |
A valós alakok viselkedése nem változott: a golden-paritás (S0-13) zöld, a 300 megmaradt kérés bájtra azonos a `main` fixture-jével.

## 10. Delta-review (6ee6f6c4: PASS with notes) – teszthiányok pótlása (csak teszt-fájlok)
Kód (`netlify/`), docs és golden fixture nem változott; a védett-hash táblázat (6.) ugyanaz marad. Új tesztek: `F4c`, `F4d`, `F6b` (`tools/test-sd-194.mjs`), `N33d` (`tools/test-qa-nap.mjs`).
| # | hiány | teszt | mutáns (az új teszt elkapja; a korábbi 214 teszt zölden hagyta) |
|---|---|---|---|
| 1 | kuponos foglalás SZÁRAZ terve csere-szóval | `F4c`: `terv.mod === 'normal'`, `csere` null, 0 terv-esemény, minden tábla azonos, 0 hálózati hívás (kuponos „(kupon)” és „COUPON –” névvel); kontroll: a normál terv `suspected` | M25: a kuponos kapu törlése a száraz ágból → F4c |
| 2 | kuponos ÚJRAFUTTATÁS (`atveve`, `hianyzoPotlas`) | `F4d`: megszakadt `atveve` sor és a régi `hianyzo_mezo` HOLD + megérkező csere-szavas megjegyzés → `kesz`, `csere` null, nincs riasztás / HOLD / `suspected` audit-sor; kontroll: a normál mindkét ágon `halasztva` + riasztás | M26: a kapu törlése az újrafuttatási ágból → F4d |
| 3 | lámpa-nevező: sd-átvett kuponos sorok és HeadSpa-konzultáció | `N33d`: 5 sd-átvett (nem `parositott`) kuponos sor → nevező 10 marad (és a 2 hiányzó esemény mellett sárga marad); 3 HeadSpa-konzultáció → nevező 13 (nem 10); vegyes eset 17 → 13 | M27: az `r.allapot === 'parositott'` szűrő törlése → N33d; M28: a konzultáció is levonódik → N33d |
| 4 | `kuponJelzes`: láthatatlan karakter a SZÓ KÖZEPÉN | `F6b`: mind a 13 karakter (U+200B–200F, U+2060–2064, U+00AD, U+180E, U+FEFF) a „kupon” / „coupon” / „KUPONKÓDDAL” szó különböző pontjain, több karakter együtt; negatív: valós nevek láthatatlan karakterrel nem kuponosak | M29: a BOM törlése a `LATHATATLAN`-ból → F6b; M30: a U+200B törlése → F6, F6b |
