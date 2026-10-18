# 2026-10-18 – Google ARNYEK backend proba-feltoltes + visszavonas (DECISION #196; hetfoi 12:00-s Google E2E-kapu)

Ag: `claude/meres-google-proba` (a main 1673fd0a-ra epitve). Draft PR (#409); merge/deploy NEM tortent, elo hivas NEM tortent, D1-iras NEM tortent (a teszteket fake D1/fake halozat futtatja).
Forras: a meresi oldal #167 6246096267 / 6246123744 keresei; DECISION #196 (Drive DECISION-LOG + #167). Ez a valtoztatas **nem** valt be elo konverziot, nem valtoztat a foglalasi folyamaton, nem nyul futo hirdeteshez.
Allapot: 1. korben `e1c1a8b8`; a fuggetlen review (PASS with notes, blokkolo nincs) nem blokkolo megjegyzeseit a 2. kor javitja (lasd H. szakasz).

## Mi keszult
| Fajl | Valtozas |
|---|---|
| `netlify/lib/meres/google-proba.js` (UJ) | `google_proba` + `google_proba_visszavon` admin-muvelet |
| `netlify/lib/meres/vegpontok.js` | a `kezelAdmin` POST-agban a ket muvelet routolasa (a kulcs-ellenorzes UTAN), a kulcs **csak fejlecben** (query-kulcs → 404) |
| `netlify/lib/meres/qa-nap.js` | `forras='google_proba'` sorok KIZARASA a T2/QA-szamlalokbol + `google_proba_db` a `t2start`-ban |
| `tools/meres-proba/meres-proba.mjs`, `uj-utak-proba.mjs` | opcionalis `MERES_GCLID` (szintetikus gclid, >= 10 karakter [A-Za-z0-9_-]); alap tovabbra `TESZT123` |
| `tools/test-google-proba.mjs` (UJ) | 24 teszt |
| `docs/booking-engine/MERES_GOOGLE_E2E_FUTTATOKONYV.md` (UJ), `QA_NAP.md` (+1 szakasz) | futtatokonyv + QA-jegyzet |

## A. A `google_proba` felulete
`POST /api/meres-admin`, JSON torzs; kulcs **CSAK** az `x-egyeztetes-kulcs` fejlecben (a mérési oldal kulcsa; a `?kulcs=` query-kulcs ennel a ket muvelet-nel 404, mint a `qa=nap` agnal; a tobbi admin-muvelet viselkedese valtozatlan):
- `muvelet:"google_proba"`; `futas_id` (8 kisbetus hexa, opc.; elhagyva minden hivas KULONBOZO veletlen azonositot kap), `akciok` (a 8 ARNYEK-akcio ID-jabol 1–8 elemu lista, opc.), `gclid_sorszam` (opc.), `kuld` (csak `true` kuld), `megerosit:"ARNYEK-6088874770-PROBA"`.
- **`gclid_sorszam` sorrendje** (a kod es a teszt szerint): a valodi HeadSpa Google-feltoltesek kozul ELOBB az osszes `FoglalasElso` (ujabb → regebbi), UTANA az osszes `Ajandekkartya` (ujabb → regebbi); az n-edik elem, alap 1 = a legfrissebb FoglalasElso.
- **Alapbol SZARAZ**: csak olvas (a gclid-kivalasztas a D1-bol), nincs halozat, nincs iras. Valasz: `futas_id`, `source_id` (`gp_<futas>`), `gclid:"gclid#1"`, `gclid_hash8`, `gclid_forras{...}`, `kuldes_feltetelei{meres_elosztas_be, webhook_beallitva}` (csak igen/nem), `terv[8]`.
- **Kuldes** (`kuld:true` + `megerosit` + `MERES_ELOSZTO=1` + `GOOGLE_ARNYEK_WEBHOOK_URL` + iras-veszkapcsolo be + 24 oras plafon): 8 POST a relay-Zapra; `eredmenyek[8]` (`allapot`, `http_status`, `valasz_roviden`), `kuldve`. A `valasz_roviden` / a D1 `platform_valasz` a **Zap nyers torzse NELKUL**: `{"http":200,"status":"success","id":"…"}`.
- A 8 akcio: Fodrasz 7825199995 / 7825200898, Oxigen 7825200901 / 7825200904, Szor 7825200907 / 7825200910, PMU 7825200913 / 7825200916 (az `ARNYEK.google.akciok`-bol, a HeadSpa nelkul).
- `muvelet:"google_proba_visszavon"`: `futas_id` (kotelezo), `kuld`, `megerosit`, `eles`. A terv az ELKULDOTT feltoltesek tukorkepe (RETRACTION, `orderId`, `conversionActionId`, `adjustmentDateTime`).
  - `kuld` nelkul: SZARAZ terv. `kuld:true` + `megerosit`, de `eles:true` ES `GOOGLE_KORREKCIO_ELES=1` nelkul: **0 POST**, csak a dry-run SOR kerul a D1-be (`kihagyva`, `dry_run`), `mod:"dry_run_sor"`, `posztolt_db:0`.
  - **Eles POST** a korrekcio-Zapra (`GOOGLE_KORREKCIO_WEBHOOK_URL`, `dryRun:false`) KIZAROLAG `eles:true` + `GOOGLE_KORREKCIO_ELES=1` + `megerosit` egyutt (indok: a korrekcio-Zap mukodese ismeretlen; a QA2 naplo szerint a relay-Zap egyszer az URL-lekerdezes `dryrun` jelzojet elesnek ertelmezte).

## B. Vedokorlatok (kodban, fail-closed; mindegyikre teszt + mutans)
1. Csak a Google ARNYEK fiok (6088874770) es a 8 felsorolt akcio; a HeadSpa (2, EXCELLENT) es minden `ELO_CELOK.google_primary` akcio kizarva (kerheto sem; `probaEllenorzes` a kuldes elott masodik, fuggetlen reteg).
2. A torzs zart lista (7 mezo); idegen mezo / vendegadat / hash-elt azonosito → `tiltva`. `ad_user_data` MINDIG `DENIED`; `value` 1 HUF.
3. A gclid CSAK a kuldott torzsben van; a valaszban, a D1 `kerelem`-ben `gclid#1` (+ `gclid_hash8`). A Zap **nyers valasz-torzse SOHA nem tarolodik** (a gclid modositott / csonkolt / kisbetus / base64 visszhangja kitakaras nelkul maradhatna): csak a http-status + a Zap `status` / `id` mezoje, ha string, `[A-Za-z0-9._-]{1,64}`, es a gclid (kisbetus / base64 / base64-url alakjanak) 10 karakteres szelete nincs benne. Halozati hiba: `{"http":null}` (a kivetel szovege / URL sem).
4. `order_id = Proba:<futas>:<akcio>` (egyedi, mintaellenorzott). Verseny-vedelem: `INSERT … ON CONFLICT DO NOTHING` (az elavult SELECT sem POST-ol) + az ujraprobalt sor atvetele compare-and-swap-pel (egyideju hivasok nem POST-olnak ketszer); max. **3 probalkozas** soronkent (a 4. nem POST-ol); a 120 s-nel frissebb `folyamatban` sor nem megy ujra.
5. **24 oras plafon (40) — DONTES:** a tenyleges KIMENO kiserleteket szamolja (`elkuldve` / `hiba` / `folyamatban`, `letrehozva` az utolso 24 oran belul). NEM szamit: a `kihagyva` sor (veszkapcsolo, dry-run) es a 24 oranal regebbi sor. A kuldes elott a **meg nem letezo** order_id-k szamat adja hozza (pontos uj sor-szam): az idempotens ujrafuttatas (0 uj sor) es az ujraprobalas (UPDATE) nem 429-ezik; a dry-run visszavonas (kihagyva sorok) nem szamit a plafonba. (1. korben minden `google_proba` sor szamitott, a tervezett 8-cal egyutt — ez 429-et adhatott volna az idempotens ujrafuttatasra.)
6. Vészkapcsolók tiszteletben tartva (`platform:google`, `uzletag:<u>`, `cella:<u>:google`, `mind`, `iras`); `megerosit` nelkul nincs kuldes; kulcs nelkul / csak query-kulccsal 404 (nincs hatas).
7. A visszavonas csak `Proba:` order_id-ra es a 8 akciora mehet; eles csak harom kulon feltetellel (`eles:true`, `GOOGLE_KORREKCIO_ELES=1`, `megerosit`) + webhook.

## C. T2-kizaras helye
- `qa-nap.js` (`qaNap`): `const probaSor = s.forras === 'google_proba'` – a proba-sorok **nem** szamitanak az arnyek-cellak szamlaloiba (allapot, forras-bontas, jogosultsag, lampa, lefedettseg); `platformok.<p>.proba_sor_kizarva` szamolja oket. A **biztonsagi ellenorzesek** (elo ID, dupla, nem-ARNYEK cel) RAJUK IS futnak (a proba-jeloles nem mentesit).
- `qa-nap.js` (`t2Start`): `sorok.meres_kuldes.google_proba_db` (csak ha > 0) – a T2-osszevetesbol levonando.
- Az egyeztetosor a `gp_*` source_id-t nem latja (nincs `mb_` / `sd_` elotag). A proba-sorok `GET ?source_id=gp_<futas>`-sal olvashatok.

## D. Tesztek + mutansok
- `tools/test-google-proba.mjs`: **24/24** (A1–A9 akcio-lista, szaraz/kuldes, kapuk, ujrafuttatas, veszkapcsolo, vedelmek, vegpont; **A10** query-kulcs 404; **A11** egyideju hivasok (3×) → 8 POST / 8 sor, ujraprobalas-verseny, visszavonas-verseny; **A12** `ON CONFLICT DO NOTHING` (elavult SELECT); **A13** 3 probalkozas-korlat (a 4. nem POST-ol); **A14** 120 s ablak (60 s / 200 s); **A15** 24 oras plafon (dontes, hat eset); **A16** kulonbozo generalt `futas_id`; **A17** Zap-valasz tarolasa (12 visszhang-variacio + HTTP-hiba + halozati hiba); T1–T3 T2-kizaras; V1–V4 visszavonas). Fake D1 + fake Zapier; semmi nem hagyja el a gepet. Az egyideju teszteket kozvetlen belepesi-pont hivassal futtatjuk (a Request-feldolgozas elcsuszatna az await-melyseget, a verseny nem jelenne meg).
- **38 mutans, 38 elkapva** (a mutans-szkript nem resze a PR-nak; M11-et – a source_id MINDEN elofordulasat `mb_`-re cserelve – az A5/T3/V2 fogja). Az uj mutansok: query-kulcs elfogadva (A10), CAS eredmeny figyelmen kivul (A11), `ON CONFLICT` nelkul (A11, A12), probalkozas-korlat 30 (A13), folyamatban-ablak 12 s / 1200 s (A14), plafon minden allapotot szamol / tervezett 8-at szamol / dry-run is szamit (A15), allando `futas_id` (A16), nyers Zap-valasz tarolasa (feltoltes: A5, A17; visszavonas: V3), visszhang-szuro / karakter-szuro / hossz-korlat kikapcsolva, a szuro csak a nyers alakot nezi (A17), dry-run visszavonas POST-ol (V2, V3).
  Az 1. kori ket tuleli mutans (CAS-eredmeny figyelmen kivul, a gclid-visszhang szuro csak a nyers alakra) a 2. korben elkapva: az elobbit a kozvetlen-hivasos verseny-teszt, az utobbit a base64-csonka `id` visszhang.
- **Teljes suite a teljes checkouton** (`git archive HEAD` → nem sparse; `node --test tools/test-*.mjs`): **519 teszt, 514 PASS, 2 FAIL, 3 SKIP**. A 2 hiba a main 1673fd0a-n IS azonos: `test-foglalo-atkotes` 19. (`kliens-kod: nincs kozvetlen Salonic-link …`) es `test-fuggetlenseg` 3. (`nincs kozos adatbazis …`) – ellenorizve: a valtoztatott fajlok main-beli valtozatával (es a `google-proba.js` / `test-google-proba.mjs` nelkul) ugyanez a ket teszt bukik. A `test-halott-gombok` csak sparse checkouton bukik (a `klon/` hianya miatt), a teljes checkouton nem. (1. korben tevesen „8 fail” szerepelt: az a sparse checkout szama volt.)

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
| `netlify/lib/meres/vegpontok.js` | 60f01af506 | b5e3881fc7 | **VALTOZOTT** (routolas + a kulcs csak fejlecben) |
| `netlify/lib/meres/qa-nap.js` | 23a73e442d | 2334390be3 | **VALTOZOTT** (T2-kizaras; a 2. korben nem valtozott) |
| `netlify/lib/meres/google-proba.js` | – | bd7f9b4bea | **UJ fajl** |
| `netlify/lib/meres/` (tree) | 6d7dab9aef | e3f20c1b97 | VALTOZOTT (a fenti 3 fajl) |
| `netlify/` (tree) | 4c9e859f92 | e495d49103 | VALTOZOTT (a fenti 3 fajl) |
| `tools/meres-proba/` (tree) | e5c26dcd00 | c49d88af20 | VALTOZOTT (`MERES_GCLID`, alap valtozatlan) |

A `netlify/**` vedett fa valtozasa **dokumentalt**: kizarolag a fenti harom fajl (DECISION #196). Az `elosztas.js` / `platformok.js` / `salonic-direct.js` / `esemeny-modell.js` / `egyeztetes-sor.js` bitre azonos – a foglalasi mereslanc, a konverziok, az elosztas es a Salonic-direct nem valtozott. (A hash-ek a 2. kori vegso allapotra szamitottak: `git rev-parse origin/main:<ut>` vs `HEAD:<ut>`.)

## F. Rollback
1. A PR revertje: a `google_proba*` muvelet eltunik (400 „ismeretlen muvelet”). Nincs sema-valtozas, nincs uj tabla/oszlop. **Figyelem – a maradó sorok:** a revert UTAN a `forras='google_proba'` sorokat (feltoltes: `esemeny_tipus='alap'`, visszavonas: `'korrekcio'`) a REGI QA-kod mar nem zarja ki: az adott napok Google `elkuldve` / `alap_elkuldve` es forras-bontas (`forras.google_proba`) szamlaloiban megjelennek, a T2 arnyek/valos osszevetes **tul sok** arnyek-feltoltest mutathat. Teendo: a revert elott/utan a lenti SELECT-tel listazni a sorokat, es az egyeztetesnel levonni (a sorok auditnyomok, **torlest NEM javaslunk**).
```sql
-- 1) a proba-sorok listaja (csak olvas)
SELECT id, esemeny_id, esemeny_tipus, uzletag, source_id, allapot, indok, http_status, probalkozas,
       datetime(letrehozva, 'unixepoch') AS letrehozva_utc, datetime(frissitve, 'unixepoch') AS frissitve_utc
FROM meres_kuldes WHERE forras = 'google_proba' ORDER BY id;
-- 2) napi / allapot szerinti bontas (a Budapest-nap kozelitoleg: +2 ora, 2026-10-25-ig; azutan +1)
SELECT date(letrehozva + 7200, 'unixepoch') AS nap, esemeny_tipus, allapot, COUNT(*) AS db
FROM meres_kuldes WHERE forras = 'google_proba' GROUP BY 1, 2, 3 ORDER BY 1, 2, 3;
-- 3) egy futas: source_id = 'gp_<futas_id>'
SELECT id, esemeny_id, platform_nev, allapot, indok, http_status, platform_valasz FROM meres_kuldes WHERE source_id = 'gp_<futas_id>' ORDER BY id;
```
2. Futas kozben: `kapcsolo platform:google be:false` / `iras be:false` / a `GOOGLE_ARNYEK_WEBHOOK_URL` torlese.
3. A mar feltoltott probat a `google_proba_visszavon` (az eles korrekciohoz a korrekcio-Zap ellenorzese UTAN) vagy a Google Ads API `uploadConversionAdjustments` vonja vissza.

## G. Nyitott kerdesek a meresi oldalnak
1. A B. resz valodi vendeg-kattintasu gclid-et hasznal (D1-bol, szerveroldalon valasztva, a hivon kivul nem latszik, `ad_user_data=DENIED`): megfelel-e a „vendegadat sehova nem kerul” feltetelnek? Ha nem, Feri sajat, valodi gclid-je kell.
2. Letezik-e a korrekcio-Zap (`GOOGLE_KORREKCIO_WEBHOOK_URL`), es mit csinal a `dryRun` mezovel? Az elso eles visszavonas elott ellenorizendo; nelkule a visszavonas a Google Ads API-n at, a meresi oldalon vegrehajthato.
3. Az A. resz szintetikus gclid-je (>= 10 karakter) ELOSZOR mentodik az `mh_attr`-ba → az ARNYEK-feltoltes a nem letezo gclid-del a Google-nel varhatoan hibaval er veget (lanc-teszt). Javasolt sorrend: A., majd B.
4. Napi 1 merge a `main`-re: sorrend az R1–R3 PR-ral (a fo munkamenet dont).
5. A Google feldolgozasi kesleltetese: a probat minel korabban kell futtatni a hetfo 12:00-s kapu elott.

## H. A fuggetlen review (e1c1a8b8, PASS with notes) nem blokkolo megjegyzesei → 2. kor
| # | Megjegyzes | Javitas |
|---|---|---|
| 1 | `?kulcs=` query-kulcs elfogadott | csak fejlec (`vegpontok.js`), teszt A10 + mutans |
| 2 | teszt-rések (verseny, 3 probalkozas, 120 s, ON CONFLICT, plafon, kulonbozo `futas_id`) | A11–A16 + mutansok; a plafon-szemantika eldontve (B/5) es tesztelve |
| 3 | a Zap nyers valasza tarolodott | csak http + status + id (B/3), A17 + mutansok |
| 4 | a dry-run visszavonas is POST-olt a korrekcio-Zapra | 0 POST eles nelkul (A/visszavon), V2, V3 + mutansok; futtatokonyv: az elso eles elott a korrekcio-Zap ellenorzese |
| 5 | `gclid_sorszam` sorrend dokumentacio, „2 ismert alap-hiba” | javitva a futtatokonyvben, a kodkommentben, ebben a naplóban (D) es a PR-leirasban |
| 6 | rollback-megjegyzes | F. szakasz + SELECT-ek |

A fuggetlen delta-review-t es a merge-et a fo munkamenet intezi.
