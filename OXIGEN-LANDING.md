# Oxigénterápia landing (`/oxigenterapia-budapest-uj`)

> **Élesítés (2026-10-04):** az oldal a **külön címen** él: `/oxigenterapia-budapest-uj` (`noindex, nofollow`, sehonnan nincs rá link, nincs a sitemapben, a Meta-pixel a slug miatt rajta nem tüzel). A régi `/oxigenterapia-budapest` (Wix-klon) változatlan. **Csere az eredeti címre** (csak a tulajdonos kifejezett kérésére): a `foglalas/oxigenterapia-budapest-uj.html` átnevezése `foglalas/oxigenterapia-budapest-uj.html`-re; benne a `robots noindex` meta törlése, a canonical és az `og:url` visszaírása a `/oxigenterapia-budapest` címre, a `<!--mh-menu-aktiv:…-->` jelölő törölhető; az `assets/js/suti.js` pixel-listája a slug (`oxigenterapia-budapest` → Fodrász-pixel) szerint magától működik; utána pixel-próba (`tools/meres-proba/pixel-proba.mjs`).


Az oldal a tulajdonos képernyőterve szerint készült (hero → jelek → állapotfelmérés → kezelők → első alkalom → kezelés lépései
→ hajhullás-típusok → mire számíthatsz / miért működik → eredmények → videó → „Mivel kezdjünk?” (két belépési lehetőség) → miért más → Arc + Haj és GYIK → záró CTA). A PMU-landing (`/sminktetovalas-budapest`)
mintájára készült; a régi Wixes oldalt egyelőre nem váltja le (lásd fent), a csere után a Meta-pixel (Fodrász-pixel, `suti.js` `PIXEL_OLDALAK`) és a GTM útvonal-szabályai változatlanul érvényesek.

## Fájlok

| Mit | Hol |
|---|---|
| oldal (szöveg, szerkezet) | `foglalas/oxigenterapia-budapest.html` |
| stílus | `assets/css/oxigen-landing.css` (betűk, színek: ugyanaz, mint a PMU-landingé) |
| működés (kezelők / eredmények lapozó, videó, Google-értékelés, CTA-mérés) | `assets/js/oxigen-landing.js` |
| képek | `assets/img/oxigen/` (kezelők, előtte/utána, kezelés-képek, szalon, Arc + Haj) és a Wix-képek `assets/img/c2eb0f_…` |
| a „hajkamera-nézet” kép | `assets/img/oxigen/hajkamera-nezet.jpg` (960×640) — erősen nagyított, trichoszkópos jellegű, **MI-vel generált szemléltető kép** (nem vendégfotó), a tulajdonos kérésére felirat nélkül; valódi hajkamerás felvételre cserélhető |

A fejlécet és a láblécet a build szúrja be (`<!--mh-fejlec-->`, `<!--mh-lablec-->`), mint a többi saját oldalon.

## Foglalás

A gombok a Salonic oxigén-fiókjára mutatnak (ugyanazok a linkek, mint az `/idpontfoglalas`-on): hajkamera `serviceId=466147` (4 990 Ft),
első kezelés `466110` (29 900 Ft), 2. alkalomtól `466158` (26 000 Ft). A build központi link-térképe (`tools/foglalo-atkotes.mjs`, kapcsolók:
`tools/foglalo-atkotes.json`) a `466110` / `466158` linkeket a közös foglalóra köti át, ha az `oxigen` kapcsoló be van kapcsolva
(előnézeten be van). A `466147` (hajkamera) **nincs a térképen**, az mindenhol natív Salonic-link marad, amíg fel nem vesszük.

Az oldalon belül **nincs `#horgony`-link**: a GTM History Change triggere minden hash-változásra mérést indítana, ezért a „görgess ide”
gombok (`data-gorgetes`) JS-ből görgetnek. A CTA-kattintások `oxigen_landing_cta` (`data-cta` érték) és `oxigen_landing_video` dataLayer-eseményt
küldenek (a PMU-landing `pmu_landing_*` mintájára; ezekre GTM-címke nem figyel).

## Hero és eredmények

- A H1 („Működő hajgyógyászati oxigénterápia hajhullás ellen”) a bal blokkban áll, két sorban (a méret a viewporthoz igazodik); a galéria teteje a cím nagybetűinek tetejéhez igazodik; alatta: „Kétmillió elvégzett kezelésből 95%-os hatékonyság*”, lábjegyzet: „*Az Oxygeni statisztikája alapján”.
- A hero jobb oldala **valós előtte/utána fotók galériája** (nem statikus kép): egy dia = egy `<figure class="hg-dia">`; a pontokat, nyilakat és a 6 mp-es automatikus lapozást (amíg a látogató bele nem nyúl; csökkentett mozgásnál nincs) az `oxigen-landing.js` adja. Felirat: „Gyengébb panaszok esetén 3–5 alkalom, súlyosabb panaszok esetén 5–10 alkalom.” A 5 jelenlegi kép **helyőrző** (hajhullás-referencia az Oxygeni-sorozatból), a tulajdonos válogatja a valódiakat (akár 10-et).
- „Az Oxygeni vendégeinek valós javulásai”: a **régi oldal galériái, panaszonként, ugyanabban a sorrendben, mind a 21 kép** (`assets/img/oxigen/eredmeny-01..21.jpg`): hajhullás 12, korpás haj 3, pikkelysömör 3, seborrea 3, „Forrás: Oxygeni Hair” jelöléssel. A hero 5 képe ezek közül való (ismétlődik, amíg a tulajdonos ki nem választja a sajátokat).
- **Vendégeink véleménye**: az **eredeti Trustindex-csúszka** (ugyanaz a widget, mint a főoldalon az „olvasd el vendégeinktől” résznél: `assets/embed/c2eb0f_95e68e62…`, Google-értékelés + 3 kártya) keretben. Külső szolgáltató, ezért a süti-tájékoztató szerint „funkcionális”: csak hozzájárulás után tölt be, addig gombos helykitöltő áll. A vélemények valós Google-értékelések, nem szerkesztettük őket; általános MOSAIC-vélemények (HeadSpa, fodrászat), oxigén-specifikus egyelőre nincs köztük.

## Mire számíthatsz az oxigénterápiától? / Miért működik?

A „Milyen hajhullásokra működik” és az „Az Oxygeni vendégeinek valós javulásai” között (`#varhato-eredmeny`): bal oldalon 6 várható hatás saját grafikával (lassuló hajhullás, dúsuló haj, új hajszálak, jobb vérkeringés, élénkebb anyagcsere, egészségesebb fejbőr; az ikonok a lap saját SVG-szimbólumai, **nem** az Oxygeni képei), jobb oldalon a „Miért működik?” szöveg a tulajdonos magyarázata szerint (pontosan ott hat, ahol a probléma van: a hajhagymák mélyén; nem felszíni, nem kozmetikai kezelés; a magas tisztaságú oxigén vitaminokat visz a fejbőrbe; a hajhagymák normális működését állítja helyre). Mobilon a hatások 2 oszlopban állnak. A hajhullás-típus kártyák szövege egyforma hosszú (két sor).

A „Mi történik az első kezeléseden?” kép magasságát a bal oszlop adja: a kép teteje a címmel, az alja a „Megnézem a kezelés részletes lépéseit” gomb aljával egyezik (a kép `position:absolute`, nem nyújtja a sort); a gomb a többi nagy gombbal egyforma méretű. Az „A kezelés lépésről lépésre” lenyitó jele nyíl (zárva lefelé, nyitva felfelé), nem plusz. A hero-galéria felirata mobilon rövid, egy soros: „Gyengébb panaszok 3–5 alkalom, súlyosabb 5–10 alkalom.” (`.sz-m`; asztalin a hosszú változat, `.sz-d`).

## A három átszabott szekció (a tulajdonos képtervei alapján, 12. kör)

A „Milyen hajhullásokra működik”, a „Mire számíthatsz / Miért működik?” és a „Mivel kezdjünk?” (árak) szekció a tulajdonos három képterve szerint készült újra (HTML/CSS, nem kép):

- **Hajhullás-típusok** (`.tipus`): kártyák bal oldalt kerek, arany ikonnal (`.tipus-ikon`), jobbra cím + szöveg; az utolsó kártya a „Nem tudod, melyik a tied?” (kérdés-buborék ikon, krémszínű, körvonalas gomb).
- **Mire számíthatsz / Miért működik?** (`#varhato-eredmeny`): 6 hatás-csempe arany gyűrűs ikonnal és serif címmel; jobbra sötétzöld „Miért működik?” kártya a valódi kezelés-fotóval (`oxigen-kezeles.jpg`, jobbra elhalványodó maszkkal) és kerek **szemléltető ábrával** (`folikulus-abra.jpg`: a hajhagymák oxigénnel, a tulajdonos képtervéből kivágott illusztráció). Mobilon a fotó a szöveg alá kerül, az ábra a fotó sarkában.
- **Mivel kezdjünk?** (`#arak`): bal oldalt két kártya (arany keretes „Első kezelés” + halványabb „Csak állapotfelmérés”, arany/krém pipa-körökkel), jobb oldalt „Hány alkalommal érdemes számolnod?”: szöveg + arany szegélyes idézet, a képterv **MI-generált előtte/utána kompozíciója** (`alkalom-kompozicio.jpg` + `alkalom-kompozicio-maszk.png`: nagy „Utána” és kis „Előtte” fotó, nyíl és feliratok a képterv képéből kivágva, a lekerekített lágy szélt a CSS-maszk adja; a tulajdonos kifejezett kérésére benne van), „Szemléltető kép” felirattal (nem „valós vendég”; ha valódi fotóra cserélik, a felirat és a kép együtt cserélendő), a „2–3 alkalom látható változás → 5–7 alkalom drasztikus változás” skála és a „Nem kell több alkalmat előre kifizetned” doboz. A kompozíció csak asztali/mobil CSS-ben méretezett kép, a maszkot `mask-image` adja.

## A kezelés lépésről lépésre (lenyitható)

9 két soros lépés, alatta a **„Hogyan működik az oxigénterápia?”** blokk: a hatásmechanizmus az Oxygeni Hair & Skin oldala (oxygenihair.hu) alapján, saját megfogalmazásban, forrásmegjelöléssel (diagnózis, 100%-os tiszta oxigén magas nyomással a bazális sejtsorig, vitaminok/ásványi anyagok hordozása, sejtanyagcsere és vérkeringés, hajhagymák, kollagén/pH, védekezőképesség).

## CTA-hierarchia (intent szerint, mobilon is ebben a sorrendben)

- **Hero:** elöl az arany „Első kezelést foglalok – 29 900 Ft” („Hajkamerás állapotfelméréssel együtt · 120 perc”), mögötte körvonalas: „Még nem vagy biztos? Hajkamerás állapotfelmérés – 4 990 Ft”.
- **Árak:** elöl a kiemelt kártya (Első oxigénterápiás hajkezelés + állapotfelmérés, 29 900 Ft, jelvény: „Ha szeretnéd rögtön elkezdeni”), utána a halványabb „Csak hajkamerás állapotfelmérés” (4 990 Ft, „Ha még nem tudod, neked való-e”).
- **Záró sáv:** arany „Első kezelést foglalok”, mögötte körvonalas „Csak állapotfelmérés”.
- **Mobil sticky sáv** (`#sticky-cta`, csak ≤700 px): a hero-gombok elgörgetése után látszik, a záró sávnál eltűnik; primary: „Első kezelés · 29 900 Ft”, mellette kis link: „Csak felmérés · 4 990 Ft”.

## Milyen hajhullásokra működik? + videók

Új szakasz (`#hajhullas-tipusok`): autoimmun, hormonális, férfias (androgén alopécia), post-covid és intenzív hajhullás, saját megfogalmazásban az Oxygeni Hair & Skin oldala (oxygenihair.hu) alapján. Alatta 4 videó az Oxygeni Hair and Skin YouTube-csatornájáról (az oxygenihair.hu is beágyazza őket), a „Hogyan működik” blokkban 1 rövid. A videók csak kattintásra töltődnek be (`youtube-nocookie.com`, ablakban); `data-yt` = YouTube-azonosító.

## Alcímek, gombok

Az oldalon nincsenek a címek fölötti kis (sárga) alcímek. Az arany pill-gomb (a többi oldal aranygombja: `linear-gradient(#c6a346, #d9c164)`, fehér felirat) a foglalás-gombok színe; **a hajkamerás állapotfelmérés gombjai fehérek** (`gomb-feher`), a záró sötét sávban körvonalas (`gomb-kontur`, nem teli). A SZÉP Kártya elfogadása a hero-ban, az árak alatt, a szalon-szakaszban és a GYIK-ban is szerepel.

## Validálásra váró helyőrzők (`[szögletes zárójeles]`, `.helyorzo`)

- a három kezelő bemutatkozója **általános, személyes adat nélküli szöveg** (nincs róluk forrásunk): a valódi szakmai háttér a tulajdonostól kérendő; a nevek és a fotók a Salonic szakember-oldaláról vannak;
- az előtte/utána képek az Oxygeni Hair márka referenciái; a „kétmillió elvégzett kezelésből 95%-nál pozitív változás” és a „3–5 / 5–10 alkalom” a tulajdonos megadott szövege;
- az időpont-módosítás pontos határideje a GYIK-ban.

## Nyitott pontok (döntés kell)

- **Időtartam:** a képernyőterv és a régi oldal „120 perc”; a Salonic jelenleg 80 percet mutat az első kezelésre (a 120 perces változat kikerült, lásd `docs/booking-engine/DECISIONS.md` 16.). A 120 három helyen szerepel (hero, ár-kártya, GYIK).
- **Arc + Haj:** a Salonic oxigén-fiókjában ma nincs ilyen szolgáltatás (csak 466147 / 466110 / 466158), ezért a gomb telefonos időpontkérésre (`tel:`) mutat.
- A régi oldal gombjai az `/idpontfoglalas` elosztóra vittek; az új oldalé közvetlenül a Salonicra (mint a HeadSpa-oldalaké).
