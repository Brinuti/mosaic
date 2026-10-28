# DECISION #251 (a)+(b): MP RETRACT kizárás platformhibára + olvasó számláló (2026-10-28)

**Mérést érint** (Google Ads kiigazítás-jelöltek, MP riport). Alapból **semmi nem változik**: a kizárás-listák üresek, a kiigazítás módja `validate` marad.

## (a) `kiigazitas.js`: platform-/Zap-hibás sor nem RETRACT-jelölt
- Új `mp_beallitas` kulcsok (D1-írásra jogosult állítja, a kód csak olvassa):
  - `kiigazitas_kivetel`: vesszővel elválasztott foglalási kulcsok (`placeId|employeeId|startUnix`) – ezek soha nem jelöltek.
  - `igazolas_kiesesi_ablakok`: JSON `[[from_unix,to_unix],...]` – az ablakban létrejött (`letrehozva`) sorok nem jelöltek (az ellenőrző csatorna, pl. a Zapier hibás futása miatt).
- **Fail-closed** (a 01-MERES review (1)–(3) nem blokkoló észrevételei alapján, 2. commit): nincs jelölt és a GET `hibas_beallitas: true`-t ad, ha (1) bármelyik kivétel-kulcs elgépelt (nem `\d+|\d+|\d+`), (2) az ablaklista nem JSON-tömb, vagy egy ablak nem két pozitív szám (`null`, `""`, `0`, negatív), vagy from>to, (3) a két beállítás olvasása hibázik (D1-hiba). A `modOlvas`/`titok` hibatűrő marad.
- A GET válasz új mezője: `kizart` (hány sort hagytunk ki).
- A két ismert kulcs (`6029|257…` 10-26 22:12:08Z, `11424|27…` 22:25:53Z; ok: Zapier `compute_spend_global_exceeded`) a `kiigazitas_kivetel`-be tehető; az ablak a Zap hibás időszakához.

## (b) MP riport: `igazolas_nelkul_regi`
- `riport.js`: csak olvasó. `mp_foglalas` éles sor, `igazolas IS NULL`, `salonic_id IS NOT NULL`, 6 óránál régebbi → `{db, max_ora}` + sárga lámpa (`figyelmeztetesek.kod = igazolas_nelkul_regi`). Semmit nem ír, nem jelölt semmire. Elérés: `/api/mp-kiigazitas?riport=1`.
- A Mosaic „levél-lánc kimaradt” számláló a `qa-nap.js`-ben (#512 ág) készül, külön SHA-val.

## Védett fájlok (blob-hash, első 10)
| fájl | előtte | utána |
|---|---|---|
| `medicalpiercing/lib/meres/kiigazitas.js` | f79dbd1167 | **a234f6c557** (dokumentált változás; a 4ceb9c16-on 9406f49c94 volt) |
| lanc.js | d52ae17519 | változatlan |
| google-ads.js | 6a4b4a480b | változatlan |
| tiktok.js | 5fc76b1a5c | változatlan |
| meta.js | 447fa9e81c | változatlan |
| igazolas.js | e370d3ff36 | változatlan |

`riport.js` nem védett: c13a4385d5.

## Rollback
A PR revertje; vagy a két beállítás-kulcs törlése (a kizárás megszűnik, a viselkedés a korábbi).
Vendégadat sehova nem kerül (csak kulcsok / időbélyegek / darabszám).

## Tesztek
`test-mp-kiigazitas.mjs` 10/10 (új: kivétel, ablak, fail-closed, riport-számláló, negatív: elgépelt kulcs, null/üres/0 ablak, olvasási hiba → 0 jelölt, `kizart` 0); a negatív tesztek a `4ceb9c16`-os kódon pirosak (8., 10.), az újon zöldek. Mind a 12 `test-mp-*.mjs` zöld.
