# Közös fejléc, menü és lábléc (megújítva 2026-10-07)

A fejléc és a lábléc **minden oldalon ugyanaz** (a ~115 Wixes oldalon és a saját oldalakon is), egy helyről szabályozva:

| Mi | Hol |
|---|---|
| Az átalakítások (HTML) | `tools/fejlec-menu.mjs` – a build (`tools/netlify-build.mjs`) és a helyi teszt-szerver (`tools/headspa-teszt/szerver.mjs`) hívja |
| A megjelenés (CSS) | `assets/css/fejlec-lablec.css` (a build a Wixes oldalak beágyazott `klon.css`-e mögé, a saját oldalaknál a fejléc-darab mögé teszi) |
| A Wixről mentett eredeti darabok | `assets/fejlec/*.html` (a `tools/fejlec-kivonat.mjs` generálja – **ne kézzel szerkeszd**; az átalakítás ezek fölött fut) |
| Tesztek | `tools/headspa-teszt/fejlec.test.mjs`, `tools/ajandek-teszt/menu.test.mjs` |

Az átalakítások **ismételhetetlen-biztosak** (az átalakított fejlécen nem csinálnak semmit), és csak a `<header id="SITE_HEADER">` elemen belül dolgoznak, így az oldal törzsét nem érintik.

## Mi változott
- **Páros Head Spa önálló főmenüpont** (a „Head Spa” után, asztalon és mobilon is); a Head Spa legördülőből kikerült (7 elem maradt). A kijelölt oldal jelölése átkerül az új pontra.
- **EN jelvény** az angol zászló helyett: arany körvonalas pirula (földgömb + „EN”, mobilon csak „EN”); az angol oldalakon „HU” (vissza a magyarra). Az „i” (infó) szintén arany körvonalas kör.
- **Asztali menü**: 72 px magas sáv, a tartalom legfeljebb 1240 px széles (a Wix 980 px-e helyett), Jost betű, finom arany aláhúzás ráhúzásra / a kijelölt oldalnál, kis nyíl a legördülőknél, a **FOGLALÁS arany gomb**, a legördülő lekerekített kártya (egy oszlop). 1080 px alatt kisebb betű, hogy a 10 pont elférjen.
- **Mobil menü** (hamburger): balra igazított sorok, Jost betű, finom vonalak, kijelölt = arany, FOGLALÁS = arany gomb.
- **Lábléc**: sötétzöld, arany hajszálvonal; 4 oszlop (márka + időpontfoglalás gomb, Head Spa, szolgáltatások, elérhetőség + nyitvatartás), alul a jogi sor (© Big in Japan Kft. · ÁSZF · Impresszum · Süti beállítások) és a nyelvváltó. Keskenyebben 2 oszlop, telefonon 1–2.
- A lábléc **„Süti beállítások” linkje mindenhol működik** (a saját oldalak lábléc-darabjában korábban beégetett link halott volt; `assets/js/suti.js` `lableclink()` most a meglévő linkre is köti a kattintást).

## Angol oldalak (`<!--mh-nyelv:en-->`)
Ha egy saját oldal forrásában (a `<!--mh-fejlec-->` után) ott van a `<!--mh-nyelv:en-->` jelölő: angol menücímkék (Couples Head Spa, Laser hair removal, …), angol akciósáv, a GYIK pont elmarad (a magyar nyitóoldal GYIK-jára vinne), a Kapcsolat az oldal saját `#helyszin` szekciójára ugrik, a nyelvváltó „HU”, a lábléc angol. Az oldalnak tehát kell egy `id="helyszin"` szekció.

## Ha módosítani kell
- Új menüpont / átrendezés: `tools/fejlec-menu.mjs` (HTML) + `assets/css/fejlec-lablec.css`; a Wix-darabokat (`assets/fejlec/`) ne szerkeszd.
- A lábléc szövegei: `LABLEC_SZOVEG` a `tools/fejlec-menu.mjs`-ben (magyar + angol).
- Próba: `node tools/netlify-build.mjs` majd a `dist/` kiszolgálása (`tools/serve-dist.mjs`), vagy a könnyű teszt-szerver (`tools/headspa-teszt/`, csak a `foglalas/*.html` oldalakhoz).
- Tudott korlát: a Wixes asztali oldalak 980 px-nél keskenyebb ablakban vízszintesen görgetnek (a régi Wix-oldalaknál is így volt; a telefonok a mobil változatot kapják, az iPad viszont „asztali oldalt”).
