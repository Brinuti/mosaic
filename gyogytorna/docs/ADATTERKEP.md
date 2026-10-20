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
| D1 `gy_visszahivas` | a "Telefonon egyeztetek idopontot" kerelem (az elo "Telefonos Idopont" urlap mezoi): nev, e-mail, telefonszam, "Mikor szeretne idopontot?", "Mikor hivhatjuk?", rendelo, a motor oldal utvonala, ertesitve-jelzo (a vendeg KIFEJEZETT kerese; az adatvedelmi szabalyzat elfogadasa kotelezo) | 60 nap | SZEMELYES adat (nev, e-mail, telefon). A "Panasza rovid leirasa" (EGESZSEGUGYI adat) a D1-be, a naplokba, az URL-be, a dataLayerbe SOHA nem kerul: csak az ertesito webhookon (Zapier -> Gmail -> rendelo@gyogytornaszom.hu; az elo urlap 123FormBuilder-en at kuldte ugyanezt) halad at. Ha az ertesites nem megy, a kerelem panasz nelkul marad meg + riasztas |
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
| `gy_erintes` (GY-22) | 37 nap (7 nap hozzarendeles + 30 nap `kesoi_fizetett` + tartalek) | automatikus: a `takarit()` a forras-vegpont hivasainak ~1%-an is fut; visszavont hozzajarulasnal a latogato sorai azonnal torlodnek |
| `gy_suti_stat` | 13 honap (csak darabszam) | automatikus (a vegpont hivasainak ~2%-an) |
| `gy_kampany`, `gy_meta` | a Google Ads kampanylista (azonositok, nevek); szemelyes adat nincs | a napi szinkron felulirja |

## A D1 adatbazis (`mp-meres`) tulajdona es hozzaferese
- Tulajdonos: a Cloudflare-fiok `560b06e0a3fe45c72f7e9c4421841659` (a Mosaic / Medical Piercing fiok, Feri). A fiok D1-kerete (10) betelt, ezert a `gy_` tablak atmenetileg az `mp-meres` adatbazisban vannak (a Medical Piercing `mp_` tablai mellett). A kod csak `gy_` tablakat ir / olvas; az `mp_` tablakhoz nem nyul.
- Hozzaferes: a `gyogytorna` Pages-projekt `GY_DB` kotese (Functions) es a fiok Cloudflare-hozzaferesei. A riport-/admin-vegpontok kulccsal vedettek (`x-gy-kulcs`, a kulcs SHA-256 hash-e a Cloudflare-titokban).
- Elkulonites: a torles es a mentes tablankent kezelheto (a fenti tablazat); egy `DROP TABLE gy_*` az `mp_` tablakat nem erinti. Ha az adat mas ceg hozzaferesi korebe kerul, vagy a D1-keret felszabadul, a `gy_` tablak kulon adatbazisba koltoztetendok (Feri kulon jovahagyasa kell mas ceg eseten).


## GY-22: 7 napos last paid click erintesi naplo (ARNYEK, 2026-10-18)
- **Mit tarol (`gy_erintes`):** projekt, pszeudonim latogato-hash (a meglevo, szerver altal beallitott HttpOnly `gy_lpt` suti SHA-256 hash-e), idobelyeg, normalizalt cimke (`google_markas` / `google_nem_markas` / `google_bizonytalan` / `ismeretlen`), bizonyitek-okkod, kampany / hirdetescsoport / hirdetes ID (csak szamok), a celoldal UTVONALA (query nelkul), hozzajarulas-allapot, szabalyverzio (`lpc1`).
- **Mit NEM tarol:** nyers click-ID (gclid / gbraid / wbraid), nev, e-mail, telefon, IP, user-agent, teljes URL, szabad szoveg, szolgaltatas-reszlet. Platform fele semmi nem megy a naplobol.
- **Mikor ir:** minden fizetett erkezes (Google click-ID VAGY `utm_medium=cpc`), hirdetesi hozzajarulassal (SAV_KI mellett alapertek: megadott); ugyanaz az erkezes 30 percen belul nem naplozodik ketszer (ujratoltes). Organikus / direkt visszateres nem ir.
- **Hozzarendeles foglalaskor (`gy_foglalas.lpc_*`, `kesoi_fizetett`):** a legutolso, 7 napon beluli fizetett erintes nyer (`lpc_kora_nap` = a kattintas kora napban); nincs fizetett -> `organikus_direkt` (ha van azonosito-suti), kulonben `ismeretlen`; a 8-30 napos legutolso fizetett cimkeje a `kesoi_fizetett`. Ismeretlen kampany-ID-t a kampanylista kesobbi frissitese utolag felold (`kampany_es_katt_utolag`).
- **ARNYEK:** csak a D1-be ir; a foglalas regi `cimke`, a dataLayer, a GTM es a `foglalas_kesz` esemeny NEM valtozik. Fail-open: naplohiba eseten a foglalas valtozatlanul megy tovabb (`gy_meta.lpc_hiba` szamlalo + `gy_riasztas` `lpc_hiba`).
- **Ellenorzes:** `GET /api/gy-admin?lpc=YYYY-MM` (kulcsos, csak aggregalt): nevezo, lpc- es munkamenet-alapu azonositott szam, mennyivel tobbet ad a naplo, `kesoi_fizetett`, hibaszamlalo.

## GY-23: szerveres Google Ads import - a foglalashoz rendelt click-ID (2026-10-19, Feri 12:40; ChatGPT egyetert)
- **Valtozas a korabbi szabalyhoz kepest:** a `gy_foglalas` rekord mostantol hordozhat NYERS Google click-ID-t (`gads_katt_ertek`, tipus: gclid / gbraid / wbraid), kizarolag a szerveres Google Ads offline import celjara. Egyeb nyers click-ID (fbclid stb.) tovabbra sincs.
- **Mikor:** hirdetesi hozzajarulassal (SAV_KI mellett alapertek: megadott), ha a 7 napos last paid click nyertese Google-forrasu (`google_*`); a click-ID a nyertes erintes munkamenet-rekordjabol jon. Hozzajarulas nelkul / organikus / nem Google: nincs.
- **Mezok:** `gads_katt_tipus`, `gads_katt_ertek`, `gads_katt_ido` (a kattintas ideje, unix), `gads_munkamenet` (a munkamenet-rekord hash-enek elso 16 karaktere: az osszerendeles ellenorizhetosege), `gads_szabaly` (`gads1+lpc1`), `ertek` (a foglalas erteke, Ft). A hozzajarulas-allapot a meglevo `hozzajarulas` mezoben van.
- **Megorzes:** a click-ID 60 nap utan NULL-ra torlodik (a foglalas-rekord marad). Indok: a kattintas legfeljebb 7 nappal a foglalas elott van, tehat <= 67 nap a Google 90 napos import-ablakabol; a 60 nap fedezi a kesobbi feltoltest, ujraprobalast es a lemondas-kiigazitast; ennel hosszabb nem kell.
- **Admin lista:** `GET /api/gy-admin?gads=1[&tol=YYYY-MM-DD]` (x-gy-kulcs): CSAK Salonic-igazolt (`igazolt=1`), teszt nelkuli, Google click-ID-s allapotfelmeresek; `aktiv` es `lemondott` agban: `click_id`, `click_tipus`, `click_ido`, `konverzio_ido` (Budapest, "yyyy-mm-dd hh:mm:ss+hh:mm"), `order_id` (= a dataLayer tranzakcio_id), `ertek`, `penznem`, `allapot`, `lemondva_ido`, `forras`. Nev, e-mail, telefon, kezeles, szolgaltatasnev, Salonic-azonosito NINCS benne. Hash-elt e-mail / telefon platformra nem megy.

## GY-24: lepesenkenti tolcsermeres (gy_motor_stat, 2026-10-19; Feri kerese, ChatGPT egyetert)
- **Tabla:** `gy_motor_stat (nap, kornyezet, esemeny, lepes, kategoria, eszkoz, db)`, PK a hat mezo; CSAK napi aggregalt szamlalo. (A keresben szereplo mezokhoz egyetlen `kategoria` oszlop kerult: az `elakad` esemeny FIX hibakategoriaja; mas esemenynel ures.) Suti, latogato- vagy munkamenet-azonosito, IP, user-agent, URL(-parameter), nev, telefon, e-mail, panasz / egeszsegugyi szoveg, kivalasztott idopont NINCS.
- **Kornyezet:** az Origin (tartalekul a Referer) alapjan: `eles` (gyogytornaszom.hu), `elonezet` (*.gyogytorna.pages.dev), `teszt` (minden mas; a `g:pw-proba` teszt-foglalas `kesz` esemenye is). A proxy miatt nem a request.url hostja dont (#406).
- **Esemenyek:** `nyit` (a motor megjelenese), `lepes` (egy lepes megjelenese, megnyitasonkent legfeljebb egyszer), `elakad` (lepes + FIX kategoria: `kotelezo_hianyzik`, `formatum`, `nincs_szabad_ido`, `szerverhiba`; mas ertek `egyeb`), `bezar_gomb` (X / hatter / Esc, az utolso lepes nevevel), `elhagy_jelzes` (pagehide / lathatosag-valtas, sendBeacon; CSAK BECSLES, megnyitasonkent egyszer), `kesz` (CSAK szerveroldalon, a foglalas / visszahivas tenyleges ELSO mentese utan; a kliens nem kuldheti, a kerese 400).
- **Lepesek (a motor sorrendjeben):** `szolg` (Szolgaltatas) → `valt` (Tipus; csak ha a csaladban tobb szolgaltatas van) → `hely` (Helyszin) → `szakember` (Szakember) → `ido` (Idopont) → `adatlap` (Adatok, Salonic keret); mellette a `hivas` (Visszahivas: "Telefonon egyeztetek idopontot"). A `hely` / `szakember` / `valt` kimarad, ha a belepesi link megadja. `kesz` lepese: `adatlap` (foglalas) vagy `hivas` (visszahivas-kerelem).
- **Riport:** `GET /api/gy-admin?tolcser=YYYY-MM[&kornyezet=eles|elonezet|teszt]` (x-gy-kulcs): lepesenkent megjelent / elakad / bezar_gomb / elhagy_jelzes_becsles, eszkozonkent, napi bontas; az arany KOZELITO (azonosito nelkul visszalepes / ujratoltes / tobbszori megnyitas torzithat; ez esemenytolcser, nem pacienskovetes).
- **Megorzes:** 13 honap (396 nap), utana automatikus torles (a `takarit()` a forras- / foglalas-vegpont hivasain fut).
- **Hibatures:** a kliens fire-and-forget (sendBeacon, tartalek: fetch keepalive, try/catch); a szerver a hibat elnyeli (204). A foglalasi folyamat es a UI nem valtozik.

## GY-25 – ELES 7 napos "utolso fizetett kattintas" (Feri kerese, 2026-10-19)

- A foglalas forras-cimkeje (`gy_foglalas.cimke`): `meta` | `tiktok` | `google_nem_markas` | `google_markas` | `organikus_direkt` | `ismeretlen`; a regi (munkamenet-alapu) cimke a `cimke_regi` / `bizonyitek_regi` oszlopban. Bizonyitek-forras: `bizonyitek_forras` = `suti` (erintes-naplo) | `munkamenet` (24 oras tartalek).
- **Nyers click-ID tarolasa (valtozas a korabbi "csak gclid" szabalyhoz kepest, Feri 2026-10-19 kifejezett kerese):** gclid / gbraid / wbraid / fbclid / ttclid (formatum- es hosszellenorzessel; msclkid erteke tovabbra sem) a `gy_erintes.katt_ertek` es a nyertes a `gy_foglalas.lpc_katt_ertek` oszlopban, CSAK hirdetesi hozzajarulassal; a gclid tovabba `gads_katt_ertek`. 60 nap utan NULL. Hozzajarulas nelkul sehol (naplo, munkamenet, foglalas) nincs nyers ID.
- Visszavonaskor a naplo es a foglalasokon tarolt nyers click-ID-k is torlodnek (`lpc_latogato` = a gy_lpt / gy_s hash eleje).
- Megjegyzes: `GY_SAV_KI=1` mellett (Feri dontese, 2026-10-14) a hozzajarulas dontes nelkul "megadottnak" szamit; a D1-ben a vélelmezett es a kifejezett hozzajarulas nem kulonbozik.
- A `?gads=` export nem tartalmaz latogato-hasht, nevet, e-mailt, telefont, kezelest; a `?foglalas=` a nyers click-ID helyett csak jelzest ad.

## GY-25 – szerveres Google Ads feltoltes (DRY-RUN, Feri 2026-10-20)

- Tabla: `gy_feltoltes` (uuid+mod egyedi): allapot, katt_tipus, **maszkolt** click-ID (`ABCD…xyz (24)`; 20 karakter alatt csak `*** (hossz)`), order_id (tartos HMAC hash), konverzio_ido (Europe/Budapest), ertek (19000), consent (`nem_ismert`), a foglalas hozzajarulas-erteke, payload_hash. Megorzes 90 nap. Teljes click-ID nem kerul a naploba (az `gy_foglalas.gads_katt_ertek` 60 nap utan torlodik).
- Jogosult: igazolt=1, allapotfelmeres, nem teszt, nem lemondott, van gclid / gbraid / wbraid. A sorok az igazolaskor es a `GET /api/gy-admin?gfeltoltes=1` hivaskor (visszamenoleg is) keszulnek.
- Kapcsolo `GY_GADS_FELTOLTES` = `ki` | `dry` (alap) | `eles` (meg nincs bekotve: nincs OAuth / kuldo, halozati hivas nincs). A Google-nek jelenleg semmi nem megy ki.
- Kuldendo mezok (leendo eles): click-ID, conversionDateTime, conversionValue 19000 HUF, orderId; consent mezo NINCS kitoltve (UNSPECIFIED; Feri 2026-10-20). Nev / e-mail / telefon / panasz / enhanced conversion nincs.
