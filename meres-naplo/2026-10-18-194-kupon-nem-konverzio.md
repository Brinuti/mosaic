# 2026-10-18 – DECISION #194: kuponos foglalás nem konverzió + N1 szűkítés + PMU `salonic_direct` `Visszajaro` érték – teszt-napló

**MÉRÉST ÉRINT (az ÁRNYÉK-láncot: esemény-képzés, elosztás, jelentések, sd csere-felismerés, sd ár-feloldás); VÉDETT `netlify/lib/meres/{esemeny-modell,elosztas,salonic-direct,egyeztetes-sor,qa-nap}.js` módosul.** Élő konverziót nem kapcsol be és nem cserél, a foglalási folyamatot, a futó hirdetéseket, külső fiókot nem érint. **D1-et, kapcsolót (`meres_kapcsolo`) nem módosít; a `salonic_direct:headspa` sor NEM jön létre.** Vendégadat sehova nem kerül (a tesztek példa-adatokkal futnak).

## 1. Engedély (CLAUDE.md, „Állandó felhatalmazás”)
- **DECISION #194** (mérési oldal + ChatGPT): #167 megjegyzései 6240109548, 6240242371, 6240295578, 6240322795, 6240374155, 6240456665 (kuponos foglalás nem konverzió; `/success-ajandekkartya-stripe` foglaló-linkek le [ez külön PR-ban már élő: #397]; HeadSpa sd bekapcsolás feltételei; a PMU `Visszajaro` érték hiánya).
- **Drive-os DECISION-LOG**: az N1 (kuponos ↔ normál pár kivétele a csere-felismerésből) rögzítését a #167-ben (6241343844) kértem; **a merge feltétele, hogy a #167 és a Drive-os DECISION-LOG egyezzen** – a fő munkamenet ellenőrzi merge előtt.
- Napi 1 merge szabály: ez a PR a nap egyetlen `main`-merge-je.

## 2. Mi van benne (`git diff origin/main..HEAD`, `main` = `97999a17`)
| fájl | tartalom |
|---|---|
| `netlify/lib/meres/esemeny-modell.js` | `esemenyek()`: `fk.tipus === 'foglalas' && fk.kupon` → `[]` (minden üzletág / jelleg); az ajándékkártya-vásárlás (`tipus: 'ajandekkartya'`) változatlan |
| `netlify/lib/meres/elosztas.js` | üres esemény-lista + kupon → `{ allapot: 'nincs_esemeny', kupon_nem_konverzio: true, miert: 'DECISION #194 …' }`; nincs `meres_kuldes` sor, nincs hálózati hívás |
| `netlify/lib/meres/salonic-direct.js` | `kuponosSzolg`, `szolgIndexKulcs` (kanonikus kulcs + `" kupon"` kuponosnál), szigorú `szolgKulcsEgyezik(tárolt, kulcs)`; az index-beszúrás és a `csereDontes` ezt használja (N1); `arFeloldas`: PMU „Korrekció” = 0 Ft `exact` (`korrekcio_az_arban`) + a fiók nevtábla-ának célzott frissítése (`fuggosegek.nevtablaFrissito`, `NEVTABLA_AR_FRISSIT_MP = 600`, workerenként, fail-closed); `arFrissitesNullaz` (csak teszthez) |
| `netlify/lib/meres/egyeztetes-sor.js` | kuponos, esemény nélküli sor: nincs `nincs_esemeny` / `parositatlan` jelzés, `kupon_nem_konverzio: true` |
| `netlify/lib/meres/qa-nap.js` | `lefedettseg`: `meres_jelleg.kupon = 1` → `szabalyos_esemeny_nelkul` (nem `parositott_esemeny_nelkul` / `nincs_sor`) |
| `tools/sd-smoke-ellenorzes.mjs` | a `level` lekérdezés `kupon` oszlopa; kuponos sd-foglalásnál C5 / C6 / C7 / C8 = `NA` (és `FAIL`, ha mégis van esemény-sor / kiment kérelem) |
| `tools/fixtures/golden-motor-kerelem.json` | 468 → 300 kérés: a **168 kiesett kulcs mind `…|kupon|…`**, a 300 megmaradt **bájtra azonos** a régi fixture-rel, az `elosztasok` (6) azonos (python-bizonyíték: `origin/main` fixture vs új) |
| tesztek | új `tools/test-sd-194.mjs` (10); átírva: `test-sd-headspa.mjs` HS-02/04/05/06, `test-sd-smoke.mjs` SM13 (+ `meres_jelleg` biztosítás a nem-sd esetekhez), `test-salonic-direct.mjs` S0-13 / S0-62..65, `test-meres.mjs` X1; új `test-qa-nap.mjs` N33b |
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
| `node --test tools/test-sd-194.mjs` | 10/10 |
| `node --test tools/test-sd-headspa.mjs tools/test-sd-smoke.mjs tools/test-salonic-direct.mjs tools/test-meres.mjs tools/test-qa-nap.mjs tools/test-egyeztetes-sor.mjs` | zöld (a golden-paritás S0-13: 300 kérés, a nem kuponos rész bájtra azonos) |
| `node --test tools/test-*.mjs` (a `main` `97999a17` fölé rebase-elt végső fejen) | **485 teszt: 480 PASS, 2 FAIL, 3 SKIP.** A 2 hiba **a `main`-en is megvan**: `test-foglalo-atkotes` 19. eset (`oxigen-uj.js:134`) és `test-fuggetlenseg` 3. eset |

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
(M7: az első változatban a P6 még átment, mert a teszt-világban a motor párosítási 2. ága is frissítette a táblát; a P6 azóta a valós D1-állapotot utánozza – hely + munkatárs sor, szolgáltatás nincs –, így az sd ár-feloldását izolálja.)

## 6. Védett elemek (alap: `origin/main` `97999a17`; blob-hash, 10 karakter)
| elem | `main` | ez a PR | |
|---|---|---|---|
| `netlify/lib/meres/hash.js` | 41cfe4f599 | 41cfe4f599 | változatlan |
| `netlify/lib/meres/elosztas.js` | b8a48dc737 | ae57d630a9 | **VÁLTOZIK** (kupon → nincs_esemeny, 5 sor) |
| `netlify/lib/meres/salonic-direct.js` | 18e8d6c971 | cb4b31c0d0 | **VÁLTOZIK** (N1, ár-feloldás) |
| `netlify/lib/meres/esemeny-modell.js` | e1cf68dec0 | e69cf54082 | **VÁLTOZIK** (kupon-szűrő) |
| `netlify/lib/meres/egyeztetes-sor.js` | 503a3eddcf | d967f83646 | **VÁLTOZIK** (jelzés) |
| `netlify/lib/meres/qa-nap.js` | e1d8dca808 | 2dbb9f12f2 | **VÁLTOZIK** (lefedettség) |
| fa `netlify` | 0435d58de0 | 6a47b88c75 | VÁLTOZIK (szándékos, a fenti 5 fájl) |
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
A `functions/`, az `assets/` és a `wrangler.toml` változatlan: az éles kapcsolók, a titkok és a foglalási folyamat érintetlen.

## 7. Rollback
- Kód: `git revert -m 1 <merge commit>` a `main`-en (merge-commit módszernél; squash esetén sima `git revert <sha>`), vagy a Cloudflare Pages `mosaic` projekt korábbi deploymentjének visszaállítása. D1-séma- és adatváltozás nincs, így a revert tiszta.
- A deploy után: a kuponos (ajándékkártyás) HeadSpa / PMU / … foglalások a **motoron is** esemény nélkül maradnak (a motor ugyanazt az `esemenyek()`-et használja) – ez a szándékos viselkedés; revert után újra FoglalasElso / Visszajaro (érték nélkül) menne ki rájuk.
- A `salonic_direct:headspa` sor nem keletkezik; ha a bekapcsolás (külön lépés) után kell visszalépni: előbb `POST /api/meres-admin {muvelet:"sd_kapcsolo", uzletag:"headspa", be:false, ok:…}` (`be` pontosan boolean), utána a kód-revert.
- Az új vendég-index sorok kulcsa (`<kanon> kupon`) revert után a régi kóddal sem okoz hibát: a régi `szolgKulcsEgyezik` a `<kulcs> kupon` alakot a HeadSpa-ra eleve tolerálta.

## 8. Maradék ablak, észrevételek, nyitott pont
- **Maradék ablak (N1):** az F2 élesedése (2026-10-17 19:53:54Z) és e változás élesedése között indexelt kuponos sorok kulcsa kupon-jelzés nélküli (a jelzés nem tárolódott), így azok normálnak látszanak. Hatás: a HeadSpa sd KI (nincs `salonic_direct:headspa` sor), tehát nincs csere-döntés; a sorok legfeljebb 180 napig élnek (`MEGORZES_NAP`). Ha az sd bekapcsolása a deploy előtt történne, ez az ablak megnyílna – ezért a sorrend: merge + deploy → bekapcsolás.
- **Lámpa (nyitott észrevétel, NEM változtattam):** a `qa-nap` Meta / TikTok lámpájának viszonyítási alapja a `valos.parositott` (#167 134. komment). A kuponos foglalások innentől esemény nélküliek, de a lámpa nevezőjében benne maradnak → magas kuponos arány mellett az `alap_elkuldve / valos.parositott` hányados sárgára billenhet. Javaslat a mérési oldalnak: a nevezőből a `szabalyos_esemeny_nelkul` kivonása. A viszonyítási alap a mérési oldal döntése, ezért ebben a PR-ban nem érintem.
- **A sd smoke-eszköz** kuponos sd-foglalásnál C5–C8 `NA` (nem hiba); a már lefutott, F1 előtti (index nélküli) kuponos sor C2 `WARN`, a verdikt `PASS` marad.
- Az első HeadSpa kuponos sd-foglalásnál (bekapcsolás után) a figyelés: 0 `meres_kuldes` sor, `sd_allapot = kesz`, a C-lista 12 sorából C5–C8 `NA`, a többi `PASS`.
