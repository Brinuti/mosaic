# MOSAIC Head Spa — statikus weboldal

A mosaicheadspa.hu Wix-mentes, statikus mása. Nincs build-függősége a Wixtől: sima HTML + CSS + JS,
bármilyen tárhelyre feltölthető.

- **20 oldal**, 311 kép, 13 videó, saját `assets/` mappából kiszolgálva
- **Nincs külső futásidejű függőség** (a foglalás Salonic-linkekkel és a Google Maps beágyazással működik,
  ahogy az eredetin is)

---

## 1. Szerkezet

```
src/pages/*.html      a szerkesztendő oldalak (törzs + fejléc-meta)
src/partials/*.html   megosztott blokkok (fejléc, lábléc, kapcsolat, árkártyák, GYIK)
tools/build.mjs       a generátor
assets/               css, js, img, video
*.html                a legenerált oldalak  ← EZEKET kell publikálni
sitemap.xml robots.txt
```

**Soha ne a gyökérben lévő `*.html`-t szerkeszd** — azt a build felülírja. Mindig a `src/pages/` alatti
párját módosítsd, majd futtasd:

```bash
node tools/build.mjs
```

Node 18+ kell hozzá (ESM). A parancs újragenerálja mind a 20 oldalt, a `sitemap.xml`-t és a `robots.txt`-t.

### Oldal-fejléc

Minden `src/pages/*.html` egy meta-blokkal kezdődik:

```html
<!--meta
{"title":"...","description":"...","nav":"slug","parent":"fodraszat","image":"assets/img/....jpg"}
-->
```

- `title` / `description` — `<title>` és meta description
- `nav` — melyik menüpont legyen aktív; `parent` — melyik legördülő szülő legyen aktív
- `image` — az Open Graph kép

### Megosztott blokkok

A `<!--include nev-->` a build során behelyettesíti a `src/partials/nev.html` tartalmát. Használatban:

| include | mit tartalmaz |
|---|---|
| `contact` | „Itt találsz meg minket" szekció, térkép, CTA gombok |
| `arak-kartyak` | a 4 head spa árkártya |
| `faq-fooldal` | a főoldal 10 kérdéses GYIK-je |
| `faq-masodik` | a 8 kérdéses GYIK (ellenjavallatokkal) |

Ha az árak vagy a nyitvatartás változik, elég a partialt átírni — minden oldalon frissül.

---

## 2. Publikálás

### Netlify (ajánlott)

Húzd be a repót vagy a mappát. Beállítások:

- **Build command:** `node tools/build.mjs`
- **Publish directory:** `.` (a gyökér)

A Netlify Forms automatikusan felismeri a két ajándékkártya-űrlapot (lásd lejjebb).

### Vercel

Ugyanezek a beállítások, de a **Netlify Forms nem működik** — ott az űrlapokhoz külön
szolgáltatás kell (pl. Formspree), vagy egy serverless function.

### Saját tárhely / cPanel

Futtasd le helyben a `node tools/build.mjs`-t, majd töltsd fel FTP-vel a gyökérben lévő
`*.html` fájlokat, az `assets/` mappát, a `sitemap.xml`-t és a `robots.txt`-t.
A `src/` és a `tools/` mappát nem kell feltölteni.

### Élesítés előtt

1. A `tools/build.mjs`-ben a `SITE` konstans adja a sitemap abszolút URL-jeit — ellenőrizd, hogy a
   végleges domain van-e benne.
2. Állíts be 301-es átirányítást a régi Wix-útvonalakról, ha valamelyik slug változna. Jelenleg
   minden slug megegyezik az eredetivel (`/headspa-budapest` → `headspa-budapest.html` stb.),
   szóval a legtöbb tárhelyen elég a „clean URL" opciót bekapcsolni.

---

## 3. Amit kézzel kell pótolni

### 3.1 Nyolc kezelés-videó (Wix token-védelem)

Nyolc rövid klipet a Wix tokenes HLS-védelme miatt nem lehetett letölteni — a linkjük 403-at ad.
Ezeket a **Wix Media Managerből kell exportálnod** és bemásolnod az `assets/video/` mappába,
**pontosan ezekkel a fájlnevekkel** (a HTML már így hivatkozik rájuk):

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

A poszter-képek (az indítás előtt látszó állóképek) már le vannak töltve, tehát addig is helyesen
néz ki az oldal — csak a lejátszás nem indul el.

Ellenőrzés a pótlás után:

```bash
grep -ho 'data-video="[^"]*"' *.html | sed 's/data-video="//;s/"//' | sort -u | while read v; do [ -f "$v" ] || echo "HIANYZIK: $v"; done
```

### 3.2 Két GYIK-blokk

Két GYIK harmadik féltől származó widgetben volt, aminek a tartalma nem volt kinyerhető az oldal
forrásából:

- **`lezeres-szortelenites-budapest.html`** — „A leggyakoribb szőrtelenítés kérdések"
- **`oxigenterapia-budapest.html`** — „Oxigénterápia - Gyakori Kérdések"

Ezek a szekciók jelenleg **hiányoznak** ezekről az oldalakról. Ha megvan a szöveg, a
`src/partials/faq-masodik.html` mintájára készíthető belőlük partial, és `<!--include ...-->`-szal
beilleszthető.

Ugyanígy nem jött át a **Trustindex Google-vélemény widget** — a helyén a csillagos értékelés és a
véleményszám szerepel statikusan.

### 3.3 Két megszűnt útvonal

Az eredeti oldalon volt két foglalási aloldal, amik nem szerepeltek a bejárt oldalak között:
`/szortelenites-foglalas` és `/pmu-foglalas`. Ezek helyett a linkek most oda mutatnak, ahol
ugyanazok a Salonic-foglalások elérhetők:

| eredeti | most |
|---|---|
| `/szortelenites-foglalas` | `idpontfoglalas.html#szor` |
| `/pmu-foglalas` (VISSZAHÍVÁST KÉREK) | a Salonic ingyenes PMU-konzultáció foglalója |

**Nézd át, hogy ez így jó-e** — ha a két eredeti oldalon volt olyan tartalom vagy űrlap, amit meg
akarsz tartani, szólj, és elkészítem külön oldalként.

---

## 4. Az ajándékkártya-űrlapok

A `headspa-ajandekkartya.html` és a `4-kezes-headspa-ajandekkartya.html` oldalon az „előre utalásos"
megrendelő űrlap a Wix beépített űrlapkezelőjét használta. Ez **Netlify Forms** formátumban lett
újraépítve:

```html
<form class="gift-form" data-netlify="true" netlify-honeypot="bot-field" ...>
```

- **Netlify-n**: a beküldések a *Forms* fülön jelennek meg, e-mail-értesítés beállítható. Semmi
  továbbit nem kell tenni.
- **Máshol**: a `data-netlify` attribútum hatástalan, az űrlap nem küld sehova. Ilyenkor cseréld le
  Formspree-re (`action="https://formspree.io/f/AZONOSITO"`), vagy szólj, és átírom.

A Stripe-os „bankkártyás vásárlás" gombok változatlanul az eredeti Stripe-linkekre mutatnak, azok
minden tárhelyen működnek.

---

## 5. Ellenőrző parancsok

Hiányzó képek:

```bash
grep -ho 'assets/img/[a-zA-Z0-9_]*\.\(jpg\|jpeg\|png\)' *.html | sort -u | while read f; do [ -f "$f" ] || echo "HIANYZIK: $f"; done
```

Törött belső linkek:

```bash
grep -ho 'href="[a-z0-9-]*\.html[^"]*"' *.html | sed 's/href="//;s/"//;s/#.*//' | sort -u | while read f; do [ -f "$f" ] || echo "TOROTT: $f"; done
```

Mindkettő jelenleg tisztán fut le (a 3.1 pontban felsorolt videókon kívül).
