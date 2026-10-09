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

## 2026-10-08, kisebb finomítások
- Minden **FOGLALÁS gomb szövege fehér** (menü, mobil menü, lábléc, felugró), finom szövegárnyékkal az arany hátteren.
- Az **„i” kör** betűje SVG-rajz (nem betűtípus), ezért pontosan középen van magyar / angol, asztali / mobil oldalon is.
- A lábléc **jogi sora** (© Big in Japan Kft. · ÁSZF · Impresszum · Süti beállítások) telefonon egy sorban marad (`font-size: min(12.5px, 2.75vw)`).
- A fejléc **akciós sávja** (2026-10-09, a tulajdonos kérése): **csak a Head Spa oldalakon** látszik (főoldal, Head Spa Budapest, árlista, termékek, férfiaknak, vélemények, páros, angol oldal + a rejtett `-regi` másolataik; a lista: `HEADSPA_OLDALAK` a `tools/fejlec-menu.mjs`-ben), minden más oldalon rejtett (a build és a helyi tesztszerver az `<html>` elemre `data-mh-headspa` jelölőt tesz, a `fejlec-lablec.css` pedig `html:not([data-mh-headspa]) #comp-mpv0ganp { display: none }`). Színe újra az **eredeti rózsaszín** (`#ee05a3`, fehér felirat; korábban halvány zöld volt); a mobilos sáv ragyogása és a Wix rózsaszín árnyéka változatlan. Teszt: `tools/headspa-teszt/akciossav.test.mjs` (minden saját oldal, asztal + telefon).

## Az „i” (Infó) felugró ablak, a mobil fejléc és menü (2026-10-07, második kör)
- **Infó ablak**: a Wixes ablak helyett saját, az oldal stílusában (krém háttér, Playfair cím, arany részletek, jobbról úszik be; X / Esc / háttérre kattintás zár). HTML: `popupHtml()` a `tools/fejlec-menu.mjs`-ben (magyar + angol), CSS: `.mhp-*` az `assets/css/fejlec-lablec.css`-ben. Tartalom: elérhetőség, nyitvatartás (**hétfő–szombat 8:00–20:00**, vasárnap zárva), „Head Spa árak és időpontok” link, Időpontfoglalás + Ajándékkártya gomb. Mobilon a nyitvatartás és az árlista-link egy-egy sorba fér (`nowrap`; a teszt a valódi, 320 px-es Wixes mobil nézetet is méri).
- **Mobil fejléc**: nincs nyelvi gomb (a logó, az „i”, a Foglalás gomb és a hamburger fér el); az angol / magyar váltás a láblécben van.
- **Mobil menü**: az Ajándékkártya lenyíló alapból nyitva (3 kártya látszik), a többi lenyíló zárva indul (a kijelölt oldal szülője arany marad), a sorok 37 px-esek, így az egész menü kiférhet a képernyőre.
- **Nyitvatartás**: a szombat is 8:00–20:00 mindenhol (lábléc, Infó ablak, a Wixes oldalak Kapcsolat-szekciói, az új oldalak helyszín-blokkjai, tesztek). A fodrász (MOSAIC Hair) oldalak saját szövege („szombat zárva”) változatlan, mert azt a fodrász-szolgáltatás Salonic-adata adja.

## Angol oldalak (`<!--mh-nyelv:en-->`)
Ha egy saját oldal forrásában (a `<!--mh-fejlec-->` után) ott van a `<!--mh-nyelv:en-->` jelölő: angol menücímkék (Couples Head Spa, Laser hair removal, …), angol akciósáv, a GYIK pont elmarad (a magyar nyitóoldal GYIK-jára vinne), a Kapcsolat az oldal saját `#helyszin` szekciójára ugrik, a nyelvváltó „HU”, a lábléc angol. Az oldalnak tehát kell egy `id="helyszin"` szekció.

## Ha módosítani kell
- Új menüpont / átrendezés: `tools/fejlec-menu.mjs` (HTML) + `assets/css/fejlec-lablec.css`; a Wix-darabokat (`assets/fejlec/`) ne szerkeszd.
- A lábléc szövegei: `LABLEC_SZOVEG` a `tools/fejlec-menu.mjs`-ben (magyar + angol).
- Próba: `node tools/netlify-build.mjs` majd a `dist/` kiszolgálása (`tools/serve-dist.mjs`), vagy a könnyű teszt-szerver (`tools/headspa-teszt/`, csak a `foglalas/*.html` oldalakhoz).
- Tudott korlát: a Wixes asztali oldalak 980 px-nél keskenyebb ablakban vízszintesen görgetnek (a régi Wix-oldalaknál is így volt; a telefonok a mobil változatot kapják, az iPad viszont „asztali oldalt”).
