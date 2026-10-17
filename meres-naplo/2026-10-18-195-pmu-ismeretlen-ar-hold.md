# 2026-10-18 – DECISION #195 / 3: ismeretlen PMU-ár = HOLD (nem megy ki érték nélkül) + `pmu.unknown_price` hiba-számláló – teszt-napló

**MÉRÉST ÉRINT (az ÁRNYÉK-láncot: sd esemény-képzés / HOLD, elosztó újrapróbáló UPDATE, sd-riasztás); VÉDETT `netlify/lib/meres/{salonic-direct,elosztas}.js` módosul.** Élő konverziót nem kapcsol be és nem cserél, a foglalási folyamatot, a futó hirdetéseket, külső fiókot nem érint. **D1-et, kapcsolót (`meres_kapcsolo`) nem módosít; a `salonic_direct:headspa` sor NEM jön létre.** Vendégadat sehova nem kerül (a tesztek példa-adatokkal futnak, a számláló csak összesített darabszám).

**Stacked a #402-re** (alap: `claude/meres-194-kupon-nem-konverzio` `73df48e1`): a #402 módosítja az `arFeloldas`-t és az `esemeny-modell.js`-t, erre épül. A #402 merge-e után a diff csak a saját commitokra szűkül; a #402 ezen **visszafelé nem változtat** (a mérési oldal kikötése).

## 1. Engedély
- **DECISION #195** (mérési oldal + ChatGPT): #167 6243023279 (2026-10-18 01:23 Budapest) és a Drive DECISION-LOG „## #195 – 2026-10-18 01:35” (a fájl `modifiedTime` 2026-10-17T23:23:29Z; a két forrás egyezik): „Ismeretlen PMU-ár: nem küldünk érték nélkül; HOLD + hiba-számláló + névtábla-bővítés (#98).” A 6243023279 szó szerint: „ne küldjünk érték nélkül konverziót (#98: érték = valós ár). Legyen HOLD + hiba-számláló (`lepes_szamlalo`, pl. `pmu.unknown_price`), és a névtábla bővítése. Ha ez nem fér a #402-be, külön kis PR, de a #402 ne változtasson rajta visszafelé.”
- Napi 1 merge szabály: a 2026-10-18-i `main`-merge a #402; ez a PR legkorábban 10-19-én (vagy Feri külön mondatára) mehet. Feltételek a végső SHA-ra (CLAUDE.md): független review PASS, védett hash dokumentált (6.), rollback (7.), vendégadat sehova.

## 2. Mi van benne (`git diff 73df48e1..HEAD`)
| fájl | tartalom |
|---|---|
| `netlify/lib/meres/salonic-direct.js` | `pmuArHold(uzletag, jelleg, minoseg)` (`PMU_AR_HOLD_JELLEGEK = ['elso', 'visszajaro']`), `PMU_AR_HOLD_INDOK`, `PMU_AR_HOLD_SZAMLALO`; a `kuldesFuttat` `normal` módban `fk.fixAllapot = { allapot: 'halasztva', indok: 'pmu_unknown_price: HOLD …' }` (a `confirmed` / `suspected` mód elsőbbséget élvez); `pmuHoldSzamol` (foglalásonként egyszer, hibatűrő); a száraz terv jelzi (`ar_hold`), de írásmentes; `sdRiasztasok`: új típus `pmu_ar_ismeretlen` (a `tartva` sor, amelynek cellái `pmu_unknown_price` HOLD-ban vannak) |
| `netlify/lib/meres/elosztas.js` | az újrapróbáló UPDATE `ertek_minoseg = COALESCE(?13, ertek_minoseg)` (egy sor, a feloldott cella minősége `exact` lesz; a minőség nélküli, motoros hívás a meglévőt nem írja felül) |
| `tools/test-sd-195.mjs` (új) | 11 teszt (H1–H10, lásd 5.) |
| `tools/lib-sd-teszt.mjs`, `tools/test-salonic-direct.mjs`, `tools/test-sd-194.mjs` | a PMU alap-`level()` ismert árral (`ar: 25000`) fut; S0-01 / S0-26 / S0-32 elvárása `exact`; a P2 / P6 / F1 a lista-ár / Korrekció útját `ar: undefined`-del futtatja (csak teszt-segéd és -elvárás, nem kód) |
| `docs/booking-engine/SALONIC_DIRECT.md`, `…_HEADSPA.md` | 8. (D5) szabály, riasztás-típus, tesztlista; a „döntés a mérési oldalnak” mondat a #195 szerint lezárva |

Nincs D1-séma-változás: a HOLD a meglévő `meres_kuldes` cellákat (`halasztva`) és a `foglalas_egyeztetes.sd_allapot = 'tartva'` állapotot használja; a számláló a meglévő `lepes_szamlalo` táblába ír (`SZAMLALO_DB`), új oszlop nélkül.

## 3. Viselkedés (állapotgép)
1. **HOLD-feltétel:** `uzletag = pmu` ÉS `ertek_minoseg = unknown_price` (az `arFeloldas` eredménye: nincs Zap `ar`, nincs lista-ár, nem „Korrekció”, nem kedvezmény-gyanús) ÉS jelleg ∈ {`elso`, `visszajaro`}. A konzultáció a rögzített táblaértéket kapja (`exact`), tehát nem érintett.
2. **HOLD:** minden (esemény × platform) cella `halasztva`, `indok = pmu_unknown_price: HOLD, nincs automatikus kuldes (… DECISION #195)`, `ertek = NULL`; 0 platformhívás (Meta, TikTok, Google, GA4); az sd-sor `tartva` + riasztás (a meglévő `veglegesIr` szabály: `halasztva` cella → `tartva`).
3. **Számláló:** a HOLD-cellák megíródása után, foglalásonként EGYSZER: `lepes_szamlalo (nap = budapesti dátum, uzletag = 'pmu', lepes = 'meres_hold', tipus = 'unknown_price') db + 1` (`SZAMLALO_DB`, a meglévő `ir()` atomi növelés, napi plafon 100 000). Az ismételt feldolgozás nem növeli (a szám a már létező HOLD-cellák megléte alapján dől el). A számláló hibája / hiánya a HOLD-ot nem akadályozza (`ar_hold.szamlalo_irva = false`). Olvasás: `SELECT nap, uzletag, tipus, db FROM lepes_szamlalo WHERE lepes = 'meres_hold'`; a meglévő `GET /api/foglalo-szamlalo` kimenetében additívan jelenik meg: JSON `napok.<nap>.pmu.lepesek.meres_hold`, CSV sor `nap;pmu;meres_hold;;db` (a `tipus` itt nem látszik, mert a foglaló-lépések összesítése nem hordozza), a HTML-tábla csak a `LEPESEK` oszlopokat mutatja (a `meres_hold` nem jelenik meg). A teljes kulcs (`tipus = unknown_price`) a D1-ből olvasható.
4. **Riasztás:** `GET /api/foglalas-egyeztetes?kulcs=…&sd_riasztas=1` → `tipus: pmu_ar_ismeretlen` (nem `elo_allapot_nem_ellenorizheto`), `ok: „DECISION #195: a PMU szolgáltatás ára ismeretlen (HOLD, 0 küldés; feloldás: nevtábla-frissítés után a sor ismételt sd_atvetel hívása)”`. A QA sor (`egyeztetes-sor.js`) változatlanul `sd_tartva` kategóriát ad (a protected fájlhoz nem nyúltam).
5. **Feloldás:** az ár később ismertté válik (nevtábla-frissítés: a #194 célzott frissítése az `arFeloldas`-ból, vagy a napi frissítés) → ugyanannak a `sd_atvetel` testnek az ISMÉTELT hívása (Zap-újraküldés vagy kézi `POST /api/foglalas-egyeztetes`, a 48 órás kapun belül) a meglévő újrafuttatási úton a halasztott cellákat az igazi árral küldi (`value` = lista-ár; `ertek_minoseg = exact`, `ertek_forras = szolgaltatas_lista`), a sor `kesz`, a riasztás megszűnik; a számláló nem változik. **48 óra után** az ismételt hívás `lejart` (nincs automatikus küldés), a cellák HOLD-ban maradnak – ember dönt (a meglévő 48 órás kapu).
6. **Elsőbbség:** ha a bejegyzés egyúttal csere-gyanús (`suspected` / `hianyzo_mezo`) vagy `confirmed`, a csere-HOLD / `kihagyva` marad az uralkodó (a PMU-ár HOLD nem írja felül, a PMU-számláló nem nő).

## 4. Hatókör és döntési pont a mérési oldalnak
- **Mit fed:** a PMU `elso` ÉS `visszajaro` esemény (FoglalasElso + Schedule, ill. Visszajaro). A #167 6243023279 szövege („ismeretlen PMU-ár … ne küldjünk érték nélkül konverziót”) nem szűkít Visszajaróra, ezért mindkettőt fedtem; **ha csak a `Visszajaro` kell, egysoros szűkítés: `PMU_AR_HOLD_JELLEGEK = ['visszajaro']`** (a H2 és a H7 hatókör-teszt jelzi).
- **Mit NEM fed (változatlan, D5 / #131):** oxigén / HeadSpa / fodrász / szőr `unknown_price`, és minden üzletág `unknown_discount` (kedvezmény-gyanú) – ezek továbbra is érték nélkül mennek (Meta `value` nincs, TikTok `CompletePayment` visszatartva). **Kérdés:** kell-e ugyanez az elv (HOLD) ezekre is? (Külön DECISION; a kód `pmuArHold` hatókör-függvénye az egyetlen hely.)
- **Már kiment, érték nélküli sorok (múlt):** a prod `meres_kuldes`-ben a `salonic_direct` PMU `Visszajaro` `unknown_price` cellák: 2 `elkuldve` (Meta, TikTok – ÁRNYÉK-cél), 2 `kihagyva`; ezeket e PR nem érinti (nincs visszamenőleges módosítás).

## 5. Tesztek
- `node --test tools/test-sd-195.mjs`: **11/11 PASS** – H1 HOLD + 0 hívás + számláló = 1; H2 új vendég (8 cella); H3 ismétlés nem számol (és második foglalás → napi 2); H4 feloldás (Meta/TikTok `value` = 99 000, `exact`, számláló változatlan, további hívás nem küld újra); H4b 48 óra után `lejart`; H5 riasztás-típus (+ a régi `elo_allapot_nem_ellenorizheto` kontroll); H6 változatlan ágak (Korrekció 0 Ft, Zap-ár, lista-ár, PMU konzultáció 13 800 Ft); H7 hatókör (oxigén / fodrász / szőr `unknown_price` és PMU `unknown_discount` érték nélkül megy; `pmuArHold` táblázat); H8 száraz terv írásmentes (minden tábla azonos, számláló nem nő, 0 hálózat); H9 számláló-hiba / -hiány + `hianyzo_mezo` HOLD elsőbbség; H10 az `elosztas` újrapróbáló UPDATE frissíti az `ertek_minoseg`-et, a null a meglévőt nem írja felül (COALESCE).
- **Mutánsok (12, mind elkapva):** M1 HOLD-ág ki (H1–H5, H8, H9) · M2 hatókör: minden üzletág (H7) · M3 hatókör: `unknown_discount` is (H7) · M4 számláló minden ismétlésnél (H3) · M5 számláló nem ír (H1–H4) · M6 az `ertek_minoseg` nem frissül (H3, H4, H5, H10) · M7 a riasztás-típus nem különbözik (H5) · M8 csak `visszajaro` (H2, H7) · M9 a HOLD-cella `kihagyva` (nem újrapróbálható; H1–H5, H8, H9) · M10 a száraz terv számlál (H8) · M11 a számláló hibája kivételt dob (H9) · M12 a PMU-HOLD felülírja a csere-HOLD-ot (H9).
- **Meglévő tesztek:** `test-salonic-direct.mjs` 75/75 (golden-paritás S0-13 zöld: a motoros kérés-törzsek bájtra azonosak), `test-sd-194.mjs` 18/18, `test-sd-smoke.mjs` 14/14, `test-qa-nap.mjs` 43/43. **Teljes suite (teljes checkout): 506 teszt = 501 PASS / 2 FAIL (a `main` két ismert alap-hibája: `test-foglalo-atkotes` 19., `test-fuggetlenseg` 3.) / 3 SKIP.** (Sparse checkout-ban a `klon/` hiánya további 6 tesztet buktat – nem valódi hiba; a teljes checkouton zöldek.)

## 6. Védett elemek (blob-hash, 10 karakter)
| elem | `main` `97999a17` | #402 `73df48e1` | ez a PR | |
|---|---|---|---|---|
| `netlify/lib/meres/hash.js` | 41cfe4f599 | 41cfe4f599 | 41cfe4f599 | változatlan |
| `netlify/lib/meres/salonic-direct.js` | 18e8d6c971 | 885d5d777b | 393587a10c | **VÁLTOZIK** (PMU-ár HOLD, riasztás-típus) |
| `netlify/lib/meres/elosztas.js` | b8a48dc737 | ae57d630a9 | 823dd35af5 | **VÁLTOZIK** (1 sor: `ertek_minoseg` COALESCE az újrapróbáló UPDATE-ben) |
| `netlify/lib/meres/esemeny-modell.js` | e1cf68dec0 | f07e2ce4fe | f07e2ce4fe | változatlan (a #402-höz képest) |
| `netlify/lib/meres/egyeztetes-sor.js` | 503a3eddcf | d967f83646 | d967f83646 | változatlan (a #402-höz képest) |
| `netlify/lib/meres/qa-nap.js` | e1d8dca808 | 23a73e442d | 23a73e442d | változatlan (a #402-höz képest) |
| fa `netlify` | 0435d58de0 | 6e494dac7a | 3129a6e6a0 | VÁLTOZIK (szándékos, a fenti 2 fájl) |
| `netlify/lib/foglalo-szamlalo.js` | 04fdf3a3fb | 04fdf3a3fb | 04fdf3a3fb | változatlan (csak importálom az `ir`, `napBudapest` függvényeket) |
| `assets/js/suti.js` | ea41ffd20d | ea41ffd20d | ea41ffd20d | változatlan |
| `assets/js/attribucio.js` | 79c09c5937 | 79c09c5937 | 79c09c5937 | változatlan |
| `assets/js/booking-launcher.js` | 7cde59bea3 | 7cde59bea3 | 7cde59bea3 | változatlan |
| `assets/js/booking-engine/koszono.js` / `engine.js` / `lepes-meres.js` / `salonic-adapter.js` | 547d0e05fc / 422d612e44 / 545b95b944 / 61a6eb83a8 | = | = | változatlan |
| fa `assets/js/booking-engine` | a5a793f9ab | a5a793f9ab | a5a793f9ab | változatlan |
| fa `functions` | ef6558e82a | ef6558e82a | ef6558e82a | változatlan |
| `wrangler.toml` | ce5e69f063 | ce5e69f063 | ce5e69f063 | változatlan |
| `klon/oxigenterapia-ok.html` 157c141e5d, `klon/fodrasz-ok.html` 1ef408bcbb, `klon/m/oxigenterapia-ok.html` 88c2d866ae, `klon/m/fodrasz-ok.html` ae96e4ae97 | – | – | – | változatlan |
A `functions/`, az `assets/` és a `wrangler.toml` változatlan: az éles kapcsolók, a titkok és a foglalási folyamat érintetlen.

## 7. Rollback
- Kód: `git revert -m 1 <merge commit>` a `main`-en (merge-commit módszernél; squash esetén sima `git revert <sha>`) vagy a Cloudflare Pages `mosaic` projekt korábbi deploymentjének visszaállítása. D1-séma- és adatváltozás nincs; a már létrejött HOLD-cellák (`halasztva`, `pmu_unknown_price`) revert után a régi kóddal újrapróbálható cellaként viselkednek (a régi kód a következő ismételt `sd_atvetel`-nél érték nélkül elküldené őket – a visszagörgetés előtt érdemes a nyitott `pmu_ar_ismeretlen` riasztásokat átnézni).
- A `lepes_szamlalo` `meres_hold` sorai ártalmatlanok (additív kulcs), törlésük nem szükséges.

## 8. Nyitott pontok
- **Névtábla-bővítés (PMU):** a prod `salonic_nevtabla` a PMU-fiókra (`place_id` 14585) jelenleg CSAK a `hely` sort tartalmazza (utolsó frissítés 2026-10-10T12:15:17Z; 0 `szolgaltatas`, 0 `ar` sor – az ok: a lusta frissítés a párosítás 2. ágához kötött, a PMU-nál az 1. ág mindig sikeres, ezért a tábla soha nem frissült). A #402 (a)(b) a kódbeli javítást adja: az ár-feloldás az első ismeretlen PMU-névnél célzottan frissít (fiókonként legfeljebb 600 mp-enként, `nevtablaFrissito`). **E PR a névtábla-bővítéshez kódban többet nem tesz** (a frissítő útvonal már kész); a PMU szolgáltatás-lista tényleges betöltését élő Salonic-lekérdezés adná, amit e PR szándékosan nem futtat (külső szolgáltatás, a feladat tiltja). Javaslat a deploy után: az első PMU-foglalás utáni `GET /api/foglalas-egyeztetes?kulcs=…&nevtabla=1` ellenőrzés (csak olvasás), hogy a 14585 alatt megjelentek-e a `szolgaltatas` / `ar` sorok; ha nem, a meglévő kulcsos admin-hívás – `POST /api/foglalas-egyeztetes {"nevtabla": "frissit", "uzletag": "pmu"}` – egyszeri futtatása (a nyilvános Salonic-oldalakat olvassa; a mérési oldal jóváhagyásával, ezt e PR nem futtatta).
- **A HOLD feloldásának triggere:** nincs időzített újrafuttató – az ismételt `sd_atvetel` a Zap-újraküldés vagy kézi hívás. Ha automatikus feloldás kell (pl. a napi nevtábla-frissítés után a `pmu_ar_ismeretlen` sorok újrafuttatása), az új működés, külön DECISION.
- **Ismeretlen PMU-ár jelentése:** a QA-nap `sd_tartva` kategóriában látszik; ha külön lámpa-/jelentés-mező kell (`pmu_ar_hold`), az `egyeztetes-sor.js` / `qa-nap.js` védett módosítás, külön lépés.
- **Hatókör-kérdések:** lásd 4. (csak `visszajaro`? más üzletágak `unknown_price` / `unknown_discount`?).
