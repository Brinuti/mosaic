# UJ-62: HeadSpa ajándékkártya – szabványos Meta Purchase (szerveres ág, ÁRNYÉK-mód; draft)

Kérés: #167 6387024988 (01-MERES, Feri 2026-10-24 18:50: „valósan mérje az ajándékkártya-vásárlást, hogy tudjam használni a hirdetésekhez"). **Merge és élesítés csak DECISION + független review PASS (végső SHA) után; az átállás Feri külön mondata.** Mérést érint: igen (Meta, HeadSpa ajándékkártya).

## Mit csinál (és mit nem)
- Új kapcsoló: `META_PURCHASE_MOD` = `ki` (alap) | `arnyek`. **Minden más érték (az `eles` is) = `ki`**: az éles pixelre küldés nincs implementálva és nincs hozzá éles token/cél a kódban; az átállás külön, Feri külön mondatához kötött változtatás.
- `arnyek` módban az ajándékkártya-vásárlás (Stripe `payment_intent.succeeded`, és a szalon által igazolt beérkezett utalás) mellé a meglévő ÁRNYÉK-elosztó **egy szabványos `Purchase` eseményt** is kiad **csak a Meta ÁRNYÉK datasetbe** (`28616665324611098`, kötelező `test_event_code`, a `platformok.js` védelmei változatlanok): `event_id = st-<PaymentIntent>` (utalásnál `st-ATU-…`), érték = tényleges befizetett összeg (HUF), `order_id` = PI, `content_name = ajandekkartya`, `action_source = website`, a mostani teljes `user_data` (hash-elt em/ph/fn/ln/ct/zp/country + fbp/fbc/IP/UA).
- A `st-<PaymentIntent>` azonosító megegyezik a böngészős Purchase `eventID`-jával (`/success-ajandekkartya-stripe?session_id=<PI>`, GTM tag 213 mintája) → a Meta dedupolni tud. A böngészős GTM-oldal (workspace + Preview) **nem ennek a PR-nek a része** (külső fiók; DECISION-azonosítót kértem a #167-ben).
- Más platformra (TikTok, Google, GA4) a Purchase **nem** megy ki és nem is keletkezik sor (`csak_platform: ['meta']`). A meglévő két ajándékkártya-esemény (`HeadSpa_Ajandekkartya`, `Schedule`) változatlan.
- **Idempotencia:** `(esemeny_id, platform)` egyedi → webhook-újrapróba nem küld újra, nem ír új sort. Ha a kapcsolót `ki`-ről `arnyek`-re váltjuk egy már kiküldött PI-n, csak a Purchase-cella megy ki.
- **Visszatérítés / vita / lemondás:** az élő állapot-ellenőrzés (`torolve`) → a Purchase `kihagyva`; **visszavonást nem küldünk** (csak napló), ahogy kérték. Nem ellenőrizhető állapot → `halasztva`.
- Vészkapcsoló: a `meres_kapcsolo` (`mind` / `platform:meta` / `uzletag:headspa` / `cella:headspa:meta`) a Purchase-ra is érvényes.
- Vendégadat: nyers adat sehova (a kimenő kérésben hash, a D1-naplóban `[hash]`).

## Védett fájlok – dokumentált változás (alapértelmezésben, `ki` módban bájtra azonos viselkedés)
| fájl | előtte | utána |
|---|---|---|
| `netlify/lib/meres/esemeny-modell.js` | `4342e6f09b` | `713ab7e123` (új: `metaPurchaseMod`, `esemenyek` 3. paramétere, `metaNev` a `purchase` típusra) |
| `netlify/lib/meres/elosztas.js` | `958f2c60dc` | `8a5b40fbb5` (új: `metaPurchase` opció átadása; `csak_platform` szűrés a cella-ciklusban és a „teendő" számításban) |
| `netlify/lib/meres/platformok.js` | `86a6310a12` | **változatlan** |
| `wrangler.toml` | `2fff9489be` | `fbb85d7ad7` (csak a `META_PURCHASE_MOD = "ki"` sor + magyarázat, éles és előnézet) |
A `ki` módot a teszt a kimenő hívásokra és a `meres_kuldes` sorokra is bájtra összeveti a kapcsoló nélküli futással (`ki`, `eles`, ismeretlen érték).

## Tesztek
`node --test tools/test-meta-purchase.mjs` (9 teszt): kapcsoló-értékek; esemény-lista (opció nélkül változatlan; utalás `st-ATU-…`; foglalásnál/más üzletágnál nincs Purchase); `ki` mód bájtra azonos; `arnyek` mód (egyetlen új sor, csak meta, Meta-kérés mezői, ÁRNYÉK dataset + tesztkód, nyers adat sehol); idempotencia és `ki`→`arnyek` váltás; utalás; visszatérítés/halasztás; vészkapcsoló és hibás válasz; védelmek (éles pixelek tiltva, tesztkód nélkül tiltva). Mutációs próba: a kapcsoló bekötésének kivétele / mindig-be / a platform-szűrés kivétele mind elbukik. Régi csomag zöld: test-meres 51, test-adatgazdagitas 21, test-qa-nap 45, test-sd-smoke 14, test-tilt-sajat-iras 1. (A `test-fuggetlenseg` 2. tesztje a main-en is piros – D1-kötés azonosító, nem ennek a PR-nek a hibája.)

## Árnyék-próba 48 óra (DECISION után; a kapcsoló `arnyek`-re állítása egy sor a `wrangler.toml`-ban)
Mérce: az árnyék Purchase darabszáma = a Stripe `succeeded` + beérkezett utalás darabszáma, duplikátum 0 (a `meres_kuldes` egyedi indexe garantálja), EMQ. A Test Events nézetben látszik (tesztkóddal megy).

## Az átállás (NEM ez a PR; Feri külön mondata)
Egyetlen lépés: Meta Event Setup Tool Purchase-szabály KI + szerver `eles` (külön PR: éles dataset, token, védelmek) + GTM publish **egyszerre**. Rollback: kapcsoló `ki`, GTM előző verzió, szabály vissza. A kapcsolót `eles`-re állítani most semmit nem tesz.

## Rollback (ez a PR)
A PR visszavonása vagy `META_PURCHASE_MOD = "ki"`; a már kiküldött árnyék-sorok maradhatnak (nem zavarnak).
