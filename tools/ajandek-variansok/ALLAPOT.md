# A 3 maradék Wixes ajándékkártya-oldal újrastílusozása – FÉLKÉSZ (leállítva 2026-10-07 este)

**Cél (a tulajdonos szabálya, docs/OLDAL_UJRASTILUS.md):** a `headspa-ajandakkartya-fiataloknak`, `headspa-ajándékkártya-ezo` (ékezetes fájlnév, NFC) és `headspa-self-care`
(noindex hirdetési változatok, régi „26.900 Ft" címmel) új kinézete a **tartalom változtatása nélkül** (a régi 20% júliusi akció / árak is szó szerint; a hibákat az „Észrevételek"
közé a PR-be írjuk, nem javítjuk). A noindex marad. A többi 8 ajándék-cím már a motor-oldalt (foglalas/ajandek.html) szolgálja ki, azokhoz nem kell nyúlni.
A Lézer-munkamenettel egyeztetve: (a) szó szerinti újrastílus, közös sablonnal; a (b) „motor-oldal átvétele" tartalom-csere, azt a tulajdonos külön döntésére hagyjuk.

## Mi van kész
- `forras/<kulcs>.folyam.txt` + `.json`: a 3 régi oldal kinyert tartalma az ÉLŐ oldalról, a csere előtt (tools/ujrastilus/folyam.mjs kimenete).
- `gen.mjs`: a generátor (megírva, **még egyszer sem futott le, nincs tesztelve**): a forrás-sorokból `foglalas/<név>.html`-t épít (hero, bemutatkozás, akció, vendégvideók,
  bemutató videó, hogyan működik, bankkártyás megrendelés (3 termék, Stripe-linkek szó szerint), előreutalásos űrlap, GYIK (assets/js/gyik.js, kulcs
  `c2eb0f_97df67cb524ad4ad76e22fddea2496e5`), galéria, vásárlás, helyszín). Egy ismert hiba: a `felosztas()` függvény felesleges (a `szeletek()` az, amit használ) – törölhető.

## Mi hiányzik (ebben a sorrendben)
1. `assets/css/ajandek-variansok.css` (a generált oldal ezt hivatkozza; a headspa-oldal.css komponenseire épül): `.ajv-hero`, `.ajv-akcio`, `.ajv-kicsik`, `.ajv-ertekeles`,
   `.ajv-hangos`, `.ajv-kiemel`, `.ajv-lista`, `.ajv-lepesek`, `.ajv-termekek` / `.ajv-termek`, `.ajv-urlap` mezők / rádiók, `.ajv-hatterkepes` (+ `.ajv-hatterkep`),
   `.video-egy`, `.gyik` (details / `.gy-valasz`), `.ajv-szuk`, `.ajv-csapda`, `.hiba`. Mobilon nincs vízszintes görgetés (390 és 360 px).
2. `assets/js/ajandek-variansok.js`: az űrlap beküldése POST `/`-re (form-name=`ajandekkartya`; mezők: ajandekozott, vezeteknev, keresztnev, email, telefon, szamlazasi_cim,
   cegnev, adoszam, kartya (a kiválasztott rádió szövege), aszf=`elfogadva`, oldal=az oldal neve, bot-field), siker után `/success-ajandekkartya`. A régi űrlap
   (assets/js/klon.js ~1198–1290) a beküldés után `wixLead()`-del dataLayer-eseményt is küldött (`lead` + `generate_lead`, `event_label: 'Form name: Ajándékkártya '`,
   form_id `7715ab48-7c85-4c1c-8fbc-a38c1cb1a23c`): ezt a MEGLÉVŐ konverziót kell megőrizni (nem újat hozzáadni), különben ezeken a hirdetési oldalakon megszűnne a lead-mérés.
   A sablon: assets/js/kapcsolat.js (a /kapcsolat űrlapja).
3. `node tools/ajandek-variansok/gen.mjs` → `foglalas/*.html` (3 fájl); hibák javítása. Rejtett régi példány: `node tools/ujrastilus/regi-peldany.mjs headspa-ajandakkartya-fiataloknak headspa-ajándékkártya-ezo headspa-self-care --lcp-torol`.
4. Ellenőrzés: `PLAYWRIGHT_UTVONAL=<node_modules> node tools/ujrastilus/ellenor.mjs tools/ajandek-variansok/forras/<kulcs>.json <url>` (könnyű szerver: tools/headspa-teszt/szerver.mjs, dist
   nélkül), képernyőképek asztalon (1440) és telefonon (390), teszt: tools/ujrastilus-teszt/ajandek-variansok.test.mjs.
5. PR a main-re („Mérést érint: nem", „Észrevételek": a régi oldalak elavult adatai: júliusi 20% akció, 32.900 → 26.900 Ft árak, `Google 4,8/5`, a bankkártyás gombok a régi
   `/headspa-ajandekkartya#comp-…` horgonyokra mutatnak (ma nem léteznek), a Stripe fizetési linkek (`buy.stripe.com/…`) régi akciós árakkal, a 29.900 / 59.800 Ft a GYIK-ban,
   a GYIK-ban a régi szöveg szerinti átvételi idő). A mergelést a Lézer-munkamenet / a tulajdonos végzi.

## Figyelem
- Lemezhely szűk volt (1,5–5 GB): teljes buildet (`tools/netlify-build.mjs`, ~700 MB) ne futtass; a könnyű szerver elég.
- Commit-szerző és a git config: lásd docs/OLDAL_UJRASTILUS.md „Szabályok / csapdák" (a `.git/config`-hoz nem nyúlunk).
- Az ékezetes fájlnév (`headspa-ajándékkártya-ezo.html`) NFC-ben legyen, mint a `klon/` mappában.
