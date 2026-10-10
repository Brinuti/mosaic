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
  assets/js/suti.js                        a Wix „Egyéni kód”-ja: CookieYes, GTM, Google Ads, Convertize
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
node tools/elo-mentes.mjs --ujra             # a kirajzolt oldal, asztali  -> tools/elo-dom/asztali/
node tools/elo-mentes.mjs --mobil --ujra     # ugyanez mobilon (kb. 50-50 perc)
node tools/popup-mentes.mjs          # a felugró menü (Wix lightbox)       -> assets/popup/
node tools/beagyazasok.mjs           # a Wix HTML-beágyazásai              -> assets/embed/
node tools/media.mjs                 # képek és videók eredetiben          -> tools/eredeti-*/
python3 tools/kepek-kicsinyites.py   # képek a megjelenített méretre       -> assets/img/
node tools/videok.mjs                # videók 720p-re (max. 24 MB)         -> assets/video/
python3 tools/betu-epites.py         # saját betűk + assets/css/wix-fonts.css (csak ha a Wix betűi változtak)
node tools/wix2static.mjs && node tools/wix2static.mjs --mobil   # -> klon/, klon/m/
node tools/videok-mentes.mjs && node tools/videok-potlas.mjs     # a Wix csak görgetéskor kitöltött YouTube-/Facebook-videói -> tools/wix-videok.json, klon/
node tools/orszagok-mentes.mjs       # a /kontroll országkód-választója     -> assets/data/orszagok.json, assets/img/flag-*
node tools/varos-lapozo-mentes.mjs   # a városoldalak lapozójának céljai     -> assets/data/varos-lapozo.json
node tools/build.mjs                 # -> dist/
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
| süti-sáv és mérés | `suti.js`: CookieYes, GTM-T9GR4JCK (benne a GA4 G-SJT2RN62H8 és a TikTok-pixel), Google Ads AW-11097894040, Convertize, Meta-pixel 2177829632420786 (a köszönőoldalakon nem) – **csak a www.medicalpiercing.hu-n** |
| köszönőoldalak (`/foglalas-ok`, `-mi`, `-shenmen`, `-klimax`, `-slim`, `-allergia`, `-maj`, `-lep`, `-vastagbel`, `-2piercing`, `-3piercing`, `-4piercing`, `-6piercing`) | ugyanazon a címen, átirányítás nélkül, a paraméterekkel (a Salonic szolgáltatásonként ide irányít); nincsenek a sitemapben |
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
3. *Settings → Variables and Secrets*: `SMTP_PASS` (Secret) = Gmail-alkalmazásjelszó a
   `medicalpiercing.hu@gmail.com` fiókhoz (Google-fiók → Biztonság → Kétlépcsős azonosítás →
   Alkalmazásjelszavak). Enélkül az űrlap beküldése sikeres, de levél nem megy ki (a Cloudflare
   naplójában látszik).
4. Próba a `https://<ág>.medicalpiercing.pages.dev` címen (a próbacímek `noindex`-esek, mérőkód nem fut rajtuk).
5. **Élesítés:** a domain most a Wix névszerverein van (`ns14/ns15.wixdns.net`), a levelezés Google
   Workspace. A Cloudflare-ben *Add a domain* → `medicalpiercing.hu`. Átvétel előtt ellenőrizni kell, hogy
   az **MX rekordok** (`aspmx.l.google.com` és társai) és a többi TXT-rekord (SPF, DKIM, Google-igazolás)
   átjöttek-e. Utána a domainregisztrátornál a névszervereket a Cloudflare-ére kell cserélni, végül
   a Pages-projektben *Custom domains* → `www.medicalpiercing.hu` és `medicalpiercing.hu`
   (a gyökér domain 301-gyel a www-re visz, mint a Wixen).

## 5. Nyitott pontok

- **Űrlap-e-mail:** a `SMTP_PASS` beállítása (lásd fent). A címzett alapból `medicalpiercing.hu@gmail.com` (`wrangler.toml`).
- **CookieYes:** a sütisáv szkriptje (`a46a3451…/script.js`) 2026-10-10-én 403-at ad, az élő Wix-oldalon is: a sáv nem
  jelenik meg, a mérőkódok hozzájárulás nélkül futnak (a Wixen is így). A CookieYes-fiókban kell rendbe tenni.
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
