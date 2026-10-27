# HeadSpa Meta szerveres foglalási esemény az ÉLŐ pixelre (DECISION #240)

**MÉRÉST ÉRINTŐ, alapból KI.** Feri (10-27): „Igen, hogyha javítja a mérést, és nincs újratanulás, rákötjük, mehet.” (#167, DECISION #240). Ez a PR **nem kapcsol be semmit**.

## Feltételek (a döntés szerint) és hogyan teljesülnek
| feltétel | megoldás |
|---|---|
| ugyanaz az eseménynév és pixel, amire a futó csoportok optimalizálnak | `Schedule`, dataset/pixel `3473839859576758` (HeadSpa); más eseménynév nincs a kódban |
| közös `event_id` a böngészős példánnyal (10/10 egyezés igazolt) | `bongeszoMetaKulcs()` (tag 213 kulcsa: köszönőoldal-útvonal + `g` + `serviceId` + `startDate`); ha nem képezhető, a szerver **nem küld** (a böngészőnek véletlen kulcsa van → a Meta dupla eseményt látna) |
| új eseménynév / új custom conversion TILOS | `ELO_META_ESEMENY = 'Schedule'`, csak a HeadSpa (`ELO_META_UZLETAGOK`); teszt védi |
| kapcsoló mögött, alapból KI; rollback = kapcsoló KI | `META_ELO_BE="headspa"` **és** `META_ELO_TOKEN` titok (≥ 16 karakter) együtt; a sor törlése = rollback; `META_ELO_TESZT_KOD` a Test Events-es előigazoláshoz |

## Mit küld
Csak HeadSpa **foglalás** (nem ajándékkártya), új vendégnél (az ÁRNYÉK-lánc ernyőeseményének feltétele: visszajáró és kupon soha, UJ-68 jelleg), az `elosztas()` után, a Salonic-levélből (élő állapot ellenőrzése: lemondottra nincs). `user_data`: hash-elt e-mail / telefon / név / ország / `external_id` + `fbc`, `fbp`, IP, user agent (DECISION #202); ez adja a várt javulást (EMQ). Érték, szolgáltatásnév, ár **nem** megy. Explicit marketing-elutasításnál (`adv === false`) semmi sem megy.

## Felépítés
`netlify/lib/meres/meta-elo.js` + tábla `meres_meta_elo` (egy `esemeny_id` / egy Salonic-foglalás egyszer; legfeljebb 3 próbálkozás; token és user-adat nincs a naplóban). A védett fájlok (`platformok.js`, `elosztas.js`, `esemeny-modell.js`, `meta-bongeszo-kulcs.js`, `qa-nap.js`, `vegpontok.js`) változatlanok; az ÁRNYÉK-lánc tiltólistája és a `qa-nap` ellenőrzése érintetlen (az élő küldés nem a `meres_kuldes`-ben van). A kör a `foglalas-esemeny.js` és a `salonic-direct.js` hívásain át záródik (sd: nincs böngésző → nincs közös ID → nem küld).

## Átállás és utóellenőrzés (a mérési oldal / Feri lépései)
1. `META_ELO_TOKEN` (Cloudflare Pages Secret, Production; a HeadSpa dataset Conversions API tokenje). *Külső fiókos lépés – Feri / mérési oldal.*
2. Előigazolás: előnézeten `META_ELO_TESZT_KOD` + `META_ELO_BE="headspa"` → Test Events: a szerveres és a böngészős példány egy eseménynek látszik-e (dedup), 3 valós minta.
3. Élesítés: `META_ELO_BE="headspa"` az éles `wrangler.toml`-ban (teszt-kód nélkül).
4. **24 órás visszamérés** (DECISION #240): dedupolt Schedule ≤ valós foglalás; az EMQ nem esik 0,5-nél többet; `fbc` / `fbp` / `external_id` nő vagy marad.
5. Rollback: a `META_ELO_BE` sor törlése + deploy.

## Tesztek
`node --test tools/test-meta-elo.mjs` (8): kapcsoló / fail-closed, kérés-alak (nincs nyers adat), közös event_id, idempotencia, hibák, kizárások (más üzletág, ajándékkártya, sd, visszajáró, kupon, elutasítás).

## Mosaic PMU (DECISION #244, UJ-79, Feri 10-27 08:33 „Mehet, igen.” – B változat)
- **Mit küld:** ugyanaz a `Schedule` (új eseménynév / custom conversion nincs) a **PMU saját pixelére**, `1019878750660854` (`ELO_CELOK.meta[3]`; ott fut a Meta-oldali `pmu-ok` URL-szabály is, „Manual Event Setup Tool”, 2026-07-25). Kapcsoló: `META_ELO_BE="pmu"` (vagy `"headspa,pmu"`), ugyanaz a `META_ELO_TOKEN`; alapból KI. Rollback: a kapcsoló törlése, az URL-szabály vissza.
- **Közös event_id:** a böngészős Meta-kulcs (`meta-bongeszo-kulcs.js`, pl. `pmuok-<g>-<serviceId>-<startDate>`). Ha nem képezhető (sd-átvétel, ajándék, hiányzó g / serviceId / startDate), **nem küld**. Csak `tipus = foglalas` (a `/foglalo-pmu` lead-eseményei, `pmu_foto_lead`, `pmu_visszahivas_lead`, nem mennek Schedule-ként).
- **Eseményfeltétel:** az ÁRNYÉK ernyőmodell (`esemenyek()`): PMU **első foglalás + konzultáció**; visszajáró és kuponos (DECISION #194) nem. *Nyitott pont a mérési oldalnak:* a kapu („szerveres Schedule ≥ Salonic valós online PMU-foglalás”) a visszajáró PMU-foglalásokat nem tartalmazza; ha azokat is számolni kell, az `ernyoJogosult` PMU-ágát kell bővíteni (külön kérés).
- **Fontos a kapuhoz:** az URL-szabályos Schedule-nek **nincs** `eventID`-ja, ezért a szerveres példánnyal **nem deduplikálható**. Az 1 hetes párhuzamban a Meta `Schedule` darabszáma = URL-szabály (oldalmegnyitások) + szerveres példány; a kapu-összevetést a szerveres események darabszámával kell végezni (`meres_meta_elo`, `uzletag = 'pmu'`, `allapot = 'elkuldve'`), nem a Meta-összeggel.
- **Átállás:** (1) `META_ELO_TOKEN` hozzáférése a PMU datasethez (rendszerfelhasználó-eszköz; *külső fiók, mérési oldal / Feri*); (2) előnézeten `META_ELO_TESZT_KOD` + `META_ELO_BE="pmu"` → Test Events, 3 valós minta; (3) élesítés: `META_ELO_BE` az éles `wrangler.toml`-ban; (4) 1 hét, utána a kapu-összevetés a mérési oldalon → URL-szabály ki.

## Előnézeti kapcsolók (DECISION #246, 2. lépés)
- A `wrangler.toml` `[env.preview.vars]` része: `ELO_CSAK_TESZT="1"`, `TIKTOK_ELO_BE="headspa"`, `META_ELO_BE="headspa,pmu"`. Az éles `[vars]`-ban egyik sincs.
- **Védőháló:** `ELO_CSAK_TESZT=1` mellett a modul **teszt-kód nélkül nem küld** (`kihagyva`), így egy előnézet sosem küldhet az éles pixelre / datasetre. A Test Events kódok (`TIKTOK_ELO_TESZT_KOD`, `META_ELO_TESZT_KOD`) a mérési oldaltól jönnek (az ARNYEK `*_TESZT_KOD` értékei ide nem jók), és a token (`*_ELO_TOKEN`, Secret, Preview) is kell; addig az előnézet semmit nem csinál.
- Az éles bekapcsolás (`*_ELO_BE` az éles `[vars]`-ban + token) külön lépés és külön Feri-mondat.
