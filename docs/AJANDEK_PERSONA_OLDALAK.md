# Ajándékkártya persona-oldalak (hero-videó + magyarázó szekció)

2026-10-09, a tulajdonos kérése: az ajándékkártya-oldalak **mind az új formátumot** kapják (videós hero felül, alatta magyarázó szekció, alatta az ajándékválasztó), a hero-videó
és a szövegek az adott **personához** igazodnak. Egyetlen master landing van (`foglalas/ajandek.html` + `assets/js/ajandek.js` + `assets/js/ajandek-adat.js`, részletek: `AJANDEK.md`);
a persona-oldal csak a felső „sales-állapotot” cseréli: **variáns** = hero (H1, alcím, gomb, videó), magyarázó szekció, előválasztott élmény, termék-sorrend. A vásárlási folyamat
(Stripe), a GYIK, a vélemények, a mérés mindenhol közös.

## Melyik cím melyik variánst adja

A cím dönti el az alapértelmezett variánst (`ajandek-adat.js` `OLDAL_ALAPERTEK`); az URL-paraméterek (`?variant=`, `?occasion=`, `?fbclid=`, `?utm_*`) mindig működnek, a `?variant=` felülírja a címet.

| URL (mosaicheadspa.hu) | variáns (`variant_id`) | hero-videó (`assets/video/`) | H1 |
|---|---|---|---|
| `/ajandekkartya-szulinapra` | `birthday` (alkalom: születésnap) | `ajandek-hero-szulinap.mp4` | A legszebb szülinapi ajándék: 80 perc, ami csak az ünnepeltről szól. |
| `/japan-headspa-ajandekkartya` | `japan` | `ajandek-hero-japan.mp4` | Ajándékozz egy szelet japán nyugalmat. |
| `/headspa-ajandekkartya-anyukaknak` | `mother` | `ajandek-hero-30-anya.mp4` (a korábbi „Anya-lánya”, marad) | Adj anyukádnak egy kis időt, amit végre csak magára fordíthat. |
| `/headspa-ajándékkártya-ezo` (`/headspa-aj%C3%A1nd%C3%A9kk%C3%A1rtya-ezo`) | `esoteric` | `ajandek-hero-ezo.mp4` | Ajándékozz belső egyensúlyt: egy lassú, csendes Head Spa rituálét. |
| `/headspa-ajandekkartya-noknek` | `for_her` | `ajandek-hero-noknek.mp4` | Adj neki 80 percet, amikor végre semmiről nem kell gondoskodnia. |
| `/headspa-self-care` | `self_care` | `ajandek-hero-selfcare.mp4` | Ajándékozz egy kis self-care-t, mert megérdemli. |
| `/headspa-paros-csajos-ajandekkartya` | `friend` | `ajandek-hero-baratnok-negyzet.mp4` (marad) | A tökéletes csajos nap ezzel a programmal kezdődik. |
| `/headspa-ajandakkartya-fiataloknak` | `young` | `ajandek-hero-fiatalok.mp4` | Ajándékozz egy szünetet a zajból, amitől a haj is tökéletes lesz. |
| `/ajandek?variant=partner` (nincs saját címe) | `partner` | `ajandek-hero-30-partner.mp4` | Egy felejthetetlen randi, ahol mindketten ellazultok. |
| `/ajandek?variant=last_minute` (nincs saját címe) | `last_minute` | `ajandek-hero-30-utolso-pillanat.mp4` | Ajándékot keresel az utolsó pillanatban? |

A `/headspa-ajandekkartya` (fő oldal), a `/4-kezes-headspa-ajandekkartya` és az `/ajandekkartya-ugc` a `general` variánst adja, **rajtuk nincs magyarázó szekció** (ott rögtön az ajándékválasztó jön).
A mother / friend / for_her / partner / last_minute variáns H1-ét, alcímét és gombfeliratát a persona szavaihoz igazítottuk (a friend szövege változatlan: ez volt a mintaoldal).

## Magyarázó szekció (a hero után, az ajándékválasztó előtt)

Asztalon két oszlop: **balra a kép** (a keret magassága a szövegoszlopot követi), **jobbra** a persona szövege (felirat, cím, 2–3 rövid bekezdés, legfeljebb 3 pipás pont); a hero videója jobbra van, így a kettő felváltva áll (2026-10-09, 2. kör, a tulajdonos kérése). A csere csak CSS (`ajandek.css`: `.ah-magyarazo-media { order: -1 }` 900 px-től, az oszlopok aránya `1fr / 1.05fr`); a DOM-ban a szöveg áll elöl, ezért mobilon marad az egymás alatti sorrend: szöveg, majd kép (ez volt eddig is).
A tartalom **adatvezérelt**: `ajandek-adat.js` → `VARIANTOK[<variáns>].magyarazo` = `{ felcim, cim, szovegek: [..], pontok: [..], media: { src, alt, w, h, poz, forras } }`; a sablon (`foglalas/ajandek.html`
`#ah-magyarazo`), a render (`ajandek.js` `magyarazoRender`) és a stílus (`ajandek.css`, „PERSONA-MAGYARAZO”) közös. A `magyarazo: null` (general) esetén a szekció rejtett.

A persona-oldalakon a **build előre ki is tölti** a hero-szöveget, a hero-képet és a szekciót a HTML-ben (`tools/ajandek-variansok/elore-render.mjs`, hívja a `tools/netlify-build.mjs`): nem az általános oldal villan fel a JS lefutásáig, és a
kereső is a persona szövegét látja. A JS ugyanazt írja be ugyanabból az adatból, a kettő nem kúszik szét (a tesztek védik). A hero-felirat (eyebrow) a mostani dizajnban rejtett (minden variánsnál).

Szabályok (a tesztek ellenőrzik): csak valódi MOSAIC-asset (kép / videó), **kitalált vendégvélemény, idézet, szám, ígéret nincs** (számként csak a termék tényei szerepelnek: 80 = 50 + 30 perc, 6 hónapig felhasználható), nincs „azonnal”,
„perceken belül”, „még ma”; a `last_minute` a kézbesítési időre nem tesz állítást. Az egészségügyi / gyógyító állítások (a régi oldalak „gyógyító energiák”, „energetikai megtisztulás” szövege) **nem** kerültek át.

### A magyarázó képek eredete (2. kör, 2026-10-09)

A magyarázó szekció képe soha nem lehet ugyanaz, mint a hero-poszter (a teszt ellenőrzi: más fájl, más tartalom). Három oldal új képet kapott, mind a MOSAIC saját, már meglévő felvételeinek egy-egy kockájából (a Drive-ról, megosztási linken át
töltve; a forrás-videók **nincsenek** a repóban, csak a kivágott állóképek), a beégetett felirat / ár / logó nélküli sávra vágva, JPEG ~1000 px széles, 76–144 KB:

| oldal (variáns) | kép (`assets/img/ajandek/`) | forrás | kocka |
|---|---|---|---|
| csajos nap (`friend`) | `magyarazo-csajos-ketto.jpg` | Drive: „páros csajos érzelmes.mp4” (1080 × 1920, hirdetési videó) | 17,5. mp: két nő fürdőlepedőben, karöltve, nevetve a MOSAIC folyosóján (a hero-videóban a pezsgőző jelenet és a páros ágyak vannak, ez más jelenet) |
| anyukáknak (`mother`) | `magyarazo-anya-lanya.jpg` | Drive: „Anya-lánya.MP4” (eredeti, 1080 × 1920; a hero ugyanennek a felvételnek a 71,5–79,5. mp-éből készült) | 75,5. mp: a lány beszél, az anya mosolyog, egymás mellett ülnek; nyitott szemű, éles kocka, a hero-poszter másik kockája |
| self-care (`self_care`) | `magyarazo-selfcare-pihenes.jpg` | Drive: „Self care headspa+ajikártya.mp4” (1080 × 1920) | 5,2. mp: csukott szemmel, nyugodtan pihenő arc az arany zuhanyív alatt (a régi, hajkamerás / fejbőrvizsgálatos kép lecserélve) |

A többi oldal (fiataloknak, nőknek, belső egyensúly, japán, szülinap) képe nem változott, csak a bal-jobb sorrend. Újragyártás: `tools/ajandek-variansok/magyarazo-kepek.py` (a forrás-videókat előbb le kell tölteni a Drive-ról egy mappába, a fájlnevek a szkriptben).
A régi, lecserélt képek (`magyarazo-csajos.jpg`, `magyarazo-anya.jpg`, `magyarazo-selfcare.jpg`) törölve; az új fájlnevek miatt a böngésző nem a régi, gyorsítótárazott képet mutatja.

## A hero-videók: honnan, hogyan

Mind **a MOSAIC meglévő, már publikált felvételeiből** készült (nincs idegen anyag, nincs felirat / ár / hirdetés-szöveg): 720 × 720 (1:1), 24 fps, **hang nélkül**, H.264 (High, yuv420p), faststart, 0,7–1,1 MB, ismétlődő
(a hurok varratát elfedi egy átúsztatás). A poszterkép (`assets/img/ajandek/hero-<kulcs>.jpg`) az LCP-kép és a „csendes mozgás” nézet; a build ezt tölti elő (`tools/lcp-elofeltoltes.json`, a variánsok saját poszterével).

| videó | mit látni (és honnan) | illeszkedés |
|---|---|---|
| `…-szulinap` | a MOSAIC ajándékkártya-boríték fotója (arany oroszlánfej-szobor előtt), majd gyertyafényes kezelés (galéria: „Fejmasszázs eszközökkel”, „Rózsakvarc fejbőrfésű”) | jó (a boríték maga az ajándék); születésnap-specifikus felvétel nincs a repóban |
| `…-japan` | a hajmosó-ív fotója (`galeria-06`), az arany ív hátulról (galéria: „Körvízsugaras vízterápia”), színes ív (`ajandek-headspa.mp4` = „szöveg nélkül.mp4”) | jó (a körvízsugaras ív a japán Head Spa jelképe); japán-specifikus környezet (pl. kert, tea) nincs |
| `…-ezo` | halk fényű kezelőszoba apró fényekkel, a kezelő „ráhangolódása”, fénygyűrű (`ajandek-headspa.mp4`, „Körvízsugaras vízterápia”) | közepes (a hangulat jó, de „ezoterikus” felvétel nincs) |
| `…-noknek` | nyugodtan pihenő nő az arany ív alatt (profi fotó `hero.jpg`), arc- és nyakmasszázs (`ajandek-headspa.mp4`) | jó |
| `…-selfcare` | arcpakolás, dekoltázs- és nyakmasszázs (galéria-klipek: „Személyre kikevert arcpakolás”, „Dekoltázs masszázs”, „Nyakmasszázs”) | jó |
| `…-fiatalok` | hajmosás és fejmasszázs („reset”), majd a kész, hullámos haj („glow up”; `ajandek-headspa.mp4`) | közepes (fiatalokra utaló felvétel nincs; a „glow up” a hajformázásból jön) |
| `…-30-anya`, `…-baratnok-negyzet`, `…-30-partner`, `…-30-utolso-pillanat` | változatlanok (korábbi kör) | — |

**Újragyártás / új videó:** `tools/ajandek-variansok/hero-videok.py` (a `HEROK` szótárban: forrás, kezdet–vég, kivágás-közép). `pip install av` (PyAV: beépített ffmpeg, H.264 + libx264; ffmpeg nem kell),
`python3 -I tools/ajandek-variansok/hero-videok.py [kulcs]`; az eredmény (`assets/video/ajandek-hero-<kulcs>.mp4` + `assets/img/ajandek/hero-<kulcs>.jpg`) be van commitolva, a build nem futtatja.

**Mit érdemes később lecserélni** (a tulajdonos a Drive-ban lévő valódi anyagokra): a **születésnap** videót (Drive: „szülinapi egyéni érzelmes (cinematic).mp4”, „szülinapi ajándék glória.mp4”, „szülinapi kör.mp4”,
„szülinapi fekete.mp4”, „Csajos szülinap – Evelin hook.mp4” – hirdetés-anyagok, feliratosak lehetnek, előbb meg kell nézni), a **japán** videót (Drive: „Japán narráció+self-care.mp4”, „Japán narráció+beauty.mp4”, „HEADSPA-japán hosszú.mp4” –
beégetett magyar felirattal; a főoldali `fooldal-japan.mp4` ugyanaz), az **ezo** és a **fiatalok** videót (nincs a Drive-ban jelölt anyag; ha készül, az lenne az igazi). A Drive → repó átvitel a Zapier-csővel (`tools/email-kepek/README.md`) képekre való
(≤ 600 KB / fájl): a videót (≤ 4 MB, H.264 / yuv420p, 1:1 vagy 3:2, hang és felirat nélkül) kézzel kell az `assets/video/` alá tenni, majd a `ajandek-adat.js` variáns `hero_media.video.src` / `src` (poszter) mezőit átírni.

## A három korábbi hirdetési oldal (ezo, self-care, fiataloknak)

Korábban régi tartalmú, újrastílusozott (Stripe nélküli, `klon.js` űrlapos) oldalak voltak (`foglalas/<név>.html`, generátor: `tools/ajandek-variansok/gen.mjs`). Mostantól ezeken a címeken is **az új master landing** fut
(Stripe-os vásárlás, a tulajdonos kérésére). A régi oldal két helyen marad meg: a **rejtett `/<név>-regi`** cím (a Wixes eredeti, `klon/<név>-regi.html`, `noindex, nofollow`, nincs link rá, nincs a sitemapben; a build készíti a `klon/<név>.html`-ből)
és az **archívum** (`tools/ajandek-variansok/archiv/<név>.html`: az újrastílusozott változat, nincs az élő útvonalon, a `gen.mjs` ide ír). A 3 cím **noindex marad** (mint a régi, `NOINDEX_AJANDEK_CIMEK` a buildben; a sitemapben sosem voltak); a többi persona-cím a
korábbi döntés szerint indexelhető, saját canonical-lal. Visszaállás a régire: a név kivétele a `REGI_AJANDEK_CIMEK`-ből és az `OLDAL_ALAPERTEK`-ből, az archív fájl visszamásolása a `foglalas/` alá.

## Mérés

A `variant_id`, `gift_context`, `relationship`, `occasion` (+ `utm_*`, `gclid`, `fbclid`, `ttclid`) minden dataLayer-eseményben és a rendelés (PaymentIntent) metadata-jában ott van, mint eddig; a `variant_id` a szervernél csak ismert érték lehet
(ismeretlen → `general`), az új értékek automatikusan ismertek. A `suti.js` pixel-listája már tartalmazta a három régi hirdetési címet (a Meta-pixel ugyanúgy fut; a `-regi` példányokon nem), a mérőkódok csak az éles domainen futnak (változatlan).
**Változás a mérésben:** a `/ajandekkartya-szulinapra` és a `/japan-headspa-ajandekkartya` eddig `variant_id: general`-t küldött, mostantól `birthday` / `japan`; az `ezo`, `self-care`, `fiataloknak` címek eddig a régi, Stripe nélküli folyamatot (régi űrlap-lead) futtatták, mostantól az új `view_item` → `purchase` sorozatot.

| `variant_id` | `gift_context` | `relationship` | `occasion` |
|---|---|---|---|
| `birthday` | birthday | – | szuletesnap |
| `japan` | japan | – | – |
| `esoteric` | esoteric | – | – |
| `self_care` | self_care | – | – |
| `young` | young | recipient_young | – |

## Új persona-oldal felvétele

1. `ajandek-adat.js`: új `VARIANTOK.<kulcs>` (hero_title / subtitle / cta, `hero_media` {poszter `src`, `video.src`, `alt`, `forras`, `status`}, `gift_finder_preselect`, `product_order`, `magyarazo`, `gift_context`) és `OLDAL_ALAPERTEK['/<cím>']`.
2. Videó + poszter: `tools/ajandek-variansok/hero-videok.py` (`HEROK`), a magyarázó kép: valódi MOSAIC-fotó (≤ 260 KB) az `assets/img/ajandek/` alatt.
3. `tools/netlify-build.mjs`: a cím a `REGI_AJANDEK_CIMEK` listába (és a `NOINDEX_AJANDEK_CIMEK`-be, ha noindex kell); `tools/lcp-elofeltoltes.json` (asztali + mobil): a variáns posztere; `tools/ajandek-teszt/szerver.mjs` `REGI_CIMEK`; ha a cím a Wixről átvett, a `klon/<cím>.html` és `klon/m/<cím>.html` megmarad; `suti.js` pixel-lista, ha kell.
4. Tesztek: `node --test "tools/ajandek-teszt/*.test.mjs" "tools/ujrastilus-teszt/ajandek-variansok.test.mjs"` (a böngészős `persona-oldalak.test.mjs`-hez: `PLAYWRIGHT_UTVONAL`, `CHROME_UTVONAL`); a `PERSONAK` lista kibővítése.

## Tesztek

- `tools/ajandek-teszt/ajandek.test.mjs`: variánsok (mezők, szövegszabályok, számok, videók H.264 / hang nélkül / méret, magyarázó adat, build előre-render, cím → variáns, build / LCP / szerver egyezése).
- `tools/ajandek-teszt/persona-oldalak.test.mjs` (Playwright, mind a 8 cím): H1 / alcím / gomb, poszter, videós hero (elem + forrás + fájl), magyarázó szekció (bal kép, jobb szöveg, sorrend, mobilon egymás alatt: szöveg, majd kép; a kép nem azonos a hero-poszterrel), előválasztás, mérés (`view_item`, `fbclid`),
  nincs vízszintes túlcsordulás 390 / 768 / 1440 px-en, nincs konzolhiba / 404. A H.264-et **valóban lejátszó** teszt (persona-onként) csak H.264-tudó böngészőben fut; a Playwright-Chromium nem tud H.264-et, ott „skip” (régóta ismert, nem hiba).
- `tools/ujrastilus-teszt/ajandek-variansok.test.mjs`: a három korábbi oldal átállása (nincs az élő útvonalon, rejtett `-regi`, noindex, sitemap, mérés, LCP).
