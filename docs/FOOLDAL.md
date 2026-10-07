# Új főoldal (`/fooldal-uj`)

A tulajdonos 2026-10-07-i látványterve alapján készült főoldal, a mostani landingek (Head Spa, lézer, oxigén) arculatában.
**Ideiglenes cím: `/fooldal-uj`** (noindex, nincs rá link, nincs a sitemapben). A mostani főoldal (`klon/index.html`, a Wixes klón) változatlanul él;
a csere a főoldal címére csak kifejezett kérésre történik (lásd lent).

## Fájlok

| Fájl | Mire való |
|---|---|
| `foglalas/fooldal-uj.html` | az oldal (egy fájl, a `<!--mh-fejlec-->` / `<!--mh-lablec-->` jelölőket a build tölti ki a közös fejléccel / lábléccel) |
| `assets/css/fooldal.css` | önálló stíluslap (más oldalt nem érint) |
| `assets/js/fooldal.js` | működés: videó-felugró, körhinta, hatás-fülek, Trustindex, térkép, CTA-mérés, mobil sticky CTA |
| `assets/img/fooldal/*.jpg` + `assets/img/m/fooldal/*.jpg` | a Drive „Renátó” fotózásaiból (kezelés + szalon), asztali és mobil méretben |
| `assets/video/fooldal-japan.mp4` + `assets/img/fooldal/japan-poszter.jpg` | „A MOSAIC Head Spa 1 percben” (Drive: *Mosaic japán alapján / Japán narráció+self-care*), 60 mp, 720×1280 |
| `tools/fooldal-teszt/fooldal.test.mjs` | böngészős tesztek (dist nélkül): `node --test tools/fooldal-teszt/fooldal.test.mjs` |

## Szerkezet

A látványterv részei (a kép tetejétől): hero, bizalmi sáv, **Mit tehetünk érted?** (5 kártya), **Melyik HeadSpa élmény illik hozzád?**, **Inkább élményt ajándékoznál?**.
Utána a mostani főoldal tartalma, szebb elrendezésben és a valódi fotókkal: vendégvideók, Google-vélemények (Trustindex), „Mit kapsz egy 50 perces szeánszon?”
(a 9 pontos lista szó szerint), a kezelés elemei (8 fekvő videó) + „Nézd, mekkora élmény!” (10 álló klip), az alapító szövege (okosgyűrű-videó), páros sáv, fejbőr + hatások
(zsíros / száraz / hajhullás fülek), OXYGENI termékek, gyógymasszőrök + szárítás, a szalon galériája, záró idézet, GYIK (mind a 18 kérdés), helyszín.

**Eltérések a látványtervtől (szándékosak):**

- *Színek, gombok:* a MOSAIC arculata (arany foglalás-gomb, sötétzöld, krém, Playfair + Jost), nem a mockup barna-piros gombjai; a közös fejléc / lábléc marad (nem a mockup egyszerűsített fejléce).
- *Élmény-kártyák:* **3 kártya** (Egyéni / Páros / 4 kezes), nem 4: a „Relax” és a „Hair” ma egyetlen szolgáltatás (a foglaló egy kártyára vonja össze, az árlista is egyetlen „Head Spa kezelést” mutat, a hajkamerás vizsgálat kérésre). A férfiaknak szóló oldalra a kártyák alatt sor mutat.
- *Árak* az árlistáról: egyéni 32 900 → 26 900, páros 65 900 → 53 800 / 2 fő, 4 kezes 49 900 → 39 900 (20% októberi kedvezmény). A hero „26 900 Ft-tól”. Az akció lejárta után a „Most 20% kedvezménnyel” jelvény és az árak frissítendők.
- *Értékelések:* „4,9 Google” + a Trustindex-widget **aktuális** értékelés-száma (a HTML-ben tartalék: 1 257); a mockup „1000+”-ja helyett a valódi szám.
- *Hajkamerás vizsgálat:* a régi szöveg „a Hair csomag része” helyett „kérésedre” (a két csomag egyesítése óta; mint az árlistán).
- *Ajándék-kép:* a mockup fényképezett borítéka helyett a valódi ajándékkártya-minták (3 darab, legyezőben); fényképezett boríték nincs a Drive-on.

## Médiaforrások (a Drive-ról; a szalon saját anyaga)

- **Renátó első fotózás** (Drive: *MOSAIC Head spa / Mosaic fotózások / Renátó első fotózás*): a szalon belső terei és részletei → `szalon-*.jpg`, `termekek.jpg`, `logo-fal.jpg`.
- **Renátó második fotózás**: kezelés és hajszárítás → `hero.jpg`, `profil.jpg`, `fej-labda.jpg`, `arcmassza.jpg`, `kezelo.jpg`, `gozfej.jpg`, `mosas.jpg`, `szaritas-*.jpg`, `ablak-iv.jpg`, `arc-portre.jpg`.
- A fotókat a Drive miniatűr-szolgáltatásából a kívánt méretben (`=s1500` stb.) töltöttem le; az eredeti 6–22 MB-os fájlok nem kerültek a repóba.
- A vendég- és kezelés-videók a meglévő `assets/video/` fájlok (a régi főoldal 28 videója + a 8 `ajandek-vendeg-*`). Az oldal egyetlen `<video>`-t sem tölt be kattintás előtt (poszter + lejátszás-gomb, a fájl csak a felugróban).

## Mérés

**Mérést érint: csak előkészítés.** A CTA-k `data-cta` attribútuma `fooldal_cta` eseményt (`{event:'fooldal_cta', cta:'<név>'}`), a videók `fooldal_video` eseményt küldenek a `dataLayer`-be (mint a páros / lézer landingeken). A GTM-ben ehhez **nincs trigger**, a Meta-pixel / suti.js lista nem módosult; a `-uj` oldalon pixel nem fut. A foglalás-gombok `/foglalo-motor?business=headspa…` linkek: a launcher és a motor mérése (`booking_*`) változatlan.

## Csere a főoldal címére (csak kifejezett kérésre)

1. `git mv foglalas/fooldal-uj.html foglalas/index.html` – a build a `foglalas/` fájljait a klón fölé másolja, és az `index.html`-ből lesz a nyitóoldal (`fooldal.html`).
2. Az oldalban: `canonical` és `og:url` → `https://www.mosaicheadspa.hu/`, a `noindex` meta törlése, a hero-kép `og:image` marad.
3. A régi (Wixes) főoldal rejtett címen megmarad: `klon/index.html` → `klon/fooldal-regi.html` és `klon/m/index.html` → `klon/m/fooldal-regi.html` (noindex + saját canonical, mint a Head Spa oldalak `-regi` változata).
4. `netlify/lib/utvonal.js` `ATIRANYITASOK`: `'/fooldal-uj': '/'`.
5. `tools/lcp-elofeltoltes.json`: a nyitóoldal (`index`) sora az új hero-képre (`/assets/img/fooldal/hero.jpg`) vagy törlendő (az oldal maga előtölti).
6. Az `-uj` teszt `OLDAL` állandója és a cím-teszt frissítendő; élesben: főoldal 200, `-regi` 200, `-uj` 301, GTM-trigger-ellenőrzés (a főoldal Wix-azonosítós gombjaira épülő triggerek!), pixel-próba a csere előtt / után.
7. Visszaállítás: a `foglalas/index.html` törlése (a klón főoldala újra előjön), az `-uj` átirányítás törlése.
