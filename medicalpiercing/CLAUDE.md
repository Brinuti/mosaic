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
- **A B-oldalak építőjével készül még** (`B_ALAP`, `HOS_CIM`): az 5 piercer-bemutatkozó oldal (név a cím, portré a hősben, a videók rácsban: `videoracs`), A szúrás folyamata, az Utóápolás és
  A piercingek eredete (egyszekciós oldal: a cím + az első videó a hős). Kézzel írt oldal lett az Árlista (`sajat/arlista-garancia.html`) és az Ajándékkártya (`sajat/ajandekkartya.html`;
  a vásárlás a `https://medicalpiercing.salonic.hu/giftcards` címen, a motor ezt nem fogja el).
- **Vendégek videós beszámolói** (2026-10-16): a tulajdonos Drive-járól 12 vendég-testimonial (a leirat alapján besorolva: migrén 6, slim 3, shenmen 2, klimax 1), webes változat
  `assets/video/uj-velemeny-<kulcs>-<n>.mp4` (480 px, H.264, 2–6 MB) + borító `assets/img/uj-velemeny-<kulcs>-<n>.webp`; a fájlnevekben nincs vendégnév. A blokk: `tools/uj-video-velemenyek.mjs`
  → `reszek/video-velemeny-<kulcs>.html`; a Vélemények oldalon a kategória Trustindex-blokkja alatt, a piercing-oldalakon az első vélemény-blokk alatt (`kategoria.mjs`, `velemeny`).
- **Google-vélemények mindenhol a főoldali lapozóval** (2026-10-16): az eredeti oldal saját Trustindex-widgetje csak akkor marad, ha rendes lapozó (`JO_VELEMENY_KULCSOK`, `sablon.mjs`);
  a 2 véleményes (783989…), az üres és az ismeretlen widget helyett a főoldali (daf9c4…, 35 vélemény). A tükör-oldalak Trustindex-beágyazása (assets/embed) is a főoldali doboz lett.
- **Helyszíneink hősképe**: Magyarország térképe a 15 helyszínnel (`tools/uj-helyszin-terkep.mjs` → `reszek/helyszin-terkep.html`, beágyazott SVG a lap betűjével).
- **A hirdetések céloldalai** (Meta, TikTok; 2026-10-16-i lista) mind formázottak az `/uj` alatt; a két utolsó: `/kozerzetjavito-piercing-soft-akcio` (a TikTok-landoló) és `/3-piercing-2-araert`
  („Páros kedvezmény”), a B-építővel. A közös dobozok (akció, árak, ékszerek, helyszínek, piercingek, média, csapat) egy oldalon csak egyszer jelennek meg.
- **A foglalómotor Piercing-lépése** (a tulajdonos látványterve és kérése, 2026-10-16; `assets/js/motor/motor.js`, `szolgRajzol` / `pkKartya` / `pkAdat`): fejléc („Melyik piercing érdekel?”, a helyszín),
  két szűrősor (Magamnak / Két személynek; 1 piercing / 2–3 piercing / Fülbevaló), „Az ár tartalmazza”, „Hogy néz ki egy szúrás?” (videó), lenyitható kártyák: a pont helye (a valódi fülfotó,
  `uj-galeria-<kulcs>-2.webp`, 1:1), mire jó, garancia, „+ 2–3 piercing” (a csomagra vált és lenyitja; a csomag: bármelyik piercing, most nem kell eldönteni, a szalonban segítünk).
  Alapérték: Magamnak + 1 piercing, a típusoldal piercingje elöl és lenyitva (az akció-oldalról: 2–3 piercing). A választás gombja a régi `[data-szolg]` (a foglalási út, a mérés és a tesztek ugyanazok).

