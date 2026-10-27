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
`node --test tools/test-meta-elo.mjs` (6): kapcsoló / fail-closed, kérés-alak (nincs nyers adat), közös event_id, idempotencia, hibák, kizárások (más üzletág, ajándékkártya, sd, visszajáró, kupon, elutasítás).
