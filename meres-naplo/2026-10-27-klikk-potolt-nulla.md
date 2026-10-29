# 2026-10-27 – meres_forras.klikk_potolt: NULL != 0 (mérési oldal kérése, #167 6435448268 2. pont)

* Kérdés: a `klikk_potolt` 10-20..26 között mind a 169 sorban NULL – fut-e a pótlás, vagy nincs eset? A NULL a kettőt nem választotta szét.
* Változás (`netlify/lib/meres/forras-lpt.js`, nem védett): hirdetési hozzájárulással a mező **`0`** (a pótlás-logika lefutott, nem kellett), **`nem_mentve`** (lefutott, de az esemény már kiment), vagy a pótolt típusok; hozzájárulás nélkül NULL. A kliensnek adott válasz alakja változatlan (`0` / `nem_mentve` → `null`). A `tools/lpt-riport-sql.mjs` „pótolt” lekérdezése kizárja a `0` / `nem_mentve` értéket.
* Nincs séma-változás (TEXT oszlop), nincs küldés, nincs új adat; régi sorok NULL-ok maradnak. Rollback: revert.
* Tesztek: test-lpt-forras 59/59 (új: NULL != 0), test-erintesnaplo 28/28, test-meres 51/51.
