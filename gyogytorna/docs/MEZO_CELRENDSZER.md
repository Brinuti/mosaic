# Mezo -> celrendszer

| Mezo | Salonic | D1 | dataLayer / GTM | Megjegyzes |
|---|---|---|---|---|
| nev, e-mail, telefon, panasz | igen (a beagyazott adatlapon) | nem | nem | a motor nem latja |
| hely, szolgaltatas, szakember, idopont | igen | csak szamok: hely nincs, tipus + `parosito` HMAC | nem | |
| tipus (allapotfelmeres / egyeb) | - | igen | `tipus` | |
| ertek (Ft, a Salonic atiranyitas ara, katalogus-arral korlatozva) | - | token-rekordban 15 percig | `ertek` | |
| tranzakcio_id (HMAC-SHA256 hex, 64) | - | szamolt | `tranzakcio_id` | GA4/Ads deduplikacio |
| forras-cimke (google_brand, google_nem_brand, google_bizonytalan, organikus, direkt, ismeretlen) | - | igen | nem (szerveroldali riport: `/api/gy-admin`) | |
| Google Ads kampany- / hirdetescsoport- / hirdetes-ID (UTM-sablon: utm_campaign, gyt_ag, utm_content; csak szamok) | - | igen (`kampany`, `hirdetescsoport`, `hirdetes`) | nem (szerveroldali riport: `kampany_bontas`) | nem szemelyes adat; a sutisavtol fuggetlenul tarolhato a foglalashoz |
| uj / visszatero | atiranyitas `first_booking` | igen | nem | |

Harmadik felek (GA4, Google Ads, egyeb) csak a meresi Claude GTM-donteseivel kapnak adatot; Meta-meres nincs.
