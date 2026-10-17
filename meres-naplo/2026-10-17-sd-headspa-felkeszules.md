# 2026-10-17 – HeadSpa salonic_direct előkészítés (DECISION #191): teszt-napló

**MÉRÉST ÉRINT (az sd smoke-eszköz és az offline tesztek); éles kód, kapcsoló, külső fiók nem változik.** Dokumentáció: `docs/booking-engine/SALONIC_DIRECT_HEADSPA.md`. A `salonic_direct:headspa` kapcsolósor **nincs** (az éles `meres_kapcsolo`: `mind=1`, `salonic_direct:oxigen=1`, `salonic_direct:pmu=1`, 10-17 17:27 Budapest).

## 1. Tesztek (helyben, Node, hamis hálózat, nincs titok)

| parancs | eredmény |
|---|---|
| `node --test tools/test-sd-headspa.mjs` | **12/12 PASS** (HS-01..HS-12, a valós 8 HeadSpa-szolgáltatásnévvel) |
| `node --test tools/test-sd-smoke.mjs` | **14/14 PASS** (SM1..SM11 régi + SM12..SM14 új HeadSpa) |
| `node --test tools/test-salonic-direct.mjs` | **71/71 PASS** (változatlan; az sd mag nem módosult) |

## 2. Élő, csak olvasó ellenőrzések (D1 `ea7b0edd…`, 2026-10-17)

- `5cc62a01` (első természetes közvetlen PMU foglalás) sd smoke: **PASS 12/12** (C4 = 1209 mp), #167 6235840508.
- HeadSpa kuponos / normál levelek a vendég-index indulása (10-13 11:52Z) óta: normál 13/13 index-sor, kuponos 1/13. Meta-árnyék `FoglalasElso` `em` nélkül: kuponos 15/18, normál 1/21.
- A Zap (`01a1125b…`, v. `01a1346f…`, csak olvasás) forrása: 5. lépés minden létrehozó levélre `sd_atvetel`; kuponos levélnél a szolgáltatásnév „ (kupon)” utótagot kap.
- Vendégadat egyik lekérdezésben / tesztben sem szerepel (UUID-előtagok, darabszámok, kulcsnevek).

## 3. Védett elemek (alap: `main` `d6e235a`; a táblázat az `ae6c96d`-vel is azonos, a közbeni `main`-változás csak `medicalpiercing/` + napló)

| elem | `main` | a változásban | |
|---|---|---|---|
| `assets/js/suti.js` | ea41ffd20d | ea41ffd20d | változatlan |
| `assets/js/booking-engine/koszono.js` | 547d0e05fc | 547d0e05fc | változatlan |
| `assets/js/booking-engine/engine.js` | 422d612e44 | 422d612e44 | változatlan |
| `assets/js/booking-engine/lepes-meres.js` | 545b95b944 | 545b95b944 | változatlan |
| `assets/js/booking-engine/salonic-adapter.js` | 61a6eb83a8 | 61a6eb83a8 | változatlan |
| `klon/oxigenterapia-ok.html` | 157c141e5d | 157c141e5d | változatlan |
| `klon/fodrasz-ok.html` | 1ef408bcbb | 1ef408bcbb | változatlan |
| `klon/m/oxigenterapia-ok.html` | 88c2d866ae | 88c2d866ae | változatlan |
| `klon/m/fodrasz-ok.html` | ae96e4ae97 | ae96e4ae97 | változatlan |
| `wrangler.toml` | 01f30c1018 | 01f30c1018 | változatlan |
| `netlify/lib/meres/salonic-direct.js` | 2ef428132f | 2ef428132f | változatlan |
| `netlify/lib/meres/hash.js` | 203394664e | 203394664e | változatlan |
| `netlify/lib/foglalo-szamlalo.js` | 04fdf3a3fb | 04fdf3a3fb | változatlan |
| fa `assets/js/booking-engine` | a5a793f9ab | a5a793f9ab | változatlan |
| fa `netlify` | 2c837cd121 | 2c837cd121 | változatlan |
| fa `functions` | f8eaf39c51 | f8eaf39c51 | változatlan |

Módosított / új fájlok: `tools/sd-smoke-ellenorzes.mjs`, `tools/test-sd-smoke.mjs` (SM12–SM14), `tools/test-sd-headspa.mjs` (új), `docs/booking-engine/SALONIC_DIRECT.md` (egy hivatkozó bekezdés), `docs/booking-engine/SALONIC_DIRECT_HEADSPA.md` (új), ez a napló.

## 4. Rollback

Ennek a változásnak nincs éles hatása: `git revert` (egy commit) elég; D1-séma, kapcsoló, Zap nem változott. A HeadSpa sd (későbbi) bekapcsolásának visszagörgetése: `sd_kapcsolo … headspa, be:false` (lásd a dokumentum 6. pontját).
