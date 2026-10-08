# QA-3 záró számláló – a DECISION #110 szerinti sorok (nyers számok, ítélet nélkül)

Mérés: 2026-10-08 20:55–20:58 UTC (22:55–22:58 Budapest), csak olvasás. Adatforrás: a #128 D1 (`628113fe-9793-450d-baad-fc77814995eb`), git, GitHub-aktivitás. Ablak: 2026-10-07 20:20:00 UTC → 2026-10-08 20:20:00 UTC (epoch 1791404400 → 1791490800). A lekérdezések: `tools/meres-proba/qa3-zaras-lekerdezesek.sql`. Vendégadat nincs a fájlban. **FINAL PASS-t ez a fájl nem mond ki.**

## A számláló sorai

| sor | érték | elvárás (GPT) |
|---|---|---|
| `foglalas_egyeztetes` sor az ablakban | 19 | – |
| állapot-eloszlás | `parositatlan` 19 (riasztás 19, párosított 0, 4 próba mindegyiknél) | – |
| lejárt „függőben” sor | **0** (függőben összesen 0, ebből nem lejárt 0) | 0 |
| lusta lezárás (kulcsos GET) | nem futtattam: nem volt `fuggoben` sor, amit le kellene zárni | – |
| `meres_kuldes` sor az ablakban (létrehozva vagy frissítve) | 0 | – |
| téves élő küldés (elküldött sor élő célponttal) | **0** (az ablakban nincs elküldött sor; a teljes táblában 500 sorból 0 élő célú) | 0 |
| rossz eseménytípus | **0** (vizsgált küldési sor: 0, nincs mit vizsgálni; „jelleg hiányzik” 0) | 0 |
| (`esemeny_id`, `platform`) duplikáció | **0** az ablakban, **0** a teljes táblában | 0 |
| felszabadult kulcs az ablakban (`foglalas_lemondas`) | 0 | tájékoztató |

## Négy osztály (csak a D1 + a UUID-listák; Gmail- és Salonic-adat nélkül)

| osztály | UUID |
|---|---|
| `CONTROLLED_TEST` | 0 |
| `OTHER_TEST` (külön sor) | 0 |
| `REAL` | 0 |
| `UNKNOWN` | 19 (okkód: `nincs-gmail-adat`) |

A 19 UUID egyike sincs a CONTROLLED_TEST (76) vagy az OTHER_TEST (10) listán. `REAL` csak pozitív bizonyítékkal (Gmail-adat) lehet, ezért a végleges osztályozás a mérési munkamenet csomagjára (Gmail UUID névvel / e-maillel / telefonnal, Salonic aktív + törölt export) vár. Nyers kimenet: `qa3-haromutas-2026-10-08-nyers-d1-csomag-nelkul.md/.json`.

## Az ablak alatt nem változott (csak olvasás)

| mi | eredmény |
|---|---|
| a #128 D1 sémája | 16 objektum (11 tábla, 5 index): név + `CREATE`-hossz megegyezik a 2026-10-08 ~21:58 UTC előtti kiindulási pillanatképpel és a `ca2ff64` kódjával, eltérés 0 |
| a párosítási szabály (git) | a séma- és párosításfájlok (`netlify/lib/foglalas-kulcs.js`, `netlify/lib/meres/elosztas.js`, `netlify/lib/meres/jelleg-rogzites.js`, `functions/api/foglalas-egyeztetes.js`, `functions/api/foglalas-kulcs.js`, `assets/js/foglalas-kulcs.js`, `wrangler.toml`) blob-azonosak a `ca2ff64` és a mostani #128 fej között; a két fej azonos |
| kódfej | `ca2ff64bff939633615c5632e5e52b47b5e8869b` (`git ls-remote`, 20:57 UTC) |
| push | a GitHub push-aktivitás szerint az utolsó push a #128 ágra 2026-10-07 18:44:16 UTC; az ablakban nincs |
| deploy | a `ca2ff64` Cloudflare Pages check-runja 2026-10-07 18:45:53 UTC; újabb git-alapú deploy nincs |
| kill switch (`meres_kapcsolo`) | 5 sor, mind `be = 1`, a legutóbbi módosítás 2026-10-06 17:16:57 UTC (epoch 1791307017): változatlan |

## Kimondott korlátok

- A D1-nek nincs DDL-naplója: a séma-ellenőrzés állapot-összevetés (kód = D1, két időpontban azonos).
- A Cloudflare Pages deploymentjeinek listáját az elérhető eszközökkel nem látom: a „nem volt deploy” bizonyítéka a git / push-aktivitás és a kódfej check-runja; kézi feltöltést vagy újrafuttatást ez nem zárna ki (a GPT #111 is auditkorlátnak nevezte).
- A téves élő küldés és a rossz eseménytípus sor csak a #128 szerver-naplóját (`meres_kuldes`) fedi; a Zapier-flow-kat (01a1125b, 01a1122c, 01a0e724, 01a10ac7) a mérési oldal ellenőrzi.
- A `c227083` commitot (csak az olvasó SQL-fájl) 2026-10-08 20:12 UTC-kor pusholtam a #138 ágra (a repo stop-hookja kérte); a #128-hoz nem nyúltam.
