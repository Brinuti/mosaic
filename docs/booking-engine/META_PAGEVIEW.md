# Oxigén / Fodrász: szerveres PageView a Hair-pixelre – Meta-cél tuning csere nélkül (UJ-74)

**MÉRÉST ÉRINTŐ, alapból KI.** Kérés: #167 6396065608 (UJ-74; Feri 10-25 10:39: **az egyéni konverziók maradnak**, nincs csere). Élő Meta-célok a Hair-pixelen (`1361403694872594`): „Oxigénterápia foglalás” (`981471570594428` = PageView + URL `oxigenterapia-ok`) és „Mosaic Hair foglalás” (`582763774760783` = PageView + URL `fodrasz-ok`). A PageView EMQ ma 6,1 (e-mail / telefon nem megy), a szerveres Contact 9,3.

## Mit csinál
A Salonic-igazolás után (`foglalasEsemenyKuldes`) szerveres **PageView**-t küld ugyanarra a pixelre, **ugyanazzal az `event_id`-val, mint a böngészős PageView** (a Meta egy eseménynek veszi: a célok, a csoportok nem változnak, új eseménynév / custom conversion nincs). `user_data`: hash-elt e-mail / telefon / név / ország / `external_id` + `fbc`, `fbp`, IP, user agent (DECISION #202); `action_source = website`; `event_source_url` = a köszönőoldal **útvonala** (query nélkül: a teljes URL `g` / `bookingUrl` paramétere Salonic-vendégazonosítót hordoz, ezt nem tároljuk és nem küldjük – ha a teljes URL kell, külön döntés).
* Csak **új vendég + konzultáció** (az ÁRNYÉK ernyőesemény feltétele); a fodrász visszajárója a `fodrasz-ok` oldalra is megy, de szerveres PageView-t nem kap (a csere-kérdést Feri később dönti el). Kupon soha. Explicit marketing-elutasításnál semmi.
* Közös kulcs nélkül (a böngészős kulcs nem képezhető) **nem küld** (különben dupla lenne). Salonic-direct (nincs böngésző) nem küld.

## Beállítás és átállás (üzletáganként)
1. **Böngészős PageView `eventID`** (külső fiókos lépés, a mérési oldal, GTM-workspace, publikálás nélkül): az `oxigenterapia-ok` és a `fodrasz-ok` oldalon a PageView kapja a foglaláshoz kötött azonosítót (`{{JS – foglalás tranzakció ID (üzletág)}}` = a `bongeszoMetaKulcs` kulcsa, a #458 közös azonosítója).
2. **Titok:** `META_PV_TOKEN` (Cloudflare Pages Secret, Production; a Hair-dataset Conversions API tokenje). *Külső fiókos lépés – Feri / mérési oldal.*
3. **Előigazolás:** előnézeten `META_PV_TESZT_KOD` + `META_PV_BE="fodrasz,oxigen"` → Test Events: 3 valós minta, a böngészős + szerveres PageView egy eseménynek látszik; az EMQ emelkedése.
4. **Élesítés:** `META_PV_BE` az éles `wrangler.toml`-ban (teszt-kód nélkül). Előfeltétel: a #458 3 mintája + UJ-68 (jelleg). Külön DECISION.
5. **Rollback:** a `META_PV_BE` sor törlése + deploy; a böngészős `eventID` visszavétele a GTM-ben.

## Felépítés
`netlify/lib/meres/meta-pageview.js` + tábla `meres_meta_pv` (egy `esemeny_id` egyszer; legfeljebb 3 próbálkozás; token és user-adat nincs a naplóban). A védett fájlok (`platformok.js`, `elosztas.js`, `esemeny-modell.js`, `meta-bongeszo-kulcs.js`, `qa-nap.js`, `vegpontok.js`) változatlanok, csak importáljuk őket; az ÁRNYÉK-lánc tiltólistája és a `qa-nap` ellenőrzése érintetlen. Hívás: `foglalas-esemeny.js` (a #499 / #500 hookjai mellett).

## Tesztek
`node --test tools/test-meta-pageview.mjs` (6): kapcsoló / fail-closed, kérés-alak, közös event_id, idempotencia, kizárások (HeadSpa / Szőr / PMU, ajándékkártya, sd, visszajáró, kupon, elutasítás), hibák.
