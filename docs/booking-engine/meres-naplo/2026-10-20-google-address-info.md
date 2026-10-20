# Google ARNYEK: address_info a user_identifiers-ben - meresi naplo, 2026-10-20

Vendegadat, kulcs, gclid, hash-ertek nincs benne.

## 1. Mi ez (forras)
Feri kerese 2026-10-20 (a mérési oldal "Google ARNYEK-feltoltes kiegeszitese" uzenete): a 10:06-os HeadSpa FoglalasElso ARNYEK-feltoltes (http 200) mar viszi a gclid-et, erteket, HUF-ot, order_id-t, consent GRANTED-et, `hashed_email`, `hashed_phone_number`, IP-t, user agentet; kerés: a `user_identifiers` bovitese `address_info`-val (`hashed_first_name`, `hashed_last_name` normalizalt SHA-256, `country_code = "HU"`, `postal_code`, ha ismert), mind a 8 ARNYEK-akciora es a HeadSpa-ra is. A torzs-epito egyetlen (`googleKerelem`), ezert minden ARNYEK-akcio ugyanazt kapja. **Csak ARNYEK-feltoltes (masodlagos akciok); elo konverzio, foglalasi folyamat, futo hirdetes nem valtozik.**

## 2. Mi valtozik a Zapier-torzsben
- Uj top-level mezok (a Zap ezeket kepezi, vagy az `address_info` elemet): `hashed_first_name`, `hashed_last_name`, `country_code` (`"HU"`), `postal_code` (ha ismert).
- `user_identifiers` uj eleme: `{ address_info: { hashed_first_name, hashed_last_name, country_code, postal_code? } }` (a `hashed_email` / `hashed_phone_number` elemek utan; osszesen max. 5).
- **Feltetelek (mind):** a vendeg MINDKET neve ismert (egy nev / nev nelkul: nincs `address_info`); az orszag `HU` (a meglevo `country` szabaly: magyar / telefon nelkuli; kulfoldi szamnal nem talaljuk ki); a Google hozzajarulas-szabaly engedi (`felhasznaloi_adat`, GRANTED; rogzitett elutasito dontesnel nincs); `MERES_GAZDAGITAS` nem `0`.
- **Nev-normalizalas (Google):** kisbetu + a szo elejerol / vegerol az irasjel / szokoz levagva, a szon BELUL a kotojel / aposztrof marad ("Kovacs-Nagy" -> `kovacs-nagy`; a Google address_info szabalya). Ugyanaz a tokenizalas, titulus-szuro (dr, prof, id, ifj, ozv ...) es nev-sorrend (MERES_NEV_SORREND), mint a Meta-feleben; a Meta-fele `nevReszek` (irasjel nelkul) **valtozatlan**, a Meta / TikTok / GA4 torzsek bajtra azonosak.
- **`postal_code` NYERSEN** megy (a Google address_info.postal_code nem hash-elt), CSAK pontosan 4 szamjegyu magyar iranyitoszamkent (elirt / kulfoldi ertek kimarad). Csak ajandekkartya-vasarlasnal van forras (Stripe PI metadata); a motornal / sd-nel nincs, ott kimarad. A naplozott torzsben maszkolt. Ez az elso nyers (nem hash-elt) vendegadat a kimeno torzsben, es a Zapier feladat-elozmenyeiben is megmarad: kulon kimondando.
- **Naplo:** `elosztas.js` `HASH_KULCSOK` / `NEV_HASH_KULCSOK` + `hashed_first_name`, `hashed_last_name`, `postal_code` -> a D1 `kerelem`-ben `"[hash]"` (az `address_info` belsejeben is; `MERES_NAPLO_TELJES=1` modban is); a `country_code` lathato. A nyers nev a memoriaban el, nem naplozodik.

## 3. FIGYELEM - mikor jelenik meg az eleso adatban
A nev a Zap `nev` mezojebol (vagy az `email_html` tartalekabol) jon. A 10-20 08:55-os #167 jelentes szerint a motoros sorok Metaban eddig csak `country`-t vittek (nev nem): a **`nev` mezo a Zap-ban a mérési oldal teendoje** (PR-B ota nyitott). Addig a motoros ARNYEK-feltoltesekben az `address_info` nem jelenik meg (a nev nem ismert); az ajandekkartya-ag (Stripe `nev` + `iranyitoszam`) ota megjelenik. Az ARNYEK Google-Zap leképezése (`hashed_first_name`, `hashed_last_name`, `country_code`, `postal_code` vagy az `address_info` elem) szinten a mérési oldal teendoje; a Zap ismeretlen mezoket nem utasit el.

## 4. Vedett elemek (blob-hash), main (563b4b37..938423d0 utan) -> ez a valtozat
- Valtozik: `platformok.js` 91f9aeb2c5 -> fe44b838c0; `elosztas.js` 958f2c60dc -> c63cb34329; `hash.js` 19b6f27a19 -> 0b5cc3a9dd; `felhasznalo-hash.js` 083870c1bc -> 1684942738.
- Valtozatlan: `vegpontok.js` 085bed6aad, `qa-nap.js` 2334390be3, `esemeny-modell.js` 4342e6f09b, `google-proba.js` f1bb0095f8, `erkezes.js` 496c3840ec, `netlify/lib/foglalas-kulcs.js` 574f59b000. A golden fixture (`tools/fixtures/golden-motor-kerelem.json`) valtozatlan (a fixture-vendegnek nincs nev -> a Google-torzs nem valtozik).

## 5. Tesztek
`test-adatgazdagitas` 22/22 (zart kulcslista a nevvel + iranyitoszammal epult torzsre; reszleges hozzajarulas-dontes; 4 szamjegyes iranyitoszam; tipografiai aposztrof / kotojel; uj: Google address_info - nev-normalizalas, kotojel, egy nev / nev nelkul / kulfoldi telefon / `MERES_GAZDAGITAS=0` / elutasito dontes: nincs address_info; postal_code nyersen az ajandekkartyanal, kimarad a motornal; naplozott torzs maszk teljes=false/true; nyers nev / varos sehol); a tobbi `tools/test-*.mjs` zold, a ket ismert alap-hiba kivetelevel (`test-foglalo-atkotes` 19., `test-fuggetlenseg` 3.).

## 5b. FONTOS - a Google API szerint ClickConversion-nel az address_info valoszinuleg NEM tamogatott
A Google Ads API referencia (`ClickConversion.user_identifiers`, v22-v25): „Only hashed_email and hashed_phone_number are supported for conversion uploads"; az `address_info` a `ConversionAdjustment`-nel (enhanced conversions for web) tamogatott. A motoros agon az iranyitoszam soha nincs, a Google cim-alapu egyeztetese viszont veznevet, keresztnevet, orszagot es iranyitoszamot egyutt kerne. **Kovetkezmeny:** ha a Zap leképezi az `address_info`-t az ARNYEK click-conversion feltoltesbe, az elutasitas / hiba (`NEEDS_ATTENTION`) valoszinu; a szerver oldali kod ettol meg tiszta (a Zap az ismeretlen mezoket kihagyja, Google-nal nincs tartalek-torzs, a Zapier mindig 200-at ad). **A leképezes (Zap) elott: egyetlen validate_only / probafeltoltes + az offline-diagnosztika; az elem csak akkor menjen, ha van `postal_code`.** Amig ez nincs, a PR merge-e sem javasolt (felesleges extra szemelyes adat a Zapier fele).

## 6. Rollback
`MERES_GAZDAGITAS=0` (env, a `wrangler.toml` [vars] kommentelt sora + deploy; ugyanaz a fo kapcsolo, mint a PR-B-nel - az osszes bovitett mezot kikapcsolja), vagy a merge-commit revertje.

## 7. Probafeltoltes
Szandekosan NEM futott kulon probafeltoltes: a google_proba admin-vegpont probakulcsat (DECISION #199/#200) toroltuk / 10-20 12:00Z-kor lejar, uj kulcs + eles Google-feltoltes (visszavonassal) kulon DECISION + Feri kulon mondata nelkul nem megy. A "http 200 + nincs uj hiba az offline-diagnosztikaban" az elso, nevvel rendelkezo termeszetes feltoltesnel ellenorizheto (D1 `meres_kuldes`: `http_status`, a `kerelem`-ben a maszkolt uj mezok; Google offline-diagnosztika a mérési oldalon).
