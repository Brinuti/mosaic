# Széles kijelzős oldalellenőrzés (2026-10-16)

**Kiváltó eset:** a főoldal ajándékkártya-szekciójában (`#ajandek`) az „Anyukádnak / Párodnak / Barátnődnek” kártyák 1920 px felett összecsúsztak
(1920 px-en a kártya 98 px, 2560 px-en 30 px széles volt, a címek egymásra csúsztak).

## Ok és javítás

`assets/css/fooldal.css`: `.ajandek-szoveg { padding: 64px max(32px, calc((100vw - 1200px) / 2)) 64px 40px }`. A jobb oldali padding a nézet
szélességével nőtt (1920 px-en 360 px, 2560 px-en 680 px), a rács (`.ajandek-racs`) viszont 1360 px-nél megáll, így a szöveg-oszlop
tartalma 1920 px-en ~320 px-re, 2560 px-en 0-ra szűkült. Javítás: a jobb padding legfeljebb 120 px
(`clamp(32px, calc((100vw - 1200px) / 2), 120px)`), vagyis 1440 px felett minden szélességen az 1440 px-es kép.

Regressziós teszt: `tools/fooldal-teszt/fooldal.test.mjs` (1440 / 1920 / 2560 / 3440 px: a kártyák ≥150 px, nincs kilógás, nincs átfedés, a szöveg-oszlop ≥700 px).
A régi CSS-sel a teszt 1920 / 2560 / 3440 px-en elbukik (98 / 30 / 30 px), a javítottal mind a 4 szélesség átmegy.

## Az eszköz

`tools/szeles-teszt/szeles-ellenorzes.mjs`: a `dist/_a` minden asztali oldalát (103 db, a `-regi`, teszt és belső oldalak nélkül) végigméri 1440 px (alap),
1920, 2560 és 3440 px-en, és ezeket keresi: szöveg a szöveggel átfedésben, szöveg kilóg a saját dobozából, a szélesedéssel összeszűkülő oszlop,
szétfutott szövegsor, nyújtott / felnagyított / törött kép, a nézetből kilógó elem, vízszintes görgetés, a szekciók tartalmának egyik oldalra csúszása.
A szűrők: csak képernyőolvasónak szánt (sr-only) és a tárolójából kivágott (carousel, line-clamp) szöveg nem számít; az aszimmetria és a felnagyítás
csak akkor hiba, ha a szélesedéssel romlik az 1440 px-es alaphoz képest.

```
node tools/netlify-build.mjs && node tools/szeles-teszt/szeles-ellenorzes.mjs [--szelesseg=1920,2560,3440] [--oldal=fooldal,arlista] [--kep=mappa] [--ki=eredmeny.json]
```

Az eszköz ellenőrzése: a régi (hibás) CSS-sel a főoldalon megtalálja az átfedést, a kilógó szöveget és az összeszűkülő kártyákat; a javítottal ezek eltűnnek.

## Eredmény (103 oldal × 3 széles nézet)

| Kategória | Eredmény |
|---|---|
| Szöveg a szöveggel átfedésben | **0** (a javítás után; az első futás 7 oldalt jelzett, mind téves riasztás: képernyőolvasós címkék, kivágott carousel-szöveg, nagy számjegyek sordoboza – kézzel ellenőrizve) |
| Szöveg kilóg a dobozából | **0** |
| Összeszűkülő / keskeny oszlop | **0** |
| Vízszintes görgetés, a nézetből kilógó elem | **0** |
| Törött kép | **0** |

## Nem szétcsúszás, de megfigyelés (nem javítva)

- **Felnagyított, lágy képek széles kijelzőn.** A hero-képek természetes szélessége 720 px (főoldal / páros hero-poszter: `c2eb0f_909ce…f001.jpg`, `paros/hero-barat.jpg`; ajándék-hero: `ajandek/hero-*.jpg`),
  ezeket 2560 px-en 2,4–3,4× nagyításban mutatja. A főoldalon és a páros oldalon ez csak a poszter (amíg a videó el nem indul), az ajándék-landingeken ez a hero-kép maga.
  Megoldás: 1600–2000 px széles változatok a forrásképből (a repóban a hero-képekből nem találtam nagyobb változatot).
- **Két ikon 7,5%-kal lapított** a szőrtelenítés-oldalakon (104×104 megjelenítés, 200×185 eredeti: `c2eb0f_93549c…png`, `c2eb0f_a37ff0…png`); szélességtől független.
- **Hosszú szövegsor:** `headspa-budapest-hungary`, `p.ar-jegyzet` 1200 px széles, 206 karakter (a tartalomoszlop szélessége, nem a nézeté).
- **Keskeny, középre igazított tartalom** a Wixről átvett oldalakon (köszönő-oldalak, árlista-fejléc stb.) 3440 px-en: a tartalom a nézet 14–18%-a, de középen áll; ez a Wix-oldalak tervezett viselkedése.
- **Hero eltolás:** a videós hero (`vh-eltolt`) szövege az 1200 px-es tartalomoszlopban áll, a háttér-videó a jobb szélig ér (tervezett).
