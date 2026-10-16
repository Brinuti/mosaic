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
- **A „B” változat az alap** (a tulajdonos döntése, 2026-10-13): az `/uj/migren-piercing`, `/uj/shenmen-piercing`, `/uj/klimax-piercing` és `/uj/slim-etvagycsokkento-piercing` oldal az eredeti
  `-b` oldalak (`migren-piercing-b`, `shenmen-piercing-b`, `klimax-piercing-b`, `slim-piercing-b`) szerkezetéből és szövegéből épül, a kategóriaoldalak dizájnjával, **„b” nélküli címen**
  (a menü és a belső linkek ide mutatnak; `/uj/uj-…-b` cím nincs). Az eredeti (régi) kategória-sablon csak az allergia / máj / pajzsmirigy / lép / vastagbél oldalnak marad (nincs `-b` oldaluk).
  A leképezés: `B_ALAP` a `tools/uj-oldalak/kategoria.mjs`-ben, a kiírás `tools/uj-fooldal.mjs` (`ujOldalak`); a stílus az `assets/css/uj-kategoria.css` végén (B szakasz). Az első galériakép „Lapozz jobbra”
  jelzését a `tools/uj-b-hos-kep.py` rajzolja (`assets/img/uj-hos-01.webp`), a „Miért a Medical Piercinget válaszd?” ikonjait a `tools/uj-b-ikonok.py` színezi a főoldal palettájára (`assets/img/uj-biz-*.webp`).
  A `tools/uj-oldalak-teszt.mjs` ezekre az oldalakra az eredeti `-b` oldalhoz hasonlít. A `/uj/…-b` tükör-oldalak (az eredeti `-b` oldalak általános sablonnal készült másolatai) megmaradnak.
- **Kézzel írt új oldalak és közös szövegjavítás** (2026-10-16): az `uj-oldalak/sajat/<név>.html` → `/uj/<név>` (első sor: `<!--oldal {"cim","leiras"} -->`, utána a `<main>` tartalma
  a közös részekkel, pl. `<!--#helyszinek-->`, `<!--#velemenyek ti=<Trustindex-kulcs>-->`); ha ugyanilyen című tükör-oldal is van, a kézzel írt az erősebb. Így készült: Csapatunk, Kapcsolat,
  Ékszereink, Helyszíneink (`elerhetosegek`), Vélemények, Garancia. A Gabi története, a Rólunk és az őszi akció oldala a B-oldalak építőjével készül (`B_ALAP`, `HOS_CIM` a `kategoria.mjs`-ben).
  A `tools/uj-fooldal.mjs` `szovegJavit` minden új lapon: nincs arany / 14 karátos bevonat (helyette „magas minőségű orvosi fém, G23 titánium”), a régi „4.100+” véleményszám helyett
  a Google mostani száma (`GOOGLE_DB` tartalék, a lap a `/api/ertekeles`-ből frissíti). A hős badge-sora közös: `uj-oldalak/reszek/bizalom.html`.
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
  tudnivalók, elérhetőségek, nyitvatartás (H–P 09:00–19:00, Szo 09:00–18:00, V zárva; a tulajdonos szerint a 9–19 a helyes – a régi oldalak láblécében álló „H-P: 10:00 - 19:00”-t a `tools/build.mjs` is javítja), két foglalás-gomb, jogi szövegek.
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
- **A hirdetések céloldalai** (Meta, TikTok; 2026-10-16-i lista) mind formázottak az `/uj` alatt; a két utolsó: `/kozerzetjavito-piercing-soft-akcio` (a TikTok-landoló) és `/3-piercing-2-araert`
  („Páros kedvezmény”), a B-építővel. A közös dobozok (akció, árak, ékszerek, helyszínek, piercingek, média, csapat) egy oldalon csak egyszer jelennek meg.
- **A foglalómotor Piercing-lépése** (a tulajdonos látványterve és kérései, 2026-10-16; `assets/js/motor/motor.js`, `szolgRajzol` / `pkKartya` / `pkAdat` / `arakBol`): nincs fejléc-doboz;
  kicsi szűrősor (Magamnak / Két személynek; 1 piercing / 2–3 piercing / Fülbevaló – asztalon egy sor, mobilon kettő), a „★ 4,8 · 5000+ értékelés” mellett egy sorban a „Hogy néz ki egy szúrás?”
  (felugró, bezárható videó: X, háttér, Esc), kicsi „Az ár tartalmazza”, alatta MINDEN lehetőség kártyája (nincs rejtett „+ többi”). Minden kártyán két gomb: „Részletek” (lenyitja: a pont helye
  a valódi fülfotóval, mire jó, garancia; a csomagoknál a kedvezmény levezetése a helyszín mostani Salonic-áraiból: 1./2./3. piercing ára, külön-külön mennyi lenne, mennyit spórol) és az erős
  színű „Időpontot választok” (a régi `[data-szolg]`: a foglalási út, a mérés és a tesztek ugyanazok). Alapérték: Magamnak + **2–3 piercing** (a tulajdonos kérése, 2026-10-16, 5. kor: „alapból a 2–3 piercing legyen kiválasztva”; a divat fülpiercing oldaláról 1 piercing), 1 piercingnél a típusoldal piercingje elöl; a „Legjobban megéri” jelölés lefelé mutató nyíllal pontosan a „2–3 piercing” gomb fölött, két sorban a „Magamnak / 2 személynek” feljebb, a jelölés a két sor között; a kártyák Részletek-részében a garancia: „ha 6–7 hét után nem tapasztalsz javulást, megerősítő piercinget szúrunk.”; MINDEN kártya csukva, a 2–3 piercingnél is (a tulajdonos kérése, 2026-10-16, 4. kör:
  „lássa, hogy milyen piercingek vannak”). A nevek teljesek („Migrén piercing”, „Shenmen piercing”, „Slim piercing”, …). A szűrősor 385–520 px között is egy sorban (rövid felirat:
  „1 db”, „2–3 db”), alatta két sorban. Az „Az ár tartalmazza” a kártya Részletek-részében van, nem a lista fölött. A szakember-lépés választói mobilon egy sorban.
  A „Kiesett ékszer újraszúrása” belsős Salonic-szolgáltatás (a tulajdonos döntése, 2026-10-16): NEM foglalható, a piercing-listából kimarad (`ujraszuras`, `szolgaltatasLepes`);
  az „Ékszercsere / visszarakás” visszahívó űrlap legördülőjében kérhető (közérzetjavító / fülbevaló, `LEHETOSEG.ekszercsere`). A szűrősorban „2 személynek”, a „2–3 piercing” gombon
  „Legjobban megéri” jelölés; az értékelés a pontos szám a `/api/ertekeles`-ből (a Trustindex-doboz fejléce), nem „5000+”. A „Hogy néz ki egy szúrás?” videója a TikTok-fiók legnézettebb
  organikus shenmen-szúrós videója (`assets/video/uj-shenmen-szuras.mp4`). A helyszín-lépésben a térkép (rámutatva a cím), a fejlécben a választott város.

