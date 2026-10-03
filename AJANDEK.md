# MOSAIC Gift Commerce Engine (`/ajandek`)

Ajándékkártya-vásárlási folyamat (e-commerce, nem foglalás): **egy közös commerce motor + egy
message-match variant réteg**. A fő mért esemény a **PAID PURCHASE** (a Stripe-fizetés
beérkezése), nem a CTA-kattintás, nem a Stripe-kattintás, nem az űrlap-beküldés.

> **Állapot (2026-10-03): P0 – csak a GENERAL variant kész.** Nem indexelhető (`noindex`), a
> főoldalról nem linkelt, nincs a sitemapben. Amíg nincs Stripe-kulcs beállítva, a checkout
> „az online fizetés nem érhető el” állapotot mutat – vásárolni nem lehet. **Élesítés előtt
> végig kell menni az [élesítési ellenőrzőlistán](#élesítési-ellenőrzőlista).**

## Mi van benne (P0) és mi nincs

| P0 (kész) | P1 (később, ugyanebbe a motorba) |
|---|---|
| GENERAL hero, Gift Finder (1 kattintás, nincs reload), 3 termék, kiválasztott-állapot panel | `for_her`, `together_friend`, `together_mother`, `together_partner`, `last_minute` variantok |
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
Elrendezés (második mockup): világos hero jobb oldali fotóval, ikonos Gift Finder, képes termékkártyák a
valódi kártya előnézetével („Így néz ki az ajándékkártya”), „A vásárlás menete”, élmény-blokk a videóval,
valódi vélemény + Google-összegzés, „Itt találsz minket” + gyakori kérdések (a válaszok az élő oldalról /
a jóváhagyott szövegekből), és a fizetési nézet három oszlopban (1 Termék | 2 Adatok | 3 Fizetés). A
mockup kitalált elemei NEM kerültek át: „azonnali kézbesítés”, „pár perc alatt elkészül”, videós
vendégvélemények, kitalált idézet, generált belső terek és térkép, „Kolosy tér”.
A képek valódi MOSAIC-fotók (`TERMEKEK.*.vizual`, a hero a `hero_media`): a **páros** termék
képe a MOSAIC egyetlen valódi páros fotója (egy nő és egy férfi vendég, két terapeuta); a spec
„két barátnő” képet kért – ha van ilyen fotó, a `TERMEKEK.paros.vizual`-t kell cserélni.

### Árak – egyetlen forrás

Az árak **csak** az `assets/js/ajandek-adat.js` `TERMEKEK.*.ar_ft` mezőjében vannak. A szerver ebből
számolja a PaymentIntent összegét (a böngésző által küldött összeg nem számít), a böngésző ebből
írja ki. A mostani értékek a MOSAIC **éles Stripe-fizetőlinkjeinek** árai (2026-10-03):
Egyéni 26.900 Ft, 4 kezes 39.900 Ft, Páros 53.800 Ft – az **októberi 20% kedvezménnyel**
(listaár 32.900 / 49.900 / 65.900 Ft). **A kedvezmény lejártakor itt kell átírni.**

## Állapotgép

```
bongeszes → kivalasztva → fizetes → feldolgozas → siker → szemelyre → osszegzo
                 ↑            ↓            ↓
                 └────────────┴── hiba ←───┘   (hiba → fizetes: az inputok megmaradnak)
```

Asztali és mobil **ugyanazt** az állapotgépet és ugyanazt a komponensfát használja (csak a CSS
különbözik). A böngésző Vissza gombja a checkoutból a „kiválasztva” állapotba visz. Stripe 3DS /
átirányítás után az oldal a `payment_intent` paraméterekből visszaáll, és a **szerver** ellenőrzi
a fizetést. Fizetés után a frissítés a személyre szabás lépését (`siker`/`szemelyre`) legfeljebb 30
percig állítja vissza; a végleges nézet (`osszegzo`, „Minden kész.”) után a frissítés **tiszta
lappal** indul (a rendelés a levélben lévő linkkel érhető el), és a „Újabb ajándékkártyát
vásárolok” link bármikor új vásárlást indít.

### Variant config (a komponensfa nem változik, csak a tartalom)

`VARIANTOK` az `ajandek-adat.js`-ben: `variant_id, hero_eyebrow, hero_title, hero_subtitle,
hero_cta, hero_media, hero_trust, product_order, featured_proof, objection_title,
objection_body, relationship, gift_context, occasion`. Routing: `?variant=<id>`; hiányzó,
érvénytelen vagy ismeretlen érték (pl. `__proto__`) → **GENERAL**. A variant a sessionben
megmarad, bekerül minden eseménybe és a PaymentIntent metadatába (a `purchase` ugyanahhoz a
forrás/variant attribúcióhoz kötődik). P1-ben a P1 variantok ugyanebbe az objektumba kerülnek.

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

**Teljesítés (kuponkód):** a kártya kuponkódját a szalon a Salonicban hozza létre kézzel (mint
eddig; a Salonic-nak nincs kuponkód-API-ja a repóban). Ezért a „kész” állapot nem automatikus:

1. A fizetés után a Stripe webhook (`POST /api/ajandek/webhook`) két levelet küld: a szalonnak
   (rendelés, **kuponkód**, vevő adatai, „kiállítottam” gomb) és a vevőnek („megkaptuk a fizetésed”).
2. A szalon a Salonicban létrehozza a kuponkódot (100% kedvezmény, 6 hónap), majd a levélben lévő
   gombbal **kiállítja** a kártyát (két lépés: megerősítő oldal → POST).
3. Ekkor a vevő levelet kap a nyomtatható kártya linkjével, és az order hub „Ajándékkártya
   letöltése” gombja is aktív lesz. Addig: „Készítjük az ajándékkártyádat…” (10 másodpercenként
   frissül).

A kuponkód determinisztikus (`AK-XXXX-XXXX`, HMAC a PaymentIntent azonosítóból; a rendelésszám `MH-…` kezdetű, hogy a kettő ne legyen összetéveszthető; **a Salonic elfogad-e kötőjeles kuponkódot, nincs ellenőrizve**). **Soha nem írunk
„perceken belül”, „azonnal”, „ma” ígéretet**, amíg ez nem garantált: ha a kódok előre kerülnek a
Salonicba, és a teljesítés tényleg azonnali, az `AJANDEK_AZONNALI=1` környezeti változó kapcsolja át
(ekkor a webhook rögtön kiállítja a kártyát, és a feliratok „perceken belül”-re váltanak).

**Letöltés:** a kártya egy nyomtatható HTML-oldal (`/api/ajandek/kartya`), a böngészőből
kinyomtatható vagy PDF-ként menthető. A hozzáférés külön tokenhez kötött (`?pi=&t=`, HMAC), így
az „Elküldöm e-mailben” gombbal továbbított link csak a kártyát mutatja, a rendelést nem.

**Átutalás:** kis másodlagos link; **nem vásárlás**. Elküldi a meglévő utalási adatokat (levél a
vevőnek és a szalonnak); a kártya az utalás beérkezése után készül.

### API (`/api/ajandek/…`)

| végpont | |
|---|---|
| `GET beallitas` | `{ mod: 'elo'｜'teszt'｜'nincs', publikus_kulcs, azonnali_kartya }` |
| `POST fizetes` | PaymentIntent létrehozása/frissítése; az ár a szerveren |
| `GET rendeles?pi=&cs=` vagy `?pi=&rt=` | rendelés állapota (Stripe-tól visszakérdezve); hitelesítés: `client_secret`, vagy az **`rt`** (HMAC, csak olvasás – ez megy levélben; a módosító végpontokhoz nem jó). Visszatérítés/vita esetén `visszavonva: true`, a kártya `kartya.allapot: 'visszavonva'` (kód és link nélkül) |
| `POST szemelyre` | megajándékozott neve, üzenet, alkalom, átadás (csak fizetés után) |
| `GET kartya?pi=&t=` | nyomtatható kártya (ha kiállított); a `t` külön token (HMAC), **nem** a `client_secret` – a link továbbítható, a rendeléshez nem ad hozzáférést (a régi `pi+cs` alak is megy) |
| `GET/POST kiallit?pi=&t=` | a szalon „kiállítottam” linkje (HMAC-token; GET csak megerősít) |
| `POST webhook` | Stripe `payment_intent.succeeded` + `charge.refunded` + `charge.dispute.created` (aláírás-ellenőrzött, idempotens; visszatérítésnél/vitánál levél a szalonnak: töröld a kuponkódot) |
| `POST atutalas` | átutalási igény (nem vásárlás); a vevőlevélbe nem kerül szabad szöveg |

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
