# Adatterkep (mi hol tarolodik, meddig)

| Hely | Mi | Meddig | Egeszsegugyi / szemelyes adat |
|---|---|---|---|
| sessionStorage (bongeszo, fulenkent) | `gyBookingCtx` (motor foglalas-azonosito `mb_...`, hely/szolgaltatas/idopont szamok), `gy_tk` (egyszeri koszono-token), `gy_motor` (probakapcsolo) | a ful bezarasaig; a token 15 perc | nincs |
| localStorage | `gy_b` (latogatoi vodor 0..99) | tartos | nincs |
| Suti `gy_s` (HttpOnly, Secure, Lax) | veletlen munkamenet-token | session; szerveroldali TTL: 30 perc inaktivitas / max 24 ora | nincs |
| Suti `gy_lpt` | veletlen token, CSAK marketing-hozzajarulassal (a sajat sav `gy_suti` sutije: m=1) | 30 nap; visszavonaskor torlodik | nincs |
| D1 `gy_foglalas` | motor-uuid, tipus (allapotfelmeres/egyeb), uj/visszatero, forras-cimke + bizonyitek-kod, Google Ads azonositok (`kampany` = utm_campaign, `hirdetescsoport` = gyt_ag, `hirdetes` = utm_content; csak 6-15 szamjegy, nem szemelyes adat), hozzajarulas-allapot, statusz, igazolt, esemeny_kiadva, teszt, parosito (HMAC) | 13 honap | NINCS: se nev, e-mail, telefon, panasz, szolgaltatasnev, nyers click-ID |
| Suti `gy_suti` (nem HttpOnly, a sav allitja) | `v1-s<0|1>-m<0|1>-t<unix mp>` = statisztika / marketing dontes + idopont | 365 nap; visszavonhato / modosithato | nincs |
| D1 `gy_suti_stat` | napi osszesitett darabszam (megjelent / elfogad / elutasit / reszleges / beall; nezet; eszkoz) | 13 honap | nincs (suti, IP, URL, azonosito nelkul) |
| D1 munkamenet / token / riasztas | hash-elt azonositok, belepesi forras-mezok | munkamenet 24 ora, token 15 perc, riasztas rovid | nincs |
| Worker napló | csak vegpontnev + rovid hibakod | Cloudflare alap | soha nem tartalmaz kerest, cookie-t, uuid-t, vendegadatot |
| dataLayer | csak `foglalas_kesz {tipus, ertek, tranzakcio_id}` | oldalbetoltes | nincs (a `tranzakcio_id` HMAC, nem visszafejtheto) |
| D1 `gy_visszahivas` | a "Telefonon egyeztetek idopontot" kerelem: nev, telefonszam, opcionalis rendelo es idosav, a motor oldal utvonala, ertesitve-jelzo (a vendeg KIFEJEZETT kerese; adatkezelesi tajekoztato elfogadasa kotelezo) | 60 nap | SZEMELYES adat (nev, telefon). Egeszsegugyi adat NINCS: a motor nem kerdez panaszt, az urlap kerve nem ir egeszsegi adatot. Az ertesito webhook (`GY_VISSZAHIVAS_WEBHOOK`, pl. Zapier -> e-mail a klinikanak) ugyanezeket a mezoket kapja |
| Salonic | a vendeg adatai, panasza | a Salonic szabalyai szerint | ott marad; a motor nem latja |

Engedelyezett lista: ami itt nincs felsorolva, azt a motor nem tarolja. A hozzajarulas nelkuli forras-megtartas (`GY_ATTR_NELKUL=1`, Feri dontese 2026-10-13) 24 oras, nem azonosit szemelyt; kapcsolo: `GY_ATTR_NELKUL=0`.
Hozzajarulas: megtagadas / visszavonas -> `gy_lpt` torlodik a kovetkezo hivasnal (a szerveroldali rekorddal egyutt); lejarat 30 nap utan.

## Megorzes es torles a `gy_` tablakra (Feri, 2026-10-13: 13 honap)
| Tabla | Megorzes | Torles |
|---|---|---|
| `gy_foglalas` | 13 honap (396 nap) a letrehozastol | automatikus: a `takarit()` a foglalas-vegpont hivasainak ~2%-an fut (`DELETE ... WHERE letrehozva < most - 396 nap`); kezi torles: `DELETE FROM gy_foglalas WHERE uuid = ?` |
| `gy_munkamenet` | 24 ora (hozzajarulassal 30 nap); inaktivitas 30 perc | automatikus (lejarat), visszavonaskor a 30 napos rekord a kovetkezo hivasnal torlodik |
| `gy_token` | 15 perc, egyszer hasznalhato; felhasznalaskor azonnal torlodik | automatikus |
| `gy_riasztas` | 90 nap (csak technikai adat) | automatikus |
| `gy_visszahivas` | 60 nap (nev + telefon) | automatikus: a `takarit()` a visszahivas-vegpont hivasainak ~5%-an fut; kezi torles: `DELETE FROM gy_visszahivas WHERE id = ?` |
| `gy_suti_stat` | 13 honap (csak darabszam) | automatikus (a vegpont hivasainak ~2%-an) |
| `gy_kampany`, `gy_meta` | a Google Ads kampanylista (azonositok, nevek); szemelyes adat nincs | a napi szinkron felulirja |

## A D1 adatbazis (`mp-meres`) tulajdona es hozzaferese
- Tulajdonos: a Cloudflare-fiok `560b06e0a3fe45c72f7e9c4421841659` (a Mosaic / Medical Piercing fiok, Feri). A fiok D1-kerete (10) betelt, ezert a `gy_` tablak atmenetileg az `mp-meres` adatbazisban vannak (a Medical Piercing `mp_` tablai mellett). A kod csak `gy_` tablakat ir / olvas; az `mp_` tablakhoz nem nyul.
- Hozzaferes: a `gyogytorna` Pages-projekt `GY_DB` kotese (Functions) es a fiok Cloudflare-hozzaferesei. A riport-/admin-vegpontok kulccsal vedettek (`x-gy-kulcs`, a kulcs SHA-256 hash-e a Cloudflare-titokban).
- Elkulonites: a torles es a mentes tablankent kezelheto (a fenti tablazat); egy `DROP TABLE gy_*` az `mp_` tablakat nem erinti. Ha az adat mas ceg hozzaferesi korebe kerul, vagy a D1-keret felszabadul, a `gy_` tablak kulon adatbazisba koltoztetendok (Feri kulon jovahagyasa kell mas ceg eseten).
