# A 7 régi (Wixes) lézeres szőrtelenítés hirdetési oldal újrastílusa

Oldalak (mind `noindex`, mint a régi): `szortelenites-5-dolog`, `szortelenites-zsofi-rovid`, `szortelenites-zsofi-vendeg`, `szortelenites-zsofi-bemutatkozo`,
`szortelenites-lezeres-kezeles-folyamata`, `szőrtelenítés-zsófi-3` (ékezetes fájlnév, NFC), `szőrtelenítés-zsófi-csomagok`.
A hét oldal ugyanazt a sablont követi (az élő `/lezeres-szortelenites-budapest` színvilágában / betűivel); a **tartalom szó szerint a régi oldalról** van (szöveg, árak, a régi
„májusi” 20%-os kedvezmény és a „nyárig” ajánlat is, képek, videó, linkek, GYIK). A régi oldal hibáit / elavult adatait **nem** javítottuk (lásd a PR „Észrevételek” részét).

- `forras/<kulcs>.folyam.txt` + `.json`: a régi oldal kinyert tartalma az éles oldalról (`tools/ujrastilus/folyam.mjs`), a csere előtt.
- `gen.mjs`: a forrásból építi a `foglalas/<név>.html` fájlokat (`node tools/lezer-variansok/gen.mjs`). Az újrafuttatás felülírja a kimenetet.
  - A **közös képek** (mind a 7 oldalon azonosak) állandó listából jönnek, nem a kinyerőből: a Wix lusta képeit a kinyerő oldalanként más készletben látta; a régi oldalak HTML-jében
    mind a 7 oldalon ugyanaz a 43 kép van ugyanabban a sorrendben (3 jelvény, 9 árkártya-kép, 6 szalonkép stb.).
  - A **csomagárak / testrészárak** a régi oldalon egy-egy hatalmas szövegsor (Wix-ismétlő); a generátor kártyákra bontja. 2 / 7 oldalon a kinyerő ezt a sort nem látta: ott a többi oldal azonos
    szövegét használja (a generátor hibát jelez, ha a látható példányok szövege eltér).
  - A hero első gombjának `#comp-…` horgonya a régi oldalon a gomb saját azonosítója (saját magára mutat); az új oldalon is a gombra kerül ugyanaz az `id`.
  - A „bérlet helyett” 3 pontjának sorszáma az új oldalon a lista számlálója (a szöveg ugyanaz).
  - A csomagárak mögötti ismétlődő háttérminta (`8af67263…`, „MOSAIC EGYEDI CSOMAG” szalag) dekoratív csempe, az új oldalra nem került.
- Stílus: `assets/css/lezer-variansok.css` (a `headspa-oldal.css` komponenseire épül). Működés: `assets/js/headspa-oldal.js` (videó-felugró, körhinta, Trustindex).
- Rejtett régi példány: `/<név>-regi` (noindex), `node tools/ujrastilus/regi-peldany.mjs <név> --lcp-torol`. Visszaállás: a `foglalas/<név>.html` törlése.
- Teszt: `node --test tools/ujrastilus-teszt/lezer-variansok.test.mjs` (könnyű szerver, dist nélkül): betöltés, meta, H1, tartalom-hűség (a kinyert sorok ÉS a régi HTML minden szövegcsomópontja), képek, linkek,
  árkártyák, GYIK, videó, körhinta, telefon (390 / 360 px), `-regi` fájlok.

## A férfi oldal: `vegleges-szortelenites-ferfiaknak`

Külön generátor: `node tools/lezer-variansok/gen-ferfi.mjs` (forrás: `forras/ferfi.folyam.txt`; a segédfüggvényeket a `gen.mjs`-ből használja). **Indexelhető** marad (a régi oldal sem volt noindex).
Eltérések a női oldalaktól: a konzultáció-szakaszban fotó van (nem videó), nincs Elysion-összehasonlítás, az árlista férfi csomagokat / testrészeket mutat (2 csomag, 4 testrész-csoport),
a galéria 9 képes, a helyszín-szakaszban a klon.js hozzájárulás-kapus Google-térkép áll (szövegei a régi oldaléi).
- A `brutalis-simasag` kép (`d25d1e56…`) a régi oldalon a konzultáció- és a „Felejtsd el a pengét” doboz **takart** háttere (a látszó kép a doboz bal oldali csempéje): az új oldalra nem került.
- Teszt: `node --test tools/ujrastilus-teszt/lezer-ferfi.test.mjs`. Rejtett régi példány: `/vegleges-szortelenites-ferfiaknak-regi`.
