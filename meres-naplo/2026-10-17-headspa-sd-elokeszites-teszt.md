# HeadSpa salonic_direct előkészítés – teszt-napló (DECISION #191 A), 2026-10-17

Mérést érintő: igen (a `salonic_direct` csere-felismerése; élő küldést nem érint, a HeadSpa-kapcsoló KI).

## Éles, csak olvasó vizsgálat (Cloudflare D1 `mosaic-foglalas-kulcs`, vendégadat nélkül)
- `salonic_nevtabla` (placeId 10427): 8 szolgáltatás + 8 ár; a nevek = `netlify/lib/lifecycle/szolgaltatasok.js` pillanatkép.
- `foglalas_vendeg` HeadSpa-sorok szolgáltatás-kulcsai: EGYÉNI Relax 8, PÁROS 7, NÉGYKEZES 1, **PÁROS `… kupon` 1** (régi alakú kulcs).
- A HeadSpa kuponos foglalások (11) Meta `content_name`-je mind `KUPONKÓDDAL - … (kupon)`; más üzletágban `(kupon)` jelzés nincs; „KUPONKÓDDAL” előtag `(kupon)` nélkül nincs.
- `meres_kapcsolo`: `mind`=1, `salonic_direct:oxigen`=1, `salonic_direct:pmu`=1; `salonic_direct:headspa` sor **nincs** (nem változtattuk).

## Tesztek
- `node --test tools/test-salonic-direct.mjs`: 75/75 (volt 71; új: S0-62, S0-63, S0-64, S0-65).
- Mutációs ellenőrzés: a `(kupon)` levágásának kivétele → S0-62 + S0-63 bukik; a `szolgKulcsEgyezik` helyett szigorú egyenlőség → S0-62 + S0-63 bukik; a független review további 17 mutációja is elbukik; a review által jelzett átengedett mutációk (null/null, előtag-párosítás, levágás sorrendje, kis-nagybetű, szóköz nélküli alak, a száraz ágban `meres_kapcsolo`-írás, üzletág-szűrés nélküli tolerancia) után a tesztek kiegészültek (S0-62, S0-64, S0-65), és ezek már elbuknak; visszaállítva 75/75.
- `test-meres` 48/48, `test-qa-nap` 40/40, `test-foglalas-kulcs` 42/42, `test-sd-smoke` 11/11.
- GOLDEN (S0-13): a motoros kérés-törzsek bájtra azonosak.

## Védett elemek (blob-hash, `origin/main` = a változtatás előtt és után azonos)
`assets/js/suti.js` ea41ffd20d · `koszono.js` 547d0e05fc · `salonic-adapter.js` 61a6eb83a8 · `klon/oxigenterapia-ok.html` 157c141e5d · `klon/fodrasz-ok.html` 1ef408bcbb · `klon/m/oxigenterapia-ok.html` 88c2d866ae · `klon/m/fodrasz-ok.html` ae96e4ae97. A diff csak `netlify/lib/meres/salonic-direct.js`, `tools/test-salonic-direct.mjs`, `docs/booking-engine/SALONIC_DIRECT.md` és ez a napló.
