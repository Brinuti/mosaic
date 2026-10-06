# `/api/foglalas-egyeztetes` – a Salonic-levélből induló hívó (Zap) bemenete

Állapot: 2026-10-06, a mérési munkamenet (Zapier) hívójához. A végpont a **PR-előnézeten** él (`https://claude-mosaic-meres-qa-1-rrb.mosaic-d77.pages.dev`); az éles oldalon nincs kötve (503 / 404). Háttér: `BOOKING_ID.md` (kulcs-tábla, párosítás), `QA2_ARNYEK.md` (árnyék-küldés).

## Hitelesítés
- `POST https://<előnézet>/api/foglalas-egyeztetes`, `content-type: application/json`, a törzs legfeljebb 256 KB (262 144 karakter; efelett `413`) – egy teljes levél-HTML is elfér.
- Kulcs: **`x-egyeztetes-kulcs: <kulcs>` fejléc** (vagy `?kulcs=`). A kulcs SHA-256-ja az `EGYEZTETES_KULCS_HASH` preview-változóban van; a kulcs maga a Zapier Storage-ban (a Zap onnan olvassa), a repóban és a naplókban nincs. **Kulcs nélkül / rossz kulccsal a válasz `404 {"ok":false}`.** (A kulcsot 2026-10-06-án újragenerálták; a régi kulcs érvénytelen.)

## 1. Létrehozó levél („Új időpont létrehozva” / „Új online foglalás érkezett”)

Egy hívás egy levélre. A végpont a Salonic UUID-jából (`uuid` + `host`) két olvasó GET-tel képezi a kulcsot (`placeId|employeeId|startUnix`), a böngésző köszönőoldali írásával párosítja a saját `booking_id`-t, **élőben ellenőrzi, hogy a foglalás még él-e**, és csak akkor küldi az árnyék-eseményeket.

| mező | típus | kötelező | jelentés |
|---|---|---|---|
| `uuid` | string (UUID) | **igen** (vagy az `email_html`-ben a link) | a Salonic foglalás-azonosítója: a „Foglalás részletek” / „Lemondom” link (`/booking/bookingDetails/<uuid>`, `/booking/cancelBooking/<uuid>`) vagy a szalon-levél „Foglalás megtekintése” linkjének `bookingId=<uuid>` része |
| `host` | string | **igen** (vagy az `email_html`-ben a link) | a Salonic-fiók: `mosaicheadspa.salonic.hu` · `mosaic-hair.salonic.hu` · `mosaic-oxigen.salonic.hu` · `mosaic-elysion.salonic.hu` (szőr) · `mosaic-pmu.salonic.hu`; ebből lesz az üzletág. Ismeretlen host: `esemeny_kuldes.allapot = "nincs_uzletag"` |
| `level_datuma` | string, ISO 8601 időzónával (`2026-10-06T16:22:10Z`) | ajánlott | a levél dátuma = az **esemény időpontja** (Meta `event_time`, TikTok `event_time`, Google `conversion_date_time`). Hiányában „most”. A Meta / TikTok 7 napnál régebbi eseményt elutasít |
| `vendeg` | `{ "email": string, "telefon": string }` | ajánlott | a vendég e-mailje és telefonja **nyersen**: a szerver hash-eli (SHA-256, normalizálva); nem tárolódik, és a Google / GA4 felé hozzájárulás nélkül nem is megy. **Az `email_html`-ből a végpont ezt nem olvassa ki**: a Zapnek kell |
| `uj_vendeg` | boolean | ajánlott | a Salonic „új vendég” jelzése a levélből (**az igazság**). `true`: FoglalasElso / Konzultacio; `false`: csak `Visszajaro` (nem konverzió); hiányában a böngésző `first_booking` jelzése, különben ismeretlen (konzultáció-nevű szolgáltatásnál konzultáció, egyébként nem konverzió). A jelzést a Zap ugyanúgy olvassa a levélből, mint a meglévő „új vendég” Zapek |
| `ar` | number (Ft) | nem | a tényleges ár (tartalék). Sorrend: `ar` → az `email_html` „Fizetendő várhatóan” / „Price” sora → a böngésző. Konzultációnál az esemény értéke a konzultáció-táblából jön (a Salonic ára csak a naplóban: `salonic_ar`) |
| `szolgaltatas` | string | ajánlott | a szolgáltatás neve: ebből lesz konzultáció (`/konzult\|hajkamer/i`) vagy kupon (`/kupon/i`: ernyő nélkül); a név-táblás tartalék ághoz is kell |
| `felado`, `idopont_szoveg`, `munkatarsak[]`, `ld {startDate}` | string / string / string[] (≤ 10) / objektum | csak tartalék | a név-táblás tartalék ághoz (ha a Salonic-oldalak nem olvashatók): a szalon neve, az időpont szövege (`Október 20. (kedd) 17:30 - 18:50`), a munkatársak, a JSON-LD `startDate` |
| `email_html` | string | alternatíva | a **vendégnek szóló** visszaigazoló levél (vagy a szalon-levél) teljes HTML-je: ebből a végpont kiolvassa a `uuid`-t, `host`-ot, `felado`-t, `szolgaltatas`-t, `idopont_szoveg`-et, `munkatarsak`-at, `ld`-t és az `ar`-t. A kinyert mezőket a kifejezetten megadott mezők felülírják |
| `diagnosztika` | boolean | nem | a név-táblás ág is lefut, csak a nyomhoz |

**Válasz** (`200`): `{ ok, allapot, kuldheto, duplikalt, booking_id, esemeny_id, kulcs, kulcs_forras, probalkozas, ujraprobal_mp, riasztas, nyom, esemeny_kuldes }`
- `allapot`: `parositott` · `fuggoben` · `parositatlan` · `ellentmondas` · `ervenytelen` (hibás UUID).
- **`fuggoben`**: a böngésző köszönőoldali írása még nem érkezett meg → **ismételd `ujraprobal_mp` másodperc múlva** (1., 3., 10., 30. perc: 60 / 180 / 600 / 1800 mp; a 4. sikertelen után `parositatlan` + riasztás: `GET ?riasztas=1`). Idő előtti ismétlés: `korai: true`, nem számít próbálkozásnak.
- `ellentmondas`: két élő foglalás ugyanazzal a kulccsal: nem küld, riasztás.
- `esemeny_kuldes` (csak `parositott` és `MERES_ELOSZTO=1` mellett): `allapot` = `kesz` (kiment; `esemenyek[]` cellánként: platform, állapot, HTTP) · `mar_kuldve` (ismétlés: minden cella végleges, **nincs új küldés**) · **`halasztva`** (a foglalás élő állapota nem ellenőrizhető: ismételd `ujraprobal_mp` = 180 mp múlva) · `nincs_esemeny` (pl. HeadSpa-konzultáció: nincs ilyen ág) · `nincs_uzletag` · `ki` · `hiba`; továbbá `elo_allapot` (`aktiv` / `torolve`), `jelleg`, `uj_vendeg`, `salonic_ar`, `ertek`, `ar_forras`, `uzletag`. **Lemondott (`torolve`) foglalásra nem megy ki esemény.**
- A levél ismétlése biztonságos: ugyanarra a UUID-ra `duplikalt: true`, `kuldheto: false`, nincs új küldés.

### Példa (kulcs nélkül; a `<KULCS>` helyére a Zapier Storage-ban lévő kulcs kerül, a példa-adatok szintetikusak)
```bash
curl -X POST 'https://claude-mosaic-meres-qa-1-rrb.mosaic-d77.pages.dev/api/foglalas-egyeztetes' \
  -H 'content-type: application/json' \
  -H 'x-egyeztetes-kulcs: <KULCS>' \
  -d '{
    "uuid": "2aae042b-7acf-30e2-017f-66febe61e2e3",
    "host": "mosaicheadspa.salonic.hu",
    "level_datuma": "2026-10-06T16:22:10Z",
    "szolgaltatas": "PÁROS MOSAIC Head Spa kezelés (50 perc + Szárítás)",
    "vendeg": { "email": "vendeg@example.com", "telefon": "+36 70 123 4567" },
    "uj_vendeg": true,
    "ar": 53800
  }'
```
Ugyanez a teljes levél-HTML-ből (a vendég adatait és az `uj_vendeg`-et ekkor is külön kell adni): `{"email_html": "<…a levél HTML-je…>", "level_datuma": "…", "vendeg": {…}, "uj_vendeg": true}`.

## 2. Lemondó levél („Foglalás lemondás” / lemondási értesítő)

A lemondási értesítőben **nincs UUID, link és JSON-LD**; csak a szalon neve a záró sorban, a szolgáltatás, a munkatárs és az időpont szövege. A hívás a **kulcs felszabadítására** szolgál (ha ugyanazt az időpontot később újrafoglalják, a két foglalás ne ütközzön): a végpont a kulcsot a név-táblából képezi, a kulcs birtokosát **élőben ellenőrzi** a Salonic-oldalon, és csak „törölve” esetén szabadítja fel; a még élő foglalást nem.

| mező | kötelező | jelentés |
|---|---|---|
| `tipus` | igen (ha nem `email_html`) | `"lemondas"` |
| `felado` | igen | a szalon neve (a „Üdvözlettel: …” sorból), pl. `Mosaic Headspa` |
| `szolgaltatas` | igen | a lemondott szolgáltatás neve |
| `idopont_szoveg` | igen | az időpont szövege (év és időzóna nélkül), pl. `Október 20. (kedd) 17:30 - 18:50` |
| `munkatarsak[]` | igen | a munkatársak nevei |
| `level_datuma` | ajánlott | a levél dátuma (az időpont évének következtetéséhez) |
| `email_html` | alternatíva | a lemondási értesítő teljes HTML-je (a „sikeresen lemondtad” / „has been cancelled” szövegről a végpont maga felismeri); `tipus` ekkor nem kell |

Nem kell: `uuid`, `host`, `vendeg`, `uj_vendeg`, `ar`. **Válasz:** `{ ok: true, tipus: "lemondas", allapot: "lemondas" | "ismeretlen", eredmenyek: [{ kulcs, tulajdonos, elo_allapot, eredmeny }] }`; a lemondás **eseményt nem küld és konverziót nem von vissza** (a QA-2 árnyékmódban a visszavonás / életút-események – Google RETRACTION, no-show, megjelent – nincsenek megépítve; a lemondás tényét a küldés előtti élő ellenőrzés kezeli: lemondott foglalás eseménye nem megy ki).

```bash
curl -X POST 'https://claude-mosaic-meres-qa-1-rrb.mosaic-d77.pages.dev/api/foglalas-egyeztetes' \
  -H 'content-type: application/json' -H 'x-egyeztetes-kulcs: <KULCS>' \
  -d '{"tipus":"lemondas","felado":"Mosaic Oxigén","szolgaltatas":"Haj Oxigénterápia - 1. alkalom","idopont_szoveg":"Október 20. (kedd) 17:30 - 18:50","munkatarsak":["Szűcs Anna"],"level_datuma":"2026-10-06T17:14:36Z"}'
```

## 3. Egyéb hívások (ugyanazzal a kulccsal)
- `GET /api/foglalas-egyeztetes?uuid=<uuid>` – a párosítás állapota.
- `GET /api/foglalas-egyeztetes?riasztas=1[&formatum=html]` – a párosítatlan / ellentmondó foglalások listája (a piros szalagos HTML riasztásnak).
- `POST {"nevtabla":"frissit"[,"uzletag":"headspa"]}` – a név-tábla kényszerített frissítése (naponta egyszer elég). Az `uzletag` a **Salonic-adapter kulcsa**: `headspa` · `hair` · `oxygen` · `laser` · `pmu` (NEM a mérés üzletág-neve: `fodrasz` / `oxigen` / `szor` ismeretlen érték, `{"sorok":0,…}`-t ad; üzletág nélkül az összes fiók frissül).
- Árnyék-napló és vészkapcsoló: `/api/meres-admin` (`GET ?source_id=<booking_id>`, `?kapcsolok=1`; `POST {"muvelet":"kapcsolo","platform":"meta","be":false}`) – ugyanazzal a kulccsal.

## Mit csinál a Zap, lépésenként
1. Trigger: a Salonic-levél (létrehozó vagy lemondó).
2. Létrehozó: `uuid` + `host` a linkből, `vendeg`, `uj_vendeg`, `level_datuma`, `szolgaltatas`, `ar` → `POST`.
3. Ha `allapot = "fuggoben"` vagy `esemeny_kuldes.allapot = "halasztva"`: várj `ujraprobal_mp` másodpercet, és hívd újra ugyanazzal a törzzsel (max. 4 próbálkozás).
4. Lemondó: `tipus = "lemondas"` + a levél mezői → `POST` (sorrendjük a létrehozó leveleké mellett nem számít).
