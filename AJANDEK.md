# MOSAIC Gift Commerce Engine (`/ajandek`)

Ajándékkártya-vásárlási folyamat (e-commerce, nem foglalás): **egy közös commerce motor + egy
message-match variant réteg**. A fő mért esemény a **PAID PURCHASE** (a Stripe-fizetés
beérkezése), nem a CTA-kattintás, nem a Stripe-kattintás, nem az űrlap-beküldés.

> **Állapot (2026-10-04): P0 + a 6 variant (a tulajdonos variant-dokumentuma szerint: `general`, `friend`, `mother`, `for_her`, `partner`, `last_minute`) kész**; a nem validált assetek helyén a `general` asset látszik (lásd [Variantok](#variant-config-a-komponensfa-nem-változik-csak-a-tartalom)). Nem indexelhető (`noindex`), a
> főoldalról nem linkelt, nincs a sitemapben. Amíg nincs Stripe-kulcs beállítva, a checkout
> „az online fizetés nem érhető el” állapotot mutat – vásárolni nem lehet. **Élesítés előtt
> végig kell menni az [élesítési ellenőrzőlistán](#élesítési-ellenőrzőlista).**

## Mi van benne (P0) és mi nincs

| P0 (kész) | P1 (később, ugyanebbe a motorba) |
|---|---|
| GENERAL hero, 3 termék (a doboz egésze kattintható), a kiválasztott termék beágyazott kezelés-bemutatója; a 6 variant (`general`, `friend`, `mother`, `for_her`, `partner`, `last_minute`) | a `NEEDS_MANUAL_VALIDATION` assetek (barátnős / páros / férfi-hook videók, TikTok-proofok) tulajdonosi validálása; a `last_minute` kézbesítési-idő állítása csak valódi SLA mellett |
| beágyazott Stripe checkout (Payment Element), siker/hiba állapot, feldolgozás | |
| vásárlás utáni személyre szabás, végleges order hub | |
| purchase analytics, perzisztencia, variant-routing (ismeretlen → GENERAL) | |

Nincs kosár, nincs külön termékoldal, nincs külön checkout variantonként. A személyre szabás
**fizetés után** jön (nem blokkolhatja a vásárlást).

## Fájlok

| fájl | szerep |
|---|---|
| `foglalas/ajandek.html` | az oldal (a build az asztali és a mobil mappába is bemásolja → `/ajandek`) |
| `assets/css/ajandek.css` | stílus (Playfair Display + Jost, a MOSAIC arculat; asztali és mobil egy fájlban) |
| `assets/js/ajandek-adat.js` | **közös adat**: termékek, **árak**, variantok, feliratok – a böngésző és a szerver is ezt olvassa |
| `assets/js/ajandek.js` | a motor: állapotgép, komponensek, mérés, perzisztencia, Stripe-integráció |
| `netlify/lib/ajandek.js`, `ajandek-levelek.js` | a szerveroldali kezelő (`/api/ajandek/*`) és a levelek / nyomtatható kártya HTML-je |
| `netlify/functions/ajandek.mjs` | Netlify-adapter |
| `functions/api/ajandek/[[kind]].js` | Cloudflare Pages-adapter (ugyanaz a kezelő) |
| `tools/ajandek-teszt/` | helyi teszt-kiszolgáló, böngészős Stripe-mock, mock Stripe API, `node --test` tesztek (nem kerül az oldalba) |

### Design (2026-10-03, a feltöltött mockupok alapján; a második, világos mockup a mérvadó)

A mockup **elrendezését és hangulatát** vettük át (fotóhátteres hero, ikonos Gift Finder, képes
termékkártyák, sötétzöld véleménysáv, kétoszlopos checkout, háromlépéses összefoglaló), a
**tartalmát nem**: az árak az éles Stripe-linkekből vannak (nem a mockup kitalált árai), a
„legnépszerűbb” helyett „Ajánlott választás” áll, a vélemény a tulajdonos valódi Google-véleménye
(nincs kitalált név/dátum, a második idézet elmarad), a fizetés Stripe (nem SimplePay), a termékek
tartalma a jóváhagyott „50 perc + 30 perc szárítás” logika, és az „Ezt fogja átélni” blokk a
jóváhagyott egyszerű szövegekkel megy (megérkezik → kikapcsol → csak vele foglalkoznak → rendezett
hajjal távozik). A fejléc és a lábléc **az éles oldalé**: a `foglalas/ajandek.html`-ben a
`<!--mh-fejlec-->` / `<!--mh-lablec-->` jelölőt a build az `assets/fejlec/` töredékekkel cseréli
(mint a sminktetoválás-landingen), a menüt az `assets/js/klon.js` működteti; az „Ajándékkártya”
menüpontot a `menuAktiv()` jelöli aktívnak. A helyi kiszolgáló ugyanezt a beillesztést végzi.
Elrendezés (a harmadik, véglegesnek szánt mockup szerint, 2026-10-03): teljes szélességű, meleg hero-fotó (arany zuhanyív) a bal
oldalon krémszínű átmenet alatt futó szöveggel (2026-10-04-től a hero média a jobb félen áll); a „Válaszd ki az ajándékot” fejléc (a **valódi Canva-kártya** előlapja, fekvő 21 x 10 cm,
`assets/img/ajandek/kartya-elolap.jpg`) alatt **három lépés egymás mellett** (a tulajdonos 5. mockupja szerint): *1 Válassz élményt* (három vízszintes
termék-kártya, rádiógomb: kép, név, „50 perc kezelés + 30 perc szárítás”, „1 fő”, `kartya_sor`, ár) | *2 Nézd meg, milyen* (a kiválasztott élmény 9:16-os videója) |
*3 Vedd meg az ajándékkártyát* (név + ár, leírás, „Mi történik a kezelésen?”, „Milyen ajándékkártyát szeretnél?” két opcióval, „Tovább a vásárláshoz”); „Mit mondanak a vendégeink?” (**nyolc valódi vendég-videó**
lapozható sorban); külön „Valódi Google-vélemények” szekció (Trustindex); „Pontosan ezt kapja” (a szeánsz 15 elemének lapozója);
„Ezt adod át neki” (fotó + a valódi kártya); „Miért MOSAIC?” (cím, elérhetőség + 14 képes, lapozható, nagyítható galéria); „Hogyan működik az ajándékozás?” + gyakori kérdések; a fizetési nézet
két oszlopban (a tulajdonos 4. mockupja szerint): bal oldalt *2 Adatok* (mezőnként ikon, összecsukható „Céges számlát kérek”), jobb oldalt *1 Rendelésed* (kép, cím, tartalom, „Felhasználható 6 hónapig”, ár)
és alatta *3 Fizetés* (Stripe Payment Element, „Biztonságos fizetés — ár”; a fizetési mód választó része: Kártya/Revolut/Google Pay vagy Banki átutalás); mobilon egy oszlop, ragadós fizetés-sávval. A mockup kitalált elemei NEM kerültek át: „azonnali kézbesítés”, a mockup
idézetei és vendégfeliratai (a videók alatt csak a vendég keresztneve és a videó hossza áll), a születésnapos mintaüzenet,
generált belső terek és térkép, „Kolosy tér” (a cím: 1023 Budapest, Bécsi út 2.), „láthatóan szebb haj”.

**Fotók és videók** (a tulajdonos Drive-mappájából, 2026-10-03; a Drive saját, 900–2000 px széles JPG-előnézete, az eredetiek 7 MB-osak):
hero: DSC03646 (Mosaic fotózások / Renátó második fotózás); Egyéni: DSC03638; 4 kezes: DSC01452 (Ajándékkártya / Képek);
„Ezt adod át neki”: DSC01457 (korábban DSC03651); szalon: DSC05642, DSC05648, DSC05660 (Renátó első fotózás); a páros kép a korábbi valódi fotó (egy nő és
egy férfi vendég, két terapeuta; „két barátnő” kép esetén a `TERMEKEK.paros.vizual`-t kell cserélni, a CSS kicsit világosítja).
A négy vendég-videó (Zsóka, Zita, Kinga, Dóri) a Drive „Testimonial videók / 720P_Mosaic Testimonial” mappájából való (az eredetiek 720x1280,
67–104 MB), **540x960-ra** átkódolva (`assets/video/ajandek-vendeg-*.mp4`, 4,7–8,7 MB): kicsit nagyobb a korábbi 360x640-nél, hogy jó minőségű
legyen, de ne foglaljon sok helyet, és ne lassítsa az oldalt (a videó csak kattintásra tölt, `preload="none"`; a Cloudflare Pages 25 MiB-nál
nagyobb fájlt nem fogad). A poszterkép a videó 0,4. másodpercéből való (a vendég arca látszik; 540 px széles JPEG).
A hero- és Head Spa-videók a tulajdonos 2026-10-03-án jóváhagyott letöltéséből készültek („szöveg nélkül.mp4” 1080x1080 / 152 MB → `ajandek-headspa.mp4`
640x640, 5,1 MB, és `ajandek-hero-altalanos.mp4`, 3:2 kivágás, 1,1 MB; „Anya-lánya.MP4” 9:16 → `ajandek-hero-anya-lanya.mp4`, 0,6 MB; „Hook1.MP4” 9:16 →
`ajandek-hero-hook.mp4`, 0,3 MB; a hero-videók hang nélkül, `-crf 29–30 -maxrate 1100k`). A nagy eredetiek nincsenek a repóban. „Ezt adod át neki”: DSC01457
(`atadas-kartya.jpg`, a Drive 1400 px-es előnézete).
Újabb videó felvétele: letöltés, ffmpeg (`-vf scale=540:960 -c:v libx264 -preset slow -crf 26 -maxrate 750k -c:a aac -b:a 64k -ac 1 -movflags +faststart`), egy új
`li` a `foglalas/ajandek.html` `ah-vendeg-lista`-jában (`data-vendeg`, `data-nev`, poszter: a Drive videó-miniatűrje).

### Oldal-felépítés és ellenőrzőlista (2026-10-03, a design-felülvizsgálat)

Elv: az oldal ne csak egy szép ajándékkártya-checkout legyen. **Előbb tegye kívánatossá a Head Spa élményt, bizonyítsa, hogy jó ajándék,
utána tegye nagyon egyszerűvé a megvásárlását.** A landing sorrendje: *hero (ár a CTA mellett, bizalmi sor)* → *3 termék + a
kártya előnézete + az átvétel-választó* → *Ilyen a Head Spa (videó + élmény-elemek)* → *vendég-videók* → *Google-vélemények* → *Pontosan ezt kapja* → *Ezt
adod át neki* → *Miért MOSAIC? + helyszín* → *Hogyan működik? (5 lépés)* → *GYIK*; a checkout, a személyre szabó és a végső összegző ugyanazon az
oldalon, külön nézetben.

| # | pont | állapot |
|---|---|---|
| 1 | Minimal header | **szándékosan eltér**: az élő oldal fejléce (a tulajdonos kérése: „menü és footer az éles oldalról”). A fizetési nézetre szűkített (minimal) fejléc külön kérésre készíthető |
| 2 | Personafüggő felső rész | ✓ 6 variant (`?variant=general\|friend\|mother\|for_her\|partner\|last_minute`): hero cím / alcím / CTA / média, Gift Finder előválasztás, terméksorrend, megnyugtató sor; minden más közös. A `last_minute` **nem állít** kézbesítési időt (csak „Online megvásárolható.") |
| 3 | Hero eladja az ajándékot és a Head Spa-t | ✓ |
| 4 | Valódi MOSAIC fotó/videó a hero-ban | ✓ valódi fotó + csendes hero-videó (`general`: „szöveg nélkül.mp4”, `mother`: „Anya-lánya.MP4”, `last_minute`: „Hook1.MP4” kivágás); a nem validált variantok a `general` médiát kapják |
| 5 | Erős trust sor | ✓ 4,9 · 1.259, 6 hónap, online, személyre szabható kártya |
| 6 | Gift Finder | **megszűnt** (2026-10-04, a tulajdonos kérésére: ugyanazt mondta, mint a három termék-doboz). A variant „előválasztása” a megfelelő termékkártya „ajánlott” (arany keretes) jelölése; a `gift_finder_select` esemény már nem megy ki |
| 7 | 3 termék elkülönítve (ár + lényeg + CTA) | ✓ |
| 8 | Persona szerinti terméksorrend | ✓ barátnő/anya/pár: Páros elöl; általános és „neki”: Egyéni |
| 9 | „Ilyen a Head Spa” videós blokk | ✓ a tulajdonos „szöveg nélkül.mp4” felvétele (57 s, 640x640, hanggal; `HEADSPA_VIDEO`, négyzet alakú lejátszó) |
| 10 | Benefit, nem technikai leírás | ✓ új (`BENEFITOK`: kikapcsolódás, masszázs, vízélmény, teljes figyelem, rendezett haj) |
| 11 | Valódi videótestimonialok | ✓ 8 vendég (Zsóka, Zita, Kinga, Dóri, Hédi, Koletta, Viki, Szandi), lapozható sorban |
| 12 | Férfi intentnél női reakciók | ✓ mind a négy vendég nő; a `for_her` variant ezt a sorrendet adja |
| 13 | „Pontosan ezt kapja” | ✓ a táblázat helyett az élő főoldal „Egy MOSAIC Headspa szeánsz elemei” lapozója (15 elem, rövid valódi videók) + 4 tudnivaló és egy „Kiválasztom az ajándékot” gomb |
| 14 | „Ezt adod át neki” | ✓ a valódi kártya + a DSC01457 fotó (Ajándékkártya / Képek; a variant-dokumentum szerint ennek a blokknak a közös fotója) |
| 15 | MOSAIC / helyszín proof | ✓ szalonfotók, cím, nyitvatartás, térkép-link |
| 16 | „Hogyan működik?” | ✓ 5 lépés: kiválasztás → személyre szabás → fizetés → átadás → beváltás |
| 17 | Gift-specifikus GYIK | ✓ átírva: érvényesség, átvétel, személyre szabás, fizetés, beváltás, a 3 termék különbsége; a Head Spa-tudnivalók a végén |
| 18 | Embedded checkout ugyanazon az oldalon | ✓ |
| 19 | E-mail + minimális adat | ⚠ a számlához név, irányítószám, város, utca is kell; csökkenthető, ha a számlázás (szamlabridge) nem igényli – döntés kell |
| 20 | Apple Pay / Google Pay / kártya elsődleges | ✓ átutalás másodlagos link |
| 21 | Ár mindig a CTA közelében | ✓ a termék-kártyákon, a 3. lépés dobozában (ár + „Tovább a vásárláshoz”), a Rendelésed kártyán és a fizetés gombon (2026-10-04-től a hero-ból a „26.900 Ft-tól” a tulajdonos kérésére lekerült) |
| 22 | Nincs nem igazolt ígéret | ✓ a teszt ellenőrzi a variantokban; a kód-kommenteken kívül nincs „azonnal / perceken belül” |
| 23 | Fizetés után a személyre szabás | ⚠ **a tulajdonos kérésére módosult**: az otthon nyomtatott kártya személyre szabása a fizetés **előtt** van (kihagyható: „Kihagyom”); a fizetés utáni név/üzenet csak személyes átvételnél marad |
| 24 | Final Order Hub | ✓ |
| 25 | Mobilon is logikus | ✓ egy oszlop, nagy gombok, nincs vízszintes carousel, nincs vízszintes túlcsordulás |
| 26 | GENERAL fallback | ✓ ismeretlen / hiányzó / hibás variant → `general` (teszt) |
| 27 | Minden variant mérhető | ✓ a `variant_id` a dataLayer-eseményekben és a PI metadata-jában is végigmegy a purchase-ig (teszt) |

### Árak – egyetlen forrás

Az árak **csak** az `assets/js/ajandek-adat.js` `TERMEKEK.*.ar_ft` mezőjében vannak. A szerver ebből
számolja a PaymentIntent összegét (a böngésző által küldött összeg nem számít), a böngésző ebből
írja ki. A mostani értékek a MOSAIC **éles Stripe-fizetőlinkjeinek** árai (2026-10-03):
Egyéni 26.900 Ft, 4 kezes 39.900 Ft, Páros 53.800 Ft – az **októberi 20% kedvezménnyel**
(listaár 32.900 / 49.900 / 65.900 Ft). **A kedvezmény lejártakor itt kell átírni.**

## Állapotgép

```
bongeszes → kivalasztva → [tervezo] → fizetes → feldolgozas → siker → [szemelyre] → osszegzo
                 ↑           ↓          ↓            ↓
                 └───────────┴──────────┴── hiba ←───┘   (hiba → fizetes: az inputok megmaradnak)
```

A termék-doboz (vagy az „Ajándékozom” gomb) kiválasztja a terméket, és alatta **beágyazva** nyílik a kezelés-bemutató (videó + leírás +
ár + „Tovább”); nincs felugró ablak. A `tervezo` (mini személyre szabó) csak **otthon kinyomtatott** kártyánál van, és a
`szemelyre` (fizetés utáni név/üzenet) csak **személyes átvételnél**. Lásd lent: „Átvétel és személyre szabás”.

Asztali és mobil **ugyanazt** az állapotgépet és ugyanazt a komponensfát használja (csak a CSS
különbözik). A böngésző Vissza gombja a checkoutból a „kiválasztva” állapotba visz. Stripe 3DS /
átirányítás után az oldal a `payment_intent` paraméterekből visszaáll, és a **szerver** ellenőrzi
a fizetést. Fizetés után a frissítés a személyre szabás lépését (`siker`/`szemelyre`) legfeljebb 30
percig állítja vissza; a végleges nézet (`osszegzo`, „Minden kész.”) után a frissítés **tiszta
lappal** indul (a rendelés a levélben lévő linkkel érhető el), és a „Újabb ajándékkártyát
vásárolok” link bármikor új vásárlást indít.

### Variant config (a komponensfa nem változik, csak a tartalom)

Forrás: a tulajdonos variant-dokumentuma (`MOSAIC_GIFT_VARIANT_CONTENT_*`, 2026-10-03). **Egyetlen master landing van**; a variant csak a
felső sales-állapotot cseréli: hero cím / alcím / média / CTA, a Gift Finder előválasztása, a terméksorrend, az első testimonial/proof
és egy (max. 1) persona-megnyugtató sor. Közös (nem variant): fejléc, „Ilyen a Head Spa”, termékadat és ár, kártya-előnézet, MOSAIC-proof,
„Hogyan működik?”, GYIK, checkout, fizetés, vásárlás utáni nézet, order hub.

`VARIANTOK` az `ajandek-adat.js`-ben: `variant_id, hero_eyebrow, hero_title, hero_subtitle,
hero_cta, hero_media, hero_trust, gift_finder_preselect, product_order, vendeg_sorrend, featured_proof, reassurance,
objection_title, objection_body, relationship, gift_context, occasion`.

| variant | `?variant=` | előválasztás | terméksorrend | `gift_context` / `relationship` | hero média |
|---|---|---|---|---|---|
| általános | `general` | – | egyéni, 4 kezes, páros | general | „szöveg nélkül.mp4” kivágás ✓ |
| barátnők | `friend` | ketten | páros, egyéni, 4 kezes | together / friend | ✗ NEEDS_MANUAL_VALIDATION → `general` média |
| anya–lánya | `mother` | ketten | páros, egyéni, 4 kezes | together / mother | „Anya-lánya.MP4” kivágás ✓ |
| neki (női címzett) | `for_her` | egyedül | egyéni, 4 kezes, páros | for_her / recipient_female | ✗ NEEDS_MANUAL_VALIDATION → `general` média |
| pár | `partner` | ketten | páros, egyéni, 4 kezes | together / partner | ✗ NEEDS_MANUAL_VALIDATION → `general` média |
| utolsó pillanat | `last_minute` | – | egyéni, 4 kezes, páros | last_minute / – (`occasion` az `?occasion=` URL-ből) | „Hook1.MP4” kezelés-képek kivágása ✓ (indítás előtt gyors vizuális QA) |

**Hogyan kapcsol át a variant?** Nem magától: a variantot a **link** hordozza. Minden hirdetés / poszt / e-mail célcíme `…/ajandek?variant=<id>`
(+ az `utm_*`, `gclid`, `fbclid`, `ttclid` paraméterek). A hiányzó, érvénytelen vagy ismeretlen érték (pl. `__proto__`) → **GENERAL**. A variant a
sessionben megmarad (a vevő a Gift Finderben később mást is választhat), bekerül minden eseménybe és a PaymentIntent metadatába
(`variant_id`, `gift_context`, `relationship`, `occasion`, `utm_*`, click-id-k), így a `purchase` ugyanahhoz a forrás/variant attribúcióhoz kötődik.

**Tesztelés:** a teszt-módú oldalon (előnézet, `pk_test_` kulccsal) az oldal alján a „TESZT MÓD” szalagon **variant-kapcsoló** van
(`general · friend · mother · for_her · partner · last_minute`); az éles oldalon ez nincs. Előnézeti linkek:
`https://claude-ajandek-motor.mosaic-d77.pages.dev/ajandek?variant=<id>`. Helyben: `node tools/ajandek-teszt/szerver.mjs` →
`http://localhost:4195/ajandek?variant=<id>`.

**Asset-validálás** (a `hero_media.status` / `first_proof_javaslat.status` mező): csak a `APPROVED_BY_METADATA`, `APPROVED_BY_EXPLICIT_FILENAME`,
`APPROVED_BY_FOLDER_CONTEXT` asset jelenhet meg; a `NEEDS_MANUAL_VALIDATION` assetet **nem** nevezzük ki magunk megfelelőnek: a variant ilyenkor a
`general` médiát kapja (`hero_media_javaslat` őrzi az eredeti javaslatot, a teszt ellenőrzi). **A tulajdonosnak kell megnéznie és jóváhagynia:**
„Új páros videó.MP4” (`friend`), „Férfi új Hook videók / 1.mov” (`for_her`), „Páros headspa kezelés 1.MP4” (`partner`), a TikTok-proofok
(Losonczi Rita – `friend`, Győri Anett – `mother`), a „Karolin.mov” (`general` első proof), valamint a `for_her` / `partner` testimonial-poolból
választott női / páros ajándék-reakció. A videók jóváhagyása után a `status` átírása és a média bekötése elég (nem kell kódot átalakítani).
A „Hook1.MP4” egy hirdetés: a férfi-beszélős jelenetei („csak 200 darab”, „zárjuk a foglalást”, „csak két kattintás”) szűkösségi és gyorsasági
állítást tartalmaznak, ezért **nem** kerültek be; a hero csak a kezelés-képek két szakaszát használja (a felirat-sáv nélkül).

**Hero-videó:** a fotó az LCP-elem és a poszter; a csendes (hang nélküli, ismétlődő) videó a betöltés után indul, nem indul csendes-mozgás (`prefers-reduced-motion`)
vagy adatkímélő mód / 2G esetén, és megáll, ha kikerül a képből. A hero médiája (fotó és videó, mind 3:2) asztali nézetben a hero jobb felén áll, a
szöveg mellett (kivágás és közel-arany nélkül), mobilon felül.

## Mérés (dataLayer, GA4 ecommerce séma)

Eseménysorrend: `view_item` → `select_item` → `begin_checkout` →
`add_payment_info` → `purchase`. Közös paraméterek: `variant_id, gift_context, relationship,
occasion, utm_source/medium/campaign/content/term, gclid, fbclid, ttclid`; termék-eseményeknél
`product_type`; `add_payment_info`/`purchase`: `payment_method`.

**A `purchase` esemény szerződése** (ezt használja a GTM-et beállító külön munkaterület):

| mező | érték |
|---|---|
| `event` | `purchase` |
| `transaction_id` (és `ecommerce.transaction_id`) | a Stripe PaymentIntent azonosítója (`pi_…`) |
| `value` (és `ecommerce.value`) | a **szerver (Stripe) által visszaigazolt bruttó összeg** forintban, nem a böngésző konfigja |
| `currency` | `HUF` |
| `event_id` | ugyanaz, mint a `transaction_id` – a böngészős és a szerveroldali (Meta / TikTok) esemény deduplikálásához |
| `product_type`, `quantity` | `egyeni` / `4kezes` / `paros`, `quantity: 1` (és `ecommerce.items`) |
| `payment_method`, `variant_id`, `gift_context`, `utm_*`, `gclid`, `fbclid`, `ttclid` | a fizetés és az attribúció adatai |

**A `purchase` kizárólag akkor megy ki, ha** (1) a szerver a Stripe-tól visszakérdezve „fizetve”
állapotot mond (`GET /api/ajandek/rendeles`), (2) a fizetést **ebben a munkamenetben indította** a
vásárló (tehát a levélből megnyitott, továbbított vagy másik eszközön nyitott link **nem** vált ki újat),
és (3) az adott PaymentIntentről még nem ment ki (`localStorage`). **Nem megy ki:** a fizetés
indításakor, oldalfrissítéskor, visszalépéskor, átutalási igénynél (az a külön `bank_transfer_request`
esemény), kártya-letöltéskor, beváltáskor.

**A `client_secret` nem kerül a mérésbe.** A Stripe-visszatérés és a levélbeli rendelés-link
paramétereit (`payment_intent*`, `redirect_status`, `rendeles`, `rt`) az `ajandek.html` elején futó kis
szkript a `sessionStorage`-ba teszi és kiveszi a címsorból, még mielőtt a `suti.js` / GTM beolvasná az
URL-t. A levélben nincs `client_secret`: csak olvasási tokent (`?rendeles=…&rt=…`) tartalmazó link van,
amivel a rendelés megnézhető, de nem szerkeszthető.

**A mérés (GTM, Google Ads, Meta, TikTok) beállítása NEM ennek a fejlesztésnek a része.** A GTM-konténer
nincs módosítva; a címkéket külön munkaterületen, másodlagos konverzióként, a 2026-10-12-i kapuig
párhuzamos teszttel állítja be egy külön ablak. A mérőkódok a `suti.js`-ből jönnek, **csak a
`mosaicheadspa.hu` domainen** futnak (a deploy preview-n nem). Az új oldalt a `suti.js` Meta-pixel
oldallistájába **nem** vettem fel (ez is a mérés-beállítás döntése).

> **A `/success-ajandekkartya-stripe` oldal megmarad.** A mostani fizetőlinkes ajándékkártya-oldalak és a
> Stripe-fizetőlinkek átirányítása érintetlen (a `klon/` mappa nem változott); az ajándékkártya-konverzió
> ma erre az oldalra épül. Az új `/ajandek` folyamat **nem** jár ott (a saját köszönő nézete az oldalon
> belül van), ezért **amíg a hirdetés a régi oldalakra mutat, a mostani mérés változatlanul fut**. Az
> `/ajandek` címet 2026-10-12 előtt **ne** linkeljük és ne hirdessük, mert a mostani konverzió nem látná
> az ott történt vásárlásokat. Ha ez változna, előbb szólni kell.

## Fizetés és teljesítés

**Fizetés:** Stripe **Payment Element** (késleltetett PaymentIntent): az e-mail az első mező, az
Apple Pay / Google Pay / bankkártya az elemben jelenik meg, ahol elérhető. A számlázási adatokat
(név, cím, e-mail) mi kérjük be és adjuk át a megerősítéskor, így a charge `billing_details`-e
ugyanolyan, mint a mostani fizetőlinkeknél.

**Számlázás:** a Stripe-fiókban már van egy `payment_intent.succeeded` webhook
(`szamlabridge.com`), amely a mostani vásárlásokból számlát készít a charge számlázási
adataiból. Az új PaymentIntentek is ezt váltják ki – **de nem lett kipróbálva** (lásd az
ellenőrzőlistát). A fizetőlinkek `automatic_tax`-szal mentek, ez a flow **nem használ Stripe Tax-ot**.

**Teljesítés (a kártyára kerülő kód).** A szalon a Salonicban hozza létre a kódot kézzel; a rendszer a **szalon által beírt kódot** teszi a kártyára.
Két eset van (a szalon eddigi gyakorlata szerint):

| | bankkártya (Stripe) | utalás |
|---|---|---|
| Salonic | sima **100%-os kupon** (a számlát a szamlabridge már kiállította) | **utalvány-értékesítés** (fizetési mód: Átutalás; ez készíti a számlát, és a Salonic a saját utalványkódját mindig felismeri foglalásnál) |
| a kód | a levélben javasolt `AK-XXXX-XXXX` (átírható) | a Salonic adja (pl. `GYOR1865`), a szalon írja be |
| rendelésazonosító | `MH-XXXXXXXX` | `ATU-XXXXXX` (ez a bankkivonat közleménye) |

1. **Kártya:** a Stripe webhook (`POST /api/ajandek/webhook`) két levelet küld: a szalonnak (rendelés, vevő adatai, javasolt kód,
   **„Kiállítom a kártyát”** gomb) és a vevőnek („megkaptuk a fizetésed”).
2. **Utalás:** a vevő a fizetési oldalon a *Fizetési mód* választóban a „Banki átutalás”-t választja (a kártyamező eltűnik, a gomb „Rendelés
   elküldése — ár” lesz, és figyelmeztetés jelenik meg: a kártyát csak az utalás visszaigazolása után tudjuk kiállítani, bankkártyánál azonnal
   küldjük), megadja a telefonszámát (kötelező, a Salonic-utalványhoz kell; a mező az *Adatok* kártyában csak átutalásnál jelenik meg), a
   szalonban átvételnél opcionálisan üzenetet is. A rendszer a Stripe-ban egy **nyilvántartási
   PaymentIntentet** hoz létre (`metadata.fizetesi_mod = atutalas`, `atu_ref = ATU-…`; **nem fizethető ki**, a `client_secret`-jét senki nem
   kapja meg), és két levelet küld: a vevőnek az utalási adatokat, a szalonnak az igényt a **„Az utalás beérkezett – kiállítom a
   kártyát”** gombbal és a Salonic-értékesítés közvetlen linkjével (`app.salonic.hu/promotion/giftCard/sale/<id>`, az id az
   `ajandek-adat.js` `TERMEKEK.*.salonic` mezőjében van; a termék/ár változásakor itt kell frissíteni). A szalon a bankkivonaton látott
   `ATU-…` közleményre keres a postafiókban.
   **Egy kattintásos Salonic-kitöltés.** A Salonic-űrlap (`GiftCardBuyForm[...]`) URL-paraméterrel nem tölthető elő, és a Salonic nem
   ad API-t. A kiállító oldal Salonic-linkje ezért az adatokat a `#mosaic=<JSON>` részben viszi (a hash nem megy el a szerverre), és a
   szalon **egyszer** a könyvjelzősávba húzza a **„MOSAIC kitöltő”** könyvjelzőt (a kiállító oldalon van, `SALONIC_KITOLTO_JS` az
   `ajandek-levelek.js`-ben, `javascript:` link). A Salonic-oldalon egyetlen kattintás kitölti az Ajándékozó nevét + telefonját, az
   Ajándékozott nevét (max. 40 karakter), a szalon e-mail címét és a fizetési módot (Átutalás = 14); a másolat-jelölőt kiveszi. **Semmit
   nem küld el**, az Előnézetet / értékesítést a szalon indítja. Az „Ajándékozó e-mail címe” mezőbe a **szalon címe** kerül (nem a vevőé), mert
   a Salonic az utalványt erre a címre küldi: így a vevő csak a MOSAIC-kártyát kapja, a Salonic saját levelét nem (kikapcsolni nem lehet).
   Az **üzenet nem kerül a Salonicba** (a kártyára a MOSAIC írja). Új Salonic-mező esetén a kitöltő a szerver által küldött JSON kulcsait
   követi (`GiftCardBuyForm_<kulcs>`), a könyvjelzőt nem kell újratelepíteni. Kártyás rendelésnél nincs Salonic-űrlap, ott a javasolt
   kuponkód egy „Másolás” gombbal másolható (`MASOL_JS`). Mindkét szkript hash-e a CSP-ben van.
   **Miért nem megy teljesen „egy gombbal, magától”?** A Salonic a saját oldalán fut, kívülről nem írható: az URL-paraméter nem tölti elő az
   űrlapot, API nincs, és a `PHPSESSID` süti SameSite-attribútum nélkül jön (Chrome ezt Lax-nak veszi), ezért a MOSAIC-oldalról indított
   cross-site POST nem vinné át a belépést. Csak a Salonic-oldalon futó kód tud kitölteni, ezért a megoldás a könyvjelző (2 kattintás: link +
   könyvjelző; semmit nem kell telepíteni). Tampermonkey-szkriptet (1 kattintás) a szalon nem kért, nincs benne.
3. **Kiállítás (mindkét esetben ugyanaz):** a gomb megerősítő oldalt nyit (GET, nem módosít), ott a szalon beírja a **kódot**, és
   megnyomja a gombot (POST). Utalásnál ekkor áll „fizetve” állapotba a rendelés (`atutalas_beerkezett`, `atutalas_ekkor`; az
   érvényesség ettől a naptól számít). A vevő levelet kap a kártya linkjével; az order hub „Ajándékkártya letöltése” gombja is aktív.
   Egyszer megy (`kartya_kesz`), ismételt kattintás nem küld újat.

**Szamlabridge:** csak a Stripe-fizetésekből készít számlát. Utalásnál a számlát a Salonic utalvány-értékesítése készíti, ezért a
nyilvántartási PI soha nem „succeeded” (a `payment_intent.succeeded` webhook nem fut rá, a szamlabridge nem számláz).

Soha nem írunk „perceken belül”, „azonnal”, „ma” ígéretet, amíg ez nem garantált (`AJANDEK_AZONNALI=1` kapcsolja át, jelenleg ki van
kapcsolva: ekkor a webhook rögtön kiállítja a kártyát, és a feliratok „perceken belül”-re váltanak).

**A kártya** (`/api/ajandek/kartya?pi=&t=`) a MOSAIC saját **Canva-terve** (A4 álló, sötétzöld-arany): a háttér
`assets/img/ajandek/kartya-hatter.jpg` (a Canva-terv szövegmentes másolatából exportálva), erre írja a rendszer a megajándékozott
nevét (fejjel lefelé, a felső arany sávba), a vevő üzenetét (ha nincs: az alapvers), a termék feliratát (`kartya_felirat`),
az értéket, a kódot és az érvényességet – ugyanazokra a helyekre, ahova eddig kézzel. Nyomtatható / PDF-ként menthető
(böngésző nyomtatás), a hozzáférés külön tokenhez kötött (`t`, HMAC), így a továbbított link csak a kártyát mutatja.
A háttér frissítése: Canva-tervmásolat („MOSAIC ajándékkártya háttér (automatikus)”) → export JPG 2382×3369 → felülírni a fájlt.

**Átutalás nem vásárlás** a mérés szempontjából (`bank_transfer_request`, nem `purchase`).

### Átvétel és személyre szabás (2026-10-03)

**Kezelés-bemutató (beágyazva, 2026-10-04-től nem felugró).** A 2. lépésben a kijelzett élmény videója (`<video controls>`, **3:4**, 540x720: a doboz képaránya pontosan a videóé, nincs sáv alatta/fölötte), a 3. lépésben cím, ár, leírás és a
„Mi történik a kezelésen?” lista (összecsukva). A kijelzett élmény = a vevő választása, ennek hiányában az ajánlott (a variant előválasztása, egyébként az első a sorrendben), így a
videó és a vásárlás-doboz mindig ki van töltve; a rádiógomb állítja be az `S.termek`-et (nincs görgetés, nincs felugró). A tartalom a
`TERMEKEK.*.kezeles` mezőben van (`leiras`, `lepesek`, `video`). A videók: *egyéni* = a Meta-fiók „Headspa szeptember 20_ natív kezelés.mp4”
(a beégetett „SZEPTEMBERI AKCIÓ −20%” sáv és a régi értékelést mutató záró kártya levágva, 3:4, 0:55), *páros* = „Szept páros HEADSPA 20_.mp4”
(ugyanígy levágva, 0:29), *4 kezes* = a „Hook1.MP4” 4 kezes szakasza (0:08; a Meta 4 kezes videóihoz nincs letölthető fájl). **Ha saját,
végleges kezelés-videó készül, a `kezeles.video = { src, poster }` mezőt kell cserélni.**

**Átvétel-választó.** A 3. lépés doboza: „Milyen ajándékkártyát szeretnél?” – *Személyre szabható, digitális ajándékkártya* (AJÁNLOTT; alap, a következő lépésben személyre szabható)
vagy *Eredeti, fizikai ajándékkártya – a szalonban veszem át* (díszborítékban, személyre szabás nélkül). A „Tovább a vásárláshoz” gomb az átvételtől függően a személyre szabóra vagy a fizetésre visz.

**Átvétel.** A kiválasztott termék panelén a vevő a fizetés előtt választ: *E-mailben, otthon kinyomtatom* (alap; személyre szabható)
vagy *Személyesen, a szalonban* (papír, díszborítékban). A választás a PI `metadata.atvetel` mezőjébe kerül (`otthon` / `szemelyesen`),
és a szalon levelében + a kiállító oldalon látszik. A régi fizetés utáni „Hogyan szeretnéd átadni?” kérdés megszűnt (személyes
átvételnél a `/szemelyre` `atadas: fizikai` marad, így a szalon értesítője változatlan).

**Mini személyre szabó** (`tervezo` nézet, csak otthon nyomtatott kártyánál): design (jelenleg 4 helyőrző: Smaragd, Krém, Homok,
Fehér), fotó (telefonról is; böngészőben ≤ 1600 px JPEG-re kicsinyítve; húzással és nagyítással igazítható), idézet vagy
üzenet (≤ 160 karakter), „Kinek szól?” (≤ 40). Az előnézet **élő** és a szerver **ugyanazt a sablont** használja
(`assets/js/ajandek-kartya.js`: `TEMAK`, `html()`, `CSS`), ezért a kinyomtatott kártya = az előnézet. Ha a vevő semmit nem ad
meg (vagy a „Kihagyom” linket használja), a MOSAIC klasszikus (Canva) kártyáját kapja.

**Új design felvétele** (a végleges, megtervezett designok helye): a `TEMAK` tömbbe egy új elem `{ id, nev, kep: {x,y,w,h,alak},
idezet: {x,y,w,h}, nevHely: {x,y,w,h} }` (a 794 × 1123 px-es A4 lap koordinátáiban), a színeit a `CSS`-ben az `.ak-t-<id>` szabály adja
(`--ak-h` háttér, `--ak-sz` szöveg, `--ak-a` kiemelő, `--ak-m` fotóhely-szín). Háttérképes (Canva) designnál a szövegmentes háttér a
`.ak-t-<id>`-ben `background: url(…)`; a fotóhely a háttér **fölé** kerül (alak: `iv` | `teglalap` | `kor` | `polaroid`, vagy új `.ak-<alak>`
szabály). **Minden designon van fotóhely és idézet-hely.** A designok száma a `TEMAK` hosszától függ (a felület magától követi).

**Fotó-tárolás.** A fotót a `POST /api/ajandek/foto` (JPEG data URL, ≤ 700 KB) a Cloudflare **KV**-ba (`AJANDEK_FOTOK` kötés,
kulcs `foto:<24 jegyű id>`) teszi: 3 napig él, és amikor a `/fizetes` vagy az `/atutalas` megkapja az `id`-t, a rendeléshez kötve
**400 napra** újraírja (a kártya 6 hónapig érvényes). A rendelés metadata-ja csak az azonosítót és a kivágást (`foto_id`, `foto_poz`
= `x,y,zoom`) tartalmazza. A képet `GET /api/ajandek/foto?id=&t=` mutatja (a `t` HMAC; a kártya-oldal és az előnézet linkjében van).
**KV-kötés nélkül** a `/beallitas` `foto: false`-t ad, a felületen a fotófeltöltés rejtett, a design és az idézet viszont működik.
A KV létrehozása és a kötés a `wrangler.toml`-ban: lásd az élesítési ellenőrzőlistát.

**Metadata** (a PI-n, a `/fizetes` és az `/atutalas` is írja): `atvetel`, `kartya_tema`, `kartya_idezet`, `szemelyre_nev`, `foto_id`,
`foto_poz`. A szalon levele (és a kiállító oldal) kiírja az átvételt, a designt, az idézetet és hogy van-e fotó, és ad egy
**előnézeti linket** (`GET /api/ajandek/elonezet?pi=&t=`, a kiállító token; a kiállítás előtt is megmutatja a vevő kártyáját).
A vevő végleges kártyája (`GET kartya`) a szalon által beírt kóddal készül.

### API (`/api/ajandek/…`)

| végpont | |
|---|---|
| `GET beallitas` | `{ mod: 'elo'｜'teszt'｜'nincs', publikus_kulcs, azonnali_kartya, foto }` (`foto`: van-e KV-tároló a fotókhoz) |
| `POST fizetes` | PaymentIntent létrehozása/frissítése; az ár a szerveren |
| `GET rendeles?pi=&cs=` vagy `?pi=&rt=` | rendelés állapota (Stripe-tól visszakérdezve); hitelesítés: `client_secret`, vagy az **`rt`** (HMAC, csak olvasás – ez megy levélben; a módosító végpontokhoz nem jó). Visszatérítés/vita esetén `visszavonva: true`, a kártya `kartya.allapot: 'visszavonva'` (kód és link nélkül) |
| `POST szemelyre` | megajándékozott neve, üzenet, alkalom, átadás (csak fizetés után) |
| `GET kartya?pi=&t=` | nyomtatható kártya (ha kiállított); a `t` külön token (HMAC), **nem** a `client_secret` – a link továbbítható, a rendeléshez nem ad hozzáférést (a régi `pi+cs` alak is megy) |
| `GET/POST kiallit?pi=&t=` | a szalon kiállító linkje (HMAC-token; GET csak megerősít, POST: `kod` kötelező; utalásnál ez állítja „fizetve” állapotba a rendelést) |
| `POST webhook` | Stripe `payment_intent.succeeded` + `charge.refunded` + `charge.dispute.created` (aláírás-ellenőrzött, idempotens; visszatérítésnél/vitánál levél a szalonnak: töröld a kuponkódot) |
| `POST atutalas` | átutalási igény (nem vásárlás): Stripe-nyilvántartási rekord + levelek; telefon kötelező; a vevőlevélbe nem kerül szabad szöveg |
| `POST foto` | a személyre szabott kártya fotója (JPEG data URL, ≤ 700 KB) → `{ id }`; Cloudflare KV, IP-nként 12 / 10 perc; KV nélkül 503 |
| `GET foto?id=&t=` | a fotó (id + HMAC-token); privát, 1 évig gyorsítótárazható |
| `GET elonezet?pi=&t=` | a szalon előnézete a személyre szabott kártyáról (kiállító token) |

**Visszaélés elleni védelem** (`/fizetes`, `/szemelyre`, `/atutalas`): csak `application/json` (415), idegen
host/`cross-site` kérés tiltva (403), memóriában tartott, best-effort kérésszám-korlát kliens-IP-nként
(`/fizetes` 20, `/atutalas` 3, `/szemelyre` 30 kérés / 10 perc; 429). A korlát **függvénypéldányonként** él,
ezért több példány vagy újraindulás esetén lazább – élesben érdemes mellé Netlify rate limit / Cloudflare WAF
szabályt, vagy Turnstile-t tenni (külső fiók, jóváhagyás kell). A túl nagy kérés (32 KB, webhook 512 KB) 413,
a törzset be sem olvassa.

## Beállítás

Környezeti változók (Netlify: *Site configuration → Environment variables*; Cloudflare: *Settings →
Variables and Secrets*; az SMTP-változók ugyanazok, mint az űrlapoknál):

| változó | |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_…` (vagy korlátozott `rk_live_…`: PaymentIntents írás/olvasás) – **titkos** |
| `STRIPE_PUBLISHABLE_KEY` | `pk_live_…` (nyilvános; Cloudflare-en a `wrangler.toml` `[vars]` részébe kell, különben a felületen megadottat törli) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` az új webhook-végponthoz – **titkos** |
| `AJANDEK_TITOK` | a kuponkód, a kiállító link, a kártya- és rendelés-tokenek HMAC-kulcsa – **titkos, KÖTELEZŐ, legalább 32 karakter** (nélküle a motor nem indul: `mod: nincs`). Egyszer kell kitalálni és minden platformon ugyanaz legyen; utána ne változzon, különben a már kiküldött linkek érvénytelenek |
| `AJANDEK_BAZIS_URL` | nem kötelező: a levelekben lévő linkek eleje (alapból a kérés origin-je) |
| `AJANDEK_AZONNALI` | nem kötelező: `1` = azonnali teljesítés (lásd fent) |
| `AJANDEK_FOTOK` | Cloudflare **KV-kötés** (nem környezeti változó): a személyre szabott kártyák fotói; `wrangler.toml` `[[kv_namespaces]]` (Production) és `[[env.preview.kv_namespaces]]` (előnézet). Nélküle nincs fotófeltöltés |

Ha a Stripe-kulcsok hiányoznak, a `mod` `nincs`, és a checkout nem enged fizetni. Teszt-kulcsokkal
(`sk_test_`/`pk_test_`) a `mod` `teszt`: a lap „TESZT MÓD” szalagot mutat.

## Élesítési ellenőrzőlista

A merge előtt/után, ebben a sorrendben. (Amíg ez nincs végigvíve, **ne** linkeljünk az oldalra és
ne indítsunk hirdetést rá.)

- [ ] **Árak**: az `ajandek-adat.js` árai a mostani akcióval egyeznek (lásd fent).
- [x] **Vendégvélemény**: a tulajdonos 2026-10-03-án megadta a valódi Google-véleményt (szó szerint, `PROOFOK.general`) és az összegzést (4,9 · 1.259 vélemény, `GOOGLE`); az értékelés számát időnként frissíteni kell az `ajandek-adat.js`-ben (és a `foglalas/ajandek.html` statikus tartalékszövegében). Soha nem generált idézet.
- [ ] **Páros termék vizuálja** („két barátnő”, nem romantikus): nincs valódi kép → `TERMEKEK.paros.vizual` (`{asset_url}`) üres.
- [ ] **Stripe teszt-kör**: teszt-kulcsokkal egy teljes vásárlás (siker, elutasított kártya, 3DS), webhook és levelek ellenőrzése. *2026-10-03: a Cloudflare-előnézeten (`claude-ajandek-motor.mosaic-d77.pages.dev`, teszt-módú Stripe) a háttér-oldal végigment: PI létrehozás → megerősítés `pm_card_visa` teszt-tokennel → `payment_intent.succeeded` webhook (HTTP 200, aláírás rendben) → „kiállítottam” (két lépés, másodszor nem küld újat) → nyomtatható kártya + `AK-` kód; `pm_card_chargeDeclined` → `sikertelen`. A beágyazott Payment Element kézi próbája is megvolt (asztali Chrome): `4242…` siker, `4000 0000 0000 0002` elutasítás + újrapróbálás, `4000 0025 0000 3155` 3DS: mindhárom rendben; a levelek megérkeztek. Még hátra van: Apple Pay iPhone-on (a `pages.dev` előnézet domainje nincs bejegyezve, ott csak Revolut Pay látszott; az Apple Pay-t az `mosaicheadspa.hu` domain regisztrálása után lehet kipróbálni, élesítéskor, külön jóváhagyással).*
- [ ] **Stripe webhook-végpont** létrehozása (előbb teszt-módban a deploy preview címére, élesben csak külön jóváhagyással): `https://<host>/api/ajandek/webhook`, események: `payment_intent.succeeded`, `charge.refunded`, `charge.dispute.created` → a `whsec_…` a `STRIPE_WEBHOOK_SECRET`-be. A meglévő szamlabridge- és Zapier-webhookokhoz nem szabad nyúlni. *Teszt-módú végpont kész (`we_1UMVmpFv8vc2ArnLqiBzqIri`, a Cloudflare-előnézetre); az éles végpont az élesítés napján, külön jóváhagyással.*
- [ ] **Apple Pay**: a `mosaicheadspa.hu` domain regisztrálása a Stripe-ban (Payment method domains) és a `/.well-known/apple-developer-merchantid-domain-association` fájl kiszolgálása (Google Pay és kártya enélkül is megy).
- [ ] **Számla**: egy valódi (vagy teszt) fizetés után ellenőrizni, hogy a `szamlabridge` ebből is számlát készít (név, cím, ÁFA – a fizetőlinkek `automatic_tax`-szal mentek, ez nem).
- [ ] **Teljesítési SLA**: eldönteni, hogy a kártya kiállítása automatikus-e (`AJANDEK_AZONNALI=1`) vagy a szalon kézi lépése; csak ennek megfelelő ígéret szerepelhet az oldalon.
- [ ] **Mérés (GTM, Google Ads, Meta, TikTok)**: NEM ennek a fejlesztésnek a része; külön munkaterületen, másodlagos konverzióként, a 2026-10-12-i kapuig párhuzamos teszttel állítja be egy külön ablak (a `purchase` esemény szerződése fent). Az `/ajandek` címet addig **ne** linkeljük és ne hirdessük.
- [ ] **ÁSZF/impresszum**: a checkout-szöveg („fizetési kötelezettséggel jár”) jogi átnézése.
- [ ] **Egy merge/nap** a Netlify-kredit miatt; a PR-előnézeten (deploy-preview) tesztelj.

## Helyőrzők

A spec szerint hiányzó üzleti adatot nem találunk ki, kapcsos zárójeles helyőrző áll: `{asset_url}`
(Páros-kép). A vélemény és a Google-összegzés már valódi adat (lásd fent). A Stripe-konfiguráció és a
teljesítési SLA a fenti környezeti változókból jön; amíg nincsenek, a motor ezt jelzi, nem talál ki
értéket.

## Tesztelés

```bash
node tools/ajandek-teszt/szerver.mjs        # http://localhost:4195/ajandek  (mobil nézet: ?m=1)
node --test "tools/ajandek-teszt/*.test.mjs"   # a szerveroldali kezelő és az adapterek tesztjei (mock Stripe-pal; Node 22+ alatt a glob idézőjelben kell)
```

A helyi kiszolgáló a valódi kezelőt egy **mock Stripe API** ellen futtatja, és egy böngészős
Stripe-mockot (`stripe-mock.js`) tesz a lapba: a teszt-kártyaszám `4242 4242 4242 4242` sikeres,
`4000 0000 0000 0002` elutasított, `4000 0025 0000 3155` átirányításos (3DS-szerű) fizetés. Az
elfogott levelek: `/__teszt/levelek`. Éles kiszolgálón ezek a fájlok nincsenek: ott a valódi
`js.stripe.com` töltődik be. A mock a valódi Stripe.js `IntegrationError`ját is utánozza (a
`fields.billingDetails: 'never'` mezőit – a címnél `line2` és `state` is – át kell adni a
`confirmPayment`-nek, üres szöveg elég): ezt a hibát a Cloudflare-előnézeten a valódi Stripe-pal
találtuk meg (2026-10-03), a helyi teszt addig nem fogta meg.

## Oldal-átrendezés (2026-10-04, a tulajdonos kérései)

- **Hero:** az ismétlődő „6 hónapig felhasználható · online …” sor lekerült (az ikonos sor már mondja); a „4,9 · 1.259 Google-vélemény” sor kattintható, a Google-szekcióra görget.
- **Google-vélemények:** külön szekció; a **Trustindex** inline widgetje (az élő főoldal beágyazása: `assets/embed/c2eb0f_95e68e62….html`, iframe) a suti-hozzájárulás
  „funkcionális” kategóriája után tölt be (`mhSuti.engedely('fun')`), addig a tulajdonos által megadott valódi vélemény és egy „Vendégértékelések megjelenítése”
  gomb áll a helyén (ugyanúgy, mint az élő oldalon). A widget a saját élő számát mutatja (pl. 1255), a hero a tulajdonos számát (1.259): a kettő eltérhet.
- **Termékek:** a Gift Finder gombsor és a „Választott ajándék” összegző doboz megszűnt (ugyanazt mondta); 2026-10-04 délután a teljes választó rész a tulajdonos 5. mockupja szerint háromlépéses lett (lásd fent), a fizetés a 4. mockup szerint.
- **Testimonialok:** +4 valódi vendég-videó (Hédi, Koletta, Viki, Szandi; a Drive „720P_Mosaic Testimonial” mappából, 540x960-ra tömörítve, 6–9 MB). A „Karolin.mov” és a „Vali Úr.mov”
  nincs közöttük (az előbbi a variant-doksi szerint validálandó).
- **Pontosan ezt kapja / Miért MOSAIC:** lapozó (15 elem) ill. 14 képes galéria nagyítóval (nyilak, billentyűk, húzás).
- **Kártya-előnézet:** a valódi Canva-kártya (`DAG_yBRXLo0`, „Ajándékkártya A4 két oldalas (21 x 10 cm) másolata”, 4. oldal) előlapja, fekvő.
- **Kártya-formátum (a tulajdonos kérése, 2026-10-04): fekvő, félbehajtott A4.** A személyre szabott (otthon nyomtatott) kártya sablonja (`assets/js/ajandek-kartya.js`) már nem egy álló A4
  lap, hanem az A4-es (álló) lapon **két fekvő lap** (egyenként 210 x 148,5 mm = 794 x 561,5 px, 1,414 : 1): felül a **hátoldal** (180°-kal elforgatva: a kártya adatai: termék, érték,
  utalványkód, érvényesség, cím), alul az **előlap** (a személyre szabott rész: fotó, idézet, „NEKI: név”). Félbehajtva egy 21 x 14,85 cm-es fekvő kártya lesz (a szaggatott vonal a hajtás).
  A designer előnézete csak az előlapot mutatja, alatta egy „Fordítsd meg a kártyát” link 3D-ben megforgatja a hátoldalra (és vissza); a végleges oldal (`szemelyreSzabottKartyaOldal`) pontosan egy A4-es lapra nyomtat. A négy dizajn továbbra is
  ELŐZETES helyőrző: a végleges (Canva-ban készült) dizajnokat **fekvő, 21 x 14,85 cm-es** lapként kell készíteni (`TEMAK[].hatter` = szövegmentes hátterkép). A „standard” (szalon-)kártya
  (`kartyaOldal`, `kartya-hatter.jpg`) a tulajdonos eredeti Canva-terve: ugyanez a félbehajtott A4 (felül elforgatott fél), változatlan.

## Kis laptopra szabott méretezés és a választó egységes magassága (2026-10-04, a tulajdonos kérése)

- **Választó:** a „Válaszd ki az ajándékot” fejléc csak a címet és a kártya-képet tartalmazza (a hero-ban már elhangzott szövegek és a pipa-lista lekerültek); a három lépés (*Válassz élményt*, *Nézd meg, milyen*, *Vedd meg az ajándékkártyát*) **mindig azonos magas** (asztalon 610 px) és azonos vonalban kezdődik, bármelyik élmény van kijelölve; a 3. lépés leírása legfeljebb 4 sor. A számkörökben a szám pontosan középen áll (lining-számjegyek, nem a Playfair régi stílusú számjegyei).
- **Fizetés:** egy kis laptop képernyőjére (1366 x 768, de 1280 x 600-ig tesztelve) elfér a fizetés gombbal együtt: bal oldalt *1 Rendelésed* (karcsú) és *2 Adatok* (a mezőkben ikon, az adatok két-három oszlopos rácsban), jobb oldalt *3 Fizetés*. Alacsony (≤ 720 px) képernyőn a Rendelésed kártya tovább tömörödik.
- **Személyre szabó:** egy képernyőre elfér a „Tovább a fizetéshez” gombbal együtt (1366 x 650 px-en a gomb alja ~480 px): a kártya előlapja bal oldalt, jobb oldalt két oszlopban a vezérlők (design / fotó + idézet / név + gombok); a hátoldal a „Fordítsd meg a kártyát” linkkel nézhető meg.
- **Hero:** a négy bizalmi elem (Google-értékelés, 6 hónapig érvényes, online megvásárolható, személyre szabható kártya) 1240 px-es szélességtől egy sorban, ikonnal együtt áll (alatta 2 x 2); a „Már van ajándékkártyád? Foglalj időpontot a kuponkóddal” sor lekerült (a beváltás a „Hogyan működik?” 5. lépésében és a GYIK-ben szerepel).

## Videóbox-méretezés, ajándékozott neve, fizetési mód, a tulajdonos első kártyadizájnja (2026-10-04, a tulajdonos kérései)

- **Háromoszlopos választó:** a videóbox képaránya pontosan a videóé (3:4; a három kezelés-videó és poszter 540x720, tiszta, elmosott sávok nélkül), és **ez adja a három lépés
  magasságát** (1280 px-től három oszlop: termékek | videó ~390–400 px | vásárlás; 900–1279 px-en két oszlop + a vásárlás alatta; 900 px alatt egy oszlop). A termék-lista és a
  vásárlás-doboz `contain: size`-zal nem számít bele a sor magasságába, a videóbox adja; tartalmuk beleférjen (ezért a termék-kártya csak a nevet, az időt, a főt és az árat mutatja,
  a vásárlás-doboz szövegei rövidebbek). Ellenőrizve 1280–1920 px között mindhárom élménynél (a dobozok teteje/alja azonos, nincs túlcsordulás).
- **Ajándékozott neve (kötelező):** az *Adatok* kártya első mezője (`ah-ajandekozott`, max. 40 karakter), a szerver `ajandekozott` mezője is kötelező (`/fizetes`, `/atutalas`).
  A személyre szabó „Ajándékozott neve” mezőjével **egy érték** (`S.tervezo.nev`, mindkét mező egymást frissíti); a Stripe-rekordban `szemelyre_nev`, a szalon-levelekben
  „Megajándékozott”, a Salonic-linkben `nameTo`; a kártyán a „NEKI” alatt jelenik meg (szalonban átvételnél a standard kártyán).
  Sorrend a rácsban: ajándékozott neve | számlázási név, e-mail | telefon (csak átutalásnál), irányítószám | város | utca.
- **Fizetési mód (egy helyen):** kártya/Revolut/Google Pay (Stripe Payment Element) vagy **Banki átutalás**. Átutalásnál nincs kártyamező, a gomb „Rendelés elküldése — ár”,
  a „Fontos: átutalás esetén a kártyát csak az utalás visszaigazolása után tudjuk kiállítani, ezért nem kapod meg azonnal. Bankkártyás fizetésnél a kártyát automatikusan, azonnal
  küldjük.” üzenettel; a külön „Inkább átutalással fizetnék” link és panel megszűnt. Elküldés után az utalási adatok a fizetés kártyában jelennek meg (a választó, a gomb és az
  *Adatok* kártya letiltva). Az átutalás továbbra sem vásárlás (`bank_transfer_request`).
- **Tulajdonos első kártyadizájnja (`smaragd`, a feltöltött terv):** zöld-arany, bal oldalt íves fotóablak, jobbra logó + idézet + „NEKI” + név; hátoldal: termék, érték, kód,
  érvényesség. A terv előlapjáról/hátoldaláról a mintaszövegeket és a mintafotót kiszedtem (lásd az „5. kör / Kártyadizájnok (A5 vászon)” részt). A sablon (`ajandek-kartya.js`) a
  dizájnnak **saját koordináta-teret és képarányt** enged (`w`, `h`, `hatter`, `hat`); a nyomtató oldalon az A4 két felében középre igazítva áll (a hajtás a két fél között). A fotó az
  ívbe kerül, az **idézet és a név a biztonságos területen marad**: a betűméret lépcsőkben csökken a hosszal és a sorok számával (max. 160 karakter idézet, 40 karakter név), a dobozok
  `overflow: hidden`, így semmi nem lóg a levelekre, a keretre vagy a logóra (160 karakteres idézettel, 40 karakteres névvel, 8 soros szöveggel ellenőrizve).
- **Szövegek (a tulajdonos kérése):** „Mi az a Headspa és miért ilyen népszerű?” (alcímben a népszerűség okai); „Imádják a nők!” + „Nézd meg, mit mondanak a kezelés után :)”;
  „Több mint 1.300 db 5 csillagos értékelés!” (**a hero és a Trustindex jelenleg 1.259 / 1255 db-ot mutat, ezért a „több mint 1.300”-at a tulajdonosnak meg kell erősítenie**);
  „Kényeztetés a legmagasabb szinten”; „Személyre szabott ajándékkártya!” + a 3 kattintásos szerkesztést és az A5 méretet leíró bekezdés.

## Szöveg- és elrendezés-módosítások, 2. kör (2026-10-04, a tulajdonos kérései)

- **Fejléc:** a „Válaszd ki az ajándékot” fejlécben a kártya-kép középen áll (1100 px-től a három oszlop középső oszlopában, a videó felett; alatta a cím alatt középre igazítva).
- **Mi az a Headspa és miért ilyen népszerű?:** a videóbox és a mellette lévő szöveges doboz (kártya) egyforma magas (900 px-től; a videó kitölti a sor magasságát, `object-fit: cover`).
- **Miért a MOSAIC Headspa?:** új szöveg (legnagyobb headspa, 270 m², parkolás), alatta Google-értékelés jelvény (`data-google-pont` / `data-google-szam`, a `GOOGLE` adatból, a
  Google-szekcióra görget), az alapító kis képe (`assets/img/ajandek/alapito-feri.png`, az éles oldal fotójából), az idézete és az aláírása (Deák Ferenc István, a MOSAIC Headspa alapítója).
  A „jelvény” (badge) értelmezése: a tulajdonos nem részletezte, az éles főoldal csillagos értékelés-sorát követtem.
- **2 perc és már a Tiéd is!** (volt: Hogyan működik?): a lépések alatti szöveg mindenhol pontosan 2 soros (rövidített szövegek + `-webkit-line-clamp: 2`, `min-height: 2.9em`).
- **Kényeztetés a legmagasabb szinten:** a lapozó videó-dobozai nagyobbak (300 px), az időtartam nem látszik, a dobozok címe középre igazított.
- **Gombok:** az elsődleges gomb (`.ah-gomb-fo`) mindenhol a PMU-oldal gombszíne: arany átmenet (`#c6a346` → `#d9c164`), fehér felirat (az élő `/sminktetovalas-budapest` oldal
  gombjából mérve); a gomb formája változatlan (a PMU-oldal gombjai pill alakúak). A másodlagos (körvonalas) gomb marad.

## 3. kör (2026-10-04, a tulajdonos kérései)

- **Ajándékkártya-kép a „Válaszd ki az ajándékot” fejlécben:** 900 px-től abszolút pozíciójú: kicsit feljebb és jobbra, a hero-videó aljába (kb. 62 px) és a szekció tetejére „átlóg”
  (`top: -98px; left: max(412px, 49%)`), de a cím mellett marad (a címtől mindig jobbra: ellenőrizve 920–1920 px között). 900 px alatt a cím alatt, középen áll.
- **Átadás blokk:** a kép a tulajdonos nyilas képe (`assets/img/ajandek/atadas-szemelyre.jpg`: „Tölts fel bármilyen fotót / Írj ide bármit / Írd ide a neveteket / nevét”), a szöveg
  vele egyforma magas (a cím a kép tetejéhez, a lista az aljához igazodik, háttér nélkül). Ugyanígy a „Mi az a Headspa” blokk: egyforma magas, **fehér háttér nélkül**.
- **Miért a MOSAIC Headspa?:** nincs gomb Feri alatt, az idézet mögött nincs fehér kártya; a bal oszlop alja (Feri idézete) a jobb oldali „Itt találsz minket” doboz aljával egy vonalban.
  A dobozban pici térkép (OpenStreetMap beágyazás, 47.5247344, 19.0367534): harmadik fél tartalma, ezért a Trustindexhez hasonlóan csak a „funkcionális” hozzájárulás után tölt be
  (addig helyőrző + „Térkép megjelenítése” gomb: a gomb engedélyezi a kategóriát).
- **4 kezes videó:** a teljes „Hook1” felvétel (39,5 s, 540x720, 2,7 MB; korábban csak egy 7,8 s-os részlet volt); az utolsó jelenet régi számokat mutat (4,8 · 116 értékelés).
- **Lapozó:** a „Kiválasztom az ajándékot” gomb a videósor alatt középen.
- **Szabd személyre:** több levegő a fejléc fölött és a két doboz előtt; a „Tovább” gomb pontosan a fölötte lévő (idézet) cella szélességű és a név-mezővel egy sorban; a
  „Kihagyom a személyre szabást” alul, középen; a „Telefonról is jó. Húzással igazíthatod.” sor kikerült.
- **Gomb a választóban:** a személyre szabható digitális kártyánál „Tovább a személyre szabáshoz”, a szalonban átvételnél „Tovább a vásárláshoz”.
- **„TESZT MÓD” szalag (alul):** a tulajdonos kérése, hogy élesítéskor tűnjön el („majd szedd ki”). A szalag csak akkor jelenik meg, ha a szerver Stripe **teszt**-módot jelez
  (`S.mod === 'teszt'`, ugyanitt van a variáns-kapcsoló), így az éles Stripe-kulcsokra váltással magától megszűnik; az élesítési lépések közé tartozik az ellenőrzése. Addig marad,
  mert jelzi, hogy az előnézet nem valódi fizetés.

## 4. kör (2026-10-04, a tulajdonos kérései)

- **Mi az a Headspa / Átadás (nyilas kép):** a szöveg többé nem húzódik szét: a szöveg természetes magassága adja a sor magasságát, a kép/videó ehhez igazodik (a videóbox négyzetes
  képe összenyomva, `object-fit: cover`; a nyilas képet legfeljebb ~9% vágja alul/felül, a feliratok megmaradnak; 1180 px alatt az Átadás egymás alatt áll).
- **Miért a MOSAIC Headspa?:** a doboz alacsonyabb (a térkép a cím-lista mellett áll), így nincs nagy rés a jelvény és Feri idézete között; az alja továbbra is egy vonalban a dobozéval.
- **Fotó áthelyezése:** a kártyán húzással (egér/érintés, `grab` kurzor) és a „Áthelyezés” nyilakkal (←↑↓→, 10%-os lépések); az első fotónál egy rövid „Húzd a fotót az igazításhoz”
  jelzés látszik a kártyán (az első mozgatásra / nagyításra eltűnik). Nagyítás nélkül csak a kép túllógó tengelye mozdítható (a kép mindig kitölti az ívet).
- **Szövegszín:** az idézet (#fbed94) és a név (#fdea91) a tulajdonos tervének sárgája (a feltöltött mockupról mérve).
- **Törölt szövegek:** „Aktuális ár” a Rendelésed dobozban; „Add meg az adataidat a vásárláshoz és a számlázáshoz.” az Adatok címe mellől.
- **Üzenet a kártyára (átutalás, szalonban átvétel):** a mező `szemelyre_uzenet` néven a Stripe-rekordba, a szalon-levélbe és a kártya-oldalra (`kartyaOldal`: név + üzenet) kerül;
  az otthon nyomtatott (személyre szabott) kártyánál az üzenet a tervezőben megadott idézet.
- **Canva (átutalásos kártya):** a fiókban vannak Brand Template-ek (a Canva-összekötő tud sablonból kitölteni és PDF-et exportálni); a kártya jelenleg a saját nyomtató oldalunkról készül
  (ugyanaz a dizájn, nem kell hozzá Canva). Ha a szalon Canvában akarja szerkeszteni: a smaragd lapokból Brand Template készíthető kitölthető mezőkkel (fotó, idézet, név, kód).
- **Szabd személyre (szellősebb):** a három sor között nagyobb hely (20 px); a kártya egy kicsit lejjebb, fölötte „Így fog kinézni – élő előnézet” cím lefelé mutató nyíllal.
- **„Hogyan épül fel a kezelés?” (minden termékkártyán):** plusz sor a kártyán az ár fölött; rákattintva felugró ablak nyílik a kezelés lépéseivel (`TERMEKEK.*.kezeles.menet`: az éles
  ajándékkártya-oldalak „Mit tartalmaz a 80 perces (50+30) kényeztetés?” listái: egyéni: fejbőrkamerás diagnózis → pakolás → hajmosás → masszázs → gőzölés → hajszárítás; páros: ugyanez
  kettőtöknek; 4 kezes: pakolás → hajmosás → 8 féle masszázs két gyógymasszőrrel → gőzölés → hajszárítás). Az ablakban „Ezt választom” gomb; a kártyán belüli gomb nem választja ki a terméket.
  A három oszlop magassága közben változatlan (a kártyák sorai egyformák, a tartalom beleférnek: ellenőrizve 900–1920 px között).
- **Szövegek (a tulajdonos listája):** „Válassz Headspa kezelést”; „Nézd meg, hogyan történik” + „Les bele videón, milyen!”; „gyógymasszőr” → „profi masszőr” mindenhol; a Headspa-előnyök: Teljes stresszoldás,
  Lazító fejzuhany, Privát, csendes szoba, Gyönyörű haj; Átadás: „PDF formátumban”, „A4-es papírra nyomtatható” (Úgy van tervezve, hogy a nyomtatás után csak félbe kell hajtanod.),
  „Személyre szabható” (a megajándékozott neve és üzenet vagy a fotótok is a kártyára kerül); fizetés: „Bankkártya, Revolut, Google Pay – Az ajándékkártyát azonnal küldjük”, „Banki átutalás – Utalás
  után küldjük ki az ajándékkártyát”, a figyelmeztetésben „ajándékkártya”. A „Rendelésed” doboz hátteréből a levélminta kikerült. A vélemények alcíme alatt piros, lefelé mutató (finoman pattogó)
  nyíl a videókra.
- **Három kártyadizájn:** `smaragd`, `szalag` (pezsgőszínű, rózsaarany szalagok, **kör** fotóablak), `virag` (rózsaszín, cseresznyevirág, **lekerekített téglalap** fotóablak); sorrend: Smaragd,
  Szalag, Virág, majd a három előzetes (Krém, Homok, Fehér, változatlanul). Az idézet és a név betűmérete a dobozból **számolt lépcsők** szerint csökken (`idezetLepcso`, `nevLepcso`). A
  mintaszöveg (az előnézeten) pontosan olyan színű, mint a beírt szöveg (nem halvány). A nyomtató oldalon a magasabb lapok is elférnek az A4 felén. (A háttérképek jelenlegi, A5 vásznas
  változatát lásd az „5. kör”-ben; a korábbi, nyújtott változatok kikerültek.)
- **„Hogyan épül fel a kezelés?” felugró (átdolgozva):** a három kezelés saját szövege az **éles oldal árlistájának kezelés-kártyájáról**: egyéni = „50 perces MOSAIC ‘Relax’ Head Spa kezelés” (masszázs fókuszú,
  hajápolási elemekkel; 11 elem), „4 Kezes” (6 pont, kiemelve: 2 profi masszőr, 8 féle masszázs), Páros (12 elem, kiemelve: arc radírozás, méregtelenítő arcpakolás, pezsgő); mindegyiknél „+ 30 perc kímélő
  hajszárítás”, „Időtartam: 50+30 perc”, felül a kezelés alapképe. (A „gyógymasszőr” itt is „profi masszőr”.)
- **Gombok a blokkokban (középen):** „Személyre szabott ajándékkártya!” → „Összeállítom a saját kártyámat”; „2 perc és már a Tiéd is!” → „Kezdem az ajándékozást”; „Imádják a nők!” → „Én is ilyen élményt ajándékozok”
  (mind a kiválasztóra görget). A 2. lépés alcíme: „Indíts el a videót a kezelésről!”.
- **„Kihagyom a személyre szabást” → melyik kártya?** A *standard* MOSAIC-kártya (az eredeti, fekete-arany Canva-terv, `kartya-hatter.jpg`, A4 félbehajtva): rajta a megajándékozott neve (az „Ajándékozott neve” mező),
  üzenet (ha nincs: az alap mondat „Miképp szeretetem Feléd árad…”), a kezelés neve, az érték, a kód és az érvényesség. Otthon nyomtatott kártyánál nincs külön üzenet-lépés a fizetés után (szalonban átvételnél van).
- **Gombok (pontosítás):** a „Személyre szabott ajándékkártya!” blokkban a gomb („Összeállítom a saját kártyámat”) a **szöveges oszlop alatt, középen** áll (nem az egész szekció alatt), és a kép alja pontosan a gomb
  aljával van egy vonalban (1180 px-től egymás mellett; alatta egymás alatt). A „Kényeztetés a legmagasabb szinten” szekció alatt mégsem kell gomb (kikerült).
- **ChatGPT-prompt a dizájnok újragyártásához:** `AJANDEK-CHATGPT-PROMPT.md` (A5 fekvő, 2480 x 1754 px, szövegmentes, magenta fotóablak, közös elrendezési rács, ellenőrzőlista).

## 5. kör (2026-10-04, a tulajdonos kérései)

### Kártyadizájnok (A5 vászon)

- **Miért újra:** a korábbi háttereket (nem A5 arányú képekből) nyújtani kellett, ettől a keret levágottnak / a rajz összekuszáltnak látszott. A tulajdonos újra feltöltötte mindhárom dizájn
  mindkét oldalát **1491 x 1055 px-es, A5 fekvő (1,413 : 1) vászonként** (14–19. kép), ezért a háttér most **változatlan**: nincs vágás, nincs nyújtás, a kártya keretével, lekerekített
  sarkával és árnyékával együtt, ahogy a terv készült. (A kártya körül a terv saját vászonszéle látszik: Smaragd: fehéres, Virág: barackszínű, Szalag: nincs.) A teszt ellenőrzi, hogy
  a JPEG mérete pontosan a dizájn `w` x `h` értéke (1491 x 1055), és hogy minden dizájn A5 arányú.
- **Fájlok:** `assets/img/ajandek/kartya-{smaragd,szalag,virag}-{elol,hat}-a5.jpg` (új név, mert az eszközök éves gyorsítótárat kapnak: a régi néven maradt képet a böngésző megtartaná).
- **Amit kiszedtem a vászonról:** az idézet és a név mintaszövege; az előlapi mintafotó (Smaragd: a fotóív belseje sötét árnyalattal kitöltve, a vastag arany ív marad), a Szalag kör- és a Virág
  téglalap-ablakának fényképe / kamera-ikonja / felirata; a hátoldalon a termék-, érték-, kód- és érvényesség-szöveg. Maradt a háttéren: logó, „NEKI”, „AJÁNDÉKKÁRTYA” (Virág), „ÉRTÉKE”,
  „UTALVÁNYKÓD” + kódkeret, elválasztók, lábléc. A kiszedés **diffúziós kitöltés + finom zaj** (a környező háttérből), nem takarás: lásd `tools/kartya-hatter/feldolgoz.mjs`.
- **Geometria (a vászon pixeleiben):** Smaragd fotóív: x 158, y 150, 516 x 758 (félkör sugár 258, középpont 416;408); Szalag fotókör: x 85, y 281, 523 x 523 (középpont 346,5;542,5);
  Virág fotóablak: x 166, y 170, 439,5 x 685, sarok 15. A dobozokat (idézet, név, termék, érték, kód, érvényesség) a mintaszövegek mért középpontjára illesztettem (a hátoldalon a „ÉRTÉKE”
  felirat a háttéren marad, az érték mellette balra igazítva áll).
- **Betűk / színek a mintaszövegből:** a mintaszöveg szélességéhez illesztett betűméret és betűtáv (DOM-mal mérve): Smaragd termék: Playfair, 44 px, 0,12 em; Virág: Playfair, 47 px, 0,133 em;
  Szalag: Jost, 47,5 px, 0,096 em; értékek: 74,5 / 92 / 62,8 px (**lining számjegyek**, `font-variant-numeric: lining-nums`, mert a Playfair alapból régi stílusú számokat ad); kód: Jost,
  0,42 / 0,53 / 0,355 em; az idézet és a név a mintaszöveg méretéig nő (57,5 / 46 / 67,5 px; hosszabb szövegnél a lépcsők csökkentik). Színek: a mintaszöveg betűmagjának színe (`szin` a
  dizájnban, plusz `hely`: a fotóhely-jelző színe a világos ablakokon). A dizájn `hat.betu` mezője adja a termék / kód / érvényesség betűcsaládját és betűtávját (a betűtáv utolsó, hozzáadott
  hézagát a bal oldali kitöltés egyenlíti ki, `box-sizing: border-box`). **Figyelem:** a stílus-attribútumba (`style="..."`) kerülő betűcsaládnevek egyes idézőjelesek (`'Playfair Display'`), különben a
  többi deklaráció elveszik (a teszt ezt őrzi).
- **Felbontás:** 1491 px / 21 cm ≈ 180 dpi: képernyőre kiváló, otthoni nyomtatáshoz elfogadható. Élesebb nyomtatáshoz ugyanez a terv 2480 px széles vászonnal kellene (a koordináták ekkor
  1,663-szorosukra változnak; a `feldolgoz.mjs` ablakai is).

### Új kártyadizájn felvétele (pixelpontos, gyors munkafolyamat)

1. **A tervet A5 fekvő vászonként kell feltölteni** (210 x 148,5 mm; ajánlott 2480 x 1754 px, legalább 1491 x 1055), a kártyával a vásznon (a vászon szélén nem kell semmit levágni), **oldalanként egy
   kép**: az *előlap* mintaszöveggel (idézet, név) és mintafotóval; a *hátoldal* mintaadatokkal (termék, érték, kód, érvényesség). Nem kell két külön, rétegekre bontott fájl: a mintaszövegeket én
   szedem ki. A mintaszövegek legyenek igazi szövegek (nem betűk rajza), és olyan helyen álljanak, ahová a valódi szöveg kerülne.
2. **Amit megcsinálok (percek, nem órák):** a mintaszöveg-dobozok mérése (`tools/kartya-hatter/feldolgoz.mjs`), a háttér kitisztítása, a fotóablak (ív / kör / lekerekített téglalap) pixelpontos
   mérése, a betűméret / betűtáv / szín illesztése a mintaszöveghez (DOM-mérés), a dizájn felvétele az `ajandek-kartya.js`-be, teszt, élő összevetés (az eredeti kép és a megjelenő kártya 50-50%-os
   keveréke: ha a szöveg egymásra esik, a dizájn pontos).
3. **Ami a leggyorsabb forrás:** Canva (A5 fekvő lap, a fiókban vannak Brand Template-ek, az összekötő tud exportálni) vagy Figma (A5 keret, 2480 x 1754) — a lényeg a fix A5 vászon és a valódi
   szöveg; réteg-export nem szükséges. ChatGPT-képgenerálás kevésbé megbízható (a méret és az arány nem pontos), ezért a feltöltött vászon mérete a hibaforrás: a teszt ezt ellenőrzi.

## 6. kör (2026-10-04, a tulajdonos kérései)

- **„Hogyan épül fel a kezelés?” felugró:** asztalon (720 px-től) a **kép balra, állóban** (a termékkártya képe, ugyanazzal a képkivágással), mellette a szöveg (bevezető, egyoszlopos felsorolás, „+ 30 perc kímélő
  hajszárítás”, **Időtartam** – mind a jobb oszlopban), a kép pontosan olyan magas, mint a szöveg (a szöveg adja a magasságot, a kép `object-fit: cover`); az „Ezt választom” gomb alul középen. Mobilon (720 px alatt)
  változatlan: a kép felül, alatta a szöveg. A bezáró **X svg** (nem betű), ezért pontosan a kör közepén áll – ugyanígy a képnézegető, a videó és az új nagyító bezáró gombján.
- **Kártya-előnézet nagyítása (Szabd személyre):** az előnézeti kártyára kattintva / koppintva (a húzás a fotót mozgatja, nem nyit nagyítást), vagy a kártya jobb felső sarkában levő nagyító gombbal nagy kártya nyílik
  (előlap / hátoldal, „Fordítsd meg” gombbal). Asztalon a képernyőhöz illesztve (`min(100%, (100dvh - 150px) * 1,4133)`), mobilon 220 vw széles, ujjal mozgatható (középre görgetve nyílik). Esc / X / az ablak üres
  részére kattintás zár.
- **Fizetési módok:** a Stripe Payment Element elrendezése `tabs` helyett `accordion` (rádiógombos, egymás alatti, **egyforma magas, teljes szélességű** sorok: Kártya, Revolut Pay, Google Pay), így mobilon a harmadik fül
  nem szorul össze, és nem lehet mellé érinteni (a bejelentett „Google Pay-t választok, de a Revolut Pay jelölődik be” hiba oka a keskeny fülek voltak; ezt a tulajdonosnak telefonon újra ki kell próbálnia). A Revolut Pay
  és a Google Pay **nem vonható egy dobozba**: a Revolut Pay nincs az Express Checkout Elementben (ott Apple Pay, Google Pay, Link, PayPal, Klarna, Amazon Pay van), a Payment Element módjait pedig nem lehet összevonni.
- **Mobil (640 px alatt):** hero-jelvények: csak a Google-értékelés és a „6 hónapig érvényes”, egy sorban; a „Válaszd ki az ajándékot” cím nem látszik (csak a kártyakép, alatta több hely, majd „1 Válassz Headspa
  kezelést”); a szekciócímek (és a rövid alcímek) középre; a GYIK címe mindenhol „Kérdésed van? Megválaszoltuk.”; a termékválasztás után (egymás alatti elrendezésben) **automatikusan a 2. lépéshez / videóhoz görget**
  (`gorgessVideora`, a ragadós fejléc alá); a „Tovább a személyre szabáshoz” és a fizetés-gomb felirata egy sorban (360 px-en is), a gombok betűmérete a szélességhez igazodik.
- **Szabd személyre (mobil):** kompakt fejléc (kisebb „Vissza az ajándékhoz”, kisebb, középre igazított cím), nincs „Így fog kinézni” felirat, a **design-választó 3 × 2**, a „Fotó törlése” a fotóválasztó gomb mellett, a
  „Fordítsd meg” és a nagyítás gomb a kártya sarkában (kerek gombok): a kártya, a design-választó és a fotóbeállítások egy képernyőn látszanak.
- **Fizetés (mobil):** a „Rendelésed” sor ára kisebb, mellette lefelé mutató nyíl (nyitva: felfelé), jelezve, hogy lenyitható. A „Biztonságos fizetés — ár” gomb egy sorban (nowrap, a betűméret a szélességgel arányos).
- **Ismert, nem ehhez tartozó észrevétel:** az élő fejléc (Wix-klón) menüsora mobilon szélesebb a képernyőnél (`scrollWidth` ≈ 980 px); a tesztekben `overflow-x: clip`-pel kerüljük meg.

## 7. kör (2026-10-04, a tulajdonos kérései)

- **Felugró (asztali és mobil):** a jobb oszlopban fentről lefelé: bevezető, felsorolás, „+ 30 perc kímélő hajszárítás”, **Időtartam**, **„Ezt választom”**; a gomb alja pontosan a kép aljával van egy vonalban (mindhárom kezelésnél mérve), nincs külön alsó sáv. Mobilon (360 × 640-től) is kép balra + szöveg jobbra, **görgetés nélkül** (a mobil bevezető mondat elmarad).
- **Mobilon a termékválasztás után** a 2. lépés **címéhez** görget (a ragadós fejléc alatt, a cím látszik, nem a videó közepére).
- **Szabd személyre (mobil):** a design-választó **legördülő** (a kiválasztott design mini képe + neve, lenyitva a 3 × 2 rács), szorosabb név / „Tovább a fizetéshez” / „Kihagyom” sorok.
- **Fizetés:** a Stripe elem **fülek** (Kártya | Revolut fizetés | Google Pay), `paymentMethodOrder: ['card', 'revolut_pay', 'google_pay']`: a kártya az alapértelmezett, a másik két mód a kártyamező **felett** látszik (az accordion elrendezés a Revolut Pay-t elsőnek, kijelölve mutatta, ezért visszaálltunk a fülekre). A „Google Pay” fül csak olyan eszközön jelenik meg, ahol van Google Pay (a teszt-böngészőben nincs). A „Kártya” felirat a Stripe-é, nem átnevezhető. A „Titkosított kapcsolat · Stripe” felirat mobilon nincs.
- **Mobil szövegek rövidítve:** a hero alcíme nincs, a lépés-alcímek (1, 3) nincsenek, a termékkártyán „50 + 30 perc”, a „Vedd meg” doboz leírása és az átvétel-opciók alszövege nincs; a 3. lépés dobozában a termék neve **mindig egy sorban** (a betűméret a szélességhez igazodik); hero-jelvények egy sorban: „★★★★★ 4,9 · 1.259 vélemény” + „6 hónapig érvényes” (ikonjuk és szövegük egy vonalban, 360 px-en is egy sor).
- **„Céges számlát kérek” (mobil):** kisebb doboz, a cím és az „Add meg a céges számlázási adatokat.” egy-egy sorban (asztalon is ez az új szöveg).
- **Trustindex:** mobilon nincs gördítősáv (a widget lapozó-vonala elrejtve; a kártyák továbbra is húzhatók). **Térkép:** csak a nagyítás (+ / −) maradt, a hosszú OpenStreetMap-szöveg levágva, helyette pici „© OpenStreetMap” hivatkozás (a licenc kötelező forrásmegjelölése – ne vedd ki).
- **Régi ajándékkártya-űrlap (landing oldalak, szalon-levél „Fizető fél Keresztneve: Anita+3630”):** hiba volt: a böngésző automatikus kitöltése a telefonszám elejét a keresztnévbe is beírhatta, mert a Wix-mezőkön nem volt `autocomplete`. Most pontos típusok (`given-name`, `family-name`, `email`, `tel-national`, …), a név mezőkben nem lehet szám / + / @ (hibaüzenet, nem megy ki levélbe), a telefonszám országkóddal, egységesen megy a szalon levelébe (`+36305715516`). A már kiment levelek javítása kézzel.
- **Variánsok:** `?variant=general|friend|mother|for_her|partner|last_minute`: mind ugyanazt a javított oldalt mutatja (csak a hero szövege / médiája, a termék-sorrend, az első bizonyíték változik).

## 8. kör (2026-10-04, a tulajdonos kérései): a konfigurátor egy képernyőre
- **Mobil tervező:** a „1 Válassz designt” és a legördülő **egy sorban** (a cím nem törik); a „2 Fotó” cím, a „Másik fotó” gomb és a „Fotó törlése” **egy sorban**; alatta a Nagyítás-csúszka és egy szöveg: „Helyezd át a képet a kezeddel.” (asztalon: „…húzd a fotót a kártyán.”). Az **áthelyezés-nyilak** kikerültek a képernyőről (billentyűzettel / képernyőolvasóval fókuszban továbbra is elérhetők, láthatatlanul); a „3 Idézet” cím mobilon láthatatlan (a mező maga vezet), a **karakterszámláló** mindenhol kikerült (a 160 karakteres `maxlength` marad), az „Ajándékozott neve” felirata kisebb és az idézet alatt szorosan áll; a „Vissza az ajándékhoz” és a cím feljebb, kisebben; a kártya-előnézet max. 300 px. Eredmény: a teljes konfigurátor (a „Vissza” sortól a „Kihagyom” sorig) 390 × 780-on kb. 638 px, így a ragadós fejléc alatt egy képernyőre elfér (360 × 640-en is kb. 637 px).
- **Példaszövegek ki:** a fizetési űrlap és a tervező mezői üresek (nincs „pl. Kovács Anna”, e-mail, telefon, irányítószám, város, cím, cégnév, adószám, „Akinek az ajándékot szánod”, „pl. Anna”, az üzenet-mezők „Írd ide az üzenetet…” szövege). Kivétel: a Stripe saját kártyamezői („1234 1234 1234 1234”, „HH/ÉÉ”, „CVC”) és a tervező idézet-mezőjének útmutatója („Írd ide az idézetet vagy az üzenetet…”, mert mobilon a címe láthatatlan).

## 9. kör (2026-10-04, a tulajdonos kérései)
- **Egységes betűméretek (mint a sminktetoválás / PMU oldalon):** négy méret CSS-változóban (`--b1` szekciócím, `--b2` alcím / terméknév / ár, `--b3` szöveg / gomb, `--b4` apró szöveg) + a hero címe (`--bh`). Asztalon 36 / 22 / 16 / 13 és hero 50 px; mobilon (≤ 700 px) 28 / 19 / 15 / 12,5 és hero 28 px. Két betűtípus: **Playfair Display** (címek, nevek, árak) és **Jost** (szöveg); a Trustindex-widgetet (azonos eredetű iframe) is Jostra állítja a lapozó-sávot elrejtő beinjektált stílus. Kivételek: a bevitelmezők mindig 16 px-esek (iOS-en kisebb betű nagyítást okoz), az „AJÁNLOTT” jelölő 11 px (mint a PMU-oldal apró címkéi), az ikon-szerű karakterek (csillagok, ‹ › nyilak). Az egységesítés a `ajandek.css` végén álló, szerepek szerinti blokk (`!important` csak a `font-size`-on, mert a korábbi, szakaszonkénti felülírásokat egyben fedi); új elem felvételekor a megfelelő szerep-listához kell adni. Ellenőrzés: minden nézet (hero + lista, tervező, fizetés, felugró) minden szövege a négy méret egyikében van asztalon és mobilon (méréssel, a `getComputedStyle` alapján).
- **A „Milyen ajándékkártyát szeretnél?” választó:** az „AJÁNLOTT” jelölő az első opció alsó szélén, jobbra ül (nem takarja a termék nevét / árát).
- **Egyszerű, fotó nélküli dizájnok (Krém, Homok, Fehér):** a tulajdonos kérésére középre igazított, letisztult előlap: MOSAIC-felirat, AJÁNDÉKKÁRTYA, gyémántos elválasztók, középen az idézet (a hosszától függő betűméret, 160 karakterig belefér), alatta „NEKI” + név; Krém / Homok: finom kétszeres keret, Fehér: vékony petrol keret. Hátoldaluk a korábbi, letisztult hátlap. A tervezőben ezeknél **nincs fotó-blokk**, az idézet teljes szélességű (a lépés-szám 2), és a fotó nem kerül a rendelésbe / a kártyára. A Smaragd, a Szalag és a Virág a fotós dizájn.
- **Javítások (a tulajdonos észrevételei):** (1) A kártya belsejében lévő apró feliratok (a „HEADSPA AND HAIR”, a „NEKI”, az „UTALVÁNYKÓD”, az „ÉRTÉKE”) a 9. körös egységesítésben hibásan 13 px-es betűt kaptak (a Krém / Homok / Fehér dizájn előnézetén és a legördülő képein is látszott); most a `:not(.ak small)` kivétel a kártyát a saját (cqw) méretén hagyja. (2) A tervező alatti „Helyezd át a képet a kezeddel.” sor kikerült (elég a kártyán lévő „Húzd a fotót az igazításhoz” felirat). (3) Mobilon kicsi hely a fejléc és a „Vissza az ajándékhoz” között. (4) **Trustindex:** az iframe-nek nincs gördítősávja (`scrolling="no"` + `overflow: hidden`), és a magassága a **widget aljához** igazodik (ResizeObserver + betűtípus-betöltés + 30 s-ig lekérdezés), így a Jost betöltése / az újratördelés után sem lóg le; a magasságot a widgetből mérjük (a `body` / `html` a nézet magasságát veszi fel, abból mérve visszacsatolás lenne). **A saját tesztkörnyezetem eddig elrejtette a gördítősávokat** (`--hide-scrollbars`), ezért nem láttam: a tesztek mostantól látható gördítősávval futnak.
