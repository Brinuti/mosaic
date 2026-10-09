# A 3 régi (Wixes) hirdetési ajándékkártya-oldal újrastílusa — ARCHÍVUM (2026-10-09 óta nem élő)

> **Állapot (2026-10-09, a tulajdonos kérése):** a három cím (`headspa-ajandakkartya-fiataloknak`, `headspa-ajándékkártya-ezo`, `headspa-self-care`) mostantól **az új master landinget** adja a megfelelő persona-variánssal
> (hero-videó + magyarázó szekció + ajándékválasztó; leírás: `docs/AJANDEK_PERSONA_OLDALAK.md`). Az itt leírt, újrastílusozott régi oldalak az `archiv/` mappába kerültek (nincsenek az élő útvonalon, a build nem használja őket;
> a `gen.mjs` is ide ír). A **rejtett `/<név>-regi`** cím (a Wixes eredeti, `klon/<név>-regi.html`) megmarad. A lenti leírás a régi, archivált oldalakról szól.
>
> Új fájlok: `elore-render.mjs` (a build ezzel tölti elő a persona-oldalak hero-szövegét / -képét / magyarázó szekcióját), `hero-videok.py` (a persona hero-videók gyártója: PyAV, a MOSAIC meglévő felvételeiből).

Oldalak (mind `noindex`, mint a régi): `headspa-ajandakkartya-fiataloknak`, `headspa-ajándékkártya-ezo` (ékezetes fájlnév, NFC), `headspa-self-care`.
A tartalom **szó szerint a régi oldalról** van (szöveg, árak a régi júliusi 20%-os akcióval, képek, videók, Stripe-linkek, GYIK, az űrlap mezői); a hibákat nem javítottuk
(lásd a PR „Észrevételek” részét). A többi 8 régi ajándék-cím a motor-oldalt (`foglalas/ajandek.html`) szolgálja ki, azokhoz nem kell nyúlni.

- `forras/<kulcs>.folyam.txt` + `.json`: a régi oldal kinyert tartalma az éles oldalról (`tools/ujrastilus/folyam.mjs`), a csere előtt.
- `gen.mjs`: a forrásból építi a `foglalas/<név>.html` fájlokat (`node tools/ajandek-variansok/gen.mjs`). Az újrafuttatás felülírja a kimenetet.
  A `FOLYAM_SZOKOZ` lista két olyan helyet javít vissza, ahol a kinyerő szóközt tett a szomszédos Wix-elemek közé („49 .900”, „ajándék ot”), az éles oldalon nincs szóköz.
- Stílus: `assets/css/ajandek-variansok.css` (a `headspa-oldal.css` komponenseire épül). Működés: `assets/js/headspa-oldal.js` (videó-felugró, galéria) + `assets/js/klon.js`.
- **Az űrlap** a meglévő `klon.js` 7d. szakaszán fut (az űrlap azonosítója `form-7715ab48-…`, a mezők `aria-label`-je a régi felirat, a gomb `data-hook="submit-button"`):
  ugyanaz az ellenőrzés, ugyanaz a POST (`form-name=ajandekkartya`, `oldal` = az oldal neve), ugyanaz a `/success-ajandekkartya` átirányítás és **ugyanaz a lead-mérés**
  (`lead` → `ecommerce:null` → `generate_lead`, a régi form_id-val), mint a régi Wix-űrlapnál. Új mérési kódot nem adtunk hozzá.
- Rejtett régi példány: `/<név>-regi` (noindex), `node tools/ujrastilus/regi-peldany.mjs <név> --lcp-torol`. (2026-10-09 előtt a visszaállás a `foglalas/<név>.html` törlése volt; most az archivált fájl visszamásolása a `foglalas/` alá + a név kivétele a build `REGI_AJANDEK_CIMEK` listájából.)
- Teszt: `node --test tools/ujrastilus-teszt/ajandek-variansok.test.mjs` (2026-10-09 óta az átállást ellenőrzi: nincs az élő útvonalon, rejtett `-regi`, noindex, mérés, LCP; dist és böngésző nélkül). Tartalom-hűség (a régi oldalról): `tools/ujrastilus/ellenor.mjs` (`--kezd`, `--kihagy` a fejléc/lábléc sorokra).
