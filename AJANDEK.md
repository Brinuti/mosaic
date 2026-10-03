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
a fizetést.

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
`product_type`; `add_payment_info`/`purchase`: `payment_method`; `purchase`: `transaction_id`
(a Stripe PaymentIntent azonosítója), `value`, `currency`.

**`purchase` kizárólag akkor megy ki, ha a szerver a Stripe-tól visszakérdezve „fizetve” állapotot
mond** (`GET /api/ajandek/rendeles`), és PaymentIntentenként legfeljebb egyszer (`localStorage`).
**Nem purchase:** Stripe-kattintás, átutalási igény (ez a külön `bank_transfer_request` esemény),
kártya-letöltés, beváltás.

A mérőkódok (GTM, GA4, Meta Pixel) a `suti.js`-ből jönnek, **csak a `mosaicheadspa.hu` domainen**
futnak. Az oldal a Headspa Meta-pixel oldallistájában van (mint a többi ajándékkártya-oldal).

> **A GTM-konténer nincs módosítva.** A `purchase` esemény a dataLayerbe kerül, de hogy a Google
> Ads / Meta / TikTok konverziós címkék arra épülnek-e, azt a GTM-ben kell beállítani. Eddig az
> ajándékkártya-vásárlás a `/success-ajandekkartya-stripe?ertek=…` oldal látogatásán alapult –
> az új folyamat nem oda érkezik.

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
| `GET rendeles?pi=&cs=` | rendelés állapota (Stripe-tól visszakérdezve); hitelesítés: `client_secret` |
| `POST szemelyre` | megajándékozott neve, üzenet, alkalom, átadás (csak fizetés után) |
| `GET kartya?pi=&t=` | nyomtatható kártya (ha kiállított); a `t` külön token (HMAC), **nem** a `client_secret` – a link továbbítható, a rendeléshez nem ad hozzáférést (a régi `pi+cs` alak is megy) |
| `GET/POST kiallit?pi=&t=` | a szalon „kiállítottam” linkje (HMAC-token; GET csak megerősít) |
| `POST webhook` | Stripe `payment_intent.succeeded` (aláírás-ellenőrzött, idempotens) |
| `POST atutalas` | átutalási igény (nem vásárlás) |

## Beállítás

Környezeti változók (Netlify: *Site configuration → Environment variables*; Cloudflare: *Settings →
Variables and Secrets*; az SMTP-változók ugyanazok, mint az űrlapoknál):

| változó | |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_…` (vagy korlátozott `rk_live_…`: PaymentIntents írás/olvasás) – **titkos** |
| `STRIPE_PUBLISHABLE_KEY` | `pk_live_…` (nyilvános; Cloudflare-en a `wrangler.toml` `[vars]` részébe kell, különben a felületen megadottat törli) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` az új webhook-végponthoz – **titkos** |
| `AJANDEK_TITOK` | a kuponkód és a kiállító link HMAC-kulcsa – **titkos**, egyszer kell kitalálni, utána ne változzon |
| `AJANDEK_BAZIS_URL` | nem kötelező: a levelekben lévő linkek eleje (alapból a kérés origin-je) |
| `AJANDEK_AZONNALI` | nem kötelező: `1` = azonnali teljesítés (lásd fent) |

Ha a Stripe-kulcsok hiányoznak, a `mod` `nincs`, és a checkout nem enged fizetni. Teszt-kulcsokkal
(`sk_test_`/`pk_test_`) a `mod` `teszt`: a lap „TESZT MÓD” szalagot mutat.

## Élesítési ellenőrzőlista

A merge előtt/után, ebben a sorrendben. (Amíg ez nincs végigvíve, **ne** linkeljünk az oldalra és
ne indítsunk hirdetést rá.)

- [ ] **Árak**: az `ajandek-adat.js` árai a mostani akcióval egyeznek (lásd fent).
- [ ] **Vendégvélemény**: a `{review}` helyőrzőt (`PROOFOK.general`) valódi, engedélyezett Google-vélemény váltsa; a csillag-összegzés számát is pótolni kell (`{aktuális Google értékelés}`). Soha nem generált idézet.
- [ ] **Páros termék vizuálja** („két barátnő”, nem romantikus): nincs valódi kép → `TERMEKEK.paros.vizual` (`{asset_url}`) üres.
- [ ] **Stripe teszt-kör**: teszt-kulcsokkal egy teljes vásárlás (siker, elutasított kártya, 3DS), webhook és levelek ellenőrzése.
- [ ] **Stripe webhook-végpont** létrehozása: `https://www.mosaicheadspa.hu/api/ajandek/webhook`, esemény: `payment_intent.succeeded` → a `whsec_…` a `STRIPE_WEBHOOK_SECRET`-be.
- [ ] **Apple Pay**: a `mosaicheadspa.hu` domain regisztrálása a Stripe-ban (Payment method domains) és a `/.well-known/apple-developer-merchantid-domain-association` fájl kiszolgálása (Google Pay és kártya enélkül is megy).
- [ ] **Számla**: egy valódi (vagy teszt) fizetés után ellenőrizni, hogy a `szamlabridge` ebből is számlát készít (név, cím, ÁFA – a fizetőlinkek `automatic_tax`-szal mentek, ez nem).
- [ ] **Teljesítési SLA**: eldönteni, hogy a kártya kiállítása automatikus-e (`AJANDEK_AZONNALI=1`) vagy a szalon kézi lépése; csak ennek megfelelő ígéret szerepelhet az oldalon.
- [ ] **GTM**: a `purchase` (és a többi) dataLayer-eseményre épülő címkék/konverziók beállítása (Google Ads, Meta, TikTok, GA4).
- [ ] **ÁSZF/impresszum**: a checkout-szöveg („fizetési kötelezettséggel jár”) jogi átnézése.
- [ ] **Egy merge/nap** a Netlify-kredit miatt; a PR-előnézeten (deploy-preview) tesztelj.

## Helyőrzők

A spec szerint hiányzó üzleti adatot nem találunk ki, kapcsos zárójeles helyőrző áll: `{review}`,
`{aktuális Google értékelés}` (vélemény), `{asset_url}` (Páros-kép). A Stripe-konfiguráció és a
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
`js.stripe.com` töltődik be.
