# Google kattintás-azonosítók: az R1–R3 rések javítása (DECISION #196 / 1.)

**Mérést érint.** Döntés: a mérési oldal + ChatGPT **DECISION #196** (#167 6246123744; a Drive DECISION-LOG-ban rögzítve), Feri „mehet”. Alapja a Google E2E-teszt előkészítése: [GCLID_ATADAS_PROBA.md](GCLID_ATADAS_PROBA.md) (a `claude/meres-gclid-atadas-proba` ágon / #403; az itt hivatkozott R1–R3 jelölések onnan valók). Napló: [meres-naplo/2026-10-18-gclid-r1r3.md](../../meres-naplo/2026-10-18-gclid-r1r3.md).

A javítás **a vendég számára láthatatlan**: a foglalási lépések, gombok, szövegek, URL-ek és a hozzájárulási logika nem változnak; csak az attribúció (a `gclid` / `gbraid` / `wbraid`) átadása pótlódik, ahol eddig kimaradt.

## Mi változott

| Rés | Mi volt | Mi lett | Hol |
|---|---|---|---|
| **R1** | Ha a foglalót **azonosító nélküli oldalról** nyitották (a látogató a gclid-es landing után másik oldalra lépett / újratöltött), a motor kontextusa (`ctx.attribution`, tehát a tracker-események) és a köszönőoldalra fűzött keresés **nem tartalmazta** a gclid-et (az URL-ből jött). | A motor induláskor, ha az URL-ben nincs Google-azonosító, **pótolja** az oldal mentett állapotából (`window.mhAttribucio.googleAzonositok()`): a hozzájárulással tárolt `mh_attr` (90 nap) és a Google-címke saját sütije (`_gcl_aw` → gclid, `_gcl_gb` → gbraid). A köszönőoldal-átadás (`withAttribution`) a kontextus azonosítóit is fűzi (`handoffSearch`). Az URL-ben megadott azonosító mindig elsőbbséget élvez. | `attribucio.js` (új: `googleAzonositok`), `booking-engine/flow.js` (új: `fillGoogleIds`, `handoffSearch`, `GOOGLE_KEYS`), `booking-engine/engine.js` (2 sor) |
| **R2** | A `gbraid` / `wbraid` **nem került a tracker-eseményekbe** (`parseContext` csak `gclid`, `fbclid`, `ttclid`, `utm_*`). | A `parseContext` a `gbraid` és `wbraid` kulcsot is felveszi → minden `booking_*` esemény hordozza (a `tracking.js` az `attribution`-t terjeszti). A lépés-mérés (`booking_open`, `booking_error`: `lepes-meres.js`) továbbra sem hordoz azonosítót (névtelen számláló). | `booking-engine/flow.js` (1 sor) |
| **R3** | **PMU beágyazott út**: a sikeres foglalás után a `foglalo-pmu.js` a **top ablakot** a Salonic URL-jére (`/pmu-ok?…&mh_proba=pmu`) navigálta, azonosítók nélkül. | A navigáció előtt a hiányzó `gclid` / `gbraid` / `wbraid` az URL-hez fűződik: forrása a szülő (landing / réteg gazdaoldala, azonos eredet) URL-je, ennek hiányában a szülő `mhAttribucio.googleAzonositok()` értéke. A keret `src`-je és a PMU-folyamat többi része változatlan. | `foglalo-pmu.js` (`googleAzonositokHozzaad`, 1 hívás) |

## Hozzájárulás (consent)

* `googleAzonositok()` **csak marketing-hozzájárulással** ad vissza bármit: ugyanaz az `engedely()` (a `suti.js` `mhSuti.engedely('adv')`, tartalékban `mh_cc.adv`), amely a `mh_attr` tárolását is kapuzza. Hozzájárulás nélkül / **kifejezett elutasítás** után üres objektum (a mentett `mh_attr` és a `_gcl_aw` ellenére). A korábbi, kifejezett elutasítás tehát **nem íródik felül**; a #170 alapértéke (döntés nélkül granted) változatlan.
* Csak **olvas**: nem ír `localStorage`-ot, nem állít sütit, nem hív harmadik felet. A 90 napnál régebbi `mh_attr`-azonosító nem jön vissza. A minta ugyanaz, mint a tároláskor (`^[A-Za-z0-9_-]{10,200}$`).
* Az **URL-ből jövő** azonosítók továbbfűzése (a landing keresése a köszönőoldalra) a mai viselkedés szerint hozzájárulástól független (az azonosító az URL-ben amúgy is ott van); ezen nem változtattunk.

## Ellenőrzés

* Offline tesztek: `node --test tools/test-gclid-r1r3.mjs` (11 teszt; vm-harness az `attribucio.js`-hez, az R3 blokk a `foglalo-pmu.js` forrásából futtatva; 14 mutáns).
* Böngészős bizonyíték: a #403 próbaeszköz (`tools/meres-proba/gclid-atadas-proba.mjs`, a #403 ágon) a javítás előtti és utáni `dist`-en, kimenő mérés letiltva, foglalás nélkül; az R3 a **valódi** `mhKeretbenOldal` függvénnyel a `tools/meres-proba/pmu-gclid-valodi.mjs`-szel (a #403 próba a PMU-szakaszban csak szimulálja az URL-t) – lásd a naplót.
* Ismert maradék: (1) a PMU beágyazott foglaló **keretének `src`-jében** továbbra sincs azonosító (a keretben nincs mérőkód; az azonosítók a siker utáni átirányítás URL-jén és a szülő `mh_attr`-jén utaznak; a keret `src`-jéhez a védett `pmu-landing.js`-t kellene módosítani); (2) a foglaló-réteg **oldal-URL-je** továbbra sem kap azonosítót azonosító nélküli oldalról nyitva (szándékosan: az URL-változás a GTM History Change-et indítaná; a kontextus, az események és a köszönőoldal URL-je viszik); (3) **R4** (közvetlen `/foglalo-motor` belépés: nincs `_gcl_aw`, hozzájárulás-döntés nélkül nincs `mh_attr`-írás) nem része; csak tudni kell.

## Rollback

`git revert -m 1 <merge>`; D1-séma / kapcsoló / külső fiók nincs. A visszavonás után a viselkedés a #403 „ismert rések” szerinti.
