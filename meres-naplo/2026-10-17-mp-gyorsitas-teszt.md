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
EREDMENYEK
