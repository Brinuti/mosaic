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
| képek | `assets/img/oxigen/` (kezelők, előtte/utána, kezelés-képek, Arc + Haj) és a Wix-képek `assets/img/c2eb0f_…` |
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

## Validálásra váró helyőrzők (`[szögletes zárójeles]`, `.helyorzo`)

- a három kezelő bemutatkozó szövege és szakmai háttere (a nevek és a fotók a Salonic szakember-oldaláról vannak);
- az **előtte/utána** képek jelenleg az Oxygeni Hair (a kezeléshez használt márka) régi oldalon is szereplő képei, „forrás: Oxygeni Hair” jelöléssel;
  saját vendég fotói, alkalomszámmal és hozzájárulással ide cserélendők;
- az időpont-módosítás pontos határideje a GYIK-ban.

## Nyitott pontok (döntés kell)

- **Időtartam:** a képernyőterv és a régi oldal „120 perc”; a Salonic jelenleg 80 percet mutat az első kezelésre (a 120 perces változat kikerült, lásd `docs/booking-engine/DECISIONS.md` 16.). A 120 három helyen szerepel (hero, ár-kártya, GYIK).
- **Arc + Haj:** a Salonic oxigén-fiókjában ma nincs ilyen szolgáltatás (csak 466147 / 466110 / 466158), ezért a gomb telefonos időpontkérésre (`tel:`) mutat.
- A régi oldal gombjai az `/idpontfoglalas` elosztóra vittek; az új oldalé közvetlenül a Salonicra (mint a HeadSpa-oldalaké).
