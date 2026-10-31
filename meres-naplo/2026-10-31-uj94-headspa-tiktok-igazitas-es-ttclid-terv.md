# 2026-10-31 – UJ-94: HeadSpa TikTok böngészős igazítás (leírás + minta) és a `ttclid`-átvétel terve

**Csak dokumentum (nincs kód, nincs GTM-/fiókváltoztatás).** MÉRÉST ÉRINTŐ témában, de semmit nem kapcsol be. Kérés: 01-MERES, #167 6516699487 (3. pont) és az UJ-94 (1) rész, határidő 2026-11-02 18:00. Állapot: **tervezet**; az élő TikTok-pixel (`CTDGK5BC77U0PIODKP30`) az ÁRNYÉK-láncban tiltott, itt sem érintjük.

## 1. A mostani böngészős állapot (TÉNY – élő web-konténer `GTM-PST2HB22`, v55, csak olvasás)

| tag | név | trigger | TikTok-esemény | `event_id` | megjegyzés |
|---|---|---|---|---|---|
| 20 | TikTok – All page view (HTML, `ttq.page`) | minden oldal | oldalmegtekintés | `{{Unique event ID}}` | az alap pixel |
| 49 | TikTok event tags – Book appointment | 120 | `SubmitForm` | `{{Unique event ID}}` | nem szüneteltetett |
| 94 | TikTok event tags – Sceadule | 126 | `SubmitForm` | `{{Unique event ID}}` | nem szüneteltetett |
| 51 / 61 | Begin Checkout / View item | 32 / 30 | `{{TikTok Lookup tabel}}` | `{{Unique event ID}}` | nem szüneteltetett |
| 104 | purchase (ajándékkártya) | 101 | `PlaceAnOrder` | `{{Unique event ID}}` | e-mail / telefon hash |

A `{{Unique event ID}}` sablon-generált azonosító: **nem egyezhet** a szerveres `mb_…` kulccsal / a Meta-böngészős kulccsal, ezért a böngészős `SubmitForm` és bármely szerveres példány között a TikTok nem tud `event_id` alapján deduplikálni (a dedup: pixel + eseménynév + `event_id`).

## 2. A célállapot (UJ-67, `docs/booking-engine/TIKTOK_ELO.md` – kész, alapból KI)

HeadSpa új vendég foglalása → **`Schedule`** esemény az ÉLŐ pixelre, **egy közös `event_id`-vel** (a Meta-böngészős kulcs: köszönőoldal-útvonal + `g` + `serviceId` + `startDate`), két úton: (a) a böngészőből `attribucio.js` → `ttq.track('Schedule', {}, { event_id })` (a szerver jelzi a válaszban, `tiktok_elo`), (b) a szerverről `tiktokEloKuld()` → TikTok Events API. A két példány ugyanazt az `event_id`-t és eseménynevet viszi → a TikTok egy eseménynek számolja. Kapcsoló: `TIKTOK_ELO_BE` + `TIKTOK_ELO_TOKEN`.

**Szerveres kérés alakja (minta, kitalált értékekkel – `tiktokEloKerelem()` kimenete):**

```json
{ "event_source": "web", "event_source_id": "CTDGK5BC77U0PIODKP30",
  "data": [ { "event": "Schedule", "event_time": 1793300000, "event_id": "bk_PELDA_kulcs",
    "user": { "email": "<sha256 e-mail>", "phone": "<sha256 telefon>", "external_id": "<sha256 id>",
              "ttp": "<_ttp süti>", "ip": "<IP>", "user_agent": "<UA>" },
    "page": { "url": "https://www.mosaicheadspa.hu/success-foglalas/" } } ] }
```
(Szolgáltatásnév, ár nem megy; `ttclid` csak ha van; explicit marketing-elutasításnál semmi.) **Böngészős minta:** `ttq.track('Schedule', {}, { event_id: 'bk_PELDA_kulcs' })`.

## 3. A böngészős GTM-tagek igazítása – a döntési pont (nem módosítunk semmit most)

Az átálláskor a köszönőoldalon egyszerre futna (1) az `attribucio.js` `Schedule` + közös `event_id`, (2) a szerveres `Schedule` + ugyanaz az `event_id` (ez a pár deduplikál), és (3) a GTM 49-es / 94-es tag `SubmitForm` + véletlen `event_id` (ez **külön eseménystream**, nem dedupolódik a `Schedule`-lal, mert más a név és az azonosító).

| opció | mit jelent | hatás | feltétel |
|---|---|---|---|
| **A (javasolt)** | a 49-es és 94-es tag szüneteltetése az átállás lépésében | egyetlen HeadSpa-konverzió-stream (`Schedule`), nincs párhuzamos `SubmitForm` | előbb olvasással megnézni, hogy van-e hirdetéscsoport, amely `SubmitForm`-ra optimalizál (TikTok-olvasás); GTM-módosítás = külső fiók + élő konverzió cseréje → **Feri külön mondata** |
| B | a 49-es / 94-es tag átírása `Schedule`-ra és a közös `event_id` átvétele (dataLayer-változó) | a GTM-tag is dedupolódik a szerverrel; az `attribucio.js` böngészős küldését ekkor ki kell kapcsolni (különben háromszoros) | összetettebb, két helyen kell szinkronban tartani; ugyanaz a Feri-mondat |
| C | nincs változás | a `SubmitForm` stream megmarad a `Schedule` mellett | a `SubmitForm` és a `Schedule` ugyanarra a foglalásra kétszer látszik a pixelen |

**Javaslat:** A, de csak az **előnézeti Test Events igazolás** (UJ-67 2. lépés, a mérési oldal `TIKTOK_ELO_TESZT_KOD`-ja + `TIKTOK_ELO_BE="headspa"` az előnézeten, 3 valós minta) **és** a `SubmitForm`-optimalizáló hirdetéscsoportok ellenőrzése után; az átállás egy lépés: `TIKTOK_ELO_BE` élesen + URL-szabály ki + 49/94 szüneteltetés (rollback: mindhárom visszaállítása). Az előnézeti „minta” a fenti kérésforma + a Test Events kijelzése; teszt-kód nélkül az előnézet nem küld (`ELO_CSAK_TESZT=1` védőháló).

## 4. A `ttclid`-átvétel terve (HeadSpa, alapból KI, kód nélkül)

**Mérés (TÉNY, D1 `mosaic-foglalas-kulcs`, 2026-10-23..30, HeadSpa):**
* `meres_erkezes` 132 érkezés: `ttp` kb. 92%-ban megvan (nap szerint 7/8 … 22/23), **`attr.tiktok` (és így `ttclid`) 0**; az `attr` kulcsai: `meta, utm_elso, utm_utolso, fbp, ttp, ga4, google`.
* `meres_forras` 133 HeadSpa-foglalás 8 napban: platform `meta` 33, `google` 25 (24 gclid + 1 gbraid), **egyik sincs TikTok-nak jelölve** (nincs `ttclid`, nincs TikTok-`utm_source`), 75 nincs fizetett jelzés.

**Az átvétel útja már létezik (TÉNY, kód):** `attribucio.js` az URL-ből `?ttclid=` → `allapot.tiktok.ttclid` (≤ 7 nap, marketing-engedéllyel) → `pillanatkep()` → `POST /api/meres-erkezes` → `erkezes.js` `erkezesTisztit` (`attr.tiktok.ttclid`) → `meres_erkezes.attr` → a szerveres TikTok-küldés (`tiktok-elo.js`, ARNYEK `platformok.js`) a `ttclid`-et a `user`-be teszi. **A hiány tehát nem a feldolgozásban van: a HeadSpa-foglalásokhoz egyszerűen nem érkezik `ttclid`.**

**HIPOTÉZISEK (a terv első lépése ezek eldöntése, csak olvasás):**
1. A HeadSpa TikTok-hirdetések céloldal-URL-jében nincs `ttclid` (a TikTok csak akkor fűzi hozzá, ha a hirdetési fiókban az automatikus kattintásazonosító-hozzáfűzés be van kapcsolva / az URL-ben a `__CLICKID__` makró szerepel) → ellenőrzés: a Mosaic TikTok-fiók aktív hirdetéseinek céloldal-URL-je (TikTok-olvasás).
2. A TikTok-forgalom nagy része nem kattintásos foglalásig jut, vagy a TikTok-eredetű foglalás más csatornán (közvetlen / referrer) látszik → ellenőrzés: `meres_forras.referrer_kat` TikTok-referrerrel (darabszám).
3. A pixel az első fél `ttclid`-et süti formában is tárolja → ha igen, a sütiből való visszanyerés kiegészítő forrás lehetne (ellenőrzés: böngészős DevTools – a „LOCAL + BROWSER” ablakon át; **csak olvasás**).

**Lépések (mind alapból KI, külön DECISION):** (1) olvasás: hirdetés-URL-ek + referrer-bontás + süti-vizsgálat (adatgyűjtés, módosítás nincs); (2) ha a (1) szerint a `ttclid` megérkezhetne, de elvész: tervezett kód `MERES_TTCLID_ATVETEL=ki|be` kapcsolóval az `attribucio.js`-ben (kiegészítő forrás a `ttclid`-süti), `erkezes.js` változatlan; (3) teszt: kitalált URL-ekkel, a `ttclid` formátum (`^[A-Za-z0-9_.-]{8,200}$`) és a 7 napos plafon; (4) visszamérés: HeadSpa szerveres TikTok-események `ttclid`-aránya (jelenleg 0%), cél: ahol TikTok-kattintás volt, ott megvan. **Védett fájlt nem érint** (`attribucio.js`, `erkezes.js` nem védettek; `platformok.js` / `elosztas.js` / `vegpontok.js` érintetlenek). Rollback: a kapcsoló `ki` / PR revert. Vendégadat sehova.

## 5. Nyitott kérdések a mérési oldalnak
1. Az A opcióhoz: melyik TikTok-hirdetéscsoportok optimalizálnak `SubmitForm`-ra (nekik van rálátásuk; a mi csatlakozónk a GYT/A76 fiókot nem látja, a Mosaicot igen – olvasás megtehető, ha kéri).
2. A `ttclid`-terv (1) lépése: kérik-e, hogy a Mosaic TikTok-fiók hirdetés-URL-jeit és az automatikus kattintásazonosító-hozzáfűzés beállítását kiolvassam (csak olvasás, fiókot nem módosítok)?
