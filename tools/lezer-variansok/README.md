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

## A férfi oldal: `vegleges-szortelenites-ferfiaknak` (már NEM ebből a rendszerből készül)

A férfi oldal **kikerült** ebből a sablonrendszerből: a `/lezeres-szortelenites-budapest` landing stílusában és komponenseivel készült újra (Feri kérése, 2026-10-17: „ez még a régi rendszer szerint készült el, nem szép”).
- **Nincs generátora.** A korábbi `gen-ferfi.mjs` (és a `gen.mjs` segédfüggvényeire épülő `lv-*` sablon) kivezetve (törölve; a git előzményben megvan). A `foglalas/vegleges-szortelenites-ferfiaknak.html` **kézzel szerkesztett HTML**.
- Stílus: `assets/css/lezer-landing.css` (a női landing komponensei: hero, kártyák, arany gombok, harmonika-GYIK, helyszín) + a csak erre az oldalra való `assets/css/lezer-ferfi-landing.css` (utána töltődik be). A `lezer-variansok.css` / `headspa-oldal.css` ezen az oldalon már nincs használatban.
- Működés: `assets/js/headspa-oldal.js` (Trustindex-keret, Google-térkép hozzájárulás-kapuval). A `lezer-landing.js` a női árlista tábláját / kalkulátorát / naptárát várja, ezért ide nem jó: a foglaló-gombok a régi oldal `/foglalo-motor?business=laser` linkjei, változatlanul.
- Tartalom: szó szerint a régi (Wixes) oldalról (a `forras/ferfi.folyam.txt` + `ferfi.json` a régi oldal kinyert tartalma; **ezek maradnak**, a teszt és az `ellenor.mjs` ezekhez méri). Az árak / „májusi 20%” / „nyárra” a régi oldalé, nem javítottuk (lásd a PR „Észrevételek”).
  Csak a megjelenés új: a ✅ jelek helyett a minta ikonjai; a hero H1 két sorra bontva (főcím + arany ajánlat-sor, mint a mintán; a szöveg ugyanaz); a Trustindex a minta csúszkás widgetje (`95e68e62…`), mert a régi oldal `614b09d1…` widgetje lebegő típusú (nagy üres területet hagy).
- A régi `brutalis-simasag` kép (`d25d1e56…`) a régi oldalon a konzultáció- és a „Felejtsd el a pengét” doboz **takart** háttere volt (a női „Hónalj előtte / utána” kép), az új oldalra nem került.
- Teszt: `node --test tools/ujrastilus-teszt/lezer-ferfi.test.mjs` (a régi oldal szövege / képe / linkje a Feri-kérte változtatások táblája szerint + stílus-azonosság a mintaoldallal + mobil hero-sorrend, azonos magasságú hasábok, galéria, belső görgetés, árva-sor, 390 / 360 px; 2026-10-20: lásd `docs/LEZERES_LANDING.md` „2026-10-20 Feri visszajelzés”). Rejtett régi példány: `/vegleges-szortelenites-ferfiaknak-regi` (változatlan).
