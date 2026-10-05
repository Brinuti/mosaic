# Kiadás-ellenőrző: a foglaló réteg / gombok változtatásainál

Ez a lista a 2026-10-05-i „fehér képernyő” hiba után készült. Minden változtatás előtt végig kell futtatni, ami a foglaló rétegét, a foglalás-gombokat/linkeket, a görgetést vagy bármilyen rögzített (fixed) / átfedő elemet érint. **A tulajdonosnak nem kell kattintgatnia: ezt a gép végzi el.**

## Mi történt (2026-10-05)

Az élesítés (#114, 00:49) után telefonon (iPhone Safari és Chrome Android is) a főoldalon és a legtöbb oldalon csak a legfelső gomb (hero) és a menü nyitotta a foglalót; a **lejjebb lévő gombokra koppintva fehér képernyő jött, felugró nélkül**.

- **Ok:** a réteg a megnyitáskor az oldalt „lefagyasztotta”: a `body` rögzített (`position: fixed`) lett, és `top: -<görgetés>` px-szel felfelé el lett tolva. Az oldal 20–30 ezer képpont magas, a gombnál legörgetve az eltolás több ezer képpont (a tulajdonos telefonján `-4989 px`). A telefonok grafikus rétege egy ekkora, eltolt blokkot nem rajzol ki: a réteg létrejött (a naplóban minden jó volt: méret, pozíció, `be-open=true`), de a képernyőn **fehér** maradt. A hero-nál (görgetés 0) az eltolás 0, ezért ott működött.
- **Javítás:** csak a görgetést zárjuk (`overflow: hidden` azon az elemen, amelynek overflow-ja a viewportra származik: alapból a `body`), az oldal helyzete nem változik. Ugyanez a Wix-klon popup-jánál (`klon.js`).

## Miért nem vettük észre magunktól

1. **A tesztek az oldal tetején és programból kattintottak** (`element.click()` JavaScriptből; a gomb nem volt legörgetve). A hibát a görgetett állapot váltotta ki.
2. **A tesztböngésző (headless Chrome/WebKit, számítógépen) nem korlátozza a grafikát úgy, mint egy telefon.** A DOM-állapot ott is hibátlan volt, a hiba csak a *kirajzolásban* van. Az „él a réteg” ellenőrzés ezért zöld volt.
3. **Nem néztük, hogy a képernyőn tényleg látszik-e a réteg**, csak azt, hogy létezik a DOM-ban.
4. **Valódi telefonos próba nem volt a folyamatban** (a lista „nyitott” pontja maradt).

## Kötelező ellenőrzések (a gép végzi)

1. `node --test tools/test-*.mjs` – tartalmazza a `tools/test-gorgeteszar.mjs`-t: tiltja a `body` rögzítését / eltolását a forrásban.
2. `node tools/netlify-build.mjs` (ELES=1), majd `node tools/meres-proba/reteg-proba.mjs --overlay dist` és `... --mobil 1` – tartalmazza a **lejjebb görgetett oldalon** nyitás ellenőrzését (a body nem fixed, a pozíció megmarad, a réteg a teljes ablakot fedi és legfelül van, bezárás után ugyanott vagyunk).
3. **Teljes gomb-bejárás, a kép alapján is**: `node tools/meres-proba/gomb-bejaras.mjs --profil asztali|mobil|webkit` – az **összes** oldal **összes** foglalás-jellegű gombját / linkjét valódi kattintással (mobilon érintéssel) meghívja, és a kép pixelei alapján ellenőrzi, hogy a foglaló panel háttérszíne látszik-e (nem fehér, nem az oldal). Kimenet: `RETEG` (rendben) / `FEHER` (megnyílt, de nem látszik: **hiba**, a futás 2-es kóddal áll le) / `SEMMI`, `FEDI` (nem történik semmi / valami takarja: **hiba**) / `HORGONY`, `ATVISZ`, `MASIK_LAP`, `TEL`, `UI_VALTAS` (várt viselkedések). Mindhárom profil kell: asztali, mobil (Chrome), webkit (Safari-motor, iPhone-profil).
4. Éles kiadás után ugyanezek az **éles oldalon** is (`--bazis https://www.mosaicheadspa.hu`), letiltott kimenő méréssel.

## Halott gombok (2026-10-05, második kör)

A „nem csinál semmit” gomb másik osztálya: a Wix-ból átvett oldalakon a **felugró űrlap** (data-popupid) és a **Wix-horgony** (data-anchor) gombjai. A felugróhoz a sablon nem került át (`/30szazalek` „KÉREM A 30%-OS KUPONT!”, `/pmu-melitta` „TELEFONOS KONZULTÁCIÓ!”), a horgonyhoz a `klon.js` táblázata nem ismerte a célszekciót (`/pmu-melitta` „TÖBB INFÓT KÉREK!”, lézeres landingek, állás-hirdetések; összesen 13 oldal, 26 gomb). Javítás: `tools/halott-popup.mjs` (a felugró-gomb a foglalóra mutat), `klon.js` `horgonySzekcio` (általános szabály: a legnagyobb `comp-` azonosítójú `<section>`, ami nem nagyobb az anchor azonosítójánál; a 19 ismert párra 19/19).

- **Teszt:** `node --test tools/test-halott-gombok.mjs` – nem maradhat sablon nélküli felugró-gomb, és minden saját oldali horgonynak van célszekciója. Új Wix-oldal bemásolásakor ez jelzi, ha újra halott gomb kerülne be.
- **Bejáró:** a `gomb-bejaras.mjs` a horgony- és felugró-gombokat is bejárja; `UI_VALTAS` = a gomb az oldalon belül nyit valamit (lenyíló, panel), nem foglaló; `SUTI_TAKAR` = a süti-sáv takarja a (rögzített aljasávi) gombot, ez nem hiba (a látogató a sávot előbb lezárja; `--suti elfogad` kikapcsolja a sávot); `SEMMI` = tényleg semmi nem történt (**hiba**). A rögzített (sticky) aljasáv gombjait a bejáró lejjebb görgetve is megméri.
- **A bejáró téves riasztásai ellen:** a gombot középre görgeti (azonnali, nem sima görgetéssel), kinyitja a lenyílókat, a link legnagyobb sorára kattint (a többsoros szöveglink teljes dobozának közepe lehet üres), minden gomb után tiszta oldalt tölt, és ha semmi nem történt, még egyszer megnézi (terhelés alatt a foglaló később nyílhat).

## Ha mégis valaki hibát jelez (valódi telefonon)

A hibát gépen nem biztos, hogy reprodukálni lehet. Használd a beépített diagnosztikát: bármelyik oldal URL-jéhez `?mhdebug=1` (pl. `https://www.mosaicheadspa.hu/paros-headspa-budapest?mhdebug=1`) → a képernyő alján zöld napló látszik: hova esik a koppintás, mi takarja, megnyílt-e a foglaló, hol van a `body`, mekkora a réteg. Képernyőkép vagy a „Masolas” gomb elég. (Paraméter nélkül a modul nem is töltődik be. Kimenő kérés nincs.)

## Általános szabály

A grafikai hibák (fehér képernyő, eltűnő elem) osztálya csak **kép** alapján látszik: DOM-állapot ellenőrzése nem elég. Új, a megjelenést érintő mechanizmusnál (rögzített elem, átfedés, transzformáció, nagy elemek) a gomb-bejárás pixel-ellenőrzése fusson mindhárom profilban.
