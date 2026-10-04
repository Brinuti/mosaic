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
| GENERAL hero, Gift Finder (1 kattintás, nincs reload), 3 termék, kiválasztott-állapot panel; a 6 variant (`general`, `friend`, `mother`, `for_her`, `partner`, `last_minute`) | a `NEEDS_MANUAL_VALIDATION` assetek (barátnős / páros / férfi-hook videók, TikTok-proofok) tulajdonosi validálása; a `last_minute` kézbesítési-idő állítása csak valódi SLA mellett |
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
oldalon krémszínű átmenet alatt futó szöveggel; egy rácsban a ikonos Gift Finder, a három képes termékkártya (Egyéni, Páros,
4 kezes: a Finder sorrendjével egyezően; kép + jelvény, cím, „50 perc kezelés + 30 perc szárítás”, rövid leírás, ár +
„Ajándékozom” gomb) és a jobb oldali „Így néz ki az ajándékkártya” előnézet (a **valódi Canva-kártya** felső, fejjel lefelé nyomtatott
fele 180°-kal elforgatva, `assets/img/ajandek/kartya-hatter.jpg`); „A vásárlás menete”; „Mit mondanak a vendégeink?” (**négy valódi
vendég-videó** modális lejátszóval + a valódi Google-vélemény és 4,9 / 1.259); „Ezt adod át neki” (fotó + a valódi kártya);
„Miért MOSAIC?” (három valódi szalonfotó + cím és elérhetőség); „Hogyan működik az ajándékozás?” + gyakori kérdések; a fizetési nézet
három oszlopban (1 Termék | 2 Adatok | 3 Fizetés). A mockup kitalált elemei NEM kerültek át: „azonnali kézbesítés”, a mockup
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
utána tegye nagyon egyszerűvé a megvásárlását.** A landing sorrendje: *hero (ár a CTA mellett, bizalmi sor)* → *Gift Finder + 3 termék + a
kártya előnézete* → *Ilyen a Head Spa (videó + élmény-elemek)* → *vendég-videók + a valódi Google-vélemény* → *Pontosan ezt kapja* → *Ezt
adod át neki* → *Miért MOSAIC? + helyszín* → *Hogyan működik? (5 lépés)* → *GYIK*; a checkout, a személyre szabó és a végső összegző ugyanazon az
oldalon, külön nézetben.

| # | pont | állapot |
|---|---|---|
| 1 | Minimal header | **szándékosan eltér**: az élő oldal fejléce (a tulajdonos kérése: „menü és footer az éles oldalról”). A fizetési nézetre szűkített (minimal) fejléc külön kérésre készíthető |
| 2 | Personafüggő felső rész | ✓ 6 variant (`?variant=general\|friend\|mother\|for_her\|partner\|last_minute`): hero cím / alcím / CTA / média, Gift Finder előválasztás, terméksorrend, megnyugtató sor; minden más közös. A `last_minute` **nem állít** kézbesítési időt (csak „Online megvásárolható.") |
| 3 | Hero eladja az ajándékot és a Head Spa-t | ✓ |
| 4 | Valódi MOSAIC fotó/videó a hero-ban | ✓ valódi fotó + csendes hero-videó (`general`: „szöveg nélkül.mp4”, `mother`: „Anya-lánya.MP4”, `last_minute`: „Hook1.MP4” kivágás); a nem validált variantok a `general` médiát kapják |
| 5 | Erős trust sor | ✓ 4,9 · 1.259, 6 hónap, online, személyre szabható kártya |
| 6 | Gift Finder | ✓ |
| 7 | 3 termék elkülönítve (ár + lényeg + CTA) | ✓ |
| 8 | Persona szerinti terméksorrend | ✓ barátnő/anya/pár: Páros elöl; általános és „neki”: Egyéni |
| 9 | „Ilyen a Head Spa” videós blokk | ✓ a tulajdonos „szöveg nélkül.mp4” felvétele (57 s, 640x640, hanggal; `HEADSPA_VIDEO`, négyzet alakú lejátszó) |
| 10 | Benefit, nem technikai leírás | ✓ új (`BENEFITOK`: kikapcsolódás, masszázs, vízélmény, teljes figyelem, rendezett haj) |
| 11 | Valódi videótestimonialok | ✓ 4 vendég |
| 12 | Férfi intentnél női reakciók | ✓ mind a négy vendég nő; a `for_her` variant ezt a sorrendet adja |
| 13 | „Pontosan ezt kapja” | ✓ új: időtartam, hány főre szól, ki végzi, fő elemek, helyszín, érvényesség, ár + gomb, termékenként |
| 14 | „Ezt adod át neki” | ✓ a valódi kártya + a DSC01457 fotó (Ajándékkártya / Képek; a variant-dokumentum szerint ennek a blokknak a közös fotója) |
| 15 | MOSAIC / helyszín proof | ✓ szalonfotók, cím, nyitvatartás, térkép-link |
| 16 | „Hogyan működik?” | ✓ 5 lépés: kiválasztás → személyre szabás → fizetés → átadás → beváltás |
| 17 | Gift-specifikus GYIK | ✓ átírva: érvényesség, átvétel, személyre szabás, fizetés, beváltás, a 3 termék különbsége; a Head Spa-tudnivalók a végén |
| 18 | Embedded checkout ugyanazon az oldalon | ✓ |
| 19 | E-mail + minimális adat | ⚠ a számlához név, irányítószám, város, utca is kell; csökkenthető, ha a számlázás (szamlabridge) nem igényli – döntés kell |
| 20 | Apple Pay / Google Pay / kártya elsődleges | ✓ átutalás másodlagos link |
| 21 | Ár mindig a CTA közelében | ✓ hero („26.900 Ft-tól”), kártyák, ablak, panel, fizetés gomb |
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

A termék „Ajándékozom” gombja előbb a **kezelés-bemutató ablakot** nyitja (leírás + videó; „Ezt ajándékozom” viszi
tovább a `kivalasztva` állapotba). A `tervezo` (mini személyre szabó) csak **otthon kinyomtatott** kártyánál van, és a
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

Eseménysorrend: `view_item` → `gift_finder_select` → `select_item` → `begin_checkout` →
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
2. **Utalás:** a vevő a fizetési oldalon az „Inkább átutalással fizetnék” linkre kattint, megadja a telefonszámát (kötelező, a
   Salonic-utalványhoz kell) és opcionálisan a megajándékozott nevét + üzenetet. A rendszer a Stripe-ban egy **nyilvántartási
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

**Kezelés-bemutató ablak.** A termékkártya „Ajándékozom” gombja `<dialog id="ah-kezeles-ablak">`-t nyit: fotó/videó, rövid leírás,
„Mi történik a kezelésen?” lista, ár, „Ezt ajándékozom” / „Másikat nézek”. A tartalom a `TERMEKEK.*.kezeles` mezőben van
(`leiras`, `lepesek`, `video`); a szövegek a MOSAIC élő oldalairól valók. **A videó helye üres**: `kezeles.video = { src, poster }`
(mp4; a Cloudflare Pages 25 MiB/fájl korlátja miatt tömörítve) – amíg nincs, az ablak a termék fotóját és „A kezelés videója
hamarosan itt lesz.” feliratot mutat. **Élesítés előtt mindhárom videót fel kell tölteni.**

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
