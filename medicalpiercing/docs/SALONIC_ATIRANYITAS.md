# Salonic-oldalak átirányítása a saját foglalómotorra

Feri kérése (2026-10-17): aki közvetlenül (legfelső ablakban) a `medicalpiercing.salonic.hu` foglalóoldalaira érkezik – főleg régi
hirdetések `.../showServices/...` linkjei –, automatikusan a saját foglalómotorunkba kerüljön, úgy, hogy a motor által keretben (iframe)
használt Salonic-adatlap ne sérüljön. Élesítés előtt a Meta Schedule-párosítást le kellett ellenőrizni.

**Állapot: ÉL (2026-10-17).** GTM-KMNT72W6 (Mosaic Headspa GTM-fiók – az MP-fiókban nincs jog konténert létrehozni), a Salonic MP-fiók „<head> részbe illeszthető kód” mezőjében; éles próba: `meres-naplo/2026-10-17-mp-salonic-atiranyitas-eles.txt`.

## 1. Mi fut most a Salonic-oldalakon (2026-10-17, a `/selectLocation`, `/showServices/`, `/guestData/` HTML-je)

- **Nincs GTM-konténer, nincs Meta-pixel (`fbq`), nincs gtag, nincs TikTok** – a Salonic `widget.min.js`-e sem olvas `_fbp`/`fbclid`-et.
- Egyetlen saját elem: az **„Egyedi CSS URL”**: `https://www.medicalpiercing.hu/assets/salonic/mp.css`.
- A Meta `Schedule` eseményt (adathalmaz `2177829632420786`) **a Salonic szervere küldi** (Conversions API), nem böngészőből.
- Ezért **JavaScriptet csak egy, a Salonic-fiókban megadott GTM-konténerrel** lehet a Salonic-oldalakra juttatni (a Mosaic négy fiókja így tölti a
  `GTM-PST2HB22`-t, `docs/booking-engine/KUPON_LINK.md`). A CSS-ből átirányítani nem lehet.

## 2. Mérés: iframe-es (motor) vs. közvetlen Salonic-foglalás – Meta Schedule

Források: Meta `ads_get_dataset_stats` / `ads_get_dataset_quality` (2026-09-20 – 10-17, 28 nap), D1 `mp_foglalas` (`forras`: `motor` = a motor keretében,
`salonic` = közvetlenül a Salonicon foglalt és a köszönőoldalunkra érkezett).

| | Érték |
|---|---|
| Schedule, 28 nap | **980 db, 100% SERVER** (böngészős Schedule nincs) |
| Schedule esemény-URL | mind a 980: `http://medicalpiercing.salonic.hu/` (fix, a Salonic adja – oldalt / utat nem különböztet) |
| EMQ (Schedule) | **6,3**; e-mail 100%, telefon 100%, IP 100%, UA 100%, fbp 5,1%, fbc 0% |
| Eszköz, 28 nap | Android 474, iPhone 360, asztali 138, iPad 5, Android-tablet 3 |
| A motor élesítése | 2026-10-11 13:22 UTC óta 100% (ATADAS.md) |
| D1, 10-12 – 10-16 (UTC) | 189 foglalás: **motor (iframe) 174 = 92%**, közvetlen Salonic 15 = 8% |
| Meta Schedule ugyanerre (UTC-napok) | **172** = a D1 91%-a (napi: 37/40, 33/36, 32/36, 40/44, 30/33) |
| Napi Schedule a motor előtt / után | 36,2/nap (09-20 – 10-10) / 33,4/nap (10-12 – 10-16, Meta-időzóna) |
| iPhone-arány a Schedule-ban előtte / utána | 37,3% / 34,1% |

**Megállapítás.** A két út a Meta adataiban **nem választható szét** (szerveres esemény, egyetlen fix URL, a match key-ek a Salonic-adatlap mezőiből
és a szerver kéréséből jönnek). De: 2026-10-12 óta a foglalások 92%-a már a motor keretében történik, és a Meta ugyanannyi Schedule-t kap (a D1 91%-a),
iPhone-ról is (34%) – tehát **a keretes (Safari/iOS-es) foglalás is Schedule-t ad**, ugyanazokkal a párosító adatokkal (e-mail, telefon, IP, UA 100%).
Az átirányítás a maradék ~8%-ot (napi ~3 foglalás) tereli át ugyanerre az útra. Az egyetlen nem ellenőrizhető tétel az fbp 5,1%-a (a Salonic-oldalon
nincs pixel, a forrása ismeretlen); ennek legfeljebb egy része érintett, az EMQ-t az e-mail/telefon adja.
**Ítélet: a Meta Schedule-párosítás szempontjából az élesítés biztonságos.**

Élesítés utáni ellenőrzés (olcsó, meglévő adatból): a D1 `forras='salonic'` napi száma ~3-ról 0–1-re esik, a Meta Schedule / D1 arány marad ~0,9
(napi |eltérés| a megszokott ±4-en belül). Az átirányított vendégek a saját oldalon is láthatók: a cím `?mp_honnan=salonic` jelölőt kap (GA4 page_location).

## 3. Megoldás

- `assets/salonic/atiranyitas.js` – a logika (a build írja be a kapcsolót: `salonic-atiranyitas.json` `"be": true` **és** a motor 100%-on). A fájl a
  Salonicnak mindig ellenőrizve megy ki (`lib/salonic-css.js`: `no-cache`), így a kikapcsolás azonnal hat, a GTM-et nem kell újra közzétenni.
- `docs/salonic-atiranyitas-gtm.html` – a GTM „Egyéni HTML” címke: csak a legfelső ablakban tölti be a fenti fájlt (keretben ki sem tölti).
- Átirányít: `/`, `/selectLocation`, `/selectSpecialization/`, `/showServices/`, `/employees/<id>/`, `/selectEmployee/`, `/selectDate/` →
  `https://www.medicalpiercing.hu/idopontfoglalas?placeId=…&serviceId=…&employeeId=…&mp_honnan=salonic` + az `fbclid`, `gclid`, `gbraid`, `wbraid`,
  `ttclid`, `msclkid`, `utm_*` változatlanul; `location.replace` (a Vissza gomb nem visz vissza a Salonicra).
- NEM irányít át: keretben (a motorunk adatlapja); `/guestData/`, `/booking/*` (lemondás, „A foglalásod”), `/user/*`, ajándékkártya, jogi oldalak,
  nyelvváltás; ismeretlen paraméteres cím (pl. SMS-/e-mail-link azonosítója); `?mp_nincs_atiranyitas=1` (utána a lapban végig); ha a hivatkozó a
  `*.medicalpiercing.hu` (a saját oldalról szándékosan a Salonicra ment vendég); 30 mp-en belül ugyanoda másodszor (hurok-védelem).
- A saját oldal (`motor-indito.js`): a `/idopontfoglalas` a címből előválasztja a helyszínt / kezelést / szakembert, és az `fbclid`/`utm_*`-t az
  adatlapnak is továbbadja (eddig a betöltéskor nyíló motor ezt nem adta át); ha a motor ki van kapcsolva / nem tölt be, a Salonicról jött vendéget a
  Salonicra küldi vissza (`mp_nincs_atiranyitas=1`); a nem a motort nyitó Salonic-linkek és a motor tartalék-linkje is megkapják ezt a paramétert.

## 4. Teszt

`node tools/build.mjs && node tools/serve.mjs`, majd `node tools/salonic-atiranyitas-teszt.mjs [--mobil] [--webkit]` – a valódi Salonic-oldalakon, a
GTM-címke böngészőbeli bejuttatásával (a Salonicon semmi nem változik), valódi foglalás nélkül (a Salonic felé csak GET, a mérőkérések eldobva).
Eredmény 2026-10-17: Chromium asztali / mobil (Pixel 5), WebKit asztali / mobil (iPhone 13): **4 × 57/57 OK** (`meres-naplo/2026-10-17-mp-salonic-atiranyitas-teszt.txt`).

## Élesítés (ami hátravan – külső fiók, Feri kifejezett kérése kell)

1. GTM: **új, csak erre szolgáló konténer** (pl. „MP – Salonic”), benne egyetlen címke (`docs/salonic-atiranyitas-gtm.html`), trigger: Inicializálás –
   minden oldal, Page Hostname = `medicalpiercing.salonic.hu`. Ne az oldal `GTM-T9GR4JCK`-ja legyen (abban GA4 + TikTok van; a Salonicon nincs
   hozzájárulás-kezelés, ott hozzájárulás nélkül mérne), és ne a Mosaic `GTM-PST2HB22`-je (Mosaic-címkék).
2. A Salonic-fiók (Medical Piercing) beállításaiban a GTM-azonosító mezőbe az új konténer azonosítója (ahogy a Mosaic-fiókokban).
3. Közzététel után: `salonic-atiranyitas-teszt` élesben (a valódi GTM-mel), 1 kézi ellenőrzés iPhone-on; 24–72 óra: D1 `forras='salonic'` ↓, Meta Schedule / D1 ≈ 0,9.

**Visszaállítás:** `salonic-atiranyitas.json` → `{ "be": false }`, merge (azonnal hat), vagy a GTM-címke szüneteltetése / a GTM-azonosító törlése a Salonicban.
