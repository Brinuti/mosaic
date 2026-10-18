# 2026-10-18 – Google ARNYEK backend proba-feltoltes + visszavonas (DECISION #196; hetfoi 12:00-s Google E2E-kapu)

Ag: `claude/meres-google-proba` (a main 1673fd0a-ra epitve). Draft PR; merge/deploy NEM tortent, elo hivas NEM tortent, D1-iras NEM tortent (a teszteket fake D1/fake halozat futtatja).
Forras: a meresi oldal #167 6246096267 / 6246123744 keresei; DECISION #196 (Drive DECISION-LOG + #167). Ez a valtoztatas **nem** valt be elo konverziot, nem valtoztat a foglalasi folyamaton, nem nyul futo hirdeteshez.

## Mi keszult
| Fajl | Valtozas |
|---|---|
| `netlify/lib/meres/google-proba.js` (UJ) | `google_proba` + `google_proba_visszavon` admin-muvelet |
| `netlify/lib/meres/vegpontok.js` | 3 sor: a `kezelAdmin` POST-agban a ket muvelet routolasa (a kulcs-ellenorzes UTAN; kulcs nelkul 404) |
| `netlify/lib/meres/qa-nap.js` | `forras='google_proba'` sorok KIZARASA a T2/QA-szamlalokbol + `google_proba_db` a `t2start`-ban |
| `tools/meres-proba/meres-proba.mjs`, `uj-utak-proba.mjs` | opcionalis `MERES_GCLID` (szintetikus gclid, >= 10 karakter [A-Za-z0-9_-]); alap tovabbra `TESZT123` |
| `tools/test-google-proba.mjs` (UJ) | 16 teszt |
| `docs/booking-engine/MERES_GOOGLE_E2E_FUTTATOKONYV.md` (UJ), `QA_NAP.md` (+1 szakasz) | futtatokonyv + QA-jegyzet |

## A. A `google_proba` felulete
`POST /api/meres-admin` (`x-egyeztetes-kulcs`, a meresi oldal kulcsa), JSON torzs:
- `muvelet:"google_proba"`; `futas_id` (8 kisbetus hexa, opc.), `akciok` (a 8 ARNYEK-akcio ID-jabol 1–8 elemu lista, opc.), `gclid_sorszam` (opc., 1 = a legfrissebb HeadSpa FoglalasElso), `kuld` (csak `true` kuld), `megerosit:"ARNYEK-6088874770-PROBA"`.
- **Alapbol SZARAZ**: csak olvas (a gclid-kivalasztas a D1-bol), nincs halozat, nincs iras. Valasz: `futas_id`, `source_id` (`gp_<futas>`), `gclid:"gclid#1"`, `gclid_hash8`, `gclid_forras{...}`, `kuldes_feltetelei{meres_elosztas_be, webhook_beallitva}` (csak igen/nem), `terv[8]`.
- **Kuldes** (`kuld:true` + `megerosit` + `MERES_ELOSZTO=1` + `GOOGLE_ARNYEK_WEBHOOK_URL` + iras-veszkapcsolo be + 24 oras plafon): 8 POST a relay-Zapra; `eredmenyek[8]`, `kuldve`.
- A 8 akcio: Fodrasz 7825199995 / 7825200898, Oxigen 7825200901 / 7825200904, Szor 7825200907 / 7825200910, PMU 7825200913 / 7825200916 (az `ARNYEK.google.akciok`-bol, a HeadSpa nelkul).
- `muvelet:"google_proba_visszavon"`: `futas_id` (kotelezo), `kuld`, `megerosit`, `eles`. A terv az ELKULDOTT feltoltesek tukorkepe (RETRACTION, `orderId`, `conversionActionId`, `adjustmentDateTime`). Zapier: `GOOGLE_KORREKCIO_WEBHOOK_URL`; **dryRun** kivetel nelkul, ha nem `eles:true` ES `GOOGLE_KORREKCIO_ELES=1`.

## B. Vedokorlatok (kodban, fail-closed; mindegyikre teszt + mutans)
1. Csak a Google ARNYEK fiok (6088874770) es a 8 felsorolt akcio; a HeadSpa (2, EXCELLENT) es minden `ELO_CELOK.google_primary` akcio kizarva (kerheto sem; `probaEllenorzes` a kuldes elott masodik, fuggetlen reteg).
2. A torzs zart lista (7 mezo); idegen mezo / vendegadat / hash-elt azonosito → `tiltva`. `ad_user_data` MINDIG `DENIED`; `value` 1 HUF.
3. A gclid CSAK a kuldott torzsben van; a valaszban, a D1 `kerelem`-ben, `platform_valasz`-ban `gclid#1` (+ `gclid_hash8`); a Zap visszhangzott gclid-je kitakarva. A gclid a D1-bol, szerveroldalon valasztodik (valodi, elkuldott HeadSpa Google-sor, 80 napon belul, 20–200 karakter).
4. `order_id = Proba:<futas>:<akcio>` (egyedi, mintaellenorzott); ugyanazzal a `futas_id`-vel ujrafuttatas nem duplaz; max. 3 probalkozas/sor; max. 40 proba-sor / 24 ora.
5. Vészkapcsolók tiszteletben tartva (`platform:google`, `uzletag:<u>`, `cella:<u>:google`, `mind`, `iras`); `megerosit` nelkul nincs kuldes; kulcs nelkul 404 (nincs hatas).
6. A visszavonas csak `Proba:` order_id-ra es a 8 akciora mehet; eles csak ket kulon feltetellel.

## C. T2-kizaras helye
- `qa-nap.js` (`qaNap`): `const probaSor = s.forras === 'google_proba'` – a proba-sorok **nem** szamitanak az arnyek-cellak szamlaloiba (allapot, forras-bontas, jogosultsag, lampa, lefedettseg); `platformok.<p>.proba_sor_kizarva` szamolja oket. A **biztonsagi ellenorzesek** (elo ID, dupla, nem-ARNYEK cel) RAJUK IS futnak (a proba-jeloles nem mentesit).
- `qa-nap.js` (`t2Start`): `sorok.meres_kuldes.google_proba_db` (csak ha > 0) – a T2-osszevetesbol levonando.
- Az egyeztetosor a `gp_*` source_id-t nem latja (nincs `mb_` / `sd_` elotag). A proba-sorok `GET ?source_id=gp_<futas>`-sal olvashatok.

## D. Tesztek + mutansok
- `tools/test-google-proba.mjs`: **16/16** (A1–A9 akcio-lista, szaraz/kuldes, kapuk, ujrafuttatas, veszkapcsolo, vedelmek, vegpont; T1–T3 T2-kizaras; V1–V4 visszavonas). Fake D1 + fake Zapier; semmi nem hagyja el a gepet.
- Teljes suite (`node --test tools/test-*.mjs`): 508 teszt, 497 PASS, 8 FAIL = a main-nel azonos kor: 2 ismert alapvonali (`189` kozos adatbazis, `16` halott-gombok) + 6 sparse-checkout miatti `klon/` hiany – ezekhez a valtozas nem nyul.
- **23 mutans, 23 elkapva** (M11-et – a source_id MINDEN elofordulasat `mb_`-re cserelve – az A5/T3/V2 fogja): megerosites-kapu, akcio-szuro, `ad_user_data`, nyers gclid a naploban / a Zap visszhangjaban, sor-forras, QA-kizaras (+ biztonsagi ellenorzes a proba-soron), dryRun-alap, szaraz-mod, `probaEllenorzes`, order_id-egyediseg, T2_START-szamlalo, idempotencia, 24 oras plafon, routolas, veszkapcsolo, gclid-sorrend, visszavonas-szuro, eles-feltetel, dry-run sorallapot, szaraz valasz webhook-szivargas.

## E. Vedett elemek (blob/tree hash, main 1673fd0a vs ez a PR)
| Ut | main | PR | |
|---|---|---|---|
| `assets/js/suti.js` | ea41ffd20d | ea41ffd20d | valtozatlan |
| `assets/js/attribucio.js` | 79c09c5937 | 79c09c5937 | valtozatlan |
| `assets/js/booking-launcher.js` | 7cde59bea3 | 7cde59bea3 | valtozatlan |
| `assets/js/booking-engine/` (tree) | a5a793f9ab | a5a793f9ab | valtozatlan |
| `functions/` (tree) | ef6558e82a | ef6558e82a | valtozatlan |
| `wrangler.toml` | ce5e69f063 | ce5e69f063 | valtozatlan |
| `netlify.toml` | 8b80554263 | 8b80554263 | valtozatlan |
| `klon/` (tree) | 02b7cacd4b | 02b7cacd4b | valtozatlan |
| `netlify/lib/meres/salonic-direct.js` | 885d5d777b | 885d5d777b | valtozatlan |
| `netlify/lib/meres/elosztas.js` | ae57d630a9 | ae57d630a9 | valtozatlan |
| `netlify/lib/meres/platformok.js` | 8f2a229d83 | 8f2a229d83 | valtozatlan |
| `netlify/lib/meres/esemeny-modell.js` | 4342e6f09b | 4342e6f09b | valtozatlan |
| `netlify/lib/meres/egyeztetes-sor.js` | d967f83646 | d967f83646 | valtozatlan |
| `netlify/lib/meres/iras-kapcsolo.js` | 51d93a058b | 51d93a058b | valtozatlan |
| `netlify/lib/meres/vegpontok.js` | 60f01af506 | fdbc53977c | **VALTOZOTT** (+3 sor: routolas) |
| `netlify/lib/meres/qa-nap.js` | 23a73e442d | 2334390be3 | **VALTOZOTT** (T2-kizaras) |
| `netlify/lib/meres/google-proba.js` | – | UJ fajl | **UJ** |
| `netlify/lib/meres/` (tree) | 6d7dab9aef | 08f3b8ee3a | VALTOZOTT (a fenti 3 fajl) |
| `netlify/` (tree) | 4c9e859f92 | 1dffa90982 | VALTOZOTT (a fenti 3 fajl) |
| `tools/meres-proba/` (tree) | e5c26dcd00 | c49d88af20 | VALTOZOTT (`MERES_GCLID`, alap valtozatlan) |

A `netlify/**` vedett fa valtozasa **dokumentalt**: kizarolag a fenti harom fajl (DECISION #196). Az `elosztas.js` / `platformok.js` / `salonic-direct.js` / `esemeny-modell.js` / `egyeztetes-sor.js` bitre azonos – a foglalasi mereslanc, a konverziok, az elosztas es a Salonic-direct nem valtozott.

## F. Rollback
1. A PR revertje: a `google_proba*` muvelet eltunik (400 „ismeretlen muvelet”); a QA-nap visszaall a regi szamlalasra. A korabbi `meres_kuldes` sorok (`forras='google_proba'`) auditnyomkent maradnak (nincs sema-valtozas, nincs uj tabla/oszlop).
2. Futas kozben: `kapcsolo platform:google be:false` / `iras be:false` / a `GOOGLE_ARNYEK_WEBHOOK_URL` torlese.
3. A mar feltoltott probat a `google_proba_visszavon` (vagy a Google Ads API `uploadConversionAdjustments`) vonja vissza.

## G. Nyitott kerdesek a meresi oldalnak
1. A B. resz valodi vendeg-kattintasu gclid-et hasznal (D1-bol, szerveroldalon valasztva, a hivon kivul nem latszik, `ad_user_data=DENIED`): megfelel-e a „vendegadat sehova nem kerul” feltetelnek? Ha nem, Feri sajat, valodi gclid-je kell.
2. Letezik-e a korrekcio-Zap (`GOOGLE_KORREKCIO_WEBHOOK_URL`)? Nelkule a visszavonas csak a tervig megy (a meresi oldal a Google Ads API-n at is vegrehajthatja).
3. Az A. resz szintetikus gclid-je (>= 10 karakter) ELOSZOR mentodik az `mh_attr`-ba → az ARNYEK-feltoltes a nem letezo gclid-del a Google-nel varhatoan hibaval er veget (lanc-teszt). Javasolt sorrend: A., majd B.
4. Napi 1 merge a `main`-re: sorrend az R1–R3 PR-ral (a fo munkamenet dont).
5. A Google feldolgozasi kesleltetese: a probat minel korabban kell futtatni a hetfo 12:00-s kapu elott.

A fuggetlen review-t es a merge-et a fo munkamenet intezi.
