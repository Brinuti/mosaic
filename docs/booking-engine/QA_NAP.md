# Napi T2 QA-vegpont (2026-10-13; a meresi oldal SPEC-je, #167 131. komment, GPT atnezte)

**Cel:** az eles D1-et a meresi oldal nem olvashatja. Ezzel a vegponttal a Zapier admin-draft (a kulcs csak a Storage-ban) naponta lekeri a T2-osszevetest (arnyek vs. valos) es a Drive-ra irja. A `pre288_missing_hmac_index` cimke is itt keletkezik.

**Hivo (DECISION #168, 2. pont): Zap caller = N/A.** Az `elvart` (napi Salonic-foglalasszam uzletagankent, MERES-NAPI-ELLENORZES) forrasa a meresi oldal; a `qa=nap` vegpontot (`&elvart=headspa:12,...`) a **meresi oldal / admin-draft (01a134e9)** hivja, a kulcs a Zapier Storage-ban van. Ehhez **nem kell Zap-bekotes** (az eles Zap-ok nem hivjak es nem modosulnak). A `qa=t2start` kulon vegpont marad.

**CSAK OLVAS, AGGREGALT, PII-MENTES.** Nem ir semmit, nem hoz letre tablat (egyetlen utasitasa sem INSERT / UPDATE / DELETE / CREATE: a teszt ezt ellenorzi), nem kuld semmit semelyik platformra.

```
GET /api/meres-admin?qa=nap&datum=YYYY-MM-DD[&proba=<uuid-elotag>,<uuid-elotag>,...]
x-egyeztetes-kulcs: <kulcs>          (CSAK fejlecben; az URL-ben kapott kulcs nem fogadhato el)
```

| Valasz | Jelentes |
|---|---|
| 200 | a jelentes (lasd lent), `Cache-Control: no-store`, `X-Robots-Tag: noindex` |
| 400 | hibas `datum` (nem YYYY-MM-DD, nem letezo nap, 2026-01-01 elotti vagy holnaputani) vagy hibas `proba` (max. 100 db, egyenkent 8 hexa karakter) |
| 401 | nincs `x-egyeztetes-kulcs` fejlec |
| 403 | rossz kulcs (konstans ideju osszevetes az `EGYEZTETES_KULCS_HASH`-sel) |
| 405 | nem GET |
| 429 | rate-limit: IP-nkent 30 kereses / 60 mp; a rossz kulcsra 5 / 60 mp (csak a futo pelda memoriajaban, D1-be / naploba nem kerul) |
| 503 | nincs `KULCS_DB` kotes |

A tobbi `/api/meres-admin` ag (`kapcsolok`, `fuggo`, `egyeztetes`, `source_id`, POST) valtozatlan, kulcs nelkul tovabbra is 404; csak a `qa=nap` kapott sajat (401/403) valaszt.

## Korlat: regi napok (> 30 nap)
A `meres_erkezes` sorokat az `erkezesMent` 30 nap utan torli. Egy 30 napnal regebbi `datum` lekerdezesekor a GA4 „nincs client_id” cellak foglalaskori pillanatkepe mar nincs meg, ezert azok **technikai** kimaradaskent (`ga4_nincs_pillanatkep`) latszanak a „szabalyos nulla” helyett (ugyanaz, mint az egyeztetosornal). A napi „tegnapi” hivasra ez nincs hatassal; a T2 (max. 14 nap) teljes idotartama a 30 napon belul van.

## Ido
A `datum` az **Europe/Budapest** szerinti naptari nap; az intervallum `[Budapest 00:00, kovetkezo nap Budapest 00:00)` UTC-ben, **felig nyitott** (a pontosan ejfeli sor a kovetkezo naphoz tartozik). A nyari / teli ido atallasa a `Intl` adatbazisbol jon (az oszi atallas napja 25, a tavaszi 23 oras). A valasz visszaadja: `datum`, `timezone`, `from_utc`, `to_utc`, `generalva_utc`.

## Valasz-szerkezet
`{ ok, datum, timezone, from_utc, to_utc, generalva_utc, lampa, szekcio_hibak, proba_szabaly, proba_megadva, osszes, uzletagak }` (`osszes` tartalmazza a `post288_nincs_email` osszeget is)

`uzletagak.<headspa|fodrasz|oxigen|szor|pmu>` (+ `ismeretlen`, csak ha van besorolatlan adat, pl. kulcs nelkuli, meg nem parositott letrehozo level):

1. **`valos`** – az aznapi letrehozo levelek (`foglalas_egyeztetes.letrehozva`): `letrehozo_level`, `parositott`, `parositatlan`, `egyeb_allapot` (pl. `fuggoben`), `proba_kizarva`, `lemondas {db, felszabadult, nincs_bejegyzes, nem_ellenorizheto, birtokos_el, egyeb}` (a `foglalas_lemondas.eredmeny` szoveg *elotagja* szerint).
2. **`arnyek.<meta|tiktok|google|ga4>`** – `meres_kuldes` sorok `allapot` szerint (`elkuldve` / `kihagyva` / `tiltva` / `hiba` / `mas`), `forras` szerint (`motor` / `salonic_direct` / `kartya`) bontva, `alap_elkuldve`, `arany`, `arany_parositott`, `lampa`.
3. **`biztonsag`** – `elo_id_talalat` (elo azonosito a `kerelem`-ben: ELO_CELOK, szohatar-vedett illesztessel), `dupla` (`allapot='elkuldve'` `GROUP BY esemeny_id, platform HAVING COUNT(*)>1`), `nem_arnyek_cel` (az elkuldott kerelem celpontja nem az ARNYEK: Meta csak a `28616665324611098` dataset + tesztkod, TikTok csak a `DB2GTTJC77UE4D1NE4MG` pixel + tesztkod, GA4 nem elo property, Google csak az ARNYEK masodlagos akciok). **Mindharomnal 0 az elvaras.**
4. **`sd`** – `sd_allapot` szerinti darabszamok es a csere-felismeres (`foglalas_reschedule.allapot`) darabszamai.
5. **`pre288_missing_hmac_index`** – `{ db, mintak: [{ uuid_prefix (8 kar.), uzletag, ido }] }` (a minta legfeljebb 20 elem, a `db` a teljes szam). Ide tartozik minden aznap letrehozott (uj vagy sd) foglalas, amelyhez **±60 percen belul**, **ugyanabban az uzletagban** lemondas (`foglalas_lemondas`) erkezett egy **1791885187** (2026-10-13 09:53:07 UTC, a #288 eles merge-e) **elott** letrehozott `foglalas_egyeztetes` uuid-ra, es ennek az uuid-nak **nincs `foglalas_vendeg` sora**. Az uj foglalas uzletaga a `foglalas_vendeg` sorabol, ennek hianyaban a kulcsabol (place id), a regi foglalase a sajat kulcsabol, ennek hianyaban a lemondas kulcsabol jon; ha valamelyik nem allapithato meg, az eset **nem szamit** (nem tudjuk igazolni az azonos uzletagot).
5b. **`post288_missing_hmac_index`** (a meresi oldal jovahagyta, #167 137. komment) – `{ db, parositatlan_db, mintak: [{ uuid_prefix, uzletag, ido }] }`: a **#288 UTAN** (`letrehozva >= 1791885187`) letrehozott letrehozo level, amelyhez **nincs `foglalas_vendeg` sor**. A `db` a **parositott** sorokat szamolja (a parositott level nem maradhat index nelkul: az sd csere-felismerese az index-soron mulik), a nem parositottak a `parositatlan_db`-ben kulon. A minta legfeljebb 20 elem. A kimaradas **okat** a D1 nem tudja; az a `/api/foglalas-egyeztetes` valaszaban latszik (`vendeg_index.kod`, lasd a `hmac-index-miert` agat). A szamlalo **tajekoztato** (onmagaban nem piros / sarga). Elso eles meres (2026-10-13): headspa `db=2` (`9a03d9f7`, `dca36449` – a kerelemben nem volt ervenyes e-mail).
5c. **`post288_nincs_email`** (a meresi oldal jovahagyta, #167 143. komment (b)) – `{ db, parositatlan_db, mintak: [{ uuid_prefix, uzletag, ido }] }`: a **#288 UTAN** letrehozott letrehozo level, amelyhez az e-mail hianya miatt **jelolo sor** van a `foglalas_vendeg` tablaban (`forras` `*_nincs_email`, `email_h = NULL`; a jelolo sort a `hmac-jelolo-sor` ag allitja elo). Igy a `post288_missing_hmac_index` **csak a valodi kimaradast** mutatja (nincs sor, nincs jelolo), a „nincs e-mail" kulon szamlalo. Ugyanaz a felosztas, mint az 5b-nel: `db` a parositott, `parositatlan_db` a nem parositott. **Tajekoztato** (nem piros / sarga). Amig a jelolo-ag nem el, a szamlalo 0.
6. **`foglalas_vendeg`** – az aznapi uj sorok `forras` szerint (`level` / `sd_atvetel`).
7. **`lefedettseg`** (BOOKING COVERAGE, a meresi oldal / GPT DECISION #166, 5. pont) – *latta-e a rendszer a valos foglalast.* `{ latott, elvart, nevezo_forras, lefedettseg, hiany, parositott_esemeny_nelkul, szabalyos_esemeny_nelkul, friss_kizarva }`. A `szabalyos_esemeny_nelkul` az **esemény nélkül SZANDÉKOSAN maradó** foglalás: a HeadSpa konzultáció (#101) és – **DECISION #194 óta – a kuponos (ajándékkártyás) foglalás** (`meres_jelleg.kupon = 1`; nem konverzió, semmilyen esemény nem megy ki): ezek nem technikai kimaradások, nem kerülnek a `parositott_esemeny_nelkul` / `nincs_sor` nevezőbe. **A lámpa nevezője (DECISION #194, review F-3):** a Meta / TikTok lámpa alapja `valos.parositott` **mínusz a kuponos, PÁROSÍTOTT (motoros) foglalások** (`meres_jelleg.kupon = 1`, a frissességtől függetlenül) – ezek szándékosan esemény nélküliek, ezért nem billentik sárgára a lámpát. Az `arnyek.<platform>.nevezo_parositott` mutatja a használt nevezőt; `0` → `n/a`. A HeadSpa-konzultáció (#101) nevezője változatlan. A `nincs_sor` / `jogosultsag` és a `lefedettseg` számlálók a fentiek szerint maradnak. `latott` = a `valos.letrehozo_level` (proba nelkul). `elvart` = a **hivo FUGGETLEN forrasbol** (pl. Salonic) szamolt darabszam: `&elvart=headspa:12,fodrasz:3,pmu:0,...` (uzletagonkent egyszer, `headspa|fodrasz|oxigen|szor|pmu`, 0-999999); ha megadott: `nevezo_forras='elvart'`, `lefedettseg = latott/elvart`, `hiany = max(0, elvart-latott)`; ha nem: `elvart=null`, `nevezo_forras='latott'` — a rendszer sajat D1-jebol a **lathatatlan kimaradas nem merheto**, ezert a napi ellenorzesnek az `elvart`-ot kulso forrasbol kell adnia. `parositott_esemeny_nelkul` = a parositott (`booking_id`) vagy `kesz` sd (`sd_id`) level, amelyhez **nincs alap esemeny-sor** a `meres_kuldes`-ben (technikai kimaradas); a 20 percnel frissebb levelek a `friss_kizarva`-ban (az esemeny-sorok meg keszulhetnek); a **HeadSpa konzultacio** (`meres_jelleg = konzultacio`) szandekosan nem kap esemenyt (#101): ez a `szabalyos_esemeny_nelkul`, nem technikai kimaradas. `osszes.lefedettseg` az osszesites: `lefedettseg` = `lefedett / elvart`, ahol `lefedett = Σ min(latott, elvart)` **uzletagonkent** (**like-for-like**: csak az `elvart`-ot kapott uzletagak; egy uzletag tulteljesitese nem fedi el egy masik hianyat; `elvart_hianyos: true`, ha nem minden uzletag kapott `elvart`-ot; `latott_az_elvart_uzletagakban` tajekoztato).
8. **`jogosultsag`** (PLATFORM ELIGIBILITY) – *lehetett-e szabalyosan esemenyt kuldeni*, platformonkent (`meta|tiktok|google|ga4`) a foglalasonkenti alap-esemeny cellakra (`esemeny_tipus='alap'`, forras `motor|salonic_direct`, az ajandekkartya es az ernyo-esemenyek nelkul): `{ cellak, kuldve, szabalyos_nulla, technikai_hiany, technikai_hiany_okok, nincs_sor, jogosult, arany }`. Besorolas az `egyeztetes-sor.js` `cellaOsztaly()`-ja szerint (ugyanaz, mint az egyeztetosor): **kuldve** = `elkuldve`; **szabalyos_nulla** = `jogos_0` (pl. `kihagyva` a modell szerint, GA4 client_id nelkul + nincs / elutasitott analytics-hozzajarulas); **technikai_hiany** = minden mas (`hiba`, `tiltva`, `veszkapcsolo`, `halasztva`, GA4 client_id hiany hozzajarulas MELLETT, GA4 foglalaskori pillanatkep nelkul). A GA4-besorolas a **foglalaskori hozzajarulas-pillanatkepbol** (`meres_erkezes.hozz`, lapos `{ ana, adv, fun, dontes }`, `source_id`-val kapcsolva) dolgozik, ugyanugy, mint az egyeztetosor; a `meres_kuldes.hozzajarulas` oszlop erre NEM alkalmas (a prodban hianyzo pillanatkepnel is kitoltott `ana: null, dontes: false`, azaz „nincs dontes”-nek latszik): erkezesi pillanatkep nelkul a GA4-kimaradas **technikai** (`ga4_nincs_pillanatkep`) — az ok csak kod / allapot (`technikai_hiany_okok`), szabad szoveg nem; **nincs_sor** = a `lefedettseg.parositott_esemeny_nelkul`. **`?proba=`:** a proba-levelek esemeny-cellai (`booking_id` / `sd_id`) a kuldott-aranybol (`arnyek.<p>.alap_elkuldve`, `jogosultsag`) **ki vannak zarva** (`arnyek.<p>.proba_cella_kizarva` mutatja, hanyat), mint a nevezobol; a biztonsagi ellenorzesek (`elo_id_talalat`, `dupla`, `nem_arnyek_cel`) viszont **minden kuldesre** futnak. **A technikai kimaradas BENNE MARAD a nevezoben:** `jogosult = kuldve + technikai_hiany + nincs_sor` (csak a szabalyos nulla marad ki), `arany = kuldve / jogosult`. Tajekoztato szamlalok: a lampat nem valtoztatjak. `osszes.jogosultsag` az osszesites.


## T2_START rogzito (`?qa=t2start`, DECISION #166 3.)
```
GET /api/meres-admin?qa=t2start[&sha=<7-40 hexa>][&zap_rev=<azonosito, max. 40 kar.>]
x-egyeztetes-kulcs: <kulcs>          (ugyanaz a hozzaferes, rate-limit es no-store, mint a qa=nap-nal)
```
**CSAK OLVAS** (csak `SELECT`), titok / PII nelkul; semmit nem tarol (a rogzitest — pl. a Drive-ra — a hivo vegzi). Egy hivasban adja a T2 kezdeti allapotat:

| Mezo | Tartalom |
|---|---|
| `t2_start_utc`, `t2_start_budapest`, `acceptance` | a szerver ideje; `acceptance` = `{ min_nap: 7, max_nap: 14, min_valos_jogosult_foglalas: 200 }` (a T2 PASS: min. 7 teljes nap ES >= 200 valodi, jogosult foglalas, max. 14 nap) |
| `kod.kod_ujjlenyomat` | az ARNYEK-celok + az elo tiltolista (`ELO_CELOK`) + a QA-konstansok sha256-ja: ha valtozik, a celok / a tiltolista valtozott (a SHA-tol fuggetlen bizonyitek) |
| `kod.production_sha`, `production_sha_forras` | **A Cloudflare Pages a `CF_PAGES_COMMIT_SHA`-t csak BUILD-kor adja, futasidoben a Function nem latja** → a rogzito a deploy SHA-jat a hivasban adja (`&sha=`; forrasa pl. a `main` HEAD / a Cloudflare Pages production deployment commitja), ekkor `forras='hivo'`. Ha a kornyezetben megis van `CF_PAGES_COMMIT_SHA`, az `env_sha`-ban latszik (`forras='env'`); egyebkent `nincs` |
| `d1.sema_ujjlenyomat`, `tablak_db` | a `sqlite_master` (tabla / index: nev + DDL, szokozok normalizalva, `sqlite_*` / `_cf_*` nelkul) sha256-ja: adat NEM, csak sema-valtozas (uj oszlop / tabla / index) valtoztatja |
| `d1.sorok` | tablankent sorszam (`meres_kuldes` + `max_id`, `foglalas_egyeztetes`, `foglalas_vendeg`, `foglalas_reschedule`, `foglalas_lemondas`, `meres_erkezes`, `foglalas_kulcs`); hianyzo tabla = `null` |
| `zap.revizio` | a Zap revizioja a szerveroldalrol NEM latszik: a rogzito adja (`&zap_rev=`), kulonben `null` / `forras='nincs'` |
| `kapcsolok.env`, `kapcsolok.d1`, `kapcsolok.titkok_jelen` | a nem titkos kapcsolok (`MERES_ELOSZTO`, `MERES_SALONIC_DIRECT`, `MERES_SD_INDEX`, `MERES_SD_NS`, `MERES_IRAS_KI`, `META_API_VERSION`); a `meres_kapcsolo` sorok (`kulcs`, `be`, `ido`, `ok` 80 karakterre vagva); a titkokrol (`META_CAPI_TOKEN`, `TIKTOK_EVENTS_TOKEN`, `GA4_TESZT_API_SECRET`, `GOOGLE_ARNYEK_WEBHOOK_URL`, `SD_HMAC_KEY_V1`, `GUEST_HMAC_KEY_V1`, `EGYEZTETES_KULCS_HASH`) **csak jelenlet-bit**, az ertek soha |
| `arnyekcelok` | Meta dataset + tesztkod, TikTok pixel + tesztkod, GA4 teszt measurement ID, Google customer + ARNYEK akcio-ID-k |

A valasz elo ID-t, kulcsot, hash-t, teljes UUID-t nem tartalmaz (a teszt N26 ellenorzi). `400`: hibas `sha` / `zap_rev`.

## Lampa
- **piros:** `elo_id_talalat > 0` VAGY `dupla > 0` VAGY `nem_arnyek_cel > 0` (uzletagonkent; az `lampa` mezo a legrosszabb).
- **sarga:** uzletagonkent es platformonkent, ha a **Meta** vagy a **TikTok** elkuldott *alap*-esemenyeinek szama `< 0,9 × valos.parositott`; ha `valos.parositott = 0`, az eredmeny `n/a` (zold nem lehet). A **GA4** es a **Google** csak tajekoztato (`lampa: "tajekoztato"`: hozzajarulas es kattintasazonosito miatt), de az `arany` ott is megjelenik. Az `arany` (`alap_elkuldve / valos`) es az `arany_parositott` (`alap_elkuldve / valos.parositott`, a lampa alapja) tajekoztato szamok, a `valos` is megmarad.
- **sarga hiany miatt is:** ha valamelyik szekcio lekerdezese hibazott (`szekcio_hibak` nem ures), a jelentes nem lehet zold (a hibauzenet nem kerul ki, csak a szekcio neve).
- A `pre288` onmagaban nem piros: tajekoztato cimke.

### Dontes a SPEC szovegehez (meresi oldal / GPT, #167 134. komment)
A SPEC „a Meta- vagy a TikTok-kuldes (`elkuldve`) kevesebb, mint 0,9 × `valos`” szoveget a meresi oldal es a GPT pontositotta: csak a **foglalasonkenti alap-esemenyeket** szamoljuk (`esemeny_tipus='alap'`, `forras` motor / salonic_direct, az `*_Ajandekkartya` es az ernyo-esemenyek — `Schedule` / `CompletePayment` — nelkul), a viszonyitasi alap pedig a **`valos.parositott`**. Indok: a **parositatlan** foglalashoz nem keszul arnyek-esemeny (csak az sd-halo fogja meg, csak pmu / oxigen), ezert a `valos`-hoz merve a lampa minden parositatlan levelnel tevesen sarga lenne. A `valos` (osszes letrehozo level) es az `arany` tajekoztato szam marad.

## „Proba” definicioja
**A D1-ben nincs proba-jelolo** (a `foglalas_egyeztetes` nem tarol nevet, e-mailt, telefont; a Zap `tesztFoglalas`-szabalya – a nev „teszt” szot tartalmaz VAGY az e-mail a teszt-listan van – a Zap levelen dolgozik, es nem kerul a D1-be). Ezert a vegpont **determinisztikus, a hivo altal vezerelt** szabalyt hasznal:
- alapbol **minden** `foglalas_egyeztetes` sor valos (`proba_szabaly` mezo irja le a valaszban);
- a napi ellenorzes a sajat (Zap-szabaly szerinti) osztalyozasabol a probak **8 karakteres uuid-elotagjait** a `&proba=` parameterben adja at; ezek nem szamitanak a `valos`-ba (es a pre288-ba), a `proba_kizarva` megmutatja, hanyat zartunk ki, a `proba_megadva` visszaadja a listat.
Igy a „ugyanaz a determinisztikus szabaly, mint a napi ellenorzesnel” teljesul anelkul, hogy vendegadat kerulne a D1-ből a vegpontba vagy a szabaly ket helyen elterne.

## PII
Nincs nev, e-mail, telefon, hash, teljes UUID, token, kerelem-torzs, kulcs. Egyetlen kivetel a hibakereseshez: a `pre288` mintalista 8 karakteres uuid-elotagja (es a hivo sajat `proba` elotagjai visszaadva). A teszt (N16) hash-eket, e-mailt, teljes UUID-t es hosszu hexa-szoveget keres a teljes valaszban.

## Mukodes / terheles
Egy hivas 7 `SELECT`-et (+ `pragma_table_info` sema-vizsgalatot) ad ki, a nap hataraival korlatozva; a `meres_kuldes` jelenleg ~500 sor (egy nap ~100): a teljes tabla-olvasas elhanyagolhato. Hianyzo tabla / oszlop (regi sema) nem hiba: a szekcio ures. D1-hiba szekciok szerint elkulonul (`szekcio_hibak`), a tobbi szekcio adata megmarad.

## Tesztek
`node --test tools/test-qa-nap.mjs` (N1–N35: ide tartozik a T2_START N26 / N26b / N27 / N35, a lefedettseg / jogosultsag N28 / N29 es a fuggetlen review javitasai N30–N34): Budapest-nap → UTC (nyar / tel / atallasi napok, ervenytelen datumok), 401 / 403 / 405 / 429 / 400 / no-store, URL-kulcs elutasitasa, a tobbi admin-ag valtozatlansaga, `valos` (felig nyitott hatarok, parositott / parositatlan, lemondas-osztalyok), proba-kizaras, arnyek (platform × allapot × forras), lampa-kuszob (pontosan 0,9 = zold), biztonsag (minden elo ID, dupla – a unique index nelkul is –, nem-ARNYEK cel), `arnyekCel` tabla, `sd`, `pre288` (kulonbozo kizaro esetek, 20-as mintakorlat), `foglalas_vendeg`, PII-mentesseg, csak-olvas (tablak tartalma valtozatlan, ures adatbazison nem hoz letre tablat, minden SQL `SELECT`), hianyzo tablak / szekcio-hiba, Budapest-ejfel hatar.

A SQL-ek az eles D1-en (csak olvasas, `mosaic-foglalas-kulcs`) is lefutottak (`meres-naplo/2026-10-13-qa-nap-teszt.md`).

## Backend proba-sorok (2026-10-18, DECISION #196)
A `google_proba` / `google_proba_visszavon` admin-muvelet (`netlify/lib/meres/google-proba.js`, futtatokonyv: `MERES_GOOGLE_E2E_FUTTATOKONYV.md`) sorai `forras = 'google_proba'` jelolest kapnak. A `qa=nap` ezeket **kizarja** az arnyek-cellak szamlaloibol, a lampabol, a lefedettsegbol es a forras-bontasbol (`platformok.<p>.proba_sor_kizarva` szamolja oket); a biztonsagi ellenorzesek (elo ID, dupla, nem-ARNYEK cel) rajuk is futnak. A `qa=t2start` a `sorok.meres_kuldes.google_proba_db` mezoben kulon mutatja (csak ha van), az egyeztetosor (`gp_*` source_id) nem latja.
