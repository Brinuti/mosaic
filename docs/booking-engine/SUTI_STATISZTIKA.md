# Mosaic nevtelen sutisav-statisztika (2026-10-13; a meresi oldal SPEC-je, #167 125. komment, GPT atnezte)

**Cel:** tudjuk, hany latogato dont a sutisavban, es hogyan. Utana donthetunk a sav szovegerol / kinezetorol, de **ez a valtozas azokhoz nem nyul**.

## Mi megy es mi nem
- A `assets/js/suti.js` kuld **`navigator.sendBeacon`**-nel (`text/plain` torzs, nincs preflight) a `POST /api/suti-stat` vegpontra, ket helyrol: a sav **megjelenesekor** (`megjelent`, oldalbetoltesenkent egyszer, csak ha a sav tenyleg megjelenik) es a savban hozott **dontesnel** (`elfogad_minden` / `elutasit` / `reszleges`).
- Mezok (pontosan ezek, mas kulcsot a szerver elutasit): `esemeny`, `fun`/`ana`/`adv` (0/1, csak dontesnel), `oldaltipus` (`fooldal` / `landing` / `foglalo` / `koszono` / `egyeb`), `eszkoz` (`mobil` = ablak <= 767 px / `desktop`).
- **Nincs** suti, azonosito, URL, idobelyeg a kliensbol. A napot a **szerver** szamolja (Europe/Budapest). **IP-t es UA-t nem taroljuk** (sem D1-ben, sem naploban).
- **Csak az eles domainen kuld** (`ELES_DOMAINEK`, mint a tobbi mero-kod; a CLAUDE.md szabalya): localhost, `*.pages.dev` (a `mosaic-d77.pages.dev` eles alias is) NEM kuld, igy a probak nem szennyezik az elesi szamlalot. Elonezeten a vegpont kozvetlen POST-tal tesztelheto (kulon `KULCS_DB`).
- Nem kuldunk: az utolagos beallitasok-megnyitas (lablec-link) es a terkep-engedely (`mhSuti.enged`) nem sav-dontes.
- `oldaltipus`: `koszono` (`success-*`, `*-ok`, `pmu-vh`) > `foglalo` (`foglalo*`, `*-foglalas`, `*idopontfoglalas`) > `fooldal` (`/`) > `landing` (a `PIXEL_OLDALAK`-ban szereplo kampanyoldal) > `egyeb`.

## Szerver
- `functions/api/suti-stat.js` -> `netlify/lib/meres/suti-stat.js` (`kezelSutiStat`). Azonos eredet kell (403), max. 300 bajt (413), nem JSON / ismeretlen kulcs / ismeretlen ertek / inkoherens dontes (pl. `elfogad_minden` nem 1,1,1) -> 400. Siker: 204.
- **D1 `suti_stat`** a `KULCS_DB`-ben (a kod hozza letre `CREATE TABLE IF NOT EXISTS`-szel; az elonezet kulon adatbazis, igy nem szennyezi az elest): `PRIMARY KEY (nap, esemeny, fun, ana, adv, oldaltipus, eszkoz)`, `db` UPSERT szamlalo (`db = db + 1`).
- **Rate-limit:** IP-nkent 20 kerés / 60 mp (429), IP nelkul kozos 200 / 60 mp; a szamlalo CSAK a futo pelda memoriajaban el (nem kerul D1-be / naploba, 5000 bejegyzes folott takarit). Ha az IP memoriabeli tartasa sem megfelelo, a helyette szolgalo napi globalis plafon egyszeruen bevezetheto.
- **Fail-open:** minden hiba (D1 leallt, ismeretlen ertek) 4xx/5xx a beaconnek; a sav es a dontes semmit nem veszit.

## Olvasas (csak aggregalt)
`GET /api/meres-admin?suti_stat=1[&tol=YYYY-MM-DD&ig=YYYY-MM-DD]` (`x-egyeztetes-kulcs`; kulcs nelkul 404). Alapbol az utolso 31 nap. Valasz: `{ ok, tol, ig, osszes: {megjelent, elfogad_minden, elutasit, reszleges}, sorok: [{nap, esemeny, fun, ana, adv, oldaltipus, eszkoz, db}] }`.

## Nem erinti (bizonyitva)
Meta-pixel, GTM, Consent Mode jelek, a sav szovege / kinezete / DOM-ja (a bongeszos proba az alap valtozattal DOM-, stilus- es pixel-azonos), a **vedett koszonooldalak** (`/oxigenterapia-ok`, `fodrasz-ok`), `PIXEL_OLDALAK` / `PIXEL_FODRASZ`, a foglalobol a teljes ablakos atiranyitas (a `suti.js` 1-233. sora, benne a PIXEL sorok, valtozatlan; a diff a 234. sor utan kezdodik).

## Tesztek
- `node --test tools/test-suti-stat.mjs` (S1-S8 szerver, K1-K6 kliens szimulalt kornyezetben, mutacio-ellenorzessel).
- `node tools/meres-proba/suti-stat-bongeszo.mjs [--naplo meres-naplo/suti-stat-bongeszo-<datum>.txt]` valodi Chromiummal: esemenyek, paritas az `origin/main` valtozattal, fail-open (500 / halozati hiba / lefagyott vegpont).
