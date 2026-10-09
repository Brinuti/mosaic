# E-mail-kepek (életciklus-levelek)

A levelekben használt képek az `assets/email/<üzletág>/` alatt vannak (a build az egész `assets/` mappát kiteszi, így a levelek a `https://www.mosaicheadspa.hu/assets/email/...` címről töltik be őket). Egy kép legfeljebb 240 KB; a katalógus-teszt (`tools/lifecycle-teszt/katalog.test.mjs`) ellenőrzi a méretet, a szélességet és hogy minden hivatkozott fájl létezik.

## Előállítás

```
python3 -I tools/email-kepek/keszit.py                  # minden lista-*.json
python3 -I tools/email-kepek/keszit.py lista-pmu.json   # egy üzletág
```

A `lista-<üzletág>.json` tételei megadják a forrást (`forras`), a kimeneti nevet (`ki`), a vágás módját (`mod`: `szeles` / `kepek` / `negyzet`) és a fókuszpontot. Kimenetenként megadható `kocka` (egy videó egy képkockája, ffmpeg kell: `FFMPEG` környezeti változó vagy PATH) és állóképes (portré) videó-előkép (`arany: [9, 16]`, `lejatszo: true`; a katalógus-blokk `szelesseg` mezője a megjelenítési szélesség). A lezeres „8 kezelés, csak 6-ot fizetsz” ábra az oldal képernyőképe: `node tools/email-kepek/program-kepernyokep.mjs` (Playwright). Két fajta forrás van:

- **az oldal saját képe** (`assets/img/...`): a repóban van, a lista közvetlenül újrafuttatható (a kiválasztáshoz: `oldal-kepek.py`);
- **Drive-kép** (`"drive": "<fájlazonosító>"` mezős tételek): a MOSAIC Drive-mappa egy fotója (profi fotózások, oxigén-, szőrtelenítés-, PMU-mappák). A nagy felbontású forrás szándékosan **nincs a repóban**; az átviteli cső a Drive-ból egy kicsinyített (≤ 1500 px, JPEG-re alakított) másolatot tesz a `tools/email-kepek/drive-jelolt/forras/<szám>.jpg` helyre, ahonnan a `keszit.py` dolgozik. A `<szám>` a Drive-index sorszáma; a kép azonosítóját a lista `drive` mezője tartalmazza.

## Drive-átviteli cső (Zapier)

A fejlesztői környezetből a Google-szerverek nem érhetők el, ezért a másolatot a Zapier végzi: a `drive-atvitel.zapier.ts` egy **piszkozat-futtatásra** (nem publikált workflow) szánt Zapier-durable kód. Két kapcsolat kell hozzá (Zapier → Connections): a Google Drive (amelyikhez a MOSAIC-mappa meg van osztva) és a GitHub (a `Brinuti/mosaic` repo). Az alias neve a kódban `drive` és `github`.

Módok (a futtatás bemenete):

- `lista`: a Drive-fa bejárása, mappánkénti kép- és videószámmal;
- `bel`: a mappák képeinek kis előnézete, csomagolva (`pack-*.bin`) + `manifest-*.tsv`, egyetlen commitban az adott ágra (ebből készültek a képválasztó lapok);
- `masol`: a kijelölt képek kicsinyített másolata külön fájlokban; a lista a bemenetben (`fajlok`) vagy a repóban lévő JSON-ban (`lista_ut`) van.
- `nevek`: egy Drive-mappa fájljai (`{ mappa }`): azonosító, név, típus, méret, van-e bélyegkép, felbontás. Hozzáférés-próbának jó (404 / üres lista = a kapcsolat nem látja a mappát), és a `masol` bemenetének (`fajlok`) azonosítóit adja. (Az oxigén „A mi vendégeink eredményei” blokk képei így készültek, 2026-10-09: a Drive-mappa a Zapier Google Drive-kapcsolatával elérhető volt; a bélyegkép PNG-forrásnál PNG-t ad `.jpg` kiterjesztéssel, ~960 px a hosszú oldal; a kártya-képeket a `vendeg-kartyak.py` készíti belőlük: `python3 -I tools/email-kepek/vendeg-kartyak.py <nyers-mappa> assets/img/oxigen`.)

Korlátok, amiket mértünk: a Zapier-sandbox csak a kapcsolat által engedett hosztokat éri el (a Drive-bélyegkép `lh3.googleusercontent.com`-ról a Drive-kapcsolattal igen); a GitHub-blob kb. 600 KB-ig fogad el; a commit az ágra történik, ezért utána `git pull` kell, és a Cloudflare egy előnézeti buildet indít.

A kész képek után az ideiglenes forrásokat (`drive-jelolt/`) törölni kell a repóból, hogy a történet ne hízzon.
