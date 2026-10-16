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
- **Az új, rejtett oldalak (`/uj-fooldal`, `/uj/...`) változtatásait is azonnal élesítjük** (a tulajdonos döntése, 2026-10-16, felülírja a 2026-10-13-ast):
  „Ha végeztél …, akkor légy szíves élesítsd, ne is kérdezz meg, mindig élesítsd, mindig tedd ki. Nekem ne linkeket csinálj, hanem ezen a /uj oldalon … hogy itt tudjuk tesztelni élesen.”
  Minden kérés után: build, a két teszt (`tools/uj-fooldal-teszt.mjs`, `tools/uj-oldalak-teszt.mjs`, helyben), commit, push, PR a `main`-re, merge, majd ellenőrzés az éles
  `https://www.medicalpiercing.hu/uj/...` oldalakon; a tulajdonosnak az éles `/uj/...` linkeket add, ne az előnézetet. A lapok továbbra is rejtettek (noindex, nincs a sitemapben, a régi oldalak nem linkelik).
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
  színű „Időpontot választok” (a régi `[data-szolg]`: a foglalási út, a mérés és a tesztek ugyanazok). Alapérték: Magamnak + 1 piercing, a típusoldal piercingje elöl és lenyitva (az akció-oldalról: 2–3 piercing).
  A „Kiesett ékszer újraszúrása” belsős Salonic-szolgáltatás (a tulajdonos döntése, 2026-10-16): NEM foglalható, a piercing-listából kimarad (`ujraszuras`, `szolgaltatasLepes`);
  az „Ékszercsere / visszarakás” visszahívó űrlap legördülőjében kérhető (közérzetjavító / fülbevaló, `LEHETOSEG.ekszercsere`). A szűrősorban „2 személynek”, a „2–3 piercing” gombon
  „Legjobban megéri” jelölés; az értékelés a pontos szám a `/api/ertekeles`-ből (a Trustindex-doboz fejléce), nem „5000+”. A „Hogy néz ki egy szúrás?” videója a TikTok-fiók legnézettebb
  organikus shenmen-szúrós videója (`assets/video/uj-shenmen-szuras.mp4`). A helyszín-lépésben a térkép (rámutatva a cím), a fejlécben a választott város.

