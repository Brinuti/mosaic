# Napi T2 QA-vegpont (2026-10-13; a meresi oldal SPEC-je, #167 131. komment, GPT atnezte)

**Cel:** az eles D1-et a meresi oldal nem olvashatja. Ezzel a vegponttal a Zapier admin-draft (a kulcs csak a Storage-ban) naponta lekeri a T2-osszevetest (arnyek vs. valos) es a Drive-ra irja. A `pre288_missing_hmac_index` cimke is itt keletkezik.

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

## Ido
A `datum` az **Europe/Budapest** szerinti naptari nap; az intervallum `[Budapest 00:00, kovetkezo nap Budapest 00:00)` UTC-ben, **felig nyitott** (a pontosan ejfeli sor a kovetkezo naphoz tartozik). A nyari / teli ido atallasa a `Intl` adatbazisbol jon (az oszi atallas napja 25, a tavaszi 23 oras). A valasz visszaadja: `datum`, `timezone`, `from_utc`, `to_utc`, `generalva_utc`.

## Valasz-szerkezet
`{ ok, datum, timezone, from_utc, to_utc, generalva_utc, lampa, szekcio_hibak, proba_szabaly, proba_megadva, osszes, uzletagak }`

`uzletagak.<headspa|fodrasz|oxigen|szor|pmu>` (+ `ismeretlen`, csak ha van besorolatlan adat, pl. kulcs nelkuli, meg nem parositott letrehozo level):

1. **`valos`** – az aznapi letrehozo levelek (`foglalas_egyeztetes.letrehozva`): `letrehozo_level`, `parositott`, `parositatlan`, `egyeb_allapot` (pl. `fuggoben`), `proba_kizarva`, `lemondas {db, felszabadult, nincs_bejegyzes, nem_ellenorizheto, birtokos_el, egyeb}` (a `foglalas_lemondas.eredmeny` szoveg *elotagja* szerint).
2. **`arnyek.<meta|tiktok|google|ga4>`** – `meres_kuldes` sorok `allapot` szerint (`elkuldve` / `kihagyva` / `tiltva` / `hiba` / `mas`), `forras` szerint (`motor` / `salonic_direct` / `kartya`) bontva, `alap_elkuldve`, `arany`, `arany_parositott`, `lampa`.
3. **`biztonsag`** – `elo_id_talalat` (elo azonosito a `kerelem`-ben: ELO_CELOK, szohatar-vedett illesztessel), `dupla` (`allapot='elkuldve'` `GROUP BY esemeny_id, platform HAVING COUNT(*)>1`), `nem_arnyek_cel` (az elkuldott kerelem celpontja nem az ARNYEK: Meta csak a `28616665324611098` dataset + tesztkod, TikTok csak a `DB2GTTJC77UE4D1NE4MG` pixel + tesztkod, GA4 nem elo property, Google csak az ARNYEK masodlagos akciok). **Mindharomnal 0 az elvaras.**
4. **`sd`** – `sd_allapot` szerinti darabszamok es a csere-felismeres (`foglalas_reschedule.allapot`) darabszamai.
5. **`pre288_missing_hmac_index`** – `{ db, mintak: [{ uuid_prefix (8 kar.), uzletag, ido }] }` (a minta legfeljebb 20 elem, a `db` a teljes szam). Ide tartozik minden aznap letrehozott (uj vagy sd) foglalas, amelyhez **±60 percen belul**, **ugyanabban az uzletagban** lemondas (`foglalas_lemondas`) erkezett egy **1791885187** (2026-10-13 09:53:07 UTC, a #288 eles merge-e) **elott** letrehozott `foglalas_egyeztetes` uuid-ra, es ennek az uuid-nak **nincs `foglalas_vendeg` sora**. Az uj foglalas uzletaga a `foglalas_vendeg` sorabol, ennek hianyaban a kulcsabol (place id), a regi foglalase a sajat kulcsabol, ennek hianyaban a lemondas kulcsabol jon; ha valamelyik nem allapithato meg, az eset **nem szamit** (nem tudjuk igazolni az azonos uzletagot).
5b. **`post288_missing_hmac_index`** (a meresi oldal jovahagyta, #167 137. komment) – `{ db, parositatlan_db, mintak: [{ uuid_prefix, uzletag, ido }] }`: a **#288 UTAN** (`letrehozva >= 1791885187`) letrehozott letrehozo level, amelyhez **nincs `foglalas_vendeg` sor**. A `db` a **parositott** sorokat szamolja (a parositott level nem maradhat index nelkul: az sd csere-felismerese az index-soron mulik), a nem parositottak a `parositatlan_db`-ben kulon. A minta legfeljebb 20 elem. A kimaradas **okat** a D1 nem tudja; az a `/api/foglalas-egyeztetes` valaszaban latszik (`vendeg_index.kod`, lasd a `hmac-index-miert` agat). A szamlalo **tajekoztato** (onmagaban nem piros / sarga). Elso eles meres (2026-10-13): headspa `db=2` (`9a03d9f7`, `dca36449` – a kerelemben nem volt ervenyes e-mail).
6. **`foglalas_vendeg`** – az aznapi uj sorok `forras` szerint (`level` / `sd_atvetel`).

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
`node --test tools/test-qa-nap.mjs` (N1–N24b): Budapest-nap → UTC (nyar / tel / atallasi napok, ervenytelen datumok), 401 / 403 / 405 / 429 / 400 / no-store, URL-kulcs elutasitasa, a tobbi admin-ag valtozatlansaga, `valos` (felig nyitott hatarok, parositott / parositatlan, lemondas-osztalyok), proba-kizaras, arnyek (platform × allapot × forras), lampa-kuszob (pontosan 0,9 = zold), biztonsag (minden elo ID, dupla – a unique index nelkul is –, nem-ARNYEK cel), `arnyekCel` tabla, `sd`, `pre288` (kulonbozo kizaro esetek, 20-as mintakorlat), `foglalas_vendeg`, PII-mentesseg, csak-olvas (tablak tartalma valtozatlan, ures adatbazison nem hoz letre tablat, minden SQL `SELECT`), hianyzo tablak / szekcio-hiba, Budapest-ejfel hatar.

A SQL-ek az eles D1-en (csak olvasas, `mosaic-foglalas-kulcs`) is lefutottak (`meres-naplo/2026-10-13-qa-nap-teszt.md`).
