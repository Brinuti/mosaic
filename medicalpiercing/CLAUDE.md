# Medical Piercing klón – munkaszabályok (Claude)

A repó gyökerében lévő `CLAUDE.md` szabályai (magyar nyelv, mindent te csinálsz, teszt → commit →
push → PR, commit-üzenet magyarul ékezet nélkül, takarékosság a Cloudflare-buildekkel) itt is érvényesek.
Ezen felül:

- Ez a mappa **külön Cloudflare Pages-projekt** (`medicalpiercing`, Root directory: `medicalpiercing`).
  A MOSAIC oldalához (`../klon`, `../assets`, `../functions`) ne nyúlj, és onnan semmit ne importálj:
  a projekt önállóan épül.
- A `klon/` gépi kimenet (`tools/wix2static.mjs`). Ha a Wix-oldalról frissítesz, a `README.md` 1. pontjának
  láncát futtasd. Kézi javítás a `klon/`-ban akkor maradandó, ha a forrást (`tools/`, `assets/`) is javítod.
- Minden változtatás után: `node tools/build.mjs`, `node tools/serve.mjs`, majd `node tools/funkcio-teszt.mjs`
  és az érintett oldalakra `node tools/elteres.mjs` (asztali és `--mobil`). A cél: 0 eltérő elem.
- A mérőkódok csak a `www.medicalpiercing.hu` domainen futhatnak (`assets/js/suti.js`, `ELES_DOMAINEK`).
- Külső fiókokban (Wix, Google, Meta, CookieYes, Cloudflare DNS) semmit ne módosíts a tulajdonos kifejezett kérése nélkül.
- **Az új oldal ÉLES, a régi helyén** (a tulajdonos kérése, 2026-10-16: „tedd élesbe ezt az oldalt. Cseréld le az eredeti oldallal.”): a kapcsoló `lib/uj-eles.js`
  (`UJ_ELES = true`). Az új oldalak az eredeti címeken vannak (`/`, `/migren-piercing`, …, a köszönőoldalak is), a régi oldal SEO-fejével (cím, leírás, canonical, og/twitter,
  ld+json, Google- és Facebook-domainigazolás; ami a régin noindex volt, az marad; `elesFej` a `tools/uj-fooldal.mjs`-ben). A régi (Wix-klón) oldalak a `/regi/<út>` címen
  maradnak (noindex + `X-Robots-Tag`), a `/uj/*`, `/uj-fooldal`, `/uj` címek 301-gyel az eredeti címre visznek (a paraméterek maradnak). A `-b` címeken (pl. `/migren-piercing-b`)
  is a B-dizájnú új oldal van. A 404-oldal új (`uj-oldalak/sajat/404.html`). **Visszaállítás:** `UJ_ELES = false` a `lib/uj-eles.js`-ben, push + merge (minden a régi
  állapotba kerül: a régi oldalak az eredeti címen, az új a `/uj/...` alatt, rejtve).
  Minden kérés után (a „mindig élesítsd, mindig tedd ki” szabály szerint, 2026-10-16): build, a két teszt (`tools/uj-fooldal-teszt.mjs`, `tools/uj-oldalak-teszt.mjs`, helyben),
  commit, push, PR a `main`-re, merge, majd ellenőrzés az éles `https://www.medicalpiercing.hu/...` oldalakon; a tulajdonosnak az éles linkeket add, ne az előnézetet.
- **Minden fejlesztési kör végén bepipálós lista** (a tulajdonos kérése, 2026-10-16): a záró üzenetben `- [x]` lista arról, mi készült el – részletesen (minden kért pont
  külön sor), de röviden és nem technikailag (ne fájlnevek, CSS, kód), hanem hogy mit lát a tulajdonos és hol. Minden sorhoz az éles link, ahol ellenőrizheti; ha valami
  nem készült el vagy másképp lett, külön `- [ ]` sorban, egy mondat indoklással. Cél: ne kelljen visszagörgetnie, a listából tudja ellenőrizni, mit kell megnéznie.
- **Tervezés PDF / látványterv alapján – ALAPSZABÁLY** (a tulajdonos döntése, 2026-10-16): a terv (wireframe) elrendezéséből és tartalmából indulj ki, de ha megtervezted,
  nézd át szakaszonként, és igazítsd a mostani oldal kinézetéhez és dobozaihoz – a tervben szereplő elemeket nem kell pontosan úgy átvenni. Pl.: a GYIK teljes szélességű
  kérdés-rács (`gar-racs`), a helyszínek végig látszanak (a megszokott helyszín-doboz), a szöveg + kép a kéthasábos doboz (`kat-doboz kat-par`), a szakaszcímek középen
  (`kat-fej`), a hős a megszokott hős. Ugyanez érvényes, ha egy régi oldal szövegét kell új oldalba tenni (a szerkezet a forrásból, a kinézet a mostani oldalból).
  **Asztalon nem maradhat üres doboz** (a tulajdonos szabálya, 2026-10-16): ha a szöveg rövid a kép mellett (nagy üres sáv a szöveg alatt / fölött), csökkentsd a kép méretét és vele
  a doboz méretét (pl. az akció-oldal „Mi jár az árért?” doboza, a TikTok-landoló ékszer-doboza); ellenőrzéskor 1440 px-en minden kéthasábos dobozt nézz meg.
- **Gyorsítás – minden oldalon** (a tulajdonos kérése, 2026-10-17: „nézd meg az összes oldalt … futtass le egy Google … Speed Testet”): a mérés a PageSpeed Insights motorjával
  (Lighthouse, ugyanazokkal az alapbeállításokkal: mobil = lassú 4G + középkategóriás telefon szimulációja, asztali preset) minden oldalon, **nem az éles domainen**, hanem a
  `medicalpiercing.pages.dev` (élessel azonos tartalom) / előnézeti címen – ott a mérőkódok nem töltődnek be, a statisztikát nem szennyezi (a Google PageSpeed szolgáltatás kulcs nélküli
  kerete gyakran elfogy). Ami a gyorsítás része, és új oldalnál / új képnél is tartsd:
  - **Google-vélemények (Trustindex)**: a `loader.js` nem a lapban áll, hanem `data-ti-src`-ben (`reszek/velemenyek.html`), és a `uj-fooldal.js` 4. pontja csak akkor teszi a lapra,
    ha a doboz a megnyitáskor látszik, különben az első görgetés / érintés után, amikor 800 px-re a képernyő közelébe ér (előtte a lap betöltésekor ~0,8 mp-re lefoglalta
    a telefon processzorát és ~650 KB-ot töltött; a főoldalon a doboz közvetlenül az első képernyő alatt van).
  - **Galériák** (`uj-oldalak.js` 1., `uj-fooldal.js` 2b.): a következő képek előtöltése csak a képernyő közelében és a lap betöltése után (korábban minden galéria 9 nagy képet töltött
    azonnal, a lap alján levő szalon-galéria is; a hősben a többi kép az elsőtől vette el a sávszélességet).
  - **Válaszadó képek**: `python3 tools/kep-valtozatok.py` (a 400 px-nél szélesebb `<img>` képek 320 / 400 / 480 / 640 / 800 / 1200 / 1600 px-es WebP-változatai, JPG/PNG esetén az eredeti méretben is:
    `assets/img/valtozat/` + `jegyzek.json`), `node tools/kep-meretek.mjs` (a képek megjelenési szélessége lapanként: asztali 1440 és 820 px, mobil 390 px → `uj-oldalak/kep-meretek.json`),
    a build (`tools/valaszado-kepek.mjs`) ebből írja a `srcset` + `sizes` attribútumot (a lap `<link rel="preload" as="image">` sora `imagesrcset`-et kap, hogy ne az eredetit töltse). **Új kép vagy elrendezés-változás után futtasd a kettőt (build → kep-valtozatok → kep-meretek →
    build)**; a nem mért kép változatlan, eredeti méretben marad (nem romlik el, csak nem gyorsul). A `src` mindig az eredeti, a képnagyító is azt nyitja.
  - **A képek doboza a betöltés előtt is a végleges méretű (elrendezés-csúszás, CLS)**: a Lighthouse a város- és állásajánlat-lapokon csúszást mért (a `width:auto` +
    `height:auto` kép doboza a betöltés előtt 0 × 0 volt, a kép érkezésekor lejjebb tolta a tartalmat). A build (`kepDobozok`, `tools/valaszado-kepek.mjs`) minden új lapon az `<img>`-re
    írja a fájl valódi szélességét és arányát (`--kw`, `--ka`); az `uj-fooldal.css` eleje ebből adja az arányt (`aspect-ratio:auto var(--ka)`) és a `--kepw`-t
    (min(`--kw`, max-height × `--ka`)). **Ahol a CSS a kép saját méretét használja**, a szélesség `width:var(--kepw,auto)`, és **minden képre vonatkozó `max-height` mellett ugyanaz
    az érték `--mh`-ként is áll** (`max-height:260px;--mh:260px`; `none` → `--mh:100000px`); a képen az `aspect-ratio:auto` helyett `aspect-ratio:auto var(--ka)`. Új ilyen szabálynál így írd.
    Az álló videó (`.vid.vid-allo`) szélessége min(300px, max-height × 9/16); a középre igazított oszlopban a galéria-sáv `align-self:stretch`. Betöltés után a kinézet ugyanaz, mint
    `width:auto`-val – kivéve, hogy a srcset nem nagyítja a kis képet a valódi szélessége fölé. Ellenőrzés: `node tools/csuszas-teszt.mjs` (késleltetett képekkel a lap első
    képernyőjén mért csúszás, asztalon és mobilon) és `node tools/doboz-teszt.mjs ki.json [alap.json]` (a képdobozok betöltés előtt / után; az alaphoz mérve a végleges kinézet).
  - **Tömörített stílusok és szkriptek** (`tools/tomorites.mjs`, esbuild): csak a saját `uj-*.css`, `uj-fooldal.js`, `uj-oldalak.js`, `motor/motor.js`, `terkep.js`, `tipus.js`; a mérőkód
    fájljai (`suti.js`, `mp-meres.js`, `motor-indito.js`, `salonic-adapter.js`, `booking-id.js`) **változatlanul** mennek ki. Az esbuild nélkül a lépés kimarad (a lap ugyanúgy működik).
  - Betűk: a `plus-jakarta-sans-latin-ext.woff2` is előtöltve (a magyar ő / ű ebben van, a hős szövegében is); borítós videó `preload="none"` (a `sablon.mjs` `video()`-ja, és a build `videoElotoltes` lépése minden új lapon: a poszteres, nem automatikusan induló `<video preload="metadata">` → `none`, a hős álló videója mobilon különben ~650 KB-ot töltött); a blog első három kártyaképe nem lusta.
  - Nem változott (mérést érintene, külön döntés kell): a `suti.js` a `<head>`-ben szinkron töltődik (a hozzájárulás-alapértékek miatt), ez a „megjelenítést blokkoló” tétel egy része.
- **Feliratos ábrák és szöveges képek soha nem vágódnak le** (a tulajdonos kérése, 2026-10-17: „ezek a képek látszódjanak teljesen … le van vágva” – a pajzsmirigy-ábra): a lista
  `uj-oldalak/teljes-kepek.json` (a pont helye a testen: allergia / máj / pajzsmirigy / lép / vastagbél; a fülpontos ábrák; a „Tragus / Shenmen / Klimax pont”, „Vagus ideg” címkés fotók;
  a „Migrén piercing helye”; a 93%-os blokk képe; a 15 városnév-csempe). A build (`teljesKepek`, `tools/valaszado-kepek.mjs`) `data-teljes` jelet tesz rájuk: egészben látszanak, a
  kéthasábos dobozban és a cikkben a kép saját arányában, fix keretben (blog-kártya, csempe) középen, a maradék sávban a kép szélének színe (`tools/teljes-kepek.py` számolja). A „pont helye”
  ábra-hely (`.kat-video-img`) és a 93%-kép (`.stat-kep`) mindig a saját arányában (`uj-egyseges.css` vége). **Új feliratos képnél** a fájlnevet írd a listába, és futtasd a `tools/teljes-kepek.py`-t.
  Ellenőrzés: minden lapon, asztalon és mobilon, a listás képek 100%-a látszik (a fotók vágása szándékos).
- **Rejtett B-változatok a konverziós képernyőtervek szerint** (a tulajdonos kérése, 2026-10-16: „az összes oldalból építs egy B verziót … kirakhatod élesbe, de nem fog rá
  link mutatni”; PDF: „MP_kepernyotervek_mobil_v2”): `/b/<név>` – `/b/fooldal`, a 9 piercing-típus (`/b/migren-piercing` … `/b/vastagbel-piercing`), `/b/kozerzetjavito-piercing-soft-akcio`,
  `/b/3-piercing-2-araert` (páros akció), `/b/arlista-garancia`, `/b/migren-shenmen-piercing-velemenyek`, `/b/migren-es-shenmen-piercing-garancia`, `/b/ful-piercing-beloves-budapest`,
  `/b/elerhetosegek`, `/b/kontroll`, `/b/a-szuras-folyamata`. **Rejtett**: noindex (meta + `X-Robots-Tag`, `B_ELOTAG` a `functions/[[path]].js`-ben), nincs canonical, nincs a sitemapben, semmi nem
  linkel rájuk. A generátor `tools/uj-b-oldalak.mjs` (→ `uj-oldalak/sajat-b/*.html`, kézzel ne szerkeszd; a tények egy helyen, a `T` objektumban), a build a `tools/uj-fooldal.mjs`
  (`b2` opció: `oldal-b2` törzsosztály, `assets/css/uj-b.css` utolsóként). Saját részek: `reszek/akcio-sav-b*.html`, `akcio-sav-landolo-b.html`, `lablec-divat.html` (a fülpiercing-oldal
  lábléce közérzetjavító pontok nélkül), `video-velemeny-slim-b.html` (semleges borítók, fogyásígéret nélkül: `assets/img/uj-velemeny-*-semleges.webp`), `video-velemeny-allergia-b.html`
  (az egy videó kompakt, kéthasábos dobozban). A „Hova szúrjuk?” képe a hős fülfotójának közeli kivágása (`assets/img/uj-galeria-<típus>-pont.webp`). Új foglaló-előválasztások
  (`motor.js` `nyit`, `uj-fooldal.js`): `data-csomag="ketto"` → „2 személynek”; `data-tipus="mi|sh|…"` → a gomb saját típusa (a lap útvonala helyett). A mérés útja nem változott
  (a foglalás-indítás egyszer fut). Teszt: `node tools/uj-b-teszt.mjs` (rejtettség, képek, túlcsordulás, üres doboz, ragadós sáv egy sorban, minden foglaló-gomb + előválasztás + mérés,
  tiltott szavak a TikTok-B-n). Kimaradt (külön döntés kell): a foglalómotor és a köszönőoldal terve, a „Nem tudom” motor-ág díja, a statikus Google- és szakember-idézetek.
  Ha a tulajdonos véglegesíti, a B-oldal tartalma a régi helyére kerül (a `/b/` cím megszűnik, a belső linkek nem változnak).
- **A „B” változat az alap** (a tulajdonos döntése, 2026-10-13): az `/uj/migren-piercing`, `/uj/shenmen-piercing`, `/uj/klimax-piercing` és `/uj/slim-etvagycsokkento-piercing` oldal az eredeti
  `-b` oldalak (`migren-piercing-b`, `shenmen-piercing-b`, `klimax-piercing-b`, `slim-piercing-b`) szerkezetéből és szövegéből épül, a kategóriaoldalak dizájnjával, **„b” nélküli címen**
  (a menü és a belső linkek ide mutatnak; `/uj/uj-…-b` cím nincs). Az eredeti (régi) kategória-sablon csak az allergia / máj / pajzsmirigy / lép / vastagbél oldalnak marad (nincs `-b` oldaluk).
  A leképezés: `B_ALAP` a `tools/uj-oldalak/kategoria.mjs`-ben, a kiírás `tools/uj-fooldal.mjs` (`ujOldalak`); a stílus az `assets/css/uj-kategoria.css` végén (B szakasz). Az első galériakép „Lapozz jobbra”
  jelzését a `tools/uj-b-hos-kep.py` rajzolja (`assets/img/uj-hos-01.webp`), a „Miért a Medical Piercinget válaszd?” ikonjait a `tools/uj-b-ikonok.py` színezi a főoldal palettájára (`assets/img/uj-biz-*.webp`).
  A `tools/uj-oldalak-teszt.mjs` ezekre az oldalakra az eredeti `-b` oldalhoz hasonlít. A `/uj/…-b` tükör-oldalak (az eredeti `-b` oldalak általános sablonnal készült másolatai) megmaradnak.
- **Kézzel írt új oldalak és közös szövegjavítás** (2026-10-16): az `uj-oldalak/sajat/<név>.html` → `/uj/<név>` (első sor: `<!--oldal {"cim","leiras"} -->`, utána a `<main>` tartalma
  a közös részekkel, pl. `<!--#helyszinek-->`, `<!--#velemenyek ti=<Trustindex-kulcs>-->`); ha ugyanilyen című tükör-oldal is van, a kézzel írt az erősebb. Így készült: Csapatunk, Kapcsolat,
  Ékszereink, Helyszíneink (`elerhetosegek`), Vélemények, Garancia. A Gabi története, a Rólunk és az őszi akció oldala a B-oldalak építőjével készül (`B_ALAP`, `HOS_CIM` a `kategoria.mjs`-ben).
  A `tools/uj-fooldal.mjs` `szovegJavit` minden új lapon: nincs arany / 14 karátos bevonat (helyette „magas minőségű orvosi fém, G23 titánium”), a régi „4.100+” véleményszám – és 2026-10-17 óta
  minden régi véleményszám („Több mint 3.400 értékelés”, „Kiváló 4,8 | 2.436 vélemény”, „4 900+ Google-vélemény”, „4.600+ vendégünk leírta” …; a tulajdonos kérése: „mindenhol 5000
  valamennyi legyen, amennyi az aktuális”) – helyett a Google mostani száma (`GOOGLE_DB` tartalék, a lap a `/api/ertekeles`-ből frissíti). A hős badge-sora közös: `uj-oldalak/reszek/bizalom.html`.
- **Galéria a piercing-oldalak hősében** (2026-10-16): mind a 9 kategória-oldalon (migrén, shenmen, klimax, slim, allergia, máj, pajzsmirigy, lép, vastagbél; a divat fülpiercing nem) a hős galéria:
  az 1–2. kép a tulajdonos Drive-mappájából (`assets/img/uj-galeria-<kulcs>-1|2.webp`), a 3–5. a migrén-oldal közös képei (`GALERIA_KOZOS`, `hosGaleriaKepek` a `kategoria.mjs`-ben). A galériás hősön nincs „20 év” pecsét.
  Arany-szöveg sehol (a fotók maradhatnak); a „Szúrathatok arany Shenmen piercinget is?” cikknek nincs `/uj` változata (`KIZART_UTAK`, `sablon.mjs`).
- **Egységes blokkok minden új oldalon** (2026-10-16): a „Legnépszerűbb piercingeink” mindenhol a főoldal doboza (`uj-oldalak/reszek/piercingek.html`); a tükör-sablon és a B-építő a régi
  piercing-rácsot (és a címét) erre cseréli (`piercingRacs` / `piercingCim` a `sablon.mjs`-ben). A budapesti szalon fotógalériája mindenhol a `migren-piercing-b` oldal „Budapesten a Jászainál várunk”
  galériájának képeivel jelenik meg (`szalonGaleria`, `sablon.mjs`; a főoldal alján: `reszek/szalon-galeria.html` a `kapcsolat` részben). A „9 ok, amiért minket válassz” csúszka kimarad.
  A blogcikkek képei a szöveg szélességében, nagyítás nélkül. A közös rész maga is tartalmazhat közös részt (`osszerak`, legfeljebb 3 szint).
- **A piercer-oldalak, a tartalmi oldalak és a GYIK** (2026-10-16): az 5 piercer-bemutatkozó oldal a `tools/uj-piercerek.mjs` kimenete (`sajat/piercer-*.html`: hős, „Rólam” doboz a tényekkel,
  a videók rácsban – álló videók mobilon lapozható sávban –, piercingek, „Tudtad, hogy…?”, 93%, vélemények); a GYIK (`/uj/akupunkturas-piercing-tudastar-video`) a `tools/uj-gyik.mjs` kimenete
  (33 kérdés 5 témában, lenyitható, asztalon két rögzített oszlopban – `HASABOK`; az ékszer anyagáról szóló két válasz a mostani kínálat szerint, G23 titánium; a videó borítója
  `assets/img/uj-gyik-video.webp`: GPT-vel tervezett háttér + a videó valódi képkockája + felirat az oldal betűjével). Kézzel írt oldal lett: A szúrás folyamata (6 lépés, az 1. videó az állapotfelmérés,
  az ékszerválasztásnál a közös ékszer-galéria), az Utóápolás, A piercingek eredete (`igy-mukodnek-a-kozerzetjavito-piercingek`), a divat fülpiercing (`ful-piercing-beloves-budapest`,
  az árak a Salonic mostani árai) és az Árlista / Ajándékkártya (`sajat/arlista-garancia.html`, `sajat/ajandekkartya.html`; a vásárlás a `https://medicalpiercing.salonic.hu/giftcards` címen,
  a motor ezt nem fogja el). A generált `sajat/` fájlokat ne kézzel szerkeszd, hanem a generátort futtasd. A Gabi története, a Rólunk és az őszi akció oldala a B-oldalak építőjével készül.
- **Egységes formázás minden új oldalon** (a tulajdonos kérései, 2026-10-16): `assets/css/uj-egyseges.css` (minden lapon UTOLSÓKÉNT töltődik). Asztalon a hős szöveghasábjának teteje / alja
  a kép tetejéhez / aljához igazodik; mobilon a hős a tartalom teljes szélességében, és MINDEN eleme egy középvonalra igazodik (cím, bevezető, gombok, értékelés, linkek;
  a tulajdonos kérése, 2026-10-16, 3. kör: „valami középre van igazítva, meg nem”): az értékelés egy sorban, a csillagok és a „Kiváló…” egymás mellett, középen (nincs rés közöttük);
  alatta a linkek középen, mértékletes közzel – nem sorkizárva, kevés linknél sem; alatta a badge-ek (a piercing-oldalakon teljes szélességben). A főoldalon a linksor és a 4 badge
  ugyanolyan széles (300 px), középre igazított blokk. A Vélemények hősében a 6 kategóriagomb mobilon 3×2-es rácsban, csak a névvel (a „piercing” szó asztalon látszik, `ugras-hosszu`).
  A rövid (≤34 karakteres) cím egy sorban (`cim-rovid`, `sablon.mjs`). A kéthasábos dobozok hasábjai egyforma magasak (a cím a videó tetejénél, a gomb a videó aljánál), az ikonos
  másodlagos címkék („VIDEÓ”, „A MÉDIÁBAN”) nincsenek. Álló videó mindig álló (9:16) keretben (`allo-keret`). A 93%-os blokk közös (`statDoboz`, `tools/uj-oldalak/kozos.mjs`;
  `reszek/stat-93.html`), a „Tudtad, hogy…?” doboz közös (`reszek/tudtad.html`), a „Helyszíneink” link mindenhol a kitelepülések oldalára (`/elerhetosegek`) mutat. Tablet (761–1000 px): a hős
  szövege teljes szélességű, az álló videós lépések két hasábban.
- **Menü és lábléc** (2026-10-16): a „Vélemények” után 5 csillag (Google-jel nélkül), a menü 1001 px-től egy sorban elfér; az almenü-ikonok GPT-vel készült vonalas ikonok
  (`assets/img/menu-ikon/<név>.webp`, 96 px), a piercerek mellett a portréjuk (`assets/img/csapat/`). A lábléc (`reszek/lablec.html`) az éles oldal láblécének tartalma sötét háttéren: menü,
  tudnivalók, elérhetőségek, nyitvatartás (**Hétfő–Szombat 08:00–19:00, Vasárnap zárva** – a tulajdonos 2026-10-29-i kérése; a régi Wix-oldalak láblécében és a tartalom-JSON-ok „H-P 9–19, Szo 9–18” szövegét a `tools/build.mjs` és a `tools/uj-oldalak/kategoria.mjs` (`NYITVATARTAS`) javítja; a telefonos elérhetőség „H–P 9:00–17:00” külön dolog, azt nem érinti), két foglalás-gomb, jogi szövegek.
- **Videók mobilon** (a tulajdonos kérése, 2026-10-16): érintőképernyőn (`(hover: none) and (pointer: coarse)`) a lejátszott videó teljes képernyőre ugrik (`assets/js/uj-fooldal.js`, 3. és 3b.):
  a saját mp4-ek (`video[controls]`, a vendégvideók sávja is) `playsinline` nélkül (iPhone: a Safari saját lejátszója), Androidon a lejátszáskor `requestFullscreen`, a végén vissza; a YouTube-ablak
  (`#videoablak.mobil`) kitölti a képernyőt (a YouTube címsora, gombjai a fekete sávokra kerülnek, nem a videóra), Androidon teljes képernyő + fekvő tájolás, a beágyazás kap
  `playsinline=0&iv_load_policy=3&fs=1`-et. Asztalon semmi sem változik. A foglaló „Hogy néz ki egy szúrás?” videója is teljes képernyőn indul mobilon (`szurasNyit`).
- **Videók indexképei** (a tulajdonos kérése, 2026-10-16, 4. kör): a fő piercing-oldalak YouTube-videóinak indexképe GPT-vel tervezett háttér + a videó valódi képkockája +
  felirat (`assets/img/uj-yt-<videó-azonosító>.webp`; a `YT_KEP` / `videoBorito` a `tools/uj-fooldal.mjs`-ben cseréli a YouTube saját képét); az álló (saját) videókon nagy
  lejátszás-jel (`.video-indito`, `uj-fooldal.js` 3c.). **Mind a 37 vendégvideó tervezett borítót kapott** (a tulajdonos kérése, 2026-10-16, a 09-es próba után):
  `assets/img/uj-velemeny-<nn>-terv.webp`, a `tools/uj-velemeny-borito.mjs` sablonjával (GPT-háttér `tools/kep-forras/velemeny-borito-hatter.webp` + a videó felirat
  nélküli valódi kockája, arcra vágva, a felső logósáv nélkül + a vendég legerősebb, valóban elhangzott mondata + alul „<Keresztnév> így segített a … piercing”).
  A tulajdonos döntése: a borítón a vendég **keresztneve** szerepel; a fájlnevekben továbbra sincs név, és a név–sorszám összerendelés, az idézetek adatfájlja a repóba
  nem kerül (a sablon az adatfájlt paraméterként kapja). Új vendégvideónál: felirat nélküli kocka + mondat a leiratból + a sablon futtatása.
- **A tervezett indexképek soha nem vágódnak le** (a tulajdonos kérése, 2026-10-16: „minden nézetben látszódjanak”): a `YT_KEP` képei (`uj-yt-*`, GYIK, szúrás, média) a build
  jelölésével (`data-terv` + `.terv-hatter`, `videoBorito` a `tools/uj-fooldal.mjs`-ben) egészben látszanak (contain); ha a doboz aránya más (pl. a kéthasábos dobozok egyforma
  magas hasábjaiban), a maradék sávot a kép saját széle tölti ki (a legfelső / legalsó sorai kinyújtva, `uj-egyseges.css`). Új tervezett kép: a `YT_KEP`-be kerüljön.
  Ellenőrzés: a borítók láthatósága minden oldalon 4 szélességen (1440 / 1100 / 820 / 390) – a vágott rész legfeljebb 3% lehet.
  A Vélemények oldal hősképe a saját arányában (3:2, csík nélkül), kattintásra a migrénes videósávhoz görget (`#videok-migren`; minden videósáv horgonya `videok-<kulcs>`).
  Az álló saját videók lejátszás-gombja (`.video-indito`, `uj-fooldal.js` 3c.) a videó LÁTHATÓ helyére kerül (`getBoundingClientRect`; a hősben a videót
  `left:50%` + `translateX(-50%)` teszi középre, amit az `offsetLeft` nem lát – ettől csúszott félre a gomb, 2026-10-16).
- **Álló Facebook-videók borítója** (a tulajdonos kérése, 2026-10-16): a `facebook.com/plugins/video.php` iframe-ek helyett a build (`fbBorito`, `tools/uj-fooldal.mjs`)
  tervezett borítót tesz (`assets/img/uj-fb-<videó-azonosító>.webp`, ugyanazzal a sablonnal: `tools/kep-forras/fb-boritok.json`, a kivágott kockák
  `tools/kep-forras/fb/`), kattintásra a helyén tölt be a Facebook-lejátszó (`uj-fooldal.js` 3d.); addig a Facebook semmit nem tölt a lapon.
- **Álló saját videók (mp4) borítója** (a tulajdonos kérése, 2026-10-16, 5. kör: „az állóvideókkal fuss még egy kört … erre is generálj szépen thumbnailt”): a Wix-ből átvett,
  feliratos első kocka helyett tervezett borító (`ALLO_BORITO` / `alloBorito` a `tools/uj-fooldal.mjs`-ben, a videó fájlneve szerint; a build `data-terv`-et tesz a videóra, a lejátszás-jel
  a képen van, az oldal saját jele ezeken rejtett). A landolóoldalak Wix-es vendégvideói ugyanazok, mint a Drive-ról jött 37 vendégvideó (képkocka-egyezés): azok a meglévő
  `uj-velemeny-<nn>-terv` borítót kapják; a többi (Ricsi, Fanni, Brigi videói, a behelyezések) `assets/img/uj-allo-<id7>.webp`, ugyanazzal a sablonnal (`tools/kep-forras/allo-boritok.json`,
  a felirat nélküli, a felirat fölött kivágott kockák: `tools/kep-forras/allo/`; az egy, a 37 között nem szereplő vendégvideó adatai a repón kívül). A hősben az álló videó mellett nincs
  üres fehér sáv: a képhasáb a borító hátterét kapja (`assets/img/uj-allo-hatter.webp`), a videó keretezve középen. Az „Így néz ki egy … behelyezés” dobozokban a videó mellett
  a behelyezés 4 lépése + link a szúrás folyamatához (`BEVIDEO_LEPESEK`, `tools/uj-oldalak/kozos.mjs`; a tükör-oldalakon `behelyezesLepesek`).
- **Az őszi akció oldala** (`/3-piercing-2-araert`, a menü „Akció” pontja; a tulajdonos kérése, 2026-10-17: „a három piercing két áráért maradjon meg, a … régi link
  301-gyel irányítson át …, a régi oldalt klónozd le az új élesre, az új dizájnnal … csak a szekciók sorrendje és a szöveges tartalom, és ez a fontos”): a két akció-oldalból egy lett.
  A `/3-piercing-2-araert-regi` **301-gyel** ide visz, a paraméterekkel (`SAJAT_ATIRANYITASOK`, `lib/utvonal.js`); a menü, az akciós sávok és a régi „3 piercing 2 áráért! - AKCIÓ!”
  linkek közvetlenül ide mutatnak. A Wix-es eredeti a `/regi/3-piercing-2-araert-regi` címen marad (noindex). Kézzel írt oldal (`uj-oldalak/sajat/3-piercing-2-araert.html`): a
  szakaszok sorrendje és a szöveg **1:1 a Wix-es `-regi` oldalról** – hős („Most megéri 2 vagy 3 piercinget szúratni!”, a plakát egészben, négyzetes kerettel) → „Több piercing =
  Erősebb hatás” (+ az ékszer-lapozó) → „9 ok, amiért a piercingeink működnek!” (mind a 9 pont; az eredetin görgethető szövegdobozban; lapozó – a `.kar` sáv, asztalon 3, tableten 2, mobilon 1 kártya + a következő széle, a tulajdonos kérése, 2026-10-17: „csinálj belőle egy szép lapozót”; minden kártyán felül a mondanivalójához illő **valódi fotó a Drive-ról** („ne kamufotót”), a képtár-címkék táblázatából (`tools/kepcimkezo/README.md`) válogatva, 3:2-re kivágva (`assets/img/uj-ok-<n>.webp`), rajta rózsás körben a sorszám; a kártyák mobilon is egyforma méretűek (a tulajdonos kérése, 2026-10-17: „a lapozó minden szöveg ugyanakkora lenne”); **csak a mostani csapat** (Ricsi, Gabi, Brigi) – a volt kolléganő (a zöld / sötétkék ruhás barna hajú lány, pl. a „Viki fotózás” mappa) egyik képen sincs, új fotónál is ügyelj rá) → „Legnépszerűbb piercingeink 👇”
  (mind a 10 típus az eredeti listáival) → „Tudtad, hogy...?” → 93% → „Olvasd el a visszajelzéseket!” → helyszínek → „Ismerd meg csapatunkat!” –, a dobozok a mostani oldalé
  (a TikTok-landoló mintájára). Szándékos eltérés (a `tools/uj-oldalak-teszt.mjs` `SZANDEKOS_LAP` sora; minden más eredeti sort számon kér): a vélemény-szám a Google mostani
  száma, „Már 15 városban várunk!” (az eredetin 12, a lista 15 város), a város-csempe maga a foglaló-link, a „higiánia” elírás javítva; a kitelepülési napok a táblázatból.
  A lapcím a mostani árral (`FRISS_CIM`, `tools/uj-fooldal.mjs`; a Wix üres leírása helyett a lap sajátja). Korábban itt a „Páros kedvezmény” (B-építő) volt, a `-regi` címen pedig
  a PDF 03-as terve szerinti kézzel írt oldal (2026-10-16; a git-előzményben: `uj-oldalak/sajat/3-piercing-2-araert-regi.html`) – a tulajdonos döntésével (2026-10-17) mindkettő
  helyett ez. A páros akció rejtett B-változata (`/b/3-piercing-2-araert`) marad.
  **2. kör – „szóljon a hidegeknek is”** (a tulajdonos kérése, 2026-10-17): a cím „Megéri kettő vagy három közérzetjavító piercinget szúratni”, alcím: „Nemcsak azért, mert
  kedvezményesebb árúak, hanem azért is, mert együtt, egymást erősítve jobban kifejtik hatásukat.” (a tulajdonos javítása: az „egymás hatását” magyartalan), alatta előszöveg az
  akcióról keretben, „Őszi akció · visszavonásig” jellel (3. kör: az akció hangsúlyosabb). A hős képe **három valódi fülfotó a Drive-ról** (három különböző
  vendég, mindegyiken három közérzetjavító piercing, divat-fülbevaló nélkül: `assets/img/uj-akcio-ful-1..3.webp`), CSS-sel lassan váltakozva (`.hos-valto`, 13,5 mp-es kör; az első
  áll, a csökkentett mozgásnál csak az első) – tiszta videó nem volt (a Drive-os videókon divat-lyukak vagy szilikon műfül). A „Több piercing = Erősebb hatás” doboz (a galéria marad)
  alatt (3. kör: „Vendégeink nagy többsége” a 81% helyett; az 1 / 2 / 3 piercing ára kiemelt csempéken „Akció · visszavonásig tart” jellel; asztalon a galéria
  pontosan a szöveghasáb magasságában, `.tobb-doboz`) **három hármas csomag** (`.csomagok`: Migrén + Shenmen + Klimax, Migrén + Shenmen + Máj, Klimax + Shenmen + Slim): hogyan erősítik egymást, kik választják – a ChatGPT-vel
  (gpt-5.5) a szalon saját piercing-leírásaiból és a vendégvélemények kombinációiból; a kép a fül a csomag három pontjával (`assets/img/uj-csomag-a|b|c.webp`, az oldal pont-ábráiból
  összerakva, a klimax- és a máj-ábra igazítva; a feliratos ábrák listáján); a gomb „Ezt a hármast kérem” (`data-csomag="3"`, a meglévő előválasztás). A „Tudtad, hogy...?” szakasz
  ebbe olvadt bele (a záró mondata; a két páros csempe a 3. körben kimaradt, a csomag-kártyán az ár középen). A „Legnépszerűbb piercingeink” rács (3. kör: címe „Ezeket a piercingeket érdemes párban vagy hármasban választani 👇”) – belőle a divat fülpiercing kimaradt, a képeken jelölés: mivel szokták párban / hármasban
  választani (`.kartya-par`). A vélemények címe „Olvasd el, hogyan segített azoknak, akik többet szúrattak”, alcíme „A piercingek erősítik egymást – nézd meg, mit írtak róla
  viselőink:”; alatta a **2-3 piercinges vendégvideók** sávja („Videóban mesélnek a vendégeink, akik több piercinget szúrattak”) (`reszek/video-velemeny-tobb.html`, `TOBB` a `tools/uj-video-velemenyek.mjs`-ben: a leiratok szerint a 20-as három, a
  többi két piercinget kapott; a 21-es és 36-os második piercingje megerősítő). A csapat lapozó (`.csapat-kar`). A vélemény-doboz widgetje a „2-3 PIERCING - 2026”
  (Trustindex 838417, kulcs `a956e9c8305984117f761d63e99`): a „SHENMEN - 2026” (679552) klónja, csak a „2-3 Piercing” címkés véleményekkel; a tulajdonos kifejezett
  engedélyével hoztam létre (2026-10-17), a lapban `<!--#velemenyek ti=a956e9c8305984117f761d63e99-->`. A Trustindex-fiókban mást továbbra se hozz létre és ne módosíts e nélkül.
  A `tools/uj-oldalak-teszt.mjs` `SZANDEKOS_LAP` sora a 2. kör átírt sorait is kivételnek veszi.
- **A TikTok-landoló** (`/kozerzetjavito-piercing-soft-akcio`, a TikTok-hirdetések céloldala; a tulajdonos kérése, 2026-10-16): a szöveg **1:1 az eredeti landolóról**
  (`/regi/kozerzetjavito-piercing-soft-akcio`), de **sehol nem állhat panasz- vagy orvosi szó** („nem lehet sehol sem, se migrén, se klimax, semmi ilyesmi, nem lehet a
  thumbnail-es videók thumbnail-en se … semmi olyasmi kifejezés, ami orvosi” – a TikTok letiltja): a szövegben, a képeken és feliratukban, a videók borítóin, az alt / title /
  meta szövegekben, a menüben, a láblécben, sőt a forráskommentekben sem (EÜ, gyógy-, kezelés, állapotfelmérés, érzéstelenítés is tilos; a teljes lista: `TILTOTT_LANDOLO`,
  `tools/tiltott-landolo.mjs`; a `tools/uj-oldalak-teszt.mjs` és a `tools/uj-b-teszt.mjs` minden landolón ellenőrzi). Kézzel írt oldal (`uj-oldalak/sajat/kozerzetjavito-piercing-soft-akcio.html`, első sorában `"landolo":true`):
  saját rövid fejléc (logó **jelmondat nélkül** – `assets/img/uj-logo-marka*.webp`, `tools/uj-logo-marka.py` –, Vélemények, Időpontfoglalás; piercing-menü nincs), az akciós
  sáv a lap árlistájához visz, saját lábléc a tiltott szavak és a két jogi bekezdés nélkül (`reszek/fejlec-landolo.html`, `akcio-sav-landolo.html`, `lablec-landolo.html`;
  `oldalHtml` `landolo` opció, `sablon.mjs`). Kimaradt: az akciós piercing-típusok sora, a „3 legnépszerűbb piercing” listái, „Tudtad, hogy…?”, „3000+”, két panaszos
  „Miért érdemes” pont, a kártyákon az állapotfelmérés és az érzéstelenítés, a kontroll első bekezdése, a csapat-jellemzések EÜ- / migrén-részei, a Google-vélemények doboza
  (a vendégek panaszokat írnak; marad a Google-értékelés feje és a link) és minden vendégvideó; a MIGRÉN-feliratos fülfotó helyett felirat nélküli. Az ékszer-lapozó a főoldali
  doboz galériája (`reszek/ekszer-galeria.html`). Új elem a landolón: előbb nézd meg, nincs-e benne (képen, borítón sem) tiltott szó. A tulajdonos döntése (2026-10-16, 10. kör): a hős „Áprilisban” helyett „Most”, a helyszínek címe
  „Már 15 városban várunk!”, a címből a „Működő” kimaradt; a többi szöveg 1:1 marad. A szakaszok a főoldal dobozaival: a hős árai az akció-oldal árdobozaiban, az „AKCIÓ!” árai a főoldal
  sötét akció-dobozában, az árlista és a páros akció a főoldal árlista-dobozában (balra a szöveg, jobbra a kártyák; a páros kártyák sötétek, két füllel), a kontroll a főoldal garancia-paneljében.
- **Árlista-doboz** (2026-10-16, 5. kör): a kártyákon minden középen (ikon, cím, áthúzott ár, ár, megtakarítás), az áthúzott ár és a keret rózsás, nem szürke (`uj-egyseges.css` vége).
  A „Tovább az összes véleményhez” dupla-szűrője az eredeti oldal `<strong>`-os linkjét is felismeri (a TikTok-landolón és 7 másik oldalon kétszer állt).
- **Árlista-doboz fülikonjai** (2026-10-16): GPT-vel rajzolt vonalas fülek az ékszerekkel (`assets/img/uj-ful-1|2|3|2x2.webp`, `tools/uj-ful-ikonok.py`, forrás:
  `tools/kep-forras/ful-ikonok-gpt.webp`); az akciós (sötét) kártyán is világos körben. A „Tovább az összes véleményhez” link nem kerül oda, ahol az eredeti oldal saját
  ilyen linkje közvetlenül utána áll (`velemenyLink`; a teszt figyeli a duplát).
- **Arcra igazított képvágás** (2026-10-16): a vágott (`object-fit: cover`) képek mobilon is az arcnál maradnak: a `tools/kep-fokusz.py` (OpenCV YuNet arcfelismerő, offline) írja az
  `uj-oldalak/kep-fokusz.json`-t, a build `object-position`-t tesz a képekre. Új kép esetén a szkriptet újra kell futtatni. A páros képek mobilon 4:3-asak.
- **Apróságok** (2026-10-16, 4. kör): minden vélemény-blokk alatt „Tovább az összes véleményhez” link (a Vélemények oldal megfelelő részéhez, `velemenyLink`); a mobilmenüben
  a Kapcsolat alatt „Garancia”; a szöveg mindenhol „Garanciális szúrásra jelentkezem”; a lábléc logója fehér, átlátszó hátterű (`uj-logo-feher.webp`); a főoldal idézete asztalon is középen.
- **A hős 4 badge-e** (`reszek/bizalom.html`) csak a piercing-oldalakon, az akció-oldalakon és a főoldalon van (a tulajdonos kérése, 2026-10-16: „csak helyet foglal mobilon”); a tartalmi
  oldalakon, a piercer-oldalakon és a GYIK-en nincs. A piros körös X rajzolt (SVG), nem „×” betű. A galériás hős asztalon négyzetes (1:1) marad.
- **Térkép a kitelepülések oldalán**: a városokra kattintva a foglalómotor az adott helyszínnel nyílik; asztalon rámutatva infobox a címmel (a címek: `reszek/helyszinek.html`) (`tools/uj-helyszin-terkep.mjs`: HTML-linkek az SVG fölött, `ht-pin`, a meglévő
  Salonic-linkekkel – a motor ezeket fogja el; a mérőkód nem változott).
- **Vendégek videós beszámolói** (2026-10-16): a tulajdonos Drive-járól („Testimonial videók”) mind a 37 vendég-videó, webes változat `assets/video/uj-velemeny-<nn>.mp4` (480 px, H.264)
  + borító `assets/img/uj-velemeny-<nn>.webp`; a fájlnevekben nincs vendégnév (a név–sorszám összerendelés a repóba nem kerül). A besorolás a leirat alapján (`VIDEOK` a
  `tools/uj-video-velemenyek.mjs`-ben; egy videó több piercingről is szólhat) → `reszek/video-velemeny-<kulcs>.html` (migren 17, shenmen 11, klimax 9, slim 9, allergia 1, mind 37).
  A piercing-oldalakon az első vélemény-blokk alatt a saját témájú sáv (ha nincs, a `mind`), a többi oldalon a `mind`. A Vélemények oldal hősképe: GPT-sablon + a videók valódi
  képkockái (vendég arcát AI-jal nem módosítjuk).
- **Google-vélemények mindenhol a főoldali lapozóval** (2026-10-16): az eredeti oldal saját Trustindex-widgetje csak akkor marad, ha rendes lapozó (`JO_VELEMENY_KULCSOK`, `sablon.mjs`);
  a 2 véleményes (783989…), az üres és az ismeretlen widget helyett a főoldali (daf9c4…, 35 vélemény). A tükör-oldalak Trustindex-beágyazása (assets/embed) is a főoldali doboz lett.
- **Helyszíneink hősképe**: Magyarország térképe a 15 helyszínnel (`tools/uj-helyszin-terkep.mjs` → `reszek/helyszin-terkep.html`, beágyazott SVG a lap betűjével).
- **A hirdetések céloldalai** (Meta, TikTok; 2026-10-16-i lista) mind formázottak az `/uj` alatt; a két utolsó: `/kozerzetjavito-piercing-soft-akcio` (a TikTok-landoló; 2026-10-16 óta kézzel írt,
  lásd fent) és `/3-piercing-2-araert` (2026-10-17 óta az őszi akció oldala, a Wix-es `-regi` oldal szövegével, lásd fent). A közös dobozok (akció, árak, ékszerek, helyszínek, piercingek, média, csapat) egy oldalon csak egyszer jelennek meg.
- **A foglalómotor Piercing-lépése** (`assets/js/motor/motor.js`, `szolgRajzol` / `pkKartya` / `pkAdat` / `arakBol`): **2026-10-20 óta (a tulajdonos kérése: „régen egy listában volt az összes piercing, egymás alatt”) nincs szűrősor**
  (a Magamnak / 2 személynek és az 1 piercing / 2–3 piercing / Fülbevaló gombok, a „Legjobban megéri” jelölés megszűnt). Felül a „★ 4,8 · 5052 Google-értékelés” és mellette a „Hogy néz ki egy szúrás?” (felugró, bezárható videó: X, háttér, Esc),
  alatta MINDEN lehetőség kártyája egy listában, egymás alatt, **tömör kártyákkal** (a fej ~50 px, a „Részletek” és az „Időpontot választok” gomb 36 px). Sorrend: 1 piercing (a típusoldal piercingje elöl; a divat fülpiercing
  oldalán a fülbevalók), 3 / 2 piercing, 1+1, 2 személynek (2 / 4 / 6 db), fülbevaló; az akció-oldal „Ezt foglalom” gombjáról (`data-csomag` 2 / 3) választott csomag, illetve a páros gombról (`ketto`) a 2 személynek csomagok elöl.
  Minden kártyán két gomb: „Részletek” (lenyitja: a pont helye a valódi fülfotóval, mire jó, garancia, „Az ár tartalmazza”; a csomagoknál a kedvezmény levezetése a helyszín mostani Salonic-áraiból) és az erős színű
  „Időpontot választok” (a régi `[data-szolg]`: a foglalási út, a mérés és a tesztek ugyanazok). MINDEN kártya csukva indul; egyszerre egy nyitható le. A nevek teljesek („Migrén piercing”, …).
  A „Kiesett ékszer újraszúrása” belsős Salonic-szolgáltatás (a tulajdonos döntése, 2026-10-16): NEM foglalható, a listából kimarad (`ujraszuras`, `szolgaltatasLepes`);
  az „Ékszercsere / visszarakás” visszahívó űrlap legördülőjében kérhető. Az értékelés a pontos szám a `/api/ertekeles`-ből (a Trustindex-doboz fejléce). A „Hogy néz ki egy szúrás?” videója a TikTok-fiók legnézettebb
  organikus shenmen-szúrós videója (`assets/video/uj-shenmen-szuras.mp4`). A helyszín-lépésben a térkép (rámutatva a cím), a fejlécben a választott város. Teszt: `tools/motor-tipus-teszt.mjs` (N, K2).
- **A 2 és 3 piercinges csomag EGY személyre szól** (a tulajdonos kérése, 2026-10-29; a vendégek kétszemélyes csomagként is hívták): a kártya fejlécében „1 személyre” jelzés (`.pk-szem`, `pkAdat` `szemely`), a „Részletek”-ben „Egy személyre szól: mind a … piercinget ugyanaz a vendég kapja, a csomag nem osztható meg. Ketten jöttök? Nézd a „2 személynek” csomagokat lejjebb.” A „2 személynek” kártyák neve eleve kimondja. Teszt: `tools/motor-tipus-teszt.mjs` (N).
- **Várható időtartam a vendég felé (e-mail, SMS, „A foglalásod” oldal): mindenhol a Salonic szolgáltatás idejéből, +10 percig** (`kb. 10–20 perc` egy piercing, `kb. 15–25` a 3 piercing, `kb. 30–40` a 2 személynek 6 db); kitalált szám SOHA (se „30–40”, se „40–50 perc”, se „fél óra”); ismeretlen szolgáltatásnál az időtartam-sor kimarad. Egy helyen volt kemény kódolt érték (`lib/foglalasom.js`, 2026-10-29-ig): ma `lib/mp-idotartam.js` (a Salonic-pillanatkép másolata; a `tools/test-mp-idotartam.mjs` ellenőrzi a levelekkel való egyezést és a levélkatalógust). A levelek forrása: `tools/levelek/general.py` (`--motor` → `netlify/lib/lifecycle/katalog/mp.js`).
- **Az előtöltött piercing naptára nem veszhet el** (hiba, 2026-10-31, Feri: Debrecen, 3 és 2 piercing: „nem lehet decemberre lapozni”; Kaposvár 3 piercing: „nincs szabad hely”): a lista első két kártyáját a motor előtölti (0–21. és 21–100. nap); ha a vendég a teljes letöltés után kattintott, az `onMore` a teljes naptárat rajzolta, majd az idopontLepes az első 21 napot visszaírta (csak 3 hét, lapozó nyíl nélkül). Javítva: `teljesBent` (`motor.js`, `idopontLepes`). Teszt: `tools/motor-elotoltes-teszt.mjs` L-eset (Debrecen, 3 piercing; élesen a javítás előtt piros volt). A Salonic-egyezés vizsgálatánál a motort az előtöltés kivárásával is kell mérni (a lista megnyitása után 2–6 mp, majd kattintás).
