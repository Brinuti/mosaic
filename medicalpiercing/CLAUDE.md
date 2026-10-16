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
