# A Salonic süti-sávja a foglaló adatlapján (kompakt)

> **Frissites (2026-10-14, Feri kerese):** az **adatlapon** (`page-booking-guestData-body`) a Salonic sutisavja mostantol nem latszik (a gyogytornas / MP foglalo mintajara), **es az "A foglalasod" oldalakon sem** (reszletek / idopont modositasa / sikeroldalak: az SMS-ben es az e-mailben kuldott linkek ide visznek; Feri kerese, 2026-10-14 - minden `customer-mosaic*` Salonic-oldalon rejtett a `.cc-window` es a `.cc-revoke`) - lasd [SALONIC_ADATLAP_GYOGYTORNAS.md](SALONIC_ADATLAP_GYOGYTORNAS.md). Az alabbi leiras a tobbi Salonic-oldalra (es a korabbi allapotra) vonatkozik; a `suti-sav-proba.mjs` "a sav legfeljebb 100 px / Elfogadom" ellenorzesei az adatlapon mar nem ertelmezhetok.

**Mi ez:** a Salonic foglalási űrlapján (az adatlapon, ahol a vendég a nevét, telefonszámát adja meg) a Salonic **saját, kötelező süti-sávja** ugrik fel („Az oldal használatával hozzájárulsz a cookie-k elemzésekhez, testreszabott tartalmakhoz és hirdetésekhez történő felhasználásához." + „További információ" + „Elfogadom"). A foglaló keskeny keretébe (telefon) ágyazva ez az alapméretében **~200 px magas** volt (16 px-es betű, a gomb a szöveg alatt, teljes szélességben): az űrlap harmadát takarta, az e-mail mező alatt. (Feri kérése, 2026-10-06.)

**Mit csináltunk:** a Salonic fiókjaiba már betöltött egyedi CSS-ünkben ([salonic/mosaic.css](../../salonic/mosaic.css), a PMU-fiókéban [salonic/pmu.css](../../salonic/pmu.css)) kompaktra vettük a sávot:
- kisebb betű (11,5 px), a szöveg és a „További információ" link változatlan;
- a gomb a szöveg **mellett** van (nem alatta): „Elfogadom", 96 px széles, a sáv magasságáig ér (jól koppintható);
- a Salonic háttér- és gombszíne marad; a sáv változatlanul alul, a kereten belül áll.

**Eredmény (valódi Salonic adatlapokon mérve):** telefonon **198 px → 76 px** (a keret ~9%-a), asztali gépen 46 px; mind a négy fiókban (fodrászat, oxigén, Head Spa, sminktetoválás). Az „Elfogadom" ugyanúgy működik (a sáv eltűnik); az űrlap felső része (telefon, név, e-mail) nincs takarva.

**Mit nem tudunk:** a sáv a Salonic sajátja: eltüntetni nem szabad és nem is tudjuk (a hozzájárulás a Salonic süti-kezelése); a tartalma (szöveg, gomb) nem módosítható a mi CSS-ünkkel. Az, hogy a sáv a keretben minden megnyitáskor újra felugrik, a böngészők harmadik fél sütijeinek tiltása miatt van (a Salonic a „megjegyeztem" sütit a mi oldalunkba ágyazva nem tudja megtartani): ez a Salonic oldalán dől el.

**Hogyan élesedik:** a CSS-fájlt a Salonic fiókok az „Egyedi CSS URL" beállításból közvetlenül `https://www.mosaicheadspa.hu/salonic/mosaic.css` címről töltik: a `main` élesítésével együtt él (Cloudflare).

**Teszt:** `node tools/meres-proba/suti-sav-proba.mjs [--overlay dist] [--mobil 1] [--uzletag hair|oxygen|headspa] [--css salonic/mosaic.css] [--kep mappa]` – a valódi Salonic adatlapon (legtávolabbi szabad időpont, foglalás nincs): a sáv legfeljebb 100 px, a szöveg legalább 11 px, az „Elfogadom" legalább 40 × 44 px, az űrlap felső részét nem takarja, az „Elfogadom"-ra eltűnik. A `--css` a helyi (még nem épített) CSS-t tölti a Salonic oldalába.
