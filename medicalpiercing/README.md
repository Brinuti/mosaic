# Medical Piercing – Wix nélküli, pixelpontos klón

A `www.medicalpiercing.hu` Wix-oldal mása: sima HTML + CSS + JS, a Cloudflare Pages-en fut.
Futás közben egyetlen kérést sem küld a Wix szervereire. A MOSAIC-klón (`../klon/`,
`../tools/wix2static.mjs`) módszerével készült, de annál egy lépéssel tovább megy:

- **Az oldalt úgy menti le, ahogy a böngészőben kirajzolódik**, a Wix JS-e után (`tools/elo-mentes.mjs`).
  Így a futás közben töltött dolgok (ismétlők elrendezése, galériák, diavetítések összes diája,
  véleménydobozok, videók, térkép) is benne vannak.
- **Saját betűfájlok** a Wix fizetős betűi (Helvetica, DIN Next, Avenir, Proxima Nova, Futura) helyett
  (`tools/betu-epites.py`). A rajzolat szabad licencű betűből jön (Arimo, Hanken Grotesk, Sarabun,
  Jost), de minden betű szélessége, a betűpárok alágása és a sormagasság az eredetiével azonos.
  Ezért a sorok pontosan ugyanott törnek.

**Mérés (2026-10-10, `tools/elteres.mjs`):** az élő Wix-oldal minden `comp-` eleme helyben és méretben
egyezik a klónnal (0 eltérő elem) a nem blogos oldalakon asztalin (1440 px) és a vizsgált mobil oldalakon
is; az oldalak teljes magassága pixelre azonos. A blogbejegyzéseknél a klón a *betöltött* állapotot
mutatja (számlálók, hozzászólások, „Friss bejegyzések” képei); az élő oldal ezeket görgetés után tölti
be, ezért a mérés pillanatától függően ott még rövidebb lehet. A blog listájában mind a 77 bejegyzés
szerepel (élőben görgetésre töltődnek be). Nyitóoldali diavetítésnél a mérés pillanatában más dia
látszhat (időfüggő).

```
medicalpiercing/
  klon/<kulcs>.html, klon/m/<kulcs>.html   az átalakított asztali és mobil lapok (146 oldal + 404)
  assets/img, video, fonts, embed, popup   képek, videók, betűk, HTML-beágyazások, felugró menü
  assets/js/klon.js                        a Wix JS helyett: menü, diavetítés, galéria, fülek, videó, űrlap
  assets/js/suti.js                        saját süti-sáv (Consent Mode v2) + a Wix „Egyéni kód”-ja: GTM, Google Ads, Convertize
  lib/utvonal.js                           a Wix-szel azonos címek, asztali/mobil a böngésző szerint
  functions/[[path]].js                    Cloudflare: címek kiszolgálása + űrlap → e-mail
  tools/                                   mentés, átalakítás, build, tesztek (a nyers mentések nincsenek a repóban)
```

## 1. Frissítés a Wix-oldalról

A Wix-oldal változása után a teljes lánc (Node 20+, Python 3, ffmpeg; Python-csomagok:
`python3 -m pip install fonttools brotli pillow`):

```bash
cd medicalpiercing
node tools/oldalak.mjs --frissit     # oldallista a Wix sitemapjeiből (a korábbi rejtett oldalak maradnak)
node tools/mentes.mjs --friss        # szerveroldali HTML, asztali + mobil  -> tools/raw*/
node tools/oldalak.mjs --bejaras     # linkelt, de sitemapben nem szereplő (rejtett) oldalak; utána újra mentes.mjs
node tools/oldalak.mjs --utvonalak   # a Wix útvonaltáblájának többi élő oldala (linkeletlen akciós és köszönőoldalak); utána újra mentes.mjs
node tools/elo-mentes.mjs --ujra             # a kirajzolt oldal, asztali  -> tools/elo-dom/asztali/
node tools/elo-mentes.mjs --mobil --ujra     # ugyanez mobilon (kb. 50-50 perc)
node tools/popup-mentes.mjs          # a felugró menü (Wix lightbox)       -> assets/popup/
node tools/beagyazasok.mjs           # a Wix HTML-beágyazásai              -> assets/embed/
node tools/media.mjs                 # képek és videók eredetiben          -> tools/eredeti-*/ (--hianyzo: csak ami az assets/-ból hiányzik)
python3 tools/kepek-kicsinyites.py   # képek a megjelenített méretre       -> assets/img/
python3 tools/webp.py                # a képek WebP-változata (fele akkora) -> assets/img/*.webp
node tools/videok.mjs                # videók 720p-re (max. 24 MB)         -> assets/video/
python3 tools/betu-epites.py         # saját betűk + assets/css/wix-fonts.css (csak ha a Wix betűi változtak)
node tools/wix2static.mjs && node tools/wix2static.mjs --mobil   # -> klon/, klon/m/
node tools/videok-mentes.mjs && node tools/videok-potlas.mjs     # a Wix csak görgetéskor kitöltött YouTube-/Facebook-videói -> tools/wix-videok.json, klon/
node tools/orszagok-mentes.mjs       # a /kontroll országkód-választója     -> assets/data/orszagok.json, assets/img/flag-*
node tools/varos-lapozo-mentes.mjs   # a városoldalak lapozójának céljai     -> assets/data/varos-lapozo.json
node tools/build.mjs                 # -> dist/
node tools/serve.mjs & node tools/hajtas-meres.mjs   # az első képernyő képei és betűi oldalanként -> tools/hajtas.json;
node tools/build.mjs                 # utána újra build (tools/gyorsitas.mjs ebből dolgozik)
```

Egyetlen oldal: `node tools/elo-mentes.mjs rolunk && node tools/wix2static.mjs rolunk` (mobilon `--mobil`).

### Az átalakító (`tools/wix2static.mjs`)

Forrás: a kirajzolt oldal (`tools/elo-dom/`). Néhány oldalt (17, főleg a városoldalak) a Wix a böngészőben
újrarajzol, és a stílust ilyenkor külső CSS-fájlokból adja: ezeknél a kirajzolt tartalom mellé a szerveroldali
mentés beágyazott stílusai és a külső Wix-CSS helyi másolata (`assets/css/wix/`) kerül. Ha a kirajzolt mentés
hiányzik, a szerveroldali mentés (`tools/raw/`) a forrás. A 404-es lap mindig a szerveroldali mentésből készül.

1. kiveszi a Wix összes scriptjét és a Wix „Egyéni kód” blokkjait (ezeket a `suti.js` adja vissza),
   valamint a futás közben beszúrt mérő-kereteket;
2. törli a Wix CDN-re mutató `@font-face` szabályokat (a saját betűk lépnek a helyükre);
3. a képeket (`static.wixstatic.com`) `assets/img/`-re, a videókat `assets/video/`-ra, a HTML-beágyazásokat
   `assets/embed/`-re írja át;
4. a Google-térképet (a Wix saját Google-kulcsával futott) a Google beágyazott térképére cseréli,
   ugyanarra a helyszínre;
5. a belső linkeket a domain nélküli, Wix-szel azonos címre írja (`canonical` és `og:url` marad);
6. beteszi a felugró menüt `<template>`-ként, a saját CSS-t, a `suti.js`-t és a `klon.js`-t.

### Címek

Minden oldal a Wix-szel azonos címen él (pl. `/varosok/bekescsaba`, `/fejfájás-elleni-piercing-…`).
A fájlnév ékezet és írásjel nélküli „kulcs” (`lib/utvonal.js` → `kulcsbol()`), a kezdőlapé `fooldal`.
Ugyanazon a címen a telefon a mobil, minden más az asztali lapot kapja (`dist/_m/`, `dist/_a/`), ahogy a Wix is a
böngésző azonosítója alapján döntött. A blogbejegyzések a `/post/…` előtaggal is elérhetők. Nem létező
címre a Wix 404-es lapja jön, 404-es státusszal.

## 2. Ellenőrzés

```bash
node tools/build.mjs && node tools/serve.mjs   # http://localhost:4290/  (mobil próba: ?nezet=mobil)
node tools/elteres.mjs rolunk index blog       # elemenkénti összevetés az élő oldallal
node tools/elteres.mjs --mobil rolunk          # ugyanez mobilon
node tools/osszevet.mjs rolunk                 # képernyőképek egymás mellett -> tools/osszevetes/
node tools/funkcio-teszt.mjs                   # menü, fülek, galéria, diavetítés, JS-hibák (asztali + mobil)
node tools/bejaras-teszt.mjs                   # MINDEN oldal asztalin és mobilon: betöltés, JS-hiba, hiányzó fájl,
                                               # menü a képernyőn, minden gomb, minden belső link célja, foglalási linkek
node tools/kitelepulesek-teszt.mjs             # a kitelepülés-táblázat olvasója (hálózat nélkül)
node tools/klon-regresszio.mjs                 # két klón-build összevetése képkockánként (pl. átalakítás előtt / után)
node tools/wix-osszevetes.mjs [--mobil] [kulcs...]  # MINDEN oldal a Wix mellett: minden link/gomb célja, stílusa
                                               # nyugalomban és rámutatáskor, képernyőképek, kattintások
                                               # -> tools/osszevetes/<nézet>/eredmeny.json + képek
```

Az élő Wix-oldalt megnyitó eszközök (`elo-mentes`, `elteres`, `osszevet`, `wix-osszevetes`) alatt egyetlen mérőkérés sem
mehet ki (`tools/meres-tiltas.mjs`): a köszönőoldalak megnyitása különben hamis foglalást küldene.

### Sebesség (`tools/gyorsitas.mjs`, `tools/sebesseg.mjs`)

A Wix a képek egyharmadát azonnal és elsőbbséggel kérte, és minden beágyazást (YouTube, térkép, Facebook,
Trustindex) a lap megnyitásakor töltött be. A build ezért:

- minden `<iframe>`-et `loading="lazy"`-re állít (csak a képernyő közelébe görgetve töltődik);
- a képeknél a `tools/hajtas.json` szerint dönt: az első képernyő képei azonnal, a 2–3 legnagyobb
  elsőbbséggel, a többi lustán (`loading="lazy"`, `decoding="async"`);
- az első képernyő szövegének betűit a `<head>` elején előre kéri (`<link rel="preload">`). Így a fejléc
  nem rándul 8 px-et, amikor a tartalékbetűről átvált; a CLS asztalin 0,117 helyett 0;
- a képeket WebP-ben adja (`tools/webp.py`, 85-ös minőség, mint a Wixen), ahol az legalább 10%-kal kisebb.
  A megosztási kép és az ikonok eredetiek maradnak;
- a magától induló háttérvideókat (Wix-videódoboz, 5–8 MB) nem tölti le a lap megnyitásakor
  (`preload="none"`): a `klon.js` akkor indítja őket, amikor a képernyő közelébe érnek;
- a három kis saját stíluslapot (`wix-google-fonts.css`, `wix-fonts.css`, `klon.css`, együtt ~5 kB tömörítve)
  a lapba ágyazza, ugyanazon a helyen: nem kell rájuk várni a megjelenítés előtt;
- minden CSS- és JS-hivatkozást tartalomjellel lát el (`?v=`), így ezek egy évig gyorsítótárazhatók (`_headers`).

A felugró menü a tulajdonos kérésére animáció nélkül, azonnal nyílik és zárul. Mérés:
`node tools/sebesseg.mjs [út...]` (TTFB, FCP, LCP, CLS, TBT, letöltött bájtok; mobilon 4× CPU-lassítás és lassú 4G).
Az éles címen (`CIM=https://www.medicalpiercing.hu`) minden adatküldő kérést eldob.

### Foglalómotor (`assets/js/motor/`, `assets/js/motor-indito.js`)

A MOSAIC-foglalómotor MP-adaptációja (Drive: MP-FOGLALOMOTOR-FELADAT.md, MP-FOGLALOMOTOR-PROBAFOGLALASOK.md). A foglalási linkek
(`medicalpiercing.salonic.hu`, `/idopontfoglalas`, `/kontroll`) helyben nyíló foglalót nyitnak, az oldal címe nem változik. A `/idopontfoglalas` és a `/kontroll` cím a főoldal tartalmát adja, a motor ráugrik, bezárva a főoldal marad (a régi köztes oldalak tartaléka: `/regi-idopontfoglalas`, `/regi-kontroll`). A fő oldala a
„Mire szeretnél időpontot foglalni?” (Új piercing / Kontroll / Ékszercsere / Garancia). Az **új piercing** lépései:
1. szolgáltatás (a fő oldal, akárhonnan kattint; csak a konkrét kontroll / ékszercsere / garancia link visz egyből az űrlapra);
2. helyszín (15);
3. piercing (két kérdéssel szűrve: Kinek? Magamnak / Két személynek, és Milyen szolgáltatás? 1 piercing / Több piercing / Fülbevaló; a „legjobban megéri” a Több piercing);
4. időpont (havi naptár, szakemberválasztó);
5. a Salonic beágyazott adatlapja;
6. köszönőoldal.

A **kontroll / ékszercsere / garancia** nem naptáras: a beépített visszahívás-kérő űrlap (a régi `/kontroll` űrlapja, `POST /api/urlap`,
`form-name` = `kontroll-visszahivas`), majd a `/kontroll-ok` → `/kontroll-xyz` köszönőoldal.

- **Kapcsoló:** `motor-kapcsolo.json` (`"arany": 0` = mindenki a régi Salonic-foglalót kapja, `100` = a motor nyílik). A build
  beírja az indítóba, és minden kattintásnál érvényes. Visszaállítás:
  - `0`, merge, deploy (1–2 perc);
  - azonnal: a Cloudflare Pages előző kiadására.

  A HTML nem gyorsítótárazott, így minden új oldalbetöltés az új állást kapja. Próba: `?motor=1` / `?motor=0` a lap címében, az adott munkamenetre (sessionStorage `mp_motor`).
- **Salonic:** csak olvasó GET a böngészőből (`salonic-adapter.js`; a Salonic és a naptár-API is engedi a CORS-t). A
  szolgáltatás-ID, az ár és a szakember a Salonicból jön, `lang=hu`-val. A foglalást a Salonic adatlapja rögzíti. **Az adatlap
  megnyitása a Salonicban 5 percre lefoglalja az időpontot**: a próbák a legtávolabbi nap legkésőbbi időpontját válasszák, és a
  helyi tesztek az adatlap kérését eldobják.
- **Köszönőoldal:** a Salonic szolgáltatásonként irányít:
  - a gyógypiercingeknél a `/foglalas-ok*` oldalra;
  - a divat fülpiercingnél (1/2/3 db) a `/fulbevalo-ok`, `/fulbevalo-ok2`, `/fulbevalo-ok3` oldalra;
  - mindig a csupasz `medicalpiercing.hu`-ra, ami 301-gyel paraméterestül a www-re visz.

  Átadás:
  - A keretben futó `suti.js` jelez a motornak. Ha a motor visszaigazolja (1,5 mp), a keretben nem mér.
  - A motor ugyanazt a köszönőoldalt ugyanazokkal a paraméterekkel, plusz `booking_id`-vel (`mb_…`, a Salonicnál `back` paraméterként is) a fő ablakban nyitja meg.
  - Ugyanannak a foglalásnak a köszönőoldala egy böngészőben csak egyszer tölti a mérőkódokat (frissítés, visszalépés, újranyitás: nem; localStorage `mp_koszono`, 30 nap).
  - A régi, közvetlenül beágyazott Salonic-naptáraknál (pl. `/migren-piercing-uj`) a keretben mér, mint eddig.
- **Mérés:** a foglalásindítás (TikTok `InitiateCheckout` + GA4 `foglalas_inditasa`, `piercing_tipus`: rövid kód) a `suti.js`-ben,
  a motor döntése előtt fut. A motor betöltési hibája GA4 `motor_hiba` eseményként megy, a vendég pedig a régi utat kapja.
- **Mobil: az adatlap egy képernyőn, görgetés nélkül** (a Mozaik mintájára). Három rész:
  1. A mobil lapok (Wix-minta) 320 px-es nézetszélességgel épülnek. Amíg a motor nyitva van, a motor `width=device-width`-re vált, bezáráskor visszaállítja; így valódi telefonméreten jelenik meg.
  2. Az adatlap lépésnél mobilon a lépésjelző, az összegző és a súgó rejtve; a fejléc „<helyszín> · Adatok”; a keret a képernyő aljáig ér.
  3. A Salonic-oldal tömör megjelenése: `assets/salonic/mp.css` (a Mozaik `salonic/mosaic.css`-ének MP-változata, csak az adatlapra).

  Bekapcsolás (a tulajdonos egy lépése): app.salonic.hu > Beállítások > Online bejelentkezés megjelenés > „Egyedi CSS URL” = `https://www.medicalpiercing.hu/assets/salonic/mp.css`.
  - A motor a Salonic-oldalból felismeri (`adapter.getPresentation`), és asztalon is elrejti a dupla összegzőt.
  - Mérve: Pixel 5, iPhone 12, iPhone SE 3, Galaxy S9+ és asztali gép is: a „Foglalás elküldése” gomb görgetés nélkül látszik.
  - Nélküle az adatlap a Salonic alapkinézete, és a kereten belül görget.
- **15 helyszín leképezése:** `node tools/mp-salonic-lekepezes.mjs` → `tools/mp-salonic-lekepezes.json` (szolgáltatások,
  munkatársak, szabad időpontok, eltérések).
- **Próbák:**
  - `node tools/motor-teszt.mjs [--mobil]`: helyben, valódi foglalás nélkül. Ellenőrzi:
    - kapcsoló, 15 helyszín, magyar kezelések, naptár, adatlapcím;
    - a köszönőoldal átadása `booking_id`-vel (`/foglalas-ok*` és `/fulbevalo-ok`);
    - mérés: a keretben nincs; a GA4-esemény egyszer; frissítéskor nincs újabb;
    - a `?motor=0` felülírás és a régi beágyazás;
    - mobil elrendezés, nézetszélesség.
  - `node tools/motor-helyszin-teszt.mjs [--csak 6029,12169] [--mobil|--asztali]`: mind a 15 helyszín, asztalon és mobilon. Ellenőrzi:
    - a kezelések és árak egyezését a leképezéssel;
    - a szabad időpontot, vagy a „nincs szabad időpont” üzenetet;
    - a szakembert, az adatlapcímet, az elrendezést.

    Az adatlap kérését eldobja. `BASE=`-szel előnézeten vagy élesben is fut.
  - `tools/motor-proba/` (távoli próbák, kimenet: `tools/motor-proba/kimenet/`, nincs a gitben):
    - `motor-fust.mjs`: füstpróba előnézeten vagy élesben; a Salonic-adatlapot betölti.
    - `adatlap-meres.mjs [--stilus] [--eszkoz "iPhone 12"|asztali]`: elfér-e az adatlap; `--stilus` = mintha a Salonic-fiókban be lenne állítva az MP-stíluslap.
    - `proba-futtat.sh` (`probafoglalas.mjs` + `lemond.mjs`): VALÓDI próbafoglalás élesben, `?motor=1`-gyel, „TESZT – Claude” néven, a legtávolabbi időpontra. A mérőkérések eldobva, a `/api/mp-foglalas` csak naplózva. Utána azonnali lemondás a Salonic lemondó oldalán. `PROBA_EMAIL` kell (a visszaigazoló levél címe).

### Takarítás (`tools/takaritas.mjs`)

A build a lapokból kiveszi a Wixtől örökölt, semmire nem használt kódot: a Wix-szerkesztő meta-címkéit
(generator, X-Wix-*, etag, skype_toolbar), a Wix belső keresőjére mutató strukturált adatot (a klónban
nincs `/search`), azokat a Wix-adatattribútumokat, amelyekre se a lapok CSS-e, se a `klon.js` / `suti.js`
nem hivatkozik, és az oldalon belül kétszer szereplő stílusblokkok korábbi példányát (~10 MB a 320 lapon).
A `klon/` forrás változatlan; a kinézet képkockánként azonos (`tools/klon-regresszio.mjs`).
Ami szándékosan marad: minden mérőkód, a **Convertize** (élő A/B-teszt: mobilon a `/migren-piercing`
látogatóinak 71%-a a `/migren-piercing-b`-re megy, cél a foglalás), a JSON-LD, a kereső-igazoló címke.
A Wixen futó második GTM-tároló (GTM-PZ6CL4JP, csak a köszönőoldalakon) üres, ezért a klón nem tölti be.

## 3. Ami működik (a Wix helyett)

| Wix-funkció | klónban |
|---|---|
| felugró menü (jobb felső gomb) | `klon.js` 1.: jobbról becsúszik, az aktuális oldal kiemelve (asztalin), rámutatáskor sötét háttér (`T_TcVK`), X / fátyol / Esc zár; a Wix menüstílusai: `assets/css/wix/felugro.css` (`tools/popup-mentes.mjs`) |
| diavetítés (főoldal, blogbejegyzések alján) | `klon.js` 2.: minden dia lementve, 1 mp áttűnés, 4 mp-enként lapoz, csak amíg látszik (mint a Wix), nyilak |
| képgaléria (piercer-oldalak) | `klon.js` 3.: nyilak, húzás |
| Pro Gallery (bélyegképes és csúszkás galériák, 34 oldal) | `klon.js` 12.: nyilak a Wix animációjával, bélyegképsáv középre igazítva, ujjal lapozás; képre kattintva teljes képernyős nézet (`?pgid=`), mobilon vissza-nyíllal |
| fejléc görgetéskor (asztali) | `klon.js` 10.: kb. 400 px lefelé görgetés után felcsúszik, felfelé görgetve visszajön |
| fülek (Migrén, Fejfájás) | `klon.js` 4. |
| videódoboz | `klon.js` 5.: némítva indul, kattintásra áll/indul, hanggomb (asztalon rámutatáskor, telefonon érintés után látszik) |
| állásjelentkezési űrlapok (5 oldal) | `klon.js` 6.: a Wix-naptár (hónap- és évlapozás, évlista; asztalon a mező alatt, telefonon teljes képernyőn), a Wix hibajelzése (mező elhagyásakor és beküldéskor piros alsó vonal, görgetés az első hibás mezőhöz) → `POST /api/urlap` → e-mail mellékletekkel (`functions/[[path]].js`, `lib/levelek.js`) |
| kontroll / garancia visszahívás-kérő (`/kontroll`, új Wix-űrlap) | `klon.js` 16.: a Wix hibaüzenetei mezőnként (mező elhagyásakor és beküldéskor, görgetés az első hibás mezőhöz), országkód-választó 238 országgal, kereséssel (telefonon alsó panel; `assets/data/orszagok.json`, `tools/orszagok-mentes.mjs`), Wix-szerű naptár (mobilon középen, „Bezárás”), legördülő lista (mobilon a böngészőé), képcsatolás → `POST /api/urlap` (`kontroll-visszahivas`) → e-mail |
| videólejátszó („Vendégeink videó beszámolói”, 12 oldal) | `klon.js` 13.: a borítóra kattintva helyben indul a Wix-vezérlőkkel (szünet, hang, idősáv, teljes kép, kép a képben), a vezérlők 2 mp után / az egér távozásakor eltűnnek; mobilon vezérlők nélkül (mint a Wixen) |
| blogbejegyzés képei | `klon.js` 14.: kattintásra fehér, teljes képernyős nézegető a bejegyzés összes képével (nyilak, Esc) |
| blog-hozzászólás | `klon.js` 15.: a „Hozzászólás írása…” mező kinyílik (név, e-mail, csillagos értékelés, szöveg) → `POST /api/urlap` (`blog-hozzaszolas`) → e-mail a szalonnak; a Wix hozzászólás-szervere nincs, a jóváhagyott hozzászólást a mentés teszi ki |
| blog RSS-csatorna (`/blog-feed.xml`) | a Wix csatornája egyszer lementve, saját képcímekkel (`tools/rss-mentes.mjs`, `assets/blog-feed.xml`) |
| Google-vélemények (Trustindex), GYIK (Common Ninja), RTL-videó | a Wix HTML-beágyazásai helyben (`assets/embed/`), változatlan külső szolgáltatással |
| YouTube- és Facebook-videók, Salonic-foglaló | változatlan beágyazás / link; a Wix csak görgetéskor tölti ki a lejátszót, ezért a kész állapotát külön mentjük (`tools/videok-mentes.mjs` → `tools/wix-videok.json`, a `wix2static.mjs` és a `tools/videok-potlas.mjs` tölti be) |
| Google-térkép | a Google beágyazott térképe ugyanarra a helyszínre (a Wix-féle egyedi térképstílus nélkül) |
| süti-sáv és mérés | `suti.js`: saját süti-sáv (`docs/SUTISAV.md`; Meta, TikTok, Convertize csak marketing-hozzájárulással), GTM-T9GR4JCK (benne a GA4 G-SJT2RN62H8 és a TikTok-pixel), Google Ads AW-11097894040, Convertize, Meta-pixel 2177829632420786 (a `/foglalas-ok*` oldalakon nem), TikTok „Foglalás indítása” (`InitiateCheckout`, `content_name: foglalas_inditasa`, `content_category`: a piercing-típus rövid kódja) minden medicalpiercing.salonic.hu linkre kattintáskor (a `/foglalas-ok*` oldalakon nem) – **csak a www.medicalpiercing.hu-n**; próba: `tools/meres-teszt.mjs` |
| köszönőoldalak (`/foglalas-ok`, `-mi`, `-shenmen`, `-klimax`, `-slim`, `-allergia`, `-maj`, `-lep`, `-vastagbel`, `-2piercing`, `-3piercing`, `-4piercing`, `-6piercing`) | ugyanazon a címen, átirányítás nélkül, a paraméterekkel (a Salonic szolgáltatásonként ide irányít); nincsenek a sitemapben |
| rejtett Wix-oldalak (a sitemapben nem szereplő akciós, régi és köszönőoldalak: `/kozerzetjavito-piercing-soft-akcio`, `/home2`, `/fulbevalo-ok*`, `/garancia-xyz`, `/kontroll-xyz`, `/kerdoiv-ok`, `/allas-ok` stb.) | a Wix útvonaltáblájából (`tools/oldalak.mjs --utvonalak`), ugyanazon a címen, a Wix `robots` beállításával; nincsenek a sitemapben. Az állásűrlapok beküldés után a `/allas-ok`, a `/kontroll` űrlapja a `/kontroll-ok` címre visz (mint a Wixen) |
| a Wix átirányításai (URL Redirect Manager) | `lib/utvonal.js` `WIX_ATIRANYITASOK`: `/kontroll-ok` → `/kontroll-xyz`, `/garancia-ok` → `/garancia-xyz` (301, a paraméterekkel) |
| URL-paraméterek megőrzése (a Wix `masterPage.js` kódja) | `klon.js` 8.: a beérkező paraméterek a munkamenetben maradnak; a foglalási linkek (medicalpiercing.salonic.hu) viszik az `fbclid`, `gclid`, `gbraid`, `wbraid`, `ttclid`, `utm_*` paramétereket |
| városoldalak lapozója („Previous” / „Next”) | `klon.js` 9.: a Wix helyszín-gyűjteményének sorrendjében (`assets/data/varos-lapozo.json`, `tools/varos-lapozo-mentes.mjs`; a gyűjtemény bővülése után újra kell futtatni), ahol nincs előző / következő, ott tiltva |
| kitelepülések (vidéki helyszínek időpontjai) | a „MP - KITELEPÜLÉSEK” Google-táblázatból: a build beírja, a lap betöltéskor frissíti (`lib/kitelepulesek.js`, `/api/kitelepulesek`, `klon.js` 11.), lásd lent |
| blog | a bejegyzések, a listák és a „legutóbbi bejegyzések” statikusan (a kedvelés/megtekintés-számláló a mentéskori állapot) |

### Kitelepülések

A vidéki helyszínek időpontjai a [„MP - KITELEPÜLÉSEK”](https://docs.google.com/spreadsheets/d/1BgIiGJkvQga-VNlPuFQ7xneevogubfya/edit)
táblázat első lapjáról („Időpontok”) jönnek: soronként egy helyszín, oszloponként egy hónap („2026. december”), a
cellában a napok („4,11,18”). A táblázatban a dátumcellák szöveg formátumúak és beviteli ellenőrzésük van (csak
számjegy, vessző, vagy „-”), az „Útmutató” lap leírja a kitöltést. Az oldalon helyszínenként az aktuális és a
következő két hónap hátralévő napjai látszanak, minden lapon, ahol a Wixen a helyszínlista volt (30 oldal), és a
saját városoldalon. A build beírja a lapokba (a dátumblokk `data-mp-kitelepules="<helyszín>"` jelölést kap), a lap
betöltéskor az `/api/kitelepulesek`-ből frissíti (a táblázat legfeljebb 5 perces másolata). A helyszínt a blokk
melletti cím, a városoldalakon a lap címe adja (a Wix-címek nem megbízhatók: a `/varosok/8800-nagykanizsa-fo-ut-23`
ma a székesfehérvári helyszín). A nem értelmezhető cellákat az `/api/kitelepulesek` `hibak` listája mutatja.

## 3/b. Rejtett új főoldal: `/uj-fooldal` (kézzel írt, nem Wix-klón)

Az új főoldal látványterve alapján készült lap, **élesben, de rejtve**: a mostani főoldalt (`/`) nem váltja le, nincs a sitemapben,
semmi nem linkeli, a keresők nem indexelhetik (`noindex,nofollow` a lapban és `X-Robots-Tag` a függvényben, `functions/[[path]].js`
`REJTETT_LAPOK`). Éles címe: https://www.medicalpiercing.hu/uj-fooldal (a PR-előnézeten is: `https://<ág>.medicalpiercing.pages.dev/uj-fooldal`).

| Mi | Hol |
|---|---|
| a lap (HTML, reszponzív: asztali és mobil ugyanaz a fájl) | `uj-fooldal/index.html` |
| stílus / viselkedés | `assets/css/uj-fooldal.css`, `assets/js/uj-fooldal.js` (a `klon.js` ezen a lapon nem fut) |
| build | `tools/uj-fooldal.mjs` (a `tools/build.mjs` hívja; leáll, ha a lapból hiányzik a `noindex`, van `canonical`, vagy hiányzó kép / betű van benne) |
| képek | `assets/img/uj-*.webp`, gyártja: `python3 tools/uj-fooldal-kepek.py` (a meglévő `assets/img/` forrásokból; a videók indexképei és a logók is) |
| betű | `assets/fonts/plus-jakarta-sans-*.woff2` (OFL, saját tárhelyről) |
| teszt | `node tools/uj-fooldal-teszt.mjs` (build + `serve.mjs` után; `BASE=<cím>`-mel előnézeten / élesben is: ilyenkor a mérőkérések és a Salonic-hívások blokkolva vannak, `tools/meres-tiltas.mjs`) |

Működés: a foglalási gombok (`/idopontfoglalas`, `/kontroll`) a foglalómotort nyitják, a mérés (süti-sáv, GTM, foglalásindítás) a `suti.js`-ben és a
`mp-meres.js`-ben ugyanúgy fut, mint a többi lapon; az URL-paraméterek (fbclid, utm_*, gclid) megőrzése a `klon.js` 8. szakaszának mása
(ugyanaz a munkamenet-kulcs). A Google-vélemények (pontszám, darabszám, két vélemény) mentett adatokkal indulnak, és élőben frissülnek a
Trustindex-widgetből (ugyanaz, amit a mostani főoldal beágyaz); ha az nem érhető el, a mentett adat marad. A három videó a kártyára kattintva
ablakban nyílik (youtube-nocookie / RTL beágyazás), nem a lap betöltésekor.

**Tartalom:** a látványterv szerkezete és a valódi oldal szövegei / adatai. A látványterv (generált kép) néhány adata nem egyezett az élő oldallal, ezeket
a valós oldal alapján cseréltük: Google 4,8 / 4 962 vélemény (élő Trustindex-adat), valódi vendégvélemények, telefon / e-mail / cím (Kecskemét: Vágó utca 19.),
az orvosi ajánlás eredeti szövege (Dr. Schmolcz Gergely, „szakmai mentor”), árak és akció az élő árlista szerint, a piercing-típusok panaszlistái az
élő oldalról. A „szakorvostól”, az „ingyenes konzultáció”, a „7 szalon” és a Nők Lapja logó nincs az élő oldalon, ezért nem kerültek a lapra.
A jogi láb (EÜ szakember, 93%-os statisztika, „nem gyógymód”) az élő oldalról átvéve.

**Élesítés főoldalként** (csak a tulajdonos kérésére): a `klon/index.html` helyett ennek a lapnak a tartalmát kell a `/` címen adni (a `dist/_a|_m/fooldal.html`
helyére), a `<meta name="robots">` és a REJTETT_LAPOK bejegyzés eltávolításával, `canonical` hozzáadásával, és a `fooldal-b` / Convertize-kísérlet
ellenőrzésével. **Visszavonás:** a lap törlése a `tools/build.mjs`-ből (egy sor) és a `REJTETT_LAPOK`-ból.

## 4. Publikálás: Cloudflare Pages (egyszeri beállítás)

A klón a `Brinuti/mosaic` repóban van, de **külön Cloudflare Pages-projekt** publikálja (a MOSAIC
oldal buildje ezt a mappát nem használja):

1. **Kész (2026-10-10, API-n):** *Workers & Pages → Create → Pages → Connect to Git* → `Brinuti/mosaic`, projektnév: `medicalpiercing`
   (`https://medicalpiercing.pages.dev`)
   - Production branch: `main` · **Root directory: `medicalpiercing`**
   - Build command: `node tools/build.mjs` · Build output: `dist`
   - *Build watch paths*: include `medicalpiercing/*` (így a MOSAIC-változások nem indítanak itt buildet)
2. A meglévő `mosaic` projektben: *Settings → Builds → Build watch paths* → exclude `medicalpiercing/*`
   (így a medicalpiercing-változások nem fogyasztanak a MOSAIC 500-as havi buildkeretéből).
3. **Kész (2026-10-11):** *Settings → Variables and Secrets*: `SMTP_PASS` (Secret, Production és Preview) =
   Gmail-alkalmazásjelszó a `medicalpiercing.hu@gmail.com` fiókhoz (Google-fiók → Biztonság →
   Alkalmazásjelszavak, „CLAUDE”). Próbalevél kiment. Enélkül az űrlap beküldése sikeres, de levél
   nem megy ki (a Cloudflare naplójában látszik).
4. Próba a `https://<ág>.medicalpiercing.pages.dev` címen (a próbacímek `noindex`-esek, mérőkód nem fut rajtuk).
5. **Élesítve: 2026-10-11 08:03.** A `medicalpiercing.hu` DNS-e a Cloudflare-en van (zóna a fiókban,
   névszerverek `dimitris`/`sharon.ns.cloudflare.com`; a regisztrátor a **Websupport**, ott cseréltük a
   Wix `ns14/ns15.wixdns.net` névszervereit). A zóna rekordjai (a Wix-DNS-ből átvéve):
   - `MX` 5 db Google Workspace (`aspmx.l.google.com` 10, `alt1`–`alt4` 20–50), `TXT` google-site-verification és SPF;
   - `mail` A `37.9.169.111` és `stape` CNAME `euj.stape.io` (szerveroldali mérés) – **DNS only**;
   - `www` és a gyökér CNAME `medicalpiercing.pages.dev`, **proxyzott**; a Pages-projektben mindkettő
     *Custom domain* (Active). A gyökeret a függvény 301-gyel a www-re küldi, a paraméterekkel együtt.
   - **Visszaállás a Wixre:** a `www` CNAME → `cdn3.wixdns.net` (DNS only); a névszervereket nem kell
     visszacserélni (a gyökér a függvényen át a www-re, onnan a Wixre visz).
   - **Tanulság:** a névszervercsere után a régi Wix-névszervert (TTL 86400) még kérdező DNS-feloldók a
     Wix Cloudflare-es szerverére küldték a látogatót, ahol a hostnév már a mi zónánkhoz tartozott:
     `403 – error code: 1034`. Egy órán belül 5%-ról közel 0-ra csökkent. Legközelebb a cserét a
     régi DNS-szolgáltatónál is érdemes előkészíteni (ott is a Pages-re mutató www-rekorddal).

## 5. Nyitott pontok

- **A Wix:** az oldal és az előfizetés még megvan (visszaállási lehetőség). Néhány nap hibátlan
  működés után lemondható; a régi Wix-DNS-ben a www rekord még a Wixre mutat.
- **CookieYes:** a sütisáv szkriptje 2026-10-10-én 403-at adott; 2026-10-11 óta saját süti-sáv van helyette (`docs/SUTISAV.md`).
- **Négy kódolt perjeles cím** (`/varosok/4031-debrecen%2C-der%C3%A9k-utca-100%2Fb`, a pécsi, a nagykanizsai Ady Endre utcai
  és a `/1-header/…` oldal): a Wix böngészőben a 404-es lapot rajzolja ki rájuk; a klón a szerver által küldött valódi
  tartalmat mutatja (`tools/elo-mentes.mjs` ezeknél a `tools/raw` mentést használja).
- **A Wix-szerkesztő** ezután nem frissíti a klónt. Szöveg- vagy képváltozáshoz vagy a Wixben kell
  módosítani és újra lefuttatni a 1. pont láncát, vagy közvetlenül a `klon/<kulcs>.html`-t kell szerkeszteni
  (asztali és mobil változatot is).
- A Wix-blog kedvelés/megtekintés-számlálója és a hozzászólás-doboz statikus; a Wix tagsági
  (bejelentkezés) funkciói nincsenek a klónban.
- A Meta szerveroldali eseményeit (Wix „Facebook Server Side Events” app) a Wix küldte; a klónban a böngészőoldali
  mérés a GTM-en át megy tovább. Ha a szerveroldali mérés kell, a GTM szerverkonténerében (stape) kell beállítani.
