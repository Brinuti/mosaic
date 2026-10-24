# GY-27: Google Ads konverzió-kiigazítás (RETRACTION) a lemondott foglalásokra – DRAFT, alapértelmezés KI

**MÉRÉST ÉRINT** (Google Ads konverzió-adat, a másodlagos `7858300772` akció). Kérés: #167 6374056468 (a mérési oldal spec-je a 6373420558. fejlesztői megjegyzés 3. pontja), határidő 10-27. **Nincs DECISION; a merge csak DECISION-nel vagy Feri mondatával, az `eles` mód csak Feri külön mondatával.**

## Mi változik (csak `gyogytorna/`)
- Új `lib/gkiigazitas.js`: jelöltválasztás, payload + védőháló, Zapier-híd (GET: felvétel + lefoglalás + kérés; POST: a Google válaszának értékelése), újrapróba-döntés.
- `lib/db.js`: additív `gy_kiigazitas` tábla; 90 napos megőrzés a `takarit`-ban; a `kattintasTorol` (visszavont hozzájárulás) a sort is törli.
- `lib/motor-szerver.js`: új `gadsKiigazitasVegpont`; védett hookok (try/catch, `lpcHiba`) a Salonic-igazolásnál és az óránkénti `?gfeltoltes=1` admin hívásnál (a `kiigazitas` blokk csak állapot-számlálókat ad). `functions/api/gy-gads-kiigazitas.js`: vékony burok.
- `wrangler.toml`: `GY_GADS_KIIGAZITAS = "ki"` (éles és előnézet).
- **Nem változik:** `lib/gfeltoltes.js`, a feltöltés, a foglalási folyamat (`public/assets/js/motor/*`), a GTM/Zapier/Google Ads fiók. A hookok `ki` módban a kérést nem érintik (a kiigazítás kódja nem fut le).

## Kapcsoló és működés
| `GY_GADS_KIIGAZITAS` | hatás |
|---|---|
| `ki` (alapérték, a változó hiányában is) | semmi: nincs felvétel, nincs marker, a végpont `{nincs:true}` |
| `dry` | a jelöltek naplózódnak (`gy_kiigazitas`), a Google-nek semmi nem megy ki |
| `eles` | a Zapier-végpont kiadja a kérést (csak Feri külön mondatával) |

Jelölt: ELES + `elfogadva` feltöltés, nem teszt foglalás, a feltöltés naplózása UTÁN lemondott, a feltöltés ≥ 48 óra és ≤ 50 nap régi. Kérés: `uploadConversionAdjustments`, `partialFailure=true`, elemenként CSAK `conversionAction`, `adjustmentType=RETRACTION`, `orderId`, `adjustmentDateTime` – **nincs click-ID, érték, consent, user_identifiers, vendégadat**. Hibabesorolás: lásd `docs/ADATTERKEP.md` GY-27.

## Tesztek
`npm run teszt` (gyogytorna): **76/76** (korábban 71; új: 5 GY-27 teszt). Fedés: kapcsoló-alapérték; payload mezői és tiltott mezők; védőháló (idegen mező/akció/típus/order_id/partialFailure/adag); jelölt-szűrés (feltöltés előtti lemondás, aktív, teszt, nem elfogadott feltöltés, 48 óra / 50 nap kapu, dry/eles külön sor, idempotens); végpont (401, `ki`/`dry` nem ír, GET→POST, sorhibák, `CONVERSION_ALREADY_RETRACTED` = kész, `CONVERSION_NOT_FOUND` átmeneti majd 72 óra után `nincs_konverzio`, újrajátszás 409, nincs click-ID a válaszban/D1-ben); küldés előtti újraellenőrzés; hozzáférési hiba (sorok visszaállnak + riasztás); értelmezhetetlen válasz; megőrzés/törlés.
**Őszinte megjegyzés:** a tesztek egy rész Google-válaszformátuma (hibakód-struktúra, `conversion_adjustments` mezőnév) az API-dokumentáció alapján szimulált – éles Google-hívás nem volt. Ezért kell a `dry` után egy `validateOnly` próba a Zapier-oldalon az `eles` előtt. Böngészős teszt nem kell (a front-end nem változik).

## Védett elemek blob-hash-e (változatlan)
`gyogytorna/lib/gfeltoltes.js` `d94560f394`, `lib/forras.js` `ad599532c4`, `lib/titkos.js` `6cfbf0992e`, `lib/salonic-szerver.js` `0b62249a55`, `tools/gfeltoltes-hid.mjs` `54e35e942c`; Mosaic `assets/js/booking-engine/engine.js` `ef41b61e51`, `lepes-meres.js` `73861ecefa`, `netlify/lib/foglalo-szamlalo.js` `3c609133d2`; MP `lib/meres/kiigazitas.js` `f79dbd1167`, `lanc.js` `4d8a657f00`. Módosult (dokumentált): `gyogytorna/lib/db.js`, `lib/motor-szerver.js`, `wrangler.toml`, `docs/ADATTERKEP.md`, `tools/test-gy-szerver.mjs`; új: `lib/gkiigazitas.js`, `functions/api/gy-gads-kiigazitas.js`, ez a napló.

## Rollback
1. Azonnal, kód nélkül: `GY_GADS_KIIGAZITAS = "ki"` (az alapérték; `dry`/`eles` bekapcsolás előtt ez van). 2. A PR revertje (a `gy_kiigazitas` tábla üresen/benne hagyható, nem zavar; `DROP TABLE gy_kiigazitas` opcionális). 3. Ha egy `eles` hívás kiment: a Google-ben visszavont konverzió nem állítható vissza egyszerűen (RESTATEMENT az érték-nem-idő miatt nem teljes), ezért az `eles` előtt `dry` + Zap-oldali `validateOnly` próba kell.

## Következő lépések (nem ennek a PR-nek a része)
Zapier-draft a végpont hívására (védőháló a 4 mezőre; publikálás csak engedéllyel) → `dry` bekapcsolás (DECISION) → dry-eredmény ellenőrzés → `eles` (Feri külön mondata).
