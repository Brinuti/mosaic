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
node tools/oldal-mentes.mjs / index                                  # nyitóoldal
node tools/oldal-mentes.mjs post/suti-tajekoztato suti-tajekoztato
```

A `tools/raw/` (asztali mentések) nincs a repóban, frissítéskor mind a 25 oldalt újra kell menteni.
Legutóbbi teljes frissítés: **2026-09-30** (Wix-kiadás 3277).

Az átalakítás (mindig mindkettőt futtasd):

```bash
node tools/wix2static.mjs
node tools/wix2static.mjs --mobil
```

Egyetlen oldal újraépítése: `node tools/wix2static.mjs index`

### 1.2 Mit csinál az átalakító

1. **Kiszedi a Wix összes scriptjét**, és a Wix egyéni kódjait (`pageHtmlEmbeds`: Meta Pixel, az
   élő oldal saját süti-sávja) – ezeket a klónban a `suti.js` adja. A teljes elrendezés a HTML-be
   ágyazott `<style>` blokkokban van, ezért a script nélküli oldal ugyanúgy néz ki — csak nem „él”.
2. **Kitörli a Wix `@font-face` szabályait**, amik a Wix CDN-jére mutatnak (1849 db az asztali,
   1899 db a mobil oldalakon). Helyettük a saját betűkészletünk lép életbe.
3. **Átírja a képhivatkozásokat** a `static.wixstatic.com` címről a helyi `assets/img/` mappára.
   Ugyanígy a néhány `static.parastorage.com`-ról jövő apró képet is (a nyelvváltó zászlaja),
   hogy az oldal futásidőben **egyetlen kérést se** küldjön a Wix felé.
4. **Átírja a belső linkeket** teljes Wix-címről helyi fájlnévre (860 asztali, 886 mobil link),
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
4. **Videók** helyi fájlból: a két magától induló videó, az oszlop-háttérvideók, a kattintásra
   induló videók (`KATTINTOS` táblázat, 53 doboz) és a kezelés-galéria felugró lejátszója
5. **Beágyazások** (`BEAGYAZASOK`): a Wix HTML-beágyazásai (GYIK, árlisták, Trustindex) az
   `assets/embed/` alól és a Google-térkép, keretben, a Wix üres dobozaiban
6. **Árkártyák** (Wix `fluid-columns-repeater`): láthatóvá tétel és a hézagok beállítása
7. **Felugró ablak** (a fejléc „i” ikonja, Wix-lightbox „Infó”): jobbról beúszik (a Wix saját
   `motion-glideIn` animációja, 600 ms), háttérfátyol, az X, az Esc és a fátyolra kattintás zár

Görgetési vagy belépő animációt szándékosan nem ad hozzá semmihez.

### 1.5b Felugró ablak („Infó”) — `assets/popup/`

A Wix a felugró ablakot kattintásra tölti le (komponensfa + CSS a `siteassets.parastorage.com`-ról),
a `?lightbox=rk7x7` címre az SSR sem rajzolja ki. A `tools/popup-info.mjs` ugyanezt a két választ
használja (`tools/popup/*.json`, `--letoltes` kapcsolóval frissíti), és a Wix id-ivel és
`data-mesh-id`-ivel építi fel a HTML-t, így a Wix elrendezése változatlanul érvényes:
`assets/popup/info.html` (asztali) és `info-mobil.html`. A `klon-kiegeszites.mjs` ezt
`<template>`-ként teszi minden oldal végére, a `klon.js` onnan nyitja meg.

```bash
node tools/popup-info.mjs --letoltes && node tools/klon-kiegeszites.mjs
```

### 1.6 Videók

Részletesen: **[VIDEOK.md](VIDEOK.md)** – leltár mind a 13 oldal videós dobozairól, és hogy
honnan jöttek a fájlok.

### 1.6b Süti-sáv és mérőkódok — `assets/js/suti.js`

Az élő oldalon a süti-sáv egy Wix egyéni kód, a mérés a Wix GTM- és GA-integrációján át ment. A
klónban mindezt a `suti.js` adja, amit a `tools/klon-kiegeszites.mjs` szúr be minden oldal
`<head>`-jébe (a `wix2static.mjs` is ezt hívja):

| | mikor fut |
|---|---|
| süti-sáv (az élő oldaléval azonos kinézet és szöveg) | mindig; a döntés 12 hónapig a böngészőben marad |
| Google Consent Mode v2 | mindig; alapból minden tiltva, a döntés szerint frissül |
| Google Tag Manager `GTM-PST2HB22` | mindig (mint a Wixen) – a címkéit a Consent Mode engedi vagy tiltja |
| Google Analytics 4 `G-H4206SQ0Q7` | statisztikai hozzájárulással |
| Meta Pixel `3473839859576758` | marketing-hozzájárulással (a Wixen hozzájárulás nélkül is futott) |
| Trustindex értékelés-snippet, Facebook-domainigazolás | mindig (sütit nem használnak) |
| Trustindex-widgetek, Common Ninja GYIK és árlisták, Google-térkép | funkcionális hozzájárulással; addig helykitöltő áll a helyükön |

**A mérőkódok csak a `mosaicheadspa.hu` domainen futnak** (`ELES_DOMAINEK` a fájl tetején), a
Netlify-os próbaoldal nem szennyezi a statisztikát. A TikTok, a Google Ads és a szerveroldali
(Stape) mérés a GTM-konténerben van, azokhoz itt nem kell nyúlni.

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

**Utolsó teljes mérés (2026-09-29): mind a 25 asztali és mind a 25 mobil oldal `dH=0, elem=0`** —
azaz az oldal teljes magassága és minden elem mérete pontosan egyezett az eredetivel.

A mérés csak akkor mérvadó, ha az eredeti oldal betűi és scriptjei betöltődnek
(`static.parastorage.com`). A felhős munkakörnyezetből ez a tartomány 2026-09-30-án tiltva volt – az
eredeti ilyenkor tartalék betűkkel rajzolódik ki, és hamis eltéréseket mutat. Ezért a 2026-09-30-i
frissítés után a régi és az új klónt vetettük össze elemenként: mobilon mind a 25 oldal pixelre
azonos, asztalin az egyetlen eltérés, hogy az élő oldal fejléce 87-ről 77 pixelre változott (ez a
Wix CSS-éből jön, az új klón követi).

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

## 3. Amit még pótolni kell

### 3.1 Videók – kész

Lásd **[VIDEOK.md](VIDEOK.md)**: a kattintásra induló videók és a kezelés-galéria 8 videója is a
helyén van.

### 3.2 HTML-beágyazások (GYIK, árlisták és társai) – kész

A Wix HTML-beágyazás dobozai (`HtmlComponent`) a tartalmukat a
`www-mosaicheadspa-hu.filesusr.com/html/<név>.htm` címről töltik. Ezeket változatlanul
letöltöttük az `assets/embed/` alá, és a `klon.js` ugyanúgy keretben (iframe) teszi vissza őket.
Mindegyik harmadik féltől tölt tartalmat, ezért funkcionális hozzájárulás kell hozzájuk (addig
helykitöltő áll a helyükön):

| fájl (`assets/embed/`) | tartalom | szolgáltató | oldalak |
|---|---|---|---|
| `c2eb0f_e2a637…`, `c2eb0f_dab261…` | GYIK (2 doboz, 642×1071, 642×1043) | Common Ninja | `index`, `headspa-ferfiaknak`, `paros-headspa-budapest` |
| `c2eb0f_97df67…` | GYIK (702×1103) | Common Ninja | `headspa-ajandekkartya`, `4-kezes-headspa-ajandekkartya` |
| `c2eb0f_7101a5…` | GYIK | Common Ninja | `lezeres-szortelenites-budapest` |
| `c2eb0f_193bec…` | GYIK | Common Ninja | `oxigenterapia-budapest` |
| `c2eb0f_89f74d…` | árlista (860×7xx) | Common Ninja | `noi-fodraszat-budapest`, `noi-fodrasz-…-balayage-hajfestes`, `noi-hajfestes-budapest` |
| `c2eb0f_ebe819…` | árlista | Common Ninja | `balayage-haj-festes-budapest` |
| `c2eb0f_614b09…` | vendégértékelések | Trustindex | `head-spa-velemenyek`, `lezeres-szortelenites-budapest`, `oxigenterapia-budapest` |
| `c2eb0f_95e68e…` | vendégértékelések (980×357) | Trustindex | `index` |

A GYIK és az árlisták szövege tehát **nem** a mi fájljainkban van, hanem a Common Ninja
fiókjában – ott kell szerkeszteni, mint eddig. A Common Ninja és a Trustindex a felhős
munkakörnyezetből nem volt elérhető, a keretek tartalmát ezért csak élesben lehet megnézni.

## 4. Publikálás

### Melyiket?

- **A `klon/` tartalmát**, ha a látogató ne vegye észre a váltást. Ekkor a `klon/*.html` kerül a
  gyökérbe, a `klon/m/*.html` pedig az `/m/` alá, az `assets/` mellé. A gyökérben lévő mostani
  `*.html` fájlok és a `src/` ilyenkor kikerülnek (vagy maradhatnak archívumnak).
- **A gyökérben lévő mostani `*.html`-t**, ha a könnyű szerkeszthetőség fontosabb, és belefér egy
  kissé eltérő megjelenés.

A kettő **nem keverhető**: a menü és a linkek másképp épülnek fel bennük.

### Netlify (ajánlott)

A repóban lévő `netlify.toml` mindent beállít: a `tools/netlify-build.mjs` egy `dist/` mappába
rakja a klónt és az `assets/`-ot, a régi `/post/…` címekre átirányítást tesz.

**Amíg az `ELES=1` környezeti változó nincs beállítva, az oldal próbaüzemben fut:** minden oldal
`noindex` fejlécet kap és a `robots.txt` mindent tilt, így a próbaoldal nem kerül a Google-be.
Élesítéskor: Netlify → *Site configuration → Environment variables* → `ELES` = `1`, majd új deploy.

**Ajándékkártya-űrlap** (`headspa-ajandekkartya`, `4-kezes-headspa-ajandekkartya`): a `klon.js`
7d. szakasza ellenőrzi és a Netlify Forms-nak küldi be (`ajandekkartya` nevű űrlap), majd a
`success-ajandekkartya.html` köszönőoldalra visz – mint a Wixen. Az e-maileket a
`netlify/functions/submission-created.mjs` küldi (a vevőnek az utalási adatokkal, a szalonnak a
rendeléssel). Beállítás a Netlify-on:

1. *Forms* → **Enable form detection** (új oldalaknál alapból ki van kapcsolva), majd új deploy.
2. *Site configuration → Environment variables*: `SMTP_HOST` (pl. `smtp.gmail.com`),
   `SMTP_PORT` (`465`), `SMTP_USER` (pl. `mosaicheadspa@gmail.com`), `SMTP_PASS` (Gmailnél
   **alkalmazásjelszó**: Google-fiók → Biztonság → Kétlépcsős azonosítás → Alkalmazásjelszavak).
   Nem kötelező: `MAIL_FROM` (feladó), `MAIL_TO` (a szalon címe, alapból mosaicheadspa@gmail.com).

Ezek nélkül a rendelések a Netlify *Forms* listájában akkor is megjelennek, csak e-mail nem megy.

### Saját tárhely / cPanel

Töltsd fel FTP-vel a választott változat `*.html` fájljait, az `assets/` mappát, a `sitemap.xml`-t
és a `robots.txt`-t. A `src/` és a `tools/` mappát nem kell feltölteni.

### Élesítés előtt

1. A `tools/build.mjs`-ben a `SITE` konstans adja a sitemap abszolút URL-jeit — ellenőrizd a
   végleges domaint.
2. Minden slug megegyezik az eredetivel, szóval a legtöbb tárhelyen elég a „clean URL" opciót
   bekapcsolni. Kivétel a `/post/suti-tajekoztato`: a Netlify-n átirányítás van rá (`tools/netlify-build.mjs`), máshol kézzel kell beállítani.

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
