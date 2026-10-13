# Adatterkep (mi hol tarolodik, meddig)

| Hely | Mi | Meddig | Egeszsegugyi / szemelyes adat |
|---|---|---|---|
| sessionStorage (bongeszo, fulenkent) | `gyBookingCtx` (motor foglalas-azonosito `mb_...`, hely/szolgaltatas/idopont szamok), `gy_tk` (egyszeri koszono-token), `gy_motor` (probakapcsolo) | a ful bezarasaig; a token 15 perc | nincs |
| localStorage | `gy_b` (latogatoi vodor 0..99) | tartos | nincs |
| Suti `gy_s` (HttpOnly, Secure, Lax) | veletlen munkamenet-token | session; szerveroldali TTL: 30 perc inaktivitas / max 24 ora | nincs |
| Suti `gy_lpt` | veletlen token, CSAK hirdetesi (CookieYes `advertisement:yes`) hozzajarulassal | 30 nap; visszavonaskor torlodik | nincs |
| D1 `gy_foglalas` | motor-uuid, tipus (allapotfelmeres/egyeb), uj/visszatero, forras-cimke + bizonyitek-kod, hozzajarulas-allapot, statusz, igazolt, esemeny_kiadva, teszt, parosito (HMAC) | 13 honap | NINCS: se nev, e-mail, telefon, panasz, szolgaltatasnev, nyers click-ID |
| D1 munkamenet / token / riasztas | hash-elt azonositok, belepesi forras-mezok | munkamenet 24 ora, token 15 perc, riasztas rovid | nincs |
| Worker napló | csak vegpontnev + rovid hibakod | Cloudflare alap | soha nem tartalmaz kerest, cookie-t, uuid-t, vendegadatot |
| dataLayer | csak `foglalas_kesz {tipus, ertek, tranzakcio_id}` | oldalbetoltes | nincs (a `tranzakcio_id` HMAC, nem visszafejtheto) |
| Salonic | a vendeg adatai, panasza | a Salonic szabalyai szerint | ott marad; a motor nem latja |

Engedelyezett lista: ami itt nincs felsorolva, azt a motor nem tarolja. A hozzajarulas nelkuli forras-megtartas (`GY_ATTR_NELKUL=1`, Feri dontese 2026-10-13) 24 oras, nem azonosit szemelyt; kapcsolo: `GY_ATTR_NELKUL=0`.
Hozzajarulas: megtagadas / visszavonas -> `gy_lpt` torlodik a kovetkezo hivasnal (a szerveroldali rekorddal egyutt); lejarat 30 nap utan.
