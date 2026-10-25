# Meta ARNYEK event_id = a böngészős tag 213 kulcsa (UJ-2, draft)

Kérés: #167 6315883179 (01-MERES + ChatGPT), 2026-10-21. Csak ÁRNYÉK; élő pixelre nem megy semmi (ELO_CELOK érintetlen). **Merge csak DECISION után; az átkötés legkorábban ~10-27, előtte UJ-2 (pixelenként 3 valós `mb_` minta).**

## Mi változik
- A motoros (`mb_`) **alapesemény** Meta ARNYEK `event_id`-ja a böngészős tag (GTM web 213, 182-es változó) kulcsa:
  `<útvonal nem alfanumerikus karakterei törölve, első 12>-<g "g:" nélkül>-<serviceId>-<startDate (unix)>`,
  a `meres_erkezes.bongeszo` MEGLÉVŐ mezőiből (`oldal`, `g`, `bookingUrl`). Új adatgyűjtés és PII nincs.
- Változatlan: ernyő (Schedule), `sd_` (Salonic-direct, `…:sd_…`, nincs böngészős pár), ajándékkártya (`pi_`), a GA4/TikTok/Google event_id-k, a `meres_kuldes` dedup-kulcsa (`esemeny_id`), `order_id`.
- Ha bármelyik rész hiányzik: marad az eddigi `esemeny_id` (nem találunk ki kulcsot).
- A HeadSpa-nál két kulcs él egymás mellett SZÁNDÉKOSAN: `hs-…` (Google Ads, TikTok, GA4 `tt_event_id`) és `successfogla-…` (Meta).

## Fájlok
- ÚJ `netlify/lib/meres/meta-bongeszo-kulcs.js` (tiszta függvény)
- `netlify/lib/meres/platformok.js` (VÉDETT): import + 3 sor a `metaKerelem`-ben
- `netlify/lib/meres/elosztas.js` (VÉDETT): a ctx kap egy `bongeszo` mezőt (1 sor)
- ÚJ `tools/test-meta-bongeszo-kulcs.mjs` (22 eset)

## Védett elemek blob-hash (dokumentált változás)
| fájl | main (372ca3ba) | ez a PR |
|---|---|---|
| `netlify/lib/meres/platformok.js` | `86a6310a12` | `67911aace4` |
| `netlify/lib/meres/elosztas.js` | `958f2c60dc` | `f8a78f8430` |
A többi védett fájl nem módosul.

## Tesztek
- Piros→zöld: a teszt a main kódján elbukik (`FoglalasElso:mb_…` ≠ `successfogla-…`), az új kódon 22/22 zöld.
- Zöld az új kódon: test-adatgazdagitas 21, test-meres 51, test-qa-nap 45, test-booking-flow 41, test-gclid-r1r3 14, test-lpt-forras 58, test-lepes-meres 29.
- D1-visszaszámolás (SELECT, 10-15..21, Meta alapesemények): `mb_` 89 sor, mindegyiknél számolható a kulcs (fodrász 31/31, HeadSpa 41/41, oxigén 12/12, PMU 3/3, szőr 2/2); `sd_` 2 sor változatlan; HeadSpa 76 sorából 35 ajándékkártya (`pi_`), változatlan.

## Fenntartás
A kulcs a `bongeszo.oldal`-ból (az érkezési írás pillanatában küldött útvonal) számolódik. Ha a köszönőoldal a 213-as tag lefutása előtt átírná a címet, a két útvonal eltérhet; a D1-ből ez nem bizonyítható → UJ-2 minták kellenek.

## Rollback
A PR visszavonása (vagy a `bongeszoKulcs` sor törlése a `metaKerelem`-ben): az ÁRNYÉK `event_id` visszaáll `esemeny_id`-ra. Élő hatás nincs.

## Mérést érint
Igen (Meta ÁRNYÉK event_id) – mérési jelölés a PR-leírásban.
