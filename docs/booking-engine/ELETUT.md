# Életút-események (DECISION-LOG #102) – a foglalás létrehozása UTÁNI állapotok

Állapot: 2026-10-06. Draft; a PR #128 (QA-2 PASS, QA-3 alatt) tetejére épül, a QA-3 után olvasztjuk össze. Az ág: `claude/mosaic-meres-eletut` (PR #138), előnézet: `https://claude-mosaic-meres-eletut.mosaic-d77.pages.dev`.
Éles pixelre / property-re / akcióra **semmi** nem megy: az árnyék-célok kódban rögzítettek (`platformok.js`, `eletut-kerelem.js`), a Google-korrekció csak `ARNYEK` másodlagos akcióra állítható össze.

## Mit küld az állapot

| állapot | Google | Meta / TikTok | GA4 |
|---|---|---|---|
| `lemondva` | **RETRACTION** (a létrehozáskor kiküldött konverzió visszavonása) | – (a konverziót nem lehet visszavonni; a lemondást a létrehozás előtti élő ellenőrzés + a Google-visszavonás kezeli) | – |
| `nem_jelent_meg` | **RETRACTION** | `<Üzletág>_NemJelentMeg` **diagnosztikai** esemény (nem konverzió: nincs `value`) | – |
| `megjelent` | – (a konverzió már kiment) | `<Üzletág>_Megjelent` **diagnosztikai** esemény | – |
| ajándékkártya-visszatérítés, teljes | **RETRACTION** | – | `refund` (a visszatérített összeg) |
| ajándékkártya-visszatérítés, részleges | **RESTATEMENT** (az új érték = összeg − visszatérített) | – | `refund` (a mostani visszatérítés = a kumulált változás) |

Egy foglalásnak **egy** lezáró állapota lehet. Azonos állapot ismét = idempotens (nincs új küldés, `mar_kuldve`); bármilyen más állapot **ellentmondás**: nem küldünk, riasztás (`GET ?riasztas=1`), kézi döntés. A kiment visszavonás / diagnosztika nem vonható vissza csendben.

## `POST /api/foglalas-eletut` (kulcsos: `x-egyeztetes-kulcs`, mint a `/api/foglalas-egyeztetes`; kulcs nélkül `404 {"ok":false}`)
```json
{ "uuid": "<Salonic UUID>" , "allapot": "lemondva | nem_jelent_meg | megjelent", "ido": "2026-10-20T15:30:00Z", "forras": "salonic-zap", "vendeg": { "email": "..", "telefon": ".." } }
```
- `uuid` **vagy** `booking_id` (`mb_…`): a párosított foglalás. `ido`: mikor történt (ISO-8601, nem lehet jövőbeli; hiányában most). `forras`: szabad szöveg (≤ 60). `vendeg`: opcionális, friss e-mail / telefon (nyersen, a szerver hash-eli, nem tárolja); hiányában az eredeti, már kiküldött alapesemény hash-elt adata.
- Meta / TikTok felé a létrehozáskori IP / user agent **nem** megy (az esemény offline történik), a `em` / `ph` / `external_id` / `fbc` / `fbp` (Meta), `email` / `phone` / `external_id` / `ttclid` / `ttp` (TikTok) igen.
- Élő Salonic-ellenőrzés a kérés idején: `lemondva` csak „törölve” oldalra; `megjelent` / `nem_jelent_meg` csak nem törölt foglalásra és **az időpont kezdete után** (a kezdés a párosítási kulcsból jön: `placeId|employeeId|startUnix`).
- Válasz (`200`): `{ ok, allapot, source_id, uzletag, eletut_allapot, elozo, elo_allapot, cellak[] }`; `allapot` =
  `kesz` (kiment / dryRun) · `mar_kuldve` (ismétlés) · `halasztva` (a Salonic-oldal nem ellenőrizhető → `ujraprobal_mp`: 180, ilyenkor **nem tárolunk függő sort: a hívó ismétli** ugyanazzal a kéréssel; vagy egy cella halasztott → 3600, ezt a `fuggo` művelet is felveszi) · `ellentmondas` (+ `riasztas: true`) · `korai` (az időpont még nem kezdődött el) · `nem_torolve` (lemondás, de a foglalás él) · `torolt_foglalas` (megjelent / nem_jelent_meg törölt foglalásra) · `ismeretlen_foglalas` (nincs páros) · `ervenytelen` · `ki` (nincs bekapcsolva).
  `cellak[]`: `{ platform, esemeny_id, platform_nev, allapot, http_status, kuldo, duplikalt? }`.
- `POST {"muvelet":"fuggo"}`: a halasztott / hibás / (élesítés után) dryRun cellák újrafeldolgozása (időzített hívónak, pl. óránként egy Zap).
- `GET ?source_id=mb_…` (foglalás) vagy `pi_…` (ajándékkártya): az életút-állapot + napló + cellák; `GET ?riasztas=1`: az ellentmondó / elutasított bejegyzések.

### A lemondási értesítő
A `/api/foglalas-egyeztetes` `tipus: lemondas` hívása (a Salonic lemondási levele) a kulcs felszabadítása mellett — ha a kulcs tulajdonosa élő ellenőrzéssel `torolve` — a foglalás `lemondva` állapotát is elindítja (`eredmenyek[].eletut`). Csak `MERES_ELOSZTO=1` és `MERES_ELETUT=1` mellett; hiba esetén `eletut: {allapot: "hiba"}`, a kulcs-felszabadítást nem érinti.

> **Nyitott pont a mérési munkamenetnek:** a `megjelent` / `nem_jelent_meg` jelzést ki hívja? A Salonic nem küld webhookot a megjelenésről; a hívó (Zap / kézi felület) a szalon naptárából / zárásából kell, hogy jöjjön. Az endpoint a bemenetét fent rögzíti; a forrás kialakítása nem része ennek a PR-nek.

## Google-korrekció a Zapieren át (a `01a0e569` előkészített minta szerint)
`POST GOOGLE_KORREKCIO_WEBHOOK_URL` (Preview-titok, Secret típus; a nyers URL soha nem kerül naplóba), törzs:
```json
{ "adjustments": [ { "type": "RETRACTION", "orderId": "FoglalasElso:mb_…", "conversionActionId": "7825199989",
                     "adjustmentDateTime": "2026-10-20 17:30:00+02:00", "note": "nem_jelent_meg: mb_…" } ],
  "dryRun": true }
```
- `RESTATEMENT`: + `"value": <új érték, egész HUF>`, `"currency": "HUF"`; csak pozitív értékkel (0 = teljes visszavonás = RETRACTION).
- `orderId` = az eredetileg kiküldött konverzió `order_id`-ja (= az alapesemény `event_id`-ja), ≤ 64 karakter. `adjustmentDateTime`: nem lehet a jövőben (Google: `LATER_THAN_MAXIMUM_DATE`).
- **`dryRun: true` alapból** (a Zap `validateOnly`-t hív, semmit nem ír; a cella `dryrun` állapotú). Éles korrekció **csak `GOOGLE_KORREKCIO_ELES=1`** mellett (`dryRun: false`); a `dryrun` sor ekkor újrafeldolgozható (nem dupla).
- A Zap a `dryRun`-t a **JSON törzsből** olvassa (a query-stringből nem: ott a `?dryrun=true` NEM dryRun — ez a QA-2 során egy szintetikus konverziót ért).
- Sikeres átvétel: HTTP 2xx. A publikált Zapet a mérési munkamenet építi; ez a leírás a szerződés.
- Ha a Google a frissen feltöltött konverzió korrekcióját elutasítja (`CONVERSION_NOT_FOUND`), a `GOOGLE_KORREKCIO_VARAKOZAS_ORA` (alap 0) szabja meg, hány óráig halasszuk a korrekciót (a Google szabálya erről **ellenőrizetlen**, ezért alapból nincs várakozás).

## Meta / TikTok diagnosztikai esemény (nem konverzió)
- Név: `HeadSpa_Megjelent`, `PMU_NemJelentMeg`, … (`<Üzletág>_Megjelent` / `<Üzletág>_NemJelentMeg`); `event_id`: `Megjelent:<booking_id>` / `NemJelentMeg:<booking_id>` (külön az alap- / ernyőeseménytől); nincs `value` / `currency`.
- Meta: `action_source` = `physical_store` (megjelent) / `other` (nem jelent meg); `custom_data`: `esemeny_tipus: diagnosztika`, `eletut_allapot`, `order_id`, `content_category`. TikTok: `properties.order_id`, `content_type: product`.
- Csak az ARNYEK célra és csak tesztkóddal (Meta `TEST83939`, TikTok `TEST83543`); a 7 napnál régebbi esemény nem megy ki (a platformok nem fogadják).

## Ajándékkártya-visszatérítés
- Stripe `charge.refunded` → a webhook az `arnyekVisszateres`-t futtatja a meglévő `visszavonasEsemeny` előtt. A logika a **kumulált** visszatérített összegre épül (idempotens; kisebb összeg nem állítja vissza a korábbit): teljes → Google RETRACTION, részleges → Google RESTATEMENT; GA4 `refund` (72 óránál régebbi időbélyeg nem megy ki; `client_id` kell az eredeti purchase-ból). Meta / TikTok: nincs esemény.
- Admin segédek (`/api/meres-admin`, kulcsos): `{"muvelet":"ajandek_visszaterites_ujra","pi":"pi_…"}` (a visszatérítés-ág kulcsos újrajátszása a Stripe aktuális állapotából) és `{"muvelet":"ajandek_teszt_visszateritese","pi":"pi_…","osszeg":<fillér>}` (Stripe **teszt-módú** visszatérítés létrehozása; csak `sk_test_` / `rk_test_` kulccsal, élő kulccsal elutasítja).

## Környezeti változók
| változó | hol | szerep |
|---|---|---|
| `MERES_ELETUT` | `[env.preview.vars]` (`"1"`) | az életút-ág bekapcsolása (az éles `[vars]` nem kapja) |
| `MERES_KULDES_MOD` | csak ennek az ágnak az előnézete (`"nyelo"`) | **nyelő mód**: a kérések elkészülnek és teljesen naplózódnak, de semerre nem mennek ki (a QA-3 célpontjait ez az előnézet nem terheli) |
| `GOOGLE_KORREKCIO_WEBHOOK_URL` | Preview-titok | a Zapier-webhook a korrekcióhoz (hiányában a cella `nincs_hitelesites`) |
| `GOOGLE_KORREKCIO_ELES` | alap: nincs | `1` = éles (nem dryRun) korrekció |
| `GOOGLE_KORREKCIO_VARAKOZAS_ORA` | alap: 0 | a korrekció halasztása az eredeti feltöltéstől |
| `KULCS_DB` | `[[env.preview.d1_databases]]` | ennél az ágnál **külön** előnézeti adatbázis: `mosaic-foglalas-kulcs-eletut` (`51996f5f-6f25-4577-97bc-4ded7760b977`), hogy a QA-3 adatait (a #128 adatbázisa) ne érintse |

## Adatbázis
`meres_eletut` (egy sor foglalásonként / vásárlásonként: állapot, előző, idő, forrás, összeg / visszatérített fillérben), `meres_eletut_naplo` (minden bejövő hívás és a döntés), a cellák a `meres_kuldes` táblában (`esemeny_tipus` = `eletut` / `korrekcio`) ugyanazzal az egyedi (`esemeny_id`, `platform`) kulccsal → 0 dupla. Az `esemeny_id`-k: `Visszavonas:<eredeti esemény_id>`, `Megjelent:<booking_id>`, `NemJelentMeg:<booking_id>`, `Korrekcio:<eredeti>:<összeg>`, `Visszaterites:<pi>:<kumulált összeg>`.

## Ellenőrzött és nyitott
- Egységtesztek: `tools/test-eletut.mjs` (21), `test-foglalas-kulcs.mjs`, `test-meres.mjs`, `tools/ajandek-teszt/*.test.mjs`.
- Valódi E2E a saját előnézeten (TESZT – Claude foglalások, nyelő mód): `docs/booking-engine/meres-naplo/eletut-*.json`, futtató: `tools/meres-proba/eletut-eset.mjs`.
- **E2E-lelet (javítva):** a `megjelent` / `nem_jelent_meg` élő Salonic-ellenőrzése az üzletág → host leképezést a `HOSTOK`-ból vette, amelynek kulcsai (`oxygen` / `laser` / `hair`) mások, mint a mérés üzletágai (`oxigen` / `szor` / `fodrasz`), ezért Oxigén / Szőr / Fodrász foglalásra `halasztva` lett. Most a `SALONIC_UZLETAG` táblát használja; regressziós teszt mind az öt üzletágra.
- A `megjelent` / `nem_jelent_meg` E2E-hez a foglalás **kezdési ideje** a saját előnézeti adatbázisban a múltba van tolva (a TESZT-foglalás valójában jövőbeli); ezt a naplók jelzik. A Salonic-oldali állapot valódi.
- **Nincs** (nem épült): Meta / TikTok esemény lemondáskor (a konverziót nem lehet visszavonni; csak Google-visszavonás), `megjelent` / `nem_jelent_meg` hívó a Salonic felől (lásd fent), a Zap publikálása.
