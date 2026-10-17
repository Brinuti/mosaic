# Medical Piercing – gyorsítás minden oldalon + a feliratos ábrák egészben – teszt-napló (2026-10-17)

## A tulajdonos kérései
1. „csinálj egy gyorsítást az oldalon. Menj végig az összes oldalon … de tesztelj, semmilyen hiba ne keletkezzen”; „ne csak a fő oldalt nézd meg, hanem … az összes oldalt …
   futtass le egy Google … Speed Testet”.
2. „ezek a képek látszódjanak teljesen … le van vágva” (allergia, máj, pajzsmirigy, lép, vastagbél piercing oldala; asztalon és mobilon).

## Mérés (módszer)
A Google PageSpeed Insights szolgáltatás kulcs nélküli napi kerete elfogyott (429), ezért a motorját, a Lighthouse 12.8-at futtattam ugyanazokkal az alapbeállításokkal
(mobil: Moto G Power, lassú 4G szimuláció; asztali preset), mind a **157 nyilvános oldalra** (a sitemap + a 19 rejtett B-oldal), mobilon és asztalon: 314 mérés.
Nem az éles domainen: az „előtte” a `medicalpiercing.pages.dev` (az élessel azonos tartalom), az „utána” a PR előnézete / a merge utáni `medicalpiercing.pages.dev`. Ott a mérőkódok
nem töltődnek be (a `suti.js` csak a www.medicalpiercing.hu-n), és a GTM / GA / Meta / TikTok / Clarity / Convertize címek blokkolva: a mérés a statisztikába nem került be.

## Előtte (157 oldal)
| | Pontszám (átlag) | LCP | TBT | CLS | Letöltött adat | 90 pont alatt |
|---|---|---|---|---|---|---|
| Mobil | 96,6 | 2,32 s | 26 ms | 0,005 | 556 KB | 16 oldal (főleg blogcikkek: 75–89; a főoldal 80) |
| Asztali | 99,8 | 0,53 s | 1 ms | 0,001 | 621 KB | 0 |

A Lighthouse javaslatai (oldalak száma): túl nagy képek (156 oldal, mobilon átlag ~306 KB, asztalon ~369 KB fölösleg), tömörítetlen JS (157) és CSS (156), fel nem használt CSS (144),
megjelenítést blokkoló fájlok (157), modern képformátum (29), a Google-vélemények szkriptje (Trustindex: a főoldalon ~0,85 s főszál-blokkolás, ~650 KB), a blogcikkekben a szöveg
(a legnagyobb elem) 3–8 s-ot várt egy 2560 px-es, 1,4 MB-os első képre.

## Mi változott
- Google-vélemények: a Trustindex `loader.js` csak a doboz közelében töltődik (`reszek/velemenyek.html` `data-ti-src`, `uj-fooldal.js` 4.).
- Galériák: az előtöltés csak a képernyő közelében és a lap betöltése után (`uj-oldalak.js` 1., `uj-fooldal.js` 2b.) – korábban minden galéria 9 nagy képet töltött azonnal.
- Válaszadó képek: 406 kép 320–1600 px-es WebP-változata (`tools/kep-valtozatok.py`), a megjelenési méretek lapanként mérve (`tools/kep-meretek.mjs`, 398 lap, 7544 kép), a build
  `srcset` + `sizes`-t ír (`tools/valaszado-kepek.mjs`); a képnagyító az eredeti képet nyitja.
- Tömörítés (esbuild): a saját CSS/JS 323 kB → 251 kB; a mérőkód fájljai (`suti.js`, `mp-meres.js`, `motor-indito.js`, `salonic-adapter.js`, `booking-id.js`) **változatlanok**.
- Betű: a `latin-ext` (ő, ű) is előtöltve; borítós videó `preload="none"`; a blog első három kártyaképe nem lusta.
- Feliratos ábrák: a pont-helye ábrák (5 oldal), a fülpontos és címkés fotók, a 93%-kép, a városnév-csempék egészben (`uj-oldalak/teljes-kepek.json`, `data-teljes`): 258 lapon 540 kép.

## Mérés – MÉRÉST ÉRINT?
A mérőkód fájljai nem változtak, a mérési események útja ugyanaz (a `meres-teszt` 85 ellenőrzése rendben). A Trustindex nem mérőkód (véleménydoboz). Új esemény, konverzió nincs.

## Eredmények
### Mintamérés (16 oldal, a PR előnézetén, a változtatások után)
A minta: főoldal, a 9 piercing-típus oldalából 4, akció, árlista, csapatunk, vélemények, blog, 3 blogcikk (köztük a leglassabbak).

| | Pontszám | LCP | Letöltött adat |
|---|---|---|---|
| Mobil | 91,2 → **99,1** | 3,04 s → **1,89 s** | 1068 KB → **497 KB** |
| Asztali | 99,6 → **99,8** | 0,64 s → **0,54 s** | 1243 KB → **486 KB** |

Kiemelve (mobil): főoldal 80 → **100** (TBT 651 ms → 0, 1338 KB → 445 KB), menstruációs cikk 75 → **99**, mi-az-a-migrén 78 → **100**, csapatunk 94 → **100**, vélemények 94 → **100**.
A Piercer mester Brigitta lap mobilon 657 KB-ot töltött a hős videója miatt (`preload="metadata"`): a build `videoElotoltes` lépése a 4 borítós videót `preload="none"`-ra teszi
(megnyitáskor 0 videókérés, lejátszásra indul a letöltés – Playwrighttal ellenőrizve).

### Feliratos ábrák
Minden új lapon (asztali 1440 / 820 px, mobil 390 px) a listás képek 100%-a látszik (a kép teljes területe a dobozon belül); a régi Wix-lapok közül egy cikkben volt vágás, azt a `klon.css`
szabálya rendezi. Szemrevételezve: allergia, máj, pajzsmirigy, lép, vastagbél piercing oldala asztalon és mobilon, a 93%-kép, a fülpontos ábrák, a városcsempék.

### Tesztek a végső buildre
- `uj-oldalak-teszt`: 174 oldal, 5729 ellenőrzés, 0 hiba
- `uj-b-teszt`: 19 B-oldal, 1042 ellenőrzés, 0 hiba
- `uj-fooldal-teszt`: 102 ellenőrzés, 0 hiba
- `meres-teszt`: 85 ellenőrzés, 0 hiba (a mérési események útja változatlan)
- korábban, ugyanerre a JS-re: `motor-tipus` asztali 120 / mobil 124 ellenőrzés, minden rendben, `motor` 26/26, `motor-formazas` 90, `csomag` 12, `forras` 1224 – rendben

### Teljes utómérés (157 oldal)
A merge után a `medicalpiercing.pages.dev`-en, ugyanazzal a módszerrel – az eredményt ide írom.
