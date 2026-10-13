# Jelolo sor (`foglalas_vendeg`, `email_h = NULL`) - teszt-naplo (2026-10-13)

**MERESEKET ERINTO** valtoztatas (a Salonic-direct safety net hash-index horga). A mérési oldal jovahagyta DRAFTKENT, kulon agon, merge nelkul (#167 143. komment (b), 6154568722). **NE MERGELD a befagyasztas felodasaig.** Kulso fiokhoz nem nyul, platformra nem kuld, a kuldesi szabalyt es a csere-felismerest nem valtoztatja.

Alap: a `claude/mosaic-hmac-index-miert-rrbwkk` ag (caa0a25, PR #311) - STACKED, mert a jelolo a `vendeg_index.kod` / `mezok` diagnosztikara epul. Valtozott: `netlify/lib/meres/salonic-direct.js` (`vendegIndexSor`: jelolo sor + a valodi INSERT `ON CONFLICT DO UPDATE ... WHERE email_h IS NULL`; `vendegIndexIr`: 180 napos takaritas jelolo-beszurasnal is), `netlify/lib/foglalas-kulcs.js` (`vendegIndexJelentes`: `allapot: 'jelolo'`), `tools/test-vendeg-jelolo-sor.mjs` (uj, 10 eset), `tools/test-vendeg-index-miert.mjs` (M3 / M4 / M6 igazitva), `docs/booking-engine/SALONIC_DIRECT.md`, ez a naplo. A vedett elemekhez (`assets/js/suti.js`, `booking-engine/`, `klon/*-ok.html`, `_redirects`, `_headers`) nem nyul.

## Szabaly
- **Mikor keszul jelolo:** a `vendeg` objektum megvan, a `GUEST_HMAC_KEY_V1` megvan, az uzletag / UUID ervenyes, DE nincs ervenyes e-mail (`hianyzik` vagy `ervenytelen_formatum`); forras: `level` (levelhorog) vagy `sd_atvetel`. **Nincs jelolo:** nincs `vendeg` mezo / nem objektum (Zap-leképezési hiba = valodi kimaradas), nincs GUEST kulcs, ismeretlen host, ervenytelen UUID, backfill, szaraz futas.
- **Tartalom:** `uuid`, `uzletag`, `szolg_kulcs`, `kezdet`, `allapot='aktiv'`, `ido`, `lejar` (+180 nap); `email_h = tel_h = nev_h = NULL`; `forras = 'level_nincs_email'` | `'sd_atvetel_nincs_email'`. Nincs hash, nincs PII.
- **Reschedule-logika valtozatlan:** a lookup `WHERE email_h = ?1` NULL-ra nem egyezik; `azonosVendeg()` `email_h`-t kovetel.
- **Felulirhato:** kesobbi ervenyes e-mailes sor a jelolot valodi sorra cseli; valodi sort a jelolo sosem ir felul.
- **Valasz:** `vendeg_index = { allapot: 'jelolo', kod: 'nincs_ervenyes_email', mezok, jelolo: 'uj'|'meglevo' }`; jelolo-irasi hiba: `allapot: 'kihagyva'`, `jelolo: 'hiba'` (fail-open).

## Tesztek
`node --test tools/test-vendeg-jelolo-sor.mjs` → **10 / 10 PASS** (J1-J10): J1 pontosan egy jelolo sor, minden hash NULL, 4 proba = 1 sor, nincs PII; J2 nincs jelolo ott, ahol valodi kimaradas van; J3 felulirhato, valodi sort nem ir felul; **J4 REGRESSZIO: ugyanaz az sd csere-dontes (S0-17 helyzet) jelolo sorokkal es nelkuluk - azonos `jeloltek`, `reschedule_from/to`, audit-sor, 0 kuldes**; J5 `email_h = NULL` sosem azonos vendeg; **J6 az sd viselkedese e-mail nelkuli foglalasnal** (a) csere-gyanu nelkul: normal sd ut, uj konverzio, KIZAROLAG arnyek celra (elo ID egyik kérésben sem), (b) csere-gyanuval: `suspected` / HOLD, `halasztva`, riasztas, 0 kuldes; J7 az sd 5. lepese e-maillel felulirja a jelolot / e-mail nelkuli sd-atvetel `sd_atvetel_nincs_email` jelolot ir; J8 a backfill nem ir jelolot; J9 fail-open; J10 a `forras` szerinti QA-szamolhatosag.
`node --test tools/test-vendeg-index-miert.mjs` → **9 / 9 PASS** (M3 / M4 / M6 az uj viselkedesre igazitva).

Mutacios probak (a tesztek tenyleg elbuknak): (1) a `WHERE email_h IS NULL` kivetele → J3 bukik (valodi sort is felulir); (2) `DO UPDATE` helyett `DO NOTHING` → J3 + J7 bukik; (3) a backfill is irna jelolot → J8 bukik; (4) a jelolo hash-t kapna → J1 bukik.

## Teljes csomag (`for f in tools/test-*.mjs; do node --test "$f"; done`)
booking-flow 41, booking-id 11, booking-layer 10, business-config 10, egyeztetes-sor 8, elo-foglaltsag 7, foglalas-esemeny 15, foglalas-kulcs 42, fuggetlenseg 7, gorgeteszar 3, halott-gombok 4, koszono 5, lepes-meres 20, meres 48, qa4-smoke 7, salonic-adapter 34, **salonic-direct 71** (golden paritas valtozatlan), validation-replay 2, vendeg-index-miert 9, **vendeg-jelolo-sor 10** – mind PASS; kivetel egyedul a korabbi, ettol fuggetlen `test-foglalo-atkotes` 19. eset (Task #67, a `main`-en is bukik).
