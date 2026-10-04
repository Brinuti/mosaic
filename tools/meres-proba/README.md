# Mérés-ellenőrző: foglaló → köszönőoldal, kimenő kérések nélkül

Automatizált Chrome (Playwright), amely a foglaló és a köszönőoldal teljes láncát végigjárja, **minden keretben naplózza a kimenő mérési kéréseket** (Google Ads, GA4, stape, Meta, TikTok, Zapier: melyik címke, milyen esemény, érték, azonosító), és **le is tiltja őket**, így a hirdetési fiókokba semmi nem jut el.

**Alapból tiltó:** a saját oldalon, a Salonic-oldalakon, a reCAPTCHA-n és néhány statikus könyvtár-CDN-en kívül minden harmadik fél felé csak a (GET) szkript- és betűtöltés engedett; minden más (bármilyen POST, ismeretlen host, a stape végpontjai) naplózva és tiltva. Emellett a csak mérésre szolgáló hostok (`capig.stape.*`, `analytics-ipv6.tiktokw.us`, `hooks.zapier.com`, `region1.analytics.google.com`, a Google Ads-végpontok) DNS-szinten sem feloldhatók, ez a második védvonal.

## Telepítés

```bash
npm install --no-save playwright-core
```

A gépen lévő Chrome-ot használja (`CHROME_UTVONAL` környezeti változóval felülírható).

## Futtatás

```bash
node tools/meres-proba/meres-proba.mjs --szenario hair|oxigen2|lezer --mod szim|nativ|valodi --out naplo.json [--clickids 1] [--landing 1] [--overlay dist]
node tools/meres-proba/elemzes.mjs naplo.json [--reszletes 1]
node tools/meres-proba/osszevet.mjs "cimke=naplo1.json" "cimke=naplo2.json"
```

- `--mod szim`: a Salonic adatlap (iframe) helyett csak a Salonic átirányítása fut a köszönőoldalra, **foglalás nem jön létre**.
- `--mod nativ`: alapvonal, a mostani Salonic-saját útvonal (köszönőoldal közvetlenül, Salonic-referrerrel).
- `--mod valodi`: **valódi foglalás** a Salonic-űrlappal (név „TESZT – Claude”, a feltétel bepipálva, hírlevél nem). A lemondás külön: `lemond.mjs <lemondó-link>` (a visszaigazoló e-mail „Lemondom” linkje). reCAPTCHA-kihívás esetén megáll.
- `--clickids 1`: hirdetési kattintást utánzó paraméterek (`gclid=TESZT123&fbclid=TESZT456&ttclid=TESZT789&utm_source=teszt&utm_medium=cpc`).
- `--landing 1`: „hirdetés → landing → motor” út (a landing a kattintás-azonosítókkal, majd a rajta lévő gombbal a motorra).
- `--overlay dist`: az éles tartomány oldalait a helyi `dist/`-ből szolgálja ki (még nem deployolt változat kipróbálása; a `dist/`-et `ELES=1 FOGLALO_ATKOTES=all node tools/netlify-build.mjs` készíti).
- `landing-sonda.mjs <útvonalak…>`: mely landingeken fut a Google-címke, a Meta-pixel és a TikTok-pixel, és kapják-e el a kattintás-azonosítót.

A teszt a süti-hozzájárulást elfogadottnak tekinti (a saját tárolóba írja, mint a süti-sáv gombja), így a mérés teljes üzemben fut.

## Meta-pixel oldalankénti ellenőrzése: `pixel-proba.mjs`

Minden oldalon `?fbclid=TESZTPIXEL` paraméterrel betölti az oldalt, és oldalanként megmondja: melyik pixel-azonosító indult (és hányszor: `fbq.getState().pixels`),
hány `PageView` ment, létrejött-e a `_fbc` süti (benne a `TESZTPIXEL`) és a `_fbp`, volt-e „Duplicate Pixel ID” figyelmeztetés, és a `buy.stripe.com` gombok
linkjében **kattintás után** ott van-e az fbc (a GTM 177-es címke kattintáskor írja a `client_reference_id`-be; hozzájárulás kell hozzá).
A kimenő mérési kérések (a `capig.stape.do` is) alapból tiltva és naplózva vannak (`tilt.mjs`, mint a többi mérőszkriptnél).

```
node tools/meres-proba/pixel-proba.mjs --oldalak mind|/utvonal,/masik --out pixel.json [--koszonok 1] [--overlay dist] [--mobil 1] [--hozzajarulas 0]
node tools/meres-proba/pixel-proba.mjs --osszevet elozo.json uj.json
```

- `--oldalak mind`: a `klon/` minden oldala; `--oldalak nincs --koszonok 1`: csak a köszönőoldalak.
- `--koszonok 1`: hat köszönőoldal a Salonic valódi átirányításának paramétereivel (`first_booking` + `bookingUrl`), hogy a GTM 213-as címkéje is lefusson (kimenő kérés nélkül) – itt látszik, ha a címke kétszer inicializálná a pixelt.
- `--overlay dist`: a még nem deployolt változat a helyi `dist/`-ből (a `pmu-ok` / `pmu-vh` a gitben szimbolikus link, ami Windowson szövegfájl: az eszköz a célfájlt szolgálja ki).
- `--hozzajarulas 0`: friss látogató süti-hozzájárulás nélkül (a pixel ettől függetlenül fut, mint a Wixen; a Stripe-link fbc-je viszont hozzájárulást kér).
- `--osszevet`: két futás összevetése oldalanként (pixelek, PageView, CAPI, események, Google/TikTok) – a „mely oldalak változtak” kérdésre.
- Az elvárt pixel a helyi `assets/js/suti.js` `PIXEL_OLDALAK` listájából jön; a listán kívüli oldalra „nincs elvárt pixel”.
## A helyben nyíló foglaló-réteg: `reteg-proba.mjs`

```
node tools/meres-proba/reteg-proba.mjs [--overlay dist] [--bazis https://…] [--mobil 1] [--kepek mappa] [--oldal /booking-test]
```

Foglalás nélkül végigjárja a réteget: minden belépési pont (HeadSpa, Fodrászat, Oxigén, Lézer, PMU, szolgáltatás-első kezdőállapot) jó állapotból indul-e, nem navigál-e az oldal, frissül-e az URL, bezárás / Esc / vissza gomb, újratöltés-visszaállítás (UTM és click ID megmarad), fókusz-csapda, valamint a valódi landing-oldalak foglaló-gombjai. `--bazis https://<ág>.mosaic-d77.pages.dev` egy PR-előnézetet vizsgál; leírás: [BOOKING_LAYER.md](../../docs/booking-engine/BOOKING_LAYER.md).

**`reteg-foglalas.mjs`**: VALÓDI foglalás a rétegen át (`--utvonal h0-headspa|hair-konzult|oxigen-2|lezer-konzult`, `--bazis https://www.mosaicheadspa.hu` vagy egy előnézet): az utolsó szabad nap utolsó időpontja, „TESZT – Claude” név, a telefonszám `MERES_TELEFON` (alap: a szalon száma). A lemondás külön: `lemond.mjs`. Előnézeten a Salonic az ÉLES köszönőoldalra irányít a keretbe, ami idegen szülő alatt mérés nélkül fut (a `suti.js` keretben nem mér), és a motort nem értesíti: a vége ott a keret tartalma, nem a motor sikerképernyője; az éles tartományon a meglévő köszönőoldal nyílik meg a teljes ablakban.
