# Kapcsolat és GYIK oldal (2026-10-07)

A fejléc menüjének **„Kapcsolat”** és **„GYIK”** pontja önálló oldalra visz (korábban a nyitóoldal szekcióira ugrottak: `/#comp-m3znoarb`, `/#comp-m4l2o45p`). Az átirányítást a `tools/fejlec-menu.mjs` végzi (minden oldalon, asztalon és mobilon). Az angol oldalakon a GYIK pont elmarad, a Kapcsolat az oldal saját `#helyszin` szekciójára ugrik. A lábléc elérhetőség-oszlopában is van link mindkettőre.

## /kapcsolat (`foglalas/kapcsolat.html`)
- **Szekció-sorrend (2026-10-08):** oldalfej + szöveg → elérhetőségi kártyák → üzenetküldő űrlap → helyszín (cím, térkép; a kép a szalon valódi váróterme: `assets/img/fooldal/szalon-elotter.jpg`) → foglalás.
- Elérhetőségek kártyákban (cím + útvonaltervezés, telefon, e-mail, nyitvatartás: **hétfő–szombat 8:00–20:00**, vasárnap zárva).
- Foglalás: egy kártya minden üzletágnak (Head Spa, Páros, Szőrtelenítés, Fodrászat, Oxigénterápia → `/foglalo-motor?business=…`, Sminktetoválás → `/sminktetovalas-budapest#foglalas`), + Ajándékkártya gomb.
- Közösségi média: Instagram (`/mosaicheadspa/`), Facebook (`/mosaicheadspa/`). TikTok nincs (nem találtunk hivatalos fiókot).
- **Üzenetküldő űrlap**: `assets/js/kapcsolat.js` → `POST /` `form-name=kapcsolat` → `functions/[[path]].js` → `netlify/lib/levelek.js` (`URLAPOK.kapcsolat`): a szalon e-mailben megkapja (`MAIL_TO`), a válasz-cím a látogató e-mail címe. Védelem: rejtett csapda-mező (`bot-field`), kötelező mezők + ÁSZF/adatkezelési hozzájárulás. SMTP nélkül (előnézet) a függvény csak naplóz és `ok`-ot ad.
- Helyszín: parkolás / tömegközlekedés (a lézeres oldal tényei), a Google-térkép hozzájárulás / gomb mögött (headspa-oldal.js).

## /gyik (`foglalas/gyik.html`, GENERÁLT)
Az összes üzletág kérdés-válaszai egy helyen (94 kérdés), üzletágankénti szekciókkal, kereső-mezővel (ékezet- és kisbetű-független, kevés találatnál kinyit) és gyorsválasztó chipekkel. A kérdések a meglévő oldalak GYIK-szekcióiból jönnek (forrás-lista: `FORRASOK` a `tools/gyik-oldal.mjs`-ben: főoldal + egyéni Head Spa, páros, lézeres, fodrász, oxigénterápia, sminktetoválás, ajándékkártya). Ha valamelyik forrásoldal GYIK-ja változik, futtasd újra: `node tools/gyik-oldal.mjs` (a teszt jelzi, ha eltér).

## Tesztek
`node --test tools/kapcsolat-teszt/kapcsolat.test.mjs` (15): betöltés, kérdésszámok, kereső, menü-linkek és kijelölés, űrlap (hibák, sikeres küldés, szerverhiba), térkép, túlcsordulás 1440 / 390 px, a levélsablon (escape, válasz-cím).
