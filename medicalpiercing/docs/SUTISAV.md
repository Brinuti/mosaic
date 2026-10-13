# Saját süti-sáv (hozzájárulás-kezelés) – Medical Piercing

**Miért:** a Wixről örökölt CookieYes-sáv szkriptje (`cdn-cookieyes.com/client_data/a46a3451…/script.js`) 2026-10-10 óta
403-at ad: nem volt sáv, nem volt hozzájárulási süti, a mérőkódok hozzájárulás nélkül futottak, a szerveres Google-feltöltés
(`lib/meres/`) pedig soha nem kapott hozzájárulást. Feri döntése (2026-10-11 11:21): „sütisáv saját mehet”.

## Működés (`assets/js/suti.js`)

- **Sáv:** magyar szöveg, egyenrangú „Elfogadom” és „Elutasítom” gomb (azonos méret és stílus), „Beállítások”
  (szükséges / statisztika / marketing), link az `/adatkezeles` oldalra. Döntés előtt jelenik meg; minden címen
  (az előnézeten is), keretben (iframe) soha. Mobilon alul, a Wix gyorsmenü-sávja fölött; a fejléc „Időpontok”
  gombját nem takarja.
- **Módosítás / visszavonás:** a lábléc „Adatkezelési tájékoztató” linkje után „Süti beállítások” link; a
  `#suti-beallitasok` címrész és a `window.mpSuti.beallitasok()` is megnyitja.
- **Tárolás:** első feles süti `mp_suti=v1-s<0|1>-m<0|1>-t<unix mp>` (s = statisztika, m = marketing), 365 nap,
  `domain=medicalpiercing.hu`, `SameSite=Lax; Secure`. Ezt olvassa a böngészős (`assets/js/mp-meres.js`) és a szerveres
  (`lib/meres/google-ads.js` `hozzajarulas()`) foglalás-mérés is. Változáskor `document` esemény: `mp_suti_valtozas`,
  és a dataLayer-be `{ event: 'mp_suti_valtozas' }`.

## Google Consent Mode v2

- A `suti.js` a `<head>`-ben szinkron fut, a gtag.js és a GTM betöltése **előtt** küldi:
  `gtag('consent', 'default', { ad_storage, ad_user_data, ad_personalization, analytics_storage: 'denied',
  functionality_storage / security_storage: 'granted', personalization_storage: 'denied', wait_for_update: 500 })`.
  Korábbi döntésnél rögtön utána `consent update` a döntés szerint; döntéskor újabb `update`.
- Haladó mód: a GTM (GTM-T9GR4JCK) és a Google Ads gtag.js (AW-11097894040) mindig betölt; hozzájárulás nélkül süti
  nélküli jelet küldenek (GA4: `gcs=G100`). Így a GA4 `foglalas_inditasa` hozzájárulás nélkül is megy (cookieless ping).
- **`ads_data_redaction: true`** – bekapcsolva: `ad_storage = denied` mellett a hirdetési kattintásazonosítók kitakarva
  mennek a Google-nek. Hozzájárulással nincs hatása.
- **`url_passthrough`** – NEM kapcsoljuk be: a `klon.js` már továbbviszi a gclid / fbclid / ttclid / utm_* paramétereket a
  munkamenetben és a foglalási linkeken (a Wixszel azonosan); a passthrough ezt duplázná, és átírná a belső linkeket.
  A szerveres feltöltés hozzájárulás nélkül amúgy sem küld gclid-et.

## Mi tölt be és mikor

| kód | döntés előtt / elutasítva | marketing-hozzájárulással |
|---|---|---|
| GTM-T9GR4JCK (GA4 G-SJT2RN62H8, Google Ads-címkék) | betölt, Consent Mode: süti nélkül | betölt, sütivel |
| Google Ads gtag.js AW-11097894040 | betölt, süti nélkül | betölt |
| TikTok-pixel (a GTM-ben, `ad_storage`-hoz kötött címke) | nem | igen (a GTM tölti) |
| TikTok `InitiateCheckout` (foglalásindítás) | nem | igen |
| Meta-pixel 2177829632420786 + PageView | nem | igen, a `/foglalas-ok*` oldalakon soha |
| Convertize 11722 | nem | igen |

A fejlesztő köszönőoldali logikája (egyszeri mérés `mp_koszono`, keret-őr a foglalómotorhoz, GA4 `foglalas_inditasa`)
változatlan. Visszavonáskor a már betöltött pixelek `fbq('consent','revoke')` / `ttq.revokeConsent()` jelet kapnak; a
következő oldalon már be sem töltenek.

## Tesztek

- `node --test tools/test-mp-feltoltes.mjs tools/test-mp-meres.mjs` – a szerver az `mp_suti` sütit olvassa.
- `node tools/sav-teszt.mjs` és `--mobil` – döntés előtt / Elfogadom / Elutasítom / lábléc / köszönőoldal / motor.
- `node tools/meres-teszt.mjs` – elfogadott hozzájárulással a mérőkódok, mint eddig.
- `tools/mp-meres-pw.mjs` – foglalás-mérés hozzájárulással és nélküle.
- `tools/forras-pw.mjs` – forrás-címke hozzájárulás nélkül, Meta / TikTok azonosító csak hozzájárulással.

## Hozzájárulástól független forrás-címke (2026-10-13)

Feri kifejezett kérése (2026-10-13 07:36): „Kifejezetten azt kérem, hogy hozzájárulás nélkül is menjen el.” A jogi
kockázatot a tulajdonos vállalja. Az `assets/js/mp-meres.js` döntés előtt / elutasításkor is eltárol a `sessionStorage`-ban
(`mp_forras`) **egyetlen durva csatornanevet** (google / meta / tiktok / egyeb) és az első észlelés idejét – azonosítót,
kattintásazonosítót, személyes adatot nem; a lap bezárásával törlődik. Semmilyen hirdetési platformnak nem megy, csak a
saját D1-be (`mp_foglalas.forras_platform`). A Meta / TikTok kattintásazonosítók (`fbclid`, `ttclid`, `_fbc`, `_fbp`,
`_ttp`) viszont **csak marketing-hozzájárulással** kerülnek tárolásra, és most sehova nem mennek. Részletek:
`docs/MERES_GOOGLE_ARNYEK.md`, „Platform szerinti forrás” szakasz.

Megjegyzés: a `klon.js` (a Wix örökölt kódja) a `fbclid` / `ttclid` / `utm_*` paramétereket már eddig is a munkamenetbe
(`savedQueryParams`) mentette hozzájárulás nélkül; ezen ez a változás nem módosít.
