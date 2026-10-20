# /hajvizsgalat-budapest – hajkamerás hajvizsgálat (Google Ads OX-2), ÚJ oldal

**Állapot (2026-10-20): ÉLES** (Feri kérésére élesítve: indexelhető, a sitemapben van; rá a belső linkelés külön döntés). Korábban (2026-10-18) DRAFT volt: `noindex, nofollow`, nincs a sitemapben, nincs rá link sehonnan.
Szövegterv: Drive `MOSAIC-GOOGLE-4UZLETAG-LANDING-BRIEF-WEBES-ABLAKNAK-2026-10-17.md`, 2. szakasz.

## Fájlok (mind új)
| Fájl | Szerepe |
|---|---|
| `foglalas/hajvizsgalat-budapest.html` | az oldal (egy fájl asztalira és mobilra) |
| `assets/css/oxigen-hajvizsgalat.css` | csak ennek az oldalnak a kiegészítő stílusa (az `oxigen-landing.css` / `oxigen-landing.js` VÁLTOZATLAN, a mintaoldal is) |
| `assets/js/oxigen-hajvizsgalat.js` | az oldal saját kis szkriptje: belső görgető gombok (`<button data-gorget="<id>">`, nincs `#hash`-váltás, nincs `pushState` / `replaceState`) + a Google-térkép betöltése (süti-engedély / gomb). Nem mérőkód, nem küld eseményt |
| `tools/ujrastilus-teszt/oxigen-hajvizsgalat.test.mjs` | tesztek (statikus + böngészős + dist) |
| `tools/ujrastilus-teszt/hajvizsgalat-torott-sor.mjs` | a „megtört sor” ellenőrző (Feri alapszabálya); önállóan is futtatható: `PLAYWRIGHT_UTVONAL=… CHROME_UTVONAL=… node tools/ujrastilus-teszt/hajvizsgalat-torott-sor.mjs 360,390,412` |

## Felépítés (a brief A–G szakaszai, 2026-10-20 óta Feri visszajelzése szerint)
hős (H1 · fotó · alcím · 4 990 Ft · EGY fő gomb · hely + „Megnézem a térképen” belső görgető gomb · 4,9 – 1 266 Google-értékelés belső görgető gomb) → **A)** „Mikor jöjj hajvizsgálatra?” (`.jelek` komponens, ikonos kártyák) → **B)** „Mit kapsz 4 990 Ft-ért?” (sötét `.allapot`) →
**C)** kötelező figyelmeztető doboz (szó szerint) → **D1)** „Így tudunk segíteni” (a következő lépés, 3 lépés) → **D2)** „Mit csinálunk az oxigénes hajkezelés során?” (az élő oldalról: szöveg + 3 kép) →
**D3)** „Nézd meg, hogyan zajlik egy kezelés” (az élő oldal videója + privát kezelőszoba) → **D4)** „Az oxigénes hajkezelés árai” (29 900 / 26 000 / 5 alkalmas bérlet + fő gomb) → **E)** „Ki vizsgál?” (Tündi, Vivien, Móni) →
**G)** bizalom (Google-értékelés + Glamour-említés + a `#velemenyek` blokk: a vendégek Google-véleményei, Trustindex-keret) → **F)** GYIK → hely + `#terkep` térképes blokk → záró sáv.
Mobilon ragadós alsó sáv: az egyetlen fő gomb (az `oxigen-landing.js` a „Mikor érdemes?” szekció elgörgetése után mutatja, a záró sávnál eltűnik).

## 2026-10-20 Feri visszajelzés (a három új oldal közös szabályai; ez az oldal)
Feri szó szerint: sorrend (cím, kép, alcím); az értékelés „sehol ne vigyen ki az oldalról”, „mindenhol legyen oldalon belül a Google vélemények”; a térképre sem ki, hanem le a térképes blokkra; hiányzik a „mi a következő lépés” blokk
(címe ne „kezelést választasz”, hanem „Így tudunk segíteni”), egy-két magyarázó blokk az oxigénes hajkezelésről az élő landingről (videóval), „egy picit adjuk el az oxigénterápiát is”; „Első kezelés hajkamerás vizsgálattal” egy sorba;
alapszabály: ahol egy-két szó csúszik át új sorba, az legyen egy sor (mobilon). Mi készült:
1. **Hős-sorrend**: mobilon / tableten (≤ 1100 px) CÍM → KÉP → alcím → ár → fő gomb → hely → értékelés. A hős-rács nevesített területeivel (`"cim" "gal" "szoveg"`, `oxigen-hajvizsgalat.css`) – ugyanazt adja, mint a többi landing `.hero-szoveg { display: contents } + order` mintája; asztalon (> 1100 px) a kétoszlopos elrendezés változatlan. Mobilon a fotó 4:3-ra vágott (a tablet és a kezelés látszik), hogy a fő gomb ne csússzon le az első képernyőről.
2. **Google-vélemények az oldalon belül**: a hős értékelés-jelvénye belső görgető gomb (`<button data-gorget="velemenyek">`) a `#velemenyek` blokkra (a „Miért bízhatsz bennünk?” szakaszban: Trustindex-keret, ugyanaz a beágyazott fájl és ugyanaz a `ti-doboz` + `oxigen-landing.js`, mint az `/oxigenterapia-budapest` oldalon). A bizalom-szakasz Google-kártyája már nem link, az „Összes vélemény a Google-on” link megszűnt.
3. **Térkép az oldalon belül**: a hős „Megnézem a térképen ↓” gombja a `#terkep` térképes blokkra görget (a hely-szekció alatt; a Google-térkép a funkcionális sütik engedélyezése után, vagy a „Google térkép megjelenítése” gombra tölt be, mint a többi Head Spa oldalon). **Meghagyva**: az „Útvonaltervezés” gomb (`maps/dir`, új lap) – az navigáció, nem „Google értékelés / Térkép” link; a `tel:` link is marad.
   A belső görgetés `<button data-gorget>` + `scrollIntoView` (`assets/js/oxigen-hajvizsgalat.js`; a repó szabálya: **nincs `href="#horgony"` link**, nincs `#hash`-váltás / `pushState` / `replaceState`, mert a GTM History Change trigger mérést indítana, lásd `OXIGEN-LANDING.md`); a cél fejlécére (h2 / h3) kerül a fókusz. A gombok linknek látszanak (aláhúzott szöveg, nagyobb érintési felület). A teszt ellenőrzi: kattintásra nincs navigáció, hash-váltás, history-hívás, új lap.
4. **„Így tudunk segíteni”** (a régi „Ha kezelést választasz” helyén; a „kezelést választasz” szöveg sehol nincs): 3 lépés (Megnézzük → Személyre szabjuk → Kezelünk, ha szeretnéd; „a következő alkalommal megkezdhetjük”, „nincs kötelező kezelés vagy bérlet”) – a mondatok az éles oldal „Mi történik az első kezeléseden?” és GYIK-szövegeiből.
5. **Oxigénes magyarázó blokkok** (az élő `/oxigenterapia-budapest`-ről, szó szerint): „Mit csinálunk az oxigénes hajkezelés során?” (lead + Tisztítás / Ápolás / Oxigénes kezelés, 3 kép) és „Nézd meg, hogyan zajlik egy kezelés” (a kezelés videója kattintásra tölt, + 3 előny: privát kezelő, „nem kell szégyellned magad”, HeadSpa ágy, + privát kezelőszoba fotó). Alattuk az árak-blokk (29 900 / 26 000 / 130 000 Ft, a meglévő oldalról) és a fő gomb. **Eredmény-/hatás-állítás nem került át** (lásd lent).
6. **„Első kezelés hajkamerás vizsgálattal”** (az ársor és a két másodlagos link) 360 / 390 / 412 px-en egy sor (`clamp()` betűméret + `white-space: nowrap`; az ár-részek `&nbsp;`-kel összekötve).
7. **Megtört sor alapszabály**: `tools/ujrastilus-teszt/hajvizsgalat-torott-sor.mjs` (Playwright, `Range.getClientRects()`): a címek, gombok, jelvények, kártyacímek, lista-elemek, rövid sorok, bekezdések utolsó sorában ≤ 2 szó maradt-e. Eszközök: `text-wrap: balance` (címek, rövid szövegek, GYIK-kérdések), `text-wrap: pretty` (bekezdések), `clamp()` betűméret, `&nbsp;`, rövidebb szöveg. Eredmény (régi oldal → új oldal): 360 px 15 → 0, 390 px 10 → 0, 412 px 9 → 0 (és 375 / 384 / 393 / 414 / 428 / 480 / 600 px is 0; 320 / 340 px-en 7 / 2 apró maradék). A teszt 360 / 390 / 412 px-en 0 találatot vár, és önteszttel bizonyítja, hogy az ellenőrző az árva szót kimutatja.
   Szövegmódosítások emiatt: „Mikor érdemes hajvizsgálatra jönnöd?” → „Mikor jöjj hajvizsgálatra?”; „Kozmetikai fejbőrápolási lehetőségeket javaslunk” → „Kozmetikai fejbőrápolási javaslat”; „Nincs kötelező bérlet: alkalmanként fizetsz.” → „Nincs kötelező bérlet.”; a Glamour-dátum külön sor; a vélemények címe „Vendégeink Google-véleményei”. A „Mikor” kártyák mobilon egy oszlopban, ikon balra (a 2 oszlopos kártyában a cím nem fért el egy sorban).

## Foglalás
- Fő gomb (az oldal EGYETLEN fő gombja, szövege mindenhol azonos): „Hajvizsgálatot foglalok – 4 990 Ft” → `/foglalo-motor?business=oxygen&service=466147` (Salonic: „AKCIÓS Hajkamerás vizsgálat és konzultáció”, 30 perc, 4 990 Ft).
- Másodlagos (csak lent, kisebb link): „Első kezelés hajkamerás vizsgálattal – 29 900 Ft” → `…&service=466110` (80 perc, 29 900 Ft).
- Fejléc FOGLALÁS gomb, Infó-ablak, lábléc: `<!--mh-foglalas:business=oxygen&service=466147-->` (az oldal fő konverziója a hajvizsgálat; ha Feri a nyitottabb `business=oxygen`-t kéri, a jelölő egy sora). Nyitvatartás: `<!--mh-nyitvatartas:hetkoznap-->` (csak H–P).
- Nincs `data-cta`, nincs mérőkód az oldalban; az `oxigen-landing.js` `data-cta`-s kattintás-eseménye így nem aktív.

## Ami NEM kerülhetett ki (megerősítésre vár / tiltott)
- A vizsgálat időtartama ([MEGERŐSÍTENDŐ] a briefben; a Salonic 30 percet ír: Feri megerősítheti).
- Szombati nyitvatartás (csak H–P szerepel az oldalon, a láblécben és az Infó-ablakban).
- **2026-10-20 óta még NEM átvett (megerősítésre vár; Feri döntsön, és a mérési oldallal / ChatGPT-vel egyeztessen)**: az élő oldal „Hogyan működik az oxigénterápia?” (élettani állítások: vérkeringés, sejtanyagcsere, „megállítható” …), „Mire számíthatsz” (lassuló hajhullás, dúsuló haj …),
  „Milyen hajhullásokra működik”, az Oxygeni YouTube-videói („segíthet …”), az előtte/utána fotók, a Glamour-idézet, a „95%” statisztika és az „5–7 alkalom drasztikus változás”; a 9 lépéses protokoll „Kezelési terv – a diagnózis alapján” sora (a „diagnózis” szó ütközik a „nem orvosi diagnózis” üzenettel).
- Megerősítésre vár: ha valaki előbb a 4 990 Ft-os vizsgálaton jár, mennyibe kerül a következő alkalmon a kezelés (az éles oldalon csak az „Első kezelés hajkamerás vizsgálattal – 29 900 Ft” és a „2. alkalomtól 26 000 Ft” szerepel); az „Így tudunk segíteni” ezért nem mond árat a „következő alkalomra”.
- A Trustindex-widget saját, beágyazott linkjei (a vélemények szerzőinek neve → Google-profil, „Értékelés írása” → Google) új lapon nyílnak; ezek a külső widget részei (a többi oldalon is ugyanígy), nem az oldal forrásában vannak.
- Tiltott: gyógyulás- / eredményígéret, „trichológus”, „orvos” mint szolgáltató, „95% hatékonyság”; a Glamour-cikknél az eredményre utaló idézet kimaradt (csak az említés + link).
- A kezelők bemutatkozó mondatai kimaradtak (a fő oldalon „validálásra várnak”); csak név + szerep.

## Élesítés (megtörtént 2026-10-20: az 1., 2., 4. lépés kész; a 3. a mérési oldalé)
1. `foglalas/hajvizsgalat-budapest.html`: a `<meta name="robots" content="noindex, nofollow">` sor (és az előtte lévő megjegyzés) ki.
2. Sitemap: `tools/wix-sitemap/pages-sitemap.xml` – új `<url><loc>https://www.mosaicheadspa.hu/hajvizsgalat-budapest</loc>…</url>` (mint a többi sor); a `tools/netlify-build.mjs` a Wix-sitemapet szó szerint adja ki.
3. Meta-pixel: az `assets/js/suti.js` `PIXEL_OLDALAK` listáján az oldal ma NINCS (az `oxigenterapia-budapest` / `oxigenterapia-ferfiaknak` a `PIXEL_FODRASZ` csoportban van): élesítéskor a `hajvizsgalat-budapest` kerüljön oda (védett mérési fájl: a mérési oldallal).
4. A teszt `noindex` és „nincs a sitemapben” ellenőrzése ekkor igazodik (élesítő PR).

## Mérés-lefedettség (helyi dist az éles hostnév alatt, kimenő mérés tiltva; `?gclid=TESZTGCLID1234567890&gbraid=…&wbraid=…&fbclid=…&ttclid=…`)
- Google-címke (GTM-PST2HB22 a `suti.js`-ből, minden élő oldalon): **fut**; a `_gcl_aw` süti létrejön a teszt-gclid-del (`GCL.<idő>.TESZTGCLID1234567890`); a Google-kérések viszik a gclid-et.
- `mh_attr` (localStorage, a `attribucio.js`): gclid / gbraid / wbraid mentve (alapértelmezett hozzájárulással); **figyelem: a `gclid` 10 karakternél rövidebb teszt-értéke (pl. `TESZT123`) a mintán nem megy át, ezért a teszt-gclid legyen ≥ 10 karakter.**
- TikTok-pixel: fut (4 kérés). **Meta-pixel: NEM fut** (az oldal nincs a `PIXEL_OLDALAK` listán).
- A fő gomb a foglaló-réteget nyitja (`#mosaic-booking-layer`), az oldal URL-je (és benne a kattintás-azonosítók) megmarad, a motor ezt a `location.search`-ből olvassa.
