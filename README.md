# MOSAIC Head Spa — Wix nélküli weboldal

A `mosaicheadspa.hu` Wix-független változata: sima HTML + CSS + JS, bármilyen tárhelyre feltölthető,
futásidőben egyetlen kérést sem küld a Wix szervereire.

A repóban **két különböző változat** van. Mindkettő működik, de más a céljuk:

| | `klon/` (+ `klon/m/`) | gyökérben lévő `*.html` |
|---|---|---|
| mi ez | a Wix-oldal **pixelpontos** mása | korábbi, kézzel újraépített változat |
| honnan jön | a Wix saját HTML-jéből, géppel | `src/pages` + `src/partials`, `tools/build.mjs` |
| oldalak | 25 asztali + 25 mobil | 22 |
| megjelenés | az eredetivel **méretre azonos** (mérve) | hasonló, de nem azonos |
| szerkeszthetőség | gépi HTML, nehezen | könnyen, kézzel |

**Ha a cél az, hogy a látogató ne vegye észre a váltást, a `klon/` tartalmát kell publikálni.**
A döntés a 4. pontban van kifejtve.

---

## 1. A klón (`klon/`) — a pixelpontos változat

### 1.1 Hogyan készül

A Wix a böngésző azonosítója (user agent) alapján **két külön oldalt** szolgál ki: telefonon egy
320 pixel széles mobil oldalt, minden máson az asztalit. Ezért mindkettőt külön mentjük le és
külön alakítjuk át.

```
tools/oldal-mentes.mjs   egy élő oldal lementése mindkét változatban
   ↓
tools/raw/*.html         a Wix asztali HTML-je (érintetlen)
tools/raw-mobil/*.html   a Wix mobil HTML-je (érintetlen)
   ↓
tools/wix2static.mjs     az átalakító
   ↓
klon/*.html              asztali klón
klon/m/*.html            mobil klón
```

Egy új oldal lementése (a `post/` előtag opcionális, a második paraméter a fájlnév):

```bash
node tools/oldal-mentes.mjs headspa-budapest
```

Az átalakítás (mindig mindkettőt futtasd):

```bash
node tools/wix2static.mjs
node tools/wix2static.mjs --mobil
```

Egyetlen oldal újraépítése: `node tools/wix2static.mjs index`

### 1.2 Mit csinál az átalakító

1. **Kiszedi a Wix összes scriptjét.** A teljes elrendezés a HTML-be ágyazott `<style>` blokkokban
   van, ezért a script nélküli oldal ugyanúgy néz ki — csak nem „él”.
2. **Kitörli a Wix `@font-face` szabályait**, amik a Wix CDN-jére mutatnak (1849 db az asztali,
   1899 db a mobil oldalakon). Helyettük a saját betűkészletünk lép életbe.
3. **Átírja a képhivatkozásokat** a `static.wixstatic.com` címről a helyi `assets/img/` mappára.
   Ugyanígy a néhány `static.parastorage.com`-ról jövő apró képet is (a nyelvváltó zászlaja),
   hogy az oldal futásidőben **egyetlen kérést se** küldjön a Wix felé.
4. **Átírja a belső linkeket** teljes Wix-címről helyi fájlnévre (864 asztali, 911 mobil link),
   a `/post/` előtagot levágva. A `canonical` és az `og:url` szándékosan marad teljes cím — azok
   a keresőnek kellenek.
5. **Beszúrja** a saját CSS-t, a `klon.js`-t és az asztali↔mobil váltót.

### 1.3 Asztali ↔ mobil váltás

A `<head>` legelejére kerül egy pár soros script, ami ugyanazt a döntést hozza, mint a Wix: ha a
böngésző azonosítója telefonra utal, a `klon/m/` alatti oldalra ugrik (és fordítva). **Nem a
képernyő szélessége számít**, ezért egy keskenyre húzott asztali ablak továbbra is az asztali
változatot kapja — pontosan úgy, ahogy most is.

Keretbe (iframe) ágyazva a váltó soha nem lép működésbe, hogy az összehasonlító eszköz használható
maradjon.

### 1.4 Betűk

A Wix öt fizetős betűcsaládot használ (Avenir LT, Futura LT, Helvetica Neue, DIN Next, Proxima
Nova). Ezeket **nem szabad** a Wix alól kimásolni és saját tárhelyről kiszolgálni — a licenc a Wix
előfizetéshez kötött. Helyettük ingyenes helyettesítők vannak beállítva (Hanken Grotesk, Jost,
Arimo, Sarabun), `size-adjust` és `ascent-override` finomhangolással, hogy **a sortörések és a
sormagasságok pixelre ugyanoda essenek**.

A Roboto, Lato és Sarabun ingyenes (Apache 2.0 / OFL), azokat a Wix által használt pontos kiadásban
töltöttük le.

```bash
node tools/fonts-wix.mjs       # kigyűjti, milyen betűt kér a Wix
node tools/fonts-letoltes.mjs  # letölti az ingyeneseket a Google Fontsról
node tools/fonts-css.mjs       # legenerálja az assets/css/wix-fonts.css-t
```

A helyettesítő-táblázat és a mért igazítási értékek a `tools/fonts-css.mjs` tetején vannak.

### 1.5 `assets/js/klon.js` — ami visszaadja a működést

A Wix scriptjeit kidobtuk, ezért ez a fájl adja vissza a viselkedést. Nem újraértelmezi: pontosan
azokat az osztályokat és attribútumokat állítja, amiket az élő oldalon mérve a Wix JS-e állít.

1. **Mobil menü** nyitás/zárás (hamburger → X, fátyolra és Esc-re zár)
2. **Mobil almenük** lenyitása
3. **Asztali legördülő menü** rámutatásra, billentyűzetről is
4. **A két lejátszódó videó** behelyezése helyi fájlból

Görgetési vagy belépő animációt szándékosan nem ad hozzá semmihez.

### 1.6 Videók

Az élő oldalon 13 oldalon van videólejátszó komponens, de **csak kettőn indul el ténylegesen
videó**: a nyitóoldalon és a `headspa-budapest-hungary` oldalon. Ez a kettő le van töltve és a
`klon.js` teszi be őket. Az élő **mobil** változat egyik oldalon sem indítja el a lejátszót, ezért
a mobil klónban sem teszünk be videót.

A galériás kezelés-videókról lásd a 3.1 pontot.

### 1.7 Ellenőrzés: összehasonlítás az eredetivel

```bash
node tools/serve-klon.mjs      # http://localhost:4180
```

A kiszolgáló négy címet ad:

| cím | mit ad |
|---|---|
| `/index.html` | asztali klón |
| `/m/index.html` | mobil klón |
| `/eredeti/index.html` | az érintetlen Wix asztali mentés |
| `/eredeti-mobil/index.html` | az érintetlen Wix mobil mentés |

Az összehasonlító eszköz: `http://localhost:4180/tools/osszehasonlitas/index.html`. Böngésző-
konzolból:

```js
mobil(false);                     // asztali (1440px) mód; mobil(true) → 320px
await vizsgal('index.html');      // egy oldal részletesen
await vizsgalTobb(['index.html','aszf.html']);   // több oldal, soronként OK/ELT
```

A vizsgálat **megvárja, amíg az eredeti oldal elrendezése megállapodik** (a Wix scriptjei
betöltés után még percekig mozgatják a tartalmat), majd összeveti minden azonosítóval ellátott
elem szélességét és magasságát.

**Jelenlegi állás: mind a 25 asztali és mind a 25 mobil oldal `dH=0, elem=0`** — azaz az oldal
teljes magassága és minden elem mérete pontosan egyezik az eredetivel.

---

## 2. A kézzel épített változat (gyökér + `src/`)

```
src/pages/*.html      a szerkesztendő oldalak (törzs + fejléc-meta)
src/partials/*.html   megosztott blokkok (fejléc, lábléc, kapcsolat, árkártyák, GYIK)
tools/build.mjs       a generátor
*.html                a legenerált oldalak
```

**Soha ne a gyökérben lévő `*.html`-t szerkeszd** — azt a build felülírja. Mindig a `src/pages/`
alatti párját módosítsd, majd:

```bash
node tools/build.mjs
```

Node 18+ kell hozzá (ESM). Újragenerálja mind a 22 oldalt, a `sitemap.xml`-t és a `robots.txt`-t.

### Oldal-fejléc

```html
<!--meta
{"title":"...","description":"...","nav":"slug","parent":"fodraszat","image":"assets/img/....jpg"}
-->
```

`title` / `description` → `<title>` és meta description · `nav` → melyik menüpont aktív ·
`parent` → melyik legördülő szülő aktív · `image` → az Open Graph kép

### Megosztott blokkok

A `<!--include nev-->` behelyettesíti a `src/partials/nev.html` tartalmát:

| include | mit tartalmaz |
|---|---|
| `contact` | „Itt találsz meg minket" szekció, térkép, CTA gombok |
| `arak-kartyak` | a 4 head spa árkártya |
| `faq-fooldal` | a főoldal 10 kérdéses GYIK-je |
| `faq-masodik` | a 8 kérdéses GYIK (ellenjavallatokkal) |
| `faq-szortelenites` | a szőrtelenítés oldal 10 kérdéses GYIK-je |
| `faq-oxigen` | az oxigénterápia oldal 10 kérdéses GYIK-je |

Ha az árak vagy a nyitvatartás változik, elég a partialt átírni — minden oldalon frissül.

### Az űrlapok

A `headspa-ajandekkartya.html`, a `4-kezes-headspa-ajandekkartya.html` és a `pmu-foglalas.html`
űrlapja **Netlify Forms** formátumban készült (`data-netlify="true"`, honeypot mezővel).

- **Netlify-n**: a beküldések a *Forms* fülön jelennek meg, e-mail-értesítés beállítható.
- **Máshol**: a `data-netlify` attribútum hatástalan. Ilyenkor Formspree kell
  (`action="https://formspree.io/f/AZONOSITO"`), vagy egy serverless function.

A PMU-űrlap fájlfeltöltést is tartalmaz (`enctype="multipart/form-data"`).

A Stripe-os „bankkártyás vásárlás" gombok az eredeti Stripe-linkekre mutatnak, azok mindenhol
működnek.

---

## 3. Amit kézzel kell pótolni

### 3.1 Nyolc kezelés-videó (Wix token-védelem)

A galériás kezelés-videók a Wix tokenes védelme miatt nem tölthetők le — a linkjük 403-at ad, a
HTML-be ágyazott aláírás pedig csak helykitöltő („invalid token”). Ezeket a **Wix Media
Managerből kell exportálnod** és bemásolnod az `assets/video/` mappába, **pontosan ezekkel a
fájlnevekkel**:

```
c2eb0f_08e23fa612e846eca8137312513c1fec.mp4
c2eb0f_225ee4f9b6164d3c858705c394f7d04e.mp4
c2eb0f_29c8623e64464bdb96b1d61fa5ed6556.mp4
c2eb0f_430fb9fbd2e744b08703615db12f4018.mp4
c2eb0f_4dd11049dc03482e8b6a169484d1b976.mp4
c2eb0f_a12ccd3c1d8741698774232c8bee7efd.mp4
c2eb0f_a772c9222aa949a0888a4aa2298ef0b5.mp4
c2eb0f_bbb818fad4674d2097775970ca10c3d0.mp4
```

A poszter-képek (az indítás előtt látszó állóképek) le vannak töltve, tehát addig is helyesen néz
ki az oldal — csak a lejátszás nem indul el. A pótlás után a `klon.js`-be kell egy kis lejátszó,
hogy a bélyegképre kattintva induljon a helyi fájl.

### 3.2 Süti-sáv

A Wix a sütijóváhagyó sávot **JavaScriptből** teszi az oldalra, ezért a klónban nincs benne. A
süti-tájékoztató **szöveges oldala** megvan (`suti-tajekoztato.html`, az eredetin
`/post/suti-tajekoztato`), de magát a sávot a saját tárhelyen pótolni kell (bármelyik ingyenes
megoldás megteszi).

Ha a régi cím is működjön, érdemes egy átirányítást beállítani:
`/post/suti-tajekoztato` → `/suti-tajekoztato.html`.

### 3.3 Trustindex Google-vélemény widget

A Google-véleményeket megjelenítő Trustindex widget nem jött át. Ha élő véleményfolyamot
szeretnél, a beágyazó scriptje betehető
(`cdn.trustindex.io/loader.js?8a7562c424f027774456be130a1`).

---

## 4. Publikálás

### Melyiket?

- **A `klon/` tartalmát**, ha a látogató ne vegye észre a váltást. Ekkor a `klon/*.html` kerül a
  gyökérbe, a `klon/m/*.html` pedig az `/m/` alá, az `assets/` mellé. A gyökérben lévő mostani
  `*.html` fájlok és a `src/` ilyenkor kikerülnek (vagy maradhatnak archívumnak).
- **A gyökérben lévő mostani `*.html`-t**, ha a könnyű szerkeszthetőség fontosabb, és belefér egy
  kissé eltérő megjelenés.

A kettő **nem keverhető**: a menü és a linkek másképp épülnek fel bennük.

### Netlify (ajánlott)

Húzd be a repót vagy a mappát.

- a klónhoz: **publish directory:** `klon`, build command nincs (az `assets/` mappát a `klon/`
  mellé kell másolni, vagy a gyökeret publikálni és a klónt a gyökérbe kiterítni)
- a kézi változathoz: **build command:** `node tools/build.mjs`, **publish directory:** `.`

### Saját tárhely / cPanel

Töltsd fel FTP-vel a választott változat `*.html` fájljait, az `assets/` mappát, a `sitemap.xml`-t
és a `robots.txt`-t. A `src/` és a `tools/` mappát nem kell feltölteni.

### Élesítés előtt

1. A `tools/build.mjs`-ben a `SITE` konstans adja a sitemap abszolút URL-jeit — ellenőrizd a
   végleges domaint.
2. Minden slug megegyezik az eredetivel, szóval a legtöbb tárhelyen elég a „clean URL" opciót
   bekapcsolni. Kivétel a `/post/suti-tajekoztato` (lásd 3.2).

---

## 5. Ellenőrző parancsok

Hiányzó képek a klónban (az átalakító magától is jelzi, jelenleg 0):

```bash
grep -ho 'assets/img/[a-zA-Z0-9_]*\.\(jpg\|jpeg\|png\|gif\|webp\|svg\)' klon/*.html klon/m/*.html | sort -u | while read f; do [ -f "$f" ] || echo "HIANYZIK: $f"; done
```

Tölt-e még bármit a Wix szervereiről (jelenleg semmit):

```bash
grep -ho '<link[^>]*\(parastorage\|wixstatic\)[^>]*>\|<script[^>]*\(parastorage\|wixstatic\)[^>]*>\|<img[^>]*\(parastorage\|wixstatic\)[^>]*>\|url([^)]*\(parastorage\|wixstatic\)[^)]*)' klon/*.html klon/m/*.html | sort -u
```

A `data-href="...parastorage..."` találatok **nem** számítanak: azok a beágyazott `<style>`
blokkok mellett álló eredetmegjelölések, nem töltenek be semmit.

Törött belső link a kézi változatban:

```bash
grep -ho 'href="[a-z0-9-]*\.html[^"]*"' *.html | sed 's/href="//;s/"//;s/#.*//' | sort -u | while read f; do [ -f "$f" ] || echo "TOROTT: $f"; done
```
