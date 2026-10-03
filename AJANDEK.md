# MOSAIC Gift Commerce Engine (`/ajandek`)

Ajándékkártya-vásárlási folyamat (e-commerce, nem foglalás): **egy közös commerce motor + egy
message-match variant réteg**. A fő mért esemény a **PAID PURCHASE** (a Stripe-fizetés
beérkezése), nem a CTA-kattintás, nem a Stripe-kattintás, nem az űrlap-beküldés.

> **Állapot (2026-10-03): P0 – csak a GENERAL variant kész.** Nem indexelhető (`noindex`), a
> főoldalról nem linkelt, nincs a sitemapben. Amíg nincs Stripe-kulcs beállítva, a checkout
> „az online fizetés nem érhető el” állapotot mutat – vásárolni nem lehet. **Élesítés előtt
> végig kell menni az [élesítési ellenőrzőlistán](#élesítési-ellenőrzőlista).**

## Mi van benne (P0) és mi nincs

| P0 (kész) | P1 (később, ugyanebbe a motorba) |
|---|---|
| GENERAL hero, Gift Finder (1 kattintás, nincs reload), 3 termék, kiválasztott-állapot panel | `for_her`, `together_friend`, `together_mother`, `together_partner`, `last_minute` variantok |
| beágyazott Stripe checkout (Payment Element), siker/hiba állapot, feldolgozás | |
| vásárlás utáni személyre szabás, végleges order hub | |
| purchase analytics, perzisztencia, variant-routing (ismeretlen → GENERAL) | |

Nincs kosár, nincs külön termékoldal, nincs külön checkout variantonként. A személyre szabás
**fizetés után** jön (nem blokkolhatja a vásárlást).

## Fájlok

| fájl | szerep |
|---|---|
| `foglalas/ajandek.html` | az oldal (a build az asztali és a mobil mappába is bemásolja → `/ajandek`) |
| `assets/css/ajandek.css` | stílus (Playfair Display + Jost, a MOSAIC arculat; asztali és mobil egy fájlban) |
| `assets/js/ajandek-adat.js` | **közös adat**: termékek, **árak**, variantok, feliratok – a böngésző és a szerver is ezt olvassa |
| `assets/js/ajandek.js` | a motor: állapotgép, komponensek, mérés, perzisztencia, Stripe-integráció |
| `netlify/lib/ajandek.js`, `ajandek-levelek.js` | a szerveroldali kezelő (`/api/ajandek/*`) és a levelek / nyomtatható kártya HTML-je |
| `netlify/functions/ajandek.mjs` | Netlify-adapter |
| `functions/api/ajandek/[[kind]].js` | Cloudflare Pages-adapter (ugyanaz a kezelő) |
| `tools/ajandek-teszt/` | helyi teszt-kiszolgáló, böngészős Stripe-mock, mock Stripe API, `node --test` tesztek (nem kerül az oldalba) |

### Design (2026-10-03, a feltöltött mockupok alapján; a második, világos mockup a mérvadó)

A mockup **elrendezését és hangulatát** vettük át (fotóhátteres hero, ikonos Gift Finder, képes
termékkártyák, sötétzöld véleménysáv, kétoszlopos checkout, háromlépéses összefoglaló), a
**tartalmát nem**: az árak az éles Stripe-linkekből vannak (nem a mockup kitalált árai), a
„legnépszerűbb” helyett „Ajánlott választás” áll, a vélemény a tulajdonos valódi Google-véleménye
(nincs kitalált név/dátum, a második idézet elmarad), a fizetés Stripe (nem SimplePay), a termékek
tartalma a jóváhagyott „50 perc + 30 perc szárítás” logika, és az „Ezt fogja átélni” blokk a
jóváhagyott egyszerű szövegekkel megy (megérkezik → kikapcsol → csak vele foglalkoznak → rendezett
hajjal távozik). A fejléc és a lábléc **az éles oldalé**: a `foglalas/ajandek.html`-ben a
`<!--mh-fejlec-->` / `<!--mh-lablec-->` jelölőt a build az `assets/fejlec/` töredékekkel cseréli
(mint a sminktetoválás-landingen), a menüt az `assets/js/klon.js` működteti; az „Ajándékkártya”
menüpontot a `menuAktiv()` jelöli aktívnak. A helyi kiszolgáló ugyanezt a beillesztést végzi.
Elrendezés (a harmadik, véglegesnek szánt mockup szerint, 2026-10-03): teljes szélességű, meleg hero-fotó (arany zuhanyív) a bal
oldalon krémszínű átmenet alatt futó szöveggel; egy rácsban a ikonos Gift Finder, a három képes termékkártya (Egyéni, Páros,
4 kezes: a Finder sorrendjével egyezően; kép + jelvény, cím, „50 perc kezelés + 30 perc szárítás”, rövid leírás, ár +
„Ajándékozom” gomb) és a jobb oldali „Így néz ki az ajándékkártya” előnézet (a **valódi Canva-kártya** felső, fejjel lefelé nyomtatott
fele 180°-kal elforgatva, `assets/img/ajandek/kartya-hatter.jpg`); „A vásárlás menete”; „Mit mondanak a vendégeink?” (**négy valódi
vendég-videó** modális lejátszóval + a valódi Google-vélemény és 4,9 / 1.259); „Ezt adod át neki” (fotó + a valódi kártya);
„Miért MOSAIC?” (három valódi szalonfotó + cím és elérhetőség); „Hogyan működik az ajándékozás?” + gyakori kérdések; a fizetési nézet
három oszlopban (1 Termék | 2 Adatok | 3 Fizetés). A mockup kitalált elemei NEM kerültek át: „azonnali kézbesítés”, a mockup
idézetei és vendégfeliratai (a videók alatt csak a vendég keresztneve és a videó hossza áll), a születésnapos mintaüzenet,
generált belső terek és térkép, „Kolosy tér” (a cím: 1023 Budapest, Bécsi út 2.), „láthatóan szebb haj”.

**Fotók és videók** (a tulajdonos Drive-mappájából, 2026-10-03; a Drive saját, 900–2000 px széles JPG-előnézete, az eredetiek 7 MB-osak):
hero: DSC03646 (Mosaic fotózások / Renátó második fotózás); Egyéni: DSC03638; 4 kezes: DSC01452 (Ajándékkártya / Képek);
„Ezt adod át neki”: DSC03651; szalon: DSC05642, DSC05648, DSC05660 (Renátó első fotózás); a páros kép a korábbi valódi fotó (egy nő és
egy férfi vendég, két terapeuta; „két barátnő” kép esetén a `TERMEKEK.paros.vizual`-t kell cserélni, a CSS kicsit világosítja).
A négy vendég-videó (Zsóka, Zita, Kinga, Dóri) a Drive „Testimonial videók / 720P_Mosaic Testimonial” mappájából való (az eredetiek 720x1280,
67–104 MB), **540x960-ra** átkódolva (`assets/video/ajandek-vendeg-*.mp4`, 4,7–8,7 MB): kicsit nagyobb a korábbi 360x640-nél, hogy jó minőségű
legyen, de ne foglaljon sok helyet, és ne lassítsa az oldalt (a videó csak kattintásra tölt, `preload="none"`; a Cloudflare Pages 25 MiB-nál
nagyobb fájlt nem fogad). A poszterkép a videó 0,4. másodpercéből való (a vendég arca látszik; 540 px széles JPEG).
