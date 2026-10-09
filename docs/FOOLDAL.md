# Új főoldal (`/`)

A tulajdonos 2026-10-07-i látványterve alapján készült főoldal, a mostani landingek (Head Spa, lézer, oxigén) arculatában.
**ÉLES a főoldal címén (2026-10-07).** A tulajdonos szabálya: most csak azok az oldalak cserélődnek, ahol a tartalomhoz nem nyúlunk, csak a megjelenés új; a főoldal régi tartalma teljes egészében megmaradt.
A régi (Wixes) főoldal rejtett címen él: `/fooldal-regi` (noindex, saját canonical); az `-uj` cím 301-gyel a főoldalra visz. Visszaállítás: lásd lent.

## Fájlok

| Fájl | Mire való |
|---|---|
| `foglalas/index.html` | az oldal (egy fájl, a `<!--mh-fejlec-->` / `<!--mh-lablec-->` jelölőket a build tölti ki a közös fejléccel / lábléccel) |
| `assets/css/fooldal.css` | önálló stíluslap (más oldalt nem érint) |
| `assets/js/fooldal.js` | működés: videó-felugró (kártyák), körhinta, hatás-fülek, csukott blokkok + GYIK mobilon, Trustindex, térkép, CTA-mérés, mobil sticky CTA (a hero: közös `video-hero.css` / `video-hero.js`) |
| `assets/img/fooldal/*.jpg` + `assets/img/m/fooldal/*.jpg` | a Drive „Renátó” fotózásaiból (kezelés + szalon), asztali és mobil méretben |
| `assets/video/fooldal-japan.mp4` + `assets/img/fooldal/japan-poszter.jpg` | „A MOSAIC Head Spa 1 percben” (Drive: *Mosaic japán alapján / Japán narráció+self-care*), 60 mp, 720×1280 |
| `tools/fooldal-teszt/fooldal.test.mjs` | böngészős tesztek (dist nélkül): `node --test tools/fooldal-teszt/fooldal.test.mjs` |

## Szerkezet

**2026-10-09, a tulajdonos kérésére:**
- **Hero = a közös videós hero** (`assets/css/video-hero.css` + `assets/js/video-hero.js`, `docs/VIDEOS_HERO.md`; mintája a `/head-spa-kedvezmeny` hero): asztalon a videó a hero háttere (jobbra tolt, balról sötétzöldbe olvadó; a forrás a régi főoldal 720×720-as klipje), telefonon felül a videó (300 px), sötétzöldbe olvadva, utána a szöveg. A „Hangot rá!” kapcsoló helyett **play gomb** nyitja a hangos videót nagy ablakban (`c2eb0f_909ce495…`, 0:09). Ikonos jelvények („50+30 perc”, „Profi hajszárítás”, „Személyre szabott”) és a Google-sor (4,9 / 5 Google · 1 257+ vendégvélemény, a #velemenyek-re görget) mint a kedvezmény oldalon; a tartalom (cím, 20% kedvezmény, ár-sor, két CTA, `data-cta`-k) változatlan. A hero és a bizalmi sáv között **hely marad a „Írtak rólunk” logó-sávnak** (HTML-komment jelzi; a tulajdonos illeszti be).
- **A főoldali „Páros Head Spa a MOSAIC-ban!” blokk kikerült** (`#paros`, a fotóhátteres sáv); a főmenü „Páros Head Spa” pontja, az élmény-kártya „Mindent a páros HeadSpa-ról” linkje és a `/paros-headspa-budapest` oldal maradt.
- **Rövidebb mobil nézet** (a cél kb. a felére): 18 345 → ~9 800 px (390 px széles képernyőn). Eszközök (csak telefonon, a tartalom asztalon megmarad): kisebb térközök; oldalra görgethető (scroll-snap) sorok a szolgáltatás- és élmény-kártyáknak, a szalon-képeknek; kisebb / kevesebb kép (ajándékkártya: egy kártya; fejbőr: egy kép; OXYGENI és logó-falas kép rejtve); csukott blokkok (`details.mobil-csukott`: a fejbőr-részletek, a „A rendszeres Head Spa hatásai”, a gyógymasszőr- és szárítás-szekció folytatása – asztalon nyitva, a feliratot a CSS rejti); GYIK: az első 6 kérdés látszik + „További kérdések (12)” gomb (a 18 kérdés mind a HTML-ben van: a `/gyik` generátor ugyanúgy olvassa); rejtett telefonon (`.csak-nagy`): a „Nézd, mekkora élmény!” (10 álló klip), az ismétlődő „Szabad időpontok” gombok a véleményeknél és a „Mit kapsz” alatt (a sticky sáv megvan). Asztalon a szekciók kicsit sűrűbbek (80 → 64 px térköz), a teljes oldal ~13 400 → ~12 500 px.

**2026-10-08, a tulajdonos kérésére:** a hero a régi főoldal videóját mutatja („Hangot rá!” gombbal; `c2eb0f_909ce495…`, 720×720, hanggal), a „Budapest, Kolosy tér” felirat és a „Már van ajándékkártyám → Beváltom” sor kikerült;
a hero és az élmény-kártyák árai kisebbek; a „Mit tehetünk érted?” címe „Mire van szükséged?”, mind az 5 kártya egyforma méretű, 1:1 képpel (sminktetoválás: `pmu/gyogyult-szoke.jpg`, nem vízjeles);
mindenhol „50 + 30 perces” (a „80 perces” helyett is); kikerült: „A Head Spa annyira ellazított…” (alapító), „A legszebb önmagad adjuk neked ajándékba.” (záró idézet), az ajándékkártya alatti „Már kaptál ajándékkártyát?”, a „Mit kapsz” alatti 4 képes sor.

**2026-10-08, 2. kör (a tulajdonos kérésére):** a H1 „Budapest kedvenc Head Spa-ja” (alatta, kisebben: „50 perc kezelés + 30 perc profi hajszárítás”); telefonon a cím **egy sorban, a teljes szélességben** (`container-type: inline-size` + `calc(100cqw / var(--h1-arany))`, az arány a betű szélességi aránya, 13,0–13,4), asztalon törhet. A „Most 20% kedvezménnyel” sima szöveg (csillag, gomb-forma nélkül); a hero „50 perc HeadSpa + 30 perc hajszárítás” sora kikerült; a bizalmi sáv elemei: Google / **270 négyzetméteren várunk rád** / Tapasztalt gyógymasszőrök / SZÉP Kártya. A hero teteje kisebb térközű (`.hero-tart` min-height nélkül). Betűméretek a sminktetoválás asztali alapjára igazítva (H1 47 px / 1,06 / −0,02em, lead 21 px / 1,4). **Színek:** a meleg krém helyett a sminktetoválás zöldes MOSAIC-tónusa (`--krem #f3f4ef`, `--krem2 #eceee7`, `--bezs #e2e5db`, `--bezs2 #d6dacc`, `--zsalya #e6ebe7`), a fejléc akciós sávja is (`#e6ebe7`); az arany kiemelések maradtak.

A látványterv részei (a kép tetejétől): hero, bizalmi sáv, **Mit tehetünk érted?** (5 kártya), **Melyik HeadSpa élmény illik hozzád?**, **Inkább élményt ajándékoznál?**.
Utána a mostani főoldal tartalma, szebb elrendezésben és a valódi fotókkal: vendégvideók, Google-vélemények (Trustindex), „Mit kapsz egy 50 + 30 perces szeánszon?”
(rövidített lista; a cím a videó tetejével, a gomb a videó aljával egy vonalban), a kezelés elemei (8 fekvő videó) + „Nézd, mekkora élmény!” (10 álló klip), páros sáv, fejbőr + hatások
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

## A csere megtörtént (2026-10-07) - és a visszaállítás

Ami történt: `git mv foglalas/fooldal-uj.html foglalas/index.html` (a build a `foglalas/` fájljait a klón fölé másolja, az `index.html`-ből lesz a nyitóoldal);
`canonical` / `og:url` a főoldalra, a `noindex` törölve; a régi Wixes főoldal `klon/fooldal-regi.html` + `klon/m/fooldal-regi.html` néven (noindex, saját canonical), az eredeti
`klon/index.html` + `klon/m/index.html` megmaradt; `netlify/lib/utvonal.js`: `'/fooldal-uj': '/'`; `tools/lcp-elofeltoltes.json`: a régi `fooldal` sorok törölve (az oldal maga előtölti a hero-képet);
a `/gyik` generátor (`tools/gyik-oldal.mjs`) forrása `foglalas/index.html`.

Mérés: a GTM éles verziójában (53) egyetlen trigger sem a főoldal Wix-azonosítós gombjaira vagy a `/` útvonalra épül (csak egyedi események, köszönőoldalak, Salonic-gazdagépek, `booking_*`),
a Meta-pixel útvonal-listáján az `index` szerepel (a nyitóoldal ugyanúgy kapja, mint eddig). A főoldal saját eseményei: `fooldal_cta`, `fooldal_video` (dataLayer, nincs GTM-trigger).

**Visszaállítás:** a `foglalas/index.html` törlése (a klón főoldala újra előjön), az `-uj` átirányítás törlése az `utvonal.js`-ből, a `fooldal` sorok visszaírása az LCP-táblába (régi értékek: git előzmény).
