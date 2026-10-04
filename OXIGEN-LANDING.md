# Oxigénterápia landing (`/oxigenterapia-budapest`)

Az oldal a tulajdonos képernyőterve szerint készült (hero → jelek → állapotfelmérés → kezelők → első alkalom → kezelés lépései
→ eredmények → videó → két belépési lehetőség → miért más → Arc + Haj és GYIK → záró CTA). A PMU-landing (`/sminktetovalas-budapest`)
mintájára a Wixről mentett régi oldal **helyére** kerül ugyanazon a címen (a `foglalas/` mappa fájlja felülírja a `klon/` azonos nevű oldalát),
ezért a Meta-pixel (Fodrász-pixel, `suti.js` `PIXEL_OLDALAK`) és a GTM útvonal-szabályai változatlanul érvényesek.

## Fájlok

| Mit | Hol |
|---|---|
| oldal (szöveg, szerkezet) | `foglalas/oxigenterapia-budapest.html` |
| stílus | `assets/css/oxigen-landing.css` (betűk, színek: ugyanaz, mint a PMU-landingé) |
| működés (kezelők / eredmények lapozó, videó, Google-értékelés, CTA-mérés) | `assets/js/oxigen-landing.js` |
| képek | `assets/img/oxigen/` (kezelők, előtte/utána, kezelés-képek, szalon, Arc + Haj) és a Wix-képek `assets/img/c2eb0f_…` |
| a „hajkamera-nézet” rajz | `assets/img/oxigen/hajkamera-illusztracio.svg` (`node tools/oxigen-hajkamera-svg.mjs`) — rajz, nem vendégfotó, „Illusztráció” felirattal |

A fejlécet és a láblécet a build szúrja be (`<!--mh-fejlec-->`, `<!--mh-lablec-->`), mint a többi saját oldalon.

## Foglalás

A gombok a Salonic oxigén-fiókjára mutatnak (ugyanazok a linkek, mint az `/idpontfoglalas`-on): hajkamera `serviceId=466147` (4 990 Ft),
első kezelés `466110` (29 900 Ft), 2. alkalomtól `466158` (26 000 Ft). A build központi link-térképe (`tools/foglalo-atkotes.mjs`, kapcsolók:
`tools/foglalo-atkotes.json`) a `466110` / `466158` linkeket a közös foglalóra köti át, ha az `oxigen` kapcsoló be van kapcsolva
(előnézeten be van). A `466147` (hajkamera) **nincs a térképen**, az mindenhol natív Salonic-link marad, amíg fel nem vesszük.

Az oldalon belül **nincs `#horgony`-link**: a GTM History Change triggere minden hash-változásra mérést indítana, ezért a „görgess ide”
gombok (`data-gorgetes`) JS-ből görgetnek. A CTA-kattintások `oxigen_landing_cta` (`data-cta` érték) és `oxigen_landing_video` dataLayer-eseményt
küldenek (a PMU-landing `pmu_landing_*` mintájára; ezekre GTM-címke nem figyel).

## Hero-galéria

A hero jobb oldalán **valós előtte/utána fotók galériája** van (nem statikus kép): egy dia = egy `<figure class="hg-dia">` a HTML-ben; a pontokat, a nyilakat és a 6 másodperces automatikus lapozást (amíg a látogató bele nem nyúl; csökkentett mozgásnál nincs) az `oxigen-landing.js` adja. Az oldal **csak a hajhullásra** épül (a többi panaszra külön landing készül). A galériában az Oxygeni Hair 5 hajhullás-referenciája van (`assets/img/oxigen/hajhullas-1..5.jpg`), a felirat: „Gyengébb panaszok esetén 3–5 alkalom, súlyosabb panaszok esetén 5–10 alkalom.” Az „Az Oxygeni vendégeinek valós javulásai” sor **más** képeket mutat (`hajhullas-6..8.jpg`). A repóban összesen 8 hajhullás előtte/utána kép van (a régi Wix-oldal Oxygeni-sorozata); a tulajdonos által kiválasztott további fotók (akár 10 a galériába) ide veendők.

## Alcímek, gombok

Az oldalon nincsenek a címek fölötti kis (sárga) alcímek. Az arany pill-gomb (a többi oldal aranygombja: `linear-gradient(#c6a346, #d9c164)`, fehér felirat) a foglalás-gombok színe; **a hajkamerás állapotfelmérés gombjai fehérek** (`gomb-feher`), a záró sötét sávban körvonalas (`gomb-kontur`, nem teli). A SZÉP Kártya elfogadása a hero-ban, az árak alatt, a szalon-szakaszban és a GYIK-ban is szerepel.

## Validálásra váró helyőrzők (`[szögletes zárójeles]`, `.helyorzo`)

- a három kezelő rövid bemutatkozója **általános szöveg** (oxigénterápiás képzés, gyakorlott kezelő, a kezelés menete; személyes adat nélkül, mert nincs forrásunk): a valódi szakmai háttér a tulajdonostól kérendő; a nevek és a fotók a Salonic szakember-oldaláról vannak;
- az előtte/utána képek az Oxygeni Hair márka referenciái; a „kétmillió elvégzett kezelésből 95%-nál pozitív változás” és a „3–5 / 5–10 alkalom” a tulajdonos megadott szövege;
- az időpont-módosítás pontos határideje a GYIK-ban.

## Nyitott pontok (döntés kell)

- **Időtartam:** a képernyőterv és a régi oldal „120 perc”; a Salonic jelenleg 80 percet mutat az első kezelésre (a 120 perces változat kikerült, lásd `docs/booking-engine/DECISIONS.md` 16.). A 120 három helyen szerepel (hero, ár-kártya, GYIK).
- **Arc + Haj:** a Salonic oxigén-fiókjában ma nincs ilyen szolgáltatás (csak 466147 / 466110 / 466158), ezért a gomb telefonos időpontkérésre (`tel:`) mutat.
- A régi oldal gombjai az `/idpontfoglalas` elosztóra vittek; az új oldalé közvetlenül a Salonicra (mint a HeadSpa-oldalaké).
