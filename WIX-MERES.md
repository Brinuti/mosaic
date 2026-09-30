# A mosaicheadspa.hu mérése a Wixen – teljes leírás

Állapot: 2026-09-30. Forrás: az élő `www.mosaicheadspa.hu` Wix-oldal. Ebben a dokumentumban
minden benne van, amit a mérésről találtam: honnan, mi fut, milyen feltétellel, milyen adattal,
és hová küldi. A végén szerepel az is, hogyan másolja ezt a statikus klón.

Rövidítések:
- **GTM**: Google Tag Manager
- **GA4**: Google Analytics 4
- **AW**: Google Ads
- **CAPI**: Meta Conversions API
- **sGTM**: szerveroldali GTM (Stape)

---

## 0. Összefoglaló egy képben

```
Böngésző (www.mosaicheadspa.hu, Wix)
│
├─ Wix „Custom code” beágyazások (Beállítások → Egyéni kód)
│   ├─ 4 db Meta-pixel, oldalanként más pixel, kategória: ESSENTIAL → hozzájárulás nélkül is fut
│   ├─ GTM-PST2HB22  (Wix „Advanced Consent Mode” sablon, Consent Mode v2)
│   ├─ GA4 G-H4206SQ0Q7 gtag.js (Wix „Advanced Consent Mode” sablon, send_page_view:false)
│   ├─ Trustindex richsnippet, FB domain-verifikáció
│   └─ Saját süti-sáv (a Wix consentPolicyManager-ét hívja)
│
├─ Wix saját analitikai csatornái („promoteAnalyticsChannels”)
│   ├─ googleTagManagerConsentMode → dataLayer: Pageview, page_view, lead, generate_lead
│   └─ googleAnalyticsConsentMode  → gtag: page_view, generate_lead
│
├─ GTM-PST2HB22 (v48, 69 tag, 96 változó)
│   ├─ Google tag G-H4206SQ0Q7, server_container_url = https://stape.mosaicheadspa.hu
│   ├─ Google Ads 16795940464: remarketing + 18 aktív konverziós címke URL/paraméter alapján
│   ├─ GA4-események (foglalás első/visszatérő, ajándékkártya, elysion…)
│   ├─ TikTok CTDGK5BC77U0PIODKP30 (alapkód + sablon-események)
│   ├─ Stape Data Tag → https://stape.mosaicheadspa.hu/data
│   └─ Egyedi HTML: Meta egyedi események (4 pixel), Zapier-webhook, Stripe-link dekorálás,
│      ajándékkártya-érték süti, újratöltés-védelem (localStorage)
│
├─ GA4 gtag-konténer (a GA4 felületén beállított dolgok)
│   ├─ „visit” = page_view másolat (Esemény létrehozása)
│   ├─ 8 további URL-alapú esemény + 20 kulcsesemény (konverzió)
│   └─ 2 URL-alapú Google Ads konverzió (a GA4-hez kötött AW-fiókból)
│
├─ Meta (Events Manager-beállítások, a pixel-configból olvasva)
│   ├─ Event Setup Tool: automatikus Purchase/Schedule a köszönőoldalakon
│   └─ CAPI Gateway (OpenBridge) pixelenként: capig.stape.de / capig.stape.do / capi-pmu.mosaicheadspa.hu
│
└─ TikTok (Events Manager-beállítások, a pixel-configból olvasva)
    └─ Event Builder: ClickButton, Lead, CompleteRegistration, Schedule URL/szöveg alapján

Külső rendszerek, amelyek visszaküldenek a köszönőoldalakra:
  Salonic foglaló (*.salonic.hu) → /success-foglalas, /fodrasz-ok, /oxigenterapia-ok, /elysion-ok, /pmu-ok …
  Stripe fizetési link (buy.stripe.com) → /success-ajandekkartya-stripe?session_id=…&ertek=…
```

---

## 1. Honnan származnak az adatok (módszer)

| Forrás | Mit ad | Hogyan értem el |
|---|---|---|
| Wix SSR-oldal (`view-source`) | `htmlEmbeds`: a „Custom code” beágyazások teljes kódja, pozíciója, oldalai (Wix-oldalazonosítóval), kategóriája | Az élő oldal HTML-jéből kinyerve; az oldalazonosítókat a sitemap/oldaladatok alapján feloldottam |
| `https://www.googletagmanager.com/gtm.js?id=GTM-PST2HB22` | A közzétett GTM-konténer teljes futtatható leírása (tagek, triggerek, változók, egyedi HTML) | Letöltve és visszafejtve (`resource.tags/macros/predicates/rules`) |
| `https://www.googletagmanager.com/gtag/js?id=G-H4206SQ0Q7` | A GA4-adatfolyam felületen beállított szabályai (események létrehozása, kulcsesemények, kereszt-domain, AW-link, bővített mérés) | Letöltve és visszafejtve |
| `https://connect.facebook.net/signals/config/<pixel>` | A 4 Meta-pixel Events Manager-beállításai (CAPI Gateway végpontok, automatikus egyeztetés, bővítmények) | Letöltve |
| `https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=CTDGK5BC77U0PIODKP30` | TikTok-pixel beállítás: Event Builder szabályok, bővítmények, automatikus egyeztetés | Letöltve |
| Wix thunderbolt JS-csomagok (reporter-api, Wix Forms app) | A Wix dataLayer-formátuma (`Pageview`, `page_view`, `lead`, `generate_lead`) és a `user_data` leképezés | Letöltve, a `Lead`/`PageView` kezelőt kiolvastam |
| Élő mérés Playwrighttal | Minden kimenő mérési kérés oldalanként (GA4, Meta, TikTok, Ads, Stape, ccm) | Headless Chromium valós Chrome UA-val, a mérőkéréseket 204-gyel elfogva (semmi nem ment ki); 8 oldal asztali + mobil nézetben |
| `window.wixDevelopersAnalytics.triggerEvent('Lead', …)` az élő oldalon | A pontos `generate_lead` dataLayer-sorozat | Élő oldalon meghívva, elfogott kérésekkel |
| GA4 Data API (property `properties/468699723`) | 28 napos alapszámok: események, hostok, oldalak, eszközök, kulcsesemények | Composio google_analytics kapcsolat |
| DNS (dns.google) | NS, A, CNAME, MX, TXT rekordok, köztük a mérési aldomainek | Távoli munkaterületről |
| Gmail (mosaicheadspa@gmail.com) | A Wix űrlap-automatizmusok leveleinek szövege és tárgya | Valódi Wix-levelekből |

**Mérési buktatók, amelyekbe beleütköztem:**
- Headless Chrome alapértelmezett UA-jával (`HeadlessChrome`) a Wix **nem indítja** a
  mérést. Valós Chrome UA és `--disable-blink-features=AutomationControlled` kell hozzá.
- A hozzájárulás alapértéke **földrajzi helytől függ**. EU/HU esetén (`gdprEnforcedGeo = true`)
  döntés előtt `ad_storage`, `analytics_storage` stb. értéke `denied`. Amerikai IP-ről a Wix
  alapból `granted`-et ad. A tesztekhez a süti-sávon „Elfogadom” került.
- Az élő oldalon a GYIK egy Common Ninja iframe-ben volt. A TikTok automatikus egyeztetése
  (EnrichAM) ezért nem látta az ott szereplő e-mail-címet. Beágyazott (nem iframe) GYIK esetén
  látja, ezért ez eltérést okoz.
- A Meta automatikus (Event Setup Tool) eseményei csak akkor jelennek meg, ha a fbevents a
  konfigurációval együtt töltődik be (ez nem mindig sikerül headless módban).

---

## 2. Wix „Custom code” beágyazások (Beállítások → Egyéni kód)

A Wix minden beágyazásnál tárolja a pozíciót (`head` / `bodyStart` / `bodyEnd`), a
„betöltés egyszer” kapcsolót (`loadOnce`), az oldalszűrést (`pages`) és a süti-kategóriát
(`category`). Az **ESSENTIAL** kategóriájú beágyazásokat a Wix hozzájárulás nélkül is betölti.

| # | Név | Pozíció | Oldalak | Kategória | Tartalom |
|---|---|---|---|---|---|
| 1 | FB domain verification | head | mind | ESSENTIAL | `<meta name="facebook-domain-verification" content="yaoi87nral4y1dniepta2xcfb5jwfy">` |
| 2 | Meta Pixel (Headspa) | head | 25 oldal (lent) | ESSENTIAL | standard Meta-alapkód: `fbq('init','3473839859576758'); fbq('track','PageView')` + noscript kép |
| 3 | Trustindex | head | mind | ESSENTIAL | `https://cdn.trustindex.io/assets/js/richsnippet.js?392183251480g320` (értékelés-csillagok, rich snippet) |
| 4 | Google Tag Manager (Advanced Consent Mode) | head | mind | – (Wix-sablon) | GTM-PST2HB22 a Wix hozzájárulás-kezelőjéhez kötve (részletek: 2.1) |
| 5 | Google Tag (Advanced Consent Mode) | head | mind | – (Wix-sablon) | gtag.js G-H4206SQ0Q7, `send_page_view:false` (részletek: 2.2) |
| 6 | MOSAIC – PMU Pixel | head | 4 oldal | ESSENTIAL | Meta-alapkód, `1019878750660854` + PageView |
| 7 | Meta Pixel (Fodrász) | bodyStart | 12 oldal | ESSENTIAL | Meta-alapkód, `1361403694872594` + PageView |
| 8 | Meta Pixel (Szőr) | bodyStart | 5 oldal | ESSENTIAL | Meta-alapkód, `643342342027957` + PageView |
| 9 | MOSAIC – Süti-sáv (saját, Claude) | bodyEnd | mind | ESSENTIAL | saját süti-sáv, a Wix `consentPolicyManager`-ét hívja (2.3) |

### Meta-pixelek oldalanként

Mind a négy pixel a standard alapkódot használja: `fbevents.js`, `init`, `track PageView`.
Egy oldalon csak egy pixel fut.

- **Headspa – 3473839859576758** (25 oldal): `/` (home), success-foglalas-egyeni-vip,
  popup-tn2x8, success-foglalas, head-spa-kedvezmeny, headspa-kupon, headspa-ferfiaknak,
  headspa-ajandekkartya, success-elofizetes, headspa-10szazalek-kedvezmennyel,
  headspa-arak-budapest, headspa-elofizetes, success-foglalas-4kezes, ajikartya-ok,
  headspa-budapest-hungary, head-spa-velemenyek, foglalas-ok, success-foglalas-paros,
  headspa-budapest, success-foglalas-paros-vip, success-ajandekkartya-stripe,
  4-kezes-headspa-ajandekkartya, paros-headspa-budapest, success-ajandekkartya,
  success-foglalas-egyeni
- **Fodrász – 1361403694872594** (12 oldal): fodraszat-foglalas, balayage-haj-festes-budapest,
  fodrasz-ok, noi-fodrasz-budapesten-30-szazalek-kedvezmennyel, noi-fodraszat-szoke,
  noi-fodraszat-hullam, 30szazalek, oxigenterapia-ok, noi-fodraszat-budapest,
  noi-fodrasz-budapest-balayage-hajfestes, noi-hajfestes-budapest, oxigenterapia-budapest
- **Szőr – 643342342027957** (5 oldal): lezeres-szortelenites-budapest, szortelenites-foglalas,
  elysion-ok, szor-konzi-ok, szortelenites-ok
- **PMU – 1019878750660854** (4 oldal): korrekcio-ok, pmu-ok, sminktetovalas-budapest,
  eltavolitas-ok
- A többi oldalon (pl. a többi ajándékkártya-landing, blog, ászf) **nincs** Meta-pixel.
  Kivétel: a GTM egyedi HTML-tagje a köszönőoldalakon maga is betölti a pixelt, ha nincs (4.6).

> **GDPR-megjegyzés:** mivel a pixelek ESSENTIAL kategóriában vannak, a PageView döntés
> nélkül és elutasítás után is kimegy. Ez tudatos maradt az adatsor folytonossága miatt.

### 2.1 GTM-beágyazás (Wix „Advanced Consent Mode” sablon)

- Létrehozza a `dataLayer`-t, és egy belső `gtag()`-pufferbe (`eventBuffer`) gyűjt, amíg a
  Wix hozzájárulás-kezelője fel nem áll.
- Figyelt események: `consentPolicyInitialized` (document), `TagManagerConfigSet` (window),
  `consentPolicyChanged` (document).
- Ha mindkettő kész (`onDoneInitilizing`):
  1. `consent default` a `evaluateConsentPolicy()` szerint. Ha `defaultPolicy` (nincs döntés)
     **és** `gdprEnforcedGeo`, akkor `advertising:false, analytics:false`, különben a Wix
     szabályzata.
  2. `dataLayer.push({site_id: <metaSiteId>})`
  3. `dataLayer.push({'gtm.start': …, event:'gtm.js'})`
  4. `dataLayer.push({'developer_id.dYzMzMD': true})` (Wix fejlesztői azonosító)
  5. a puffer kiürítése a dataLayer-be
- A Consent Mode leképezése:
  - `ad_storage`, `ad_user_data`, `ad_personalization` ← advertising
  - `analytics_storage` ← analytics
  - `functionality_storage` ← functional
  - `personalization_storage` és `security_storage` mindig `granted`
- Döntéskor `consent update`, majd `dataLayer.push({event:'consentPolicyChanged'})`.
- Wix-szerkesztői domaineken (`.wix.com`, `.editorx.com` stb.) minden alapból tiltva van.
- A beágyazás beregisztrálja magát a `window.promoteAnalyticsChannels` tömbbe
  `googleTagManagerConsentMode` néven, `report: gtag`. Ezen a csatornán küldi a Wix a saját
  eseményeit a dataLayer-be (3. fejezet).
- A betöltés a szokásos GTM-kóddal történik: `gtm.js?id=GTM-PST2HB22`.

### 2.2 GA4-beágyazás (Wix „Advanced Consent Mode” sablon)

- `<script async src="https://www.googletagmanager.com/gtag/js?id=G-H4206SQ0Q7">`
- Ugyanaz a hozzájárulás-logika, mint a GTM-nél. Utána:
  `gtag('js')`, `gtag('set','developer_id.dYzMzMD',true)`,
  `gtag('config','G-H4206SQ0Q7',{send_page_view:false})`.
- Beregisztrál `googleAnalyticsConsentMode` néven. A Wix ezen a csatornán küldi a
  `page_view`-t és a `generate_lead`-et gtag-hívásként.
- Az automatikus oldalmegtekintés ki van kapcsolva. A `page_view`-t a Wix küldi, minden
  oldalváltáskor.

### 2.3 Saját süti-sáv (Wix consentPolicyManager)

- A sáv szövege: „Sütiket használunk (részletek). [Beállítások] [Elfogadom]”.
- A beállításokban négy kategória van: Feltétlenül szükséges (fix), Funkcionális,
  Statisztika, Marketing.
- A döntést `consentPolicyManager.setConsentPolicy({essential:true, functional, analytics,
  advertising, dataToThirdParty: advertising})` rögzíti. Erre a Wix a fenti beágyazásokon át
  `consent update`-et küld.
- A sáv akkor jelenik meg, ha `getCurrentConsentPolicy().defaultPolicy === true`. Döntés után
  egy kis „Süti beállítások” gomb marad.
- `AUTO_REJTES_MS = 0`. Korábban 10 másodperc után a sáv döntés nélkül eltűnt, és a
  látogatók többségénél minden hirdetési süti tiltva maradt. 2026-09-28-án ezt javítottam.

---

## 3. A Wix saját dataLayer-/gtag-eseményei

A Wix a `promoteAnalyticsChannels` csatornákon keresztül küldi ezeket. A formátum a Wix
reporter-api kódjából és élő mérésből származik.

### 3.1 Oldalmegtekintés (minden oldalbetöltéskor és Wix-es navigációkor)

GTM-csatorna (dataLayer):
```js
{ event: 'Pageview', url: '/headspa-budapest', title: '<oldalcím>' }
{ ecommerce: null }
{ event: 'page_view', url: '/headspa-budapest', title: '<oldalcím>', page_type: 'static' }
```
Hozzájárulás-döntés után ezt követi: `{ event: 'consentPolicyChanged' }`.

GA4-csatorna (gtag): `gtag('event','page_view', {page_location, page_title, …})`, ami egy
`G-H4206SQ0Q7` `page_view` találat.

### 3.2 Űrlapküldés (Wix Forms, `Lead`)

A Wix Forms app beküldéskor ezt hívja:
```js
trackEvent('Lead', { formId, userData: <mezőértékek>, category: 'contact' | 'subscribe',
                     label: 'Form name: <űrlap neve>' })
```
A `category` értéke `subscribe`, ha az űrlap csak e-mail/feliratkozás jellegű, egyébként
`contact`. A mi mind a négy űrlapunknál `contact`.

GTM-csatorna (dataLayer), élőben ellenőrizve:
```js
{ event: 'lead', event_label: 'Form name: Ajándékkártya ', event_category: 'contact' }
{ ecommerce: null }
{ event: 'generate_lead', lead_category: 'contact', label: 'Form name: Ajándékkártya ',
  form_id: '7715ab48-7c85-4c1c-8fbc-a38c1cb1a23c',
  user_data: {
    ajandekozott_neve: 'Teszt Anna', fizeto_fel_vezetekneve: 'Teszt', fizeto_fel_keresztneve: 'Elek',
    cim: '1023 Budapest, Bécsi út 2.',
    milyen_kartyat_kersz: 'Egyéni 50 perces Headspa kezelés - 26.900 Ft (20% kedvezmény)',
    form_field_d3ec: true,            // ÁSZF-jelölőnégyzet
    email: 'teszt@pelda.hu', phone_number: '+36202474444' } }
```
GA4-csatorna (gtag):
```js
gtag('event','generate_lead', { event_category:'contact', event_action:'Submitted',
                                event_label:'Form name: Ajándékkártya ' })
```

**A `user_data` leképezése** (a Wix `R()` függvénye):
- Minden mező a saját Wix-kulcsán marad. Kivételt a kulcsnév (kisbetűsítve) tartalmaz-egyezése
  alapján felismert mezők képeznek:
  - `email` → `email`
  - `phone` / `phone_number` → `phone_number`
  - `first_name` / `firstname` → `address.first_name`
  - `last_name` / `lastname` / `surname` → `address.last_name`
  - `address` / `street` → `address.street`
  - `city` / `town` → `address.city`
  - `region` / `state` / `province` → `address.region`
  - `postal` / `zip` → `address.postal_code`
  - `country` → `address.country`
- Ha kulcs alapján nincs `email`, a Wix értékminta alapján keresi meg. Az e-mail-szerű érték a
  `email` kulcsra kerül (pl. az `e_mail_cim` mezőből). A telefonszámmal ugyanez történik: a
  `telefonszam` mezőből lesz `phone_number`, nemzetközi (+36…) formában.
- Emiatt a magyar kulcsú mezők (`fizeto_fel_keresztneve`, `cim` stb.) változatlan kulccsal
  maradnak a `user_data` alatt. A GTM ezekre hivatkozik (4.4).

A Wix egyéb e-kereskedelmi eseményeket is ismer (Purchase, AddToCart stb.). Ezek itt nem
futnak, mert nincs Wix Stores / Wix fizetés: a fizetés Stripe-linkkel történik.

---

## 4. GTM-PST2HB22 – teljes leltár (közzétett verzió: 48)

Tagtípusok:
- `__gaawe`: GA4-esemény
- `__googtag`: Google tag
- `__awct`: Ads-konverzió
- `__sp`: Ads-remarketing
- `__gclidw`: konverziós linker
- `__html`: egyedi HTML
- `__cl`: kattintásfigyelő
- `__cvt_MRQN8`: TikTok Pixel sablon
- `__cvt_MBTSV`: Stape Data Tag
- `__cvt_M63B8`: „Unique Event ID” sablon
- `__paused`: szüneteltetett

Az „ÉS” a feltételek együttes teljesülését jelenti, a „KIVÉVE” kizáró feltételt, a „TILTÁS”
blokkoló triggert.

### 4.1 Változók (a fontosak)

| Változó | Típus | Érték / logika |
|---|---|---|
| GA4 azonosító | konstans | `G-H4206SQ0Q7` |
| Ads azonosító | konstans | `16795940464` |
| TikTok pixel | konstans | `CTDGK5BC77U0PIODKP30` |
| Headspa Meta-pixel | konstans | `3473839859576758` |
| Stape szerver | konstans | `https://stape.mosaicheadspa.hu` |
| price | URL-paraméter | `?price=` |
| employee | URL-paraméter | `?employee=` |
| first_booking | URL-paraméter | `?first_booking=` (`true` = első foglalás) |
| location | URL-paraméter | `?location=` (pl. „Mosaic”) |
| ertek | URL-paraméter | `?ertek=` (Stripe ajándékkártya értéke) |
| session_id | URL-paraméter | `?session_id=` (Stripe checkout session) |
| _fbp, _fbc, _ttp, ttclid | süti | Meta/TikTok azonosítók |
| mh_ajk_ertek, mh_ajk_tx | süti | ajándékkártya-érték és tranzakció-ID (a 4.6-os egyedi HTML írja) |
| employee → üzletág | lookup | Patrik/Evelin/Betti → `fodraszat` |
| esemény → TikTok név | lookup | elso_foglalas→Schedule, sikeres_foglalas→SubmitApplication, view_item→ViewContent, begin_checkout→InitiateCheckout |
| esemény → TikTok név (2) | lookup | purchase→Purchase, begin_checkout→InitiationCheckout, view_item→ViewContent, select_employee→Lead |
| generate_lead → | lookup | `ajandek_kartya_utalas` |
| form_type → | lookup | gyógytorna-szolgáltatásnevek (egy korábbi projektből maradt, itt nem használt) |
| Egyedi rendelés-ID (Ads orderId) | JS | `<útvonal első 12 alfanumerikus karaktere>-<g>-<serviceId>-<startDate>`; a `g` paraméter és a `bookingUrl` (Salonic) `serviceId`/`startDate` paraméteréből |
| Headspa rendelés-ID | JS | `hs-<g>-<serviceId>-<startDate>` |
| TikTok event_id | JS | `hs-<g>-<serviceId>-<startDate>`, ennek hiányában `tt-<véletlen>` |
| tt_cid | JS | `first_booking=true` → `headspa_foglalas_elso`, egyébként `headspa_foglalas_visszajaro` |
| Újratöltés-figyelő | JS | kulcs `mh_koszono_<s\|session_id>` vagy `mh_koszono_<útvonal>\|<g>\|<startDate>`; ha már van localStorage-bejegyzés: `ujratoltes`, egyébként `elso`; azonosító nélkül `nincs-azonosito` |
| Salonic DOM-értékek | JS | ár (`.d-flex.justify-content-between > strong`), szolgáltatásnév, telefon (`.iti__selected-dial-code` + `#GuestDataForm_guestPhoneTemp`); ezek a Salonic-oldalakon futnak, a mi oldalunkon üresek |
| formData.* / user_data.* | dataLayer | e-mail, telefon, név, `user_data.fizeto_fel_keresztneve`, `…_vezetekneve`, `user_data.cim` |
| Unique Event ID | sablon | `gtmPageLoadId` + `gtmBrowserId` + `gtm.uniqueEventId` (deduplikációs event_id) |
| Enhanced conversions (awec) | kézi | e-mail: `inputs.GuestDataForm_guestEmail`, telefon: `inputs.GuestDataForm_guestPhoneFull` (Salonic) |

### 4.2 Alap-tagek (minden oldalon)

| Tag | Típus | Trigger | Beállítás |
|---|---|---|---|
| Google tag | googtag | gtm.init | `G-H4206SQ0Q7`; paraméterek: `event_id` (véletlen), `action_source=website`, `first_party_collection=true`, `x-fb-ck-fbp={_fbp}`, `x-fb-ck-fbc={_fbc}`, `x-ttk-ck-ttp={_ttp}`, `x-ttk-ck-ttclid={ttclid}`, **`server_container_url=https://stape.mosaicheadspa.hu`**. Emiatt minden GA4-találat a `https://stape.mosaicheadspa.hu/g/collect` címre megy, és minden GA4-eseményen ott van az `ep.action_source=website` |
| Ads remarketing | sp | gtm.init | 16795940464, konverziós linkerrel, eseményparaméterekkel, user ID-val |
| Konverziós linker | gclidw | gtm.js | kereszt-domain, URL-átadással (`url_passthrough`); linker-domainek: www.mosaicheadspa.hu, mosaicheadspa.hu, mosaicheadspa.salonic.hu, mosaic-hair.salonic.hu, mosaic-elysion.salonic.hu, mosaic-oxigen.salonic.hu, mosaic-pmu.salonic.hu |
| TikTok alapkód | html (consent: ad_storage) | gtm.js | TikTok-alapkód `CTDGK5BC77U0PIODKP30`, `ttq.page({event_id: <Unique Event ID>})` |
| Stripe-link dekorálás | html (consent: ad_storage, ad_user_data), laponként egyszer | gtm.js | kattintáskor minden `a[href*="buy.stripe.com"]` linkhez `client_reference_id=g_<gclid>__F__<fbclid>` paramétert ad. A gclid a `_gcl_aw` sütiből (3. ponttól) vagy az URL-ből, az fbclid a `_fbc` sütiből (4. ponttól) jön; csak `[A-Za-z0-9_-]` karakterek, max. 200 karakter |
| Ajándékkártya-érték | html, laponként egyszer | gtm.js | a `milyen_kartyat_kersz` rádiógomb kiválasztásakor a címke „… 26.900 Ft” részéből számot képez, és beírja az `mh_ajk_ertek` sütibe (2 óra). Küldéskor/kattintáskor létrehozza az `mh_ajk_tx=ajk-<idő>-<véletlen>` sütit |
| 9 db kattintásfigyelő | cl | gtm.js | automatikus kattintás-események. Egyik aktív tag sem használja őket, de futnak |

### 4.3 Google Ads konverziók (AW-16795940464) – mind `gtm.js` (oldalbetöltés) triggerrel

Közös beállítás: pénznem HUF, konverziós linker be, az érték a `?price=` paraméter, a
rendelés-ID az „Egyedi rendelés-ID” változó, hacsak a táblázat mást nem mond.

Közös hostfeltétel (ahol jelölve): `^(www\.)?mosaicheadspa\.hu$`.

| Címke | Feltétel | Érték | Rendelés-ID | Jelentés |
|---|---|---|---|---|
| `nJFWCNPd7fYbEPDs9sg-` | host ÉS útvonal tartalmazza `/success-foglalas` | price | hs-… | Headspa-foglalás (összes) |
| `xIXsCNbd7fYbEPDs9sg-` | host ÉS `first_booking=true` ÉS `/success-foglalas` | price | hs-… | Headspa első foglalás |
| `95YICNnd7fYbEPDs9sg-` | host ÉS `/success-foglalas` KIVÉVE `first_booking=true` | price | hs-… | Headspa visszatérő |
| `xXxpCMKJ-fYbEPDs9sg-` | `/success-ajandekkartya` KIVÉVE útvonal tartalmazza `stripe` | süti `mh_ajk_ertek` | süti `mh_ajk_tx` | Ajándékkártya, átutalás (Wix-űrlap) |
| `TuXOCMWJ-fYbEPDs9sg-` | `/success-ajandekkartya-stripe` | `?ertek` | `?session_id` | Ajándékkártya, Stripe |
| `lR7hCNHRiIkdEPDs9sg-` | host ÉS `/fodrasz-ok` ÉS `first_booking=true` KIVÉVE employee tartalmazza `Elysion` VAGY `price=0`; TILTÁS: újratöltés | price | egyedi | Fodrász első foglalás |
| `gnKICIeIp4kdEPDs9sg-` | host ÉS `/fodrasz-ok` ÉS `location` tartalmazza `Mosaic` KIVÉVE `first_booking=true` VAGY `Elysion`; TILTÁS: újratöltés | price | egyedi | Fodrász visszatérő |
| `DnDNCNTRiIkdEPDs9sg-` | host ÉS `/fodrasz-ok` ÉS `first_booking=true` ÉS `price=0` KIVÉVE `Elysion`; TILTÁS: újratöltés | **13000 (fix)** | egyedi | Fodrász ingyenes konzultáció |
| `tZ7zCLnriqwcEPDs9sg-` | host ÉS `first_booking=true` ÉS `/oxigenterapia-ok` KIVÉVE `price=4990` | price | egyedi | Oxigénterápia első |
| `uImLCLLV-YgdEPDs9sg-` | host ÉS `/oxigenterapia-ok` ÉS `price=4990` | price | egyedi | Oxigén konzultáció (4990 Ft) |
| `pLhlCISIp4kdEPDs9sg-` | host ÉS `/oxigenterapia-masodik`, VAGY host ÉS `/oxigenterapia-ok` KIVÉVE `first_booking=true` / `price=4990` | price | egyedi | Oxigén visszatérő |
| `LXcLCJ6ixPsbEPDs9sg-` | `/elysion-ok` | price | egyedi | Szőrtelenítés (Elysion) összes |
| `cPOaCIHr9ogdEPDs9sg-` | host ÉS `first_booking=true` ÉS `/elysion-ok` KIVÉVE `price=0`, VAGY host ÉS `/fodrasz-ok` ÉS `first_booking=true` ÉS employee `Elysion` KIVÉVE `price=0` | price | egyedi | Szőr első fizetős foglalás |
| `2jrCCJf--ogdEPDs9sg-` | host ÉS `first_booking=true` ÉS `price=0` ÉS `/elysion-ok`, VAGY host ÉS `/fodrasz-ok` ÉS `first_booking=true` ÉS `Elysion` ÉS `price=0` | **27000 (fix)** | egyedi | Szőr ingyenes konzultáció |
| `D0NNCIGIp4kdEPDs9sg-` | host ÉS `/szortelenites-ok`, VAGY host ÉS `/elysion-ok` KIVÉVE első, VAGY host ÉS `/fodrasz-ok` ÉS `Elysion` KIVÉVE első | price | egyedi | Szőr visszatérő |
| `LUiYCNWY-tocEPDs9sg-` | `/pmu-ok` | price | egyedi | PMU összes |
| `LNuBCOKivIkdEPDs9sg-` | host ÉS `first_booking=true` ÉS `/pmu-ok` | price | egyedi | PMU első |
| `0wUNCOWivIkdEPDs9sg-` | host ÉS `/pmu-ok` KIVÉVE `first_booking=true` | price | egyedi | PMU visszatérő |

**Szüneteltetett Ads-tagek** (5 konverzió és 1 remarketing): fodrász első, oxigén első, oxigén
`Oxigénterápia` employee, `/oxigenterapia-ok` összes, oxigén nem első, valamint a `head_spa`
eseményre futó remarketing (awud).

### 4.4 GA4-események a GTM-ből (mind G-H4206SQ0Q7, a Stape szerveren át)

| Esemény | Trigger | Paraméterek |
|---|---|---|
| **`gtm.js`** (!) | host ÉS `/success` az útvonalban ÉS gtm.js | `value=?price`, `currency=HUF`, `item_name` (Salonic-DOM, itt üres), `tt_event_id`, `tt_cid`. A tag eseménynév-mezője `{{Event}}`, ezért az esemény neve szó szerint `gtm.js`. Ez hibás beállítás, de így megy a GA4-be (28 nap alatt 526 db) |
| `view_item` | dataLayer `view_item` (Salonic) | – |
| `select_employee` | dataLayer `select_employee` (Salonic) | – |
| `ajandekkartya_utalas` | dataLayer **`generate_lead`**, laponként egyszer | – (**minden** Wix-űrlap generate_lead-jére fut, a PMU/PPC/fodrász űrlapra is) |
| `hair_book_appointment_first` | `/fodrasz-ok` ÉS `first_booking=true` ÉS `location` tartalmazza `Mosaic` KIVÉVE `Elysion`; TILTÁS: újratöltés | first_time, value, employee, currency=HUF |
| `hair_book_appointment_second` | host ÉS `/fodrasz-ok` ÉS `location` `Mosaic` KIVÉVE első / `Elysion`; TILTÁS: újratöltés | ugyanaz |
| `oxygen_headspa_first_appointment` | host ÉS `first_booking=true` ÉS `/oxigenterapia-ok` KIVÉVE `price=4990` | ugyanaz |
| `oxygen_headspa_second_appointment` | host ÉS `/oxigenterapia-masodik` | ugyanaz |
| `szor_book_appointment_second` | host ÉS `/szortelenites-ok` | ugyanaz |
| `elysion_ok` | `/elysion-ok` | value=price, currency=HUF |
| `ajandekkartya_stripe` | `/success-ajandekkartya-stripe`, laponként egyszer | value=`?ertek`, currency=HUF, transaction_id=`?session_id` |

### 4.5 TikTok (CTDGK5BC77U0PIODKP30) a GTM-ből

A TikTok-sablon tagek mind `ad_storage` hozzájáruláshoz kötöttek. Hashelés: `hashed`,
event_id: Unique Event ID.

| Esemény | Trigger | Adatok |
|---|---|---|
| alapkód + `ttq.page()` | gtm.js | lásd 4.2 |
| `SubmitForm` | `/fodrasz-ok` ÉS employee → `fodraszat` | e-mail: `formData.email`, telefon (Salonic-DOM), érték: Salonic-DOM, HUF |
| `SubmitForm` | `/fodrasz-ok` ÉS employee tartalmazza `Oxigénterápia` | ugyanaz |
| `InitiateCheckout` (lookup) | dataLayer `begin_checkout` | bővített e-kereskedelem (GA-formátumból), HUF |
| `ViewContent` (lookup) | dataLayer `view_item` | bővített e-kereskedelem, HUF |
| **`PlaceAnOrder`** | dataLayer **`generate_lead`** | e-mail: `user_data.email`, telefon: `user_data.phone_number` |

**Szüneteltetett:** 6 db `cvt_KFNBV` típusú tag. Ez egy másik sablon, a triggereik alapján
korábbi Meta-/CAPI-tagek lehettek: gtm.init, begin_checkout, fodrász-ok, head_spa, view_item,
oxygen_headspa, generate_lead.

### 4.6 Stape (szerveroldali mérés)

- **Stape Data Tag – foglalás** (`cvt_MBTSV`)
  - Triggerek: `/fodrasz-ok` + fodrász employee; `head_spa` esemény; `/fodrasz-ok` +
    `Oxigénterápia`; `oxygen_headspa` esemény.
  - Eseménynév: `{{Event}}` (egyedi).
  - Cél: `https://stape.mosaicheadspa.hu`, útvonal `/data`, protokoll v2, fetch.
  - Szkript: `https://stapecdn.com/dtag/v8.js`.
  - user_data: `email_address=formData.email`, `phone_number` (Salonic-DOM),
    `first_name=formData.first_name`, `last_name=formData.last_name`, `country=HU`.
- **Stape Data Tag – ajándékkártya**
  - Trigger: dataLayer `generate_lead`.
  - Szabványos esemény: **`purchase`**.
  - user_data: `email_address=user_data.email`, `phone_number=user_data.phone_number`,
    `first_name=user_data.fizeto_fel_keresztneve`,
    `last_name=user_data.fizeto_fel_vezetekneve`, `street=user_data.cim`, `country=HU`.
- **GA4 a Stape-en át:** a Google tag `server_container_url` beállítása miatt
  (`stape.mosaicheadspa.hu/g/collect`). Élőben ez is kimegy:
  `https://stape.mosaicheadspa.hu/_/service_worker/69f0/sw_iframe.html`.
- A **Stape szerverkonténer** belső beállítása (hová továbbít: GA4, Meta CAPI, TikTok Events
  API stb.) kívülről nem látható. A `x-fb-ck-*` és `x-ttk-ck-*` paraméterek azt jelzik, hogy a
  szerver Meta- és TikTok-továbbítást végez.

### 4.7 Egyedi HTML: Meta egyedi események + TikTok + Stape (`gtm.load`, köszönőoldalak)

Feltétel: host ÉS útvonal illeszkedik erre:
`/(fodrasz-ok|oxigenterapia-ok|oxigenterapia-masodik|elysion-ok|szortelenites-ok|pmu-ok|success-ajandekkartya|success-foglalas)`.

A logika:
1. Útvonal és paraméterek alapján kiválasztja a **pixelt**, az **üzletágat**, a **típust**, az
   **eseménynevet** és az **értéket**:

| Útvonal / feltétel | Pixel | content_category | content_type | Meta esemény | Érték |
|---|---|---|---|---|---|
| `/success-ajandekkartya-stripe` | Headspa | headspa | ajandekkartya | `HeadSpa_Ajandekkartya` | `?ertek` |
| `/success-ajandekkartya` | Headspa | headspa | ajandekkartya_utalas | `HeadSpa_AjandekkartyaUtalas` | süti `mh_ajk_ertek` |
| `/success-foglalas`, első | Headspa | headspa | foglalas_elso | `HeadSpa_FoglalasElso` | price |
| `/success-foglalas`, nem első | Headspa | headspa | foglalas_visszajaro | `HeadSpa_Visszajaro` | price |
| `/fodrasz-ok` + employee `Elysion`, első, `price=0` | Szőr | szor | konzultacio | `Szor_Konzultacio` | 27000 |
| `/fodrasz-ok` + `Elysion`, első | Szőr | szor | foglalas_elso | `Szor_FoglalasElso` | price |
| `/fodrasz-ok` + `Elysion`, nem első | Szőr | szor | foglalas_visszajaro | `Szor_Visszajaro` | price |
| `/fodrasz-ok`, első, `price=0` | Fodrász | fodrasz | konzultacio | `Fodrasz_Konzultacio` | 13000 |
| `/fodrasz-ok`, első | Fodrász | fodrasz | foglalas_elso | `Fodrasz_FoglalasElso` | price |
| `/fodrasz-ok`, nem első | Fodrász | fodrasz | foglalas_visszajaro | `Fodrasz_Visszajaro` | price |
| `/oxigenterapia-masodik` | Fodrász | oxigen | foglalas_visszajaro | `Oxigen_Visszajaro` | price |
| `/oxigenterapia-ok`, `price=4990` vagy 0 | Fodrász | oxigen | konzultacio | `Oxigen_Konzultacio` | price |
| `/oxigenterapia-ok`, első | Fodrász | oxigen | foglalas_elso | `Oxigen_FoglalasElso` | price |
| `/oxigenterapia-ok`, egyéb | Fodrász | oxigen | foglalas_visszajaro | `Oxigen_Visszajaro` | price |
| `/elysion-ok` (a `/fodrasz-ok`+Elysion ágaival azonos) | Szőr | szor | konzultacio / foglalas_elso / foglalas_visszajaro | `Szor_…` | 27000 / price |
| `/szortelenites-ok` | Szőr | szor | foglalas_visszajaro | `Szor_Visszajaro` | price |
| `/pmu-ok`, első | PMU | pmu | konzultacio (ha `price=0`) / kezeles | `PMU_Foglalas` | price |
| `/pmu-ok`, nem első | PMU | pmu | foglalas_visszajaro | `PMU_Visszajaro` | price |

2. **event_id** (deduplikáció):
   - Stripe: `st-<session_id>`
   - átutalás: süti `mh_ajk_tx`
   - foglalás: az egyedi rendelés-ID
   - ha egyik sincs: `r-<idő>-<véletlen>`
3. **Újraküldés-védelem:** localStorage `mh_meta_ce_<esemény>_<event_id vagy útvonal|g|bookingUrl|session_id>`.
   Ha már létezik, a tag nem küld semmit.
4. Ha nincs `fbq`, betölti a Meta-alapkódot. Ha a pixel még nincs inicializálva, lefut egy
   `fbq('init', pixel)`. Ezután:
   `fbq('trackSingleCustom', pixel, <esemény>, {content_category, content_type, content_name: ?service, currency:'HUF', value}, {eventID})`.
5. **TikTok** (a headspa kivételével): `ttq.track('CompletePayment', {content_id, content_type:'product', currency:'HUF', value}, {event_id})`.
   A TikTok SDK ezt **`Purchase`** néven küldi ki.
   - content_id szőr/fodrász/oxigén esetén: `<üzletág>_<típus>` (pl. `fodrasz_foglalas_elso`,
     `szor_konzultacio`)
   - content_id PMU esetén: `pmu_foglalas_<konzultacio|kezeles|visszajaro>`
6. **Stape pixel (GET):**
   `https://stape.mosaicheadspa.hu/data?v=2&event_name=meta_custom_event&m_px=<pixel>&m_ev=<esemény>&m_uzletag=…&m_tipus=…&event_id=…&page_location=…&m_value=…&m_service=…&m_tev=CompletePayment&m_tcid=<content_id>&external_id=<g>`
7. A localStorage-kulcsot beírja.

### 4.8 Egyedi HTML: Zapier-webhook (köszönőoldalak)

- Cél: `POST https://hooks.zapier.com/hooks/catch/25416243/0xYgLEnqBPdjKSkG/`
  (`sendBeacon`, text/plain; tartalék: fetch no-cors).
- Csak akkor küld, ha van `?bookingUrl` (amiből `startDate` jön) és `?employee`.
- JSON-tartalom:
  ```
  startDate, employee, price, first (first_booking), gclid (_gcl_aw), fbclid (_fbc-ből),
  ttclid, ttp (_ttp), ttid (TikTok event_id, csak headspa), eid (egyedi rendelés-ID),
  fbc, fbp, xid (?g), ua (max. 300 karakter), biz
  ```
- 4 változat:

| Tag | Oldal | `biz` |
|---|---|---|
| headspa | host + `/success-foglalas` | `headspa` |
| oxigén | host + `/oxigenterapia-ok` | `oxigen` |
| fodrász | host + `/fodrasz-ok` + első | `fodraszat` |
| egyéb | `/fodrasz-ok` (visszatérő, Mosaic, nem Elysion), `/oxigenterapia-masodik`, `/elysion-ok`, `/pmu-ok`, `/szortelenites-ok` | az útvonalból: `szor` / `pmu` / `oxigen` / `fodraszat` |

- Felhasználása (feltételezés): offline konverzió-feltöltés / CRM-sor.

### 4.9 Egyedi HTML: újratöltés-jelölés

- Trigger: `gtm.load` a köszönőoldalakon (a `success-foglalas` kivételével, plusz a
  `success-ajandekkartya-stripe`).
- Beírja: `localStorage['mh_koszono_<kulcs>'] = <idő>`.
- A következő betöltéskor az „Újratöltés-figyelő” változó értéke `ujratoltes` lesz. Ez
  blokkolja a fodrász-konverziókat és a `hair_book_*` GA4-eseményeket.

---

## 5. GA4 (G-H4206SQ0Q7) – a felületen beállított szabályok (gtag-konténer)

- **Adatfolyam-beállítások:**
  - kereszt-domain: `^mosaicheadspa\.hu$`, `mosaicheadspa\.salonic\.hu`
  - hivatkozó-kizárás: `mosaicheadspa\.salonic\.hu`
  - Google-jelek: BE
  - e-mail kitakarás: BE
  - felhasználói adatgyűjtés (automatikus e-mail): BE
- **Bővített mérés:** oldalmegtekintés (előzmény-változással), görgetés, kimenő kattintás,
  webhelyes keresés (`q,s,search,query,keyword`), videó, fájlletöltés, űrlap-interakció.
- **Események létrehozása** (kliensoldalon, a `page_view`-ból):

| Új esemény | Feltétel |
|---|---|
| **`visit`** | **minden `page_view` másolata**, a paraméterekkel együtt. Ezért van `visit` minden oldalmegtekintés mellett: nem a Wix küldi |
| `foglalas_ajikartya_ga4` | page_path tartalmazza `/success` |
| `ads_conversion_Id_pont_foglal_sa_Oldal_1` | page_path `/success-fodrasz`-szel kezdődik |
| `ads_conversion_Id_pont_foglal_sa_Oldal_2` | page_path `/success-foglalas`-sal kezdődik |
| `ads_conversion_Id_pont_foglal_sa_Oldal_3` | page_path `/success-ajandekkartya`-val kezdődik |
| `ads_conversion_Egy_b_Oldalbet_lt_s_www_1` | page_path `/success-foglalas`-sal kezdődik |
| `ads_conversion_Fodrasz_Foglalas_1` | page_path `/fodrasz-ok`-kal kezdődik |
| `ads_conversion_Vasarlas_Ajandekkartya_1` | page_path `/success-ajandekkartya`-val kezdődik |
| `ads_conversion_purchase` | domain `www.mosaicheadspa.hu` ÉS page_path `/success`-szel kezdődik |
| `Heaspa_Salonic_Ajandekkartya` | page_location tartalmazza `payment/success` (Salonic) |
| `Oxigén_foglalás` | page_location tartalmazza `mosaicheadspa.hu/oxigenterapia-ok` |
| `Dani_idopontfoglalas_uj_pageview` | page_location tartalmazza `/idopontfoglalas` |
| `Szörtelenités_elysion_ok` | page_location tartalmazza `elysion-ok` |

- **Kulcsesemények (konverziók):** purchase, foglalas_ajikartya_ga4, ads_conversion_Id_pont_foglal_sa_Oldal_1/2/3,
  ads_conversion_Fodrasz_Foglalas_1, ads_conversion_Egy_b_Oldalbet_lt_s_www_1,
  ads_conversion_Vasarlas_Ajandekkartya_1, ads_conversion_purchase, **page_view** (!),
  Heaspa_Salonic_Ajandekkartya, form_submit, Oxigén_foglalás, ajandekkartya_stripe,
  ajandekkartya_utalas, hair_book_appointment_first, hair_book_appointment_second,
  oxygen_headspa_second_appointment, Dani_idopontfoglalas_uj_pageview, Szörtelenités_elysion_ok
- **Google Ads (AW-16795940464) a gtag-konténerben:**
  - GA4-Ads összekapcsolás
  - Consent Mode
  - bővített konverzió: automatikus e-mail
  - `form_submit` és `user_data_lead`-ből first-party adat
  - URL-alapú konverziók:
    - `6oBECMPGs6kcEPDs9sg-`: page_view a `https://www.mosaicheadspa.hu/oxigenterapia-ok` címen
    - `jWtgCN7npJgaEPDs9sg-`: page_view a `https://www.mosaicheadspa.hu/success…` címen
      (élőben a `/success-ajandekkartya` oldalon mérve)

### 5.1 GA4 alapszámok (utolsó 28 nap, 2026-09-30-ig) – az átállás utáni összevetéshez

- **Események** (db / felhasználó):

| Esemény | Db | Felhasználó |
|---|---|---|
| page_view | 38 664 | 16 933 |
| visit | 36 970 | 16 273 |
| session_start | 19 088 | 15 701 |
| first_visit | 13 532 | 13 439 |
| user_engagement | 11 784 | 3 226 |
| scroll | 4 722 | 2 338 |
| view_item | 1 972 | 1 200 |
| select_employee | 1 445 | 648 |
| form_start | 655 | 481 |
| foglalas_ajikartya_ga4 | 577 | 423 |
| gtm.js | 526 | 400 |
| ads_conversion_Egy_b… | 233 | – |
| ads_conversion_Id_pont…_2 | 233 | – |
| click | 188 | – |
| ads_conversion_Fodrasz_Foglalas_1 | 183 | – |
| ads_conversion_Id_pont…_3 | 164 | – |
| ads_conversion_Vasarlas_Ajandekkartya_1 | 164 | – |
| ajandekkartya_stripe | 134 | – |
| hair_book_appointment_second | 93 | – |
| hair_book_appointment_first | 72 | – |
| Szörtelenités_elysion_ok | 28 | – |
| elysion_ok | 28 | – |
| form_submit | 25 | – |
| Oxigén_foglalás | 20 | – |
| oxygen_headspa_first_appointment | 15 | – |
| view_item_list | 5 | – |
| ajandekkartya_utalas | 3 | – |
| oxygen_headspa_second_appointment | 3 | – |
| Dani_idopontfoglalas_uj_pageview | 2 | – |
| Heaspa_Salonic_Ajandekkartya | 1 | – |
| szor_book_appointment_second | 1 | – |

- **Hostok** (page_view):

| Host | page_view |
|---|---|
| www.mosaicheadspa.hu | 23 700 |
| mosaicheadspa.salonic.hu | 8 103 |
| mosaic-hair.salonic.hu | 4 069 |
| mosaicheadspa.hu | 987 |
| mosaic-oxigen.salonic.hu | 967 |
| mosaic-elysion.salonic.hu | 636 |
| localhost | 131 |
| két további salonic-aldomain | 67, illetve 4 |

  A Salonic-foglaló ugyanezt a GA4-et futtatja, ezért ott is mér.
- **Top oldalak:** `/` 7 111, `/showServices/` 3 786, `/selectDate/` 3 153,
  `/sminktetovalas-budapest` 2 598, `/idpontfoglalas` 2 113, `/head-spa-kedvezmeny` 2 046,
  `/selectSpecialization/` 1 731, `/paros-headspa-budapest` 1 371,
  `/balayage-haj-festes-budapest` 1 184, `/selectEmployee/` 1 174, `/headspa-ajandekkartya`
  1 071, `/guestData/` 1 034, `/lezeres-szortelenites-budapest` 986,
  `/oxigenterapia-budapest` 766, `/services` 674
- **Eszközök** (page_view / felhasználó):

| Eszköz | page_view | Felhasználó |
|---|---|---|
| mobil | 32 627 | 19 283 |
| asztali | 5 769 | 2 377 |
| tablet | 260 | 148 |
| smart TV | 8 | 4 |

---

## 6. Meta – az Events Manager beállításai (pixel-configból)

- **Automatikus egyeztetés** mind a négy pixelen: em, fn, ln, ge, ph, ct, st, zp, db, country,
  external_id.
- **Bekapcsolt bővítmények:** InferredEvents (gombkattintás, bővített gombválasztó),
  IWLParameters, SmartSetup, **ESTRuleEngine**, OpenBridge, FirstPartyCookies (`_fbp`/`_fbc`,
  fbclid/brid/waaem paraméterek), Microdata (JSON-LD/OpenGraph), BotBlocking, ClientHint,
  PageMetadata, Timezone stb.
- **Event Setup Tool (kód nélküli események).** Ezeket a Meta a saját szabálymotorjával küldi,
  `es=automatic`, `cd[cs_est]=true`, `eid=ob3_plugin-set_…` jelöléssel. Élőben mérve:
  - `/success-ajandekkartya` (Headspa pixel): **Purchase** és **Schedule**
  - `/fodrasz-ok` (Fodrász pixel): **Schedule**
  - `/pmu-ok` (PMU pixel): **Schedule**

  A szabályok a Meta szerverén vannak, URL-hez kötve. Ugyanazon az URL-en változtatás nélkül
  működnek tovább.
- **Conversions API Gateway (OpenBridge).** A böngésző a pixeleseményeket ide is elküldi:

| Pixel | Végpont | Tartalék |
|---|---|---|
| Headspa 3473839859576758 | `https://capig.stape.de` | ugyanaz |
| Fodrász 1361403694872594 | `https://capig.stape.do` | ugyanaz |
| Szőr 643342342027957 | `https://capig.stape.de` | `capig-vladysla-97581-hgy3ps6pca-ew.a.run.app` |
| PMU 1019878750660854 | **`https://capi-pmu.mosaicheadspa.hu`** (saját aldomain) | `capig-denis-38353-kdw3w5dgoa-ew.a.run.app` |

  Ez a Meta CAPI (szerveroldali küldés) Stape-es megoldása. **A `capi-pmu` CNAME-et
  domainköltözéskor át kell vinni** (8. fejezet).
- **Egyedi események** (GTM-ből, 4.7): `HeadSpa_Ajandekkartya`, `HeadSpa_AjandekkartyaUtalas`,
  `HeadSpa_FoglalasElso`, `HeadSpa_Visszajaro`, `Fodrasz_Konzultacio`, `Fodrasz_FoglalasElso`,
  `Fodrasz_Visszajaro`, `Szor_Konzultacio`, `Szor_FoglalasElso`, `Szor_Visszajaro`,
  `Oxigen_Konzultacio`, `Oxigen_FoglalasElso`, `Oxigen_Visszajaro`, `PMU_Foglalas`,
  `PMU_Visszajaro`.

---

## 7. TikTok – CTDGK5BC77U0PIODKP30 (pixel-configból)

- **Bővítmények:** AdvancedMatching, **AutoAdvancedMatching**, AutoClick, AutoConfig
  (OpenGraph/microdata/JSON-LD), EventBuilder + RuleEngine, HistoryObserver, Identify,
  Metadata, PageData, EnableLPV (LandingPageView), Callback, DiagnosticsConsole.
- **Automatikus események** minden oldalon: `Pageview` (a GTM `ttq.page()`-ből),
  `LandingPageView`, `EngagedSession` (kb. 10 mp után), valamint `ClickButton` (AutoClick) és
  `EnrichAM`.
  - Az `EnrichAM` akkor küldődik, ha az automatikus egyeztetés e-mailt vagy telefonszámot talál
    az oldalon vagy űrlapon.
  - Tiltott kulcsszavak: ssn, card, cvv, pass, zip, address, gender, health…
  - Kizárt gombok: cancel, back, return.
- **Event Builder szabályok** (a TikTok felületén, kód nélkül):

| Esemény | Kiváltó | Feltétel |
|---|---|---|
| `ClickButton` | kattintás | a gomb szövege pontosan „időpontfoglalás” |
| `Lead` | oldalmegtekintés | URL tartalmazza `/payment/success` **vagy** `oxigenterapia-ok` |
| `CompleteRegistration` | oldalmegtekintés | URL tartalmazza `/elysion-ok` |
| `Schedule` | oldalmegtekintés | URL tartalmazza `mosaicheadspa.hu/success` |

- **GTM-ből:** `SubmitForm`, `InitiateCheckout`, `ViewContent`, `PlaceAnOrder` (4.5), valamint
  `Purchase` (a `CompletePayment` új neve, 4.7).

---

## 8. DNS és domain (2026-09-30)

| Rekord | Érték | Szerep |
|---|---|---|
| NS | `ns2.wixdns.net`, `ns3.wixdns.net` | most a Wix a DNS-szolgáltató; a domain a Websupportnál van regisztrálva |
| A `mosaicheadspa.hu` | 185.230.63.107 / .171 / .186 (Wix) | a gyökér 301-gyel a `www`-re irányít |
| CNAME `www` | `cdn3.wixdns.net` | Wix-oldal |
| **CNAME `stape`** | `euj.stape.io` | sGTM: GA4 `/g/collect`, Stape `/data` |
| **CNAME `capi-pmu`** | `capig.stape.cloud` | a PMU-pixel Meta CAPI Gateway-e |
| MX | `aspmx.l.google.com` (10), `alt1` (20), `alt2` (30), `alt3` (40), `alt4.aspmx.l.google.com` (50) | Google Workspace e-mail |
| TXT | `v=spf1 include:_spf.google.com ~all` | SPF |
| TXT | `google-site-verification=IteLJpEtWAiDMbUgFBetFV4EdKeAcH-qQ76LmLv3LCc` | Search Console |
| – | nincs DMARC, nincs `google._domainkey` DKIM | – |

A Facebook-domainverifikáció **meta tagként** van az oldalon (2. fejezet, 1. sor), nem DNS-ben.

---

## 9. Űrlapok (Wix Forms) és levelek

| Űrlap (Wix-név) | Form ID | Hol | Mezőkulcsok | Átirányítás küldés után |
|---|---|---|---|---|
| `Ajándékkártya ` (szóközzel a végén) | 7715ab48-7c85-4c1c-8fbc-a38c1cb1a23c | 10 ajándékkártya-landing: headspa-ajandekkartya, 4-kezes-, -anyukaknak, -noknek, -fiataloknak (ajandakkartya), paros-csajos-, japan-, -ezo, ajandekkartya-ugc, headspa-self-care | fizeto_fel_keresztneve, fizeto_fel_vezetekneve, e_mail_cim, telefonszam, cim, cegnev_opcionalis, ceg_adoszam_opcionalis, ajandekozott_neve, milyen_kartyat_kersz (rádió, ár a címkében), form_field_d3ec (ÁSZF) | `/success-ajandekkartya` |
| `Smink form` | 875a7aa0-161e-464f-9f14-24706dcccd86 | pmu-urlap | nev, telefonszam, szolgaltatas, volt_mar_korabban_tetovalasod, mit_beszeljuenk_at_a_foglalas_elott | `/pmu-vh` |
| `PPC űrlap` | 5b88872c-2a75-4ae1-9376-fdcced9f5ff4 | ppc-allashirdetes | first_name, email, phone, tell_us_what_you_need_help_with, miert_valtanal, form_field, form_field_1, miert_gondolod_hogy_alacsonyabb_cpa_kat_tudnal_elerni_mint_en_10, google_ads, meta_ads, meta_ads_1, wix, wordpress_ben_melyik_szerkesztot_hasznalod | `/allashirdetes-ok` |
| `Fodrász` | 86cf1fc1-4770-408e-b0a0-d3cf7c3bb447 | fodrász-álláshirdetés | first_name, email, phone, melyik_evben_szuelettel, hany_ev_tapasztalatod_van, hol_dolgozol_es_miert_valtanal, fb_insta_tiktok_referenciaid_linkje (+ képfeltöltés) | `/fodrasz-allas-ok` |

- Minden Wix-űrlapon captcha-védelem van. Beküldéskor a 3.2 szerinti `lead` / `generate_lead`
  sorozat megy ki.
- Mérési következmény: **bármelyik** űrlap beküldése elindítja az alábbiakat, mert a
  triggerük a `generate_lead`, nem az űrlap azonosítója:
  - GA4 `ajandekkartya_utalas`
  - TikTok `PlaceAnOrder`
  - Stape `purchase`
- **Wix-automatizmusok (e-mailek):** a Wix minden űrlapnál csak a szalonnak küld értesítést
  (mosaicheadspa@gmail.com). Kivétel az átutalásos ajándékkártya: ott a vevő is kap levelet.

| Űrlap | Levél tárgya |
|---|---|
| Ajándékkártya (szalonnak) | „Ajándékkártya  Előreutalásos ajándékkártyát vett” |
| Ajándékkártya (vevőnek) | „MOSAIC ajándékkártya utalási adatok + infók” |
| Smink | „Új Smink form-beküldés érkezett” |
| Fodrász | „Új fodrász jelentkezett” |
| PPC | „Új PPC-jelentkezés érkezett” |

---

## 10. Külső folyamatok, amelyek a mérést táplálják

- **Salonic online foglaló** (`mosaicheadspa.salonic.hu`, `mosaic-hair.`, `mosaic-oxigen.`,
  `mosaic-elysion.`, `mosaic-pmu.salonic.hu`):
  - Sikeres foglalás után a mi köszönőoldalunkra irányít, ilyen paraméterekkel:
    `?first_booking=true|false&price=<Ft>&employee=<név>&location=<hely>&service=<szolg.>&g=<vendég-ID>&bookingUrl=<Salonic URL serviceId- és startDate-tel>`.
  - Ezekből épül minden konverzióérték, rendelés-ID és deduplikációs azonosító.
  - A foglaló ugyanazt a GA4-et futtatja (a GA4-hostok között ott vannak a salonic-aldomainek), és a
    dataLayer-eseményekből ítélve a GTM-et is; a `view_item`, `select_employee`,
    `begin_checkout` események onnan jönnek. A linker és a kereszt-domain beállítás köti össze
    a munkameneteket.
- **Stripe fizetési linkek** (`buy.stripe.com`):
  - Kattintáskor a GTM beírja a `client_reference_id=g_<gclid>__F__<fbclid>` paramétert.
  - Fizetés után a Stripe a
    `/success-ajandekkartya-stripe?session_id=<cs_…>&ertek=<Ft>` címre irányít.
- **Zapier**: a köszönőoldalakról kapja a foglalás és a kattintás-azonosítók adatait (4.8).

---

## 11. Mit mértem élőben, oldalanként (asztali és mobil azonos)

Minden oldalon kimegy:
- GA4 `page_view` és `visit` (Stape `/g/collect`, `ep.action_source=website`)
- az oldal Meta-pixelének `PageView`-ja (ha van pixel)
- TikTok `Pageview`, `LandingPageView`, `EngagedSession`
- Google Ads remarketing (2 kérés)
- `www.google.com/ccm/collect` (3 kérés)
- Stape `sw_iframe`
- dataLayer: `Pageview`, `page_view`, `consentPolicyChanged`

Többlet az egyes oldalakon:

| Oldal | Többlet |
|---|---|
| `/`, `/headspa-ajandekkartya`, `/noi-fodraszat-budapest`, `/lezeres-szortelenites-budapest`, `/sminktetovalas-budapest` | nincs; a pixel oldalanként: Headspa / Headspa / Fodrász / Szőr / PMU |
| `/success-ajandekkartya` | Ads `xXxpCMKJ-fYbEPDs9sg-` + `jWtgCN7npJgaEPDs9sg-`; GA4 `gtm.js`, `foglalas_ajikartya_ga4`, `ads_conversion_Id_pont…_3`, `ads_conversion_Vasarlas_Ajandekkartya_1`, `scroll`; Meta `HeadSpa_AjandekkartyaUtalas` + automatikus `Purchase` és `Schedule`; TikTok `Schedule`; Stape `/data` `meta_custom_event` |
| `/fodrasz-ok?first_booking=true&price=12000&employee=Mosaic Hair` | Ads `lR7hCNHRiIkdEPDs9sg-`; GA4 `ads_conversion_Fodrasz_Foglalas_1`, `scroll`; Meta `Fodrasz_FoglalasElso` (value 12000) + automatikus `Schedule`; TikTok `Purchase` (content_id `fodrasz_foglalas_elso`); Stape `meta_custom_event` |
| `/pmu-ok?first_booking=true&…` | Ads `LNuBCOKivIkdEPDs9sg-` + `LUiYCNWY-tocEPDs9sg-`; GA4 `scroll`; Meta `PMU_Foglalas` + automatikus `Schedule`; TikTok `Purchase`; Stape `meta_custom_event` |
| Wix-űrlap beküldése | dataLayer `lead`, `generate_lead`; GA4 `ajandekkartya_utalas` (Stape), gtag `generate_lead`; Stape `/data` `purchase`; TikTok `PlaceAnOrder` + `EnrichAM` |

---

## 12. Ismert furcsaságok / hibák a mostani beállításban (változatlanul hagytam)

1. **GA4 `gtm.js` esemény.** A `/success*` oldalakon futó GA4-tag eseményneve `{{Event}}`,
   ezért az esemény neve `gtm.js` lesz (526 db / 28 nap).
2. **`ajandekkartya_utalas`, TikTok `PlaceAnOrder` és Stape `purchase` minden űrlapra.** A
   PMU-, PPC- és fodrászjelentkezés is „ajándékkártya-vásárlásnak” számít.
3. A **`page_view` kulcseseménynek van jelölve** a GA4-ben, így minden oldalmegtekintés
   „konverzió”.
4. Két GA4-esemény ugyanazon a feltételen fut: `ads_conversion_Id_pont…_2` és
   `ads_conversion_Egy_b…`, mindkettő `/success-foglalas`.
5. A Meta-pixelek ESSENTIAL kategóriában vannak, hozzájárulás nélkül is futnak (GDPR-kockázat).
6. A GTM-ben maradtak egy másik projektből származó változók (gyógytorna-lookupok) és 9
   használaton kívüli kattintásfigyelő, valamint 6 szüneteltetett `cvt_KFNBV` és 6
   szüneteltetett Ads-tag.
7. A Salonic-DOM-változók (ár, szolgáltatás, telefon) a mi oldalunkon üresek. A TikTok
   `SubmitForm` érték és telefon, valamint a GA4 `item_name` ezért üres.
8. Nincs DMARC és nincs DKIM a domainen.

---

## 13. Hogyan másolja a klón (fájlok)

| Wix-elem | Klónbeli megfelelő |
|---|---|
| Meta-pixelek oldalanként, hozzájárulástól függetlenül | `assets/js/suti.js` – `PIXEL_OLDALAK` (ugyanaz a 4 pixel, ugyanazok az oldalak) |
| GTM-PST2HB22 + Consent Mode (default denied, `wait_for_update` 500, update a sávból) | `assets/js/suti.js` – ugyanaz a konténer, változtatás nélkül, így minden 4. fejezetbeli tag ugyanúgy fut |
| GA4 gtag `send_page_view:false` + Wix-féle `page_view` | `assets/js/suti.js` (`page_view` kézzel, `action_source=website`); a `visit`-et a GA4 saját „Esemény létrehozása” szabálya készíti, mint a Wixen |
| Wix dataLayer `Pageview` / `{ecommerce:null}` / `page_view` | `assets/js/suti.js` |
| Wix Forms `lead` / `generate_lead` + `user_data` (`R()`) | `assets/js/klon.js` – `wixLead`, `wixUserData`, `WIX_UD` (ugyanazok a form ID-k, nevek, mezőkulcsok) |
| Wix-űrlapok beküldése és levelei | Netlify Forms + `netlify/functions/submission-created.mjs` (azonos tárgyak és szövegek) |
| URL-ek (kiterjesztés nélkül, mobil ugyanazon a címen) | `netlify/edge-functions/oldal.js` + `netlify/lib/utvonal.js` |
| FB domain-verifikáció, JSON-LD, meta tagek, sitemap, robots | a Wix SSR-ből átvéve (`tools/wix2static.mjs`, `tools/wix-sitemap/`) |
| Mérőkódok csak éles domainen | `suti.js` – `ELES_DOMAINEK` (előnézeten és localhoston nem mér) |
| Meta Event Setup Tool, CAPI Gateway, TikTok Event Builder, GA4-szabályok | nincs teendő: ezek a Meta/TikTok/Google szerverén vannak, URL-hez kötve, és a klón URL-jei azonosak |

Élő Wix és klón összevetése 8 oldalon, asztali és mobil nézetben: minden GA4-, Meta-,
TikTok-, Ads- és Stape-hívás egyezik.
