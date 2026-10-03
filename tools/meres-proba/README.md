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
