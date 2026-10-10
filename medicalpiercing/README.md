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

**Mérés (2026-10-10, 1440 px):** a kezdőlap, a Rólunk és a Blog oldalon az élő Wix-oldal minden
`comp-` eleme helyben és méretben egyezik a klónnal (`tools/elteres.mjs`: 0 eltérő elem), és az
oldalak teljes magassága is pixelre azonos.

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
node tools/build.mjs                 # -> dist/
```

Egyetlen oldal: `node tools/elo-mentes.mjs rolunk && node tools/wix2static.mjs rolunk` (mobilon `--mobil`).

### Az átalakító (`tools/wix2static.mjs`)

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
```

## 3. Ami működik (a Wix helyett)

| Wix-funkció | klónban |
|---|---|
| felugró menü (jobb felső gomb) | `klon.js` 1.: jobbról becsúszik, az aktuális oldal kiemelve (asztalin), X / fátyol / Esc zár |
| diavetítés (blogbejegyzések alján) | `klon.js` 2.: minden dia lementve, 1 mp áttűnés, 4 mp-enként lapoz, nyilak |
| képgaléria (piercer-oldalak) | `klon.js` 3.: nyilak, húzás |
| fülek (Migrén, Fejfájás) | `klon.js` 4. |
| videódoboz | `klon.js` 5.: némítva indul, kattintásra áll/indul, hanggomb |
| állásjelentkezési űrlapok (5 oldal) | `klon.js` 6. → `POST /api/urlap` → e-mail mellékletekkel (`functions/[[path]].js`, `lib/levelek.js`) |
| Google-vélemények (Trustindex), GYIK (Common Ninja), RTL-videó | a Wix HTML-beágyazásai helyben (`assets/embed/`), változatlan külső szolgáltatással |
| YouTube- és Facebook-videók, Salonic-foglaló | változatlan beágyazás / link |
| Google-térkép | a Google beágyazott térképe ugyanarra a helyszínre (a Wix-féle egyedi térképstílus nélkül) |
| süti-sáv és mérés | `suti.js`: CookieYes, GTM-T9GR4JCK, Google Ads AW-11097894040, Convertize – **csak a www.medicalpiercing.hu-n** |
| blog | a bejegyzések, a listák és a „legutóbbi bejegyzések” statikusan (a kedvelés/megtekintés-számláló a mentéskori állapot) |

## 4. Publikálás: Cloudflare Pages (egyszeri beállítás)

A klón a `Brinuti/mosaic` repóban van, de **külön Cloudflare Pages-projekt** publikálja (a MOSAIC
oldal buildje ezt a mappát nem használja):

1. *Workers & Pages → Create → Pages → Connect to Git* → `Brinuti/mosaic`, projektnév: `medicalpiercing`
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
- **A Wix-szerkesztő** ezután nem frissíti a klónt. Szöveg- vagy képváltozáshoz vagy a Wixben kell
  módosítani és újra lefuttatni a 1. pont láncát, vagy közvetlenül a `klon/<kulcs>.html`-t kell szerkeszteni
  (asztali és mobil változatot is).
- A Wix-blog kedvelés/megtekintés-számlálója és a hozzászólás-doboz statikus; a Wix tagsági
  (bejelentkezés) funkciói nincsenek a klónban.
- A Meta szerveroldali eseményeit (Wix „Facebook Server Side Events” app) a Wix küldte; a klónban a böngészőoldali
  mérés a GTM-en át megy tovább. Ha a szerveroldali mérés kell, a GTM szerverkonténerében (stape) kell beállítani.
